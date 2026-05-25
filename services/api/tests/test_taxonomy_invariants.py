from __future__ import annotations

# ruff: noqa: F401

import os
from hashlib import sha256
from pathlib import Path

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.modules.llm.application.parsers.cause_analysis_parser import parse_cause_analysis_with_meta
from sikao_api.modules.review.application.cause_analysis_cache import CauseTagDefinition
from test_cause_analysis_prompts_v2 import (
    test_parse_cause_analysis_accepts_group_payload_with_null_evolution as test_taxonomy_null_evolution_parser_gate,
    test_parse_cause_analysis_accepts_valid_single_payload as test_taxonomy_comparison_judgment_parser_gate,
    test_parse_cause_analysis_falls_back_unknown_slug_to_other as test_taxonomy_unknown_slug_fallback_gate,
)
from test_postgres_review_cause_analysis_edges_v2 import (
    test_postgres_deep_cause_analysis_requires_hard_item_and_uses_independent_quota as test_taxonomy_deep_quota_gate,
    test_postgres_group_cause_analysis_rejects_in_progress_idempotency_claim as test_taxonomy_group_idempotency_gate,
    test_postgres_group_override_rejected_and_admin_invalidate_refreshes_tag_cache as test_taxonomy_group_override_gate,
    test_postgres_single_cause_analysis_surfaces_taxonomy_degraded_warning as test_taxonomy_degraded_warning_gate,
    test_postgres_single_cause_analysis_enforces_normal_quota_but_forced_is_exempt as test_taxonomy_quota_gate,
)
from test_postgres_review_cause_feedback_v2 import (
    test_postgres_single_cause_feedback_persists_dimensions_and_actions as test_taxonomy_feedback_disagreed_gate,
)
from test_postgres_review_cause_analysis_v2 import (
    _set_item_metadata,
    _stub_completion,
    test_postgres_deep_cause_analysis_for_hard_item_persists_timestamp as test_taxonomy_deep_success_gate,
    test_postgres_deep_cache_miss_when_hard_context_changes as test_taxonomy_deep_cache_miss_gate,
    test_postgres_forced_cause_analysis_caches_and_clears_pending_flag as test_taxonomy_forced_cache_gate,
    test_postgres_group_cause_analysis_uses_db_cache as test_taxonomy_group_cache_gate,
    test_postgres_single_analysis_evolution_ignores_deep_history as test_taxonomy_deep_isolation_gate,
    test_postgres_single_cause_analysis_reuses_db_cache_for_identical_state as test_taxonomy_single_cache_gate,
    test_postgres_single_cause_override_writes_attempt_and_audit as test_taxonomy_single_override_gate,
)
from test_review_phase_r2_cause_taxonomy_schema import (
    test_postgres_review_r2_schema_adds_cause_tag_table_and_analysis_version as test_taxonomy_seed_schema_gate,
)


def _single_payload_with_evolution(summary: str) -> str:
    return (
        "{"
        f"\"summary\":\"{summary}\","
        "\"dimensions\":[{\"slug\":\"concept_confusion\",\"name_display\":\"概念混淆\",\"severity\":\"high\",\"suggestion\":\"先拆定义再对照题干。\"}],"
        "\"suggested_actions\":[\"整理概念对照表\"],"
        "\"related_questions\":[],"
        "\"evolution_context\":{"
        "\"comparison_judgment\":{"
        "\"improved_dimensions\":[],"
        "\"persisted_dimensions\":[\"concept_confusion\"],"
        "\"newly_emerged_dimensions\":[],"
        "\"actions_likely_completed\":[false],"
        "\"overall_trend\":\"stagnant\""
        "}"
        "}"
        "}"
    )


