"""AI 答疑会话 endpoints — Slice 1a.

5 endpoints (plan §4.2):
  POST   /api/v2/llm/conversations               # 创建会话 + SSE stream 第一条 assistant
  GET    /api/v2/llm/conversations               # 列表 (DESC by updated_at, limit 20)
  GET    /api/v2/llm/conversations/{id}          # 单会话 + messages 全文
  POST   /api/v2/llm/conversations/{id}/messages # 续 user message → SSE stream
  DELETE /api/v2/llm/conversations/{id}          # 删

SSE 帧格式 (text/event-stream, fetch+ReadableStream 拆):
  data: {"type":"delta","content":"..."}\\n\\n          # 增量内容
  data: {"type":"done","messageId":123}\\n\\n           # 结束 (含 assistant message id)
  data: {"type":"error","code":"...","message":"..."}\\n\\n   # 错误 (终结流)

POST 端点 mutating, verify_csrf_token 强制. SSE 走 X-CSRF-Token header (前端
fetch+ReadableStream 携带), EventSource 不能带自定义 header 故不用 (plan §3.3.1).

Async cancel (plan §3.3.2): handler async def + `await request.is_disconnected()`,
断开 → return 让 chat_completion_stream `async with` exit cancel httpx upstream.
Token 用户断网后不继续付费.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from sikao_api.core.config import Settings
from sikao_api.core.deps import get_app_settings
from sikao_api.db.session import get_db_session
from sikao_api.db import schemas
from sikao_api.db.models import LlmConversation, LlmMessage, LlmTokenUsage, User
from sikao_api.modules.system.application.errors import LLMServiceError
from sikao_api.modules.llm.application.llm import ProviderLabel, build_llm_provider
from sikao_api.modules.llm.application.llm.conversations import (
    append_user_message,
    build_messages_for_llm,
    create_conversation,
    delete_conversation,
    finalize_assistant_message,
    get_conversation,
    list_conversations,
)
from sikao_api.modules.llm.application.llm.prompts.qa import extract_displayed_user_message
from sikao_api.modules.llm.application.llm.provider import ChatCompletionChunk, LLMMessage, LLMProvider
from sikao_api.modules.llm.application.llm.usage_estimator import estimate_tokens
from sikao_api.modules.llm.application.llm.usage_recorder import UsageRecord, record_usage
from sikao_api.modules.auth.application.security import get_current_user, verify_csrf_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/llm", tags=["llm-conversations-v2"])


# ─── Serializers ──────────────────────────────────────────────────────────


def _serialize_summary(
    conversation: LlmConversation, message_count: int, last_preview: str | None
) -> schemas.LlmConversationSummaryV2:
    return schemas.LlmConversationSummaryV2(
        id=conversation.id,
        title=conversation.title,
        context_kind=conversation.context_kind,  # type: ignore[arg-type]
        context_id=conversation.context_id,
        message_count=message_count,
        last_preview=last_preview,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def _serialize_message(
    message: LlmMessage, token_usage: LlmTokenUsage | None
) -> schemas.LlmMessageV2:
    usage_dto: schemas.LlmMessageTokenUsageV2 | None = None
    if token_usage is not None:
        usage_dto = schemas.LlmMessageTokenUsageV2(
            prompt_tokens=token_usage.prompt_tokens,
            completion_tokens=token_usage.completion_tokens,
            model=token_usage.model,
        )
    # user role: storage form 含 intent guidance suffix, strip 给前端展示
    # (4th-review P1 fix). assistant/system 不含 marker, 直接返.
    display_content = (
        extract_displayed_user_message(message.content)
        if message.role == "user"
        else message.content
    )
    return schemas.LlmMessageV2(
        id=message.id,
        role=message.role,  # type: ignore[arg-type]
        content=display_content,
        created_at=message.created_at,
        token_usage=usage_dto,
    )


def _serialize_detail(
    db: Session, conversation: LlmConversation
) -> schemas.LlmConversationDetailV2:
    """Serialize conversation + messages. Lazy fetch token_usage by id (assistant
    only). 1 batch query 避免 N+1."""
    messages = list(conversation.messages)
    usage_ids = [m.token_usage_id for m in messages if m.token_usage_id is not None]
    usage_map: dict[int, LlmTokenUsage] = {}
    if usage_ids:
        from sqlalchemy import select

        rows = db.execute(
            select(LlmTokenUsage).where(LlmTokenUsage.id.in_(usage_ids))
        ).scalars()
        usage_map = {row.id: row for row in rows}

    return schemas.LlmConversationDetailV2(
        id=conversation.id,
        title=conversation.title,
        context_kind=conversation.context_kind,  # type: ignore[arg-type]
        context_id=conversation.context_id,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            _serialize_message(
                m, usage_map.get(m.token_usage_id) if m.token_usage_id else None
            )
            for m in messages
        ],
    )


# ─── Read endpoints ───────────────────────────────────────────────────────


@router.get(
    "/conversations", response_model=schemas.LlmConversationListResponse
)
def list_my_conversations(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.LlmConversationListResponse:
    """List user's conversations DESC by updated_at, limit 20."""
    rows = list_conversations(session, user_id=user.id)
    return schemas.LlmConversationListResponse(
        items=[_serialize_summary(c, count, preview) for c, count, preview in rows]
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=schemas.LlmConversationDetailV2,
)
def get_my_conversation(
    conversation_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
) -> schemas.LlmConversationDetailV2:
    """Single conversation + messages 全文. 跨 user → 404."""
    conversation = get_conversation(
        session, user_id=user.id, conversation_id=conversation_id
    )
    return _serialize_detail(session, conversation)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_my_conversation(
    conversation_id: int,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> Response:
    delete_conversation(session, user_id=user.id, conversation_id=conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Streaming endpoints (SSE) ────────────────────────────────────────────


@router.post("/conversations")
async def create_my_conversation(
    payload: schemas.LlmConversationCreateRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> StreamingResponse:
    """创建会话 + 落首条 user message + SSE stream 第一条 assistant 回复.

    Phase 1 (sync): create_conversation + commit early — 即使 stream 中断,
    user message 仍然落库, 用户能看到自己问了啥, 重发即可.
    Phase 2 (stream generator): 跑 LLM stream + 末尾 finalize assistant + record usage.
    """
    # Phase 1: create conversation + user msg synchronously, commit early.
    # intent_hint 传给 service 让 storage form 含 guidance suffix.
    conversation = create_conversation(
        session,
        user_id=user.id,
        context_kind=payload.context_kind,
        context_id=payload.context_id,
        title=payload.title,
        user_message=payload.user_message,
        intent_hint=payload.intent_hint,
    )
    session.commit()
    session.refresh(conversation)

    provider, provider_label = build_llm_provider(
        settings, db=session, user_id=user.id
    )

    return StreamingResponse(
        _stream_assistant_reply(
            request=request,
            db=session,
            settings=settings,
            user_id=user.id,
            provider=provider,
            provider_label=provider_label,
            conversation=conversation,
            model=settings.llm_model_qa,
        ),
        media_type="text/event-stream",
    )


@router.post("/conversations/{conversation_id}/messages")
async def continue_my_conversation(
    conversation_id: int,
    payload: schemas.LlmConversationContinueRequest,
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    _csrf: Annotated[None, Depends(verify_csrf_token)],
) -> StreamingResponse:
    """续 user message → SSE stream 续接 assistant 回复. 跨 user → 404."""
    conversation = append_user_message(
        session,
        user_id=user.id,
        conversation_id=conversation_id,
        user_message=payload.user_message,
        intent_hint=payload.intent_hint,
    )
    session.commit()
    session.refresh(conversation)

    provider, provider_label = build_llm_provider(
        settings, db=session, user_id=user.id
    )

    return StreamingResponse(
        _stream_assistant_reply(
            request=request,
            db=session,
            settings=settings,
            user_id=user.id,
            provider=provider,
            provider_label=provider_label,
            conversation=conversation,
            model=settings.llm_model_qa,
        ),
        media_type="text/event-stream",
    )


# ─── SSE generator + finalize ─────────────────────────────────────────────


async def _stream_assistant_reply(
    *,
    request: Request,
    db: Session,
    settings: Settings,
    user_id: int,
    provider: LLMProvider,
    provider_label: ProviderLabel,
    conversation: LlmConversation,
    model: str,
) -> AsyncIterator[bytes]:
    """Stream assistant reply chunk-by-chunk. 累积 content 末尾 finalize.

    用户断 (`is_disconnected`) → return 让 `async with httpx` exit cancel
    upstream call, token 不继续付费 (plan §3.3.2). 已累积的 content 不写入
    DB (PoC 简化, 节流付费不审计 partial).

    Upstream HTTP error → yield error frame + return (不 raise, 否则触发
    get_db_session rollback 把 user message 也回滚 — 保留 user msg 让用户重发).

    `build_messages_for_llm` 在 generator 内调用 (3rd review P1 #3): ValueError
    invariant 违反时被现有 except 接住转 error 帧, 不让裸 exception 透到 FastAPI
    返 500. intent_hint 不再是参数 — 已在 create/append 时由 service 拼入
    storage content (4th-review P1 fix).
    """
    # 3rd review P1 #3: 在第一个 delta 前先发 'created' frame 把 conversationId
    # 给前端. 用户在任何时刻 abort (mid-stream cancel) 后都已拿到 id, 重发走
    # 续话端点不再创建孤立 conversation row. error / done frame 也带 id 但是
    # 防御性多一层 (用户极快 cancel 时 error/done 都没出, 只有 created).
    yield _sse_frame({"type": "created", "conversationId": conversation.id})

    accumulated_content = ""
    final_chunk: ChatCompletionChunk | None = None
    try:
        llm_messages = build_messages_for_llm(db, conversation=conversation)
        async for chunk in provider.chat_completion_stream(
            messages=llm_messages,
            model=model,
            max_tokens=settings.llm_max_tokens,
        ):
            if await request.is_disconnected():
                logger.info(
                    "llm.qa.client_disconnected user_id=%s conversation_id=%s "
                    "accumulated_chars=%d — cancelling upstream",
                    user_id,
                    conversation.id,
                    len(accumulated_content),
                )
                return
            if chunk.content_delta:
                accumulated_content += chunk.content_delta
                yield _sse_frame({"type": "delta", "content": chunk.content_delta})
            if chunk.is_final:
                final_chunk = chunk
    except httpx.HTTPStatusError as exc:
        logger.warning(
            "llm.qa.upstream_http_error user_id=%s conversation_id=%s status=%s",
            user_id,
            conversation.id,
            exc.response.status_code,
        )
        yield _sse_frame(
            {
                "type": "error",
                "code": "llm_upstream",
                "message": "LLM 服务暂不可用, 请稍后重试.",
                "conversationId": conversation.id,
            }
        )
        return
    except httpx.TimeoutException:
        logger.warning(
            "llm.qa.upstream_timeout user_id=%s conversation_id=%s",
            user_id,
            conversation.id,
        )
        yield _sse_frame(
            {
                "type": "error",
                "code": "llm_timeout",
                "message": "LLM 响应超时, 请稍后重试.",
                "conversationId": conversation.id,
            }
        )
        return
    except httpx.RequestError as exc:
        # 3rd review P1 #1: catch httpx 传输层错误基类 (ConnectError /
        # ReadError / WriteError / RemoteProtocolError / NetworkError 等).
        # 之前漏 catch 让 mid-stream 网络断 → generator raise → 用户看 hang.
        logger.warning(
            "llm.qa.upstream_network_error user_id=%s conversation_id=%s "
            "err_type=%s err=%s",
            user_id,
            conversation.id,
            type(exc).__name__,
            exc,
        )
        yield _sse_frame(
            {
                "type": "error",
                "code": "llm_network",
                "message": "LLM 网络异常, 请稍后重试.",
                "conversationId": conversation.id,
            }
        )
        return
    except LLMServiceError as exc:
        logger.warning(
            "llm.qa.config_error user_id=%s conversation_id=%s err=%s",
            user_id,
            conversation.id,
            exc.message,
        )
        yield _sse_frame(
            {
                "type": "error",
                "code": exc.code,
                "message": exc.message,
                "conversationId": conversation.id,
            }
        )
        return
    except ValueError as exc:
        # 3rd review P1 #3: build_messages_for_llm invariant raise (理论上不
        # 发生 — create + append 都 add user msg). 防御性 catch 让 invariant
        # 违反时用户拿到 error 帧而非 stream hang.
        logger.error(
            "llm.qa.invariant_violation user_id=%s conversation_id=%s err=%s",
            user_id,
            conversation.id,
            exc,
        )
        yield _sse_frame(
            {
                "type": "error",
                "code": "internal",
                "message": "对话状态异常, 请刷新重试.",
                "conversationId": conversation.id,
            }
        )
        return

    # Stream completed. Record usage + finalize assistant message.
    if not accumulated_content:
        # 上游 0-content stream — 罕见 (LLM filter 触发?). 不写空 assistant.
        logger.warning(
            "llm.qa.empty_completion user_id=%s conversation_id=%s",
            user_id,
            conversation.id,
        )
        yield _sse_frame(
            {
                "type": "error",
                "code": "empty_completion",
                "message": "LLM 未返回内容, 请重试.",
                "conversationId": conversation.id,
            }
        )
        return

    # 2nd review P1: 包 try/except SQLAlchemyError 防 DB 失败时用户永等不到
    # done 帧. 分两层降级:
    # - record_usage 失败 → 仅丢记账 (warn log + token_usage=None), 仍写
    #   assistant 让对话历史完整 + 用户拿到 done 帧
    # - finalize_assistant_message / commit 失败 → 写消息也失败, 发 error 帧
    #   让前端知道对话没保存 (user_message 已 Phase 1 commit 仍持久, 用户可重发)
    token_usage: LlmTokenUsage | None = None
    try:
        token_usage = _record_usage_or_estimate(
            db=db,
            settings=settings,
            user_id=user_id,
            conversation=conversation,
            provider_label=provider_label,
            model=model,
            prompt_messages=llm_messages,
            completion_text=accumulated_content,
            final_chunk=final_chunk,
        )
    except SQLAlchemyError as exc:
        logger.warning(
            "llm.qa.record_usage_failed user_id=%s conversation_id=%s err=%s "
            "— finalizing message without usage row",
            user_id,
            conversation.id,
            exc,
        )
        db.rollback()  # 回滚部分 usage 行让 finalize 在 clean session

    try:
        assistant_msg = finalize_assistant_message(
            db,
            conversation=conversation,
            content=accumulated_content,
            token_usage=token_usage,
        )
        db.commit()
    except SQLAlchemyError as exc:
        logger.error(
            "llm.qa.finalize_failed user_id=%s conversation_id=%s err=%s",
            user_id,
            conversation.id,
            exc,
        )
        db.rollback()
        yield _sse_frame(
            {
                "type": "error",
                "code": "persistence_failed",
                "message": "对话保存失败, 请重试.",
                "conversationId": conversation.id,
            }
        )
        return

    # `conversationId` 加在 done frame 让前端创建会话后能续话 (Slice 1b 必需:
    # ChatPanel 第一轮 POST /conversations 后, 续话走 POST /conversations/{id}/messages
    # 需要 id). 续话端点 done 也带相同 id 让前端逻辑统一 (无害冗余).
    yield _sse_frame(
        {
            "type": "done",
            "messageId": assistant_msg.id,
            "conversationId": conversation.id,
        }
    )


def _sse_frame(payload: dict[str, object]) -> bytes:
    """SSE 单帧编码: `data: {json}\\n\\n` 双 newline 分隔.

    json.dumps 默认转义 ASCII 控制字符 (\\n / \\r / \\t 等) 为 \\\\n / \\\\r / \\\\t,
    所以 LLM content 含换行时 SSE 帧不会被中间 \\n 断开. ensure_ascii=False
    仅放过非 ASCII (中文等), 不放过控制字符.
    """
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode()


def _record_usage_or_estimate(
    *,
    db: Session,
    settings: Settings,
    user_id: int,
    conversation: LlmConversation,
    provider_label: ProviderLabel,
    model: str,
    prompt_messages: list[LLMMessage],
    completion_text: str,
    final_chunk: ChatCompletionChunk | None,
) -> LlmTokenUsage:
    """Record usage row. 真 usage 来自 final chunk; 缺则 R9 fallback estimate.

    provider_label 从 build_llm_provider 直接拿 ('system' | 'user_byom') —
    Slice 1a review P1 修: 早先用 has-BYOM-default 反推, BYOM fallback system
    场景错标 'user_byom'. 现在 factory 是 truth source.
    """
    if (
        final_chunk is not None
        and final_chunk.prompt_tokens is not None
        and final_chunk.completion_tokens is not None
    ):
        prompt_tokens = final_chunk.prompt_tokens
        completion_tokens = final_chunk.completion_tokens
        cache_hit = final_chunk.prompt_cache_hit_tokens or 0
        cache_miss = final_chunk.prompt_cache_miss_tokens or 0
        # DeepSeek 单返 prompt_tokens, 不一定拆 hit/miss; 业务层 default
        # miss=prompt_tokens 让计费按 miss 价 (保守).
        if cache_hit == 0 and cache_miss == 0:
            cache_miss = prompt_tokens
        estimated = False
    else:
        # R9 fallback: tiktoken 估算 (settings.llm_usage_estimate_fallback).
        prompt_text = "\n".join(getattr(m, "content", "") for m in prompt_messages)
        prompt_tokens = estimate_tokens(
            prompt_text, settings.llm_usage_estimate_fallback
        )
        completion_tokens = estimate_tokens(
            completion_text, settings.llm_usage_estimate_fallback
        )
        cache_hit = 0
        cache_miss = prompt_tokens
        estimated = True
        logger.info(
            "llm.qa.usage_estimated user_id=%s conversation_id=%s prompt=%s completion=%s",
            user_id,
            conversation.id,
            prompt_tokens,
            completion_tokens,
        )

    return record_usage(
        db,
        UsageRecord(
            feature="qa",
            user_id=user_id,
            provider=provider_label,
            model=model,
            prompt_tokens=prompt_tokens,
            prompt_cache_hit_tokens=cache_hit,
            prompt_cache_miss_tokens=cache_miss,
            completion_tokens=completion_tokens,
            estimated=estimated,
            resource_type="conversation",
            resource_id=conversation.id,
        ),
    )
