from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import (
    AuditLogV2,
    PlanAdjustmentV2,
    PlanEventV2,
    PlanV2,
    PracticeSessionV2,
    ProfileInfoV2,
    RecommendationV2,
    UserV2,
)
from sikao_api.db.session import DatabaseManager
from sikao_api.modules.llm.application.plan_adjustor import PlanAdjustmentContext
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.llm.application.window_queries import load_window_events
from sikao_api.modules.plans.application.event_service import EventServiceSupport
from sikao_api.modules.plans.domain.rrule_subset import build_occurrence_ref, expand_occurrences
from sikao_api.modules.plans.application.helpers import now_utc, serialize_event, serialize_plan, today_cn
from sikao_api.modules.progress.application.snapshot_writer import (
    refresh_daily_progress_snapshot,
    refresh_weekly_weakness_snapshot,
)
from sikao_api.modules.recommendations.application.service import RecommendationServiceV2
from sikao_api.modules.mock_exam.application.auto_submitter import auto_submit_expired_mock_exams
from sikao_api.modules.session.application.submit_hooks import run_progress_submit_hooks
from sikao_api.modules.session_lifecycle.application.cleanup import (
    cleanup_stale_sessions,
    expire_daily_sessions,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log


@dataclass(frozen=True)
class SkippedEventHookPayload:
    user_id: int
    plan_id: int
    event_id: int
    occurrence_ref: str | None = None


class HomeRuntimeOrchestrator:
    def __init__(self, db: DatabaseManager, settings: Settings) -> None:
        self._db = db
        self._settings = settings

    async def run_daily_progress_snapshot(self) -> int:
        return await asyncio.to_thread(self._run_daily_progress_snapshot_sync)

    async def run_weekly_weakness_snapshot(self) -> int:
        return await asyncio.to_thread(self._run_weekly_weakness_snapshot_sync)

    async def run_event_status_tick(self) -> list[SkippedEventHookPayload]:
        return await asyncio.to_thread(self._run_event_status_tick_sync)

    async def run_cleanup_expired(self) -> dict[str, int]:
        return await asyncio.to_thread(self._run_cleanup_expired_sync)

    async def run_cleanup_soft_deleted_events(self) -> int:
        return await asyncio.to_thread(self._run_cleanup_soft_deleted_events_sync)

    async def run_daily_plan_adjust(self) -> int:
        session = self._db.session_factory()
        try:
            plan_ids = list(
                session.scalars(
                    select(PlanV2.id).where(
                        PlanV2.deleted_at.is_(None),
                        PlanV2.status == "active",
                    )
                )
            )
        finally:
            session.close()

        created = 0
        for plan_id in plan_ids:
            if await self._propose_adjustment_for_plan(
                plan_id=plan_id,
                source="cron_daily",
                request_id=None,
            ):
                created += 1
        return created

    async def run_login_adjustment_check(self, *, user_id: int, request_id: str | None) -> bool:
        session = self._db.session_factory()
        try:
            plan_id = session.scalar(
                select(PlanV2.id).where(
                    PlanV2.user_id == user_id,
                    PlanV2.deleted_at.is_(None),
                    PlanV2.status == "active",
                )
            )
        finally:
            session.close()
        if plan_id is None:
            return False
        return await self._propose_adjustment_for_plan(
            plan_id=plan_id,
            source="login_hook",
            request_id=request_id,
        )

    async def run_skipped_adjustment_check(
        self,
        *,
        user_id: int,
        plan_id: int,
        event_id: int,
        occurrence_ref: str | None,
        request_id: str | None,
    ) -> bool:
        return await self._propose_adjustment_for_plan(
            plan_id=plan_id,
            source="event_skipped_hook",
            request_id=request_id,
            trigger_event_id=event_id,
            trigger_occurrence_ref=occurrence_ref,
            expected_user_id=user_id,
        )

    async def run_submit_recommender_refresh(
        self,
        *,
        user_id: int,
        session_id: int,
        request_id: str | None,
    ) -> bool:
        session = self._db.session_factory()
        try:
            user = session.get(UserV2, user_id)
            if user is None or not user.is_active:
                return False

            latest_generated_at = session.scalar(
                select(func.max(RecommendationV2.generated_at)).where(
                    RecommendationV2.user_id == user_id,
                )
            )
            if latest_generated_at is not None and latest_generated_at >= now_utc() - timedelta(minutes=5):
                add_audit_log(
                    session,
                    user_id=user_id,
                    actor_type="system",
                    actor_id="home.submit_recommender_refresh",
                    action="recommendation.refresh_debounced",
                    target_type="practice_session_v2",
                    target_id=session_id,
                    metadata={"trigger": "submit_hook"},
                    request_id=request_id,
                    ip=None,
                )
                session.commit()
                return False

            service = RecommendationServiceV2(session)
            payload = {"trigger": "submit_hook", "session_id": session_id}
            request_hash = service.build_request_hash(payload=payload)
            await service.refresh(
                user=user,
                settings=self._settings,
                idempotency_key=str(uuid4()),
                request_hash=request_hash,
                request_id=request_id,
                ip=None,
            )
            session.commit()
            return True
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    async def run_submit_progress_hooks(self, *, user_id: int, session_id: int | None) -> None:
        await asyncio.to_thread(self._run_submit_progress_hooks_sync, user_id, session_id)

    async def run_session_lifecycle_cleanup(self) -> dict[str, int]:
        return await asyncio.to_thread(self._run_session_lifecycle_cleanup_sync)

    async def run_daily_session_expire(self) -> int:
        return await asyncio.to_thread(self._run_daily_session_expire_sync)

    async def run_mock_exam_auto_submit(self) -> list[tuple[int, int]]:
        return await asyncio.to_thread(self._run_mock_exam_auto_submit_sync)

    def _run_submit_progress_hooks_sync(self, user_id: int, session_id: int | None) -> None:
        session = self._db.session_factory()
        try:
            run_progress_submit_hooks(session, user_id=user_id, session_id=session_id)
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_session_lifecycle_cleanup_sync(self) -> dict[str, int]:
        session = self._db.session_factory()
        try:
            counts = cleanup_stale_sessions(session)
            session.commit()
            return counts
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_daily_session_expire_sync(self) -> int:
        session = self._db.session_factory()
        try:
            count = expire_daily_sessions(session)
            session.commit()
            return count
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_mock_exam_auto_submit_sync(self) -> list[tuple[int, int]]:
        session = self._db.session_factory()
        try:
            submitted = auto_submit_expired_mock_exams(session)
            session.commit()
            return submitted
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_daily_progress_snapshot_sync(self) -> int:
        session = self._db.session_factory()
        try:
            processed = 0
            target_date = today_cn()
            for user_id in self._list_active_user_ids(session):
                refresh_daily_progress_snapshot(session, user_id=user_id, snapshot_date=target_date)
                processed += 1
            session.commit()
            return processed
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_weekly_weakness_snapshot_sync(self) -> int:
        session = self._db.session_factory()
        try:
            processed = 0
            anchor_date = today_cn()
            for user_id in self._list_active_user_ids(session):
                refresh_weekly_weakness_snapshot(session, user_id=user_id, anchor_date=anchor_date)
                processed += 1
            session.commit()
            return processed
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_event_status_tick_sync(self) -> list[SkippedEventHookPayload]:
        session = self._db.session_factory()
        try:
            event_support = EventServiceSupport(session)
            skipped: list[SkippedEventHookPayload] = []
            existing_occurrence_transitions = self._load_occurrence_transition_keys(session)
            rows = list(
                session.scalars(
                    select(PlanEventV2).where(
                        PlanEventV2.deleted_at.is_(None),
                        PlanEventV2.recurring_rule.is_(None),
                    )
                )
            )
            for row in rows:
                linked_sessions = event_support._list_linked_sessions(parent_id=row.id, occurrence_ref=None)
                linked_session_id, resolved_status = event_support._resolve_runtime_status(
                    stored_status=row.status,
                    event_start=row.start_at,
                    event_end=row.end_at,
                    linked_sessions=linked_sessions,
                )
                before = serialize_event(row)
                changed = False
                if row.linked_session_id != linked_session_id:
                    row.linked_session_id = linked_session_id
                    changed = True
                if row.status != resolved_status:
                    row.status = resolved_status
                    changed = True
                if not changed:
                    continue
                after = serialize_event(row)
                add_audit_log(
                    session,
                    user_id=row.user_id,
                    actor_type="cron",
                    actor_id="home.event_status.tick",
                    action="event.status_auto_transition",
                    target_type="plan_event_v2",
                    target_id=row.id,
                    before=before,
                    after=after,
                    metadata={"linked_session_id": linked_session_id},
                    request_id=None,
                    ip=None,
                )
                session.add(row)
                if before["status"] != "skipped" and resolved_status == "skipped":
                    skipped.append(
                        SkippedEventHookPayload(
                            user_id=row.user_id,
                            plan_id=row.plan_id,
                            event_id=row.id,
                        )
                    )
            recurring_rows = list(
                session.scalars(
                    select(PlanEventV2).where(
                        PlanEventV2.deleted_at.is_(None),
                        PlanEventV2.recurring_rule.is_not(None),
                    )
                )
            )
            current_time = now_utc()
            range_start = current_time - timedelta(days=7)
            range_end = current_time + timedelta(days=1)
            for row in recurring_rows:
                assert row.recurring_rule is not None
                duration = row.end_at - row.start_at
                for occurrence_start in expand_occurrences(
                    rule=row.recurring_rule,
                    dtstart=row.start_at,
                    range_start=range_start,
                    range_end=range_end,
                ):
                    occurrence_ref = build_occurrence_ref(
                        parent_id=row.id,
                        occurrence_start=occurrence_start,
                        timezone=row.timezone,
                    )
                    occurrence_day = occurrence_ref.split(":", 1)[1]
                    if occurrence_day in row.recurring_exception_dates:
                        continue
                    linked_sessions = event_support._list_linked_sessions(
                        parent_id=row.id,
                        occurrence_ref=occurrence_ref,
                    )
                    linked_session_id, resolved_status = event_support._resolve_runtime_status(
                        stored_status="planned",
                        event_start=occurrence_start,
                        event_end=occurrence_start + duration,
                        linked_sessions=linked_sessions,
                    )
                    if resolved_status not in {"in_progress", "done", "skipped"}:
                        continue
                    transition_key = (row.id, occurrence_ref, resolved_status)
                    if transition_key in existing_occurrence_transitions:
                        continue
                    add_audit_log(
                        session,
                        user_id=row.user_id,
                        actor_type="cron",
                        actor_id="home.event_status.tick",
                        action="event.status_auto_transition",
                        target_type="plan_event_occurrence_v2",
                        target_id=row.id,
                        after={"status": resolved_status, "linked_session_id": linked_session_id},
                        metadata={"occurrence_ref": occurrence_ref},
                        request_id=None,
                        ip=None,
                    )
                    existing_occurrence_transitions.add(transition_key)
                    if resolved_status == "skipped":
                        skipped.append(
                            SkippedEventHookPayload(
                                user_id=row.user_id,
                                plan_id=row.plan_id,
                                event_id=row.id,
                                occurrence_ref=occurrence_ref,
                            )
                        )
            session.commit()
            return skipped
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_cleanup_expired_sync(self) -> dict[str, int]:
        session = self._db.session_factory()
        try:
            counts = {"adjustments": 0, "recommendations": 0}
            current_time = now_utc()
            adjustments = list(
                session.scalars(
                    select(PlanAdjustmentV2).where(
                        PlanAdjustmentV2.status == "pending",
                        PlanAdjustmentV2.expires_at <= current_time,
                    )
                )
            )
            for row in adjustments:
                row.status = "expired"
                row.decided_at = current_time
                session.add(row)
                add_audit_log(
                    session,
                    user_id=row.user_id,
                    actor_type="cron",
                    actor_id="home.cleanup.expired",
                    action="plan_adjustment.expired",
                    target_type="plan_adjustment_v2",
                    target_id=row.id,
                    after={"status": "expired"},
                    request_id=None,
                    ip=None,
                )
                counts["adjustments"] += 1

            recommendations: list[RecommendationV2] = list(
                session.scalars(
                    select(RecommendationV2).where(
                        RecommendationV2.status == "pending",
                        RecommendationV2.expires_at <= current_time,
                    )
                )
            )
            for recommendation in recommendations:
                recommendation.status = "expired"
                session.add(recommendation)
                add_audit_log(
                    session,
                    user_id=recommendation.user_id,
                    actor_type="cron",
                    actor_id="home.cleanup.expired",
                    action="recommendation.expired",
                    target_type="recommendation_v2",
                    target_id=recommendation.id,
                    after={"status": "expired"},
                    request_id=None,
                    ip=None,
                )
                counts["recommendations"] += 1

            session.commit()
            return counts
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _run_cleanup_soft_deleted_events_sync(self) -> int:
        session = self._db.session_factory()
        try:
            threshold = now_utc() - timedelta(days=30)
            rows = list(
                session.scalars(
                    select(PlanEventV2).where(
                        PlanEventV2.deleted_at.is_not(None),
                        PlanEventV2.deleted_at <= threshold,
                    )
                )
            )
            for row in rows:
                add_audit_log(
                    session,
                    user_id=row.user_id,
                    actor_type="cron",
                    actor_id="home.cleanup.soft_deleted_events",
                    action="plan_event.cleanup_delete",
                    target_type="plan_event_v2",
                    target_id=row.id,
                    before=serialize_event(row),
                    request_id=None,
                    ip=None,
                )
                session.delete(row)
            session.commit()
            return len(rows)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    async def _propose_adjustment_for_plan(
        self,
        *,
        plan_id: int,
        source: str,
        request_id: str | None,
        trigger_event_id: int | None = None,
        trigger_occurrence_ref: str | None = None,
        expected_user_id: int | None = None,
    ) -> bool:
        session = self._db.session_factory()
        try:
            plan = session.get(PlanV2, plan_id)
            if plan is None or plan.deleted_at is not None or plan.status != "active":
                return False
            if expected_user_id is not None and plan.user_id != expected_user_id:
                return False
            user = session.get(UserV2, plan.user_id)
            if user is None or not user.is_active:
                return False
            if not self._is_ai_adjust_enabled(session, user_id=user.id):
                return False
            if self._has_pending_adjustment(session, user_id=user.id):
                return False

            context = PlanAdjustmentContext(
                plan_id=plan.id,
                source=source,
                payload=self._build_adjustment_payload(
                    session,
                    plan=plan,
                    trigger_event_id=trigger_event_id,
                    trigger_occurrence_ref=trigger_occurrence_ref,
                    source=source,
                ),
            )
            adjustment = await HomeLlmService(session, self._settings).adjust_plan(
                user=user,
                context=context,
            )
            if adjustment is None:
                session.commit()
                return False

            diff_hash = self._hash_changes(adjustment.changes)
            recent_duplicate = self._find_recent_adjustment_by_hash(
                session,
                user_id=user.id,
                adjustment_id=adjustment.id,
                diff_hash=diff_hash,
            )
            if recent_duplicate is not None:
                session.delete(adjustment)
                action = (
                    "plan_adjustment.suppressed_after_reject"
                    if recent_duplicate.status == "rejected"
                    else "plan_adjustment.deduplicated"
                )
                add_audit_log(
                    session,
                    user_id=user.id,
                    actor_type="system",
                    actor_id="home.plan_adjust",
                    action=action,
                    target_type="plan_adjustment_v2",
                    target_id=recent_duplicate.id,
                    metadata={"diff_hash": diff_hash, "source": source},
                    request_id=request_id,
                    ip=None,
                )
                session.commit()
                return False

            add_audit_log(
                session,
                user_id=user.id,
                actor_type="ai",
                actor_id="home.plan_adjust",
                action="plan_adjustment.proposed",
                target_type="plan_adjustment_v2",
                target_id=adjustment.id,
                after={"changes_count": len(adjustment.changes), "reason": adjustment.reason},
                metadata={"diff_hash": diff_hash, "source": source},
                request_id=request_id,
                ip=None,
            )
            session.commit()
            return True
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _build_adjustment_payload(
        self,
        session: Session,
        *,
        plan: PlanV2,
        trigger_event_id: int | None,
        trigger_occurrence_ref: str | None,
        source: str,
    ) -> dict[str, Any]:
        anchor = today_cn()
        recent_sessions = list(
            session.scalars(
                select(PracticeSessionV2).where(
                    PracticeSessionV2.user_id == plan.user_id,
                )
                .order_by(PracticeSessionV2.started_at.desc(), PracticeSessionV2.id.desc())
                .limit(5)
            )
        )
        pending_adjustments = session.scalar(
            select(func.count(PlanAdjustmentV2.id)).where(
                PlanAdjustmentV2.user_id == plan.user_id,
                PlanAdjustmentV2.status == "pending",
            )
        )
        return {
            "trigger": source,
            "trigger_event_id": trigger_event_id,
            "trigger_occurrence_ref": trigger_occurrence_ref,
            "today": anchor.isoformat(),
            "plan": serialize_plan(plan),
            "future_events": load_window_events(
                session,
                user_id=plan.user_id,
                plan_id=plan.id,
                from_date=anchor,
                to_date=anchor + timedelta(days=14),
                timezone="Asia/Shanghai",
            ),
            "recent_sessions": [
                {
                    "id": row.id,
                    "track": row.track,
                    "entry_kind": row.entry_kind,
                    "status": row.status,
                    "started_at": row.started_at.isoformat(),
                    "submitted_at": row.submitted_at.isoformat() if row.submitted_at else None,
                }
                for row in recent_sessions
            ],
            "pending_adjustments": int(pending_adjustments or 0),
        }

    def _is_ai_adjust_enabled(self, session: Session, *, user_id: int) -> bool:
        profile = session.scalar(
            select(ProfileInfoV2).where(ProfileInfoV2.user_id == user_id)
        )
        if profile is None:
            return True
        return bool(profile.ai_adjust_enabled)

    def _has_pending_adjustment(self, session: Session, *, user_id: int) -> bool:
        pending_id = session.scalar(
            select(PlanAdjustmentV2.id).where(
                PlanAdjustmentV2.user_id == user_id,
                PlanAdjustmentV2.status == "pending",
                PlanAdjustmentV2.expires_at > now_utc(),
            )
        )
        return pending_id is not None

    def _find_recent_adjustment_by_hash(
        self,
        session: Session,
        *,
        user_id: int,
        adjustment_id: int,
        diff_hash: str,
    ) -> PlanAdjustmentV2 | None:
        window_start = now_utc() - timedelta(hours=24)
        rows = list(
            session.scalars(
                select(PlanAdjustmentV2).where(
                    PlanAdjustmentV2.user_id == user_id,
                    PlanAdjustmentV2.id != adjustment_id,
                    PlanAdjustmentV2.proposed_at >= window_start,
                )
            )
        )
        for row in rows:
            if self._hash_changes(row.changes) == diff_hash:
                return row
        return None

    def _list_active_user_ids(self, session: Session) -> list[int]:
        return list(
            session.scalars(
                select(UserV2.id).where(UserV2.is_active.is_(True))
            )
        )

    def _load_occurrence_transition_keys(
        self,
        session: Session,
    ) -> set[tuple[int, str, str]]:
        rows = list(
            session.scalars(
                select(AuditLogV2).where(
                    AuditLogV2.action == "event.status_auto_transition",
                    AuditLogV2.target_type == "plan_event_occurrence_v2",
                )
            )
        )
        keys: set[tuple[int, str, str]] = set()
        for row in rows:
            occurrence_ref = row.metadata_json.get("occurrence_ref")
            status = (row.after or {}).get("status")
            if isinstance(row.target_id, int) and isinstance(occurrence_ref, str) and isinstance(status, str):
                keys.add((row.target_id, occurrence_ref, status))
        return keys

    def _hash_changes(self, changes: list[dict[str, Any]]) -> str:
        payload = json.dumps(changes, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
