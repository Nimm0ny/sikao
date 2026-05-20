from __future__ import annotations

from sikao_api.db.schemas_v2 import ActionLinkV2, DashboardTodayResponseV2, DashboardWeeklyPlanResponseV2, OverviewResponseV2, SectionCardV2, SummaryMetricV2


def build_dashboard_overview() -> OverviewResponseV2:
    return OverviewResponseV2(
        summary=[
            SummaryMetricV2(key="today", label="Today", value="0 tasks"),
            SummaryMetricV2(key="week", label="Week", value="0 plans"),
        ],
        sections=[
            SectionCardV2(key="today", title="今日任务", description="进入今日任务链路。", status="empty", href="/dashboard/today"),
            SectionCardV2(key="week", title="本周计划", description="查看本周计划骨架。", status="empty", href="/dashboard/weekly-plan"),
        ],
        actions=[
            ActionLinkV2(key="today", label="打开今日任务", href="/dashboard/today"),
            ActionLinkV2(key="plan", label="打开本周计划", href="/dashboard/weekly-plan"),
        ],
    )


def build_dashboard_today() -> DashboardTodayResponseV2:
    return DashboardTodayResponseV2(
        summary=[SummaryMetricV2(key="must-do", label="Must-do", value="0")],
        sections=[
            SectionCardV2(key="must-do", title="今日必做", description="空任务链路骨架。", status="empty", href="/dashboard/today/must-do"),
            SectionCardV2(key="continue", title="继续练习", description="空继续练习骨架。", status="empty", href="/dashboard/today/continue"),
            SectionCardV2(key="review", title="推荐复盘", description="空推荐复盘骨架。", status="empty", href="/dashboard/today/review"),
        ],
        actions=[
            ActionLinkV2(key="must-do", label="今日必做", href="/dashboard/today/must-do"),
            ActionLinkV2(key="continue", label="继续练习", href="/dashboard/today/continue"),
            ActionLinkV2(key="review", label="推荐复盘", href="/dashboard/today/review"),
        ],
    )


def build_dashboard_weekly_plan() -> DashboardWeeklyPlanResponseV2:
    return DashboardWeeklyPlanResponseV2(
        summary=[SummaryMetricV2(key="week-target", label="Week target", value="0h")],
        sections=[
            SectionCardV2(key="goal", title="本周目标", description="本周目标骨架。", status="empty", href="/dashboard/weekly-plan/goal"),
            SectionCardV2(key="completion", title="今日完成度", description="今日完成度骨架。", status="empty", href="/dashboard/weekly-plan/today-completion"),
            SectionCardV2(key="adjust", title="调整计划", description="调整计划骨架。", status="empty", href="/dashboard/weekly-plan/adjust"),
        ],
        actions=[
            ActionLinkV2(key="goal", label="本周目标", href="/dashboard/weekly-plan/goal"),
            ActionLinkV2(key="completion", label="今日完成度", href="/dashboard/weekly-plan/today-completion"),
            ActionLinkV2(key="adjust", label="调整计划", href="/dashboard/weekly-plan/adjust"),
        ],
    )
