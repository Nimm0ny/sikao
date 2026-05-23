from __future__ import annotations

from time import perf_counter

from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.modules.ai_questions.domain.errors import AI_AUDIT_FAILED, NO_SOURCE_QUESTIONS
from sikao_api.modules.ai_questions.domain.types import AiGenerateConfig, GeneratedQuestionCandidate, LlmGenerationBundle
from sikao_api.modules.ai_questions.application.pool_query import pick_source_questions
from sikao_api.modules.llm.application.cost_tracker import LlmCallRecord, add_llm_call
from sikao_api.modules.llm.application.question_generator import (
    ParsedGeneratedQuestion,
    QUESTION_GENERATE_PROMPT_VERSION,
    QuestionAuditResult,
    QuestionGenerationTrace,
    SourceQuestion,
    generate_questions_with_trace,
    self_audit_question,
)
from sikao_api.modules.system.application.errors import LLMServiceError


def generate_with_audit(
    session: Session,
    *,
    settings: Settings,
    config: AiGenerateConfig,
    count: int,
) -> LlmGenerationBundle:
    sources = pick_source_questions(
        session,
        config=config,
        limit=max(count * 2, count),
    )
    if not sources:
        raise LLMServiceError(
            "no source questions available for ai generation",
            code=NO_SOURCE_QUESTIONS,
        )

    started = perf_counter()
    traces: list[QuestionGenerationTrace] = []
    generated_trace = _run_generation(
        settings=settings,
        session=session,
        config=config,
        sources=sources,
        count=count,
    )
    traces.append(generated_trace)
    accepted: list[GeneratedQuestionCandidate] = []
    for question in generated_trace.questions:
        source = _source_by_id(sources, source_question_id=question.source_question_id)
        if source is None:
            continue
        audit = _run_self_audit(
            settings=settings,
            session=session,
            config=config,
            question=question,
            source=source,
        )
        if audit.passed:
            accepted.append(GeneratedQuestionCandidate(question=question, source=source))

    retry_count = 0
    if len(accepted) < count:
        retry_count = 1
        retry_trace = _run_generation(
            settings=settings,
            session=session,
            config=config,
            sources=sources,
            count=max(count - len(accepted), 5),
        )
        traces.append(retry_trace)
        for question in retry_trace.questions:
            source = _source_by_id(sources, source_question_id=question.source_question_id)
            if source is None:
                continue
            audit = _run_self_audit(
                settings=settings,
                session=session,
                config=config,
                question=question,
                source=source,
            )
            if audit.passed:
                accepted.append(GeneratedQuestionCandidate(question=question, source=source))
            if len(accepted) >= count:
                break

    if len(accepted) < count:
        raise LLMServiceError(
            "question generation audit failed to produce enough questions",
            code=AI_AUDIT_FAILED,
        )

    raw_messages = [
        {"id": source.id, "stem": source.stem, "category_l1": source.category_l1}
        for source in sources
    ]
    llm_call = add_llm_call(
        session,
        settings=settings,
        record=LlmCallRecord(
            user_id=config.user_id,
            purpose="question_generation",
            prompt_version=QUESTION_GENERATE_PROMPT_VERSION,
            provider=traces[0].provider,
            model=traces[0].model,
            input_tokens=sum((trace.usage.get("prompt_tokens") or 0) for trace in traces),
            output_tokens=sum((trace.usage.get("completion_tokens") or 0) for trace in traces),
            request_payload={
                "sources": raw_messages,
                "count": count,
                "attempt_messages": [trace.messages for trace in traces],
            },
            response_payload={"attempt_raw_texts": [trace.raw_text for trace in traces]},
            parsed_output={
                "accepted_questions": [
                    candidate.question.model_dump(mode="python") for candidate in accepted[:count]
                ]
            },
            parse_status="ok",
            error_class=None,
            error_message=None,
            retry_count=retry_count,
            latency_ms=int((perf_counter() - started) * 1000),
        ),
    )
    return LlmGenerationBundle(
        questions=accepted[:count],
        llm_call_id=llm_call.id,
        self_audit_passed_count=len(accepted[:count]),
    )


def _run_generation(
    *,
    settings: Settings,
    session: Session,
    config: AiGenerateConfig,
    sources: list[SourceQuestion],
    count: int,
) -> QuestionGenerationTrace:
    import asyncio

    return asyncio.run(
        generate_questions_with_trace(
            settings=settings,
            sources=sources,
            target_difficulty=config.difficulty_range,
            count=count,
            db=session,
            user_id=config.user_id,
        )
    )


def _run_self_audit(
    *,
    settings: Settings,
    session: Session,
    config: AiGenerateConfig,
    question: ParsedGeneratedQuestion,
    source: SourceQuestion,
) -> QuestionAuditResult:
    import asyncio

    return asyncio.run(
        self_audit_question(
            settings=settings,
            question=question,
            target_difficulty=config.difficulty_range,
            source=source,
            db=session,
            user_id=config.user_id,
        )
    )


def _source_by_id(
    sources: list[SourceQuestion],
    *,
    source_question_id: int,
) -> SourceQuestion | None:
    for source in sources:
        if source.id == source_question_id:
            return source
    return None
