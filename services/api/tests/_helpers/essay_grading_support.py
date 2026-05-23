from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from sikao_api.db.models import Paper, PaperBlock, PaperRevision, PaperSection, Question, User


def seed_essay_question(
    session: Session,
    *,
    type_payload: dict[str, Any] | None = None,
    user: User | None = None,
) -> tuple[User, Question]:
    if user is None:
        user = User(username="alice", display_name="Alice", password_hash="x")
        session.add(user)
        session.flush()

    paper = Paper(paper_code="ESSAY-T", paper_name="t")
    session.add(paper)
    session.flush()
    revision = PaperRevision(
        paper_id=paper.id,
        revision_number=1,
        sort_order=1,
        paper_name="t",
        question_count=1,
        source_hash="test-hash-essay",
    )
    session.add(revision)
    session.flush()
    section = PaperSection(
        paper_revision_id=revision.id,
        section_key="s1",
        title="申论",
        instruction_text="",
        display_order=1,
        question_count=1,
    )
    session.add(section)
    session.flush()
    block = PaperBlock(
        paper_revision_id=revision.id,
        section_id=section.id,
        block_type="question",
        display_order=1,
    )
    session.add(block)
    session.flush()

    payload = type_payload or {
        "materialTexts": ["材料一 ...", "材料二..."],
        "wordLimitMin": 800,
        "wordLimitMax": 1000,
        "fullScore": 40,
    }
    question = Question(
        paper_revision_id=revision.id,
        section_id=section.id,
        block_id=block.id,
        position=1,
        source_uuid="essay-q1",
        question_kind="essay",
        subtype_name="申论",
        stem_text="<p>题干</p>",
        answer_text="",
        renderer_key="essay",
        is_gradable=False,
        type_payload_json=payload,
    )
    session.add(question)
    session.flush()
    return user, question
