"""SIKAO Wave 4 Phase 2C: xingce-wrongbook BE service.

7 endpoint 后端聚合 + mastery 5 维评估算法 + 蒙对识破 + peek 扣减:

  - calc_summary               5 stat (in_practice / todo / danger / graduated / weekly_new)
  - get_graduation_candidates  consecutive_correct == 2 的题
  - mark_mastered              手动标已掌握 (state machine: any → 'mastered')
  - peek                       扣 peek_count, return remaining
  - submit_with_bluff          重做模式提交 + 蒙对识破 (duration > avg×2 且答对)
  - smart_review_today         今日 4 stat
  - smart_review_next          下一题 (priority by mastery + 时间)

Mastery 评估算法 (5 维, 单纯函数 _evaluate_mastery 返 dict, 不写 DB):
  - is_danger     : bluff_count >= 2 OR 'trap_caught' in error_reasons
  - is_graduated  : consecutive_correct_count >= 3
  - is_meek       : consecutive_correct_count == 2 AND not danger
  - is_ok         : consecutive_correct_count == 1 AND not danger
  - is_todo       : consecutive_correct_count == 0 AND not graduated

蒙对识破: duration_ms > avg_duration_ms × 2 AND is_correct=True. avg 是
**该 user 该题** 历史 attempts 的均值 (排除当前 attempt). 历史 0 次时不判蒙对
(无 baseline).

Fail-Fast: 全部 endpoint 缺数据抛 NotFoundError, 不返空兜底. peek 0 时
ValidationError. 不 silent catch.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from sikao_api.db import schemas
from sikao_api.db.models import (
    ExamEvent,
    Question,
    User,
    WrongQuestionAttempt,
    WrongQuestionMastery,
)
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError
from sikao_api.modules.wrong_book.application.mastery import (
    MASTERY_MASTERED,
    MASTERY_NOT_MASTERED,
    MASTERY_REVIEWING,
)

# Heatmap helper — re-export from wrong_book_heatmap (Wave 5 plan 5.2 #6) so
# test_wrong_book_heatmap.py 等继续从本模块导入 (backward compat).
from sikao_api.modules.wrong_book.application.wrong_book_heatmap import _bucket_subject_short
from sikao_api.modules.wrong_book.application.wrong_book_heatmap import compute_heatmap as _compute_heatmap_impl

__all__ = ["WrongBookService", "_bucket_subject_short"]


_ERROR_REASON_TRAP = "trap_caught"
_GRADUATION_THRESHOLD = 3
_BLUFF_DANGER_THRESHOLD = 2
_DEFAULT_PEEK_COUNT = 3
_BLUFF_MULTIPLIER = 2  # duration > avg × 2 + 答对 = 蒙对


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _evaluate_mastery_flags(record: WrongQuestionMastery) -> dict[str, bool]:
    """5 维评估 (pure function, 不写 DB).

    返 dict 让 schema layer 选择性暴露字段. 单一职责: 输入 mastery row,
    输出布尔 flag.
    """
    is_danger = (
        record.bluff_count >= _BLUFF_DANGER_THRESHOLD
        or _ERROR_REASON_TRAP in (record.error_reasons or [])
    )
    is_graduated = record.consecutive_correct_count >= _GRADUATION_THRESHOLD
    is_meek = record.consecutive_correct_count == 2 and not is_danger
    is_ok = record.consecutive_correct_count == 1 and not is_danger
    is_todo = record.consecutive_correct_count == 0 and not is_graduated
    return {
        "is_danger": is_danger,
        "is_graduated": is_graduated,
        "is_meek": is_meek,
        "is_ok": is_ok,
        "is_todo": is_todo,
    }


class WrongBookService:
    """7 endpoint 聚合服务. 跟 ExamPaperService 解耦 (单一职责: 错题本评估)."""

    def __init__(self, session: Session) -> None:
        self.session = session

    # ── #1 summary ──────────────────────────────────────────────────────────
    def calc_summary(self, *, user: User) -> schemas.WrongBookSummary:
        """5 stat 聚合: in_practice / todo / danger / graduated / weekly_new."""
        records = list(
            self.session.scalars(
                select(WrongQuestionMastery).where(
                    WrongQuestionMastery.user_id == user.id
                )
            )
        )
        in_practice = sum(1 for r in records if r.mastery_level != MASTERY_MASTERED)
        todo_count = sum(1 for r in records if r.consecutive_correct_count == 0)
        graduated_count = sum(
            1 for r in records if r.consecutive_correct_count >= _GRADUATION_THRESHOLD
        )
        danger_count = sum(
            1
            for r in records
            if (
                r.bluff_count >= _BLUFF_DANGER_THRESHOLD
                or _ERROR_REASON_TRAP in (r.error_reasons or [])
            )
        )
        # weekly_new: last_wrong_time 在过去 7 天内 (含今天).
        cutoff = _utc_now_naive() - timedelta(days=7)
        weekly_new = sum(1 for r in records if r.last_wrong_time >= cutoff)
        return schemas.WrongBookSummary(
            in_practice=in_practice,
            todo_count=todo_count,
            danger_count=danger_count,
            graduated_count=graduated_count,
            weekly_new=weekly_new,
        )

    # ── #2 graduation candidates ────────────────────────────────────────────
    def get_graduation_candidates(
        self, *, user: User, limit: int = 10
    ) -> list[schemas.GraduationCandidate]:
        """consecutive_correct_count == 2 的题, 再做对一次毕业."""
        if limit < 1 or limit > 50:
            raise ValidationError("invalid limit")
        records = list(
            self.session.scalars(
                select(WrongQuestionMastery)
                .options(joinedload(WrongQuestionMastery.question))
                .where(
                    WrongQuestionMastery.user_id == user.id,
                    WrongQuestionMastery.consecutive_correct_count == 2,
                )
                .order_by(WrongQuestionMastery.last_updated.desc())
                .limit(limit)
            )
        )
        return [
            schemas.GraduationCandidate(
                question_id=r.question.id,
                stem=r.question.stem_text,
                knowledge_point=r.question.subject,
                consecutive_correct=r.consecutive_correct_count,
            )
            for r in records
        ]

    # ── #4 mark mastered ────────────────────────────────────────────────────
    def mark_mastered(
        self, *, user: User, question_id: int
    ) -> schemas.MarkMasteredResult:
        """state machine: any → 'mastered'. 用户手动跳过 review.

        404 当无 mastery record. 不创建 — 只能标记已存在的错题.
        """
        record = self.session.scalar(
            select(WrongQuestionMastery).where(
                WrongQuestionMastery.user_id == user.id,
                WrongQuestionMastery.question_id == question_id,
            )
        )
        if record is None:
            raise NotFoundError(f"wrong question {question_id} not in user wrong-book")
        record.mastery_level = MASTERY_MASTERED
        # consecutive_correct_count 强制提到毕业线, 让 graduation_candidates
        # 不再误推 + summary "graduated_count" 立即 +1.
        if record.consecutive_correct_count < _GRADUATION_THRESHOLD:
            record.consecutive_correct_count = _GRADUATION_THRESHOLD
        self.session.flush()
        return schemas.MarkMasteredResult(
            question_id=question_id,
            mastery_level=record.mastery_level,
            consecutive_correct_count=record.consecutive_correct_count,
        )

    # ── #5 peek ─────────────────────────────────────────────────────────────
    def peek(self, *, user: User, question_id: int) -> schemas.PeekResult:
        """扣 peek_count. 0 时拒绝 (Fail-Fast: ValidationError)."""
        record = self.session.scalar(
            select(WrongQuestionMastery).where(
                WrongQuestionMastery.user_id == user.id,
                WrongQuestionMastery.question_id == question_id,
            )
        )
        if record is None:
            raise NotFoundError(f"wrong question {question_id} not in user wrong-book")
        if record.peek_count <= 0:
            raise ValidationError(
                "peek count exhausted", code="peek_exhausted"
            )
        record.peek_count -= 1
        self.session.flush()
        return schemas.PeekResult(
            peeked_reference=True,
            peek_remaining=record.peek_count,
        )

    # ── #6 submit with bluff ────────────────────────────────────────────────
    def submit_with_bluff(
        self,
        *,
        user: User,
        question_id: int,
        payload: schemas.WrongBookSubmitPayload,
    ) -> schemas.WrongBookSubmitResult:
        """重做模式提交 — 写 attempts + 评估蒙对识破 + update mastery.

        蒙对识破: duration_ms > avg×2 AND is_correct=True. avg = 该 user 该题
        历史 attempts 的均时 (排除当前). 历史 0 次时不判蒙对 (无 baseline).
        """
        question = self.session.get(Question, question_id)
        if question is None:
            raise NotFoundError(f"question {question_id} not found")
        record = self.session.scalar(
            select(WrongQuestionMastery).where(
                WrongQuestionMastery.user_id == user.id,
                WrongQuestionMastery.question_id == question_id,
            )
        )
        if record is None:
            raise NotFoundError(f"wrong question {question_id} not in user wrong-book")

        # 判 is_correct: 跟 question.answer_text 比对 (沿用 exam_support helper).
        from sikao_api.modules.admin.application.exam_support import (
            deserialize_answer_text,
            is_answer_correct,
            normalize_answer_keys,
            serialize_answer_keys,
        )

        selected_keys = normalize_answer_keys(payload.selected_option_keys)
        correct_keys = deserialize_answer_text(question.answer_text)
        is_correct = is_answer_correct(selected_keys, correct_keys)
        # attempts 表 selected_option_key 存"A,B,C" 风格 (跟 PracticeSessionAnswer 一致).
        selected_serial = serialize_answer_keys(selected_keys)

        # avg duration 历史 (排除当前): 默认 0 当 0 次历史 → 不判蒙对.
        avg_duration_ms = (
            self.session.scalar(
                select(func.avg(WrongQuestionAttempt.duration_ms)).where(
                    WrongQuestionAttempt.user_id == user.id,
                    WrongQuestionAttempt.question_id == question_id,
                )
            )
            or 0
        )
        # 蒙对识破: 必须有 ≥1 次历史 attempt + 当前耗时 > 历史均时 × 2 + 答对.
        history_count = (
            self.session.scalar(
                select(func.count(WrongQuestionAttempt.id)).where(
                    WrongQuestionAttempt.user_id == user.id,
                    WrongQuestionAttempt.question_id == question_id,
                )
            )
            or 0
        )
        bluff_detected = (
            is_correct
            and history_count >= 1
            and avg_duration_ms > 0
            and payload.duration_ms > avg_duration_ms * _BLUFF_MULTIPLIER
        )

        # attempt_no = 历史 + 1.
        next_attempt_no = int(history_count) + 1
        attempt = WrongQuestionAttempt(
            user_id=user.id,
            question_id=question_id,
            attempt_no=next_attempt_no,
            selected_option_key=selected_serial,
            duration_ms=payload.duration_ms,
            attempted_at=_utc_now_naive(),
            error_reason=payload.error_reason,
            is_correct=is_correct,
        )
        self.session.add(attempt)

        # update mastery: 沿用 services/mastery.py 同语义 + bluff/error_reasons 累计.
        if not is_correct:
            record.mastery_level = MASTERY_NOT_MASTERED
            record.consecutive_correct_count = 0
            record.last_wrong_time = attempt.attempted_at
            if payload.error_reason and payload.error_reason not in (
                record.error_reasons or []
            ):
                record.error_reasons = [
                    *(record.error_reasons or []),
                    payload.error_reason,
                ]
        else:
            record.consecutive_correct_count += 1
            if record.consecutive_correct_count >= _GRADUATION_THRESHOLD:
                record.mastery_level = MASTERY_MASTERED
            elif record.consecutive_correct_count >= 1:
                record.mastery_level = MASTERY_REVIEWING
            if bluff_detected:
                record.bluff_count += 1
                if "bluff" not in (record.error_reasons or []):
                    record.error_reasons = [*(record.error_reasons or []), "bluff"]
                # 蒙对不算"真掌握" — 退回 not_mastered + 清 streak.
                record.consecutive_correct_count = 0
                record.mastery_level = MASTERY_NOT_MASTERED

        self.session.flush()
        return schemas.WrongBookSubmitResult(
            question_id=question_id,
            is_correct=is_correct,
            bluff_detected=bluff_detected,
            mastery_level=record.mastery_level,
            consecutive_correct_count=record.consecutive_correct_count,
            bluff_count=record.bluff_count,
            attempt_no=next_attempt_no,
        )

    # ── #7 smart-review today ───────────────────────────────────────────────
    def smart_review_today(self, *, user: User) -> schemas.SmartReviewToday:
        """今日 4 stat: pushed / finished / streak / days_to_exam.

        "今日" 用 UTC day boundary 跟 _utc_now_naive() (attempted_at 写库锚点)
        对齐. 跨时区 SHA-prod 数据若改本地日聚合, 走 dashboard 同款
        Asia/Shanghai 偏移 (本 fixer 阶段保持 UTC 对齐).
        """
        # attempted_at 是 naive UTC datetime — today_start 也用 UTC 锚点对齐.
        now_utc = _utc_now_naive()
        today_start = datetime.combine(now_utc.date(), datetime.min.time())
        # pushed_today: 今日所有 attempts (重做行为).
        pushed_today = int(
            self.session.scalar(
                select(func.count(WrongQuestionAttempt.id)).where(
                    WrongQuestionAttempt.user_id == user.id,
                    WrongQuestionAttempt.attempted_at >= today_start,
                )
            )
            or 0
        )
        finished_today = int(
            self.session.scalar(
                select(func.count(WrongQuestionAttempt.id)).where(
                    WrongQuestionAttempt.user_id == user.id,
                    WrongQuestionAttempt.attempted_at >= today_start,
                    WrongQuestionAttempt.is_correct.is_(True),
                )
            )
            or 0
        )

        # streak_days: 倒推 attempts.attempted_at 连续日.
        streak_days = self._compute_attempts_streak(user_id=user.id)

        # days_to_exam: 拿最近未来一场 visible exam (national first), 无则 0.
        days_to_exam = self._compute_days_to_exam()

        return schemas.SmartReviewToday(
            pushed_today=pushed_today,
            finished_today=finished_today,
            streak_days=streak_days,
            days_to_exam=days_to_exam,
        )

    def _compute_attempts_streak(self, *, user_id: int) -> int:
        """连续打卡天数 (基于 attempts, 倒推到第一个空白日).

        attempted_at 是 UTC naive — streak 用 UTC date 锚点 (跟
        smart_review_today.today_start 对齐).
        """
        today = _utc_now_naive().date()
        # 拉过去 60 天 distinct attempt 日.
        since = today - timedelta(days=60)
        rows = self.session.execute(
            select(func.date(WrongQuestionAttempt.attempted_at))
            .where(
                WrongQuestionAttempt.user_id == user_id,
                WrongQuestionAttempt.attempted_at >= datetime.combine(since, datetime.min.time()),
            )
            .group_by(func.date(WrongQuestionAttempt.attempted_at))
        ).all()
        attempt_days: set[date] = set()
        for row in rows:
            value = row[0]
            if isinstance(value, date):
                attempt_days.add(value)
            elif isinstance(value, str):
                attempt_days.add(date.fromisoformat(value))
        streak = 0
        cursor = today
        while cursor in attempt_days:
            streak += 1
            cursor -= timedelta(days=1)
        return streak

    def _compute_days_to_exam(self) -> int:
        today = _utc_now_naive().date()
        next_exam = self.session.scalar(
            select(ExamEvent)
            .where(
                ExamEvent.visible.is_(True),
                ExamEvent.exam_date >= today,
            )
            .order_by(ExamEvent.exam_date.asc())
            .limit(1)
        )
        if next_exam is None:
            return 0
        return (next_exam.exam_date - today).days

    # ── #8 smart-review next ────────────────────────────────────────────────
    def smart_review_next(self, *, user: User) -> schemas.SmartReviewNext:
        """下一题: priority by (not_mastered first, 久 last_wrong first)."""
        record = self.session.scalar(
            select(WrongQuestionMastery)
            .options(joinedload(WrongQuestionMastery.question))
            .where(
                WrongQuestionMastery.user_id == user.id,
                WrongQuestionMastery.mastery_level != MASTERY_MASTERED,
            )
            .order_by(
                # 危险题先推 (bluff_count desc), 其次 last_wrong 久的 (asc).
                WrongQuestionMastery.bluff_count.desc(),
                WrongQuestionMastery.last_wrong_time.asc(),
            )
            .limit(1)
        )
        if record is None:
            raise NotFoundError("no wrong question available for smart review")
        # mode: bluff_count >= 2 → 'danger'; 否则默认 'qifei' (主线推送).
        mode: str = "danger" if record.bluff_count >= _BLUFF_DANGER_THRESHOLD else "qifei"
        return schemas.SmartReviewNext(
            question_id=record.question.id,
            mode=mode,  # type: ignore[arg-type]
            stem=record.question.stem_text,
            knowledge_point=record.question.subject,
            consecutive_correct_count=record.consecutive_correct_count,
            last_wrong_time=record.last_wrong_time,
        )

    # ── #9 heatmap (Wave 5 plan 5.2) ────────────────────────────────────────
    def compute_heatmap(
        self, *, user: User, days: int
    ) -> schemas.WrongBookHeatmapResponse:
        """Thin wrapper — 实现在 app/services/wrong_book_heatmap.py.

        拆 module 起因: wrong_book.py 文件 ≤500 行 (§4 铁律). heatmap 逻辑
        ~150 行独立子模块. router 仍调 WrongBookService.compute_heatmap, wrapper
        透明转发 (response shape / 行为不变).
        """
        return _compute_heatmap_impl(self.session, user=user, days=days)

    # ── helper for list view filter (#3 扩参) ──────────────────────────────
    @staticmethod
    def filter_by_view(
        records: list[WrongQuestionMastery],
        view: str | None,
    ) -> list[WrongQuestionMastery]:
        """ViewFilter: all/todo/doing/danger/meek/ok/new/graduated.

        - all       : 不过滤
        - todo      : consecutive_correct_count == 0 AND not graduated
        - doing     : consecutive_correct_count IN (1, 2) AND not danger
        - danger    : bluff_count >= 2 OR error_reasons 含 'trap_caught'
        - meek      : consecutive_correct_count == 2 AND not danger
        - ok        : consecutive_correct_count == 1 AND not danger
        - new       : last_wrong_time 过去 7 天
        - graduated : consecutive_correct_count >= 3
        """
        if view in (None, "all"):
            return records
        cutoff = _utc_now_naive() - timedelta(days=7)
        result: list[WrongQuestionMastery] = []
        for r in records:
            flags = _evaluate_mastery_flags(r)
            if view == "todo" and flags["is_todo"]:
                result.append(r)
            elif view == "doing" and r.consecutive_correct_count in (1, 2) and not flags["is_danger"]:
                result.append(r)
            elif view == "danger" and flags["is_danger"]:
                result.append(r)
            elif view == "meek" and flags["is_meek"]:
                result.append(r)
            elif view == "ok" and flags["is_ok"]:
                result.append(r)
            elif view == "new" and r.last_wrong_time >= cutoff:
                result.append(r)
            elif view == "graduated" and flags["is_graduated"]:
                result.append(r)
        return result
