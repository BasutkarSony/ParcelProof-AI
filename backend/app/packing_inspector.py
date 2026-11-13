"""AI vision packing inspection service with Groq/Gemini selection and OpenAI fallback.

This module isolates external vision-model calls from the deterministic shipment evidence engine (ai_analyzer.py).

Safety guarantees enforced here:
- inspection_status is always PENDING_HUMAN_REVIEW; the model never approves
  or rejects a shipment.
- The prompt explicitly instructs the model not to invent unseen contents, not
  to claim sealed-parcel contents are verified, and to express uncertainty
  explicitly.
- engine_metadata is honestly labelled as an LLM (zero_hallucination: False).
- Provider API keys are read from the environment and are never logged, echoed,
  or included in any response body.
- Provider responses are validated for structure before persistence; malformed
  responses raise RuntimeError.
- manifest_item_id values from every provider are cross-checked against the
  actual finalized manifest items before the result is trusted.
- Groq Qwen vision is limited to three images per request; larger photo sets
  are routed to Gemini rather than silently truncating evidence.
"""

import base64
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
import uuid as _uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Photo storage
# ---------------------------------------------------------------------------

DATA_DIR = Path(os.getenv("PARCELPROOF_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
PHOTO_DIR = DATA_DIR / "inspection_photos"

# Magic-byte signatures for supported image types.
_ALLOWED_SIGNATURES: dict[bytes, str] = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
}
_WEBP_RIFF = b"RIFF"
_WEBP_MARKER = b"WEBP"

MAX_PHOTOS_PER_INSPECTION = 5
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB


def _detect_mime(data: bytes) -> str | None:
    """Return the MIME type from magic bytes, or None if unsupported."""
    for sig, mime in _ALLOWED_SIGNATURES.items():
        if data[: len(sig)] == sig:
            return mime
    # WebP: bytes 0-3 == RIFF, bytes 8-11 == WEBP
    if len(data) >= 12 and data[:4] == _WEBP_RIFF and data[8:12] == _WEBP_MARKER:
        return "image/webp"
    return None


def validate_and_store_photo(raw_bytes: bytes, original_filename: str) -> dict:
    """Validate image magic bytes, persist to private storage, return metadata.

    Returns a dict with keys:
        id, path (internal Path — never expose in API responses),
        sha256, mime_type, size_bytes.

    Raises ValueError for oversized files, wrong magic bytes, or unsupported
    format.  Only JPEG, PNG, and WebP are accepted; the decision is based
    entirely on the file's magic bytes, not the caller-supplied filename or
    Content-Type header.
    """
    if len(raw_bytes) > MAX_PHOTO_BYTES:
        raise ValueError(
            f"Photo exceeds the 10 MB limit ({len(raw_bytes):,} bytes)."
        )

    mime = _detect_mime(raw_bytes)
    if mime is None:
        raise ValueError(
            f"'{original_filename}' is not a supported image type. "
            "Accepted formats: JPEG, PNG, WebP."
        )

    photo_id = str(_uuid.uuid4())
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[mime]

    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    dest = PHOTO_DIR / f"{photo_id}{ext}"
    dest.write_bytes(raw_bytes)

    digest = hashlib.sha256(raw_bytes).hexdigest()
    return {
        "id": photo_id,
        "path": dest,        # internal use only
        "sha256": digest,
        "mime_type": mime,
        "size_bytes": len(raw_bytes),
    }


# ---------------------------------------------------------------------------
# Gemini inspection schema
# ---------------------------------------------------------------------------

_VALID_RESULTS = {"MATCH", "POSSIBLE_MISSING", "POSSIBLE_EXTRA", "UNCERTAIN", "NOT_VISIBLE"}
_VALID_CONFIDENCE = {"LOW", "MEDIUM", "HIGH"}
_VALID_QUALITY = {"GOOD", "FAIR", "POOR", "UNUSABLE"}
_VALID_IDENTITY_ASSESSMENTS = {"CONSISTENT", "DIFFERENT", "UNCERTAIN", "NOT_ASSESSABLE"}

_INSPECTION_SCHEMA = {
    "type": "OBJECT",
    "required": [
        "image_quality",
        "item_checks",
        "additional_observations",
        "human_review_required",
        "inspection_summary",
    ],
    "properties": {
        "image_quality": {
            "type": "OBJECT",
            "required": ["overall", "photo_assessments", "limitations"],
            "properties": {
                "overall": {
                    "type": "STRING",
                    "description": "GOOD, FAIR, POOR, or UNUSABLE",
                },
                "photo_assessments": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "required": ["photo_index", "useful", "notes"],
                        "properties": {
                            "photo_index": {"type": "INTEGER"},
                            "useful": {"type": "BOOLEAN"},
                            "notes": {"type": "STRING"},
                        },
                    },
                },
                "limitations": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                },
            },
        },
        "item_checks": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "required": [
                    "manifest_item_id",
                    "sku",
                    "description",
                    "expected_qty",
                    "result",
                    "visual_evidence",
                    "confidence",
                    "identity_assessment",
                    "matched_features",
                ],
                "properties": {
                    "manifest_item_id": {"type": "STRING"},
                    "sku": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "expected_qty": {"type": "INTEGER"},
                    # observed_qty is nullable: null means genuinely uncertain.
                    # The google-genai SDK supports "nullable": true on leaf fields.
                    "observed_qty": {"type": "INTEGER", "nullable": True},
                    "result": {
                        "type": "STRING",
                        "description": (
                            "One of: MATCH, POSSIBLE_MISSING, POSSIBLE_EXTRA, "
                            "UNCERTAIN, NOT_VISIBLE"
                        ),
                    },
                    "visual_evidence": {"type": "STRING"},
                    "confidence": {
                        "type": "STRING",
                        "description": "One of: LOW, MEDIUM, HIGH",
                    },
                    "identity_assessment": {"type": "STRING", "description": "CONSISTENT, DIFFERENT, UNCERTAIN, or NOT_ASSESSABLE"},
                    "matched_features": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
            },
        },
        "additional_observations": {
            "type": "OBJECT",
            "required": [
                "possible_extra_items",
                "visible_product_damage",
                "visible_packaging_damage",
                "uncertainty_notes",
            ],
            "properties": {
                "possible_extra_items": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                },
                "visible_product_damage": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                },
                "visible_packaging_damage": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                },
                "uncertainty_notes": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                },
            },
        },
        "human_review_required": {
            "type": "BOOLEAN",
            "description": "Always true. Set to true unconditionally.",
        },
        "inspection_summary": {"type": "STRING"},
    },
}


