"""Create and import the self-contained MVP demo question bank.

This script intentionally does not read ``BACKEND_DATA_ROOT``. It generates a
small deterministic standard-json bank inside the repository and imports it via
the same ExamPaperService path used by real Fenbi/AIPTA data.

Default dataset:
- 10 xingce papers, 4 questions each
- 100 shenlun papers, 1 essay question each

Usage:
    python -m scripts.import.import_mvp_demo
    python -m scripts.import.import_mvp_demo --skip-migrations
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import sessionmaker

from sikao_api.core.config import get_settings
from sikao_api.db.models import PaperRevision
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService

REPO_ROOT = Path(__file__).resolve().parents[2]
SEED_ROOT = REPO_ROOT / "database" / "seeds" / "mvp-demo"
GENERATED_ROOT = SEED_ROOT / "generated"
ALEMBIC_INI = REPO_ROOT / "database" / "migrations" / "alembic.ini"

XINGCE_COUNT = 10
SHENLUN_COUNT = 100

SUBJECTS = [
    ("言语理解", "片段阅读"),
    ("判断推理", "图形推理"),
    ("数量关系", "基础运算"),
    ("资料分析", "增长率"),
]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-url", default=None, help="Defaults to settings.database_url")
    parser.add_argument("--skip-migrations", action="store_true")
    parser.add_argument("--xingce-count", type=int, default=XINGCE_COUNT)
    parser.add_argument("--shenlun-count", type=int, default=SHENLUN_COUNT)
    parser.add_argument("--seed-root", type=Path, default=GENERATED_ROOT)
    args = parser.parse_args(argv)

    settings = get_settings()
    db_url = args.db_url or settings.database_url
    if not args.skip_migrations:
        _run_migrations(db_url)

    files = _write_demo_files(
        root=args.seed_root,
        xingce_count=args.xingce_count,
        shenlun_count=args.shenlun_count,
    )
    summary = _import_files(files=files, base_dir=args.seed_root, db_url=db_url)
    print(
        "MVP demo seed ready: "
        f"{summary['new']} new, {summary['skipped']} skipped, "
        f"{summary['failed']} failed, {summary['questions']} questions"
    )
    if summary["failed"]:
        for item in summary["failures"]:
            print(f"  [FAILED] {item['file']}: {item['error']}")
    print(f"Generated seed files: {args.seed_root}")
    return 0 if summary["failed"] == 0 else 1


def _run_migrations(db_url: str) -> None:
    os.environ["DATABASE_URL"] = db_url
    get_settings.cache_clear()
    cfg = Config(str(ALEMBIC_INI))
    command.upgrade(cfg, "head")


def _write_demo_files(*, root: Path, xingce_count: int, shenlun_count: int) -> list[Path]:
    root.mkdir(parents=True, exist_ok=True)
    files: list[Path] = []

    for index in range(1, xingce_count + 1):
        payload = _build_xingce_payload(index)
        files.append(_write_json(root / "xingce" / f"{payload['paperCode']}.standard.json", payload))

    for index in range(1, shenlun_count + 1):
        payload = _build_shenlun_payload(index)
        files.append(_write_json(root / "shenlun" / f"{payload['paperCode']}.standard.json", payload))

    return files


def _write_json(path: Path, payload: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    path.write_text(content + "\n", encoding="utf-8")
    return path


def _import_files(*, files: list[Path], base_dir: Path, db_url: str) -> dict[str, Any]:
    engine = create_engine(db_url, future=True)
    _ensure_schema_ready(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    counters: dict[str, Any] = {"new": 0, "skipped": 0, "failed": 0, "questions": 0, "failures": []}

    with session_factory() as session:
        service = ExamPaperService(session)
        for path in files:
            content = path.read_bytes()
            existing = session.scalar(select(PaperRevision).where(PaperRevision.source_hash == _sha256(content)))
            if existing is not None:
                counters["skipped"] += 1
                counters["questions"] += existing.question_count
                continue

            summary = service.import_standard_json_files(
                files=[(path.relative_to(base_dir).as_posix(), content)],
                base_dir=base_dir,
                source_name="mvp-demo-seed",
                created_by="mvp-demo-seed",
            )
            item = next(iter(summary.items), None)
            if item is None or item.status == "failed":
                counters["failed"] += 1
                counters["failures"].append(
                    {
                        "file": str(path.relative_to(base_dir)),
                        "error": item.error_message if item is not None else "no import item",
                    }
                )
                continue
            service.publish_revision(
                str(item.paper_code),
                int(item.revision_id),
                released_by="mvp-demo-seed",
                release_execution_id=f"mvp-demo:{item.paper_code}:{item.source_hash}",
                release_note="Self-contained MVP demo seed.",
            )
            counters["new"] += 1
            counters["questions"] += item.imported_question_count
        session.commit()

    return counters


def _ensure_schema_ready(engine) -> None:
    tables = set(inspect(engine).get_table_names())
    required = {"alembic_version", "papers", "paper_revisions", "questions"}
    missing = sorted(required - tables)
    if missing:
        raise RuntimeError(
            "database schema is not ready; missing tables: "
            + ", ".join(missing)
            + ". Run `npm run bootstrap:mvp-demo` or run Alembic before `npm run seed:mvp-demo`."
        )


def _sha256(content: bytes) -> str:
    import hashlib

    return hashlib.sha256(content).hexdigest()


def _build_xingce_payload(index: int) -> dict[str, Any]:
    paper_code = f"MVPXC{index:03d}"
    year = 2026 - ((index - 1) % 4)
    blocks = []
    for q_index, (top_type, subtype) in enumerate(SUBJECTS, start=1):
        answer = ["A", "B", "C", "D"][(index + q_index) % 4]
        blocks.append(
            {
                "type": "question",
                "sourceUuid": f"{paper_code}-q{q_index}",
                "questionKind": "single_choice",
                "subtypeName": subtype,
                "stemText": f"{paper_code} 第 {q_index} 题: 选择最符合题意的一项。",
                "difficultyCode": ["easy", "medium", "hard"][(index + q_index) % 3],
                "rendererKey": "single_choice",
                "options": [
                    {"key": "A", "text": "选项 A"},
                    {"key": "B", "text": "选项 B"},
                    {"key": "C", "text": "选项 C"},
                    {"key": "D", "text": "选项 D"},
                ],
                "answerKeys": [answer],
                "explanationText": f"本题 demo 正确答案为 {answer}。",
                "canonicalTaxonomy": {
                    "canonicalTopType": top_type,
                    "canonicalSubtype": subtype,
                    "rawRenderType": "single_choice",
                    "mappingSource": "mvp-demo",
                },
                "tags": ["mvp-demo", top_type],
            }
        )

    return {
        "paperCode": paper_code,
        "paperName": f"MVP 行测演示卷 {index:03d}",
        "examYear": year,
        "sourceProvider": "mvp-demo",
        "sourceKind": "demo",
        "sortOrder": year * 1000 + index,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "xingce",
                "title": "行政职业能力测验",
                "instructionText": "本卷为 MVP demo 数据, 用于本地启动和功能验收。",
                "blocks": blocks,
            }
        ],
    }


def _build_shenlun_payload(index: int) -> dict[str, Any]:
    paper_code = f"MVPSL{index:03d}"
    year = 2026 - ((index - 1) % 5)
    full_score = 40 if index % 3 else 35
    return {
        "paperCode": paper_code,
        "paperName": f"MVP 申论演示卷 {index:03d}",
        "examYear": year,
        "sourceProvider": "mvp-demo",
        "sourceKind": "demo",
        "sortOrder": year * 1000 + index,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "shenlun",
                "title": "申论",
                "instructionText": "根据给定材料作答。",
                "blocks": [
                    {
                        "type": "question",
                        "sourceUuid": f"{paper_code}-q1",
                        "questionKind": "essay",
                        "subtypeName": "申论大作文",
                        "stemText": f"<p>请围绕公共治理主题, 完成 {paper_code} 的申论作答。</p>",
                        "answerKeys": [],
                        "options": [],
                        "explanationText": "",
                        "difficultyCode": "medium",
                        "rendererKey": "essay",
                        "isGradable": False,
                        "typePayload": {
                            "materialTexts": [
                                f"材料一: {paper_code} 关注基层治理、公共服务与数字化转型。",
                                "材料二: 作答应兼顾问题意识、政策理解和表达结构。",
                            ],
                            "wordLimitMin": 800,
                            "wordLimitMax": 1000,
                            "suggestedMinutes": 60,
                            "fullScore": full_score,
                        },
                        "canonicalTaxonomy": {
                            "canonicalTopType": "申论",
                            "canonicalSubtype": "文章写作",
                            "rawRenderType": "essay",
                            "mappingSource": "mvp-demo",
                        },
                        "tags": ["mvp-demo", "申论"],
                    }
                ],
            }
        ],
    }


if __name__ == "__main__":
    raise SystemExit(main())
