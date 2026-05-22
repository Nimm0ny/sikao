from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import PlanEventV2, PracticeSessionAnswerV2, PracticeSessionV2
from sikao_api.modules.progress.application.service import build_progress_overview
from sikao_api.scheduler import HomeSchedulerContext
from sikao_api.scheduler.jobs.event_status_tick import sync_run_event_status_tick_job
from sikao_api.modules.plans.domain.rrule_subset import build_occurrence_ref

from tests._home_phase_m3_support import build_client, load_user, register, seed_question


def _job_context(app) -> HomeSchedulerContext:
    return HomeSchedulerContext(settings=app.state.settings, db=app.state.db)


def _create_plan(client) -> int:
    response = client.post(
        "/api/v2/plans",
        json={
            "name": "Tick plan",
            "targetExamId": "guokao_2027",
            "targetExamDate": "2027-11-26",
            "dailyMinutesTarget": 180,
            "style": "balanced",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_event_status_tick_updates_concrete_rows_and_is_idempotent(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        user = load_user(app)
        plan_id = _create_plan(client)
        now = datetime(2026, 6, 16, 12, 0)

        session = app.state.db.session_factory()
        try:
            concrete_skipped = PlanEventV2(
                plan_id=plan_id,
                user_id=user.id,
                title="Past planned",
                category="custom",
                notes="",
                start_at=now - timedelta(hours=3),
                end_at=now - timedelta(hours=2),
                timezone="Asia/Shanghai",
                recurring_rule=None,
                recurring_exception_dates=[],
                status="planned",
                source="user_manual",
                change_log=[],
            )
            concrete_done = PlanEventV2(
                plan_id=plan_id,
                user_id=user.id,
                title="Past in progress",
                category="custom",
                notes="",
                start_at=now - timedelta(hours=2),
                end_at=now - timedelta(hours=1),
                timezone="Asia/Shanghai",
                recurring_rule=None,
                recurring_exception_dates=[],
                status="in_progress",
                source="user_manual",
                change_log=[],
            )
            session.add_all([concrete_skipped, concrete_done])
            session.flush()
            submitted_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="manual",
                status="submitted",
                started_at=now - timedelta(hours=2),
                submitted_at=now - timedelta(hours=1, minutes=15),
                payload_json={},
                linked_plan_event_id=concrete_done.id,
            )
            session.add(submitted_session)
            session.commit()
            concrete_skipped_id = concrete_skipped.id
            concrete_done_id = concrete_done.id
            submitted_session_id = submitted_session.id
        finally:
            session.close()

        first = sync_run_event_status_tick_job(_job_context(app), current_time=now)
        second = sync_run_event_status_tick_job(_job_context(app), current_time=now)

        assert first.updated_events == 2
        assert second.updated_events == 0

        session = app.state.db.session_factory()
        try:
            skipped_row = session.get(PlanEventV2, concrete_skipped_id)
            done_row = session.get(PlanEventV2, concrete_done_id)
            assert skipped_row is not None and skipped_row.status == "skipped"
            assert done_row is not None and done_row.status == "done"
            assert done_row.linked_session_id == submitted_session_id
        finally:
            session.close()


def test_event_status_tick_materializes_recurring_occurrences_without_mutating_parent_status(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        user = load_user(app)
        plan_id = _create_plan(client)
        now = datetime(2026, 6, 16, 12, 0)
        occurrence_start = datetime(2026, 6, 15, 1, 0)

        session = app.state.db.session_factory()
        try:
            parent = PlanEventV2(
                plan_id=plan_id,
                user_id=user.id,
                title="Recurring review",
                category="review",
                notes="",
                start_at=occurrence_start,
                end_at=occurrence_start + timedelta(hours=1),
                timezone="Asia/Shanghai",
                recurring_rule="FREQ=DAILY;COUNT=2",
                recurring_exception_dates=[],
                status="planned",
                source="ai_generated",
                change_log=[],
            )
            session.add(parent)
            session.flush()
            linked_occurrence_ref = build_occurrence_ref(
                parent_id=parent.id,
                occurrence_start=occurrence_start,
                timezone=parent.timezone,
            )
            submitted_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="manual",
                status="submitted",
                started_at=occurrence_start,
                submitted_at=occurrence_start + timedelta(minutes=30),
                payload_json={},
                linked_plan_event_id=parent.id,
                linked_plan_event_occurrence_ref=linked_occurrence_ref,
            )
            session.add(submitted_session)
            session.commit()
            parent_id = parent.id
            submitted_session_id = submitted_session.id
        finally:
            session.close()

        first = sync_run_event_status_tick_job(_job_context(app), current_time=now)
        second = sync_run_event_status_tick_job(_job_context(app), current_time=now)

        assert first.materialized_occurrences == 2
        assert second.materialized_occurrences == 0

        session = app.state.db.session_factory()
        try:
            parent = session.get(PlanEventV2, parent_id)
            detached_rows = list(
                session.scalars(
                    select(PlanEventV2)
                    .where(PlanEventV2.recurring_parent_id == parent_id)
                    .order_by(PlanEventV2.start_at.asc())
                )
            )
            assert parent is not None
            assert parent.status == "planned"
            assert parent.recurring_exception_dates == ["2026-06-15", "2026-06-16"]
            assert len(detached_rows) == 2
            assert detached_rows[0].status == "done"
            assert detached_rows[0].linked_session_id == submitted_session_id
            assert detached_rows[1].status == "skipped"
        finally:
            session.close()


def test_event_status_tick_preserves_progress_invariant(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        user = load_user(app)
        plan_id = _create_plan(client)
        question_id = seed_question(app, subject_kind="yanyu", item_no=1)
        now = datetime.now(UTC).replace(tzinfo=None)

        session = app.state.db.session_factory()
        try:
            event = PlanEventV2(
                plan_id=plan_id,
                user_id=user.id,
                title="Invariant event",
                category="xingce",
                notes="",
                start_at=now - timedelta(hours=2),
                end_at=now - timedelta(hours=1),
                timezone="Asia/Shanghai",
                recurring_rule=None,
                recurring_exception_dates=[],
                status="planned",
                source="user_manual",
                change_log=[],
            )
            linked_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="manual",
                status="submitted",
                started_at=now - timedelta(hours=2),
                submitted_at=now - timedelta(hours=1, minutes=10),
                payload_json={},
            )
            session.add_all([event, linked_session])
            session.flush()
            linked_session.linked_plan_event_id = event.id
            session.add(
                PracticeSessionAnswerV2(
                    session_id=linked_session.id,
                    question_id=question_id,
                    question_key=str(question_id),
                    display_order=1,
                    response_json={"selected": "A"},
                    is_correct=True,
                    answered_at=now - timedelta(hours=1, minutes=20),
                )
            )
            session.commit()
        finally:
            session.close()

        session = app.state.db.session_factory()
        try:
            before = build_progress_overview(session, user=user, plan_id=plan_id)
        finally:
            session.close()

        sync_run_event_status_tick_job(_job_context(app), current_time=now)

        session = app.state.db.session_factory()
        try:
            after = build_progress_overview(session, user=user, plan_id=plan_id)
        finally:
            session.close()

        assert before.summary.today == after.summary.today
