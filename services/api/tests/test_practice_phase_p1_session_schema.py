from __future__ import annotations

import sqlite3

import pytest
from sikao_api.db.models_v2 import NoteV2, PracticeSessionV2

from _practice_phase_p1_support import engine_with_fk, make_database, run_alembic, seed_user


def test_session_runtime_schema_and_triggers(tmp_path) -> None:
    db_file, env, db_url = make_database(tmp_path)
    run_alembic(env, "upgrade", "head")
    engine = engine_with_fk(db_url)
    try:
        user_id = seed_user(engine)

        with sqlite3.connect(db_file) as conn:
            session_cols = {row[1] for row in conn.execute("PRAGMA table_info(practice_sessions_v2)")}
            answer_cols = {row[1] for row in conn.execute("PRAGMA table_info(practice_session_answers_v2)")}
            assert {
                "paused_at",
                "paused_count",
                "last_heartbeat_at",
                "expires_at",
                "abandoned_at",
                "abandoned_reason",
                "force_submitted",
                "force_submitted_reason",
                "recovered_from_session_id",
                "total_active_seconds",
                "paused_total_seconds",
                "first_question_at",
                "last_activity_at",
                "exam_mode",
                "time_limit_minutes",
                "auto_submit_at",
                "allow_review_during",
                "allow_pause",
                "delayed_review_until",
            }.issubset(session_cols)
            assert {
                "time_spent_ms",
                "first_seen_at",
                "first_answered_at",
                "last_modified_at",
                "answer_change_count",
                "visit_count",
                "is_overtime",
            }.issubset(answer_cols)

            conn.execute(
                """
                INSERT INTO practice_sessions_v2 (
                    user_id, track, entry_kind, status, payload_json, started_at, updated_at,
                    practice_mode, source_mode, config_snapshot
                ) VALUES (?, 'xingce', 'paper', 'draft', '{}', datetime('now'), datetime('now'),
                          'full_set', 'paper', '{}')
                """,
                (user_id,),
            )
            session_id = conn.execute("SELECT MAX(id) FROM practice_sessions_v2").fetchone()[0]
            conn.execute(
                """
                UPDATE practice_sessions_v2
                SET status = 'submitted', submitted_at = datetime('now')
                WHERE id = ?
                """,
                (session_id,),
            )
            conn.commit()
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute(
                    "UPDATE practice_sessions_v2 SET status = 'in_progress' WHERE id = ?",
                    (session_id,),
                )

            with pytest.raises(sqlite3.IntegrityError):
                conn.execute(
                    """
                    INSERT INTO practice_sessions_v2 (
                        user_id, track, entry_kind, status, payload_json, started_at, updated_at,
                        practice_mode, source_mode, config_snapshot, exam_mode
                    ) VALUES (?, 'xingce', 'paper', 'draft', '{}', datetime('now'), datetime('now'),
                              'full_set', 'paper', '{}', 1)
                    """,
                    (user_id,),
                )
    finally:
        engine.dispose()


def test_mock_exam_auto_submit_at_is_immutable(tmp_path) -> None:
    db_file, env, db_url = make_database(tmp_path)
    run_alembic(env, "upgrade", "head")
    engine = engine_with_fk(db_url)
    try:
        user_id = seed_user(engine)
        with sqlite3.connect(db_file) as conn:
            conn.execute(
                """
                INSERT INTO practice_sessions_v2 (
                    user_id, track, entry_kind, status, payload_json, started_at, updated_at,
                    practice_mode, source_mode, config_snapshot,
                    exam_mode, time_limit_minutes, auto_submit_at, allow_review_during, allow_pause
                ) VALUES (
                    ?, 'xingce', 'paper', 'in_progress', '{}', datetime('now'), datetime('now'),
                    'full_set', 'paper', '{}',
                    1, 120, datetime('now', '+120 minutes'), 0, 0
                )
                """,
                (user_id,),
            )
            session_id = conn.execute("SELECT MAX(id) FROM practice_sessions_v2").fetchone()[0]
            conn.commit()

            with pytest.raises(sqlite3.IntegrityError):
                conn.execute(
                    """
                    UPDATE practice_sessions_v2
                    SET auto_submit_at = datetime('now', '+121 minutes')
                    WHERE id = ?
                    """,
                    (session_id,),
                )
    finally:
        engine.dispose()


def test_note_detail_schema_defaults_stay_backward_compatible() -> None:
    table = NoteV2.__table__
    assert table.c["linked_question_id"].nullable is True
    assert table.c["visibility"].default.arg == "private"


def test_practice_session_schema_defaults_stay_backward_compatible() -> None:
    table = PracticeSessionV2.__table__
    assert table.c["practice_mode"].default.arg == "full_set"
    assert table.c["source_mode"].default.arg == "paper"
    assert table.c["exam_mode"].default.arg is False
