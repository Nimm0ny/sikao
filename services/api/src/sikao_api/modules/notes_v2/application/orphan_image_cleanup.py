from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteImageV2


@dataclass(frozen=True, slots=True)
class OrphanNoteImageCleanupEntry:
    image_id: int
    user_id: int
    note_id: int | None
    file_path: str
    file_existed: bool
    created_at: datetime


@dataclass(frozen=True, slots=True)
class OrphanNoteImageCleanupResult:
    deleted: list[OrphanNoteImageCleanupEntry]


def cleanup_orphan_note_images(
    session: Session,
    *,
    upload_dir: Path,
    now: datetime | None = None,
) -> OrphanNoteImageCleanupResult:
    cutoff = (now or datetime.now(UTC).replace(tzinfo=None)) - timedelta(hours=24)
    rows = list(
        session.scalars(
            select(NoteImageV2)
            .where(
                NoteImageV2.note_id.is_(None),
                NoteImageV2.created_at <= cutoff,
            )
            .order_by(NoteImageV2.id.asc())
        )
    )
    deleted: list[OrphanNoteImageCleanupEntry] = []
    for row in rows:
        absolute_path = _resolve_absolute_upload_path(
            upload_dir=upload_dir,
            file_path=row.file_path,
        )
        existed = absolute_path.exists()
        if existed:
            absolute_path.unlink()
        deleted.append(
            OrphanNoteImageCleanupEntry(
                image_id=row.id,
                user_id=row.user_id,
                note_id=row.note_id,
                file_path=row.file_path,
                file_existed=existed,
                created_at=row.created_at,
            )
        )
        session.delete(row)
    session.flush()
    return OrphanNoteImageCleanupResult(deleted=deleted)


def _resolve_absolute_upload_path(*, upload_dir: Path, file_path: str) -> Path:
    normalized = file_path.strip()
    if normalized.startswith("/uploads/"):
        normalized = normalized.removeprefix("/uploads/")
    else:
        normalized = normalized.lstrip("/")
    return upload_dir / Path(normalized)
