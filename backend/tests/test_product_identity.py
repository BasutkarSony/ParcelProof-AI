"""Tests for catalogue product identity profiles and private reference images."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import store
from app.main import app
from app.product_identity import normalize_gtin


class GTINValidationTests(unittest.TestCase):
    def test_valid_gtin_is_normalized(self):
        self.assertEqual(normalize_gtin("400 638 133393-1"), "4006381333931")

    def test_invalid_check_digit_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "check digit"):
            normalize_gtin("4006381333932")

    def test_unsupported_length_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "8, 12, 13 or 14"):
            normalize_gtin("123456")

    def test_empty_gtin_is_optional(self):
        self.assertIsNone(normalize_gtin(""))


class CatalogueIdentityApiTests(unittest.TestCase):
    def setUp(self):
        self._original_db_path = store.DB_PATH
        self._tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self._tmp.close()
        store.DB_PATH = Path(self._tmp.name)
        self._env = patch.dict(os.environ, {
            "DATABASE_URL": "",
            "PARCELPROOF_REQUIRE_DATABASE": "false",
            "PARCELPROOF_DEMO_AUTH_REQUIRED": "false",
            "PARCELPROOF_DEMO_USERNAME": "",
            "PARCELPROOF_DEMO_PASSWORD": "",
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SECRET_KEY": "sb_secret_test-secret",
            "SUPABASE_SERVICE_ROLE_KEY": "eyJ.legacy.service-role.jwt",
        }, clear=False)
        self._env.start()
        store.init_db()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self._env.stop()
        store.DB_PATH = self._original_db_path
        os.unlink(self._tmp.name)

    def test_checkout_catalogue_exposes_only_buyer_safe_copy(self):
        store.update_product_identity_profile(
            sku="MUG-CER-001",
            description="Stoneware mug with cobalt-blue rim and botanical design.",
            store_description="Stoneware coffee mug with a glazed finish.",
            barcode_gtin="4006381333931",
        )
        public_response = self.client.get("/api/catalog")
        self.assertEqual(public_response.status_code, 200)
        public_product = next(
            item for item in public_response.json()["products"]
            if item["sku"] == "MUG-CER-001"
        )
        self.assertEqual(public_product["description"], "Stoneware coffee mug with a glazed finish.")
        self.assertNotIn("barcode_gtin", public_product)
        self.assertNotIn("has_reference_image", public_product)
        self.assertNotIn("reference_image_url", public_product)

        identity_response = self.client.get("/api/catalog/identity-profiles")
        self.assertEqual(identity_response.status_code, 200)
        identity_product = next(
            item for item in identity_response.json()["products"]
            if item["sku"] == "MUG-CER-001"
        )
        self.assertEqual(identity_product["description"], "Stoneware mug with cobalt-blue rim and botanical design.")
        self.assertEqual(identity_product["store_description"], "Stoneware coffee mug with a glazed finish.")

    def test_invalid_gtin_does_not_upload_reference_image(self):
        with patch("app.main.object_storage.upload_private_object") as upload:
            response = self.client.put(
                "/api/catalog/NOTE-A5-003/identity",
                data={
                    "description": "A5 hardcover notebook with navy cover.",
                    "barcode_gtin": "4006381333932",
                },
            )
        self.assertEqual(response.status_code, 422)
        upload.assert_not_called()

    def test_private_matching_details_can_be_left_blank(self):
        response = self.client.put(
            "/api/catalog/NOTE-A5-003/identity",
            data={
                "description": "",
                "store_description": "Hardcover ruled notebook with 160 pages.",
                "barcode_gtin": "",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["product"]["description"], "")
        self.assertIsNone(response.json()["product"]["barcode_gtin"])

    def test_reference_image_is_saved_privately_and_served_through_app(self):
        image_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 8 + b"\xff\xd9"
        with patch("app.main.object_storage.upload_private_object") as upload:
            upload.return_value = "catalogue/test-profile/reference.jpg"
            with patch("app.main.object_storage.download_private_object", return_value=image_bytes) as download:
                response = self.client.put(
                    "/api/catalog/NOTE-A5-003/identity",
                    data={
                        "description": "A5 ruled notebook, navy textured hardcover, 160 pages.",
                        "store_description": "Hardcover ruled notebook with 160 pages.",
                        "barcode_gtin": "4006381333931",
                    },
                    files={
                        "reference_image": ("notebook.jpg", image_bytes, "image/jpeg"),
                    },
                )
                self.assertEqual(response.status_code, 200, response.text)
                data = response.json()
                self.assertTrue(data["product"]["has_reference_image"])
                self.assertEqual(data["product"]["barcode_gtin"], "4006381333931")
                self.assertEqual(data["product"]["store_description"], "Hardcover ruled notebook with 160 pages.")
                self.assertIn("/api/catalog/NOTE-A5-003/reference-image", data["product"]["reference_image_url"])
                upload.assert_called_once()
                args, kwargs = upload.call_args
                self.assertTrue(args[0].startswith("catalogue/"))
                self.assertEqual(args[2], "image/jpeg")

                image_response = self.client.get("/api/catalog/NOTE-A5-003/reference-image")
                self.assertEqual(image_response.status_code, 200)
                self.assertEqual(image_response.content, image_bytes)
                self.assertEqual(image_response.headers["content-type"], "image/jpeg")
                download.assert_called_once()


if __name__ == "__main__":
    unittest.main()