def _build_prompt(
    manifest: dict,
    reference_metas: list[dict] | None = None,
    product_context: list[dict] | None = None,
    photo_count: int = 0,
) -> str:
    """Build the shared prompt for packing evidence and labelled catalogue references."""
    reference_metas = reference_metas or []
    product_context = product_context or []
    items_text = "\n".join(
        "  - Item ID: {id} | SKU: {sku} | Description: {desc} | "
        "Expected qty: {qty} | Fragile: {fragile}".format(
            id=item["id"],
            sku=item.get("sku") or "N/A",
            desc=item["description"],
            qty=item["expected_qty"],
            fragile="Yes" if item["fragile"] else "No",
        )
        for item in manifest["items"]
    )
    profile_lines = []
    for profile in product_context:
        gtin = profile.get("barcode_gtin") or "not supplied"
        status = profile.get("reference_image_status", "NOT_CONFIGURED")
        profile_lines.append(
            f"  - SKU {profile['sku']} | product: {profile.get('name') or 'not supplied'} | "
            f"identity description: {profile.get('description') or 'not supplied'} | "
            f"catalogue GTIN: {gtin} | reference image status: {status}"
        )
    reference_lines = [
        f"  - Catalogue reference image {index} belongs to SKU {meta['sku']}."
        for index, meta in enumerate(reference_metas, start=1)
    ]
    packing_photo_lines = [
        f"  - PACKING PHOTO {index}: actual merchant-captured evidence."
        for index in range(1, photo_count + 1)
    ]
    if reference_metas:
        image_order = (
            f"The first {len(reference_metas)} supplied images are catalogue reference "
            "images in the exact order listed below. The remaining supplied images "
            "are actual packing photos for this shipment."
        )
    else:
        image_order = "All supplied images are actual packing photographs for this shipment."

    return (
        "You are a packing verification assistant. Compare visible packing evidence "
        "with the finalized shipment manifest and its saved product identity profiles. "
        "The photographs are one evidence set for a single shipment.\n\n"
        f"SHIPMENT MANIFEST\n"
        f"  manifest_id     : {manifest['id']}\n"
        f"  fingerprint     : {manifest['manifest_hash']}\n"
        f"  shipment_ref    : {manifest['shipment_order_id']}\n\n"
        f"DECLARED ITEMS:\n{items_text}\n\n"
        "SAVED CATALOGUE IDENTITY PROFILES:\n"
        + ("\n".join(profile_lines) if profile_lines else "  - No product identity profiles are saved.")
        + "\n"
        + ("CATALOGUE REFERENCE IMAGE ORDER:\n" + "\n".join(reference_lines) + "\n" if reference_lines else "")
        + ("ACTUAL PACKING PHOTO ORDER:\n" + "\n".join(packing_photo_lines) + "\n" if packing_photo_lines else "")
        + "IMAGE ORDER:\n" + image_order + "\n\n"
        "MANDATORY INSTRUCTIONS — follow exactly:\n"
        "1. Catalogue reference images are examples of the expected product. They are "
        "NOT items physically packed in this shipment. Never count a reference image "
        "as an observed item, extra item or packing photograph. Compare its visible "
        "product appearance only with the actual packing photographs for the matching SKU.\n"
        "2. Only describe what is VISIBLY PRESENT in the actual packing photographs. "
        "Do not invent or assume unseen contents under any circumstances.\n"
        "3. A SKU is an internal merchant/catalogue identifier, not a physical product "
        "feature. It is not expected to be printed on the product or visible in a photo. "
        "Never mark an item as a mismatch or missing solely because the SKU cannot be read. "
        "Never mark a mismatch or missing item solely because the SKU cannot be read. "
        "Compare the human-readable description and only physical attributes stated in "
        "the manifest or saved product profile.\n"
        "4. If a catalogue GTIN is supplied, it is metadata, not proof that the barcode "
        "was scanned. Only report a GTIN as visually matched when its human-readable "
        "digits are clearly visible on the actual packing item or label. Do not claim "
        "that barcode bars were decoded by a scanner. An unreadable or absent label "
        "does not by itself mean the product is wrong.\n"
        "5. Do not infer unlisted requirements beyond the manifest description or saved product profile. "
        "Separate object detection from product-variant checking. When the saved profile "
        "names a distinguishing attribute such as colour, printed design, size, model, "
        "material or finish, treat every named attribute as a required comparison. "
        "List the positive matches for those attributes individually in matched_features. "
        "Do not substitute generic clues such as mug shape or handle presence for a "
        "different required detail such as its print, colour or size. Set "
        "identity_assessment=CONSISTENT only when each explicitly named distinguishing "
        "attribute is visibly confirmed and at least two different physical attributes "
        "are listed. The attributes must not be repeated wording for the same clue "
        "(for example, 'navy' and 'blue' are both colour descriptions). Set DIFFERENT "
        "when a relevant visible feature conflicts. Set UNCERTAIN when a required "
        "attribute cannot be compared, and NOT_ASSESSABLE when there is no useful "
        "product identity reference. A general object category match (for example, "
        "'a ceramic mug is visible') is NOT enough to confirm a specific product variant. "
        "A visual similarity is supporting evidence, not proof of an exact SKU.\n"
        "6. Use result=MATCH only when identity_assessment=CONSISTENT, all explicitly "
        "named distinguishing attributes are confirmed, at least two different "
        "matched_features are listed, and observed_qty equals expected_qty. "
        "Otherwise use result=UNCERTAIN or the appropriate quantity observation.\n"
        "7. When referring to captured evidence, use PACKING PHOTO 1, PACKING PHOTO 2, "
        "and so on. Catalogue reference images are never counted in this numbering. "
        "photo_assessments.photo_index is one-based and refers only to packing photos. "
        "do not use the combined provider image position when numbering packing photos.\n"
        "8. Do NOT claim that the contents of sealed boxes, bags, or parcels have been "
        "verified. If a container is sealed or closed, state that its contents are NOT VISIBLE.\n"
        "9. Treat all actual packing photographs as one evidence set. Several photos may "
        "show different angles or sides of the same physical unit. Do not count a product "
        "once per photo. Count only distinct physical objects that are clearly visible. "
        "If you cannot tell whether photos show the same object or separate objects, "
        "use result=UNCERTAIN, set observed_qty=null, and explain the uncertainty.\n"
        "10. Clearly distinguish between 'not visible' and 'definitely absent'. Use "
        "result=NOT_VISIBLE when an item simply cannot be seen. Use result=POSSIBLE_MISSING "
        "only when the relevant unpacked contents are sufficiently visible to support it.\n"
        "11. Describe visible product damage and packaging damage separately. Do not "
        "infer damage that is hidden or not shown.\n"
        "12. Set human_review_required to true unconditionally. The model never approves "
        "or rejects a shipment. Express uncertainty honestly and use confidence=LOW when unsure.\n\n"
        "Return a JSON object matching the supplied schema exactly."
    )




