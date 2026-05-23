from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from sikao_api.modules.llm.application.essay_grader import EssayGradingTrace

_DIMENSION_WEIGHTS = {
    "论点准确": 30.0,
    "材料运用": 25.0,
    "语言": 20.0,
    "结构": 15.0,
    "字数符合度": 10.0,
}


@dataclass(frozen=True)
class EssayReportPersistPayload:
    score: Decimal
    feedback_json: dict[str, Any]


def build_report_persist_payload(
    *,
    trace: EssayGradingTrace,
    graded_at: datetime,
    llm_call_id: int,
) -> EssayReportPersistPayload:
    dimensions: list[dict[str, Any]] = []
    total_score = Decimal("0.00")
    for item in trace.payload.evaluation.dimensions:
        full_score = Decimal(str(_DIMENSION_WEIGHTS[item.name]))
        dimension_score = (Decimal(str(item.score)) / Decimal("10")) * full_score
        dimension_score = dimension_score.quantize(Decimal("0.01"))
        total_score += dimension_score
        dimensions.append(
            {
                "name": item.name,
                "score": float(dimension_score),
                "full_score": float(full_score),
                "comment": item.comment,
            }
        )

    strengths = list(trace.payload.evaluation.strengths)
    weaknesses = list(trace.payload.evaluation.weaknesses)
    suggestions = list(trace.payload.evaluation.suggestions)
    overall_comment = _build_overall_comment(
        strengths=strengths,
        weaknesses=weaknesses,
        suggestions=suggestions,
    )
    return EssayReportPersistPayload(
        score=total_score,
        feedback_json={
            "total_score": float(total_score),
            "dimensions": dimensions,
            "highlights": strengths,
            "issues": weaknesses,
            "overall_comment": overall_comment,
            "improvement_suggestions": suggestions,
            "graded_at": graded_at.isoformat().replace("+00:00", "Z"),
            "llm_call_id": llm_call_id,
        },
    )


def build_failed_feedback_json(*, error_message: str) -> dict[str, Any]:
    return {"error_message": error_message}


def _build_overall_comment(
    *,
    strengths: list[str],
    weaknesses: list[str],
    suggestions: list[str],
) -> str:
    strengths_text = "；".join(strengths) if strengths else "暂无明显亮点"
    weaknesses_text = "；".join(weaknesses) if weaknesses else "暂无明显问题"
    suggestions_text = "；".join(suggestions) if suggestions else "继续保持当前结构与论证强度"
    return (
        f"本次作答的主要亮点包括：{strengths_text}。"
        f"当前最需要修正的问题包括：{weaknesses_text}。"
        f"后续可优先按以下方向改进：{suggestions_text}。"
    )
