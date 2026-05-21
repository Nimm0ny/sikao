from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PlanAdjustmentV2, PlanEventV2, UserV2
from sikao_api.db.schemas_v2 import PlanAdjustmentListResponseV2, PlanAdjustmentReadV2
from sikao_api.modules.plans.application.helpers import append_change_log, now_utc, serialize_event, to_naive_utc
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


class AdjustmentServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_adjustments(self, *, user: UserV2, status: str | None) -> PlanAdjustmentListResponseV2:
        query = select(PlanAdjustmentV2).where(PlanAdjustmentV2.user_id == user.id)
        if status is not None:
            query = query.where(PlanAdjustmentV2.status == status)
        rows = list(self.session.scalars(query.order_by(PlanAdjustmentV2.proposed_at.desc(), PlanAdjustmentV2.id.desc())))
        return PlanAdjustmentListResponseV2(
            items=[PlanAdjustmentReadV2.model_validate(row) for row in rows],
            total=len(rows),
        )

    def get_adjustment(self, *, user: UserV2, adjustment_id: int) -> PlanAdjustmentReadV2:
        return PlanAdjustmentReadV2.model_validate(
            self._get_adjustment_row(user_id=user.id, adjustment_id=adjustment_id)
        )

    def accept_adjustment(
        self,
        *,
        user: UserV2,
        adjustment_id: int,
        request_id: str | None,
        ip: str | None,
    ) -> None:
        adjustment = self._get_adjustment_row(user_id=user.id, adjustment_id=adjustment_id)
        if adjustment.status != "pending":
            raise ValidationError("adjustment is not pending", code="adjustment_not_pending")
        for change in adjustment.changes:
            self._apply_change(
                user=user,
                adjustment=adjustment,
                change=change,
                request_id=request_id,
                ip=ip,
            )
        adjustment.status = "accepted"
        adjustment.decided_at = now_utc()
        self.session.add(adjustment)
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan_adjustment.accept",
            target_type="plan_adjustment_v2",
            target_id=adjustment.id,
            after={"status": "accepted"},
            metadata={"changes_count": len(adjustment.changes)},
            request_id=request_id,
            ip=ip,
        )

    def reject_adjustment(
        self,
        *,
        user: UserV2,
        adjustment_id: int,
        reason: str | None,
        request_id: str | None,
        ip: str | None,
    ) -> None:
        adjustment = self._get_adjustment_row(user_id=user.id, adjustment_id=adjustment_id)
        if adjustment.status != "pending":
            raise ValidationError("adjustment is not pending", code="adjustment_not_pending")
        adjustment.status = "rejected"
        adjustment.decided_at = now_utc()
        adjustment.user_reject_reason = reason
        self.session.add(adjustment)
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan_adjustment.reject",
            target_type="plan_adjustment_v2",
            target_id=adjustment.id,
            after={"status": "rejected", "user_reject_reason": reason},
            request_id=request_id,
            ip=ip,
        )

    def _apply_change(
        self,
        *,
        user: UserV2,
        adjustment: PlanAdjustmentV2,
        change: dict[str, Any],
        request_id: str | None,
        ip: str | None,
    ) -> None:
        action = change.get("action")
        after_payload = change.get("after") or {}
        before_payload = change.get("before") or {}
        event_id = change.get("event_id")
        if action == "add":
            event = PlanEventV2(
                plan_id=adjustment.plan_id,
                user_id=user.id,
                title=str(after_payload.get("title", "Adjusted event")),
                category=str(after_payload.get("category", "custom")),
                notes=str(after_payload.get("notes", "")),
                start_at=to_naive_utc(after_payload["start_at"]),
                end_at=to_naive_utc(after_payload["end_at"]),
                timezone=str(after_payload.get("timezone", "Asia/Shanghai")),
                recurring_rule=after_payload.get("recurring_rule"),
                recurring_exception_dates=list(after_payload.get("recurring_exception_dates", [])),
                status=str(after_payload.get("status", "planned")),
                source="ai_adjusted",
                target_id=after_payload.get("target_id"),
                change_log=[],
            )
            event.change_log = append_change_log(
                event.change_log,
                change_type="create",
                before=None,
                after={
                    "title": event.title,
                    "start_at": event.start_at.isoformat(),
                    "end_at": event.end_at.isoformat(),
                },
                reason="adjustment_accept_add",
                actor="ai",
            )
            self.session.add(event)
            self.session.flush()
            add_audit_log(
                self.session,
                user_id=user.id,
                actor_type="user",
                actor_id=str(user.id),
                action="plan_event.adjustment_add",
                target_type="plan_event_v2",
                target_id=event.id,
                after=serialize_event(event),
                metadata={"adjustment_id": adjustment.id},
                request_id=request_id,
                ip=ip,
            )
            return
        if not isinstance(event_id, int):
            raise ValidationError("adjustment change event_id is required", code="invalid_adjustment_change")
        existing_event = self.session.scalar(
            select(PlanEventV2).where(PlanEventV2.id == event_id, PlanEventV2.user_id == user.id)
        )
        if existing_event is None:
            raise NotFoundError("adjustment target event not found", code="event_not_found")
        snapshot_before = serialize_event(existing_event)
        if action == "edit":
            if "title" in after_payload:
                existing_event.title = str(after_payload["title"])
            if "category" in after_payload:
                existing_event.category = str(after_payload["category"])
            if "notes" in after_payload:
                existing_event.notes = str(after_payload["notes"])
            if "start_at" in after_payload:
                existing_event.start_at = to_naive_utc(after_payload["start_at"])
            if "end_at" in after_payload:
                existing_event.end_at = to_naive_utc(after_payload["end_at"])
            if "timezone" in after_payload:
                existing_event.timezone = str(after_payload["timezone"])
            if "status" in after_payload:
                existing_event.status = str(after_payload["status"])
            before_event = before_payload or snapshot_before
            existing_event.change_log = append_change_log(
                existing_event.change_log,
                change_type="update",
                before=before_event,
                after=serialize_event(existing_event),
                reason="adjustment_accept_edit",
                actor="ai",
            )
            self.session.add(existing_event)
            add_audit_log(
                self.session,
                user_id=user.id,
                actor_type="user",
                actor_id=str(user.id),
                action="plan_event.adjustment_edit",
                target_type="plan_event_v2",
                target_id=existing_event.id,
                before=before_event,
                after=serialize_event(existing_event),
                metadata={"adjustment_id": adjustment.id},
                request_id=request_id,
                ip=ip,
            )
            return
        if action == "delete":
            before_event = before_payload or snapshot_before
            existing_event.deleted_at = now_utc()
            existing_event.change_log = append_change_log(
                existing_event.change_log,
                change_type="delete",
                before=before_event,
                after=serialize_event(existing_event),
                reason="adjustment_accept_delete",
                actor="ai",
            )
            self.session.add(existing_event)
            add_audit_log(
                self.session,
                user_id=user.id,
                actor_type="user",
                actor_id=str(user.id),
                action="plan_event.adjustment_delete",
                target_type="plan_event_v2",
                target_id=existing_event.id,
                before=before_event,
                after=serialize_event(existing_event),
                metadata={"adjustment_id": adjustment.id},
                request_id=request_id,
                ip=ip,
            )
            return
        raise ValidationError("unsupported adjustment action", code="invalid_adjustment_change")

    def _get_adjustment_row(self, *, user_id: int, adjustment_id: int) -> PlanAdjustmentV2:
        adjustment = self.session.scalar(
            select(PlanAdjustmentV2).where(
                PlanAdjustmentV2.id == adjustment_id,
                PlanAdjustmentV2.user_id == user_id,
            )
        )
        if adjustment is None:
            raise NotFoundError("plan adjustment not found", code="plan_adjustment_not_found")
        return adjustment
