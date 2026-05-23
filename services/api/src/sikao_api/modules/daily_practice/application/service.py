from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
import hashlib
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import (
    DailyPracticeV2,
    EssayReportV2,
    EssaySubmissionV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionV2,
    UserPracticePreferencesV2,
    UserV2,
)
from sikao_api.db.schemas_v2 import (
    CustomPracticeDefaults,
    DailyPracticeResponseV2,
    PracticePreferencesPayloadV1,
    PracticeSessionCreateRequestV2,
    PracticeSessionEnvelopeV2,
)
from sikao_api.modules.ai_questions.application.service import AiQuestionsService
from sikao_api.modules.ai_questions.interface.schemas import AiQuestionsGenerateConfigV2
from sikao_api.modules.daily_practice.application.weakness_weighter import load_category_weights
from sikao_api.modules.progress.application.aggregates import today_cn
from sikao_api.modules.session.application.service import SessionServiceV2
from sikao_api.modules.system.application.errors import NotFoundError


def get_or_create_daily(
    session: Session,
    *,
    settings: Settings,
    user: UserV2,
    type_name: str,
) -> DailyPracticeResponseV2:
    today = today_cn()
    row, created = ensure_daily_for_date(
        session,
        settings=settings,
        user=user,
        type_name=type_name,
        date_value=today,
    )
    if created:
        session.commit()
    elif row.status in {"pending", "started"} and row.expired_at <= datetime.now(UTC).replace(tzinfo=None):
        row.status = "expired"
        session.add(row)
        session.commit()
    return _serialize_daily(session, row=row)


def ensure_daily_for_date(
    session: Session,
    *,
    settings: Settings,
    user: UserV2,
    type_name: str,
    date_value: date,
) -> tuple[DailyPracticeV2, bool]:
    _lock_daily_generation_key(
        session,
        user_id=user.id,
        type_name=type_name,
        date_value=date_value,
    )
    row = session.scalar(
        select(DailyPracticeV2).where(
            DailyPracticeV2.user_id == user.id,
            DailyPracticeV2.type == type_name,
            DailyPracticeV2.date == date_value,
        )
    )
    if row is not None:
        return row, False
    try:
        row = _generate_daily_row(
            session,
            settings=settings,
            user=user,
            type_name=type_name,
            date_value=date_value,
        )
    except IntegrityError:
        session.rollback()
        row = session.scalar(
            select(DailyPracticeV2).where(
                DailyPracticeV2.user_id == user.id,
                DailyPracticeV2.type == type_name,
                DailyPracticeV2.date == date_value,
            )
        )
        if row is None:
            raise
        return row, False
    return row, True


def start_daily(
    session: Session,
    *,
    user: UserV2,
    daily_id: int,
) -> PracticeSessionEnvelopeV2:
    row = session.scalar(
        select(DailyPracticeV2).where(
            DailyPracticeV2.id == daily_id,
            DailyPracticeV2.user_id == user.id,
        )
    )
    if row is None:
        raise NotFoundError("daily practice not found", code="daily_practice_not_found")

    now = datetime.now(UTC).replace(tzinfo=None)
    existing = _find_active_daily_session(session, user_id=user.id, daily_id=row.id)
    service = SessionServiceV2(session)
    if existing is not None:
        return service.build_session_response(practice_session=existing)
    if row.completed_session_id is not None or row.status in {"completed", "expired"} or row.expired_at <= now:
        raise NotFoundError("daily practice not found", code="daily_practice_not_found")

    previous_status = row.status
    if previous_status == "started":
        row.status = "pending"
        session.add(row)
        session.flush()

    practice_session = service.create_session(
        user=user,
        payload=PracticeSessionCreateRequestV2(
            track=row.type,  # type: ignore[arg-type]
            entry_kind="daily",
            mode="daily",
            config={"daily_practice_id": row.id},
        ),
    )
    row.status = "started"
    if row.started_at is None:
        row.started_at = now
    session.add(row)
    session.commit()
    session.refresh(practice_session)
    return service.build_session_response(practice_session=practice_session)


