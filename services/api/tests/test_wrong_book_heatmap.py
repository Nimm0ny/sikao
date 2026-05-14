"""SIKAO Wave 5: xingce-wrongbook Heatmap endpoint tests.

覆盖:
  - empty state (新用户 → 5 行 × N cell count=0)
  - with data (mock 错题 → 对应 cell 非 0, peak_idx 正确)
  - days 参数 (7/30/90/180; 其他值 → 422)
  - unauthorized (无 jwt → 401)
  - subject 5 行严格按序 (言语 / 数量 / 判推 / 资分 / 常识)
  - subject bucket 优先级 (常识判断 → 常识, 非误归判推)

跟 test_wrong_book.py 协同 — 复用 build_client / login / _setup_published_paper.
fixture complex-paper.json 的 Question.subject 默认 NULL, 测带数据场景需
手动 update Question.subject.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models import (
    PracticeSession,
    PracticeSessionAnswer,
    Question,
)
from sikao_api.modules.wrong_book.application.wrong_book import _bucket_subject_short
from tests.test_exam_api import (
    _setup_published_paper,
    bearer_headers,
    build_client,
    iter_session_questions,
    login,
)

# ─── helper ─────────────────────────────────────────────────────────────────


def _seed_subject_and_answers(
    client,
    *,
    user_username: str,
    subject_assignments: dict[int, str],
    answer_outcomes: list[tuple[int, bool, datetime]],
) -> None:
    """Override Question.subject + insert PracticeSessionAnswer rows directly.

    subject_assignments: { question_id: subject_full_name }
    answer_outcomes: [(question_id, is_correct, answered_at), ...]

    Bypasses /submit endpoint to control answered_at precisely (so we can
    test across days). 用 raw model insert + 单事务 commit.
    """
    db_session = client.app.state.db.session_factory()
    try:
        # 1) update Question.subject
        for qid, subject in subject_assignments.items():
            q = db_session.get(Question, qid)
            assert q is not None, f"question {qid} not found"
            q.subject = subject

        # 2) find a practice session for this user (any session works for FK).
        # Need session.user_id match for the heatmap query.
        from sikao_api.db.models import User as UserModel

        user_row = db_session.scalar(
            select(UserModel).where(UserModel.username == user_username)
        )
        assert user_row is not None

        practice_session = db_session.scalar(
            select(PracticeSession).where(PracticeSession.user_id == user_row.id)
        )
        assert practice_session is not None, (
            "expected at least one practice session — run _setup_published_paper + start first"
        )

        # 3) clear existing answers in that session (避免 fixture 残留 answer 干扰).
        existing_answers = list(
            db_session.scalars(
                select(PracticeSessionAnswer).where(
                    PracticeSessionAnswer.session_id == practice_session.id
                )
            )
        )
        for a in existing_answers:
            db_session.delete(a)
        db_session.flush()

        # 4) seed answers (display_order 自增, correct_answer_snapshot 占位).
        for idx, (qid, is_correct, answered_at) in enumerate(answer_outcomes):
            db_session.add(
                PracticeSessionAnswer(
                    session_id=practice_session.id,
                    question_id=qid,
                    display_order=idx,
                    selected_answer="A",  # 仅占位, heatmap 不读 selected
                    correct_answer_snapshot="A" if is_correct else "B",
                    is_correct=is_correct,
                    answered_at=answered_at,
                )
            )
        db_session.commit()
    finally:
        db_session.close()


def _start_session_for_user(client, token: str) -> int:
    """起 paper D1 session — 返 session_id (subsequent seed 需要)."""
    response = client.post(
        "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
    )
    assert response.status_code == 200
    return int(response.json()["sessionId"])


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


# ─── bucket helper unit tests ───────────────────────────────────────────────


def test_bucket_subject_short_yanyu() -> None:
    assert _bucket_subject_short("言语理解") == "言语"
    assert _bucket_subject_short("言语理解与表达") == "言语"


def test_bucket_subject_short_shuliang() -> None:
    assert _bucket_subject_short("数量关系") == "数量"
    assert _bucket_subject_short("数学运算") == "数量"


def test_bucket_subject_short_panduan() -> None:
    assert _bucket_subject_short("判断推理") == "判推"
    assert _bucket_subject_short("图形推理") == "判推"


def test_bucket_subject_short_ziliao() -> None:
    assert _bucket_subject_short("资料分析") == "资分"


def test_bucket_subject_short_changshi_priority_over_panduan() -> None:
    """关键: '常识判断' 含 '判断' 但优先归 '常识' (不能误归 '判推')."""
    assert _bucket_subject_short("常识判断") == "常识"
    assert _bucket_subject_short("公共基础知识") == "常识"


def test_bucket_subject_short_unknown_returns_none() -> None:
    assert _bucket_subject_short(None) is None
    assert _bucket_subject_short("申论") is None
    assert _bucket_subject_short("英语听力") is None


# ─── empty state ────────────────────────────────────────────────────────────


def test_heatmap_empty_returns_five_rows_n_cells(tmp_path: Path) -> None:
    """新用户 → 5 行 × 30 cell, 所有 count=0, rate=None."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["days"] == 30
        assert len(body["rows"]) == 5
        for row in body["rows"]:
            assert len(row["cells"]) == 30
            assert row["total"] == 0
            assert row["peakIdx"] is None
            for cell in row["cells"]:
                assert cell["count"] == 0
                assert cell["rate"] is None


