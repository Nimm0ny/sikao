from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from typing import cast
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PlanEventV2, PlanV2, PracticeSessionV2, RecommendationV2, UserV2
from sikao_api.db.session import load_runtime_metadata


REPO_ROOT = Path(__file__).resolve().parents[3]
ALEMBIC_INI = REPO_ROOT / "database" / "migrations" / "alembic.ini"
ALEMBIC_WORKDIR = REPO_ROOT / "database" / "migrations"


def _build_engine(database_file: Path):
    engine = create_engine(f"sqlite:///{database_file.as_posix()}")

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    load_runtime_metadata().create_all(engine)
    return engine


def _read_sqlite_indexes(database_file: Path, table_name: str) -> dict[str, tuple[bool, bool, tuple[str, ...]]]:
    with sqlite3.connect(database_file) as connection:
        rows = connection.execute(f"PRAGMA index_list('{table_name}')").fetchall()
        indexes: dict[str, tuple[bool, bool, tuple[str, ...]]] = {}
        for row in rows:
            index_name = str(row[1])
            columns = connection.execute(f"PRAGMA index_info('{index_name}')").fetchall()
            indexes[index_name] = (
                bool(row[2]),
                bool(row[4]),
                tuple(column_row[2] for column_row in columns),
            )
    return indexes


def _read_table_foreign_keys(
    database_file: Path,
    table_name: str,
) -> set[tuple[tuple[str, ...], str, tuple[str, ...], str]]:
    with sqlite3.connect(database_file) as connection:
        rows = connection.execute(f"PRAGMA foreign_key_list('{table_name}')").fetchall()
    grouped: dict[int, dict[str, object]] = {}
    for row in rows:
        foreign_key = grouped.setdefault(
            int(row[0]),
            {
                "from_columns": [],
                "ref_table": str(row[2]),
                "to_columns": [],
                "on_delete": str(row[6]).upper(),
            },
        )
        from_columns = foreign_key["from_columns"]
        to_columns = foreign_key["to_columns"]
        assert isinstance(from_columns, list)
        assert isinstance(to_columns, list)
        from_columns.append((int(row[1]), str(row[3])))
        to_columns.append((int(row[1]), str(row[4])))
    return {
        (
            tuple(column for _, column in sorted(cast(list[tuple[int, str]], entry["from_columns"]))),
            str(entry["ref_table"]),
            tuple(column for _, column in sorted(cast(list[tuple[int, str]], entry["to_columns"]))),
            str(entry["on_delete"]),
        )
        for entry in grouped.values()
    }


def _read_table_sql(database_file: Path, table_name: str) -> str:
    with sqlite3.connect(database_file) as connection:
        row = connection.execute(
            """
            SELECT sql
            FROM sqlite_master
            WHERE type = 'table'
              AND name = ?
            """,
            (table_name,),
        ).fetchone()
    assert row is not None
    return str(row[0])


def _run_alembic_command(database_file: Path, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{database_file.as_posix()}"
    env.pop("PYTHONPATH", None)
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            str(ALEMBIC_INI),
            *args,
        ],
        cwd=ALEMBIC_WORKDIR,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def test_home_b1_runtime_metadata_exposes_new_plan_tables_and_indexes(tmp_path: Path) -> None:
    database_file = tmp_path / "home-b1-runtime.db"
    engine = _build_engine(database_file)
    inspector = inspect(engine)
    try:
        tables = set(inspector.get_table_names())
        assert "plan_v2" in tables
        assert "plan_event_v2" in tables
        assert "plan_adjustment_v2" in tables
        assert "recommendation_v2" in tables
        assert "recommendation_feedback_v2" in tables
        assert "idempotency_key_v2" in tables
        assert "llm_call_v2" in tables
        assert "audit_log_v2" in tables

        practice_session_columns = {
            column["name"]: column for column in inspector.get_columns("practice_sessions_v2")
        }
        profile_goal_columns = {
            column["name"]: column for column in inspector.get_columns("profile_goals_v2")
        }
        profile_info_columns = {
            column["name"]: column for column in inspector.get_columns("profile_infos_v2")
        }

        assert "linked_plan_event_id" in practice_session_columns
        assert "linked_plan_event_occurrence_ref" in practice_session_columns
        assert "linked_recommendation_id" in practice_session_columns
        assert "exam_targets" in profile_goal_columns
        assert "ai_adjust_enabled" in profile_info_columns
        assert "dashboard_preferences" in profile_info_columns
        assert "recommender_preferences" in profile_info_columns
    finally:
        engine.dispose()

    plan_indexes = _read_sqlite_indexes(database_file, "plan_v2")
    event_indexes = _read_sqlite_indexes(database_file, "plan_event_v2")
    adjustment_indexes = _read_sqlite_indexes(database_file, "plan_adjustment_v2")
    recommendation_indexes = _read_sqlite_indexes(database_file, "recommendation_v2")
    llm_indexes = _read_sqlite_indexes(database_file, "llm_call_v2")

    assert plan_indexes["ix_plan_v2_user_active"] == (True, True, ("user_id",))
    assert plan_indexes["ix_plan_v2_user_status"] == (False, False, ("user_id", "status"))
    assert event_indexes["ix_event_v2_user_alive"] == (False, True, ("user_id",))
    assert adjustment_indexes["ix_adj_v2_pending_expires"] == (False, True, ("expires_at",))
    assert recommendation_indexes["ix_rec_v2_active"] == (False, True, ("user_id", "expires_at"))
    assert llm_indexes["ix_llm_parse_failed"] == (False, True, ("parse_status",))


