from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import QuestionFlagV2


def _persistent_flags(client) -> list[QuestionFlagV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(QuestionFlagV2).order_by(QuestionFlagV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def test_persistent_flag_endpoint_creates_immediate_persistent_flag(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-OPS-02",
            title="Answer Ops Persistent",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-OPS-02"},
        )
        assert response.status_code == 200, response.text
        session_id = response.json()["id"]
        question_id = int(response.json()["items"][0]["questionKey"])

        blocked = client.post(
            f"/api/v2/practice/sessions/{session_id}/persistent-flag",
            json={"questionId": question_id, "reason": "needs_review"},
        )
        assert blocked.status_code == 409, blocked.text
        assert blocked.json()["code"] == "practice_session_not_submitted"

        client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": str(question_id), "answer": {"selected": ["A"]}}]},
        )
        client.post(f"/api/v2/practice/sessions/{session_id}/submit")

        flagged = client.post(
            f"/api/v2/practice/sessions/{session_id}/persistent-flag",
            json={"questionId": question_id, "reason": "needs_review"},
        )
        assert flagged.status_code == 200, flagged.text
        assert flagged.json()["hasPersistentFlag"] is True
        persistent = _persistent_flags(client)
        assert len(persistent) == 1
        assert persistent[0].reason == "needs_review"
