"""AI 答疑会话业务层 — Slice 1a.

职责拆分:
- CRUD: create_conversation / list_conversations / get_conversation / delete_conversation
- 续话: append_user_message
- LLM 准备: build_messages_for_llm (转 ORM history + context → list[LLMMessage])
- LLM 完成回写: finalize_assistant_message (stream 累积完成后写入)

不做的事:
- LLM 调用本身 — route handler 拿 (conversation, llm_messages) 自己 stream
- token usage 记账 — route handler 调 record_usage (Slice 0b helper) 拿 row.id
  回填 finalize_assistant_message(token_usage_id=...)
- context fetching for 'wrong_question' / 'session_result' — Slice 1b/2x 接,
  当前返 None + warn log

context_kind == 'question' Slice 1a 实施 (从 questions 表取 stem + options).
context_kind == 'general' → context_text=None.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from sikao_api.db.models import (
    LlmConversation,
    LlmMessage,
    LlmTokenUsage,
    Question,
    QuestionOption,
)
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.llm.application.llm.prompts.qa import (
    build_qa_messages,
    compose_user_content_for_storage,
)
from sikao_api.modules.llm.application.llm.provider import LLMMessage

logger = logging.getLogger(__name__)

CONTEXT_KINDS_KNOWN = frozenset(
    {"question", "wrong_question", "session_result", "general"}
)

_TITLE_FALLBACK_MAX_LEN = 32
_LIST_DEFAULT_LIMIT = 20
_LAST_PREVIEW_MAX_LEN = 80


class ConversationNotFoundError(NotFoundError):
    """会话不存在 / 跨用户访问 (避 timing leak 不区分两情况, 跟 0c BYOM 一致)."""

    def __init__(self, conversation_id: int) -> None:
        super().__init__(
            message=f"conversation {conversation_id} not found",
            code="conversation_not_found",
        )


# ─── CRUD ─────────────────────────────────────────────────────────────────


def create_conversation(
    db: Session,
    *,
    user_id: int,
    context_kind: str,
    context_id: int | None,
    title: str | None,
    user_message: str,
    intent_hint: str = "freeform",
) -> LlmConversation:
    """创建会话 + 落首条 user message. 返回 conversation (含 message 已 flush
    拿到 id). title None → 用 user_message 前 N 字截断兜底.

    `intent_hint` 经 `compose_user_content_for_storage` 拼到 user_message 末尾
    一并存 DB (4th-review P1 fix): history 回放给 LLM 时跟 turn 1 实际 prompt
    bytes 一致, prompt cache 命中率提升. title fallback 仍用 raw user_message
    截断, 不暴露 guidance suffix.

    `context_kind` 必须在 CONTEXT_KINDS_KNOWN 内 (route 层 Pydantic Literal
    enforce, 这里防御性 check).
    """
    if context_kind not in CONTEXT_KINDS_KNOWN:
        raise ValueError(f"unknown context_kind: {context_kind!r}")

    resolved_title = title or _fallback_title(user_message)
    stored_content = compose_user_content_for_storage(user_message, intent_hint)
    conversation = LlmConversation(
        user_id=user_id,
        title=resolved_title,
        context_kind=context_kind,
        context_id=context_id,
    )
    db.add(conversation)
    db.flush()  # 拿 conversation.id 给 message FK

    user_msg = LlmMessage(
        conversation_id=conversation.id,
        role="user",
        content=stored_content,
    )
    db.add(user_msg)
    db.flush()
    return conversation


def append_user_message(
    db: Session,
    *,
    user_id: int,
    conversation_id: int,
    user_message: str,
    intent_hint: str = "freeform",
) -> LlmConversation:
    """续 user message 到已有会话. 跨 user 访问 → ConversationNotFoundError.

    `intent_hint` 经 `compose_user_content_for_storage` 拼到 user_message 末尾
    一并存 DB (跟 create_conversation 一致, 让 history 跟 LLM call bytes 一致).

    刷新 updated_at 让 list 排序看到最近活跃 (ORM onupdate 仅对 UPDATE 触发,
    这里是新 message INSERT 不动 conversation row, 需 explicit utc_now()).
    """
    conversation = _get_user_conversation(db, user_id=user_id, conversation_id=conversation_id)
    stored_content = compose_user_content_for_storage(user_message, intent_hint)
    msg = LlmMessage(
        conversation_id=conversation.id,
        role="user",
        content=stored_content,
    )
    db.add(msg)
    from sikao_api.db.models import utc_now

    conversation.updated_at = utc_now()
    db.flush()
    return conversation


def list_conversations(
    db: Session,
    *,
    user_id: int,
    limit: int = _LIST_DEFAULT_LIMIT,
) -> list[tuple[LlmConversation, int, str | None]]:
    """List user's conversations DESC by updated_at. 返 (conv, message_count,
    last_preview) tuples.

    last_preview = 末条 assistant 消息前 80 字 (无 assistant 时 None).
    message_count = 该会话所有消息数 (含 user/system/assistant).
    """
    convs = list(
        db.execute(
            select(LlmConversation)
            .where(LlmConversation.user_id == user_id)
            .order_by(desc(LlmConversation.updated_at))
            .limit(limit)
        ).scalars()
    )
    if not convs:
        return []

    counts = _get_message_counts(db, [c.id for c in convs])
    previews = _get_last_assistant_previews(db, [c.id for c in convs])
    return [(c, counts.get(c.id, 0), previews.get(c.id)) for c in convs]


def get_conversation(
    db: Session, *, user_id: int, conversation_id: int
) -> LlmConversation:
    """单会话明细 (含 messages, ORM relationship 自动 eager 拉). 跨 user → 404."""
    return _get_user_conversation(db, user_id=user_id, conversation_id=conversation_id)


def delete_conversation(
    db: Session, *, user_id: int, conversation_id: int
) -> None:
    """删会话. 跨 user → 404. messages 走 cascade (FK ondelete=CASCADE +
    relationship cascade='all, delete-orphan' 双层)."""
    conversation = _get_user_conversation(
        db, user_id=user_id, conversation_id=conversation_id
    )
    db.delete(conversation)
    db.flush()


# ─── LLM 调用准备 / 完成回写 ──────────────────────────────────────────────


def build_messages_for_llm(
    db: Session,
    *,
    conversation: LlmConversation,
) -> list[LLMMessage]:
    """从会话历史 + context_kind/id 构造 LLM messages.

    - 拉 conversation.messages 全部 (升序), 转 LLMMessage role+content. 注意
      user msg 的 content 是 storage form (含 intent guidance suffix, 由
      compose_user_content_for_storage 在 create/append 时写入).
    - 末条必须是 user (刚 INSERT 的). build_qa_messages 把 history (除末 user)
      + 末 user_message 分发.
    - context_text 由 _resolve_context_text 抓 (Slice 1a 仅 'question').

    intent_hint 不再是参数 (4th-review P1 fix): guidance 已在 compose 阶段拼
    入 user content, history 跟 current user msg 都是 storage form 直接送 LLM.
    """
    history_msgs = list(conversation.messages)
    if not history_msgs or history_msgs[-1].role != "user":
        raise ValueError(
            "conversation must end with a user message before LLM call"
        )

    context_text = _resolve_context_text(
        db,
        kind=conversation.context_kind,
        context_id=conversation.context_id,
    )

    history_for_llm = [
        LLMMessage(role=m.role, content=m.content)
        for m in history_msgs[:-1]  # 除末 user
        if m.role in ("user", "assistant")
    ]
    user_message = history_msgs[-1].content  # storage form, 含 guidance suffix

    return build_qa_messages(
        context_text=context_text,
        history=history_for_llm,
        user_message=user_message,
    )


def finalize_assistant_message(
    db: Session,
    *,
    conversation: LlmConversation,
    content: str,
    token_usage: LlmTokenUsage | None,
) -> LlmMessage:
    """Stream 累积完成后写入 assistant 消息 + 关联 token_usage_id.

    token_usage None → user 在中途 cancel / 上游 0 token 错误等场景, 不阻塞.
    finalize 仍调用让前端历史回看有 partial assistant content.
    """
    from sikao_api.db.models import utc_now

    msg = LlmMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=content,
        token_usage_id=token_usage.id if token_usage is not None else None,
    )
    db.add(msg)
    conversation.updated_at = utc_now()
    db.flush()
    return msg


# ─── 内部 helpers ────────────────────────────────────────────────────────


def _get_user_conversation(
    db: Session, *, user_id: int, conversation_id: int
) -> LlmConversation:
    """Fetch 会话, 跨 user 也返 404 (timing leak 防护, 跟 0c 一致)."""
    conversation = db.execute(
        select(LlmConversation).where(
            LlmConversation.id == conversation_id,
            LlmConversation.user_id == user_id,
        )
    ).scalar_one_or_none()
    if conversation is None:
        raise ConversationNotFoundError(conversation_id)
    return conversation


def _get_message_counts(
    db: Session, conversation_ids: Iterable[int]
) -> dict[int, int]:
    rows = db.execute(
        select(LlmMessage.conversation_id, func.count(LlmMessage.id))
        .where(LlmMessage.conversation_id.in_(list(conversation_ids)))
        .group_by(LlmMessage.conversation_id)
    ).all()
    return {cid: cnt for cid, cnt in rows}


def _get_last_assistant_previews(
    db: Session, conversation_ids: Iterable[int]
) -> dict[int, str]:
    """每会话末条 assistant 消息前 N 字. 无 assistant → 不入 dict (caller None)."""
    ids = list(conversation_ids)
    if not ids:
        return {}
    # subquery: 每会话 max(created_at) where role='assistant'
    last_per_conv = (
        select(
            LlmMessage.conversation_id,
            func.max(LlmMessage.created_at).label("max_created"),
        )
        .where(
            LlmMessage.conversation_id.in_(ids),
            LlmMessage.role == "assistant",
        )
        .group_by(LlmMessage.conversation_id)
        .subquery()
    )
    rows = db.execute(
        select(LlmMessage.conversation_id, LlmMessage.content)
        .join(
            last_per_conv,
            (LlmMessage.conversation_id == last_per_conv.c.conversation_id)
            & (LlmMessage.created_at == last_per_conv.c.max_created)
            & (LlmMessage.role == "assistant"),
        )
    ).all()
    return {cid: _truncate(content, _LAST_PREVIEW_MAX_LEN) for cid, content in rows}


def _resolve_context_text(
    db: Session, *, kind: str, context_id: int | None
) -> str | None:
    """根据 context_kind 抓格式化好的 context 文本. Slice 1a 仅 'question',
    其他三类 stub None + warn log (Slice 1b/2x 接).

    'general' / context_id None → None (无上下文).
    """
    if kind == "general" or context_id is None:
        return None
    if kind == "question":
        return _format_question_context(db, context_id)
    logger.warning(
        "llm.qa.context_kind_not_implemented kind=%s context_id=%s — "
        "no context injected (Slice 1a only 'question')",
        kind,
        context_id,
    )
    return None


def _format_question_context(db: Session, question_id: int) -> str | None:
    """Format question stem + options + answer into prompt context text.

    Question 不存在 → None + warn log (前端可能传陈旧 ID, 不阻塞答疑流).
    """
    question = db.get(Question, question_id)
    if question is None:
        logger.warning(
            "llm.qa.question_not_found question_id=%s — no context", question_id
        )
        return None
    options = list(
        db.execute(
            select(QuestionOption)
            .where(QuestionOption.question_id == question_id)
            .order_by(QuestionOption.display_order)
        ).scalars()
    )
    parts = [f"题干: {question.stem_text}"]
    if options:
        opt_lines = "\n".join(
            f"  {opt.option_key}. {opt.option_text}" for opt in options
        )
        parts.append(f"选项:\n{opt_lines}")
    if question.answer_text:
        parts.append(f"正确答案: {question.answer_text}")
    if question.explanation_text:
        parts.append(f"解析: {question.explanation_text}")
    return "\n\n".join(parts)


def _fallback_title(user_message: str) -> str:
    """user_message 前 N 字截断作 title, 末尾长则加 ellipsis."""
    stripped = user_message.strip()
    if len(stripped) <= _TITLE_FALLBACK_MAX_LEN:
        return stripped or "新会话"
    return stripped[: _TITLE_FALLBACK_MAX_LEN - 1] + "…"


def _truncate(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


__all__ = [
    "CONTEXT_KINDS_KNOWN",
    "ConversationNotFoundError",
    "append_user_message",
    "build_messages_for_llm",
    "create_conversation",
    "delete_conversation",
    "finalize_assistant_message",
    "get_conversation",
    "list_conversations",
]
