from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import (
    DailyPlanItemV2,
    DailyPlanV2,
    PracticeSessionV2,
    UserV2,
    WeeklyPlanV2,
)
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    DashboardTodayResponseV2,
    DashboardWeeklyPlanResponseV2,
    OverviewResponseV2,
    SectionCardV2,
    SummaryMetricV2,
)


def _today_cn() -> date:
    return (datetime.now(UTC) + timedelta(hours=8)).date()


def _load_today_plan(session: Session, *, user: UserV2) -> DailyPlanV2 | None:
    return session.scalar(
        select(DailyPlanV2).where(
            DailyPlanV2.user_id == user.id,
            DailyPlanV2.plan_date == _today_cn(),
        )
    )


def _load_today_items(session: Session, *, daily_plan_id: int) -> list[DailyPlanItemV2]:
    return list(
        session.scalars(
            select(DailyPlanItemV2)
            .where(DailyPlanItemV2.daily_plan_id == daily_plan_id)
            .order_by(DailyPlanItemV2.display_order.asc())
        )
    )


def _load_weekly_plan(session: Session, *, user: UserV2) -> WeeklyPlanV2 | None:
    monday = _today_cn() - timedelta(days=_today_cn().weekday())
    return session.scalar(
        select(WeeklyPlanV2).where(
            WeeklyPlanV2.user_id == user.id,
            WeeklyPlanV2.week_start == monday,
        )
    )


def _load_continue_session(session: Session, *, user: UserV2) -> PracticeSessionV2 | None:
    return session.scalar(
        select(PracticeSessionV2)
        .where(
            PracticeSessionV2.user_id == user.id,
            PracticeSessionV2.status.in_(("draft", "in_progress")),
        )
        .order_by(PracticeSessionV2.started_at.desc(), PracticeSessionV2.id.desc())
    )


def build_dashboard_overview(
    session: Session,
    *,
    user: UserV2,
) -> OverviewResponseV2:
    daily_plan = _load_today_plan(session, user=user)
    today_items = _load_today_items(session, daily_plan_id=daily_plan.id) if daily_plan else []
    weekly_plan = _load_weekly_plan(session, user=user)
    weekly_summary = weekly_plan.summary_json if weekly_plan is not None else {}
    return OverviewResponseV2(
        summary=[
            SummaryMetricV2(key="today", label="Today", value=str(len(today_items))),
            SummaryMetricV2(
                key="week",
                label="Week",
                value=str(int(weekly_summary.get("dailyPlanCount", 0))),
            ),
        ],
        sections=[
            SectionCardV2(
                key="today",
                title="今日任务",
                description=f"{len(today_items)} 项任务",
                status="ready" if today_items else "empty",
                href="/dashboard/today",
            ),
            SectionCardV2(
                key="week",
                title="本周计划",
                description=f"{int(weekly_summary.get('totalItems', 0))} 项总任务",
                status="ready" if weekly_plan is not None else "empty",
                href="/dashboard/weekly-plan",
            ),
        ],
        actions=[
            ActionLinkV2(key="today", label="打开今日任务", href="/dashboard/today"),
            ActionLinkV2(key="plan", label="打开本周计划", href="/dashboard/weekly-plan"),
        ],
    )


def build_dashboard_today(
    session: Session,
    *,
    user: UserV2,
) -> DashboardTodayResponseV2:
    daily_plan = _load_today_plan(session, user=user)
    items = _load_today_items(session, daily_plan_id=daily_plan.id) if daily_plan else []
    pending = [item for item in items if item.state != "completed"]
    return DashboardTodayResponseV2(
        summary=[SummaryMetricV2(key="must-do", label="Must-do", value=str(len(pending)))],
        sections=[
            SectionCardV2(
                key=item.item_kind,
                title=item.title,
                description=item.summary,
                status=item.state,
                href="/plan",
            )
            for item in items
        ],
        actions=[ActionLinkV2(key="plan", label="打开计划", href="/plan")],
    )


