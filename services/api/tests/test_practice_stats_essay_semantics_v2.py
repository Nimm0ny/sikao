from __future__ import annotations

from datetime import datetime
from pathlib import Path

from _helpers.practice_content_support import (
    build_client,
    register_user,
    seed_completed_session,
    seed_essay_submission,
    seed_paper,
)


def test_essay_stats_deduplicate_shared_session_minutes(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="ES-STATS-02",
            title="Essay Session Dedup",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay A", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "summary"},
                {"prompt": "Essay B", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "proposal"},
            ],
        )
        practice_session_id = seed_completed_session(
            client,
            user_id=user_id,
            paper_code="ES-STATS-02",
            started_at=datetime(2026, 5, 23, 9, 0, 0),
            submitted_at=datetime(2026, 5, 23, 9, 30, 0),
        )
        seed_essay_submission(client, user_id=user_id, question_id=question_ids[0], practice_session_id=practice_session_id, submitted_at=datetime(2026, 5, 23, 9, 30, 0), score=70.0)
        seed_essay_submission(client, user_id=user_id, question_id=question_ids[1], practice_session_id=practice_session_id, submitted_at=datetime(2026, 5, 23, 9, 30, 0), score=80.0)

        response = client.get("/api/v2/practice/stats?type=essay")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["overall"]["totalQuestions"] == 2
        assert payload["overall"]["totalSessions"] == 1
        assert payload["overall"]["totalMinutes"] == 30
        assert payload["overall"]["averageScore"] == 75.0


def test_essay_stats_ignore_pending_and_failed_reports(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="ES-STATS-03",
            title="Essay Status Filter",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay A", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "summary"},
            ],
        )[0]
        seed_essay_submission(client, user_id=user_id, question_id=question_id, submitted_at=datetime(2026, 5, 23, 9, 0, 0), score=72.0, report_status="completed")
        seed_essay_submission(client, user_id=user_id, question_id=question_id, submitted_at=datetime(2026, 5, 23, 10, 0, 0), score=None, report_status="pending")
        seed_essay_submission(client, user_id=user_id, question_id=question_id, submitted_at=datetime(2026, 5, 23, 11, 0, 0), score=None, report_status="failed")

        response = client.get("/api/v2/practice/stats?type=essay")
        assert response.status_code == 200, response.text
        assert response.json()["overall"]["totalQuestions"] == 1
        assert response.json()["overall"]["averageScore"] == 72.0