def list_daily_history(
    session: Session,
    *,
    user: UserV2,
    period: str,
    type_name: str | None = None,
) -> list[DailyPracticeResponseV2]:
    days = 7 if period == "7d" else 30
    cutoff = today_cn() - timedelta(days=days - 1)
    stmt = select(DailyPracticeV2).where(
        DailyPracticeV2.user_id == user.id,
        DailyPracticeV2.date >= cutoff,
    )
    if type_name is not None:
        stmt = stmt.where(DailyPracticeV2.type == type_name)
    rows = list(
        session.scalars(
            stmt.order_by(DailyPracticeV2.date.desc(), DailyPracticeV2.id.desc())
        )
    )
    return [_serialize_daily(session, row=row) for row in rows]


def _generate_daily_row(
    session: Session,
    *,
    settings: Settings,
    user: UserV2,
    type_name: str,
    date_value: date,
) -> DailyPracticeV2:
    defaults = _load_custom_defaults(session, user_id=user.id)
    weakest_category = _pick_weakest_category(
        session,
        user_id=user.id,
        type_name=type_name,
    )
    generation_strategy = "weakness_weighted" if weakest_category is not None else "random_balanced"
    if defaults.last_used_source_mode == "ai_generated" and type_name == "xingce":
        generated = AiQuestionsService(session, settings).generate(
            user=user,
            config=AiQuestionsGenerateConfigV2(
                type="xingce",
                category_l1=weakest_category,
                category_l2=None,
                year_range=defaults.last_used_year_range,
                difficulty_range=defaults.last_used_difficulty_range,
                count=defaults.last_used_count,
                exclude_already_done=defaults.last_used_exclude_done,
                only_wrong=defaults.last_used_only_wrong,
            ),
            idempotency_key=str(uuid4()),
            request_id=None,
        )
        question_ids = list(generated.question_ids)
    else:
        question_ids = _pick_real_exam_questions(
            session,
            user_id=user.id,
            type_name=type_name,
            defaults=defaults,
        )
    row = DailyPracticeV2(
        user_id=user.id,
        date=date_value,
        type=type_name,
        question_ids=question_ids,
        generation_strategy=generation_strategy,
        status="pending",
        expired_at=datetime.combine(date_value, datetime.max.time()).replace(tzinfo=None),
    )
    session.add(row)
    session.flush()
    return row


def _load_custom_defaults(
    session: Session,
    *,
    user_id: int,
) -> CustomPracticeDefaults:
    row = session.get(UserPracticePreferencesV2, user_id)
    if row is None:
        return PracticePreferencesPayloadV1().custom_practice
    payload = PracticePreferencesPayloadV1.model_validate(row.payload)
    return payload.custom_practice


def _pick_weakest_category(
    session: Session,
    *,
    user_id: int,
    type_name: str,
) -> str | None:
    weights = load_category_weights(session, user_id=user_id, type_name=type_name)
    if not weights:
        return None
    return max(weights, key=lambda item: item.weight).category_l1


def _pick_real_exam_questions(
    session: Session,
    *,
    user_id: int,
    type_name: str,
    defaults: CustomPracticeDefaults,
) -> list[int]:
    stmt = select(QuestionV2).where(
        QuestionV2.subject_kind == type_name,
        QuestionV2.source == "real_exam",
        QuestionV2.is_active.is_(True),
        QuestionV2.historical_accuracy >= defaults.last_used_difficulty_range[0],
        QuestionV2.historical_accuracy <= defaults.last_used_difficulty_range[1],
    )
    current_year = datetime.now(UTC).year
    if defaults.last_used_year_range == "recent_3":
        stmt = stmt.where(QuestionV2.year.is_not(None), QuestionV2.year >= current_year - 2)
    elif defaults.last_used_year_range == "recent_5":
        stmt = stmt.where(QuestionV2.year.is_not(None), QuestionV2.year >= current_year - 4)
    elif defaults.last_used_year_range == "recent_10":
        stmt = stmt.where(QuestionV2.year.is_not(None), QuestionV2.year >= current_year - 9)

    answered_ids = (
        select(PracticeSessionAnswerV2.question_id)
        .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
        .where(
            PracticeSessionV2.user_id == user_id,
            PracticeSessionV2.status == "submitted",
            PracticeSessionAnswerV2.question_id.is_not(None),
            PracticeSessionAnswerV2.response_json != {},
        )
    )
    if defaults.last_used_exclude_done:
        stmt = stmt.where(QuestionV2.id.not_in(answered_ids))
    if defaults.last_used_only_wrong:
        wrong_ids = (
            select(PracticeSessionAnswerV2.question_id)
            .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
            .where(
                PracticeSessionV2.user_id == user_id,
                PracticeSessionV2.status == "submitted",
                PracticeSessionAnswerV2.question_id.is_not(None),
                PracticeSessionAnswerV2.is_correct.is_(False),
            )
        )
        stmt = stmt.where(QuestionV2.id.in_(wrong_ids))

    questions = list(session.scalars(stmt.order_by(QuestionV2.category_l1.asc(), QuestionV2.id.asc())))
    if not questions:
        raise NotFoundError("daily practice candidate pool empty", code="daily_practice_empty")

    weights = {
        item.category_l1: item.weight
        for item in load_category_weights(session, user_id=user_id, type_name=type_name)
    }
    buckets: dict[str, list[QuestionV2]] = defaultdict(list)
    for question in questions:
        buckets[question.category_l1].append(question)
    ordered_categories = sorted(
        buckets,
        key=lambda category: (-weights.get(category, 1.0), category),
    )
    selected: list[int] = []
    while ordered_categories and len(selected) < defaults.last_used_count:
        next_round: list[str] = []
        for category in ordered_categories:
            bucket = buckets[category]
            if bucket:
                selected.append(bucket.pop(0).id)
                if len(selected) >= defaults.last_used_count:
                    break
            if bucket:
                next_round.append(category)
        ordered_categories = next_round
    return selected


