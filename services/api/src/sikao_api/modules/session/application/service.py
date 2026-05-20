from __future__ import annotations

from datetime import UTC, datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import ActionLinkV2, OperationAckV2, PracticeAnswerPayloadV2, PracticeSessionCreateRequestV2, PracticeSessionEnvelopeV2, PracticeSessionItemV2, PracticeSessionResultResponseV2, SectionCardV2, SummaryMetricV2
from sikao_api.modules.system.application.errors import NotFoundError


class SessionServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_session(
        self, *, user: UserV2, payload: PracticeSessionCreateRequestV2
    ) -> PracticeSessionV2:
        practice_session = PracticeSessionV2(
            user_id=user.id,
            track=payload.track,
            entry_kind=payload.entry_kind,
            status="draft",
            payload_json=payload.payload,
        )
        self.session.add(practice_session)
        self.session.flush()
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
        self, *, practice_session: PracticeSessionV2, answers: list[PracticeAnswerPayloadV2]
    ) -> None:
        existing = {
            row.question_key: row
            for row in self.session.scalars(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == practice_session.id
                )
            )
        }
        for index, answer in enumerate(answers, start=1):
            row = existing.get(answer.question_key)
            if row is None:
                row = PracticeSessionAnswerV2(
                    session_id=practice_session.id,
                    question_key=answer.question_key,
                    display_order=index,
                    response_json=answer.answer,
                    duration_seconds=answer.duration_seconds,
                )
                self.session.add(row)
            else:
                row.display_order = index
                row.response_json = answer.answer
                row.duration_seconds = answer.duration_seconds
                row.answered_at = datetime.now(UTC).replace(tzinfo=None)
                self.session.add(row)
        practice_session.status = "in_progress"
        self.session.add(practice_session)

    def submit(self, *, practice_session: PracticeSessionV2) -> None:
        practice_session.status = "submitted"
        practice_session.submitted_at = datetime.now(UTC).replace(tzinfo=None)
        self.session.add(practice_session)

    def build_session_response(self, *, practice_session: PracticeSessionV2) -> PracticeSessionEnvelopeV2:
        answers = list(
            self.session.scalars(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == practice_session.id
                ).order_by(PracticeSessionAnswerV2.display_order.asc())
            )
        )
        return PracticeSessionEnvelopeV2(
            id=practice_session.id,
            track=practice_session.track,
            entry_kind=practice_session.entry_kind,
            status=practice_session.status,
            items=[
                PracticeSessionItemV2(
                    id=str(answer.id),
                    question_key=answer.question_key,
                    prompt="Phase 1 skeleton session item",
                    answer_kind="placeholder",
                    status="answered",
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
        answered_count = len(answers)
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
                    href="/wrong-book",
                )
            ],
        )
