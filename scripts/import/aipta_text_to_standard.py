"""Aipta 申论真题 plain text → standard JSON paper adapter (Slice 2b).

输入: 一份 plain text 申论真题 (admin 手贴 / 程序自动生成都行); 输出: 跟 fenbi
adapter 同样的 standard JSON paper, 直接走 ExamPaperService.import_standard_json_files
入库. 不爬 aipta 网站, 不需要 BeautifulSoup / SSRF guard / 反爬 sleep — plan §R2
风险整条作废.

输入格式契约 (固定):

    <第一行: 标题 — parser 忽略, paperName 由 admin 显式给>

    一、注意事项
    [整段忽略, 不入库]

    二、给定材料

    材料1

    [段落...]

    材料2

    [段落...]

    ... (材料编号必须连续 1, 2, 3, ...)

    三、作答要求

    1.<题干 含 （N分）>

    要求：
    [可选条目, 含字数限制]

    2.<题干>
    ...

    注：[尾部噪音 "答案及解析..." 等, 整段丢]

输出每道题: questionKind=essay, rendererKey=essay, isGradable=False; type_payload
含 materialTexts (全 5 段) + wordLimitMin/Max + fullScore + suggestedMinutes (若有).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


class AiptaParseError(ValueError):
    """Aipta text 格式不合规 — fail-fast at adapter, 不让 bad shape 进 ingest."""


@dataclass(frozen=True)
class ParsedQuestion:
    question_no: int
    stem: str  # 含 "1.<题干>...（X分）" 整段, 不含 "要求：" 后的内容
    requirements: str  # "要求：" 后的整段
    full_score: int | None
    word_limit_min: int | None
    word_limit_max: int | None


@dataclass(frozen=True)
class ParsedPaper:
    materials: list[str]
    questions: list[ParsedQuestion] = field(default_factory=list)


# ── 章节边界 / 子标题正则 ─────────────────────────────────────────────────────

# "二、给定材料" — 章节头, MULTILINE 防止匹配到 "二、给定" 这种残缺标记
_RE_SECTION_2 = re.compile(r"^二、\s*给定材料\s*$", re.MULTILINE)
# "三、作答要求"
_RE_SECTION_3 = re.compile(r"^三、\s*作答要求\s*$", re.MULTILINE)
# 尾部 "注：..." 噪音 (e.g. "注：篇幅有限，答案及解析请下载...") — 整段丢
_RE_NOTE_TAIL = re.compile(r"^注\s*[：:]", re.MULTILINE)

# "材料N" 子标题 — 数字必须连续 1, 2, 3, ...
_RE_MATERIAL_HEADER = re.compile(r"^材料(\d+)\s*$", re.MULTILINE)

# 题号 "1.", "2." 在 line 起始. 排 "1.5亿" / "第1.条" 等正文中数字 — 仅匹配
# line start + 数字 + 点; 实际验证在 parse_questions 内做编号连续性检查.
_RE_QUESTION_LEAD = re.compile(r"^(\d+)\.", re.MULTILINE)

# 分值 "（N分）" / "(N分)"
_RE_FULL_SCORE = re.compile(r"[（(](\d+)分[）)]")

# 字数限制 — 三种写法都接:
#   "不超过 N 字" → max
#   "字数 N - M 字" / "N - M 字" → range
#   "不少于 N 字" → min
# 区间分隔符接半角 `-`, 全角 `－`, 中文 `—`, `~`
_RE_WORD_NO_MORE = re.compile(r"不超过\s*(\d+)\s*字")
_RE_WORD_RANGE = re.compile(r"(?:字数)?\s*(\d+)\s*[-－—~]\s*(\d+)\s*字")
_RE_WORD_AT_LEAST = re.compile(r"不少于\s*(\d+)\s*字")


def parse_aipta_text(raw_text: str) -> ParsedPaper:
    """raw_text → ParsedPaper. 任何格式问题立即 raise AiptaParseError (fail-fast).

    parser 只负责正文结构 (材料 + 题), 标题 / 年份 / 卷类型 / paperCode 等 metadata
    由 caller (admin endpoint body) 显式给, 不在这里猜.
    """
    text = raw_text.replace("\r\n", "\n").strip()

    m2 = _RE_SECTION_2.search(text)
    m3 = _RE_SECTION_3.search(text)
    if m2 is None:
        raise AiptaParseError("missing section header '二、给定材料'")
    if m3 is None:
        raise AiptaParseError("missing section header '三、作答要求'")
    if m2.end() >= m3.start():
        raise AiptaParseError("section '三、作答要求' must come after '二、给定材料'")

    materials_section = text[m2.end() : m3.start()]
    questions_section = text[m3.end() :]

    tail = _RE_NOTE_TAIL.search(questions_section)
    if tail is not None:
        questions_section = questions_section[: tail.start()]

    materials = _parse_materials(materials_section)
    questions = _parse_questions(questions_section)
    if not questions:
        raise AiptaParseError("'三、作答要求' 段下未找到任何编号题")

    return ParsedPaper(materials=materials, questions=questions)


def _parse_materials(section: str) -> list[str]:
    matches = list(_RE_MATERIAL_HEADER.finditer(section))
    if not matches:
        raise AiptaParseError("'二、给定材料' 段下未找到 '材料N' 子标题")
    materials: list[str] = []
    for index, match in enumerate(matches):
        expected = index + 1
        actual = int(match.group(1))
        if actual != expected:
            raise AiptaParseError(
                f"material number out of sequence: expected 材料{expected}, got 材料{actual}"
            )
        body_start = match.end()
        body_end = matches[index + 1].start() if index + 1 < len(matches) else len(section)
        body = section[body_start:body_end].strip()
        if not body:
            raise AiptaParseError(f"材料{actual} body is empty")
        materials.append(body)
    return materials


def _parse_questions(section: str) -> list[ParsedQuestion]:
    matches = list(_RE_QUESTION_LEAD.finditer(section))
    questions: list[ParsedQuestion] = []
    for index, match in enumerate(matches):
        expected = index + 1
        actual = int(match.group(1))
        if actual != expected:
            raise AiptaParseError(
                f"question number out of sequence: expected {expected}., got {actual}."
            )
        # match 起始含 "N.", body_start 跳过 "N." 给后面只留题干内容 (跟 fenbi
        # 约定一致 — questionNo 由 position 显式呈现, 不嵌进 stem 文本).
        body_start = match.end()
        body_end = matches[index + 1].start() if index + 1 < len(matches) else len(section)
        body = section[body_start:body_end].strip()
        if not body:
            raise AiptaParseError(f"question {actual} body is empty")
        questions.append(_parse_one_question(body, actual))
    return questions


# "要求：" 或 "要求:" 在 line 起始或前面有 newline (避免误匹配题干里 "要求...")
_RE_REQUIREMENT_HEAD = re.compile(r"(?:^|\n)\s*要求\s*[：:]")


def _parse_one_question(body: str, question_no: int) -> ParsedQuestion:
    req_match = _RE_REQUIREMENT_HEAD.search(body)
    if req_match is not None:
        stem = body[: req_match.start()].strip()
        requirements = body[req_match.end() :].strip()
    else:
        stem = body.strip()
        requirements = ""

    if not stem:
        raise AiptaParseError(f"question {question_no} stem is empty")

    score_match = _RE_FULL_SCORE.search(stem)
    full_score = int(score_match.group(1)) if score_match else None

    word_min, word_max = _parse_word_limit(stem + "\n" + requirements)

    return ParsedQuestion(
        question_no=question_no,
        stem=stem,
        requirements=requirements,
        full_score=full_score,
        word_limit_min=word_min,
        word_limit_max=word_max,
    )


_MIN_PLAUSIBLE_WORD_LIMIT = 50  # 申论最短题字数限制下限 (经验值 — 公考申论小题最低 100-150 字)


def _parse_word_limit(text: str) -> tuple[int | None, int | None]:
    r"""三种写法都接, 返 (min, max). 优先匹配 range, 再 max, 再 min.

    1st review P1 #3: range 写法 `\d+-\d+字` 容易误抓生活语义 (e.g. 题干 '用1-2字
    总结', '概括为3-5字' 这种 — 实际不是字数限制). 用 `lo >= 50` sanity guard 拒
    掉, 命中疑似误识别时不返 range, 让上层继续尝试 max-only / at-least 写法或最终
    返 (None, None) 当无字数限制.
    """
    range_match = _RE_WORD_RANGE.search(text)
    if range_match is not None:
        lo = int(range_match.group(1))
        hi = int(range_match.group(2))
        if lo > hi:
            raise AiptaParseError(f"word limit range invalid: {lo} > {hi}")
        if lo >= _MIN_PLAUSIBLE_WORD_LIMIT:
            return lo, hi
        # else: 疑似误抓 (生活语义 e.g. "用1-2字"), fall through 试其他写法
    max_match = _RE_WORD_NO_MORE.search(text)
    if max_match is not None:
        return None, int(max_match.group(1))
    min_match = _RE_WORD_AT_LEAST.search(text)
    if min_match is not None:
        return int(min_match.group(1)), None
    return None, None


# ── Standard JSON composer ───────────────────────────────────────────────────


def compose_standard_paper(
    *,
    parsed: ParsedPaper,
    paper_code: str,
    paper_name: str,
    exam_year: int,
    source_kind: str,
) -> dict[str, Any]:
    """Parsed paper + admin metadata → 标准 JSON paper (跟 fenbi adapter 同 shape).

    每道 essay question 自包含全 N 段材料 (跟 Slice 2a EssayMetadata contract 对齐 —
    前端 EssayRenderer 从 content.essayMetadata.materialTexts 读全集). PoC 阶段 5
    KB / 题, 5 题 25 KB / 卷, 重复存可接受.
    """
    blocks: list[dict[str, Any]] = []
    for question in parsed.questions:
        type_payload: dict[str, Any] = {"materialTexts": list(parsed.materials)}
        if question.word_limit_min is not None:
            type_payload["wordLimitMin"] = question.word_limit_min
        if question.word_limit_max is not None:
            type_payload["wordLimitMax"] = question.word_limit_max
        if question.full_score is not None:
            type_payload["fullScore"] = question.full_score

        # stem 包成简单 <p>...</p> 给 DOMPurify 处理. 多段用 \n\n 分; 跟 EssayRenderer
        # whitespace-pre-wrap 配合断行可视.
        stem_html = _wrap_stem_paragraphs(question.stem)
        explanation_text = ""
        if question.requirements:
            # 要求段 (含字数 / 条目) 当 explanation, 用户答题前提示已在 essayMetadata
            # 字数限制呈现; 这里多保留原文给评分时 LLM 参考 + 调试.
            explanation_text = _wrap_stem_paragraphs(question.requirements)

        blocks.append(
            {
                "type": "question",
                "sourceUuid": f"aipta-{paper_code}-q{question.question_no}",
                "questionKind": "essay",
                "subtypeName": "申论",
                "stemText": stem_html,
                "answerKeys": [],
                "options": [],
                "explanationText": explanation_text,
                "difficultyCode": "unknown",
                "rendererKey": "essay",
                "isGradable": False,
                "typePayload": type_payload,
                "tags": [],
            }
        )

    return {
        "paperCode": paper_code,
        "paperName": paper_name,
        "examYear": exam_year,
        "sourceProvider": "aipta",
        "sourceKind": source_kind,
        "sortOrder": exam_year * 100,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "section-essay",
                "title": "申论",
                "instructionText": "",
                "blocks": blocks,
            }
        ],
    }


def _wrap_stem_paragraphs(text: str) -> str:
    """将多段纯文本包成 `<p>...</p>` HTML, 保留换行结构. DOMPurify 后端用."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    return "".join(f"<p>{_escape_html(p)}</p>" for p in paragraphs)


def _escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
