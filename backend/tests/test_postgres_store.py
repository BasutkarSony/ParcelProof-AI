"""PostgreSQL integration test for the complete persistence path.

Set DATABASE_URL to a disposable PostgreSQL database to run this test.
"""
import os
import sys
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import store


@unittest.skipUnless(os.getenv("DATABASE_URL"), "DATABASE_URL is not configured")
class PostgreSQLPersistenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        store.init_db()

    def test_concurrent_retries_create_only_one_shipment(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier

        order = store.create_order(
            [{"sku": "MUG-CER-001", "quantity": 1}],
            buyer_name="PostgreSQL Concurrent Buyer",
        )
        paypal_order_id = f"PAYPAL-{uuid.uuid4()}"
        capture_id = f"CAPTURE-{uuid.uuid4()}"
        store.set_paypal_order_id(order["id"], paypal_order_id)
        store.set_capture(order["id"], capture_id, "PAID")

        barrier = Barrier(2)

        def create_once():
            barrier.wait(timeout=10)
            return store.create_shipment_for_order(
                checkout_order_id=order["id"],
                paypal_order_id=paypal_order_id,
                paypal_capture_id=capture_id,
                amount=order["total"],
                currency="USD",
                buyer_name="PostgreSQL Concurrent Buyer",
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(create_once)
            second = executor.submit(create_once)
            shipments = [first.result(timeout=30), second.result(timeout=30)]

        self.assertEqual(shipments[0]["id"], shipments[1]["id"])
        self.assertEqual(
            len([
                shipment for shipment in store.list_shipments()
                if shipment["checkout_order_id"] == order["id"]
            ]),
            1,
        )

    def test_checkout_to_shipment_manifest_inspection_and_review(self):
        order_items = [
            {"sku": "TOTE-COT-002", "quantity": 1},
            {"sku": "MUG-CER-001", "quantity": 2},
            {"sku": "NOTE-A5-003", "quantity": 1},
        ]
        order = store.create_order(order_items, buyer_name="PostgreSQL CI Buyer")
        paypal_order_id = f"PAYPAL-{uuid.uuid4()}"
        capture_id = f"CAPTURE-{uuid.uuid4()}"
        store.set_paypal_order_id(order["id"], paypal_order_id)
        store.set_capture(order["id"], capture_id, "PAID")

        shipment = store.create_shipment_for_order(
            checkout_order_id=order["id"],
            paypal_order_id=paypal_order_id,
            paypal_capture_id=capture_id,
            amount=order["total"],
            currency="USD",
            buyer_name="PostgreSQL CI Buyer",
        )
        self.assertIsNotNone(shipment["id"])
        recovered = store.create_shipment_for_order(
            checkout_order_id=order["id"],
            paypal_order_id=paypal_order_id,
            paypal_capture_id=capture_id,
            amount=order["total"],
            currency="USD",
            buyer_name="PostgreSQL CI Buyer",
        )
        self.assertEqual(recovered["id"], shipment["id"])

        manifest = store.create_manifest_from_checkout_order(
            shipment["order_id"], order["id"]
        )
        self.assertEqual(
            [item["sku"] for item in manifest["items"]],
            ["TOTE-COT-002", "MUG-CER-001", "NOTE-A5-003"],
        )
        finalized = store.finalize_manifest(manifest["id"])
        self.assertEqual(finalized["status"], "FINALIZED")
        self.assertTrue(finalized["manifest_hash"])

        inspection = store.create_inspection(
            manifest_id=finalized["id"],
            manifest_hash=finalized["manifest_hash"],
            model_used="postgres-ci",
            ai_result={"overall_status": "PASS"},
            photo_records=[
                {
                    "id": f"photo-{uuid.uuid4()}",
                    "sha256": "a" * 64,
                    "mime_type": "image/jpeg",
                    "size_bytes": 128,
                    "storage_path": f"{finalized['id']}/one.jpg",
                },
                {
                    "id": f"photo-{uuid.uuid4()}",
                    "sha256": "b" * 64,
                    "mime_type": "image/png",
                    "size_bytes": 256,
                    "storage_path": f"{finalized['id']}/two.png",
                },
            ],
        )
        self.assertEqual(len(inspection["photos"]), 2)
        self.assertTrue(inspection["photos"][0]["storage_path"].endswith("one.jpg"))

        reviewed = store.record_inspection_review(
            inspection_id=inspection["id"],
            decision="APPROVED",
            reviewer_label="PostgreSQL CI Reviewer",
        )
        self.assertEqual(reviewed["inspection_status"], "APPROVED")
        self.assertEqual(len(reviewed["review_history"]), 1)


if __name__ == "__main__":
    unittest.main()
