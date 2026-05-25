from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import DebtSeverity
from sikao_api.db.models_v2 import ProfileInfoV2, ReviewAttemptV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import (
    ReviewDebtPlanBucketV2,
    ReviewDebtPlanResponseV2,
    ReviewDebtSnapshotResponseV2,
)
from sikao_api.modules.review.application.debt_hard_question import (
    build_hard_cleared_attempt,
    detect_hard_trigger,
    maybe_mark_hard_from_thresholds,
)
from sikao_api.modules.review.application.debt_preferences import (
    ReviewRampupRuntime,
    read_review_debt_preferences,
    read_review_rampup_runtime,
)
from sikao_api.modules.review.application.debt_rampup import (
    advance_rampup,
    complete_rampup,
    current_phase_limit,
    should_trigger_rampup,
    start_rampup,
)
from sikao_api.modules.review.application.debt_redistribution import (
    ReviewDebtSnapshot,
    build_redistribute_plan,
    compute_debt_snapshot,
    fetch_overdue_items,
    redistribute_overdue_items,
)
from sikao_api.modules.review.application.queue_items import ACTIVE_REVIEW_ITEM_STATUSES
from sikao_api.modules.review.application.srs_core import utc_now
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError
from sikao_api.modules.review.application.srs_core import get_today_end
from sikao_api.modules.llm.application.idempotency import (
    build_idempotent_request_hash,
    claim_idempotency_key,
    release_idempotency_claim,
    store_replay,
    validate_idempotency_key,
)

_REVIEW_TIMEZONE = "Asia/Shanghai"


