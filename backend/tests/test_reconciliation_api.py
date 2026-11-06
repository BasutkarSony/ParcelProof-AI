import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from app import main as api
from app.reconciliation import ReconciliationInputError, ReconciliationPreconditionError


class ReconciliationApiTests(unittest.TestCase):
    def setUp(self):
        self.shipment = {
            "order_id": "SHP-1",
            "checkout_order_id": "order-1",
            "paypal_capture_id": "CAPTURE-1",
            "paypal_order_id": "PAYPAL-1",
        }
        self.order = {
            "id": "order-1",
            "payment_status": "PAID",
            "paypal_capture_id": "CAPTURE-1",
            "paypal_order_id": "PAYPAL-1",
        }
        self.manifest = {
            "id": "manifest-1",
            "status": "FINALIZED",
            "manifest_hash": "a" * 64,
            "shipment_order_id": "SHP-1",
        }
        self.payload = {"document": {"document_type": "PACKING_LIST", "items": [], "merchant_confirmed": True}}

    @patch("app.main.reconcile_order_document", return_value={"overall_status": "MATCHED_FOR_CHECKED_FIELDS"})
    @patch("app.main.create_reconciliation_run", return_value={"id": "run-1"})
    @patch("app.main.get_manifest_for_shipment")
    @patch("app.main.get_order")
    @patch("app.main.get_shipment_by_order_id")
    def test_endpoint_reconciles_the_order_linked_to_selected_shipment(
        self, get_shipment, get_order, get_manifest, create_run, reconcile
    ):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        get_manifest.return_value = self.manifest

        result = api.reconcile_shipment_documents("SHP-1", self.payload)

        self.assertEqual(result["overall_status"], "MATCHED_FOR_CHECKED_FIELDS")
        self.assertEqual(result["reconciliation_id"], "run-1")
        create_run.assert_called_once()
        reconcile.assert_called_once_with(self.order, self.manifest, self.payload["document"])
        get_order.assert_called_once_with("order-1")
        get_manifest.assert_called_once_with("SHP-1")

    @patch("app.main.get_shipment_by_order_id", return_value=None)
    def test_unknown_shipment_returns_404(self, _get_shipment):
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-MISSING", self.payload)
        self.assertEqual(raised.exception.status_code, 404)

    @patch("app.main.get_shipment_by_order_id", return_value={"order_id": "SHP-SAMPLE"})
    def test_sample_shipment_is_rejected(self, _get_shipment):
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-SAMPLE", self.payload)
        self.assertEqual(raised.exception.status_code, 409)

    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.get_order", return_value=None)
    def test_missing_linked_order_returns_404(self, _get_order, get_shipment):
        get_shipment.return_value = self.shipment
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-1", self.payload)
        self.assertEqual(raised.exception.status_code, 404)

    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.get_order")
    @patch("app.main.get_manifest_for_shipment", return_value=None)
    def test_missing_manifest_returns_404(self, _get_manifest, get_order, get_shipment):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-1", self.payload)
        self.assertEqual(raised.exception.status_code, 404)

    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.get_order")
    @patch("app.main.get_manifest_for_shipment")
    def test_missing_normalized_document_returns_422(self, get_manifest, get_order, get_shipment):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        get_manifest.return_value = self.manifest
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-1", {})
        self.assertEqual(raised.exception.status_code, 422)

    @patch("app.main.reconcile_order_document", side_effect=ReconciliationPreconditionError("Not ready"))
    @patch("app.main.get_manifest_for_shipment")
    @patch("app.main.get_order")
    @patch("app.main.get_shipment_by_order_id")
    def test_precondition_error_is_returned_as_conflict(
        self, get_shipment, get_order, get_manifest, _reconcile
    ):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        get_manifest.return_value = self.manifest
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-1", self.payload)
        self.assertEqual(raised.exception.status_code, 409)

    @patch("app.main.reconcile_order_document", side_effect=ReconciliationInputError("Invalid document"))
    @patch("app.main.get_manifest_for_shipment")
    @patch("app.main.get_order")
    @patch("app.main.get_shipment_by_order_id")
    def test_invalid_normalized_document_is_returned_as_422(
        self, get_shipment, get_order, get_manifest, _reconcile
    ):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        get_manifest.return_value = self.manifest
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-1", self.payload)
        self.assertEqual(raised.exception.status_code, 422)

 
    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.get_order")
    def test_capture_mismatch_between_shipment_and_checkout_is_rejected(self, get_order, get_shipment):
        get_shipment.return_value = {**self.shipment, "paypal_capture_id": "OTHER-CAPTURE"}
        get_order.return_value = self.order
        with patch("app.main.get_manifest_for_shipment", return_value=self.manifest):
            with self.assertRaises(HTTPException) as raised:
                api.reconcile_shipment_documents("SHP-1", self.payload)
        self.assertEqual(raised.exception.status_code, 409)

    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.get_order")
    @patch("app.main.get_manifest_for_shipment")
    def test_manifest_from_another_shipment_is_rejected(self, get_manifest, get_order, get_shipment):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        get_manifest.return_value = {**self.manifest, "shipment_order_id": "SHP-OTHER"}
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-1", self.payload)
        self.assertEqual(raised.exception.status_code, 409)

    @patch("app.main.get_shipment_by_order_id")
    @patch("app.main.get_order")
    @patch("app.main.get_manifest_for_shipment")
    def test_unconfirmed_structured_document_cannot_bypass_review_gate(self, get_manifest, get_order, get_shipment):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        get_manifest.return_value = self.manifest
        payload = {"document": {"document_type": "PACKING_LIST", "items": []}}
        with self.assertRaises(HTTPException) as raised:
            api.reconcile_shipment_documents("SHP-1", payload)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertIn("Merchant confirmation", raised.exception.detail)

    @patch("app.main.create_reconciliation_run", return_value={"id": "run-1"})
    @patch("app.main.reconcile_order_document", return_value={"overall_status": "MATCHED_FOR_CHECKED_FIELDS"})
    @patch("app.main.get_shipment_document")
    @patch("app.main.get_manifest_for_shipment")
    @patch("app.main.get_order")
    @patch("app.main.get_shipment_by_order_id")
    def test_confirmed_document_id_is_used_and_saved(
        self, get_shipment, get_order, get_manifest, get_document, reconcile, create_run
    ):
        get_shipment.return_value = self.shipment
        get_order.return_value = self.order
        get_manifest.return_value = self.manifest
        get_document.return_value = {
            "id": "document-1",
            "shipment_order_id": "SHP-1",
            "document_type": "PACKING_LIST",
            "document_status": "CONFIRMED",
            "confirmed_data": {
                "document_type": "PACKING_LIST",
                "items": [{"sku": "SKU-1", "description": "Product", "quantity": 1}],
            },
        }
        result = api.reconcile_shipment_documents("SHP-1", {"document_id": "document-1"})
        self.assertEqual(result["reconciliation_id"], "run-1")
        create_run.assert_called_once()
        self.assertEqual(create_run.call_args.kwargs["document_id"], "document-1")
        self.assertTrue(reconcile.call_args.args[2]["merchant_confirmed"])



if __name__ == "__main__":
    unittest.main()