# ---------------------------------------------------------------------------
# Optional OpenAI Vision fallback
# ---------------------------------------------------------------------------

def _openai_response_schema() -> dict:
    """Return a strict JSON Schema supported by OpenAI Structured Outputs."""
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "image_quality",
            "item_checks",
            "additional_observations",
            "human_review_required",
            "inspection_summary",
        ],
        "properties": {
            "image_quality": {
                "type": "object",
                "additionalProperties": False,
                "required": ["overall", "photo_assessments", "limitations"],
                "properties": {
                    "overall": {"type": "string", "enum": sorted(_VALID_QUALITY)},
                    "photo_assessments": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["photo_index", "useful", "notes"],
                            "properties": {
                                "photo_index": {"type": "integer"},
                                "useful": {"type": "boolean"},
                                "notes": {"type": "string"},
                            },
                        },
                    },
                    "limitations": {"type": "array", "items": {"type": "string"}},
                },
            },
            "item_checks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "manifest_item_id", "sku", "description", "expected_qty",
                        "observed_qty", "result", "visual_evidence", "confidence",
                        "identity_assessment", "matched_features",
                    ],
                    "properties": {
                        "manifest_item_id": {"type": "string"},
                        "sku": {"type": "string"},
                        "description": {"type": "string"},
                        "expected_qty": {"type": "integer"},
                        "observed_qty": {"type": ["integer", "null"]},
                        "result": {"type": "string", "enum": sorted(_VALID_RESULTS)},
                        "visual_evidence": {"type": "string"},
                        "confidence": {"type": "string", "enum": sorted(_VALID_CONFIDENCE)},
                        "identity_assessment": {"type": "string", "enum": sorted(_VALID_IDENTITY_ASSESSMENTS)},
                        "matched_features": {"type": "array", "items": {"type": "string"}},
                    },
                },
            },
            "additional_observations": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "possible_extra_items", "visible_product_damage",
                    "visible_packaging_damage", "uncertainty_notes",
                ],
                "properties": {
                    "possible_extra_items": {"type": "array", "items": {"type": "string"}},
                    "visible_product_damage": {"type": "array", "items": {"type": "string"}},
                    "visible_packaging_damage": {"type": "array", "items": {"type": "string"}},
                    "uncertainty_notes": {"type": "array", "items": {"type": "string"}},
                },
            },
            "human_review_required": {"type": "boolean"},
            "inspection_summary": {"type": "string"},
        },
    }


