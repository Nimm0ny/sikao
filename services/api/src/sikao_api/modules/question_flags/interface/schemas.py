from __future__ import annotations

from typing import Literal

from sikao_api.core.schemas import CamelModel, UtcDatetime


FlagReasonV2 = Literal["uncertain", "revisit_later", "needs_review"]


class QuestionFlagCreateV2(CamelModel):
    reason: FlagReasonV2


class QuestionFlagItemV2(CamelModel):
    id: int
    question_id: int
    title: str
    type: Literal["xingce", "essay"]
    category_l1: str
    category_l2: str | None = None
    year: int | None = None
    region: str | None = None
    exam_type: str
    reason: FlagReasonV2
    status: Literal["active", "resolved"]
    question_status: str
    source_session_id: int | None = None
    href: str | None = None
    created_at: UtcDatetime
    resolved_at: UtcDatetime | None = None


class QuestionFlagListV2(CamelModel):
    items: list[QuestionFlagItemV2]
    total: int
    page: int
    page_size: int
