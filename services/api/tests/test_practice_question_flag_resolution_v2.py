from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import QuestionFlagV2, ReviewItemV2


def _flag_rows(client: TestClient) -> list[QuestionFlagV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(QuestionFlagV2).order_by(QuestionFlagV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def _review_rows(client: TestClient) -> list[ReviewItemV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def test_question_flag_upsert_and_resolve_use_pending_empty_state(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-FLAG-02",
            title="Flags Lifecycle",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Lifecycle question",
                    "year": 2024,
                    "region": "shanghai",
                    "exam_type": "national",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                }
            ],
        )[0]

        first = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert first.status_code == 200, first.text
        first_flag_id = first.json()["id"]

        updated = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "needs_review"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["id"] == first_flag_id
        assert updated.json()["reason"] == "needs_review"
        assert len(_flag_rows(client)) == 1
        assert len(_review_rows(client)) == 1

        resolved = client.patch(f"/api/v2/practice/questions/{question_id}/flag/resolve")
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["status"] == "resolved"

        review_after_resolve = client.get("/api/v2/review/items")
        assert review_after_resolve.status_code == 200, review_after_resolve.text
        assert review_after_resolve.json()["items"] == []

        placeholder_detail = client.get("/api/v2/review/items/999")
        assert placeholder_detail.status_code == 200, placeholder_detail.text
        assert placeholder_detail.json()["item"]["status"] == "empty"

        placeholder_redo = client.post("/api/v2/review/items/999/redo")
        assert placeholder_redo.status_code == 200, placeholder_redo.text
        assert placeholder_redo.json() == {"ok": False, "status": "unavailable"}
