from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from _helpers.postgres_temp_db import build_postgres_engine
from test_import_real_exams import (
    API_SRC,
    REPO_ROOT,
    _MODULE,
    _MAPPER,
    _PARSER,
    _alembic,
    _write_json_input,
)
from sikao_api.db.models_v2 import PaperV2


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_apply_uses_per_paper_transactions(tmp_path: Path) -> None:
    with build_postgres_engine("sikao_import_batch") as engine:
        env = os.environ.copy()
        env["DATABASE_URL"] = engine.url.render_as_string(hide_password=False)
        env["PYTHONPATH"] = os.pathsep.join([str(API_SRC), str(REPO_ROOT)])
        _alembic(env, "upgrade", "head")

        batch_path = tmp_path / "batch-postgres.json"
        _write_json_input(batch_path)
        payload = json.loads(batch_path.read_text(encoding="utf-8"))
        payload = [
            payload,
            {
                **payload,
                "paper_code": "GX-2024-02",
                "questions": [
                    payload["questions"][0],
                    {
                        **payload["questions"][1],
                        "prompt": "Question 2 changed",
                        "content_json": {
                            "stem": "Question 2 changed",
                            "options": ["A", "B"],
                            "correct_answer": "B",
                        },
                    },
                ],
            },
        ]
        batch_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

        with pytest.raises(ValueError, match="partial overlap"):
            _MODULE._build_manifest(
                engine,
                _MAPPER.map_raw_papers(_PARSER.load_raw_papers(batch_path)),
                dry_run=False,
            )

        with Session(engine) as session:
            assert session.scalar(select(PaperV2).where(PaperV2.paper_code == "GX-2024-01")) is not None
            assert session.scalar(select(PaperV2).where(PaperV2.paper_code == "GX-2024-02")) is None
