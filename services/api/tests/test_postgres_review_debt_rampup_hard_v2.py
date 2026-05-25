from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, ProfileInfoV2, ReviewAttemptV2, ReviewItemV2, UserV2
from sikao_api.modules.review.application.debt_preferences import REVIEW_DEBT_RUNTIME_KEY
from sikao_api.modules.review.application.debt_service import ReviewDebtService
from sikao_api.modules.review.application.hooks import run_review_submit_hooks
from sikao_api.modules.review.application.srs_engine import advance_on_correct, regress_on_incorrect


def _seed_review_items(
    client: TestClient,
    *,
    user_id: int,
    question_ids: list[int],
    days_overdue: int,
    count: int,
) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        for index, question_id in enumerate(question_ids[:count], start=1):
            session.add(
                ReviewItemV2(
                    user_id=user_id,
                    source_kind="wrong_answer",
                    source_id=2000 + index,
                    title=f"Debt item {index}",
                    status="pending",
                    question_id=question_id,
                    metadata_json={"algorithm_version": "simple_v1"},
                    correct_streak=0,
                    next_review_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days_overdue),
                    reason="wrong_answer",
                    version=1,
                )
            )
        session.commit()


def _question_bank(count: int) -> list[dict[str, Any]]:
    return [
        {
            "prompt": f"Debt question {idx}",
            "year": 2024,
            "region": "beijing",
            "exam_type": "provincial",
            "category_l1": "verbal",
            "category_l2": "logic_fill",
        }
        for idx in range(1, count + 1)
    ]


def _review_rows(client: TestClient) -> list[ReviewItemV2]:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        rows = list(session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()))
        for row in rows:
            session.expunge(row)
        return rows


def _synthetic_item(*, streak: int = 1, metadata: dict[str, object] | None = None) -> ReviewItemV2:
    return ReviewItemV2(
        user_id=1,
        source_kind="wrong_answer",
        source_id=1,
        title="Synthetic debt item",
        status="in_progress",
        question_id=1,
        metadata_json=metadata or {},
        correct_streak=streak,
        next_review_at=datetime.now(UTC).replace(tzinfo=None),
        version=1,
        reason="wrong_answer",
    )