# ─── subject order ──────────────────────────────────────────────────────────


def test_heatmap_subject_order_strict(tmp_path: Path) -> None:
    """5 行严格按 言语/数量/判推/资分/常识 顺序."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        subjects = [row["subject"] for row in resp.json()["rows"]]
        assert subjects == ["言语", "数量", "判推", "资分", "常识"]


# ─── with data ──────────────────────────────────────────────────────────────


def test_heatmap_with_data_today_cell_filled(tmp_path: Path) -> None:
    """mock 一道 '言语理解' 错题 → 言语行最后 cell count=1, peak_idx=29."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        _start_session_for_user(client, token)
        # 拿 session 内第一题, 给它 subject "言语理解".
        start_resp = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        questions = iter_session_questions(start_resp.json())
        qid = questions[0]["questionId"]

        # 当前时间 UTC naive → Asia/Shanghai 今日 = (UTC + 8h).date()
        # 选 UTC 04:00 当天, +8h = 12:00 今日 (避开 UTC 16:00 之后这种跨日边界).
        now_utc = _utc_now_naive()
        today_local_anchor = datetime.combine(
            (now_utc + timedelta(hours=8)).date(), datetime.min.time()
        ) - timedelta(hours=8)  # 当地今日 00:00 → UTC
        seed_at = today_local_anchor + timedelta(hours=4)  # 当地今日 04:00

        _seed_subject_and_answers(
            client,
            user_username="alice",
            subject_assignments={qid: "言语理解"},
            answer_outcomes=[(qid, False, seed_at)],
        )

        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=30",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        yanyu_row = next(r for r in body["rows"] if r["subject"] == "言语")
        # 今日 = cells[29]; count==1, rate==1.0.
        today_cell = yanyu_row["cells"][29]
        assert today_cell["count"] == 1
        assert today_cell["rate"] == 1.0
        assert yanyu_row["total"] == 1
        assert yanyu_row["peakIdx"] == 29

        # 其他 4 行仍空.
        for row in body["rows"]:
            if row["subject"] != "言语":
                assert row["total"] == 0
                assert row["peakIdx"] is None


