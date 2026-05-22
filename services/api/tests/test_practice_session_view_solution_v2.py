from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_paper


def _create_paper_session(client, *, paper_code: str, practice_mode: str) -> tuple[int, int, str]:
    seed_paper(
        client,
        paper_code=paper_code,
        title="Answer Ops",
        subject_kind="xingce",
        questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
    )
    response = client.post(
        "/api/v2/practice/sessions",
        json={"track": "xingce", "entryKind": "paper", "paperCode": paper_code, "practiceMode": practice_mode},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return payload["id"], int(payload["items"][0]["id"]), payload["items"][0]["questionKey"]


def test_view_solution_enforces_strict_closed_book(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        full_set_session_id, full_set_answer_id, full_set_question_key = _create_paper_session(
            client,
            paper_code="XC-OPS-FULL",
            practice_mode="full_set",
        )
        blocked = client.post(
            f"/api/v2/practice/sessions/{full_set_session_id}/answers/{full_set_answer_id}/view-solution"
        )
        assert blocked.status_code == 403, blocked.text
        assert blocked.json()["code"] == "STRICT_CLOSED_BOOK"

        per_question_session_id, per_question_answer_id, _ = _create_paper_session(
            client,
            paper_code="XC-OPS-PER",
            practice_mode="per_question",
        )
        allowed = client.post(
            f"/api/v2/practice/sessions/{per_question_session_id}/answers/{per_question_answer_id}/view-solution"
        )
        assert allowed.status_code == 200, allowed.text
        assert allowed.json()["viewedSolution"] is True

        client.post(
            f"/api/v2/practice/sessions/{full_set_session_id}/answers",
            json={"answers": [{"questionKey": full_set_question_key, "answer": {"selected": ["A"]}}]},
        )
        client.post(f"/api/v2/practice/sessions/{full_set_session_id}/submit")
        unlocked = client.post(
            f"/api/v2/practice/sessions/{full_set_session_id}/answers/{full_set_answer_id}/view-solution"
        )
        assert unlocked.status_code == 200, unlocked.text
        assert unlocked.json()["viewedSolution"] is True
