from __future__ import annotations

import os
from datetime import UTC, date, datetime
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import (
    PaperRevisionV2,
    PaperV2,
    PlanEventV2,
    PlanV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    UserV2,
)


def utc_naive(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=UTC).replace(tzinfo=None)


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_event_aggregates_route_and_openapi(tmp_path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-AGG-001",
            title="Aggregate Xingce",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        essay_question_ids = seed_paper(
            client,
            paper_code="ES-AGG-001",
            title="Aggregate Essay",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay A", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "summary"},
            ],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory

        with factory() as session:
            user = session.query(UserV2).filter_by(id=user_id).one()
            xingce_paper = session.query(PaperV2).filter_by(paper_code="XC-AGG-001").one()
            xingce_revision = session.query(PaperRevisionV2).filter_by(
                paper_id=xingce_paper.id,
                status="published",
            ).one()
            essay_paper = session.query(PaperV2).filter_by(paper_code="ES-AGG-001").one()
            essay_revision = session.query(PaperRevisionV2).filter_by(
                paper_id=essay_paper.id,
                status="published",
            ).one()

            plan = PlanV2(
                user_id=user.id,
                name="Aggregate plan",
                target_exam_id="guokao-2027",
                target_exam_date=date(2027, 11, 26),
                daily_minutes_target=180,
                style="balanced",
                baseline={},
                focus_subjects=["xingce"],
                status="active",
                source="user_manual",
                change_log=[],
            )
            session.add(plan)
            session.flush()

            ready_event = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Ready event",
                category="xingce",
                notes="",
                start_at=utc_naive(2026, 5, 30, 1),
                end_at=utc_naive(2026, 5, 30, 2),
                timezone="Asia/Shanghai",
                status="planned",
                source="user_manual",
                change_log=[],
            )
            missing_event = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Missing event",
                category="xingce",
                notes="",
                start_at=utc_naive(2026, 5, 30, 3),
                end_at=utc_naive(2026, 5, 30, 4),
                timezone="Asia/Shanghai",
                status="planned",
                source="user_manual",
                change_log=[],
            )
            stale_event = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Stale event",
                category="xingce",
                notes="",
                start_at=utc_naive(2026, 5, 30, 5),
                end_at=utc_naive(2026, 5, 30, 6),
                timezone="Asia/Shanghai",
                status="planned",
                source="user_manual",
                change_log=[],
            )
            unsupported_event = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Unsupported event",
                category="essay",
                notes="",
                start_at=utc_naive(2026, 5, 30, 7),
                end_at=utc_naive(2026, 5, 30, 8),
                timezone="Asia/Shanghai",
                status="planned",
                source="user_manual",
                change_log=[],
            )
            no_graded_event = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="No graded event",
                category="xingce",
                notes="",
                start_at=utc_naive(2026, 5, 30, 9),
                end_at=utc_naive(2026, 5, 30, 10),
                timezone="Asia/Shanghai",
                status="planned",
                source="user_manual",
                change_log=[],
            )
            recurring_event = PlanEventV2(
                plan_id=plan.id,
                user_id=user.id,
                title="Recurring event",
                category="xingce",
                notes="",
                start_at=utc_naive(2026, 5, 30, 11),
                end_at=utc_naive(2026, 5, 30, 12),
                timezone="Asia/Shanghai",
                recurring_rule="FREQ=DAILY;COUNT=2",
                recurring_exception_dates=[],
                status="planned",
                source="user_manual",
                change_log=[],
            )
            session.add_all(
                [
                    ready_event,
                    missing_event,
                    stale_event,
                    unsupported_event,
                    no_graded_event,
                    recurring_event,
                ]
            )
            session.flush()

            ready_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="paper",
                status="submitted",
                paper_id=xingce_paper.id,
                revision_id=xingce_revision.id,
                payload_json={},
                started_at=utc_naive(2026, 5, 30, 1),
                submitted_at=utc_naive(2026, 5, 30, 2),
                total_active_seconds=1800,
                linked_plan_event_id=ready_event.id,
                source_mode="paper",
                config_snapshot={},
            )
            unsupported_session = PracticeSessionV2(
                user_id=user.id,
                track="essay",
                entry_kind="mock_exam",
                status="submitted",
                paper_id=essay_paper.id,
                revision_id=essay_revision.id,
                payload_json={},
                started_at=utc_naive(2026, 5, 30, 7),
                submitted_at=utc_naive(2026, 5, 30, 8),
                total_active_seconds=2400,
                linked_plan_event_id=unsupported_event.id,
                exam_mode=True,
                time_limit_minutes=120,
                source_mode="paper",
                config_snapshot={},
            )
            no_graded_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="paper",
                status="submitted",
                paper_id=xingce_paper.id,
                revision_id=xingce_revision.id,
                payload_json={},
                started_at=utc_naive(2026, 5, 30, 9),
                submitted_at=utc_naive(2026, 5, 30, 10),
                linked_plan_event_id=no_graded_event.id,
                source_mode="paper",
                config_snapshot={},
            )
            foreign_session = PracticeSessionV2(
                user_id=user.id + 999,
                track="xingce",
                entry_kind="paper",
                status="submitted",
                paper_id=xingce_paper.id,
                revision_id=xingce_revision.id,
                payload_json={},
                started_at=utc_naive(2026, 5, 30, 5),
                submitted_at=utc_naive(2026, 5, 30, 6),
                total_active_seconds=600,
                source_mode="paper",
                config_snapshot={},
            )
            recurring_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="paper",
                status="submitted",
                paper_id=xingce_paper.id,
                revision_id=xingce_revision.id,
                payload_json={},
                started_at=utc_naive(2026, 5, 31, 11),
                submitted_at=utc_naive(2026, 5, 31, 12),
                total_active_seconds=900,
                linked_plan_event_id=recurring_event.id,
                linked_plan_event_occurrence_ref=f"{recurring_event.id}:2026-05-31",
                source_mode="paper",
                config_snapshot={},
            )
            session.add_all(
                [
                    ready_session,
                    unsupported_session,
                    no_graded_session,
                    foreign_session,
                    recurring_session,
                ]
            )
            session.flush()
            stale_event.linked_session_id = foreign_session.id

            session.add_all(
                [
                    PracticeSessionAnswerV2(
                        session_id=ready_session.id,
                        question_id=question_ids[0],
                        question_key="q1",
                        display_order=1,
                        response_json={"selected": ["A"]},
                        is_correct=True,
                        answered_at=utc_naive(2026, 5, 30, 2),
                    ),
                    PracticeSessionAnswerV2(
                        session_id=ready_session.id,
                        question_id=question_ids[1],
                        question_key="q2",
                        display_order=2,
                        response_json={"selected": ["B"]},
                        is_correct=False,
                        answered_at=utc_naive(2026, 5, 30, 2),
                    ),
                    PracticeSessionAnswerV2(
                        session_id=unsupported_session.id,
                        question_id=essay_question_ids[0],
                        question_key="essay-q1",
                        display_order=1,
                        response_json={"text": "draft"},
                        is_correct=None,
                        answered_at=utc_naive(2026, 5, 30, 8),
                    ),
                    PracticeSessionAnswerV2(
                        session_id=recurring_session.id,
                        question_id=question_ids[0],
                        question_key="q1",
                        display_order=1,
                        response_json={"selected": ["A"]},
                        is_correct=True,
                        answered_at=utc_naive(2026, 5, 31, 12),
                    ),
                ]
            )
            session.commit()

            ready_id = str(ready_event.id)
            missing_id = str(missing_event.id)
            stale_id = str(stale_event.id)
            unsupported_id = str(unsupported_event.id)
            no_graded_id = str(no_graded_event.id)
            recurring_ref = f"{recurring_event.id}:2026-05-31"

        openapi = client.get("/openapi.json")
        assert openapi.status_code == 200, openapi.text
        schema = openapi.json()
        assert "/api/v2/plans/events/aggregates" in schema["paths"]
        availability_schema = schema["components"]["schemas"]["PlanEventAggregateReadV2"]["properties"]["availability"]
        assert "event_unavailable" in availability_schema["enum"]
        assert "session_not_found" in availability_schema["enum"]

        response = client.post(
            "/api/v2/plans/events/aggregates",
            json={
                "eventIds": [
                    stale_id,
                    ready_id,
                    "999999",
                    missing_id,
                    unsupported_id,
                    no_graded_id,
                    recurring_ref,
                ]
            },
        )
        assert response.status_code == 200, response.text
        items = response.json()["items"]
        assert [item["eventId"] for item in items] == [
            stale_id,
            ready_id,
            "999999",
            missing_id,
            unsupported_id,
            no_graded_id,
            recurring_ref,
        ]

        by_id = {item["eventId"]: item for item in items}
        assert by_id[stale_id]["availability"] == "session_not_found"
        assert by_id[ready_id]["availability"] == "ready"
        assert by_id[ready_id]["metrics"] == {
            "attemptedCount": 2,
            "correctCount": 1,
            "accuracy": 0.5,
            "activeSeconds": 1800,
            "sourceKind": "practice_session",
        }
        assert by_id["999999"]["availability"] == "event_unavailable"
        assert by_id[missing_id]["availability"] == "missing_linked_session"
        assert by_id[unsupported_id]["availability"] == "unsupported_track"
        assert by_id[no_graded_id]["availability"] == "no_graded_items"
        assert by_id[recurring_ref]["availability"] == "ready"
        assert by_id[recurring_ref]["metrics"]["attemptedCount"] == 1

        duplicate = client.post(
            "/api/v2/plans/events/aggregates",
            json={"eventIds": [ready_id, ready_id]},
        )
        assert duplicate.status_code == 422
        assert "distinct" in duplicate.text
