from __future__ import annotations

from datetime import UTC, datetime, timedelta
import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_completed_session,
    seed_paper,
)
from _home_phase_m4_support import parse_sse_frames
from sikao_api.db.models_v2 import (
    LlmCallV2,
    NoteTagV2,
    NoteV2,
    ReviewAttemptV2,
    ReviewItemV2,
    WeeklyReviewCacheV2,
)
from sikao_api.modules.llm.application.llm import LLMConfigError
from sikao_api.modules.review.application.queue_items import reason_compat_for_source


def _weekly_markdown() -> str:
    return (
        "## 本周成果\n"
        "- 完成 3 次复盘并沉淀出新的答题模式。\n\n"
        "## 薄弱环节\n"
        "- 资料分析的表格题仍然需要更稳定的节奏控制。\n\n"
        "## 下周建议\n"
        "- 先做 2 组资料分析，再回看本周错题。\n\n"
        "## 本周知识沉淀\n"
        "- 遇到相邻约束优先尝试捆绑法。\n"
    )


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_weekly_review_generate_and_replay(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[list[str]] = []

    class StubWeeklyProvider:
        async def chat_completion_stream(self, **kwargs):  # type: ignore[no-untyped-def]
            messages = kwargs["messages"]
            calls.append([message.content for message in messages])
            yield type(
                "Chunk",
                (),
                {
                    "content_delta": _weekly_markdown(),
                    "is_final": False,
                    "prompt_tokens": None,
                    "completion_tokens": None,
                },
            )()
            yield type(
                "Chunk",
                (),
                {
                    "content_delta": "",
                    "is_final": True,
                    "prompt_tokens": 120,
                    "completion_tokens": 180,
                },
            )()

    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        return StubWeeklyProvider(), "mock"

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.weekly_review_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="notes-weekly-route@example.com", display_name="Notes Weekly Route")
        question_ids = seed_paper(
            client,
            paper_code="XC-NOTES-WEEKLY-ROUTE",
            title="Notes Weekly Route",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Weekly route Q1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-NOTES-WEEKLY-ROUTE",
            answer_outcomes=[False],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            item = ReviewItemV2(
                user_id=user_id,
                source_kind="manual_add",
                source_id=question_ids[0],
                title="Weekly route review item",
                status="pending",
                question_id=question_ids[0],
                metadata_json={},
                reason=reason_compat_for_source("manual_add"),
            )
            session.add(item)
            session.flush()
            session.add(
                ReviewAttemptV2(
                    review_item_id=item.id,
                    outcome="correct",
                    notes_json={"effectiveConfidence": "certain"},
                    attempted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2),
                )
            )
            session.add(
                NoteV2(
                    user_id=user_id,
                    title="Weekly route linked note",
                    body="weekly route body",
                    status="active",
                    linked_question_id=question_ids[0],
                    visibility="private",
                    type="question_level",
                    body_json={"type": "doc", "content": []},
                    body_text="weekly route body",
                    word_count=3,
                    content_hash="weekly-route-hash",
                    reaction_count=0,
                    comment_count=0,
                    bookmark_count=0,
                    is_featured=False,
                    created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3),
                    updated_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3),
                )
            )
            session.commit()

        headers = {"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174500"}
        response = client.post("/api/v2/notes/weekly-review/generate", headers=headers, json={})
        assert response.status_code == 200, response.text
        frames = parse_sse_frames(response.text)
        assert any(frame["type"] == "chunk" for frame in frames)
        done = next(frame for frame in frames if frame["type"] == "done")
        assert done["title"].startswith("第")
        assert done["tags"][0] == "周回顾"

        replay = client.post("/api/v2/notes/weekly-review/generate", headers=headers, json={})
        assert replay.status_code == 200, replay.text
        replay_frames = parse_sse_frames(replay.text)
        replay_done = next(frame for frame in replay_frames if frame["type"] == "done")
        assert replay_done["note_id"] == done["note_id"]
        assert calls and len(calls) == 1

        second = client.post(
            "/api/v2/notes/weekly-review/generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174504"},
            json={},
        )
        assert second.status_code == 200, second.text
        second_done = next(frame for frame in parse_sse_frames(second.text) if frame["type"] == "done")
        assert second_done["note_id"] != done["note_id"]
        assert len(calls) == 2

        third = client.post(
            "/api/v2/notes/weekly-review/generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174505"},
            json={},
        )
        assert third.status_code == 429, third.text
        assert third.json()["code"] == "weekly_review_rate_limited"

        with factory() as session:
            note_row = session.get(NoteV2, int(done["note_id"]))
            assert note_row is not None
            assert note_row.type == "weekly_review"
            tags = list(
                session.query(NoteTagV2)
                .filter_by(note_id=note_row.id)
                .order_by(NoteTagV2.tag_name.asc())
            )
            assert [tag.tag_name for tag in tags] == ["周回顾", f"第{note_row.title.split('第', 1)[1].split('周', 1)[0]}周"]
            assert all(tag.is_system for tag in tags)

            cache_row = (
                session.query(WeeklyReviewCacheV2)
                .filter_by(user_id=user_id)
                .one()
            )
            assert cache_row.note_id == int(second_done["note_id"])
            assert cache_row.llm_call_id is not None
            llm_calls = list(
                session.query(LlmCallV2)
                .filter_by(purpose="notes_weekly_review")
                .order_by(LlmCallV2.id.asc())
            )
            assert len(llm_calls) == 2
            assert llm_calls[0].provider == "mock"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_weekly_review_records_failed_call_when_provider_build_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _boom(*args, **kwargs):  # type: ignore[no-untyped-def]
        del args, kwargs
        raise LLMConfigError("LLM_API_KEY not configured")

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.weekly_review_service.build_llm_provider",
        _boom,
    )

    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="notes-weekly-build-fail@example.com", display_name="Notes Weekly Build Fail")
        seed_paper(
            client,
            paper_code="XC-NOTES-WEEKLY-BUILD-FAIL",
            title="Notes Weekly Build Fail",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Weekly build fail Q1",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-NOTES-WEEKLY-BUILD-FAIL",
            answer_outcomes=[True],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )

        response = client.post(
            "/api/v2/notes/weekly-review/generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174501"},
            json={},
        )
        assert response.status_code == 503, response.text
        assert response.json()["code"] == "llm_config_missing"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = (
                session.query(LlmCallV2)
                .filter_by(purpose="notes_weekly_review")
                .order_by(LlmCallV2.id.desc())
                .one()
            )
            assert row.parse_status == "failed_before_trace"
            assert row.provider == "system"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_weekly_review_handles_empty_week_without_error(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_build_provider(*args, **kwargs):  # type: ignore[no-untyped-def]
        raise AssertionError("empty week should not call build_llm_provider")

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.weekly_review_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes-weekly-empty@example.com", display_name="Notes Weekly Empty")
        response = client.post(
            "/api/v2/notes/weekly-review/generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174502"},
            json={},
        )
        assert response.status_code == 200, response.text
        done = next(frame for frame in parse_sse_frames(response.text) if frame["type"] == "done")
        assert int(done["note_id"]) > 0
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            note_row = session.get(NoteV2, int(done["note_id"]))
            assert note_row is not None
            assert "暂无学习记录" in note_row.body_text
            llm_call = session.query(LlmCallV2).filter_by(purpose="notes_weekly_review").one_or_none()
            assert llm_call is None


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_weekly_review_rate_limits_after_two_generated_notes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_build_provider(settings, *, db=None, user_id=None, timeout_seconds_override=None):  # type: ignore[no-untyped-def]
        del settings, db, user_id, timeout_seconds_override
        return (
            type(
                "Provider",
                (),
                {
                    "chat_completion_stream": lambda self, **kwargs: (_ for _ in () ),
                },
            )(),
            "mock",
        )

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.weekly_review_service.build_llm_provider",
        _fake_build_provider,
    )

    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="notes-weekly-limit@example.com", display_name="Notes Weekly Limit")
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            for offset in range(2):
                session.add(
                    NoteV2(
                        user_id=user_id,
                        title=f"第{offset + 1}周学习回顾",
                        body="weekly body",
                        status="active",
                        linked_question_id=None,
                        visibility="private",
                        type="weekly_review",
                        body_json={"type": "doc", "content": []},
                        body_text="weekly body",
                        word_count=2,
                        content_hash=f"weekly-limit-{offset}",
                        reaction_count=0,
                        comment_count=0,
                        bookmark_count=0,
                        is_featured=False,
                        created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=offset + 1),
                        updated_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=offset + 1),
                    )
                )
            session.commit()

        response = client.post(
            "/api/v2/notes/weekly-review/generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174503"},
            json={},
        )
        assert response.status_code == 429, response.text
        assert response.json()["code"] == "weekly_review_rate_limited"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_notes_weekly_review_rejects_invalid_week_format(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="notes-weekly-invalid-week@example.com", display_name="Notes Weekly Invalid Week")
        response = client.post(
            "/api/v2/notes/weekly-review/generate",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174506"},
            json={"week": "2026-99"},
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "validation_error"
