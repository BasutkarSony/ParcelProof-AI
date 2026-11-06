"""Deterministic reconciliation between a paid PayPal order and export documents.

Document values are supplied in a normalized structure by the caller. This
module deliberately does not use an LLM to decide whether values match.
"""
from __future__ import annotations

import re
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from typing import Any

ENGINE_VERSION = "0.1.0"
DOCUMENT_TYPES = {"COMMERCIAL_INVOICE", "PACKING_LIST"}
CENT = Decimal("0.01")
ADDRESS_FIELDS = (
    "address_line_1",
    "city",
    "state",
    "postal_code",
    "country_code",
)


class ReconciliationInputError(ValueError):
    """The supplied normalized document cannot be safely reconciled."""


class ReconciliationPreconditionError(ValueError):
    """The PayPal order or manifest is not eligible for reconciliation."""


def _text(value: Any) -> str:
    return str(value or "").strip()


def _normalized(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", _text(value).casefold())


def _money(value: Any, field: str, *, required: bool = False) -> Decimal | None:
    if value is None or value == "":
        if required:
            raise ReconciliationInputError(f"Document field '{field}' is required.")
        return None
    if isinstance(value, bool):
        raise ReconciliationInputError(f"Document field '{field}' must be a monetary amount.")
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ReconciliationInputError(f"Document field '{field}' must be a valid monetary amount.") from None
    if not parsed.is_finite() or parsed < 0:
        raise ReconciliationInputError(f"Document field '{field}' must be a non-negative monetary amount.")
    rounded = parsed.quantize(CENT)
    if parsed != rounded:
        raise ReconciliationInputError(f"Document field '{field}' may contain no more than two decimal places.")
    return rounded


def _quantity(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ReconciliationInputError(f"Document field '{field}' must be a positive whole number.")
    return value


def _check(
    checks: list[dict],
    *,
    code: str,
    status: str,
    severity: str,
    field: str,
    expected: Any,
    observed: Any,
    message: str,
    recommended_action: str,
    sources: list[dict],
) -> None:
    checks.append({
        "code": code,
        "status": status,
        "severity": severity,
        "field": field,
        "expected": None if expected is None else str(expected),
        "observed": None if observed is None else str(observed),
        "message": message,
        "recommended_action": recommended_action,
        "sources": sources,
    })


def _compare(
    checks: list[dict],
    *,
    code: str,
    field: str,
    expected: Any,
    observed: Any,
    severity: str = "REVIEW",
    message: str,
    recommended_action: str,
    sources: list[dict],
    normalize: bool = False,
) -> None:
    if expected in (None, "") or observed in (None, ""):
        missing_side = "document" if observed in (None, "") else "PayPal order"
        _check(
            checks,
            code=code,
            status="NOT_CHECKED",
            severity="REVIEW",
            field=field,
            expected=expected,
            observed=observed,
            message=f"{field} could not be compared because the {missing_side} value is missing.",
            recommended_action=f"Confirm and record {field} before treating this reconciliation as complete.",
            sources=sources,
        )
        return
    left = _normalized(expected) if normalize else expected
    right = _normalized(observed) if normalize else observed
    matched = left == right
    _check(
        checks,
        code=code,
        status="MATCH" if matched else "MISMATCH",
        severity="INFO" if matched else severity,
        field=field,
        expected=expected,
        observed=observed,
        message=message if matched else f"{message} The values do not match.",
        recommended_action="No action required." if matched else recommended_action,
        sources=sources,
    )


def _address_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return {key: _text(value.get(key)) for key in ADDRESS_FIELDS if _text(value.get(key))}
    if isinstance(value, str) and value.strip():
        return {"_full_address": value.strip()}
    return {}


def _order_item_key(item: dict) -> str:
    sku = _normalized(item.get("sku"))
    if sku:
        return f"sku:{sku}"
    name = _normalized(item.get("name") or item.get("description"))
    return f"name:{name}" if name else ""


def _document_item_key(item: dict) -> str:
    sku = _normalized(item.get("sku"))
    if sku:
        return f"sku:{sku}"
    description = _normalized(item.get("description") or item.get("name"))
    return f"name:{description}" if description else ""


def reconcile_order_document(order: dict, manifest: dict, document: dict) -> dict:
    """Compare normalized export-document data with a verified PayPal order.

    Accepted document fields:
      document_type: COMMERCIAL_INVOICE or PACKING_LIST
      document_number, currency, total_amount, recipient_name,
      recipient_address, items[{sku, description, quantity, unit_amount,
      line_total}]

    A packing list need not contain monetary values. Missing fields remain
    NOT_CHECKED; they are never silently treated as a match.
    """
    if not isinstance(order, dict) or not isinstance(manifest, dict):
        raise ReconciliationInputError("A PayPal order and shipment manifest are required.")
    if not isinstance(document, dict):
        raise ReconciliationInputError("The normalized export document must be an object.")

    if _text(order.get("payment_status")).upper() != "PAID":
        raise ReconciliationPreconditionError("Only a verified PAID PayPal order can be reconciled.")
    if not _text(order.get("paypal_capture_id")):
        raise ReconciliationPreconditionError("The PayPal order has no verified capture ID.")
    if _text(manifest.get("status")).upper() != "FINALIZED":
        raise ReconciliationPreconditionError("Finalize the shipment manifest before reconciliation.")
    if not manifest.get("manifest_hash"):
        raise ReconciliationPreconditionError("The finalized manifest has no integrity fingerprint.")

    document_type = _text(document.get("document_type")).upper()
    if document_type not in DOCUMENT_TYPES:
        raise ReconciliationInputError(
            "document_type must be COMMERCIAL_INVOICE or PACKING_LIST."
        )

    checks: list[dict] = []
    order_ref = _text(order.get("id"))
    manifest_ref = _text(manifest.get("id"))
    document_ref = _text(document.get("document_number")) or "UNNUMBERED_DOCUMENT"

    doc_currency = _text(document.get("currency")).upper()
    order_currency = _text(order.get("currency")).upper()
    if document_type == "PACKING_LIST" and not doc_currency:
        _check(
            checks,
            code="CURRENCY_NOT_APPLICABLE",
            status="NOT_APPLICABLE",
            severity="INFO",
            field="currency",
            expected=None,
            observed=None,
            message="A packing list is not required to state a monetary currency.",
            recommended_action="No action required.",
            sources=[{"record": "export_document", "id": document_ref, "field": "document_type"}],
        )
    else:
        _compare(
            checks,
            code="CURRENCY_MATCH",
            field="currency",
            expected=order_currency,
            observed=doc_currency,
            severity="BLOCKER",
            message="Document currency matches the captured PayPal order.",
            recommended_action="Correct the document currency or investigate the source order before dispatch.",
            sources=[
                {"record": "paypal_order", "id": order_ref, "field": "currency"},
                {"record": "export_document", "id": document_ref, "field": "currency"},
            ],
        )

    if document_type == "COMMERCIAL_INVOICE":
        order_total = _money(order.get("total"), "order.total", required=True)
        document_total = _money(document.get("total_amount"), "total_amount")
        _compare(
            checks,
            code="INVOICE_TOTAL_MATCH",
            field="invoice total",
            expected=order_total,
            observed=document_total,
            severity="REVIEW",
            message=(
                "Invoice total matches the PayPal order total. Compare like-for-like "
                "totals; freight, tax, discounts or duties may explain a difference."
            ),
            recommended_action=(
                "Review the invoice's goods, freight, tax and discount breakdown. "
                "Do not change the PayPal amount to force a match."
            ),
            sources=[
                {"record": "paypal_order", "id": order_ref, "field": "total"},
                {"record": "export_document", "id": document_ref, "field": "total_amount"},
            ],
        )
    else:
        _check(
            checks,
            code="INVOICE_TOTAL_NOT_APPLICABLE",
            status="NOT_APPLICABLE",
            severity="INFO",
            field="invoice total",
            expected=None,
            observed=None,
            message="A packing list is not expected to contain a payable total.",
            recommended_action="No action required.",
            sources=[{"record": "export_document", "id": document_ref, "field": "document_type"}],
        )

    _compare(
        checks,
        code="RECIPIENT_NAME_MATCH",
        field="recipient name",
        expected=_text(order.get("buyer_name")),
        observed=_text(document.get("recipient_name")),
        severity="REVIEW",
        message="Document recipient name matches the PayPal buyer name.",
        recommended_action="Confirm the recipient identity and correct the source document if necessary.",
        sources=[
            {"record": "paypal_order", "id": order_ref, "field": "buyer_name"},
            {"record": "export_document", "id": document_ref, "field": "recipient_name"},
        ],
        normalize=True,
    )

    order_address = _address_dict(order.get("shipping_address"))
    doc_address = _address_dict(document.get("recipient_address"))
    if "_full_address" in order_address or "_full_address" in doc_address:
        _compare(
            checks,
            code="RECIPIENT_ADDRESS_MATCH",
            field="recipient address",
            expected=order_address.get("_full_address"),
            observed=doc_address.get("_full_address"),
            severity="REVIEW",
            message="Document recipient address matches the PayPal shipping address.",
            recommended_action="Compare the complete recipient address and correct any discrepancy.",
            sources=[
                {"record": "paypal_order", "id": order_ref, "field": "shipping_address"},
                {"record": "export_document", "id": document_ref, "field": "recipient_address"},
            ],
            normalize=True,
        )
    elif not order_address or not doc_address:
        _check(
            checks,
            code="RECIPIENT_ADDRESS_PRESENT",
            status="NOT_CHECKED",
            severity="REVIEW",
            field="recipient address",
            expected="Structured PayPal shipping address",
            observed="Structured document recipient address" if doc_address else None,
            message="A structured recipient address is not available on both records.",
            recommended_action="Add or verify the recipient address in both records.",
            sources=[
                {"record": "paypal_order", "id": order_ref, "field": "shipping_address"},
                {"record": "export_document", "id": document_ref, "field": "recipient_address"},
            ],
        )
    else:
        for address_field in ADDRESS_FIELDS:
            expected = order_address.get(address_field)
            observed = doc_address.get(address_field)
            if expected or observed:
                _compare(
                    checks,
                    code=f"RECIPIENT_{address_field.upper()}_MATCH",
                    field=f"recipient {address_field.replace('_', ' ')}",
                    expected=expected,
                    observed=observed,
                    severity="BLOCKER" if address_field in {"country_code", "postal_code"} else "REVIEW",
                    message=f"Document recipient {address_field.replace('_', ' ')} matches the PayPal shipping address.",
                    recommended_action="Verify the buyer-provided destination and correct the document before dispatch.",
                    sources=[
                        {"record": "paypal_order", "id": order_ref, "field": f"shipping_address.{address_field}"},
                        {"record": "export_document", "id": document_ref, "field": f"recipient_address.{address_field}"},
                    ],
                    normalize=True,
                )

    # The manifest must remain traceable to the exact paid-order line items.
    source_items = { _text(item.get("id")): item for item in (order.get("items") or []) }
    manifest_items = manifest.get("items")
    if not isinstance(manifest_items, list) or not manifest_items:
        raise ReconciliationPreconditionError("The finalized manifest has no items to reconcile.")

    manifest_source_ids: set[str] = set()
    for position, item in enumerate(manifest_items):
        source_id = _text(item.get("source_order_item_id"))
        label = f"manifest item {position + 1}"
        if not source_id:
            _check(
                checks,
                code="MANIFEST_SOURCE_LINK_MISSING",
                status="NOT_CHECKED",
                severity="REVIEW",
                field=f"{label} source order item",
                expected="Paid-order item reference",
                observed=None,
                message=f"{label} is not linked to a paid-order line item.",
                recommended_action="Review the manifest line against the original paid order.",
                sources=[
                    {"record": "shipment_manifest", "id": manifest_ref, "field": f"items[{position}]"},
                    {"record": "paypal_order", "id": order_ref, "field": "items"},
                ],
            )
            continue
        source = source_items.get(source_id)
        if source is None:
            _check(
                checks,
                code="MANIFEST_SOURCE_LINK_INVALID",
                status="MISMATCH",
                severity="BLOCKER",
                field=f"{label} source order item",
                expected="An item belonging to this PayPal order",
                observed=source_id,
                message=f"{label} refers to an item outside the paid PayPal order.",
                recommended_action="Correct the manifest source reference before dispatch.",
                sources=[
                    {"record": "shipment_manifest", "id": manifest_ref, "field": f"items[{position}].source_order_item_id"},
                    {"record": "paypal_order", "id": order_ref, "field": "items[].id"},
                ],
            )
            continue
        if source_id in manifest_source_ids:
            _check(
                checks,
                code="MANIFEST_SOURCE_DUPLICATED",
                status="MISMATCH",
                severity="BLOCKER",
                field=f"{label} source order item",
                expected="A unique order-item reference",
                observed=source_id,
                message=f"The same paid-order line is referenced more than once in the manifest.",
                recommended_action="Remove duplicate manifest rows or correct their source references.",
                sources=[{"record": "shipment_manifest", "id": manifest_ref, "field": f"items[{position}]"}],
            )
            continue
        manifest_source_ids.add(source_id)
        _compare(
            checks,
            code="MANIFEST_SKU_MATCH",
            field=f"{label} SKU",
            expected=source.get("sku"),
            observed=item.get("sku"),
            severity="BLOCKER",
            message=f"{label} SKU matches its paid-order item.",
            recommended_action="Correct the manifest SKU to match the purchased product.",
            sources=[
                {"record": "paypal_order", "id": order_ref, "field": f"items[{source_id}].sku"},
                {"record": "shipment_manifest", "id": manifest_ref, "field": f"items[{position}].sku"},
            ],
            normalize=True,
        )
        _compare(
            checks,
            code="MANIFEST_QUANTITY_MATCH",
            field=f"{label} quantity",
            expected=source.get("quantity"),
            observed=item.get("expected_qty"),
            severity="BLOCKER",
            message=f"{label} quantity matches its paid-order item.",
            recommended_action="Correct the manifest quantity to match the quantity purchased.",
            sources=[
                {"record": "paypal_order", "id": order_ref, "field": f"items[{source_id}].quantity"},
                {"record": "shipment_manifest", "id": manifest_ref, "field": f"items[{position}].expected_qty"},
            ],
        )
    for source_id, source in source_items.items():
        if source_id not in manifest_source_ids:
            _check(
                checks,
                code="MANIFEST_ORDER_ITEM_MISSING",
                status="MISMATCH",
                severity="BLOCKER",
                field=f"manifest item for {source.get('sku') or source.get('name')}",
                expected=source.get("sku") or source.get("name"),
                observed=None,
                message="A purchased order item is missing from the finalized packing manifest.",
                recommended_action="Resolve the missing manifest line; a finalized manifest may need a controlled correction workflow.",
                sources=[
                    {"record": "paypal_order", "id": order_ref, "field": f"items[{source_id}]"},
                    {"record": "shipment_manifest", "id": manifest_ref, "field": "items"},
                ],
            )

    document_items = document.get("items")
    if not isinstance(document_items, list) or not document_items:
        _check(
            checks,
            code="DOCUMENT_ITEMS_PRESENT",
            status="NOT_CHECKED",
            severity="REVIEW",
            field="document line items",
            expected="At least one identifiable line item",
            observed=None,
            message="The document contains no structured line items to compare.",
            recommended_action="Extract or enter the document's SKU/description and quantity fields.",
            sources=[{"record": "export_document", "id": document_ref, "field": "items"}],
        )
    else:
        expected_by_key: dict[str, dict] = {}
        for item in order.get("items") or []:
            key = _order_item_key(item)
            if not key:
                continue
            if key not in expected_by_key:
                expected_by_key[key] = {
                    "sku": item.get("sku"),
                    "name": item.get("name"),
                    "quantity": 0,
                    "unit_price": item.get("unit_price"),
                }
            expected_by_key[key]["quantity"] += int(item.get("quantity") or 0)

        observed_by_key: dict[str, dict] = {}
        unidentified_count = 0
        for position, item in enumerate(document_items):
            if not isinstance(item, dict):
                raise ReconciliationInputError(f"Document line item {position + 1} must be an object.")
            key = _document_item_key(item)
            if not key:
                unidentified_count += 1
                _check(
                    checks,
                    code="DOCUMENT_ITEM_UNIDENTIFIED",
                    status="NOT_CHECKED",
                    severity="REVIEW",
                    field=f"document line item {position + 1}",
                    expected="SKU or description",
                    observed=None,
                    message="A document line item has no usable SKU or description.",
                    recommended_action="Review and identify this line item before treating the document as reconciled.",
                    sources=[{"record": "export_document", "id": document_ref, "field": f"items[{position}]"}],
                )
                continue
            raw_quantity = item.get("quantity")
            quantity = None if raw_quantity in (None, "") else _quantity(raw_quantity, f"items[{position}].quantity")
            if key not in observed_by_key:
                observed_by_key[key] = {"quantity": 0, "quantity_unknown": False, "rows": [], "unit_amount": item.get("unit_amount")}
            if quantity is None:
                observed_by_key[key]["quantity_unknown"] = True
            elif not observed_by_key[key]["quantity_unknown"]:
                observed_by_key[key]["quantity"] += quantity
            observed_by_key[key]["rows"].append(position)

        for key, expected in expected_by_key.items():
            observed = observed_by_key.get(key)
            item_label = expected.get("sku") or expected.get("name") or key
            if observed is None:
                _check(
                    checks,
                    code="DOCUMENT_ORDER_ITEM_MISSING",
                    status="MISMATCH",
                    severity="BLOCKER",
                    field=f"document item {item_label}",
                    expected=expected["quantity"],
                    observed=None,
                    message=f"The export document is missing a purchased item: {item_label}.",
                    recommended_action="Correct the export document or investigate why the purchased item is absent.",
                    sources=[
                        {"record": "paypal_order", "id": order_ref, "field": "items"},
                        {"record": "export_document", "id": document_ref, "field": "items"},
                    ],
                )
                continue
            if observed.get("quantity_unknown"):
                _check(
                    checks, code="DOCUMENT_ITEM_QUANTITY_MATCH", status="NOT_CHECKED",
                    severity="REVIEW", field=f"quantity for {item_label}",
                    expected=expected["quantity"], observed=None,
                    message=f"The quantity for {item_label} could not be read confidently from the document.",
                    recommended_action="Check the original document and enter the printed quantity.",
                    sources=[
                        {"record": "paypal_order", "id": order_ref, "field": "items"},
                        {"record": "export_document", "id": document_ref, "field": f"items[{','.join(map(str, observed['rows']))}].quantity"},
                    ],
                )
            else:
                _compare(
                    checks,
                    code="DOCUMENT_ITEM_QUANTITY_MATCH",
                    field=f"quantity for {item_label}",
                    expected=expected["quantity"],
                    observed=observed["quantity"],
                    severity="BLOCKER",
                    message=f"Document quantity matches the paid order for {item_label}.",
                    recommended_action="Correct the document quantity or investigate the order discrepancy.",
                    sources=[
                        {"record": "paypal_order", "id": order_ref, "field": "items"},
                        {"record": "export_document", "id": document_ref, "field": f"items[{','.join(map(str, observed['rows']))}].quantity"},
                    ],
                )
            if document_type == "COMMERCIAL_INVOICE" and observed.get("unit_amount") not in (None, ""):
                expected_unit = _money(expected.get("unit_price"), "order item unit_price")
                observed_unit = _money(observed.get("unit_amount"), "items.unit_amount")
                _compare(
                    checks,
                    code="DOCUMENT_ITEM_UNIT_VALUE_MATCH",
                    field=f"unit value for {item_label}",
                    expected=expected_unit,
                    observed=observed_unit,
                    severity="REVIEW",
                    message=f"Invoice unit value matches the PayPal order for {item_label}.",
                    recommended_action="Review discounts, tax treatment or price changes against the source order.",
                    sources=[
                        {"record": "paypal_order", "id": order_ref, "field": "items[].unit_price"},
                        {"record": "export_document", "id": document_ref, "field": "items[].unit_amount"},
                    ],
                )

        for key, observed in observed_by_key.items():
            if key not in expected_by_key:
                _check(
                    checks,
                    code="DOCUMENT_EXTRA_ITEM",
                    status="MISMATCH",
                    severity="BLOCKER",
                    field=f"unexpected document item {key.split(':', 1)[-1]}",
                    expected="An item present on the PayPal order",
                    observed=key.split(":", 1)[-1],
                    message="The export document contains an item not found on the paid PayPal order.",
                    recommended_action="Verify the document line against the buyer's order and remove or explain an unrelated item.",
                    sources=[
                        {"record": "export_document", "id": document_ref, "field": "items"},
                        {"record": "paypal_order", "id": order_ref, "field": "items"},
                    ],
                )

    mismatches = [item for item in checks if item["status"] == "MISMATCH"]
    needs_review = [item for item in checks if item["status"] == "NOT_CHECKED"]
    has_blocker = any(item["severity"] == "BLOCKER" for item in mismatches)
    overall_status = (
        "MISMATCH_FOUND" if has_blocker
        else "REVIEW_REQUIRED" if mismatches or needs_review
        else "MATCHED_FOR_CHECKED_FIELDS"
    )

    return {
        "engine": "PARCELPROOF_DETERMINISTIC_RECONCILIATION",
        "engine_version": ENGINE_VERSION,
        "overall_status": overall_status,
        "decision_notice": (
            "This is an operational consistency check, not customs clearance, carrier proof, "
            "PayPal Seller Protection eligibility or legal/export compliance advice."
        ),
        "references": {
            "order_id": order_ref,
            "paypal_order_id": _text(order.get("paypal_order_id")),
            "paypal_capture_id": _text(order.get("paypal_capture_id")),
            "manifest_id": manifest_ref,
            "manifest_hash": _text(manifest.get("manifest_hash")),
            "document_type": document_type,
            "document_number": document_ref,
        },
        "summary": {
            "checks_total": len(checks),
            "matched": sum(item["status"] == "MATCH" for item in checks),
            "mismatches": len(mismatches),
            "not_checked": len(needs_review),
            "blockers": sum(item["status"] == "MISMATCH" and item["severity"] == "BLOCKER" for item in checks),
        },
        "checks": checks,
        "findings": [item for item in checks if item["status"] in {"MISMATCH", "NOT_CHECKED"}],
    }
