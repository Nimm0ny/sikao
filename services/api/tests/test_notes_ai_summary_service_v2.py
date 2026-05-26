from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AiSummaryCacheV2, NoteV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import NoteAiSummaryCardV2
from sikao_api.modules.notes_v2.application.ai_summary_service import AiSummaryServiceV2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_notes_ai_summary_service_confirm_creates_and_replays_review_items(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="notes-ai-summary-service@example.com", display_name="Notes AI Summary Service")
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            note = NoteV2(
                user_id=user_id,
                title="Summary source note",
                body="summary note body",
                status="active",
                linked_question_id=None,
                visibility="private",
                type="free",
                body_json={"type": "doc", "content": []},
                body_text="summary note body",
                word_count=3,
                content_hash="summary-hash",
                reaction_count=0,
                comment_count=0,
                bookmark_count=0,
                is_featured=False,
            )
            session.add(note)
            session.flush()
            session.add(
                AiSummaryCacheV2(
                    user_id=user_id,
                    note_id=note.id,
                    content_hash="summary-hash",
                    prompt_version="note_summary_cards@v1",
                    cards_json=[{"text": "捆绑法适用于相邻约束"}],
                    confirmed_review_item_ids=[],
                )
            )
            session.commit()

            user = session.get(UserV2, user_id)
            assert user is not None
            service = AiSummaryServiceV2(session)
            result = service.confirm_cards(
                user=user,
                note_id=note.id,
                cards=[NoteAiSummaryCardV2(index=0, text="捆绑法适用于相邻约束")],
                prompt_version="note_summary_cards@v1",
            )
            session.commit()

            assert len(result.review_item_ids) == 1
            created_item = session.get(ReviewItemV2, result.review_item_ids[0])
            assert created_item is not None
            assert created_item.source_kind == "note_card"
            assert created_item.metadata_json["source_note_id"] == note.id
            assert created_item.metadata_json["card_text"] == "捆绑法适用于相邻约束"

            replay = service.confirm_cards(
                user=user,
                note_id=note.id,
                cards=[NoteAiSummaryCardV2(index=0, text="捆绑法适用于相邻约束")],
                prompt_version="note_summary_cards@v1",
            )
            assert replay.review_item_ids == result.review_item_ids

            rows = list(
                session.scalars(
                    select(ReviewItemV2).where(
                        ReviewItemV2.user_id == user_id,
                        ReviewItemV2.source_kind == "note_card",
                    )
                )
            )
            assert len(rows) == 1
            cache_row = session.query(AiSummaryCacheV2).filter_by(note_id=note.id).one()
            assert cache_row.confirmed_at is not None
            assert cache_row.confirmed_at >= note.updated_at
