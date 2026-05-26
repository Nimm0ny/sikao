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
    safe_path: bool
    file_existed: bool
    file_deleted: bool
    delete_error: str | None
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
    row_ids = list(
        session.scalars(
            select(NoteImageV2.id)
            .where(
                NoteImageV2.note_id.is_(None),
                NoteImageV2.created_at <= cutoff,
            )
            .order_by(NoteImageV2.id.asc())
        )
    )
    deleted: list[OrphanNoteImageCleanupEntry] = []
    upload_root = upload_dir.resolve()
    for image_id in row_ids:
        row = _load_locked_orphan_row_for_cleanup(session, image_id=image_id)
        if row is None:
            continue
        absolute_path = _resolve_absolute_upload_path(
            upload_dir=upload_root,
            file_path=row.file_path,
        )
        safe_path = absolute_path is not None
        existed = absolute_path is not None and absolute_path.exists()
        deleted_file = False
        delete_error: str | None = None
        if existed and absolute_path is not None:
            try:
                absolute_path.unlink()
                deleted_file = True
            except OSError as exc:
                delete_error = str(exc)
        deleted.append(
            OrphanNoteImageCleanupEntry(
                image_id=row.id,
                user_id=row.user_id,
                note_id=row.note_id,
                file_path=row.file_path,
                safe_path=safe_path,
                file_existed=bool(existed),
                file_deleted=deleted_file,
                delete_error=delete_error,
                created_at=row.created_at,
            )
        )
        session.delete(row)
    session.flush()
    return OrphanNoteImageCleanupResult(deleted=deleted)


def _load_locked_orphan_row_for_cleanup(
    session: Session,
    *,
    image_id: int,
) -> NoteImageV2 | None:
    return session.scalar(
        select(NoteImageV2)
        .where(
            NoteImageV2.id == image_id,
            NoteImageV2.note_id.is_(None),
        )
        .with_for_update(skip_locked=True)
    )


def _resolve_absolute_upload_path(
    *,
    upload_dir: Path,
    file_path: str,
) -> Path | None:
    normalized = file_path.strip()
    if normalized.startswith("/uploads/"):
        normalized = normalized.removeprefix("/uploads/")
    else:
        normalized = normalized.lstrip("/")
    candidate = (upload_dir / Path(normalized)).resolve()
    if not _is_under_root(candidate, root=upload_dir):
        return None
    return candidate


def _is_under_root(path: Path, *, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True
