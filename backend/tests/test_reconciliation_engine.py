import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.reconciliation import (
    ReconciliationInputError,
    ReconciliationPreconditionError,
    reconcile_order_document,
)


def sample_records():
    order = {
        "id": "order-1",
        "paypal_order_id": "PAYPAL-ORDER-1",
        "paypal_capture_id": "CAPTURE-1",
        "payment_status": "PAID",
        "currency": "USD",
        "total": "25.00",
        "buyer_name": "Alex Buyer",
        "shipping_address": {
            "address_line_1": "123 River Road",
            "city": "Berlin",
            "state": "Berlin",
            "postal_code": "10115",
            "country_code": "DE",
        },
        "items": [{
            "id": "order-item-1",
            "sku": "SKU-1",
            "name": "Handmade Ceramic Cup",
            "quantity": 2,
            "unit_price": "12.50",
            "line_total": "25.00",
        }],
    }
    manifest = {
        "id": "manifest-1",
        "status": "FINALIZED",
        "manifest_hash": "a" * 64,
        "items": [{
            "id": "manifest-item-1",
            "source_order_item_id": "order-item-1",
            "sku": "SKU-1",
            "description": "Handmade Ceramic Cup",
            "expected_qty": 2,
        }],
    }
    invoice = {
        "document_type": "COMMERCIAL_INVOICE",
        "document_number": "INV-1001",
        "currency": "USD",
        "total_amount": "25.00",
        "recipient_name": "Alex Buyer",
        "recipient_address": {
            "address_line_1": "123 River Road",
            "city": "Berlin",
            "state": "Berlin",
            "postal_code": "10115",
            "country_code": "DE",
        },
        "items": [{
            "sku": "SKU-1",
            "description": "Handmade Ceramic Cup",
            "quantity": 2,
            "unit_amount": "12.50",
            "line_total": "25.00",
        }],
    }
    return order, manifest, invoice


