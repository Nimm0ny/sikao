from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import UserV2

from _home_phase_m4_support import build_client, parse_sse_frames, register_user, seed_active_plan, seed_plan_event


def test_regenerate_range_success_replays_by_same_http_body(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            plan = seed_active_plan(user=user, name="Replay plan")
            session.add(plan)
            session.flush()
            session.add(seed_plan_event(user=user, plan_id=plan.id))
            session.commit()
            plan_id = plan.id
        finally:
            session.close()

        payload = {"planId": plan_id, "from": "2027-11-20", "to": "2027-11-21", "userNotes": "refresh the window"}
        first = client.post(
            "/api/v2/plans/events/regenerate-range",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174202"},
            json=payload,
        )
        first_done = next(frame for frame in parse_sse_frames(first.text) if frame["type"] == "done")

        replay = client.post(
            "/api/v2/plans/events/regenerate-range",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174202"},
            json=payload,
        )
        replay_done = next(frame for frame in parse_sse_frames(replay.text) if frame["type"] == "done")
        assert replay_done["event_count"] == first_done["event_count"]
        assert replay_done["llm_call_id"] == first_done["llm_call_id"]


def test_regenerate_range_same_key_with_different_tail_notes_is_rejected(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        app.state.settings.llm_max_input_tokens = 10
        register_user(client)
        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            plan = seed_active_plan(user=user, name="Hash plan")
            session.add(plan)
            session.flush()
            session.add(seed_plan_event(user=user, plan_id=plan.id))
            session.commit()
            plan_id = plan.id
        finally:
            session.close()

        key = "123e4567-e89b-12d3-a456-426614174203"
        first = client.post(
            "/api/v2/plans/events/regenerate-range",
            headers={"Idempotency-Key": key},
            json={"planId": plan_id, "from": "2027-11-20", "to": "2027-11-21", "userNotes": "abcdefghij-tail-a"},
        )
        assert first.status_code == 200, first.text

        second = client.post(
            "/api/v2/plans/events/regenerate-range",
            headers={"Idempotency-Key": key},
            json={"planId": plan_id, "from": "2027-11-20", "to": "2027-11-21", "userNotes": "abcdefghij-tail-b"},
        )
        error = next(frame for frame in parse_sse_frames(second.text) if frame["type"] == "error")
        assert error["code"] == "idempotency_key_reused"
