from __future__ import annotations

from html import escape
from typing import Any


def json_to_markdown(body_json: dict[str, Any] | None) -> str:
    from sikao_api.modules.notes_v2.domain.body_extractor import extract_text

    return extract_text(body_json)


def json_to_html(body_json: dict[str, Any] | None) -> str:
    from sikao_api.modules.notes_v2.domain.body_extractor import extract_text

    return f"<p>{escape(extract_text(body_json))}</p>"
