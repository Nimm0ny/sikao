from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import QuestionFavoriteV2


def _favorite_rows(client: TestClient) -> list[QuestionFavoriteV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(QuestionFavoriteV2).order_by(QuestionFavoriteV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def test_question_favorite_upsert_is_user_scoped(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client, email="alice@example.com", display_name="Alice")
        question_id = seed_paper(
            client,
            paper_code="XC-FAV-02",
            title="Favorites Scope",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Scoped question",
                    "year": 2024,
                    "region": "shanghai",
                    "exam_type": "national",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/favorite",
            json={"note": "first note"},
        )
        assert created.status_code == 200, created.text

        updated = client.post(
            f"/api/v2/practice/questions/{question_id}/favorite",
            json={"note": "updated note"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["note"] == "updated note"
        assert len(_favorite_rows(client)) == 1

        register_user(client, email="bob@example.com", display_name="Bob")
        foreign_delete = client.delete(f"/api/v2/practice/questions/{question_id}/favorite")
        assert foreign_delete.status_code == 404, foreign_delete.text
        assert foreign_delete.json()["code"] == "favorite_not_found"

        own_listing = client.get("/api/v2/practice/favorites")
        assert own_listing.status_code == 200, own_listing.text
        assert own_listing.json()["items"] == []
