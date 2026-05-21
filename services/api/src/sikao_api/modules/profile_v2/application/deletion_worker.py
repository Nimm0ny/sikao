"""PR-P5: Hard-delete cron worker stub.

Runs daily at 02:00 UTC+8. Scans AccountDeletionJobV2 where
status='pending' AND hard_delete_at <= now(), then:
1. Anonymize audit logs (actor -> "deleted_user:<public_id>")
2. Nullify LlmCallV2.user_id
3. DELETE user (CASCADE cleans all related data)
4. Mark job status='completed'

Not implemented yet — scheduling infrastructure TBD.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AccountDeletionJobV2, UserV2


def run_hard_delete_sweep(session: Session) -> int:
    """Execute pending hard-delete jobs. Returns count of processed jobs.

    Raises on individual job failure after marking job as failed.
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
        try:
            _execute_hard_delete(session, job=job, now=now)
            processed += 1
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)[:500]
            session.add(job)
            session.commit()

    return processed


def _execute_hard_delete(
    session: Session, *, job: AccountDeletionJobV2, now: datetime
) -> None:
    # TODO: anonymize AuditLogV2 / nullify LlmCallV2.user_id before CASCADE
    # Mark job completed BEFORE deleting user (CASCADE would destroy job row)
    job.status = "completed"
    job.completed_at = now
    session.add(job)
    session.flush()

    user = session.get(UserV2, job.user_id)
    if user is not None:
        session.delete(user)

    session.commit()
