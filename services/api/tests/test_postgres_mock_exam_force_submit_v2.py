from __future__ import annotations

import os
import asyncio
from datetime import timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.mock_exam.application.auto_submitter import auto_submit_expired_mock_exams
from sikao_api.modules.system.application.home_runtime import HomeRuntimeOrchestrator


def _mock_questions() -> list[dict[str, Any]]:
    return [
        {
            "prompt": f"Question {index}",
            "year": 2024,
            "region": "beijing",
            "exam_type": "provincial",
            "category_l1": "verbal",
            "category_l2": "logic_fill",
        }
        for index in range(1, 31)
    ]


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_force_submitter(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-FORCE-PG-001",
            title="Force PG",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-PG-001"},
            headers={"Idempotency-Key": "mock-create-force-pg-1"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]
        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.auto_submit_at is not None
            expired_now = practice_session.auto_submit_at + timedelta(seconds=1)
            practice_session.status = "paused"
            practice_session.paused_at = practice_session.auto_submit_at - timedelta(minutes=1)
            session.add(practice_session)
            session.commit()

        with factory() as session:
            submitted = auto_submit_expired_mock_exams(session, now=expired_now)
            session.commit()
            assert submitted == [(user_id, session_id)]
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.status == "submitted"
            assert practice_session.force_submitted is True
            assert practice_session.force_submitted_reason == "mock_exam_timeout"

        lifecycle = client.get(f"/api/v2/practice/sessions/{session_id}/lifecycle")
        assert lifecycle.status_code == 200, lifecycle.text
        assert [item["trigger"] for item in lifecycle.json()["transitions"]].count("force_submit") == 1


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_runtime_auto_submit_refreshes_progress_hooks(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-FORCE-PG-003",
            title="Force PG Runtime",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-PG-003"},
            headers={"Idempotency-Key": "mock-create-force-pg-3"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]
        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        app = cast(Any, client.app)
        calls: list[tuple[int, int | None]] = []

        def _record_progress(*, session_factory, user_id: int, session_id: int | None) -> bool:
            del session_factory
            calls.append((user_id, session_id))
            return True

        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(
            "sikao_api.modules.system.application.home_runtime.auto_submit_expired_mock_exams",
            lambda session: [(user_id, session_id)],
        )
        monkeypatch.setattr(
            "sikao_api.modules.system.application.home_runtime.run_progress_submit_hooks_isolated",
            _record_progress,
        )

        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        try:
            submitted = asyncio.run(runtime.run_mock_exam_auto_submit())
        finally:
            monkeypatch.undo()
        assert submitted == [(user_id, session_id)]
        assert calls == [(user_id, session_id)]


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_force_submitter_progress_hook_failure_does_not_block_business_submit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-FORCE-PG-002",
            title="Force PG Hook Failure",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-PG-002"},
            headers={"Idempotency-Key": "mock-create-force-pg-2"},
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["sessionId"]
        started = client.post(f"/api/v2/practice/sessions/{session_id}/start")
        assert started.status_code == 200, started.text

        def _boom(*_args: object, **_kwargs: object) -> None:
            raise RuntimeError("progress hook boom")

        monkeypatch.setattr(
            "sikao_api.modules.session.application.hooks.run_progress_submit_hooks",
            _boom,
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.auto_submit_at is not None
            expired_now = practice_session.auto_submit_at + timedelta(seconds=1)

        with factory() as session:
            submitted = auto_submit_expired_mock_exams(session, now=expired_now)
            session.commit()
            assert submitted == [(user_id, session_id)]
            practice_session = session.get(PracticeSessionV2, session_id)
            assert practice_session is not None
            assert practice_session.status == "submitted"


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_mock_exam_runtime_progress_hook_failure_does_not_block_other_submissions(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MOCK-FORCE-PG-004",
            title="Force PG Runtime Batch",
            subject_kind="xingce",
            questions=_mock_questions(),
        )
        created_a = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-PG-004"},
            headers={"Idempotency-Key": "mock-create-force-pg-4a"},
        )
        created_b = client.post(
            "/api/v2/practice/mock-exams",
            json={"paperCode": "XC-MOCK-FORCE-PG-004"},
            headers={"Idempotency-Key": "mock-create-force-pg-4b"},
        )
        session_a = created_a.json()["sessionId"]
        session_b = created_b.json()["sessionId"]
        assert client.post(f"/api/v2/practice/sessions/{session_a}/start").status_code == 200
        assert client.post(f"/api/v2/practice/sessions/{session_b}/start").status_code == 200

        calls = {"count": 0}

        def flaky_progress(*, session_factory, user_id: int, session_id: int | None) -> bool:
            del session_factory, user_id
            calls["count"] += 1
            return calls["count"] != 1

        monkeypatch.setattr(
            "sikao_api.modules.system.application.home_runtime.auto_submit_expired_mock_exams",
            lambda session: [(user_id, session_a), (user_id, session_b)],
        )
        monkeypatch.setattr(
            "sikao_api.modules.system.application.home_runtime.run_progress_submit_hooks_isolated",
            flaky_progress,
        )

        app = cast(Any, client.app)
        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        submitted = asyncio.run(runtime.run_mock_exam_auto_submit())
        assert submitted == [(user_id, session_a), (user_id, session_b)]
        assert calls["count"] == 2
