import hashlib
import hmac
import json
import logging
import os
import time
from pathlib import Path
from decimal import Decimal
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, Response, RedirectResponse
from urllib.parse import urlencode
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from app.validator import validate_order
from app.product_identity import normalize_gtin
from app.ai_analyzer import analyze_shipment_evidence
from app.reconciliation import (
    ReconciliationInputError,
    ReconciliationPreconditionError,
    reconcile_order_document,
)
from app.document_extractor import (
    DocumentExtractionError, DocumentValidationError, MAX_DOCUMENT_BYTES,
    extract_export_document, sha256_document, validate_confirmed_document,
    validate_document_bytes,
)
from app import object_storage
from app.paypal_client import (
    configured as paypal_configured,
    submissions_enabled as paypal_submissions_enabled,
    get_access_token,
    submit_tracking,
    create_paypal_order,
    capture_paypal_order,
    PayPalConfigurationError,
)
from app.store import (
    init_db,
    get_catalogue,
    get_catalogue_identity_profiles,
    get_product_identity_profile,
    update_product_identity_profile,
    create_order,
    get_order,
    list_orders as store_list_orders,
    set_paypal_order_id,
    set_capture,
    create_manifest,
    create_manifest_from_checkout_order,
    get_manifest,
    get_manifest_for_shipment,
    update_manifest,
    finalize_manifest,
    create_inspection,
    get_inspection,
    list_inspection_summaries_for_manifest,
    record_inspection_review,
    create_shipment_for_order,
    get_shipment_by_order_id,
    get_shipment_by_checkout_order_id,
    list_shipments,
    update_shipment,
    create_shipment_document,
    get_shipment_document,
    list_shipment_documents,
    update_shipment_document_extraction,
    confirm_shipment_document,
    create_reconciliation_run,
    list_reconciliation_runs,
)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="ParcelProof AI API",
    description="PayPal-connected shipment evidence and packing verification",
    version="0.2.0",
)



DEMO_SESSION_COOKIE = "parcelproof_demo_session"
DEMO_SESSION_TTL_SECONDS = 12 * 60 * 60
AUTH_PUBLIC_PATHS = {"/api/auth/status", "/api/auth/login", "/api/auth/logout"}


def _demo_auth_required() -> bool:
    return os.getenv("PARCELPROOF_DEMO_AUTH_REQUIRED", "false").strip().lower() == "true"


def _demo_credentials() -> tuple[str, str]:
    return os.getenv("PARCELPROOF_DEMO_USERNAME", "").strip(), os.getenv("PARCELPROOF_DEMO_PASSWORD", "")


def _demo_session_secret() -> bytes:
    configured = os.getenv("PARCELPROOF_DEMO_SESSION_SECRET", "").strip()
    if configured:
        return configured.encode("utf-8")
    username, password = _demo_credentials()
    return hashlib.sha256(("parcelproof-demo-session:" + username + ":" + password).encode("utf-8")).digest()


def _create_demo_session_token(now: int | None = None) -> str:
    username, password = _demo_credentials()
    if not username or not password:
        raise ValueError("Demo sign-in is not configured.")
    issued_at = int(now if now is not None else time.time())
    message = f"{username}:{issued_at}".encode("utf-8")
    signature = hmac.new(_demo_session_secret(), message, hashlib.sha256).hexdigest()
    return f"{issued_at}.{signature}"