def test_home_b1_active_plan_partial_unique_index_honors_soft_delete(tmp_path: Path) -> None:
    engine = _build_engine(tmp_path / "home-b1-partial.db")
    try:
        with Session(engine) as session:
            user = UserV2(display_name="home-b1-user")
            session.add(user)
            session.flush()
            user_id = user.id

            session.add(
                PlanV2(
                    user_id=user_id,
                    name="Primary Plan",
                    target_exam_id="guokao_2027",
                    target_exam_date=date(2027, 11, 28),
                    daily_minutes_target=120,
                    style="standard",
                    baseline={"xingce_score": 60},
                    focus_subjects=["yanyu"],
                    status="active",
                    source="user_manual",
                    change_log=[],
                )
            )
            session.commit()

        with Session(engine) as session:
            session.add(
                PlanV2(
                    user_id=user_id,
                    name="Conflicting Plan",
                    target_exam_id="guokao_2027",
                    target_exam_date=date(2027, 11, 29),
                    daily_minutes_target=150,
                    style="aggressive",
                    baseline={"xingce_score": 62},
                    focus_subjects=["panduan"],
                    status="active",
                    source="ai_generated",
                    change_log=[],
                )
            )
            with pytest.raises(IntegrityError):
                session.flush()
            session.rollback()

            session.add(
                PlanV2(
                    user_id=user_id,
                    name="Archived-like Active Plan",
                    target_exam_id="guokao_2027",
                    target_exam_date=date(2027, 12, 1),
                    daily_minutes_target=180,
                    style="loose",
                    baseline={"xingce_score": 64},
                    focus_subjects=["shuliang"],
                    status="active",
                    source="user_manual",
                    change_log=[],
                    deleted_at=datetime.now(UTC).replace(tzinfo=None),
                )
            )
            session.commit()

        with Session(engine) as session:
            count = session.scalar(
                select(func.count()).select_from(PlanV2).where(PlanV2.user_id == user_id)
            )
            assert count == 2
    finally:
        engine.dispose()


def test_home_b1_practice_session_links_set_null_when_targets_deleted(tmp_path: Path) -> None:
    engine = _build_engine(tmp_path / "home-b1-fk.db")
    try:
        with Session(engine) as session:
            user = UserV2(display_name="link-user")
            session.add(user)
            session.flush()

            plan = PlanV2(
                user_id=user.id,
                name="Linked Plan",
                target_exam_id="guokao_2027",
                target_exam_date=date(2027, 11, 30),
                daily_minutes_target=100,
                style="standard",
                baseline={},
                focus_subjects=[],
                status="active",
                source="user_manual",
                change_log=[],
            )
            session.add(plan)
            session.flush()

            event_row = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Evening Practice",
                category="xingce",
                notes="",
                start_at=datetime(2027, 1, 2, 10, 0, 0),
                end_at=datetime(2027, 1, 2, 11, 0, 0),
                timezone="Asia/Shanghai",
                recurring_exception_dates=[],
                status="planned",
                source="user_manual",
                change_log=[],
            )
            recommendation = RecommendationV2(
                user_id=user.id,
                title="Review weak items",
                reason="Low recent accuracy",
                estimated_minutes=20,
                cta="去复盘",
                action_type="review",
                payload={"review_item_ids": [1, 2]},
                expires_at=datetime(2027, 1, 2, 12, 0, 0),
                served_count=0,
                status="pending",
                source_signals={"accuracy_recent_50": 0.42},
            )
            session.add_all([event_row, recommendation])
            session.flush()

            practice_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="manual",
                status="draft",
                linked_plan_event_id=event_row.id,
                linked_plan_event_occurrence_ref="1:2026-06-15",
                linked_recommendation_id=recommendation.id,
                payload_json={},
            )
            session.add(practice_session)
            session.commit()
            session.refresh(practice_session)
            session.delete(event_row)
            session.delete(recommendation)
            session.commit()
            session.refresh(practice_session)

            assert practice_session.linked_plan_event_id is None
            assert practice_session.linked_plan_event_occurrence_ref == "1:2026-06-15"
            assert practice_session.linked_recommendation_id is None
    finally:
        engine.dispose()


