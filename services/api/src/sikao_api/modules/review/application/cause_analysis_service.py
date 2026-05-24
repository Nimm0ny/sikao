from __future__ import annotations

from time import monotonic
from typing import Any

from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.enums_v2 import ReviewItemStatus
from sikao_api.db.models_v2 import AiCauseAnalysisV2, UserV2
from sikao_api.db.schemas_v2 import (
    CauseAnalysisGroupRequestV2,
    CauseAnalysisRequestV2,
    CauseAnalysisResponseV2,
)
from sikao_api.modules.llm.application.idempotency import (
    build_idempotent_request_hash,
    claim_idempotency_key,
    get_replay,
    release_idempotency_claim,
    store_replay,
    validate_idempotency_key,
)
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_forced import (
    PROMPT_VERSION as FORCED_PROMPT_VERSION,
    build_cause_analysis_forced_messages,
)
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_group import (
    PROMPT_VERSION as GROUP_PROMPT_VERSION,
    build_cause_analysis_group_messages,
)
from sikao_api.modules.llm.application.llm.prompts.cause_analysis_single import (
    PROMPT_VERSION as SINGLE_PROMPT_VERSION,
    build_cause_analysis_single_messages,
)
from sikao_api.modules.llm.application.service import HomeLlmService
from sikao_api.modules.llm.application.quotas import HomeLlmQuotaService
from sikao_api.modules.review.application.cause_analysis_cache import (
    CauseTagDefinition,
    compute_group_input_hash,
    compute_group_question_ids_signature,
    compute_single_input_hash,
    load_active_cause_tags,
    render_taxonomy_block,
)
from sikao_api.modules.review.application.cause_analysis_context import (
    build_evolution_context_block,
    build_group_context,
    build_single_analysis_context,
    supplement_related_questions,
)
from sikao_api.modules.review.application.cause_analysis_execution import (
    clear_forced_pending,
    execute_and_persist_group_analysis,
    execute_and_persist_single_analysis,
)
from sikao_api.modules.review.application.cause_analysis_queries import (
    load_cached_group_row,
    load_cached_single_row,
    load_group_items_or_raise,
    load_item_or_raise,
    load_previous_single_analysis,
    load_question_or_raise,
)
from sikao_api.modules.review.application.cause_analysis_result import serialize_analysis_row
from sikao_api.modules.review.application.audit import (
    log_review_cause_analysis_cache_hit,
    log_review_cause_analysis_completed,
    persist_review_cause_analysis_failed,
    persist_review_cause_analysis_requested,
)
from sikao_api.modules.review.application.metrics import (
    increment_cause_cache_hit,
    increment_cause_failure,
    increment_cause_request,
    observe_cause_duration_ms,
)
from sikao_api.modules.system.application.errors import ConflictError

_ACTIVE_REVIEW_STATUSES = {
    ReviewItemStatus.PENDING.value,
    ReviewItemStatus.IN_PROGRESS.value,
    ReviewItemStatus.PROBATIONARY.value,
}
_CAUSE_ANALYSIS_PURPOSE = "review_cause_analysis"
_CAUSE_ANALYSIS_TTL_DAYS = 30


