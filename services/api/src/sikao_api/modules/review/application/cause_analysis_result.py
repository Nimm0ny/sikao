from __future__ import annotations

from typing import Any, Literal, cast

from sikao_api.db.models_v2 import AiCauseAnalysisV2
from sikao_api.db.schemas_v2 import CauseAnalysisResponseV2, CauseAnalysisResultV2
from sikao_api.modules.llm.application.parsers.cause_analysis_parser import ParsedCauseAnalysis
from sikao_api.modules.system.application.errors import LLMServiceError


def serialize_analysis_row(
    row: AiCauseAnalysisV2,
    *,
    cached: bool,
    warning_code: str | None = None,
) -> CauseAnalysisResponseV2:
    result = CauseAnalysisResultV2.model_validate(row.result_json)
    meta = result.meta if isinstance(result.meta, dict) else {}
    return CauseAnalysisResponseV2(
        analysis_id=row.id,
        scope=cast(Literal["single", "group"], row.scope),
        mode=result.mode,
        version=row.version,
        cached=cached,
        expires_at=row.expires_at,
        llm_call_id=row.llm_call_id,
        warning_code=warning_code or str(meta.get("warning_code") or "") or None,
        result=result,
    )


def build_result_json(
    *,
    parsed: ParsedCauseAnalysis,
    mode: str,
    llm_model: str,
    prompt_version: str,
    usage: dict[str, int | None],
    previous_analysis: AiCauseAnalysisV2 | None,
    source_review_item_id: int | None,
    current_confidence: str | None,
    last_answer_hash: str | None,
    error_count: int | None,
    related_questions: list[int],
) -> dict[str, Any]:
    result_json = parsed.payload.model_dump(mode="python", by_alias=True)
    result_json["mode"] = mode
    if not result_json.get("related_questions"):
        result_json["related_questions"] = related_questions
    if previous_analysis is not None:
        if result_json.get("evolution_context") is None:
            raise LLMServiceError(
                "single cause analysis must return evolution_context when previous analysis exists",
                code="review_cause_analysis_schema_invalid",
            )
        evolution_context = dict(result_json.get("evolution_context") or {})
        evolution_context["previous_analysis_id"] = previous_analysis.id
        evolution_context["previous_analyzed_at"] = previous_analysis.created_at.isoformat()
        previous_result = dict(previous_analysis.result_json)
        evolution_context["previous_dimensions"] = previous_result.get("dimensions", [])
        evolution_context["previous_suggested_actions"] = previous_result.get("suggested_actions", [])
        previous_meta = previous_result.get("_meta")
        previous_confidence = None
        if isinstance(previous_meta, dict):
            previous_confidence = previous_meta.get("current_confidence")
        evolution_context["previous_confidence"] = previous_confidence
        result_json["evolution_context"] = evolution_context
    result_json["_meta"] = {
        "prompt_template_version": prompt_version,
        "llm_model": llm_model,
        "tokens_used": {
            "prompt": usage.get("prompt_tokens"),
            "completion": usage.get("completion_tokens"),
        },
        "review_item_id": source_review_item_id,
        "current_confidence": current_confidence,
        "last_answer_hash": last_answer_hash,
        "error_count": error_count,
        "warning_code": "taxonomy_degraded_response" if parsed.fallback_count >= 3 else None,
    }
    return result_json

