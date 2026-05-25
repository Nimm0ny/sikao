from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_completed_session, seed_paper
from sikao_api.db.models_v2 import NoteV2, UserV2
from sikao_api.modules.notes_v2.application.weekly_review_service import WeeklyReviewServiceV2


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
