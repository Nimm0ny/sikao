from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_completed_session, seed_paper
from sikao_api.db.models_v2 import NoteV2, ReviewAttemptV2, ReviewItemV2
from sikao_api.modules.review.application.queue_items import reason_compat_for_source
from sikao_api.modules.review.application.weekly_service import build_weekly_summary


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_notes_weekly_review_foundation_aggregates_review_practice_and_notes(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="notes-weekly-foundation@example.com", display_name="Notes Weekly Foundation")
        question_ids = seed_paper(
            client,
            paper_code="XC-NOTES-WEEKLY-FOUNDATION",
            title="Notes Weekly Foundation",
            subject_kind="xingce",
            questions=[
                {"prompt": "Weekly foundation Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Weekly foundation Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "data", "category_l2": "table"},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-NOTES-WEEKLY-FOUNDATION",
            answer_outcomes=[True, False],
            submitted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            item = ReviewItemV2(
                user_id=user_id,
                source_kind="manual_add",
                source_id=question_ids[0],
                title="Weekly review item",
                status="pending",
                question_id=question_ids[0],
                metadata_json={},
                reason=reason_compat_for_source("manual_add"),
            )
            session.add(item)
            session.flush()
            session.add(ReviewAttemptV2(review_item_id=item.id, outcome="correct", notes_json={"effectiveConfidence": "certain"}, attempted_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=2)))
            session.add(
                NoteV2(
                    user_id=user_id,
                    title="Weekly linked note",
                    body="weekly note body",
                    status="active",
                    linked_question_id=question_ids[0],
                    visibility="private",
                    type="question_level",
                    body_json={"type": "doc", "content": []},
                    body_text="weekly note body",
                    word_count=3,
                    content_hash="weekly-hash",
                    reaction_count=0,
                    comment_count=0,
                    bookmark_count=0,
                    is_featured=False,
                    created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3),
                    updated_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=3),
                )
            )
            session.commit()

            now_cn_date = (datetime.now(UTC) + timedelta(hours=8)).date()
            week_start = now_cn_date - timedelta(days=now_cn_date.weekday())
            summary = build_weekly_summary(session, user_id=user_id, week_start_date=week_start)

        assert summary.items_reviewed >= 1
        assert summary.new_notes_count >= 1
        assert summary.redo_accuracy_pct >= 0
        assert summary.week
