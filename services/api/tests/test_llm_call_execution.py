from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from sikao_api.modules.llm.application.call_execution import call_json_completion, collect_stream_text
from sikao_api.modules.llm.application.llm.provider import ChatCompletionChunk, ChatCompletionResult, LLMMessage


class _StubProvider:
    async def chat_completion(self, **kwargs: Any) -> ChatCompletionResult:  # type: ignore[override]
        return ChatCompletionResult(
            content="{}",
            prompt_tokens=1,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=1,
            completion_tokens=1,
            model=str(kwargs["model"]),
            finish_reason="stop",
        )

    async def chat_completion_stream(self, **kwargs: Any):  # type: ignore[override]
        yield ChatCompletionChunk(
            content_delta="hello",
            is_final=True,
            prompt_tokens=1,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=1,
            completion_tokens=1,
            finish_reason="stop",
        )


@pytest.mark.asyncio
async def test_call_json_completion_uses_general_llm_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def _fake_build(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        captured["timeout"] = timeout_seconds_override
        return _StubProvider(), "system"

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.call_execution.build_llm_provider",
        _fake_build,
    )
    service = SimpleNamespace(
        settings=SimpleNamespace(
            llm_timeout_seconds=120,
            llm_timeout_study_plan_seconds=10,
            llm_max_tokens=4000,
            llm_temperature=0.7,
            llm_provider="custom",
            llm_api_key="real-key",
            app_env="test",
        ),
        session=object(),
    )
    await call_json_completion(
        service,
        user_id=1,
        purpose="review_cause_analysis",
        prompt_version="cause_analysis_single@v1",
        model="deepseek-v4-flash",
        messages=[LLMMessage(role="user", content="hi")],
    )
    assert captured["timeout"] == 120.0


@pytest.mark.asyncio
async def test_call_json_completion_keeps_study_plan_timeout_for_plan_purposes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def _fake_build(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        captured["timeout"] = timeout_seconds_override
        return _StubProvider(), "system"

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.call_execution.build_llm_provider",
        _fake_build,
    )
    service = SimpleNamespace(
        settings=SimpleNamespace(
            llm_timeout_seconds=120,
            llm_timeout_study_plan_seconds=10,
            llm_max_tokens=4000,
            llm_temperature=0.7,
            llm_provider="custom",
            llm_api_key="real-key",
            app_env="test",
        ),
        session=object(),
    )
    await call_json_completion(
        service,
        user_id=1,
        purpose="plan_generate",
        prompt_version="plan_generate@v1",
        model="deepseek-v4-flash",
        messages=[LLMMessage(role="user", content="hi")],
    )
    assert captured["timeout"] == 10.0


@pytest.mark.asyncio
async def test_collect_stream_text_uses_general_llm_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def _fake_build(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        captured["timeout"] = timeout_seconds_override
        return _StubProvider(), "system"

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.call_execution.build_llm_provider",
        _fake_build,
    )
    service = SimpleNamespace(
        settings=SimpleNamespace(
            llm_timeout_seconds=120,
            llm_timeout_study_plan_seconds=10,
            llm_max_tokens=4000,
            llm_temperature=0.7,
            llm_provider="custom",
            llm_api_key="real-key",
            app_env="test",
        ),
        session=object(),
    )
    await collect_stream_text(
        service,
        user_id=1,
        purpose="review_cause_analysis",
        prompt_version="cause_analysis_single@v1",
        model="deepseek-v4-flash",
        messages=[LLMMessage(role="user", content="hi")],
    )
    assert captured["timeout"] == 120.0


@pytest.mark.asyncio
async def test_call_json_completion_uses_general_timeout_for_deep_review(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def _fake_build(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        captured["timeout"] = timeout_seconds_override
        return _StubProvider(), "system"

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.call_execution.build_llm_provider",
        _fake_build,
    )
    service = SimpleNamespace(
        settings=SimpleNamespace(
            llm_timeout_seconds=120,
            llm_timeout_study_plan_seconds=10,
            llm_max_tokens=4000,
            llm_temperature=0.7,
            llm_provider="custom",
            llm_api_key="real-key",
            app_env="test",
        ),
        session=object(),
    )
    await call_json_completion(
        service,
        user_id=1,
        purpose="review_cause_analysis_deep",
        prompt_version="cause_analysis_deep@v1",
        model="deepseek-v4-flash",
        messages=[LLMMessage(role="user", content="hi")],
    )
    assert captured["timeout"] == 120.0


@pytest.mark.asyncio
async def test_collect_stream_text_keeps_study_plan_timeout_for_plan_streams(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def _fake_build(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        captured["timeout"] = timeout_seconds_override
        return _StubProvider(), "system"

    monkeypatch.setattr(
        "sikao_api.modules.llm.application.call_execution.build_llm_provider",
        _fake_build,
    )
    service = SimpleNamespace(
        settings=SimpleNamespace(
            llm_timeout_seconds=120,
            llm_timeout_study_plan_seconds=10,
            llm_max_tokens=4000,
            llm_temperature=0.7,
            llm_provider="custom",
            llm_api_key="real-key",
            app_env="test",
        ),
        session=object(),
    )
    await collect_stream_text(
        service,
        user_id=1,
        purpose="plan_generate",
        prompt_version="plan_generate@v1",
        model="deepseek-v4-flash",
        messages=[LLMMessage(role="user", content="hi")],
    )
    assert captured["timeout"] == 10.0
