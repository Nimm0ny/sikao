from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import func, select

from sikao_api.db.models_v2 import PlanEventV2, PracticeSessionAnswerV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import (
    EventConflictItemV2,
    EventConflictsRequestV2,
    EventConflictsResponseV2,
    EventWindowDataV2,
    EventWindowMetaV2,
    EventWindowResponseV2,
    PlanEventReadV2,
    PracticeBlockV2,
)
from sikao_api.modules.plans.application.event_service import EventServiceSupport
from sikao_api.modules.plans.application.helpers import to_naive_utc
from sikao_api.modules.plans.domain.rrule_subset import build_occurrence_ref, expand_occurrences


class EventQueryServiceV2(EventServiceSupport):
    def list_events(
        self,
        *,
        user: UserV2,
        from_date: date,
        to_date: date,
        include_practice_blocks: bool,
        tz: str,
    ) -> EventWindowResponseV2:
        range_start, range_end = self._build_utc_window(from_date=from_date, to_date=to_date, timezone=tz)
        self._validate_window(range_start=range_start, range_end=range_end)
        rows = list(
            self.session.scalars(
                select(PlanEventV2).where(
                    PlanEventV2.user_id == user.id,
                    PlanEventV2.deleted_at.is_(None),
                )
            )
        )
        events = self._expand_events(rows=rows, range_start=range_start, range_end=range_end)
        practice_blocks = (
            self._list_practice_blocks(user=user, range_start=range_start, range_end=range_end)
            if include_practice_blocks
            else []
        )
        return EventWindowResponseV2(
            data=EventWindowDataV2(events=events, practice_blocks=practice_blocks),
            meta=EventWindowMetaV2.model_validate(
                {
                    "from": from_date,
                    "to": to_date,
                    "include_practice_blocks": include_practice_blocks,
                    "tz": tz,
                }
            ),
        )

    def get_event(self, *, user: UserV2, event_id: str) -> PlanEventReadV2:
        resolved = self._resolve_event_reference(user_id=user.id, event_id=event_id)
        if resolved["kind"] == "virtual":
            return self._build_virtual_event_model(
                parent=resolved["parent"],  # type: ignore[arg-type]
                occurrence_start=resolved["occurrence_start"],  # type: ignore[arg-type]
            )
        return self._build_concrete_event_model(resolved["event"])  # type: ignore[arg-type]

    def detect_conflicts(
        self,
        *,
        user: UserV2,
        payload: EventConflictsRequestV2,
    ) -> EventConflictsResponseV2:
        if not payload.events:
            return EventConflictsResponseV2(conflicts=[])
        if payload.existing_window is not None:
            range_start, range_end = self._build_utc_window(
                from_date=payload.existing_window.from_date,
                to_date=payload.existing_window.to,
                timezone="Asia/Shanghai",
            )
        else:
            starts = [item.start_at for item in payload.events]
            ends = [item.end_at for item in payload.events]
            range_start = min(to_naive_utc(item) for item in starts)
            range_end = max(to_naive_utc(item) for item in ends)
        existing = self._expand_events(
            rows=list(
                self.session.scalars(
                    select(PlanEventV2).where(
                        PlanEventV2.user_id == user.id,
                        PlanEventV2.deleted_at.is_(None),
                    )
                )
            ),
            range_start=range_start,
            range_end=range_end,
        )
        practice_blocks = self._list_practice_blocks(user=user, range_start=range_start, range_end=range_end)
        conflicts: list[EventConflictItemV2] = []
        for proposed in payload.events:
            windows = self._expand_proposed_event(
                title=proposed.title,
                category=proposed.category,
                start_at=to_naive_utc(proposed.start_at),
                end_at=to_naive_utc(proposed.end_at),
                recurring_rule=proposed.recurring_rule,
                range_start=range_start,
                range_end=range_end,
            )
            for window_start, window_end, title in windows:
                for event in existing:
                    if self._windows_overlap(window_start, window_end, event.start_at, event.end_at):
                        conflicts.append(
                            EventConflictItemV2(
                                kind="event",
                                source_id=event.id,
                                start_at=event.start_at,
                                end_at=event.end_at,
                                title=event.title,
                            )
                        )
                for block in practice_blocks:
                    if self._windows_overlap(window_start, window_end, block.start_at, block.end_at):
                        conflicts.append(
                            EventConflictItemV2(
                                kind="practice_block",
                                source_id=block.id,
                                start_at=block.start_at,
                                end_at=block.end_at,
                                title=title,
                            )
                        )
        unique: dict[tuple[str, str], EventConflictItemV2] = {}
        for item in conflicts:
            unique[(item.kind, item.source_id)] = item
        return EventConflictsResponseV2(conflicts=list(unique.values()))

    def _expand_events(
        self,
        *,
        rows: list[PlanEventV2],
        range_start: datetime,
        range_end: datetime,
    ) -> list[PlanEventReadV2]:
        events: list[PlanEventReadV2] = []
        for row in rows:
            if row.recurring_rule:
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
                    if occurrence_start >= range_end:
                        continue
                    events.append(self._build_virtual_event_model(parent=row, occurrence_start=occurrence_start))
                continue
            if row.end_at <= range_start or row.start_at >= range_end:
                continue
            events.append(self._build_concrete_event_model(row))
        return sorted(events, key=lambda item: (item.start_at, item.id))

    def _list_practice_blocks(
        self,
        *,
        user: UserV2,
        range_start: datetime,
        range_end: datetime,
    ) -> list[PracticeBlockV2]:
        sessions = list(
            self.session.scalars(
                select(PracticeSessionV2).where(
                    PracticeSessionV2.user_id == user.id,
                    PracticeSessionV2.linked_plan_event_id.is_(None),
                )
            )
        )
        items_count_rows = {
            session_id: count
            for session_id, count in self.session.execute(
                select(
                    PracticeSessionAnswerV2.session_id,
                    func.count(PracticeSessionAnswerV2.id),
                )
                .group_by(PracticeSessionAnswerV2.session_id)
            ).all()
        }
        blocks: list[PracticeBlockV2] = []
        for session_row in sessions:
            block_end = session_row.submitted_at or self._now()
            if block_end <= range_start or session_row.started_at >= range_end:
                continue
            blocks.append(
                PracticeBlockV2(
                    id=f"session:{session_row.id}",
                    session_id=session_row.id,
                    start_at=session_row.started_at,
                    end_at=block_end,
                    items_count=int(items_count_rows.get(session_row.id, 0)),
                    accuracy=None,
                    category=session_row.track,
                    subject=session_row.payload_json.get("subject")
                    if isinstance(session_row.payload_json, dict)
                    else None,
                    is_in_progress=session_row.submitted_at is None,
                )
            )
        return sorted(blocks, key=lambda item: (item.start_at, item.id))

    def _now(self) -> datetime:
        from sikao_api.modules.plans.application.helpers import now_utc

        return now_utc()
