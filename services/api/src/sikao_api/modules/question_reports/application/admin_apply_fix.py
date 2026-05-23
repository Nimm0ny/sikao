from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import QuestionOptionV2, QuestionV2
from sikao_api.db.schemas_v2 import QuestionReportApplyFixRequestV2
from sikao_api.modules.question_reports.domain.types import QuestionReportFixField
from sikao_api.modules.system.application.errors import ValidationError

_ANSWER_SPLIT_RE = re.compile(r"[,，、/\s]+")


def apply_fix_to_question(
    session: Session,
    *,
    question: QuestionV2,
    payload: QuestionReportApplyFixRequestV2,
) -> tuple[Any, Any]:
    if payload.field == QuestionReportFixField.STEM:
        text_after = require_text_after(payload)
        before_value: Any = question.prompt
        question.prompt = text_after
        if "stem" in question.content_json:
            content_json = dict(question.content_json)
            content_json["stem"] = text_after
            question.content_json = content_json
        return before_value, text_after

    if payload.field == QuestionReportFixField.EXPLANATION:
        text_after = require_text_after(payload)
        if "explanation" in question.content_json:
            before_explanation: Any = question.content_json.get("explanation")
            content_json = dict(question.content_json)
            content_json["explanation"] = text_after
            question.content_json = content_json
            return before_explanation, text_after
        if "explanationText" in question.content_json:
            before_explanation_text: Any = question.content_json.get("explanationText")
            content_json = dict(question.content_json)
            content_json["explanationText"] = text_after
            question.content_json = content_json
            return before_explanation_text, text_after
        raise ValidationError(
            "question does not expose explanation payload",
            code="question_report_fix_field_missing",
        )

    if payload.field == QuestionReportFixField.CORRECT_ANSWER:
        text_after = require_text_after(payload)
        normalized_answer = normalize_answer_text_against_option_keys(
            session,
            question=question,
            text_after=text_after,
        )
        if "correct_answer" in question.content_json:
            before_correct_answer: Any = question.content_json.get("correct_answer")
            content_json = dict(question.content_json)
            content_json["correct_answer"] = normalized_answer
            question.content_json = content_json
            return before_correct_answer, normalized_answer
        if "answerText" in question.content_json:
            before_answer_text: Any = question.content_json.get("answerText")
            content_json = dict(question.content_json)
            content_json["answerText"] = normalized_answer
            question.content_json = content_json
            return before_answer_text, normalized_answer
        raise ValidationError(
            "question does not expose answer payload",
            code="question_report_fix_field_missing",
        )

    if payload.field == QuestionReportFixField.OPTIONS:
        return _apply_option_fix(session, question=question, payload=payload)

    raise ValidationError(
        "unsupported apply-fix field",
        code="question_report_fix_field_invalid",
    )


def require_text_after(payload: QuestionReportApplyFixRequestV2) -> str:
    if payload.text_after is None or not payload.text_after.strip():
        raise ValidationError(
            "text_after is required for selected field",
            code="question_report_fix_text_required",
        )
    if payload.options_after:
        raise ValidationError(
            "options_after must stay empty for text fields",
            code="question_report_fix_payload_invalid",
        )
    return payload.text_after.strip()


def require_options_after(
    payload: QuestionReportApplyFixRequestV2,
) -> list[dict[str, str]]:
    if payload.text_after is not None:
        raise ValidationError(
            "text_after must stay empty for options field",
            code="question_report_fix_payload_invalid",
        )
    if not payload.options_after:
        raise ValidationError(
            "options_after is required for options field",
            code="question_report_fix_options_required",
        )
    return [
        {"key": item.key, "text": item.text}
        for item in payload.options_after
    ]


def _apply_option_fix(
    session: Session,
    *,
    question: QuestionV2,
    payload: QuestionReportApplyFixRequestV2,
) -> tuple[Any, Any]:
    desired = require_options_after(payload)
    option_rows = list(
        session.scalars(
            select(QuestionOptionV2)
            .where(QuestionOptionV2.question_id == question.id)
            .order_by(
                QuestionOptionV2.display_order.asc(),
                QuestionOptionV2.id.asc(),
            )
        )
    )
    desired_keys = {item["key"] for item in desired}
    sync_content_json_options = "options" in question.content_json
    if option_rows:
        existing_keys = {row.option_key for row in option_rows}
        if existing_keys != desired_keys:
            raise ValidationError(
                "options_after must preserve existing option keys",
                code="question_report_fix_option_keys_mismatch",
            )
        before_options: Any = [
            {"key": row.option_key, "text": row.option_text}
            for row in option_rows
        ]
    else:
        raw_options = question.content_json.get("options")
        if not isinstance(raw_options, dict):
            raise ValidationError(
                "question does not expose option payload",
                code="question_report_fix_field_missing",
            )
        existing_keys = {str(key) for key in raw_options}
        if existing_keys != desired_keys:
            raise ValidationError(
                "options_after must preserve existing option keys",
                code="question_report_fix_option_keys_mismatch",
            )
        before_options = [
            {"key": str(key), "text": str(value)}
            for key, value in raw_options.items()
        ]
    existing_by_key = {row.option_key: row for row in option_rows}
    seen_keys: set[str] = set()
    for display_order, item in enumerate(desired, start=1):
        seen_keys.add(item["key"])
        row = existing_by_key.get(item["key"])
        if row is None:
            row = QuestionOptionV2(
                question_id=question.id,
                option_key=item["key"],
                option_text=item["text"],
                display_order=display_order,
            )
            session.add(row)
        else:
            row.option_text = item["text"]
            row.display_order = display_order
            session.add(row)
    for row in option_rows:
        if row.option_key not in seen_keys:
            session.delete(row)
    if sync_content_json_options:
        content_json = dict(question.content_json)
        content_json["options"] = {
            item["key"]: item["text"] for item in desired
        }
        question.content_json = content_json
    return before_options, desired


def normalize_answer_text_against_option_keys(
    session: Session,
    *,
    question: QuestionV2,
    text_after: str,
) -> str:
    option_keys = _load_option_keys(session, question=question)
    if not option_keys:
        return text_after.strip()
    parsed_keys = _parse_answer_keys(text_after=text_after, option_keys=option_keys)
    if (
        not parsed_keys
        or any(key not in option_keys for key in parsed_keys)
        or len(set(parsed_keys)) != len(parsed_keys)
    ):
        raise ValidationError(
            "correct answer must reference existing option keys",
            code="question_report_fix_answer_invalid",
        )
    if all(len(key) == 1 and key.isalnum() for key in option_keys):
        return "".join(sorted(parsed_keys))
    if len(parsed_keys) == 1:
        return parsed_keys[0]
    return ",".join(parsed_keys)


def _load_option_keys(session: Session, *, question: QuestionV2) -> set[str]:
    row_keys = set(
        session.scalars(
            select(QuestionOptionV2.option_key).where(
                QuestionOptionV2.question_id == question.id
            )
        )
    )
    if row_keys:
        return {str(key) for key in row_keys}
    raw_options = question.content_json.get("options")
    if isinstance(raw_options, dict):
        return {str(key) for key in raw_options}
    return set()


def _parse_answer_keys(*, text_after: str, option_keys: set[str]) -> list[str]:
    normalized = text_after.strip()
    if normalized in option_keys:
        return [normalized]
    parts = [part for part in _ANSWER_SPLIT_RE.split(normalized) if part]
    if len(parts) > 1:
        return parts
    if all(len(key) == 1 and key.isalnum() for key in option_keys):
        collapsed = _ANSWER_SPLIT_RE.sub("", normalized)
        return list(collapsed)
    return [normalized]
