"""SIKAO Wave 4 Phase 2C: xingce-wrongbook BE tests.

覆盖:
  - 7 endpoint happy + edge (404 / 422 / peek 耗尽 / 跨用户 isolation)
  - mastery 5 维评估 invariant (graduated / danger / meek / ok / todo)
  - 蒙对识破算法 (duration > avg×2 且答对)
  - peek 扣减 + 0 时 422
  - smart-review today / next
  - alembic 0019 + 0020 schema 落地 (新表 + 新字段存在)
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import inspect, select

from sikao_api.db.models import (
    WrongQuestionAttempt,
    WrongQuestionMastery,
)
from sikao_api.modules.wrong_book.application.wrong_book import (
    WrongBookService,
    _evaluate_mastery_flags,
)
from tests.test_exam_api import (
    _setup_published_paper,
    bearer_headers,
    build_answer_map,
    build_client,
    iter_session_questions,
    login,
)

# ─── helper ─────────────────────────────────────────────────────────────────


def _setup_user_with_one_wrong(
    tmp_path: Path,
    client: TestClient,
    *,
    username: str = "alice",
    password: str = "alice-pass",
) -> tuple[str, int]:
    """登录 + 起 session + 第一题做错 → 返 (token, question_id) for wrong-book."""
    _setup_published_paper(tmp_path, client)
    token = login(client, username, password)
    start = client.post(
        "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
    )
    payload = start.json()
    session_id = payload["sessionId"]
    questions = iter_session_questions(payload)
    qid = questions[0]["questionId"]
    correct = build_answer_map(client, payload)[str(qid)]
    wrong = ["A"] if correct != ["A"] else ["B"]
    submit_resp = client.post(
        f"/api/v2/practice/sessions/{session_id}/submit",
        json={"questionId": qid, "selectedAnswerKeys": wrong},
        headers=bearer_headers(token),
    )
    assert submit_resp.status_code == 200, submit_resp.text
    return token, qid


def _pick_correct_keys(client: TestClient, session_payload: dict, question_id: int) -> list[str]:
    return build_answer_map(client, session_payload)[str(question_id)]


# ─── alembic schema verify ──────────────────────────────────────────────────


def test_alembic_0019_creates_wrong_question_attempts_table(tmp_path: Path) -> None:
    """schema 落地: wrong_question_attempts 新表 + 索引 + unique constraint."""
    with build_client(tmp_path) as client:
        engine = client.app.state.db.engine
        inspector = inspect(engine)
        assert "wrong_question_attempts" in inspector.get_table_names()
        cols = {c["name"] for c in inspector.get_columns("wrong_question_attempts")}
        assert cols == {
            "id",
            "user_id",
            "question_id",
            "attempt_no",
            "selected_option_key",
            "duration_ms",
            "attempted_at",
            "error_reason",
            "is_correct",
        }
        # unique constraint (user_id, question_id, attempt_no) 存在.
        unique_names = {
            u["name"] for u in inspector.get_unique_constraints("wrong_question_attempts")
        }
        assert "uq_attempts_user_question_attempt" in unique_names


def test_alembic_0020_extends_wrong_question_masteries_columns(tmp_path: Path) -> None:
    """schema 落地: wrong_question_masteries 加 4 新字段."""
    with build_client(tmp_path) as client:
        engine = client.app.state.db.engine
        inspector = inspect(engine)
        cols = {c["name"] for c in inspector.get_columns("wrong_question_masteries")}
        # 老字段保留, 新字段加入.
        assert "error_reasons" in cols
        assert "bluff_count" in cols
        assert "peek_count" in cols
        assert "attempts_json" in cols


# ─── #1 summary ─────────────────────────────────────────────────────────────


def test_summary_returns_five_stats(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        resp = client.get(
            "/api/v2/practice/wrong-questions/summary",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {
            "inPractice",
            "todoCount",
            "dangerCount",
            "graduatedCount",
            "weeklyNew",
        }
        assert body["inPractice"] == 1
        assert body["todoCount"] == 1
        assert body["graduatedCount"] == 0
        assert body["weeklyNew"] == 1


def test_summary_isolation_per_user(tmp_path: Path) -> None:
    """alice 的错题不应在 bob 的 summary 里."""
    with build_client(tmp_path) as client:
        _setup_user_with_one_wrong(tmp_path, client, username="alice", password="alice-pass")
        bob_token = login(client, "bob", "bob-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/summary",
            headers=bearer_headers(bob_token),
        )
        assert resp.status_code == 200
        assert resp.json() == {
            "inPractice": 0,
            "todoCount": 0,
            "dangerCount": 0,
            "graduatedCount": 0,
            "weeklyNew": 0,
        }


# ─── #2 graduation candidates ───────────────────────────────────────────────


def test_graduation_candidates_returns_consecutive_two(tmp_path: Path) -> None:
    """consecutive_correct_count == 2 的题才返."""
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        # 手动把 mastery 的 consecutive_correct 改 2.
        session = client.app.state.db.session_factory()
        try:
            record = session.scalar(
                select(WrongQuestionMastery).where(
                    WrongQuestionMastery.question_id == qid,
                )
            )
            assert record is not None
            record.consecutive_correct_count = 2
            session.commit()
        finally:
            session.close()

        resp = client.get(
            "/api/v2/practice/wrong-questions/graduation-candidates",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["questionId"] == qid
        assert body[0]["consecutiveCorrect"] == 2


def test_graduation_candidates_excludes_other_states(tmp_path: Path) -> None:
    """consecutive_correct_count != 2 不返."""
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        # consecutive=0 (做错后默认状态) → 不返
        resp = client.get(
            "/api/v2/practice/wrong-questions/graduation-candidates",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json() == []


# ─── #4 mark mastered ───────────────────────────────────────────────────────


def test_mark_mastered_sets_state_and_consecutive(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        resp = client.patch(
            f"/api/v2/practice/wrong-questions/{qid}/mark-mastered",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["masteryLevel"] == "mastered"
        assert body["consecutiveCorrectCount"] >= 3


def test_mark_mastered_404_for_unknown_question(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.patch(
            "/api/v2/practice/wrong-questions/99999/mark-mastered",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 404


# ─── #5 peek ────────────────────────────────────────────────────────────────


def test_peek_decrements_count(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        # 默认 peek_count=3 → 第一次 peek 后剩 2.
        resp = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/peek",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["peekedReference"] is True
        assert body["peekRemaining"] == 2
        # 再 peek 两次 → 0.
        client.post(
            f"/api/v2/practice/wrong-questions/{qid}/peek",
            headers=bearer_headers(token),
        )
        third = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/peek",
            headers=bearer_headers(token),
        )
        assert third.status_code == 200
        assert third.json()["peekRemaining"] == 0


def test_peek_rejects_when_exhausted(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        # 跑完 3 次 peek → 0.
        for _ in range(3):
            client.post(
                f"/api/v2/practice/wrong-questions/{qid}/peek",
                headers=bearer_headers(token),
            )
        resp = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/peek",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 422


def test_peek_404_for_no_mastery_record(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.post(
            "/api/v2/practice/wrong-questions/99999/peek",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 404


# ─── #6 submit with bluff ───────────────────────────────────────────────────


def test_submit_with_bluff_first_correct_no_bluff(tmp_path: Path) -> None:
    """第一次重做 (0 历史 attempts) 不判蒙对."""
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        # 拿 correct key 来重做答对.
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        correct = _pick_correct_keys(client, start.json(), qid)

        resp = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/submit-bluff",
            json={"selectedOptionKeys": correct, "durationMs": 10_000},
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["isCorrect"] is True
        assert body["bluffDetected"] is False  # 无历史 baseline 不判
        assert body["attemptNo"] == 1


def test_submit_with_bluff_detects_slow_correct(tmp_path: Path) -> None:
    """duration > avg×2 + 答对 = bluff."""
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        correct = _pick_correct_keys(client, start.json(), qid)

        # 先做 2 次正常耗时 (10s, 12s avg=11s).
        for ms in (10_000, 12_000):
            client.post(
                f"/api/v2/practice/wrong-questions/{qid}/submit-bluff",
                json={"selectedOptionKeys": correct, "durationMs": ms},
                headers=bearer_headers(token),
            )
        # 第 3 次 50s 远超 avg×2=22s → bluff.
        resp = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/submit-bluff",
            json={"selectedOptionKeys": correct, "durationMs": 50_000},
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["isCorrect"] is True
        assert body["bluffDetected"] is True
        assert body["bluffCount"] >= 1


def test_submit_with_bluff_wrong_answer_no_bluff(tmp_path: Path) -> None:
    """答错的题永远不是 bluff (即使耗时长)."""
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        wrong = ["X"]  # 肯定错
        resp = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/submit-bluff",
            json={"selectedOptionKeys": wrong, "durationMs": 999_999},
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["isCorrect"] is False
        assert body["bluffDetected"] is False


def test_submit_with_bluff_writes_attempts_row(tmp_path: Path) -> None:
    """submit 写 wrong_question_attempts 一行 (attempt_no 单调)."""
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        correct = _pick_correct_keys(client, start.json(), qid)
        client.post(
            f"/api/v2/practice/wrong-questions/{qid}/submit-bluff",
            json={"selectedOptionKeys": correct, "durationMs": 5_000},
            headers=bearer_headers(token),
        )
        client.post(
            f"/api/v2/practice/wrong-questions/{qid}/submit-bluff",
            json={"selectedOptionKeys": correct, "durationMs": 7_000},
            headers=bearer_headers(token),
        )
        session = client.app.state.db.session_factory()
        try:
            rows = list(
                session.scalars(
                    select(WrongQuestionAttempt).where(
                        WrongQuestionAttempt.question_id == qid,
                    ).order_by(WrongQuestionAttempt.attempt_no)
                )
            )
            assert len(rows) == 2
            assert rows[0].attempt_no == 1
            assert rows[1].attempt_no == 2
            assert rows[0].duration_ms == 5_000
        finally:
            session.close()


# ─── #7 smart-review today ──────────────────────────────────────────────────


def test_smart_review_today_zero_when_no_attempts(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/smart-review/today", headers=bearer_headers(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["pushedToday"] == 0
        assert body["finishedToday"] == 0
        assert body["streakDays"] == 0


def test_smart_review_today_counts_today_attempts(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        correct = _pick_correct_keys(client, start.json(), qid)
        # 一次 attempt (今天).
        client.post(
            f"/api/v2/practice/wrong-questions/{qid}/submit-bluff",
            json={"selectedOptionKeys": correct, "durationMs": 8_000},
            headers=bearer_headers(token),
        )
        resp = client.get(
            "/api/v2/practice/smart-review/today", headers=bearer_headers(token)
        )
        body = resp.json()
        assert body["pushedToday"] == 1
        assert body["finishedToday"] == 1
        assert body["streakDays"] == 1


# ─── #8 smart-review next ───────────────────────────────────────────────────


def test_smart_review_next_returns_unmastered(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token, qid = _setup_user_with_one_wrong(tmp_path, client)
        resp = client.get(
            "/api/v2/practice/smart-review/next", headers=bearer_headers(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["questionId"] == qid
        assert body["mode"] in ("qifei", "danger")


def test_smart_review_next_404_when_all_mastered(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/smart-review/next", headers=bearer_headers(token)
        )
        assert resp.status_code == 404


# ─── mastery 5 维评估 invariant (pure function) ─────────────────────────────


def _make_mastery(
    *,
    consecutive: int,
    bluff: int = 0,
    error_reasons: list[str] | None = None,
) -> WrongQuestionMastery:
    """Fixture: 不入 DB 的 mastery row, 给 _evaluate_mastery_flags 用."""
    record = WrongQuestionMastery()
    record.consecutive_correct_count = consecutive
    record.bluff_count = bluff
    record.error_reasons = error_reasons or []
    record.last_wrong_time = datetime.now(UTC).replace(tzinfo=None)
    return record


def test_mastery_flags_todo() -> None:
    flags = _evaluate_mastery_flags(_make_mastery(consecutive=0))
    assert flags["is_todo"] is True
    assert flags["is_graduated"] is False
    assert flags["is_meek"] is False


def test_mastery_flags_ok() -> None:
    flags = _evaluate_mastery_flags(_make_mastery(consecutive=1))
    assert flags["is_ok"] is True
    assert flags["is_meek"] is False
    assert flags["is_todo"] is False


def test_mastery_flags_meek() -> None:
    flags = _evaluate_mastery_flags(_make_mastery(consecutive=2))
    assert flags["is_meek"] is True
    assert flags["is_ok"] is False


def test_mastery_flags_graduated() -> None:
    flags = _evaluate_mastery_flags(_make_mastery(consecutive=3))
    assert flags["is_graduated"] is True
    assert flags["is_todo"] is False


def test_mastery_flags_danger_by_bluff() -> None:
    flags = _evaluate_mastery_flags(_make_mastery(consecutive=2, bluff=2))
    assert flags["is_danger"] is True
    assert flags["is_meek"] is False  # danger 优先 over meek


def test_mastery_flags_danger_by_trap_caught() -> None:
    flags = _evaluate_mastery_flags(
        _make_mastery(consecutive=1, error_reasons=["trap_caught"])
    )
    assert flags["is_danger"] is True
    assert flags["is_ok"] is False  # danger 优先 over ok


# ─── filter_by_view (#3 扩参 helper) ─────────────────────────────────────────


def test_filter_by_view_all_returns_all() -> None:
    recs = [_make_mastery(consecutive=c) for c in (0, 1, 2, 3)]
    assert len(WrongBookService.filter_by_view(recs, "all")) == 4
    assert len(WrongBookService.filter_by_view(recs, None)) == 4


def test_filter_by_view_todo_only_zero_consecutive() -> None:
    recs = [_make_mastery(consecutive=c) for c in (0, 0, 1, 2, 3)]
    out = WrongBookService.filter_by_view(recs, "todo")
    assert len(out) == 2  # consecutive=0 两条


def test_filter_by_view_graduated_only_three_plus() -> None:
    recs = [_make_mastery(consecutive=c) for c in (0, 1, 2, 3, 5)]
    out = WrongBookService.filter_by_view(recs, "graduated")
    assert len(out) == 2  # consecutive >=3 两条


def test_filter_by_view_danger() -> None:
    recs = [
        _make_mastery(consecutive=1, bluff=0),
        _make_mastery(consecutive=2, bluff=2),
        _make_mastery(consecutive=0, error_reasons=["trap_caught"]),
    ]
    out = WrongBookService.filter_by_view(recs, "danger")
    assert len(out) == 2  # bluff>=2 + trap_caught


# ─── pure unit: WrongBookService instantiate ────────────────────────────────


def test_service_instantiate_with_session(tmp_path: Path) -> None:
    """Smoke: service 能拿 db session 构造."""
    with build_client(tmp_path) as client:
        session = client.app.state.db.session_factory()
        try:
            svc = WrongBookService(session)
            assert svc is not None
        finally:
            session.close()


# ─── ruff/mypy clean — no unused imports ───────────────────────────────────
# (datetime / timedelta / pytest 仅 fixture/typing 用; 在文件顶部 import 不
# 删, ruff 会 catch 真正未用的 — 此 noqa 不需要.)