class ReconciliationEngineTests(unittest.TestCase):
    def test_matching_invoice_matches_checked_fields(self):
        order, manifest, invoice = sample_records()

        result = reconcile_order_document(order, manifest, invoice)

        self.assertEqual(result["overall_status"], "MATCHED_FOR_CHECKED_FIELDS")
        self.assertEqual(result["summary"]["mismatches"], 0)
        self.assertEqual(result["summary"]["not_checked"], 0)
        self.assertGreater(result["summary"]["matched"], 0)
        self.assertEqual(result["references"]["paypal_capture_id"], "CAPTURE-1")
        self.assertTrue(all(check["sources"] for check in result["checks"]))

    def test_invoice_total_difference_requires_review_not_automatic_rejection(self):
        order, manifest, invoice = sample_records()
        invoice["total_amount"] = "30.00"

        result = reconcile_order_document(order, manifest, invoice)

        finding = next(item for item in result["findings"] if item["code"] == "INVOICE_TOTAL_MATCH")
        self.assertEqual(result["overall_status"], "REVIEW_REQUIRED")
        self.assertEqual(finding["severity"], "REVIEW")
        self.assertIn("freight", finding["recommended_action"])

    def test_currency_mismatch_is_a_blocker(self):
        order, manifest, invoice = sample_records()
        invoice["currency"] = "EUR"

        result = reconcile_order_document(order, manifest, invoice)

        finding = next(item for item in result["findings"] if item["code"] == "CURRENCY_MATCH")
        self.assertEqual(result["overall_status"], "MISMATCH_FOUND")
        self.assertEqual(finding["severity"], "BLOCKER")

    def test_document_item_quantity_mismatch_is_a_blocker(self):
        order, manifest, invoice = sample_records()
        invoice["items"][0]["quantity"] = 1

        result = reconcile_order_document(order, manifest, invoice)

        finding = next(item for item in result["findings"] if item["code"] == "DOCUMENT_ITEM_QUANTITY_MATCH")
        self.assertEqual(result["overall_status"], "MISMATCH_FOUND")
        self.assertEqual(finding["expected"], "2")
        self.assertEqual(finding["observed"], "1")

    def test_unexpected_document_item_is_flagged(self):
        order, manifest, invoice = sample_records()
        invoice["items"].append({
            "sku": "EXTRA-1", "description": "Unordered item", "quantity": 1,
        })

        result = reconcile_order_document(order, manifest, invoice)

        self.assertIn("DOCUMENT_EXTRA_ITEM", {item["code"] for item in result["findings"]})
        self.assertEqual(result["overall_status"], "MISMATCH_FOUND")

    def test_missing_document_fields_are_not_silently_treated_as_matches(self):
        order, manifest, invoice = sample_records()
        invoice.pop("recipient_address")
        invoice.pop("recipient_name")
        invoice.pop("items")

        result = reconcile_order_document(order, manifest, invoice)

        self.assertEqual(result["overall_status"], "REVIEW_REQUIRED")
        self.assertGreater(result["summary"]["not_checked"], 0)
        self.assertIn("DOCUMENT_ITEMS_PRESENT", {item["code"] for item in result["findings"]})

    def test_country_or_postal_mismatch_is_a_blocker(self):
        order, manifest, invoice = sample_records()
        invoice["recipient_address"]["country_code"] = "FR"

        result = reconcile_order_document(order, manifest, invoice)

        self.assertIn("RECIPIENT_COUNTRY_CODE_MATCH", {item["code"] for item in result["findings"]})
        self.assertEqual(result["overall_status"], "MISMATCH_FOUND")

    def test_manifest_quantity_mismatch_is_a_blocker(self):
        order, manifest, invoice = sample_records()
        manifest["items"][0]["expected_qty"] = 1

        result = reconcile_order_document(order, manifest, invoice)

        self.assertIn("MANIFEST_QUANTITY_MATCH", {item["code"] for item in result["findings"]})
        self.assertEqual(result["overall_status"], "MISMATCH_FOUND")

    def test_packing_list_does_not_require_total_amount(self):
        order, manifest, invoice = sample_records()
        packing_list = {
            "document_type": "PACKING_LIST",
            "document_number": "PL-1001",
            "currency": "USD",
            "recipient_name": invoice["recipient_name"],
            "recipient_address": invoice["recipient_address"],
            "items": [{
                "sku": "SKU-1",
                "description": "Handmade Ceramic Cup",
                "quantity": 2,
            }],
        }

        result = reconcile_order_document(order, manifest, packing_list)

        self.assertNotEqual(result["overall_status"], "MISMATCH_FOUND")
        self.assertIn("INVOICE_TOTAL_NOT_APPLICABLE", {item["code"] for item in result["checks"]})

    def test_unpaid_order_cannot_be_reconciled(self):
        order, manifest, invoice = sample_records()
        order["payment_status"] = "CREATED"

        with self.assertRaises(ReconciliationPreconditionError):
            reconcile_order_document(order, manifest, invoice)

    def test_unfinalized_manifest_cannot_be_reconciled(self):
        order, manifest, invoice = sample_records()
        manifest["status"] = "DRAFT"

        with self.assertRaises(ReconciliationPreconditionError):
            reconcile_order_document(order, manifest, invoice)

    def test_invalid_document_quantity_is_rejected(self):
        order, manifest, invoice = sample_records()
        invoice["items"][0]["quantity"] = 1.5

        with self.assertRaises(ReconciliationInputError):
            reconcile_order_document(order, manifest, invoice)

    def test_unsupported_document_type_is_rejected(self):
        order, manifest, invoice = sample_records()
        invoice["document_type"] = "CUSTOMS_DECLARATION"

        with self.assertRaises(ReconciliationInputError):
            reconcile_order_document(order, manifest, invoice)


if __name__ == "__main__":
    unittest.main()
