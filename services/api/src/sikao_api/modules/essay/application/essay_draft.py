"""PR13 P5: 申论草稿持久化 service.

API:
- EssayDraftService(session).upsert(user_id, question_id, typed_draft, handwritten_draft_metadata) → record
- EssayDraftService(session).get_my_draft(user_id, question_id) → record | None

Upsert 策略 (dialect-agnostic, 跟 SQLite test + PG prod 都跑):
  先 SELECT 同 (user_id, question_id) → 存在 UPDATE / 不存在 INSERT. 两 query
  in autosave 高频也仍 OK (PR13 FE 2s debounce, 单用户 RPS << 1). 不走
  dialect-specific ON CONFLICT 避免 PG/SQLite 分支代码.

兜底: 极小概率两个并发请求同时进入 "不存在 INSERT" 路径 → 第二个 commit 撞
unique constraint IntegrityError. 业务层 catch 转 UPDATE — 这是 fail-fast 的
合理 transition, 不是 silent swallow (不返 None, 不 drop 数据, 重新走 query
拿到 existing record 后 update).
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sikao_api.db.models import EssayDraftRecord, Question, utc_now
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


class EssayDraftService:
    """申论草稿 upsert + 查询 (PR13 P5)."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert(
        self,
        *,
        user_id: int,
        question_id: int,
        typed_draft: str,
        handwritten_draft_metadata: dict[str, Any] | None,
    ) -> EssayDraftRecord:
        """Upsert essay draft for (user_id, question_id).

        如 question 不存在 → NotFoundError (404).
        如 question 不是 essay 类型 → ValidationError(422, essay_wrong_kind),
        跟 EssayGradingService.submit 一致.
        """
        question = self.session.get(Question, question_id)
        if question is None:
            raise NotFoundError("question not found")
        if question.renderer_key != "essay":
            raise ValidationError(
                "question is not essay type", code="essay_wrong_kind"
            )

        existing = self._fetch_existing(
            user_id=user_id, question_id=question_id
        )
        if existing is not None:
            existing.typed_draft = typed_draft
            existing.handwritten_draft_metadata = handwritten_draft_metadata
            existing.updated_at = utc_now()
            self.session.flush()
            return existing

        record = EssayDraftRecord(
            user_id=user_id,
            question_id=question_id,
            typed_draft=typed_draft,
            handwritten_draft_metadata=handwritten_draft_metadata,
        )
        self.session.add(record)
        try:
            self.session.flush()
        except IntegrityError:
            # Race: 第二个请求并发进入这条路径, unique constraint 撞.
            # rollback flush state → 重新走 fetch + update, 不返 None / 不吞数据.
            self.session.rollback()
            existing_after_race = self._fetch_existing(
                user_id=user_id, question_id=question_id
            )
            if existing_after_race is None:
                # 极不应发生 — IntegrityError 后竟然 fetch 不到 row.
                # fail-fast: 抛出原始错误的语义, 不静默兜底.
                raise
            existing_after_race.typed_draft = typed_draft
            existing_after_race.handwritten_draft_metadata = (
                handwritten_draft_metadata
            )
            existing_after_race.updated_at = utc_now()
            self.session.flush()
            return existing_after_race
        return record

    def get_my_draft(
        self, *, user_id: int, question_id: int
    ) -> EssayDraftRecord | None:
        """获取当前用户对某题的最新 draft, 没存过返 None.

        跨用户语义在 route 层处理 (POST upsert 走自身 user_id; GET 用 question_id
        查自己的, 缺即 404 防 leak — 跟 EssayGrading 一致).
        """
        return self._fetch_existing(user_id=user_id, question_id=question_id)

    def _fetch_existing(
        self, *, user_id: int, question_id: int
    ) -> EssayDraftRecord | None:
        stmt = (
            select(EssayDraftRecord)
            .where(
                EssayDraftRecord.user_id == user_id,
                EssayDraftRecord.question_id == question_id,
            )
            .limit(1)
        )
        return self.session.scalar(stmt)
