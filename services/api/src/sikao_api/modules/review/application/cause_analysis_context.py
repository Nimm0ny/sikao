from __future__ import annotations

from datetime import datetime
from hashlib import sha256
import json
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import (
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionOptionV2,
    QuestionV2,
    ReviewAttemptV2,
    ReviewItemV2,
    UserV2,
)
def build_single_analysis_context(
    session: Session,
    *,
    user: UserV2,
    item: ReviewItemV2,
    question: QuestionV2,
) -> dict[str, Any]:
    history = build_answer_history(session, user_id=user.id, question_id=question.id)
    latest_user_answer = history[0]["user_answer"] if history else ""
    item_metadata = item.metadata_json if isinstance(item.metadata_json, dict) else {}
    last_answer_hash = str(item_metadata.get("last_answer_hash") or "")
    if not last_answer_hash and latest_user_answer:
        last_answer_hash = sha256(latest_user_answer.encode("utf-8")).hexdigest()
    confidence_values = [
        str(entry["confidence"])
        for entry in history
        if entry.get("confidence") is not None
    ]
    current_confidence = item_metadata.get("last_confidence")
    if current_confidence is None and confidence_values:
        current_confidence = confidence_values[0]
    avg_duration_s, duration_ratio = compute_duration_stats(
        session,
        user_id=user.id,
        question_id=question.id,
    )
    error_count = count_incorrect_history(session, user_id=user.id, question_id=question.id)
    return {
        "question_type": question.answer_kind,
        "category_l1": question.category_l1,
        "category_l2": question.category_l2 or "uncategorized",
        "question_body": question.prompt,
        "options_text": build_options_text(session, question_id=question.id),
        "correct_answer": extract_correct_answer(question=question),
        "explanation": str(question.content_json.get("explanation", "")),
        "error_count": error_count,
        "answer_history_block": render_answer_history_block(history=history),
        "confidence_history": ",".join(confidence_values) if confidence_values else "none",
        "avg_duration_s": avg_duration_s,
        "duration_ratio": duration_ratio,
        "last_answer_hash": last_answer_hash or sha256(str(question.id).encode("utf-8")).hexdigest(),
        "current_confidence": current_confidence,
        "mismatch_count": int(item_metadata.get("confidence_mismatch_count", 0) or 0),
    }


def build_group_context(
    session: Session,
    *,
    user: UserV2,
    items: list[ReviewItemV2],
) -> tuple[list[dict[str, object]], str]:
    ordered_items = sorted(
        items,
        key=lambda item: (
            int(item.question_id) if item.question_id is not None else 0,
            item.id,
        ),
    )
    prompt_summary: list[dict[str, object]] = []
    lines: list[str] = []
    for item in ordered_items:
        question = load_question_for_item(session, item)
        history = build_answer_history(session, user_id=user.id, question_id=question.id)
        last_wrong = next((entry for entry in history if entry["is_correct"] is False), None)
        latest_confidence = item.metadata_json.get("last_confidence") if isinstance(item.metadata_json, dict) else None
        error_count = count_incorrect_history(session, user_id=user.id, question_id=question.id)
        last_answer_hash = str(
            (item.metadata_json or {}).get("last_answer_hash") if isinstance(item.metadata_json, dict) else ""
        )
        prompt_summary.append(
            {
                "questionId": question.id,
                "status": item.status,
                "correctStreak": item.correct_streak,
                "lastAnswerHash": last_answer_hash,
                "lastConfidence": latest_confidence,
                "lastWrongAnswer": last_wrong["user_answer"] if last_wrong is not None else "",
                "errorCount": error_count,
            }
        )
        lines.append(
            f"Q{question.id} | {question.answer_kind} | {question.category_l1}>{question.category_l2 or 'uncategorized'} | "
            f"errors={error_count} | lastWrong={last_wrong['user_answer'] if last_wrong is not None else 'none'} | "
            f"lastConfidence={latest_confidence or 'none'}"
        )
    return prompt_summary, "\n".join(lines)


def build_evolution_context_block(previous_analysis_result: dict[str, Any], *, previous_analysis_id: int, previous_analyzed_at: datetime) -> str:
    dimensions = previous_analysis_result.get("dimensions", [])
    suggested = previous_analysis_result.get("suggested_actions", [])
    confidence = None
    previous_meta = previous_analysis_result.get("_meta")
    if isinstance(previous_meta, dict):
        confidence = previous_meta.get("current_confidence")
    return (
        f"PreviousAnalysisId: {previous_analysis_id}\n"
        f"PreviousAnalyzedAt: {previous_analyzed_at.isoformat()}\n"
        f"PreviousDimensions: {json.dumps(dimensions, ensure_ascii=False)}\n"
        f"PreviousSuggestedActions: {json.dumps(suggested, ensure_ascii=False)}\n"
        f"PreviousConfidence: {confidence or 'unknown'}"
    )


def supplement_related_questions(
    session: Session,
    *,
    exclude_question_ids: set[int],
    category_pairs: set[tuple[str, str | None]],
) -> list[int]:
    if not category_pairs:
        return []
    rows = list(
        session.scalars(
            select(QuestionV2.id)
            .where(
                ~QuestionV2.id.in_(exclude_question_ids),
                or_(*[
                    (QuestionV2.category_l1 == category_l1) & (QuestionV2.category_l2 == category_l2)
                    for category_l1, category_l2 in category_pairs
                ]),
            )
            .order_by(QuestionV2.answer_count.desc(), QuestionV2.id.asc())
            .limit(5)
        )
    )
    return [int(value) for value in rows]


