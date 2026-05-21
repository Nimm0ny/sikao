from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PlanV2, UserV2
from sikao_api.db.schemas_v2 import PlanCreateRequestV2, PlanListResponseV2, PlanReadV2, PlanUpdateRequestV2
from sikao_api.modules.plans.application.helpers import append_change_log, serialize_plan, today_cn
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError


class PlanServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def list_plans(self, *, user: UserV2) -> PlanListResponseV2:
        plans = list(
            self.session.scalars(
                select(PlanV2)
                .where(PlanV2.user_id == user.id, PlanV2.deleted_at.is_(None))
                .order_by(PlanV2.created_at.desc(), PlanV2.id.desc())
            )
        )
        return PlanListResponseV2(items=[self._to_read_model(plan) for plan in plans], total=len(plans))

    def create_plan(
        self,
        *,
        user: UserV2,
        payload: PlanCreateRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> PlanReadV2:
        self._validate_target_exam_date(payload.target_exam_date)
        active_plan = self._load_active_plan(user_id=user.id)
        if active_plan is not None:
            raise ConflictError("active plan already exists", code="active_plan_exists")
        plan = PlanV2(
            user_id=user.id,
            name=payload.name,
            target_exam_id=payload.target_exam_id,
            target_exam_date=payload.target_exam_date,
            daily_minutes_target=payload.daily_minutes_target,
            style=payload.style,
            baseline=payload.baseline,
            focus_subjects=payload.focus_subjects,
            status="active",
            source="user_manual",
            change_log=[],
        )
        self.session.add(plan)
        self.session.flush()
        after = serialize_plan(plan)
        plan.change_log = append_change_log(
            plan.change_log,
            change_type="create",
            before=None,
            after=after,
            reason="manual_create",
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan.create",
            target_type="plan_v2",
            target_id=plan.id,
            after=after,
            metadata={"source": "user_manual"},
            request_id=request_id,
            ip=ip,
        )
        self.session.add(plan)
        self.session.flush()
        return self._to_read_model(plan)

    def get_plan(self, *, user: UserV2, plan_id: int) -> PlanReadV2:
        return self._to_read_model(self._get_plan_row(user_id=user.id, plan_id=plan_id))

    def update_plan(
        self,
        *,
        user: UserV2,
        plan_id: int,
        payload: PlanUpdateRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> PlanReadV2:
        plan = self._get_plan_row(user_id=user.id, plan_id=plan_id)
        before = serialize_plan(plan)
        updates: dict[str, object] = {}
        if payload.name is not None:
            plan.name = payload.name
            updates["name"] = payload.name
        if payload.target_exam_date is not None:
            self._validate_target_exam_date(payload.target_exam_date)
            plan.target_exam_date = payload.target_exam_date
            updates["target_exam_date"] = payload.target_exam_date.isoformat()
        if payload.daily_minutes_target is not None:
            plan.daily_minutes_target = payload.daily_minutes_target
            updates["daily_minutes_target"] = payload.daily_minutes_target
        if payload.style is not None:
            plan.style = payload.style
            updates["style"] = payload.style
        if payload.focus_subjects is not None:
            plan.focus_subjects = payload.focus_subjects
            updates["focus_subjects"] = payload.focus_subjects
        if not updates:
            raise ValidationError("no plan fields provided", code="empty_plan_update")
        after = serialize_plan(plan)
        plan.change_log = append_change_log(
            plan.change_log,
            change_type="update",
            before=before,
            after=after,
            reason="manual_update",
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan.update",
            target_type="plan_v2",
            target_id=plan.id,
            before=before,
            after=after,
            diff=updates,
            request_id=request_id,
            ip=ip,
        )
        self.session.add(plan)
        return self._to_read_model(plan)

    def archive_plan(
        self, *, user: UserV2, plan_id: int, request_id: str | None, ip: str | None
    ) -> PlanReadV2:
        return self._set_plan_status(
            user=user,
            plan_id=plan_id,
            new_status="archived",
            reason="manual_archive",
            request_id=request_id,
            ip=ip,
        )

    def activate_plan(
        self, *, user: UserV2, plan_id: int, request_id: str | None, ip: str | None
    ) -> PlanReadV2:
        target = self._get_plan_row(user_id=user.id, plan_id=plan_id)
        for active_plan in self.session.scalars(
            select(PlanV2)
            .where(
                PlanV2.user_id == user.id,
                PlanV2.deleted_at.is_(None),
                PlanV2.status == "active",
                PlanV2.id != target.id,
            )
        ):
            before = serialize_plan(active_plan)
            active_plan.status = "paused"
            after = serialize_plan(active_plan)
            active_plan.change_log = append_change_log(
                active_plan.change_log,
                change_type="pause",
                before=before,
                after=after,
                reason="activate_other_plan",
            )
            self.session.add(active_plan)
        return self._set_existing_plan_status(
            user=user,
            plan=target,
            new_status="active",
            reason="manual_activate",
            request_id=request_id,
            ip=ip,
        )

    def pause_plan(
        self, *, user: UserV2, plan_id: int, request_id: str | None, ip: str | None
    ) -> PlanReadV2:
        return self._set_plan_status(
            user=user,
            plan_id=plan_id,
            new_status="paused",
            reason="manual_pause",
            request_id=request_id,
            ip=ip,
        )

    def soft_delete_plan(
        self, *, user: UserV2, plan_id: int, request_id: str | None, ip: str | None
    ) -> None:
        plan = self._get_plan_row(user_id=user.id, plan_id=plan_id)
        before = serialize_plan(plan)
        plan.deleted_at = plan.updated_at
        after = serialize_plan(plan)
        plan.change_log = append_change_log(
            plan.change_log,
            change_type="delete",
            before=before,
            after=after,
            reason="manual_soft_delete",
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan.delete",
            target_type="plan_v2",
            target_id=plan.id,
            before=before,
            after=after,
            request_id=request_id,
            ip=ip,
        )
        self.session.add(plan)

    def _set_plan_status(
        self,
        *,
        user: UserV2,
        plan_id: int,
        new_status: str,
        reason: str,
        request_id: str | None,
        ip: str | None,
    ) -> PlanReadV2:
        plan = self._get_plan_row(user_id=user.id, plan_id=plan_id)
        return self._set_existing_plan_status(
            user=user,
            plan=plan,
            new_status=new_status,
            reason=reason,
            request_id=request_id,
            ip=ip,
        )

    def _set_existing_plan_status(
        self,
        *,
        user: UserV2,
        plan: PlanV2,
        new_status: str,
        reason: str,
        request_id: str | None,
        ip: str | None,
    ) -> PlanReadV2:
        before = serialize_plan(plan)
        plan.status = new_status
        if new_status == "archived":
            plan.archived_at = plan.updated_at
        elif new_status == "active":
            plan.archived_at = None
        after = serialize_plan(plan)
        plan.change_log = append_change_log(
            plan.change_log,
            change_type=new_status,
            before=before,
            after=after,
            reason=reason,
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action=f"plan.{new_status}",
            target_type="plan_v2",
            target_id=plan.id,
            before=before,
            after=after,
            request_id=request_id,
            ip=ip,
        )
        self.session.add(plan)
        return self._to_read_model(plan)

    def _get_plan_row(self, *, user_id: int, plan_id: int) -> PlanV2:
        plan = self.session.scalar(
            select(PlanV2).where(PlanV2.id == plan_id, PlanV2.user_id == user_id)
        )
        if plan is None or plan.deleted_at is not None:
            raise NotFoundError("plan not found", code="plan_not_found")
        return plan

    def _load_active_plan(self, *, user_id: int) -> PlanV2 | None:
        return self.session.scalar(
            select(PlanV2).where(
                PlanV2.user_id == user_id,
                PlanV2.deleted_at.is_(None),
                PlanV2.status == "active",
            )
        )

    def _validate_target_exam_date(self, target_exam_date: date) -> None:
        if target_exam_date < today_cn() + date.resolution:
            raise ValidationError("target_exam_date must be at least tomorrow", code="invalid_exam_date")

    def _to_read_model(self, plan: PlanV2) -> PlanReadV2:
        return PlanReadV2.model_validate(plan)
