from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import inspect, text

from _helpers.postgres_temp_db import build_postgres_engine
from _review_phase_r1_support import render_url, run_alembic


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_n2_note_images_note_id_is_nullable_after_head() -> None:
    with build_postgres_engine("sikao_notes_n2_head") as engine:
        database_url = render_url(engine.url)
        upgrade = run_alembic(database_url, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

        columns = {column["name"]: column for column in inspect(engine).get_columns("note_images_v2")}
        assert columns["note_id"]["nullable"] is True


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_n2_downgrade_minus_one_rejects_existing_orphans() -> None:
    with build_postgres_engine("sikao_notes_n2_down") as engine:
        database_url = render_url(engine.url)
        upgrade = run_alembic(database_url, "upgrade", "head")
        assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

        with engine.begin() as connection:
            user_id = connection.execute(
                text(
                    """
                    INSERT INTO users_v2 (public_id, display_name, is_active, created_at, updated_at)
                    VALUES (:public_id, :display_name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                    """
                ),
                {"public_id": str(uuid4()), "display_name": "orphan-image-owner"},
            ).scalar_one()
            connection.execute(
                text(
                    """
                    INSERT INTO note_images_v2 (
                        note_id, user_id, file_path, file_name, file_size, mime_type, width, height, created_at
                    )
                    VALUES (
                        NULL, :user_id, '/uploads/notes/demo.png', 'demo.png', 10, 'image/png', 1, 1, CURRENT_TIMESTAMP
                    )
                    """
                ),
                {"user_id": user_id},
            )

        downgrade = run_alembic(database_url, "downgrade", "-1")
        assert downgrade.returncode != 0
        assert "orphan note images exist" in (downgrade.stderr or downgrade.stdout)
