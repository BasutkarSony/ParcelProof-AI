import re
from datetime import date
from typing import Any, Dict, List, Optional


CARRIER_PATTERNS = {
    "UPS": re.compile(r"^1Z[0-9A-Z]{16}$", re.IGNORECASE),
    "FEDEX": re.compile(r"^(\d{12}|\d{15}|\d{20}|\d{22})$"),
    "USPS": re.compile(r"^(9[1-5]\d{20}|[A-Z]{2}\d{9}[A-Z]{2}|\d{20}|\d{22})$", re.IGNORECASE),
    "DHL": re.compile(r"^(\d{10}|\d{11})$"),
}

EXCEPTION_KEYWORDS = [
    "returned to sender",
    "delivery failed",
    "damaged in transit",
    "refused by recipient",
    "held at customs",
    "incorrect address",
    "undeliverable",
    "package lost",
]

def _detect_probable_carrier(tracking_number: str) -> Optional[str]:
    cleaned = tracking_number.strip().replace(" ", "").replace("-", "")
    for carrier, pattern in CARRIER_PATTERNS.items():
        if pattern.match(cleaned):
            return carrier
    return None


def analyze_shipment_evidence(order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic shipment-record completeness checks for merchant operations.

    This is not a Seller Protection eligibility calculator. Merchant-entered
    shipment fields and notes are not treated as independent carrier evidence.
    """
    order_id = str(order.get("order_id", "UNKNOWN")).strip()
    transaction_id = str(order.get("transaction_id", "")).strip()
    tracking_number = str(order.get("tracking_number", "")).strip()
    carrier = str(order.get("carrier", "")).strip().upper()
    carrier_other = str(order.get("carrier_name_other", "")).strip()
    status = str(order.get("status", "")).strip().upper()
    shipped_date = str(order.get("shipped_date", "") or "").strip()
    delivered_date = str(order.get("delivered_date", "") or "").strip()
    shipping_address = str(order.get("shipping_address", "") or "").strip()
    evidence_text = str(order.get("evidence_text", "") or "").strip()

    # Evidence checks are deliberately independent of Seller Protection eligibility.
    # PayPal applies country-, account-, transaction- and claim-specific rules.
    evidence_lower = evidence_text.lower()

    strengths: List[str] = []
    risk_factors: List[str] = []
    recommendations: List[str] = []
    exceptions_detected: List[str] = []

    score = 100

    # 1. Transaction & Order ID baseline
    if not transaction_id:
        score -= 25
        risk_factors.append("Missing PayPal transaction ID.")
        recommendations.append("Attach the genuine PayPal transaction ID associated with this payment.")
    elif transaction_id.upper().startswith("SANDBOX-TXN-"):
        # Synthetic / demo ID
        score -= 5
        risk_factors.append("Sample transaction ID detected (SANDBOX-TXN-*).")
        recommendations.append("Replace with a genuine PayPal Sandbox capture ID before live testing.")

    # 2. Tracking number presence & carrier matching
    cleaned_tracking = tracking_number.replace(" ", "").replace("-", "")
    if not tracking_number:
        score -= 40
        risk_factors.append("No tracking number provided.")
        recommendations.append("Obtain an official carrier tracking number before submitting evidence.")
    else:
        strengths.append(f"Tracking number provided: {tracking_number}")
        probable_carrier = _detect_probable_carrier(tracking_number)

        if carrier in CARRIER_PATTERNS:
            if CARRIER_PATTERNS[carrier].match(cleaned_tracking):
                strengths.append(f"Tracking number matches standard {carrier} format.")
            elif probable_carrier and probable_carrier != carrier:
                score -= 15
                risk_factors.append(
                    f"Format mismatch: tracking number matches {probable_carrier} format, but carrier is set to {carrier}."
                )
                recommendations.append(f"Verify whether this package was actually shipped via {probable_carrier}.")
            elif tracking_number.upper().startswith(("DEMO", "TRACK", "TEST")):
                strengths.append(f"Demonstration/simulated tracking number provided for testing.")
        elif carrier == "OTHER":
            if not carrier_other:
                score -= 20
                risk_factors.append("Carrier is set to 'OTHER' but no carrier name was specified.")
                recommendations.append("Provide the specific carrier name (carrier_name_other) required by PayPal.")
            else:
                strengths.append(f"Custom carrier documented: {carrier_other}")

    # 3. No signature threshold or protection eligibility inference.
    # Signature requirements depend on PayPal's current country, transaction,
    # account and claim rules; this heuristic does not assess them.

    # 4. Dates & Chronology Consistency
    parsed_shipped = None
    parsed_delivered = None
    today = date.today()

    if shipped_date:
        try:
            parsed_shipped = date.fromisoformat(shipped_date)
            if parsed_shipped > today:
                score -= 30
                risk_factors.append(f"Shipment date ({shipped_date}) is in the future.")
                recommendations.append("Correct the shipment date to reflect actual carrier dispatch.")
            else:
                strengths.append(f"Dispatch date documented ({shipped_date}).")
        except ValueError:
            score -= 15
            risk_factors.append(f"Shipment date format invalid: '{shipped_date}'. Must be YYYY-MM-DD.")

    if delivered_date:
        try:
            parsed_delivered = date.fromisoformat(delivered_date)
            if parsed_delivered > today:
                score -= 30
                risk_factors.append(f"Delivery date ({delivered_date}) is in the future.")
                recommendations.append("Delivery cannot be recorded in the future.")
            elif parsed_shipped and parsed_delivered < parsed_shipped:
                score -= 35
                risk_factors.append("Delivery date precedes shipment date.")
                recommendations.append("Resolve chronological conflict between shipping and delivery records.")
            else:
                strengths.append(f"Confirmed delivery date ({delivered_date}).")
        except ValueError:
            score -= 15
            risk_factors.append(f"Delivery date format invalid: '{delivered_date}'. Must be YYYY-MM-DD.")

    if status == "DELIVERED" and not delivered_date:
        score -= 10
        risk_factors.append("Status is marked DELIVERED but no delivery date is recorded.")
        recommendations.append("Include the delivery date from carrier tracking to substantiate delivery proof.")

    # 5. Merchant-entered evidence notes and destination text matching
    destination_tokens_matched: List[str] = []
    if evidence_text:
        for kw in EXCEPTION_KEYWORDS:
            if kw in evidence_lower:
                exceptions_detected.append(kw)
                score -= 25
                risk_factors.append(
                    f"Shipment notes contain the phrase '{kw}'. Confirm it against the carrier's official tracking record."
                )
                recommendations.append("Check the carrier's official tracking page and resolve any confirmed exception.")

        # Address verification against shipping address
        if shipping_address:
            # Extract postal code or city tokens
            addr_tokens = [t.strip().lower() for t in re.split(r"[, ]+", shipping_address) if len(t.strip()) >= 3]
            destination_tokens_matched = [t for t in addr_tokens if t in evidence_lower]
            if destination_tokens_matched:
                strengths.append(
                    "Shipment notes mention destination text "
                    f"({', '.join(dict.fromkeys(destination_tokens_matched[:2]))}); this is not carrier verification."
                )
            else:
                recommendations.append("Compare the recipient destination against an online-verifiable carrier record.")
        else:
            recommendations.append("Record buyer's destination shipping address to ensure matching with PayPal transaction details.")
    else:
        recommendations.append("Attach carrier-issued tracking milestones and proof of shipment or delivery when available.")

    # Calculate an operational evidence-completeness indicator, not protection readiness.
    final_score = max(0, min(100, score))

    if final_score >= 85:
        tier = "RECORD_COMPLETE"
        evidence_label = "Shipment record looks complete for review"
    elif final_score >= 70:
        tier = "RECORD_NEEDS_REVIEW"
        evidence_label = "Shipment record needs a closer review"
    elif final_score >= 45:
        tier = "EVIDENCE_GAPS"
        evidence_label = "Important shipment information is missing"
    else:
        tier = "MAJOR_EVIDENCE_GAPS"
        evidence_label = "Shipment record has major gaps"

    # PayPal Orders v2 Add Tracking preview.
    paypal_tracking_request_body: Dict[str, Any] = {
        "capture_id": transaction_id,
        "tracking_number": tracking_number,
        "carrier": carrier or "OTHER",
        "notify_payer": False,
    }
    if carrier == "OTHER" and carrier_other:
        paypal_tracking_request_body["carrier_name_other"] = carrier_other

    paypal_payload_preview = {
        "endpoint": "POST /v2/checkout/orders/{paypal_order_id}/track",
        "request_body": paypal_tracking_request_body,
        "submission_safety_status": "DISABLED_BY_DEFAULT",
        "safety_gate_note": (
            "Tracking submission requires a verified paid checkout, the latest finalized-manifest "
            "inspection to be human-approved, and PAYPAL_TRACKING_SUBMISSION_ENABLED=true."
        ),
    }

    return {
        "order_id": order_id,
        "evidence_score": final_score,
        "evidence_tier": tier,
        "evidence_label": evidence_label,
        "evidence_checks": {
            "tracking_number_recorded": bool(tracking_number),
            "carrier_recorded": bool(carrier and (carrier != "OTHER" or carrier_other)),
            "shipment_date_recorded": bool(shipped_date),
            "delivered_status_and_date_recorded": status == "DELIVERED" and bool(delivered_date),
            "destination_text_match": bool(destination_tokens_matched),
            "exception_phrases_found": exceptions_detected,
            "source_notice": (
                "Shipment fields and notes are merchant-entered in this prototype. "
                "No carrier event feed is connected, so these checks do not verify shipment or delivery."
            ),
        },
        "paypal_notice": (
            "This score does not assess PayPal Seller Protection eligibility. PayPal applies the "
            "requirements for the seller's country, account, transaction and claim, and makes the final decision."
        ),
        # Carriers not in CARRIER_PATTERNS (e.g. OTHER) have no automatic
        # tracking-number format validation pattern. format_valid is None
        # (unsupported), never an incorrect PASS or FAIL.
        "carrier_analysis": {
            "carrier": carrier,
            "probable_detected_carrier": _detect_probable_carrier(tracking_number) if tracking_number else None,
            "format_valid": bool(
                carrier in CARRIER_PATTERNS and CARRIER_PATTERNS[carrier].match(cleaned_tracking)
            ) if tracking_number and carrier in CARRIER_PATTERNS else None,
        },
        "evidence_summary": {
            "exceptions_detected": exceptions_detected,
            "evidence_provided": bool(evidence_text),
        },
        "engine_metadata": {
            "type": "DETERMINISTIC_RULES_NLP",
            "name": "Deterministic Shipment Data Checks",
            "auditable": True,
            "zero_hallucination": True,
            "description": "Rule-based checks for entered tracking details, dates, note keywords and address-text overlap. Does not verify carrier events or determine PayPal eligibility.",
        },
        "strengths": strengths,
        "risk_factors": risk_factors,
        "recommendations": recommendations,
        "paypal_payload_preview": paypal_payload_preview,
    }
