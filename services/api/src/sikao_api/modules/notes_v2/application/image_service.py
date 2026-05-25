from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.schemas_v2 import NoteImageUploadResponseV2
from sikao_api.modules.notes_v2.domain.errors import IMAGE_INVALID_TYPE, IMAGE_LIMIT_EXCEEDED, IMAGE_TOO_LARGE
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_MAX_NOTE_IMAGES = 20
_FORMAT_TO_MIME = {
    "PNG": ("image/png", "png"),
    "JPEG": ("image/jpeg", "jpg"),
    "GIF": ("image/gif", "gif"),
    "WEBP": ("image/webp", "webp"),
}


class NoteImageServiceV2:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.repo = NotesRepoV2(session)

    def upload_image(
        self,
        *,
        user: UserV2,
        raw_bytes: bytes,
        original_filename: str,
        note_id: int | None,
    ) -> NoteImageUploadResponseV2:
        if len(raw_bytes) > _MAX_IMAGE_BYTES:
            raise ValidationError("image exceeds size limit", code=IMAGE_TOO_LARGE)

        if note_id is not None:
            note = self.repo.get_owned_note(user_id=user.id, note_id=note_id)
            if note is None:
                raise NotFoundError("note not found", code="note_not_found")
            if self.repo.count_note_images(note_id=note_id) >= _MAX_NOTE_IMAGES:
                raise ValidationError("note image limit exceeded", code=IMAGE_LIMIT_EXCEEDED)

        mime_type, extension, width, height = self._inspect_image(raw_bytes)
        target_name = f"{uuid4().hex}.{extension}"
        relative_path = Path("notes") / str(user.id) / target_name
        absolute_path = self.settings.upload_dir / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        absolute_path.write_bytes(raw_bytes)

        row = self.repo.create_note_image(
            note_id=note_id,
            user_id=user.id,
            file_path=f"/uploads/{relative_path.as_posix()}",
            file_name=original_filename,
            file_size=len(raw_bytes),
            mime_type=mime_type,
            width=width,
            height=height,
        )
        return NoteImageUploadResponseV2(
            id=row.id,
            url=row.file_path,
            file_name=row.file_name,
            file_size=row.file_size,
            mime_type=row.mime_type,
            width=row.width,
            height=row.height,
        )

    @staticmethod
    def _inspect_image(raw_bytes: bytes) -> tuple[str, str, int | None, int | None]:
        try:
            with Image.open(BytesIO(raw_bytes)) as image:
                image.load()
                image_format = image.format
                width, height = image.size
        except (UnidentifiedImageError, OSError) as exc:
            raise ValidationError("invalid image type", code=IMAGE_INVALID_TYPE) from exc

        if image_format not in _FORMAT_TO_MIME:
            raise ValidationError("invalid image type", code=IMAGE_INVALID_TYPE)
        mime_type, extension = _FORMAT_TO_MIME[image_format]
        return mime_type, extension, width, height
