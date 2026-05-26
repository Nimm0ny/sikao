from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session as SqlAlchemySession
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import AiSummaryCacheV2, NoteV2, QuestionV2, UserV2
from sikao_api.db.schemas_v2 import (
    NoteAiSummaryCardV2,
    NoteAiSummaryConfirmResponseV2,
    NoteAiSummaryPreviewResponseV2,
)
from sikao_api.modules.llm.application.cost_tracker import LlmCallRecord, add_llm_call
from sikao_api.modules.llm.application.llm import LLMMessage, build_llm_provider
from sikao_api.modules.llm.application.llm.prompts.note_summary_cards import (
    PROMPT_VERSION,
    build_note_summary_cards_messages,
)
from sikao_api.modules.llm.application.parsers.note_summary_parser import parse_note_summary_output
from sikao_api.modules.llm.application.quotas import HomeLlmQuotaService
from sikao_api.modules.llm.application.sanitizer import sanitize_user_input
from sikao_api.db.enums_v2 import ReviewSourceKind
from sikao_api.modules.review.application.queue_items import create_review_item
from sikao_api.modules.system.application.errors import LLMParseError, LLMServiceError, NotFoundError, ValidationError


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

    async def generate_preview(
        self,
        *,
        user: UserV2,
        note_id: int,
        settings: Settings,
    ) -> NoteAiSummaryPreviewResponseV2:
        summary_input = self.build_summary_input(user=user, note_id=note_id)
        cache_row = self.session.scalar(
            select(AiSummaryCacheV2).where(
                AiSummaryCacheV2.user_id == user.id,
                AiSummaryCacheV2.note_id == summary_input.note_id,
                AiSummaryCacheV2.content_hash == summary_input.content_hash,
                AiSummaryCacheV2.prompt_version == PROMPT_VERSION,
            )
        )
        if cache_row is not None and cache_row.cards_json:
            return NoteAiSummaryPreviewResponseV2(
                cards=_cards_from_json(cache_row.cards_json),
                cached=True,
                note_content_hash=summary_input.content_hash,
            )

        HomeLlmQuotaService(self.session, settings).check_quota(
            user_id=user.id,
            purpose="notes_ai_summary",
        )
        question = None
        if summary_input.linked_question_id is not None:
            question = self.session.get(QuestionV2, summary_input.linked_question_id)
        messages = build_note_summary_cards_messages(
            body_text=sanitize_user_input(summary_input.body_text, max_chars=2000),
            question_stem=(
                sanitize_user_input(question.prompt, max_chars=500)
                if question is not None
                else None
            ),
        )
        provider_label = "system"
        try:
            provider, provider_label = build_llm_provider(
                settings,
                db=self.session,
                user_id=user.id,
            )
            result = await provider.chat_completion(
                messages=messages,
                model=settings.llm_model_qa,
                max_tokens=settings.llm_max_tokens,
                temperature=0.3,
                response_format="json_object",
            )
        except httpx.TimeoutException as exc:
            self._record_failed_call(
                settings=settings,
                user_id=user.id,
                purpose="notes_ai_summary",
                provider_label=provider_label,
                messages=messages,
                raw_text="",
                prompt_version=PROMPT_VERSION,
                model=settings.llm_model_qa,
                prompt_tokens=None,
                completion_tokens=None,
                error=exc,
                parse_status="timeout",
            )
            raise LLMServiceError("llm service unavailable", code="llm_service_unavailable") from exc
        except httpx.HTTPError as exc:
            self._record_failed_call(
                settings=settings,
                user_id=user.id,
                purpose="notes_ai_summary",
                provider_label=provider_label,
                messages=messages,
                raw_text="",
                prompt_version=PROMPT_VERSION,
                model=settings.llm_model_qa,
                prompt_tokens=None,
                completion_tokens=None,
                error=exc,
                parse_status="provider_error",
            )
            raise LLMServiceError("llm service unavailable", code="llm_service_unavailable") from exc
        except Exception as exc:
            self._record_failed_call(
                settings=settings,
                user_id=user.id,
                purpose="notes_ai_summary",
                provider_label=provider_label,
                messages=messages,
                raw_text="",
                prompt_version=PROMPT_VERSION,
                model=settings.llm_model_qa,
                prompt_tokens=None,
                completion_tokens=None,
                error=exc,
                parse_status="failed_before_trace",
            )
            if isinstance(exc, LLMServiceError):
                raise
            raise LLMServiceError("llm service unavailable", code="llm_service_unavailable") from exc

        try:
            parsed = parse_note_summary_output(result.content)
        except Exception as exc:
            self._record_failed_call(
                settings=settings,
                user_id=user.id,
                purpose="notes_ai_summary",
                provider_label=provider_label,
                messages=messages,
                raw_text=result.content,
                prompt_version=PROMPT_VERSION,
                model=result.model,
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                error=exc,
                parse_status="parse_failed",
            )
            raise LLMParseError("llm parse failed", code="llm_parse_failed") from exc

        llm_call = add_llm_call(
            self.session,
            settings=settings,
            record=LlmCallRecord(
                user_id=user.id,
                purpose="notes_ai_summary",
                prompt_version=PROMPT_VERSION,
                provider=_provider_name(settings=settings, provider_label=provider_label),
                model=result.model,
                input_tokens=result.prompt_tokens,
                output_tokens=result.completion_tokens,
                request_payload={"messages": [message.__dict__ for message in messages]},
                response_payload={"content": result.content},
                parsed_output=parsed.model_dump(mode="json"),
                parse_status="ok",
                error_class=None,
                error_message=None,
                retry_count=0,
                latency_ms=0,
            ),
        )
        cards_json = [
            {"index": index, "text": card.text, "editable": True}
            for index, card in enumerate(parsed.cards)
        ]
        if cache_row is None:
            cache_row = AiSummaryCacheV2(
                user_id=user.id,
                note_id=summary_input.note_id,
                content_hash=summary_input.content_hash,
                prompt_version=PROMPT_VERSION,
                cards_json=cards_json,
                llm_call_id=llm_call.id,
                confirmed_review_item_ids=[],
            )
        else:
            cache_row.cards_json = cards_json
            cache_row.llm_call_id = llm_call.id
            cache_row.confirmed_review_item_ids = []
            cache_row.confirmed_at = None
        self.session.add(cache_row)
        self.session.flush()
        return NoteAiSummaryPreviewResponseV2(
            cards=_cards_from_json(cards_json),
            cached=False,
            note_content_hash=summary_input.content_hash,
        )

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
            select(AiSummaryCacheV2)
            .where(
                AiSummaryCacheV2.user_id == user.id,
                AiSummaryCacheV2.note_id == note.id,
                AiSummaryCacheV2.content_hash == note.content_hash,
                AiSummaryCacheV2.prompt_version == prompt_version,
            )
            .with_for_update()
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
        cache_row.confirmed_at = datetime.now(UTC).replace(tzinfo=None)
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

    def _record_failed_call(
        self,
        *,
        settings: Settings,
        user_id: int,
        purpose: str,
        provider_label: str,
        messages: list[LLMMessage],
        raw_text: str,
        prompt_version: str,
        model: str,
        prompt_tokens: int | None,
        completion_tokens: int | None,
        error: Exception,
        parse_status: str,
    ) -> None:
        with SqlAlchemySession(bind=self.session.get_bind()) as isolated_session:
            add_llm_call(
                isolated_session,
                settings=settings,
                record=LlmCallRecord(
                    user_id=user_id,
                    purpose=purpose,
                    prompt_version=prompt_version,
                    provider=_provider_name(settings=settings, provider_label=provider_label),
                    model=model,
                    input_tokens=prompt_tokens,
                    output_tokens=completion_tokens,
                    request_payload={"messages": [message.__dict__ for message in messages]},
                    response_payload={"content": raw_text} if raw_text else None,
                    parsed_output=None,
                    parse_status=parse_status,
                    error_class=type(error).__name__,
                    error_message=str(error),
                    retry_count=0,
                    latency_ms=0,
                ),
            )
            isolated_session.commit()


def _cards_from_json(raw_cards: list[dict[str, object]]) -> list[NoteAiSummaryCardV2]:
    return [
        NoteAiSummaryCardV2(
            index=_coerce_index(raw.get("index"), fallback=idx),
            text=str(raw["text"]),
            editable=bool(raw.get("editable", True)),
        )
        for idx, raw in enumerate(raw_cards)
    ]


def _coerce_index(raw_value: object, *, fallback: int) -> int:
    if isinstance(raw_value, int) and not isinstance(raw_value, bool):
        return raw_value
    return fallback


def _provider_name(*, settings: Settings, provider_label: str) -> str:
    if provider_label == "mock":
        return "mock"
    if provider_label == "system":
        return "system"
    if provider_label == "user_byom":
        return "user_byom"
    if settings.llm_provider == "mock":
        return "mock"
    if settings.app_env == "test" and not settings.llm_api_key:
        return "mock"
    return settings.llm_provider
