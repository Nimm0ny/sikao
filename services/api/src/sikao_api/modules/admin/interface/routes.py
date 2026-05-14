from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, Query, UploadFile
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.modules.question_bank.application.aipta_import import import_aipta_text
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService
from sikao_api.modules.auth.application.security import get_admin_principal, verify_csrf_token_if_cookie_auth

router = APIRouter(prefix="/api/v2/admin", tags=["admin-v2"])


# P1-1 fix (security review 2026-04-30): 给 admin mutating endpoints 加
# verify_csrf_token_if_cookie_auth dep.
#
# ⚠️ Currently a no-op until admin migrates off Basic auth (回归 review P1-D):
# admin endpoints 现在都用 get_admin_principal (HTTP Basic), 永远没 auth_token
# cookie, dep 一定 skip. **当前 0 实际收益**, 只是 defensive groundwork — 如果
# 将来 admin 切到 cookie session auth, dep 会自动启用 CSRF 不需重新 wire.
# 添加成本是 1 行 dep, 不破现有 admin CLI / deploy/scripts (HTTP Basic 路径).


@router.post(
    "/import-jobs/standard-json",
    response_model=schemas.ImportJobSummary,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
async def import_standard_json(
    *,
    uploads: list[UploadFile] = File(...),
    base_dir: str | None = Form(default=None),
    session: Session = Depends(get_db_session),
    admin_username: str = Depends(get_admin_principal),
) -> schemas.ImportJobSummary:
    files = [(upload.filename or "paper.standard.json", await upload.read()) for upload in uploads]
    service = ExamPaperService(session)
    return service.import_standard_json_files(
        files=files,
        base_dir=Path(base_dir).resolve() if base_dir else Path.cwd(),
        created_by=admin_username,
    )


@router.post(
    "/essay-papers/import-aipta-text",
    response_model=schemas.ImportJobSummary,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def import_aipta_text_endpoint(
    payload: schemas.AiptaTextImportRequest,
    session: Annotated[Session, Depends(get_db_session)],
    admin_username: Annotated[str, Depends(get_admin_principal)],
) -> schemas.ImportJobSummary:
    """Slice 2b: admin paste 申论真题 plain text → ingest 单卷.

    格式契约见 `app/scripts/aipta_text_to_standard.py` docstring. 解析 / 校验
    错抛 ValidationError(422), 全局 exception handler 自动 map.
    """
    return import_aipta_text(
        session,
        paper_code=payload.paper_code,
        paper_name=payload.paper_name,
        exam_year=payload.exam_year,
        source_kind=payload.source_kind,
        raw_text=payload.raw_text,
        created_by=admin_username,
    )


@router.get("/import-jobs", response_model=list[schemas.ImportJobSummary])
def list_import_jobs(
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[schemas.ImportJobSummary]:
    return ExamPaperService(session).list_import_jobs()


@router.get("/import-jobs/{job_id}", response_model=schemas.ImportJobSummary)
def get_import_job(
    job_id: int,
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.ImportJobSummary:
    return ExamPaperService(session).get_import_job(job_id)


@router.get("/papers", response_model=list[schemas.AdminPaperSummaryV2])
def list_admin_papers(
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[schemas.AdminPaperSummaryV2]:
    return ExamPaperService(session).list_admin_papers()


@router.get("/papers/{paper_code}/revisions", response_model=list[schemas.PaperRevisionSummary])
def list_paper_revisions(
    paper_code: str,
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[schemas.PaperRevisionSummary]:
    return ExamPaperService(session).list_paper_revisions(paper_code)


@router.post(
    "/papers/{paper_code}/revisions/{revision_id}/publish",
    response_model=schemas.PaperDetailV2,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def publish_revision(
    paper_code: str,
    revision_id: int,
    admin_username: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
    release_execution_id: Annotated[str | None, Header(alias="X-Release-Execution-Id")] = None,
) -> schemas.PaperDetailV2:
    return ExamPaperService(session).publish_revision(
        paper_code,
        revision_id,
        released_by=admin_username,
        release_execution_id=release_execution_id,
    )


@router.get("/revisions/{revision_id}/publish-status", response_model=schemas.PublishStatusResponseV2)
def publish_status(
    revision_id: int,
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PublishStatusResponseV2:
    return ExamPaperService(session).get_publish_status(revision_id)


@router.get("/questions", response_model=list[schemas.QuestionListItemV2])
def list_admin_questions(
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
    paper_code: str | None = Query(default=None, alias="paperCode"),
    revision_id: int | None = Query(default=None, alias="revisionId"),
    keyword: str | None = Query(default=None),
) -> list[schemas.QuestionListItemV2]:
    return ExamPaperService(session).list_admin_questions(paper_code=paper_code, revision_id=revision_id, keyword=keyword)


@router.get("/questions/{question_id}", response_model=schemas.AdminQuestionDetailV2)
def get_admin_question(
    question_id: int,
    _admin: Annotated[str, Depends(get_admin_principal)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.AdminQuestionDetailV2:
    return ExamPaperService(session).get_admin_question(question_id)
