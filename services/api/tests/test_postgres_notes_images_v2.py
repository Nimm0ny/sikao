from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
from typing import Any, cast

from PIL import Image
import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import NoteImageV2


def _app_factory(client):  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    return app.state.db.session_factory


def _body_json(title: str, paragraph: str) -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": title}]},
            {"type": "paragraph", "content": [{"type": "text", "text": paragraph}]},
        ],
    }


def _png_bytes() -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (4, 3), color=(255, 0, 0))
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_note_image_upload_supports_orphan_and_bound_images(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="images@example.com", display_name="Image User")
        note = client.post(
            "/api/v2/notes",
            json={"title": "Image Note", "bodyJson": _body_json("Image", "body")},
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        orphan = client.post(
            "/api/v2/notes/images",
            files={"image": ("orphan.png", _png_bytes(), "image/png")},
        )
        assert orphan.status_code == 200, orphan.text
        assert orphan.json()["url"].startswith("/uploads/notes/")
        assert orphan.json()["mimeType"] == "image/png"
        assert orphan.json()["width"] == 4
        assert orphan.json()["height"] == 3

        bound = client.post(
            "/api/v2/notes/images",
            files={"image": ("bound.png", _png_bytes(), "image/png")},
            data={"note_id": str(note_id)},
        )
        assert bound.status_code == 200, bound.text

        factory = _app_factory(client)
        with factory() as session:
            rows = list(session.scalars(select(NoteImageV2).order_by(NoteImageV2.id.asc())))
            assert rows[0].note_id is None
            assert rows[1].note_id == note_id

        rebound = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "bodyJson": {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "正文引用刚才的 orphan 图片。"}],
                        },
                        {
                            "type": "image",
                            "attrs": {"src": orphan.json()["url"], "alt": "orphan"},
                        },
                    ],
                }
            },
        )
        assert rebound.status_code == 200, rebound.text

        with factory() as session:
            rows = list(session.scalars(select(NoteImageV2).order_by(NoteImageV2.id.asc())))
            assert rows[0].note_id == note_id
            assert rows[1].note_id == note_id


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_note_image_upload_rejects_invalid_type_and_size_and_limit(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="image-limit@example.com", display_name="Image Limit User")
        note = client.post(
            "/api/v2/notes",
            json={"title": "Image Limit", "bodyJson": _body_json("Image", "body")},
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        invalid = client.post(
            "/api/v2/notes/images",
            files={"image": ("bad.txt", b"not-an-image", "text/plain")},
        )
        assert invalid.status_code == 422, invalid.text
        assert invalid.json()["code"] == "image_invalid_type"

        too_large = client.post(
            "/api/v2/notes/images",
            files={"image": ("huge.bin", b"x" * (5 * 1024 * 1024 + 1), "application/octet-stream")},
        )
        assert too_large.status_code == 422, too_large.text
        assert too_large.json()["code"] == "image_too_large"

        for idx in range(20):
            response = client.post(
                "/api/v2/notes/images",
                files={"image": (f"{idx}.png", _png_bytes(), "image/png")},
                data={"note_id": str(note_id)},
            )
            assert response.status_code == 200, response.text

        overflow = client.post(
            "/api/v2/notes/images",
            files={"image": ("overflow.png", _png_bytes(), "image/png")},
            data={"note_id": str(note_id)},
        )
        assert overflow.status_code == 422, overflow.text
        assert overflow.json()["code"] == "image_limit_exceeded"
