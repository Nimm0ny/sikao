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


def _create_paper_session(client, *, seed: bool) -> tuple[int, int, str]:
    if seed:
        seed_paper(
            client,
            paper_code="XC-OPS-01",
            title="Answer Ops",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
    response = client.post(
        "/api/v2/practice/sessions",
        json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-OPS-01", "practiceMode": "full_set"},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return payload["id"], int(payload["items"][0]["id"]), payload["items"][0]["questionKey"]


def test_submit_promotion_preserves_existing_persistent_flag_reason(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        session_id, answer_id, question_key = _create_paper_session(client, seed=True)
        question_id = int(question_key)
        client.post(f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/flag", json={"flagged": True})
        client.post(f"/api/v2/practice/sessions/{session_id}/answers", json={"answers": [{"questionKey": question_key, "answer": {"selected": ["A"]}}]})
        client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        client.post(
            f"/api/v2/practice/sessions/{session_id}/persistent-flag",
            json={"questionId": question_id, "reason": "needs_review"},
        )

        second_session_id, second_answer_id, _ = _create_paper_session(client, seed=False)
        client.post(f"/api/v2/practice/sessions/{second_session_id}/answers/{second_answer_id}/flag", json={"flagged": True})
        client.post(f"/api/v2/practice/sessions/{second_session_id}/answers", json={"answers": [{"questionKey": question_key, "answer": {"selected": ["A"]}}]})
        client.post(f"/api/v2/practice/sessions/{second_session_id}/submit")

        persistent = _persistent_flags(client)
        assert len(persistent) == 1
        assert persistent[0].reason == "needs_review"
        assert persistent[0].source_session_id == session_id
