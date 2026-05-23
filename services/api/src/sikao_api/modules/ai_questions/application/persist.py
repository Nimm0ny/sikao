from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2
from sikao_api.modules.ai_questions.domain.types import GeneratedQuestionCandidate


def _build_content_json(candidate: GeneratedQuestionCandidate) -> dict[str, object]:
    return {
        "stem": candidate.question.stem,
        "options": candidate.question.options,
        "correct_answer": candidate.question.correct_answer,
        "explanation": candidate.question.explanation,
    }


def save_with_dedupe(
    session: Session,
    *,
    generated_questions: list[GeneratedQuestionCandidate],
    excluded_existing_ids: set[int] | None = None,
) -> list[int]:
    saved_ids: list[int] = []
    next_item_no_by_revision: dict[int, int] = {}
    generated_at = datetime.now(UTC).replace(tzinfo=None)

    for candidate in generated_questions:
        content_json = _build_content_json(candidate)
        content_hash = compute_question_content_hash(
            candidate.question.stem,
            content_json,
        )
        existing = session.scalar(
            select(QuestionV2).where(QuestionV2.content_hash == content_hash)
        )
        if existing is not None:
            if excluded_existing_ids is not None and existing.id in excluded_existing_ids:
                continue
            saved_ids.append(existing.id)
            continue

        source_revision_id = _ensure_ai_anchor_revision_id(
            session,
            track=candidate.source.subject_kind,
        )
        if source_revision_id not in next_item_no_by_revision:
            current_max = session.scalar(
                select(func.max(QuestionV2.item_no)).where(
                    QuestionV2.revision_id == source_revision_id
                )
            )
            next_item_no_by_revision[source_revision_id] = int(current_max or 0) + 1

        new_question = QuestionV2(
            revision_id=source_revision_id,
            section_id=None,
            block_id=None,
            material_group_id=None,
            item_no=next_item_no_by_revision[source_revision_id],
            subject_kind=candidate.source.subject_kind,
            prompt=candidate.question.stem,
            answer_kind=candidate.question.type,
            status="published",
            content_json=content_json,
            source="ai_generated",
            year=candidate.source.year,
            region=candidate.source.region,
            exam_type=candidate.source.exam_type or "other",
            category_l1=candidate.source.category_l1 or "uncategorized",
            category_l2=candidate.source.category_l2,
            historical_accuracy=candidate.question.estimated_difficulty or 0.0,
            answer_count=0,
            quality_score=5.0,
            report_count=0,
            is_active=True,
            content_hash=content_hash,
            ai_source_question_id=candidate.source.id,
            ai_self_audit_passed=True,
            ai_generated_at=generated_at,
        )
        session.add(new_question)
        session.flush()
        saved_ids.append(new_question.id)
        next_item_no_by_revision[source_revision_id] += 1

    return saved_ids


def _ensure_ai_anchor_revision_id(session: Session, *, track: str) -> int:
    paper_code = f"__AI_GENERATED_POOL_{track.upper()}__"
    paper = session.scalar(select(PaperV2).where(PaperV2.paper_code == paper_code))
    if paper is None:
        paper = PaperV2(
            paper_code=paper_code,
            title=f"AI Generated Pool ({track})",
            subject_kind=track,
        )
        session.add(paper)
        session.flush()
    revision = session.scalar(
        select(PaperRevisionV2)
        .where(PaperRevisionV2.paper_id == paper.id)
        .order_by(PaperRevisionV2.revision_number.desc(), PaperRevisionV2.id.desc())
    )
    if revision is None:
        revision = PaperRevisionV2(
            paper_id=paper.id,
            revision_number=1,
            status="draft",
        )
        session.add(revision)
        session.flush()
    return revision.id
