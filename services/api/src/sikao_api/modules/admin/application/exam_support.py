from __future__ import annotations

from collections.abc import Iterable


def normalize_answer_keys(raw_value: Iterable[str] | None) -> list[str]:
    if raw_value is None:
        return []
    normalized = sorted({str(item).strip().upper() for item in raw_value if str(item).strip()})
    return normalized


def serialize_answer_keys(answer_keys: list[str], option_order: list[str] | None = None) -> str:
    if option_order:
        order_map = {key: index for index, key in enumerate(option_order)}
        answer_keys = sorted(answer_keys, key=lambda item: order_map.get(item, len(order_map)))
    else:
        answer_keys = sorted(answer_keys)
    return ",".join(answer_keys)


def deserialize_answer_text(answer_text: str | None) -> list[str]:
    if not answer_text:
        return []
    return [part.strip().upper() for part in answer_text.split(",") if part.strip()]


def infer_renderer_key(
    answer_keys: list[str],
    option_keys: list[str],
    *,
    explicit_renderer: str | None = None,
) -> str:
    if explicit_renderer:
        return explicit_renderer
    return "multiple_choice" if len(answer_keys) > 1 else "single_choice"


def selection_mode_for_renderer(renderer_key: str) -> str:
    return "multiple" if renderer_key in {"multiple_choice", "checkbox"} else "single"


def is_answer_correct(selected_answer_keys: list[str], correct_answer_keys: list[str]) -> bool:
    return normalize_answer_keys(selected_answer_keys) == normalize_answer_keys(correct_answer_keys)


def format_answer_summary(answer_keys: list[str]) -> str:
    return ",".join(normalize_answer_keys(answer_keys))
