"""Slice 2b · aipta plain text → standard JSON adapter unit tests.

Hand-crafted minimal fixtures (无版权问题 + 完全离线测试). 真样本回归 e2e 在
`test_aipta_import.py` (skipif `.claude/aipta-samples/samples.txt` 缺失).
"""

from __future__ import annotations

import pytest

from sikao_api.scripts.aipta_text_to_standard import (
    AiptaParseError,
    compose_standard_paper,
    parse_aipta_text,
)

_MINIMAL_TEXT = """2026 申论 demo

一、注意事项

1.本题本由给定资料与作答要求两部分构成。

二、给定材料

材料1

这是材料一的第一段内容。

材料1的第二段。

材料2

材料二只有这一段。

三、作答要求

1.请概括材料一的主要内容。（10分）

要求：全面、准确、有条理，不超过200字。

2.请就材料二谈谈你的看法。（25分）

要求：

（1）观点明确；

（2）字数500-800字。

注：篇幅有限，答案及解析请下载试卷后查看。
"""


# ──────────────────────────────────────────────────────────────────────────────
# parse_aipta_text · happy path
# ──────────────────────────────────────────────────────────────────────────────


def test_parse_extracts_two_materials() -> None:
    parsed = parse_aipta_text(_MINIMAL_TEXT)
    assert len(parsed.materials) == 2
    assert "材料一的第一段" in parsed.materials[0]
    assert "材料1的第二段" in parsed.materials[0]
    assert parsed.materials[1] == "材料二只有这一段。"


def test_parse_extracts_two_questions_with_score() -> None:
    parsed = parse_aipta_text(_MINIMAL_TEXT)
    assert len(parsed.questions) == 2
    q1, q2 = parsed.questions
    assert q1.question_no == 1
    assert q1.full_score == 10
    assert q1.word_limit_min is None
    assert q1.word_limit_max == 200
    assert q1.stem.startswith("请概括材料一")
    assert q2.question_no == 2
    assert q2.full_score == 25
    assert q2.word_limit_min == 500
    assert q2.word_limit_max == 800


def test_parse_strips_leading_question_number_from_stem() -> None:
    parsed = parse_aipta_text(_MINIMAL_TEXT)
    # stem 不能以 "1." / "2." 开头 — questionNo 由 position 显式呈现
    for q in parsed.questions:
        assert not q.stem.startswith(f"{q.question_no}.")


def test_parse_drops_tail_note() -> None:
    """尾部 '注：' 起的内容整段丢."""
    parsed = parse_aipta_text(_MINIMAL_TEXT)
    for q in parsed.questions:
        assert "答案及解析" not in q.stem
        assert "答案及解析" not in q.requirements


def test_parse_separates_stem_from_requirements() -> None:
    """要求段拆出来, stem 不含 '要求：' 后内容; requirements 不带 '要求：' 前缀."""
    parsed = parse_aipta_text(_MINIMAL_TEXT)
    q1 = parsed.questions[0]
    assert "要求" not in q1.stem
    assert q1.requirements.startswith("全面")
    q2 = parsed.questions[1]
    # 多条要求 (1)(2) 都进 requirements
    assert "（1）" in q2.requirements
    assert "（2）" in q2.requirements


# ──────────────────────────────────────────────────────────────────────────────
# parse_aipta_text · edge cases
# ──────────────────────────────────────────────────────────────────────────────


def test_parse_word_limit_with_dash_variants() -> None:
    """字数区间分隔符接半角 / 全角 / 中文 dash."""
    for sep in ("-", "－", "—", "~"):
        text = (
            f"标题\n\n二、给定材料\n\n材料1\n\n材料一内容\n\n"
            f"三、作答要求\n\n1.题干（5分）\n\n要求：字数100{sep}200字。\n"
        )
        parsed = parse_aipta_text(text)
        assert parsed.questions[0].word_limit_min == 100, f"sep={sep!r}"
        assert parsed.questions[0].word_limit_max == 200, f"sep={sep!r}"


def test_parse_word_limit_range_rejects_implausibly_low_lo() -> None:
    """1st review P1 #3: '用1-2字总结' 这种生活语义不是字数限制 — sanity guard 拒.

    range lo < 50 时不当字数限制看, 让 parser 继续尝试 max-only / at-least 写法,
    或最终返 (None, None) 不报错.
    """
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n材料一\n\n"
        "三、作答要求\n\n1.请用1-2字概括材料一主旨, 并写一段说明, 不超过300字。（5分）\n"
    )
    parsed = parse_aipta_text(text)
    q = parsed.questions[0]
    # "1-2字" 被忽略 ↓ "不超过 300 字" 被采纳
    assert q.word_limit_min is None
    assert q.word_limit_max == 300


def test_parse_word_limit_at_least_no_max() -> None:
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n材料一\n\n"
        "三、作答要求\n\n1.题干（5分）\n\n要求：不少于800字。\n"
    )
    parsed = parse_aipta_text(text)
    assert parsed.questions[0].word_limit_min == 800
    assert parsed.questions[0].word_limit_max is None


def test_parse_score_optional() -> None:
    """没有 (X分) 标记的题, full_score=None 不报错."""
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n材料一\n\n"
        "三、作答要求\n\n1.随便问一个问题。\n\n要求：不超过100字。\n"
    )
    parsed = parse_aipta_text(text)
    assert parsed.questions[0].full_score is None


