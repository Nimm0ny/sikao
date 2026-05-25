from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from _helpers.postgres_temp_db import build_postgres_engine
from _review_phase_r1_support import pg_index_names, render_url, run_alembic
from sikao_api.core.config import Settings
from sikao_api.main import create_app


def _build_settings(tmp_path: Path, database_url: str) -> Settings:
    return Settings(
        app_env="test",
        database_url=database_url,
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="notes-n1-secret",
        app_version="notes-n1-test",
        git_sha="notes-n1-sha",
        image_tag="notes-n1-tag",
        build_time="2026-05-25T00:00:00Z",
        schema_version="notes-n1-schema",
    )


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_n1_postgres_head_schema_and_runtime_smoke(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_notes_n1_head") as engine:
        database_url = render_url(engine.url)
        upgrade = run_alembic(database_url, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

        inspector = inspect(engine)
        assert {
            "notes_v2",
            "note_tags_v2",
            "note_images_v2",
            "note_reactions_v2",
            "note_comments_v2",
            "note_bookmarks_v2",
        } <= set(inspector.get_table_names())

        note_columns = {column["name"] for column in inspector.get_columns("notes_v2")}
        assert {
            "type",
            "body_json",
            "body_text",
            "word_count",
            "content_hash",
            "reaction_count",
            "comment_count",
            "bookmark_count",
            "is_featured",
            "deleted_at",
            "linked_question_id",
            "visibility",
        } <= note_columns

        assert {
            "ix_notes_v2_user_updated",
            "ix_notes_v2_user_question",
            "ix_notes_v2_user_type",
            "ix_notes_v2_user_visibility",
            "ix_notes_v2_linked_question",
        } <= pg_index_names(engine, "notes_v2")
        assert {
            "uq_note_tag_per_note",
            "ix_note_tags_v2_user_tag",
            "ix_note_images_v2_note",
            "uq_note_reaction",
            "ix_note_comments_v2_note_created",
            "ix_note_bookmarks_v2_user",
        } <= pg_index_names(engine, "note_tags_v2") | pg_index_names(engine, "note_images_v2") | pg_index_names(engine, "note_reactions_v2") | pg_index_names(engine, "note_comments_v2") | pg_index_names(engine, "note_bookmarks_v2")

        app = create_app(settings=_build_settings(tmp_path, database_url), initialize_schema=False)
        with TestClient(app) as client:
            response = client.get("/version")
            assert response.status_code == 200, response.text


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_n1_postgres_upgrade_and_downgrade_roundtrip_preserves_legacy_rows() -> None:
    with build_postgres_engine("sikao_notes_n1_roundtrip") as engine:
        database_url = render_url(engine.url)
        base_upgrade = run_alembic(database_url, "upgrade", "1030_review_cause_feedback_contract")
        assert base_upgrade.returncode == 0, base_upgrade.stderr or base_upgrade.stdout

        with engine.begin() as connection:
            user_id = connection.execute(
                text(
                    """
                    INSERT INTO users_v2 (public_id, display_name, is_active, created_at, updated_at)
                    VALUES (:public_id, :display_name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                    """
                ),
                {"public_id": str(uuid4()), "display_name": "legacy-note-user"},
            ).scalar_one()
            connection.execute(
                text(
                    """
                    INSERT INTO notes_v2 (user_id, title, body, status, visibility, created_at, updated_at)
                    VALUES (:user_id, 'legacy note', '数量关系 formula summary', 'active', 'private', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """
                ),
                {"user_id": user_id},
            )

        head_upgrade = run_alembic(database_url, "upgrade", "head")
        assert head_upgrade.returncode == 0, head_upgrade.stderr or head_upgrade.stdout

        with engine.connect() as connection:
            migrated = connection.execute(
                text(
                    """
                    SELECT type, body_text, word_count, deleted_at
                    FROM notes_v2
                    WHERE title = 'legacy note'
                    """
                )
            ).mappings().one()
        assert migrated["type"] == "free"
        assert migrated["body_text"] == "数量关系 formula summary"
        assert migrated["word_count"] == 6
        assert migrated["deleted_at"] is None

        downgrade = run_alembic(database_url, "downgrade", "1030_review_cause_feedback_contract")
        assert downgrade.returncode == 0, downgrade.stderr or downgrade.stdout

        downgraded_columns = {column["name"] for column in inspect(engine).get_columns("notes_v2")}
        assert "note_tags_v2" not in inspect(engine).get_table_names()
        assert "body_json" not in downgraded_columns
        assert "body_text" not in downgraded_columns
        assert "content_hash" not in downgraded_columns
        assert "deleted_at" not in downgraded_columns

        with engine.connect() as connection:
            remaining = connection.execute(
                text("SELECT title FROM notes_v2 WHERE title = 'legacy note'")
            ).scalar_one()
        assert remaining == "legacy note"
