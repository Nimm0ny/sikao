"""Test helpers for identity v2 register/login flow (post-#3d migration).

After commit #3d 删除老 /auth/register + LoginRequestV2.username schema,
existing tests must register via /auth/register/email and login via the new
identifier-based payload. These helpers map the legacy `username` test
parameter to a synthetic email `f"{username}@test.local"` so 18 existing
test files can keep their `register/login by name` structure with minimal
diffs.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient


def _username_to_email(username: str) -> str:
    """Map legacy `username` fixture name to synthetic email identifier.

    Convention: `<username>@test.local` — keeps register + login round-trip
    coherent (same email used both calls).
    """
    return f"{username}@test.local"


def register_user(
    client: TestClient,
    *,
    username: str,
    password: str = "passw0rd",
    display_name: str | None = None,
) -> int:
    """Register a test user via /auth/register/email + return user_id.

    Old test pattern was `client.post("/auth/register", json={"username": X,
    "password": Y, "displayName": Z})`. After identity v2 (D6/D7), users
    register by email/phone (not username). Helper bridges by mapping
    test username → synthetic email.

    Returns: int user_id (matches old `int(resp.json()["user"]["id"])`).
    """
    payload: dict[str, Any] = {
        "email": _username_to_email(username),
        "password": password,
    }
    if display_name is not None:
        payload["displayName"] = display_name
    resp = client.post("/api/v2/auth/register/email", json=payload)
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def login_as_user(
    client: TestClient,
    *,
    username: str,
    password: str = "passw0rd",
) -> dict[str, Any]:
    """Login via /auth/login with identifier (matches synthetic email from
    register_user). Returns response body.
    """
    resp = client.post(
        "/api/v2/auth/login",
        json={
            "identifier": _username_to_email(username),
            "password": password,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()
