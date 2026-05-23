from __future__ import annotations

from datetime import UTC, datetime

from sikao_api.db.models_v2 import PracticeSessionV2
from sikao_api.modules.mock_exam.domain.errors import DELAYED_REVIEW_LOCKED, MOCK_EXAM_NOT_STARTED, MOCK_PAUSE_FORBIDDEN
from sikao_api.modules.system.application.errors import ConflictError, ForbiddenError, ValidationError


def assert_mock_exam_started(practice_session: PracticeSessionV2) -> None:
    if practice_session.exam_mode and practice_session.status == "draft":
        raise ConflictError(
            "mock exam has not started",
            code=MOCK_EXAM_NOT_STARTED,
        )


def assert_can_pause(practice_session: PracticeSessionV2) -> None:
    if practice_session.exam_mode and not practice_session.allow_pause:
        raise ValidationError(
            "mock exam pause is forbidden",
            code=MOCK_PAUSE_FORBIDDEN,
        )


def assert_can_view_solution(
    practice_session: PracticeSessionV2,
    *,
    now: datetime | None = None,
) -> None:
    if not practice_session.exam_mode:
        return
    if practice_session.status != "submitted":
        return
    if practice_session.delayed_review_until is None:
        return
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    if current_time < practice_session.delayed_review_until:
        raise ForbiddenError(
            "mock exam delayed review is still locked",
            code=DELAYED_REVIEW_LOCKED,
        )


def resolve_force_submit_reason(
    practice_session: PracticeSessionV2,
    *,
    now: datetime | None = None,
) -> str | None:
    if not practice_session.exam_mode or practice_session.auto_submit_at is None:
        return None
    current_time = now or datetime.now(UTC).replace(tzinfo=None)
    if current_time >= practice_session.auto_submit_at:
        return "mock_exam_timeout"
    return None
