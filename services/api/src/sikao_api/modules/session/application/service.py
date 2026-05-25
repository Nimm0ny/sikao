from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from sikao_api.modules.admin.application.exam_support import is_answer_correct, normalize_answer_keys
from sikao_api.db.models_v2 import DailyPracticeV2, EssaySubmissionV2, PaperRevisionV2, PaperV2, PlanEventV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionFlagV2, QuestionV2, UserV2
from sikao_api.modules.essay_grading.application.service import PracticeEssayGradingService
from sikao_api.db.schemas_v2 import ActionLinkV2, PracticeAnswerPayloadV2, PracticeSessionCreateRequestV2, PracticeSessionEnvelopeV2, PracticeSessionItemV2, PracticeSessionResultResponseV2, SectionCardV2, SummaryMetricV2
from sikao_api.modules.daily_practice.application.state_sync import sync_daily_completion
from sikao_api.modules.mock_exam.application.enforcer import assert_mock_exam_started
from sikao_api.modules.session.application.answer_flag_ops import promote_flagged_answers
from sikao_api.modules.session.application.mode_dispatcher import SessionSelection, resolve_session_selection
from sikao_api.modules.session_lifecycle.application.state_machine import evaluate_transition
from sikao_api.modules.session_lifecycle.domain.types import SessionActor, SessionTrigger, SessionStatus
from sikao_api.modules.session_lifecycle.domain.types import TransitionAttempt
from sikao_api.modules.session_lifecycle.application.transition_support import apply_transition
from sikao_api.modules.timing.application.submit_summary import apply_submit_timing_summary
from sikao_api.modules.plans.domain.rrule_subset import build_occurrence_ref, end_of_local_day, expand_occurrences, parse_occurrence_ref, start_of_local_day
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError


class SessionServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_session(
        self, *, user: UserV2, payload: PracticeSessionCreateRequestV2
    ) -> PracticeSessionV2:
        if payload.linked_plan_event_occurrence_ref and payload.linked_plan_event_id is None:
            raise ValidationError(
                "linked_plan_event_occurrence_ref requires linked_plan_event_id",
                code="practice_session_occurrence_link_requires_event",
            )
        if payload.linked_recommendation_id is not None and payload.linked_plan_event_id is not None:
            raise ValidationError(
                "linked_recommendation_id cannot be combined with linked_plan_event_id",
                code="practice_session_link_conflict",
            )
        linked_event, is_virtual_occurrence = self._resolve_linked_event(
            user=user,
            linked_plan_event_id=payload.linked_plan_event_id,
            linked_plan_event_occurrence_ref=payload.linked_plan_event_occurrence_ref,
        )
        selection = resolve_session_selection(self.session, user=user, payload=payload)
        self._claim_daily_selection_if_needed(selection=selection)
        paper_id, revision_id = self._resolve_paper_binding(payload.paper_code)
        selected_questions = self._resolve_questions(
            question_ids=payload.question_ids,
            revision_id=revision_id,
            fallback_questions=selection.questions,
        )
        practice_session = PracticeSessionV2(
            user_id=user.id,
            track=payload.track,
            entry_kind=payload.entry_kind,
            status="draft",
            paper_id=paper_id,
            revision_id=revision_id,
            payload_json=payload.payload,
            practice_mode=self._resolve_practice_mode(
                payload=payload,
                selection=selection,
            ),
            source_mode=selection.source_mode,
            config_snapshot=selection.config_snapshot,
            expires_at=selection.expires_at,
            linked_plan_event_id=payload.linked_plan_event_id,
            linked_plan_event_occurrence_ref=payload.linked_plan_event_occurrence_ref,
            linked_recommendation_id=payload.linked_recommendation_id,
        )
        self.session.add(practice_session)
        self.session.flush()
        if linked_event is not None and not is_virtual_occurrence:
            linked_event.linked_session_id = practice_session.id
            if linked_event.status == "planned":
                linked_event.status = "in_progress"
            self.session.add(linked_event)
        for display_order, question in enumerate(selected_questions, start=1):
            self.session.add(
                PracticeSessionAnswerV2(
                    session_id=practice_session.id,
                    question_id=question.id,
                    question_key=str(question.id),
                    display_order=display_order,
                    response_json={},
                )
            )
        return practice_session

    def get_session(self, *, user: UserV2, session_id: int) -> PracticeSessionV2:
        practice_session = self.session.scalar(
            select(PracticeSessionV2).where(
                PracticeSessionV2.id == session_id, PracticeSessionV2.user_id == user.id
            )
        )
        if practice_session is None:
            raise NotFoundError("practice session not found", code="practice_session_not_found")
        return practice_session

    def save_answers(
        self,
        *,
        practice_session: PracticeSessionV2,
        answers: list[PracticeAnswerPayloadV2],
        request_id: str | None = None,
    ) -> None:
        practice_session = self._lock_session_row(practice_session.id)
        self._ensure_session_is_writable(practice_session)
        assert_mock_exam_started(practice_session)
        self._ensure_distinct_answer_keys(answers)
        if not answers:
            self._ensure_session_not_submitted(practice_session.id)
            return

        existing = self._load_existing_answers(practice_session.id)
        if existing:
            self._ensure_allowed_question_keys(
                existing_keys=set(existing),
                answers=answers,
            )
        else:
            self._claim_initial_scope(practice_session.id)

        for index, answer in enumerate(answers, start=1):
            row = existing.get(answer.question_key)
            if row is None:
                row = PracticeSessionAnswerV2(
                    session_id=practice_session.id,
                    question_id=self._resolve_new_answer_question_id(
                        practice_session=practice_session,
                        question_key=answer.question_key,
                    ),
                    question_key=answer.question_key,
                    display_order=index,
                    response_json=answer.answer,
                    duration_seconds=answer.duration_seconds,
                )
                self.session.add(row)
            else:
                row.response_json = answer.answer
                row.duration_seconds = answer.duration_seconds
                row.answered_at = datetime.now(UTC).replace(tzinfo=None)
                self.session.add(row)

        if practice_session.status == "draft":
            apply_transition(
                self.session,
                practice_session=practice_session,
                trigger="first_answer",
                actor="user",
                actor_id=str(practice_session.user_id),
                request_id=request_id,
            )
        elif practice_session.status == "paused":
            apply_transition(
                self.session,
                practice_session=practice_session,
                trigger="answer_during_paused",
                actor="user",
                actor_id=str(practice_session.user_id),
                request_id=request_id,
            )
        elif existing:
            self._mark_session_in_progress(practice_session.id)
        practice_session.last_activity_at = datetime.now(UTC).replace(tzinfo=None)
        self.session.add(practice_session)

    def submit(
        self,
        *,
        practice_session: PracticeSessionV2,
        force_submitted_reason: str | None = None,
    ) -> None:
        practice_session = self._lock_session_row(practice_session.id)
        expected_status = practice_session.status
        if expected_status == "submitted":
            raise ConflictError(
                "practice session already submitted",
                code="practice_session_submitted",
            )
        if expected_status in {"abandoned", "expired"}:
            raise ConflictError(
                "practice session is not writable",
                code="SESSION_NOT_WRITABLE",
            )
        trigger: SessionTrigger = "force_submit" if force_submitted_reason is not None else "user_submit"
        actor: SessionActor = "system" if force_submitted_reason is not None else "user"
        transition = evaluate_transition(
            TransitionAttempt(
                from_status=cast(SessionStatus, expected_status),
                trigger=trigger,
                actor=actor,
            )
        )
        if not transition.ok or transition.new_status != "submitted":
            raise ConflictError(
                "invalid session transition",
                code=transition.error_code or "INVALID_TRANSITION",
            )
        submitted_at = self._resolve_submitted_at(
            practice_session=practice_session,
            force_submitted_reason=force_submitted_reason,
        )
        paused_total_seconds = practice_session.paused_total_seconds
        paused_at = practice_session.paused_at
        if expected_status == "paused" and paused_at is not None:
            paused_total_seconds += int((submitted_at - paused_at).total_seconds())
        delayed_review_until = self._resolve_delayed_review_until(
            practice_session=practice_session,
            submitted_at=submitted_at,
        )
        self._refresh_objective_answer_correctness(practice_session=practice_session)
        practice_session.paused_total_seconds = paused_total_seconds
        apply_submit_timing_summary(
            self.session,
            practice_session=practice_session,
            submitted_at=submitted_at,
        )
        practice_session.status = "submitted"
        practice_session.submitted_at = submitted_at
        practice_session.force_submitted = force_submitted_reason is not None
        practice_session.force_submitted_reason = force_submitted_reason
        practice_session.delayed_review_until = delayed_review_until
        practice_session.paused_at = None
        practice_session.paused_total_seconds = paused_total_seconds
        practice_session.last_activity_at = submitted_at
        self.session.add(practice_session)
        add_audit_log(
            self.session,
            user_id=practice_session.user_id,
            actor_type="system" if force_submitted_reason is not None else "user",
            actor_id="session.submit" if force_submitted_reason is not None else str(practice_session.user_id),
            action="session.force_submitted" if force_submitted_reason is not None else "session.user_submit",
            target_type="practice_session_v2",
            target_id=practice_session.id,
            before={"status": expected_status},
            after={"status": "submitted"},
            metadata={"trigger": trigger, "reason": force_submitted_reason}
            if force_submitted_reason is not None
            else {"trigger": trigger},
            request_id=None,
            ip=None,
        )
        essay_submission = PracticeEssayGradingService(
            self.session,
        ).ensure_submission_for_session(practice_session=practice_session)
        sync_daily_completion(self.session, practice_session=practice_session)
        user = self.session.get(UserV2, practice_session.user_id)
        if user is not None:
            promote_flagged_answers(
                self.session,
                user=user,
                practice_session=practice_session,
            )
        if practice_session.linked_plan_event_id is not None and practice_session.linked_plan_event_occurrence_ref is None:
            linked_event = self.session.scalar(
                select(PlanEventV2).where(
                    PlanEventV2.id == practice_session.linked_plan_event_id,
                    PlanEventV2.user_id == practice_session.user_id,
                    PlanEventV2.deleted_at.is_(None),
                )
            )
            if linked_event is not None:
                linked_event.status = "done" if submitted_at >= linked_event.end_at else "in_progress"
                linked_event.linked_session_id = practice_session.id
                self.session.add(linked_event)
        if essay_submission is not None:
            self.session.add(essay_submission)

    def _claim_daily_selection_if_needed(self, *, selection: SessionSelection) -> None:
        if selection.source_mode != "daily":
            return
        daily_id = selection.config_snapshot.get("daily_practice_id")
        if not isinstance(daily_id, int):
            raise ValidationError(
                "daily session missing daily_practice_id",
                code="daily_practice_not_found",
            )
        now = datetime.now(UTC).replace(tzinfo=None)
        result = self.session.execute(
            update(DailyPracticeV2)
            .where(
                DailyPracticeV2.id == daily_id,
                DailyPracticeV2.status == "pending",
                DailyPracticeV2.completed_session_id.is_(None),
                DailyPracticeV2.expired_at > now,
            )
            .values(
                status="started",
                started_at=func.coalesce(DailyPracticeV2.started_at, now),
            )
            .execution_options(synchronize_session=False)
        )
        if getattr(result, "rowcount", None) == 1:
            return
        current = self.session.get(DailyPracticeV2, daily_id)
        if current is None or current.completed_session_id is not None or current.expired_at <= now:
            raise NotFoundError("daily practice not found", code="daily_practice_not_found")
        raise ConflictError(
            "daily practice already started",
            code="daily_practice_already_started",
        )

    def build_session_response(self, *, practice_session: PracticeSessionV2) -> PracticeSessionEnvelopeV2:
        answers = list(
            self.session.scalars(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == practice_session.id
                ).order_by(PracticeSessionAnswerV2.display_order.asc())
            )
        )
        questions_by_id = self._load_questions_for_answers(answers)
        persistent_question_ids = self._load_persistent_flag_question_ids(
            user_id=practice_session.user_id,
            answers=answers,
        )
        essay_submission_id = self._resolve_essay_submission_id(
            practice_session=practice_session
        )
        return PracticeSessionEnvelopeV2(
            id=practice_session.id,
            track=practice_session.track,
            entry_kind=practice_session.entry_kind,
            status=practice_session.status,
            essay_submission_id=essay_submission_id,
            items=[
                self._build_session_item(
                    answer=answer,
                    questions_by_id=questions_by_id,
                    persistent_question_ids=persistent_question_ids,
                )
                for answer in answers
            ],
            actions=[
                ActionLinkV2(
                    key="submit",
                    label="Submit session",
                    href=f"/api/v2/practice/sessions/{practice_session.id}/submit",
                )
            ],
            started_at=practice_session.started_at,
            practice_mode=practice_session.practice_mode,
            source_mode=practice_session.source_mode,
            config_snapshot=practice_session.config_snapshot,
            submitted_at=practice_session.submitted_at,
        )

    def build_result_response(
        self, *, practice_session: PracticeSessionV2
    ) -> PracticeSessionResultResponseV2:
        answers = list(
            self.session.scalars(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == practice_session.id
                )
            )
        )
        answered_count = sum(
            1 for answer in answers if self._has_meaningful_answer(answer.response_json)
        )
        return PracticeSessionResultResponseV2(
            summary=[
                SummaryMetricV2(key="track", label="Track", value=practice_session.track),
                SummaryMetricV2(key="status", label="Status", value=practice_session.status),
                SummaryMetricV2(key="answered", label="Answered", value=str(answered_count)),
            ],
            sections=[
                SectionCardV2(
                    key="result",
                    title="Skeleton result",
                    description="Phase 1 backend result placeholder.",
                    status="empty",
                    href=f"/practice/sessions/{practice_session.id}",
                )
            ],
            actions=[
                ActionLinkV2(
                    key="review",
                    label="Open review",
                    href=self._build_result_action_href(practice_session=practice_session),
                )
            ],
        )

    def _build_result_action_href(self, *, practice_session: PracticeSessionV2) -> str:
        if practice_session.track != "essay":
            return "/wrong-book"
        if self._resolve_essay_submission_id(practice_session=practice_session) is None:
            return f"/practice/sessions/{practice_session.id}"
        return f"/practice/sessions/{practice_session.id}/grading"

    def _resolve_essay_submission_id(
        self,
        *,
        practice_session: PracticeSessionV2,
    ) -> int | None:
        if practice_session.track != "essay":
            return None
        return self.session.scalar(
            select(EssaySubmissionV2.id).where(
                EssaySubmissionV2.practice_session_id == practice_session.id
            )
        )

    def _resolve_paper_binding(self, paper_code: str | None) -> tuple[int | None, int | None]:
        if paper_code is None:
            return None, None

        paper = self.session.scalar(
            select(PaperV2).where(PaperV2.paper_code == paper_code)
        )
        if paper is None:
            raise NotFoundError("paper not found", code="paper_not_found")

        revision = self.session.scalar(
            select(PaperRevisionV2)
            .where(
                PaperRevisionV2.paper_id == paper.id,
                PaperRevisionV2.status == "published",
            )
            .order_by(PaperRevisionV2.revision_number.desc(), PaperRevisionV2.id.desc())
        )
        if revision is None:
            raise NotFoundError("paper revision not found", code="paper_revision_not_found")
        return paper.id, revision.id

    def _resolve_questions(
        self,
        *,
        question_ids: list[int],
        revision_id: int | None,
        fallback_questions: list[QuestionV2],
    ) -> list[QuestionV2]:
        if fallback_questions:
            return fallback_questions
        if not question_ids:
            if revision_id is None:
                return []
            return list(
                self.session.scalars(
                    select(QuestionV2)
                    .where(QuestionV2.revision_id == revision_id)
                    .order_by(QuestionV2.item_no.asc(), QuestionV2.id.asc())
                )
            )
        self._ensure_distinct_question_ids(question_ids)
        if revision_id is None:
            raise ValidationError(
                "question ids require paper-bound session",
                code="practice_session_question_ids_require_paper_code",
            )

        ordered_ids = list(question_ids)
        questions = list(
            self.session.scalars(
                select(QuestionV2).where(QuestionV2.id.in_(ordered_ids))
            )
        )
        questions_by_id = {question.id: question for question in questions}
        if len(questions_by_id) != len(ordered_ids):
            raise ValidationError("question ids not found", code="question_not_found")

        ordered_questions = [questions_by_id[question_id] for question_id in ordered_ids]
        if revision_id is not None:
            for question in ordered_questions:
                if question.revision_id != revision_id:
                    raise ValidationError(
                        "paper code and question ids do not match",
                        code="paper_code_mismatch",
                    )
        return ordered_questions

    def _refresh_objective_answer_correctness(
        self,
        *,
        practice_session: PracticeSessionV2,
    ) -> None:
        if practice_session.track == "essay":
            return
        answers = list(
            self.session.scalars(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == practice_session.id
                )
            )
        )
        question_ids = {
            int(answer.question_id)
            for answer in answers
            if answer.question_id is not None
        }
        if not question_ids:
            return
        questions_by_id = {
            question.id: question
            for question in self.session.scalars(
                select(QuestionV2).where(QuestionV2.id.in_(question_ids))
            )
        }
        for answer in answers:
            if answer.question_id is None:
                continue
            question = questions_by_id.get(int(answer.question_id))
            if question is None:
                continue
            answer.is_correct = self._compute_answer_correctness(
                question=question,
                response_json=answer.response_json,
            )
            self.session.add(answer)

    def _compute_answer_correctness(
        self,
        *,
        question: QuestionV2,
        response_json: Mapping[str, Any],
    ) -> bool | None:
        if question.answer_kind not in {"single_choice", "multiple_choice", "checkbox"}:
            return None
        selected_keys = self._extract_selected_answer_keys(response_json)
        if not selected_keys:
            return None
        correct_keys = self._extract_correct_answer_keys(question)
        if not correct_keys:
            return None
        return is_answer_correct(selected_keys, correct_keys)

    def _extract_selected_answer_keys(self, response_json: Mapping[str, Any]) -> list[str]:
        raw_selected = response_json.get("selected")
        if isinstance(raw_selected, str):
            return normalize_answer_keys([raw_selected])
        if isinstance(raw_selected, Sequence) and not isinstance(raw_selected, (str, bytes, bytearray)):
            return normalize_answer_keys([str(item) for item in raw_selected])
        raw_single = response_json.get("selectedAnswer")
        if isinstance(raw_single, str):
            return normalize_answer_keys([raw_single])
        raw_keys = response_json.get("selectedAnswerKeys")
        if isinstance(raw_keys, Sequence) and not isinstance(raw_keys, (str, bytes, bytearray)):
            return normalize_answer_keys([str(item) for item in raw_keys])
        return []

    def _extract_answer_text(self, response_json: Mapping[str, Any]) -> str | None:
        candidates = (
            response_json.get("text"),
            response_json.get("answerText"),
            response_json.get("content"),
        )
        for candidate in candidates:
            if not isinstance(candidate, str):
                continue
            normalized = candidate.strip()
            if normalized:
                return normalized
        return None

    def _extract_correct_answer_keys(self, question: QuestionV2) -> list[str]:
        content_json = question.content_json if isinstance(question.content_json, Mapping) else {}
        candidates = (
            content_json.get("correct_answer"),
            content_json.get("correctAnswer"),
            content_json.get("answerText"),
        )
        for candidate in candidates:
            keys = self._normalize_correct_answer_value(candidate)
            if keys:
                return keys
        return []

    def _normalize_correct_answer_value(self, raw_value: object) -> list[str]:
        if isinstance(raw_value, Sequence) and not isinstance(raw_value, (str, bytes, bytearray)):
            return normalize_answer_keys([str(item) for item in raw_value])
        if not isinstance(raw_value, str):
            return []
        value = raw_value.strip().upper()
        if not value:
            return []
        if "," in value:
            return normalize_answer_keys([part for part in value.split(",") if part.strip()])
        if len(value) > 1 and value.isalpha():
            return normalize_answer_keys(list(value))
        return normalize_answer_keys([value])

    def _ensure_session_not_submitted(self, session_id: int) -> None:
        status = self.session.scalar(
            select(PracticeSessionV2.status).where(PracticeSessionV2.id == session_id)
        )
        if status == "submitted":
            raise ConflictError(
                "practice session already submitted",
                code="practice_session_submitted",
            )

    def _ensure_session_not_terminal(self, practice_session: PracticeSessionV2) -> None:
        if practice_session.status in {"abandoned", "expired"}:
            raise ConflictError(
                "practice session is not writable",
                code="SESSION_NOT_WRITABLE",
            )

    def _ensure_session_is_writable(self, practice_session: PracticeSessionV2) -> None:
        if practice_session.status == "submitted":
            raise ConflictError(
                "practice session already submitted",
                code="practice_session_submitted",
            )
        self._ensure_session_not_terminal(practice_session)

    def _resolve_delayed_review_until(
        self,
        *,
        practice_session: PracticeSessionV2,
        submitted_at: datetime,
    ) -> datetime | None:
        if not practice_session.exam_mode:
            return None
        mock_config = practice_session.config_snapshot.get("mock_exam")
        if not isinstance(mock_config, Mapping):
            return None
        delayed_minutes = mock_config.get("delayed_review_minutes")
        if not isinstance(delayed_minutes, int) or delayed_minutes <= 0:
            return None
        return submitted_at + timedelta(minutes=delayed_minutes)

    def _resolve_submitted_at(
        self,
        *,
        practice_session: PracticeSessionV2,
        force_submitted_reason: str | None,
    ) -> datetime:
        if force_submitted_reason == "mock_exam_timeout" and practice_session.auto_submit_at is not None:
            return practice_session.auto_submit_at
        return datetime.now(UTC).replace(tzinfo=None)

    def _ensure_session_can_submit(
        self,
        *,
        practice_session: PracticeSessionV2,
        force_submitted_reason: str | None,
    ) -> None:
        if practice_session.status == "submitted":
            raise ConflictError(
                "practice session already submitted",
                code="practice_session_submitted",
            )
        self._ensure_session_not_terminal(practice_session)

    def _load_existing_answers(
        self, session_id: int
    ) -> dict[str, PracticeSessionAnswerV2]:
        return {
            row.question_key: row
            for row in self.session.scalars(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == session_id
                )
            )
        }

    def _claim_initial_scope(self, session_id: int) -> None:
        result = self.session.execute(
            update(PracticeSessionV2)
            .where(
                PracticeSessionV2.id == session_id,
                PracticeSessionV2.status == "draft",
                ~select(PracticeSessionAnswerV2.id)
                .where(PracticeSessionAnswerV2.session_id == session_id)
                .exists(),
            )
            .values(status="in_progress")
            .execution_options(synchronize_session=False)
        )
        if getattr(result, "rowcount", None) == 1:
            return

        status = self.session.scalar(
            select(PracticeSessionV2.status).where(PracticeSessionV2.id == session_id)
        )
        if status == "submitted":
            raise ConflictError(
                "practice session already submitted",
                code="practice_session_submitted",
            )
        raise ConflictError(
            "practice session scope already initialized",
            code="practice_session_scope_locked",
        )

    def _mark_session_in_progress(self, session_id: int) -> None:
        result = self.session.execute(
            update(PracticeSessionV2)
            .where(
                PracticeSessionV2.id == session_id,
                PracticeSessionV2.status != "submitted",
            )
            .values(status="in_progress")
            .execution_options(synchronize_session=False)
        )
        if getattr(result, "rowcount", None) != 1:
            raise ConflictError(
                "practice session already submitted",
                code="practice_session_submitted",
            )

    def _resolve_practice_mode(
        self,
        *,
        payload: PracticeSessionCreateRequestV2,
        selection: SessionSelection,
    ) -> str:
        if selection.source_mode == "wrong_redo":
            return "per_question"
        return payload.practice_mode

    def _lock_session_row(self, session_id: int) -> PracticeSessionV2:
        practice_session = self.session.scalar(
            select(PracticeSessionV2)
            .where(PracticeSessionV2.id == session_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if practice_session is None:
            raise NotFoundError("practice session not found", code="practice_session_not_found")
        return practice_session

    def _ensure_distinct_answer_keys(
        self, answers: list[PracticeAnswerPayloadV2]
    ) -> None:
        question_keys = [answer.question_key for answer in answers]
        if len(question_keys) != len(set(question_keys)):
            raise ValidationError(
                "duplicate question keys are not allowed in one save request",
                code="practice_session_duplicate_question_key",
            )

    def _ensure_distinct_question_ids(self, question_ids: list[int]) -> None:
        if len(question_ids) != len(set(question_ids)):
            raise ValidationError(
                "duplicate question ids are not allowed in one create request",
                code="practice_session_duplicate_question_id",
            )

    def _ensure_allowed_question_keys(
        self,
        *,
        existing_keys: set[str],
        answers: list[PracticeAnswerPayloadV2],
    ) -> None:
        for answer in answers:
            if answer.question_key not in existing_keys:
                raise ValidationError(
                    "question key is outside this session scope",
                    code="practice_session_question_key_not_allowed",
                )

    def _resolve_linked_event(
        self,
        *,
        user: UserV2,
        linked_plan_event_id: int | None,
        linked_plan_event_occurrence_ref: str | None,
    ) -> tuple[PlanEventV2 | None, bool]:
        if linked_plan_event_id is None:
            return None, False
        event = self.session.scalar(
            select(PlanEventV2).where(
                PlanEventV2.id == linked_plan_event_id,
                PlanEventV2.user_id == user.id,
                PlanEventV2.deleted_at.is_(None),
            )
        )
        if event is None:
            raise NotFoundError("linked plan event not found", code="plan_event_not_found")
        if linked_plan_event_occurrence_ref is None:
            if event.recurring_rule is not None:
                raise ValidationError(
                    "recurring event links require linked_plan_event_occurrence_ref",
                    code="practice_session_occurrence_ref_required",
                )
            return event, False
        if event.recurring_parent_id is not None:
            raise ValidationError(
                "detached events cannot use linked_plan_event_occurrence_ref",
                code="practice_session_occurrence_ref_invalid",
            )
        if event.recurring_rule is None:
            raise ValidationError(
                "non-recurring events cannot use linked_plan_event_occurrence_ref",
                code="practice_session_occurrence_ref_invalid",
            )
        parent_id, occurrence_day = parse_occurrence_ref(linked_plan_event_occurrence_ref)
        if parent_id != event.id:
            raise ValidationError(
                "linked_plan_event_occurrence_ref does not match linked_plan_event_id",
                code="practice_session_occurrence_ref_invalid",
            )
        occurrences = expand_occurrences(
            rule=event.recurring_rule,
            dtstart=event.start_at,
            range_start=start_of_local_day(occurrence_day, timezone=event.timezone),
            range_end=end_of_local_day(occurrence_day, timezone=event.timezone),
        )
        occurrence_refs = {
            build_occurrence_ref(parent_id=event.id, occurrence_start=occurrence_start, timezone=event.timezone)
            for occurrence_start in occurrences
        }
        if linked_plan_event_occurrence_ref not in occurrence_refs:
            raise ValidationError(
                "linked_plan_event_occurrence_ref is not a valid occurrence for this event",
                code="practice_session_occurrence_ref_invalid",
            )
        if occurrence_day.isoformat() in event.recurring_exception_dates:
            raise ValidationError(
                "linked_plan_event_occurrence_ref points to an excepted occurrence",
                code="practice_session_occurrence_ref_invalid",
            )
        return event, True

    def _build_session_item(
        self,
        *,
        answer: PracticeSessionAnswerV2,
        questions_by_id: dict[int, QuestionV2],
        persistent_question_ids: set[int] | None = None,
    ) -> PracticeSessionItemV2:
        question = questions_by_id.get(answer.question_id) if answer.question_id is not None else None
        if question is None:
            prompt = "Phase 1 skeleton session item"
            answer_kind = "placeholder"
        else:
            prompt = question.prompt
            answer_kind = question.answer_kind
        return PracticeSessionItemV2(
            id=str(answer.id),
            question_key=answer.question_key,
            prompt=prompt,
            answer_kind=answer_kind,
            status="answered" if self._has_meaningful_answer(answer.response_json) else "pending",
            selected_answer_keys=self._extract_selected_answer_keys(answer.response_json),
            answer_text=self._extract_answer_text(answer.response_json),
            flagged=answer.flagged,
            viewed_solution=answer.viewed_solution,
            has_persistent_flag=bool(
                answer.question_id is not None
                and persistent_question_ids is not None
                and answer.question_id in persistent_question_ids
            ),
        )

    def _resolve_new_answer_question_id(
        self,
        *,
        practice_session: PracticeSessionV2,
        question_key: str,
    ) -> int | None:
        if practice_session.revision_id is not None:
            if not question_key.isdigit():
                raise ValidationError(
                    "paper-bound session requires numeric question key",
                    code="practice_session_question_key_not_allowed",
                )
            question = self.session.scalar(
                select(QuestionV2).where(
                    QuestionV2.id == int(question_key),
                    QuestionV2.revision_id == practice_session.revision_id,
                )
            )
            if question is None:
                raise ValidationError(
                    "question key is outside this paper session scope",
                    code="practice_session_question_key_not_allowed",
                )
            return question.id

        if question_key.isdigit():
            raise ValidationError(
                "open session does not allow numeric question key binding",
                code="practice_session_question_key_not_allowed",
            )
        return None

    def _has_meaningful_answer(self, payload: Any) -> bool:
        if payload is None:
            return False
        if isinstance(payload, str):
            return payload.strip() != ""
        if isinstance(payload, Mapping):
            return any(self._has_meaningful_answer(value) for value in payload.values())
        if isinstance(payload, Sequence) and not isinstance(payload, (str, bytes, bytearray)):
            return any(self._has_meaningful_answer(value) for value in payload)
        return True

    def _load_questions_for_answers(
        self, answers: list[PracticeSessionAnswerV2]
    ) -> dict[int, QuestionV2]:
        question_ids = [answer.question_id for answer in answers if answer.question_id is not None]
        if not question_ids:
            return {}
        questions = list(
            self.session.scalars(
                select(QuestionV2).where(QuestionV2.id.in_(question_ids))
            )
        )
        return {question.id: question for question in questions}

    def _load_persistent_flag_question_ids(
        self,
        *,
        user_id: int,
        answers: list[PracticeSessionAnswerV2],
    ) -> set[int]:
        question_ids = [answer.question_id for answer in answers if answer.question_id is not None]
        if not question_ids:
            return set()
        return {
            int(question_id)
            for question_id in self.session.scalars(
                select(QuestionFlagV2.question_id).where(
                    QuestionFlagV2.user_id == user_id,
                    QuestionFlagV2.question_id.in_(question_ids),
                    QuestionFlagV2.resolved_at.is_(None),
                )
            )
            if question_id is not None
        }