def _valid_demo_session(token: str | None, now: int | None = None) -> bool:
    username, password = _demo_credentials()
    if not username or not password or not token:
        return False
    try:
        issued_text, supplied_signature = token.split(".", 1)
        issued_at = int(issued_text)
    except (ValueError, TypeError):
        return False
    current_time = int(now if now is not None else time.time())
    age = current_time - issued_at
    if age < -60 or age > DEMO_SESSION_TTL_SECONDS:
        return False
    message = f"{username}:{issued_at}".encode("utf-8")
    expected = hmac.new(_demo_session_secret(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(supplied_signature, expected)


def _request_has_demo_session(request: Request) -> bool:
    return _valid_demo_session(request.cookies.get(DEMO_SESSION_COOKIE))


@app.get("/api/auth/status")
def demo_auth_status(request: Request):
    """Tell the frontend whether the shared demo session is required."""
    enabled = _demo_auth_required()
    username, password = _demo_credentials()
    return {
        "enabled": enabled,
        "configured": bool(username and password) if enabled else True,
        "authenticated": (not enabled) or _request_has_demo_session(request),
        "demo_username": username if enabled and username and password else "",
    }


@app.post("/api/auth/login")
async def demo_auth_login(request: Request):
    """Create a signed, HttpOnly browser session for the shared demo account."""
    if not _demo_auth_required():
        return {"authenticated": True, "enabled": False}
    username, password = _demo_credentials()
    if not username or not password:
        raise HTTPException(status_code=503, detail="Demo sign-in is not configured. Please contact the demo owner.")
    try:
        payload = await request.json()
        supplied_username = str(payload.get("username", ""))
        supplied_password = str(payload.get("password", ""))
    except (ValueError, AttributeError):
        supplied_username = ""
        supplied_password = ""
    valid = (
        hmac.compare_digest(supplied_username.encode("utf-8"), username.encode("utf-8"))
        and hmac.compare_digest(supplied_password.encode("utf-8"), password.encode("utf-8"))
    )
    if not valid:
        raise HTTPException(status_code=401, detail="The username or password is incorrect.")

    token = _create_demo_session_token()
    response = Response(
        content=json.dumps({"authenticated": True, "enabled": True}),
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    secure_cookie = request.url.scheme == "https" or forwarded_proto.split(",")[0].strip() == "https"
    response.set_cookie(
        key=DEMO_SESSION_COOKIE,
        value=token,
        max_age=DEMO_SESSION_TTL_SECONDS,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        path="/",
    )
    return response


@app.post("/api/auth/logout")
def demo_auth_logout(request: Request):
    """Clear the browser's shared demo session."""
    response = Response(
        content=json.dumps({"authenticated": False, "enabled": _demo_auth_required()}),
        media_type="application/json",
        headers={"Cache-Control": "no-store"},
    )
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    secure_cookie = request.url.scheme == "https" or forwarded_proto.split(",")[0].strip() == "https"
    response.delete_cookie(
        key=DEMO_SESSION_COOKIE,
        path="/",
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
    )
    return response


@app.middleware("http")
async def protect_public_demo(request: Request, call_next):
    """Protect API data with a signed session while keeping the login page and health public."""
    enabled = _demo_auth_required()
    path = request.url.path
    is_health_check = request.method == "GET" and path == "/health"
    is_auth_route = path in AUTH_PUBLIC_PATHS
    is_preflight = request.method == "OPTIONS"

    if enabled and not is_health_check and not is_auth_route and not is_preflight:
        username, password = _demo_credentials()
        if not username or not password:
            return Response(
                content=json.dumps({"detail": "Demo sign-in is not configured."}),
                status_code=503,
                media_type="application/json",
                headers={"Cache-Control": "no-store"},
            )
        if path.startswith("/api/") and not _request_has_demo_session(request):
            return Response(
                content=json.dumps({"detail": "Please sign in to continue."}),
                status_code=401,
                media_type="application/json",
                headers={"Cache-Control": "no-store"},
            )

    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).parent.parent / "data" / "sample_orders.json"
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend_dist"


@app.get("/")
def root():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {"app": "ParcelProof AI", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/orders")
def list_orders():
    # Load sample shipment orders
    with DATA_FILE.open("r", encoding="utf-8-sig") as file:
        sample_orders = json.load(file)

    # Load persistent shipments created from PayPal checkout payments
    persistent_shipments = list_shipments()

    # Combine persistent shipments with sample orders (persistent shipments first)
    combined = list(persistent_shipments) + sample_orders
    return {"orders": combined}


def _catalogue_identity_profiles_response() -> list[dict]:
    products = get_catalogue_identity_profiles()
    for product in products:
        product["reference_image_url"] = (
            f"/api/catalog/{product['sku']}/reference-image"
            if product.get("has_reference_image")
            else None
        )
    return products


@app.get("/api/catalog")
def catalog():
    """Return only buyer-safe product copy and prices for checkout."""
    return {"products": get_catalogue()}


@app.get("/api/catalog/identity-profiles")
def catalogue_identity_profiles():
    """Return private product identity profiles for merchant setup."""
    return {"products": _catalogue_identity_profiles_response()}

@app.get("/api/catalog/{sku}/reference-image")
def get_catalogue_reference_image(sku: str):
    """Serve one saved catalogue reference image through the authenticated app."""
    profile = get_product_identity_profile(sku)
    if not profile or not profile.get("reference_image_path"):
        raise HTTPException(status_code=404, detail="No product reference image is saved.")
    try:
        raw = object_storage.download_private_object(profile["reference_image_path"])
    except object_storage.StorageConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except object_storage.StorageOperationError:
        raise HTTPException(status_code=502, detail="Product reference image could not be loaded.")
    return Response(
        content=raw,
        media_type=profile.get("reference_image_mime_type") or "application/octet-stream",
        headers={"Cache-Control": "private, no-store"},
    )


@app.put("/api/catalog/{sku}/identity")
async def save_catalogue_identity_profile(
    sku: str,
    description: str = Form(...),
    store_description: str | None = Form(None),
    barcode_gtin: str = Form(""),
    reference_image: UploadFile | None = File(None),
):
    """Save reusable product identity data once per catalogue SKU."""
    profile = get_product_identity_profile(sku)
    if profile is None:
        raise HTTPException(status_code=404, detail="Active catalogue product not found.")

    normalized_description = str(description or "").strip()
    if not normalized_description or len(normalized_description) > 500:
        raise HTTPException(
            status_code=422,
            detail="Product description is required and must be 500 characters or fewer.",
        )
    normalized_store_description = str(
        store_description if store_description is not None
        else profile.get("store_description", "")
    ).strip()
    if not normalized_store_description or len(normalized_store_description) > 180:
        raise HTTPException(
            status_code=422,
            detail="A short buyer-facing description is required (180 characters or fewer).",
        )
    try:
        normalized_gtin = normalize_gtin(barcode_gtin)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    new_object_path = None
    new_mime_type = None
    local_temp_path = None
    if reference_image is not None and reference_image.filename:
        raw = await reference_image.read(MAX_PHOTO_BYTES + 1)
        if len(raw) > MAX_PHOTO_BYTES:
            await reference_image.close()
            raise HTTPException(status_code=422, detail="Product reference image exceeds the 10 MB limit.")
        try:
            image_meta = validate_and_store_photo(raw, reference_image.filename)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        local_temp_path = image_meta["path"]
        extension = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }[image_meta["mime_type"]]
        sku_folder = hashlib.sha256(sku.encode("utf-8")).hexdigest()[:24]
        new_object_path = f"catalogue/{sku_folder}/{image_meta['id']}{extension}"
        new_mime_type = image_meta["mime_type"]

        try:
            await run_in_threadpool(
                object_storage.upload_private_object,
                new_object_path,
                raw,
                new_mime_type,
            )
        except object_storage.StorageConfigurationError as exc:
            Path(local_temp_path).unlink(missing_ok=True)
            raise HTTPException(status_code=503, detail=str(exc))
        except object_storage.StorageOperationError:
            Path(local_temp_path).unlink(missing_ok=True)
            raise HTTPException(status_code=502, detail="Product reference image could not be saved to private storage.")
        finally:
            await reference_image.close()

        Path(local_temp_path).unlink(missing_ok=True)

    try:
        updated_profile = update_product_identity_profile(
            sku=sku,
            description=normalized_description,
            store_description=normalized_store_description,
            barcode_gtin=normalized_gtin,
            reference_image_path=new_object_path,
            reference_image_mime_type=new_mime_type,
        )
    except ValueError as exc:
        if new_object_path:
            try:
                await run_in_threadpool(object_storage.delete_private_object, new_object_path)
            except object_storage.StorageOperationError:
                pass
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        if new_object_path:
            try:
                await run_in_threadpool(object_storage.delete_private_object, new_object_path)
            except object_storage.StorageOperationError:
                pass
        raise

    old_path = profile.get("reference_image_path")
    if new_object_path and old_path and old_path != new_object_path:
        try:
            await run_in_threadpool(object_storage.delete_private_object, old_path)
        except object_storage.StorageOperationError:
            # Keep the newly saved profile valid; an orphaned old object is harmless
            # and can be cleaned up later without exposing it publicly.
            pass

    product = next(
        (item for item in _catalogue_identity_profiles_response() if item["sku"] == sku),
        None,
    )
    return {"product": product, "identity_profile": {
        "sku": updated_profile["sku"],
        "barcode_gtin": updated_profile["barcode_gtin"],
        "has_reference_image": bool(updated_profile.get("reference_image_path")),
    }}



@app.get("/api/checkout/orders")
def checkout_orders():
    return {"orders": store_list_orders()}


def _normalize_checkout_details(payload: dict) -> tuple[str, dict]:
    buyer_name = str(payload.get("buyer_name", "")).strip()
    if not buyer_name or len(buyer_name) > 100:
        raise HTTPException(
            status_code=422,
            detail="Enter the recipient's full name (up to 100 characters).",
        )

    raw_address = payload.get("shipping_address")
    if not isinstance(raw_address, dict):
        raise HTTPException(status_code=422, detail="Enter a delivery address.")

    address = {
        "address_line_1": str(raw_address.get("address_line_1", "")).strip(),
        "address_line_2": str(raw_address.get("address_line_2", "")).strip(),
        "city": str(raw_address.get("city", "")).strip(),
        "state": str(raw_address.get("state", "")).strip(),
        "postal_code": str(raw_address.get("postal_code", "")).strip(),
        "country_code": str(raw_address.get("country_code", "")).strip().upper(),
    }
    required_fields = {
        "street address": address["address_line_1"],
        "city": address["city"],
        "postal code": address["postal_code"],
    }
    missing = [name for name, value in required_fields.items() if not value]
    if missing:
        raise HTTPException(
            status_code=422,
            detail="Complete the delivery address: " + ", ".join(missing) + ".",
        )
    if len(address["country_code"]) != 2 or not address["country_code"].isalpha():
        raise HTTPException(
            status_code=422,
            detail="Enter the two-letter country code, such as IN or US.",
        )

    # PayPal requires admin_area_1 for these countries when a shipping
    # address is supplied in an Orders v2 request.
    region_required_countries = {
        "AR", "BR", "CA", "CN", "ID", "IN", "JP", "MX", "TH", "US"
    }
    if (
        address["country_code"] in region_required_countries
        and not address["state"]
    ):
        raise HTTPException(
            status_code=422,
            detail="Enter the state or region for the selected country.",
        )

    if any(len(value) > 120 for value in address.values()):
        raise HTTPException(status_code=422, detail="Delivery address fields are too long.")

    return buyer_name, address


@app.post("/api/checkout/orders")
def create_checkout_order(payload: dict):
    items = payload.get("items", [])
    currency = str(payload.get("currency", "USD")).strip().upper()
    buyer_name, shipping_address = _normalize_checkout_details(payload)

    # Authenticate before writing a local order so missing credentials do not
    # leave an incomplete checkout record behind.
    try:
        token = get_access_token()
    except PayPalConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    try:
        order = create_order(
            items,
            currency,
            buyer_name=buyer_name,
            shipping_address=shipping_address,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    total_cents = int(Decimal(order["total"]) * 100)
    try:
        paypal_result = create_paypal_order(
            token,
            total_cents,
            currency,
            items=order["items"],
            buyer_name=buyer_name,
            shipping_address=shipping_address,
        )
    except (RuntimeError, ValueError) as exc:
        set_capture(order["id"], "", "FAILED")
        raise HTTPException(status_code=502, detail=f"PayPal could not create checkout: {exc}")

    paypal_order_id = paypal_result.get("id")
    if not paypal_order_id:
        set_capture(order["id"], "", "FAILED")
        raise HTTPException(status_code=502, detail="PayPal did not return an order ID.")

    set_paypal_order_id(order["id"], paypal_order_id)

    approval_url = None
    for link in paypal_result.get("links", []):
        if link.get("rel") in ("approve", "payer-action"):
            approval_url = link.get("href")
            break

    if not approval_url:
        set_capture(order["id"], "", "FAILED")
        raise HTTPException(status_code=502, detail="PayPal did not return an approval link.")

    return {
        "order_id": order["id"],
        "paypal_order_id": paypal_order_id,
        "approval_url": approval_url,
        "total": order["total"],
        "currency": currency,
        "status": order["payment_status"],
    }


@app.post("/api/checkout/orders/{order_id}/capture")
def capture_checkout_order(order_id: str, payload: dict):
    order = get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    # Idempotency: already captured orders return without calling PayPal again.
    if order.get("payment_status") in ("PAID", "CAPTURED"):
        # Ensure shipment exists for this paid order (retry recovery if payment succeeded but shipment failed)
        existing_shipment = get_shipment_by_checkout_order_id(order_id)
        if not existing_shipment and order.get("paypal_capture_id"):
            existing_shipment = create_shipment_for_order(
                checkout_order_id=order["id"],
                paypal_order_id=order.get("paypal_order_id") or "",
                paypal_capture_id=order.get("paypal_capture_id"),
                amount=order.get("total", "0.00"),
                currency=order.get("currency", "USD"),
                shipping_address=order.get("shipping_address") or {},
                buyer_name=order.get("buyer_name", ""),
            )

        existing_manifest = (
            create_manifest_from_checkout_order(existing_shipment["order_id"], order["id"])
            if existing_shipment
            else None
        )
        return {
            "order_id": order["id"],
            "paypal_order_id": order.get("paypal_order_id"),
            "paypal_capture_id": order.get("paypal_capture_id"),
            "shipment_id": existing_shipment.get("id") if existing_shipment else None,
            "shipment_order_id": existing_shipment.get("order_id") if existing_shipment else None,
            "manifest_id": existing_manifest.get("id") if existing_manifest else None,
            "buyer_name": order.get("buyer_name", ""),
            "shipping_address": order.get("shipping_address") or {},
            "items": order.get("items", []),
            "total": order.get("total", "0.00"),
            "currency": order.get("currency", "USD"),
            "payment_status": order.get("payment_status"),
            "already_captured": True,
        }

    paypal_order_id = order.get("paypal_order_id")
    if not paypal_order_id:
        raise HTTPException(
            status_code=400, detail="Order has no associated PayPal order."
        )

    token = get_access_token()
    request_id = f"capture-{order_id}"

    try:
        capture_result = capture_paypal_order(token, paypal_order_id, request_id)
    except RuntimeError as exc:
        # Failed payment: mark local order as failed.
        set_capture(order_id, "", "FAILED")
        raise HTTPException(status_code=502, detail=str(exc))

    capture_status = None
    capture_id = None
    captured_amount = None
    captured_currency = None

    # Verify the PayPal order ID in the capture response matches the local order.
    paypal_response_order_id = capture_result.get("id")
    if not paypal_response_order_id or paypal_response_order_id != paypal_order_id:
        set_capture(order_id, "", "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PayPal order ID mismatch or missing in capture response.",
            },
        )

    # Verify top-level PayPal order status is COMPLETED
    paypal_order_status = capture_result.get("status")
    if paypal_order_status != "COMPLETED":
        set_capture(order_id, "", "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PayPal order status is not COMPLETED.",
                "order_status": paypal_order_status,
            },
        )

    purchase_units = capture_result.get("purchase_units", [])
    for pu in purchase_units:
        payments = pu.get("payments", {})
        captures = payments.get("captures", [])
        if captures:
            capture = captures[0]
            capture_id = capture.get("id")
            capture_status = capture.get("status")
            capture_amount = capture.get("amount", {})
            captured_amount = capture_amount.get("value")
            captured_currency = capture_amount.get("currency_code")
            break

    # Require a non-empty string capture ID before persisting.
    if not isinstance(capture_id, str) or not capture_id.strip():
        set_capture(order_id, "", "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PayPal capture ID is missing or invalid.",
            },
        )

    # Never mark PAID if capture details are missing or malformed.
    if capture_status != "COMPLETED":
        set_capture(order_id, capture_id, "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PayPal capture did not complete.",
                "capture_status": capture_status,
            },
        )

    if captured_currency != order.get("currency", "USD"):
        set_capture(order_id, capture_id, "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PayPal capture currency does not match the checkout order currency.",
                "captured_currency": captured_currency,
            },
        )

    if captured_amount is None:
        set_capture(order_id, capture_id, "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PayPal capture is missing an amount.",
            },
        )

    try:
        captured_decimal = Decimal(str(captured_amount))
    except Exception:
        set_capture(order_id, capture_id, "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "PayPal capture amount is malformed.",
            },
        )

    if captured_decimal != Decimal(order["total"]):
        set_capture(order_id, capture_id, "FAILED")
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Captured amount does not match order total.",
                "expected": order["total"],
                "captured": captured_amount,
            },
        )

    # Persist the actual nested capture ID, not the top-level order ID.
    set_capture(order_id, capture_id, "PAID")

    # Only create a shipment after PayPal capture is verified.
    # Persist the local checkout order ID and PayPal capture ID against the shipment.
    shipment = create_shipment_for_order(
        checkout_order_id=order["id"],
        paypal_order_id=paypal_order_id,
        paypal_capture_id=capture_id,
        amount=order["total"],
        currency=order.get("currency", "USD"),
        shipping_address=order.get("shipping_address") or {},
        buyer_name=order.get("buyer_name", ""),
    )
    manifest = create_manifest_from_checkout_order(shipment["order_id"], order["id"])

    return {
        "order_id": order["id"],
        "paypal_order_id": paypal_order_id,
        "paypal_capture_id": capture_id,
        "shipment_id": shipment["id"],
        "shipment_order_id": shipment["order_id"],
        "manifest_id": manifest["id"],
        "buyer_name": order.get("buyer_name", ""),
        "shipping_address": order.get("shipping_address") or {},
        "items": order.get("items", []),
        "total": order.get("total", "0.00"),
        "currency": order.get("currency", "USD"),
        "payment_status": "PAID",
        "already_captured": False,
    }


