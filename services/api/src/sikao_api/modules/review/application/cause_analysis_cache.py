from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
from threading import RLock
from time import monotonic

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import CauseTagV2

_CAUSE_TAG_CACHE_TTL_SECONDS = 300.0
_CAUSE_TAG_CACHE_LOCK = RLock()
_CAUSE_TAG_CACHE: tuple[float, list["CauseTagDefinition"]] | None = None


@dataclass(frozen=True)
class CauseTagDefinition:
    slug: str
    name: str
    category: str
    severity_default: str
    description: str
    display_order: int
    taxonomy_version: str


def load_active_cause_tags(
    session: Session,
    *,
    force_refresh: bool = False,
) -> list[CauseTagDefinition]:
    global _CAUSE_TAG_CACHE
    with _CAUSE_TAG_CACHE_LOCK:
        if not force_refresh and _CAUSE_TAG_CACHE is not None:
            expires_at, cached = _CAUSE_TAG_CACHE
            if expires_at > monotonic():
                return cached
        rows = list(
            session.scalars(
                select(CauseTagV2)
                .where(CauseTagV2.is_active.is_(True))
                .order_by(CauseTagV2.display_order.asc(), CauseTagV2.id.asc())
            )
        )
        tags = [
            CauseTagDefinition(
                slug=row.slug,
                name=row.name,
                category=row.category,
                severity_default=row.severity_default,
                description=row.description,
                display_order=row.display_order,
                taxonomy_version=row.taxonomy_version,
            )
            for row in rows
        ]
        _CAUSE_TAG_CACHE = (monotonic() + _CAUSE_TAG_CACHE_TTL_SECONDS, tags)
        return tags


def invalidate_cause_tag_cache() -> None:
    global _CAUSE_TAG_CACHE
    with _CAUSE_TAG_CACHE_LOCK:
        _CAUSE_TAG_CACHE = None


def get_active_cause_tag_map(
    session: Session,
    *,
    force_refresh: bool = False,
) -> dict[str, CauseTagDefinition]:
    return {
        tag.slug: tag
        for tag in load_active_cause_tags(session, force_refresh=force_refresh)
    }


def render_taxonomy_block(tags: list[CauseTagDefinition]) -> str:
    sections = [
        ("knowledge", "知识层"),
        ("reasoning", "思维层"),
        ("state", "状态层"),
        ("other", "兜底"),
    ]
    lines: list[str] = []
    for category_key, category_label in sections:
        category_tags = [tag for tag in tags if tag.category == category_key]
        if not category_tags:
            continue
        lines.append(f"{category_label}（{category_key}）:")
        for tag in category_tags:
            lines.append(f"  - {tag.slug}: {tag.name}")
    return "\n".join(lines)


def compute_single_input_hash(
    *,
    user_id: int,
    question_id: int,
    last_answer_hash: str,
    mode: str,
    current_confidence: str | None,
    error_count: int,
    mismatch_count: int | None = None,
    re_fail_count: int | None = None,
    total_wrong_count: int | None = None,
    historical_dimensions_freq: dict[str, int] | None = None,
) -> str:
    mode_specific: dict[str, object]
    if mode == "forced":
        mode_specific = {
            "mismatchCount": mismatch_count,
        }
    elif mode == "deep":
        mode_specific = {
            "reFailCount": re_fail_count,
            "totalWrongCount": total_wrong_count,
            "historicalDimensionsFreq": historical_dimensions_freq or {},
        }
    else:
        mode_specific = {}
    encoded = json.dumps(
        {
            "userId": user_id,
            "questionId": question_id,
            "lastAnswerHash": last_answer_hash,
            "mode": mode,
            "currentConfidence": current_confidence,
            "errorCount": error_count,
            "modeSpecific": mode_specific,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return sha256(encoded.encode("utf-8")).hexdigest()


def compute_group_question_ids_signature(*, question_ids: list[int]) -> str:
    sorted_ids = ",".join(str(value) for value in sorted(set(question_ids)))
    return sha256(sorted_ids.encode("utf-8")).hexdigest()


def compute_group_input_hash(
    *,
    user_id: int,
    question_ids_signature: str,
    prompt_summary: list[dict[str, object]],
) -> str:
    encoded = json.dumps(
        {
            "userId": user_id,
            "questionIdsSignature": question_ids_signature,
            "promptSummary": prompt_summary,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return sha256(encoded.encode("utf-8")).hexdigest()
