from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from sqlalchemy import select
from _home_phase_m3_support import (
    AuditLogV2,
    PlanEventV2,
    PracticeSessionAnswerV2,
    PracticeSessionV2,
    build_client,
    load_user,
    register,
    seed_answer,
    seed_exam_targets,
    seed_practice_session,
    seed_question,
    seed_review_item,
)


def test_home_m3_dashboard_progress_and_planning_contracts(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        user = load_user(app)
        seed_exam_targets(app, user_id=user.id)
        yanyu_question_id = seed_question(app, subject_kind="yanyu", item_no=1)
        panduan_question_id = seed_question(app, subject_kind="panduan", item_no=2)

        plan_response = client.post(
            "/api/v2/plans",
            json={
                "name": "Home active plan",
                "targetExamId": "guokao_2027",
                "targetExamDate": "2027-11-26",
                "dailyMinutesTarget": 180,
                "style": "balanced",
                "focusSubjects": ["yanyu", "panduan"],
            },
        )
        assert plan_response.status_code == 200, plan_response.text
        plan_id = plan_response.json()["id"]

        today_cn = (datetime.now(UTC) + timedelta(hours=8)).date()
        week_event_day = (
            today_cn + timedelta(days=1)
            if today_cn.weekday() < 6
            else today_cn - timedelta(days=1)
        )
        recurring_event = client.post(
            "/api/v2/plans/events",
            json={
                "planId": plan_id,
                "title": "Morning drills",
                "category": "xingce",
                "startAt": f"{today_cn.isoformat()}T01:00:00Z",
                "endAt": f"{today_cn.isoformat()}T02:00:00Z",
                "timezone": "Asia/Shanghai",
                "recurringRule": "FREQ=DAILY;COUNT=3",
            },
        )
        assert recurring_event.status_code == 200, recurring_event.text
        recurring_parent_id = recurring_event.json()["id"]
        week_event = client.post(
            "/api/v2/plans/events",
            json={
                "planId": plan_id,
                "title": "Essay block",
                "category": "essay",
                "startAt": f"{week_event_day.isoformat()}T03:00:00Z",
                "endAt": f"{week_event_day.isoformat()}T04:30:00Z",
                "timezone": "Asia/Shanghai",
            },
        )
        assert week_event.status_code == 200, week_event.text

        submitted_session_id = seed_practice_session(
            app,
            user_id=user.id,
            started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=50),
            status="submitted",
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=20),
        )
        seed_answer(
            app,
            session_id=submitted_session_id,
            question_id=yanyu_question_id,
            question_key=str(yanyu_question_id),
            display_order=1,
            answered_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=40),
            is_correct=True,
        )
        seed_answer(
            app,
            session_id=submitted_session_id,
            question_id=panduan_question_id,
            question_key=str(panduan_question_id),
            display_order=2,
            answered_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=35),
            is_correct=False,
        )
        seed_practice_session(
            app,
            user_id=user.id,
            started_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=10),
            status="in_progress",
        )
        seed_review_item(
            app,
            user_id=user.id,
            title="Review yanyu logic",
            updated_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(days=4),
        )

        today_response = client.get("/api/v2/dashboard/today")
        assert today_response.status_code == 200, today_response.text
        today_payload = today_response.json()
        assert today_payload["planId"] == plan_id
        assert today_payload["date"] == today_cn.isoformat()
        assert today_payload["practiceBlocks"][0]["sessionId"] == submitted_session_id
        assert any(item["id"] == f"{recurring_parent_id}:{today_cn.isoformat()}" for item in today_payload["events"])

        continue_response = client.get("/api/v2/dashboard/today/continue")
        assert continue_response.status_code == 200, continue_response.text
        assert continue_response.json()["hasActiveSession"] is True
        assert continue_response.json()["href"].startswith("/practice/sessions/")

        review_response = client.get("/api/v2/dashboard/today/review")
        assert review_response.status_code == 200, review_response.text
        assert review_response.json()["total"] == 1
        assert review_response.json()["items"][0]["title"] == "Review yanyu logic"

        weekly_response = client.get("/api/v2/dashboard/weekly-plan")
        assert weekly_response.status_code == 200, weekly_response.text
        assert weekly_response.json()["planId"] == plan_id
        assert weekly_response.json()["summary"]["totalEvents"] >= 2

        goal_response = client.get("/api/v2/dashboard/weekly-plan/goal")
        assert goal_response.status_code == 200, goal_response.text
        assert goal_response.json()["id"] == plan_id

        completion_response = client.get("/api/v2/dashboard/weekly-plan/today-completion")
        assert completion_response.status_code == 200, completion_response.text
        assert completion_response.json()["date"] == today_cn.isoformat()

        full_plan = client.get(
            "/api/v2/dashboard/full-plan",
            params={"view": "month", "anchorDate": today_cn.isoformat()},
        )
        assert full_plan.status_code == 200, full_plan.text
        full_payload = full_plan.json()
        assert full_payload["view"] == "month"
        assert full_payload["targets"][0]["examId"] == "guokao_2027"

        progress = client.get("/api/v2/dashboard/progress", params={"planId": plan_id})
        assert progress.status_code == 200, progress.text
        progress_payload = progress.json()
        assert progress_payload["summary"]["today"]["itemsAnswered"] == 2
        assert progress_payload["summary"]["today"]["accuracy"] == "0.50"
        assert progress_payload["nearestExamTarget"]["examId"] == "guokao_2027"
        assert {item["subjectKey"] for item in progress_payload["subjectAccuracies"]} >= {"yanyu", "panduan"}

        timeseries = client.get(
            "/api/v2/dashboard/progress/timeseries",
            params={"from": today_cn.isoformat(), "to": today_cn.isoformat(), "granularity": "day"},
        )
        assert timeseries.status_code == 200, timeseries.text
        assert timeseries.json()["points"][0]["itemsAnswered"] == 2
        invalid_timeseries = client.get(
            "/api/v2/dashboard/progress/timeseries",
            params={"from": today_cn.isoformat(), "to": today_cn.isoformat(), "granularity": "month"},
        )
        assert invalid_timeseries.status_code == 422, invalid_timeseries.text
        assert invalid_timeseries.json()["code"] == "invalid_timeseries_window"

        weakness = client.get("/api/v2/dashboard/progress/weakness")
        assert weakness.status_code == 200, weakness.text
        assert {item["subjectKey"] for item in weakness.json()["items"]} >= {"yanyu", "panduan"}

        diagnosis = client.get("/api/v2/dashboard/progress/diagnosis")
        assert diagnosis.status_code == 200, diagnosis.text
        assert set(diagnosis.json().keys()) == {"strengths", "weaknesses", "suggestions", "generatedAt"}


