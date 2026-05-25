from __future__ import annotations

from collections import Counter
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import AiCauseAnalysisV2, RecommendationFeedbackV2, UserV2
from sikao_api.db.schemas_v2 import CauseAnalysisFeedbackRequestV2
from sikao_api.modules.review.application.cause_analysis_cache import get_active_cause_tag_map
from sikao_api.modules.system.application.audit_v2 import add_audit_log
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError


_CAUSE_ANALYSIS_FEEDBACK_TYPES = {"cause_analysis_single", "cause_analysis_group"}


class CauseAnalysisFeedbackService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def submit_feedback(
        self,
        *,
        user: UserV2,
        analysis_id: int,
        payload: CauseAnalysisFeedbackRequestV2,
        request_id: str | None,
        ip: str | None,
    ) -> RecommendationFeedbackV2:
        analysis = self._load_owned_analysis(user_id=user.id, analysis_id=analysis_id)
        feedback_type = self._resolve_feedback_type(analysis)
        self._validate_payload(analysis=analysis, payload=payload)
        metadata_json = {
            "rating": payload.rating,
            "comment": payload.comment,
            "dimensions_disagreed": list(payload.dimensions_disagreed),
            "actions_unhelpful": list(payload.actions_unhelpful),
        }
        row = RecommendationFeedbackV2(
            recommendation_id=None,
            analysis_id=analysis.id,
            feedback_type=feedback_type,
            reason="user_feedback",
            rating=payload.rating,
            note=payload.comment,
            metadata_json=metadata_json,
        )
        self.session.add(row)
        self.session.flush()
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="review.cause_analysis.feedback_submitted",
            target_type="ai_cause_analysis_v2",
            target_id=analysis.id,
            after={
                "feedbackType": feedback_type,
                "rating": payload.rating,
                "dimensionsDisagreed": list(payload.dimensions_disagreed),
                "actionsUnhelpful": list(payload.actions_unhelpful),
            },
            request_id=request_id,
            ip=ip,
        )
        return row

    def list_top_disagreed_dimensions(
        self,
        *,
        since: datetime,
        limit: int = 5,
    ) -> list[dict[str, int | str]]:
        rows = list(
            self.session.scalars(
                select(RecommendationFeedbackV2).where(
                    RecommendationFeedbackV2.feedback_type.in_(_CAUSE_ANALYSIS_FEEDBACK_TYPES),
                    RecommendationFeedbackV2.rating == "down",
                    RecommendationFeedbackV2.created_at >= since,
                )
            )
        )
        counts: Counter[str] = Counter()
        for row in rows:
            metadata_json = row.metadata_json if isinstance(row.metadata_json, dict) else {}
            disagreed = metadata_json.get("dimensions_disagreed")
            if not isinstance(disagreed, list):
                continue
            for raw_slug in disagreed:
                if not isinstance(raw_slug, str):
                    continue
                slug = raw_slug.strip().lower()
                if slug:
                    counts[slug] += 1
        return [
            {"slug": slug, "down_count": count}
            for slug, count in counts.most_common(limit)
        ]

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

    def _resolve_feedback_type(self, analysis: AiCauseAnalysisV2) -> str:
        if analysis.scope == "single":
            return "cause_analysis_single"
        if analysis.scope == "group":
            return "cause_analysis_group"
        raise ValidationError(
            "unsupported cause analysis scope for feedback",
            code="cause_analysis_feedback_invalid",
        )

    def _validate_payload(
        self,
        *,
        analysis: AiCauseAnalysisV2,
        payload: CauseAnalysisFeedbackRequestV2,
    ) -> None:
        if payload.rating == "up" and (
            payload.dimensions_disagreed or payload.actions_unhelpful
        ):
            raise ValidationError(
                "positive feedback cannot include disagreed dimensions or unhelpful actions",
                code="cause_analysis_feedback_invalid",
            )

        active_tags = get_active_cause_tag_map(self.session)
        invalid_slugs = sorted(
            {
                slug
                for slug in payload.dimensions_disagreed
                if slug not in active_tags
            }
        )
        if invalid_slugs:
            raise ValidationError(
                "invalid cause tag slug: " + ", ".join(invalid_slugs),
                code="cause_tag_invalid",
            )

        suggested_actions = analysis.result_json.get("suggested_actions")
        action_count = len(suggested_actions) if isinstance(suggested_actions, list) else 0
        invalid_indexes = sorted(
            {
                index
                for index in payload.actions_unhelpful
                if index >= action_count
            }
        )
        if invalid_indexes:
            raise ValidationError(
                "actions_unhelpful contains out-of-range indexes",
                code="cause_analysis_feedback_invalid",
            )
