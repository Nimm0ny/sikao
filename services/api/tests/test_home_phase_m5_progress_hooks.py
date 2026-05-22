from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import (
    AuditLogV2,
    LlmCallV2,
    PlanEventV2,
    PracticeSessionV2,
    ProgressSnapshotV2,
    WeaknessSnapshotV2,
)
from sikao_api.modules.system.application.home_runtime import HomeRuntimeOrchestrator

from _home_phase_m5_support import (
    build_client,
    load_user,
    register_user,
    seed_active_plan,
    seed_answer,
    seed_event,
    seed_practice_session,
    seed_question,
)


def test_progress_snapshot_job_writes_single_row_per_user_per_day(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        user = load_user(app)
        started_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=40)
        session_id = seed_practice_session(
            app,
            user_id=user.id,
            started_at=started_at,
            submitted_at=started_at + timedelta(minutes=20),
            status="submitted",
        )
        seed_answer(
            app,
            session_id=session_id,
            question_key="seed-1",
            answered_at=started_at + timedelta(minutes=10),
            is_correct=True,
        )
        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        count_first = asyncio.run(runtime.run_daily_progress_snapshot())
        count_second = asyncio.run(runtime.run_daily_progress_snapshot())

        session = app.state.db.session_factory()
        try:
            rows = list(session.scalars(select(ProgressSnapshotV2).where(ProgressSnapshotV2.user_id == user.id)))
        finally:
            session.close()

    assert count_first >= 1
    assert count_second >= 1
    assert len(rows) == 1


