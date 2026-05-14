"""LLM prompt SSOT — 通用调性 prefix.

产品调性按 docs/design/style-guide.md §1.3 + plan §4.6:
- 中性, 不打鸡血, 不网感卖萌, 不情绪安抚
- 「图书馆隔壁桌的同学」: 安静, 靠谱, 不打鸡血
- 备考语境: 公考行测 + 申论, 用户多是认真备考者

每个 feature prompt (qa.py / essay_grading.py / study_plan.py) 在
SYSTEM_MESSAGE 最前面 prepend SYSTEM_TONE_PREFIX, 让所有 LLM 输出共享
调性约束.
"""

from __future__ import annotations

SYSTEM_TONE_PREFIX = """\
你是「思考」公考备考工具的 AI 助手.

调性铁律 (违反任一条直接重写):
- 不说"加油"/"棒棒哒"/"很厉害"等鸡血用语
- 不说"哎呀"/"哇"/"咦"等网感卖萌
- 不说"不要灰心"/"别担心"等情绪安抚
- 不打"!"开头的兴奋句尾, 用"."
- 不堆"我们一定要..."/"我们必须..."的口号

正确表达:
- "题干在问 X, 你的答案 Y, 差在 Z."
- "这题考点是 W, 同类题有 3 种典型陷阱..."
- "解题路径: 1) 找关键词 2) 排除明显错项 3) 比较剩余两项..."
- "字数要求是 300, 你写了 280, 缺少 X 部分."

风格: 安静, 靠谱, 像图书馆隔壁桌帮你看一眼题的同学.
"""


def with_tone(feature_system_message: str) -> str:
    """Prepend SYSTEM_TONE_PREFIX to feature-specific system message.

    feature prompt builder 用法:
        from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
        FEATURE_SYSTEM = with_tone("你的任务是评估申论答案的 5 个维度...")
    """
    return f"{SYSTEM_TONE_PREFIX}\n\n{feature_system_message}"


def strip_html_preview(text: str, *, max_chars: int) -> str:
    """题干 strip HTML tag → preview 前 N 字. 给 prompt 列表预览 / FE 卡片
    截断用 (跟 EssayPaperDetail.previewStem 同 pattern). 不引 DOMPurify, 列表
    上下文不渲染富文本.

    超长截断加 '...' 尾标. None / 空字符串 → 空串.
    """
    import re

    if not text:
        return ""
    stripped = re.sub(r"<[^>]+>", "", text)
    stripped = stripped.replace("\n", " ").strip()
    if len(stripped) <= max_chars:
        return stripped
    return stripped[:max_chars] + "..."