def build_answer_history(
    session: Session,
    *,
    user_id: int,
    question_id: int,
) -> list[dict[str, Any]]:
    practice_rows = list(
        session.execute(
            select(
                PracticeSessionAnswerV2.answered_at,
                PracticeSessionAnswerV2.is_correct,
                PracticeSessionAnswerV2.response_json,
                PracticeSessionAnswerV2.session_id,
            )
            .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
            .where(
                PracticeSessionV2.user_id == user_id,
                PracticeSessionAnswerV2.question_id == question_id,
            )
        )
    )
    review_rows = list(
        session.execute(
            select(
                ReviewAttemptV2.attempted_at,
                ReviewAttemptV2.outcome,
                ReviewAttemptV2.notes_json,
            )
            .join(ReviewItemV2, ReviewItemV2.id == ReviewAttemptV2.review_item_id)
            .where(
                ReviewItemV2.user_id == user_id,
                ReviewItemV2.question_id == question_id,
            )
        )
    )
    entries: list[dict[str, Any]] = []
    for answered_at, is_correct, response_json, session_id in practice_rows:
        entries.append(
            {
                "answered_at": answered_at,
                "is_correct": is_correct,
                "user_answer": extract_answer_from_response(response_json),
                "confidence": None,
                "session_id": session_id,
            }
        )
    for attempted_at, outcome, notes_json in review_rows:
        if outcome not in {"correct", "incorrect", "probation_failed", "graduated"}:
            continue
        if not isinstance(notes_json, dict):
            continue
        if "userAnswer" not in notes_json and "isCorrect" not in notes_json:
            continue
        entries.append(
            {
                "answered_at": attempted_at,
                "is_correct": notes_json.get("isCorrect"),
                "user_answer": str(notes_json.get("userAnswer", "")),
                "confidence": notes_json.get("effectiveConfidence", notes_json.get("confidence")),
                "session_id": None,
            }
        )
    entries.sort(key=lambda item: item["answered_at"], reverse=True)
    return entries[:10]


def render_answer_history_block(*, history: list[dict[str, Any]]) -> str:
    if not history:
        return "none"
    lines: list[str] = []
    for entry in history:
        outcome = "correct" if entry["is_correct"] is True else "wrong"
        confidence = entry["confidence"] if entry["confidence"] is not None else "none"
        lines.append(
            f"{entry['answered_at'].isoformat()} {outcome} -> {entry['user_answer'] or 'empty'} confidence={confidence}"
        )
    return "\n".join(lines)


def compute_duration_stats(
    session: Session,
    *,
    user_id: int,
    question_id: int,
) -> tuple[float, float]:
    question_avg = session.scalar(
        select(func.avg(PracticeSessionAnswerV2.duration_seconds))
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionAnswerV2.question_id == question_id,
            PracticeSessionAnswerV2.duration_seconds.is_not(None),
        )
    )
    user_avg = session.scalar(
        select(func.avg(PracticeSessionAnswerV2.duration_seconds))
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionAnswerV2.duration_seconds.is_not(None),
        )
    )
    resolved_question_avg = float(question_avg or 0.0)
    resolved_user_avg = float(user_avg or 0.0)
    if resolved_user_avg <= 0:
        return resolved_question_avg, 1.0
    return resolved_question_avg, resolved_question_avg / resolved_user_avg


def count_incorrect_history(
    session: Session,
    *,
    user_id: int,
    question_id: int,
) -> int:
    practice_wrong = session.scalar(
        select(func.count(PracticeSessionAnswerV2.id))
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionAnswerV2.question_id == question_id,
            PracticeSessionAnswerV2.is_correct.is_(False),
        )
    ) or 0
    review_wrong = session.scalar(
        select(func.count(ReviewAttemptV2.id))
        .join(ReviewItemV2, ReviewItemV2.id == ReviewAttemptV2.review_item_id)
        .where(
            ReviewItemV2.user_id == user_id,
            ReviewItemV2.question_id == question_id,
            ReviewAttemptV2.outcome.in_(("incorrect", "probation_failed")),
        )
    ) or 0
    return int(practice_wrong) + int(review_wrong)


def build_options_text(session: Session, *, question_id: int) -> str:
    options = list(
        session.scalars(
            select(QuestionOptionV2)
            .where(QuestionOptionV2.question_id == question_id)
            .order_by(QuestionOptionV2.display_order.asc(), QuestionOptionV2.id.asc())
        )
    )
    if options:
        return "\n".join(f"{option.option_key}. {option.option_text}" for option in options)
    question = session.get(QuestionV2, question_id)
    if question is None:
        return ""
    raw_options = question.content_json.get("options")
    if isinstance(raw_options, dict):
        return "\n".join(f"{key}. {value}" for key, value in raw_options.items())
    return ""


def extract_correct_answer(*, question: QuestionV2) -> str:
    content_json = question.content_json
    for key in ("correct_answer", "answerText", "answer"):
        candidate = content_json.get(key)
        if candidate is None:
            continue
        if isinstance(candidate, list):
            return ",".join(str(value) for value in candidate)
        return str(candidate)
    return ""


def extract_answer_from_response(response_json: dict[str, Any]) -> str:
    selected = response_json.get("selected")
    if isinstance(selected, list):
        return ",".join(str(value) for value in selected)
    if isinstance(selected, str):
        return selected
    answer = response_json.get("answer")
    if isinstance(answer, str):
        return answer
    text_value = response_json.get("text")
    if isinstance(text_value, str):
        return text_value
    return json.dumps(response_json, ensure_ascii=False, sort_keys=True)


def load_question_for_item(session: Session, item: ReviewItemV2) -> QuestionV2:
    question = session.get(QuestionV2, item.question_id)
    if question is None:
        raise RuntimeError("question not found")
    return question