def test_parse_question_without_requirements() -> None:
    """没有 '要求：' 段也能解析, requirements 为空."""
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n材料一\n\n"
        "三、作答要求\n\n1.直接问题, 字数不超过100字。（5分）\n"
    )
    parsed = parse_aipta_text(text)
    assert parsed.questions[0].requirements == ""
    assert parsed.questions[0].word_limit_max == 100  # 字数从 stem 抽


# ──────────────────────────────────────────────────────────────────────────────
# parse_aipta_text · fail-fast
# ──────────────────────────────────────────────────────────────────────────────


def test_parse_missing_section_2_raises() -> None:
    text = "标题\n\n三、作答要求\n\n1.题（5分）\n要求：100字。\n"
    with pytest.raises(AiptaParseError, match="二、给定材料"):
        parse_aipta_text(text)


def test_parse_missing_section_3_raises() -> None:
    text = "标题\n\n二、给定材料\n\n材料1\n\n内容\n"
    with pytest.raises(AiptaParseError, match="三、作答要求"):
        parse_aipta_text(text)


def test_parse_section_3_before_section_2_raises() -> None:
    text = "标题\n\n三、作答要求\n\n1.题\n\n二、给定材料\n\n材料1\n\n内容\n"
    with pytest.raises(AiptaParseError, match="三、作答要求.*after.*二、给定材料"):
        parse_aipta_text(text)


def test_parse_no_materials_raises() -> None:
    text = "标题\n\n二、给定材料\n\n(没有材料N子标题)\n\n三、作答要求\n\n1.题（5分）\n"
    with pytest.raises(AiptaParseError, match="材料N"):
        parse_aipta_text(text)


def test_parse_material_number_out_of_sequence_raises() -> None:
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n内容1\n\n材料3\n\n内容3\n\n"
        "三、作答要求\n\n1.题（5分）\n"
    )
    with pytest.raises(AiptaParseError, match="material number out of sequence"):
        parse_aipta_text(text)


def test_parse_question_number_out_of_sequence_raises() -> None:
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n内容\n\n"
        "三、作答要求\n\n1.题一（5分）\n要求：100字。\n\n"
        "3.题三（10分）\n要求：200字。\n"
    )
    with pytest.raises(AiptaParseError, match="question number out of sequence"):
        parse_aipta_text(text)


def test_parse_no_questions_raises() -> None:
    text = "标题\n\n二、给定材料\n\n材料1\n\n内容\n\n三、作答要求\n\n(空)\n"
    with pytest.raises(AiptaParseError, match="未找到任何编号题"):
        parse_aipta_text(text)


def test_parse_invalid_word_range_raises() -> None:
    """min > max 直接拒, 防错置."""
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n内容\n\n"
        "三、作答要求\n\n1.题（5分）\n\n要求：字数800-500字。\n"
    )
    with pytest.raises(AiptaParseError, match="word limit range invalid"):
        parse_aipta_text(text)


def test_parse_empty_material_body_raises() -> None:
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n材料2\n\n内容2\n\n"
        "三、作答要求\n\n1.题（5分）\n"
    )
    with pytest.raises(AiptaParseError, match="材料1 body is empty"):
        parse_aipta_text(text)


# ──────────────────────────────────────────────────────────────────────────────
# compose_standard_paper
# ──────────────────────────────────────────────────────────────────────────────


def test_compose_emits_essay_questions_with_full_materials() -> None:
    parsed = parse_aipta_text(_MINIMAL_TEXT)
    paper = compose_standard_paper(
        parsed=parsed,
        paper_code="AIPTA-2026-DEMO",
        paper_name="2026 申论 demo",
        exam_year=2026,
        source_kind="国考",
    )
    assert paper["paperCode"] == "AIPTA-2026-DEMO"
    assert paper["paperName"] == "2026 申论 demo"
    assert paper["examYear"] == 2026
    assert paper["sourceProvider"] == "aipta"
    assert paper["sourceKind"] == "国考"
    assert paper["visibleInPublic"] is True

    section = paper["sections"][0]
    assert section["title"] == "申论"
    assert len(section["blocks"]) == 2

    block = section["blocks"][0]
    assert block["type"] == "question"
    assert block["questionKind"] == "essay"
    assert block["rendererKey"] == "essay"
    assert block["isGradable"] is False
    assert block["sourceUuid"] == "AIPTA-2026-DEMO-q1".lower().replace(
        "aipta", "aipta"
    ) or block["sourceUuid"].startswith("aipta-")
    # 每题 typePayload 全 N 段材料 (跟 Slice 2a EssayMetadata contract 对齐)
    assert block["typePayload"]["materialTexts"] == parsed.materials
    assert block["typePayload"]["wordLimitMax"] == 200
    assert block["typePayload"]["fullScore"] == 10


def test_compose_stem_html_escaped() -> None:
    """题干含 < > & 这种特殊字符需要被 HTML 转义防 XSS."""
    text = (
        "标题\n\n二、给定材料\n\n材料1\n\n安全内容\n\n"
        "三、作答要求\n\n1.评论 a < b 与 c & d 的关系（5分）\n\n要求：100字。\n"
    )
    parsed = parse_aipta_text(text)
    paper = compose_standard_paper(
        parsed=parsed,
        paper_code="AIPTA-XSS",
        paper_name="x",
        exam_year=2026,
        source_kind="国考",
    )
    stem = paper["sections"][0]["blocks"][0]["stemText"]
    assert "&lt;" in stem
    assert "&amp;" in stem
    assert "<b>" not in stem  # 用户输入的 < b 不能逃逸成真 tag
