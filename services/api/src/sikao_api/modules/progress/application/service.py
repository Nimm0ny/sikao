from __future__ import annotations

from sikao_api.db.schemas_v2 import ActionLinkV2, DashboardProgressResponseV2, OverviewResponseV2, SectionCardV2, SummaryMetricV2


def build_progress_overview() -> DashboardProgressResponseV2:
    return DashboardProgressResponseV2(
        summary=[
            SummaryMetricV2(key="trend", label="Trend", value="empty"),
            SummaryMetricV2(key="weakness", label="Weakness", value="empty"),
        ],
        sections=[
            SectionCardV2(key="trend", title="能力趋势", description="空趋势骨架。", status="empty", href="/dashboard/progress/trend"),
            SectionCardV2(key="weakness", title="弱项提醒", description="空弱项骨架。", status="empty", href="/dashboard/progress/weakness"),
            SectionCardV2(key="diagnosis", title="最近诊断", description="空诊断骨架。", status="empty", href="/dashboard/progress/diagnosis"),
        ],
        actions=[
            ActionLinkV2(key="trend", label="能力趋势", href="/dashboard/progress/trend"),
            ActionLinkV2(key="weakness", label="弱项提醒", href="/dashboard/progress/weakness"),
            ActionLinkV2(key="diagnosis", label="最近诊断", href="/dashboard/progress/diagnosis"),
        ],
    )


def build_progress_leaf(title: str, href: str) -> OverviewResponseV2:
    return OverviewResponseV2(
        summary=[SummaryMetricV2(key="state", label=title, value="empty")],
        sections=[SectionCardV2(key="state", title=title, description="Phase 1 progress skeleton.", status="empty", href=href)],
        actions=[ActionLinkV2(key="back", label="返回进度", href="/dashboard/progress")],
    )
