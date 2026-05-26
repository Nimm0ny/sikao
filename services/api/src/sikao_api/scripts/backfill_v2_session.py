from __future__ import annotations

import argparse
from typing import cast

from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from sikao_api.db.models import PaperRevision, PracticeSession, PracticeSessionAnswer, Question
from sikao_api.db.models_v2 import (
    PaperRevisionV2,
    PaperV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionV2,
    UserV2,
)
from sikao_api.scripts.backfill_v2_common import (
    BackfillStats,
    add_common_args,
    commit_or_rollback,
    iter_with_limit,
    legacy_public_id,
    open_session,
)


def infer_track(session_row: PracticeSession) -> str:
    if session_row.paper is not None:
        if session_row.paper.paper_code.startswith("FBSL-") or "申论" in session_row.paper.paper_name:
            return "essay"
    return "xingce"


def _resolve_question_v2_id(
    session: Session,
    *,
    legacy_question: Question | None,
    session_revision_v2_id: int | None,
) -> int | None:
    if legacy_question is None:
        return None
    if session_revision_v2_id is not None:
        return cast(
            int | None,
            session.scalar(
            select(QuestionV2.id).where(
                QuestionV2.revision_id == session_revision_v2_id,
                QuestionV2.item_no == legacy_question.position,
            )
        ),
        )
    if legacy_question.paper_revision is None or legacy_question.paper_revision.paper is None:
        return None
    paper_v2_id = session.scalar(
        select(PaperV2.id).where(
            PaperV2.paper_code == legacy_question.paper_revision.paper.paper_code
        )
    )
    if paper_v2_id is None:
        return None
    revision_v2_id = session.scalar(
        select(PaperRevisionV2.id).where(
            PaperRevisionV2.paper_id == paper_v2_id,
            PaperRevisionV2.revision_number == legacy_question.paper_revision.revision_number,
        )
    )
    if revision_v2_id is None:
        return None
    return cast(
        int | None,
        session.scalar(
        select(QuestionV2.id).where(
            QuestionV2.revision_id == revision_v2_id,
            QuestionV2.item_no == legacy_question.position,
        )
    ),
    )


def _build_answer_payload(answer: PracticeSessionAnswer) -> dict[str, object]:
    return {
        "selectedAnswer": answer.selected_answer,
        "correctAnswerSnapshot": answer.correct_answer_snapshot,
        "wrongReasonCode": answer.wrong_reason_code,
        "wrongReasonSource": answer.wrong_reason_source,
    }


