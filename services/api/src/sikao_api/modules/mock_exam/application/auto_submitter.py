from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.mock_exam.application.enforcer import resolve_force_submit_reason
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.modules.session.application.submit_hooks import run_progress_submit_hooks
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError


def auto_submit_expired_mock_exams(
    session: Session,
    *,
    now: datetime | None = None,
) -> list[tuple[int, int]]:
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    rows = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.exam_mode.is_(True),
                PracticeSessionV2.status.in_(("in_progress", "paused")),
                PracticeSessionV2.auto_submit_at.is_not(None),
                PracticeSessionV2.auto_submit_at <= current_time,
            ).order_by(PracticeSessionV2.id.asc())
        )
    )
    submitted: list[tuple[int, int]] = []
    service = SessionServiceV2(session)
    for practice_session in rows:
        reason = resolve_force_submit_reason(practice_session, now=current_time)
        if reason is None:
            continue
        try:
            with session.begin_nested():
                service.submit(
                    practice_session=practice_session,
                    force_submitted_reason=reason,
                )
                run_progress_submit_hooks(
                    session,
                    user_id=practice_session.user_id,
                    session_id=practice_session.id,
                )
                add_audit_log(
                    session,
                    user_id=practice_session.user_id,
                    actor_type="system",
                    actor_id="mock_exam.auto_submitter",
                    action="mock_exam.force_submitted",
                    target_type="practice_session_v2",
                    target_id=practice_session.id,
                    metadata={"reason": reason},
                    request_id=None,
                    ip=None,
                )
                submitted.append((practice_session.user_id, practice_session.id))
        except ConflictError:
            continue
    session.flush()
    return submitted
