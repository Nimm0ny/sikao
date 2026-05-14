"""Backfill question_assets / material_group_assets mime_type using magic-byte sniff.

历史 import 路径在 fenbi `.bin`（无扩展名公式 URL fallback）资源上拿到
`application/octet-stream`，DB 里实际 bytes 是 PNG/JPEG 等。本脚本扫所有这种
脏 mime_type，按 magic header 还原成准确 MIME。

`<img>` context 下浏览器 image-sniff 仍能渲染，所以 read 路径不阻塞，但
admin/curl/CDN/直接 URL 链路依赖 Content-Type 正确，所以一次性 backfill 干净。

CLI:
    python -m sikao_api.scripts.backfill_asset_mime --db-url sqlite:///./var/exam_papers.db
    python -m sikao_api.scripts.backfill_asset_mime --db-url ... --dry-run
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.db.models import MaterialGroupAsset, QuestionAsset
from sikao_api.modules.question_bank.application.exam_papers import _detect_image_mime_from_bytes

DIRTY_MIME_VALUES = ("application/octet-stream", "")


class AssetRow(Protocol):
    file_path: str
    mime_type: str


def _scan_question_assets(session: Session, *, dry_run: bool) -> dict[str, int]:
    stmt = select(QuestionAsset).where(QuestionAsset.mime_type.in_(DIRTY_MIME_VALUES))
    return _scan_rows(session.scalars(stmt).all(), dry_run=dry_run)


def _scan_material_group_assets(session: Session, *, dry_run: bool) -> dict[str, int]:
    stmt = select(MaterialGroupAsset).where(MaterialGroupAsset.mime_type.in_(DIRTY_MIME_VALUES))
    return _scan_rows(session.scalars(stmt).all(), dry_run=dry_run)


def _scan_and_update(
    session: Session,
    model: type[QuestionAsset] | type[MaterialGroupAsset],
    *,
    dry_run: bool,
) -> dict[str, int]:
    if model is QuestionAsset:
        return _scan_question_assets(session, dry_run=dry_run)
    if model is MaterialGroupAsset:
        return _scan_material_group_assets(session, dry_run=dry_run)
    raise TypeError(f"unsupported asset model: {model.__name__}")


def _scan_rows(rows: Sequence[AssetRow], *, dry_run: bool) -> dict[str, int]:
    counter: Counter[str] = Counter()
    counter["scanned"] = len(rows)
    for asset in rows:
        path = Path(asset.file_path)
        if not path.is_file():
            counter["missing_file"] += 1
            continue
        detected = _detect_image_mime_from_bytes(path)
        if detected is None:
            counter["unknown_bytes"] += 1
            continue
        if detected == asset.mime_type:
            counter["already_correct"] += 1
            continue
        counter[f"updated_to:{detected}"] += 1
        if not dry_run:
            asset.mime_type = detected
    return dict(counter)


def run(*, db_url: str, dry_run: bool) -> dict[str, dict[str, int]]:
    engine = create_engine(db_url, future=True)
    Session_ = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)
    report: dict[str, dict[str, int]] = {}
    with Session_() as session:
        report["question_assets"] = _scan_and_update(session, QuestionAsset, dry_run=dry_run)
        report["material_group_assets"] = _scan_and_update(session, MaterialGroupAsset, dry_run=dry_run)
        if not dry_run:
            session.commit()
    return report


def _print_report(report: dict[str, dict[str, int]], *, dry_run: bool) -> None:
    prefix = "[DRY-RUN] " if dry_run else ""
    for table, counts in report.items():
        print(f"{prefix}{table}:")
        for k in sorted(counts):
            print(f"  {k}: {counts[k]}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backfill asset mime_type via magic-byte sniff.")
    parser.add_argument("--db-url", required=True, help="SQLAlchemy DB URL (e.g. sqlite:///./var/exam_papers.db)")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without writing.")
    args = parser.parse_args(argv)

    report = run(db_url=args.db_url, dry_run=args.dry_run)
    _print_report(report, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
