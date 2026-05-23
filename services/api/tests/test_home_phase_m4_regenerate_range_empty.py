from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import PlanEventV2, UserV2
from sikao_api.modules.llm.application.llm.provider import ChatCompletionChunk, ChatCompletionResult, LLMMessage

from _home_phase_m4_support import build_client, parse_sse_frames, register_user, seed_active_plan, seed_plan_event


def test_regenerate_range_empty_output_does_not_delete_existing_events(tmp_path: Path, monkeypatch) -> None:
    class EmptyPlanProvider:
        async def chat_completion(
            self,
            *,
            messages: list[LLMMessage],
            model: str,
            max_tokens=None,
            temperature=0.7,
            response_format=None,
        ) -> ChatCompletionResult:
            del max_tokens, messages, model, response_format, temperature
            raise NotImplementedError

        async def chat_completion_stream(
            self,
            *,
            messages: list[LLMMessage],
            model: str,
            max_tokens=None,
            temperature=0.7,
            response_format=None,
        ):
            del max_tokens, messages, model, response_format, temperature
            yield ChatCompletionChunk("", False, None, None, None, None, None)
            yield ChatCompletionChunk('{"events": [], "summary": {}, "errors": []}', True, 12, 0, 12, 8, "stop")

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.call_execution.build_llm_provider",
        lambda settings, **kwargs: (EmptyPlanProvider(), "system"),
    )

    with build_client(tmp_path) as (client, app):
        register_user(client)
        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            plan = seed_active_plan(user=user, name="Window plan")
            session.add(plan)
            session.flush()
            event = seed_plan_event(user=user, plan_id=plan.id)
            session.add(event)
            session.commit()
            event_id = event.id
        finally:
            session.close()

        response = client.post(
            "/api/v2/plans/events/regenerate-range",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174200"},
            json={"planId": plan.id, "from": "2027-11-20", "to": "2027-11-20", "userNotes": "none"},
        )
        assert any(frame["type"] == "error" for frame in parse_sse_frames(response.text))

        session = app.state.db.session_factory()
        try:
            surviving = session.get(PlanEventV2, event_id)
            assert surviving is not None
            assert surviving.deleted_at is None
        finally:
            session.close()
