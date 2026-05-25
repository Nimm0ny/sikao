from __future__ import annotations

from sikao_api.modules.notes_v2.domain.tiptap_converter import md_to_json


def test_md_to_json_strips_markdown_fence_and_preserves_marks() -> None:
    payload = md_to_json(
        """```markdown
        ## 本周知识沉淀
        **捆绑法** 适用于 *相邻约束*
        ```
        """
    )
    paragraph = payload["content"][1]
    assert paragraph["type"] == "paragraph"
    text_nodes = paragraph["content"]
    assert any(node.get("marks") == [{"type": "bold"}] for node in text_nodes if node["type"] == "text")
    assert any(node.get("marks") == [{"type": "italic"}] for node in text_nodes if node["type"] == "text")
