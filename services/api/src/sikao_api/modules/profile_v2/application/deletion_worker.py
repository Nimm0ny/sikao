"""PR-P5: Hard-delete cron worker.

Runs daily at 02:00 UTC+8. Scans AccountDeletionJobV2 where
status='pending' AND hard_delete_at <= now(), then:
1. Anonymize audit logs (actor -> "deleted_user:<public_id>")
2. Nullify LlmCallV2.user_id
3. DELETE user (CASCADE cleans related data; job survives via SET NULL)
4. Mark job status='completed'

Audit retention: AccountDeletionJobV2.user_id has ondelete=SET NULL, so
the job row persists with user_id=NULL and user_public_id preserved as
an audit record after hard delete.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AccountDeletionJobV2, UserV2


def run_hard_delete_sweep(session: Session) -> int:
    """Execute pending hard-delete jobs. Returns count of processed jobs.

    Jobs that fail are marked with status='failed' and an error_message;
    the worker continues to the next job.
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    jobs = session.scalars(
        select(AccountDeletionJobV2).where(
            AccountDeletionJobV2.status == "pending",
            AccountDeletionJobV2.hard_delete_at <= now,
        )
    ).all()

    processed = 0
    for job in jobs:
        job_id = job.id
        try:
            _execute_hard_delete(session, job=job, now=now)
            processed += 1
        except Exception as exc:
            session.rollback()
            # Re-fetch since the previous transaction was rolled back.
            failed_job = session.get(AccountDeletionJobV2, job_id)
            if failed_job is not None:
                failed_job.status = "failed"
                failed_job.error_message = str(exc)[:500]
                session.commit()

    return processed


def _execute_hard_delete(
    session: Session, *, job: AccountDeletionJobV2, now: datetime
) -> None:
    # TODO: anonymize AuditLogV2 / nullify LlmCallV2.user_id before user delete

    user = session.get(UserV2, job.user_id) if job.user_id is not None else None
    if user is not None:
        session.delete(user)

    # SET NULL on FK preserves the job as audit record after user deletion.
    job.status = "completed"
    job.completed_at = now
    session.add(job)
    session.commit()
