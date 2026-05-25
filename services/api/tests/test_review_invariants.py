from __future__ import annotations

# ruff: noqa: F401

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import ReviewItemV2
from sikao_api.modules.review.application.validators import validate_review_item_source_contract
from sikao_api.modules.system.application.errors import ValidationError
from test_cross_tab_review import (
    test_cross_tab_review_wrong_answer_probation_failure_and_add_to_plan_flow as test_review_pr_r5_cross_tab_flow_gate,
)
from test_home_phase_m6_contract_lock import (
    test_home_m6_typegen_script_reuses_backend_openapi_export_entrypoint as test_review_openapi_export_entrypoint_gate,
)
from test_openapi_drift import (
    test_checked_in_openapi_matches_live_app_for_review_backend_gate as test_review_openapi_drift_gate,
    test_openapi_includes_review_debt_and_profile_contract_shapes as test_review_openapi_shape_gate,
)
from test_postgres_practice_session_modes_v2 import (
    test_postgres_wrong_redo_allows_inactive_review_questions_and_forces_per_question as test_review_pr_r3_pr_r4_gate,
)
from test_postgres_review_cause_analysis_edges_v2 import (
    test_postgres_single_cause_analysis_failure_persists_llm_audit as test_review_pr_r6_failure_isolated_gate,
)
from test_postgres_review_crud_v2 import (
    test_postgres_review_archive_restore_and_batch_actions as test_review_archive_restore_gate,
    test_postgres_review_create_list_detail_and_duplicate_manual_add as test_review_pr_r1_manual_add_gate,
    test_postgres_review_graduate_detects_version_conflict as test_review_pr_r10_optimistic_lock_gate,
    test_postgres_review_graduate_filters_and_dashboard_consumer as test_review_graduate_dashboard_gate,
)
from test_practice_question_flag_review_sync_v2 import (
    test_question_flag_create_and_review_sync as test_review_pr_r1_flagged_persistent_gate,
)


def test_review_pr_r7_source_contract_gate() -> None:
    validate_review_item_source_contract(
        source_kind="manual_add",
        question_id=1,
        metadata_json={"manualAddedAt": "2026-05-25T00:00:00Z"},
    )
    validate_review_item_source_contract(
        source_kind="note_card",
        question_id=None,
        metadata_json={"source_note_id": 42},
    )

    with pytest.raises(ValidationError):
        validate_review_item_source_contract(
            source_kind="note_card",
            question_id=None,
            metadata_json={},
        )
    with pytest.raises(ValidationError):
        validate_review_item_source_contract(
            source_kind="wrong_answer",
            question_id=1,
            metadata_json={"source_note_id": 42},
        )


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_review_pr_r2_supported_mutations_preserve_source_kind_gate(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-INVARIANT-R2",
            title="Review invariant PR-R2",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "PR-R2 manual add",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        created = client.post("/api/v2/review/items", json={"questionId": question_id})
        assert created.status_code == 200, created.text
        item_id = created.json()["id"]
        assert created.json()["kind"] == "manual_add"

        archived = client.patch(f"/api/v2/review/items/{item_id}/archive")
        assert archived.status_code == 200, archived.text
        assert archived.json()["kind"] == "manual_add"

        restored = client.patch(f"/api/v2/review/items/{item_id}/restore")
        assert restored.status_code == 200, restored.text
        assert restored.json()["kind"] == "manual_add"

        graduated = client.patch(f"/api/v2/review/items/{item_id}/graduate")
        assert graduated.status_code == 200, graduated.text
        assert graduated.json()["kind"] == "manual_add"

        detail = client.get(f"/api/v2/review/items/{item_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["item"]["kind"] == "manual_add"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(ReviewItemV2, item_id)
            assert row is not None
            assert row.user_id == user_id
            assert row.source_kind == "manual_add"
