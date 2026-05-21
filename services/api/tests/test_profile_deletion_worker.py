"""Tests for the hard-delete cron worker (PR-P5)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import AccountDeletionJobV2, UserV2
from sikao_api.db.session import DatabaseManager
from sikao_api.modules.profile_v2.application import deletion_worker


def _make_db(tmp_path: Path) -> DatabaseManager:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'worker.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="worker-test-secret",
        app_version="worker-test",
        git_sha="worker-sha",
        image_tag="worker-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="worker-schema",
    )
    db = DatabaseManager(settings)
    db.create_all()
    return db


def _seed_pending_job(db: DatabaseManager, *, hard_delete_at: datetime) -> tuple[int, int, str]:
    session = db.session_factory()
    try:
        user = UserV2(display_name="ToDelete")
        session.add(user)
        session.flush()
        now = datetime.now(UTC).replace(tzinfo=None)
        user.deleted_at = now - timedelta(days=8)
        user.is_active = False
        job = AccountDeletionJobV2(
            user_id=user.id,
            user_public_id=user.public_id,
            requested_at=now - timedelta(days=8),
            hard_delete_at=hard_delete_at,
            status="pending",
            reason="other",
        )
        session.add(job)
        session.commit()
        return user.id, job.id, user.public_id
    finally:
        session.close()


def test_worker_completes_due_job_and_keeps_audit_record(tmp_path: Path) -> None:
    """v2-#1 regression: job row must survive after user delete (FK SET NULL)."""
    db = _make_db(tmp_path)
    past = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    user_id, job_id, public_id = _seed_pending_job(db, hard_delete_at=past)

    session = db.session_factory()
    try:
        processed = deletion_worker.run_hard_delete_sweep(session)
    finally:
        session.close()

    assert processed == 1

    verify = db.session_factory()
    try:
        # User row should be gone.
        assert verify.get(UserV2, user_id) is None
        # Job row must survive as audit record.
        surviving = verify.get(AccountDeletionJobV2, job_id)
        assert surviving is not None
        assert surviving.status == "completed"
        assert surviving.user_id is None  # FK SET NULL fired
        assert surviving.user_public_id == public_id  # public_id preserved
    finally:
        verify.close()


def test_worker_skips_jobs_not_yet_due(tmp_path: Path) -> None:
    db = _make_db(tmp_path)
    future = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=3)
    user_id, _, _ = _seed_pending_job(db, hard_delete_at=future)

    session = db.session_factory()
    try:
        processed = deletion_worker.run_hard_delete_sweep(session)
    finally:
        session.close()

    assert processed == 0

    verify = db.session_factory()
    try:
        assert verify.get(UserV2, user_id) is not None
    finally:
        verify.close()


def test_worker_marks_job_failed_when_execute_raises(
    tmp_path: Path, monkeypatch
) -> None:
    """v2-#2 regression: failed jobs must persist as 'failed' with error_message."""
    db = _make_db(tmp_path)
    past = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    user_id, job_id, _ = _seed_pending_job(db, hard_delete_at=past)

    def boom(session, *, job, now):
        raise RuntimeError("simulated failure")

    monkeypatch.setattr(deletion_worker, "_execute_hard_delete", boom)

    session = db.session_factory()
    try:
        processed = deletion_worker.run_hard_delete_sweep(session)
    finally:
        session.close()

    assert processed == 0

    verify = db.session_factory()
    try:
        failed = verify.get(AccountDeletionJobV2, job_id)
        assert failed is not None
        assert failed.status == "failed"
        assert failed.error_message == "simulated failure"
        # User must still exist (failure handler must rollback the staged delete).
        assert verify.get(UserV2, user_id) is not None
    finally:
        verify.close()
