from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, aliased

from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2
from sikao_api.db.schemas_v2 import (
    ActionLinkV2,
    CatalogItemV2,
    CatalogListResponseV2,
    PracticeCenterResponseV2,
    SectionCardV2,
    SummaryMetricV2,
)
from sikao_api.modules.content.application.completion_query import load_paper_completion_metrics
from sikao_api.modules.system.application.errors import ValidationError


DifficultyFilter = Literal["easy", "medium", "hard"]
PaperSort = Literal["year_desc", "difficulty", "recent"]


@dataclass(frozen=True)
class CategoryQuery:
    subject_kind: Literal["xingce", "essay"]
    level: int
    category_l1: str | None = None


@dataclass(frozen=True)
class PaperQuery:
    subject_kind: Literal["xingce", "essay"]
    category_l1: str | None = None
    category_l2: str | None = None
    year: int | None = None
    region: str | None = None
    exam_type: str | None = None
    difficulty: DifficultyFilter | None = None
    sort: PaperSort = "year_desc"


@dataclass(frozen=True)
class PaperRow:
    paper_id: int
    paper_code: str
    title: str
    year: int | None
    region: str | None
    exam_type: str | None
    question_count: int
    avg_accuracy: float | None

    @property
    def difficulty(self) -> str | None:
        if self.avg_accuracy is None:
            return None
        if self.avg_accuracy >= 0.7:
            return "easy"
        if self.avg_accuracy >= 0.4:
            return "medium"
        return "hard"


def build_practice_center_overview(session: Session) -> PracticeCenterResponseV2:
    xingce_papers = _count_latest_published_papers(session, subject_kind="xingce")
    essay_papers = _count_latest_published_papers(session, subject_kind="essay")
    xingce_categories = _count_category_l1(session, subject_kind="xingce")
    essay_categories = _count_category_l1(session, subject_kind="essay")
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
                title="Xingce",
                description=f"{xingce_categories} categories / {xingce_papers} papers",
                status="ready" if xingce_papers > 0 else "empty",
                href="/practice/xingce/categories",
            ),
            SectionCardV2(
                key="essay",
                title="Essay",
                description=f"{essay_categories} categories / {essay_papers} papers",
                status="ready" if essay_papers > 0 else "empty",
                href="/practice/essay/categories",
            ),
        ],
        actions=[
            ActionLinkV2(key="xingce-categories", label="Browse Xingce Categories", href="/practice/xingce/categories"),
            ActionLinkV2(key="xingce-papers", label="Browse Xingce Papers", href="/practice/xingce/papers"),
            ActionLinkV2(key="essay-categories", label="Browse Essay Categories", href="/practice/essay/categories"),
            ActionLinkV2(key="essay-papers", label="Browse Essay Papers", href="/practice/essay/papers"),
        ],
    )


def build_xingce_categories(
    session: Session,
    *,
    level: int,
    category_l1: str | None,
) -> CatalogListResponseV2:
    return build_categories(
        session,
        query=CategoryQuery(subject_kind="xingce", level=level, category_l1=category_l1),
    )


def build_essay_categories(
    session: Session,
    *,
    level: int,
    category_l1: str | None,
) -> CatalogListResponseV2:
    return build_categories(
        session,
        query=CategoryQuery(subject_kind="essay", level=level, category_l1=category_l1),
    )


def build_categories(session: Session, *, query: CategoryQuery) -> CatalogListResponseV2:
    scope = _question_scope(query.subject_kind).subquery()
    if query.level == 1:
        stmt = (
            select(
                scope.c.category_l1,
                func.count().label("question_count"),
            )
            .group_by(scope.c.category_l1)
            .order_by(func.count().desc(), scope.c.category_l1.asc())
        )
        rows = session.execute(stmt).all()
        items = [
            CatalogItemV2(
                id=category_l1,
                title=category_l1,
                subtitle=f"{int(question_count)} questions",
                status="ready",
                href=f"/practice/{query.subject_kind}/categories?level=2&category_l1={category_l1}",
                count=int(question_count),
                category_l1=category_l1,
            )
            for category_l1, question_count in rows
            if category_l1
        ]
        return CatalogListResponseV2(items=items, total=len(items), page=1, page_size=max(len(items), 1))

    if query.category_l1 is None:
        raise ValidationError("level=2 requires category_l1", code="content_category_l1_required")

    stmt = (
        select(
            scope.c.category_l2,
            func.count().label("question_count"),
        )
        .where(scope.c.category_l1 == query.category_l1)
        .group_by(scope.c.category_l2)
        .order_by(func.count().desc(), scope.c.category_l2.asc())
    )
    rows = session.execute(stmt).all()
    items = [
        CatalogItemV2(
            id=f"{query.category_l1}:{category_l2 or 'uncategorized'}",
            title=category_l2 or "uncategorized",
            subtitle=f"{int(question_count)} questions",
            status="ready",
            href=_build_category_papers_href(
                subject_kind=query.subject_kind,
                category_l1=query.category_l1,
                category_l2=category_l2,
            ),
            count=int(question_count),
            category_l1=query.category_l1,
            category_l2=category_l2,
        )
        for category_l2, question_count in rows
    ]
    return CatalogListResponseV2(items=items, total=len(items), page=1, page_size=max(len(items), 1))


