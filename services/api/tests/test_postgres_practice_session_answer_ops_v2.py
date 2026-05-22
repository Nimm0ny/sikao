from __future__ import annotations

import os

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import QuestionFlagV2


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_session_answer_ops_closed_book_and_submit_promotion(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-PG-OPS",
            title="PG Answer Ops",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        session_response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-PG-OPS", "practiceMode": "full_set"},
        )
        assert session_response.status_code == 200, session_response.text
        payload = session_response.json()
        session_id = payload["id"]
        answer_id = int(payload["items"][0]["id"])
        question_id = int(payload["items"][0]["questionKey"])

        blocked = client.post(f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/view-solution")
        assert blocked.status_code == 403, blocked.text

        flagged = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/flag",
            json={"flagged": True},
        )
        assert flagged.status_code == 200, flagged.text
        submit = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submit.status_code == 200, submit.text

        persistent = client.post(
            f"/api/v2/practice/sessions/{session_id}/persistent-flag",
            json={"questionId": question_id, "reason": "needs_review"},
        )
        assert persistent.status_code == 200, persistent.text
        assert persistent.json()["hasPersistentFlag"] is True
        factory = client.app.state.db.session_factory
        with factory() as session:
            flag = session.query(QuestionFlagV2).filter_by(question_id=question_id).one()
            assert flag.reason == "needs_review"
            assert flag.source_session_id == session_id