def test_event_status_tick_transitions_concrete_events_and_writes_audit(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        user = load_user(app)
        plan_id = seed_active_plan(app, user_id=user.id)
        now = datetime.now(UTC).replace(tzinfo=None)
        in_progress_event_id = seed_event(
            app,
            user_id=user.id,
            plan_id=plan_id,
            title="Window open",
            start_at=now - timedelta(minutes=10),
            end_at=now + timedelta(minutes=30),
        )
        skipped_event_id = seed_event(
            app,
            user_id=user.id,
            plan_id=plan_id,
            title="Window missed",
            start_at=now - timedelta(hours=2),
            end_at=now - timedelta(hours=1),
        )

        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        skipped = asyncio.run(runtime.run_event_status_tick())

        session = app.state.db.session_factory()
        try:
            in_progress_row = session.get(PlanEventV2, in_progress_event_id)
            skipped_row = session.get(PlanEventV2, skipped_event_id)
            audits = list(
                session.scalars(
                    select(AuditLogV2).where(AuditLogV2.action == "event.status_auto_transition")
                )
            )
        finally:
            session.close()

    assert in_progress_row is not None and in_progress_row.status == "in_progress"
    assert skipped_row is not None and skipped_row.status == "skipped"
    assert [(item.user_id, item.plan_id, item.event_id) for item in skipped] == [
        (user.id, plan_id, skipped_event_id)
    ]
    assert len(audits) == 2


def test_event_status_tick_emits_occurrence_audit_for_recurring_parent(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        user = load_user(app)
        plan_id = seed_active_plan(app, user_id=user.id)
        now = datetime.now(UTC).replace(tzinfo=None)
        seed_event(
            app,
            user_id=user.id,
            plan_id=plan_id,
            title="Daily recurring block",
            start_at=now - timedelta(days=2),
            end_at=now - timedelta(days=2) + timedelta(hours=1),
            recurring_rule="FREQ=DAILY;COUNT=2",
        )

        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        skipped = asyncio.run(runtime.run_event_status_tick())

        session = app.state.db.session_factory()
        try:
            occurrence_audits = list(
                session.scalars(
                    select(AuditLogV2).where(
                        AuditLogV2.action == "event.status_auto_transition",
                        AuditLogV2.target_type == "plan_event_occurrence_v2",
                    )
                )
            )
        finally:
            session.close()

    assert len(skipped) == 2
    assert all(item.occurrence_ref is not None for item in skipped)
    assert len(occurrence_audits) == 2


def test_submit_updates_progress_and_weakness_without_recommender_when_scheduler_disabled(
    tmp_path: Path,
) -> None:
    with build_client(tmp_path, home_scheduler_enabled=False) as (client, app):
        register_user(client)
        user = load_user(app)
        seed_active_plan(app, user_id=user.id)
        started_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=25)
        session_id = seed_practice_session(
            app,
            user_id=user.id,
            started_at=started_at,
            submitted_at=None,
            status="draft",
        )
        question_id = seed_question(app, paper_code="HOME-M5-WEAKNESS", subject_kind="yanyu")
        seed_answer(
            app,
            session_id=session_id,
            question_key="verbal-1",
            answered_at=started_at + timedelta(minutes=10),
            is_correct=True,
            question_id=question_id,
        )

        submit_response = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submit_response.status_code == 200, submit_response.text

        overview_response = client.get("/api/v2/dashboard/progress")
        weakness_response = client.get("/api/v2/dashboard/progress/weakness")
        assert overview_response.status_code == 200, overview_response.text
        assert weakness_response.status_code == 200, weakness_response.text

        session = app.state.db.session_factory()
        try:
            llm_calls = list(session.scalars(select(LlmCallV2).where(LlmCallV2.purpose == "recommend_today")))
        finally:
            session.close()

    overview_body = overview_response.json()
    weakness_body = weakness_response.json()
    assert overview_body["summary"]["today"]["sessionsCount"] >= 1
    assert weakness_body["items"]
    assert llm_calls == []


def test_submit_with_scheduler_eventually_writes_progress_and_weakness_snapshots(tmp_path: Path) -> None:
    with build_client(tmp_path, home_scheduler_enabled=True) as (client, app):
        register_user(client)
        user = load_user(app)
        seed_active_plan(app, user_id=user.id)
        started_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=15)
        session_id = seed_practice_session(
            app,
            user_id=user.id,
            started_at=started_at,
            submitted_at=None,
            status="draft",
        )
        question_id = seed_question(app, paper_code="HOME-M5-ASYNC", subject_kind="yanyu")
        seed_answer(
            app,
            session_id=session_id,
            question_key="async-1",
            answered_at=started_at + timedelta(minutes=5),
            is_correct=False,
            question_id=question_id,
        )

        response = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert response.status_code == 200, response.text

        deadline = datetime.now(UTC).timestamp() + 3.0
        snapshots: list[ProgressSnapshotV2] = []
        weakness_rows: list[WeaknessSnapshotV2] = []
        while datetime.now(UTC).timestamp() < deadline:
            session = app.state.db.session_factory()
            try:
                snapshots = list(
                    session.scalars(select(ProgressSnapshotV2).where(ProgressSnapshotV2.user_id == user.id))
                )
                weakness_rows = list(
                    session.scalars(select(WeaknessSnapshotV2).where(WeaknessSnapshotV2.user_id == user.id))
                )
            finally:
                session.close()
            if snapshots and weakness_rows:
                break
            time.sleep(0.1)

    assert snapshots
    assert weakness_rows


def test_submit_keeps_main_transaction_when_progress_hook_fails(tmp_path: Path, monkeypatch) -> None:
    with build_client(tmp_path, home_scheduler_enabled=True) as (client, app):
        register_user(client)
        user = load_user(app)
        started_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=15)
        session_id = seed_practice_session(
            app,
            user_id=user.id,
            started_at=started_at,
            submitted_at=None,
            status="draft",
        )

        async def _boom(self, *, user_id: int) -> None:
            raise RuntimeError(f"boom-{user_id}")

        monkeypatch.setattr(
            "sikao_api.modules.system.application.home_runtime.HomeRuntimeOrchestrator.run_submit_progress_hooks",
            _boom,
        )

        response = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert response.status_code == 200, response.text
        time.sleep(0.2)

        session = app.state.db.session_factory()
        try:
            practice_session = session.get(PracticeSessionV2, session_id)
        finally:
            session.close()

    assert practice_session is not None
    assert practice_session.status == "submitted"
    assert practice_session.submitted_at is not None
