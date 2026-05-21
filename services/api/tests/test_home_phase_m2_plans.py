from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import PlanAdjustmentV2, PlanEventV2, PlanV2, PracticeSessionV2, UserV2
from sikao_api.main import create_app


@contextmanager
def build_client(tmp_path: Path) -> Iterator[tuple[TestClient, FastAPI]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'home-m2-plans.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m2-plans-secret",
        app_version="home-m2-test",
        git_sha="home-m2-sha",
        image_tag="home-m2-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="home-m2-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _register(client: TestClient, *, email: str = "alice@example.com") -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": email,
            "password": "secret123",
            "displayName": "Alice",
        },
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.cookies["csrf_token_v2"]


def _load_user(app: FastAPI) -> UserV2:
    session = app.state.db.session_factory()
    try:
        user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
        assert user is not None
        session.expunge(user)
        return user
    finally:
        session.close()


def test_plan_crud_and_activation_flow(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register(client)

        create = client.post(
            "/api/v2/plans",
            json={
                "name": "Primary plan",
                "targetExamId": "guokao-2027",
                "targetExamDate": "2027-11-26",
                "dailyMinutesTarget": 180,
                "style": "balanced",
                "focusSubjects": ["xingce", "essay"],
            },
        )
        assert create.status_code == 200, create.text
        plan_id = create.json()["id"]
        assert create.json()["status"] == "active"

        listed = client.get("/api/v2/plans")
        assert listed.status_code == 200
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["id"] == plan_id

        updated = client.put(
            f"/api/v2/plans/{plan_id}",
            json={"dailyMinutesTarget": 210, "style": "aggressive"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["dailyMinutesTarget"] == 210
        assert updated.json()["style"] == "aggressive"

        paused = client.post(f"/api/v2/plans/{plan_id}/pause")
        assert paused.status_code == 200
        assert paused.json()["status"] == "paused"

        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            second = PlanV2(
                user_id=user.id,
                name="Secondary plan",
                target_exam_id="guokao-2028",
                target_exam_date=datetime(2028, 1, 20).date(),
                daily_minutes_target=120,
                style="steady",
                baseline={},
                focus_subjects=["xingce"],
                status="paused",
                source="user_manual",
                change_log=[],
            )
            session.add(second)
            session.commit()
            second_id = second.id
        finally:
            session.close()

        activated = client.post(f"/api/v2/plans/{second_id}/activate")
        assert activated.status_code == 200, activated.text
        assert activated.json()["status"] == "active"

        archived = client.post(f"/api/v2/plans/{second_id}/archive")
        assert archived.status_code == 200
        assert archived.json()["status"] == "archived"

        deleted = client.delete(f"/api/v2/plans/{second_id}")
        assert deleted.status_code == 200
        assert deleted.json() == {"ok": True, "status": "deleted"}

        missing = client.get(f"/api/v2/plans/{second_id}")
        assert missing.status_code == 404
        assert missing.json()["code"] == "plan_not_found"


def test_events_recurring_scope_practice_blocks_conflicts_and_adjustments(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register(client)
        user = _load_user(app)

        plan_response = client.post(
            "/api/v2/plans",
            json={
                "name": "Calendar plan",
                "targetExamId": "guokao-2027",
                "targetExamDate": "2027-11-26",
                "dailyMinutesTarget": 180,
                "style": "balanced",
            },
        )
        assert plan_response.status_code == 200, plan_response.text
        plan_id = plan_response.json()["id"]

        create_event = client.post(
            "/api/v2/plans/events",
            json={
                "planId": plan_id,
                "title": "Morning drills",
                "category": "xingce",
                "startAt": "2026-06-15T01:00:00Z",
                "endAt": "2026-06-15T02:00:00Z",
                "timezone": "Asia/Shanghai",
                "recurringRule": "FREQ=DAILY;COUNT=3",
            },
        )
        assert create_event.status_code == 200, create_event.text
        parent_id = create_event.json()["id"]

        listed = client.get("/api/v2/plans/events", params={"from": "2026-06-15", "to": "2026-06-17"})
        assert listed.status_code == 200, listed.text
        event_ids = [item["id"] for item in listed.json()["data"]["events"]]
        assert event_ids == [f"{parent_id}:2026-06-15", f"{parent_id}:2026-06-16", f"{parent_id}:2026-06-17"]

        scoped_this = client.patch(
            f"/api/v2/plans/events/{parent_id}:2026-06-16",
            params={"scope": "this"},
            json={"title": "Detached review block", "category": "review"},
        )
        assert scoped_this.status_code == 200, scoped_this.text
        assert scoped_this.json()["isRecurringInstance"] is False
        detached_id = scoped_this.json()["id"]

        listed_after_this = client.get("/api/v2/plans/events", params={"from": "2026-06-15", "to": "2026-06-17"})
        assert listed_after_this.status_code == 200
        titles = {item["id"]: item["title"] for item in listed_after_this.json()["data"]["events"]}
        assert titles[f"{parent_id}:2026-06-15"] == "Morning drills"
        assert titles[detached_id] == "Detached review block"
        assert f"{parent_id}:2026-06-16" not in titles

        scoped_future = client.patch(
            f"/api/v2/plans/events/{parent_id}:2026-06-17",
            params={"scope": "future"},
            json={"title": "Future evening block", "category": "essay"},
        )
        assert scoped_future.status_code == 200, scoped_future.text
        future_id = scoped_future.json()["id"]
        assert scoped_future.json()["recurringParentId"] is None

        rebased_future = client.patch(
            f"/api/v2/plans/events/{future_id}:2026-06-18",
            params={"scope": "all"},
            json={"title": "Rebased future block"},
        )
        assert rebased_future.status_code == 200, rebased_future.text
        assert rebased_future.json()["title"] == "Rebased future block"

        session_link = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "manual",
                "payload": {},
                "linkedPlanEventId": int(parent_id),
                "linkedPlanEventOccurrenceRef": f"{parent_id}:2026-06-15",
            },
        )
        assert session_link.status_code == 200, session_link.text

        invalid_session_link = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "manual",
                "payload": {},
                "linkedPlanEventId": int(parent_id),
                "linkedPlanEventOccurrenceRef": f"{parent_id}:2026-06-30",
            },
        )
        assert invalid_session_link.status_code == 422
        assert invalid_session_link.json()["code"] == "practice_session_occurrence_ref_invalid"

        session = app.state.db.session_factory()
        try:
            session.add(
                PracticeSessionV2(
                    user_id=user.id,
                    track="xingce",
                    entry_kind="manual",
                    status="submitted",
                    started_at=datetime(2026, 6, 15, 2, 30),
                    submitted_at=datetime(2026, 6, 15, 2, 55),
                    payload_json={"subject": "yanyu"},
                )
            )
            adjustment = PlanAdjustmentV2(
                plan_id=plan_id,
                user_id=user.id,
                expires_at=datetime(2026, 6, 16, 0, 0),
                reason="Need a later block.",
                changes=[
                    {
                        "event_id": int(future_id),
                        "action": "edit",
                        "before": {},
                        "after": {
                            "title": "Adjusted future block",
                            "category": "essay",
                        },
                    }
                ],
                source="login_check",
            )
            adjustment_reject = PlanAdjustmentV2(
                plan_id=plan_id,
                user_id=user.id,
                expires_at=datetime(2026, 6, 16, 0, 0),
                reason="Skip this one.",
                changes=[],
                source="cron_daily",
            )
            session.add_all([adjustment, adjustment_reject])
            session.commit()
            adjustment_id = adjustment.id
            adjustment_reject_id = adjustment_reject.id
        finally:
            session.close()

        with_blocks = client.get(
            "/api/v2/plans/events",
            params={"from": "2026-06-15", "to": "2026-06-17", "include_practice_blocks": True},
        )
        assert with_blocks.status_code == 200
        assert len(with_blocks.json()["data"]["practiceBlocks"]) == 1
        assert with_blocks.json()["data"]["practiceBlocks"][0]["sessionId"] > 0
        event_by_id = {item["id"]: item for item in with_blocks.json()["data"]["events"]}
        assert event_by_id[f"{parent_id}:2026-06-15"]["linkedSessionId"] == session_link.json()["id"]

        conflicts = client.post(
            "/api/v2/plans/events/conflicts",
            json={
                "events": [
                    {
                        "title": "Overlap probe",
                        "category": "xingce",
                        "startAt": "2026-06-15T01:30:00Z",
                        "endAt": "2026-06-15T02:10:00Z",
                    }
                ],
                "existingWindow": {"from": "2026-06-15", "to": "2026-06-15"},
            },
        )
        assert conflicts.status_code == 200, conflicts.text
        kinds = {item["kind"] for item in conflicts.json()["conflicts"]}
        assert "event" in kinds

        invalid_bulk_delete = client.post(
            "/api/v2/plans/events/bulk-delete",
            json={"planId": plan_id, "from": "2026-06-15"},
        )
        assert invalid_bulk_delete.status_code == 422
        assert invalid_bulk_delete.json()["code"] == "invalid_event_window"

        dry_run = client.post(
            "/api/v2/plans/events/bulk-delete",
            json={"planId": plan_id, "from": "2026-06-15", "to": "2026-06-17", "dryRun": True},
        )
        assert dry_run.status_code == 200, dry_run.text
        assert dry_run.json()["status"] == "dry_run"
        assert dry_run.json()["matchedIds"]

        accept = client.post(f"/api/v2/plans/adjustments/{adjustment_id}/accept")
        assert accept.status_code == 200, accept.text
        reject = client.post(
            f"/api/v2/plans/adjustments/{adjustment_reject_id}/reject",
            json={"reason": "Not now"},
        )
        assert reject.status_code == 200, reject.text

        session = app.state.db.session_factory()
        try:
            accepted_adjustment = session.get(PlanAdjustmentV2, adjustment_id)
            rejected_adjustment = session.get(PlanAdjustmentV2, adjustment_reject_id)
            old_parent = session.get(PlanEventV2, int(parent_id))
            future_event = session.get(PlanEventV2, int(future_id))
            linked_session = session.get(PracticeSessionV2, session_link.json()["id"])
            assert accepted_adjustment is not None and accepted_adjustment.status == "accepted"
            assert rejected_adjustment is not None and rejected_adjustment.status == "rejected"
            assert old_parent is not None and old_parent.title == "Morning drills"
            assert future_event is not None and future_event.title == "Adjusted future block"
            assert linked_session is not None
            assert linked_session.linked_plan_event_id == int(parent_id)
            assert linked_session.linked_plan_event_occurrence_ref == f"{parent_id}:2026-06-15"
        finally:
            session.close()