def build_xingce_papers(
    session: Session,
    *,
    user_id: int | None,
    category_l1: str | None,
    category_l2: str | None,
    year: int | None,
    region: str | None,
    exam_type: str | None,
    difficulty: DifficultyFilter | None,
    sort: PaperSort,
) -> CatalogListResponseV2:
    return build_papers(
        session,
        query=PaperQuery(
            subject_kind="xingce",
            category_l1=category_l1,
            category_l2=category_l2,
            year=year,
            region=region,
            exam_type=exam_type,
            difficulty=difficulty,
            sort=sort,
        ),
        user_id=user_id,
    )


def build_essay_papers(
    session: Session,
    *,
    user_id: int | None,
    category_l1: str | None,
    category_l2: str | None,
    year: int | None,
    region: str | None,
    exam_type: str | None,
    sort: PaperSort,
) -> CatalogListResponseV2:
    return build_papers(
        session,
        query=PaperQuery(
            subject_kind="essay",
            category_l1=category_l1,
            category_l2=category_l2,
            year=year,
            region=region,
            exam_type=exam_type,
            sort=sort,
        ),
        user_id=user_id,
    )


def build_papers(
    session: Session,
    *,
    query: PaperQuery,
    user_id: int | None,
) -> CatalogListResponseV2:
    rows = _load_paper_rows(session, query=query)
    metrics = load_paper_completion_metrics(session, user_id=user_id) if user_id is not None else {}

    if query.sort == "recent":
        epoch = datetime(1970, 1, 1)
        rows.sort(
            key=lambda row: (
                metrics[row.paper_id].last_attempt_at if row.paper_id in metrics else epoch,
                row.year or 0,
                row.title,
            ),
            reverse=True,
        )
    elif query.sort == "difficulty":
        rows.sort(
            key=lambda row: (
                row.avg_accuracy is None,
                -(1.0 - row.avg_accuracy) if row.avg_accuracy is not None else 0.0,
                row.title,
            )
        )
    else:
        rows.sort(key=lambda row: (row.year or 0, row.title), reverse=True)

    items = [
        CatalogItemV2(
            id=row.paper_code,
            paper_code=row.paper_code,
            title=row.title,
            subtitle=_paper_subtitle(row),
            status="completed" if row.paper_id in metrics else "ready",
            href=_paper_href(subject_kind=query.subject_kind, paper_code=row.paper_code),
            category_l1=query.category_l1,
            category_l2=query.category_l2,
            year=row.year,
            region=row.region,
            exam_type=row.exam_type,
            question_count=row.question_count,
            difficulty=row.difficulty,
            is_completed=row.paper_id in metrics,
            best_score=metrics[row.paper_id].best_score if row.paper_id in metrics else None,
            last_attempt_at=metrics[row.paper_id].last_attempt_at if row.paper_id in metrics else None,
        )
        for row in rows
    ]
    return CatalogListResponseV2(items=items, total=len(items), page=1, page_size=max(len(items), 1))


def _load_paper_rows(session: Session, *, query: PaperQuery) -> list[PaperRow]:
    latest = _latest_published_revisions(query.subject_kind).subquery()
    aggregate_question = aliased(QuestionV2)
    filter_question = aliased(QuestionV2)
    avg_accuracy = func.avg(
        case(
            (aggregate_question.historical_accuracy.is_not(None), aggregate_question.historical_accuracy),
            else_=None,
        )
    )
    stmt = (
        select(
            PaperV2.id.label("paper_id"),
            PaperV2.paper_code,
            PaperV2.title,
            func.max(aggregate_question.year).label("exam_year"),
            func.max(aggregate_question.region).label("region"),
            func.max(aggregate_question.exam_type).label("exam_type"),
            func.count(aggregate_question.id).label("question_count"),
            avg_accuracy.label("avg_accuracy"),
        )
        .join(latest, latest.c.paper_id == PaperV2.id)
        .join(aggregate_question, aggregate_question.revision_id == latest.c.revision_id)
        .where(PaperV2.subject_kind == query.subject_kind)
        .group_by(PaperV2.id, PaperV2.paper_code, PaperV2.title)
    )
    stmt = stmt.where(
        _build_paper_filter_exists(
            filter_question=filter_question,
            revision_id_column=latest.c.revision_id,
            query=query,
        )
    )

    rows = [
        PaperRow(
            paper_id=int(row.paper_id),
            paper_code=row.paper_code,
            title=row.title,
            year=row.exam_year,
            region=row.region,
            exam_type=row.exam_type,
            question_count=int(row.question_count),
            avg_accuracy=float(row.avg_accuracy) if row.avg_accuracy is not None else None,
        )
        for row in session.execute(stmt).all()
    ]
    if query.difficulty is not None:
        rows = [row for row in rows if row.difficulty == query.difficulty]
    return rows


