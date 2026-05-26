from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import httpx
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session as SqlAlchemySession
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import NoteV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionV2, UserV2, WeeklyReviewCacheV2
from sikao_api.modules.llm.application.cost_tracker import LlmCallRecord, add_llm_call
from sikao_api.modules.llm.application.llm import LLMConfigError, LLMMessage, LLMProvider, build_llm_provider
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_weekly import (
    PROMPT_VERSION,
    build_cause_analysis_weekly_messages,
)
from sikao_api.modules.llm.application.quotas import HomeLlmQuotaService
from sikao_api.modules.notes_v2.domain.body_extractor import extract_text, extract_word_count
from sikao_api.modules.notes_v2.domain.content_hash import compute_content_hash
from sikao_api.modules.notes_v2.domain.tiptap_converter import md_to_json
from sikao_api.modules.notes_v2.infrastructure.repos import NotesRepoV2
from sikao_api.modules.review.application.time_windows import current_cn_date, parse_iso_week_code, week_bounds_utc_from_cn_week_start
from sikao_api.modules.review.application.weekly_service import build_weekly_summary
from sikao_api.modules.system.application.errors import LLMParseError, LLMServiceError, QuotaExceededError, ValidationError


@dataclass(frozen=True, slots=True)
class WeeklyReviewDataV2:
    week_number: int
    date_range: str
    review_count: int
    redo_accuracy_pct: float
    accuracy_delta_pct: float | None
    graduated_count: int
    practice_count: int
    module_accuracy_summary: str
    weakness_detail: str
    note_count: int
    question_note_count: int
    note_titles: str
    week_start_date: date


@dataclass(frozen=True, slots=True)
class WeeklyReviewGenerationPrepV2:
    user_id: int
    week_start_date: date
    title: str
    tags: list[str]
    summary: WeeklyReviewDataV2
    provider: LLMProvider | None
    provider_label: str
    messages: list[LLMMessage]
    local_markdown: str | None = None


@dataclass(frozen=True, slots=True)
class WeeklyReviewStreamFrameV2:
    type: str
    payload: dict[str, object]


class WeeklyReviewServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = NotesRepoV2(session)

    def build_summary_input(
        self,
        *,
        user: UserV2,
        week: str | None = None,
        now: datetime | None = None,
    ) -> WeeklyReviewDataV2:
        resolved_now = now or datetime.now(UTC).replace(tzinfo=None)
        week_start_date = self._resolve_week_start_date(week=week, now=resolved_now)
        window_start, window_end = week_bounds_utc_from_cn_week_start(week_start_date)
        review_summary = build_weekly_summary(
            self.session,
            user_id=user.id,
            week_start_date=week_start_date,
        )
        previous_week_start_date = week_start_date - timedelta(days=7)
        previous_summary = build_weekly_summary(
            self.session,
            user_id=user.id,
            week_start_date=previous_week_start_date,
        )
        note_count, question_note_count, note_titles = self._weekly_note_snapshot(
            user_id=user.id,
            window_start=window_start,
            window_end=window_end,
        )
        practice_count, module_accuracy_summary, weakness_detail = self._practice_snapshot(
            user_id=user.id,
            window_start=window_start,
            window_end=window_end,
        )
        accuracy_delta_pct: float | None = None
        if previous_summary.items_reviewed > 0:
            accuracy_delta_pct = (
                review_summary.redo_accuracy_pct - previous_summary.redo_accuracy_pct
            )
        return WeeklyReviewDataV2(
            week_number=_cn_week_number(week_start_date),
            date_range=self._date_range(
                week_start_date=week_start_date,
                window_end=window_end,
                now=resolved_now,
            ),
            review_count=review_summary.items_reviewed,
            redo_accuracy_pct=review_summary.redo_accuracy_pct,
            accuracy_delta_pct=accuracy_delta_pct,
            graduated_count=review_summary.new_graduated_count,
            practice_count=practice_count,
            module_accuracy_summary=module_accuracy_summary,
            weakness_detail=weakness_detail,
            note_count=note_count,
            question_note_count=question_note_count,
            note_titles=note_titles,
            week_start_date=week_start_date,
        )

    def prepare_generation(
        self,
        *,
        user: UserV2,
        settings: Settings,
        week: str | None = None,
        now: datetime | None = None,
    ) -> WeeklyReviewGenerationPrepV2:
        summary = self.build_summary_input(user=user, week=week, now=now)
        self.session.scalar(
            select(UserV2.id)
            .where(UserV2.id == user.id)
            .with_for_update()
        )
        self._assert_weekly_limit(user_id=user.id, week_start_date=summary.week_start_date)
        if self._is_empty_week(summary):
            return WeeklyReviewGenerationPrepV2(
                user_id=user.id,
                week_start_date=summary.week_start_date,
                title=f"第{summary.week_number}周学习回顾",
                tags=_weekly_tags(summary.week_number),
                summary=summary,
                provider=None,
                provider_label="system",
                messages=[],
                local_markdown=_empty_weekly_markdown(summary.week_number),
            )
        HomeLlmQuotaService(self.session, settings).check_quota(
            user_id=user.id,
            purpose="notes_weekly_review",
        )
        messages = build_cause_analysis_weekly_messages(
            week_number=summary.week_number,
            date_range=summary.date_range,
            review_count=summary.review_count,
            redo_accuracy_pct=summary.redo_accuracy_pct,
            accuracy_delta_pct=summary.accuracy_delta_pct,
            graduated_count=summary.graduated_count,
            practice_count=summary.practice_count,
            module_accuracy_summary=summary.module_accuracy_summary,
            weakness_detail=summary.weakness_detail,
            note_count=summary.note_count,
            question_note_count=summary.question_note_count,
            note_titles=summary.note_titles,
        )
        try:
            provider, provider_label = build_llm_provider(
                settings,
                db=self.session,
                user_id=user.id,
            )
        except LLMConfigError as exc:
            self._record_failed_call(
                settings=settings,
                user_id=user.id,
                purpose="notes_weekly_review",
                provider_label="system",
                messages=messages,
                raw_text="",
                prompt_version=PROMPT_VERSION,
                model=settings.llm_model_qa,
                prompt_tokens=None,
                completion_tokens=None,
                error=exc,
                parse_status="failed_before_trace",
            )
            raise
        return WeeklyReviewGenerationPrepV2(
            user_id=user.id,
            week_start_date=summary.week_start_date,
            title=f"第{summary.week_number}周学习回顾",
            tags=_weekly_tags(summary.week_number),
            summary=summary,
            provider=provider,
            provider_label=provider_label,
            messages=messages,
        )

    async def stream_generation(
        self,
        *,
        prepared: WeeklyReviewGenerationPrepV2,
        settings: Settings,
    ) -> AsyncIterator[WeeklyReviewStreamFrameV2]:
        markdown = prepared.local_markdown or ""
        model_name = settings.llm_model_qa
        prompt_tokens: int | None = None
        completion_tokens: int | None = None
        if prepared.provider is not None:
            try:
                async for chunk in prepared.provider.chat_completion_stream(
                    messages=prepared.messages,
                    model=settings.llm_model_qa,
                    max_tokens=settings.llm_max_tokens,
                    temperature=0.7,
                ):
                    if chunk.content_delta:
                        markdown += chunk.content_delta
                        yield WeeklyReviewStreamFrameV2(
                            type="chunk",
                            payload={"text": chunk.content_delta},
                        )
                    if chunk.is_final:
                        model_name = settings.llm_model_qa
                        prompt_tokens = chunk.prompt_tokens
                        completion_tokens = chunk.completion_tokens
            except LLMConfigError as exc:
                self._record_failed_call(
                    settings=settings,
                    user_id=prepared.user_id,
                    purpose="notes_weekly_review",
                    provider_label="system",
                    messages=prepared.messages,
                    raw_text="",
                    prompt_version=PROMPT_VERSION,
                    model=settings.llm_model_qa,
                    prompt_tokens=None,
                    completion_tokens=None,
                    error=exc,
                    parse_status="failed_before_trace",
                )
                raise
            except httpx.TimeoutException as exc:
                self._record_failed_call(
                    settings=settings,
                    user_id=prepared.user_id,
                    purpose="notes_weekly_review",
                    provider_label=prepared.provider_label,
                    messages=prepared.messages,
                    raw_text=markdown,
                    prompt_version=PROMPT_VERSION,
                    model=settings.llm_model_qa,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    error=exc,
                    parse_status="timeout",
                )
                raise LLMServiceError("llm service unavailable", code="llm_service_unavailable") from exc
            except httpx.HTTPError as exc:
                self._record_failed_call(
                    settings=settings,
                    user_id=prepared.user_id,
                    purpose="notes_weekly_review",
                    provider_label=prepared.provider_label,
                    messages=prepared.messages,
                    raw_text=markdown,
                    prompt_version=PROMPT_VERSION,
                    model=settings.llm_model_qa,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    error=exc,
                    parse_status="provider_error",
                )
                raise LLMServiceError("llm service unavailable", code="llm_service_unavailable") from exc
            except Exception as exc:
                self._record_failed_call(
                    settings=settings,
                    user_id=prepared.user_id,
                    purpose="notes_weekly_review",
                    provider_label=prepared.provider_label,
                    messages=prepared.messages,
                    raw_text=markdown,
                    prompt_version=PROMPT_VERSION,
                    model=settings.llm_model_qa,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    error=exc,
                    parse_status="failed_before_trace",
                )
                if isinstance(exc, LLMServiceError):
                    raise
                raise LLMServiceError("llm service unavailable", code="llm_service_unavailable") from exc
        elif markdown:
            yield WeeklyReviewStreamFrameV2(
                type="chunk",
                payload={"text": markdown},
            )

        try:
            body_json = md_to_json(markdown)
            body_text = extract_text(body_json)
        except Exception as exc:
            self._record_failed_call(
                settings=settings,
                user_id=prepared.user_id,
                purpose="notes_weekly_review",
                provider_label=prepared.provider_label,
                messages=prepared.messages,
                raw_text=markdown,
                prompt_version=PROMPT_VERSION,
                model=model_name,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                error=exc,
                parse_status="parse_failed",
            )
            raise LLMParseError("llm parse failed", code="llm_parse_failed") from exc

        llm_call_id: int | None = None
        if prepared.provider is not None:
            llm_call = add_llm_call(
                self.session,
                settings=settings,
                record=LlmCallRecord(
                    user_id=prepared.user_id,
                    purpose="notes_weekly_review",
                    prompt_version=PROMPT_VERSION,
                    provider=_provider_name(settings=settings, provider_label=prepared.provider_label),
                    model=model_name,
                    input_tokens=prompt_tokens,
                    output_tokens=completion_tokens,
                    request_payload={"messages": [message.__dict__ for message in prepared.messages]},
                    response_payload={"content": markdown},
                    parsed_output=body_json,
                    parse_status="ok",
                    error_class=None,
                    error_message=None,
                    retry_count=0,
                    latency_ms=0,
                ),
            )
            llm_call_id = llm_call.id
        note = self._persist_weekly_note(
            user_id=prepared.user_id,
            title=prepared.title,
            tags=prepared.tags,
            body_json=body_json,
            body_text=body_text,
        )
        self._upsert_cache(
            user_id=prepared.user_id,
            week_start_date=prepared.week_start_date,
            note_id=note.id,
            llm_call_id=llm_call_id,
        )
        yield WeeklyReviewStreamFrameV2(
            type="done",
            payload={
                "note_id": note.id,
                "title": note.title,
                "tags": prepared.tags,
            },
        )

    def _weekly_note_snapshot(
        self,
        *,
        user_id: int,
        window_start: datetime,
        window_end: datetime,
    ) -> tuple[int, int, str]:
        rows = list(
            self.session.scalars(
                select(NoteV2)
                .where(
                    NoteV2.user_id == user_id,
                    NoteV2.created_at >= window_start,
                    NoteV2.created_at < window_end,
                    NoteV2.deleted_at.is_(None),
                )
                .order_by(NoteV2.created_at.asc(), NoteV2.id.asc())
            )
        )
        note_count = len(rows)
        question_note_count = sum(1 for row in rows if row.linked_question_id is not None)
        note_titles = "；".join(row.title for row in rows[:5]) if rows else "无本周笔记"
        return note_count, question_note_count, note_titles

    def _practice_snapshot(
        self,
        *,
        user_id: int,
        window_start: datetime,
        window_end: datetime,
    ) -> tuple[int, str, str]:
        rows = list(
            self.session.execute(
                select(
                    QuestionV2.category_l1,
                    func.count(PracticeSessionAnswerV2.id),
                    func.sum(case((PracticeSessionAnswerV2.is_correct.is_(True), 1), else_=0)),
                )
                .join(PracticeSessionV2, PracticeSessionV2.id == PracticeSessionAnswerV2.session_id)
                .join(QuestionV2, QuestionV2.id == PracticeSessionAnswerV2.question_id)
                .where(
                    PracticeSessionV2.user_id == user_id,
                    PracticeSessionAnswerV2.answered_at >= window_start,
                    PracticeSessionAnswerV2.answered_at < window_end,
                    PracticeSessionAnswerV2.question_id.is_not(None),
                )
                .group_by(QuestionV2.category_l1)
                .order_by(func.count(PracticeSessionAnswerV2.id).desc(), QuestionV2.category_l1.asc())
            )
        )
        if not rows:
            return 0, "无本周练习数据", "无显著薄弱模块"

        practice_count = sum(int(total or 0) for _category, total, _correct in rows)
        summaries: list[tuple[str, float, int, int]] = []
        for category, total, correct in rows:
            total_count = int(total or 0)
            correct_count = int(correct or 0)
            accuracy = 0.0 if total_count == 0 else round(correct_count * 100 / total_count, 1)
            summaries.append((str(category or "unknown"), accuracy, correct_count, total_count))
        module_accuracy_summary = "；".join(
            f"{category} {accuracy:.1f}% ({correct}/{total})"
            for category, accuracy, correct, total in summaries[:4]
        )
        weakest = sorted(summaries, key=lambda item: (item[1], item[3]))[:3]
        weakness_detail = "；".join(
            f"{category} {accuracy:.1f}% ({correct}/{total})"
            for category, accuracy, correct, total in weakest
        )
        return practice_count, module_accuracy_summary, weakness_detail

    def _upsert_cache(
        self,
        *,
        user_id: int,
        week_start_date: date,
        note_id: int,
        llm_call_id: int | None,
    ) -> None:
        cache_row = self.session.scalar(
            select(WeeklyReviewCacheV2).where(
                WeeklyReviewCacheV2.user_id == user_id,
                WeeklyReviewCacheV2.week_start_date == week_start_date,
                WeeklyReviewCacheV2.prompt_version == PROMPT_VERSION,
            )
        )
        if cache_row is None:
            cache_row = WeeklyReviewCacheV2(
                user_id=user_id,
                week_start_date=week_start_date,
                prompt_version=PROMPT_VERSION,
                note_id=note_id,
                llm_call_id=llm_call_id,
            )
        else:
            cache_row.note_id = note_id
            cache_row.llm_call_id = llm_call_id
        self.session.add(cache_row)
        self.session.flush()

    def _persist_weekly_note(
        self,
        *,
        user_id: int,
        title: str,
        tags: list[str],
        body_json: dict[str, object],
        body_text: str,
    ) -> NoteV2:
        note = NoteV2(
            user_id=user_id,
            title=title,
            body=body_text,
            status="active",
            linked_question_id=None,
            visibility="private",
            type="weekly_review",
            body_json=body_json,
            body_text=body_text,
            word_count=extract_word_count(body_text),
            content_hash=compute_content_hash(body_json),
            reaction_count=0,
            comment_count=0,
            bookmark_count=0,
            is_featured=False,
        )
        self.session.add(note)
        self.session.flush()
        for tag in tags:
            existing = self.repo.get_note_tag(note_id=note.id, tag_name=tag)
            if existing is None:
                self.repo.add_note_tag(
                    user_id=user_id,
                    note_id=note.id,
                    tag_name=tag,
                    is_system=True,
                )
        return note

    def _assert_weekly_limit(self, *, user_id: int, week_start_date: date) -> None:
        window_start, window_end = week_bounds_utc_from_cn_week_start(week_start_date)
        weekly_count = int(
            self.session.scalar(
                select(func.count(NoteV2.id)).where(
                    NoteV2.user_id == user_id,
                    NoteV2.type == "weekly_review",
                    NoteV2.created_at >= window_start,
                    NoteV2.created_at < window_end,
                )
            )
            or 0
        )
        if weekly_count >= 2:
            raise QuotaExceededError(
                "weekly review limit exceeded",
                code="weekly_review_rate_limited",
            )

    @staticmethod
    def _is_empty_week(summary: WeeklyReviewDataV2) -> bool:
        return (
            summary.review_count == 0
            and summary.practice_count == 0
            and summary.note_count == 0
        )

    def _resolve_week_start_date(self, *, week: str | None, now: datetime) -> date:
        if week is not None:
            try:
                return parse_iso_week_code(week)
            except ValueError as exc:
                raise ValidationError("week must use YYYY-WW format", code="validation_error") from exc
        now_cn = now.replace(tzinfo=UTC) + timedelta(hours=8)
        return now_cn.date() - timedelta(days=now_cn.date().weekday())

    @staticmethod
    def _date_range(
        *,
        week_start_date: date,
        window_end: datetime,
        now: datetime,
    ) -> str:
        current_week_start = current_cn_date() - timedelta(days=current_cn_date().weekday())
        if week_start_date == current_week_start:
            end_date = (now.replace(tzinfo=UTC) + timedelta(hours=8)).date()
        else:
            end_date = (window_end - timedelta(seconds=1)).date()
        return f"{week_start_date.isoformat()} ~ {end_date.isoformat()}"

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


def _cn_week_number(week_start_date: date) -> int:
    return int(week_start_date.isocalendar().week)


def _weekly_tags(week_number: int) -> list[str]:
    return ["周回顾", f"第{week_number}周"]


def _empty_weekly_markdown(week_number: int) -> str:
    return (
        "## 本周成果\n"
        f"- 第{week_number}周暂无学习记录。\n\n"
        "## 薄弱环节\n"
        "- 暂无可识别的薄弱环节。\n\n"
        "## 下周建议\n"
        "- 先完成一组基础练习，再回来看本周沉淀。\n\n"
        "## 本周知识沉淀\n"
        "- 本周暂无新的知识沉淀。\n"
    )


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
