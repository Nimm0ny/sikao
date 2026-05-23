from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2

from .mapper import ImportPaper


@dataclass(frozen=True)
class ImportPlan:
    action: Literal["create_paper", "create_revision", "skip"]
    paper_code: str
    revision_number: int
    reason: str


def plan_import(session: Session, paper: ImportPaper) -> ImportPlan:
    paper_row = session.scalar(
        select(PaperV2).where(PaperV2.paper_code == paper.paper_code)
    )
    revisions = []
    if paper_row is not None:
        revisions = list(
            session.scalars(
                select(PaperRevisionV2)
                .where(PaperRevisionV2.paper_id == paper_row.id)
                .order_by(PaperRevisionV2.revision_number.asc(), PaperRevisionV2.id.asc())
            )
        )
        for revision in revisions:
            if _revision_signature(session, paper_row, revision) == paper.signature:
                return ImportPlan(
                    action="skip",
                    paper_code=paper.paper_code,
                    revision_number=revision.revision_number,
                    reason="matching_revision_signature",
                )

    wanted_hashes = [question.content_hash for question in paper.questions]
    overlapping_hashes = {
        row[0]
        for row in session.execute(
            select(QuestionV2.content_hash).where(
                QuestionV2.content_hash.in_(wanted_hashes)
            )
        )
        if row[0] is not None
    }
    if overlapping_hashes:
        raise ValueError(
            "partial overlap with existing questions is not supported by the "
            "current V2 schema; overlapping hashes: "
            + ", ".join(sorted(overlapping_hashes))
        )

    if paper_row is None:
        return ImportPlan(
            action="create_paper",
            paper_code=paper.paper_code,
            revision_number=1,
            reason="paper_code_not_found",
        )

    next_revision = (revisions[-1].revision_number if revisions else 0) + 1
    return ImportPlan(
        action="create_revision",
        paper_code=paper.paper_code,
        revision_number=next_revision,
        reason="new_revision_signature",
    )


def apply_import_plan(session: Session, paper: ImportPaper, plan: ImportPlan) -> dict[str, int | str]:
    paper_row = session.scalar(
        select(PaperV2).where(PaperV2.paper_code == paper.paper_code)
    )
    if paper_row is None:
        paper_row = PaperV2(
            paper_code=paper.paper_code,
            title=paper.title,
            subject_kind=paper.subject_kind,
        )
        session.add(paper_row)
        session.flush()
    else:
        paper_row.title = paper.title
        paper_row.subject_kind = paper.subject_kind

    revision = PaperRevisionV2(
        paper_id=paper_row.id,
        revision_number=plan.revision_number,
        status=paper.revision_status,
    )
    session.add(revision)
    session.flush()

    for question in paper.questions:
        session.add(
            QuestionV2(
                revision_id=revision.id,
                item_no=question.item_no,
                subject_kind=paper.subject_kind,
                prompt=question.prompt,
                answer_kind=question.answer_kind,
                status=question.status,
                content_json=question.content_json,
                source=question.source,
                year=question.year,
                region=question.region,
                exam_type=question.exam_type,
                category_l1=question.category_l1,
                category_l2=question.category_l2,
                historical_accuracy=question.historical_accuracy,
                answer_count=question.answer_count,
                quality_score=question.quality_score,
                report_count=question.report_count,
                is_active=question.is_active,
                content_hash=question.content_hash,
                ai_source_question_id=question.ai_source_question_id,
                ai_self_audit_passed=question.ai_self_audit_passed,
                ai_generated_at=question.ai_generated_at,
                ability_dimensions=question.ability_dimensions,
                discrimination_index=question.discrimination_index,
                heat_score=question.heat_score,
                complexity_level=question.complexity_level,
                knowledge_tags=question.knowledge_tags,
            )
        )
    session.flush()
    return {
        "paper_code": paper.paper_code,
        "revision_number": revision.revision_number,
        "question_count": len(paper.questions),
    }
def _revision_signature(session: Session, paper: PaperV2, revision: PaperRevisionV2) -> str:
    questions = list(
        session.scalars(
            select(QuestionV2)
            .where(QuestionV2.revision_id == revision.id)
            .order_by(QuestionV2.item_no.asc())
        )
    )
    payload = {
        "paper_code": paper.paper_code,
        "title": paper.title,
        "subject_kind": paper.subject_kind,
        "revision_status": revision.status,
        "questions": [
            {
                "item_no": question.item_no,
                "prompt": question.prompt,
                "content_hash": question.content_hash,
                "answer_kind": question.answer_kind,
                "status": question.status,
                "source": question.source,
                "year": question.year,
                "region": question.region,
                "exam_type": question.exam_type,
                "category_l1": question.category_l1,
                "category_l2": question.category_l2,
                "historical_accuracy": question.historical_accuracy,
                "answer_count": question.answer_count,
                "quality_score": question.quality_score,
                "report_count": question.report_count,
                "ai_source_question_id": question.ai_source_question_id,
                "ai_self_audit_passed": question.ai_self_audit_passed,
                "ai_generated_at": (
                    question.ai_generated_at.isoformat()
                    if question.ai_generated_at is not None
                    else None
                ),
                "ability_dimensions": question.ability_dimensions,
                "discrimination_index": question.discrimination_index,
                "heat_score": question.heat_score,
                "complexity_level": question.complexity_level,
                "knowledge_tags": question.knowledge_tags,
                "is_active": question.is_active,
            }
            for question in questions
        ],
    }
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