def _find_active_daily_session(
    session: Session,
    *,
    user_id: int,
    daily_id: int,
) -> PracticeSessionV2 | None:
    candidates = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.user_id == user_id,
                PracticeSessionV2.source_mode == "daily",
                PracticeSessionV2.status.in_(("draft", "in_progress", "paused")),
            )
        )
    )
    for candidate in candidates:
        if candidate.config_snapshot.get("daily_practice_id") == daily_id:
            return candidate
    return None


def _lock_daily_generation_key(
    session: Session,
    *,
    user_id: int,
    type_name: str,
    date_value: date,
) -> None:
    if session.bind is None or session.bind.dialect.name != "postgresql":
        return
    payload = f"daily:{user_id}:{type_name}:{date_value.isoformat()}".encode("utf-8")
    lock_key = int.from_bytes(hashlib.sha256(payload).digest()[:8], byteorder="big", signed=True)
    session.execute(select(func.pg_advisory_xact_lock(lock_key)))


def _serialize_daily(
    session: Session,
    *,
    row: DailyPracticeV2,
) -> DailyPracticeResponseV2:
    completed_accuracy = None
    if row.completed_session_id is not None:
        if row.type == "essay":
            scores = [
                float(score)
                for score in session.scalars(
                    select(EssayReportV2.score)
                    .join(EssaySubmissionV2, EssaySubmissionV2.id == EssayReportV2.submission_id)
                    .where(
                        EssaySubmissionV2.practice_session_id == row.completed_session_id,
                        EssayReportV2.status == "completed",
                        EssayReportV2.score.is_not(None),
                    )
                )
                if score is not None
            ]
            if scores:
                completed_accuracy = round(sum(scores) / (len(scores) * 100), 4)
        else:
            answers = list(
                session.scalars(
                    select(PracticeSessionAnswerV2).where(
                        PracticeSessionAnswerV2.session_id == row.completed_session_id
                    )
                )
            )
            if answers:
                questions = {
                    question.id: question
                    for question in session.scalars(
                        select(QuestionV2).where(
                            QuestionV2.id.in_(
                                [answer.question_id for answer in answers if answer.question_id is not None]
                            )
                        )
                    )
                }
                correct = 0
                total = 0
                for answer in answers:
                    if answer.question_id is None:
                        continue
                    total += 1
                    if answer.is_correct is True:
                        correct += 1
                        continue
                    if answer.is_correct is False:
                        continue
                    selected = answer.response_json.get("selected") if isinstance(answer.response_json, dict) else None
                    question = questions.get(answer.question_id)
                    expected = question.content_json.get("correct_answer") if question is not None else None
                    if isinstance(selected, list) and isinstance(expected, str):
                        if "".join(sorted(selected)) == "".join(sorted(expected)):
                            correct += 1
                completed_accuracy = round(correct / total, 4) if total else None
    return DailyPracticeResponseV2(
        id=row.id,
        date=row.date,
        type=row.type,  # type: ignore[arg-type]
        question_count=len(row.question_ids),
        status=row.status,
        completed_session_id=row.completed_session_id,
        completed_accuracy=completed_accuracy,
    )
