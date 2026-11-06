import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai_analyzer import analyze_shipment_evidence


class ShipmentEvidenceAnalyzerTests(unittest.TestCase):
    def test_complete_record_returns_neutral_evidence_label(self):
        result = analyze_shipment_evidence({
            "order_id": "ORD-1001",
            "transaction_id": "8MC585209K746392H",
            "tracking_number": "781234567890",
            "carrier": "FEDEX",
            "status": "DELIVERED",
            "shipped_date": "2026-10-25",
            "delivered_date": "2026-10-28",
            "shipping_address": "Seattle, WA 98101",
            "evidence_text": "Delivered at Seattle, WA 98101.",
        })

        self.assertGreaterEqual(result["evidence_score"], 85)
        self.assertEqual(result["evidence_tier"], "RECORD_COMPLETE")
        self.assertEqual(result["evidence_label"], "Shipment record looks complete for review")
        self.assertNotIn("seller_protection", result)
        self.assertIn("does not assess PayPal Seller Protection eligibility", result["paypal_notice"])

    def test_high_value_and_signature_text_do_not_trigger_outdated_policy(self):
        result = analyze_shipment_evidence({
            "order_id": "ORD-HIGH-VAL",
            "transaction_id": "TXN-100",
            "tracking_number": "1Z9999999999999999",
            "carrier": "UPS",
            "status": "DELIVERED",
            "shipped_date": "2026-10-25",
            "delivered_date": "2026-10-28",
            "amount": 980.00,
            "currency": "USD",
            "evidence_text": "Delivered to front door without signature.",
        })

        self.assertNotIn("signature_confirmation", result)
        self.assertNotIn("signature_detected", result["evidence_summary"])
        self.assertFalse(any("signature" in item.lower() for item in result["risk_factors"]))

    def test_transaction_date_does_not_infer_paypal_policy(self):
        base = {
            "order_id": "ORD-DATE",
            "transaction_id": "TXN-1",
            "tracking_number": "781234567890",
            "carrier": "FEDEX",
            "status": "SHIPPED",
            "shipped_date": "2026-10-25",
        }
        without_date = analyze_shipment_evidence(base)
        with_date = analyze_shipment_evidence({**base, "transaction_date": "2026-10-24"})

        self.assertEqual(without_date["evidence_score"], with_date["evidence_score"])
        self.assertNotIn("policy_applicability", with_date)

    def test_carrier_format_mismatch_is_flagged(self):
        result = analyze_shipment_evidence({
            "order_id": "ORD-MISMATCH",
            "transaction_id": "TXN-2",
            "tracking_number": "1Z9999999999999999",
            "carrier": "USPS",
            "status": "SHIPPED",
            "shipped_date": "2026-10-25",
        })

        self.assertEqual(result["carrier_analysis"]["probable_detected_carrier"], "UPS")
        self.assertIn("Format mismatch", " ".join(result["risk_factors"]))

    def test_other_carrier_format_is_not_guessed(self):
        result = analyze_shipment_evidence({
            "order_id": "ORD-OTHER",
            "transaction_id": "TXN-3",
            "tracking_number": "DEMO123456",
            "carrier": "OTHER",
            "carrier_name_other": "Demo Logistics",
            "status": "SHIPPED",
            "shipped_date": "2026-10-25",
        })

        self.assertEqual(result["carrier_analysis"]["carrier"], "OTHER")
        self.assertIsNone(result["carrier_analysis"]["format_valid"])
        self.assertIsNone(result["carrier_analysis"]["probable_detected_carrier"])

    def test_exception_phrases_are_flagged_as_text_not_carrier_verified_events(self):
        result = analyze_shipment_evidence({
            "order_id": "ORD-EXCEPTION",
            "transaction_id": "TXN-4",
            "tracking_number": "781234567890",
            "carrier": "FEDEX",
            "status": "SHIPPED",
            "shipped_date": "2026-10-25",
            "evidence_text": "Delivery failed: damaged in transit, returned to sender.",
        })

        self.assertIn("damaged in transit", result["evidence_summary"]["exceptions_detected"])
        self.assertIn("returned to sender", result["evidence_summary"]["exceptions_detected"])
        self.assertTrue(result["evidence_checks"]["exception_phrases_found"])
        self.assertIn("merchant-entered", result["evidence_checks"]["source_notice"].lower())
        self.assertLess(result["evidence_score"], 70)

    def test_destination_match_is_only_a_text_match(self):
        result = analyze_shipment_evidence({
            "order_id": "ORD-ADDRESS",
            "transaction_id": "TXN-5",
            "tracking_number": "781234567890",
            "carrier": "FEDEX",
            "status": "DELIVERED",
            "shipped_date": "2026-10-25",
            "delivered_date": "2026-10-28",
            "shipping_address": "Seattle, WA 98101",
            "evidence_text": "Delivery notes: Seattle, WA 98101.",
        })

        self.assertTrue(result["evidence_checks"]["destination_text_match"])
        self.assertTrue(any("not carrier verification" in item.lower() for item in result["strengths"]))
        self.assertIn("No carrier event feed is connected", result["evidence_checks"]["source_notice"])

    def test_payload_preview_remains_locked_and_human_gated(self):
        result = analyze_shipment_evidence({
            "order_id": "ORD-1001",
            "transaction_id": "CAPTURE-1001",
            "tracking_number": "781234567890",
            "carrier": "FEDEX",
            "status": "SHIPPED",
            "shipped_date": "2026-10-25",
        })
        preview = result["paypal_payload_preview"]

        self.assertEqual(preview["endpoint"], "POST /v2/checkout/orders/{paypal_order_id}/track")
        self.assertEqual(preview["request_body"], {
            "capture_id": "CAPTURE-1001",
            "tracking_number": "781234567890",
            "carrier": "FEDEX",
            "notify_payer": False,
        })
        self.assertEqual(preview["submission_safety_status"], "DISABLED_BY_DEFAULT")
        self.assertIn("human-approved", preview["safety_gate_note"])

    def test_engine_metadata_describes_checks_without_policy_claims(self):
        result = analyze_shipment_evidence({"order_id": "ORD-1", "transaction_id": "TXN-1"})

        self.assertEqual(result["engine_metadata"]["type"], "DETERMINISTIC_RULES_NLP")
        self.assertTrue(result["engine_metadata"]["auditable"])
        self.assertTrue(result["engine_metadata"]["zero_hallucination"])
        self.assertIn("does not verify carrier events", result["engine_metadata"]["description"])


if __name__ == "__main__":
    unittest.main()