def test_heatmap_with_mixed_subjects_three_rows_filled(tmp_path: Path) -> None:
    """3 道题分配 3 subject (言语/数量/常识) 各错 1 次 → 对应 3 行 total=1."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        _start_session_for_user(client, token)

        start_resp = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        questions = iter_session_questions(start_resp.json())
        assert len(questions) >= 3, "fixture 至少需 3 题"
        qids = [q["questionId"] for q in questions[:3]]

        now_utc = _utc_now_naive()
        today_local_anchor = datetime.combine(
            (now_utc + timedelta(hours=8)).date(), datetime.min.time()
        ) - timedelta(hours=8)
        seed_at = today_local_anchor + timedelta(hours=4)

        _seed_subject_and_answers(
            client,
            user_username="alice",
            subject_assignments={
                qids[0]: "言语理解",
                qids[1]: "数量关系",
                qids[2]: "常识判断",
            },
            answer_outcomes=[
                (qids[0], False, seed_at),
                (qids[1], False, seed_at),
                (qids[2], False, seed_at),
            ],
        )

        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=30",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        by_subject = {r["subject"]: r for r in body["rows"]}
        assert by_subject["言语"]["total"] == 1
        assert by_subject["数量"]["total"] == 1
        assert by_subject["常识"]["total"] == 1
        assert by_subject["判推"]["total"] == 0
        assert by_subject["资分"]["total"] == 0


def test_heatmap_rate_correct_count_over_total(tmp_path: Path) -> None:
    """1 错 + 1 对 同 subject 同日 → rate = 1/2 = 0.5."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        _start_session_for_user(client, token)

        start_resp = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        questions = iter_session_questions(start_resp.json())
        assert len(questions) >= 2
        qids = [q["questionId"] for q in questions[:2]]

        now_utc = _utc_now_naive()
        today_local_anchor = datetime.combine(
            (now_utc + timedelta(hours=8)).date(), datetime.min.time()
        ) - timedelta(hours=8)
        seed_at = today_local_anchor + timedelta(hours=4)

        _seed_subject_and_answers(
            client,
            user_username="alice",
            subject_assignments={
                qids[0]: "言语理解",
                qids[1]: "言语理解",
            },
            answer_outcomes=[
                (qids[0], False, seed_at),  # wrong
                (qids[1], True, seed_at),  # correct
            ],
        )

        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=30",
            headers=bearer_headers(token),
        )
        body = resp.json()
        yanyu_row = next(r for r in body["rows"] if r["subject"] == "言语")
        today_cell = yanyu_row["cells"][29]
        assert today_cell["count"] == 1  # 错 1
        assert today_cell["rate"] == 0.5  # 错 1 / 总 2


# ─── days param ─────────────────────────────────────────────────────────────


def test_heatmap_days_7(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=7",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["days"] == 7
        for row in body["rows"]:
            assert len(row["cells"]) == 7


def test_heatmap_days_90(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=90",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["days"] == 90
        for row in body["rows"]:
            assert len(row["cells"]) == 90


def test_heatmap_days_180(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=180",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["days"] == 180
        for row in body["rows"]:
            assert len(row["cells"]) == 180


def test_heatmap_days_invalid_value_returns_422(tmp_path: Path) -> None:
    """days=15 不在 {7,30,90,180} → 422 (ValidationError)."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=15",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 422


# ─── auth ───────────────────────────────────────────────────────────────────


def test_heatmap_unauthorized_returns_401(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        resp = client.get("/api/v2/practice/wrong-questions/heatmap")
        assert resp.status_code == 401


# ─── isolation ──────────────────────────────────────────────────────────────


def test_heatmap_user_isolation(tmp_path: Path) -> None:
    """alice 的错题不应在 bob 的 heatmap 里."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        alice_token = login(client, "alice", "alice-pass")
        _start_session_for_user(client, alice_token)

        start_resp = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(alice_token)
        )
        questions = iter_session_questions(start_resp.json())
        qid = questions[0]["questionId"]

        now_utc = _utc_now_naive()
        today_local_anchor = datetime.combine(
            (now_utc + timedelta(hours=8)).date(), datetime.min.time()
        ) - timedelta(hours=8)
        seed_at = today_local_anchor + timedelta(hours=4)

        _seed_subject_and_answers(
            client,
            user_username="alice",
            subject_assignments={qid: "言语理解"},
            answer_outcomes=[(qid, False, seed_at)],
        )

        bob_token = login(client, "bob", "bob-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/heatmap?days=30",
            headers=bearer_headers(bob_token),
        )
        body = resp.json()
        for row in body["rows"]:
            assert row["total"] == 0
            assert row["peakIdx"] is None
