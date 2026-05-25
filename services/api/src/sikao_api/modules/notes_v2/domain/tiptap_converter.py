from __future__ import annotations

from html import escape
from typing import Any

def _render_inline_markdown(node: dict[str, Any]) -> str:
    if node.get("type") == "text":
        text = str(node.get("text") or "")
        marks = node.get("marks")
        if not isinstance(marks, list):
            return text
        for mark in marks:
            if not isinstance(mark, dict):
                continue
            mark_type = mark.get("type")
            if mark_type == "bold":
                text = f"**{text}**"
            elif mark_type == "italic":
                text = f"*{text}*"
            elif mark_type == "highlight":
                text = f"=={text}=="
        return text
    if node.get("type") == "hardBreak":
        return "  \n"
    if node.get("type") == "image":
        raw_attrs = node.get("attrs")
        attrs: dict[str, Any] = raw_attrs if isinstance(raw_attrs, dict) else {}
        return f"![{attrs.get('alt') or ''}]({attrs.get('src') or ''})"
    return "".join(
        _render_inline_markdown(child)
        for child in node.get("content", [])
        if isinstance(child, dict)
    )


def _render_block_markdown(node: dict[str, Any], *, ordered_index: int = 1) -> str:
    node_type = node.get("type")
    if node_type == "heading":
        level = 1
        attrs = node.get("attrs")
        if isinstance(attrs, dict):
            raw_level = attrs.get("level")
            if isinstance(raw_level, int):
                level = max(1, min(raw_level, 6))
        return f"{'#' * level} {_render_inline_markdown(node)}\n\n"
    if node_type == "paragraph":
        return f"{_render_inline_markdown(node)}\n\n"
    if node_type == "blockquote":
        inner = "".join(
            _render_block_markdown(child)
            for child in node.get("content", [])
            if isinstance(child, dict)
        ).strip().splitlines()
        return "\n".join(f"> {line}" if line else ">" for line in inner) + "\n\n"
    if node_type in {"bulletList", "orderedList"}:
        lines: list[str] = []
        for idx, child in enumerate(
            [item for item in node.get("content", []) if isinstance(item, dict)],
            start=1,
        ):
            marker = "-" if node_type == "bulletList" else f"{idx}."
            rendered = _render_inline_markdown(child).strip()
            lines.append(f"{marker} {rendered}")
        return "\n".join(lines) + "\n\n"
    if node_type == "image":
        return f"{_render_inline_markdown(node)}\n\n"
    return "".join(
        _render_block_markdown(child, ordered_index=ordered_index)
        for child in node.get("content", [])
        if isinstance(child, dict)
    )


def json_to_markdown(body_json: dict[str, Any] | None) -> str:
    if not isinstance(body_json, dict):
        return ""
    content = body_json.get("content")
    if not isinstance(content, list):
        return ""
    return "".join(
        _render_block_markdown(child)
        for child in content
        if isinstance(child, dict)
    ).strip()


def _render_inline_html(node: dict[str, Any]) -> str:
    if node.get("type") == "text":
        text = escape(str(node.get("text") or ""))
        marks = node.get("marks")
        if not isinstance(marks, list):
            return text
        for mark in marks:
            if not isinstance(mark, dict):
                continue
            mark_type = mark.get("type")
            if mark_type == "bold":
                text = f"<strong>{text}</strong>"
            elif mark_type == "italic":
                text = f"<em>{text}</em>"
            elif mark_type == "highlight":
                text = f"<mark>{text}</mark>"
        return text
    if node.get("type") == "hardBreak":
        return "<br />"
    if node.get("type") == "image":
        raw_attrs = node.get("attrs")
        attrs: dict[str, Any] = raw_attrs if isinstance(raw_attrs, dict) else {}
        return (
            f'<img src="{escape(str(attrs.get("src") or ""))}" '
            f'alt="{escape(str(attrs.get("alt") or ""))}" />'
        )
    return "".join(
        _render_inline_html(child)
        for child in node.get("content", [])
        if isinstance(child, dict)
    )


def _render_block_html(node: dict[str, Any]) -> str:
    node_type = node.get("type")
    if node_type == "heading":
        level = 1
        attrs = node.get("attrs")
        if isinstance(attrs, dict):
            raw_level = attrs.get("level")
            if isinstance(raw_level, int):
                level = max(1, min(raw_level, 6))
        return f"<h{level}>{_render_inline_html(node)}</h{level}>"
    if node_type == "paragraph":
        return f"<p>{_render_inline_html(node)}</p>"
    if node_type == "blockquote":
        inner = "".join(
            _render_block_html(child)
            for child in node.get("content", [])
            if isinstance(child, dict)
        )
        return f"<blockquote>{inner}</blockquote>"
    if node_type in {"bulletList", "orderedList"}:
        tag = "ul" if node_type == "bulletList" else "ol"
        items = "".join(
            f"<li>{_render_inline_html(child)}</li>"
            for child in node.get("content", [])
            if isinstance(child, dict)
        )
        return f"<{tag}>{items}</{tag}>"
    if node_type == "image":
        return _render_inline_html(node)
    return "".join(
        _render_block_html(child)
        for child in node.get("content", [])
        if isinstance(child, dict)
    )


def json_to_html(body_json: dict[str, Any] | None) -> str:
    if not isinstance(body_json, dict):
        return ""
    content = body_json.get("content")
    if not isinstance(content, list):
        return ""
    return "".join(
        _render_block_html(child)
        for child in content
        if isinstance(child, dict)
    )
