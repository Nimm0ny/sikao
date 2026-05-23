from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from sikao_api.modules.llm.application import cache as llm_cache
from sikao_api.db.models_v2 import IdempotencyKeyV2, LlmCallV2, RecommendationV2, UserV2
from sikao_api.modules.llm.application.llm.provider import ChatCompletionResult, LLMMessage
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.plans.application.helpers import now_utc

from _home_phase_m4_support import build_client, register_user, seed_active_plan


def _has_cached_prefix(prefix: str) -> bool:
    with llm_cache._lock:
        return any(any(key.startswith(prefix) for key in cache.keys()) for cache in llm_cache._caches.values())


def test_recommendation_refresh_uses_home_llm_and_invalidates_cache(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            session.add(seed_active_plan(user=user, name="Rec plan"))
            session.add(
                RecommendationV2(
                    user_id=user.id,
                    title="Old pending row",
                    reason="to be expired",
                    estimated_minutes=10,
                    cta="Ignore",
                    action_type="rest",
                    payload={"rest_minutes": 10},
                    expires_at=user.created_at,
                    source_signals={},
                )
            )
            session.commit()
        finally:
            session.close()

        first = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174101"},
        )
        assert first.status_code == 200, first.text

        second = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174102"},
        )
        assert second.status_code == 200, second.text
        second_body = second.json()
        assert any(item["actionType"] in {"review", "continue"} for item in second_body["items"])

        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            cache_prefix = f"recommend_today:{user.id}:"
            assert _has_cached_prefix(cache_prefix)
        finally:
            session.close()

        actionable = next(item for item in second_body["items"] if item["actionType"] in {"review", "continue"})
        assert client.post(
            f"/api/v2/recommendations/{actionable['id']}/accept",
            json={"action": "session"},
        ).status_code == 200
        rejected_item = next(item for item in second_body["items"] if item["id"] != actionable["id"])
        assert client.post(
            f"/api/v2/recommendations/{rejected_item['id']}/reject",
            json={"reason": "already_done", "note": "covered elsewhere"},
        ).status_code == 200
        assert not _has_cached_prefix(cache_prefix)
        assert client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174103"},
        ).status_code == 200

        session = app.state.db.session_factory()
        try:
            calls = list(session.scalars(select(LlmCallV2).where(LlmCallV2.purpose == "recommend_today")))
            assert len(calls) >= 3
        finally:
            session.close()


def test_recommendation_refresh_parse_failure_keeps_pending_rows(tmp_path: Path, monkeypatch) -> None:
    class InvalidRecommendationProvider:
        async def chat_completion(
            self,
            *,
            messages: list[LLMMessage],
            model: str,
            max_tokens=None,
            temperature: float = 0.7,
            response_format=None,
        ) -> ChatCompletionResult:
            del max_tokens, messages, model, response_format, temperature
            return ChatCompletionResult(
                content='{"recommendations": [{"title": "broken"}]}',
                prompt_tokens=8,
                prompt_cache_hit_tokens=0,
                prompt_cache_miss_tokens=8,
                completion_tokens=12,
                model="broken-model",
                finish_reason="stop",
            )

        async def chat_completion_stream(self, **kwargs):
            raise NotImplementedError

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.call_execution.build_llm_provider",
        lambda settings, **kwargs: (InvalidRecommendationProvider(), "system"),
    )

    with build_client(tmp_path) as (client, app):
        register_user(client)
        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            session.add(seed_active_plan(user=user, name="Rec plan"))
            session.add(
                RecommendationV2(
                    user_id=user.id,
                    title="Keep me pending",
                    reason="should survive parse failure",
                    estimated_minutes=15,
                    cta="Later",
                    action_type="rest",
                    payload={"rest_minutes": 15},
                    expires_at=now_utc(),
                    source_signals={},
                )
            )
            session.commit()
            pending_id = session.scalar(select(RecommendationV2.id).where(RecommendationV2.title == "Keep me pending"))
        finally:
            session.close()

        response = client.post(
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174104"},
        )
        assert response.status_code == 502, response.text
        assert response.json()["code"] == "llm_parse_failed"

        session = app.state.db.session_factory()
        try:
            row = session.get(RecommendationV2, pending_id)
            assert row is not None
            assert row.status == "pending"
        finally:
            session.close()


def test_recommendation_refresh_rejects_in_progress_idempotency_claim(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        register_user(client)
        session = app.state.db.session_factory()
        try:
            user = session.scalar(select(UserV2).where(UserV2.display_name == "Alice"))
            assert user is not None
            session.add(seed_active_plan(user=user, name="Rec plan"))
            session.flush()
            session.add(
                IdempotencyKeyV2(
                    key="123e4567-e89b-12d3-a456-426614174105",
                    user_id=user.id,
                    endpoint="POST /api/v2/recommendations/refresh",
                    request_hash=HomeLlmService(session, app.state.settings).build_idempotent_request_hash(payload={}),
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
            "/api/v2/recommendations/refresh",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174105"},
        )
        assert response.status_code == 409, response.text
        assert response.json()["code"] == "idempotency_request_in_progress"
