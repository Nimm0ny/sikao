from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm import Session as SqlAlchemySession

from sikao_api.core.config import Settings
from sikao_api.db.enums_v2 import CauseAnalysisScope
from sikao_api.db.models_v2 import AiCauseAnalysisV2, QuestionV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import CauseAnalysisResponseV2
from sikao_api.modules.llm.application.call_execution import call_json_completion
from sikao_api.modules.llm.application.call_recording import persist_failed_call, record_success_call
from sikao_api.modules.llm.application.parsers.cause_analysis_parser import parse_cause_analysis_with_meta
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.review.application.cause_analysis_cache import CauseTagDefinition
from sikao_api.modules.review.application.cause_analysis_result import build_result_json, serialize_analysis_row
from sikao_api.modules.system.application.errors import LLMServiceError

_CAUSE_ANALYSIS_PURPOSE = "review_cause_analysis"
_CAUSE_ANALYSIS_TTL_DAYS = 30


async def execute_and_persist_single_analysis(
    session: Session,
    *,
    settings: Settings,
    home_llm: HomeLlmService,
    user: UserV2,
    item: ReviewItemV2,
    question: QuestionV2,
    input_hash: str,
    previous_analysis: AiCauseAnalysisV2 | None,
    mode: str,
    purpose: str,
    prompt_version: str,
    messages: list[Any],
    tag_map: dict[str, CauseTagDefinition],
    current_confidence: str | None,
    last_answer_hash: str,
    error_count: int,
    related_questions: list[int],
) -> CauseAnalysisResponseV2:
    raw_text = ""
    usage: dict[str, int | None] = {"prompt_tokens": None, "completion_tokens": None}
    provider = "unknown"
    model = settings.llm_model_qa
    try:
        raw_text, usage, provider = await call_json_completion(
            home_llm,
            user_id=user.id,
            purpose=purpose,
            prompt_version=prompt_version,
            model=settings.llm_model_qa,
            messages=messages,
        )
        parsed = parse_cause_analysis_with_meta(raw_text, allowed_tags=tag_map)
        result_json = build_result_json(
            parsed=parsed,
            mode=mode,
            llm_model=settings.llm_model_qa,
            prompt_version=prompt_version,
            usage=usage,
            previous_analysis=previous_analysis,
            source_review_item_id=item.id,
            current_confidence=current_confidence,
            last_answer_hash=last_answer_hash,
            error_count=error_count,
            related_questions=related_questions,
        )
    except Exception as exc:
        persist_failed_llm_call(
            session,
            settings=settings,
            user_id=user.id,
            purpose=purpose,
            prompt_version=prompt_version,
            provider=provider or "unknown",
            model=model,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=exc,
            parse_status=getattr(exc, "parse_status", "failed_before_parse"),
        )
        raise LLMServiceError("review cause analysis failed", code="review_cause_analysis_failed") from exc

    llm_call = record_success_call(
        home_llm,
        user_id=user.id,
        purpose=purpose,
        prompt_version=prompt_version,
        provider=provider,
        model=model,
        messages=messages,
        raw_text=raw_text,
        parsed_output=result_json,
        usage=usage,
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    row = AiCauseAnalysisV2(
        user_id=user.id,
        scope=CauseAnalysisScope.SINGLE.value,
        question_id=question.id,
        question_ids_signature=None,
        input_hash=input_hash,
        result_json=result_json,
        llm_call_id=llm_call.id,
        version=1,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(days=_CAUSE_ANALYSIS_TTL_DAYS),
    )
    if mode == "forced":
        clear_forced_pending(item)
        session.add(item)
    elif mode == "deep":
        metadata = dict(item.metadata_json) if isinstance(item.metadata_json, dict) else {}
        metadata["last_deep_analysis_at"] = now.isoformat()
        item.metadata_json = metadata
        session.add(item)
    session.add(row)
    session.flush()
    return serialize_analysis_row(
        row,
        cached=False,
        warning_code="taxonomy_degraded_response" if parsed.fallback_count >= 3 else None,
    )


async def execute_and_persist_group_analysis(
    session: Session,
    *,
    settings: Settings,
    home_llm: HomeLlmService,
    user: UserV2,
    question_ids_signature: str,
    input_hash: str,
    prompt_version: str,
    messages: list[Any],
    tag_map: dict[str, CauseTagDefinition],
    related_questions: list[int],
) -> CauseAnalysisResponseV2:
    raw_text = ""
    usage: dict[str, int | None] = {"prompt_tokens": None, "completion_tokens": None}
    provider = "unknown"
    model = settings.llm_model_qa
    try:
        raw_text, usage, provider = await call_json_completion(
            home_llm,
            user_id=user.id,
            purpose=_CAUSE_ANALYSIS_PURPOSE,
            prompt_version=prompt_version,
            model=settings.llm_model_qa,
            messages=messages,
        )
        parsed = parse_cause_analysis_with_meta(raw_text, allowed_tags=tag_map)
        result_json = build_result_json(
            parsed=parsed,
            mode="group",
            llm_model=settings.llm_model_qa,
            prompt_version=prompt_version,
            usage=usage,
            previous_analysis=None,
            source_review_item_id=None,
            current_confidence=None,
            last_answer_hash=None,
            error_count=None,
            related_questions=related_questions,
        )
    except Exception as exc:
        persist_failed_llm_call(
            session,
            settings=settings,
            user_id=user.id,
            purpose=_CAUSE_ANALYSIS_PURPOSE,
            prompt_version=prompt_version,
            provider=provider or "unknown",
            model=model,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=exc,
            parse_status=getattr(exc, "parse_status", "failed_before_parse"),
        )
        raise LLMServiceError("review group cause analysis failed", code="review_cause_analysis_failed") from exc

    llm_call = record_success_call(
        home_llm,
        user_id=user.id,
        purpose=_CAUSE_ANALYSIS_PURPOSE,
        prompt_version=prompt_version,
        provider=provider,
        model=model,
        messages=messages,
        raw_text=raw_text,
        parsed_output=result_json,
        usage=usage,
    )
    now = datetime.now(UTC).replace(tzinfo=None)
    row = AiCauseAnalysisV2(
        user_id=user.id,
        scope=CauseAnalysisScope.GROUP.value,
        question_id=None,
        question_ids_signature=question_ids_signature,
        input_hash=input_hash,
        result_json=result_json,
        llm_call_id=llm_call.id,
        version=1,
        created_at=now,
        updated_at=now,
        expires_at=now + timedelta(days=_CAUSE_ANALYSIS_TTL_DAYS),
    )
    session.add(row)
    session.flush()
    return serialize_analysis_row(
        row,
        cached=False,
        warning_code="taxonomy_degraded_response" if parsed.fallback_count >= 3 else None,
    )


def persist_failed_llm_call(
    session: Session,
    *,
    settings: Settings,
    user_id: int,
    purpose: str,
    prompt_version: str,
    provider: str,
    model: str,
    messages: list[Any],
    raw_text: str,
    usage: dict[str, int | None],
    error: Exception,
    parse_status: str,
) -> None:
    with SqlAlchemySession(bind=session.get_bind()) as isolated_session:
        persist_failed_call(
            session=isolated_session,
            settings=settings,
            user_id=user_id,
            purpose=purpose,
            prompt_version=prompt_version,
            provider=provider,
            model=model,
            messages=messages,
            raw_text=raw_text,
            usage=usage,
            error=error,
            parse_status=parse_status,
        )
        isolated_session.commit()


def clear_forced_pending(item: ReviewItemV2) -> None:
    metadata = dict(item.metadata_json) if isinstance(item.metadata_json, dict) else {}
    metadata["forced_cause_analysis_pending"] = False
    metadata["forced_reason"] = None
    metadata["forced_cause_analysis_cleared_at"] = datetime.now(UTC).replace(tzinfo=None).isoformat()
    item.metadata_json = metadata
