from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_completed_session,
    seed_essay_submission,
    seed_paper,
)
from sikao_api.modules.practice_stats.application.snapshot_writer import recompute_user_stats


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_practice_stats_routes(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-PG-STATS-01",
            title="PG Stats",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill", "historical_accuracy": 0.2},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading", "historical_accuracy": 0.8},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-PG-STATS-01",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True, False],
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            recompute_user_stats(session, user_id=user_id)
            session.commit()

        stats = client.get("/api/v2/practice/stats?type=xingce")
        assert stats.status_code == 200, stats.text
        assert stats.json()["overall"]["accuracy"] == 0.5

        cross = client.get("/api/v2/practice/stats/cross?type=xingce&category=verbal")
        assert cross.status_code == 200, cross.text
        assert len(cross.json()["items"]) == 2

        percentile = client.get("/api/v2/practice/stats/percentile?type=xingce&category=verbal")
        assert percentile.status_code == 200, percentile.text

        essay_question_id = seed_paper(
            client,
            paper_code="ES-PG-STATS-01",
            title="PG Essay Stats",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay A", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "summary"},
            ],
        )[0]
        seed_essay_submission(
            client,
            user_id=user_id,
            question_id=essay_question_id,
            submitted_at=datetime(2026, 5, 23, 10, 0, 0),
            score=75.0,
        )
        with factory() as session:
            recompute_user_stats(session, user_id=user_id)
            session.commit()

        essay_stats = client.get("/api/v2/practice/stats?type=essay")
        assert essay_stats.status_code == 200, essay_stats.text
        assert essay_stats.json()["overall"]["averageScore"] == 75.0
