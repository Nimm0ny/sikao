from __future__ import annotations

import importlib.util
import os
import sqlite3
import subprocess
import sys
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db import schemas_v2
from sikao_api.db.models_v2 import QuestionV2

from _practice_phase_p1_support import (
    ALEMBIC_INI,
    API_SRC,
    REPO_ROOT,
    engine_with_fk,
    list_v2_tables,
    make_database,
    run_alembic,
    seed_revision,
)


def test_question_metadata_upgrade_and_downgrade_cycle(tmp_path) -> None:
    db_file, env, _ = make_database(tmp_path)
    run_alembic(env, "upgrade", "head")

    with sqlite3.connect(db_file) as conn:
        question_cols = {row[1] for row in conn.execute("PRAGMA table_info(questions_v2)")}
        assert {
            "ability_dimensions",
            "discrimination_index",
            "heat_score",
            "complexity_level",
            "knowledge_tags",
        }.issubset(question_cols)
        assert {"knowledge_point_v2", "question_knowledge_point_v2"}.issubset(
            list_v2_tables(conn)
        )

    run_alembic(env, "downgrade", "1018_review_item_reason")
    with sqlite3.connect(db_file) as conn:
        question_cols = {row[1] for row in conn.execute("PRAGMA table_info(questions_v2)")}
        assert "ability_dimensions" not in question_cols
        tables = list_v2_tables(conn)
        assert "knowledge_point_v2" not in tables
        assert "question_knowledge_point_v2" not in tables

    run_alembic(env, "upgrade", "head")


def test_question_metadata_invalid_ability_dimensions_rejected(tmp_path) -> None:
    _, env, db_url = make_database(tmp_path)
    run_alembic(env, "upgrade", "head")
    engine = engine_with_fk(db_url)
    try:
        _, revision_id = seed_revision(engine)
        with Session(engine) as session:
            bad_question = QuestionV2(
                revision_id=revision_id,
                item_no=1,
                subject_kind="xingce",
                prompt="bad dimensions",
                answer_kind="single_choice",
                status="published",
                content_json={"stem": "bad dimensions"},
                ability_dimensions=["reasoning", "not_valid"],
            )
            session.add(bad_question)
            with pytest.raises(IntegrityError):
                session.commit()
    finally:
        engine.dispose()


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_practice_p1_json_columns_use_jsonb() -> None:
    base_url = make_url(os.environ["TEST_POSTGRESQL_URL"])
    test_database = f"sikao_practice_p1_{uuid4().hex[:8]}"
    admin_engine = create_engine(base_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin_engine.begin() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
        connection.execute(text(f'CREATE DATABASE "{test_database}"'))

    database_url = base_url.set(database=test_database).render_as_string(hide_password=False)
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env["PYTHONPATH"] = str(API_SRC)

    try:
        subprocess.run(
            [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), "upgrade", "head"],
            check=True,
            cwd=REPO_ROOT,
            env=env,
        )
        engine = create_engine(database_url, future=True)
        try:
            with engine.connect() as connection:
                rows = connection.execute(
                    text(
                        """
                        SELECT table_name, column_name, udt_name
                        FROM information_schema.columns
                        WHERE table_name IN (
                            'questions_v2',
                            'practice_stats_snapshot_v2',
                            'ai_generated_question_request_v2',
                            'daily_practice_v2',
                            'user_practice_preferences_v2'
                        )
                          AND column_name IN (
                            'ability_dimensions',
                            'knowledge_tags',
                            'recent_trend',
                            'request_params',
                            'pool_question_ids',
                            'llm_generated_question_ids',
                            'question_ids',
                            'payload'
                        )
                        ORDER BY table_name, column_name
                        """
                    )
                ).fetchall()
        finally:
            engine.dispose()
        assert rows
        assert all(row.udt_name == "jsonb" for row in rows)
    finally:
        cleanup_engine = create_engine(base_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
        try:
            with cleanup_engine.begin() as connection:
                connection.execute(
                    text(
                        """
                        SELECT pg_terminate_backend(pid)
                        FROM pg_stat_activity
                        WHERE datname = :database_name
                          AND pid <> pg_backend_pid()
                        """
                    ),
                    {"database_name": test_database},
                )
                connection.execute(text(f'DROP DATABASE IF EXISTS "{test_database}"'))
        finally:
            cleanup_engine.dispose()
            admin_engine.dispose()


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_question_metadata_phase1_invariants(tmp_path) -> None:
    from _helpers.postgres_temp_db import build_postgres_engine
    from _helpers.practice_content_support import build_client

    with build_postgres_engine("sikao_practice_qmeta") as engine:
        database_url = engine.url.render_as_string(hide_password=False)
        env = os.environ.copy()
        env["DATABASE_URL"] = database_url
        env["PYTHONPATH"] = str(API_SRC)
        subprocess.run(
            [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), "upgrade", "head"],
            check=True,
            cwd=REPO_ROOT,
            env=env,
        )

        with engine.connect() as connection:
            assert connection.execute(text("SELECT COUNT(*) FROM knowledge_point_v2")).scalar_one() == 0
            assert (
                connection.execute(text("SELECT COUNT(*) FROM question_knowledge_point_v2")).scalar_one()
                == 0
            )

        constraints = {
            constraint["name"]
            for constraint in inspect(engine).get_check_constraints("questions_v2")
        }
        assert "ck_q_v2_complexity_range" in constraints
        assert "ck_q_v2_heat_non_negative" in constraints

        with build_client(
            tmp_path,
            database_url=database_url,
            initialize_schema=False,
            schema_token="practice-qmeta-phase1",
        ) as client:
            paths = set(client.app.openapi()["paths"].keys())

        assert not any("knowledge-point" in path for path in paths)
        assert schemas_v2.QuestionEnvelopeV2.model_fields["metadata_preview"].default is None
        assert importlib.util.find_spec("sikao_api.modules.question_metadata") is None
