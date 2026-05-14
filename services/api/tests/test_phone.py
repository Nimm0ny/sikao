"""Phone normalization tests — Identity v2 (D2/D8).

Cover: normalize_phone happy + edge + reject; is_phone_format gate.
"""

from __future__ import annotations

import pytest

from sikao_api.modules.auth.application.phone import is_phone_format, normalize_phone


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Happy path: 11-digit straight.
        ("13800138000", "13800138000"),
        ("18900190019", "18900190019"),
        # +86 / 86 prefix strip.
        ("+8613800138000", "13800138000"),
        ("8613800138000", "13800138000"),
        # Whitespace + dash + parens strip.
        ("+86 138 0013 8000", "13800138000"),
        ("86-138-0013-8000", "13800138000"),
        ("(138)-0013-8000", "13800138000"),
        ("  13800138000  ", "13800138000"),
        # Each leading second-digit 3-9 valid.
        ("13000130001", "13000130001"),
        ("19999999999", "19999999999"),
    ],
)
def test_normalize_phone_accepts_valid(raw: str, expected: str) -> None:
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        # Second digit 0-2 not allowed (大陆段位规则).
        "10800138000",
        "11800138000",
        "12800138000",
        # Length wrong.
        "1380013800",  # 10 digits
        "138001380000",  # 12 digits
        # Non-digit.
        "138-abcd-8000",
        "user@example.com",
        # Empty / None.
        "",
        None,
        # Wrong start digit.
        "23800138000",
        "03800138000",
    ],
)
def test_normalize_phone_rejects_invalid(raw: str | None) -> None:
    assert normalize_phone(raw) is None


def test_is_phone_format_gate() -> None:
    assert is_phone_format("13800138000") is True
    assert is_phone_format("+86 13800138000") is True
    assert is_phone_format("user@example.com") is False
    assert is_phone_format("12800138000") is False
    assert is_phone_format("") is False
