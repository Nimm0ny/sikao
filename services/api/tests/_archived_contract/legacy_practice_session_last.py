"""SIKAO Wave 8 Phase B: GET /api/v2/practice/last-session tests.

覆盖:
  - empty state (新用户 → null body)
  - in-progress session (completed_at IS NULL, started 走 desc top-1)
  - completed-only (无 in-progress → null body)
  - unauthorized (无 jwt → 401)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models import PracticeSession
from tests.test_exam_api import (
    _setup_published_paper,
    bearer_headers,
    build_client,
    iter_session_questions,
    login,
)


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ─── empty / unauthorized ────────────────────────────────────────────────


def test_last_session_empty_returns_null(tmp_path: Path) -> None:
    """新用户 → null body."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/last-session", headers=bearer_headers(token)
        )
        assert resp.status_code == 200
        assert resp.json() is None


def test_last_session_unauthorized_returns_401(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        resp = client.get("/api/v2/practice/last-session")
        assert resp.status_code == 401


# ─── in-progress session ─────────────────────────────────────────────────


def test_last_session_in_progress_returns_summary(tmp_path: Path) -> None:
    """alice 起一套 paper, 不 complete → /last-session 返该 session summary."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        assert start.status_code == 200
        session_payload = start.json()
        expected_session_id = session_payload["sessionId"]

        resp = client.get(
            "/api/v2/practice/last-session", headers=bearer_headers(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body is not None
        assert body["id"] == expected_session_id
        assert body["paperId"] > 0  # paper-bound session
        assert isinstance(body["paperTitle"], str)
        assert body["paperTitle"]  # non-empty
        assert body["answeredCount"] == 0  # 还没答
        assert body["total"] >= 1
        assert body["currentQuestionId"] is None  # 一道没答
        assert "startedAt" in body


def test_last_session_with_one_answer_anchors_current_qid(
    tmp_path: Path,
) -> None:
    """答了 1 道 → answeredCount=1, currentQuestionId=last answered qid."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        session_payload = start.json()
        session_id = session_payload["sessionId"]
        first_q = iter_session_questions(session_payload)[0]
        qid = first_q["questionId"]

        # submit one answer
        submit = client.post(
            f"/api/v2/practice/sessions/{session_id}/submit",
            json={"questionId": qid, "selectedAnswerKeys": ["A"]},
            headers=bearer_headers(token),
        )
        assert submit.status_code == 200

        resp = client.get(
            "/api/v2/practice/last-session", headers=bearer_headers(token)
        )
        body = resp.json()
        assert body is not None
        assert body["id"] == session_id
        assert body["answeredCount"] == 1
        assert body["currentQuestionId"] == qid


# ─── completed-only ──────────────────────────────────────────────────────


def test_last_session_returns_null_when_only_completed(tmp_path: Path) -> None:
    """In-DB 仅 completed session → null body."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        session_id = start.json()["sessionId"]

        # Force-complete via DB (避开 submit complete 路径的额外副作用).
        db = client.app.state.db.session_factory()
        try:
            ps = db.scalar(
                select(PracticeSession).where(PracticeSession.id == session_id)
            )
            assert ps is not None
            ps.completed_at = _utc_now_naive()
            db.commit()
        finally:
            db.close()

        resp = client.get(
            "/api/v2/practice/last-session", headers=bearer_headers(token)
        )
        assert resp.status_code == 200
        assert resp.json() is None


# ─── ordering: most recent ───────────────────────────────────────────────


def test_last_session_picks_most_recent_started(tmp_path: Path) -> None:
    """2 个 in-progress session, 取 started_at desc 第一个."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start_a = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        first_id = start_a.json()["sessionId"]

        # 第二个 session — directly insert via DB so started_at 比 first 大.
        db = client.app.state.db.session_factory()
        try:
            first = db.scalar(
                select(PracticeSession).where(PracticeSession.id == first_id)
            )
            assert first is not None
            # 让 first started_at 后退 1 小时, 这样第二个 (新 start) 是 most recent.
            first.started_at = _utc_now_naive() - timedelta(hours=1)
            db.commit()
        finally:
            db.close()

        start_b = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        second_id = start_b.json()["sessionId"]
        assert second_id != first_id

        resp = client.get(
            "/api/v2/practice/last-session", headers=bearer_headers(token)
        )
        body = resp.json()
        assert body is not None
        assert body["id"] == second_id


# ─── isolation ───────────────────────────────────────────────────────────


def test_last_session_user_isolation(tmp_path: Path) -> None:
    """alice 起的 session 不应漏到 bob 的 /last-session."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        alice_token = login(client, "alice", "alice-pass")
        client.post(
            "/api/v2/practice/papers/D1/start",
            headers=bearer_headers(alice_token),
        )

        bob_token = login(client, "bob", "bob-pass")
        resp = client.get(
            "/api/v2/practice/last-session",
            headers=bearer_headers(bob_token),
        )
        assert resp.status_code == 200
        assert resp.json() is None
