from __future__ import annotations

from sikao_api.db.schemas_v2 import ActionLinkV2, CatalogListResponseV2, CatalogItemV2, PracticeCenterResponseV2, SectionCardV2, SummaryMetricV2


def build_practice_center_overview() -> PracticeCenterResponseV2:
    return PracticeCenterResponseV2(
        summary=[
            SummaryMetricV2(key="tracks", label="Tracks", value="2"),
            SummaryMetricV2(key="collections", label="Collections", value="4"),
        ],
        sections=[
            SectionCardV2(
                key="xingce",
                title="行测",
                description="分类练习与套卷练习入口",
                status="empty",
                href="/practice/center/xingce/categories",
            ),
            SectionCardV2(
                key="essay",
                title="申论",
                description="专项练习与套卷练习入口",
                status="empty",
                href="/practice/center/essay/categories",
            ),
        ],
        actions=[
            ActionLinkV2(key="xingce-categories", label="行测分类练习", href="/practice/center/xingce/categories"),
            ActionLinkV2(key="xingce-papers", label="行测套卷练习", href="/practice/center/xingce/papers"),
            ActionLinkV2(key="essay-categories", label="申论专项练习", href="/practice/center/essay/categories"),
            ActionLinkV2(key="essay-papers", label="申论套卷练习", href="/practice/center/essay/papers"),
        ],
    )


def build_empty_catalog(*, href_prefix: str) -> CatalogListResponseV2:
    return CatalogListResponseV2(items=[], total=0, page=1, page_size=20)