def _run_openai_inspection(
    manifest: dict,
    photo_metas: list[dict],
    api_key: str,
    reference_metas: list[dict] | None = None,
    product_context: list[dict] | None = None,
) -> dict:
    """Run packing photos and catalogue references through the optional OpenAI fallback."""
    reference_metas = reference_metas or []
    model = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    image_parts = []
    for meta in [*reference_metas, *photo_metas]:
        raw = meta.get("data") if isinstance(meta.get("data"), bytes) else Path(meta["path"]).read_bytes()
        encoded = base64.b64encode(raw).decode("ascii")
        image_parts.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{meta['mime_type']};base64,{encoded}",
                "detail": "high",
            },
        })

    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [{
                "type": "text",
                "text": _build_prompt(manifest, reference_metas, product_context, len(photo_metas)),
            }] + image_parts,
        }],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "packing_inspection",
                "strict": True,
                "schema": _openai_response_schema(),
            },
        },
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        timeout = max(15, min(int(os.getenv("OPENAI_VISION_TIMEOUT_SECONDS", "90")), 180))
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Report the HTTP status only; never echo credentials or provider response bodies.
        raise RuntimeError(
            f"OpenAI vision fallback request failed (HTTP {exc.code})."
        ) from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise RuntimeError(
            "OpenAI vision fallback could not complete the request."
        ) from None

    try:
        message = response_data["choices"][0]["message"]
        if message.get("refusal"):
            raise RuntimeError("OpenAI declined the packing inspection request.")
        ai_result = json.loads(message["content"])
    except (KeyError, IndexError, TypeError, ValueError):
        raise RuntimeError(
            "OpenAI vision fallback returned an unexpected response format."
        ) from None

    _validate_ai_result(ai_result, manifest, len(photo_metas) if photo_metas else None)
    _apply_conservative_identity_rules(ai_result, product_context)

    return {
        "ai_result": ai_result,
        "model_used": model,
        "engine_metadata": {
            "type": "OPENAI_VISION_LLM",
            "model": model,
            "auditable": False,
            "zero_hallucination": False,
            "disclaimer": (
                "Visual inspection only. Sealed container contents are not "
                "verified. This result requires human review before any "
                "shipment approval or rejection decision is made."
            ),
        },
    }



# ---------------------------------------------------------------------------
# Groq Qwen Vision provider
# ---------------------------------------------------------------------------

def _run_groq_inspection(
    manifest: dict,
    photo_metas: list[dict],
    api_key: str,
    reference_metas: list[dict] | None = None,
    product_context: list[dict] | None = None,
) -> dict:
    """Run Groq Qwen vision with both catalogue references and packing evidence.

    Groq accepts at most three images in total. Never truncate either group:
    callers must route a larger combined set to Gemini or another provider.
    """
    reference_metas = reference_metas or []
    if not photo_metas:
        raise RuntimeError("Groq vision inspection requires at least one packing photo.")
    if len(reference_metas) + len(photo_metas) > 3:
        raise RuntimeError(
            "Groq Qwen vision accepts up to 3 images in total. "
            "Use Gemini to analyse every catalogue reference and packing photo."
        )

    model = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b").strip() or "qwen/qwen3.8-27b"
    image_parts = []
    for meta in [*reference_metas, *photo_metas]:
        raw = meta.get("data") if isinstance(meta.get("data"), bytes) else Path(meta["path"]).read_bytes()
        encoded = base64.b64encode(raw).decode("ascii")
        image_parts.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{meta['mime_type']};base64,{encoded}",
                "detail": "high",
            },
        })

    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [{
                "type": "text",
                "text": _build_prompt(manifest, reference_metas, product_context, len(photo_metas)),
            }] + image_parts,
        }],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "packing_inspection",
                "strict": True,
                "schema": _openai_response_schema(),
            },
        },
    }

    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        timeout = max(15, min(int(os.getenv("GROQ_VISION_TIMEOUT_SECONDS", "90")), 180))
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            message = f"Groq rejected the configured API key (HTTP {exc.code})."
        elif exc.code == 404:
            message = (
                f"Groq could not find model {model!r} (HTTP 404). "
                "Check GROQ_VISION_MODEL and model access."
            )
        elif exc.code == 429:
            message = (
                "Groq vision rate or quota limit reached (HTTP 429). "
                "Check the Groq console limits and retry after the applicable reset."
            )
        elif exc.code >= 500:
            message = f"Groq vision is temporarily unavailable (HTTP {exc.code})."
        else:
            message = f"Groq rejected the vision request (HTTP {exc.code})."
        raise RuntimeError(message) from None
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        raise RuntimeError("Groq vision request could not complete. Check provider availability.") from None

    try:
        message = response_data["choices"][0]["message"]
        if message.get("refusal"):
            raise RuntimeError("Groq declined the packing inspection request.")
        ai_result = json.loads(message["content"])
    except (KeyError, IndexError, TypeError, ValueError):
        raise RuntimeError("Groq vision returned an unexpected response format.") from None

    _validate_ai_result(ai_result, manifest, len(photo_metas) if photo_metas else None)
    _apply_conservative_identity_rules(ai_result, product_context)

    return {
        "ai_result": ai_result,
        "model_used": model,
        "engine_metadata": {
            "type": "GROQ_VISION_LLM",
            "model": model,
            "auditable": False,
            "zero_hallucination": False,
            "disclaimer": (
                "Visual inspection only. Sealed container contents are not "
                "verified. This result requires human review before any "
                "shipment approval or rejection decision is made."
            ),
        },
    }



def _is_retryable_gemini_error(exc: Exception) -> bool:
    """Retry transient provider outages, but never hammer rate/quota-limited requests."""
    code = getattr(exc, "code", None)
    status = str(getattr(exc, "status", "") or "").upper()
    message = str(getattr(exc, "message", "") or str(exc)).upper()

    # Google uses 429 for both short-window rate limits and exhausted daily quota.
    # A rapid server-side retry cannot reliably resolve either, so preserve evidence
    # and let the operator retry after the reported rate window or quota reset.
    if code == 429 or "429" in message or "429" in status or "RESOURCE_EXHAUSTED" in message:
        return False

    return code in (500, 502, 503, 504) or any(
        token in message or token in status for token in (
            "500", "502", "503", "504", "UNAVAILABLE", "INTERNAL",
        )
    )


