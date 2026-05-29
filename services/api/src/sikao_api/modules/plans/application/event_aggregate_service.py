from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

from sikao_api.db.models_v2 import (
    PlanEventV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionV2,
    UserV2,
)
from sikao_api.db.schemas_v2 import (
    PlanEventAggregateBatchResponseV2,
    PlanEventAggregateMetricsV2,
    PlanEventAggregateReadV2,
)
from sikao_api.modules.plans.application.event_service import EventServiceSupport
from sikao_api.modules.plans.domain.rrule_subset import build_occurrence_ref, parse_occurrence_ref
from sikao_api.modules.system.application.errors import NotFoundError


OBJECTIVE_ANSWER_KINDS = {"single_choice", "multiple_choice", "checkbox"}


@dataclass(frozen=True)
class AggregateTarget:
    event_id: str
    linked_session_id: int | None
    availability: str | None = None


@dataclass(frozen=True)
class VirtualDescriptor:
    event_id: str
    parent_id: int
    occurrence_ref: str


class EventAggregateServiceV2(EventServiceSupport):
    def list_event_aggregates(
        self,
        *,
        user: UserV2,
        event_ids: list[str],
    ) -> PlanEventAggregateBatchResponseV2:
        targets = self._resolve_targets(user_id=user.id, event_ids=event_ids)
        session_ids = sorted(
            {
                target.linked_session_id
                for target in targets
                if target.linked_session_id is not None
            }
        )
        sessions_by_id = self._load_sessions(user_id=user.id, session_ids=session_ids)
        answer_stats = self._load_answer_stats(session_ids=session_ids)
        items = [
            self._build_item(
                target=target,
                session=sessions_by_id.get(target.linked_session_id)
                if target.linked_session_id is not None
                else None,
                answer_stats=answer_stats,
            )
            for target in targets
        ]
        return PlanEventAggregateBatchResponseV2(items=items)

    def _resolve_targets(self, *, user_id: int, event_ids: list[str]) -> list[AggregateTarget]:
        concrete_ids: list[int] = []
        virtual_descriptors: list[VirtualDescriptor] = []
        parsed: list[tuple[str, str, int | None, str | None]] = []

        for event_id in event_ids:
            if ":" not in event_id:
                try:
                    concrete_id = int(event_id)
                except ValueError:
                    parsed.append(("invalid", event_id, None, None))
                    continue
                concrete_ids.append(concrete_id)
                parsed.append(("concrete", event_id, concrete_id, None))
                continue

            try:
                parent_id, _occurrence_day = parse_occurrence_ref(event_id)
            except Exception:
                parsed.append(("invalid", event_id, None, None))
                continue
            virtual_descriptors.append(
                VirtualDescriptor(
                    event_id=event_id,
                    parent_id=parent_id,
                    occurrence_ref=event_id,
                )
            )
            parsed.append(("virtual", event_id, parent_id, event_id))

        concrete_rows = {
            row.id: row
            for row in self.session.scalars(
                select(PlanEventV2).where(
                    PlanEventV2.user_id == user_id,
                    PlanEventV2.deleted_at.is_(None),
                    PlanEventV2.id.in_(concrete_ids),
                )
            )
        }
        parent_rows = {
            row.id: row
            for row in self.session.scalars(
                select(PlanEventV2).where(
                    PlanEventV2.user_id == user_id,
                    PlanEventV2.deleted_at.is_(None),
                    PlanEventV2.id.in_([descriptor.parent_id for descriptor in virtual_descriptors]),
                )
            )
        }
        concrete_reverse_links = self._load_reverse_linked_sessions(
            user_id=user_id,
            event_ids=list(concrete_rows.keys()),
        )
        virtual_links = self._load_occurrence_linked_sessions(
            user_id=user_id,
            descriptors=virtual_descriptors,
        )

        targets: list[AggregateTarget] = []
        for kind, event_id, identifier, _occurrence_ref in parsed:
            if kind == "invalid":
                targets.append(
                    AggregateTarget(event_id=event_id, linked_session_id=None, availability="event_unavailable")
                )
                continue

            if kind == "concrete":
                row = concrete_rows.get(identifier)
                if row is None:
                    targets.append(
                        AggregateTarget(event_id=event_id, linked_session_id=None, availability="event_unavailable")
                    )
                    continue
                if row.linked_session_id is not None:
                    targets.append(
                        AggregateTarget(event_id=event_id, linked_session_id=row.linked_session_id)
                    )
                    continue
                linked_session_id = concrete_reverse_links.get(row.id)
                if linked_session_id is None:
                    targets.append(
                        AggregateTarget(event_id=event_id, linked_session_id=None, availability="missing_linked_session")
                    )
                    continue
                targets.append(AggregateTarget(event_id=event_id, linked_session_id=linked_session_id))
                continue

            parent = parent_rows.get(identifier)
            if parent is None or parent.recurring_rule is None:
                targets.append(
                    AggregateTarget(event_id=event_id, linked_session_id=None, availability="event_unavailable")
                )
                continue
            try:
                occurrence_start = self._find_occurrence_start(
                    parent=parent,
                    occurrence_day=parse_occurrence_ref(event_id)[1],
                )
            except Exception:
                targets.append(
                    AggregateTarget(event_id=event_id, linked_session_id=None, availability="event_unavailable")
                )
                continue
            canonical_ref = build_occurrence_ref(
                parent_id=parent.id,
                occurrence_start=occurrence_start,
                timezone=parent.timezone,
            )
            linked_session_id = virtual_links.get((parent.id, canonical_ref))
            if linked_session_id is None:
                targets.append(
                    AggregateTarget(event_id=event_id, linked_session_id=None, availability="missing_linked_session")
                )
                continue
            targets.append(AggregateTarget(event_id=event_id, linked_session_id=linked_session_id))
        return targets

    def _load_reverse_linked_sessions(self, *, user_id: int, event_ids: list[int]) -> dict[int, int]:
        if not event_ids:
            return {}
        rows = self.session.scalars(
            select(PracticeSessionV2)
            .where(
                PracticeSessionV2.user_id == user_id,
                PracticeSessionV2.linked_plan_event_id.in_(event_ids),
                PracticeSessionV2.linked_plan_event_occurrence_ref.is_(None),
            )
            .order_by(
                PracticeSessionV2.linked_plan_event_id.asc(),
                PracticeSessionV2.started_at.desc(),
                PracticeSessionV2.id.desc(),
            )
        )
        linked: dict[int, int] = {}
        for row in rows:
            if row.linked_plan_event_id is None or row.linked_plan_event_id in linked:
                continue
            linked[row.linked_plan_event_id] = row.id
        return linked

    def _load_occurrence_linked_sessions(
        self,
        *,
        user_id: int,
        descriptors: list[VirtualDescriptor],
    ) -> dict[tuple[int, str], int]:
        if not descriptors:
            return {}
        parent_ids = [descriptor.parent_id for descriptor in descriptors]
        occurrence_refs = [descriptor.occurrence_ref for descriptor in descriptors]
        rows = self.session.scalars(
            select(PracticeSessionV2)
            .where(
                PracticeSessionV2.user_id == user_id,
                PracticeSessionV2.linked_plan_event_id.in_(parent_ids),
                PracticeSessionV2.linked_plan_event_occurrence_ref.in_(occurrence_refs),
            )
            .order_by(
                PracticeSessionV2.linked_plan_event_id.asc(),
                PracticeSessionV2.linked_plan_event_occurrence_ref.asc(),
                PracticeSessionV2.started_at.desc(),
                PracticeSessionV2.id.desc(),
            )
        )
        linked: dict[tuple[int, str], int] = {}
        for row in rows:
            if row.linked_plan_event_id is None or row.linked_plan_event_occurrence_ref is None:
                continue
            key = (row.linked_plan_event_id, row.linked_plan_event_occurrence_ref)
            if key in linked:
                continue
            linked[key] = row.id
        return linked

    def _load_sessions(self, *, user_id: int, session_ids: list[int]) -> dict[int, PracticeSessionV2]:
        if not session_ids:
            return {}
        return {
            row.id: row
            for row in self.session.scalars(
                select(PracticeSessionV2).where(
                    PracticeSessionV2.user_id == user_id,
                    PracticeSessionV2.id.in_(session_ids),
                )
            )
        }

    def _load_answer_stats(self, *, session_ids: list[int]) -> dict[int, tuple[int, int, bool]]:
        if not session_ids:
            return {}
        rows = self.session.execute(
            select(
                PracticeSessionAnswerV2.session_id,
                PracticeSessionAnswerV2.is_correct,
                QuestionV2.answer_kind,
            )
            .join(QuestionV2, QuestionV2.id == PracticeSessionAnswerV2.question_id, isouter=True)
            .where(PracticeSessionAnswerV2.session_id.in_(session_ids))
        ).all()
        stats: dict[int, tuple[int, int, bool]] = {}
        for session_id, is_correct, answer_kind in rows:
            attempted_count, correct_count, has_unsupported_kind = stats.get(int(session_id), (0, 0, False))
            unsupported_kind = has_unsupported_kind or (
                answer_kind is not None and answer_kind not in OBJECTIVE_ANSWER_KINDS
            )
            stats[int(session_id)] = (
                attempted_count + (1 if is_correct is not None else 0),
                correct_count + (1 if is_correct is True else 0),
                unsupported_kind,
            )
        return stats

    def _build_item(
        self,
        *,
        target: AggregateTarget,
        session: PracticeSessionV2 | None,
        answer_stats: dict[int, tuple[int, int, bool]],
    ) -> PlanEventAggregateReadV2:
        if target.availability is not None:
            return PlanEventAggregateReadV2(
                event_id=target.event_id,
                linked_session_id=target.linked_session_id,
                availability=target.availability,
                metrics=None,
            )
        if target.linked_session_id is None:
            return PlanEventAggregateReadV2(
                event_id=target.event_id,
                linked_session_id=None,
                availability="missing_linked_session",
                metrics=None,
            )
        if session is None:
            return PlanEventAggregateReadV2(
                event_id=target.event_id,
                linked_session_id=target.linked_session_id,
                availability="session_not_found",
                metrics=None,
            )
        if session.status != "submitted" or session.submitted_at is None:
            return PlanEventAggregateReadV2(
                event_id=target.event_id,
                linked_session_id=session.id,
                availability="not_submitted",
                metrics=None,
            )
        if session.track != "xingce":
            return PlanEventAggregateReadV2(
                event_id=target.event_id,
                linked_session_id=session.id,
                availability="unsupported_track",
                metrics=None,
            )

        attempted_count, correct_count, has_unsupported_kind = answer_stats.get(session.id, (0, 0, False))
        if has_unsupported_kind:
            return PlanEventAggregateReadV2(
                event_id=target.event_id,
                linked_session_id=session.id,
                availability="unsupported_track",
                metrics=None,
            )
        if attempted_count == 0:
            return PlanEventAggregateReadV2(
                event_id=target.event_id,
                linked_session_id=session.id,
                availability="no_graded_items",
                metrics=None,
            )

        source_kind = "mock_exam" if session.entry_kind == "mock_exam" else "practice_session"
        active_seconds = session.total_active_seconds if session.total_active_seconds > 0 else None
        return PlanEventAggregateReadV2(
            event_id=target.event_id,
            linked_session_id=session.id,
            availability="ready",
            metrics=PlanEventAggregateMetricsV2(
                attempted_count=attempted_count,
                correct_count=correct_count,
                accuracy=round(correct_count / attempted_count, 4),
                active_seconds=active_seconds,
                source_kind=source_kind,
            ),
        )
