from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from sikao_api.db.enums_v2 import CauseAnalysisScope, ReviewAttemptOutcome
from sikao_api.db.models_v2 import AiCauseAnalysisV2, ReviewItemV2, UserV2
from sikao_api.db.schemas_v2 import CauseDimensionOverrideRequestV2
from sikao_api.modules.review.application.cause_analysis_cache import get_active_cause_tag_map
from sikao_api.modules.review.application.effective_slug import get_effective_slug
from sikao_api.modules.review.application.queue_items import record_review_attempt
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError


class CauseOverrideService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def override_dimension(
        self,
        *,
        user: UserV2,
        analysis_id: int,
        dimension_index: int,
        payload: CauseDimensionOverrideRequestV2,
        request_id: str | None,
    ) -> AiCauseAnalysisV2:
        analysis = self._load_owned_analysis(user_id=user.id, analysis_id=analysis_id)
        if analysis.scope != CauseAnalysisScope.SINGLE.value:
            raise ConflictError(
                "only single-scope analyses support override",
                code="cause_analysis_override_scope_invalid",
            )
        if analysis.version != payload.expected_version:
            raise ConflictError(
                "cause analysis version conflict",
                code="cause_analysis_optimistic_lock",
            )
        active_tags = get_active_cause_tag_map(self.session)
        if payload.slug not in active_tags:
            raise ValidationError("invalid cause tag slug", code="cause_tag_invalid")

        result_json = dict(analysis.result_json)
        raw_dimensions = list(result_json.get("dimensions", []))
        if not 0 <= dimension_index < len(raw_dimensions):
            raise NotFoundError("cause analysis dimension not found", code="cause_analysis_dimension_not_found")

        dimension = dict(raw_dimensions[dimension_index])
        before_slug = get_effective_slug(dimension)
        llm_original_slug = str(dimension.get("_llm_original_slug") or dimension.get("slug") or "other")
        override_block = {
            "slug_original": before_slug,
            "slug_overridden": payload.slug,
            "severity_overridden": payload.user_severity,
            "user_note": payload.user_note,
            "overridden_at": datetime.now(UTC).replace(tzinfo=None).isoformat(),
        }
        dimension["user_override"] = override_block
        dimension["_llm_original_slug"] = llm_original_slug
        dimension["slug"] = payload.slug
        dimension["name_display"] = active_tags[payload.slug].name
        if payload.user_severity is not None:
            dimension["severity"] = payload.user_severity
        raw_dimensions[dimension_index] = dimension
        result_json["dimensions"] = raw_dimensions

        analysis.result_json = result_json
        analysis.version += 1
        analysis.updated_at = datetime.now(UTC).replace(tzinfo=None)
        result = self.session.execute(
            update(AiCauseAnalysisV2)
            .where(
                AiCauseAnalysisV2.id == analysis.id,
                AiCauseAnalysisV2.user_id == user.id,
                AiCauseAnalysisV2.version == payload.expected_version,
            )
            .values(
                result_json=analysis.result_json,
                version=analysis.version,
                updated_at=analysis.updated_at,
            )
            .execution_options(synchronize_session=False)
        )
        if getattr(result, "rowcount", None) != 1:
            raise ConflictError(
                "cause analysis version conflict",
                code="cause_analysis_optimistic_lock",
            )

        review_item_id = self._resolve_review_item_id(analysis=analysis)
        record_review_attempt(
            self.session,
            item_id=review_item_id,
            outcome=ReviewAttemptOutcome.CAUSE_TAG_OVERRIDDEN.value,
            notes_json={
                "analysisId": analysis.id,
                "dimensionIndex": dimension_index,
                "from": before_slug,
                "to": payload.slug,
                "userSeverity": payload.user_severity,
                "userNote": payload.user_note,
            },
        )
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="review.cause_analysis.dimension_overridden",
            target_type="ai_cause_analysis_v2",
            target_id=analysis.id,
            before={"slug": before_slug, "dimensionIndex": dimension_index},
            after={"slug": payload.slug, "dimensionIndex": dimension_index},
            metadata={"reviewItemId": review_item_id},
            request_id=request_id,
        )
        return analysis

    def _load_owned_analysis(self, *, user_id: int, analysis_id: int) -> AiCauseAnalysisV2:
        analysis = self.session.scalar(
            select(AiCauseAnalysisV2).where(
                AiCauseAnalysisV2.id == analysis_id,
                AiCauseAnalysisV2.user_id == user_id,
            )
        )
        if analysis is None:
            raise NotFoundError("cause analysis not found", code="cause_analysis_not_found")
        return analysis

    def _resolve_review_item_id(self, *, analysis: AiCauseAnalysisV2) -> int:
        meta = analysis.result_json.get("_meta") if isinstance(analysis.result_json, dict) else None
        review_item_id = meta.get("review_item_id") if isinstance(meta, dict) else None
        if not isinstance(review_item_id, int):
            raise ConflictError(
                "cause analysis is missing review item binding",
                code="cause_analysis_review_item_missing",
            )
        row = self.session.get(ReviewItemV2, review_item_id)
        if row is None:
            raise ConflictError(
                "bound review item does not exist",
                code="cause_analysis_review_item_missing",
            )
        return review_item_id