def _is_gemini_unavailable(exc: Exception) -> bool:
    code = getattr(exc, "code", None)
    message = str(exc).upper()
    return code in (429, 500, 502, 503, 504) or any(
        token in message for token in (
            "429", "500", "502", "503", "504",
            "RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL",
        )
    )


def _gemini_failure_message(exc: Exception) -> str:
    """Return a safe, actionable provider diagnostic without exposing request data or keys."""
    code = getattr(exc, "code", None)
    status = str(getattr(exc, "status", "") or "").upper()
    message = str(getattr(exc, "message", "") or str(exc)).upper()

    if "API_KEY_INVALID" in message or "API KEY NOT VALID" in message or code == 401:
        return (
            "Gemini rejected the configured API key. Generate a valid Gemini API key "
            "in Google AI Studio, update GEMINI_API_KEY in Render, and redeploy."
        )
    if code == 403 or "PERMISSION_DENIED" in status or "PERMISSION_DENIED" in message:
        return (
            "Gemini denied access to this API key (HTTP 403). Check that the key's "
            "Google project has Gemini API access and that key restrictions allow it."
        )
    if code == 404 or "NOT_FOUND" in status or "NOT_FOUND" in message:
        return (
            "Gemini could not find the configured model (HTTP 404). Check GEMINI_MODEL "
            "against the models available to this API key."
        )
    if code == 400 or "INVALID_ARGUMENT" in status or "INVALID_ARGUMENT" in message:
        return (
            "Gemini rejected the inspection request (HTTP 400). The configured model "
            "or structured-output schema may not support this request."
        )
    if code == 429 or "429" in status or "429" in message or "RESOURCE_EXHAUSTED" in status or "RESOURCE_EXHAUSTED" in message:
        if "QUOTA_EXCEEDED" in status or "QUOTA_EXCEEDED" in message or "DAILY QUOTA" in message:
            return (
                "Gemini daily quota was exhausted (HTTP 429). Check the Google AI "
                "project's quota and wait for the quota reset, or request a quota increase. "
                "This request was not automatically retried."
            )
        if "RATE_LIMIT_EXCEEDED" in status or "RATE_LIMIT_EXCEEDED" in message or "TOO_MANY_REQUESTS" in message:
            return (
                "Gemini's short-window rate limit was reached (HTTP 429). Wait for the "
                "rate window to reset before retrying. This request was not automatically retried."
            )
        return (
            "Gemini returned HTTP 429, which can indicate a short-window rate limit or "
            "an exhausted daily quota. Check the Google AI project's usage details, wait "
            "for the applicable limit to reset, then retry. This request was not automatically retried."
        )
    if code == 503 or "UNAVAILABLE" in status or "UNAVAILABLE" in message:
        return (
            "Gemini service is temporarily unavailable or overloaded (HTTP 503) "
            "after a retry. Wait for the provider to recover, then retry the "
            "inspection. This is different from a quota limit."
        )
    if code in (500, 502, 504):
        return (
            f"Gemini returned a temporary provider error (HTTP {code}) after a retry. "
            "Wait briefly for the service to recover, then retry the inspection."
        )
    if code is not None:
        return f"Gemini inspection request failed with HTTP {code}."
    return (
        "Gemini inspection request failed before an HTTP response was received "
        f"({type(exc).__name__}). Check the deployed Gemini model and API configuration."
    )


# ---------------------------------------------------------------------------
# Public inspection entry point
# ---------------------------------------------------------------------------

class GeminiUnavailableError(RuntimeError):
    """Raised when no usable vision provider is configured or available."""

    def __init__(self, message: str, status_code: int = 503):
        super().__init__(message)
        self.status_code = status_code


