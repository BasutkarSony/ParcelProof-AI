"""Private Supabase Storage adapter for shipment inspection photos.

The backend uses a Supabase secret/service-role key. Never expose this key to
the browser or include it in logs or API responses.
"""
from __future__ import annotations

import os
import re
from urllib.parse import quote

import requests


class StorageConfigurationError(RuntimeError):
    """Raised when private object storage is not configured."""


class StorageOperationError(RuntimeError):
    """Raised when a private object operation fails."""


def _configuration() -> tuple[str, str, str, str]:
    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    api_key = (
        os.getenv("SUPABASE_SECRET_KEY", "").strip()
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )
    service_jwt = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not service_jwt and api_key and not api_key.startswith("sb_secret_"):
        # Legacy service_role keys are JWTs and can serve both purposes.
        service_jwt = api_key
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "inspection-photos").strip()
    if not base_url or not api_key or not bucket:
        raise StorageConfigurationError(
            "Private photo storage is not configured. Set SUPABASE_URL and a backend-only Supabase key."
        )
    if api_key.startswith("sb_secret_") and not service_jwt:
        raise StorageConfigurationError(
            "Private Storage requires a legacy service_role JWT in SUPABASE_SERVICE_ROLE_KEY when using an sb_secret API key."
        )
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+", base_url):
        raise StorageConfigurationError("SUPABASE_URL must be an HTTPS project URL.")
    if "/" in bucket or bucket in {".", ".."}:
        raise StorageConfigurationError("SUPABASE_STORAGE_BUCKET is invalid.")
    return base_url, api_key, service_jwt, bucket


def _object_url(base_url: str, bucket: str, object_path: str) -> str:
    parts = object_path.split("/")
    if not parts or any(part in {"", ".", ".."} for part in parts):
        raise ValueError("Invalid storage object path.")
    encoded_path = "/".join(quote(part, safe="") for part in parts)
    return f"{base_url}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}"


def _headers(api_key: str, service_jwt: str, content_type: str | None = None) -> dict[str, str]:
    # sb_secret_* is an opaque API key, while Storage's service-level bypass
    # requires the service_role JWT in Authorization.
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {service_jwt}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def upload_private_object(object_path: str, data: bytes, content_type: str) -> str:
    """Upload an object without overwriting an existing object; return its key."""
    base_url, api_key, service_jwt, bucket = _configuration()
    try:
        response = requests.post(
            _object_url(base_url, bucket, object_path),
            headers={**_headers(api_key, service_jwt, content_type), "x-upsert": "false"},
            data=data,
            timeout=30,
        )
        if response.status_code not in (200, 201):
            raise StorageOperationError(
                f"Private photo upload failed (HTTP {response.status_code})."
            )
    except requests.RequestException:
        raise StorageOperationError("Private photo upload could not reach storage.") from None
    return object_path


def download_private_object(object_path: str) -> bytes:
    """Download an object from the private bucket."""
    base_url, api_key, service_jwt, bucket = _configuration()
    try:
        response = requests.get(
            _object_url(base_url, bucket, object_path),
            headers=_headers(api_key, service_jwt),
            timeout=30,
        )
        if response.status_code != 200:
            raise StorageOperationError(
                f"Private photo retrieval failed (HTTP {response.status_code})."
            )
        return response.content
    except requests.RequestException:
        raise StorageOperationError("Private photo retrieval could not reach storage.") from None


def delete_private_object(object_path: str) -> None:
    """Delete an object during rollback after a failed inspection."""
    base_url, api_key, service_jwt, bucket = _configuration()
    try:
        response = requests.delete(
            _object_url(base_url, bucket, object_path),
            headers=_headers(api_key, service_jwt),
            timeout=30,
        )
        if response.status_code not in (200, 204):
            raise StorageOperationError(
                f"Private photo cleanup failed (HTTP {response.status_code})."
            )
    except requests.RequestException:
        raise StorageOperationError("Private photo cleanup could not reach storage.") from None