def test_home_b1_alembic_upgrade_downgrade_cycle_preserves_home_tables(tmp_path: Path) -> None:
    database_file = tmp_path / f"home-b1-alembic-{uuid4().hex}.db"

    upgrade = _run_alembic_command(database_file, "upgrade", "head")
    assert upgrade.returncode == 0, upgrade.stderr or upgrade.stdout

    downgrade = _run_alembic_command(database_file, "downgrade", "-1")
    assert downgrade.returncode == 0, downgrade.stderr or downgrade.stdout

    reupgrade = _run_alembic_command(database_file, "upgrade", "head")
    assert reupgrade.returncode == 0, reupgrade.stderr or reupgrade.stdout

    with sqlite3.connect(database_file) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        }
        practice_session_columns = {
            row[1] for row in connection.execute("PRAGMA table_info('practice_sessions_v2')").fetchall()
        }
        profile_goal_columns = {
            row[1] for row in connection.execute("PRAGMA table_info('profile_goals_v2')").fetchall()
        }

    adjustment_indexes = _read_sqlite_indexes(database_file, "plan_adjustment_v2")
    recommendation_indexes = _read_sqlite_indexes(database_file, "recommendation_v2")
    practice_session_indexes = _read_sqlite_indexes(database_file, "practice_sessions_v2")
    practice_session_fks = _read_table_foreign_keys(database_file, "practice_sessions_v2")
    adjustment_fks = _read_table_foreign_keys(database_file, "plan_adjustment_v2")
    recommendation_fks = _read_table_foreign_keys(database_file, "recommendation_v2")
    plan_table_sql = _read_table_sql(database_file, "plan_v2")
    event_table_sql = _read_table_sql(database_file, "plan_event_v2")
    idem_table_sql = _read_table_sql(database_file, "idempotency_key_v2")

    assert "plan_v2" in tables
    assert "plan_event_v2" in tables
    assert "plan_adjustment_v2" in tables
    assert "recommendation_v2" in tables
    assert "idempotency_key_v2" in tables
    assert "audit_log_v2" in tables
    assert "linked_plan_event_id" in practice_session_columns
    assert "linked_plan_event_occurrence_ref" in practice_session_columns
    assert "linked_recommendation_id" in practice_session_columns
    assert "exam_targets" in profile_goal_columns
    assert adjustment_indexes["ix_adj_v2_pending_expires"] == (False, True, ("expires_at",))
    assert recommendation_indexes["ix_rec_v2_active"] == (False, True, ("user_id", "expires_at"))
    assert practice_session_indexes["ix_practice_sessions_v2_linked_plan_event"] == (
        False,
        False,
        ("linked_plan_event_id",),
    )
    assert practice_session_indexes["ix_practice_sessions_v2_linked_recommendation"] == (
        False,
        False,
        ("linked_recommendation_id",),
    )
    assert (
        ("linked_plan_event_id",),
        "plan_event_v2",
        ("id",),
        "SET NULL",
    ) in practice_session_fks
    assert (
        ("linked_recommendation_id",),
        "recommendation_v2",
        ("id",),
        "SET NULL",
    ) in practice_session_fks
    assert (("llm_call_id",), "llm_call_v2", ("id",), "SET NULL") in adjustment_fks
    assert (("llm_call_id",), "llm_call_v2", ("id",), "SET NULL") in recommendation_fks
    assert "daily_minutes_target BETWEEN 60 AND 720" in plan_table_sql
    assert "end_at > start_at" in event_table_sql
    assert "uq_idem_key" in idem_table_sql
