"""Phase-Practice WU-B10.3: questions_v2 post-backfill invariants.

Covers content_hash backfill + dedup, UNIQUE(content_hash), composite index
ix_questions_v2_source_active, source-immutable trigger (SQLite path; PG
path mirrors the same SQL via a different RAISE syntax), and the alembic
round-trip.
"""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import (
    PaperRevisionV2,
    PaperV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    QuestionV2,
    UserV2,
)


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"
_API_SRC = _REPO_ROOT / "services" / "api" / "src"


def _enable_sqlite_fk(dbapi_connection: Any, _record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"b10_3-{uuid4().hex}.db"
    db_file.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    db_url = f"sqlite:///{db_file.as_posix()}"
    env["DATABASE_URL"] = db_url
    env["PYTHONPATH"] = str(_API_SRC)
    return db_file, env, db_url


def _alembic(env: dict[str, str], *args: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(_ALEMBIC_INI), *args],
        check=True, cwd=_REPO_ROOT, env=env,
    )


def _engine_with_fk(db_url: str):
    engine = create_engine(db_url, future=True)
    event.listen(engine, "connect", _enable_sqlite_fk)
    return engine


def _seed_paper_revision(db_url: str, *, suffix: str) -> int:
    engine = _engine_with_fk(db_url)
    try:
        with Session(engine) as session:
            paper = PaperV2(paper_code=f"paper-{suffix}", title=f"paper {suffix}", subject_kind="xingce")
            session.add(paper)
            session.flush()
            revision = PaperRevisionV2(paper_id=paper.id, revision_number=1, status="draft")
            session.add(revision)
            session.flush()
            session.commit()
            return revision.id
    finally:
        engine.dispose()


def test_content_hash_helper_is_deterministic() -> None:
    """Hash is order-stable across dict insertion order and content-sensitive."""
    a = compute_question_content_hash("题干", {"options": ["A", "B"], "answer": "A"})
    b = compute_question_content_hash("题干", {"answer": "A", "options": ["A", "B"]})
    assert a == b and len(a) == 32
    assert compute_question_content_hash("题干", {"options": ["A", "C"], "answer": "A"}) != a


def test_upgrade_backfills_content_hash_and_marks_dedup(tmp_path: Path) -> None:
    """Two pre-1014 rows with identical (prompt, content_json) come out of
    1014 with the oldest keeping its hash + active, and the loser content_hash
    nulled (so UNIQUE can land) + is_active flipped off (so the picker skips)."""
    db_file, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "1013_question_v2_quality_and_ai_fields")
    revision_id = _seed_paper_revision(db_url, suffix="dedup")

    with sqlite3.connect(db_file) as conn:
        for item_no, prompt in [(1, "duplicated"), (2, "duplicated"), (3, "unique")]:
            conn.execute(
                "INSERT INTO questions_v2 "
                "(revision_id, item_no, subject_kind, prompt, answer_kind, status, content_json, "
                "source, exam_type, category_l1, historical_accuracy, answer_count, "
                "quality_score, report_count, is_active, created_at, updated_at) "
                "VALUES (?, ?, 'xingce', ?, 'single_choice', 'draft', '{\"answer\":\"A\"}', "
                "'real_exam', 'national', 'verbal', 0, 0, 5, 0, 1, "
                "datetime('now'), datetime('now'))",
                (revision_id, item_no, prompt),
            )
        conn.commit()

    _alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        rows = conn.execute(
            "SELECT prompt, content_hash, is_active FROM questions_v2 ORDER BY id"
        ).fetchall()
    by_prompt: dict[str, list[tuple[str | None, int]]] = {}
    for prompt, chash, active in rows:
        by_prompt.setdefault(prompt, []).append((chash, active))

    keeper, loser = by_prompt["duplicated"]
    assert keeper[0] is not None and len(keeper[0]) == 32 and keeper[1] == 1
    assert loser == (None, 0), "dedup loser must have content_hash NULL + is_active 0"
    unique_chash, unique_active = by_prompt["unique"][0]
    assert unique_active == 1 and unique_chash is not None and unique_chash != keeper[0]


def test_unique_constraint_rejects_post_upgrade_duplicate(tmp_path: Path) -> None:
    """Post-1014 INSERT with a colliding content_hash must fail at DB level."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    revision_id = _seed_paper_revision(db_url, suffix="unique-violation")

    engine = _engine_with_fk(db_url)
    try:
        with Session(engine) as session:
            duplicate = "a" * 32
            session.add(QuestionV2(
                revision_id=revision_id, item_no=1, subject_kind="xingce",
                prompt="first", answer_kind="single_choice", status="draft",
                content_json={"answer": "A"}, content_hash=duplicate,
            ))
            session.commit()
            with pytest.raises(IntegrityError):
                session.add(QuestionV2(
                    revision_id=revision_id, item_no=2, subject_kind="xingce",
                    prompt="second", answer_kind="single_choice", status="draft",
                    content_json={"answer": "B"}, content_hash=duplicate,
                ))
                session.commit()
    finally:
        engine.dispose()


def test_source_update_is_blocked_by_trigger(tmp_path: Path) -> None:
    """Trigger aborts UPDATE that changes source; non-source UPDATE still works."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")
    revision_id = _seed_paper_revision(db_url, suffix="immutable")

    engine = _engine_with_fk(db_url)
    try:
        with Session(engine) as session:
            session.add(QuestionV2(
                revision_id=revision_id, item_no=1, subject_kind="xingce",
                prompt="protected", answer_kind="single_choice", status="draft",
                content_json={"answer": "A"}, source="real_exam",
            ))
            session.commit()

            session.execute(text("UPDATE questions_v2 SET prompt = 'edited' WHERE item_no = 1"))
            session.commit()
            assert session.execute(
                text("SELECT prompt FROM questions_v2 WHERE item_no = 1")
            ).scalar_one() == "edited"

            with pytest.raises((IntegrityError, OperationalError)) as exc:
                session.execute(
                    text("UPDATE questions_v2 SET source = 'ai_generated' WHERE item_no = 1")
                )
                session.commit()
            assert "immutable" in str(exc.value).lower()
            session.rollback()

            assert session.execute(
                text("SELECT source FROM questions_v2 WHERE item_no = 1")
            ).scalar_one() == "real_exam"
    finally:
        engine.dispose()


