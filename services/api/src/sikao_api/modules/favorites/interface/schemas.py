from __future__ import annotations

from typing import Literal

from pydantic import Field

from sikao_api.core.schemas import CamelModel, UtcDatetime


class QuestionFavoriteCreateV2(CamelModel):
    note: str | None = Field(default=None, max_length=512)


class QuestionFavoriteItemV2(CamelModel):
    id: int
    question_id: int
    title: str
    type: Literal["xingce", "essay"]
    category_l1: str
    category_l2: str | None = None
    year: int | None = None
    region: str | None = None
    exam_type: str
    note: str | None = None
    question_status: str
    href: str | None = None
    created_at: UtcDatetime


class QuestionFavoriteListV2(CamelModel):
    items: list[QuestionFavoriteItemV2]
    total: int
    page: int
    page_size: int


class QuestionFavoriteCountV2(CamelModel):
    count: int
