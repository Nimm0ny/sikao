from __future__ import annotations
import os
from pathlib import Path
from typing import Any, cast
import pytest
from fastapi.testclient import TestClient
from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
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


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_practice_favorites_and_flags_flow(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-PG-FAVFLAG-01",
            title="PG Favorites Flags",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "PG question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        favorite = client.post(
            f"/api/v2/practice/questions/{question_id}/favorite",
            json={"note": "postgres note"},
        )
        assert favorite.status_code == 200, favorite.text
        assert favorite.json()["note"] == "postgres note"

        flag = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert flag.status_code == 200, flag.text
        first_flag_id = flag.json()["id"]

        resolved = client.patch(f"/api/v2/practice/questions/{question_id}/flag/resolve")
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["status"] == "resolved"

        recreated = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "needs_review"},
        )
        assert recreated.status_code == 200, recreated.text
        assert recreated.json()["id"] != first_flag_id

        flags = _flag_rows(client)
        assert len(flags) == 2
        assert len([row for row in flags if row.resolved_at is None]) == 1

        reviews = _review_rows(client)
        assert len([row for row in reviews if row.reason == "flagged_persistent" and row.status == "resolved"]) == 1
        assert len([row for row in reviews if row.reason == "flagged_persistent" and row.status == "pending"]) == 1

        resolved_again = client.patch(f"/api/v2/practice/questions/{question_id}/flag/resolve")
        assert resolved_again.status_code == 200, resolved_again.text
        recreated_again = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "revisit_later"},
        )
        assert recreated_again.status_code == 200, recreated_again.text
        reviews = _review_rows(client)
        assert len([row for row in reviews if row.reason == "flagged_persistent" and row.status == "pending"]) == 1
        assert len([row for row in reviews if row.reason == "flagged_persistent" and row.status == "resolved"]) == 2

        review_queue = client.get("/api/v2/review/items")
        assert review_queue.status_code == 200, review_queue.text
        assert len(review_queue.json()["items"]) == 1
