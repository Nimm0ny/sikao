from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import cast

from sqlalchemy import select

from sikao_api.db.models_v2 import PlanEventV2, UserV2
from sikao_api.db.schemas_v2 import PlanEventReadV2
from sikao_api.modules.plans.application.event_service import EventServiceSupport
from sikao_api.modules.plans.application.helpers import append_change_log, now_utc, serialize_event
from sikao_api.modules.plans.domain.rrule_subset import build_occurrence_ref
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ValidationError


class EventDeleteServiceV2(EventServiceSupport):
    def soft_delete_event(
        self,
        *,
        user: UserV2,
        event_id: str,
        scope: str | None,
        request_id: str | None,
        ip: str | None,
    ) -> None:
        resolved = self._resolve_event_reference(user_id=user.id, event_id=event_id, include_deleted=False)
        if resolved["kind"] == "virtual":
            parent = cast(PlanEventV2, resolved["parent"])
            occurrence_start = cast(datetime, resolved["occurrence_start"])
            self._delete_virtual_event(
                user=user,
                parent=parent,
                occurrence_start=occurrence_start,
                scope=scope,
                request_id=request_id,
                ip=ip,
            )
            return
        event = cast(PlanEventV2, resolved["event"])
        if event.recurring_parent_id is not None and scope == "future":
            parent = self._get_event_row(user_id=user.id, event_id=event.recurring_parent_id, include_deleted=False)
            self._truncate_parent_series(
                user=user,
                parent=parent,
                occurrence_start=event.start_at,
                request_id=request_id,
                ip=ip,
                action="plan_event.delete_future",
            )
            return
        if event.recurring_parent_id is not None and scope == "all":
            parent = self._get_event_row(user_id=user.id, event_id=event.recurring_parent_id, include_deleted=False)
            self._soft_delete_concrete_event(
                user=user,
                event=parent,
                action="plan_event.delete_all",
                request_id=request_id,
                ip=ip,
            )
            return
        self._soft_delete_concrete_event(
            user=user,
            event=event,
            action="plan_event.delete",
            request_id=request_id,
            ip=ip,
        )

    def restore_event(
        self, *, user: UserV2, event_id: int, request_id: str | None, ip: str | None
    ) -> PlanEventReadV2:
        event = self._get_event_row(user_id=user.id, event_id=event_id, include_deleted=True)
        if event.deleted_at is None:
            return self._build_concrete_event_model(event)
        if event.deleted_at < now_utc() - timedelta(days=30):
            raise ValidationError("deleted event is no longer restorable", code="event_restore_expired")
        before = serialize_event(event)
        event.deleted_at = None
        after = serialize_event(event)
        event.change_log = append_change_log(
            event.change_log,
            change_type="restore",
            before=before,
            after=after,
            reason="manual_restore",
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan_event.restore",
            target_type="plan_event_v2",
            target_id=event.id,
            before=before,
            after=after,
            request_id=request_id,
            ip=ip,
        )
        self.session.add(event)
        return self._build_concrete_event_model(event)

    def bulk_delete(
        self,
        *,
        user: UserV2,
        plan_id: int | None,
        from_date: date | None,
        to_date: date | None,
        source: str | None,
        dry_run: bool,
        request_id: str | None,
        ip: str | None,
    ) -> list[str]:
        query = select(PlanEventV2).where(
            PlanEventV2.user_id == user.id,
            PlanEventV2.deleted_at.is_(None),
        )
        if plan_id is not None:
            query = query.where(PlanEventV2.plan_id == plan_id)
        if source is not None:
            query = query.where(PlanEventV2.source == source)
        if from_date is not None and to_date is not None:
            range_start, range_end = self._build_utc_window(
                from_date=from_date,
                to_date=to_date,
                timezone="Asia/Shanghai",
            )
            query = query.where(PlanEventV2.start_at < range_end, PlanEventV2.end_at >= range_start)
        elif from_date is not None or to_date is not None:
            raise ValidationError("from and to must be provided together", code="invalid_event_window")
        rows = list(self.session.scalars(query.order_by(PlanEventV2.start_at.asc(), PlanEventV2.id.asc())))
        ids = [str(row.id) for row in rows]
        if dry_run:
            return ids
        for row in rows:
            self._soft_delete_concrete_event(
                user=user,
                event=row,
                action="plan_event.bulk_delete",
                request_id=request_id,
                ip=ip,
            )
        return ids

    def _delete_virtual_event(
        self,
        *,
        user: UserV2,
        parent: PlanEventV2,
        occurrence_start: datetime,
        scope: str | None,
        request_id: str | None,
        ip: str | None,
    ) -> None:
        if scope not in {"this", "future", "all"}:
            raise ValidationError("scope is required for recurring instance delete", code="invalid_event_scope")
        if scope == "all":
            self._soft_delete_concrete_event(
                user=user,
                event=parent,
                action="plan_event.delete_all",
                request_id=request_id,
                ip=ip,
            )
            return
        if scope == "future":
            self._truncate_parent_series(
                user=user,
                parent=parent,
                occurrence_start=occurrence_start,
                request_id=request_id,
                ip=ip,
                action="plan_event.delete_future",
            )
            return
        before = serialize_event(parent)
        self._append_exception(parent=parent, occurrence_start=occurrence_start)
        after = serialize_event(parent)
        parent.change_log = append_change_log(
            parent.change_log,
            change_type="delete",
            before=before,
            after=after,
            reason="scope_this_exception",
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="plan_event.delete_this",
            target_type="plan_event_v2",
            target_id=parent.id,
            before=before,
            after=after,
            metadata={"occurrence_ref": build_occurrence_ref(parent_id=parent.id, occurrence_start=occurrence_start, timezone=parent.timezone)},
            request_id=request_id,
            ip=ip,
        )
        self.session.add(parent)

    def _truncate_parent_series(
        self,
        *,
        user: UserV2,
        parent: PlanEventV2,
        occurrence_start: datetime,
        request_id: str | None,
        ip: str | None,
        action: str,
    ) -> None:
        if parent.recurring_rule is None:
            raise ValidationError("future scope requires recurring parent", code="invalid_event_scope")
        before = serialize_event(parent)
        parent.recurring_rule = self._truncate_rule_until(rule=parent.recurring_rule, cutoff=occurrence_start - timedelta(seconds=1))
        after = serialize_event(parent)
        self._soft_delete_future_detached_rows(parent_id=parent.id, cutoff=occurrence_start)
        parent.change_log = append_change_log(
            parent.change_log,
            change_type="truncate",
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
            target_id=parent.id,
            before=before,
            after=after,
            request_id=request_id,
            ip=ip,
        )
        self.session.add(parent)

    def _soft_delete_concrete_event(
        self,
        *,
        user: UserV2,
        event: PlanEventV2,
        action: str,
        request_id: str | None,
        ip: str | None,
    ) -> None:
        before = serialize_event(event)
        event.deleted_at = now_utc()
        after = serialize_event(event)
        event.change_log = append_change_log(
            event.change_log,
            change_type="delete",
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
