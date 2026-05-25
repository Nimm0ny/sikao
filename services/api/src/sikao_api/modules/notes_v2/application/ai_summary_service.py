from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import ReviewSourceKind
from sikao_api.db.models_v2 import AiSummaryCacheV2, NoteV2, UserV2
from sikao_api.db.schemas_v2 import NoteAiSummaryCardV2, NoteAiSummaryConfirmResponseV2
from sikao_api.modules.review.application.queue_items import create_review_item
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


@dataclass(frozen=True, slots=True)
class AiSummaryInputV2:
    note_id: int
    title: str
    body_text: str
    linked_question_id: int | None
    content_hash: str


class AiSummaryServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def build_summary_input(self, *, user: UserV2, note_id: int) -> AiSummaryInputV2:
        note = self._load_owned_note(user=user, note_id=note_id)
        if not note.body_text.strip():
            raise ValidationError("note body_text cannot be blank", code="validation_error")
        if not note.content_hash:
            raise ValidationError("note content_hash is required", code="validation_error")
        return AiSummaryInputV2(
            note_id=note.id,
            title=note.title,
            body_text=note.body_text[:2000],
            linked_question_id=note.linked_question_id,
            content_hash=note.content_hash,
        )

    def confirm_cards(
        self,
        *,
        user: UserV2,
        note_id: int,
        cards: list[NoteAiSummaryCardV2],
        prompt_version: str,
    ) -> NoteAiSummaryConfirmResponseV2:
        note = self._load_owned_note(user=user, note_id=note_id)
        if not note.content_hash:
            raise ValidationError("note content_hash is required", code="validation_error")
        cache_row = self.session.scalar(
            select(AiSummaryCacheV2).where(
                AiSummaryCacheV2.user_id == user.id,
                AiSummaryCacheV2.note_id == note.id,
                AiSummaryCacheV2.content_hash == note.content_hash,
                AiSummaryCacheV2.prompt_version == prompt_version,
            )
        )
        if cache_row is None:
            raise NotFoundError("ai summary cache not found", code="note_ai_summary_cache_not_found")
        if cache_row.confirmed_review_item_ids:
            return NoteAiSummaryConfirmResponseV2(
                review_item_ids=list(cache_row.confirmed_review_item_ids),
                message="已加入复盘队列",
            )

        created_ids: list[int] = []
        for card in cards:
            item = create_review_item(
                self.session,
                user_id=user.id,
                question_id=None,
                source_kind=ReviewSourceKind.NOTE_CARD.value,
                title=card.text,
                source_id=note.id,
                metadata_json={
                    "source_note_id": note.id,
                    "card_text": card.text,
                    "note_content_hash": note.content_hash,
                },
            )
            created_ids.append(item.id)
        cache_row.confirmed_review_item_ids = created_ids
        cache_row.confirmed_at = note.updated_at
        self.session.add(cache_row)
        self.session.flush()
        return NoteAiSummaryConfirmResponseV2(
            review_item_ids=created_ids,
            message="已加入复盘队列",
        )

    def _load_owned_note(self, *, user: UserV2, note_id: int) -> NoteV2:
        note = self.session.scalar(
            select(NoteV2).where(
                NoteV2.id == note_id,
                NoteV2.user_id == user.id,
                NoteV2.deleted_at.is_(None),
            )
        )
        if note is None:
            raise NotFoundError("note not found", code="note_not_found")
        return note
