"""Phase 5.4b —— 错题掌握度自动规则更新。

规则（用户已确认，见 docs/ui-rollout/phase5-rebrand.md §"最终决策"）：

    第一次做错 (or 已存在 record 再做错)：
        record 置 not_mastered / consecutive_correct_count=0 /
        last_wrong_time = answered_at

    record 存在 + 此次做对：
        consecutive_correct_count += 1
        consecutive_correct_count >= 2 → mastered
        consecutive_correct_count == 1 → reviewing

    record 不存在 + 此次做对：
        no-op（没做错过的题不进错题本）

匿名 session（user 为 None）禁止调用此函数——由 caller（exam_papers
service）统一把关。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models import WrongQuestionMastery

MASTERY_NOT_MASTERED = "not_mastered"
MASTERY_REVIEWING = "reviewing"
MASTERY_MASTERED = "mastered"


def update_mastery(
    session: Session,
    *,
    user_id: int,
    question_id: int,
    is_correct: bool,
    answered_at: datetime,
) -> None:
    record = session.scalar(
        select(WrongQuestionMastery).where(
            WrongQuestionMastery.user_id == user_id,
            WrongQuestionMastery.question_id == question_id,
        )
    )

    if not is_correct:
        if record is None:
            session.add(
                WrongQuestionMastery(
                    user_id=user_id,
                    question_id=question_id,
                    mastery_level=MASTERY_NOT_MASTERED,
                    last_wrong_time=answered_at,
                    consecutive_correct_count=0,
                )
            )
        else:
            record.mastery_level = MASTERY_NOT_MASTERED
            record.consecutive_correct_count = 0
            record.last_wrong_time = answered_at
        return

    # 答对且不存在记录 → 从未答错过，不进错题本（no-op）。
    if record is None:
        return

    record.consecutive_correct_count += 1
    if record.consecutive_correct_count >= 2:
        record.mastery_level = MASTERY_MASTERED
    elif record.consecutive_correct_count == 1:
        record.mastery_level = MASTERY_REVIEWING
