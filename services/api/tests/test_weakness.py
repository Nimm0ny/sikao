"""SIKAO Wave 8 Phase B: GET /api/v2/practice/wrong-questions/weakness tests.

覆盖:
  - empty user (无答题 → 5 module score=0)
  - multi-subject (mock 错题 → 高分排前)
  - single-subject (1 subject 错最多 → top1)
  - limit param (limit=3 / 限制返条数)
  - validation (limit 出界 → 422)
  - unauthorized → 401

复用 test_wrong_book_heatmap _seed_subject_and_answers helper 写 fixture
PracticeSessionAnswer (避走 /submit 路径).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models import (
    PracticeSession,
    PracticeSessionAnswer,
    Question,
    User,
)
from tests.test_exam_api import (
    _setup_published_paper,
    bearer_headers,
    build_client,
    iter_session_questions,
    login,
)


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _start_session(client, token: str) -> dict:
    """Start session, return start payload."""
    resp = client.post(
        "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
    )
    assert resp.status_code == 200
    return resp.json()


def _seed_answers(
    client,
    *,
    user_username: str,
    subject_assignments: dict[int, str],
    answer_outcomes: list[tuple[int, bool]],
    bank_subject_padding: dict[str, int] | None = None,
) -> None:
    """Set Question.subject + insert PracticeSessionAnswer rows.

    answer_outcomes: [(question_id, is_correct), ...] — answered_at 现在.

    bank_subject_padding: { subject_full_name: extra_question_count } — 给指
    定 subject 额外 N 道未答 question 增大 bank_total, 让 completion_rate < 1
    保证 weakness score > 0. 用 fixture 已存在的其他 question id pad (不新建,
    避免破 paper revision).
    """
    db = client.app.state.db.session_factory()
    try:
        for qid, subject in subject_assignments.items():
            q = db.get(Question, qid)
            assert q is not None
            q.subject = subject

        # bank padding: 给其他 question 设上同 subject (相当于扩大 bank).
        if bank_subject_padding:
            assigned_qids = set(subject_assignments.keys())
            other_qs = list(
                db.scalars(
                    select(Question).where(Question.id.not_in(assigned_qids))
                )
            )
            cursor = 0
            for subject, n in bank_subject_padding.items():
                for _ in range(n):
                    if cursor >= len(other_qs):
                        raise AssertionError(
                            "not enough fixture questions to pad bank"
                        )
                    other_qs[cursor].subject = subject
                    cursor += 1

        user_row = db.scalar(
            select(User).where(User.username == user_username)
        )
        assert user_row is not None
        ps = db.scalar(
            select(PracticeSession).where(PracticeSession.user_id == user_row.id)
        )
        assert ps is not None

        # 清现有 answers 避免 fixture 残留 (e.g. start 时 0 answer 但保险).
        for a in list(
            db.scalars(
                select(PracticeSessionAnswer).where(
                    PracticeSessionAnswer.session_id == ps.id
                )
            )
        ):
            db.delete(a)
        db.flush()

        now_utc = _utc_now_naive()
        for idx, (qid, is_correct) in enumerate(answer_outcomes):
            db.add(
                PracticeSessionAnswer(
                    session_id=ps.id,
                    question_id=qid,
                    display_order=idx,
                    selected_answer="A",
                    correct_answer_snapshot="A" if is_correct else "B",
                    is_correct=is_correct,
                    answered_at=now_utc - timedelta(hours=idx),
                )
            )
        db.commit()
    finally:
        db.close()


# ─── empty / unauthorized ────────────────────────────────────────────────


def test_weakness_empty_user_returns_zero_scores(tmp_path: Path) -> None:
    """新用户 → all module score=0 (按 limit 截 top N)."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/weakness",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["modules"]) == 2  # default limit=2
        for m in body["modules"]:
            assert m["score"] == 0.0
            assert m["wrongRate"] == 0.0


