from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from typing import Iterable
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.orm import Session

from sikao_api.core.config import get_settings
from sikao_api.db.session import DatabaseManager


@dataclass
class BackfillStats:
    scanned: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    conflicts: int = 0

    def emit(self, *, scope: str, dry_run: bool) -> None:
        payload = {
            "scope": scope,
            "mode": "dry-run" if dry_run else "apply",
            **asdict(self),
        }
        print(json.dumps(payload, ensure_ascii=False))


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)


def open_session(*, database_url: str | None) -> tuple[Session, DatabaseManager]:
    settings = get_settings()
    if database_url is not None:
        settings = settings.model_copy(update={"database_url": database_url})
    db = DatabaseManager(settings)
    return db.session_factory(), db


def legacy_public_id(legacy_user_id: int) -> str:
    return str(uuid5(NAMESPACE_URL, f"sikao-legacy-user-{legacy_user_id}"))


def trim_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def commit_or_rollback(session: Session, *, dry_run: bool) -> None:
    if dry_run:
        session.rollback()
        return
    session.commit()


def iter_with_limit(items: Iterable, *, limit: int | None):
    if limit is None:
        yield from items
        return
    for index, item in enumerate(items):
        if index >= limit:
            break
        yield item
