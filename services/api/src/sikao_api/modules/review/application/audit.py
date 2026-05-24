from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm import Session as SqlAlchemySession

from sikao_api.modules.system.application.audit_v2 import add_audit_log


def log_review_item_archived(
    session: Session,
    *,
    user_id: int,
    item_id: int,
    before_status: str,
    request_id: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.item.archived",
        target_type="review_item_v2",
        target_id=item_id,
        before={"status": before_status},
        after={"status": "archived"},
        request_id=request_id,
    )


def log_review_item_restored(
    session: Session,
    *,
    user_id: int,
    item_id: int,
    request_id: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.item.restored",
        target_type="review_item_v2",
        target_id=item_id,
        after={"status": "pending", "correct_streak": 0},
        request_id=request_id,
    )


def log_review_item_mark_resolved(
    session: Session,
    *,
    user_id: int,
    item_id: int,
    before_status: str,
    request_id: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.item.mark_resolved",
        target_type="review_item_v2",
        target_id=item_id,
        before={"status": before_status},
        after={"status": "probationary"},
        request_id=request_id,
    )


def log_review_cause_analysis_requested(
    session: Session,
    *,
    user_id: int,
    scope: str,
    mode: str,
    review_item_id: int | None,
    request_id: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.cause_analysis.requested",
        target_type="review_item_v2" if review_item_id is not None else "review_group",
        target_id=review_item_id,
        metadata={"scope": scope, "mode": mode},
        request_id=request_id,
    )


def persist_review_cause_analysis_requested(
    session: Session,
    *,
    user_id: int,
    scope: str,
    mode: str,
    review_item_id: int | None,
    request_id: str | None,
) -> None:
    _commit_isolated_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.cause_analysis.requested",
        target_type="review_item_v2" if review_item_id is not None else "review_group",
        target_id=review_item_id,
        metadata={"scope": scope, "mode": mode},
        request_id=request_id,
    )


def log_review_cause_analysis_cache_hit(
    session: Session,
    *,
    user_id: int,
    scope: str,
    mode: str,
    analysis_id: int,
    request_id: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.cause_analysis.cache_hit",
        target_type="ai_cause_analysis_v2",
        target_id=analysis_id,
        metadata={"scope": scope, "mode": mode},
        request_id=request_id,
    )


def log_review_cause_analysis_completed(
    session: Session,
    *,
    user_id: int,
    scope: str,
    mode: str,
    analysis_id: int,
    llm_call_id: int,
    duration_ms: int,
    request_id: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.cause_analysis.completed",
        target_type="ai_cause_analysis_v2",
        target_id=analysis_id,
        metadata={
            "scope": scope,
            "mode": mode,
            "llmCallId": llm_call_id,
            "durationMs": duration_ms,
        },
        request_id=request_id,
    )


def log_review_cause_analysis_failed(
    session: Session,
    *,
    user_id: int,
    scope: str,
    mode: str,
    error_type: str,
    request_id: str | None,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.cause_analysis.failed",
        target_type="ai_cause_analysis_v2",
        target_id=None,
        metadata={"scope": scope, "mode": mode, "errorType": error_type},
        request_id=request_id,
    )


def persist_review_cause_analysis_failed(
    session: Session,
    *,
    user_id: int,
    scope: str,
    mode: str,
    error_type: str,
    request_id: str | None,
) -> None:
    _commit_isolated_audit_log(
        session,
        user_id=user_id,
        actor_type="user",
        actor_id=str(user_id),
        action="review.cause_analysis.failed",
        target_type="ai_cause_analysis_v2",
        target_id=None,
        metadata={"scope": scope, "mode": mode, "errorType": error_type},
        request_id=request_id,
    )


def log_review_weekly_snapshot_generated(
    session: Session,
    *,
    user_id: int,
    snapshot_id: int,
    week: str,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="system",
        actor_id="review.weekly_summary.snapshot",
        action="review.weekly_summary.snapshot_generated",
        target_type="review_weekly_snapshot_v2",
        target_id=snapshot_id,
        metadata={"week": week},
        request_id=None,
    )


def log_review_weekly_snapshot_refreshed(
    session: Session,
    *,
    user_id: int,
    snapshot_id: int,
    week: str,
) -> None:
    add_audit_log(
        session,
        user_id=user_id,
        actor_type="system",
        actor_id="review.weekly_summary.snapshot",
        action="review.weekly_summary.snapshot_refreshed",
        target_type="review_weekly_snapshot_v2",
        target_id=snapshot_id,
        metadata={"week": week},
        request_id=None,
    )


def _commit_isolated_audit_log(session: Session, **payload: Any) -> None:
    with SqlAlchemySession(bind=session.get_bind()) as isolated_session:
        add_audit_log(isolated_session, **payload)
        isolated_session.commit()