def test_indexes_and_trigger_round_trip(tmp_path: Path) -> None:
    """head -> 1013 drops 1014 invariants; reupgrade reinstates them."""
    db_file, env, _ = _make_database(tmp_path)

    def _state() -> tuple[set[str], set[str]]:
        with sqlite3.connect(db_file) as conn:
            indexes = {row[1] for row in conn.execute("PRAGMA index_list(questions_v2)")}
            triggers = {row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='questions_v2'"
            )}
        return indexes, triggers

    _alembic(env, "upgrade", "head")
    indexes, triggers = _state()
    assert "ix_questions_v2_source_active" in indexes
    assert "questions_v2_source_protect" in triggers

    _alembic(env, "downgrade", "1013_question_v2_quality_and_ai_fields")
    indexes, triggers = _state()
    assert "ix_questions_v2_source_active" not in indexes
    assert "questions_v2_source_protect" not in triggers

    _alembic(env, "upgrade", "head")
    indexes, triggers = _state()
    assert "ix_questions_v2_source_active" in indexes
    assert "questions_v2_source_protect" in triggers



def test_content_hash_helper_rejects_none_inputs() -> None:
    """AGENTS-H7 fail-fast: prompt and content_json are NOT NULL in the DB,
    so passing None for either is an impossible state that the helper must
    refuse rather than silently coercing into a stable digest (which would
    cause two malformed rows to dedup-collide in WU-B10.3 backfill)."""
    with pytest.raises(ValueError, match="prompt"):
        compute_question_content_hash(None, {})  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="content_json"):
        compute_question_content_hash("prompt", None)


def test_dedup_loser_remains_readable_via_session_answer(tmp_path: Path) -> None:
    """WU-B10.3 dedup losers come out with content_hash=NULL and is_active=0
    so the picker stops resurfacing them. But the model docstring promises
    historical reads (the user's own session result page) still render the
    question text via the FK join. This regression test pins that contract:
    a row with is_active=false must remain reachable from
    practice_session_answers_v2.question_id without ever filtering on
    questions_v2.is_active. If a future picker / result query refactors to
    `WHERE is_active=true` and breaks user history, this test catches it."""
    _, env, db_url = _make_database(tmp_path)
    _alembic(env, "upgrade", "head")

    engine = _engine_with_fk(db_url)
    try:
        with Session(engine) as session:
            user = UserV2(public_id=str(uuid4()), display_name="historical user")
            paper = PaperV2(paper_code=f"p-{uuid4().hex}", title="paper", subject_kind="xingce")
            session.add_all([user, paper])
            session.flush()
            revision = PaperRevisionV2(paper_id=paper.id, revision_number=1, status="draft")
            session.add(revision)
            session.flush()
            retired = QuestionV2(
                revision_id=revision.id, item_no=1, subject_kind="xingce",
                prompt="historical question stem", answer_kind="single_choice",
                status="draft", content_json={"answer": "A"},
            )
            session.add(retired)
            session.flush()
            ps = PracticeSessionV2(
                user_id=user.id, track="xingce", entry_kind="paper",
                status="submitted", payload_json={},
            )
            session.add(ps)
            session.flush()
            answer = PracticeSessionAnswerV2(
                session_id=ps.id,
                question_id=retired.id,
                question_key="q-1",
                display_order=1,
                response_json={"choice": "A"},
                is_correct=True,
            )
            session.add(answer)
            session.commit()
            retired_id = retired.id
            session_id = ps.id

        # Simulate the WU-B10.3 dedup demote: hash NULLed, is_active flipped off.
        # We cannot UPDATE source (immutable trigger), but is_active is fair game.
        with Session(engine) as session:
            session.execute(
                text(
                    "UPDATE questions_v2 SET is_active = 0, content_hash = NULL "
                    "WHERE id = :id"
                ),
                {"id": retired_id},
            )
            session.commit()

        # Historical-read contract: even though the question is retired, the
        # answer row's question_id still resolves and the prompt still reads.
        with Session(engine) as session:
            row = session.execute(
                text(
                    "SELECT q.prompt, q.is_active "
                    "FROM practice_session_answers_v2 a "
                    "JOIN questions_v2 q ON q.id = a.question_id "
                    "WHERE a.session_id = :sid"
                ),
                {"sid": session_id},
            ).one()
            assert row.prompt == "historical question stem"
            assert row.is_active == 0
    finally:
        engine.dispose()
