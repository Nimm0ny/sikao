from __future__ import annotations

from pydantic import Field

from sikao_api.core.schemas import CamelModel


class EssayReferenceReportRequestV2(CamelModel):
    note: str | None = Field(default=None, max_length=512)


class EssayReferenceGenerateRequestV2(CamelModel):
    question_id: int
