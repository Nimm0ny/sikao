from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import ReviewItemV2


def _review_rows(client: TestClient) -> list[ReviewItemV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def test_question_flag_create_and_review_sync(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-FLAG-01",
            title="Flags Sample",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Flag me",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert created.status_code == 200, created.text
        payload = created.json()
        assert payload["questionId"] == question_id
        assert payload["reason"] == "uncertain"
        assert payload["status"] == "active"

        flags = client.get("/api/v2/practice/flags?reason=uncertain")
        assert flags.status_code == 200, flags.text
        assert len(flags.json()["items"]) == 1

        review = client.get("/api/v2/review/items")
        assert review.status_code == 200, review.text
        assert len(review.json()["items"]) == 1
        assert review.json()["items"][0]["status"] == "pending"

        review_rows = _review_rows(client)
        assert len(review_rows) == 1
        assert review_rows[0].reason == "flagged_persistent"
        assert review_rows[0].question_id == question_id
        assert review_rows[0].status == "pending"
