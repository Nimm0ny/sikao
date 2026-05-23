from __future__ import annotations

from typing import Literal, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, UserV2
from sikao_api.db.schemas_v2 import ActiveSessionProgress, ActiveSessionV2, ActiveSessionsResponseV2
from sikao_api.modules.session.application.answer_item_state import has_meaningful_answer


def build_active_sessions(session: Session, *, user: UserV2) -> ActiveSessionsResponseV2:
    rows = list(
        session.scalars(
            select(PracticeSessionV2).where(
                PracticeSessionV2.user_id == user.id,
                PracticeSessionV2.status.in_(("draft", "in_progress", "paused")),
            )
        )
    )
    rows.sort(key=lambda row: row.last_activity_at or row.started_at, reverse=True)
    rows = rows[:10]
    paper_lookup = {
        row.id: row.paper_code
        for row in session.scalars(select(PaperV2).where(PaperV2.id.in_([item.paper_id for item in rows if item.paper_id is not None])))
    }
    sessions = []
    for item in rows:
        answers = list(
            session.scalars(
                select(PracticeSessionAnswerV2).where(
                    PracticeSessionAnswerV2.session_id == item.id
                )
            )
        )
        answered = sum(1 for answer in answers if has_meaningful_answer(answer.response_json))
        category = item.config_snapshot.get("category_l2") or item.config_snapshot.get("category_l1")
        sessions.append(
            ActiveSessionV2(
                id=item.id,
                type=cast(Literal["xingce", "essay"], item.track),
                source_mode=item.source_mode,
                practice_mode=item.practice_mode,
                status=item.status,
                started_at=item.started_at,
                last_activity_at=item.last_activity_at,
                paused_at=item.paused_at,
                progress=ActiveSessionProgress(answered=answered, total=len(answers)),
                paper_code=paper_lookup.get(item.paper_id) if item.paper_id is not None else None,
                category=category if isinstance(category, str) else None,
                exam_mode=item.exam_mode,
            )
        )
    return ActiveSessionsResponseV2(sessions=sessions, count=len(sessions))