class ReviewDebtService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_snapshot(self, *, user: UserV2) -> ReviewDebtSnapshotResponseV2:
        info = self._get_or_create_info(user.id)
        preferences = read_review_debt_preferences(info)
        runtime = read_review_rampup_runtime(info)
        snapshot = compute_debt_snapshot(
            self.session,
            user_id=user.id,
            user_tz=_REVIEW_TIMEZONE,
            daily_limit=preferences.daily_limit,
        )
        return self._serialize_snapshot(snapshot=snapshot, runtime=runtime, preferences=preferences)

    def get_plan(self, *, user: UserV2) -> ReviewDebtPlanResponseV2:
        buckets, total_count = build_redistribute_plan(
            self.session,
            user_id=user.id,
            user_tz=_REVIEW_TIMEZONE,
        )
        spread_days = len(buckets)
        return ReviewDebtPlanResponseV2(
            buckets=[ReviewDebtPlanBucketV2(date=item[0], count=item[1]) for item in buckets],
            total_count=total_count,
            spread_days=spread_days,
        )

    def trigger_redistribute(
        self,
        *,
        user: UserV2,
        request_id: str | None,
        ip: str | None,
        idempotency_key: str,
    ) -> ReviewDebtSnapshotResponseV2:
        validate_idempotency_key(idempotency_key)
        info = self._get_or_create_info(user.id)
        preferences = read_review_debt_preferences(info)
        runtime = read_review_rampup_runtime(info)
        endpoint = "POST /api/v2/review/debt/redistribute"
        request_hash = build_idempotent_request_hash(payload={})
        replay = claim_idempotency_key(
            self.session,
            user_id=user.id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            return ReviewDebtSnapshotResponseV2.model_validate(replay)
        try:
            if runtime.active:
                raise ConflictError("ramp-up is active", code="review_debt_rampup_active")
            snapshot = compute_debt_snapshot(
                self.session,
                user_id=user.id,
                user_tz=_REVIEW_TIMEZONE,
                daily_limit=preferences.daily_limit,
            )
            if snapshot.debt_severity not in {DebtSeverity.MODERATE, DebtSeverity.HEAVY, DebtSeverity.CRITICAL}:
                raise ValidationError("redistribute requires moderate or higher debt", code="review_debt_redistribute_unavailable")
            items = fetch_overdue_items(self.session, user_id=user.id, user_tz=_REVIEW_TIMEZONE)
            result = redistribute_overdue_items(
                self.session,
                items=items,
                daily_limit=preferences.daily_limit,
                user_tz=_REVIEW_TIMEZONE,
            )
            add_audit_log(
                self.session,
                user_id=user.id,
                actor_type="user",
                actor_id=str(user.id),
                action="review.debt.redistribute",
                target_type="review_queue",
                target_id=None,
                after={"redistributed_count": result.redistributed_count, "spread_days": result.spread_days},
                request_id=request_id,
                ip=ip,
            )
            response = self.get_snapshot(user=user)
            store_replay(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_body=response.model_dump(mode="json"),
            )
            return response
        except Exception:
            release_idempotency_claim(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            raise

    def skip_rampup(
        self,
        *,
        user: UserV2,
        request_id: str | None,
        ip: str | None,
        idempotency_key: str,
    ) -> ReviewDebtSnapshotResponseV2:
        validate_idempotency_key(idempotency_key)
        info = self._get_or_create_info(user.id)
        preferences = read_review_debt_preferences(info)
        runtime = read_review_rampup_runtime(info)
        endpoint = "POST /api/v2/review/debt/skip-rampup"
        request_hash = build_idempotent_request_hash(payload={})
        replay = claim_idempotency_key(
            self.session,
            user_id=user.id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            return ReviewDebtSnapshotResponseV2.model_validate(replay)
        try:
            if not runtime.active:
                raise ConflictError("ramp-up is not active", code="review_debt_rampup_inactive")
            complete_rampup(self.session, user_id=user.id, info=info)
            items = fetch_overdue_items(self.session, user_id=user.id, user_tz=_REVIEW_TIMEZONE)
            result = redistribute_overdue_items(
                self.session,
                items=items,
                daily_limit=preferences.daily_limit,
                user_tz=_REVIEW_TIMEZONE,
            )
            add_audit_log(
                self.session,
                user_id=user.id,
                actor_type="user",
                actor_id=str(user.id),
                action="review.debt.skip_rampup",
                target_type="review_queue",
                target_id=None,
                after={"redistributed_count": result.redistributed_count, "spread_days": result.spread_days},
                request_id=request_id,
                ip=ip,
            )
            response = self.get_snapshot(user=user)
            store_replay(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_body=response.model_dump(mode="json"),
            )
            return response
        except Exception:
            release_idempotency_claim(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            raise

    def run_debt_severity_evaluator(self, *, user_id: int) -> int:
        info = self._get_or_create_info(user_id)
        preferences = read_review_debt_preferences(info)
        runtime = read_review_rampup_runtime(info)
        snapshot = compute_debt_snapshot(
            self.session,
            user_id=user_id,
            user_tz=_REVIEW_TIMEZONE,
            daily_limit=preferences.daily_limit,
        )
        if snapshot.overdue_count <= 0:
            return 0
        days_since_last_attempt = self._days_since_last_attempt(user_id=user_id)
        if (
            preferences.rampup_enabled
            and snapshot.debt_severity == DebtSeverity.CRITICAL
            and not runtime.active
            and should_trigger_rampup(days_since_last_attempt=days_since_last_attempt)
        ):
            start_rampup(
                self.session,
                user_id=user_id,
                info=info,
                user_tz=_REVIEW_TIMEZONE,
                daily_limit=preferences.daily_limit,
            )
            return snapshot.overdue_count
        if runtime.active:
            return 0
        if preferences.redistribute_enabled and snapshot.debt_severity == DebtSeverity.HEAVY:
            items = fetch_overdue_items(self.session, user_id=user_id, user_tz=_REVIEW_TIMEZONE)
            return redistribute_overdue_items(
                self.session,
                items=items,
                daily_limit=preferences.daily_limit,
                user_tz=_REVIEW_TIMEZONE,
            ).redistributed_count
        return 0

    def run_rampup_phase_advancer(self, *, user_id: int) -> int:
        info = self._get_or_create_info(user_id)
        preferences = read_review_debt_preferences(info)
        runtime = read_review_rampup_runtime(info)
        if not runtime.active or runtime.phase is None:
            return 0
        if runtime.last_transition_on == get_today_end(_REVIEW_TIMEZONE).date():
            return 0
        if runtime.phase == runtime.phase.__class__.DAY_5:
            complete_rampup(self.session, user_id=user_id, info=info)
            items = fetch_overdue_items(self.session, user_id=user_id, user_tz=_REVIEW_TIMEZONE)
            return redistribute_overdue_items(
                self.session,
                items=items,
                daily_limit=preferences.daily_limit,
                user_tz=_REVIEW_TIMEZONE,
            ).redistributed_count
        result = advance_rampup(
            self.session,
            user_id=user_id,
            info=info,
            runtime=runtime,
            user_tz=_REVIEW_TIMEZONE,
            daily_limit=preferences.daily_limit,
        )
        return 0 if result is None else result.active_today_count

    def run_hard_question_detector(self, *, user_id: int) -> int:
        rows = list(
            self.session.scalars(
                select(ReviewItemV2).where(
                    ReviewItemV2.user_id == user_id,
                    ReviewItemV2.status.in_((*ACTIVE_REVIEW_ITEM_STATUSES, "graduated")),
                )
            )
        )
        marked = 0
        for row in rows:
            trigger = detect_hard_trigger(self.session, item=row)
            if trigger is None:
                continue
            if maybe_mark_hard_from_thresholds(self.session, item=row, trigger_condition=trigger):
                marked += 1
        return marked

    def manual_clear_hard(self, *, user: UserV2, item_id: int) -> None:
        item = self.session.scalar(
            select(ReviewItemV2).where(ReviewItemV2.id == item_id, ReviewItemV2.user_id == user.id)
        )
        if item is None:
            raise NotFoundError("review item not found", code="review_item_not_found")
        attempt = build_hard_cleared_attempt(
            item,
            cleared_by="user_manual",
            user_tz=_REVIEW_TIMEZONE,
        )
        if attempt is None:
            return
        self.session.add(item)
        record = ReviewAttemptV2(
            review_item_id=item.id,
            outcome=attempt.outcome,
            notes_json=attempt.notes_json,
        )
        self.session.add(record)

    def preview_extra_review_item_ids(self, *, user: UserV2, count: int) -> list[int]:
        if count <= 0:
            return []
        today_end = get_today_end(_REVIEW_TIMEZONE)
        rows = list(
            self.session.scalars(
                select(ReviewItemV2)
                .where(
                    ReviewItemV2.user_id == user.id,
                    ReviewItemV2.status.in_(ACTIVE_REVIEW_ITEM_STATUSES),
                    ReviewItemV2.next_review_at.is_not(None),
                    ReviewItemV2.next_review_at > today_end,
                )
                .order_by(ReviewItemV2.next_review_at.asc(), ReviewItemV2.id.asc())
                .limit(count)
            )
        )
        return [row.id for row in rows]

    def _get_or_create_info(self, user_id: int) -> ProfileInfoV2:
        info = self.session.scalar(select(ProfileInfoV2).where(ProfileInfoV2.user_id == user_id))
        if info is None:
            info = ProfileInfoV2(user_id=user_id)
            self.session.add(info)
            self.session.flush()
        return info

    def _days_since_last_attempt(self, *, user_id: int) -> int | None:
        last_attempt = self.session.scalar(
            select(func.max(ReviewAttemptV2.attempted_at))
            .join(ReviewItemV2, ReviewItemV2.id == ReviewAttemptV2.review_item_id)
            .where(ReviewItemV2.user_id == user_id)
        )
        if last_attempt is None:
            return None
        return max(0, (utc_now() - last_attempt).days)

    def _serialize_snapshot(
        self,
        *,
        snapshot: ReviewDebtSnapshot,
        runtime: ReviewRampupRuntime,
        preferences,
    ) -> ReviewDebtSnapshotResponseV2:
        return ReviewDebtSnapshotResponseV2(
            debt_severity=snapshot.debt_severity.value,
            overdue_count=snapshot.overdue_count,
            oldest_overdue_days=snapshot.oldest_overdue_days,
            daily_limit=snapshot.daily_limit,
            recommended_today_count=(
                min(snapshot.overdue_count, current_phase_limit(phase=runtime.phase, daily_limit=snapshot.daily_limit))
                if runtime.active and runtime.phase is not None
                else snapshot.recommended_today_count
            ),
            redistributed_count=snapshot.redistributed_count,
            rampup_phase=runtime.phase.value if runtime.phase is not None else None,
            rampup_started_at=runtime.started_at,
            rampup_unlock_at=runtime.unlock_at,
            rampup_active=runtime.active,
            can_redistribute=(
                not runtime.active
                and preferences.redistribute_enabled
                and snapshot.debt_severity in {DebtSeverity.MODERATE, DebtSeverity.HEAVY, DebtSeverity.CRITICAL}
            ),
        )
