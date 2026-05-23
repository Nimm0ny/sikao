from __future__ import annotations

import os
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import DailyPracticeV2


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_daily_practice_start_and_history(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-DAILY-PG-001",
            title="Daily PG Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )

        daily = client.get("/api/v2/practice/daily?type=xingce")
        assert daily.status_code == 200, daily.text
        daily_id = daily.json()["id"]

        started = client.post(f"/api/v2/practice/daily/{daily_id}/start")
        assert started.status_code == 200, started.text
        session_id = started.json()["id"]
        answer_key = started.json()["items"][0]["questionKey"]
        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        history = client.get("/api/v2/practice/daily/history?period=7d&type=xingce")
        assert history.status_code == 200, history.text
        assert history.json()[0]["completedSessionId"] == session_id

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(DailyPracticeV2, daily_id)
            assert row is not None
            assert row.completed_session_id == session_id
            assert row.status == "completed"