def _validate_ai_result(
    ai_result: dict,
    manifest: dict,
    photo_count: int | None = None,
) -> None:
    """Validate the structure of a vision-model response before persistence.

    Raises RuntimeError with a descriptive message on any violation.
    Does not modify ai_result.
    """
    _REQUIRED_TOP = {
        "image_quality", "item_checks", "additional_observations",
        "human_review_required", "inspection_summary",
    }
    missing_top = _REQUIRED_TOP - ai_result.keys()
    if missing_top:
        raise RuntimeError(
            f"Vision response is missing required fields: {sorted(missing_top)}"
        )

    # image_quality
    iq = ai_result["image_quality"]
    if not isinstance(iq, dict):
        raise RuntimeError("Vision response: image_quality must be an object.")
    if iq.get("overall") not in _VALID_QUALITY:
        raise RuntimeError(
            f"Vision response: image_quality.overall must be one of "
            f"{sorted(_VALID_QUALITY)}, got {iq.get('overall')!r}."
        )

    # item_checks
    item_checks = ai_result["item_checks"]
    if not isinstance(item_checks, list):
        raise RuntimeError("Vision response: item_checks must be an array.")

    valid_item_ids = {item["id"] for item in manifest.get("items", [])}
    for idx, check in enumerate(item_checks):
        if not isinstance(check, dict):
            raise RuntimeError(f"Vision response: item_checks[{idx}] must be an object.")

        for field in ("manifest_item_id", "description", "result",
                      "visual_evidence", "confidence", "identity_assessment"):
            if not isinstance(check.get(field), str):
                raise RuntimeError(
                    f"Vision response: item_checks[{idx}].{field} must be a string."
                )

        item_id = check["manifest_item_id"]
        if valid_item_ids and item_id not in valid_item_ids:
            raise RuntimeError(
                f"Vision response: item_checks[{idx}].manifest_item_id "
                f"{item_id!r} does not match any item in the finalized manifest."
            )

        result_val = check["result"]
        if result_val not in _VALID_RESULTS:
            raise RuntimeError(
                f"Vision response: item_checks[{idx}].result must be one of "
                f"{sorted(_VALID_RESULTS)}, got {result_val!r}."
            )

        confidence = check["confidence"]
        if confidence not in _VALID_CONFIDENCE:
            raise RuntimeError(
                f"Vision response: item_checks[{idx}].confidence must be one of "
                f"{sorted(_VALID_CONFIDENCE)}, got {confidence!r}."
            )

        identity_assessment = check["identity_assessment"]
        if identity_assessment not in _VALID_IDENTITY_ASSESSMENTS:
            raise RuntimeError(
                f"Vision response: item_checks[{idx}].identity_assessment must be one of "
                f"{sorted(_VALID_IDENTITY_ASSESSMENTS)}, got {identity_assessment!r}."
            )
        matched_features = check.get("matched_features")
        if not isinstance(matched_features, list) or any(
            not isinstance(feature, str) for feature in matched_features
        ):
            raise RuntimeError(
                f"Vision response: item_checks[{idx}].matched_features must be an array of strings."
            )

        # observed_qty is nullable; None is valid (honest uncertainty).
        # Non-null values must be integers.
        obs_qty = check.get("observed_qty")
        if obs_qty is not None and not isinstance(obs_qty, int):
            raise RuntimeError(
                f"Vision response: item_checks[{idx}].observed_qty must be an "
                f"integer or null, got {type(obs_qty).__name__!r}."
            )

    # Packing-photo numbers are one-based and exclude catalogue-reference images.
    if photo_count is not None:
        assessments = ai_result["image_quality"].get("photo_assessments")
        if not isinstance(assessments, list):
            raise RuntimeError("Vision response: photo_assessments must be an array.")
        for index, assessment in enumerate(assessments):
            if not isinstance(assessment, dict):
                raise RuntimeError(f"Vision response: photo_assessments[{index}] must be an object.")
            photo_index = assessment.get("photo_index")
            if not isinstance(photo_index, int) or photo_index < 1 or photo_index > photo_count:
                raise RuntimeError(
                    f"Vision response: photo_assessments[{index}].photo_index must refer to "
                    f"a packing photo numbered 1 to {photo_count}; catalogue references are excluded."
                )

    # additional_observations
    ao = ai_result["additional_observations"]
    if not isinstance(ao, dict):
        raise RuntimeError("Vision response: additional_observations must be an object.")
    for list_field in ("possible_extra_items", "visible_product_damage",
                       "visible_packaging_damage", "uncertainty_notes"):
        if not isinstance(ao.get(list_field), list):
            raise RuntimeError(
                f"Vision response: additional_observations.{list_field} must be an array."
            )



_PROFILE_ATTRIBUTE_REQUIREMENTS = {
    "colour": re.compile(r"\bcolou?r\b", re.IGNORECASE),
    "design": re.compile(r"\b(?:print(?:ed)?|design|pattern|motif|graphic|logo)\b", re.IGNORECASE),
    "size": re.compile(r"\b(?:size|dimensions?|measurements?|A[0-6])\b", re.IGNORECASE),
    "model": re.compile(r"\b(?:model|version|edition|generation|series)\b", re.IGNORECASE),
    "material": re.compile(r"\b(?:material|fabric|composition)\b", re.IGNORECASE),
    "finish": re.compile(r"\b(?:finish|glaze|coating|texture)\b", re.IGNORECASE),
}

_FEATURE_ATTRIBUTE_MARKERS = {
    "colour": re.compile(
        r"\b(?:colou?r|black|white|beige|cream|ivory|blue|navy|red|green|yellow|"
        r"grey|gray|pink|purple|brown|orange|neutral|gold|silver|teal|maroon)\b",
        re.IGNORECASE,
    ),
    "design": re.compile(
        r"\b(?:design|pattern|print(?:ed)?|floral|botanical|leaf|leaves|motif|"
        r"graphic|logo|illustration|artwork|embroidered|embroidery|embossed|"
        r"engraved|striped|stripe|plaid|checked|polka)\b",
        re.IGNORECASE,
    ),
    "size": re.compile(
        r"\b(?:size|dimension|measurement|A[0-6]|small|medium|large|XL|XXL)\b",
        re.IGNORECASE,
    ),
    "model": re.compile(
        r"\b(?:model|version|edition|generation|series)\b",
        re.IGNORECASE,
    ),
    "material": re.compile(
        r"\b(?:material|fabric|composition|ceramic|stoneware|cotton|leather|"
        r"steel|stainless|plastic|glass|wooden|wood)\b",
        re.IGNORECASE,
    ),
    "finish": re.compile(
        r"\b(?:finish|glaze|coating|texture|matte|glossy|satin|polished|brushed)\b",
        re.IGNORECASE,
    ),
}

_ATTRIBUTE_LABELS = {
    "colour": "colour",
    "design": "printed design",
    "size": "size",
    "model": "model",
    "material": "material",
    "finish": "finish",
}


