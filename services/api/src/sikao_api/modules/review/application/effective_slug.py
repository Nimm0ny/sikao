from __future__ import annotations

from typing import Any


def get_effective_slug(dimension: dict[str, Any]) -> str:
    override = dimension.get("user_override")
    if isinstance(override, dict):
        overridden = override.get("slug_overridden")
        if isinstance(overridden, str) and overridden.strip():
            return overridden.strip().lower()
    slug = dimension.get("slug")
    if isinstance(slug, str) and slug.strip():
        return slug.strip().lower()
    return "other"

