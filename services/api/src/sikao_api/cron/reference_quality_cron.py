from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import EssayReferenceAnswerV2
from sikao_api.modules.system.application.audit_v2 import add_audit_log

_MANAGED_REFERENCE_SOURCES = ("ai_generated", "user_contributed")


@dataclass(frozen=True)
class ReferenceQualityCronResult:
    updated_count: int
    published_count: int
    archived_count: int


def recompute_reference_quality(
    session: Session,
    *,
    publish_like_threshold: int = 3,
    publish_favorite_threshold: int = 2,
    archive_quality_threshold: float = 2.5,
    archive_report_threshold: int = 5,
) -> ReferenceQualityCronResult:
    rows = list(
        session.scalars(select(EssayReferenceAnswerV2).with_for_update())
    )
    if not rows:
        return ReferenceQualityCronResult(
            updated_count=0,
            published_count=0,
            archived_count=0,
        )

    updated_count = 0
    published_count = 0
    archived_count = 0
    now = datetime.now(UTC).replace(tzinfo=None)

    for row in rows:
        before_status = row.status
        before_quality = float(row.quality_score)
        before_report_count = int(row.report_count)
        before_published_at = row.published_at

        next_quality = _compute_reference_quality(
            likes_count=row.likes_count,
            favorites_count=row.favorites_count,
            report_count=row.report_count,
        )
        row.quality_score = next_quality

        status_changed = False
        reason: str | None = None

        if row.source in _MANAGED_REFERENCE_SOURCES:
            next_status, reason = _resolve_managed_reference_status(
                row=row,
                publish_like_threshold=publish_like_threshold,
                publish_favorite_threshold=publish_favorite_threshold,
                archive_quality_threshold=archive_quality_threshold,
                archive_report_threshold=archive_report_threshold,
            )
            if next_status != row.status:
                row.status = next_status
                status_changed = True
                if next_status == "public" and row.published_at is None:
                    row.published_at = now
                if next_status == "public":
                    published_count += 1
                elif next_status == "archived":
                    archived_count += 1
        if (
            row.quality_score != before_quality
            or row.status != before_status
            or row.published_at != before_published_at
        ):
            updated_count += 1
            session.add(row)

        if status_changed and reason is not None:
            add_audit_log(
                session,
                user_id=0,
                actor_type="system",
                actor_id="practice.reference_quality.recompute",
                action="reference.status_change",
                target_type="essay_reference_answer_v2",
                target_id=row.id,
                before={
                    "status": before_status,
                    "quality_score": before_quality,
                    "report_count": before_report_count,
                },
                after={
                    "status": row.status,
                    "quality_score": row.quality_score,
                },
                metadata={"reason": reason},
                request_id=None,
                ip=None,
            )

    session.flush()
    return ReferenceQualityCronResult(
        updated_count=updated_count,
        published_count=published_count,
        archived_count=archived_count,
    )


def _compute_reference_quality(
    *,
    likes_count: int,
    favorites_count: int,
    report_count: int,
) -> float:
    base = 5.0
    likes_bonus = min(likes_count * 0.05, 1.0)
    favorites_bonus = min(favorites_count * 0.15, 1.5)
    reports_penalty = report_count * 0.5
    score = base + likes_bonus + favorites_bonus - reports_penalty
    return round(max(0.0, min(score, 5.0)), 2)


def _resolve_managed_reference_status(
    *,
    row: EssayReferenceAnswerV2,
    publish_like_threshold: int,
    publish_favorite_threshold: int,
    archive_quality_threshold: float,
    archive_report_threshold: int,
) -> tuple[str, str | None]:
    if row.ai_self_audit_passed is False:
        return "archived", "ai_self_audit_failed"
    if row.quality_score < archive_quality_threshold:
        return "archived", f"quality_score<{archive_quality_threshold}"
    if row.report_count >= archive_report_threshold:
        return "archived", f"report_count>={archive_report_threshold}"
    if row.status == "draft" and (
        row.likes_count >= publish_like_threshold
        or row.favorites_count >= publish_favorite_threshold
    ):
        return "public", "quality_published"
    return row.status, None
