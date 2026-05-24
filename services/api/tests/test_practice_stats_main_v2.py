from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import text

from _helpers.practice_content_support import (
    build_client,
    register_user,
    seed_completed_session,
    seed_essay_submission,
    seed_paper,
)
from sikao_api.modules.practice_stats.application.snapshot_writer import recompute_user_stats


def test_xingce_stats_main_endpoint_falls_back_to_realtime(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-STATS-01",
            title="Stats Xingce",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-STATS-01",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True, False],
        )

        response = client.get("/api/v2/practice/stats?type=xingce")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["type"] == "xingce"
        assert payload["overall"]["totalQuestions"] == 2
        assert payload["overall"]["correctCount"] == 1
        assert payload["overall"]["accuracy"] == 0.5
        assert payload["byCategoryL1"][0]["categoryKey"] == "verbal"
        assert len(payload["byCategoryL2"]) == 2


def test_essay_stats_main_endpoint_exposes_average_score(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="ES-STATS-01",
            title="Stats Essay",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay A", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "summary"},
            ],
        )[0]
        seed_essay_submission(
            client,
            user_id=user_id,
            question_id=question_id,
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            score=72.0,
        )

        response = client.get("/api/v2/practice/stats?type=essay")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["type"] == "essay"
        assert payload["overall"]["totalQuestions"] == 1
        assert payload["overall"]["averageScore"] == 72.0
        assert payload["overall"]["accuracy"] == 0.72


def test_xingce_stats_main_endpoint_backfills_legacy_percentile_nulls(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client, email="legacy-stats@example.com", display_name="Legacy Stats")
        seed_paper(
            client,
            paper_code="XC-STATS-LEGACY",
            title="Stats Legacy",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-STATS-LEGACY",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True],
        )
        app = client.app
        factory = app.state.db.session_factory
        with factory() as session:
            recompute_user_stats(session, user_id=user_id)
            session.execute(
                text(
                    """
                    UPDATE practice_stats_snapshot_v2
                    SET percentile_rank = NULL, percentile_updated_at = NULL
                    WHERE user_id = :user_id AND type = 'xingce' AND total_questions > 0
                    """
                ),
                {"user_id": user_id},
            )
            session.commit()

        response = client.get("/api/v2/practice/stats?type=xingce")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["overall"]["percentileRank"] == 1.0
