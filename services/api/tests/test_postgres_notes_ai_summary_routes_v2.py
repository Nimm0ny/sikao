from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.llm_stubs import StubLlmProvider
from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AiSummaryCacheV2, LlmCallV2, NoteV2
from sikao_api.modules.llm.application.llm import LLMConfigError


def _note_body() -> dict[str, Any]:
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "捆绑法适用于相邻约束"}],
            }
        ],
    }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_ai_summary_preview_and_confirm_replay(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        calls.append("called")
        return (
            StubLlmProvider('{"cards":[{"text":"捆绑法适用于相邻约束"},{"text":"插空法适用于不相邻约束"}]}'),
            "mock",
        )

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.ai_summary_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes-ai-summary-route@example.com", display_name="Notes AI Summary Route")
        note = client.post(
            "/api/v2/notes",
            json={
                "title": "AI Summary Route Note",
                "bodyJson": _note_body(),
                "tags": ["summary"],
            },
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        preview = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert preview.status_code == 200, preview.text
        payload = preview.json()
        assert payload["cached"] is False
        assert len(payload["cards"]) == 2
        assert calls == ["called"]

        preview_cached = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert preview_cached.status_code == 200, preview_cached.text
        assert preview_cached.json()["cached"] is True
        assert calls == ["called"]

        confirm = client.post(
            f"/api/v2/notes/{note_id}/ai-summary/confirm",
            json={"cards": preview.json()["cards"]},
        )
        assert confirm.status_code == 200, confirm.text
        review_item_ids = confirm.json()["reviewItemIds"]
        assert len(review_item_ids) == 2

        confirm_replay = client.post(
            f"/api/v2/notes/{note_id}/ai-summary/confirm",
            json={"cards": preview.json()["cards"]},
        )
        assert confirm_replay.status_code == 200, confirm_replay.text
        assert confirm_replay.json()["reviewItemIds"] == review_item_ids

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            cache_row = session.query(AiSummaryCacheV2).filter_by(note_id=note_id).one()
            note_row = session.get(NoteV2, note_id)
            assert note_row is not None
            assert cache_row.confirmed_review_item_ids == review_item_ids
            assert cache_row.note_id == note_id
            assert cache_row.content_hash == note_row.content_hash


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_ai_summary_records_failed_call_when_provider_build_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _boom(*args, **kwargs):  # type: ignore[no-untyped-def]
        del args, kwargs
        raise LLMConfigError("LLM_API_KEY not configured")

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.ai_summary_service.build_llm_provider",
        _boom,
    )

    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes-ai-summary-build-fail@example.com", display_name="Notes AI Summary Build Fail")
        note = client.post(
            "/api/v2/notes",
            json={"title": "Build Fail Note", "bodyJson": _note_body(), "tags": ["summary"]},
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        preview = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert preview.status_code == 503, preview.text
        assert preview.json()["code"] == "llm_config_missing"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.query(LlmCallV2).filter_by(purpose="notes_ai_summary").order_by(LlmCallV2.id.desc()).one()
            assert row.parse_status == "failed_before_trace"
            assert row.provider == "system"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_ai_summary_records_failed_call_for_provider_runtime_error(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class BrokenProvider:
        async def chat_completion(self, **kwargs):  # type: ignore[no-untyped-def]
            del kwargs
            raise RuntimeError("provider exploded")

    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        return BrokenProvider(), "mock"

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.ai_summary_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes-ai-summary-runtime-fail@example.com", display_name="Notes AI Summary Runtime Fail")
        note = client.post(
            "/api/v2/notes",
            json={"title": "Runtime Fail Note", "bodyJson": _note_body(), "tags": ["summary"]},
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        preview = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert preview.status_code == 503, preview.text
        assert preview.json()["code"] == "llm_service_unavailable"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.query(LlmCallV2).filter_by(purpose="notes_ai_summary").order_by(LlmCallV2.id.desc()).one()
            assert row.parse_status == "failed_before_trace"
            assert row.provider == "mock"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_ai_summary_rebuilds_after_note_content_changes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        calls.append("called")
        return (
            StubLlmProvider('{"cards":[{"text":"第一版摘要"},{"text":"第二版摘要"}]}'),
            "mock",
        )

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.ai_summary_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes-ai-summary-rebuild@example.com", display_name="Notes AI Summary Rebuild")
        note = client.post(
            "/api/v2/notes",
            json={"title": "Rebuild Note", "bodyJson": _note_body(), "tags": ["summary"]},
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        first_preview = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert first_preview.status_code == 200, first_preview.text
        assert first_preview.json()["cached"] is False
        assert calls == ["called"]

        updated = client.put(
            f"/api/v2/notes/{note_id}",
            json={
                "bodyJson": {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "插空法适用于不相邻约束，先看空位数量。"}],
                        }
                    ],
                }
            },
        )
        assert updated.status_code == 200, updated.text

        second_preview = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert second_preview.status_code == 200, second_preview.text
        assert second_preview.json()["cached"] is False
        assert calls == ["called", "called"]


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_ai_summary_respects_shared_daily_quota(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        return (
            StubLlmProvider('{"cards":[{"text":"共享配额摘要"}]}'),
            "mock",
        )

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.ai_summary_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes-ai-summary-quota@example.com", display_name="Notes AI Summary Quota")
        note = client.post(
            "/api/v2/notes",
            json={"title": "Quota Note", "bodyJson": _note_body(), "tags": ["summary"]},
        )
        assert note.status_code == 200, note.text
        note_id = note.json()["id"]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            user_id = session.get(NoteV2, note_id).user_id  # type: ignore[union-attr]
            for index in range(20):
                session.add(
                    LlmCallV2(
                        user_id=user_id,
                        purpose="review_cause_analysis",
                        prompt_version=f"review_cause_analysis@quota-{index}",
                        provider="mock",
                        model="mock-model",
                        input_tokens=10,
                        output_tokens=20,
                        cost_cny=0.0001,
                        latency_ms=1,
                        request_payload={},
                        response_payload={"content": "ok"},
                        parsed_output={"ok": True},
                        parse_status="ok",
                        error_class=None,
                        error_message=None,
                        retry_count=0,
                    )
                )
            session.commit()

        preview = client.post(f"/api/v2/notes/{note_id}/ai-summary")
        assert preview.status_code == 429, preview.text
        assert preview.json()["code"] == "llm_daily_call_quota_exceeded"
