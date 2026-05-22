from __future__ import annotations

import sqlite3

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import (
    EssayReferenceAnswerV2,
    EssayReferenceFeedbackV2,
    QuestionFlagV2,
)

from _practice_phase_p1_support import (
    engine_with_fk,
    list_v2_tables,
    make_database,
    run_alembic,
    seed_question,
    seed_revision,
    seed_user,
)


def test_support_tables_and_active_flag_partial_unique_index(tmp_path) -> None:
    db_file, env, db_url = make_database(tmp_path)
    run_alembic(env, "upgrade", "head")
    engine = engine_with_fk(db_url)
    try:
        user_id = seed_user(engine)
        _, revision_id = seed_revision(engine)
        question_id = seed_question(engine, revision_id=revision_id)

        with Session(engine) as session:
            session.add(
                QuestionFlagV2(
                    user_id=user_id,
                    question_id=question_id,
                    reason="uncertain",
                )
            )
            session.commit()

        with Session(engine) as session:
            session.add(
                QuestionFlagV2(
                    user_id=user_id,
                    question_id=question_id,
                    reason="needs_review",
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()

            existing = session.query(QuestionFlagV2).filter_by(
                user_id=user_id,
                question_id=question_id,
                resolved_at=None,
            ).one()
            existing.resolved_at = existing.created_at
            session.commit()

            session.add(
                QuestionFlagV2(
                    user_id=user_id,
                    question_id=question_id,
                    reason="needs_review",
                )
            )
            session.commit()

        with sqlite3.connect(db_file) as conn:
            assert {
                "practice_stats_snapshot_v2",
                "question_favorite_v2",
                "question_flag_v2",
                "ai_generated_question_request_v2",
                "daily_practice_v2",
                "user_practice_preferences_v2",
            }.issubset(list_v2_tables(conn))
    finally:
        engine.dispose()


def test_essay_reference_feedback_trigger_syncs_counts(tmp_path) -> None:
    _, env, db_url = make_database(tmp_path)
    run_alembic(env, "upgrade", "head")
    engine = engine_with_fk(db_url)
    try:
        user_id = seed_user(engine)
        _, revision_id = seed_revision(engine, paper_code="ESSAY-001", subject_kind="essay")
        question_id = seed_question(engine, revision_id=revision_id)

        with Session(engine) as session:
            reference = EssayReferenceAnswerV2(
                question_id=question_id,
                content="官方范文",
                source="official",
                created_by_admin=True,
                status="public",
            )
            session.add(reference)
            session.commit()
            reference_id = reference.id

        with Session(engine) as session:
            session.add_all(
                [
                    EssayReferenceFeedbackV2(
                        reference_id=reference_id,
                        user_id=user_id,
                        action="like",
                    ),
                    EssayReferenceFeedbackV2(
                        reference_id=reference_id,
                        user_id=user_id,
                        action="report",
                    ),
                ]
            )
            session.commit()

        with Session(engine) as session:
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert reference is not None
            assert reference.likes_count == 1
            assert reference.favorites_count == 0
            assert reference.report_count == 1

            report_feedback = session.query(EssayReferenceFeedbackV2).filter_by(
                reference_id=reference_id,
                action="report",
            ).one()
            like_feedback = session.query(EssayReferenceFeedbackV2).filter_by(
                reference_id=reference_id,
                action="like",
            ).one()
            like_feedback.action = "favorite"
            session.commit()

        with Session(engine) as session:
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert reference is not None
            assert reference.likes_count == 0
            assert reference.favorites_count == 1
            assert reference.report_count == 1

            report_feedback = session.query(EssayReferenceFeedbackV2).filter_by(
                reference_id=reference_id,
                action="report",
            ).one()
            session.delete(report_feedback)
            session.commit()

        with Session(engine) as session:
            reference = session.get(EssayReferenceAnswerV2, reference_id)
            assert reference is not None
            assert reference.likes_count == 0
            assert reference.favorites_count == 1
            assert reference.report_count == 0
    finally:
        engine.dispose()
