from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import AiGeneratedQuestionRequestV2, UserV2
from sikao_api.db.schemas_v2 import AiQuestionsGenerateResponseV2
from sikao_api.modules.ai_questions.application.llm_orchestrator import generate_with_audit
from sikao_api.modules.ai_questions.application.persist import save_with_dedupe
from sikao_api.modules.ai_questions.application.pool_query import (
    load_answered_question_ids,
    query_pool_done,
    query_pool_not_done,
)
from sikao_api.modules.ai_questions.application.quota import AiQuestionsQuotaService
from sikao_api.modules.ai_questions.domain.errors import AI_REQUEST_NOT_FOUND, AI_REQUEST_NOT_READY
from sikao_api.modules.ai_questions.domain.types import AiGenerateConfig
from sikao_api.modules.ai_questions.interface.schemas import AiQuestionRequestDetailV2, AiQuestionsGenerateConfigV2
from sikao_api.modules.llm.application.idempotency import (
    build_idempotent_request_hash,
    claim_idempotency_key,
    get_replay,
    release_idempotency_claim,
    store_replay,
    validate_idempotency_key,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError, LLMServiceError, NotFoundError, ValidationError


class AiQuestionsService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.quota = AiQuestionsQuotaService(session)

    def generate(
        self,
        *,
        user: UserV2,
        config: AiQuestionsGenerateConfigV2,
        idempotency_key: str,
        request_id: str | None,
    ) -> AiQuestionsGenerateResponseV2:
        self._validate_idempotency_key(idempotency_key)
        payload = {"config": config.model_dump(mode="json")}
        request_hash = build_idempotent_request_hash(payload=payload)
        replay = get_replay(
            self.session,
            user_id=user.id,
            endpoint="practice.ai_questions.generate",
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            return AiQuestionsGenerateResponseV2.model_validate(replay)

        runtime_config = self._to_runtime_config(user_id=user.id, config=config)
        self.quota.check_quota(user_id=user.id)
        claim_idempotency_key(
            self.session,
            user_id=user.id,
            endpoint="practice.ai_questions.generate",
            idempotency_key=idempotency_key,
            request_hash=request_hash,
        )

        started = datetime.now(UTC).replace(tzinfo=None)
        request_row: AiGeneratedQuestionRequestV2 | None = None

        try:
            request_row = self._create_request_record(config=runtime_config)
            not_done = query_pool_not_done(
                self.session,
                config=runtime_config,
                limit=runtime_config.count,
            )
            if len(not_done) >= runtime_config.count:
                response = self._complete_from_pool(
                    user=user,
                    request_row=request_row,
                    question_ids=[question.id for question in not_done],
                    started=started,
                    request_id=request_id,
                )
            else:
                already_done = []
                if not runtime_config.exclude_already_done:
                    already_done = query_pool_done(
                        self.session,
                        config=runtime_config,
                        limit=runtime_config.count - len(not_done),
                        exclude_ids=[question.id for question in not_done],
                    )
                pool_total = not_done + already_done
                if len(pool_total) >= runtime_config.count:
                    response = self._complete_from_pool(
                        user=user,
                        request_row=request_row,
                        question_ids=[question.id for question in pool_total],
                        started=started,
                        request_id=request_id,
                    )
                else:
                    llm_bundle = generate_with_audit(
                        self.session,
                        settings=self.settings,
                        config=runtime_config,
                        count=runtime_config.count - len(pool_total),
                    )
                    excluded_ids = (
                        load_answered_question_ids(self.session, user_id=user.id)
                        if runtime_config.exclude_already_done
                        else None
                    )
                    llm_ids = save_with_dedupe(
                        self.session,
                        generated_questions=llm_bundle.questions,
                        excluded_existing_ids=excluded_ids,
                    )
                    if len(pool_total) + len(llm_ids) < runtime_config.count:
                        raise LLMServiceError(
                            "question generation did not produce enough unseen questions",
                            code="AI_AUDIT_FAILED",
                        )
                    response = self._complete_with_llm(
                        user=user,
                        request_row=request_row,
                        pool_question_ids=[question.id for question in pool_total],
                        llm_generated_question_ids=llm_ids,
                        llm_call_id=llm_bundle.llm_call_id,
                        llm_self_audit_passed_count=llm_bundle.self_audit_passed_count,
                        started=started,
                        request_id=request_id,
                    )

            store_replay(
                self.session,
                user_id=user.id,
                endpoint="practice.ai_questions.generate",
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                response_body=response.model_dump(mode="json"),
            )
            self.session.commit()
            return response
        except Exception as exc:
            if request_row is not None:
                request_row.status = "failed"
                request_row.error_message = str(exc)
                request_row.completed_at = datetime.now(UTC).replace(tzinfo=None)
                request_row.duration_ms = int((request_row.completed_at - request_row.started_at).total_seconds() * 1000)
                self.session.add(request_row)
                self.session.commit()
            release_idempotency_claim(
                self.session,
                user_id=user.id,
                endpoint="practice.ai_questions.generate",
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            raise

    def get_request_detail(
        self,
        *,
        user: UserV2,
        request_id: int,
    ) -> AiQuestionRequestDetailV2:
        row = self.session.scalar(
            select(AiGeneratedQuestionRequestV2).where(
                AiGeneratedQuestionRequestV2.id == request_id,
                AiGeneratedQuestionRequestV2.user_id == user.id,
            )
        )
        if row is None:
            raise NotFoundError("ai question request not found", code=AI_REQUEST_NOT_FOUND)
        return AiQuestionRequestDetailV2(
            id=row.id,
            status=row.status,
            request_params=row.request_params,
            pool_question_ids=list(row.pool_question_ids),
            llm_generated_question_ids=list(row.llm_generated_question_ids),
            llm_self_audit_passed_count=row.llm_self_audit_passed_count,
            llm_call_id=row.llm_call_id,
            error_message=row.error_message,
            started_at=row.started_at,
            completed_at=row.completed_at,
            duration_ms=row.duration_ms,
        )

    def load_generated_question_ids(
        self,
        *,
        user_id: int,
        ai_request_id: int,
    ) -> list[int]:
        row = self.session.scalar(
            select(AiGeneratedQuestionRequestV2).where(
                AiGeneratedQuestionRequestV2.id == ai_request_id,
                AiGeneratedQuestionRequestV2.user_id == user_id,
            )
        )
        if row is None:
            raise NotFoundError("ai question request not found", code=AI_REQUEST_NOT_FOUND)
        if row.status not in {"partial_pool", "llm_generated"}:
            raise ConflictError("ai question request not ready", code=AI_REQUEST_NOT_READY)
        return list(row.pool_question_ids) + list(row.llm_generated_question_ids)

    def _to_runtime_config(
        self,
        *,
        user_id: int,
        config: AiQuestionsGenerateConfigV2,
    ) -> AiGenerateConfig:
        if config.type != "xingce":
            raise ValidationError(
                "essay ai question generation is not implemented yet",
                code="ai_question_track_unsupported",
            )
        return AiGenerateConfig(
            user_id=user_id,
            type=config.type,
            category_l1=config.category_l1,
            category_l2=config.category_l2,
            year_range=config.year_range,
            difficulty_range=config.difficulty_range,
            count=config.count,
            exclude_already_done=config.exclude_already_done,
            only_wrong=config.only_wrong,
        )

    def _create_request_record(self, *, config: AiGenerateConfig) -> AiGeneratedQuestionRequestV2:
        row = AiGeneratedQuestionRequestV2(
            user_id=config.user_id,
            request_params={
                "type": config.type,
                "category_l1": config.category_l1,
                "category_l2": config.category_l2,
                "year_range": config.year_range,
                "difficulty_range": list(config.difficulty_range),
                "count": config.count,
                "exclude_already_done": config.exclude_already_done,
                "only_wrong": config.only_wrong,
            },
            status="pending",
        )
        self.session.add(row)
        self.session.flush()
        return row

    def _complete_from_pool(
        self,
        *,
        user: UserV2,
        request_row: AiGeneratedQuestionRequestV2,
        question_ids: list[int],
        started: datetime,
        request_id: str | None,
    ) -> AiQuestionsGenerateResponseV2:
        completed_at = datetime.now(UTC).replace(tzinfo=None)
        request_row.status = "partial_pool"
        request_row.pool_question_ids = list(question_ids)
        request_row.llm_generated_question_ids = []
        request_row.completed_at = completed_at
        request_row.duration_ms = int((completed_at - started).total_seconds() * 1000)
        self.session.add(request_row)
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="ai_question.request.completed_from_pool",
            target_type="ai_generated_question_request_v2",
            target_id=request_row.id,
            after={
                "status": request_row.status,
                "pool_question_ids": list(question_ids),
            },
            request_id=request_id,
            ip=None,
        )
        return AiQuestionsGenerateResponseV2(
            request_id=request_row.id,
            question_ids=list(question_ids),
            status=request_row.status,
            duration_ms=request_row.duration_ms or 0,
            pool_count=len(question_ids),
            llm_generated_count=0,
        )

    def _complete_with_llm(
        self,
        *,
        user: UserV2,
        request_row: AiGeneratedQuestionRequestV2,
        pool_question_ids: list[int],
        llm_generated_question_ids: list[int],
        llm_call_id: int | None,
        llm_self_audit_passed_count: int,
        started: datetime,
        request_id: str | None,
    ) -> AiQuestionsGenerateResponseV2:
        completed_at = datetime.now(UTC).replace(tzinfo=None)
        request_row.status = "llm_generated"
        request_row.pool_question_ids = list(pool_question_ids)
        request_row.llm_generated_question_ids = list(llm_generated_question_ids)
        request_row.llm_self_audit_passed_count = llm_self_audit_passed_count
        request_row.llm_call_id = llm_call_id
        request_row.completed_at = completed_at
        request_row.duration_ms = int((completed_at - started).total_seconds() * 1000)
        self.session.add(request_row)
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="ai_question.request.completed_with_llm",
            target_type="ai_generated_question_request_v2",
            target_id=request_row.id,
            after={
                "status": request_row.status,
                "pool_question_ids": list(pool_question_ids),
                "llm_generated_question_ids": list(llm_generated_question_ids),
                "llm_call_id": llm_call_id,
            },
            request_id=request_id,
            ip=None,
        )
        question_ids = list(pool_question_ids) + list(llm_generated_question_ids)
        return AiQuestionsGenerateResponseV2(
            request_id=request_row.id,
            question_ids=question_ids,
            status=request_row.status,
            duration_ms=request_row.duration_ms or 0,
            pool_count=len(pool_question_ids),
            llm_generated_count=len(llm_generated_question_ids),
        )

    def _validate_idempotency_key(self, key: str) -> None:
        validate_idempotency_key(key)
