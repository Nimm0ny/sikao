"""Slice 2b · aipta plain text → standard JSON paper → DB ingest 服务层胶水.

把 plain text adapter (parser) 跟现有 ExamPaperService.import_standard_json_files
拼一起, admin endpoint 直接调本服务. 解析错抛 ValidationError (422), 让全局
exception_handler 自动 map.

aipta 题没 assets (题目纯文本 + 给定材料纯文本), `base_dir` 用 cwd 占位即可,
不会真去解析 asset 路径.
"""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.scripts.aipta_text_to_standard import (
    AiptaParseError,
    compose_standard_paper,
    parse_aipta_text,
)
from sikao_api.modules.system.application.errors import ValidationError
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService


def import_aipta_text(
    session: Session,
    *,
    paper_code: str,
    paper_name: str,
    exam_year: int,
    source_kind: str,
    raw_text: str,
    created_by: str,
) -> schemas.ImportJobSummary:
    """admin paste text → ingest 单道 aipta paper. 解析 / 校验失败抛
    ValidationError(422); ingest 期同样走 ExamPaperService 既有 retry / hash 跳过.
    """
    if not raw_text.strip():
        raise ValidationError("rawText is empty", code="aipta_empty")
    if not paper_code.strip():
        raise ValidationError("paperCode is required", code="aipta_missing_code")
    if not paper_name.strip():
        raise ValidationError("paperName is required", code="aipta_missing_name")
    if exam_year <= 0:
        raise ValidationError("examYear must be positive", code="aipta_bad_year")

    try:
        parsed = parse_aipta_text(raw_text)
    except AiptaParseError as exc:
        raise ValidationError(str(exc), code="aipta_parse_error") from exc

    paper_payload = compose_standard_paper(
        parsed=parsed,
        paper_code=paper_code.strip().upper(),
        paper_name=paper_name.strip(),
        exam_year=exam_year,
        source_kind=source_kind.strip(),
    )
    paper_bytes = json.dumps(paper_payload, ensure_ascii=False).encode("utf-8")

    service = ExamPaperService(session)
    return service.import_standard_json_files(
        files=[(f"{paper_code.strip().upper()}.standard.json", paper_bytes)],
        base_dir=Path.cwd(),  # aipta 无 assets, base_dir 占位
        created_by=created_by,
    )