def _required_profile_attributes(description: str) -> set[str]:
    """Find variant attributes the merchant explicitly asked the model to compare."""
    return {
        attribute
        for attribute, pattern in _PROFILE_ATTRIBUTE_REQUIREMENTS.items()
        if pattern.search(description or "")
    }


def _confirmed_feature_attributes(features: list[str]) -> set[str]:
    """Map positive model-reported features to the attributes they actually describe."""
    confirmed = set()
    for feature in features:
        value = str(feature).strip()
        if not value:
            continue
        # matched_features must describe a positive agreement, not a discrepancy.
        if re.search(r"\b(?:no|not|without|absent|missing|plain|blank|unprinted)\b", value, re.IGNORECASE):
            continue
        for attribute, pattern in _FEATURE_ATTRIBUTE_MARKERS.items():
            if pattern.search(value):
                confirmed.add(attribute)
    return confirmed


def _apply_conservative_identity_rules(
    ai_result: dict,
    product_context: list[dict] | None = None,
) -> dict:
    """Downgrade MATCH claims missing quantity, distinct evidence or required variant details."""
    notes = ai_result.setdefault("additional_observations", {}).setdefault("uncertainty_notes", [])
    profiles_by_sku = {
        str(profile.get("sku") or "").strip(): profile
        for profile in (product_context or [])
        if str(profile.get("sku") or "").strip()
    }
    for check in ai_result.get("item_checks", []):
        if check.get("result") != "MATCH":
            continue
        expected = check.get("expected_qty")
        observed = check.get("observed_qty")
        if isinstance(expected, int) and isinstance(observed, int) and observed != expected:
            check["result"] = "POSSIBLE_MISSING" if observed < expected else "POSSIBLE_EXTRA"
            check["confidence"] = "LOW"
            notes.append(
                f"{check.get('sku') or check.get('description')}: the model reported a visual match "
                f"but counted {observed} item(s) against {expected} expected. The result was "
                "changed to a quantity discrepancy for merchant review."
            )
            continue
        # Count independent visible attributes, not repeated wording of the same clue.
        features = []
        seen_features = set()
        for item in check.get("matched_features", []):
            feature = " ".join(str(item).split())
            normalized_feature = feature.casefold()
            if feature and normalized_feature not in seen_features:
                features.append(feature)
                seen_features.add(normalized_feature)
        sku = str(check.get("sku") or "").strip()
        profile = profiles_by_sku.get(sku, {})
        required_attributes = _required_profile_attributes(profile.get("description") or "")
        confirmed_attributes = _confirmed_feature_attributes(features)
        missing_attributes = sorted(required_attributes - confirmed_attributes)

        if (
            check.get("identity_assessment") != "CONSISTENT"
            or len(features) < 2
            or observed is None
            or missing_attributes
        ):
            check["result"] = "UNCERTAIN"
            check["confidence"] = "LOW"
            assessment = check.get("identity_assessment")
            reasons = []
            if assessment == "DIFFERENT":
                reasons.append("The model reports a visible product-identity difference.")
            elif assessment == "NOT_ASSESSABLE":
                reasons.append("The exact product identity cannot be assessed from the saved reference information.")
            elif assessment != "CONSISTENT":
                reasons.append("The model did not confirm a consistent product identity.")
            if len(features) < 2:
                reasons.append("Fewer than two different visible product attributes were provided.")
            if observed is None:
                reasons.append("The visible quantity could not be confirmed.")
            if missing_attributes:
                missing_labels = [_ATTRIBUTE_LABELS[item] for item in missing_attributes]
                reasons.append(
                    "The saved product profile asks for "
                    + ", ".join(missing_labels)
                    + ", but the model did not explicitly confirm "
                    + ("it." if len(missing_labels) == 1 else "them.")
                )
            notes.append(
                f"{sku or check.get('description')}: "
                + " ".join(reasons)
                + " The original MATCH claim was downgraded to UNCERTAIN and requires merchant review."
            )
    ai_result["human_review_required"] = True
    return ai_result


