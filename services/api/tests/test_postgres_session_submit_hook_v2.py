from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_paper,
)
from sikao_api.db.models_v2 import PracticeSessionV2, PracticeStatsSnapshotV2, QuestionV2


class _FakeScheduler:
    def __init__(self, *, progress_result: bool, recommender_result: bool = True) -> None:
        self.progress_result = progress_result
        self.recommender_result = recommender_result
        self.progress_calls: list[tuple[int, int | None, str | None]] = []
        self.recommender_calls: list[tuple[int, int, str | None]] = []

    def enqueue_submit_progress_refresh(
        self,
        *,
        user_id: int,
        session_id: int | None,
        request_id: str | None,
    ) -> bool:
        self.progress_calls.append((user_id, session_id, request_id))
        return self.progress_result

    def enqueue_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
    ) -> bool:
        self.recommender_calls.append((user_id, session_id, request_id))
        return self.recommender_result


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_submit_hook_progress_enqueue_false_falls_back_to_inline_stats_refresh(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-SUBMIT-HOOK-001",
            title="Submit Hook Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Q1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )
        app = cast(Any, client.app)
        scheduler = _FakeScheduler(progress_result=False, recommender_result=True)
        app.state.home_scheduler = scheduler

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-SUBMIT-HOOK-001",
                "payload": {},
                "practiceMode": "full_set",
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]
        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {
                        "questionKey": answer_key,
                        "answer": {"selected": ["A"]},
                        "durationSeconds": 30,
                    }
                ]
            },
        )
        assert saved.status_code == 200, saved.text

        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        factory = app.state.db.session_factory
        with factory() as session:
            snapshots = list(
                session.query(PracticeStatsSnapshotV2)
                .filter_by(user_id=user_id, type="xingce")
                .all()
            )
            question = session.query(QuestionV2).filter_by(category_l2="logic_fill").one()
            assert snapshots
            assert question.answer_count == 1
            assert question.historical_accuracy == 0.0
        assert len(scheduler.progress_calls) == 1
        assert scheduler.progress_calls[0][0] == user_id
        assert scheduler.progress_calls[0][1] == session_id
        assert isinstance(scheduler.progress_calls[0][2], str)
        assert len(scheduler.recommender_calls) == 1
        assert scheduler.recommender_calls[0][0] == user_id
        assert scheduler.recommender_calls[0][1] == session_id
        assert isinstance(scheduler.recommender_calls[0][2], str)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_submit_hook_failure_no_longer_rolls_back_submitted_session(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-SUBMIT-HOOK-002",
            title="Submit Hook Failure Source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Q1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )

        def _boom(*_args: object, **_kwargs: object) -> None:
            raise RuntimeError("hook boom")

        monkeypatch.setattr(
            "sikao_api.modules.session.application.hooks.run_progress_submit_hooks",
            _boom,
        )

        created = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "paper",
                "paperCode": "XC-SUBMIT-HOOK-002",
                "payload": {},
                "practiceMode": "full_set",
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        answer_key = created.json()["items"][0]["questionKey"]
        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={
                "answers": [
                    {
                        "questionKey": answer_key,
                        "answer": {"selected": ["A"]},
                        "durationSeconds": 30,
                    }
                ]
            },
        )
        assert saved.status_code == 200, saved.text

        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.status == "submitted"
            assert practice_session.submitted_at is not None
