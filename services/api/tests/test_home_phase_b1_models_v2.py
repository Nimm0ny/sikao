from __future__ import annotations

import sqlite3
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event, func, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PlanV2, UserV2
from sikao_api.db.session import load_runtime_metadata


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


def test_home_b1_runtime_metadata_exposes_new_plan_tables_and_indexes(tmp_path: Path) -> None:
    database_file = tmp_path / "home-b1-runtime.db"
    engine = _build_engine(database_file)
    inspector = inspect(engine)
    try:
        tables = set(inspector.get_table_names())
        assert "plan_v2" in tables
        assert "plan_event_v2" in tables
    finally:
        engine.dispose()

    plan_indexes = _read_sqlite_indexes(database_file, "plan_v2")
    event_indexes = _read_sqlite_indexes(database_file, "plan_event_v2")

    assert plan_indexes["ix_plan_v2_user_active"] == (True, True, ("user_id",))
    assert plan_indexes["ix_plan_v2_user_status"] == (False, False, ("user_id", "status"))
    assert event_indexes["ix_event_v2_user_alive"] == (False, True, ("user_id",))


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
