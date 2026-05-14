"""LLM AI 答疑会话 — Slice 1a 测试.

Cover:
- prompts/qa.py: build_qa_messages 5 intent 各注入 guidance + freeform 不注入
- services/llm/conversations.py: CRUD + build_messages_for_llm + context fetch
- routes/llm_conversations_v2.py: list/get/delete + SSE POST stream + cancel
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db.models import (
    LlmConversation,
    LlmMessage,
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    Question,
    QuestionOption,
    User,
)
from sikao_api.main import create_app
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.llm.application.llm.conversations import (
    ConversationNotFoundError,
    append_user_message,
    build_messages_for_llm,
    create_conversation,
    delete_conversation,
    finalize_assistant_message,
    get_conversation,
    list_conversations,
)
from sikao_api.modules.llm.application.llm.prompts.qa import (
    INTENT_GUIDANCE_MARKER,
    INTENT_HINTS_KNOWN,
    QA_SYSTEM_MESSAGE,
    build_qa_messages,
    compose_user_content_for_storage,
    extract_displayed_user_message,
)
from sikao_api.modules.llm.application.llm.provider import (
    ChatCompletionChunk,
    ChatCompletionResult,
    LLMMessage,
)
from sikao_api.modules.auth.application.security import hash_password

# ─── Prompt builder ────────────────────────────────────────────────────────


def test_qa_intent_hints_known_set_complete() -> None:
    """5 类 intent 全在 KNOWN 集合 (plan §4.4)."""
    expected = {
        "why_wrong",
        "common_traps",
        "solving_path",
        "category_summary",
        "freeform",
    }
    assert INTENT_HINTS_KNOWN == expected


def test_qa_build_messages_basic_layout() -> None:
    """build_qa_messages: system + history + user, user_message 由 caller 已带
    storage form (含 / 不含 guidance suffix). builder 不再处理 intent."""
    msgs = build_qa_messages(
        context_text=None,
        history=[],
        user_message="为什么 B 不对",
    )
    assert len(msgs) == 2  # system + user
    assert msgs[0].role == "system"
    assert msgs[0].content == QA_SYSTEM_MESSAGE
    assert msgs[1].role == "user"
    assert msgs[1].content == "为什么 B 不对"  # caller-provided, builder 不变


def test_qa_build_messages_context_text_appended() -> None:
    """context_text 注入 system prompt 内, user 不带."""
    msgs = build_qa_messages(
        context_text="题干: 这是一道题",
        history=[],
        user_message="为什么",
    )
    assert "题干: 这是一道题" in msgs[0].content
    assert msgs[1].role == "user"
    assert "题干" not in msgs[1].content


def test_qa_build_messages_history_preserved() -> None:
    """既往 user/assistant 轮在 system 之后, 末轮 user 之前 (按时序).

    history 里的 user.content 是 storage form (含 guidance suffix), builder
    透传. 这让 turn N 看到的 history 跟 turn 1 实际发的 prompt bytes 一致.
    """
    history = [
        LLMMessage(role="user", content="prev q1"),
        LLMMessage(role="assistant", content="prev a1"),
    ]
    msgs = build_qa_messages(
        context_text=None,
        history=history,
        user_message="q2",
    )
    assert [m.role for m in msgs] == ["system", "user", "assistant", "user"]
    assert msgs[1].content == "prev q1"
    assert msgs[2].content == "prev a1"
    assert msgs[3].content == "q2"


@pytest.mark.parametrize(
    "intent,marker",
    [
        ("why_wrong", "为什么我的答案错了"),
        ("common_traps", "常见错法"),
        ("solving_path", "步骤 1"),
        ("category_summary", "题型归类"),
    ],
)
def test_compose_user_content_appends_guidance(intent: str, marker: str) -> None:
    """compose_user_content_for_storage 把 intent guidance 拼到 user message
    末尾用 INTENT_GUIDANCE_MARKER 分隔. service 层用此函数产出 storage form."""
    composed = compose_user_content_for_storage("ping", intent)
    assert composed.startswith("ping")
    assert INTENT_GUIDANCE_MARKER in composed
    assert marker in composed


def test_compose_user_content_freeform_returns_raw() -> None:
    """freeform → 直接返 raw user_message, 不加 marker."""
    composed = compose_user_content_for_storage("hello", "freeform")
    assert composed == "hello"
    assert INTENT_GUIDANCE_MARKER not in composed


def test_compose_user_content_unknown_intent_falls_back_to_freeform() -> None:
    """非已知 intent silent fallback 'freeform' (Pydantic Literal 已防, 这里防御)."""
    composed = compose_user_content_for_storage("hello", "bogus_intent")
    assert composed == "hello"


def test_extract_displayed_user_message_strips_guidance() -> None:
    """extract_displayed_user_message 从 storage form 抽出 raw 给前端展示."""
    composed = compose_user_content_for_storage("为什么 B 不对", "why_wrong")
    assert extract_displayed_user_message(composed) == "为什么 B 不对"


def test_extract_displayed_user_message_no_marker_returns_input() -> None:
    """无 marker 的 content (freeform / assistant) 直接返."""
    assert extract_displayed_user_message("hello") == "hello"


def test_qa_system_prompt_stable_across_intent_switches() -> None:
    """同 context_text 但 user_message 不同 intent storage form 时, system
    prompt bytes-identical 让 DeepSeek prompt cache 命中 (R13, 50x cheaper)."""
    sys_a = build_qa_messages(
        context_text="题干: A",
        history=[],
        user_message=compose_user_content_for_storage("q", "why_wrong"),
    )[0].content
    sys_b = build_qa_messages(
        context_text="题干: A",
        history=[],
        user_message=compose_user_content_for_storage("q", "common_traps"),
    )[0].content
    sys_c = build_qa_messages(
        context_text="题干: A",
        history=[],
        user_message=compose_user_content_for_storage("q", "freeform"),
    )[0].content
    assert sys_a == sys_b == sys_c


# ─── Service (CRUD + LLM 准备) ─────────────────────────────────────────────


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_user(db: Session, *, username: str = "alice") -> User:
    user = User(
        username=username,
        password_hash=hash_password("password"),
        display_name=username,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def test_create_conversation_inserts_user_message(session: Session) -> None:
    user = _make_user(session)
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="hello world",
    )
    assert conv.id is not None
    assert conv.title == "hello world"  # fallback from user_message (raw)
    assert conv.context_kind == "general"
    assert len(conv.messages) == 1
    assert conv.messages[0].role == "user"
    # default intent_hint='freeform' → storage form == raw user message
    assert conv.messages[0].content == "hello world"


def test_create_conversation_with_intent_stores_composed_content(
    session: Session,
) -> None:
    """4th-review P1 fix: intent_hint != freeform → DB 存 raw + guidance suffix.

    title 仍用 raw user_message 兜底截断, 不暴露 guidance.
    """
    user = _make_user(session)
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="为什么 B 不对",
        intent_hint="why_wrong",
    )
    stored = conv.messages[0].content
    assert stored.startswith("为什么 B 不对")
    assert INTENT_GUIDANCE_MARKER in stored
    assert "为什么我的答案错了" in stored  # why_wrong guidance marker
    # title 是 raw, 不含 marker
    assert "[本题作答提示]" not in conv.title


def test_create_conversation_title_fallback_truncates_long_message(
    session: Session,
) -> None:
    user = _make_user(session)
    long_msg = "a" * 100
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message=long_msg,
    )
    assert len(conv.title) <= 32
    assert conv.title.endswith("…")


def test_create_conversation_unknown_context_kind_raises(session: Session) -> None:
    user = _make_user(session)
    with pytest.raises(ValueError, match="unknown context_kind"):
        create_conversation(
            session,
            user_id=user.id,
            context_kind="bogus_kind",
            context_id=None,
            title=None,
            user_message="x",
        )


def test_append_user_message_cross_user_404(session: Session) -> None:
    alice = _make_user(session, username="alice")
    bob = _make_user(session, username="bob")
    conv = create_conversation(
        session,
        user_id=alice.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="alice msg",
    )
    with pytest.raises(ConversationNotFoundError):
        append_user_message(
            session, user_id=bob.id, conversation_id=conv.id, user_message="hack"
        )


def test_append_user_message_bumps_updated_at(session: Session) -> None:
    """续 message 后 updated_at 必须刷新让 list 排序看到最近活跃."""
    import time

    user = _make_user(session)
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="first",
    )
    initial_updated = conv.updated_at
    time.sleep(0.01)  # SQLite datetime 精度毫秒级
    append_user_message(
        session,
        user_id=user.id,
        conversation_id=conv.id,
        user_message="follow up",
    )
    session.refresh(conv)
    assert conv.updated_at > initial_updated


def test_list_conversations_orders_by_updated_at_desc(session: Session) -> None:
    import time

    user = _make_user(session)
    conv1 = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title="one",
        user_message="m1",
    )
    time.sleep(0.01)
    conv2 = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title="two",
        user_message="m2",
    )
    rows = list_conversations(session, user_id=user.id)
    ids = [c.id for c, _, _ in rows]
    assert ids == [conv2.id, conv1.id]


def test_list_conversations_includes_message_count_and_preview(
    session: Session,
) -> None:
    user = _make_user(session)
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title="t",
        user_message="user q",
    )
    finalize_assistant_message(
        session, conversation=conv, content="assistant reply", token_usage=None
    )
    rows = list_conversations(session, user_id=user.id)
    assert len(rows) == 1
    _, count, preview = rows[0]
    assert count == 2  # user + assistant
    assert preview == "assistant reply"


def test_list_conversations_isolates_users(session: Session) -> None:
    alice = _make_user(session, username="alice")
    bob = _make_user(session, username="bob")
    create_conversation(
        session,
        user_id=alice.id,
        context_kind="general",
        context_id=None,
        title="a",
        user_message="m",
    )
    rows = list_conversations(session, user_id=bob.id)
    assert rows == []


def test_get_conversation_cross_user_404(session: Session) -> None:
    alice = _make_user(session, username="alice")
    bob = _make_user(session, username="bob")
    conv = create_conversation(
        session,
        user_id=alice.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="m",
    )
    with pytest.raises(NotFoundError):
        get_conversation(session, user_id=bob.id, conversation_id=conv.id)


def test_delete_conversation_cascades_messages(session: Session) -> None:
    user = _make_user(session)
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="m",
    )
    finalize_assistant_message(
        session, conversation=conv, content="reply", token_usage=None
    )
    conv_id = conv.id
    delete_conversation(session, user_id=user.id, conversation_id=conv_id)
    session.flush()
    # messages 全部 cascade 删
    remaining = (
        session.query(LlmMessage).filter_by(conversation_id=conv_id).count()
    )
    assert remaining == 0
    assert session.get(LlmConversation, conv_id) is None


def test_build_messages_for_llm_general_context(session: Session) -> None:
    user = _make_user(session)
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="why",
        intent_hint="freeform",
    )
    msgs = build_messages_for_llm(session, conversation=conv)
    # general 无 context_text, msgs = [system tone, user]
    assert len(msgs) == 2
    assert msgs[0].role == "system"
    assert "上下文:" not in msgs[0].content
    assert msgs[1].content == "why"


def test_build_messages_for_llm_question_context_injects_stem(
    session: Session,
) -> None:
    """context_kind='question' + context_id → 抓 question 表 stem + options.

    intent_hint='why_wrong' 在 create 时已经写入 storage form, build_messages
    透传 → user message 含 guidance suffix.
    """
    user = _make_user(session)
    question = _make_question(session, stem="选项中的关键信息是?", answer="A")
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="question",
        context_id=question.id,
        title=None,
        user_message="为什么",
        intent_hint="why_wrong",
    )
    msgs = build_messages_for_llm(session, conversation=conv)
    system_content = msgs[0].content
    assert "题干: 选项中的关键信息是?" in system_content  # context 在 system
    assert "选项:" in system_content
    # intent guidance 在 user message storage form 内 (compose 阶段拼入)
    user_content = msgs[-1].content
    assert "为什么我的答案错了" in user_content
    assert user_content.startswith("为什么")
    assert INTENT_GUIDANCE_MARKER in user_content


def test_build_messages_for_llm_history_keeps_storage_form(
    session: Session,
) -> None:
    """4th-review P1 fix 关键 invariant: turn 2 时 history 里的 user1 content
    必须跟 turn 1 实际发给 LLM 的 user1 bytes 一致 (含 guidance suffix), 让
    DeepSeek prompt cache 跨轮命中 + model 看到的 history 跟 turn 1 实际一致."""
    user = _make_user(session)
    # turn 1: why_wrong intent
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="general",
        context_id=None,
        title=None,
        user_message="为什么 B 不对",
        intent_hint="why_wrong",
    )
    finalize_assistant_message(
        session, conversation=conv, content="assistant reply 1", token_usage=None
    )
    # turn 2: 切 common_traps intent
    append_user_message(
        session,
        user_id=user.id,
        conversation_id=conv.id,
        user_message="再问一个",
        intent_hint="common_traps",
    )
    msgs = build_messages_for_llm(session, conversation=conv)
    # [system, user1+why_wrong_guidance, assistant1, user2+common_traps_guidance]
    assert [m.role for m in msgs] == ["system", "user", "assistant", "user"]
    # turn 1 user content 仍带 why_wrong guidance (storage form preserved)
    assert "为什么 B 不对" in msgs[1].content
    assert "为什么我的答案错了" in msgs[1].content
    assert INTENT_GUIDANCE_MARKER in msgs[1].content
    # turn 2 user content 含 common_traps guidance
    assert "再问一个" in msgs[3].content
    assert "常见错法" in msgs[3].content


def test_build_messages_for_llm_unknown_kind_falls_back_no_context(
    session: Session,
) -> None:
    """'wrong_question' / 'session_result' 在 Slice 1a stub: 无 context 注入."""
    user = _make_user(session)
    conv = create_conversation(
        session,
        user_id=user.id,
        context_kind="wrong_question",
        context_id=42,  # 不存在也无所谓, 走 stub
        title=None,
        user_message="q",
    )
    msgs = build_messages_for_llm(session, conversation=conv)
    assert "上下文:" not in msgs[0].content


# ─── Helpers (build minimum question fixture) ─────────────────────────────


def _make_question(
    db: Session, *, stem: str = "stem", answer: str = "A"
) -> Question:
    """Minimal question with paper / revision / section / block + 2 options.

    Question 表 FK 链: question → block → section → revision → paper.
    """
    paper = Paper(paper_code="P1", paper_name="P1")
    db.add(paper)
    db.flush()
    revision = PaperRevision(
        paper_id=paper.id,
        revision_number=1,
        sort_order=1,
        paper_name="P1",
        source_hash="hash1",
    )
    db.add(revision)
    db.flush()
    section = PaperSection(
        paper_revision_id=revision.id,
        section_key="sec1",
        title="s",
        display_order=1,
    )
    db.add(section)
    db.flush()
    block = PaperBlock(
        paper_revision_id=revision.id,
        section_id=section.id,
        block_type="single_choice",
        display_order=1,
    )
    db.add(block)
    db.flush()
    question = Question(
        paper_revision_id=revision.id,
        section_id=section.id,
        block_id=block.id,
        position=1,
        source_uuid="q-uuid-1",
        question_kind="single_choice",
        subtype_name="single_choice",
        stem_text=stem,
        answer_text=answer,
        explanation_text="",
    )
    db.add(question)
    db.flush()
    db.add_all(
        [
            QuestionOption(
                question_id=question.id,
                option_key="A",
                option_text="opt A",
                display_order=1,
            ),
            QuestionOption(
                question_id=question.id,
                option_key="B",
                option_text="opt B",
                display_order=2,
            ),
        ]
    )
    db.flush()
    return question


# ─── Routes (TestClient) ───────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path):  # type: ignore[no-untyped-def]
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        # Slice 1a: routes call build_llm_provider — 必须有 api_key 否则
        # LLMConfigError. 测试 mock provider, 这里随便填.
        llm_api_key="test-key",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as c:
        yield c, settings


def _register(client: TestClient, *, username: str = "user1") -> int:
    """Register + auto-login (cookie)."""
    resp = client.post(
        "/api/v2/auth/register/email",
        json={"email": f"{username}@test.local", "password": "passw0rd", "displayName": username},
    )
    assert resp.status_code == 200, resp.text
    return int(resp.json()["user"]["id"])


def _csrf_header(client: TestClient) -> dict[str, str]:
    """Phase B: CSRF double-submit cookie. Token 由 register 返 + cookie 设置.

    register 响应里有 csrfToken 字段 (若没有, 走 cookie csrf_token 直接读).
    """
    csrf = client.cookies.get("csrf_token")
    assert csrf, "csrf_token cookie missing — check Phase B login flow"
    return {"X-CSRF-Token": csrf}


def test_endpoint_list_conversations_unauthenticated_401(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    resp = c.get("/api/v2/llm/conversations")
    assert resp.status_code == 401


def test_endpoint_list_conversations_empty(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/llm/conversations")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"items": []}


def test_endpoint_post_conversation_csrf_missing_403(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    _register(c)
    # 无 X-CSRF-Token header
    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "hi",
            "intentHint": "freeform",
        },
    )
    assert resp.status_code == 403


# ─── SSE streaming endpoints (mock provider) ──────────────────────────────


class _FakeProvider:
    """Mock LLMProvider for SSE tests. 预设 chunks list yield."""

    def __init__(self, chunks: list[ChatCompletionChunk]) -> None:
        self._chunks = chunks

    async def chat_completion(  # pragma: no cover - sync API not used in SSE tests
        self, **_kwargs: object
    ) -> ChatCompletionResult:
        raise NotImplementedError

    async def chat_completion_stream(
        self, **_kwargs: object
    ) -> AsyncIterator[ChatCompletionChunk]:
        for chunk in self._chunks:
            yield chunk


def _patch_provider(monkeypatch, chunks: list[ChatCompletionChunk]) -> None:  # type: ignore[no-untyped-def]
    """Replace build_llm_provider for both routes module + factory.

    build_llm_provider 返 (provider, label) tuple — Slice 1a review P1 修.
    """
    fake = _FakeProvider(chunks)
    monkeypatch.setattr(
        "sikao_api.modules.llm.interface.conversations.build_llm_provider",
        lambda *a, **kw: (fake, "system"),
    )


def _final_chunk(*, completion_tokens: int = 10) -> ChatCompletionChunk:
    return ChatCompletionChunk(
        content_delta="",
        is_final=True,
        prompt_tokens=20,
        prompt_cache_hit_tokens=0,
        prompt_cache_miss_tokens=20,
        completion_tokens=completion_tokens,
        finish_reason="stop",
    )


def _delta_chunk(text: str) -> ChatCompletionChunk:
    return ChatCompletionChunk(
        content_delta=text,
        is_final=False,
        prompt_tokens=None,
        prompt_cache_hit_tokens=None,
        prompt_cache_miss_tokens=None,
        completion_tokens=None,
        finish_reason=None,
    )


def _parse_sse_frames(body: bytes) -> list[dict[str, object]]:
    """Parse SSE body → list of decoded JSON payloads."""
    frames: list[dict[str, object]] = []
    for raw in body.decode("utf-8").split("\n\n"):
        line = raw.strip()
        if not line.startswith("data: "):
            continue
        payload = line[len("data: "):]
        frames.append(json.loads(payload))
    return frames


def test_endpoint_post_conversation_streams_assistant_reply(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    c, _ = client
    _register(c)
    _patch_provider(
        monkeypatch,
        chunks=[
            _delta_chunk("Hello"),
            _delta_chunk(" world"),
            _final_chunk(completion_tokens=2),
        ],
    )
    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "hi",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/event-stream")
    frames = _parse_sse_frames(resp.content)
    types = [f["type"] for f in frames]
    # 3rd review P1 #3: 第一帧必为 'created' 含 conversationId, 让用户在
    # 任何时刻 abort 都拿到 id 续话.
    assert types == ["created", "delta", "delta", "done"]
    assert isinstance(frames[0]["conversationId"], int)
    assert frames[1]["content"] == "Hello"
    assert frames[2]["content"] == " world"
    assert isinstance(frames[3]["messageId"], int)
    # done frame 含 conversationId 冗余防 created 漏 (理论不会但防御性).
    assert frames[3]["conversationId"] == frames[0]["conversationId"]


def test_endpoint_post_conversation_persists_assistant_and_usage(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """Stream 完成后 assistant message + llm_token_usage row 落库."""
    c, settings = client
    _register(c)
    _patch_provider(
        monkeypatch,
        chunks=[_delta_chunk("Hi"), _final_chunk(completion_tokens=1)],
    )
    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200, resp.text
    frames = _parse_sse_frames(resp.content)
    done = [f for f in frames if f["type"] == "done"][0]
    msg_id = done["messageId"]

    # 验证 DB: conversation + 2 messages + 1 usage row.
    from sikao_api.db.session import DatabaseManager

    db_mgr = DatabaseManager(settings)
    sess = db_mgr.session_factory()
    try:
        conv = sess.query(LlmConversation).first()
        assert conv is not None
        msgs = (
            sess.query(LlmMessage)
            .filter_by(conversation_id=conv.id)
            .order_by(LlmMessage.created_at)
            .all()
        )
        assert [m.role for m in msgs] == ["user", "assistant"]
        assert msgs[1].id == msg_id
        assert msgs[1].content == "Hi"
        assert msgs[1].token_usage_id is not None
        from sikao_api.db.models import LlmTokenUsage

        usage = sess.get(LlmTokenUsage, msgs[1].token_usage_id)
        assert usage is not None
        assert usage.feature == "qa"
        assert usage.completion_tokens == 1
        assert usage.prompt_tokens == 20
        assert usage.estimated is False
    finally:
        sess.close()


def test_endpoint_post_conversation_estimates_when_usage_missing(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """final chunk 无 usage → tiktoken 估算 + estimated=True (R9 fallback)."""
    c, settings = client
    _register(c)

    final_no_usage = ChatCompletionChunk(
        content_delta="",
        is_final=True,
        prompt_tokens=None,
        prompt_cache_hit_tokens=None,
        prompt_cache_miss_tokens=None,
        completion_tokens=None,
        finish_reason="stop",
    )
    _patch_provider(monkeypatch, chunks=[_delta_chunk("Hi"), final_no_usage])

    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200

    from sikao_api.db.session import DatabaseManager
    from sikao_api.db.models import LlmTokenUsage

    sess = DatabaseManager(settings).session_factory()
    try:
        usage = sess.query(LlmTokenUsage).first()
        assert usage is not None
        assert usage.estimated is True
    finally:
        sess.close()


def test_endpoint_continue_conversation_appends_and_streams(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """POST /conversations/{id}/messages 续话 + SSE stream."""
    c, settings = client
    _register(c)

    # First create a conversation (1 stream call).
    _patch_provider(
        monkeypatch,
        chunks=[_delta_chunk("first"), _final_chunk()],
    )
    create_resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "q1",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert create_resp.status_code == 200

    # Get conversation id.
    list_resp = c.get("/api/v2/llm/conversations")
    conv_id = list_resp.json()["items"][0]["id"]

    # Continue.
    _patch_provider(monkeypatch, chunks=[_delta_chunk("second"), _final_chunk()])
    cont_resp = c.post(
        f"/api/v2/llm/conversations/{conv_id}/messages",
        json={"userMessage": "q2", "intentHint": "freeform"},
        headers=_csrf_header(c),
    )
    assert cont_resp.status_code == 200
    frames = _parse_sse_frames(cont_resp.content)
    deltas = [f["content"] for f in frames if f["type"] == "delta"]
    assert deltas == ["second"]

    # 4 messages: user q1, assistant first, user q2, assistant second.
    detail_resp = c.get(f"/api/v2/llm/conversations/{conv_id}")
    detail = detail_resp.json()
    roles = [m["role"] for m in detail["messages"]]
    assert roles == ["user", "assistant", "user", "assistant"]


def test_endpoint_get_conversation_cross_user_404(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    _register(c, username="alice")
    # alice 无会话 → 任何 id 都 404
    resp = c.get("/api/v2/llm/conversations/999")
    assert resp.status_code == 404


def test_endpoint_delete_conversation_csrf_required(client) -> None:  # type: ignore[no-untyped-def]
    c, _ = client
    _register(c)
    resp = c.delete("/api/v2/llm/conversations/1")
    # CSRF missing → 403 (检查在 404 之前)
    assert resp.status_code == 403


def test_endpoint_post_conversation_stores_composed_content_returns_displayed(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """4th-review P1 fix end-to-end:
    - DB 里 user.content 含 guidance suffix (storage form)
    - GET /conversations/{id} 序列化返 raw user input (strip suffix 给前端展示)
    """
    c, settings = client
    _register(c)
    _patch_provider(
        monkeypatch,
        chunks=[_delta_chunk("ans"), _final_chunk(completion_tokens=1)],
    )
    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "为什么 B 不对",
            "intentHint": "why_wrong",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    # consume stream
    _parse_sse_frames(resp.content)

    # 1) DB storage form 含 guidance suffix
    from sikao_api.db.session import DatabaseManager

    sess = DatabaseManager(settings).session_factory()
    try:
        msgs = (
            sess.query(LlmMessage).order_by(LlmMessage.created_at).all()
        )
        user_msg = msgs[0]
        assert user_msg.role == "user"
        assert user_msg.content.startswith("为什么 B 不对")
        assert "[本题作答提示]" in user_msg.content
        assert "为什么我的答案错了" in user_msg.content  # why_wrong guidance
    finally:
        sess.close()

    # 2) 序列化层 strip suffix 返干净 raw 给前端
    list_resp = c.get("/api/v2/llm/conversations")
    conv_id = list_resp.json()["items"][0]["id"]
    detail = c.get(f"/api/v2/llm/conversations/{conv_id}").json()
    user_displayed = [m for m in detail["messages"] if m["role"] == "user"][0]
    assert user_displayed["content"] == "为什么 B 不对"
    assert "[本题作答提示]" not in user_displayed["content"]


def test_endpoint_post_conversation_streams_content_with_newlines(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """LLM 返带 \\n 的 content (代码块/多行解释): SSE 帧 json.dumps 默认转义
    控制字符, 不会因 \\n 断帧 — review P1 #1 验证."""
    c, _ = client
    _register(c)
    multiline = "step 1\nstep 2\nstep 3"
    _patch_provider(
        monkeypatch,
        chunks=[_delta_chunk(multiline), _final_chunk(completion_tokens=3)],
    )
    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    deltas = [f for f in frames if f["type"] == "delta"]
    # 单帧 delta 含完整 multiline content (json escape 让 \n 不破帧).
    assert deltas[0]["content"] == multiline
    assert any(f["type"] == "done" for f in frames)


