from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperV2, QuestionV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    CatalogListResponseV2,
    CatalogItemV2,
    PracticeCenterResponseV2,
    SectionCardV2,
    SummaryMetricV2,
)


def build_practice_center_overview(session: Session) -> PracticeCenterResponseV2:
    xingce_papers = session.scalar(
        select(func.count()).select_from(PaperV2).where(PaperV2.subject_kind == "xingce")
    ) or 0
    essay_papers = session.scalar(
        select(func.count()).select_from(PaperV2).where(PaperV2.subject_kind == "essay")
    ) or 0
    xingce_categories = session.scalar(
        select(func.count(func.distinct(QuestionV2.subject_kind))).where(
            QuestionV2.subject_kind.notin_(["申论", "未知"])
        )
    ) or 0
    essay_categories = 1 if essay_papers > 0 else 0
    return PracticeCenterResponseV2(
        summary=[
            SummaryMetricV2(key="tracks", label="Tracks", value="2"),
            SummaryMetricV2(
                key="collections",
                label="Collections",
                value=str(xingce_categories + essay_categories),
            ),
        ],
        sections=[
            SectionCardV2(
                key="xingce",
                title="行测",
                description=f"{xingce_categories} 类 / {xingce_papers} 套",
                status="ready" if xingce_papers > 0 else "empty",
                href="/practice/center/xingce/categories",
            ),
            SectionCardV2(
                key="essay",
                title="申论",
                description=f"{essay_categories} 类 / {essay_papers} 套",
                status="ready" if essay_papers > 0 else "empty",
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


def build_xingce_categories(session: Session) -> CatalogListResponseV2:
    rows = session.execute(
        select(QuestionV2.subject_kind, func.count())
        .where(QuestionV2.subject_kind.notin_(["申论", "未知"]))
        .group_by(QuestionV2.subject_kind)
        .order_by(func.count().desc(), QuestionV2.subject_kind.asc())
    ).all()
    items = [
        CatalogItemV2(
            id=subject_kind,
            title=subject_kind,
            subtitle=f"{count} 题",
            status="ready",
            href=f"/practice/center/xingce/categories?subject={subject_kind}",
        )
        for subject_kind, count in rows
    ]
    return CatalogListResponseV2(items=items, total=len(items), page=1, page_size=20)


def build_xingce_papers(session: Session) -> CatalogListResponseV2:
    rows = session.scalars(
        select(PaperV2)
        .where(PaperV2.subject_kind == "xingce")
        .order_by(PaperV2.title.asc())
    ).all()
    items = [
        CatalogItemV2(
            id=paper.paper_code,
            title=paper.title,
            subtitle=paper.paper_code,
            status="ready",
            href=f"/practice/{paper.paper_code}/start",
        )
        for paper in rows
    ]
    return CatalogListResponseV2(items=items, total=len(items), page=1, page_size=20)


def build_essay_categories(session: Session) -> CatalogListResponseV2:
    count = session.scalar(
        select(func.count()).select_from(QuestionV2).where(QuestionV2.subject_kind == "申论")
    ) or 0
    items = []
    if count > 0:
        items.append(
            CatalogItemV2(
                id="essay",
                title="申论",
                subtitle=f"{count} 题",
                status="ready",
                href="/practice/center/essay/categories?subject=essay",
            )
        )
    return CatalogListResponseV2(items=items, total=len(items), page=1, page_size=20)


def build_essay_papers(session: Session) -> CatalogListResponseV2:
    rows = session.scalars(
        select(PaperV2)
        .where(PaperV2.subject_kind == "essay")
        .order_by(PaperV2.title.asc())
    ).all()
    items = [
        CatalogItemV2(
            id=paper.paper_code,
            title=paper.title,
            subtitle=paper.paper_code,
            status="ready",
            href=f"/essay/papers/{paper.paper_code}",
        )
        for paper in rows
    ]
    return CatalogListResponseV2(items=items, total=len(items), page=1, page_size=20)
