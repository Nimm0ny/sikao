from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import AuditLogV2, PlanEventV2, PlanV2, PracticeSessionV2, RecommendationFeedbackV2, RecommendationV2, UserV2
from sikao_api.main import create_app


@contextmanager
def build_client(tmp_path: Path) -> Iterator[tuple[TestClient, FastAPI]]:
    settings = Settings(
        app_env="test",
        llm_provider="mock",
        database_url=f"sqlite:///{(tmp_path / 'home-m2-recommendations.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m2-rec-secret",
        app_version="home-m2-test",
        git_sha="home-m2-sha",
        image_tag="home-m2-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="home-m2-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _register(client: TestClient) -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={"email": "alice@example.com", "password": "secret123", "displayName": "Alice"},
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.cookies["csrf_token_v2"]


def _seed_active_plan(app: FastAPI) -> UserV2:
    session = app.state.db.session_factory()
    try:
        user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
        assert user is not None
        session.add(
            PlanV2(
                user_id=user.id,
                name="Rec plan",
                target_exam_id="guokao-2027",
                target_exam_date=datetime(2027, 11, 26).date(),
                daily_minutes_target=180,
                style="balanced",
                baseline={},
                focus_subjects=["xingce"],
                status="active",
                source="user_manual",
                change_log=[],
            )
        )
        session.commit()
        session.expunge(user)
        return user
    finally:
        session.close()


def test_refresh_replay_accept_and_reject(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register(client)
        user = _seed_active_plan(app)
        future_expiry = datetime.utcnow() + timedelta(days=1)

        missing_key = client.post("/api/v2/recommendations/refresh")
        assert missing_key.status_code == 422
        assert missing_key.json()["code"] == "idempotency_key_required"

        invalid_key = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "a-b-c-d-e"},
        )
        assert invalid_key.status_code == 422
        assert invalid_key.json()["code"] == "idempotency_key_invalid"

        refresh = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174000"},
        )
        assert refresh.status_code == 200, refresh.text
        assert refresh.json()["total"] >= 1

        replay = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174000"},
        )
        assert replay.status_code == 200, replay.text
        assert replay.json() == refresh.json()

        session = app.state.db.session_factory()
        try:
            existing_session = PracticeSessionV2(
                user_id=user.id,
                track="xingce",
                entry_kind="manual",
                status="in_progress",
                payload_json={},
            )
            session.add(existing_session)
            session.commit()
            existing_session_id = existing_session.id
        finally:
            session.close()

        refresh_continue = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174001"},
        )
        assert refresh_continue.status_code == 200, refresh_continue.text
        continue_item = next(item for item in refresh_continue.json()["items"] if item["actionType"] == "continue")
        continue_accept = client.post(
            f"/api/v2/recommendations/{continue_item['id']}/accept",
            json={"action": "session"},
        )
        assert continue_accept.status_code == 200, continue_accept.text
        assert continue_accept.json()["sessionId"] == existing_session_id

        session = app.state.db.session_factory()
        try:
            session.add(
                RecommendationV2(
                    user_id=user.id,
                    title="Continue practice",
                    reason="Unfinished work exists",
                    estimated_minutes=25,
                    cta="Continue",
                    action_type="continue",
                    payload={"session_template": {"track": "xingce", "entry_kind": "manual"}},
                    expires_at=future_expiry,
                    source_signals={"in_progress_session_id": existing_session_id},
                )
            )
            session.add(
                RecommendationV2(
                    user_id=user.id,
                    title="Add review block",
                    reason="Schedule review",
                    estimated_minutes=30,
                    cta="Plan it",
                    action_type="review",
                    payload={},
                    expires_at=future_expiry,
                    source_signals={},
                )
            )
            session.add(
                RecommendationV2(
                    user_id=user.id,
                    title="Skip for now",
                    reason="User rejected",
                    estimated_minutes=15,
                    cta="Skip",
                    action_type="rest",
                    payload={"rest_minutes": 15},
                    expires_at=future_expiry,
                    source_signals={},
                )
            )
            session.commit()
            continue_id = session.scalar(select(RecommendationV2.id).where(RecommendationV2.title == "Continue practice"))
            plan_id = session.scalar(select(RecommendationV2.id).where(RecommendationV2.title == "Add review block"))
            reject_id = session.scalar(select(RecommendationV2.id).where(RecommendationV2.title == "Skip for now"))
        finally:
            session.close()

        accept_session = client.post(
            f"/api/v2/recommendations/{continue_id}/accept",
            json={"action": "session"},
        )
        assert accept_session.status_code == 200, accept_session.text
        assert accept_session.json()["sessionId"] is not None

        accept_plan = client.post(
            f"/api/v2/recommendations/{plan_id}/accept",
            json={"action": "plan", "targetDate": "2026-06-16"},
        )
        assert accept_plan.status_code == 200, accept_plan.text
        assert accept_plan.json()["eventId"] is not None

        reject = client.post(
            f"/api/v2/recommendations/{reject_id}/reject",
            json={"reason": "already_done", "note": "covered elsewhere"},
        )
        assert reject.status_code == 200, reject.text

        history = client.get("/api/v2/recommendations/history")
        assert history.status_code == 200, history.text
        history_ids = {item["id"] for item in history.json()["items"]}
        assert plan_id in history_ids
        assert reject_id in history_ids

        session = app.state.db.session_factory()
        try:
            linked_session = session.scalar(
                select(PracticeSessionV2).where(PracticeSessionV2.linked_recommendation_id == continue_id)
            )
            resumed_session = session.get(PracticeSessionV2, existing_session_id)
            planned_event = session.scalar(select(PlanEventV2).where(PlanEventV2.id == accept_plan.json()["eventId"]))
            feedback = session.scalar(
                select(RecommendationFeedbackV2).where(RecommendationFeedbackV2.recommendation_id == reject_id)
            )
            audit_actions = {
                row.action
                for row in session.scalars(
                    select(AuditLogV2).where(AuditLogV2.target_type == "plan_event_v2")
                )
            }
            assert linked_session is not None
            assert linked_session.linked_plan_event_id is None
            assert linked_session.linked_plan_event_occurrence_ref is None
            assert resumed_session is not None and resumed_session.linked_recommendation_id == continue_id
            assert planned_event is not None and planned_event.source == "ai_generated"
            assert planned_event.change_log
            assert feedback is not None and feedback.reason == "already_done"
            assert feedback.feedback_type == "recommendation_reject"
            assert feedback.analysis_id is None
            assert feedback.rating is None
            assert feedback.metadata_json == {}
            assert "plan_event.create_from_recommendation" in audit_actions
        finally:
            session.close()
