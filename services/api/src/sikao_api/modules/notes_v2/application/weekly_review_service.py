from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import NoteV2, QuestionV2, UserV2


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


class WeeklyReviewServiceV2:
    def __init__(self, session: Session) -> None:
        self.session = session

    def build_summary_input(self, *, user: UserV2, now: datetime | None = None) -> WeeklyReviewDataV2:
        resolved_now = now or datetime.now(UTC).replace(tzinfo=None)
        week_start_date, window_start, window_end = _cn_week_window(resolved_now)
        note_count, question_note_count, note_titles = self._weekly_note_snapshot(
            user_id=user.id,
            window_start=window_start,
            window_end=window_end,
        )
        return WeeklyReviewDataV2(
            week_number=_cn_week_number(week_start_date),
            date_range=f"{week_start_date.isoformat()} ~ {window_end.date().isoformat()}",
            review_count=0,
            redo_accuracy_pct=0.0,
            accuracy_delta_pct=None,
            graduated_count=0,
            practice_count=0,
            module_accuracy_summary="无本周练习数据",
            weakness_detail="无显著薄弱模块",
            note_count=note_count,
            question_note_count=question_note_count,
            note_titles=note_titles,
            week_start_date=week_start_date,
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
                )
                .order_by(NoteV2.created_at.asc(), NoteV2.id.asc())
            )
        )
        note_count = len(rows)
        question_note_count = sum(1 for row in rows if row.linked_question_id is not None)
        titles = "，".join(row.title for row in rows[:5]) if rows else "无本周笔记"
        return note_count, question_note_count, titles


def _cn_week_window(now_utc_naive: datetime) -> tuple[date, datetime, datetime]:
    now_cn = now_utc_naive.replace(tzinfo=UTC) + timedelta(hours=8)
    week_start_date = now_cn.date() - timedelta(days=now_cn.date().weekday())
    window_start = datetime.combine(week_start_date, datetime.min.time())
    return week_start_date, window_start, now_cn.replace(tzinfo=None)


def _cn_week_number(week_start_date: date) -> int:
    return int(week_start_date.isocalendar().week)
