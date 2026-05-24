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


def test_question_flag_delete_hides_queue_and_keeps_history(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-FLAG-04",
            title="Flags Delete History",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Delete history question",
                    "year": 2024,
                    "region": "guangdong",
                    "exam_type": "provincial",
                    "category_l1": "numeric",
                    "category_l2": "calculation",
                }
            ],
        )[0]

        client.post(f"/api/v2/practice/questions/{question_id}/flag", json={"reason": "uncertain"})
        client.patch(f"/api/v2/practice/questions/{question_id}/flag/resolve")
        client.post(f"/api/v2/practice/questions/{question_id}/flag", json={"reason": "needs_review"})

        removed = client.delete(f"/api/v2/practice/questions/{question_id}/flag")
        assert removed.status_code == 200, removed.text
        assert removed.json() == {"ok": True, "status": "deleted"}

        flags_after_delete = client.get("/api/v2/practice/flags")
        assert flags_after_delete.status_code == 200, flags_after_delete.text
        assert [item["status"] for item in flags_after_delete.json()["items"]] == ["resolved"]

        review_after_delete = client.get("/api/v2/review/items")
        assert review_after_delete.status_code == 200, review_after_delete.text
        assert review_after_delete.json()["items"] == []

        recreated_after_delete = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert recreated_after_delete.status_code == 200, recreated_after_delete.text
        review_rows = _review_rows(client)
        assert len([row for row in review_rows if row.status == "pending"]) == 1
        assert len([row for row in review_rows if row.status == "archived"]) == 2
