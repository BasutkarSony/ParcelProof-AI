import asyncio
import hashlib
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from starlette.datastructures import UploadFile

from app import main as api


class ExportDocumentApiTests(unittest.TestCase):
    def setUp(self):
        self.shipment = {
            "order_id": "SHP-1",
            "checkout_order_id": "order-1",
            "paypal_capture_id": "CAPTURE-1",
            "paypal_order_id": "PAYPAL-1",
        }
        self.original = b"%PDF-1.4 test"
        self.document = {
            "id": "document-1",
            "shipment_order_id": "SHP-1",
            "document_type": "COMMERCIAL_INVOICE",
            "document_status": "STORED",
            "extraction_status": "NOT_STARTED",
            "original_filename": "invoice.pdf",
            "mime_type": "application/pdf",
            "size_bytes": len(self.original),
            "sha256": hashlib.sha256(self.original).hexdigest(),
            "storage_path": "SHP-1/documents/invoice.pdf",
            "extracted_data": None,
            "confirmed_data": None,
            "extraction_provider": None,
            "extraction_error": None,
            "reviewer_label": None,
            "confirmed_at": None,
            "created_at": "2026-11-06T00:00:00+00:00",
        }

    def _upload(self, data=None, filename="../invoice.pdf"):
        return UploadFile(filename=filename, file=io.BytesIO(data if data is not None else self.original))

    @patch("app.main.update_shipment_document_extraction")
    @patch("app.main.extract_export_document", return_value={
        "status": "NOT_CONFIGURED", "provider": None, "data": None,
        "message": "Original saved for manual review.",
    })
    @patch("app.main.create_shipment_document")
    @patch("app.main.object_storage.upload_private_object")
    @patch("app.main.get_shipment_by_order_id")
    def test_upload_saves_private_original_and_reviewable_record(
        self, get_shipment, upload_object, create_document, extract, update_extraction
    ):
        get_shipment.return_value = self.shipment
        create_document.return_value = self.document
        update_extraction.return_value = {
            **self.document,
            "document_status": "AWAITING_REVIEW",
            "extraction_status": "NOT_CONFIGURED",
        }
        result = asyncio.run(
            api.upload_shipment_document("SHP-1", self._upload(), "COMMERCIAL_INVOICE")
        )
        upload_object.assert_called_once()
        self.assertEqual(upload_object.call_args.args[2], "application/pdf")
        self.assertEqual(upload_object.call_args.kwargs["bucket_name"], "shipment-documents")
        self.assertEqual(create_document.call_args.kwargs["original_filename"], "invoice.pdf")
        self.assertEqual(result["document"]["document_status"], "AWAITING_REVIEW")
        self.assertNotIn("storage_path", result["document"])
        self.assertEqual(result["message"], "Original saved for manual review.")

    @patch("app.main.get_shipment_by_order_id", return_value={"order_id": "SHP-SAMPLE"})
    @patch("app.main.object_storage.upload_private_object")
    def test_sample_shipment_is_rejected_before_storage(self, upload_object, _shipment):
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(api.upload_shipment_document("SHP-SAMPLE", self._upload(), "PACKING_LIST"))
        self.assertEqual(raised.exception.status_code, 409)
        upload_object.assert_not_called()

    @patch("app.main.get_shipment_by_order_id", return_value=None)
    @patch("app.main.object_storage.upload_private_object")
    def test_missing_shipment_is_rejected_before_storage(self, upload_object, _shipment):
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(api.upload_shipment_document("SHP-MISSING", self._upload(), "PACKING_LIST"))
        self.assertEqual(raised.exception.status_code, 404)
        upload_object.assert_not_called()

    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.object_storage.upload_private_object")
    def test_non_document_payload_is_rejected_before_storage(self, upload_object, get_shipment):
        get_shipment.return_value = self.shipment
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(api.upload_shipment_document("SHP-1", self._upload(b"not a PDF"), "PACKING_LIST"))
        self.assertEqual(raised.exception.status_code, 415)
        upload_object.assert_not_called()

    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.object_storage.upload_private_object")
    def test_invalid_document_type_is_rejected_before_storage(self, upload_object, get_shipment):
        get_shipment.return_value = self.shipment
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(api.upload_shipment_document("SHP-1", self._upload(), "BOL"))
        self.assertEqual(raised.exception.status_code, 422)
        upload_object.assert_not_called()

    @patch("app.main.object_storage.download_private_object", return_value=b"%PDF-1.4 test")
    @patch("app.main.get_shipment_document")
    def test_original_download_verifies_hash_and_is_private(self, get_document, download):
        get_document.return_value = self.document
        response = api.download_shipment_document("document-1")
        download.assert_called_once_with("SHP-1/documents/invoice.pdf", bucket_name="shipment-documents")
        self.assertEqual(response.body, self.original)
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertIn("attachment;", response.headers["content-disposition"])

    @patch("app.main.object_storage.download_private_object", return_value=b"%PDF-1.4 tampered")
    @patch("app.main.get_shipment_document")
    def test_original_download_rejects_hash_mismatch(self, get_document, _download):
        get_document.return_value = self.document
        with self.assertRaises(HTTPException) as raised:
            api.download_shipment_document("document-1")
        self.assertEqual(raised.exception.status_code, 502)
        self.assertIn("SHA-256", raised.exception.detail)

    @patch("app.main.confirm_shipment_document")
    @patch("app.main.get_shipment_document")
    def test_confirmation_validates_and_persists_merchant_review(self, get_document, confirm_document):
        get_document.return_value = self.document
        confirmed_data = {
            "document_type": "COMMERCIAL_INVOICE",
            "document_number": "INV-1",
            "currency": "USD",
            "total_amount": "12.50",
            "recipient_name": "Buyer",
            "recipient_address": {"country_code": "IN"},
            "items": [{"sku": "NOTE-A5-003", "description": "Notebook", "quantity": 1}],
        }
        saved = {
            **self.document,
            "document_status": "CONFIRMED",
            "confirmed_data": {**confirmed_data, "merchant_confirmed": True},
            "reviewer_label": "Merchant",
            "confirmed_at": "2026-11-06T00:01:00+00:00",
        }
        confirm_document.return_value = saved
        result = api.confirm_export_document("document-1", {"document": confirmed_data})
        self.assertEqual(result["document_status"], "CONFIRMED")
        self.assertTrue(confirm_document.call_args.kwargs["confirmed_data"]["merchant_confirmed"])
        self.assertEqual(confirm_document.call_args.kwargs["reviewer_label"], "Merchant")

    @patch("app.main.confirm_shipment_document")
    @patch("app.main.get_shipment_document")
    def test_confirmation_rejects_invalid_fields(self, get_document, confirm_document):
        get_document.return_value = self.document
        with self.assertRaises(HTTPException) as raised:
            api.confirm_export_document("document-1", {"document": {"currency": "USDD"}})
        self.assertEqual(raised.exception.status_code, 422)
        confirm_document.assert_not_called()


if __name__ == "__main__":
    unittest.main()
