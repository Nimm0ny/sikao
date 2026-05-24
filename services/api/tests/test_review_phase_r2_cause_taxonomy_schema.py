from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import inspect, select

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import CauseTagV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_r2_schema_adds_cause_tag_table_and_analysis_version(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            inspector = inspect(session.get_bind())
            assert "cause_tag_v2" in inspector.get_table_names()
            ai_columns = {column["name"] for column in inspector.get_columns("ai_cause_analysis_v2")}
            assert {"version", "updated_at"} <= ai_columns

            rows = list(
                session.scalars(
                    select(CauseTagV2).where(CauseTagV2.is_active.is_(True)).order_by(CauseTagV2.display_order.asc())
                )
            )
            assert len(rows) == 16
            assert rows[0].slug == "concept_confusion"
            assert rows[-1].slug == "other"
            assert {row.taxonomy_version for row in rows} == {"v1"}

