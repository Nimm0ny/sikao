from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionV2, RecommendationV2, ReviewItemV2, UserV2
from sikao_api.modules.review.application.queue_items import canonical_review_status, utc_now
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError

_ACTIVE_REVIEW_STATUSES = {"pending", "in_progress", "probationary"}


def create_review_recommendation(
    session: Session,
    *,
    user: UserV2,
    item_id: int,
    request_id: str | None,
    ip: str | None,
) -> RecommendationV2:
    row = session.execute(
        select(ReviewItemV2, QuestionV2)
        .join(QuestionV2, QuestionV2.id == ReviewItemV2.question_id)
        .where(
            ReviewItemV2.id == item_id,
            ReviewItemV2.user_id == user.id,
        )
        .with_for_update()
    ).one_or_none()
    if row is None:
        raise NotFoundError("review item not found", code="review_item_not_found")

    item, question = row
    existing = _find_existing_pending_recommendation(session, user_id=user.id, item_id=item_id)
    if existing is not None:
        return existing

    status = canonical_review_status(item.status)
    if status not in _ACTIVE_REVIEW_STATUSES:
        raise ConflictError(
            "review item cannot be added to plan in current status",
            code="review_item_status_invalid",
        )

    recommendation = RecommendationV2(
        user_id=user.id,
        title=f"Redo review item: {item.title}",
        reason="Add this review item to your plan and resume it as a focused wrong-redo session.",
        estimated_minutes=20,
        cta="Start redo",
        action_type="review_session",
        payload={
            "session_template": {
                "track": question.subject_kind,
                "entry_kind": "review",
                "mode": "wrong_redo",
            },
            "mode": "wrong_redo",
            "config": {
                "count": 1,
                "review_item_ids": [item.id],
                "shuffle_options": True,
            },
        },
        expires_at=utc_now() + timedelta(hours=4),
        source_signals={
            "linked_review_id": item.id,
            "question_id": question.id,
            "source_kind": item.source_kind,
        },
    )
    session.add(recommendation)
    session.flush()
    add_audit_log(
        session,
        user_id=user.id,
        actor_type="user",
        actor_id=str(user.id),
        action="review.add_to_plan",
        target_type="recommendation_v2",
        target_id=recommendation.id,
        after={
            "action_type": recommendation.action_type,
            "linked_review_id": item.id,
        },
        request_id=request_id,
        ip=ip,
    )
    return recommendation


def _find_existing_pending_recommendation(
    session: Session,
    *,
    user_id: int,
    item_id: int,
) -> RecommendationV2 | None:
    rows = list(
        session.scalars(
            select(RecommendationV2)
            .where(
                RecommendationV2.user_id == user_id,
                RecommendationV2.status == "pending",
            )
            .order_by(RecommendationV2.generated_at.desc(), RecommendationV2.id.desc())
        )
    )
    now = utc_now()
    for row in rows:
        if row.expires_at <= now:
            continue
        if row.action_type != "review_session":
            continue
        linked_review_id = row.source_signals.get("linked_review_id")
        if linked_review_id == item_id:
            return row
    return None
