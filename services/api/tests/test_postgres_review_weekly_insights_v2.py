from __future__ import annotations

from datetime import datetime, timedelta
import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AiCauseAnalysisV2, AuditLogV2, LlmCallV2, NoteV2, ReviewAttemptV2, ReviewItemV2, ReviewWeeklySnapshotV2
from sikao_api.modules.review.application.metrics import get_review_metric_snapshot, reset_review_metric_snapshot
from sikao_api.modules.review.application.time_windows import iso_week_code_from_date, previous_week_start, week_bounds_utc_from_cn_week_start
from sikao_api.modules.review.application.weekly_service import write_weekly_snapshot


def _app_factory(client):  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    return app.state.db.session_factory


def _seed_review_item(
    client,
    *,
    user_id: int,
    question_id: int,
    title: str,
    created_at: datetime,
    source_kind: str = "wrong_answer",
    status: str = "in_progress",
    source_id: int | None = 900,
) -> int:
    factory = _app_factory(client)
    with factory() as session:
        row = ReviewItemV2(
            user_id=user_id,
            question_id=question_id,
            title=title,
            source_kind=source_kind,
            source_id=source_id,
            status=status,
            metadata_json={},
            created_at=created_at,
            updated_at=created_at,
            reason=source_kind if source_kind in {"wrong_answer", "manual_add", "flagged_persistent"} else None,
        )
        session.add(row)
        session.commit()
        return row.id


def _seed_attempt(
    client,
    *,
    review_item_id: int,
    outcome: str,
    attempted_at: datetime,
    notes_json: dict[str, Any] | None = None,
) -> None:
    factory = _app_factory(client)
    with factory() as session:
        session.add(
            ReviewAttemptV2(
                review_item_id=review_item_id,
                outcome=outcome,
                notes_json=notes_json or {},
                attempted_at=attempted_at,
            )
        )
        session.commit()


