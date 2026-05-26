from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_completed_session, seed_paper
from sikao_api.db.models_v2 import NoteV2, UserV2
from sikao_api.modules.notes_v2.application.weekly_review_service import WeeklyReviewServiceV2
from sikao_api.modules.system.application.errors import QuotaExceededError


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_notes_weekly_review_service_collects_weekly_context(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="notes-weekly-context@example.com", display_name="Notes Weekly Context")
        question_ids = seed_paper(
            client,
            paper_code="XC-NOTES-WEEKLY-CONTEXT",
            title="Notes Weekly Context",
            subject_kind="xingce",
            questions=[{"prompt": "Weekly context Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-NOTES-WEEKLY-CONTEXT",
            answer_outcomes=[True],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                NoteV2(
                    user_id=user_id,
                    title="Weekly note title",
                    body="weekly note body",
                    status="active",
                    linked_question_id=question_ids[0],
                    visibility="private",
                    type="question_level",
                    body_json={"type": "doc", "content": []},
                    body_text="weekly note body",
                    word_count=3,
                    content_hash="weekly-hash-context",
                    reaction_count=0,
                    comment_count=0,
                    bookmark_count=0,
                    is_featured=False,
                    created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2),
                    updated_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2),
                )
            )
            session.commit()

            service = WeeklyReviewServiceV2(session)
            user = session.get(UserV2, user_id)
            assert user is not None
            weekly = service.build_summary_input(user=user)

        assert weekly.note_count >= 1
        assert weekly.question_note_count >= 1
        assert weekly.note_titles
        assert weekly.week_number >= 1


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_notes_weekly_review_service_limits_third_concurrent_generation(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    class SlowProvider:
        async def chat_completion_stream(self, **kwargs):  # type: ignore[no-untyped-def]
            del kwargs
            await asyncio.sleep(0.1)
            yield type(
                "Chunk",
                (),
                {
                    "content_delta": "## 本周成果\n- 完成一轮复盘。\n\n## 薄弱环节\n- 资料分析仍需加强。\n\n## 下周建议\n- 继续做资料分析。\n\n## 本周知识沉淀\n- 先判断约束关系。\n",
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
        return SlowProvider(), "mock"

    monkeypatch.setattr(
        "sikao_api.modules.notes_v2.application.weekly_review_service.build_llm_provider",
        _fake_build_provider,
    )

    async def _collect(service: WeeklyReviewServiceV2, prepared, settings):  # type: ignore[no-untyped-def]
        frames = []
        async for frame in service.stream_generation(prepared=prepared, settings=settings):
            frames.append(frame)
        return frames

    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="notes-weekly-concurrent@example.com", display_name="Notes Weekly Concurrent")
        seed_paper(
            client,
            paper_code="XC-NOTES-WEEKLY-CONCURRENT",
            title="Notes Weekly Concurrent",
            subject_kind="xingce",
            questions=[{"prompt": "Weekly concurrent Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-NOTES-WEEKLY-CONCURRENT",
            answer_outcomes=[True],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        settings = app.state.settings

        def _run_once() -> int:
            with factory() as session:
                user = session.get(UserV2, user_id)
                assert user is not None
                service = WeeklyReviewServiceV2(session)
                try:
                    prepared = service.prepare_generation(user=user, settings=settings)
                except QuotaExceededError:
                    session.rollback()
                    return 429
                frames = asyncio.run(_collect(service, prepared, settings))
                session.commit()
                done = next(frame for frame in frames if frame.type == "done")
                return int(done.payload["note_id"])

        with ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(lambda _index: _run_once(), range(3)))

        statuses = [429 if result == 429 else 200 for result in results]
        assert sorted(statuses) == [200, 200, 429]
