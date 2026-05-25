from __future__ import annotations

import os

import pytest
from sqlalchemy import inspect

from _helpers.postgres_temp_db import build_postgres_engine
from _review_phase_r1_support import render_url, run_alembic


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_n4_ai_runtime_cache_tables_exist_after_head() -> None:
    with build_postgres_engine("sikao_notes_n4_head") as engine:
        database_url = render_url(engine.url)
        upgrade = run_alembic(database_url, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

        inspector = inspect(engine)
        assert {"ai_summary_cache_v2", "weekly_review_cache_v2"} <= set(inspector.get_table_names())

        ai_summary_columns = {column["name"] for column in inspector.get_columns("ai_summary_cache_v2")}
        assert {
            "id",
            "user_id",
            "note_id",
            "content_hash",
            "prompt_version",
            "cards_json",
            "llm_call_id",
            "confirmed_review_item_ids",
            "confirmed_at",
            "created_at",
            "updated_at",
        } <= ai_summary_columns

        weekly_columns = {column["name"] for column in inspector.get_columns("weekly_review_cache_v2")}
        assert {
            "id",
            "user_id",
            "week_start_date",
            "prompt_version",
            "note_id",
            "llm_call_id",
            "created_at",
            "updated_at",
        } <= weekly_columns


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_n4_downgrade_minus_one_drops_ai_runtime_cache_tables() -> None:
    with build_postgres_engine("sikao_notes_n4_down") as engine:
        database_url = render_url(engine.url)
        upgrade = run_alembic(database_url, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

        downgrade = run_alembic(database_url, "downgrade", "-1")
        assert downgrade.returncode == 0, downgrade.stderr or downgrade.stdout

        inspector = inspect(engine)
        assert "ai_summary_cache_v2" not in inspector.get_table_names()
        assert "weekly_review_cache_v2" not in inspector.get_table_names()