def _active_tag_map() -> dict[str, CauseTagDefinition]:
    return {
        "concept_confusion": CauseTagDefinition(
            slug="concept_confusion",
            name="概念混淆",
            category="knowledge",
            severity_default="high",
            description="concept",
            display_order=1,
            taxonomy_version="v1",
        ),
        "other": CauseTagDefinition(
            slug="other",
            name="其他",
            category="other",
            severity_default="low",
            description="fallback",
            display_order=99,
            taxonomy_version="v1",
        ),
    }


def test_taxonomy_empty_slug_falls_back_to_other_gate() -> None:
    parsed = parse_cause_analysis_with_meta(
        """
        {
          "summary": "empty slug",
          "dimensions": [{"slug": "", "name_display": "Bad", "severity": "low", "suggestion": "Nope"}],
          "suggested_actions": [],
          "related_questions": []
        }
        """,
        allowed_tags=_active_tag_map(),
    )
    assert parsed.payload.dimensions[0].slug == "other"
    assert parsed.fallback_count == 1


def test_taxonomy_uppercase_slug_normalizes_to_lowercase_gate() -> None:
    parsed = parse_cause_analysis_with_meta(
        """
        {
          "summary": "uppercase slug",
          "dimensions": [{"slug": "CONCEPT_CONFUSION", "name_display": "概念混淆", "severity": "high", "suggestion": "拆定义"}],
          "suggested_actions": [],
          "related_questions": []
        }
        """,
        allowed_tags=_active_tag_map(),
    )
    assert parsed.payload.dimensions[0].slug == "concept_confusion"
    assert parsed.fallback_count == 0


def test_taxonomy_inactive_slug_falls_back_to_other_gate() -> None:
    parsed = parse_cause_analysis_with_meta(
        """
        {
          "summary": "inactive slug",
          "dimensions": [{"slug": "deprecated_slug", "name_display": "旧标签", "severity": "medium", "suggestion": "回退"}],
          "suggested_actions": [],
          "related_questions": []
        }
        """,
        allowed_tags=_active_tag_map(),
    )
    assert parsed.payload.dimensions[0].slug == "other"
    assert parsed.payload.dimensions[0].llm_original_slug == "deprecated_slug"
    assert parsed.fallback_count == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_taxonomy_single_analysis_tracks_previous_analysis_and_latest_evolution_context(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_single@v1": _single_payload_with_evolution("evolution summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-TAXONOMY-EVO",
            title="Taxonomy Evolution",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Evolution question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        item_id = client.post("/api/v2/review/items", json={"questionId": question_id}).json()["id"]

        _set_item_metadata(
            client,
            item_id=item_id,
            updates={"last_answer_hash": sha256(b"A").hexdigest(), "last_confidence": "likely"},
        )
        first = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174401"},
            json={"mode": "single"},
        )
        assert first.status_code == 200, first.text
        first_body = first.json()
        first_evolution = first_body["result"]["evolutionContext"]
        assert first_evolution["previousAnalysisId"] is None
        assert first_evolution["previousDimensions"] == []

        _set_item_metadata(
            client,
            item_id=item_id,
            updates={"last_answer_hash": sha256(b"B").hexdigest(), "last_confidence": "likely"},
        )
        second = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174402"},
            json={"mode": "single"},
        )
        assert second.status_code == 200, second.text
        second_body = second.json()
        evolution = second_body["result"]["evolutionContext"]
        assert evolution["previousAnalysisId"] == first_body["analysisId"]
        assert evolution["comparisonJudgment"]["actionsLikelyCompleted"] == [False]

        _set_item_metadata(
            client,
            item_id=item_id,
            updates={"last_answer_hash": sha256(b"C").hexdigest(), "last_confidence": "likely"},
        )
        third = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": "123e4567-e89b-12d3-a456-426614174403"},
            json={"mode": "single"},
        )
        assert third.status_code == 200, third.text
        latest_prompt = "\n".join(str(message) for message in calls[-1]["messages"])
        assert f"PreviousAnalysisId: {second_body['analysisId']}" in latest_prompt
        assert f"PreviousAnalysisId: {first_body['analysisId']}" not in latest_prompt
