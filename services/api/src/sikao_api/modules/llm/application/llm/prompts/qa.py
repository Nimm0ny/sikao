"""AI 答疑 prompt builder — Slice 1a.

5 类 intent (plan §4.4):
- why_wrong: 用户想知道为什么答案错了
- common_traps: 这考点常见错法 / 易混淆点
- solving_path: 解题思路 / 推理链
- category_summary: 题型归类 / 同类题特征
- freeform: 用户任意问题

每类 intent guidance 拼到 user message 末尾 (不放 system prompt) 让 system
保持固定前缀, DeepSeek prompt cache 5min 窗口能跨轮命中 (plan §3.3 / R13).

context_text 由 service 层格式化好传入 (题干 + 选项 + 用户答案 等). prompt
builder 保持纯函数 — 不直接拿 ORM 实体, 让 db 解耦.

**Storage 模型 (4th-review P1 fix)**: service 层 `compose_user_content_for_storage`
把 raw user input + guidance suffix 一并写入 DB. 这样:
- history 回放给 LLM 时跟 turn 1 实际 prompt bytes 一致 (model 看到的 history
  跟之前真发生的 prompt 一致, 没语义断裂)
- DeepSeek prompt cache turn 2 时 history user1 部分也能命中 (system 大头之外
  额外节省)
- 序列化给前端时调 `extract_displayed_user_message` strip suffix 让用户看到
  自己输入的原文, 不暴露内部 hint
"""

from __future__ import annotations

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage

_QA_SYSTEM_BODY = """\
你的任务是回答用户关于公考备考题目的问题. 用户会带具体题目 / 错题 / 答题结果
作为上下文 (如果有).

输出原则:
- 直接, 准确, 答完即停, 不啰嗦
- 不复述题干和选项 (用户已经看过); 引用时用 "题干说...", "选项 B 是..."
- 不下"建议你多做题"/"加强练习"等无信息空话
- 中文输出, 公文体感
"""

# 每类 intent 拼到 user message 末尾的输出结构指引.
# freeform 不追加 — 走默认对话风, compose_user_content_for_storage 直接返 raw.
_INTENT_GUIDANCE: dict[str, str] = {
    "why_wrong": (
        "用户问题倾向是「为什么我的答案错了」. 输出结构:\n"
        "1. 用户答案 X 的错在哪 (一句话)\n"
        "2. 正确答案的关键依据 (引用题干 / 材料原话)\n"
        "3. 下次同类题注意的一点"
    ),
    "common_traps": (
        "用户问题倾向是「这考点常见错法 / 易混淆点」. 输出结构:\n"
        "列 2-3 个该考点的典型陷阱, 每条一句话, 用 '- ' bullet 起头.\n"
        "陷阱 = 学生常错的具体表现, 不是泛泛的'要细心'."
    ),
    "solving_path": (
        "用户问题倾向是「解题思路 / 推理链」. 输出结构:\n"
        "步骤 1: ...\n步骤 2: ...\n步骤 3: ...\n"
        "每步一行, 描述「这一步在做什么」+「为什么这样做」.\n"
        "步数按题目实际, 一般 3-5 步."
    ),
    "category_summary": (
        "用户问题倾向是「题型归类 / 同类题特征」. 输出结构:\n"
        "特征: <这类题在题干 / 材料 / 选项上的识别信号>\n"
        "套路: <见到这类题应该走的固定路径 / 常见考点>\n"
        "二段式, 每段 2-3 句."
    ),
    "freeform": "",
}

QA_SYSTEM_MESSAGE = with_tone(_QA_SYSTEM_BODY)

INTENT_HINTS_KNOWN = frozenset(_INTENT_GUIDANCE.keys())

# Marker 分隔 raw user input 和 intent guidance suffix. extract_displayed_user_message
# split 拿前段返前端展示. Marker 内文字 "[本题作答提示]" 写在中括号内是为了让
# LLM 把它视为结构化指引而非用户口语 — 中括号在中文里很少出现, 减少歧义.
INTENT_GUIDANCE_MARKER = "\n\n[本题作答提示]\n"


def compose_user_content_for_storage(
    user_message: str, intent_hint: str = "freeform"
) -> str:
    """Build the full user-message string that gets stored in DB **and** sent
    to LLM. Both layers see the same bytes:
    - DB 存储: 让 history 回放时跟 turn 1 实际 prompt 一致
    - LLM call: 经 build_qa_messages → list[LLMMessage] 直接送上游

    intent_hint 不在已知集合 / freeform → 返 raw user_message (不附 marker).
    """
    if intent_hint not in INTENT_HINTS_KNOWN:
        intent_hint = "freeform"
    guidance = _INTENT_GUIDANCE[intent_hint]
    if not guidance:
        return user_message
    return f"{user_message}{INTENT_GUIDANCE_MARKER}{guidance}"


def extract_displayed_user_message(stored_content: str) -> str:
    """Strip intent guidance suffix from a stored user message for display.

    序列化给前端时调用, 让用户看到自己输入的原文, 不暴露内部 hint. 没 marker
    时直接返 stored_content (兼容 freeform / pre-existing rows).
    """
    if INTENT_GUIDANCE_MARKER in stored_content:
        return stored_content.split(INTENT_GUIDANCE_MARKER, 1)[0]
    return stored_content


def build_qa_messages(
    *,
    context_text: str | None,
    history: list[LLMMessage],
    user_message: str,
) -> list[LLMMessage]:
    """Build messages for OpenAI chat completion.

    Layout (按 DeepSeek prompt cache 5min 窗口命中策略 — plan §3.3 / R13 要求
    固定前缀 + 仅末尾增量):
        [system]  调性 prefix + 答疑指引 + context_text
                  ↑ 固定: 同 conversation 多轮 system prompt bytes-identical
        [history] 既往 user/assistant 轮 (按时序), user msgs 已含 guidance suffix
                  (caller 通过 compose_user_content_for_storage 写 DB → 历史回放
                  跟 turn 1 实际 prompt 一致)
        [user]    本轮 user_message — caller 已应用 compose_user_content_for_storage,
                  含 guidance suffix (若 intent_hint != 'freeform')

    intent_hint 处理上移到 `compose_user_content_for_storage` (service 层 DB
    write 时调). 这里只 assemble messages 不再追加 guidance — caller 控制.
    """
    system_parts = [QA_SYSTEM_MESSAGE]
    if context_text:
        system_parts.append(f"上下文:\n{context_text}")

    return [
        LLMMessage(role="system", content="\n\n".join(system_parts)),
        *history,
        LLMMessage(role="user", content=user_message),
    ]


__all__ = [
    "INTENT_GUIDANCE_MARKER",
    "INTENT_HINTS_KNOWN",
    "QA_SYSTEM_MESSAGE",
    "build_qa_messages",
    "compose_user_content_for_storage",
    "extract_displayed_user_message",
]