def _seed_cause_analysis(
    client,
    *,
    user_id: int,
    question_id: int,
    created_at: datetime,
    dimensions: list[dict[str, Any]],
) -> None:
    factory = _app_factory(client)
    with factory() as session:
        llm_call = LlmCallV2(
            user_id=user_id,
            purpose="review_cause_analysis",
            prompt_version="cause_analysis_single@v1",
            provider="mock",
            model="mock-model",
            latency_ms=1,
            request_payload={"questionId": question_id},
            response_payload={"content": "ok"},
            parsed_output={"ok": True},
            parse_status="ok",
            created_at=created_at,
        )
        session.add(llm_call)
        session.flush()
        session.add(
            AiCauseAnalysisV2(
                user_id=user_id,
                scope="single",
                question_id=question_id,
                input_hash=f"hash-{question_id}-{created_at.timestamp()}",
                result_json={
                    "mode": "single",
                    "summary": "summary",
                    "dimensions": dimensions,
                    "suggested_actions": ["x"],
                    "related_questions": [],
                    "_meta": {"current_confidence": "likely"},
                },
                llm_call_id=llm_call.id,
                version=1,
                created_at=created_at,
                updated_at=created_at,
                expires_at=created_at + timedelta(days=30),
            )
        )
        session.commit()


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_weekly_summary_fallback_and_snapshot_preference(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-WEEKLY-001",
            title="Weekly source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Weekly focus question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        week_start = previous_week_start()
        window_start, _ = week_bounds_utc_from_cn_week_start(week_start)
        created_at = window_start + timedelta(hours=2)
        item_id = _seed_review_item(
            client,
            user_id=user_id,
            question_id=question_id,
            title="Weekly focus question",
            created_at=created_at,
        )
        _seed_attempt(
            client,
            review_item_id=item_id,
            outcome="incorrect",
            attempted_at=created_at + timedelta(hours=1),
            notes_json={"effectiveConfidence": "guess", "userAnswer": "A", "isCorrect": False},
        )
        _seed_attempt(
            client,
            review_item_id=item_id,
            outcome="probation_entered",
            attempted_at=created_at + timedelta(hours=2),
            notes_json={"effectiveConfidence": "likely", "userAnswer": "B", "isCorrect": True},
        )
        factory = _app_factory(client)
        with factory() as session:
            session.add(
                NoteV2(
                    user_id=user_id,
                    title="Weekly note",
                    body="body",
                    linked_question_id=question_id,
                    created_at=created_at + timedelta(hours=3),
                    updated_at=created_at + timedelta(hours=3),
                )
            )
            session.commit()
        _seed_cause_analysis(
            client,
            user_id=user_id,
            question_id=question_id,
            created_at=created_at + timedelta(hours=4),
            dimensions=[{"slug": "concept_confusion", "name_display": "概念混淆", "severity": "high", "suggestion": "x"}],
        )

        week_code = iso_week_code_from_date(week_start)
        fallback = client.get("/api/v2/review/weekly-summary", params={"week": week_code})
        assert fallback.status_code == 200, fallback.text
        payload = fallback.json()
        assert payload["week"] == week_code
        assert payload["itemsReviewed"] == 1
        assert payload["redoAccuracyPct"] == 50.0
        assert payload["newNotesCount"] == 1
        assert payload["newGraduatedCount"] == 0
        assert payload["generatedNoteId"] is None
        assert payload["biggestConcern"]["slug"] == "concept_confusion"

        with factory() as session:
            snapshot, created = write_weekly_snapshot(session, user_id=user_id, week_start_date=week_start)
            session.commit()
            assert created is True
            snapshot_id = snapshot.id
            row = session.get(ReviewWeeklySnapshotV2, snapshot_id)
            assert row is not None
            row.data_json = {
                **row.data_json,
                "nextWeekFocus": "Use the stored snapshot payload.",
            }
            session.add(row)
            session.commit()

        preferred = client.get("/api/v2/review/weekly-summary", params={"week": week_code})
        assert preferred.status_code == 200, preferred.text
        assert preferred.json()["nextWeekFocus"] == "Use the stored snapshot payload."


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_insights_routes_and_effective_slug(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-INSIGHTS-001",
            title="Insights source",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Insights one",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Insights two",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        week_start = previous_week_start()
        window_start, _ = week_bounds_utc_from_cn_week_start(week_start)
        first_item = _seed_review_item(
            client,
            user_id=user_id,
            question_id=question_ids[0],
            title="Insights one",
            created_at=window_start + timedelta(days=1),
        )
        second_item = _seed_review_item(
            client,
            user_id=user_id,
            question_id=question_ids[1],
            title="Insights two",
            created_at=window_start + timedelta(days=2),
            source_kind="manual_add",
        )
        note_card_item = _seed_review_item(
            client,
            user_id=user_id,
            question_id=question_ids[1],
            title="Insights note card",
            created_at=window_start + timedelta(days=2, hours=2),
            source_kind="note_card",
            source_id=901,
        )
        _seed_attempt(
            client,
            review_item_id=first_item,
            outcome="graduated",
            attempted_at=window_start + timedelta(days=2, hours=1),
            notes_json={"effectiveConfidence": "likely", "isCorrect": True},
        )
        _seed_attempt(
            client,
            review_item_id=second_item,
            outcome="probation_entered",
            attempted_at=window_start + timedelta(days=3, hours=1),
            notes_json={"effectiveConfidence": "likely", "isCorrect": True},
        )
        _seed_attempt(
            client,
            review_item_id=note_card_item,
            outcome="archived",
            attempted_at=window_start + timedelta(days=4, hours=1),
            notes_json={},
        )
        _seed_attempt(
            client,
            review_item_id=note_card_item,
            outcome="restored",
            attempted_at=window_start + timedelta(days=5, hours=1),
            notes_json={},
        )
        _seed_cause_analysis(
            client,
            user_id=user_id,
            question_id=question_ids[0],
            created_at=window_start + timedelta(days=2, hours=2),
            dimensions=[
                {
                    "slug": "concept_confusion",
                    "name_display": "概念混淆",
                    "severity": "high",
                    "suggestion": "x",
                    "user_override": {"slug_overridden": "knowledge_gap"},
                }
            ],
        )

        trends = client.get("/api/v2/review/insights/trends")
        assert trends.status_code == 200, trends.text
        days = trends.json()["days"]
        assert any(day["newIncorrect"] >= 1 for day in days)
        assert sum(day["graduated"] for day in days) == 1
        assert days[-1]["netAccumulation"] == 1

        causes = client.get("/api/v2/review/insights/causes")
        assert causes.status_code == 200, causes.text
        assert causes.json()["causes"][0]["slug"] == "knowledge_gap"

        redo_accuracy = client.get("/api/v2/review/insights/redo-accuracy")
        assert redo_accuracy.status_code == 200, redo_accuracy.text
        weeks = redo_accuracy.json()["weeks"]
        assert weeks[0]["totalAttempts"] == 2
        assert weeks[0]["correctCount"] == 2
        assert weeks[0]["accuracyPct"] == 100.0


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_review_audit_and_metrics_cover_archive_restore_and_weekly_snapshot(tmp_path: Path) -> None:
    reset_review_metric_snapshot()
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
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

        factory = _app_factory(client)
        with factory() as session:
            _, created = write_weekly_snapshot(session, user_id=user_id, week_start_date=previous_week_start())
            assert created is True
            session.commit()

        audits = []
        with factory() as session:
            audits = list(session.scalars(select(AuditLogV2).where(AuditLogV2.user_id == user_id)))
        actions = {row.action for row in audits}
        assert "review.item.archived" in actions
        assert "review.item.restored" in actions
        assert "review.item.mark_resolved" in actions or promoted.json()["status"] == "probationary"

        metrics_snapshot = get_review_metric_snapshot()
        assert metrics_snapshot["review_item_archived_total"] >= 1
        assert metrics_snapshot["review_item_restored_total"] >= 1
