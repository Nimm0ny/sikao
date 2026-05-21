from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PlanEventV2, PlanV2, ProfileGoalV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import DashboardPlanWindowSummaryV2, ExamCountdownV2, ProgressDiagnosisResponseV2, ProgressPlanSliceV2, WeaknessItemV2
from sikao_api.modules.plans.application.event_query_service import EventQueryServiceV2
from sikao_api.modules.progress.application.aggregates import (
    build_metric_bucket,
    day_bounds_cn,
    load_answers,
    load_sessions,
    now_utc,
    quantize_ratio,
    today_cn,
    to_cn_date,
)
from sikao_api.modules.system.application.errors import NotFoundError


def load_active_plan(session: Session, *, user_id: int) -> PlanV2 | None:
    return session.scalar(
        select(PlanV2).where(
            PlanV2.user_id == user_id,
            PlanV2.deleted_at.is_(None),
            PlanV2.status == "active",
        )
    )


def list_exam_targets(
    session: Session,
    *,
    user: UserV2,
    active_plan: PlanV2 | None,
) -> list[ExamCountdownV2]:
    today = today_cn()
    targets: list[ExamCountdownV2] = []
    goal = session.scalar(select(ProfileGoalV2).where(ProfileGoalV2.user_id == user.id))
    if goal is not None:
        for item in goal.exam_targets:
            exam_date_raw = item.get("exam_date")
            if not isinstance(exam_date_raw, str):
                continue
            try:
                exam_date = date.fromisoformat(exam_date_raw)
            except ValueError:
                continue
            if exam_date < today:
                continue
            exam_id = str(item.get("exam_id") or f"target-{len(targets) + 1}")
            targets.append(
                ExamCountdownV2(
                    exam_id=exam_id,
                    exam_name=str(item.get("exam_name") or exam_id),
                    exam_date=exam_date,
                    days_until=(exam_date - today).days,
                )
            )
    if not targets and active_plan is not None and active_plan.target_exam_date >= today:
        targets.append(
            ExamCountdownV2(
                exam_id=active_plan.target_exam_id,
                exam_name=active_plan.name,
                exam_date=active_plan.target_exam_date,
                days_until=(active_plan.target_exam_date - today).days,
            )
        )
    return sorted(targets, key=lambda item: (item.exam_date, item.exam_id))


def build_plan_slice(
    session: Session,
    *,
    user: UserV2,
    plan_id: int | None,
) -> ProgressPlanSliceV2:
    plan = _resolve_plan_for_slice(session, user=user, plan_id=plan_id)
    if plan is None:
        return ProgressPlanSliceV2(
            events_in_window_total=0,
            events_done=0,
            events_skipped=0,
            minutes_target_in_window=0,
            minutes_practiced_in_window=0,
        )
    plan_rows = list(
        session.scalars(
            select(PlanEventV2).where(
                PlanEventV2.plan_id == plan.id,
                PlanEventV2.user_id == user.id,
                PlanEventV2.deleted_at.is_(None),
            )
        )
    )
    if not plan_rows:
        return ProgressPlanSliceV2(
            plan_id=plan.id,
            events_in_window_total=0,
            events_done=0,
            events_skipped=0,
            minutes_target_in_window=0,
            minutes_practiced_in_window=0,
        )
    range_start = min(row.start_at for row in plan_rows)
    range_end = day_bounds_cn(today_cn())[1]
    events = EventQueryServiceV2(session)._expand_events(  # noqa: SLF001
        rows=plan_rows,
        range_start=range_start,
        range_end=range_end,
    )
    practiced = build_metric_bucket(
        sessions=load_sessions(session, user_id=user.id),
        answers=load_answers(session, user_id=user.id),
        range_start=range_start,
        range_end=range_end,
    )
    minutes_target = sum(int((event.end_at - event.start_at).total_seconds() // 60) for event in events)
    return ProgressPlanSliceV2(
        plan_id=plan.id,
        range_from=to_cn_date(range_start),
        range_to=today_cn(),
        events_in_window_total=len(events),
        events_done=sum(1 for event in events if event.status == "done"),
        events_skipped=sum(1 for event in events if event.status == "skipped"),
        minutes_target_in_window=minutes_target,
        minutes_practiced_in_window=practiced.minutes_practiced,
    )


def build_diagnosis(
    session: Session,
    *,
    user: UserV2,
    weakness_items: list[WeaknessItemV2],
) -> ProgressDiagnosisResponseV2:
    recent_start, _ = day_bounds_cn(today_cn() - timedelta(days=29))
    recent_bucket = build_metric_bucket(
        sessions=load_sessions(session, user_id=user.id),
        answers=load_answers(session, user_id=user.id),
        range_start=recent_start,
        range_end=None,
    )
    pending_review_count = int(
        session.scalar(
            select(func.count())
            .select_from(ReviewItemV2)
            .where(ReviewItemV2.user_id == user.id, ReviewItemV2.status == "pending")
        )
        or 0
    )
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []
    if recent_bucket.accuracy is not None and recent_bucket.accuracy >= 0.75:
        strengths.append("近30天客观题正确率保持在 75% 以上。")
    if recent_bucket.minutes_practiced >= 300:
        strengths.append("近30天练习时长稳定，投入节奏良好。")
    if pending_review_count <= 3:
        strengths.append("待复盘项目积压较少，复盘压力可控。")
    if recent_bucket.accuracy is None or recent_bucket.accuracy < 0.60:
        weaknesses.append("近30天客观题正确率仍偏低，需要优先修补基础。")
        suggestions.append("先做 1 轮错题复盘，再安排 1 个短时专项练习块。")
    if weakness_items:
        weakest = weakness_items[0]
        weaknesses.append(f"{weakest.subject_label} 正确率偏低，是当前最明显的短板。")
        suggestions.append(f"接下来 3 天优先补 {weakest.subject_label}，每天至少 1 个时间块。")
    if pending_review_count > 8:
        weaknesses.append("待复盘项目积压较多，知识回收速度偏慢。")
        suggestions.append("先消化高优先 review items，再扩充新增练习量。")
    if not strengths and not weaknesses:
        suggestions.append("先完成一场练习并提交结果，系统再生成稳定诊断。")
    return ProgressDiagnosisResponseV2(
        strengths=strengths,
        weaknesses=weaknesses,
        suggestions=suggestions,
        generated_at=now_utc(),
    )


def build_plan_window_summary(
    *,
    events: list,
    practice_minutes_total: int,
) -> DashboardPlanWindowSummaryV2:
    total_events = len(events)
    event_minutes_total = sum(
        int((event.end_at - event.start_at).total_seconds() // 60)
        for event in events
    )
    done_count = sum(1 for event in events if event.status == "done")
    return DashboardPlanWindowSummaryV2(
        total_events=total_events,
        planned_count=sum(1 for event in events if event.status == "planned"),
        in_progress_count=sum(1 for event in events if event.status == "in_progress"),
        done_count=done_count,
        skipped_count=sum(1 for event in events if event.status == "skipped"),
        event_minutes_total=event_minutes_total,
        practice_minutes_total=practice_minutes_total,
        completion_rate=quantize_ratio(done_count, total_events),
    )


def _resolve_plan_for_slice(session: Session, *, user: UserV2, plan_id: int | None) -> PlanV2 | None:
    if plan_id is None:
        return load_active_plan(session, user_id=user.id)
    plan = session.scalar(
        select(PlanV2).where(
            PlanV2.id == plan_id,
            PlanV2.user_id == user.id,
            PlanV2.deleted_at.is_(None),
        )
    )
    if plan is None:
        raise NotFoundError("plan not found", code="plan_not_found")
    return plan