def _latest_published_revisions(subject_kind: Literal["xingce", "essay"]) -> Any:
    latest_number = (
        select(
            PaperRevisionV2.paper_id.label("paper_id"),
            func.max(PaperRevisionV2.revision_number).label("revision_number"),
        )
        .join(PaperV2, PaperV2.id == PaperRevisionV2.paper_id)
        .where(
            PaperV2.subject_kind == subject_kind,
            PaperRevisionV2.status == "published",
        )
        .group_by(PaperRevisionV2.paper_id)
        .subquery()
    )
    return (
        select(
            PaperRevisionV2.id.label("revision_id"),
            PaperRevisionV2.paper_id.label("paper_id"),
        )
        .join(
            latest_number,
            and_(
                PaperRevisionV2.paper_id == latest_number.c.paper_id,
                PaperRevisionV2.revision_number == latest_number.c.revision_number,
            ),
        )
    )


def _question_scope(subject_kind: Literal["xingce", "essay"]) -> Any:
    latest = _latest_published_revisions(subject_kind).subquery()
    return (
        select(
            QuestionV2.category_l1.label("category_l1"),
            QuestionV2.category_l2.label("category_l2"),
        )
        .join(latest, latest.c.revision_id == QuestionV2.revision_id)
        .where(
            QuestionV2.category_l1.is_not(None),
            QuestionV2.category_l1 != "",
        )
    )


def _count_latest_published_papers(session: Session, *, subject_kind: Literal["xingce", "essay"]) -> int:
    return int(
        session.scalar(select(func.count()).select_from(_latest_published_revisions(subject_kind).subquery()))
        or 0
    )


def _count_category_l1(session: Session, *, subject_kind: Literal["xingce", "essay"]) -> int:
    scope = _question_scope(subject_kind).subquery()
    return int(session.scalar(select(func.count(func.distinct(scope.c.category_l1)))) or 0)


def _paper_href(*, subject_kind: str, paper_code: str) -> str:
    if subject_kind == "essay":
        return f"/essay/papers/{paper_code}"
    return f"/practice/{paper_code}/start"


def _build_category_papers_href(
    *,
    subject_kind: str,
    category_l1: str,
    category_l2: str | None,
) -> str:
    href = f"/practice/{subject_kind}/papers?category_l1={category_l1}"
    if category_l2:
        href += f"&category_l2={category_l2}"
    return href


def _build_paper_filter_exists(
    *,
    filter_question: Any,
    revision_id_column: Any,
    query: PaperQuery,
) -> Any:
    if query.category_l2 is not None and query.category_l1 is None:
        raise ValidationError(
            "category_l2 requires category_l1",
            code="content_category_l1_required",
        )

    conditions: list[Any] = [filter_question.revision_id == revision_id_column]
    if query.category_l1 is not None:
        conditions.append(filter_question.category_l1 == query.category_l1)
    if query.category_l2 is not None:
        if query.category_l2 == "uncategorized":
            conditions.append(
                or_(
                    filter_question.category_l2.is_(None),
                    filter_question.category_l2 == "",
                )
            )
        else:
            conditions.append(filter_question.category_l2 == query.category_l2)
    if query.year is not None:
        conditions.append(filter_question.year == query.year)
    if query.region is not None:
        conditions.append(filter_question.region == query.region)
    if query.exam_type is not None:
        conditions.append(filter_question.exam_type == query.exam_type)
    return select(filter_question.id).where(*conditions).exists()


def _paper_subtitle(row: PaperRow) -> str:
    parts: list[str] = []
    if row.year is not None:
        parts.append(str(row.year))
    if row.region:
        parts.append(row.region)
    if row.exam_type:
        parts.append(row.exam_type)
    parts.append(f"{row.question_count} questions")
    return " / ".join(parts)