@app.post("/api/validate")
def validate(payload: dict):
    return validate_order(payload)


@app.post("/api/analyze-evidence")
def analyze_evidence(payload: dict):
    return analyze_shipment_evidence(payload)


@app.get("/api/paypal/status")
def paypal_status():
    return {
        "provider": "PayPal Sandbox",
        "configured": paypal_configured(),
        "submission_enabled": paypal_submissions_enabled(),
        "base_url": "https://api-m.sandbox.paypal.com",
        "note": "Sandbox only. Credentials can be verified via OAuth. Tracking writes require an explicit local opt-in.",
    }


@app.post("/api/paypal/verify-connection")
def paypal_verify_connection():
    try:
        get_access_token()
        return {
            "success": True,
            "status": "AUTHENTICATED",
            "message": "Successfully authenticated with PayPal Sandbox OAuth 2.0 (client_credentials).",
            "provider": "PayPal Sandbox",
            "submission_enabled": paypal_submissions_enabled(),
            "safety_gate": "Tracking write gate is safely locked (PAYPAL_TRACKING_SUBMISSION_ENABLED=false). No tracking data was sent.",
        }
    except PayPalConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayPal Sandbox OAuth failed: {str(exc)}")


def _record_packing_review(inspection_id: str, payload: dict) -> dict:
    """Shared validation and persistence for JSON and browser-native review submissions."""
    inspection = get_inspection(inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")

    manifest = get_manifest(inspection["manifest_id"])
    if manifest is None:
        raise HTTPException(status_code=404, detail="Inspection manifest not found.")
    inspections = list_inspections_for_manifest(manifest["id"])
    if not inspections or inspections[0]["id"] != inspection_id:
        raise HTTPException(
            status_code=409,
            detail="Only the latest packing inspection can receive a human review decision.",
        )
    if manifest["status"] != "FINALIZED":
        raise HTTPException(
            status_code=409,
            detail="The manifest is not finalized; this inspection cannot be reviewed.",
        )

    try:
        reviewed = record_inspection_review(
            inspection_id=inspection_id,
            decision=payload.get("decision", ""),
            reviewer_label=payload.get("reviewer_label", ""),
            notes=payload.get("notes", ""),
        )
    except ValueError as exc:
        message = str(exc)
        status_code = 404 if message.startswith("Inspection not found:") else 409 if "already been reviewed" in message else 422
        raise HTTPException(status_code=status_code, detail=message)

    return {
        "inspection_id": reviewed["id"],
        "manifest_id": reviewed["manifest_id"],
        "inspection_status": reviewed["inspection_status"],
        "review_history": reviewed["review_history"],
        "reviewed_at": reviewed["updated_at"],
    }


@app.post("/api/inspections/{inspection_id}/review")
def review_packing_inspection(inspection_id: str, payload: dict):
    """JSON API for explicit human decisions; AI output is never approval."""
    return _record_packing_review(inspection_id, payload)


@app.post("/api/inspections/{inspection_id}/review/form")
def review_packing_inspection_form(
    inspection_id: str,
    decision: str = Form(...),
    reviewer_label: str = Form("Merchant"),
    notes: str = Form(""),
):
    """Native browser form endpoint; works even when client-side event handling fails."""
    try:
        result = _record_packing_review(
            inspection_id,
            {
                "decision": decision,
                "reviewer_label": reviewer_label,
                "notes": notes,
            },
        )
    except HTTPException as exc:
        query = urlencode({
            "review_error": str(exc.detail),
            "inspection_id": inspection_id,
        })
        return RedirectResponse(url=f"/inspections?{query}", status_code=303)

    query = urlencode({
        "review_status": result["inspection_status"],
        "inspection_id": inspection_id,
    })
    return RedirectResponse(url=f"/inspections?{query}", status_code=303)


@app.post("/api/shipments/{shipment_order_id}/submit-tracking")
def submit_shipment_tracking(shipment_order_id: str, payload: dict):
    """Submit a stored paid shipment's carrier tracking after human inspection approval."""
    shipment = get_shipment_by_order_id(shipment_order_id)
    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Persistent PayPal-paid shipment not found. Sample shipments cannot be submitted.",
        )

    if not paypal_submissions_enabled():
        raise HTTPException(
            status_code=503,
            detail="PayPal tracking submission is disabled. The Sandbox write gate is still locked.",
        )

    # Confirm the payment linkage using the local paid order, not client-supplied IDs.
    checkout_order = get_order(shipment["checkout_order_id"])
    if not checkout_order or checkout_order.get("payment_status") != "PAID":
        raise HTTPException(status_code=409, detail="A verified paid checkout is required.")
    if (
        checkout_order.get("paypal_order_id") != shipment.get("paypal_order_id")
        or checkout_order.get("paypal_capture_id") != shipment.get("paypal_capture_id")
    ):
        raise HTTPException(status_code=409, detail="Stored PayPal order/capture linkage does not match.")

    manifest = get_manifest_for_shipment(shipment_order_id)
    if not manifest or manifest.get("status") != "FINALIZED":
        raise HTTPException(status_code=409, detail="Finalize the shipment manifest before dispatch.")

    inspections = list_inspections_for_manifest(manifest["id"])
    if not inspections or inspections[0].get("inspection_status") != "APPROVED":
        raise HTTPException(
            status_code=409,
            detail="The latest packing inspection must be approved by a human reviewer before tracking can be submitted.",
        )

    tracking_number = str(payload.get("tracking_number", "")).strip()
    carrier = str(payload.get("carrier", "")).strip().upper()
    carrier_name_other = str(payload.get("carrier_name_other", "")).strip()
    notify_payer = payload.get("notify_payer", False)
    if not isinstance(notify_payer, bool):
        raise HTTPException(status_code=422, detail="notify_payer must be true or false.")

    if shipment.get("tracking_submission_status") == "SUBMITTED":
        same_tracking = (
            shipment.get("tracking_number") == tracking_number
            and shipment.get("carrier") == carrier
            and (carrier != "OTHER" or shipment.get("carrier_name_other") == carrier_name_other)
        )
        if same_tracking:
            return {
                "submitted": True,
                "already_submitted": True,
                "provider": "PayPal Sandbox",
                "shipment_order_id": shipment_order_id,
                "tracking_number": shipment["tracking_number"],
                "carrier": shipment["carrier"],
                "submitted_at": shipment.get("paypal_tracking_submitted_at"),
            }
        raise HTTPException(
            status_code=409,
            detail="Tracking has already been submitted for this shipment and cannot be replaced in this demo workflow.",
        )

    if shipment.get("tracking_submission_status") == "FAILED":
        previous_carrier_name = (
            str(shipment.get("carrier_name_other") or "").strip()
            if shipment.get("carrier") == "OTHER"
            else ""
        )
        requested_carrier_name = carrier_name_other if carrier == "OTHER" else ""
        if (
            shipment.get("tracking_number") != tracking_number
            or shipment.get("carrier") != carrier
            or previous_carrier_name != requested_carrier_name
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "The previous tracking request has an uncertain result. Retry with the same "
                    "tracking number and carrier before attempting a different tracking update."
                ),
            )

    validation_payload = {
        "order_id": shipment_order_id,
        "transaction_id": shipment["paypal_capture_id"],
        "tracking_number": tracking_number,
        "carrier": carrier,
        "carrier_name_other": carrier_name_other,
        "status": "SHIPPED",
    }
    validation = validate_order(validation_payload)
    if validation["result"] == "BLOCKED":
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Tracking details failed ParcelProof's basic data checks. Nothing was sent to PayPal.",
                "validation": validation,
            },
        )

    try:
        response = submit_tracking({
            "paypal_order_id": shipment["paypal_order_id"],
            "paypal_capture_id": shipment["paypal_capture_id"],
            "tracking_number": tracking_number,
            "carrier": carrier,
            "carrier_name_other": carrier_name_other,
            "notify_payer": notify_payer,
            "items": checkout_order.get("items", []),
        })
    except PayPalConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        # Preserve the exact tracker details; the result may be uncertain if the request timed out.
        update_shipment(
            shipment_order_id,
            tracking_number=tracking_number,
            carrier=carrier,
            carrier_name_other=carrier_name_other or "UNASSIGNED",
            tracking_submission_status="FAILED",
        )
        raise HTTPException(status_code=502, detail=str(exc))

    if not isinstance(response, dict) or response.get("id") != shipment.get("paypal_order_id"):
        update_shipment(
            shipment_order_id,
            tracking_number=tracking_number,
            carrier=carrier,
            carrier_name_other=carrier_name_other or "UNASSIGNED",
            tracking_submission_status="FAILED",
        )
        raise HTTPException(
            status_code=502,
            detail="PayPal returned a successful response that did not match the stored order ID. Verify the order in Sandbox before retrying.",
        )

    submitted_at = datetime.now(timezone.utc).isoformat()
    update_shipment(
        shipment_order_id,
        tracking_number=tracking_number,
        carrier=carrier,
        carrier_name_other=carrier_name_other or "UNASSIGNED",
        status="SHIPPED",
        shipped_date=datetime.now(timezone.utc).date().isoformat(),
        tracking_submission_status="SUBMITTED",
        paypal_tracking_submitted_at=submitted_at,
    )
    return {
        "submitted": True,
        "already_submitted": False,
        "provider": "PayPal Sandbox",
        "shipment_order_id": shipment_order_id,
        "paypal_order_id": shipment["paypal_order_id"],
        "paypal_capture_id": shipment["paypal_capture_id"],
        "tracking_number": tracking_number,
        "carrier": carrier,
        "submitted_at": submitted_at,
        "validation": validation,
        "paypal_response": response,
    }


