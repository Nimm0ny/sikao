from __future__ import annotations

from datetime import datetime, timedelta
from typing import cast

from sikao_api.db.models_v2 import PlanEventV2, UserV2
from sikao_api.db.schemas_v2 import (
    PlanEventCreateRequestV2,
    PlanEventReadV2,
    PlanEventUpdateRequestV2,
)
from sikao_api.modules.plans.application.event_service import EventServiceSupport
from sikao_api.modules.plans.application.helpers import append_change_log, serialize_event
from sikao_api.modules.plans.domain.rrule_subset import validate_rrule_subset
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ValidationError


class EventCommandServiceV2(EventServiceSupport):
    def create_event(
        self,
        *,
        user: UserV2,
        payload: PlanEventCreateRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> PlanEventReadV2:
        plan = self._get_plan_for_write(user_id=user.id, plan_id=payload.plan_id)
        self._validate_event_window(payload.start_at, payload.end_at)
        if payload.recurring_rule is not None:
            validate_rrule_subset(payload.recurring_rule)
        event = PlanEventV2(
            plan_id=plan.id,
            user_id=user.id,
            title=payload.title,
            category=payload.category,
            notes=payload.notes,
            start_at=payload.start_at.replace(tzinfo=None),
            end_at=payload.end_at.replace(tzinfo=None),
            timezone=payload.timezone,
            recurring_rule=payload.recurring_rule,
            recurring_exception_dates=[],
            status="planned",
            source=payload.source,
            target_id=payload.target_id,
            change_log=[],
        )
        self.session.add(event)
        self.session.flush()
        after = serialize_event(event)
        event.change_log = append_change_log(
            event.change_log,
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
            action="plan_event.create",
            target_type="plan_event_v2",
            target_id=event.id,
            after=after,
            request_id=request_id,
            ip=ip,
        )
        self.session.add(event)
        return self._build_concrete_event_model(event)

    def update_event(
        self,
        *,
        user: UserV2,
        event_id: str,
        payload: PlanEventUpdateRequestV2,
        scope: str | None,
        request_id: str | None,
        ip: str | None,
    ) -> PlanEventReadV2:
        resolved = self._resolve_event_reference(user_id=user.id, event_id=event_id, include_deleted=False)
        if resolved["kind"] == "virtual":
            parent = cast(PlanEventV2, resolved["parent"])
            occurrence_start = cast(datetime, resolved["occurrence_start"])
            return self._update_virtual_event(
                user=user,
                parent=parent,
                occurrence_start=occurrence_start,
                payload=payload,
                scope=scope,
                request_id=request_id,
                ip=ip,
            )
        event = cast(PlanEventV2, resolved["event"])
        if event.recurring_parent_id is not None and scope in {"future", "all"}:
            parent = self._get_event_row(user_id=user.id, event_id=event.recurring_parent_id, include_deleted=False)
            if scope == "all":
                return self._apply_update_to_concrete_event(
                    user=user,
                    event=parent,
                    payload=payload,
                    action="plan_event.update_all",
                    request_id=request_id,
                    ip=ip,
                )
            return self._split_parent_for_future(
                user=user,
                parent=parent,
                occurrence_start=event.start_at,
                payload=payload,
                request_id=request_id,
                ip=ip,
            )
        if event.recurring_rule is not None and scope not in {None, "all"}:
            raise ValidationError("scope is invalid for recurring parent id update", code="invalid_event_scope")
        return self._apply_update_to_concrete_event(
            user=user,
            event=event,
            payload=payload,
            action="plan_event.update",
            request_id=request_id,
            ip=ip,
        )

    def _update_virtual_event(
        self,
        *,
        user: UserV2,
        parent: PlanEventV2,
        occurrence_start: datetime,
        payload: PlanEventUpdateRequestV2,
        scope: str | None,
        request_id: str | None,
        ip: str | None,
    ) -> PlanEventReadV2:
        if scope not in {"this", "future", "all"}:
            raise ValidationError("scope is required for recurring instance update", code="invalid_event_scope")
        if scope == "all":
            return self._apply_update_to_concrete_event(
                user=user,
                event=parent,
                payload=payload,
                action="plan_event.update_all",
                request_id=request_id,
                ip=ip,
            )
        if scope == "future":
            return self._split_parent_for_future(
                user=user,
                parent=parent,
                occurrence_start=occurrence_start,
                payload=payload,
                request_id=request_id,
                ip=ip,
            )
        return self._create_detached_override(
            user=user,
            parent=parent,
            occurrence_start=occurrence_start,
            payload=payload,
            request_id=request_id,
            ip=ip,
        )

    def _create_detached_override(
        self,
        *,
        user: UserV2,
        parent: PlanEventV2,
        occurrence_start: datetime,
        payload: PlanEventUpdateRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> PlanEventReadV2:
        duration = parent.end_at - parent.start_at
        detached = PlanEventV2(
            plan_id=parent.plan_id,
            user_id=parent.user_id,
            title=parent.title,
            category=parent.category,
            notes=parent.notes,
            start_at=occurrence_start,
            end_at=occurrence_start + duration,
            timezone=parent.timezone,
            recurring_rule=None,
            recurring_parent_id=parent.id,
            recurring_exception_dates=[],
            status=parent.status,
            source=parent.source,
            target_id=parent.target_id,
            change_log=[],
        )
        self._apply_payload_to_event(detached, payload, allow_recurring_rule=False)
        self._append_exception(parent=parent, occurrence_start=occurrence_start)
        self.session.add(detached)
        self.session.flush()
        after = serialize_event(detached)
        detached.change_log = append_change_log(
            detached.change_log,
            change_type="create",
            before=None,
            after=after,
            reason="scope_this_detached_override",
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan_event.update_this",
            target_type="plan_event_v2",
            target_id=detached.id,
            after=after,
            metadata={"parent_id": parent.id},
            request_id=request_id,
            ip=ip,
        )
        self.session.add_all([parent, detached])
        return self._build_concrete_event_model(detached)

    def _split_parent_for_future(
        self,
        *,
        user: UserV2,
        parent: PlanEventV2,
        occurrence_start: datetime,
        payload: PlanEventUpdateRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> PlanEventReadV2:
        if parent.recurring_rule is None:
            raise ValidationError("future scope requires recurring parent", code="invalid_event_scope")
        if occurrence_start <= parent.start_at:
            return self._apply_update_to_concrete_event(
                user=user,
                event=parent,
                payload=payload,
                action="plan_event.update_all",
                request_id=request_id,
                ip=ip,
            )
        previous_rule = parent.recurring_rule
        before_parent = serialize_event(parent)
        parent.recurring_rule = self._truncate_rule_until(rule=previous_rule, cutoff=occurrence_start - timedelta(seconds=1))
        after_parent = serialize_event(parent)
        duration = parent.end_at - parent.start_at
        new_parent = PlanEventV2(
            plan_id=parent.plan_id,
            user_id=parent.user_id,
            title=parent.title,
            category=parent.category,
            notes=parent.notes,
            start_at=occurrence_start,
            end_at=occurrence_start + duration,
            timezone=parent.timezone,
            recurring_rule=previous_rule,
            recurring_parent_id=None,
            recurring_exception_dates=[],
            status=parent.status,
            source=parent.source,
            target_id=parent.target_id,
            change_log=[],
        )
        self._apply_payload_to_event(new_parent, payload, allow_recurring_rule=True)
        self._soft_delete_future_detached_rows(parent_id=parent.id, cutoff=occurrence_start)
        self.session.add(new_parent)
        self.session.flush()
        after_new = serialize_event(new_parent)
        new_parent.change_log = append_change_log(
            new_parent.change_log,
            change_type="split_future",
            before=None,
            after=after_new,
            reason="scope_future",
        )
        parent.change_log = append_change_log(
            parent.change_log,
            change_type="truncate",
            before=before_parent,
            after=after_parent,
            reason="scope_future",
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan_event.update_future",
            target_type="plan_event_v2",
            target_id=new_parent.id,
            before=before_parent,
            after=after_new,
            metadata={"parent_id": parent.id},
            request_id=request_id,
            ip=ip,
        )
        self.session.add_all([parent, new_parent])
        return self._build_concrete_event_model(new_parent)

    def _apply_update_to_concrete_event(
        self,
        *,
        user: UserV2,
        event: PlanEventV2,
        payload: PlanEventUpdateRequestV2,
        action: str,
        request_id: str | None,
        ip: str | None,
    ) -> PlanEventReadV2:
        before = serialize_event(event)
        self._apply_payload_to_event(
            event,
            payload,
            allow_recurring_rule=event.recurring_rule is not None and event.recurring_parent_id is None,
        )
        after = serialize_event(event)
        event.change_log = append_change_log(
            event.change_log,
            change_type="update",
            before=before,
            after=after,
            reason=action,
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action=action,
            target_type="plan_event_v2",
            target_id=event.id,
            before=before,
            after=after,
            request_id=request_id,
            ip=ip,
        )
        self.session.add(event)
        return self._build_concrete_event_model(event)
