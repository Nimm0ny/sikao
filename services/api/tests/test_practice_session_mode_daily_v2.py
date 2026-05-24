from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from _helpers.practice_content_support import (
    build_client,
    register_user,
    seed_completed_session,
    seed_daily_practice,
    seed_paper,
)
from sikao_api.db.models_v2 import DailyPracticeV2, PracticeSessionV2
from sikao_api.modules.session_lifecycle.application.cleanup import expire_daily_sessions
from sikao_api.modules.progress.application.aggregates import today_cn


def test_session_mode_daily_picks_daily_question_ids(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-MODE-DAILY",
            title="Daily Mode",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        daily_id = seed_daily_practice(client, user_id=user_id, type_name="xingce", question_ids=question_ids, date_value=today_cn())
        response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "daily", "mode": "daily", "config": {"daily_practice_id": daily_id}},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["sourceMode"] == "daily"
        assert [item["prompt"] for item in payload["items"]] == ["A", "B"]
        assert payload["configSnapshot"]["daily_practice_id"] == daily_id
        blocked_second_create = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "daily", "mode": "daily", "config": {"daily_practice_id": daily_id}},
        )
        assert blocked_second_create.status_code == 404, blocked_second_create.text
        assert blocked_second_create.json()["code"] == "daily_practice_not_found"
        app = client.app
        factory = app.state.db.session_factory
        with factory() as session:
            created = session.get(PracticeSessionV2, payload["id"])
            daily_row = session.get(DailyPracticeV2, daily_id)
            assert created is not None
            assert created.expires_at is not None
            assert daily_row is not None and daily_row.status == "started"
            created.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
            session.add(created)
            session.flush()
            expired = expire_daily_sessions(session, now=datetime.now(UTC).replace(tzinfo=None))
            session.commit()
            created = session.get(PracticeSessionV2, payload["id"])
            daily_row = session.get(DailyPracticeV2, daily_id)
            assert expired == 1
            assert created is not None and created.status == "expired"
            assert daily_row is not None and daily_row.status == "expired"


def test_session_mode_daily_rejects_consumed_or_expired_records(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-MODE-DAILY-USED",
            title="Daily Used",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        completed_id = seed_daily_practice(
            client,
            user_id=user_id,
            type_name="xingce",
            question_ids=question_ids,
            date_value=today_cn() - timedelta(days=1),
            status="completed",
        )
        completed_session_id = seed_daily_practice(
            client,
            user_id=user_id,
            type_name="xingce",
            question_ids=question_ids,
            date_value=today_cn() - timedelta(days=2),
            completed_session_id=seed_completed_session(
                client,
                user_id=user_id,
                paper_code="XC-MODE-DAILY-USED",
                submitted_at=datetime(2026, 5, 20, 9, 0, 0),
                answer_outcomes=[True],
            ),
        )
        expired_id = seed_daily_practice(
            client,
            user_id=user_id,
            type_name="xingce",
            question_ids=question_ids,
            date_value=today_cn() - timedelta(days=3),
            expired_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1),
        )
        for daily_id in (completed_id, completed_session_id, expired_id):
            response = client.post(
                "/api/v2/practice/sessions",
                json={"track": "xingce", "entryKind": "daily", "mode": "daily", "config": {"daily_practice_id": daily_id}},
            )
            assert response.status_code == 404, response.text
            assert response.json()["code"] == "daily_practice_not_found"
