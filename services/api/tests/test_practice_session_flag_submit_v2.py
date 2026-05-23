from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import QuestionFlagV2, ReviewItemV2


def _persistent_flags(client) -> list[QuestionFlagV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(QuestionFlagV2).order_by(QuestionFlagV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def _review_items(client) -> list[ReviewItemV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def _create_paper_session(client, *, seed: bool) -> tuple[int, int]:
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
    return payload["id"], int(payload["items"][0]["id"])


def test_session_flag_stays_session_local_until_submit(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        session_id, answer_id = _create_paper_session(client, seed=True)
        flagged = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers/{answer_id}/flag",
            json={"flagged": True},
        )
        assert flagged.status_code == 200, flagged.text
        assert flagged.json()["flagged"] is True
        assert _persistent_flags(client) == []

        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text
        persistent = _persistent_flags(client)
        assert len(persistent) == 1
        assert persistent[0].reason == "uncertain"
        review = _review_items(client)
        assert any(item.reason == "flagged_persistent" for item in review)
