from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    DashboardContinueResponseV2,
    DashboardFullPlanResponseV2,
    DashboardReviewResponseV2,
    DashboardTodayCompletionResponseV2,
    DashboardTodayResponseV2,
    DashboardWeeklyAdjustRequestV2,
    DashboardWeeklyPlanResponseV2,
    OverviewResponseV2,
    PlanReadV2,
    PlanUpdateRequestV2,
    ReviewItemV2 as ReviewItemSchemaV2,
    SectionCardV2,
    SummaryMetricV2,
)
from sikao_api.modules.plans.application.event_query_service import EventQueryServiceV2
from sikao_api.modules.plans.application.plan_service import PlanServiceV2
from sikao_api.modules.progress.application.aggregates import (
    month_bounds_cn,
    today_cn,
    week_bounds_cn,
)
from sikao_api.modules.review.application.queue_items import (
    ACTIVE_REVIEW_ITEM_STATUSES,
    canonical_review_source_kind,
    canonical_review_status,
    load_review_presence_sets,
    today_end_utc,
)
from sikao_api.modules.progress.application.dashboard_support import (
    build_plan_window_summary,
    list_exam_targets,
    load_active_plan,
)
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


def build_dashboard_overview(
    session: Session,
    *,
    user: UserV2,
) -> OverviewResponseV2:
    today_payload = build_dashboard_today(session, user=user)
    weekly_payload = build_dashboard_weekly_plan(session, user=user)
    return OverviewResponseV2(
        summary=[
            SummaryMetricV2(key="today", label="Today", value=str(today_payload.summary.total_events)),
            SummaryMetricV2(key="week", label="Week", value=str(weekly_payload.summary.total_events)),
        ],
        sections=[
            SectionCardV2(
                key="today",
                title="今日计划",
                description=f"{today_payload.summary.total_events} 个日程块",
                status="ready" if today_payload.summary.total_events > 0 else "empty",
                href="/dashboard/today",
            ),
            SectionCardV2(
                key="week",
                title="本周计划",
                description=f"{weekly_payload.summary.total_events} 个周内日程块",
                status="ready" if weekly_payload.summary.total_events > 0 else "empty",
                href="/dashboard/weekly-plan",
            ),
            SectionCardV2(
                key="progress",
                title="学习进度",
                description="查看真实进度、弱项和诊断。",
                status="ready",
                href="/dashboard/progress",
            ),
        ],
        actions=[
            ActionLinkV2(key="today", label="打开今日计划", href="/dashboard/today"),
            ActionLinkV2(key="week", label="打开本周计划", href="/dashboard/weekly-plan"),
            ActionLinkV2(key="progress", label="打开学习进度", href="/dashboard/progress"),
        ],
    )


def build_dashboard_today(
    session: Session,
    *,
    user: UserV2,
) -> DashboardTodayResponseV2:
    target_date = today_cn()
    plan = load_active_plan(session, user_id=user.id)
    exam_targets = list_exam_targets(session, user=user, active_plan=plan)
    events, practice_blocks = _load_window(
        session,
        user=user,
        plan_id=plan.id if plan is not None else None,
        from_date=target_date,
        to_date=target_date,
        include_practice_blocks=True,
    )
    return DashboardTodayResponseV2(
        date=target_date,
        plan_id=plan.id if plan is not None else None,
        summary=build_plan_window_summary(
            events=events,
            practice_minutes_total=_sum_practice_minutes(practice_blocks),
        ),
        events=events,
        practice_blocks=practice_blocks,
        nearest_exam_target=exam_targets[0] if exam_targets else None,
    )


def build_dashboard_continue(
    session: Session,
    *,
    user: UserV2,
) -> DashboardContinueResponseV2:
    practice_session = session.scalar(
        select(PracticeSessionV2)
        .where(
            PracticeSessionV2.user_id == user.id,
            PracticeSessionV2.status.in_(("draft", "in_progress")),
        )
        .order_by(PracticeSessionV2.started_at.desc(), PracticeSessionV2.id.desc())
    )
    if practice_session is None:
        return DashboardContinueResponseV2(has_active_session=False)
    href = f"/practice/sessions/{practice_session.id}"
    return DashboardContinueResponseV2(
        has_active_session=True,
        session_id=practice_session.id,
        track=practice_session.track,
        entry_kind=practice_session.entry_kind,
        status=practice_session.status,
        started_at=practice_session.started_at,
        href=href,
    )


def build_dashboard_review(
    session: Session,
    *,
    user: UserV2,
) -> DashboardReviewResponseV2:
    items = list(
        session.scalars(
            select(ReviewItemV2)
            .where(
                ReviewItemV2.user_id == user.id,
                ReviewItemV2.status.in_(ACTIVE_REVIEW_ITEM_STATUSES),
                (ReviewItemV2.next_review_at.is_(None) | (ReviewItemV2.next_review_at <= today_end_utc())),
            )
            .order_by(ReviewItemV2.updated_at.asc(), ReviewItemV2.created_at.asc(), ReviewItemV2.id.asc())
        )
    )
    note_question_ids, cause_question_ids = load_review_presence_sets(
        session,
        user_id=user.id,
        items=items[:5],
    )
    return DashboardReviewResponseV2(
        items=[
            _serialize_review_item(
                item,
                note_question_ids=note_question_ids,
                cause_question_ids=cause_question_ids,
            )
            for item in items[:5]
        ],
        total=len(items),
    )


