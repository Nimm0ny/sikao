from __future__ import annotations

from sikao_api.modules.notes_v2.domain.tiptap_converter import md_to_json


def test_md_to_json_parses_weekly_review_headings_and_lists() -> None:
    payload = md_to_json(
        """
        ## 本周成果
        - 复盘 18 题
        - 毕业 4 题

        ## 薄弱环节
        - 资料分析耗时偏高
        """
    )
    assert payload["type"] == "doc"
    content = payload["content"]
    assert content[0]["type"] == "heading"
    assert content[0]["attrs"]["level"] == 2
    assert content[1]["type"] == "bulletList"
    assert content[2]["type"] == "heading"


def test_md_to_json_parses_blockquote_and_horizontal_rule() -> None:
    payload = md_to_json(
        """
        > 本周需要先巩固审题

        ---
        """
    )
    assert payload["content"][0]["type"] == "blockquote"
    assert payload["content"][1]["type"] == "horizontalRule"
