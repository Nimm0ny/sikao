from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from sikao_api.db.models_v2 import AuditLogV2, RecommendationV2
from sikao_api.modules.system.application.home_runtime import HomeRuntimeOrchestrator

from _home_phase_m5_support import (
    build_client,
    load_user,
    register_user,
    seed_active_plan,
    seed_answer,
    seed_practice_session,
    seed_recommendation,
)


def test_submit_route_enqueues_recommender_refresh_and_creates_rows(tmp_path) -> None:
    with build_client(tmp_path, home_scheduler_enabled=True) as (client, app):
        register_user(client)
        user = load_user(app)
        seed_active_plan(app, user_id=user.id)
        started_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=35)
        session_id = seed_practice_session(
            app,
            user_id=user.id,
            started_at=started_at,
            submitted_at=None,
            status="draft",
        )
        seed_answer(
            app,
            session_id=session_id,
            question_key="rec-1",
            answered_at=started_at + timedelta(minutes=12),
            is_correct=False,
        )

        response = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert response.status_code == 200, response.text

        deadline = time.time() + 3.0
        while time.time() < deadline:
            session = app.state.db.session_factory()
            try:
                recommendations = list(
                    session.scalars(select(RecommendationV2).where(RecommendationV2.user_id == user.id))
                )
            finally:
                session.close()
            if recommendations:
                break
            time.sleep(0.1)

    assert recommendations, "submit hook should asynchronously refresh recommendations"


def test_submit_recommender_refresh_debounces_recent_generation(tmp_path) -> None:
    with build_client(tmp_path, home_scheduler_enabled=False) as (client, app):
        register_user(client)
        user = load_user(app)
        seed_active_plan(app, user_id=user.id)
        now = datetime.now(UTC).replace(tzinfo=None)
        seed_recommendation(
            app,
            user_id=user.id,
            generated_at=now - timedelta(minutes=1),
            expires_at=now + timedelta(hours=1),
        )

        runtime = HomeRuntimeOrchestrator(app.state.db, app.state.settings)
        created = asyncio.run(
            runtime.run_submit_recommender_refresh(
                user_id=user.id,
                session_id=999,
                request_id="req-submit",
            )
        )

        session = app.state.db.session_factory()
        try:
            recommendations = list(
                session.scalars(select(RecommendationV2).where(RecommendationV2.user_id == user.id))
            )
            audits = list(
                session.scalars(
                    select(AuditLogV2).where(
                        AuditLogV2.user_id == user.id,
                        AuditLogV2.action == "recommendation.refresh_debounced",
                    )
                )
            )
        finally:
            session.close()

    assert created is False
    assert len(recommendations) == 1
    assert len(audits) == 1