def build_dashboard_today_leaf(
    session: Session,
    *,
    user: UserV2,
    key: str,
    title: str,
) -> OverviewResponseV2:
    daily_plan = _load_today_plan(session, user=user)
    items = _load_today_items(session, daily_plan_id=daily_plan.id) if daily_plan else []
    matched = [item for item in items if item.item_kind == key]
    return OverviewResponseV2(
        summary=[SummaryMetricV2(key="count", label=title, value=str(len(matched)))],
        sections=[
            SectionCardV2(
                key=item.item_kind,
                title=item.title,
                description=item.summary,
                status=item.state,
                href="/plan",
            )
            for item in matched
        ],
        actions=[ActionLinkV2(key="back", label="返回计划", href="/plan")],
    )


def build_dashboard_continue(
    session: Session,
    *,
    user: UserV2,
) -> OverviewResponseV2:
    practice_session = _load_continue_session(session, user=user)
    if practice_session is None:
        return OverviewResponseV2(
            summary=[SummaryMetricV2(key="count", label="Continue", value="0")],
            sections=[],
            actions=[
                ActionLinkV2(
                    key="practice-center",
                    label="打开练习中心",
                    href="/practice/center",
                )
            ],
        )
    href = f"/practice/sessions/{practice_session.id}"
    return OverviewResponseV2(
        summary=[SummaryMetricV2(key="count", label="Continue", value="1")],
        sections=[
            SectionCardV2(
                key="continue",
                title="继续练习",
                description=f"{practice_session.track} / {practice_session.entry_kind}",
                status="ready",
                href=href,
            )
        ],
        actions=[ActionLinkV2(key="continue", label="继续练习", href=href)],
    )


def build_dashboard_weekly_plan(
    session: Session,
    *,
    user: UserV2,
) -> DashboardWeeklyPlanResponseV2:
    weekly_plan = _load_weekly_plan(session, user=user)
    summary_json = weekly_plan.summary_json if weekly_plan is not None else {}
    total_items = int(summary_json.get("totalItems", 0))
    completed_items = int(summary_json.get("completedItems", 0))
    return DashboardWeeklyPlanResponseV2(
        summary=[SummaryMetricV2(key="week-target", label="Week target", value=str(total_items))],
        sections=[
            SectionCardV2(
                key="goal",
                title="本周目标",
                description=f"{total_items} 项总任务",
                status="ready" if weekly_plan is not None else "empty",
                href="/dashboard/weekly-plan/goal",
            ),
            SectionCardV2(
                key="completion",
                title="今日完成度",
                description=f"{completed_items}/{total_items} 已完成",
                status="ready" if total_items > 0 else "empty",
                href="/dashboard/weekly-plan/today-completion",
            ),
            SectionCardV2(
                key="adjust",
                title="调整计划",
                description="如需调整，重新生成周计划。",
                status="ready" if weekly_plan is not None else "empty",
                href="/dashboard/weekly-plan/adjust",
            ),
        ],
        actions=[
            ActionLinkV2(key="goal", label="本周目标", href="/dashboard/weekly-plan/goal"),
            ActionLinkV2(
                key="completion",
                label="今日完成度",
                href="/dashboard/weekly-plan/today-completion",
            ),
            ActionLinkV2(key="adjust", label="调整计划", href="/dashboard/weekly-plan/adjust"),
        ],
    )


def build_dashboard_weekly_leaf(
    session: Session,
    *,
    user: UserV2,
    key: str,
    title: str,
) -> OverviewResponseV2:
    weekly_plan = _load_weekly_plan(session, user=user)
    summary_json = weekly_plan.summary_json if weekly_plan is not None else {}
    value = (
        summary_json.get("totalItems", 0)
        if key == "goal"
        else summary_json.get("completedItems", 0)
    )
    return OverviewResponseV2(
        summary=[SummaryMetricV2(key=key, label=title, value=str(int(value)))],
        sections=[
            SectionCardV2(
                key=key,
                title=title,
                description="V2 weekly plan view",
                status="ready" if weekly_plan is not None else "empty",
                href="/dashboard/weekly-plan",
            )
        ],
        actions=[ActionLinkV2(key="back", label="返回周计划", href="/dashboard/weekly-plan")],
    )
