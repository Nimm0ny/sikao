from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from sikao_api.db.content_hash import compute_question_content_hash

from .parser import RawPaperRecord


_ABILITY_DIMENSIONS = {
    "comprehension",
    "reasoning",
    "calculation",
    "memory",
    "application",
}
_KNOWLEDGE_TAG_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


@dataclass(frozen=True)
class ImportQuestion:
    item_no: int
    prompt: str
    answer_kind: str
    status: str
    content_json: dict[str, Any]
    source: str
    year: int | None
    region: str | None
    exam_type: str
    category_l1: str
    category_l2: str | None
    historical_accuracy: float
    answer_count: int
    quality_score: float
    report_count: int
    is_active: bool
    ai_source_question_id: int | None
    ai_self_audit_passed: bool | None
    ai_generated_at: datetime | None
    ability_dimensions: list[str] = field(default_factory=list)
    discrimination_index: float | None = None
    heat_score: float = 0.0
    complexity_level: int | None = None
    knowledge_tags: list[str] = field(default_factory=list)
    content_hash: str = ""


@dataclass(frozen=True)
class ImportPaper:
    source_path: Path
    paper_code: str
    title: str
    subject_kind: str
    revision_status: str
    questions: list[ImportQuestion]
    signature: str


def map_raw_papers(raw_papers: list[RawPaperRecord]) -> list[ImportPaper]:
    return [_map_raw_paper(record) for record in raw_papers]


def _map_raw_paper(raw: RawPaperRecord) -> ImportPaper:
    questions: list[ImportQuestion] = []
    for index, question in enumerate(raw.questions, start=1):
        item_no = int(question.get("item_no") or index)
        prompt = _question_prompt(question)
        answer_kind = str(question.get("answer_kind") or "single_choice").strip()
        status = str(question.get("status") or "published").strip()
        content_json = _question_content_json(question, prompt)
        ability_dimensions = _normalize_ability_dimensions(question.get("ability_dimensions"))
        knowledge_tags = _normalize_knowledge_tags(question.get("knowledge_tags"))
        content_hash = compute_question_content_hash(prompt, content_json)
        category_l1, category_l2 = _normalize_category_pair(question)
        is_active = _optional_bool(question.get("is_active"), default=True)
        questions.append(
            ImportQuestion(
                item_no=item_no,
                prompt=prompt,
                answer_kind=answer_kind,
                status=status,
                content_json=content_json,
                source=str(question.get("source") or "real_exam").strip() or "real_exam",
                year=_optional_int(question.get("year")),
                region=_optional_text(question.get("region")),
                exam_type=str(question.get("exam_type") or "other").strip() or "other",
                category_l1=category_l1,
                category_l2=category_l2,
                historical_accuracy=_optional_float(question.get("historical_accuracy")) or 0.0,
                answer_count=_optional_int(question.get("answer_count")) or 0,
                quality_score=_optional_float(question.get("quality_score")) or 5.0,
                report_count=_optional_int(question.get("report_count")) or 0,
                is_active=True if is_active is None else is_active,
                ai_source_question_id=_optional_int(question.get("ai_source_question_id")),
                ai_self_audit_passed=_optional_bool(question.get("ai_self_audit_passed")),
                ai_generated_at=_optional_datetime(question.get("ai_generated_at")),
                ability_dimensions=ability_dimensions,
                discrimination_index=_optional_float(question.get("discrimination_index")),
                heat_score=_optional_float(question.get("heat_score")) or 0.0,
                complexity_level=_optional_int(question.get("complexity_level")),
                knowledge_tags=knowledge_tags,
                content_hash=content_hash,
            )
        )

    signature_payload = {
        "paper_code": raw.paper_code,
        "title": raw.title,
        "subject_kind": raw.subject_kind,
        "revision_status": str(getattr(raw, "revision_status", "") or "published"),
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
    signature = hashlib.sha256(
        json.dumps(signature_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    return ImportPaper(
        source_path=raw.source_path,
        paper_code=raw.paper_code,
        title=raw.title,
        subject_kind=raw.subject_kind,
        revision_status=str(getattr(raw, "revision_status", "") or "published"),
        questions=questions,
        signature=signature,
    )


def _question_prompt(question: dict[str, Any]) -> str:
    prompt = str(question.get("prompt") or question.get("stem") or "").strip()
    if not prompt:
        raise ValueError("question prompt/stem must not be empty")
    return prompt


def _question_content_json(question: dict[str, Any], prompt: str) -> dict[str, Any]:
    if "content_json" in question:
        return _json_object(question["content_json"], "content_json")
    options = question.get("options") or []
    if isinstance(options, str):
        options = json.loads(options)
    if not isinstance(options, list):
        raise ValueError("options must be a list or JSON-encoded list")
    return {
        "stem": prompt,
        "options": options,
        "correct_answer": question.get("correct_answer"),
        "explanation": question.get("explanation"),
    }


def _normalize_category_pair(question: dict[str, Any]) -> tuple[str, str | None]:
    if "classification" in question and isinstance(question["classification"], dict):
        classification = question["classification"]
        l1 = _optional_text(classification.get("l1"))
        l2 = _optional_text(classification.get("l2"))
    else:
        l1 = _optional_text(question.get("category_l1")) or _optional_text(question.get("category"))
        l2 = _optional_text(question.get("category_l2")) or _optional_text(question.get("subcategory"))
    return l1 or "uncategorized", l2


def _normalize_ability_dimensions(raw: Any) -> list[str]:
    values = _normalize_string_list(raw)
    invalid = sorted({value for value in values if value not in _ABILITY_DIMENSIONS})
    if invalid:
        raise ValueError(
            "ability_dimensions contains unsupported values: " + ", ".join(invalid)
        )
    return values


def _normalize_knowledge_tags(raw: Any) -> list[str]:
    values = _normalize_string_list(raw)
    invalid = sorted({value for value in values if not _KNOWLEDGE_TAG_PATTERN.match(value)})
    if invalid:
        raise ValueError(
            "knowledge_tags must be snake_case: " + ", ".join(invalid)
        )
    return values


def _normalize_string_list(raw: Any) -> list[str]:
    if raw in (None, ""):
        return []
    if isinstance(raw, str):
        parsed = json.loads(raw) if raw.strip().startswith("[") else [part.strip() for part in raw.split(",")]
    else:
        parsed = raw
    if not isinstance(parsed, list):
        raise ValueError("expected a list-compatible value")
    values = [str(item).strip() for item in parsed if str(item).strip()]
    return values


def _json_object(raw: Any, label: str) -> dict[str, Any]:
    parsed = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(parsed, dict):
        raise ValueError(f"{label} must be a JSON object")
    return parsed


def _optional_text(raw: Any) -> str | None:
    value = str(raw or "").strip()
    return value or None


def _optional_int(raw: Any) -> int | None:
    if raw in (None, ""):
        return None
    return int(raw)


def _optional_float(raw: Any) -> float | None:
    if raw in (None, ""):
        return None
    return float(raw)


def _optional_bool(raw: Any, default: bool | None = None) -> bool | None:
    if raw in (None, ""):
        return default
    if isinstance(raw, bool):
        return raw
    value = str(raw).strip().lower()
    if value in {"1", "true", "yes"}:
        return True
    if value in {"0", "false", "no"}:
        return False
    raise ValueError(f"unsupported boolean literal: {raw!r}")


def _optional_datetime(raw: Any) -> datetime | None:
    if raw in (None, ""):
        return None
    if isinstance(raw, datetime):
        return raw
    return datetime.fromisoformat(str(raw))
