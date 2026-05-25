from __future__ import annotations

import re
from typing import Any


_BLOCK_TYPES = {"heading", "paragraph", "listItem", "blockquote", "codeBlock"}


def extract_text(body_json: dict[str, Any] | None) -> str:
    if not isinstance(body_json, dict):
        return ""

    parts: list[str] = []

    def walk(node: dict[str, Any]) -> None:
        node_type = node.get("type")
        if node_type == "text":
            text = node.get("text")
            if isinstance(text, str):
                parts.append(text)
            return
        if node_type == "image":
            attrs = node.get("attrs")
            if isinstance(attrs, dict):
                alt = attrs.get("alt")
                if isinstance(alt, str) and alt.strip():
                    parts.append(alt.strip())
            return
        if node_type == "hardBreak":
            parts.append("\n")
            return

        content = node.get("content")
        if isinstance(content, list):
            for child in content:
                if isinstance(child, dict):
                    walk(child)
        if node_type in _BLOCK_TYPES:
            parts.append("\n")

    content = body_json.get("content")
    if isinstance(content, list):
        for child in content:
            if isinstance(child, dict):
                walk(child)

    text = "".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_word_count(body_text: str) -> int:
    cjk_count = sum(1 for char in body_text if "\u4e00" <= char <= "\u9fff")
    non_cjk = re.sub(r"[\u4e00-\u9fff]", " ", body_text)
    non_cjk_words = [part for part in non_cjk.split() if part]
    return cjk_count + len(non_cjk_words)
