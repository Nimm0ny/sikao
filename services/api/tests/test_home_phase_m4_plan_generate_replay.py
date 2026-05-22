from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import IdempotencyKeyV2, LlmCallV2, PlanEventV2, PlanV2, UserV2
from sikao_api.modules.llm.application.plan_generator import build_plan_generate_request_payload, PlanGenerateParams
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.plans.application.helpers import now_utc

from _home_phase_m4_support import build_client, parse_sse_frames, register_user


def test_plan_auto_generate_and_replay(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        payload = {
            "name": "AI Plan",
            "targetExamId": "guokao-2027",
            "targetExamDate": "2027-11-26",
            "dailyMinutesTarget": 180,
            "style": "balanced",
            "focusSubjects": ["xingce"],
            "baseline": {},
            "userNotes": "focus verbal first",
        }
        response = client.post(
            "/api/v2/plans/auto-generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174100"},
            json=payload,
        )
        assert response.status_code == 200, response.text
        frames = parse_sse_frames(response.text)
        done = next(frame for frame in frames if frame["type"] == "done")
        assert any(frame["type"] == "event" for frame in frames)
        assert done["event_count"] == 2

        replay = client.post(
            "/api/v2/plans/auto-generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174100"},
            json=payload,
        )
        replay_frames = parse_sse_frames(replay.text)
        replay_done = next(frame for frame in replay_frames if frame["type"] == "done")
        assert replay_done["plan"]["id"] == done["plan"]["id"]

        session = app.state.db.session_factory()
        try:
            plan = session.scalar(select(PlanV2).where(PlanV2.name == "AI Plan"))
            assert plan is not None
            events = list(session.scalars(select(PlanEventV2).where(PlanEventV2.plan_id == plan.id)))
            calls = list(session.scalars(select(LlmCallV2).where(LlmCallV2.purpose == "plan_generate")))
            assert len(events) == 2
            assert len(calls) == 1
        finally:
            session.close()


def test_plan_auto_generate_rejects_in_progress_idempotency_claim(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            payload = {
                "name": "AI Plan",
                "targetExamId": "guokao-2027",
                "targetExamDate": "2027-11-26",
                "dailyMinutesTarget": 180,
                "style": "balanced",
                "focusSubjects": ["xingce"],
                "baseline": {},
                "userNotes": "focus verbal first",
            }
            params = PlanGenerateParams(
                name=payload["name"],
                target_exam_id=payload["targetExamId"],
                target_exam_date=datetime(2027, 11, 26).date(),
                daily_minutes_target=payload["dailyMinutesTarget"],
                style=payload["style"],
                focus_subjects=list(payload["focusSubjects"]),
                baseline=dict(payload["baseline"]),
                user_notes=payload["userNotes"],
            )
            session.add(
                IdempotencyKeyV2(
                    key="123e4567-e89b-12d3-a456-426614174106",
                    user_id=user.id,
                    endpoint="POST /api/v2/plans/auto-generate",
                    request_hash=HomeLlmService(session, app.state.settings).build_idempotent_request_hash(
                        payload=build_plan_generate_request_payload(params=params)
                    ),
                    response_status=202,
                    response_body={"status": "in_progress"},
                    created_at=now_utc(),
                    expires_at=now_utc(),
                )
            )
            session.commit()
        finally:
            session.close()

        response = client.post(
            "/api/v2/plans/auto-generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174106"},
            json=payload,
        )
        frames = parse_sse_frames(response.text)
        error = next(frame for frame in frames if frame["type"] == "error")
        assert error["code"] == "idempotency_request_in_progress"
