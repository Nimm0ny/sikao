from __future__ import annotations

import asyncio
import os
from hashlib import sha256
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, ReviewItemV2, ReviewWeeklySnapshotV2
from sikao_api.modules.review.application.metrics import get_review_metric_snapshot, reset_review_metric_snapshot
from sikao_api.modules.system.application.home_runtime import HomeRuntimeOrchestrator


def _app_context(client):  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    return app, app.state.db.session_factory


def _set_item_metadata(client, *, item_id: int, updates: dict[str, Any]) -> None:
    _app, factory = _app_context(client)
    with factory() as session:
        row = session.get(ReviewItemV2, item_id)
        assert row is not None
        metadata = dict(row.metadata_json)
        metadata.update(updates)
        row.metadata_json = metadata
        session.add(row)
        session.commit()


def _audit_actions(client) -> set[str]:  # type: ignore[no-untyped-def]
    _app, factory = _app_context(client)
    with factory() as session:
        return {
            row.action
            for row in session.scalars(select(AuditLogV2).order_by(AuditLogV2.id.asc()))
        }


def _stub_completion(monkeypatch: pytest.MonkeyPatch, *, payload: str) -> None:
    async def _fake_call_json_completion(service, *, user_id: int, purpose: str, prompt_version: str, model: str, messages):  # type: ignore[no-untyped-def]
        return payload, {"prompt_tokens": 111, "completion_tokens": 42}, "mock"

    monkeypatch.setattr(
        "sikao_api.modules.review.application.cause_analysis_execution.call_json_completion",
        _fake_call_json_completion,
    )


def _single_payload(summary: str) -> str:
    return (
        "{"
        f"\"summary\":\"{summary}\","
        "\"dimensions\":[{\"slug\":\"concept_confusion\",\"name_display\":\"概念混淆\",\"severity\":\"high\",\"suggestion\":\"先拆定义再对照题干。\"}],"
        "\"suggested_actions\":[\"整理概念对照表\"],"
        "\"related_questions\":[]"
        "}"
    )


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_archive_restore_and_mark_resolved_emit_audit_and_metrics(tmp_path: Path) -> None:
    reset_review_metric_snapshot()
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-AUDIT-001",
            title="Audit source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Audit item",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        item_id = client.post("/api/v2/review/items", json={"questionId": question_id}).json()["id"]
        archived = client.patch(f"/api/v2/review/items/{item_id}/archive")
        assert archived.status_code == 200, archived.text
        restored = client.patch(f"/api/v2/review/items/{item_id}/restore")
        assert restored.status_code == 200, restored.text
        promoted = client.patch(f"/api/v2/review/items/{item_id}/graduate")
        assert promoted.status_code == 200, promoted.text

        actions = _audit_actions(client)
        assert "review.item.archived" in actions
        assert "review.item.restored" in actions
        assert "review.item.mark_resolved" in actions

        metrics_snapshot = get_review_metric_snapshot()
        assert metrics_snapshot["review_item_archived_total"] >= 1
        assert metrics_snapshot["review_item_restored_total"] >= 1
        assert metrics_snapshot["review_srs_mastery_transitions_total"] >= 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_cause_analysis_emits_audit_and_metrics(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    reset_review_metric_snapshot()
    _stub_completion(monkeypatch, payload=_single_payload("audit summary"))
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-AUDIT-002",
            title="Cause audit source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Cause audit item",
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
            updates={
                "last_answer_hash": sha256(b"A").hexdigest(),
                "last_confidence": "likely",
            },
        )

        first = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert first.status_code == 200, first.text
        second = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert second.status_code == 200, second.text
        assert second.json()["cached"] is True

        actions = _audit_actions(client)
        assert "review.cause_analysis.requested" in actions
        assert "review.cause_analysis.completed" in actions
        assert "review.cause_analysis.cache_hit" in actions

        metrics_snapshot = get_review_metric_snapshot()
        assert metrics_snapshot["review_cause_analysis_requests_total"] >= 2
        assert metrics_snapshot["review_cause_analysis_cache_hits_total"] >= 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_cause_analysis_failure_emits_audit_and_metrics(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reset_review_metric_snapshot()

    async def _failing_call(*args, **kwargs):  # type: ignore[no-untyped-def]
        raise TimeoutError("upstream timed out")

    monkeypatch.setattr(
        "sikao_api.modules.review.application.cause_analysis_execution.call_json_completion",
        _failing_call,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-AUDIT-004",
            title="Cause failure source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Cause failure item",
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
            updates={
                "last_answer_hash": sha256(b"A").hexdigest(),
                "last_confidence": "likely",
            },
        )
        response = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert response.status_code == 503, response.text

        actions = _audit_actions(client)
        assert "review.cause_analysis.requested" in actions
        assert "review.cause_analysis.failed" in actions
        metrics_snapshot = get_review_metric_snapshot()
        assert metrics_snapshot["review_cause_analysis_failures_total"] >= 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_weekly_snapshot_runtime_emits_audit_and_metrics(tmp_path: Path) -> None:
    reset_review_metric_snapshot()
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-AUDIT-003",
            title="Weekly runtime source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Weekly runtime item",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        _app, factory = _app_context(client)
        with factory() as session:
            session.add(
                ReviewItemV2(
                    user_id=user_id,
                    question_id=question_id,
                    title="Weekly runtime item",
                    source_kind="wrong_answer",
                    source_id=1,
                    status="in_progress",
                    metadata_json={},
                )
            )
            session.commit()

        orchestrator = HomeRuntimeOrchestrator(_app.state.db, _app.state.settings)
        processed = asyncio.run(orchestrator.run_review_weekly_summary_snapshot())
        assert processed >= 1
        processed_again = asyncio.run(orchestrator.run_review_weekly_summary_snapshot())
        assert processed_again >= 1

        with factory() as session:
            rows = list(session.scalars(select(ReviewWeeklySnapshotV2)))
            assert len(rows) == 1
            audits = list(
                session.scalars(
                    select(AuditLogV2).where(
                        AuditLogV2.user_id == user_id,
                        AuditLogV2.action.in_(
                            (
                                "review.weekly_summary.snapshot_generated",
                                "review.weekly_summary.snapshot_refreshed",
                            )
                        ),
                    )
                )
            )
        actions = {row.action for row in audits}
        assert "review.weekly_summary.snapshot_generated" in actions
        assert "review.weekly_summary.snapshot_refreshed" in actions
        assert sum(1 for row in audits if row.action == "review.weekly_summary.snapshot_generated") == 1
        metrics_snapshot = get_review_metric_snapshot()
        assert metrics_snapshot["review_weekly_snapshots_generated_total"] == 1
