from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import ProgressSnapshotV2, UserV2
from sikao_api.scheduler import HomeSchedulerContext
from sikao_api.scheduler.jobs.progress_snapshot import run_progress_snapshot_job

from tests._home_phase_m3_support import build_client, load_user, register, seed_answer, seed_practice_session, seed_question


def _job_context(app) -> HomeSchedulerContext:
    return HomeSchedulerContext(settings=app.state.settings, db=app.state.db)


def test_progress_snapshot_job_writes_zero_snapshot_for_active_user_without_sessions(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        asyncio.run(run_progress_snapshot_job(_job_context(app)))

        session = app.state.db.session_factory()
        try:
            snapshots = list(session.scalars(select(ProgressSnapshotV2)))
            assert len(snapshots) == 1
            assert snapshots[0].data_json["itemsAnswered"] == 0
            assert snapshots[0].data_json["minutesPracticed"] == 0
        finally:
            session.close()


def test_progress_snapshot_job_is_idempotent_and_handles_multiple_users(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        alice = load_user(app)
        question_id = seed_question(app, subject_kind="yanyu", item_no=1)
        alice_session_id = seed_practice_session(
            app,
            user_id=alice.id,
            started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=45),
            status="submitted",
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=5),
        )
        seed_answer(
            app,
            session_id=alice_session_id,
            question_id=question_id,
            question_key=str(question_id),
            display_order=1,
            answered_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=20),
            is_correct=True,
        )

        session = app.state.db.session_factory()
        try:
            bob = UserV2(display_name="Bob")
            session.add(bob)
            session.commit()
            bob_id = bob.id
        finally:
            session.close()

        asyncio.run(run_progress_snapshot_job(_job_context(app)))
        asyncio.run(run_progress_snapshot_job(_job_context(app)))

        session = app.state.db.session_factory()
        try:
            snapshots = list(
                session.scalars(
                    select(ProgressSnapshotV2).order_by(
                        ProgressSnapshotV2.user_id.asc(),
                        ProgressSnapshotV2.snapshot_date.asc(),
                    )
                )
            )
            assert len(snapshots) == 2
            by_user = {row.user_id: row for row in snapshots}
            assert by_user[alice.id].data_json["itemsAnswered"] == 1
            assert by_user[bob_id].data_json["itemsAnswered"] == 0
        finally:
            session.close()
