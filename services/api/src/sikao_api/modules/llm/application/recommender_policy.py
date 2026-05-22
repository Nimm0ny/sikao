"""Static recommendation policy header for prompts."""

from __future__ import annotations


def build_recommendation_policy_header() -> str:
    return "\n".join(
        [
            "- Prefer continue when there is an unfinished practice session.",
            "- Prefer review after a recently submitted session or weak-signal spike.",
            "- Use rest only as a low-intensity fallback, never as the only card.",
            "- Keep cards immediately executable.",
        ]
    )
