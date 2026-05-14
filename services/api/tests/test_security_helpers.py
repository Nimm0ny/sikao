"""Helper-level unit tests for cookie + bearer dual-fallback auth (Phase B.1b).

Verifies _get_token_from_request behavior contract per Phase B.1a:
  cookie (preferred) OR Authorization Bearer (fallback).
"""
from __future__ import annotations

from unittest.mock import MagicMock

from fastapi.security import HTTPAuthorizationCredentials

from sikao_api.modules.auth.application.security import _get_token_from_request


def _make_request(cookies: dict[str, str] | None = None) -> MagicMock:
    request = MagicMock()
    request.cookies = cookies or {}
    return request


def test_get_token_from_request_cookie_only() -> None:
    request = _make_request({"auth_token": "cookie-jwt-here"})
    token = _get_token_from_request(request, bearer=None)
    assert token == "cookie-jwt-here"


def test_get_token_from_request_bearer_only() -> None:
    request = _make_request({})
    bearer = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bearer-jwt-here")
    token = _get_token_from_request(request, bearer=bearer)
    assert token == "bearer-jwt-here"


def test_get_token_from_request_cookie_precedence_over_bearer() -> None:
    """Cookie wins when both present (more secure storage during migration)."""
    request = _make_request({"auth_token": "cookie-wins"})
    bearer = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bearer-loses")
    token = _get_token_from_request(request, bearer=bearer)
    assert token == "cookie-wins"


def test_get_token_from_request_neither_returns_none() -> None:
    request = _make_request({})
    token = _get_token_from_request(request, bearer=None)
    assert token is None


def test_get_token_from_request_empty_cookie_falls_back_to_bearer() -> None:
    """Defensive: cookie present but empty value → treat as absent, use bearer."""
    request = _make_request({"auth_token": ""})
    bearer = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bearer-fallback")
    token = _get_token_from_request(request, bearer=bearer)
    assert token == "bearer-fallback"