def test_endpoint_post_conversation_client_disconnect_cancels_mid_stream(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """3rd review P1 #2 (DoD gap): SSE mid-stream cancel.

    Mock Request.is_disconnected 让其首次调用返 False (放第 1 chunk 出),
    第二次返 True 触发 generator return. 验证:
    - 第 1 帧 delta 出 (1 chunk consumed before cancel)
    - 没 done 帧 (cancel 后 finalize 不跑)
    - assistant message 没落库 (节流付费 + 不审计 partial, plan §3.3.2 设计)
    """
    c, settings = client
    _register(c)
    _patch_provider(
        monkeypatch,
        chunks=[
            _delta_chunk("first"),
            _delta_chunk("second"),  # 第二次循环前 is_disconnected → True 不该 yield
            _final_chunk(),
        ],
    )

    # is_disconnected 状态机: 第 1 次调 False (let chunk 1 yield), 第 2 次 True.
    state = {"calls": 0}

    async def _disconnect_after_first(self):  # type: ignore[no-untyped-def]
        state["calls"] += 1
        return state["calls"] >= 2

    monkeypatch.setattr(
        "starlette.requests.Request.is_disconnected", _disconnect_after_first
    )

    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    types = [f["type"] for f in frames]
    # 3rd review P1 #3: 'created' 帧必先于 delta — abort 路径下也已发出.
    assert types[0] == "created"
    assert isinstance(frames[0]["conversationId"], int)
    # 至少 1 个 delta (第 1 chunk 已出), 后续 cancel 不 yield 'second' / 'done'.
    assert "delta" in types
    assert "done" not in types
    assert "error" not in types
    delta_contents = [f["content"] for f in frames if f["type"] == "delta"]
    assert "second" not in delta_contents

    # assistant message 没落库, 仅 user message 持久 (节流付费设计).
    from sikao_api.db.session import DatabaseManager

    sess = DatabaseManager(settings).session_factory()
    try:
        msgs = sess.query(LlmMessage).all()
        assert [m.role for m in msgs] == ["user"]
    finally:
        sess.close()


def test_endpoint_post_conversation_network_error_yields_error_frame(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """3rd review P1 #1: httpx.ConnectError (network drop) → llm_network 帧.

    现有 catch 只覆盖 HTTPStatusError + TimeoutException; ConnectError 漏 catch
    时让 user 看 stream hang. 现在 catch httpx.RequestError 基类.
    """
    import httpx as _httpx

    class _NetworkErrorProvider:
        async def chat_completion(self, **_kw):  # pragma: no cover
            raise NotImplementedError

        async def chat_completion_stream(self, **_kw):
            # 先 yield 一个 chunk, 再 raise ConnectError 模拟 mid-stream 断网.
            yield _delta_chunk("partial")
            raise _httpx.ConnectError("simulated network drop")

    c, _ = client
    _register(c)
    fake = _NetworkErrorProvider()
    monkeypatch.setattr(
        "sikao_api.modules.llm.interface.conversations.build_llm_provider",
        lambda *a, **kw: (fake, "system"),
    )

    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    types_codes = [(f["type"], f.get("code")) for f in frames]
    assert any(t == "error" and code == "llm_network" for t, code in types_codes)
    assert not any(t == "done" for t, _ in types_codes)
    # 3rd review P1 #3: created frame 必先于任何 error (frontend 极快 abort
    # 后重发也已拿到 conversationId).
    assert frames[0]["type"] == "created"
    # 2nd review P1 #2: error frame 必带 conversationId 让前端续话不创建孤立会话.
    error_frame = next(f for f in frames if f["type"] == "error")
    assert isinstance(error_frame["conversationId"], int)
    assert error_frame["conversationId"] == frames[0]["conversationId"]


def test_endpoint_post_conversation_invariant_violation_yields_internal_frame(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """3rd review P1 #3: build_messages_for_llm ValueError → 'internal' 帧, 不 500."""
    c, _ = client
    _register(c)

    def _raise_invariant(*_a, **_kw):
        raise ValueError("conversation must end with a user message before LLM call")

    monkeypatch.setattr(
        "sikao_api.modules.llm.interface.conversations.build_messages_for_llm",
        _raise_invariant,
    )
    # provider 不会被调用因 build_messages 先 raise, 但仍 patch 防 LLMConfigError.
    _patch_provider(monkeypatch, chunks=[])

    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    assert any(f["type"] == "error" and f["code"] == "internal" for f in frames)


def test_endpoint_record_usage_then_finalize_failure_rolls_back_usage_row(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """3rd review P1 #4 verify: record_usage 后 finalize raise → rollback 整事务,
    token_usage row 不 leak (SQLAlchemy session-level rollback 默认行为)."""
    from sqlalchemy.exc import OperationalError

    c, settings = client
    _register(c)
    _patch_provider(
        monkeypatch,
        chunks=[_delta_chunk("Hi"), _final_chunk(completion_tokens=1)],
    )

    def _raise(*_a, **_kw):
        raise OperationalError("db down", {}, Exception())

    monkeypatch.setattr(
        "sikao_api.modules.llm.interface.conversations.finalize_assistant_message", _raise
    )

    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    assert any(
        f["type"] == "error" and f["code"] == "persistence_failed" for f in frames
    )

    # 关键 invariant: token_usage row 不 leak (rollback 整事务).
    from sikao_api.db.session import DatabaseManager
    from sikao_api.db.models import LlmTokenUsage

    sess = DatabaseManager(settings).session_factory()
    try:
        usage_count = sess.query(LlmTokenUsage).count()
        assert usage_count == 0  # rollback 应已清理 record_usage 写的 row
    finally:
        sess.close()


def test_endpoint_post_conversation_record_usage_failure_still_finalizes(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """2nd review P1: record_usage SQLAlchemyError → 不阻塞 finalize.

    用户仍拿到 assistant content (token_usage_id=None) + done 帧, 仅丢记账.
    """
    from sqlalchemy.exc import OperationalError

    c, settings = client
    _register(c)
    _patch_provider(
        monkeypatch,
        chunks=[_delta_chunk("Hi"), _final_chunk(completion_tokens=1)],
    )

    def _raise(*_a: object, **_kw: object) -> None:
        raise OperationalError("simulated", {}, Exception())

    monkeypatch.setattr(
        "sikao_api.modules.llm.interface.conversations._record_usage_or_estimate", _raise
    )

    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    types = [f["type"] for f in frames]
    # done 仍发, 没 error 帧
    assert "done" in types
    assert "error" not in types

    # assistant message 写入了 (token_usage_id=None)
    from sikao_api.db.session import DatabaseManager

    sess = DatabaseManager(settings).session_factory()
    try:
        msgs = sess.query(LlmMessage).order_by(LlmMessage.created_at).all()
        assert [m.role for m in msgs] == ["user", "assistant"]
        assert msgs[1].content == "Hi"
        assert msgs[1].token_usage_id is None
    finally:
        sess.close()


def test_endpoint_post_conversation_finalize_failure_yields_error_frame(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """2nd review P1: finalize_assistant_message SQLAlchemyError → error 帧 +
    没 done 帧. user_message Phase 1 已 commit 仍持久, 用户可重发."""
    from sqlalchemy.exc import OperationalError

    c, _ = client
    _register(c)
    _patch_provider(
        monkeypatch,
        chunks=[_delta_chunk("Hi"), _final_chunk(completion_tokens=1)],
    )

    def _raise(*_a: object, **_kw: object) -> None:
        raise OperationalError("db down", {}, Exception())

    monkeypatch.setattr(
        "sikao_api.modules.llm.interface.conversations.finalize_assistant_message", _raise
    )

    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    types = [f["type"] for f in frames]
    assert "done" not in types
    assert any(
        f["type"] == "error" and f["code"] == "persistence_failed" for f in frames
    )


def test_endpoint_post_conversation_empty_completion_yields_error_frame(  # type: ignore[no-untyped-def]
    client, monkeypatch
) -> None:
    """LLM 返 0 content (filter 触发?) → error frame, 不写空 assistant."""
    c, settings = client
    _register(c)
    _patch_provider(monkeypatch, chunks=[_final_chunk(completion_tokens=0)])
    resp = c.post(
        "/api/v2/llm/conversations",
        json={
            "contextKind": "general",
            "userMessage": "ping",
            "intentHint": "freeform",
        },
        headers=_csrf_header(c),
    )
    assert resp.status_code == 200
    frames = _parse_sse_frames(resp.content)
    error_frame = next(
        (f for f in frames if f["type"] == "error" and f["code"] == "empty_completion"),
        None,
    )
    assert error_frame is not None
    # 2nd review P1 #2: error frame 必带 conversationId 让前端续话不创建孤立会话.
    assert isinstance(error_frame["conversationId"], int)

    # 验证 user msg 落了 assistant 没落.
    from sikao_api.db.session import DatabaseManager

    sess = DatabaseManager(settings).session_factory()
    try:
        msgs = sess.query(LlmMessage).all()
        assert [m.role for m in msgs] == ["user"]
    finally:
        sess.close()