def test_weakness_unauthorized_returns_401(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        resp = client.get("/api/v2/practice/wrong-questions/weakness")
        assert resp.status_code == 401


# ─── validation ──────────────────────────────────────────────────────────


def test_weakness_limit_zero_returns_422(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/weakness?limit=0",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 422


def test_weakness_limit_too_large_returns_422(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/weakness?limit=10",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 422


# ─── multi-subject ───────────────────────────────────────────────────────


def test_weakness_single_subject_wrong_returns_high_score(
    tmp_path: Path,
) -> None:
    """1 道 '言语' 错 + 3 道 '言语' 未答 → 言语 score > 0, 排第一."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = _start_session(client, token)
        qid = iter_session_questions(start)[0]["questionId"]

        # pad bank: 3 个其他 question 设 subject "言语理解" 让 bank_total=4,
        # completion_rate=1/4=0.25, score = 1.0 × 0.75 × 1.0 × 100 = 75.
        _seed_answers(
            client,
            user_username="alice",
            subject_assignments={qid: "言语理解"},
            answer_outcomes=[(qid, False)],
            bank_subject_padding={"言语理解": 3},
        )

        resp = client.get(
            "/api/v2/practice/wrong-questions/weakness?limit=5",
            headers=bearer_headers(token),
        )
        body = resp.json()
        yanyu = next(m for m in body["modules"] if m["subject"] == "言语")
        assert yanyu["score"] > 0
        assert yanyu["wrongRate"] == 1.0
        assert yanyu["suggestedAction"] == "重做错题"
        # 排第一
        assert body["modules"][0]["subject"] == "言语"


def test_weakness_multi_subject_sorted_desc(tmp_path: Path) -> None:
    """2 subject 错题率不同 → score desc 排序.

    fixture 仅 4 题, 所以分配 2 题, 剩 2 题做 bank padding (各分 1 给 言语/数量).
    """
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = _start_session(client, token)
        questions = iter_session_questions(start)
        assert len(questions) >= 2
        qids = [q["questionId"] for q in questions[:2]]

        # 言语: 1 错 / 1 用户总 = 100% 错; 数量: 0 错 / 1 用户总 = 0% 错 (答对).
        # bank pad: 言语 + 1 道, 数量 + 1 道, completion_rate=0.5/subject.
        # score: 言语 = 1.0 × 0.5 × 100 = 50; 数量 = 0 (wrong_rate=0).
        _seed_answers(
            client,
            user_username="alice",
            subject_assignments={
                qids[0]: "言语理解",
                qids[1]: "数量关系",
            },
            answer_outcomes=[
                (qids[0], False),  # 言语 错
                (qids[1], True),  # 数量 对
            ],
            bank_subject_padding={"言语理解": 1, "数量关系": 1},
        )

        resp = client.get(
            "/api/v2/practice/wrong-questions/weakness?limit=5",
            headers=bearer_headers(token),
        )
        body = resp.json()
        # 言语 score > 0, 数量 score == 0 (wrong_rate=0).
        yanyu = next(m for m in body["modules"] if m["subject"] == "言语")
        shuliang = next(m for m in body["modules"] if m["subject"] == "数量")
        assert yanyu["score"] > 0
        assert shuliang["score"] == 0.0
        # 言语 排第一.
        assert body["modules"][0]["subject"] == "言语"


def test_weakness_limit_param_truncates(tmp_path: Path) -> None:
    """limit=3 → 返 3 行."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        resp = client.get(
            "/api/v2/practice/wrong-questions/weakness?limit=3",
            headers=bearer_headers(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["modules"]) == 3


def test_weakness_suggested_action_thresholds(tmp_path: Path) -> None:
    """wrong_rate 阈值 — 100% 错 → 重做错题."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = _start_session(client, token)
        qid = iter_session_questions(start)[0]["questionId"]

        _seed_answers(
            client,
            user_username="alice",
            subject_assignments={qid: "言语理解"},
            answer_outcomes=[(qid, False)],
            bank_subject_padding={"言语理解": 2},
        )

        resp = client.get(
            "/api/v2/practice/wrong-questions/weakness?limit=5",
            headers=bearer_headers(token),
        )
        body = resp.json()
        yanyu = next(m for m in body["modules"] if m["subject"] == "言语")
        # 100% wrong → 重做错题
        assert yanyu["suggestedAction"] == "重做错题"
