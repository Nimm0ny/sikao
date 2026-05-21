from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import IdempotencyKeyV2, PlanEventV2, PlanV2, PracticeSessionV2, RecommendationFeedbackV2, RecommendationV2, UserV2
from sikao_api.db.schemas_v2 import (
    RecommendationAcceptRequestV2,
    RecommendationAcceptResponseV2,
    RecommendationListResponseV2,
    RecommendationReadV2,
    RecommendationRejectRequestV2,
)
from sikao_api.modules.plans.application.helpers import now_utc
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError


class RecommendationServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_today(self, *, user: UserV2) -> RecommendationListResponseV2:
        rows = list(
            self.session.scalars(
                select(RecommendationV2)
                .where(
                    RecommendationV2.user_id == user.id,
                    RecommendationV2.status == "pending",
                    RecommendationV2.expires_at > now_utc(),
                )
                .order_by(RecommendationV2.generated_at.desc(), RecommendationV2.id.desc())
                .limit(3)
            )
        )
        return RecommendationListResponseV2(items=[RecommendationReadV2.model_validate(row) for row in rows], total=len(rows))

    def build_request_hash(self, *, payload: dict[str, object]) -> str:
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def get_refresh_replay(
        self,
        *,
        user: UserV2,
        idempotency_key: str,
        request_hash: str,
    ) -> RecommendationListResponseV2 | None:
        row = self.session.scalar(
            select(IdempotencyKeyV2).where(
                IdempotencyKeyV2.key == idempotency_key,
                IdempotencyKeyV2.user_id == user.id,
                IdempotencyKeyV2.endpoint == "POST /api/v2/recommendations/refresh",
            )
        )
        if row is None:
            return None
        if row.request_hash != request_hash:
            raise ConflictError("idempotency key was reused with a different payload", code="idempotency_key_reused")
        return RecommendationListResponseV2.model_validate(row.response_body)

    def refresh(
        self,
        *,
        user: UserV2,
        idempotency_key: str,
        request_hash: str,
        request_id: str | None,
        ip: str | None,
    ) -> RecommendationListResponseV2:
        self._validate_idempotency_key(idempotency_key)
        pending_rows = list(
            self.session.scalars(
                select(RecommendationV2).where(
                    RecommendationV2.user_id == user.id,
                    RecommendationV2.status == "pending",
                )
            )
        )
        now = now_utc()
        for row in pending_rows:
            row.status = "expired"
            self.session.add(row)

        items: list[RecommendationV2] = []
        latest_in_progress = self.session.scalar(
            select(PracticeSessionV2)
            .where(
                PracticeSessionV2.user_id == user.id,
                PracticeSessionV2.status.in_(("draft", "in_progress")),
            )
            .order_by(PracticeSessionV2.started_at.desc(), PracticeSessionV2.id.desc())
        )
        if latest_in_progress is not None:
            items.append(
                RecommendationV2(
                    user_id=user.id,
                    title="Continue your active practice",
                    reason="You already have an unfinished practice session.",
                    estimated_minutes=25,
                    cta="Continue",
                    action_type="continue",
                    payload={
                        "session_template": {
                            "track": latest_in_progress.track,
                            "entry_kind": latest_in_progress.entry_kind,
                        }
                    },
                    expires_at=now + timedelta(hours=4),
                    source_signals={"in_progress_session_id": latest_in_progress.id},
                )
            )

        latest_submitted = self.session.scalar(
            select(PracticeSessionV2)
            .where(
                PracticeSessionV2.user_id == user.id,
                PracticeSessionV2.status == "submitted",
            )
            .order_by(PracticeSessionV2.submitted_at.desc(), PracticeSessionV2.id.desc())
        )
        if latest_submitted is not None:
            items.append(
                RecommendationV2(
                    user_id=user.id,
                    title="Add a focused review block",
                    reason="Recent completed practice suggests it is time to review weak spots.",
                    estimated_minutes=20,
                    cta="Review",
                    action_type="review",
                    payload={
                        "session_template": {
                            "track": latest_submitted.track,
                            "entry_kind": "review",
                            "subject": latest_submitted.payload_json.get("subject")
                            if isinstance(latest_submitted.payload_json, dict)
                            else None,
                        }
                    },
                    expires_at=now + timedelta(hours=4),
                    source_signals={"latest_submitted_session_id": latest_submitted.id},
                )
            )

        items.append(
            RecommendationV2(
                user_id=user.id,
                title="Reserve a short recovery block",
                reason="Keeping some slack in the day helps sustain execution quality.",
                estimated_minutes=15,
                cta="Block time",
                action_type="rest",
                payload={"rest_minutes": 15},
                expires_at=now + timedelta(hours=4),
                source_signals={"strategy": "baseline_rest"},
            )
        )
        for row in items[:3]:
            self.session.add(row)
        self.session.flush()
        response = RecommendationListResponseV2(
            items=[RecommendationReadV2.model_validate(row) for row in items[:3]],
            total=min(len(items), 3),
        )
        self.session.add(
            IdempotencyKeyV2(
                key=idempotency_key,
                user_id=user.id,
                endpoint="POST /api/v2/recommendations/refresh",
                request_hash=request_hash,
                response_status=200,
                response_body=response.model_dump(mode="json"),
                created_at=now,
                expires_at=now + timedelta(hours=24),
            )
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="recommendation.refresh",
            target_type="recommendation_v2",
            target_id=None,
            after={"count": response.total},
            metadata={"idempotency_key": idempotency_key},
            request_id=request_id,
            ip=ip,
        )
        return response

    def accept(
        self,
        *,
        user: UserV2,
        recommendation_id: int,
        payload: RecommendationAcceptRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> RecommendationAcceptResponseV2:
        recommendation = self._get_recommendation_row(user_id=user.id, recommendation_id=recommendation_id)
        self._ensure_pending(recommendation)
        if payload.action == "session":
            session_row = self._create_session_from_recommendation(user=user, recommendation=recommendation)
            recommendation.status = "accepted_session"
            recommendation.accepted_at = now_utc()
            self.session.add_all([recommendation, session_row])
            add_audit_log(
                self.session,
                user_id=user.id,
                actor_type="user",
                actor_id=str(user.id),
                action="recommendation.accept_session",
                target_type="recommendation_v2",
                target_id=recommendation.id,
                after={"session_id": session_row.id},
                request_id=request_id,
                ip=ip,
            )
            return RecommendationAcceptResponseV2(
                recommendation_id=recommendation.id,
                status=recommendation.status,
                session_id=session_row.id,
                redirect_url=f"/practice/sessions/{session_row.id}",
            )
        event_row = self._create_event_from_recommendation(
            user=user,
            recommendation=recommendation,
            target_date=payload.target_date,
        )
        recommendation.status = "accepted_plan"
        recommendation.accepted_at = now_utc()
        self.session.add_all([recommendation, event_row])
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="recommendation.accept_plan",
            target_type="recommendation_v2",
            target_id=recommendation.id,
            after={"event_id": event_row.id},
            request_id=request_id,
            ip=ip,
        )
        return RecommendationAcceptResponseV2(
            recommendation_id=recommendation.id,
            status=recommendation.status,
            event_id=event_row.id,
        )

    def reject(
        self,
        *,
        user: UserV2,
        recommendation_id: int,
        payload: RecommendationRejectRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> None:
        recommendation = self._get_recommendation_row(user_id=user.id, recommendation_id=recommendation_id)
        self._ensure_pending(recommendation)
        recommendation.status = "rejected"
        recommendation.rejected_at = now_utc()
        self.session.add(recommendation)
        self.session.add(
            RecommendationFeedbackV2(
                recommendation_id=recommendation.id,
                reason=payload.reason,
                note=payload.note,
            )
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="recommendation.reject",
            target_type="recommendation_v2",
            target_id=recommendation.id,
            after={"reason": payload.reason},
            request_id=request_id,
            ip=ip,
        )

    def history(self, *, user: UserV2, from_date: date | None, to_date: date | None) -> RecommendationListResponseV2:
        query = select(RecommendationV2).where(
            RecommendationV2.user_id == user.id,
            RecommendationV2.status != "pending",
        )
        if from_date is not None:
            query = query.where(RecommendationV2.generated_at >= self._local_day_start(from_date))
        if to_date is not None:
            query = query.where(RecommendationV2.generated_at < self._local_day_start(to_date + timedelta(days=1)))
        rows = list(self.session.scalars(query.order_by(RecommendationV2.generated_at.desc(), RecommendationV2.id.desc())))
        return RecommendationListResponseV2(items=[RecommendationReadV2.model_validate(row) for row in rows], total=len(rows))

    def _create_session_from_recommendation(self, *, user: UserV2, recommendation: RecommendationV2) -> PracticeSessionV2:
        if recommendation.action_type == "rest":
            raise ValidationError("rest recommendation cannot open a practice session", code="invalid_recommendation_accept")
        template = recommendation.payload.get("session_template", {})
        track = template.get("track") or ("essay" if template.get("category") == "essay" else "xingce")
        entry_kind = template.get("entry_kind") or recommendation.action_type
        session_row = PracticeSessionV2(
            user_id=user.id,
            track=track,
            entry_kind=entry_kind,
            status="draft",
            payload_json=recommendation.payload,
            linked_recommendation_id=recommendation.id,
        )
        self.session.add(session_row)
        self.session.flush()
        return session_row

    def _create_event_from_recommendation(
        self,
        *,
        user: UserV2,
        recommendation: RecommendationV2,
        target_date: date | None,
    ) -> PlanEventV2:
        if target_date is None:
            raise ValidationError("target_date is required for plan acceptance", code="recommendation_target_date_required")
        plan = self.session.scalar(
            select(PlanV2).where(
                PlanV2.user_id == user.id,
                PlanV2.deleted_at.is_(None),
                PlanV2.status == "active",
            )
        )
        if plan is None:
            raise ConflictError("active plan required before adding recommendation to plan", code="active_plan_required")
        zone = ZoneInfo("Asia/Shanghai")
        local_start = datetime.combine(target_date, time(hour=18, minute=0), tzinfo=zone)
        start_at = local_start.astimezone(UTC).replace(tzinfo=None)
        end_at = start_at + timedelta(minutes=recommendation.estimated_minutes)
        category = "break" if recommendation.action_type == "rest" else "custom"
        template = recommendation.payload.get("session_template", {})
        if isinstance(template, dict) and "category" in template:
            category = str(template["category"])
        event = PlanEventV2(
            plan_id=plan.id,
            user_id=user.id,
            title=recommendation.title,
            category=category,
            notes=recommendation.reason,
            start_at=start_at,
            end_at=end_at,
            timezone="Asia/Shanghai",
            status="planned",
            source="ai_generated",
            recurring_exception_dates=[],
            target_id=None,
            change_log=[],
        )
        self.session.add(event)
        self.session.flush()
        return event

    def _validate_idempotency_key(self, key: str) -> None:
        if not key:
            raise ValidationError("Idempotency-Key is required", code="idempotency_key_required")
        try:
            uuid.UUID(key)
        except ValueError as exc:
            raise ValidationError("Idempotency-Key must be a UUID", code="idempotency_key_invalid") from exc

    def _ensure_pending(self, recommendation: RecommendationV2) -> None:
        if recommendation.status != "pending":
            raise ValidationError("recommendation is not pending", code="recommendation_not_pending")
        if recommendation.expires_at <= now_utc():
            raise ValidationError("recommendation has expired", code="recommendation_expired")

    def _get_recommendation_row(self, *, user_id: int, recommendation_id: int) -> RecommendationV2:
        recommendation = self.session.scalar(
            select(RecommendationV2).where(
                RecommendationV2.id == recommendation_id,
                RecommendationV2.user_id == user_id,
            )
        )
        if recommendation is None:
            raise NotFoundError("recommendation not found", code="recommendation_not_found")
        return recommendation

    def _local_day_start(self, value: date) -> datetime:
        zone = ZoneInfo("Asia/Shanghai")
        return datetime.combine(value, time.min, tzinfo=zone).astimezone(UTC).replace(tzinfo=None)
