import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import object_storage


class SupabasePrivateStorageTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SECRET_KEY": "sb_secret_test-secret",
            "SUPABASE_SERVICE_ROLE_KEY": "eyJ.legacy.service-role.jwt",
            "SUPABASE_STORAGE_BUCKET": "inspection-photos",
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    @patch("app.object_storage.requests.post")
    def test_upload_uses_private_backend_credentials_and_no_overwrite(self, post):
        post.return_value.status_code = 200
        key = object_storage.upload_private_object(
            "inspection-1/photo-1.jpg", b"image-bytes", "image/jpeg"
        )
        self.assertEqual(key, "inspection-1/photo-1.jpg")
        args, kwargs = post.call_args
        self.assertEqual(
            args[0],
            "https://example.supabase.co/storage/v1/object/inspection-photos/inspection-1/photo-1.jpg",
        )
        self.assertEqual(kwargs["headers"]["apikey"], "sb_secret_test-secret")
        self.assertEqual(
            kwargs["headers"]["Authorization"],
            "Bearer eyJ.legacy.service-role.jwt",
        )
        self.assertEqual(kwargs["headers"]["x-upsert"], "false")
        self.assertEqual(kwargs["data"], b"image-bytes")

    def test_legacy_service_role_jwt_keeps_bearer_header(self):
        headers = object_storage._headers("eyJlegacy-service-role-jwt")
        self.assertEqual(headers["apikey"], "eyJlegacy-service-role-jwt")
        self.assertEqual(headers["Authorization"], "Bearer eyJlegacy-service-role-jwt")

    @patch("app.object_storage.requests.get")
    def test_download_returns_raw_bytes(self, get):
        get.return_value.status_code = 200
        get.return_value.content = b"photo"
        self.assertEqual(
            object_storage.download_private_object("inspection-1/photo.jpg"),
            b"photo",
        )

    @patch("app.object_storage.requests.delete")
    def test_delete_removes_object(self, delete):
        delete.return_value.status_code = 200
        object_storage.delete_private_object("inspection-1/photo.jpg")
        delete.assert_called_once()

    def test_missing_configuration_fails_closed(self):
        with patch.dict(os.environ, {
            "SUPABASE_URL": "",
            "SUPABASE_SECRET_KEY": "",
            "SUPABASE_SERVICE_ROLE_KEY": "",
        }):
            with self.assertRaises(object_storage.StorageConfigurationError):
                object_storage.download_private_object("inspection/photo.jpg")

    def test_new_secret_key_requires_legacy_storage_service_jwt(self):
        with patch.dict(os.environ, {"SUPABASE_SERVICE_ROLE_KEY": ""}):
            with self.assertRaises(object_storage.StorageConfigurationError):
                object_storage.download_private_object("inspection/photo.jpg")

    def test_legacy_service_role_jwt_can_fill_both_credentials(self):
        with patch.dict(os.environ, {"SUPABASE_SECRET_KEY": ""}):
            config = object_storage._configuration()
        self.assertEqual(config[1], "eyJ.legacy.service-role.jwt")
        self.assertEqual(config[2], "eyJ.legacy.service-role.jwt")

    def test_object_path_rejects_traversal(self):
        with self.assertRaises(ValueError):
            object_storage._object_url(
                "https://example.supabase.co", "inspection-photos", "../outside.jpg"
            )

    @patch("app.object_storage.requests.post")
    def test_provider_error_does_not_leak_response_body(self, post):
        post.return_value.status_code = 500
        post.return_value.text = "sensitive provider response"
        with self.assertRaises(object_storage.StorageOperationError) as error:
            object_storage.upload_private_object("inspection/photo.jpg", b"x", "image/jpeg")
        self.assertNotIn("sensitive", str(error.exception))


if __name__ == "__main__":
    unittest.main()