def test_home_m3_weekly_adjust_updates_plan_and_writes_audit(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        plan_response = client.post(
            "/api/v2/plans",
            json={
                "name": "Adjustable plan",
                "targetExamId": "guokao_2027",
                "targetExamDate": "2027-11-26",
                "dailyMinutesTarget": 180,
                "style": "balanced",
                "focusSubjects": ["yanyu"],
            },
        )
        assert plan_response.status_code == 200, plan_response.text
        plan_id = plan_response.json()["id"]

        adjust = client.put(
            "/api/v2/dashboard/weekly-plan/adjust",
            json={
                "dailyMinutesTarget": 210,
                "style": "aggressive",
                "focusSubjects": ["panduan", "yanyu"],
            },
        )
        assert adjust.status_code == 200, adjust.text
        assert adjust.json()["id"] == plan_id
        assert adjust.json()["dailyMinutesTarget"] == 210
        assert adjust.json()["style"] == "aggressive"
        assert adjust.json()["focusSubjects"] == ["panduan", "yanyu"]

        session = app.state.db.session_factory()
        try:
            audit_rows = list(
                session.scalars(
                    select(AuditLogV2).where(
                        AuditLogV2.action == "plan.update",
                        AuditLogV2.target_type == "plan_v2",
                        AuditLogV2.target_id == plan_id,
                    )
                )
            )
            assert audit_rows
        finally:
            session.close()


def test_home_m3_session_submit_refreshes_snapshots_and_progress_ignores_event_status(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register(client)
        user = load_user(app)
        question_id = seed_question(app, subject_kind="yanyu", item_no=1)

        plan_response = client.post(
            "/api/v2/plans",
            json={
                "name": "Invariant plan",
                "targetExamId": "guokao_2027",
                "targetExamDate": "2027-11-26",
                "dailyMinutesTarget": 120,
                "style": "balanced",
            },
        )
        assert plan_response.status_code == 200, plan_response.text
        plan_id = plan_response.json()["id"]

        session = app.state.db.session_factory()
        try:
            today = datetime.now(UTC).replace(tzinfo=None)
            event = PlanEventV2(
                plan_id=plan_id,
                user_id=user.id,
                title="Invariant event",
                category="xingce",
                notes="",
                start_at=today - timedelta(hours=2),
                end_at=today - timedelta(hours=1),
                timezone="Asia/Shanghai",
                recurring_rule=None,
                recurring_parent_id=None,
                recurring_exception_dates=[],
                status="done",
                source="user_manual",
                target_id=None,
                change_log=[],
            )
            practice_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="manual",
                status="in_progress",
                started_at=today - timedelta(minutes=35),
                payload_json={},
            )
            session.add_all([event, practice_session])
            session.flush()
            session.add(
                PracticeSessionAnswerV2(
                    session_id=practice_session.id,
                    question_id=question_id,
                    question_key=str(question_id),
                    display_order=1,
                    response_json={"selected": "A"},
                    is_correct=True,
                    answered_at=today - timedelta(minutes=30),
                )
            )
            session.commit()
            practice_session_id = practice_session.id
            event_id = event.id
        finally:
            session.close()

        submitted = client.post(f"/api/v2/practice/sessions/{practice_session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        before = client.get("/api/v2/dashboard/progress", params={"planId": plan_id})
        weakness_before = client.get("/api/v2/dashboard/progress/weakness")
        assert before.status_code == 200, before.text
        assert weakness_before.status_code == 200, weakness_before.text
        before_payload = before.json()
        weakness_before_payload = weakness_before.json()

        session = app.state.db.session_factory()
        try:
            event = session.get(PlanEventV2, event_id)
            assert event is not None
            event.status = "skipped"
            session.add(event)
            session.commit()
        finally:
            session.close()

        after = client.get("/api/v2/dashboard/progress", params={"planId": plan_id})
        weakness_after = client.get("/api/v2/dashboard/progress/weakness")
        assert after.status_code == 200, after.text
        assert weakness_after.status_code == 200, weakness_after.text
        after_payload = after.json()
        weakness_after_payload = weakness_after.json()

        assert before_payload["summary"]["today"] == after_payload["summary"]["today"]
        assert weakness_before_payload == weakness_after_payload
        assert before_payload["summary"]["planSlice"]["eventsDone"] == 1
        assert after_payload["summary"]["planSlice"]["eventsDone"] == 0
        assert after_payload["summary"]["planSlice"]["eventsSkipped"] == 1
