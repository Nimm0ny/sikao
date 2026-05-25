from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import ReviewItemV2, UserV2
from sikao_api.modules.review.application.debt_service import ReviewDebtService


def _seed_review_items(
    client: TestClient,
    *,
    user_id: int,
    question_ids: list[int],
    days_overdue: int,
    count: int,
    correct_streak: int = 0,
) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        for index, question_id in enumerate(question_ids[:count], start=1):
            session.add(
                ReviewItemV2(
                    user_id=user_id,
                    source_kind="wrong_answer",
                    source_id=1000 + index,
                    title=f"Debt item {index}",
                    status="pending",
                    question_id=question_id,
                    metadata_json={"algorithm_version": "simple_v1"},
                    correct_streak=correct_streak,
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


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_review_debt_snapshot_classifies_and_profile_contract(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-DEBT-001",
            title="Debt Snapshot",
            subject_kind="xingce",
            questions=_question_bank(80),
        )

        empty = client.get("/api/v2/review/debt/snapshot")
        assert empty.status_code == 200, empty.text
        assert empty.json()["debtSeverity"] == "none"
        assert empty.json()["overdueCount"] == 0

        _seed_review_items(client, user_id=user_id, question_ids=question_ids, days_overdue=2, count=10)
        light = client.get("/api/v2/review/debt/snapshot")
        assert light.status_code == 200, light.text
        assert light.json()["debtSeverity"] == "light"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.query(ReviewItemV2).delete()
            session.commit()

        _seed_review_items(client, user_id=user_id, question_ids=question_ids, days_overdue=2, count=50)
        moderate = client.get("/api/v2/review/debt/snapshot")
        assert moderate.status_code == 200, moderate.text
        assert moderate.json()["debtSeverity"] == "moderate"
        assert moderate.json()["dailyLimit"] == 30

        redistributed = client.post(
            "/api/v2/review/debt/redistribute",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174201"},
        )
        assert redistributed.status_code == 200, redistributed.text
        redistributed_replay = client.post(
            "/api/v2/review/debt/redistribute",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174201"},
        )
        assert redistributed_replay.status_code == 200, redistributed_replay.text
        assert redistributed_replay.json() == redistributed.json()

        invalid = client.put(
            "/api/v2/profile/info",
            json={"reviewDailyLimit": 9},
        )
        assert invalid.status_code == 422, invalid.text
        assert invalid.json()["detail"][0]["loc"][-1] == "reviewDailyLimit"

        valid = client.put(
            "/api/v2/profile/info",
            json={
                "reviewDailyLimit": 10,
                "reviewDebtRedistributeEnabled": True,
                "reviewRampupEnabled": True,
                "reviewHardQuestionAutoDeepAnalysis": True,
            },
        )
        assert valid.status_code == 200, valid.text
        assert valid.json()["reviewDailyLimit"] == 10
        assert valid.json()["reviewDebtRedistributeEnabled"] is True
        profile_info = client.get("/api/v2/profile/info")
        assert profile_info.status_code == 200, profile_info.text
        assert profile_info.json()["reviewDailyLimit"] == 10

        with factory() as session:
            session.query(ReviewItemV2).delete()
            session.commit()

        _seed_review_items(client, user_id=user_id, question_ids=question_ids, days_overdue=3, count=70)
        heavy = client.get("/api/v2/review/debt/snapshot")
        assert heavy.status_code == 200, heavy.text
        assert heavy.json()["dailyLimit"] == 10
        assert heavy.json()["debtSeverity"] == "heavy"


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_review_debt_heavy_redistribute_preserves_streak_version_and_plan(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-DEBT-002",
            title="Debt Redistribute",
            subject_kind="xingce",
            questions=_question_bank(120),
        )
        _seed_review_items(
            client,
            user_id=user_id,
            question_ids=question_ids,
            days_overdue=3,
            count=120,
            correct_streak=2,
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            user = session.get(UserV2, user_id)
            assert user is not None
            service = ReviewDebtService(session)
            redistributed = service.run_debt_severity_evaluator(user_id=user.id)
            session.commit()
            assert redistributed == 120

        snapshot = client.get("/api/v2/review/debt/snapshot")
        assert snapshot.status_code == 200, snapshot.text
        assert snapshot.json()["debtSeverity"] == "light"

        plan = client.get("/api/v2/review/debt/plan")
        assert plan.status_code == 200, plan.text
        assert plan.json()["totalCount"] == 120
        assert plan.json()["spreadDays"] == 4
        assert [bucket["count"] for bucket in plan.json()["buckets"]] == [30, 30, 30, 30]

        rows = _review_rows(client)
        assert all(row.correct_streak == 2 for row in rows)
        assert all(row.version == 1 for row in rows)
        assert all(row.metadata_json["algorithm_version"] == "simple_v1" for row in rows)

        with factory() as session:
            user = session.get(UserV2, user_id)
            assert user is not None
            service = ReviewDebtService(session)
            before = {row.id: row.next_review_at for row in session.query(ReviewItemV2).all()}
            extra_ids = service.preview_extra_review_item_ids(user=user, count=10)
            after = {row.id: row.next_review_at for row in session.query(ReviewItemV2).all()}
            assert len(extra_ids) == 10
            assert before == after
