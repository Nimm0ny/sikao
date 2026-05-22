"""Import real-exam data into the Phase-Practice V2 schema.

Supports JSON and CSV inputs and exposes two execution modes:

  - dry-run: parse + map + compare against the current V2 DB without writing
  - apply:   persist papers/revisions/questions into papers_v2 / questions_v2

Fail-fast rules:
  - unsupported file formats are rejected immediately
  - malformed rows stop the run
  - partial content-hash overlap with existing questions is rejected because
    the current V2 schema cannot safely express "same question in two revisions"
    without either duplicating a UNIQUE(content_hash) row or silently dropping it
"""

# ruff: noqa: E402

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

REPO_ROOT = Path(__file__).resolve().parents[2]
API_SRC = REPO_ROOT / "services" / "api" / "src"
IMPORT_ROOT = Path(__file__).resolve().parent
if str(API_SRC) not in sys.path:
    sys.path.insert(0, str(API_SRC))
if str(IMPORT_ROOT) not in sys.path:
    sys.path.insert(0, str(IMPORT_ROOT))

from importers import ImportPaper, apply_import_plan, load_raw_papers, map_raw_papers, plan_import


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="JSON/CSV file or directory to import")
    parser.add_argument("--db-url", default=None, help="Override DATABASE_URL for dry-run/apply")
    parser.add_argument("--dry-run", action="store_true", help="Parse + diff only, no writes")
    parser.add_argument("--manifest", default=None, help="Optional path to write the JSON manifest")
    args = parser.parse_args(argv)

    db_url = args.db_url or _database_url_from_env()
    raw_papers = load_raw_papers(Path(args.input))
    import_papers = map_raw_papers(raw_papers)

    engine = create_engine(db_url, future=True)
    try:
        manifest = _build_manifest(engine, import_papers, dry_run=args.dry_run)
    finally:
        engine.dispose()

    payload = json.dumps(manifest, ensure_ascii=False, indent=2)
    if args.manifest is not None:
        manifest_path = Path(args.manifest).expanduser().resolve()
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(payload, encoding="utf-8")
    print(payload)
    return 0


def _database_url_from_env() -> str:
    import os

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL or --db-url is required")
    return db_url


def _build_manifest(
    engine: Engine,
    import_papers: list[ImportPaper],
    *,
    dry_run: bool,
) -> dict[str, Any]:
    applied: list[dict[str, Any]] = []
    planned: list[dict[str, Any]] = []
    for paper in import_papers:
        with Session(engine) as session:
            plan = plan_import(session, paper)
            planned.append(
                {
                    "paper_code": paper.paper_code,
                    "source_path": str(paper.source_path),
                    "action": plan.action,
                    "revision_number": plan.revision_number,
                    "reason": plan.reason,
                    "question_count": len(paper.questions),
                    "signature": paper.signature,
                }
            )
            if dry_run or plan.action == "skip":
                session.rollback()
                continue
            applied.append(apply_import_plan(session, paper, plan))
            session.commit()
            session.expunge_all()

    return {
        "dry_run": dry_run,
        "paper_count": len(import_papers),
        "planned": planned,
        "applied": applied,
    }


if __name__ == "__main__":
    raise SystemExit(main())