# ---------------------------------------------------------------------------
# Shipment manifest endpoints
# These operate on actual merchant shipment records, not on checkout orders.
# ---------------------------------------------------------------------------

def _load_shipment_orders() -> dict:
    """Return a dict keyed by order_id combining persistent DB shipments and sample orders."""
    orders = {}
    with DATA_FILE.open("r", encoding="utf-8-sig") as fh:
        sample_orders = json.load(fh)
    for o in sample_orders:
        orders[o["order_id"]] = o

    for s in list_shipments():
        orders[s["order_id"]] = s

    return orders


def _require_shipment_order(shipment_order_id: str) -> dict:
    """Return the shipment record or raise 404.

    Checks persistent SQLite shipment records and sample orders.
    """
    # Check persistent DB shipments first
    db_shipment = get_shipment_by_order_id(shipment_order_id)
    if db_shipment:
        return db_shipment

    orders = _load_shipment_orders()
    record = orders.get(shipment_order_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Shipment record '{shipment_order_id}' not found.",
        )
    return record


@app.post("/api/shipments/{shipment_order_id}/manifest", status_code=201)
def create_shipment_manifest(shipment_order_id: str, payload: dict):
    """Create a DRAFT manifest for an existing shipment evidence record."""
    _require_shipment_order(shipment_order_id)

    # Paid checkouts already have a manifest generated from the actual items
    # purchased. Return it on repeat requests instead of creating a duplicate.
    existing_manifest = get_manifest_for_shipment(shipment_order_id)
    if existing_manifest is not None:
        return existing_manifest

    items = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=422, detail="'items' must be a list.")

    notes = payload.get("notes")
    if notes is not None:
        notes = str(notes).strip() or None

    try:
        manifest = create_manifest(shipment_order_id, items, notes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return manifest


@app.get("/api/shipments/{shipment_order_id}/manifest")
def get_shipment_manifest(shipment_order_id: str):
    """Return the most recent manifest for a shipment evidence record."""
    _require_shipment_order(shipment_order_id)

    manifest = get_manifest_for_shipment(shipment_order_id)
    if manifest is None:
        raise HTTPException(
            status_code=404,
            detail=f"No manifest found for shipment '{shipment_order_id}'.",
        )
    return manifest


def _document_api_record(document: dict) -> dict:
    """Expose document metadata without the private storage object path."""
    return {
        "document_id": document["id"],
        "shipment_order_id": document["shipment_order_id"],
        "document_type": document["document_type"],
        "document_status": document["document_status"],
        "extraction_status": document["extraction_status"],
        "original_filename": document["original_filename"],
        "mime_type": document["mime_type"],
        "size_bytes": document["size_bytes"],
        "sha256": document["sha256"],
        "extracted_data": document.get("extracted_data"),
        "confirmed_data": document.get("confirmed_data"),
        "extraction_provider": document.get("extraction_provider"),
        "extraction_error": document.get("extraction_error"),
        "reviewer_label": document.get("reviewer_label"),
        "confirmed_at": document.get("confirmed_at"),
        "created_at": document.get("created_at"),
    }


@app.post("/api/shipments/{shipment_order_id}/documents", status_code=201)
async def upload_shipment_document(
    shipment_order_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
):
    shipment = get_shipment_by_order_id(shipment_order_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="A persisted shipment is required.")
    if not shipment.get("checkout_order_id"):
        raise HTTPException(status_code=409, detail="Sample shipments cannot store export documents.")
    document_type = str(document_type or "").strip().upper()
    if document_type not in {"COMMERCIAL_INVOICE", "PACKING_LIST"}:
        raise HTTPException(status_code=422, detail="Choose COMMERCIAL_INVOICE or PACKING_LIST.")

    raw_bytes = await file.read(MAX_DOCUMENT_BYTES + 1)
    try:
        mime_type = validate_document_bytes(raw_bytes)
    except DocumentValidationError as exc:
        status = 413 if len(raw_bytes) > MAX_DOCUMENT_BYTES else 415
        raise HTTPException(status_code=status, detail=str(exc)) from None

    from uuid import uuid4
    filename = str(file.filename or "export-document").replace("\\", "/").split("/")[-1]
    filename = "".join(char for char in filename if char.isprintable() and char not in {'"', "'", "\\", "/"})[:180].strip()
    filename = filename or "export-document"
    extension = {"application/pdf": ".pdf", "image/jpeg": ".jpg",
                 "image/png": ".png", "image/webp": ".webp"}[mime_type]
    storage_path = f"{shipment_order_id}/documents/{uuid4()}{extension}"
    bucket = os.getenv("SUPABASE_DOCUMENTS_BUCKET", "shipment-documents").strip()
    try:
        object_storage.upload_private_object(storage_path, raw_bytes, mime_type, bucket_name=bucket)
    except object_storage.StorageConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None
    except object_storage.StorageOperationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from None

    try:
        document = create_shipment_document(
            shipment_order_id, document_type=document_type, original_filename=filename,
            mime_type=mime_type, size_bytes=len(raw_bytes),
            sha256=sha256_document(raw_bytes), storage_path=storage_path,
        )
    except Exception:
        try:
            object_storage.delete_private_object(storage_path, bucket_name=bucket)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="The document metadata could not be saved.") from None

    try:
        extraction = extract_export_document(raw_bytes, mime_type, document_type)
    except DocumentExtractionError:
        extraction = {
            "status": "FAILED", "provider": "GEMINI", "data": None,
            "message": "The original document is saved. AI extraction failed; enter fields manually.",
        }
    except DocumentValidationError as exc:
        extraction = {"status": "FAILED", "provider": None, "data": None, "message": str(exc)}
    updated = update_shipment_document_extraction(
        document["id"], extraction_status=extraction["status"],
        document_status="AWAITING_REVIEW", extracted_data=extraction.get("data"),
        extraction_provider=extraction.get("provider"),
        extraction_error=extraction["message"] if extraction["status"] == "FAILED" else None,
    )
    return {"document": _document_api_record(updated), "message": extraction["message"]}


