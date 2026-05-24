from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

import os
import pytest

from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_daily_practice,
    seed_paper,
    seed_review_item,
)
from sikao_api.db.models_v2 import DailyPracticeV2, PracticeSessionV2
from sikao_api.modules.session_lifecycle.application.cleanup import expire_daily_sessions
from sikao_api.modules.progress.application.aggregates import today_cn


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_session_modes_category_daily_and_wrong_redo(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-PG-MODES",
            title="PG Session Modes",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        category = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "category", "mode": "category", "config": {"category_l1": "verbal", "count": 2}},
        )
        assert category.status_code == 200, category.text
        assert len(category.json()["items"]) == 2

        daily_id = seed_daily_practice(
            client,
            user_id=user_id,
            type_name="xingce",
            question_ids=question_ids,
            date_value=today_cn(),
        )
        daily = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "daily", "mode": "daily", "config": {"daily_practice_id": daily_id}},
        )
        assert daily.status_code == 200, daily.text
        assert daily.json()["sourceMode"] == "daily"
        blocked_second_create = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "daily", "mode": "daily", "config": {"daily_practice_id": daily_id}},
        )
        assert blocked_second_create.status_code == 404, blocked_second_create.text
        assert blocked_second_create.json()["code"] == "daily_practice_not_found"
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            created = session.get(PracticeSessionV2, daily.json()["id"])
            daily_row = session.get(DailyPracticeV2, daily_id)
            assert created is not None
            assert created.expires_at is not None
            assert daily_row is not None and daily_row.status == "started"
            created.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
            session.add(created)
            session.flush()
            expired = expire_daily_sessions(session, now=datetime.now(UTC).replace(tzinfo=None))
            session.commit()
            created = session.get(PracticeSessionV2, daily.json()["id"])
            daily_row = session.get(DailyPracticeV2, daily_id)
            assert expired == 1
            assert created is not None and created.status == "expired"
            assert daily_row is not None and daily_row.status == "expired"

        seed_review_item(client, user_id=user_id, question_id=question_ids[0], title="Redo A")
        seed_review_item(client, user_id=user_id, question_id=question_ids[0], title="Redo A duplicate")
        essay_question_id = seed_paper(
            client,
            paper_code="ES-PG-MODES",
            title="PG Session Modes Essay",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay Q", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "summary"},
            ],
        )[0]
        seed_review_item(client, user_id=user_id, question_id=essay_question_id, title="Redo Essay")
        wrong_redo = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "wrong_redo", "mode": "wrong_redo", "config": {"count": 1}},
        )
        assert wrong_redo.status_code == 200, wrong_redo.text
        assert wrong_redo.json()["items"][0]["prompt"] == "A"

        conflict = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "daily", "mode": "daily", "paperCode": "XC-PG-MODES", "config": {"daily_practice_id": daily_id}},
        )
        assert conflict.status_code == 422, conflict.text
        assert conflict.json()["code"] == "practice_session_mode_conflict"
