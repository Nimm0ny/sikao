from __future__ import annotations

from sikao_api.modules.notes_v2.domain.errors import CONTENT_TOO_SHORT
from sikao_api.modules.system.application.errors import ValidationError


PUBLIC_NOTE_MIN_BODY_LENGTH = 50


def assert_public_note_publishable(*, body_text: str) -> None:
    if len(body_text.strip()) < PUBLIC_NOTE_MIN_BODY_LENGTH:
        raise ValidationError(
            "public notes require at least 50 characters of body text",
            code=CONTENT_TOO_SHORT,
        )