def _run_gemini_inspection(
    manifest: dict,
    photo_metas: list[dict],
    reference_metas: list[dict] | None = None,
    product_context: list[dict] | None = None,
) -> dict:
    """Run Gemini with catalogue references and every submitted packing photo.

    Gemini is attempted first. A single short retry is made for transient server
    errors. If Gemini remains unavailable, OPENAI_API_KEY enables a vision
    fallback. The same references, photos, prompt, schema checks and human-review
    invariant are applied to both providers.
    """
    reference_metas = reference_metas or []
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    if not api_key:
        if openai_key:
            if not reference_metas and not product_context:
                return _run_openai_inspection(manifest, photo_metas, openai_key)
            return _run_openai_inspection(
                manifest, photo_metas, openai_key, reference_metas, product_context
            )
        raise GeminiUnavailableError(
            "No vision provider is configured. Add GEMINI_API_KEY or OPENAI_API_KEY to backend/.env."
        )

    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"

    # Import here so unit tests can run without a live provider connection.
    from google import genai
    from google.genai import types

    try:
        timeout_ms = int(os.getenv("GEMINI_TIMEOUT_MS", "75000"))
    except (TypeError, ValueError):
        timeout_ms = 75000
    timeout_ms = max(15000, min(timeout_ms, 120000))
    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=timeout_ms,
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )

    # Catalogue references are sent first, then the actual packing photographs.
    # The prompt labels each reference image and explicitly forbids counting it.
    prompt_text = _build_prompt(manifest, reference_metas, product_context, len(photo_metas))
    contents: list = [prompt_text]
    for meta in [*reference_metas, *photo_metas]:
        raw = meta.get("data") if isinstance(meta.get("data"), bytes) else Path(meta["path"]).read_bytes()
        contents.append(
            types.Part.from_bytes(data=raw, mime_type=meta["mime_type"])
        )

    import json as _json
    try:
        from google.genai import errors as genai_errors
    except ImportError:
        genai_errors = None

    response = None
    final_error = None
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_INSPECTION_SCHEMA,
                ),
            )
            break
        except Exception as exc:
            final_error = exc
            if attempt == 0 and _is_retryable_gemini_error(exc):
                time.sleep(0.5)
                continue
            break

    if response is None:
        if final_error and _is_gemini_unavailable(final_error):
            primary_diagnostic = _gemini_failure_message(final_error)
            if openai_key:
                try:
                    return _run_openai_inspection(
                        manifest, photo_metas, openai_key, reference_metas, product_context
                    )
                except RuntimeError:
                    raise RuntimeError(
                        f"{primary_diagnostic} The optional OpenAI vision fallback also failed. "
                        "Check its configured model and API access."
                    ) from None
            provider_status = 429 if getattr(final_error, "code", None) == 429 or "RESOURCE_EXHAUSTED" in str(final_error).upper() else 503
            raise GeminiUnavailableError(
                f"{primary_diagnostic} OPENAI_API_KEY may be configured as an optional fallback.",
                status_code=provider_status,
            ) from None
        raise RuntimeError(_gemini_failure_message(final_error)) from None

    try:
        ai_result = _json.loads(response.text)
    except (ValueError, AttributeError) as exc:
        raise RuntimeError(
            "Gemini returned an unexpected response format."
        ) from exc

    # Validate structure, packing-photo numbering and manifest item IDs before persistence.
    _validate_ai_result(ai_result, manifest, len(photo_metas) if photo_metas else None)
    _apply_conservative_identity_rules(ai_result, product_context)

    # Hard-enforce the safety invariant regardless of what the model returned.
    ai_result["human_review_required"] = True

    return {
        "ai_result": ai_result,
        "model_used": model,
        "engine_metadata": {
            "type": "GEMINI_VISION_LLM",
            "model": model,
            "auditable": False,
            "zero_hallucination": False,
            "disclaimer": (
                "Visual inspection only. Sealed container contents are not "
                "verified. This result requires human review before any "
                "shipment approval or rejection decision is made."
            ),
        },
    }


def run_inspection(
    manifest: dict,
    photo_metas: list[dict],
    reference_metas: list[dict] | None = None,
    product_context: list[dict] | None = None,
) -> dict:
    """Select a vision provider without dropping catalogue references or parcel photos.

    Groq is used only when the combined reference + packing image count is at
    most three. Larger sets go to Gemini (or the configured OpenAI fallback).
    """
    reference_metas = reference_metas or []
    product_context = product_context or []
    total_images = len(reference_metas) + len(photo_metas)
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    preference = os.getenv("PACKING_VISION_PROVIDER", "auto").strip().lower() or "auto"

    if preference not in {"auto", "groq", "gemini"}:
        raise RuntimeError(
            "PACKING_VISION_PROVIDER must be one of: auto, groq, gemini."
        )

    groq_can_process = total_images <= 3
    groq_first = preference == "groq" or (
        preference == "auto" and bool(groq_key) and groq_can_process
    )
    failures = []

    def try_groq():
        if not groq_key:
            raise RuntimeError("GROQ_API_KEY is not configured.")
        if not groq_can_process:
            raise RuntimeError(
                "Groq Qwen accepts up to three images in total. Gemini is required "
                "to analyse every catalogue reference and packing photo."
            )
        if not reference_metas and not product_context:
            return _run_groq_inspection(manifest, photo_metas, groq_key)
        return _run_groq_inspection(
            manifest, photo_metas, groq_key, reference_metas, product_context
        )

    if groq_first and groq_key:
        try:
            return try_groq()
        except RuntimeError as exc:
            failures.append(str(exc))

    if gemini_key:
        try:
            if not reference_metas and not product_context:
                return _run_gemini_inspection(manifest, photo_metas)
            return _run_gemini_inspection(
                manifest, photo_metas, reference_metas, product_context
            )
        except RuntimeError as exc:
            failures.append(str(exc))

    if not groq_first and groq_key:
        try:
            return try_groq()
        except RuntimeError as exc:
            failures.append(str(exc))

    if openai_key and not gemini_key:
        if not reference_metas and not product_context:
            return _run_openai_inspection(manifest, photo_metas, openai_key)
        return _run_openai_inspection(
            manifest, photo_metas, openai_key, reference_metas, product_context
        )

    if failures:
        combined = " ".join(failures)
        status_code = 429 if "HTTP 429" in combined else 503
        raise GeminiUnavailableError(
            "No configured vision provider completed the inspection. " + combined,
            status_code=status_code,
        ) from None

    if groq_key and not groq_can_process and not gemini_key:
        raise GeminiUnavailableError(
            f"This inspection contains {total_images} catalogue and packing images. "
            "Groq Qwen accepts up to three images in total; configure GEMINI_API_KEY "
            "or OPENAI_API_KEY to analyse the complete evidence set.",
        )

    raise GeminiUnavailableError(
        "No vision provider is configured. Add GROQ_API_KEY or GEMINI_API_KEY "
        "to backend/.env. OpenAI remains available as an optional legacy fallback."
    )

