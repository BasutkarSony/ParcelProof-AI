import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.store as store
from app.document_extractor import (
    DocumentValidationError, detect_document_mime, extract_export_document,
    validate_confirmed_document, validate_document_bytes,
)


class DocumentValidationTests(unittest.TestCase):
    def test_file_signatures(self):
        self.assertEqual(detect_document_mime(b"%PDF-1.7 data"), "application/pdf")
        self.assertEqual(detect_document_mime(b"\xff\xd8\xffx"), "image/jpeg")
        self.assertEqual(detect_document_mime(b"\x89PNG\r\n\x1a\nx"), "image/png")
        self.assertEqual(detect_document_mime(b"RIFF1234WEBPpayload"), "image/webp")

    def test_reject_unknown_or_oversized(self):
        with self.assertRaises(DocumentValidationError):
            validate_document_bytes(b"not pdf")
        with self.assertRaises(DocumentValidationError):
            validate_document_bytes(b"%PDF-" + b"x" * (10 * 1024 * 1024))

    def test_no_gemini_key_supports_manual_review(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
            result = extract_export_document(b"%PDF-1.4 x", "application/pdf", "COMMERCIAL_INVOICE")
        self.assertEqual(result["status"], "NOT_CONFIGURED")
        self.assertIsNone(result["data"])

    def test_merchant_confirmation_normalizes_values(self):
        doc = validate_confirmed_document({
            "document_type": "COMMERCIAL_INVOICE", "document_number": " INV-22 ",
            "currency": "usd", "total_amount": "25",
            "recipient_name": "Buyer", "recipient_address": {"country_code": "de"},
            "items": [{"sku": "SKU-1", "description": "Product", "quantity": 2, "unit_amount": "12.5"}],
        }, "COMMERCIAL_INVOICE")
        self.assertEqual(doc["document_number"], "INV-22")
        self.assertEqual(doc["currency"], "USD")
        self.assertEqual(doc["total_amount"], "25.00")
        self.assertTrue(doc["merchant_confirmed"])

    def test_unknown_quantity_allowed_for_human_correction(self):
        doc = validate_confirmed_document({
            "document_type": "PACKING_LIST", "items": [{"description": "Notebook", "quantity": None}],
        }, "PACKING_LIST")
        self.assertIsNone(doc["items"][0]["quantity"])

    def test_document_type_cannot_be_switched(self):
        with self.assertRaises(DocumentValidationError):
            validate_confirmed_document({"document_type": "PACKING_LIST"}, "COMMERCIAL_INVOICE")


class DocumentPersistenceTests(unittest.TestCase):
    def setUp(self):
        handle = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        handle.close()
        self.path = Path(handle.name)
        self.old_path = store.DB_PATH
        store.DB_PATH = self.path
        store.init_db()
        order = store.create_order([{"sku": "NOTE-A5-003", "quantity": 1}], buyer_name="Test Buyer")
        store.set_paypal_order_id(order["id"], "PAYPAL-123")
        store.set_capture(order["id"], "CAPTURE-123", "PAID")
        self.order = store.get_order(order["id"])
        self.shipment = store.create_shipment_for_order(
            checkout_order_id=order["id"], paypal_order_id="PAYPAL-123",
            paypal_capture_id="CAPTURE-123", amount=order["total"], currency="USD",
            shipping_address=order["shipping_address"], buyer_name="Test Buyer",
        )
        manifest = store.create_manifest_from_checkout_order(self.shipment["order_id"], self.order["id"])
        self.manifest = store.finalize_manifest(manifest["id"])

    def tearDown(self):
        store.DB_PATH = self.old_path
        os.unlink(self.path)

    def test_document_confirmation_and_reconciliation_history_persist(self):
        doc = store.create_shipment_document(
            self.shipment["order_id"], document_type="COMMERCIAL_INVOICE",
            original_filename="invoice.pdf", mime_type="application/pdf",
            size_bytes=120, sha256="a" * 64, storage_path="shipment/invoice.pdf",
        )
        updated = store.update_shipment_document_extraction(
            doc["id"], extraction_status="NOT_CONFIGURED", document_status="AWAITING_REVIEW",
        )
        self.assertEqual(updated["document_status"], "AWAITING_REVIEW")
        confirmed = store.confirm_shipment_document(
            doc["id"], confirmed_data={"document_type": "COMMERCIAL_INVOICE", "items": []},
            reviewer_label="Merchant",
        )
        self.assertEqual(confirmed["document_status"], "CONFIRMED")
        result = {"overall_status": "REVIEW_REQUIRED", "engine_version": "0.1.0"}
        run = store.create_reconciliation_run(
            shipment_order_id=self.shipment["order_id"], order_id=self.order["id"],
            manifest_id=self.manifest["id"], document_id=doc["id"], result=result,
        )
        self.assertEqual(run["document_id"], doc["id"])
        self.assertEqual(run["result"]["overall_status"], "REVIEW_REQUIRED")
        self.assertEqual(len(store.list_reconciliation_runs(self.shipment["order_id"])), 1)


if __name__ == "__main__":
    unittest.main()
