"""Private Supabase Storage adapter for shipment evidence."""
from __future__ import annotations
import os
import re
from urllib.parse import quote
import requests


class StorageConfigurationError(RuntimeError):
    """Private object storage configuration is missing or invalid."""


class StorageOperationError(RuntimeError):
    """A private storage operation failed."""


def _configuration(bucket_override: str | None = None) -> tuple[str, str, str, str]:
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    api_key = os.getenv("SUPABASE_SECRET_KEY", "").strip() or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    service_jwt = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not service_jwt and api_key and not api_key.startswith("sb_secret_"):
        service_jwt = api_key
    bucket = (bucket_override or os.getenv("SUPABASE_STORAGE_BUCKET", "inspection-photos")).strip()
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,100}", bucket):
        raise StorageConfigurationError("Private Storage bucket name is invalid.")
    if not base_url or not api_key:
        raise StorageConfigurationError("Private object storage is not configured.")
    if api_key.startswith("sb_secret_") and not service_jwt:
        raise StorageConfigurationError("Private Storage requires the service_role JWT when using an sb_secret API key.")
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+", base_url):
        raise StorageConfigurationError("SUPABASE_URL must be an HTTPS project URL.")
    return base_url, api_key, service_jwt, bucket


def _object_url(base_url: str, bucket: str, object_path: str) -> str:
    parts = object_path.split("/")
    if not parts or any(part in {"", ".", ".."} for part in parts):
        raise ValueError("Invalid storage object path.")
    encoded = "/".join(quote(part, safe="") for part in parts)
    return f"{base_url}/storage/v1/object/{quote(bucket, safe='')}/{encoded}"


def _headers(api_key: str, service_jwt: str, content_type: str | None = None) -> dict[str, str]:
    headers = {"apikey": api_key, "Authorization": f"Bearer {service_jwt}"}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def upload_private_object(object_path: str, data: bytes, content_type: str,
                          bucket_name: str | None = None) -> str:
    base_url, api_key, service_jwt, bucket = _configuration(bucket_name)
    try:
        response = requests.post(
            _object_url(base_url, bucket, object_path),
            headers={**_headers(api_key, service_jwt, content_type), "x-upsert": "false"},
            data=data, timeout=30,
        )
        if response.status_code not in (200, 201):
            raise StorageOperationError(f"Private object upload failed (HTTP {response.status_code}).")
    except requests.RequestException:
        raise StorageOperationError("Private object upload could not reach storage.") from None
    return object_path


def download_private_object(object_path: str, bucket_name: str | None = None) -> bytes:
    base_url, api_key, service_jwt, bucket = _configuration(bucket_name)
    try:
        response = requests.get(_object_url(base_url, bucket, object_path),
                                headers=_headers(api_key, service_jwt), timeout=30)
        if response.status_code != 200:
            raise StorageOperationError(f"Private object retrieval failed (HTTP {response.status_code}).")
        return response.content
    except requests.RequestException:
        raise StorageOperationError("Private object retrieval could not reach storage.") from None


def delete_private_object(object_path: str, bucket_name: str | None = None) -> None:
    base_url, api_key, service_jwt, bucket = _configuration(bucket_name)
    try:
        response = requests.delete(_object_url(base_url, bucket, object_path),
                                   headers=_headers(api_key, service_jwt), timeout=30)
        if response.status_code not in (200, 204):
            raise StorageOperationError(f"Private object cleanup failed (HTTP {response.status_code}).")
    except requests.RequestException:
        raise StorageOperationError("Private object cleanup could not reach storage.") from None
