"""Input sanitization helpers for Home LLM features."""

from __future__ import annotations

import re

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def sanitize_user_input(text: str | None, *, max_chars: int) -> str:
    """Normalize user text before it is sent to prompts or persisted to LlmCallV2."""
    if not text:
        return ""
    cleaned = _CONTROL_CHARS_RE.sub("", text).strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars].rstrip()
