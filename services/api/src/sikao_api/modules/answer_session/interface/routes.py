from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response, status
from fastapi.responses import Response as RawResponse
from pydantic import Field
from sqlalchemy.orm import Session

from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import User
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService
from sikao_api.modules.system.application.idempotency import (
    build_request_hash,
    load_idempotent_response,
    store_idempotent_response,
)
from sikao_api.modules.auth.application.security import (
    get_current_user,
    get_optional_current_user,
    verify_csrf_token,
    verify_csrf_token_if_cookie_auth,
)

router = APIRouter(prefix="/api/v2/practice", tags=["practice-v2"])


@router.get(
    "/custom/facets",
    response_model=schemas.CustomPracticeFacetsResponseV2,
)
def list_custom_practice_facets(
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.CustomPracticeFacetsResponseV2:
    return ExamPaperService(session).list_custom_practice_facets()


@router.post(
    "/custom/start",
    response_model=schemas.PracticeSessionStartV2,
    response_model_exclude_none=True,
    dependencies=[Depends(verify_csrf_token)],
)
def start_custom_practice_session(
    payload: schemas.CustomPracticeStartPayload,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeSessionStartV2:
    return ExamPaperService(session).start_custom_practice_session(payload, user=user)


@router.post(
    "/papers/{paper_code}/start",
    response_model=schemas.PracticeSessionStartV2,
    response_model_exclude_none=True,
    # Post-Phase D P0-1: anonymous PoC demo OK 但 cookie auth 必须 CSRF.
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def start_paper_session(
    paper_code: str,
    user: Annotated[User | None, Depends(get_optional_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeSessionStartV2:
    return ExamPaperService(session).start_paper_session(paper_code, user=user)


@router.post(
    "/sessions/{session_id}/submit",
    response_model=schemas.PracticeSessionAnswerResultV2,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def submit_session_answer(
    session_id: int,
    payload: schemas.PracticeSessionAnswerSubmissionV2,
    user: Annotated[User | None, Depends(get_optional_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> schemas.PracticeSessionAnswerResultV2 | RawResponse:
    if idempotency_key:
        request_hash = build_request_hash({"sessionId": session_id, **payload.model_dump()})
        replay = load_idempotent_response(
            session,
            scope=f"submit:{session_id}",
            key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            code, body = replay
            return RawResponse(content=body, media_type="application/json", status_code=code)

    result = ExamPaperService(session).submit_session_answer(session_id, payload, user=user)
    if idempotency_key:
        store_idempotent_response(
            session,
            scope=f"submit:{session_id}",
            key=idempotency_key,
            request_hash=request_hash,
            response_code=200,
            response_body=result.model_dump_json(by_alias=True).encode("utf-8"),
        )
    return result


@router.post(
    "/sessions/{session_id}/complete",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf_token_if_cookie_auth)],
)
def complete_session(
    session_id: int,
    *,
    payload: schemas.CompleteSessionPayloadV2 | None = None,
    user: Annotated[User | None, Depends(get_optional_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> Response:
    if idempotency_key:
        request_hash = build_request_hash(
            {"sessionId": session_id, "payload": payload.model_dump() if payload else {}}
        )
        replay = load_idempotent_response(
            session,
            scope=f"complete:{session_id}",
            key=idempotency_key,
            request_hash=request_hash,
        )
        if replay is not None:
            code, _body = replay
            return Response(status_code=code)

    ExamPaperService(session).complete_session(session_id, user=user, payload=payload)
    if idempotency_key:
        store_idempotent_response(
            session,
            scope=f"complete:{session_id}",
            key=idempotency_key,
            request_hash=request_hash,
            response_code=204,
            response_body=b"",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/sessions/{session_id}/result",
    response_model=schemas.PracticeSessionResultV2,
    response_model_exclude_none=True,
)
def get_session_result(
    session_id: int,
    user: Annotated[User | None, Depends(get_optional_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeSessionResultV2:
    return ExamPaperService(session).get_session_result(session_id, user=user)


@router.get("/history", response_model=schemas.PracticeHistoryResponseV2)
def get_history(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeHistoryResponseV2:
    return ExamPaperService(session).get_history(user=user)


# ── Phase 5.4b：错题本 + 重做 ────────────────────────────────────────────────


@router.get(
    "/wrong-questions",
    response_model=schemas.WrongQuestionListResponseV2,
    response_model_exclude_none=True,
)
def list_wrong_questions(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    mastery_level: str | None = None,  # "not_mastered" | "reviewing" | "mastered"
    subject: str | None = None,
    subtype: str | None = None,  # Phase 6.4 P2 — canonical_subtype filter
    paper_code: Annotated[str | None, Query(alias="paperCode")] = None,
    page: int = 1,
    page_size: int = 20,
) -> schemas.WrongQuestionListResponseV2:
    """List user's wrong questions (paginate + filter).

    paperCode (规范官 P0-1, 2026-05-08): 跨页错题过滤. WrongBook view 的
    "本套错题" mode 走这个 server-side filter, 让用户看到该 paper 全集 (跨
    分页), 不再被 client-side filter 限制在当前页 20 条.
    """
    return ExamPaperService(session).list_wrong_questions(
        user=user,
        mastery_level=mastery_level,
        subject=subject,
        subtype=subtype,
        paper_code=paper_code,
        page=page,
        page_size=page_size,
    )


class WrongRetryBatchPayload(schemas.CamelModel):
    question_ids: list[int]


@router.post(
    "/wrong-questions/retry-batch",
    response_model=schemas.PracticeSessionStartV2,
    response_model_exclude_none=True,
    dependencies=[Depends(verify_csrf_token)],
)
def retry_wrong_batch(
    payload: WrongRetryBatchPayload,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeSessionStartV2:
    """Phase 6.4 P2 批量复习 — 一次创建含 N 个错题的 retry session.

    所有 N 题必须属于同一 paper revision. 跨 paper 由前端 disable
    button (UI 体验更直观, 后端再 reject 兜底).
    """
    return ExamPaperService(session).start_retry_wrong_batch(payload.question_ids, user=user)


@router.post(
    "/wrong-questions/{question_id}/retry",
    response_model=schemas.PracticeSessionStartV2,
    response_model_exclude_none=True,
    dependencies=[Depends(verify_csrf_token)],
)
def retry_wrong_question(
    question_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeSessionStartV2:
    return ExamPaperService(session).start_retry_wrong(question_id=question_id, user=user)


# ── Slice 3b · 学习计划 task 跳转 entry ──────────────────────────────────


class StudyPlanStartPayload(schemas.CamelModel):
    """学习计划 task → practice session 创建入参.

    paperCode 可选 (review_wrong 跨卷场景没 paperCode); questionIds 必填,
    至少 1 个. 跟 retry-batch 区别见 ExamPaperService.start_study_plan_session.
    """

    paper_code: str | None = None
    question_ids: list[int] = Field(..., min_length=1)


@router.post(
    "/study-plan/start",
    response_model=schemas.PracticeSessionStartV2,
    response_model_exclude_none=True,
    dependencies=[Depends(verify_csrf_token)],
)
def start_study_plan_session(
    payload: StudyPlanStartPayload,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeSessionStartV2:
    return ExamPaperService(session).start_study_plan_session(
        paper_code=payload.paper_code,
        question_ids=payload.question_ids,
        user=user,
    )


# ── Phase 5.5 Dashboard stats ────────────────────────────────────────────────


@router.get("/stats/heatmap", response_model=list[schemas.HeatmapEntryV2])
def stats_heatmap(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[schemas.HeatmapEntryV2]:
    return ExamPaperService(session).get_heatmap(user=user)


@router.get("/stats/trend", response_model=list[schemas.TrendEntryV2])
def stats_trend(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    days: int = 14,
) -> list[schemas.TrendEntryV2]:
    return ExamPaperService(session).get_trend(user=user, days=days)


@router.get(
    "/stats/knowledge-points", response_model=list[schemas.KnowledgePointEntryV2]
)
def stats_knowledge_points(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> list[schemas.KnowledgePointEntryV2]:
    return ExamPaperService(session).get_knowledge_points(user=user)


@router.get("/stats/summary", response_model=schemas.DashboardStatsV2)
def stats_summary(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.DashboardStatsV2:
    return ExamPaperService(session).get_dashboard_summary(user=user)


# ── SIKAO Wave 4 Phase 2C: xingce-wrongbook BE 8 endpoint ─────────────────
# (heatmap endpoint + --data-* token 推 Wave 5, master §3.7 token SSOT 拍板)


@router.get(
    "/wrong-questions/summary",
    response_model=schemas.WrongBookSummary,
)
def get_wrong_book_summary(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.WrongBookSummary:
    """主页 hero 5 stat-strip (in_practice / todo / danger / graduated / weekly_new)."""
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).calc_summary(user=user)


@router.get(
    "/wrong-questions/graduation-candidates",
    response_model=list[schemas.GraduationCandidate],
)
def get_graduation_candidates(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    limit: int = 10,
) -> list[schemas.GraduationCandidate]:
    """毕业候选 (consecutive_correct_count == 2)."""
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).get_graduation_candidates(user=user, limit=limit)


@router.patch(
    "/wrong-questions/{question_id}/mark-mastered",
    response_model=schemas.MarkMasteredResult,
    dependencies=[Depends(verify_csrf_token)],
)
def mark_wrong_question_mastered(
    question_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.MarkMasteredResult:
    """手动标错题已掌握 — state machine: any → 'mastered'."""
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).mark_mastered(user=user, question_id=question_id)


@router.post(
    "/wrong-questions/{question_id}/peek",
    response_model=schemas.PeekResult,
    dependencies=[Depends(verify_csrf_token)],
)
def peek_wrong_question(
    question_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PeekResult:
    """重做模式偷看答案 — 扣 peek_count, 返剩余."""
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).peek(user=user, question_id=question_id)


@router.post(
    "/wrong-questions/{question_id}/submit-bluff",
    response_model=schemas.WrongBookSubmitResult,
    dependencies=[Depends(verify_csrf_token)],
)
def submit_wrong_question_with_bluff(
    question_id: int,
    payload: schemas.WrongBookSubmitPayload,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.WrongBookSubmitResult:
    """重做模式提交 — 写 attempts + 评估蒙对识破 + update mastery."""
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).submit_with_bluff(
        user=user, question_id=question_id, payload=payload
    )


@router.get(
    "/smart-review/today",
    response_model=schemas.SmartReviewToday,
)
def get_smart_review_today(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.SmartReviewToday:
    """智能复盘"今日"4 stat (pushed / finished / streak / days_to_exam)."""
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).smart_review_today(user=user)


@router.get(
    "/smart-review/next",
    response_model=schemas.SmartReviewNext,
)
def get_smart_review_next(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.SmartReviewNext:
    """智能复盘下一题 (priority: 险题 + 久未做对)."""
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).smart_review_next(user=user)


@router.get(
    "/wrong-questions/heatmap",
    response_model=schemas.WrongBookHeatmapResponse,
)
def get_wrong_book_heatmap(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    days: int = 30,
) -> schemas.WrongBookHeatmapResponse:
    """5 模块 × N 天 错题强度 heatmap.

    days ∈ {7, 30, 90, 180}; 其他值 → 422. 行固定顺序: 言语 / 数量 / 判推 /
    资分 / 常识. cells[-1] = 今天 (Asia/Shanghai 本地日).
    """
    from sikao_api.modules.wrong_book.application.wrong_book import WrongBookService

    return WrongBookService(session).compute_heatmap(user=user, days=days)


# ── SIKAO Wave 8 Phase B: Home 4-block data sources ──────────────────────


@router.get(
    "/last-session",
    response_model=schemas.PracticeSessionSummary | None,
)
def get_last_incomplete_practice_session(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.PracticeSessionSummary | None:
    """Home "继续答题" 数据源.

    返回该 user 最近 1 个 completed_at IS NULL 的 PracticeSession summary;
    无中断 session → null body (FE 据此渲 "今日推荐" 替代入口).
    """
    from sikao_api.modules.answer_session.application.practice_session_last import get_last_incomplete_session

    return get_last_incomplete_session(session, user_id=user.id)


@router.get(
    "/wrong-questions/weakness",
    response_model=schemas.WeakModuleListResponse,
)
def get_weakness_modules(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    limit: int = 2,
) -> schemas.WeakModuleListResponse:
    """Home block 3 "薄弱模块" 数据源.

    Top-N 薄弱模块 (默认 N=2). score = wrong_rate × (1 - completion_rate) ×
    subject_weight × 100; 排 desc, top limit 返. limit ∈ [1, 5]; 其他值 → 422.
    """
    from sikao_api.modules.wrong_book.application.weakness import compute_weakness

    return compute_weakness(session, user_id=user.id, limit=limit)


@router.patch(
    "/sessions/{session_id}/answers/{answer_id}/diagnosis",
    response_model=schemas.WrongReasonOutV2,
    dependencies=[Depends(verify_csrf_token)],
)
def update_answer_wrong_reason(
    session_id: int,
    answer_id: int,
    payload: schemas.WrongReasonUpdateV2,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.WrongReasonOutV2:
    """PR-3: Update wrong-reason diagnosis on a submitted answer.

    Both AI-generated diagnosis (source='ai') and user-override (source='user')
    go through this endpoint. Ownership enforced: answer must belong to a
    session owned by the current user.
    """
    from sikao_api.modules.answer_session.application.diagnosis import update_wrong_reason

    return update_wrong_reason(
        session,
        session_id=session_id,
        answer_id=answer_id,
        user_id=user.id,
        payload=payload,
    )
