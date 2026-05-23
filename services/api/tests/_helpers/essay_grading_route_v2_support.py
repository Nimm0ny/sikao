from __future__ import annotations

from typing import Any, cast

from _helpers.llm_stubs import (
    well_formed_essay_payload,
    well_formed_reference_answer_payload,
    well_formed_reference_audit_payload,
)
from sikao_api.db.models_v2 import EssayReferenceAnswerV2, PaperRevisionV2, PaperV2, QuestionV2
from sikao_api.modules.llm.application.essay_grader import EssayGradingTrace
from sikao_api.modules.llm.application.parsers.grading_parser import parse_grading_output
from sikao_api.modules.llm.application.parsers.reference_parser import (
    ReferenceAnswerAuditResult,
    ReferenceAnswerPayload,
    parse_reference_answer,
    parse_reference_answer_audit,
)
from sikao_api.modules.llm.application.reference_answer_generator import (
    ReferenceAnswer,
    ReferenceAnswerTrace,
)
from sikao_api.modules.system.application.errors import LLMServiceError


def seed_essay_question(client: Any, *, paper_code: str) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        paper = PaperV2(
            paper_code=paper_code,
            title=paper_code,
            subject_kind="essay",
        )
        session.add(paper)
        session.flush()
        revision = PaperRevisionV2(
            paper_id=paper.id,
            revision_number=1,
            status="published",
        )
        session.add(revision)
        session.flush()
        question = QuestionV2(
            revision_id=revision.id,
            item_no=1,
            subject_kind="essay",
            prompt="请结合材料谈谈你的理解。",
            answer_kind="essay",
            status="published",
            content_json={
                "materialTexts": ["材料一：基层治理需要协同。", "材料二：数字化不是目的而是手段。"],
                "wordLimitMin": 800,
                "wordLimitMax": 1000,
                "fullScore": 40,
            },
            source="real_exam",
            year=2024,
            region="beijing",
            exam_type="provincial",
            category_l1="essay",
            category_l2="policy_analysis",
        )
        session.add(question)
        session.commit()
        return int(question.id)


def create_and_submit_essay_session(
    client: Any,
    *,
    paper_code: str,
    answer_text: str,
) -> int:
    create = client.post(
        "/api/v2/practice/sessions",
        json={
            "track": "essay",
            "entryKind": "paper",
            "paperCode": paper_code,
            "payload": {},
            "practiceMode": "full_set",
        },
    )
    assert create.status_code == 200, create.text
    body = create.json()
    session_id = int(body["id"])
    answer_key = body["items"][0]["questionKey"]

    save = client.post(
        f"/api/v2/practice/sessions/{session_id}/answers",
        json={
            "answers": [
                {
                    "questionKey": answer_key,
                    "answer": {"text": answer_text},
                    "durationSeconds": 120,
                }
            ]
        },
    )
    assert save.status_code == 200, save.text

    submit = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
    assert submit.status_code == 200, submit.text
    return session_id


def seed_reference_answer(
    client: Any,
    *,
    question_id: int,
    source: str,
    status: str,
    quality_score: float,
    content: str = "参考范文",
) -> int:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        row = EssayReferenceAnswerV2(
            question_id=question_id,
            content=content,
            source=source,
            status=status,
            quality_score=quality_score,
        )
        session.add(row)
        session.commit()
        return int(row.id)


async def fake_grade_success(*args: Any, **kwargs: Any) -> EssayGradingTrace:
    del args
    user = kwargs["user"]
    question_stem = kwargs["question_stem"]
    materials = kwargs["materials"]
    user_answer = kwargs["user_answer"]
    word_limit_min = kwargs["word_limit_min"]
    word_limit_max = kwargs["word_limit_max"]
    full_score = kwargs["full_score"]
    assert user is not None
    assert question_stem
    assert materials
    assert user_answer
    assert word_limit_min == 800
    assert word_limit_max == 1000
    assert full_score == 40
    payload_text = well_formed_essay_payload()
    return EssayGradingTrace(
        payload=parse_grading_output(payload_text),
        raw_text=payload_text,
        usage={
            "prompt_tokens": 10,
            "prompt_cache_hit_tokens": 0,
            "prompt_cache_miss_tokens": 10,
            "completion_tokens": 20,
        },
        provider="mock",
        model="mock-essay-grader",
        messages=[],
        prompt_version="essay_grading@v1",
        llm_call_id=123,
    )


async def fake_grade_failure(*args: Any, **kwargs: Any) -> EssayGradingTrace:
    del args, kwargs
    raise LLMServiceError("upstream timeout", code="llm_service_unavailable")


def noop_store_replay(*args: Any, **kwargs: Any) -> None:
    del args, kwargs


async def fake_reference_success(*args: Any, **kwargs: Any) -> ReferenceAnswerTrace:
    del args
    payload_text = well_formed_reference_answer_payload()
    audit_text = well_formed_reference_audit_payload()
    payload: ReferenceAnswerPayload = parse_reference_answer(payload_text)
    audit: ReferenceAnswerAuditResult = parse_reference_answer_audit(audit_text)
    result = ReferenceAnswer(
        content=payload.content,
        structure_outline=list(payload.structure_outline),
        key_points=list(payload.key_points),
        estimated_score=payload.estimated_score,
        ai_self_audit_passed=True,
        audit_reason=audit.reason,
    )
    return ReferenceAnswerTrace(
        result=result,
        generation_payload=payload,
        audit_result=audit,
        raw_text=payload_text,
        audit_raw_text=audit_text,
        usage={"prompt_tokens": 10, "prompt_cache_hit_tokens": 0, "prompt_cache_miss_tokens": 10, "completion_tokens": 20},
        audit_usage={"prompt_tokens": 5, "prompt_cache_hit_tokens": 0, "prompt_cache_miss_tokens": 5, "completion_tokens": 10},
        provider="mock",
        model="mock-reference",
        messages=[],
        prompt_version="reference_answer@v1",
        audit_provider="mock",
        audit_model="mock-reference-audit",
        audit_messages=[],
        audit_prompt_version="reference_answer_self_audit@v1",
    )


async def fake_reference_archived(*args: Any, **kwargs: Any) -> ReferenceAnswerTrace:
    trace = await fake_reference_success(*args, **kwargs)
    return ReferenceAnswerTrace(
        result=ReferenceAnswer(
            content=trace.result.content,
            structure_outline=list(trace.result.structure_outline),
            key_points=list(trace.result.key_points),
            estimated_score=trace.result.estimated_score,
            ai_self_audit_passed=False,
            audit_reason="self audit failed",
        ),
        generation_payload=trace.generation_payload,
        audit_result=parse_reference_answer_audit(
            well_formed_reference_audit_payload(passed=False, reason="self audit failed")
        ),
        raw_text=trace.raw_text,
        audit_raw_text=well_formed_reference_audit_payload(
            passed=False,
            reason="self audit failed",
        ),
        usage=trace.usage,
        audit_usage=trace.audit_usage,
        provider=trace.provider,
        model=trace.model,
        messages=trace.messages,
        prompt_version=trace.prompt_version,
        audit_provider=trace.audit_provider,
        audit_model=trace.audit_model,
        audit_messages=trace.audit_messages,
        audit_prompt_version=trace.audit_prompt_version,
    )
