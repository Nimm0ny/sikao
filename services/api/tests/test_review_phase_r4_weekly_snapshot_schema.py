from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import inspect

from _helpers.practice_content_support import build_postgres_client, register_user


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_r4_schema_adds_weekly_snapshot_table(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            inspector = inspect(session.get_bind())
            assert "review_weekly_snapshots_v2" in inspector.get_table_names()
            columns = {column["name"] for column in inspector.get_columns("review_weekly_snapshots_v2")}
            assert {"user_id", "week_start_date", "data_json", "created_at", "updated_at"} <= columns
            unique_names = {
                constraint["name"]
                for constraint in inspector.get_unique_constraints("review_weekly_snapshots_v2")
            }
            assert "uq_review_weekly_snapshots_v2_user_week" in unique_names

