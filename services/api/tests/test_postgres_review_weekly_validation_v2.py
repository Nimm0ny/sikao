from __future__ import annotations

import os
from pathlib import Path

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_weekly_summary_rejects_invalid_week(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        response = client.get("/api/v2/review/weekly-summary", params={"week": "2026-W99"})
        assert response.status_code == 422, response.text
        payload = response.json()
        assert payload["code"] == "review_week_invalid"
