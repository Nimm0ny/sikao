from __future__ import annotations

from html import escape
import json
from urllib.parse import quote

from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserV2
from sikao_api.modules.notes_v2.domain.tiptap_converter import json_to_html, json_to_markdown
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


class NoteExportServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = NotesRepoV2(session)

    def export_note(
        self,
        *,
        user: UserV2,
        note_id: int,
        export_format: str,
    ) -> tuple[str, str, str]:
        note = self.repo.get_owned_note(user_id=user.id, note_id=note_id)
        if note is None:
            raise NotFoundError("note not found", code="note_not_found")
        if export_format not in {"markdown", "html"}:
            raise ValidationError("unsupported export format", code="validation_error")

        tags = self.repo.list_note_tags(note_id=note.id)
        title_slug = note.title.replace("/", "-").replace("\\", "-")
        safe_ascii_slug = "".join(char if char.isascii() and char not in {'"', ";"} else "_" for char in title_slug)

        if export_format == "markdown":
            body = json_to_markdown(note.body_json) if note.body_json is not None else note.body
            frontmatter = "\n".join(
                [
                    "---",
                    f"title: {json.dumps(note.title, ensure_ascii=False)}",
                    f"tags: {json.dumps(tags, ensure_ascii=False)}",
                    f"created_at: {json.dumps(note.created_at.isoformat(), ensure_ascii=False)}",
                    "---",
                    "",
                ]
            )
            return f"{frontmatter}{body}\n", "text/markdown; charset=utf-8", self._content_disposition_filename(
                ascii_stem=safe_ascii_slug or "note",
                utf8_stem=title_slug or "note",
                extension="md",
            )

        body_html = json_to_html(note.body_json) if note.body_json is not None else f"<p>{escape(note.body)}</p>"
        document = "\n".join(
            [
                "<!DOCTYPE html>",
                "<html lang=\"zh-CN\">",
                "<head>",
                "  <meta charset=\"utf-8\">",
                f"  <title>{escape(note.title)}</title>",
                "</head>",
                "<body>",
                body_html,
                "</body>",
                "</html>",
            ]
        )
        return document, "text/html; charset=utf-8", self._content_disposition_filename(
            ascii_stem=safe_ascii_slug or "note",
            utf8_stem=title_slug or "note",
            extension="html",
        )

    @staticmethod
    def _content_disposition_filename(*, ascii_stem: str, utf8_stem: str, extension: str) -> str:
        return (
            f'attachment; filename="{ascii_stem}.{extension}"; '
            f"filename*=UTF-8''{quote(f'{utf8_stem}.{extension}')}"
        )
