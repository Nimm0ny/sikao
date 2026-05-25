from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import IdempotencyKeyV2, PlanEventV2, PlanV2, PracticeSessionV2, RecommendationFeedbackV2, RecommendationV2, UserV2
from sikao_api.db.schemas_v2 import (
    PracticeSessionCreateRequestV2,
    RecommendationAcceptRequestV2,
    RecommendationAcceptResponseV2,
    RecommendationListResponseV2,
    RecommendationReadV2,
    RecommendationRejectRequestV2,
)
from sikao_api.modules.llm.application.cache import invalidate_user_prefix_all
from sikao_api.modules.llm.application.idempotency import claim_idempotency_key, release_idempotency_claim, store_replay
from sikao_api.modules.llm.application.recommender import RecommendationContext
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.plans.application.helpers import now_utc
from sikao_api.modules.session.application.service import SessionServiceV2
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

    async def refresh(
        self,
        *,
        user: UserV2,
        settings: Settings,
        idempotency_key: str,
        request_hash: str,
        request_id: str | None,
        ip: str | None,
    ) -> RecommendationListResponseV2:
        self._validate_idempotency_key(idempotency_key)
        endpoint = "POST /api/v2/recommendations/refresh"
        replay = claim_idempotency_key(
            self.session,
            user_id=user.id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            return RecommendationListResponseV2.model_validate(replay)

        should_release_claim = True
        try:
            pending_rows = list(
                self.session.scalars(
                    select(RecommendationV2).where(
                        RecommendationV2.user_id == user.id,
                        RecommendationV2.status == "pending",
                    )
                )
            )
            preserved_rows = [row for row in pending_rows if row.action_type == "review_session"]
            expired_rows = [row for row in pending_rows if row.action_type != "review_session"]
            for row in expired_rows:
                row.status = "expired"
                self.session.add(row)
            replaced_ids = {row.id for row in expired_rows}

            latest_in_progress = self.session.scalar(
                select(PracticeSessionV2)
                .where(
                    PracticeSessionV2.user_id == user.id,
                    PracticeSessionV2.status.in_(("draft", "in_progress")),
                )
                .order_by(PracticeSessionV2.started_at.desc(), PracticeSessionV2.id.desc())
            )
            latest_submitted = self.session.scalar(
                select(PracticeSessionV2)
                .where(
                    PracticeSessionV2.user_id == user.id,
                    PracticeSessionV2.status == "submitted",
                )
                .order_by(PracticeSessionV2.submitted_at.desc(), PracticeSessionV2.id.desc())
            )
            llm_rows, llm_call = await HomeLlmService(self.session, settings).recommend_today(
                user=user,
                context=RecommendationContext(
                    payload={
                        "in_progress_session": (
                            {
                                "id": latest_in_progress.id,
                                "track": latest_in_progress.track,
                                "entry_kind": latest_in_progress.entry_kind,
                            }
                            if latest_in_progress is not None
                            else None,
                        ),
                        "latest_submitted_session": (
                            {
                                "id": latest_submitted.id,
                                "track": latest_submitted.track,
                                "entry_kind": latest_submitted.entry_kind,
                                "subject": latest_submitted.payload_json.get("subject")
                                if isinstance(latest_submitted.payload_json, dict)
                                else None,
                            }
                            if latest_submitted is not None
                            else None
                        ),
                        "pending_rows_replaced": len(pending_rows),
                    }
                ),
            )
            items = self._materialize_recommendations(
                user=user,
                llm_rows=llm_rows,
                latest_in_progress=latest_in_progress,
                latest_submitted=latest_submitted,
                llm_call_id=llm_call.id,
                excluded_recent_ids=replaced_ids,
                max_items=max(0, 3 - len(preserved_rows)),
            )
            for row in items:
                self.session.add(row)
            self.session.flush()
            active_items = sorted(
                [*preserved_rows, *items],
                key=lambda row: (row.generated_at, row.id),
                reverse=True,
            )[:3]
            response = RecommendationListResponseV2(
                items=[RecommendationReadV2.model_validate(row) for row in active_items],
                total=len(active_items),
            )
            store_replay(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_body=response.model_dump(mode="json"),
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
            should_release_claim = False
            return response
        except Exception:
            self.session.rollback()
            if should_release_claim:
                release_idempotency_claim(
                    self.session,
                    user_id=user.id,
                    endpoint=endpoint,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                )
            raise

    def _materialize_recommendations(
        self,
        *,
        user: UserV2,
        llm_rows: list[dict[str, object]],
        latest_in_progress: PracticeSessionV2 | None,
        latest_submitted: PracticeSessionV2 | None,
        llm_call_id: int,
        excluded_recent_ids: set[int],
        max_items: int = 3,
    ) -> list[RecommendationV2]:
        items: list[RecommendationV2] = []
        if max_items <= 0:
            return items
        now = now_utc()
        for row in llm_rows:
            action_type = str(row["action_type"])
            if action_type == "continue" and latest_in_progress is None:
                continue
            if self._was_recently_served(
                user_id=user.id,
                title=str(row["title"]),
                action_type=action_type,
                now=now,
                excluded_ids=excluded_recent_ids,
            ):
                continue

            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            source_signals: dict[str, object] = {}
            estimated_minutes_value = row["estimated_minutes"]
            estimated_minutes = (
                estimated_minutes_value
                if isinstance(estimated_minutes_value, int)
                else int(str(estimated_minutes_value))
            )
            if action_type == "continue" and latest_in_progress is not None:
                payload = {
                    "session_template": {
                        "track": latest_in_progress.track,
                        "entry_kind": latest_in_progress.entry_kind,
                    }
                }
                source_signals["in_progress_session_id"] = latest_in_progress.id
            elif action_type == "review" and latest_submitted is not None:
                payload = {
                    "session_template": {
                        "track": latest_submitted.track,
                        "entry_kind": "review",
                        "subject": latest_submitted.payload_json.get("subject")
                        if isinstance(latest_submitted.payload_json, dict)
                        else None,
                    }
                }
                source_signals["latest_submitted_session_id"] = latest_submitted.id
            elif action_type == "rest":
                payload = payload or {"rest_minutes": estimated_minutes}
                source_signals["strategy"] = "baseline_rest"

            items.append(
                RecommendationV2(
                    user_id=user.id,
                    title=str(row["title"]),
                    reason=str(row["reason"]),
                    estimated_minutes=estimated_minutes,
                    cta=str(row["cta"]),
                    action_type=action_type,
                    payload=payload if isinstance(payload, dict) else {},
                    expires_at=now + timedelta(hours=4),
                    source_signals=source_signals,
                    llm_call_id=llm_call_id,
                )
            )
            if len(items) == max_items:
                break

        if not items:
            items.append(
                RecommendationV2(
                    user_id=user.id,
                    title="Reserve a short recovery block",
                    reason="No higher-confidence recommendation was produced, so keep one light recovery block.",
                    estimated_minutes=15,
                    cta="Rest",
                    action_type="rest",
                    payload={"rest_minutes": 15},
                    expires_at=now + timedelta(hours=4),
                    source_signals={"strategy": "fallback_rest"},
                    llm_call_id=llm_call_id,
                )
            )
        return items

    def _was_recently_served(
        self,
        *,
        user_id: int,
        title: str,
        action_type: str,
        now: datetime,
        excluded_ids: set[int],
    ) -> bool:
        query = select(RecommendationV2.id).where(
                RecommendationV2.user_id == user_id,
                RecommendationV2.title == title,
                RecommendationV2.action_type == action_type,
                RecommendationV2.generated_at >= now - timedelta(hours=24),
            )
        if excluded_ids:
            query = query.where(RecommendationV2.id.not_in(excluded_ids))
        recent = self.session.scalar(query)
        return recent is not None

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
            session_row = self._create_session_from_recommendation(
                user=user,
                recommendation=recommendation,
            )
            recommendation.status = "accepted_session"
            recommendation.accepted_at = now_utc()
            invalidate_user_prefix_all(user_prefix=f"recommend_today:{user.id}:")
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
            request_id=request_id,
            ip=ip,
        )
        recommendation.status = "accepted_plan"
        recommendation.accepted_at = now_utc()
        invalidate_user_prefix_all(user_prefix=f"recommend_today:{user.id}:")
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
        invalidate_user_prefix_all(user_prefix=f"recommend_today:{user.id}:")
        self.session.add(recommendation)
        self.session.add(
            RecommendationFeedbackV2(
                recommendation_id=recommendation.id,
                analysis_id=None,
                feedback_type="recommendation_reject",
                reason=payload.reason,
                rating=None,
                note=payload.note,
                metadata_json={},
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
        if recommendation.action_type == "continue":
            existing_session_id = recommendation.source_signals.get("in_progress_session_id")
            if not isinstance(existing_session_id, int):
                raise ConflictError("continue recommendation source session is missing", code="recommendation_source_session_missing")
            existing_session = self.session.scalar(
                select(PracticeSessionV2).where(
                    PracticeSessionV2.id == existing_session_id,
                    PracticeSessionV2.user_id == user.id,
                    PracticeSessionV2.status.in_(("draft", "in_progress")),
                )
            )
            if existing_session is None:
                raise ConflictError("continue recommendation source session is unavailable", code="recommendation_source_session_unavailable")
            existing_session.linked_recommendation_id = recommendation.id
            self.session.add(existing_session)
            return existing_session
        if recommendation.action_type == "review_session":
            template = recommendation.payload.get("session_template", {})
            config = recommendation.payload.get("config", {})
            if not isinstance(template, dict) or not isinstance(config, dict):
                raise ConflictError(
                    "review_session recommendation payload is invalid",
                    code="recommendation_payload_invalid",
                )
            track_value = str(template.get("track") or "xingce")
            practice_payload = PracticeSessionCreateRequestV2(
                track="essay" if track_value == "essay" else "xingce",
                entry_kind=str(template.get("entry_kind") or "review"),
                mode=str(template.get("mode") or "wrong_redo"),
                config=config,
                linked_recommendation_id=recommendation.id,
            )
            return SessionServiceV2(self.session).create_session(user=user, payload=practice_payload)
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
        request_id: str | None,
        ip: str | None,
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
        event.change_log = [
            {
                "at": now_utc().replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
                "actor": "ai",
                "type": "create",
                "before": None,
                "after": {
                    "title": event.title,
                    "start_at": event.start_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
                    "end_at": event.end_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
                },
                "reason": "recommendation_accept_plan",
            }
        ]
        self.session.add(event)
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan_event.create_from_recommendation",
            target_type="plan_event_v2",
            target_id=event.id,
            after={
                "title": event.title,
                "start_at": event.start_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
                "end_at": event.end_at.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z"),
            },
            metadata={"recommendation_id": recommendation.id},
            request_id=request_id,
            ip=ip,
        )
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
