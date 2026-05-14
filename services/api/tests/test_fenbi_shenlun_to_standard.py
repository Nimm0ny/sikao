from __future__ import annotations

import csv
import json
from pathlib import Path

from sikao_api.scripts.fenbi_shenlun_to_standard import (
    FenbiRow,
    classify_exam_scope,
    classify_question,
    classify_variant,
    convert_paper_id,
    html_to_text,
    load_manifest_rows,
)


def test_html_to_text_preserves_paragraph_breaks_and_unescapes_entities() -> None:
    raw = "<p><b>请根据</b>&ldquo;资料1&rdquo;</p><p>要求：不超过250字。</p>"

    assert html_to_text(raw) == "请根据“资料1”\n要求：不超过250字。"


def test_classify_exam_scope_and_variant() -> None:
    assert classify_exam_scope("国考", "2026年国家公考《申论》题（副省级）") == "国考"
    assert classify_exam_scope("四川", "2025年四川省考《申论》题（县乡卷）") == "省考"
    assert classify_variant("2026年国家公考《申论》题（行政执法）") == "行政执法"
    assert classify_variant("2020年广东省考《申论》题（二类）") == "二类"
    assert classify_variant("2020年江苏省考《申论》题A卷") == "A卷"


def test_classify_common_question_types() -> None:
    assert classify_question("请概括主要问题。", question_no=1, total_questions=4, full_score=10) == (
        "归纳概括",
        "归纳概括",
    )
    assert classify_question("谈谈你对划线句子的理解。", question_no=2, total_questions=4, full_score=15) == (
        "综合分析",
        "综合分析",
    )
    assert classify_question("请提出工作建议。", question_no=3, total_questions=4, full_score=20) == (
        "提出对策",
        "提出对策",
    )
    assert classify_question("请撰写一份讲话稿。", question_no=3, total_questions=4, full_score=20) == (
        "公文/应用文",
        "公文/应用文",
    )
    assert classify_question("自选角度，自拟题目，写一篇文章。", question_no=4, total_questions=4, full_score=40) == (
        "大作文",
        "大作文",
    )


def test_classify_previous_pending_fenbi_patterns() -> None:
    assert classify_question("阅读材料9，提炼出“链长制”的内涵。", question_no=2, total_questions=4, full_score=10) == (
        "归纳概括",
        "归纳概括",
    )
    assert classify_question(
        "请结合资料，对“人口诅咒”作一全面解释。",
        question_no=2,
        total_questions=4,
        full_score=20,
    ) == ("综合分析", "综合分析")
    assert classify_question(
        "针对材料反映的困难，提出政府可采取的长效化扶持措施。",
        question_no=3,
        total_questions=4,
        full_score=25,
    ) == ("提出对策", "提出对策")
    assert classify_question(
        "假如你是工作人员，请给来信反映问题的小学生写一封回信。",
        question_no=3,
        total_questions=4,
        full_score=25,
    ) == ("公文/应用文", "公文/应用文")
    assert classify_question(
        "根据给定资料，为补浪河乡撰写一份案例介绍材料。",
        question_no=4,
        total_questions=4,
        full_score=35,
    ) == ("公文/应用文", "公文/应用文")


def test_load_manifest_rows_filters_year_range(tmp_path: Path) -> None:
    manifest = tmp_path / "manifest.csv"
    with manifest.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "labelId",
                "labelName",
                "paperId",
                "combineKey",
                "name",
                "year",
                "date",
                "topic",
                "url",
            ],
        )
        writer.writeheader()
        writer.writerow({"labelName": "国考", "paperId": "1", "name": "2012年国考", "year": "2012"})
        writer.writerow({"labelName": "国考", "paperId": "2", "name": "2013年国考", "year": "2013"})

    rows = load_manifest_rows(tmp_path, year_start=2013, year_end=2026)

    assert [row.paper_id for row in rows] == ["2"]


def test_convert_paper_id_emits_importable_standard_shape(tmp_path: Path) -> None:
    source = tmp_path
    paper_dir = source / "raw_json" / "papers" / "12345"
    paper_dir.mkdir(parents=True)
    (paper_dir / "paper.json").write_text(
        json.dumps(
            {
                "id": 12345,
                "combineKey": "6_2_demo",
                "name": "2026年国家公考《申论》题（副省级）",
                "date": "2025-11-30",
                "topic": "发展",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (paper_dir / "questions.json").write_text(
        json.dumps(
            {
                "materials": [
                    {"id": 1001, "content": "<p>材料第一段。</p><p>材料第二段。</p>", "accessories": []}
                ],
                "questions": [
                    {
                        "id": 2001,
                        "content": "<p>请概括主要做法。（10分）</p><p>要求：不超过200字。</p>",
                        "difficulty": 3,
                        "materialIndexes": [0],
                        "accessories": [
                            {
                                "materialIndexes": [1001],
                                "wordCount": 200,
                                "score": 10.0,
                                "title": "请概括主要做法。",
                            }
                        ],
                    },
                    {
                        "id": 2002,
                        "content": "<p>自选角度，自拟题目，写一篇文章。（40分）</p><p>要求：800-1000字。</p>",
                        "difficulty": 4,
                        "materialIndexes": [0],
                        "accessories": [{"materialIndexes": [1001], "wordCount": 1000, "score": 40.0}],
                    },
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    rows = [
        FenbiRow(
            label_id="101",
            label_name="国考",
            paper_id="12345",
            combine_key="6_2_demo",
            name="2026年国家公考《申论》题（副省级）",
            year=2026,
            date="2025-11-30",
            topic="发展",
            url="https://example.test/paper",
        )
    ]

    paper, record = convert_paper_id(source_root=source, paper_id="12345", rows=rows)
    blocks = paper["sections"][0]["blocks"]

    assert paper["paperCode"] == "FBSL-12345"
    assert len(paper["paperCode"]) <= 20
    assert paper["sourceProvider"] == "fenbi_shenlun"
    assert paper["fenbiMetadata"]["regions"] == ["国考"]
    assert record["examScope"] == "国考"
    assert record["variant"] == "副省级"
    assert blocks[0]["rendererKey"] == "essay"
    assert blocks[0]["canonicalTaxonomy"]["canonicalSubtype"] == "归纳概括"
    assert blocks[0]["typePayload"]["materialTexts"] == ["材料1\n材料第一段。\n材料第二段。"]
    assert blocks[0]["typePayload"]["fullScore"] == 10
    assert blocks[0]["typePayload"]["wordLimitMax"] == 200
    assert blocks[1]["canonicalTaxonomy"]["canonicalSubtype"] == "大作文"
    assert blocks[1]["typePayload"]["wordLimitMin"] == 800
    assert blocks[1]["typePayload"]["wordLimitMax"] == 1000