def build_dashboard_weekly_plan(
    session: Session,
    *,
    user: UserV2,
    anchor_date: date | None = None,
) -> DashboardWeeklyPlanResponseV2:
    target_date = anchor_date or today_cn()
    week_start, week_end = week_bounds_cn(target_date)
    plan = load_active_plan(session, user_id=user.id)
    exam_targets = list_exam_targets(session, user=user, active_plan=plan)
    events, practice_blocks = _load_window(
        session,
        user=user,
        plan_id=plan.id if plan is not None else None,
        from_date=week_start,
        to_date=week_end,
        include_practice_blocks=True,
    )
    return DashboardWeeklyPlanResponseV2(
        week_start=week_start,
        week_end=week_end,
        plan_id=plan.id if plan is not None else None,
        summary=build_plan_window_summary(
            events=events,
            practice_minutes_total=_sum_practice_minutes(practice_blocks),
        ),
        events=events,
        practice_blocks=practice_blocks,
        nearest_exam_target=exam_targets[0] if exam_targets else None,
    )


def get_dashboard_weekly_goal(session: Session, *, user: UserV2) -> PlanReadV2:
    plan = load_active_plan(session, user_id=user.id)
    if plan is None:
        raise NotFoundError("active plan not found", code="plan_not_found")
    return PlanReadV2.model_validate(plan)


def build_dashboard_today_completion(
    session: Session,
    *,
    user: UserV2,
) -> DashboardTodayCompletionResponseV2:
    today_payload = build_dashboard_today(session, user=user)
    return DashboardTodayCompletionResponseV2(
        date=today_payload.date,
        total_events=today_payload.summary.total_events,
        done_events=today_payload.summary.done_count,
        completion_rate=today_payload.summary.completion_rate,
    )


def update_dashboard_weekly_adjust(
    session: Session,
    *,
    user: UserV2,
    payload: DashboardWeeklyAdjustRequestV2,
    request_id: str | None,
    ip: str | None,
) -> PlanReadV2:
    plan = load_active_plan(session, user_id=user.id)
    if plan is None:
        raise NotFoundError("active plan not found", code="plan_not_found")
    if payload.daily_minutes_target is None and payload.style is None and payload.focus_subjects is None:
        raise ValidationError("no weekly plan adjustments provided", code="empty_plan_update")
    return PlanServiceV2(session).update_plan(
        user=user,
        plan_id=plan.id,
        payload=PlanUpdateRequestV2(
            daily_minutes_target=payload.daily_minutes_target,
            style=payload.style,
            focus_subjects=payload.focus_subjects,
        ),
        request_id=request_id,
        ip=ip,
    )


def build_dashboard_full_plan(
    session: Session,
    *,
    user: UserV2,
    view: str,
    anchor_date: date,
) -> DashboardFullPlanResponseV2:
    from_date, to_date = _resolve_full_plan_window(view=view, anchor_date=anchor_date)
    plan = load_active_plan(session, user_id=user.id)
    events, practice_blocks = _load_window(
        session,
        user=user,
        plan_id=plan.id if plan is not None else None,
        from_date=from_date,
        to_date=to_date,
        include_practice_blocks=True,
    )
    return DashboardFullPlanResponseV2.model_validate(
        {
            "view": view,
            "anchorDate": anchor_date,
            "from": from_date,
            "to": to_date,
            "planId": plan.id if plan is not None else None,
            "summary": build_plan_window_summary(
                events=events,
                practice_minutes_total=_sum_practice_minutes(practice_blocks),
            ).model_dump(mode="json"),
            "events": [event.model_dump(mode="json") for event in events],
            "practiceBlocks": [item.model_dump(mode="json") for item in practice_blocks],
            "targets": [
                target.model_dump(mode="json")
                for target in list_exam_targets(session, user=user, active_plan=plan)
            ],
        }
    )


def _resolve_full_plan_window(*, view: str, anchor_date: date) -> tuple[date, date]:
    if view == "today":
        return anchor_date, anchor_date
    if view == "week":
        return week_bounds_cn(anchor_date)
    if view == "month":
        return month_bounds_cn(anchor_date)
    raise ValidationError("view must be one of today|week|month", code="invalid_full_plan_view")


def _load_window(
    session: Session,
    *,
    user: UserV2,
    plan_id: int | None,
    from_date: date,
    to_date: date,
    include_practice_blocks: bool,
) -> tuple[list[Any], list[Any]]:
    payload = EventQueryServiceV2(session).list_events(
        user=user,
        from_date=from_date,
        to_date=to_date,
        include_practice_blocks=include_practice_blocks,
        tz="Asia/Shanghai",
    )
    events = payload.data.events
    if plan_id is not None:
        events = [item for item in events if item.plan_id == plan_id]
    else:
        events = []
    return events, payload.data.practice_blocks


def _sum_practice_minutes(practice_blocks: list[Any]) -> int:
    return sum(
        int((item.end_at - item.start_at).total_seconds() // 60)
        for item in practice_blocks
    )


def _serialize_review_item(
    item: ReviewItemV2,
    *,
    note_question_ids: set[int],
    cause_question_ids: set[int],
) -> ReviewItemSchemaV2:
    question_id = int(item.question_id) if item.question_id is not None else None
    return ReviewItemSchemaV2(
        id=item.id,
        kind=canonical_review_source_kind(source_kind=item.source_kind, reason=item.reason),
        title=item.title,
        status=canonical_review_status(item.status),
        href=f"/review/items/{item.id}",
        created_at=item.created_at,
        updated_at=item.updated_at,
        correct_streak=item.correct_streak,
        next_review_at=item.next_review_at,
        question_id=question_id,
        has_user_notes=question_id in note_question_ids if question_id is not None else False,
        has_cause_analysis=question_id in cause_question_ids if question_id is not None else False,
    )
