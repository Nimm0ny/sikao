from __future__ import annotations

from html import escape
import re
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


def md_to_json(markdown: str) -> dict[str, Any]:
    stripped = _strip_markdown_fence(markdown)
    lines = stripped.splitlines()
    nodes: list[dict[str, Any]] = []
    index = 0
    while index < len(lines):
        raw_line = lines[index].rstrip()
        line = raw_line.strip()
        if not line:
            index += 1
            continue
        heading_match = re.match(r"^(#{1,6})\s+(.*)$", line)
        if heading_match:
            level = len(heading_match.group(1))
            nodes.append(_heading_node(level=level, text=heading_match.group(2).strip()))
            index += 1
            continue
        if line == "---":
            nodes.append({"type": "horizontalRule"})
            index += 1
            continue
        if line.startswith(">"):
            quote_lines: list[str] = []
            while index < len(lines):
                candidate = lines[index].strip()
                if not candidate.startswith(">"):
                    break
                quote_lines.append(candidate[1:].lstrip())
                index += 1
            nodes.append(
                {
                    "type": "blockquote",
                    "content": [_paragraph_node(" ".join(part for part in quote_lines if part))],
                }
            )
            continue
        if re.match(r"^[-*]\s+", line):
            items: list[dict[str, Any]] = []
            while index < len(lines):
                candidate = lines[index].strip()
                match = re.match(r"^[-*]\s+(.*)$", candidate)
                if match is None:
                    break
                items.append(
                    {
                        "type": "listItem",
                        "content": [_paragraph_node(match.group(1).strip())],
                    }
                )
                index += 1
            nodes.append({"type": "bulletList", "content": items})
            continue
        if re.match(r"^\d+\.\s+", line):
            items = []
            start = int(line.split(".", 1)[0])
            while index < len(lines):
                candidate = lines[index].strip()
                match = re.match(r"^(\d+)\.\s+(.*)$", candidate)
                if match is None:
                    break
                items.append(
                    {
                        "type": "listItem",
                        "content": [_paragraph_node(match.group(2).strip())],
                    }
                )
                index += 1
            nodes.append({"type": "orderedList", "attrs": {"start": start}, "content": items})
            continue

        paragraph_lines = [raw_line]
        index += 1
        while index < len(lines):
            lookahead = lines[index].strip()
            if not lookahead:
                break
            if re.match(r"^(#{1,6})\s+", lookahead) or lookahead == "---" or lookahead.startswith(">"):
                break
            if re.match(r"^[-*]\s+", lookahead) or re.match(r"^\d+\.\s+", lookahead):
                break
            paragraph_lines.append(lines[index].rstrip())
            index += 1
        nodes.append(_paragraph_node("\n".join(paragraph_lines)))
    return {"type": "doc", "content": nodes}


def _strip_markdown_fence(markdown: str) -> str:
    stripped = markdown.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 2 and lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
    return stripped


def _heading_node(*, level: int, text: str) -> dict[str, Any]:
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": _inline_content(text),
    }


def _paragraph_node(text: str) -> dict[str, Any]:
    return {"type": "paragraph", "content": _inline_content(text)}


def _inline_content(text: str) -> list[dict[str, Any]]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if not normalized:
        return []
    segments = normalized.split("\n")
    content: list[dict[str, Any]] = []
    for idx, segment in enumerate(segments):
        content.extend(_parse_inline_marks(segment))
        if idx < len(segments) - 1:
            content.append({"type": "hardBreak"})
    return content


def _parse_inline_marks(text: str) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    index = 0
    while index < len(text):
        if text.startswith("**", index):
            end = text.find("**", index + 2)
            if end != -1:
                inner = text[index + 2 : end]
                nodes.append({"type": "text", "text": inner, "marks": [{"type": "bold"}]})
                index = end + 2
                continue
        if text.startswith("*", index):
            end = text.find("*", index + 1)
            if end != -1:
                inner = text[index + 1 : end]
                nodes.append({"type": "text", "text": inner, "marks": [{"type": "italic"}]})
                index = end + 1
                continue
        next_special = _next_special_index(text, index)
        chunk = text[index:next_special]
        if chunk:
            nodes.append({"type": "text", "text": chunk})
        index = next_special
    return nodes


def _next_special_index(text: str, start: int) -> int:
    positions = [pos for pos in (text.find("**", start), text.find("*", start)) if pos != -1]
    if not positions:
        return len(text)
    return min(positions)