@app.get("/api/shipments/{shipment_order_id}/documents")
def list_shipment_export_documents(shipment_order_id: str):
    if get_shipment_by_order_id(shipment_order_id) is None:
        raise HTTPException(status_code=404, detail="Shipment not found.")
    return {"shipment_order_id": shipment_order_id,
            "documents": [_document_api_record(item) for item in list_shipment_documents(shipment_order_id)]}


@app.get("/api/documents/{document_id}/file")
def download_shipment_document(document_id: str):
    document = get_shipment_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Export document not found.")
    bucket = os.getenv("SUPABASE_DOCUMENTS_BUCKET", "shipment-documents").strip()
    try:
        content = object_storage.download_private_object(document["storage_path"], bucket_name=bucket)
    except object_storage.StorageConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from None
    except object_storage.StorageOperationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from None
    if sha256_document(content) != document.get("sha256"):
        raise HTTPException(status_code=502, detail="Stored export document failed its SHA-256 integrity check.")
    filename = "".join(
        char for char in str(document["original_filename"])
        if char.isprintable() and char not in {'"', "'", "\\", "/", "\\r", "\\n"}
    )[:150].strip() or "export-document"
    return Response(
        content=content, media_type=document["mime_type"],
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@app.put("/api/documents/{document_id}/confirm")
def confirm_export_document(document_id: str, payload: dict):
    document = get_shipment_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Export document not found.")
    fields = payload.get("document") if isinstance(payload, dict) else None
    try:
        confirmed = validate_confirmed_document(fields, document["document_type"])
        saved = confirm_shipment_document(
            document_id, confirmed_data=confirmed,
            reviewer_label=payload.get("reviewer_label", "Merchant"),
        )
    except (DocumentValidationError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return _document_api_record(saved)


@app.get("/api/shipments/{shipment_order_id}/reconciliations")
def get_shipment_reconciliations(shipment_order_id: str):
    if get_shipment_by_order_id(shipment_order_id) is None:
        raise HTTPException(status_code=404, detail="Shipment not found.")
    return {"shipment_order_id": shipment_order_id,
            "reconciliations": list_reconciliation_runs(shipment_order_id)}


@app.post("/api/shipments/{shipment_order_id}/reconcile")
def reconcile_shipment_documents(shipment_order_id: str, payload: dict):
    """Compare confirmed export fields against the paid order and final manifest."""
    shipment = get_shipment_by_order_id(shipment_order_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="A persisted PayPal shipment is required.")
    order_id = shipment.get("checkout_order_id")
    if not order_id:
        raise HTTPException(status_code=409, detail="Sample shipments cannot be reconciled against PayPal.")
    order = get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="The linked PayPal checkout order was not found.")
    if str(order.get("paypal_capture_id") or "").strip() != str(shipment.get("paypal_capture_id") or "").strip():
        raise HTTPException(status_code=409, detail="The shipment capture does not match its linked PayPal checkout.")
    if (
        shipment.get("paypal_order_id")
        and order.get("paypal_order_id")
        and str(shipment["paypal_order_id"]).strip() != str(order["paypal_order_id"]).strip()
    ):
        raise HTTPException(status_code=409, detail="The shipment PayPal order does not match its linked checkout.")
    manifest = get_manifest_for_shipment(shipment_order_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Create a shipment manifest before reconciliation.")
    if manifest.get("shipment_order_id") != shipment_order_id:
        raise HTTPException(status_code=409, detail="The selected manifest belongs to a different shipment.")

    document_id = payload.get("document_id") if isinstance(payload, dict) else None
    if document_id:
        saved = get_shipment_document(str(document_id))
        if saved is None:
            raise HTTPException(status_code=404, detail="Export document not found.")
        if saved.get("shipment_order_id") != shipment_order_id:
            raise HTTPException(status_code=409, detail="The document belongs to a different shipment.")
        if saved.get("document_status") != "CONFIRMED" or not isinstance(saved.get("confirmed_data"), dict):
            raise HTTPException(status_code=409, detail="Confirm the document fields before reconciliation.")
        try:
            document = validate_confirmed_document(saved["confirmed_data"], saved["document_type"])
        except DocumentValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from None
    else:
        raw_document = payload.get("document") if isinstance(payload, dict) else None
        if not isinstance(raw_document, dict):
            raise HTTPException(status_code=422, detail="Provide a confirmed document_id or normalized document object.")
        if raw_document.get("merchant_confirmed") is not True:
            raise HTTPException(status_code=409, detail="Merchant confirmation is required before reconciliation.")
        try:
            document = validate_confirmed_document(raw_document, raw_document.get("document_type"))
        except DocumentValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from None

    try:
        result = reconcile_order_document(order, manifest, document)
    except ReconciliationPreconditionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except ReconciliationInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    run = create_reconciliation_run(
        shipment_order_id=shipment_order_id, order_id=order_id,
        manifest_id=manifest["id"], document_id=str(document_id) if document_id else None,
        result=result,
    )
    return {**result, "reconciliation_id": run["id"]}


@app.get("/api/manifests/{manifest_id}")
def get_manifest_by_id(manifest_id: str):
    """Return a manifest by its own UUID."""
    manifest = get_manifest(manifest_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not found.")
    return manifest


@app.put("/api/manifests/{manifest_id}")
def update_manifest_by_id(manifest_id: str, payload: dict):
    """Replace all items on a DRAFT manifest."""
    manifest = get_manifest(manifest_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not found.")

    items = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=422, detail="'items' must be a list.")

    notes = payload.get("notes")
    if notes is not None:
        notes = str(notes).strip() or None

    try:
        updated = update_manifest(manifest_id, items, notes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return updated


@app.post("/api/manifests/{manifest_id}/finalize")
def finalize_manifest_by_id(manifest_id: str):
    """Finalize a DRAFT manifest and compute its SHA-256 fingerprint."""
    manifest = get_manifest(manifest_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not found.")

    try:
        finalized = finalize_manifest(manifest_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return finalized


# ---------------------------------------------------------------------------
# Packing inspection endpoints
# ---------------------------------------------------------------------------

import app.packing_inspector as packing_inspector_service
from app.packing_inspector import (
    validate_and_store_photo,
    run_inspection,
    MAX_PHOTOS_PER_INSPECTION,
    MAX_PHOTO_BYTES,
    GeminiUnavailableError,
)


@app.post("/api/manifests/{manifest_id}/inspections", status_code=201)
async def create_packing_inspection(
    manifest_id: str,
    photos: list[UploadFile] = File(...),
):
    """Upload packing photographs and run a Gemini visual inspection.

    Accepts 1–5 JPEG, PNG, or WebP photographs. Validates file content by
    magic bytes — filename and MIME header are not trusted.

    The manifest must exist and be FINALIZED before an inspection can be
    submitted. Inspection status is always PENDING_HUMAN_REVIEW.
    """
    request_started_at = time.perf_counter()

    # 1. Resolve and validate manifest.
    manifest = get_manifest(manifest_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not found.")
    if manifest["status"] != "FINALIZED":
        raise HTTPException(
            status_code=422,
            detail="Inspections can only be submitted for FINALIZED manifests.",
        )

    linked_shipment = (
        get_shipment_by_order_id(manifest["shipment_order_id"])
        if manifest.get("shipment_order_id")
        else None
    )
    if linked_shipment and linked_shipment.get("tracking_submission_status") == "SUBMITTED":
        raise HTTPException(
            status_code=409,
            detail="Tracking has already been submitted. Packing inspections for this shipment are closed.",
        )

    # 2. Enforce photo count limits.
    if not photos:
        raise HTTPException(status_code=422, detail="At least one photograph is required.")
    if len(photos) > MAX_PHOTOS_PER_INSPECTION:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum {MAX_PHOTOS_PER_INSPECTION} photographs per inspection.",
        )

    # 3. Read each upload in bounded chunks, validate, and store.
    # Track stored paths so we can delete them if any later step fails.
    photo_metas: list[dict] = []
    stored_paths: list = []
    stored_objects: list[str] = []

    async def _cleanup_stored():
        """Delete every photo file stored so far in this request."""
        for p in stored_paths:
            try:
                Path(p).unlink(missing_ok=True)
            except OSError:
                pass
        for object_path in stored_objects:
            try:
                await run_in_threadpool(object_storage.delete_private_object, object_path)
            except object_storage.StorageOperationError:
                # Best-effort rollback; never mask the original inspection error.
                pass

    photo_upload_started_at = time.perf_counter()
    for upload in photos:
        # Read in chunks, enforcing the per-file size cap before buffering.
        chunks: list[bytes] = []
        total = 0
        chunk_size = 64 * 1024  # 64 KB
        while True:
            chunk = await upload.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_PHOTO_BYTES:
                await upload.close()
                await _cleanup_stored()
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Photo '{upload.filename or 'upload'}' exceeds the "
                        f"10 MB per-file limit."
                    ),
                )
            chunks.append(chunk)
        raw = b"".join(chunks)

        try:
            meta = validate_and_store_photo(raw, upload.filename or "upload")
        except ValueError as exc:
            await _cleanup_stored()
            raise HTTPException(status_code=422, detail=str(exc))

        if os.getenv("SUPABASE_URL", "").strip():
            # Track the temporary local copy immediately so every failure path cleans it.
            stored_paths.append(meta["path"])
            extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[meta["mime_type"]]
            object_path = f"{manifest_id}/{meta['id']}{extension}"
            try:
                await run_in_threadpool(object_storage.upload_private_object, object_path, raw, meta["mime_type"])
            except object_storage.StorageConfigurationError as exc:
                await _cleanup_stored()
                raise HTTPException(status_code=503, detail=str(exc))
            except object_storage.StorageOperationError as exc:
                await _cleanup_stored()
                raise HTTPException(status_code=502, detail=str(exc))
            stored_objects.append(object_path)
            meta["storage_path"] = object_path
            meta["data"] = raw
            Path(meta["path"]).unlink(missing_ok=True)
            stored_paths.remove(meta["path"])
            meta.pop("path", None)
        else:
            stored_paths.append(meta["path"])
        photo_metas.append(meta)

    photo_upload_ms = round((time.perf_counter() - photo_upload_started_at) * 1000)

    # 4. Resolve one saved catalogue identity profile per distinct SKU.
    # Reference images are passed to vision as labelled catalogue context, not
    # as packing evidence and never count toward the inspection's photo_count.
    reference_loading_started_at = time.perf_counter()
    reference_metas: list[dict] = []
    product_reference_context: list[dict] = []
    seen_skus: set[str] = set()
    for item in manifest.get("items", []):
        sku = str(item.get("sku") or "").strip()
        if not sku or sku in seen_skus:
            continue
        seen_skus.add(sku)
        profile = get_product_identity_profile(sku)
        if profile is None:
            product_reference_context.append({
                "sku": sku,
                "name": None,
                "description": None,
                "barcode_gtin": None,
                "reference_image_status": "NO_PROFILE",
            })
            continue

        context = {
            "sku": sku,
            "name": profile.get("name"),
            "description": profile.get("description"),
            "barcode_gtin": profile.get("barcode_gtin"),
            "reference_image_status": "NOT_CONFIGURED",
        }
        if profile.get("reference_image_path"):
            try:
                reference_bytes = await run_in_threadpool(
                    object_storage.download_private_object,
                    profile["reference_image_path"],
                )
                reference_metas.append({
                    "sku": sku,
                    "data": reference_bytes,
                    "mime_type": profile.get("reference_image_mime_type") or "image/jpeg",
                })
                context["reference_image_status"] = "LOADED"
            except (object_storage.StorageConfigurationError, object_storage.StorageOperationError):
                context["reference_image_status"] = "UNAVAILABLE"
        elif profile.get("barcode_gtin"):
            context["reference_image_status"] = "GTIN_ONLY"
        product_reference_context.append(context)

    catalogue_reference_ms = round((time.perf_counter() - reference_loading_started_at) * 1000)

    # 5. Build durable photo metadata before calling the external AI provider.
    photo_records = [
        {
            "id": m["id"],
            "sha256": m["sha256"],
            "mime_type": m["mime_type"],
            "size_bytes": m["size_bytes"],
            "storage_path": m.get("storage_path"),
        }
        for m in photo_metas
    ]

    async def _record_ai_failure(exc: Exception, status_code: int):
        """Keep uploaded evidence even when the optional AI analysis is unavailable."""
        failure_message = str(exc).strip()[:500] or "The vision provider did not return a usable result."
        try:
            failed_inspection = create_inspection(
                manifest_id=manifest_id,
                manifest_hash=manifest["manifest_hash"],
                model_used=None,
                ai_result={
                    "inspection_state": "AI_FAILED",
                    "failure_message": failure_message,
                    "human_review_required": True,
                    "retry_available": status_code in (429, 503),
                },
                photo_records=photo_records,
                inspection_status="AI_FAILED",
            )
        except Exception:
            await _cleanup_stored()
            raise HTTPException(
                status_code=status_code,
                detail=(
                    f"{failure_message} The database could not save this photo evidence. "
                    "Keep the original files and retry."
                ),
            ) from None

        raise HTTPException(
            status_code=status_code,
            detail=(
                f"{failure_message} The uploaded photos and their hashes were preserved "
                f"as failed inspection {failed_inspection['id']}. Retry the AI inspection "
                "with the original photos; this failed attempt cannot be approved."
            ),
        )

    # 6. Run the AI provider. Provider failure must not destroy the evidence.
    # Keep the original provider call for products without an actual saved
    # reference image or GTIN; only send the extra context when it is useful.
    has_identity_context = bool(reference_metas) or any(
        item.get("barcode_gtin")
        or item.get("reference_image_status") == "UNAVAILABLE"
        for item in product_reference_context
    )
    vision_provider_started_at = time.perf_counter()
    try:
        if has_identity_context:
            result = await run_in_threadpool(
                run_inspection,
                manifest,
                photo_metas,
                reference_metas,
                product_reference_context,
            )
        else:
            result = await run_in_threadpool(run_inspection, manifest, photo_metas)
    except GeminiUnavailableError as exc:
        vision_provider_ms = round((time.perf_counter() - vision_provider_started_at) * 1000)
        logger.warning(
            "packing_inspection_provider_unavailable manifest_id=%s photo_count=%d reference_count=%d provider_elapsed_ms=%d status_code=%d",
            manifest_id, len(photo_metas), len(reference_metas), vision_provider_ms, getattr(exc, "status_code", 503),
        )
        await _record_ai_failure(exc, getattr(exc, "status_code", 503))
    except RuntimeError as exc:
        vision_provider_ms = round((time.perf_counter() - vision_provider_started_at) * 1000)
        logger.warning(
            "packing_inspection_provider_failed manifest_id=%s photo_count=%d reference_count=%d provider_elapsed_ms=%d error_type=%s",
            manifest_id, len(photo_metas), len(reference_metas), vision_provider_ms, type(exc).__name__,
        )
        await _record_ai_failure(RuntimeError(f"Vision inspection failed: {exc}"), 502)

    vision_provider_ms = round((time.perf_counter() - vision_provider_started_at) * 1000)

    # 7. Persist; clean up photos if the DB write fails.
    unavailable_references = [
        item["sku"] for item in product_reference_context
        if item["reference_image_status"] == "UNAVAILABLE"
    ]
    ai_result = dict(result["ai_result"])
    ai_result["product_reference_context"] = product_reference_context
    if unavailable_references:
        notes = ai_result.get("additional_observations", {}).get("uncertainty_notes", [])
        ai_result["additional_observations"]["uncertainty_notes"] = [
            *notes,
            "Saved catalogue reference image could not be loaded for SKU(s): "
            + ", ".join(unavailable_references)
            + ". This inspection used the manifest description without those reference images.",
        ]

    engine_metadata = dict(result.get("engine_metadata") or {})
    engine_metadata["processing_timings_ms"] = {
        "photo_upload_ms": photo_upload_ms,
        "catalogue_reference_ms": catalogue_reference_ms,
        "vision_provider_ms": vision_provider_ms,
    }
    database_persist_started_at = time.perf_counter()
    try:
        inspection = create_inspection(
            manifest_id=manifest_id,
            manifest_hash=manifest["manifest_hash"],
            model_used=result["model_used"],
            ai_result={
                **ai_result,
                "engine_metadata": engine_metadata,
            },
            photo_records=photo_records,
        )
    except Exception:
        await _cleanup_stored()
        raise

    database_persist_ms = round((time.perf_counter() - database_persist_started_at) * 1000)
    total_elapsed_ms = round((time.perf_counter() - request_started_at) * 1000)
    processing_timings_ms = {
        "photo_upload_ms": photo_upload_ms,
        "catalogue_reference_ms": catalogue_reference_ms,
        "vision_provider_ms": vision_provider_ms,
        "database_persist_ms": database_persist_ms,
        "total_ms": total_elapsed_ms,
    }
    logger.info(
        "packing_inspection_timing manifest_id=%s photo_count=%d reference_count=%d model=%s photo_upload_ms=%d catalogue_reference_ms=%d vision_provider_ms=%d database_persist_ms=%d total_ms=%d",
        manifest_id, len(photo_metas), len(reference_metas), result.get("model_used"),
        photo_upload_ms, catalogue_reference_ms, vision_provider_ms, database_persist_ms, total_elapsed_ms,
    )

    # Photos are now safely referenced in the DB — do not delete them.
    # Strip any internal fields before returning.
    return {
        "inspection_id": inspection["id"],
        "manifest_id": manifest_id,
        "inspection_status": inspection["inspection_status"],
        "manifest_hash_at_inspection": inspection["manifest_hash_at_inspection"],
        "photo_count": inspection["photo_count"],
        "photos": [
            {
                "id": p["id"],
                "sha256": p["sha256"],
                "mime_type": p["mime_type"],
                "size_bytes": p["size_bytes"],
            }
            for p in inspection["photos"]
        ],
        "ai_result": inspection["ai_result"],
        "review_history": inspection.get("review_history", []),
        "model_used": inspection["model_used"],
        "processing_timings_ms": processing_timings_ms,
        "created_at": inspection["created_at"],
    }


@app.get("/api/manifests/{manifest_id}/inspections")
def list_manifest_inspections(manifest_id: str):
    """List compact inspection history, including each run's latest merchant decision."""
    manifest = get_manifest(manifest_id)
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not found.")
    inspections = list_inspection_summaries_for_manifest(manifest_id)
    return {
        "manifest_id": manifest_id,
        "inspections": [
            {
                "inspection_id": item["id"],
                "inspection_status": item["inspection_status"],
                "photo_count": item["photo_count"],
                "model_used": item["model_used"],
                "manifest_hash_at_inspection": item["manifest_hash_at_inspection"],
                "created_at": item["created_at"],
                "latest_review": item["latest_review"],
            }
            for item in inspections
        ],
    }


@app.get("/api/inspections/{inspection_id}")
def get_inspection_by_id(inspection_id: str):
    """Retrieve a single inspection by its UUID."""
    inspection = get_inspection(inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")
    return {
        "inspection_id": inspection["id"],
        "manifest_id": inspection["manifest_id"],
        "inspection_status": inspection["inspection_status"],
        "manifest_hash_at_inspection": inspection["manifest_hash_at_inspection"],
        "photo_count": inspection["photo_count"],
        "photos": [
            {
                "id": p["id"],
                "sha256": p["sha256"],
                "mime_type": p["mime_type"],
                "size_bytes": p["size_bytes"],
            }
            for p in inspection["photos"]
        ],
        "ai_result": inspection["ai_result"],
        "review_history": inspection.get("review_history", []),
        "model_used": inspection["model_used"],
        "created_at": inspection["created_at"],
        "updated_at": inspection["updated_at"],
    }


@app.get("/api/inspections/{inspection_id}/photos/{photo_id}")
def get_inspection_photo(inspection_id: str, photo_id: str):
    """Return a stored photo only when it belongs to the requested inspection."""
    inspection = get_inspection(inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found.")

    photo = next(
        (item for item in inspection.get("photos", []) if item.get("id") == photo_id),
        None,
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found for this inspection.")

    extension_by_mime = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }
    extension = extension_by_mime.get(photo.get("mime_type"))
    if extension is None:
        raise HTTPException(status_code=415, detail="Stored photo type is not supported.")

    if photo.get("storage_path"):
        try:
            photo_bytes = object_storage.download_private_object(photo["storage_path"])
        except object_storage.StorageConfigurationError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except object_storage.StorageOperationError as exc:
            raise HTTPException(status_code=502, detail=str(exc))
        return Response(
            content=photo_bytes,
            media_type=photo["mime_type"],
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        )

    photo_path = packing_inspector_service.PHOTO_DIR / f"{photo_id}{extension}"
    if not photo_path.is_file():
        raise HTTPException(status_code=404, detail="Stored photo file is unavailable.")

    return FileResponse(
        photo_path,
        media_type=photo["mime_type"],
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )





@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend_routes(full_path: str):
    """Serve built Vite assets and let the frontend handle browser routes."""
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found.")

    if not FRONTEND_DIST.is_dir():
        raise HTTPException(status_code=404, detail="Frontend build is not available.")

    dist_root = FRONTEND_DIST.resolve()
    requested_file = (FRONTEND_DIST / full_path).resolve()
    if requested_file.is_relative_to(dist_root) and requested_file.is_file():
        return FileResponse(requested_file)

    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend route not found.")