class ReviewCauseAnalysisService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.home_llm = HomeLlmService(session, settings)
        self.quotas = HomeLlmQuotaService(session, settings)

    async def analyze_single(
        self,
        *,
        user: UserV2,
        item_id: int,
        payload: CauseAnalysisRequestV2,
        idempotency_key: str,
        request_id: str | None = None,
    ) -> CauseAnalysisResponseV2:
        endpoint = f"POST /api/v2/review/items/{item_id}/cause-analysis"
        validate_idempotency_key(idempotency_key)
        request_hash = build_idempotent_request_hash(payload={"mode": payload.mode})
        replay = get_replay(
            self.session,
            user_id=user.id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            return CauseAnalysisResponseV2.model_validate(replay)
        claim = claim_idempotency_key(
            self.session,
            user_id=user.id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if claim is not None:
            return CauseAnalysisResponseV2.model_validate(claim)

        try:
            item = load_item_or_raise(self.session, user=user, item_id=item_id)
            question = load_question_or_raise(self.session, item)
            persist_review_cause_analysis_requested(
                self.session,
                user_id=user.id,
                scope="single",
                mode=payload.mode,
                review_item_id=item.id,
                request_id=request_id,
            )
            increment_cause_request(scope="single", mode=payload.mode)
            if payload.mode == "forced" and not bool(item.metadata_json.get("forced_cause_analysis_pending", False)):
                raise ConflictError(
                    "forced cause analysis is not pending for this item",
                    code="review_cause_analysis_mode_invalid",
                )
            tags = load_active_cause_tags(self.session)
            tag_map = {tag.slug: tag for tag in tags}
            single_context = build_single_analysis_context(
                self.session,
                user=user,
                item=item,
                question=question,
            )
            cached_row = load_cached_single_row(
                self.session,
                user_id=user.id,
                question_id=question.id,
                last_answer_hash=single_context["last_answer_hash"],
                current_confidence=single_context["current_confidence"],
                error_count=single_context["error_count"],
                mode=payload.mode,
            )
            if cached_row is not None:
                if payload.mode == "forced":
                    clear_forced_pending(item)
                    self.session.add(item)
                log_review_cause_analysis_cache_hit(
                    self.session,
                    user_id=user.id,
                    scope="single",
                    mode=payload.mode,
                    analysis_id=cached_row.id,
                    request_id=request_id,
                )
                increment_cause_cache_hit(scope="single", mode=payload.mode)
                response = serialize_analysis_row(cached_row, cached=True)
                store_replay(
                    self.session,
                    user_id=user.id,
                    endpoint=endpoint,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                    response_body=response.model_dump(mode="json", by_alias=True),
                )
                return response
            previous_analysis = load_previous_single_analysis(
                self.session,
                user_id=user.id,
                question_id=question.id,
            ) if payload.mode == "single" else None
            input_hash = compute_single_input_hash(
                user_id=user.id,
                question_id=question.id,
                last_answer_hash=single_context["last_answer_hash"],
                mode=payload.mode,
            )

            if payload.mode != "forced":
                self.quotas.check_quota(user_id=user.id, purpose=_CAUSE_ANALYSIS_PURPOSE)
            messages, prompt_version = self._build_single_messages(
                payload_mode=payload.mode,
                context=single_context,
                tags=tags,
                previous_analysis=previous_analysis,
            )
            started_at = monotonic()
            response = await execute_and_persist_single_analysis(
                self.session,
                settings=self.settings,
                home_llm=self.home_llm,
                user=user,
                item=item,
                question=question,
                input_hash=input_hash,
                previous_analysis=previous_analysis,
                mode=payload.mode,
                prompt_version=prompt_version,
                messages=messages,
                tag_map=tag_map,
                current_confidence=single_context["current_confidence"],
                last_answer_hash=single_context["last_answer_hash"],
                error_count=single_context["error_count"],
                related_questions=supplement_related_questions(
                    self.session,
                    exclude_question_ids={question.id},
                    category_pairs={(question.category_l1, question.category_l2)},
                ),
            )
            duration_ms = observe_cause_duration_ms(scope="single", mode=payload.mode, started_at=started_at)
            log_review_cause_analysis_completed(
                self.session,
                user_id=user.id,
                scope="single",
                mode=payload.mode,
                analysis_id=response.analysis_id,
                llm_call_id=response.llm_call_id,
                duration_ms=duration_ms,
                request_id=request_id,
            )
            store_replay(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_body=response.model_dump(mode="json", by_alias=True),
            )
            return response
        except Exception as exc:
            persist_review_cause_analysis_failed(
                self.session,
                user_id=user.id,
                scope="single",
                mode=payload.mode,
                error_type=type(exc).__name__,
                request_id=request_id,
            )
            increment_cause_failure(scope="single", mode=payload.mode, error_type=type(exc).__name__)
            release_idempotency_claim(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            raise

    async def analyze_group(
        self,
        *,
        user: UserV2,
        payload: CauseAnalysisGroupRequestV2,
        idempotency_key: str,
        request_id: str | None = None,
    ) -> CauseAnalysisResponseV2:
        endpoint = "POST /api/v2/review/cause-analysis/group"
        validate_idempotency_key(idempotency_key)
        request_payload = {"itemIds": sorted(payload.item_ids)}
        request_hash = build_idempotent_request_hash(payload=request_payload)
        replay = get_replay(
            self.session,
            user_id=user.id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            return CauseAnalysisResponseV2.model_validate(replay)
        claim = claim_idempotency_key(
            self.session,
            user_id=user.id,
            endpoint=endpoint,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if claim is not None:
            return CauseAnalysisResponseV2.model_validate(claim)

        try:
            items = load_group_items_or_raise(self.session, user=user, item_ids=payload.item_ids)
            persist_review_cause_analysis_requested(
                self.session,
                user_id=user.id,
                scope="group",
                mode="group",
                review_item_id=None,
                request_id=request_id,
            )
            increment_cause_request(scope="group", mode="group")
            tags = load_active_cause_tags(self.session)
            tag_map = {tag.slug: tag for tag in tags}
            prompt_summary, summary_block = build_group_context(self.session, user=user, items=items)
            signature = compute_group_question_ids_signature(
                question_ids=[int(item.question_id) for item in items if item.question_id is not None]
            )
            input_hash = compute_group_input_hash(
                user_id=user.id,
                question_ids_signature=signature,
                prompt_summary=prompt_summary,
            )
            cached_row = load_cached_group_row(
                self.session,
                user_id=user.id,
                question_ids_signature=signature,
                input_hash=input_hash,
            )
            if cached_row is not None:
                log_review_cause_analysis_cache_hit(
                    self.session,
                    user_id=user.id,
                    scope="group",
                    mode="group",
                    analysis_id=cached_row.id,
                    request_id=request_id,
                )
                increment_cause_cache_hit(scope="group", mode="group")
                response = serialize_analysis_row(cached_row, cached=True)
                store_replay(
                    self.session,
                    user_id=user.id,
                    endpoint=endpoint,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                    response_body=response.model_dump(mode="json", by_alias=True),
                )
                return response

            self.quotas.check_quota(user_id=user.id, purpose=_CAUSE_ANALYSIS_PURPOSE)
            messages = build_cause_analysis_group_messages(
                question_count=len(items),
                questions_summary_block=summary_block,
                taxonomy_block=render_taxonomy_block(tags),
            )
            question_ids = {
                int(item.question_id)
                for item in items
                if item.question_id is not None
            }
            category_pairs = {
                (
                    load_question_or_raise(self.session, item).category_l1,
                    load_question_or_raise(self.session, item).category_l2,
                )
                for item in items
            }
            started_at = monotonic()
            response = await execute_and_persist_group_analysis(
                self.session,
                settings=self.settings,
                home_llm=self.home_llm,
                user=user,
                question_ids_signature=signature,
                input_hash=input_hash,
                prompt_version=GROUP_PROMPT_VERSION,
                messages=messages,
                tag_map=tag_map,
                related_questions=supplement_related_questions(
                    self.session,
                    exclude_question_ids=question_ids,
                    category_pairs=category_pairs,
                ),
            )
            duration_ms = observe_cause_duration_ms(scope="group", mode="group", started_at=started_at)
            log_review_cause_analysis_completed(
                self.session,
                user_id=user.id,
                scope="group",
                mode="group",
                analysis_id=response.analysis_id,
                llm_call_id=response.llm_call_id,
                duration_ms=duration_ms,
                request_id=request_id,
            )
            store_replay(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_body=response.model_dump(mode="json", by_alias=True),
            )
            return response
        except Exception as exc:
            persist_review_cause_analysis_failed(
                self.session,
                user_id=user.id,
                scope="group",
                mode="group",
                error_type=type(exc).__name__,
                request_id=request_id,
            )
            increment_cause_failure(scope="group", mode="group", error_type=type(exc).__name__)
            release_idempotency_claim(
                self.session,
                user_id=user.id,
                endpoint=endpoint,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            raise


    def _build_single_messages(
        self,
        *,
        payload_mode: str,
        context: dict[str, Any],
        tags: list[CauseTagDefinition],
        previous_analysis: AiCauseAnalysisV2 | None,
    ) -> tuple[list[Any], str]:
        taxonomy_block = render_taxonomy_block(tags)
        if payload_mode == "forced":
            return (
                build_cause_analysis_forced_messages(
                    question_type=context["question_type"],
                    category_l1=context["category_l1"],
                    category_l2=context["category_l2"],
                    question_body=context["question_body"],
                    options_text=context["options_text"],
                    correct_answer=context["correct_answer"],
                    explanation=context["explanation"],
                    error_count=context["error_count"],
                    answer_history_block=context["answer_history_block"],
                    confidence_history=context["confidence_history"],
                    avg_duration_s=context["avg_duration_s"],
                    duration_ratio=context["duration_ratio"],
                    mismatch_count=context["mismatch_count"],
                    taxonomy_block=taxonomy_block,
                ),
                FORCED_PROMPT_VERSION,
            )
        evolution_block = (
            None
            if previous_analysis is None
            else build_evolution_context_block(
                dict(previous_analysis.result_json),
                previous_analysis_id=previous_analysis.id,
                previous_analyzed_at=previous_analysis.created_at,
            )
        )
        return (
            build_cause_analysis_single_messages(
                question_type=context["question_type"],
                category_l1=context["category_l1"],
                category_l2=context["category_l2"],
                question_body=context["question_body"],
                options_text=context["options_text"],
                correct_answer=context["correct_answer"],
                explanation=context["explanation"],
                error_count=context["error_count"],
                answer_history_block=context["answer_history_block"],
                confidence_history=context["confidence_history"],
                avg_duration_s=context["avg_duration_s"],
                duration_ratio=context["duration_ratio"],
                taxonomy_block=taxonomy_block,
                evolution_context_block=evolution_block,
            ),
            SINGLE_PROMPT_VERSION,
        )
