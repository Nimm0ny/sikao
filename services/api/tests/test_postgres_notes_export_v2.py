from __future__ import annotations

import os
from pathlib import Path

import pytest
from sqlalchemy import text

from _helpers.practice_content_support import build_postgres_client, register_user


def _body_json() -> dict:
    return {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "\u6807\u9898"}],
            },
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "\u6b63\u6587"},
                    {"type": "hardBreak"},
                    {"type": "text", "text": "\u7b2c\u4e8c\u884c"},
                ],
            },
            {
                "type": "image",
                "attrs": {
                    "src": "/uploads/notes/demo.png",
                    "alt": "\u793a\u610f\u56fe",
                },
            },
        ],
    }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_note_export_markdown_and_html_and_legacy_fallback(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="export@example.com", display_name="Export User")
        note = client.post(
            "/api/v2/notes",
            json={
                "title": "\u5bfc\u51fa\u7b14\u8bb0",
                "bodyJson": _body_json(),
                "tags": ["math", "formula"],
            },
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        markdown = client.get(f"/api/v2/notes/{note_id}/export", params={"format": "markdown"})
        assert markdown.status_code == 200, markdown.text
        assert markdown.headers["content-type"].startswith("text/markdown")
        assert 'title: "\u5bfc\u51fa\u7b14\u8bb0"' in markdown.text
        assert 'tags: ["math", "formula"]' in markdown.text
        assert f'created_at: "{note.json()["createdAt"]}"' in markdown.text
        assert "## \u6807\u9898" in markdown.text
        expected_markdown = "\n".join(
            [
                "---",
                'title: "\u5bfc\u51fa\u7b14\u8bb0"',
                'tags: ["math", "formula"]',
                f'created_at: "{note.json()["createdAt"]}"',
                "---",
                "## \u6807\u9898",
                "",
                "\u6b63\u6587  ",
                "\u7b2c\u4e8c\u884c",
                "",
                "![\u793a\u610f\u56fe](/uploads/notes/demo.png)",
                "",
            ]
        )
        assert markdown.text == expected_markdown

        html = client.get(f"/api/v2/notes/{note_id}/export", params={"format": "html"})
        assert html.status_code == 200, html.text
        assert html.headers["content-type"].startswith("text/html")
        assert "<!DOCTYPE html>" in html.text
        assert "<h2>\u6807\u9898</h2>" in html.text
        assert 'src="/uploads/notes/demo.png"' in html.text
