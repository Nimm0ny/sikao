from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, QuestionV2, UserV2


REPO_ROOT = Path(__file__).resolve().parents[3]
ALEMBIC_INI = REPO_ROOT / "database" / "migrations" / "alembic.ini"
API_SRC = REPO_ROOT / "services" / "api" / "src"


def enable_sqlite_fk(dbapi_connection: Any, _record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def make_database(tmp_dir: Path) -> tuple[Path, dict[str, str], str]:
    db_file = tmp_dir / f"practice-p1-{uuid4().hex}.db"
    env = os.environ.copy()
    db_url = f"sqlite:///{db_file.as_posix()}"
    env["DATABASE_URL"] = db_url
    env["PYTHONPATH"] = str(API_SRC)
    return db_file, env, db_url


def run_alembic(env: dict[str, str], *args: str) -> None:
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), *args],
        check=True,
        cwd=REPO_ROOT,
        env=env,
    )


def engine_with_fk(db_url: str):
    engine = create_engine(db_url, future=True)
    event.listen(engine, "connect", enable_sqlite_fk)
    return engine


def seed_user(engine) -> int:
    with Session(engine) as session:
        user = UserV2(public_id=str(uuid4()), display_name="seed user")
        session.add(user)
        session.commit()
        return user.id


def seed_revision(
    engine,
    *,
    paper_code: str = "P1-001",
    subject_kind: str = "xingce",
) -> tuple[int, int]:
    with Session(engine) as session:
        paper = PaperV2(
            paper_code=paper_code,
            title=f"Paper {paper_code}",
            subject_kind=subject_kind,
        )
        session.add(paper)
        session.flush()
        revision = PaperRevisionV2(
            paper_id=paper.id,
            revision_number=1,
            status="published",
        )
        session.add(revision)
        session.commit()
        return paper.id, revision.id


def seed_question(engine, *, revision_id: int, item_no: int = 1) -> int:
    with Session(engine) as session:
        question = QuestionV2(
            revision_id=revision_id,
            item_no=item_no,
            subject_kind="xingce",
            prompt=f"Question {item_no}",
            answer_kind="single_choice",
            status="published",
            content_json={"stem": f"Question {item_no}"},
        )
        session.add(question)
        session.commit()
        return question.id


def list_v2_tables(connection: sqlite3.Connection) -> set[str]:
    return {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%_v2'"
        )
    }
