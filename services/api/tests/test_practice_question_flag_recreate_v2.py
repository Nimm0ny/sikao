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


def test_question_flag_recreate_preserves_resolved_history(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-FLAG-03",
            title="Flags History",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "History question",
                    "year": 2024,
                    "region": "guangdong",
                    "exam_type": "provincial",
                    "category_l1": "numeric",
                    "category_l2": "calculation",
                }
            ],
        )[0]

        first = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert first.status_code == 200, first.text
        first_flag_id = first.json()["id"]

        client.patch(f"/api/v2/practice/questions/{question_id}/flag/resolve")
        recreated = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "revisit_later"},
        )
        assert recreated.status_code == 200, recreated.text
        assert recreated.json()["id"] != first_flag_id
        assert len(_flag_rows(client)) == 2

        review_rows = _review_rows(client)
        assert len(review_rows) == 2
        assert len([row for row in review_rows if row.status == "pending"]) == 1
        assert len([row for row in review_rows if row.status == "archived"]) == 1

        client.patch(f"/api/v2/practice/questions/{question_id}/flag/resolve")
        recreated_again = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "needs_review"},
        )
        assert recreated_again.status_code == 200, recreated_again.text
        review_rows = _review_rows(client)
        assert len([row for row in review_rows if row.status == "pending"]) == 1
        assert len([row for row in review_rows if row.status == "archived"]) == 2
