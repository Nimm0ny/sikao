"""Batch import fenbi papers from backend_data mirror into the database.

按 SIKAO_MIGRATION_AGENT_BRIEF.md §8 + new_web AGENTS.md §12 「数据导入设计规范」实现：
- 扫 backend_data/xingce/papers/ 下所有 paper（行测 764 套）
- 对每个调 fenbi_to_standard.convert_paper → backend_data/import-staging/<paperCode>/
- 每个 paper 独立调 ExamPaperService.import_standard_json_files（每套独立事务）
- 三层 dedupe（mirror size / adapter deterministic / DB source_hash）
- 写 manifest.json 报告：new / hash-skipped / failed

CLI:
    # 用默认路径（backend_data_root 来自 sikao_api settings）
    python -m scripts.import.import_fenbi_batch

    # 显式指定
    python -m scripts.import.import_fenbi_batch --mirror D:/py_pj/backend_data/xingce \\
        --staging D:/py_pj/backend_data/import-staging --db-url sqlite:///./var/exam_papers.db
"""

from __future__ import annotations

import argparse
import hashlib
import json
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

# fenbi_to_standard 在 sikao 里挪到了 scripts/import/，作脚本同目录 import
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fenbi_to_standard import convert_paper  # noqa: E402

# 默认从 settings 读 backend_data_root；CLI --mirror / --staging 可覆盖。
_settings = get_settings()
_BACKEND_DATA = Path(_settings.backend_data_root)
DEFAULT_MIRROR = _BACKEND_DATA / "xingce"
DEFAULT_STAGING = _BACKEND_DATA / "import-staging"