def _backdate_rampup_transition(client: TestClient, *, user_id: int, days: int = 1) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        info = session.query(ProfileInfoV2).filter_by(user_id=user_id).one()
        recommender_preferences = dict(info.recommender_preferences or {})
        runtime = dict(recommender_preferences.get(REVIEW_DEBT_RUNTIME_KEY, {}))
        runtime["last_transition_on"] = (
            datetime.now(UTC).replace(tzinfo=None).date() - timedelta(days=days)
        ).isoformat()
        recommender_preferences[REVIEW_DEBT_RUNTIME_KEY] = runtime
        info.recommender_preferences = recommender_preferences
        session.add(info)
        session.commit()


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_review_rampup_start_advance_complete_and_skip(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-DEBT-003",
            title="Debt Rampup",
            subject_kind="xingce",
            questions=_question_bank(80),
        )
        _seed_review_items(client, user_id=user_id, question_ids=question_ids, days_overdue=20, count=80)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            first_row = session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()).first()
            assert first_row is not None
            session.add(
                ReviewAttemptV2(
                    review_item_id=first_row.id,
                    outcome="incorrect",
                    notes_json={},
                    attempted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=12),
                )
            )
            session.commit()

        with factory() as session:
            service = ReviewDebtService(session)
            started = service.run_debt_severity_evaluator(user_id=user_id)
            session.commit()
            assert started == 80

        started_snapshot = client.get("/api/v2/review/debt/snapshot")
        assert started_snapshot.status_code == 200, started_snapshot.text
        assert started_snapshot.json()["rampupActive"] is True
        assert started_snapshot.json()["rampupPhase"] == "day_1"
        assert started_snapshot.json()["recommendedTodayCount"] == 10

        rows = _review_rows(client)
        protected = [row for row in rows if row.metadata_json.get("debt_status") == "ramp_up_protected"]
        redistributed = [row for row in rows if row.metadata_json.get("debt_status") == "redistributed"]
        assert len(protected) == 70
        assert len(redistributed) == 0

        with factory() as session:
            service = ReviewDebtService(session)
            same_day = service.run_rampup_phase_advancer(user_id=user_id)
            session.commit()
            assert same_day == 0

        _backdate_rampup_transition(client, user_id=user_id)
        with factory() as session:
            service = ReviewDebtService(session)
            day2 = service.run_rampup_phase_advancer(user_id=user_id)
            session.commit()
            assert day2 == 15

        day2_snapshot = client.get("/api/v2/review/debt/snapshot")
        assert day2_snapshot.status_code == 200, day2_snapshot.text
        assert day2_snapshot.json()["rampupPhase"] == "day_2"
        assert day2_snapshot.json()["recommendedTodayCount"] == 15

        for _ in range(4):
            _backdate_rampup_transition(client, user_id=user_id)
            with factory() as session:
                service = ReviewDebtService(session)
                service.run_rampup_phase_advancer(user_id=user_id)
                session.commit()

        completed_snapshot = client.get("/api/v2/review/debt/snapshot")
        assert completed_snapshot.status_code == 200, completed_snapshot.text
        assert completed_snapshot.json()["rampupActive"] is False
        completed_plan = client.get("/api/v2/review/debt/plan")
        assert completed_plan.status_code == 200, completed_plan.text
        assert completed_plan.json()["totalCount"] > 0

        with factory() as session:
            session.query(ReviewItemV2).delete()
            session.commit()
        _seed_review_items(client, user_id=user_id, question_ids=question_ids, days_overdue=20, count=80)
        with factory() as session:
            first_row = session.query(ReviewItemV2).order_by(ReviewItemV2.id.asc()).first()
            assert first_row is not None
            session.add(
                ReviewAttemptV2(
                    review_item_id=first_row.id,
                    outcome="incorrect",
                    notes_json={},
                    attempted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=12),
                )
            )
            session.commit()
        with factory() as session:
            service = ReviewDebtService(session)
            service.run_debt_severity_evaluator(user_id=user_id)
            session.commit()

        skipped = client.post(
            "/api/v2/review/debt/skip-rampup",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174202"},
        )
        assert skipped.status_code == 200, skipped.text
        assert skipped.json()["rampupActive"] is False
        skipped_replay = client.post(
            "/api/v2/review/debt/skip-rampup",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174202"},
        )
        assert skipped_replay.status_code == 200, skipped_replay.text
        assert skipped_replay.json() == skipped.json()
        rows_after_skip = _review_rows(client)
        assert any(row.metadata_json.get("debt_status") == "redistributed" for row in rows_after_skip)


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_review_refail_marks_hard_and_manual_clear_preserves_refail_count(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-DEBT-004",
            title="Debt Hard",
            subject_kind="xingce",
            questions=_question_bank(4),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            anchor = ReviewItemV2(
                user_id=user_id,
                source_kind="wrong_answer",
                source_id=700,
                title="Graduated anchor",
                status="graduated",
                question_id=question_ids[0],
                metadata_json={"algorithm_version": "simple_v1"},
                correct_streak=4,
                next_review_at=None,
                reason="wrong_answer",
            )
            session.add(anchor)
            session.commit()
            anchor_id = anchor.id

        for index in range(3):
            with factory() as session:
                practice_session = PracticeSessionV2(
                    user_id=user_id,
                    track="xingce",
                    entry_kind="review",
                    status="submitted",
                    payload_json={},
                    practice_mode="full_set",
                    source_mode="wrong_redo",
                    config_snapshot={},
                )
                session.add(practice_session)
                session.flush()
                session.add(
                    PracticeSessionAnswerV2(
                        session_id=practice_session.id,
                        question_id=question_ids[0],
                        question_key=str(question_ids[0]),
                        display_order=1,
                        response_json={"answer": f"{index}"},
                        is_correct=False,
                    )
                )
                session.commit()
                run_review_submit_hooks(session, user_id=user_id, session_id=practice_session.id)
                session.commit()

        rows = _review_rows(client)
        anchor = next(row for row in rows if row.id == anchor_id)
        assert anchor.metadata_json["re_fail_count"] == 3
        assert anchor.metadata_json["is_hard"] is True

        with factory() as session:
            user = session.get(UserV2, user_id)
            assert user is not None
            service = ReviewDebtService(session)
            service.manual_clear_hard(user=user, item_id=anchor_id)
            session.commit()

        cleared_rows = _review_rows(client)
        cleared = next(row for row in cleared_rows if row.id == anchor_id)
        assert cleared.correct_streak == 0
        assert cleared.status == "pending"
        assert cleared.metadata_json["is_hard"] is False
        assert cleared.metadata_json["re_fail_count"] == 3


def test_review_debt_hard_item_caps_positive_multiplier() -> None:
    item = _synthetic_item(streak=1, metadata={"is_hard": True})
    result = advance_on_correct(item, confidence="certain", used_recall=True, user_tz="Asia/Shanghai")
    assert result.next_review_at is not None
    assert result.new_streak == 2


def test_review_debt_second_mismatch_marks_hard() -> None:
    item = _synthetic_item(streak=2, metadata={"confidence_mismatch_count": 1})
    result = regress_on_incorrect(item, confidence="certain", user_tz="Asia/Shanghai")
    assert result.is_hard_now is True
    assert item.metadata_json["is_hard"] is True