def run(*, database_url: str | None, dry_run: bool, limit: int | None) -> int:
    session, _db = open_session(database_url=database_url)
    stats = BackfillStats()
    try:
        legacy_sessions = list(
            session.scalars(
                select(PracticeSession)
                .options(
                    selectinload(PracticeSession.paper),
                    selectinload(PracticeSession.paper_revision),
                    selectinload(PracticeSession.answers)
                    .selectinload(PracticeSessionAnswer.question)
                    .selectinload(Question.paper_revision)
                    .selectinload(PaperRevision.paper),
                )
                .order_by(PracticeSession.id.asc())
            )
        )
        existing_v2 = {
            int(row.payload_json["legacySessionId"]): row
            for row in session.scalars(select(PracticeSessionV2))
            if isinstance(row.payload_json, dict) and "legacySessionId" in row.payload_json
        }

        for legacy_session in iter_with_limit(legacy_sessions, limit=limit):
            stats.scanned += 1
            user_v2 = session.scalar(
                select(UserV2).where(
                    UserV2.public_id == legacy_public_id(legacy_session.user_id)
                )
            )
            if user_v2 is None:
                stats.conflicts += 1
                continue

            paper_v2_id = None
            revision_v2_id = None
            if legacy_session.paper is not None:
                paper_v2 = session.scalar(
                    select(PaperV2).where(PaperV2.paper_code == legacy_session.paper.paper_code)
                )
                if paper_v2 is not None:
                    paper_v2_id = paper_v2.id
            if legacy_session.paper_revision is not None and paper_v2_id is not None:
                revision_v2 = session.scalar(
                    select(PaperRevisionV2).where(
                        PaperRevisionV2.paper_id == paper_v2_id,
                        PaperRevisionV2.revision_number == legacy_session.paper_revision.revision_number,
                    )
                )
                if revision_v2 is not None:
                    revision_v2_id = revision_v2.id

            payload_json = {
                "legacySessionId": legacy_session.id,
                "legacyMode": legacy_session.mode,
                "legacyRetryQuestionIds": legacy_session.retry_question_ids_json,
            }

            session_v2 = existing_v2.get(legacy_session.id)
            if session_v2 is None:
                session_v2 = PracticeSessionV2(
                    user_id=user_v2.id,
                    track=infer_track(legacy_session),
                    entry_kind=legacy_session.mode,
                    status=(
                        "submitted"
                        if legacy_session.completed_at is not None
                        else ("in_progress" if legacy_session.answers else "draft")
                    ),
                    paper_id=paper_v2_id,
                    revision_id=revision_v2_id,
                    payload_json=payload_json,
                    started_at=legacy_session.started_at,
                    submitted_at=legacy_session.completed_at,
                    updated_at=legacy_session.completed_at or legacy_session.started_at,
                )
                session.add(session_v2)
                session.flush()
                stats.inserted += 1
            else:
                session_v2.track = infer_track(legacy_session)
                session_v2.entry_kind = legacy_session.mode
                session_v2.status = (
                    "submitted"
                    if legacy_session.completed_at is not None
                    else ("in_progress" if legacy_session.answers else "draft")
                )
                session_v2.paper_id = paper_v2_id
                session_v2.revision_id = revision_v2_id
                session_v2.payload_json = payload_json
                session_v2.started_at = legacy_session.started_at
                session_v2.submitted_at = legacy_session.completed_at
                session_v2.updated_at = legacy_session.completed_at or legacy_session.started_at
                session.add(session_v2)
                stats.updated += 1

            existing_answers = {
                row.question_key: row
                for row in session.scalars(
                    select(PracticeSessionAnswerV2).where(
                        PracticeSessionAnswerV2.session_id == session_v2.id
                    )
                )
            }
            seen_answer_keys: set[str] = set()
            for legacy_answer in sorted(
                legacy_session.answers,
                key=lambda item: item.display_order,
            ):
                question_v2_id = _resolve_question_v2_id(
                    session,
                    legacy_question=legacy_answer.question,
                    session_revision_v2_id=revision_v2_id,
                )
                question_key = (
                    str(question_v2_id)
                    if revision_v2_id is not None and question_v2_id is not None
                    else f"legacy:{legacy_answer.question_id}"
                )
                seen_answer_keys.add(question_key)
                answer_v2 = existing_answers.get(question_key)
                if answer_v2 is None:
                    session.add(
                        PracticeSessionAnswerV2(
                            session_id=session_v2.id,
                            question_id=question_v2_id,
                            question_key=question_key,
                            display_order=legacy_answer.display_order,
                            response_json=_build_answer_payload(legacy_answer),
                            is_correct=legacy_answer.is_correct,
                            duration_seconds=legacy_answer.elapsed_seconds,
                            answered_at=legacy_answer.answered_at,
                        )
                    )
                    continue
                answer_v2.question_id = question_v2_id
                answer_v2.display_order = legacy_answer.display_order
                answer_v2.response_json = _build_answer_payload(legacy_answer)
                answer_v2.is_correct = legacy_answer.is_correct
                answer_v2.duration_seconds = legacy_answer.elapsed_seconds
                answer_v2.answered_at = legacy_answer.answered_at
                session.add(answer_v2)

            stale_answer_keys = set(existing_answers) - seen_answer_keys
            if stale_answer_keys:
                session.execute(
                    delete(PracticeSessionAnswerV2).where(
                        PracticeSessionAnswerV2.session_id == session_v2.id,
                        PracticeSessionAnswerV2.question_key.in_(sorted(stale_answer_keys)),
                    )
                )

        commit_or_rollback(session, dry_run=dry_run)
    finally:
        session.close()
    stats.emit(scope="session", dry_run=dry_run)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="backfill_v2_session",
        description="Backfill legacy practice_sessions into practice_sessions_v2.",
    )
    add_common_args(parser)
    args = parser.parse_args()
    return run(
        database_url=args.database_url,
        dry_run=args.dry_run,
        limit=args.limit,
    )


if __name__ == "__main__":
    raise SystemExit(main())