def run_batch(
    *,
    mirror_root: Path,
    staging_root: Path,
    db_url: str,
    limit: int | None = None,
) -> dict[str, Any]:
    """单进程批量入库；多进程同时跑会在 source_hash dedupe 检查与 commit 之间 race，
    本脚本不保证并发安全 — PoC 阶段单机单跑足够。"""
    mirror_root = mirror_root.resolve()
    staging_root = staging_root.resolve()
    papers_root = mirror_root / "papers"
    if not papers_root.is_dir():
        raise FileNotFoundError(f"mirror papers dir missing: {papers_root}. Run sync_fenbi_mirror first.")

    paper_dirs = sorted(p for p in papers_root.iterdir() if p.is_dir())
    if limit is not None:
        paper_dirs = paper_dirs[:limit]
    print(f"Found {len(paper_dirs)} paper(s) under {papers_root}")
    staging_root.mkdir(parents=True, exist_ok=True)

    session_factory = _build_session_factory(db_url)
    new_papers, skipped_papers, failed_papers = _process_all(paper_dirs, staging_root, session_factory)

    manifest = _assemble_manifest(
        mirror_root=mirror_root,
        staging_root=staging_root,
        db_url=db_url,
        paper_count=len(paper_dirs),
        new_papers=new_papers,
        skipped_papers=skipped_papers,
        failed_papers=failed_papers,
    )
    _write_atomic(staging_root / "import-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    return manifest


def _build_session_factory(db_url: str) -> sessionmaker:
    engine = create_engine(db_url, future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def _process_all(
    paper_dirs: list[Path],
    staging_root: Path,
    session_factory: sessionmaker,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    new_papers: list[dict[str, Any]] = []
    skipped_papers: list[dict[str, Any]] = []
    failed_papers: list[dict[str, Any]] = []
    for paper_dir in paper_dirs:
        try:
            entry = _process_one(paper_dir=paper_dir, staging_root=staging_root, session_factory=session_factory)
        except Exception as exc:
            failed_papers.append({"paper": paper_dir.name, "error": str(exc)})
            print(f"  [FAILED ] {paper_dir.name[:60]}: {exc}")
            continue
        if entry["status"] == "new":
            new_papers.append(entry)
            print(f"  [NEW    ] {entry['paperCode']}: {entry['questionCount']} questions ← {paper_dir.name[:50]}")
        else:
            skipped_papers.append(entry)
            print(f"  [SKIPPED] {entry['paperCode']}: source_hash already in DB")
    return new_papers, skipped_papers, failed_papers


def _assemble_manifest(
    *,
    mirror_root: Path,
    staging_root: Path,
    db_url: str,
    paper_count: int,
    new_papers: list[dict[str, Any]],
    skipped_papers: list[dict[str, Any]],
    failed_papers: list[dict[str, Any]],
) -> dict[str, Any]:
    asset_issue_count = sum(
        len(entry.get("assetIssues", []))
        for entry in [*new_papers, *skipped_papers]
    )
    return {
        "imported_at": datetime.now(UTC).isoformat(),
        "mirror_root": str(mirror_root),
        "staging_root": str(staging_root),
        "db_url": _sanitize_db_url(db_url),
        "total_count": paper_count,
        "new_count": len(new_papers),
        "skipped_count": len(skipped_papers),
        "failed_count": len(failed_papers),
        "asset_issue_count": asset_issue_count,
        "new_papers": new_papers,
        "skipped_papers": skipped_papers,
        "failed": failed_papers,
    }


def _write_atomic(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def _process_one(
    *,
    paper_dir: Path,
    staging_root: Path,
    session_factory: sessionmaker,
) -> dict[str, Any]:
    """Convert one paper through adapter + import. Returns a manifest entry."""
    fenbi_id = paper_dir.name.split("_", 1)[0]
    paper_staging = staging_root / f"FENBI-{fenbi_id}"
    out_json = convert_paper(paper_dir, paper_staging, copy_assets=True, skip_bad_questions=True)
    content = out_json.read_bytes()
    source_hash = hashlib.sha256(content).hexdigest()
    asset_issues = _collect_asset_issues(out_json, paper_staging)

    existing = _find_existing_revision(session_factory, source_hash)
    if existing is not None:
        return {
            "paperCode": existing["paperCode"],
            "questionCount": existing["questionCount"],
            "status": "skipped",
            "mirrorDir": paper_dir.name,
            "assetIssues": asset_issues,
        }

    return _import_new_revision(
        session_factory=session_factory,
        out_json=out_json,
        content=content,
        paper_staging=paper_staging,
        fenbi_id=fenbi_id,
        mirror_dir_name=paper_dir.name,
        asset_issues=asset_issues,
    )


def _collect_asset_issues(out_json: Path, paper_staging: Path) -> list[dict[str, str]]:
    standard = json.loads(out_json.read_text(encoding="utf-8"))
    issues: list[dict[str, str]] = []
    issues.extend(_iter_data_missing_asset_issues(standard))
    seen_missing_paths: set[str] = set()
    for asset_path in _iter_asset_paths(standard):
        if asset_path in seen_missing_paths:
            continue
        if not (paper_staging / asset_path).is_file():
            seen_missing_paths.add(asset_path)
            issues.append({"kind": "missing_file", "path": asset_path})
    return issues


def _iter_data_missing_asset_issues(node: Any) -> list[dict[str, str]]:
    if isinstance(node, dict):
        issues: list[dict[str, str]] = []
        source_uuid = node.get("sourceUuid")
        special_payload = node.get("specialPayload")
        if isinstance(source_uuid, str) and isinstance(special_payload, dict):
            if special_payload.get("dataMissing") is True:
                for path in special_payload.get("missingAssetPaths") or []:
                    if isinstance(path, str) and path.strip():
                        issues.append(
                            {
                                "kind": "question_data_missing",
                                "sourceUuid": source_uuid,
                                "path": path,
                            }
                        )
        for value in node.values():
            issues.extend(_iter_data_missing_asset_issues(value))
        return issues
    if isinstance(node, list):
        issues = []
        for item in node:
            issues.extend(_iter_data_missing_asset_issues(item))
        return issues
    return []


def _iter_asset_paths(node: Any) -> list[str]:
    if isinstance(node, dict):
        paths: list[str] = []
        raw_assets = node.get("assets")
        if isinstance(raw_assets, list):
            for asset in raw_assets:
                if isinstance(asset, dict):
                    raw_path = asset.get("path")
                    if isinstance(raw_path, str) and raw_path.strip():
                        paths.append(raw_path)
        for value in node.values():
            paths.extend(_iter_asset_paths(value))
        return paths
    if isinstance(node, list):
        paths = []
        for item in node:
            paths.extend(_iter_asset_paths(item))
        return paths
    return []


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
    out_json: Path,
    content: bytes,
    paper_staging: Path,
    fenbi_id: str,
    mirror_dir_name: str,
    asset_issues: list[dict[str, str]],
    auto_publish: bool = True,
) -> dict[str, Any]:
    session = session_factory()
    try:
        service = ExamPaperService(session)
        summary = service.import_standard_json_files(
            files=[(out_json.name, content)],
            base_dir=paper_staging,
            created_by="batch-import",
        )
        item = next(iter(summary.items), None)
        # ImportJob 构造时 status 默认 "failed"，只有 try 内全跑完才会改 "completed" —— 所以
        # 用 status 区分 service 内部 fail（如 ValidationError），不能只看 summary 顶层 status。
        if item is None or item.status == "failed":
            raise RuntimeError(f"import service failed: {item.error_message if item else 'no item'}")
        if auto_publish and item.paper_code is not None and item.revision_id is not None:
            service.publish_revision(
                item.paper_code,
                item.revision_id,
                released_by="batch-import",
            )
        session.commit()
    finally:
        session.close()

    return {
        "paperCode": item.paper_code,
        "questionCount": item.imported_question_count,
        "status": "new",
        "mirrorDir": mirror_dir_name,
        "assetIssues": asset_issues,
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mirror", default=DEFAULT_MIRROR, type=Path, help="Local mirror root (containing papers/)")
    parser.add_argument("--staging", default=DEFAULT_STAGING, type=Path, help="Staging output dir")
    parser.add_argument("--db-url", default=None, help="DB URL (defaults to settings.database_url)")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N papers (debug)")
    args = parser.parse_args(argv)

    db_url = args.db_url or get_settings().database_url
    print(f"Batch import fenbi papers: mirror={args.mirror} → staging={args.staging} → db={_sanitize_db_url(db_url)}")
    print()

    manifest = run_batch(
        mirror_root=args.mirror,
        staging_root=args.staging,
        db_url=db_url,
        limit=args.limit,
    )
    print()
    print(
        f"Done: {manifest['total_count']} papers — "
        f"{manifest['new_count']} new, {manifest['skipped_count']} skipped, {manifest['failed_count']} failed"
    )
    print(f"Manifest written to {args.staging}/import-manifest.json")
    return 0 if manifest["failed_count"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
