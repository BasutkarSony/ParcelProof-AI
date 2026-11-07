"""Validation helpers for merchant catalogue identity profiles."""
from __future__ import annotations


def normalize_gtin(value: str | None) -> str | None:
    """Normalize and validate GTIN-8/12/13/14 using its GS1 check digit.

    Spaces and hyphens from printed labels/scanner input are removed. Empty
    input means the merchant has not supplied a GTIN.
    """
    raw = str(value or "").strip()
    if not raw:
        return None

    digits = raw.replace(" ", "").replace("-", "")
    if len(digits) not in {8, 12, 13, 14} or not digits.isdigit():
        raise ValueError("Enter a valid 8, 12, 13 or 14 digit GTIN.")

    body = digits[:-1]
    weighted_sum = sum(
        int(digit) * (3 if index % 2 == 0 else 1)
        for index, digit in enumerate(reversed(body))
    )
    expected_check_digit = (10 - (weighted_sum % 10)) % 10
    if int(digits[-1]) != expected_check_digit:
        raise ValueError("The GTIN check digit is invalid. Scan or re-enter the barcode.")

    return digits
