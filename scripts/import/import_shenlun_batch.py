"""Batch import shenlun (申论) papers from backend_data mirror into the database.

按 CLAUDE.md §12 「数据导入设计规范」与 import_fenbi_batch.py 同款流程实现：
- 扫 `$BACKEND_DATA_ROOT/shenlun/standard_json/` 下所有 `FBSL-*.standard.json`（745 套）
- 每个 paper 独立调 ExamPaperService.import_standard_json_files（每套独立事务）
- 三层 dedupe 中本脚本只走 DB source_hash 这一层（申论无 mirror 同步、无 adapter staging 中间产物，
  standard.json 已是终态）
- 写 manifest.json 报告：new / hash-skipped / failed

跟 import_fenbi_batch.py 的核心差异：
- 跳过 adapter（fenbi_to_standard.convert_paper） —— 申论 standard.json 已经是终态格式
- mirror 扫"文件级"而不是"目录级"（`mirror_root/*.standard.json` vs `mirror_root/papers/<id_name>/`）
- 无 staging 中间目录（不调 convert_paper 也就没有 staging 输出）
- 无 assets 处理（申论所有材料文本内嵌 standard.json，0 处 `assets` 引用 —— 已实测验证）
- base_dir 直接传 standard.json 所在目录（即 mirror_root）

CLI:
    # 用默认路径（mirror_root 来自 settings.backend_data_root / shenlun / standard_json）
    python -m scripts.import.import_shenlun_batch

    # 显式指定
    python -m scripts.import.import_shenlun_batch \\
        --mirror D:/py_pj/backend_data/shenlun/standard_json \\
        --db-url postgresql+psycopg://exam_api:secret@127.0.0.1:5432/exam_api
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from sikao_api.core.config import get_settings
from sikao_api.db.base import Base
from sikao_api.db.models import PaperRevision
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService

logger = logging.getLogger(__name__)

# 默认从 settings 读 backend_data_root；CLI --mirror 可覆盖。
_settings = get_settings()
_BACKEND_DATA = Path(_settings.backend_data_root)
DEFAULT_MIRROR = _BACKEND_DATA / "shenlun" / "standard_json"


def run_batch(
    *,
    mirror_root: Path,
    db_url: str,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """单进程批量入库；多进程同时跑会在 source_hash dedupe 检查与 commit 之间 race，
    本脚本不保证并发安全 — PoC 阶段单机单跑足够。"""
    mirror_root = mirror_root.resolve()
    if not mirror_root.is_dir():
        raise FileNotFoundError(
            f"shenlun standard_json dir missing: {mirror_root}. "
            "Expected `$BACKEND_DATA_ROOT/shenlun/standard_json/FBSL-*.standard.json`."
        )

    paper_files = sorted(mirror_root.glob("FBSL-*.standard.json"))
    if not paper_files:
        raise FileNotFoundError(
            f"no FBSL-*.standard.json under {mirror_root}. "
            "Check fenbi_shenlun_to_standard.py output location."
        )
    if limit is not None:
        paper_files = paper_files[:limit]
    logger.info("Found %d shenlun paper(s) under %s", len(paper_files), mirror_root)

    if dry_run:
        logger.info("dry-run: skipping DB session & import; reporting discovery only")
        manifest = _assemble_manifest(
            mirror_root=mirror_root,
            db_url=db_url,
            paper_count=len(paper_files),
            new_papers=[],
            skipped_papers=[],
            failed_papers=[],
            dry_run=True,
        )
        manifest["discovered_papers"] = [p.name for p in paper_files]
        _write_manifest(mirror_root, manifest)
        return manifest

    session_factory = _build_session_factory(db_url)
    new_papers, skipped_papers, failed_papers = _process_all(paper_files, session_factory, mirror_root)

    manifest = _assemble_manifest(
        mirror_root=mirror_root,
        db_url=db_url,
        paper_count=len(paper_files),
        new_papers=new_papers,
        skipped_papers=skipped_papers,
        failed_papers=failed_papers,
        dry_run=False,
    )
    _write_manifest(mirror_root, manifest)
    return manifest


def _build_session_factory(db_url: str) -> sessionmaker:
    engine = create_engine(db_url, future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def _process_all(
    paper_files: list[Path],
    session_factory: sessionmaker,
    base_dir: Path,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    new_papers: list[dict[str, Any]] = []
    skipped_papers: list[dict[str, Any]] = []
    failed_papers: list[dict[str, Any]] = []
    for paper_file in paper_files:
        try:
            entry = _process_one(paper_file=paper_file, session_factory=session_factory, base_dir=base_dir)
        except Exception as exc:
            # 按 CLAUDE.md §4 Fail-Fast：不 silent swallow —— 记 manifest + log，再 continue 处理
            # 下一套（每套独立事务，failure isolation 是设计目标，不是 silent fallback）。
            failed_papers.append({"paper": paper_file.name, "error": str(exc)})
            logger.exception("[FAILED ] %s: %s", paper_file.name[:60], exc)
            continue
        if entry["status"] == "new":
            new_papers.append(entry)
            logger.info(
                "[NEW    ] %s: %d questions <- %s",
                entry["paperCode"],
                entry["questionCount"],
                paper_file.name,
            )
        else:
            skipped_papers.append(entry)
            logger.info("[SKIPPED] %s: source_hash already in DB", entry["paperCode"])
    return new_papers, skipped_papers, failed_papers


def _assemble_manifest(
    *,
    mirror_root: Path,
    db_url: str,
    paper_count: int,
    new_papers: list[dict[str, Any]],
    skipped_papers: list[dict[str, Any]],
    failed_papers: list[dict[str, Any]],
    dry_run: bool,
) -> dict[str, Any]:
    return {
        "imported_at": datetime.now(UTC).isoformat(),
        "source_provider": "fenbi_shenlun",
        "mirror_root": str(mirror_root),
        "db_url": _sanitize_db_url(db_url),
        "dry_run": dry_run,
        "total_count": paper_count,
        "new_count": len(new_papers),
        "skipped_count": len(skipped_papers),
        "failed_count": len(failed_papers),
        "new_papers": new_papers,
        "skipped_papers": skipped_papers,
        "failed": failed_papers,
    }


def _write_manifest(mirror_root: Path, manifest: dict[str, Any]) -> None:
    # manifest 写到 mirror_root 的父目录，避免污染 standard_json/（同 CLAUDE.md §12 mirror 不混 staging）。
    target = mirror_root.parent / "import-manifest-shenlun.json"
    _write_atomic(target, json.dumps(manifest, ensure_ascii=False, indent=2))
    logger.info("Manifest written to %s", target)


def _write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def _process_one(
    *,
    paper_file: Path,
    session_factory: sessionmaker,
    base_dir: Path,
) -> dict[str, Any]:
    """Read one shenlun standard.json + import. Returns a manifest entry."""
    content = paper_file.read_bytes()
    source_hash = hashlib.sha256(content).hexdigest()

    existing = _find_existing_revision(session_factory, source_hash)
    if existing is not None:
        return {
            "paperCode": existing["paperCode"],
            "questionCount": existing["questionCount"],
            "status": "skipped",
            "mirrorFile": paper_file.name,
        }

    return _import_new_revision(
        session_factory=session_factory,
        paper_file=paper_file,
        content=content,
        base_dir=base_dir,
    )


def _find_existing_revision(session_factory: sessionmaker, source_hash: str) -> dict[str, Any] | None:
    """先单独短事务查 source_hash —— 让 service 内部的写事务不被 preview 的读阻塞。"""
    with session_factory() as preview_session:
        existing = preview_session.scalar(
            select(PaperRevision).where(PaperRevision.source_hash == source_hash)
        )
        if existing is None:
            return None
        return {
            "paperCode": existing.paper.paper_code,
            "questionCount": existing.question_count,
        }


def _import_new_revision(
    *,
    session_factory: sessionmaker,
    paper_file: Path,
    content: bytes,
    base_dir: Path,
    auto_publish: bool = True,
) -> dict[str, Any]:
    session = session_factory()
    try:
        service = ExamPaperService(session)
        summary = service.import_standard_json_files(
            files=[(paper_file.name, content)],
            base_dir=base_dir,
            created_by="batch-import-shenlun",
        )
        item = next(iter(summary.items), None)
        # ImportJob 构造时 status 默认 "failed"，只有 try 内全跑完才会改 "completed" —— 所以
        # 用 status 区分 service 内部 fail（如 ValidationError），不能只看 summary 顶层 status。
        if item is None or item.status == "failed":
            raise RuntimeError(
                f"import service failed: {item.error_message if item else 'no item'}"
            )
        if auto_publish and item.paper_code is not None and item.revision_id is not None:
            service.publish_revision(
                item.paper_code,
                item.revision_id,
                released_by="batch-import-shenlun",
            )
        session.commit()
    finally:
        session.close()

    return {
        "paperCode": item.paper_code,
        "questionCount": item.imported_question_count,
        "status": "new",
        "mirrorFile": paper_file.name,
    }


def _sanitize_db_url(url: str) -> str:
    """Strip password from DB URL for logging."""
    if "@" not in url:
        return url
    schema, rest = url.split("://", 1)
    if "@" not in rest:
        return url
    creds, host_part = rest.rsplit("@", 1)
    user = creds.split(":", 1)[0]
    return f"{schema}://{user}:***@{host_part}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--mirror",
        default=DEFAULT_MIRROR,
        type=Path,
        help=f"Local mirror dir containing FBSL-*.standard.json (default: {DEFAULT_MIRROR})",
    )
    parser.add_argument(
        "--db-url",
        default=None,
        help="DB URL (defaults to $DATABASE_URL / settings.database_url)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N papers (debug)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Log level (default: INFO)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover papers and write manifest without DB connection / import",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )

    db_url = args.db_url or get_settings().database_url
    logger.info(
        "Batch import shenlun papers: mirror=%s -> db=%s%s",
        args.mirror,
        _sanitize_db_url(db_url),
        " (dry-run)" if args.dry_run else "",
    )

    manifest = run_batch(
        mirror_root=args.mirror,
        db_url=db_url,
        limit=args.limit,
        dry_run=args.dry_run,
    )
    logger.info(
        "Done: %d papers -- %d new, %d skipped, %d failed",
        manifest["total_count"],
        manifest["new_count"],
        manifest["skipped_count"],
        manifest["failed_count"],
    )
    return 0 if manifest["failed_count"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
