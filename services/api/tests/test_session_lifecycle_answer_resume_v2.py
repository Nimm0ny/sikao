from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, PracticeSessionV2


def _seed_draft_paper_session(
    client: TestClient,
    *,
    user_id: int,
    paper_code: str,
) -> tuple[int, str]:
    seed_paper(
        client,
        paper_code=paper_code,
        title="Lifecycle Answer Resume",
        subject_kind="xingce",
        questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
    )
    response = client.post(
        "/api/v2/practice/sessions",
        json={"track": "xingce", "entryKind": "paper", "paperCode": paper_code},
    )
    assert response.status_code == 200, response.text
    return response.json()["id"], response.json()["items"][0]["questionKey"]


def test_answer_write_moves_draft_and_paused_to_in_progress(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        draft_session_id, question_key = _seed_draft_paper_session(client, user_id=user_id, paper_code="XC-LC-DRAFT")
        save_draft = client.post(
            f"/api/v2/practice/sessions/{draft_session_id}/answers",
            json={"answers": [{"questionKey": question_key, "answer": {"selected": ["A"]}}]},
        )
        assert save_draft.status_code == 200, save_draft.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(PracticeSessionV2, draft_session_id)
            assert row is not None and row.status == "in_progress" and row.first_question_at is not None

        paused_session_id, paused_question_key = _seed_draft_paper_session(client, user_id=user_id, paper_code="XC-LC-PAUSED")
        with factory() as session:
            paused = session.get(PracticeSessionV2, paused_session_id)
            assert paused is not None
            paused.status = "paused"
            paused.paused_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=5)
            session.add(paused)
            session.commit()

        save_paused = client.post(
            f"/api/v2/practice/sessions/{paused_session_id}/answers",
            json={"answers": [{"questionKey": paused_question_key, "answer": {"selected": ["A"]}}]},
        )
        assert save_paused.status_code == 200, save_paused.text
        with factory() as session:
            row = session.get(PracticeSessionV2, paused_session_id)
            audits = list(session.query(AuditLogV2).filter_by(target_type="practice_session_v2", target_id=paused_session_id).order_by(AuditLogV2.id.asc()))
            assert row is not None and row.status == "in_progress" and row.paused_at is None and row.paused_total_seconds >= 300
            assert any(audit.metadata_json.get("trigger") == "answer_during_paused" for audit in audits)


def test_answer_write_rejects_abandoned_and_expired_sessions(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        app = cast(Any, client.app)
        factory = app.state.db.session_factory

        abandoned_session_id, abandoned_question_key = _seed_draft_paper_session(
            client,
            user_id=user_id,
            paper_code="XC-LC-ABANDONED",
        )
        with factory() as session:
            abandoned = session.get(PracticeSessionV2, abandoned_session_id)
            assert abandoned is not None
            abandoned.status = "abandoned"
            abandoned.abandoned_at = datetime.now(UTC).replace(tzinfo=None)
            abandoned.abandoned_reason = "user_discard"
            session.add(abandoned)
            session.commit()

        abandoned_save = client.post(
            f"/api/v2/practice/sessions/{abandoned_session_id}/answers",
            json={"answers": [{"questionKey": abandoned_question_key, "answer": {"selected": ["A"]}}]},
        )
        assert abandoned_save.status_code == 409, abandoned_save.text
        assert abandoned_save.json()["code"] == "SESSION_NOT_WRITABLE"

        expired_session_id, expired_question_key = _seed_draft_paper_session(
            client,
            user_id=user_id,
            paper_code="XC-LC-EXPIRED",
        )
        with factory() as session:
            expired = session.get(PracticeSessionV2, expired_session_id)
            assert expired is not None
            expired.status = "expired"
            expired.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
            session.add(expired)
            session.commit()

        expired_save = client.post(
            f"/api/v2/practice/sessions/{expired_session_id}/answers",
            json={"answers": [{"questionKey": expired_question_key, "answer": {"selected": ["A"]}}]},
        )
        assert expired_save.status_code == 409, expired_save.text
        assert expired_save.json()["code"] == "SESSION_NOT_WRITABLE"
