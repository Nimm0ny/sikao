"""PR-1 MVP: onboarding status check.

Returns whether the current user has completed the onboarding flow:
  - has_goal: UserGoal row exists
  - has_exam: at least one UserExam row exists
  - is_onboarded: both true

FE uses this on /dashboard mount to decide whether to redirect to /study/onboarding.
No write operations; read-only status check.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models import UserExam, UserGoal
from sikao_api.db.schemas import OnboardingStatusV2


def get_onboarding_status(session: Session, *, user_id: int) -> OnboardingStatusV2:
    has_goal = (
        session.scalar(select(UserGoal).where(UserGoal.user_id == user_id)) is not None
    )
    has_exam = (
        session.scalar(select(UserExam).where(UserExam.user_id == user_id)) is not None
    )
    return OnboardingStatusV2(
        has_goal=has_goal,
        has_exam=has_exam,
        is_onboarded=has_goal and has_exam,
    )
