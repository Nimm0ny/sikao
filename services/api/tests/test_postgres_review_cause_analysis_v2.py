from __future__ import annotations

import os
from hashlib import sha256
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AiCauseAnalysisV2, AuditLogV2, LlmCallV2, ReviewAttemptV2, ReviewItemV2


def _app_factory(client):  # type: ignore[no-untyped-def]
    app = cast(Any, client.app)
    return app.state.db.session_factory


def _set_item_metadata(client, *, item_id: int, updates: dict[str, Any]) -> None:
    factory = _app_factory(client)
    with factory() as session:
        row = session.get(ReviewItemV2, item_id)
        assert row is not None
        metadata = dict(row.metadata_json)
        metadata.update(updates)
        row.metadata_json = metadata
        session.add(row)
        session.commit()


def _analysis_rows(client) -> list[AiCauseAnalysisV2]:  # type: ignore[no-untyped-def]
    factory = _app_factory(client)
    with factory() as session:
        rows = list(session.scalars(select(AiCauseAnalysisV2).order_by(AiCauseAnalysisV2.id.asc())))
        for row in rows:
            session.expunge(row)
        return rows


def _llm_calls(client) -> list[LlmCallV2]:  # type: ignore[no-untyped-def]
    factory = _app_factory(client)
    with factory() as session:
        rows = list(session.scalars(select(LlmCallV2).order_by(LlmCallV2.id.asc())))
        for row in rows:
            session.expunge(row)
        return rows


def _attempt_rows(client) -> list[ReviewAttemptV2]:  # type: ignore[no-untyped-def]
    factory = _app_factory(client)
    with factory() as session:
        rows = list(session.scalars(select(ReviewAttemptV2).order_by(ReviewAttemptV2.id.asc())))
        for row in rows:
            session.expunge(row)
        return rows


def _audit_rows(client) -> list[AuditLogV2]:  # type: ignore[no-untyped-def]
    factory = _app_factory(client)
    with factory() as session:
        rows = list(session.scalars(select(AuditLogV2).order_by(AuditLogV2.id.asc())))
        for row in rows:
            session.expunge(row)
        return rows


def _single_payload(summary: str = "single summary") -> str:
    return (
        "{"
        f"\"summary\":\"{summary}\","
        "\"dimensions\":[{\"slug\":\"concept_confusion\",\"name_display\":\"概念混淆\",\"severity\":\"high\",\"suggestion\":\"先拆定义再对照题干。\"}],"
        "\"suggested_actions\":[\"整理概念对照表\"],"
        "\"related_questions\":[]"
        "}"
    )


def _group_payload(summary: str = "group summary") -> str:
    return (
        "{"
        f"\"summary\":\"{summary}\","
        "\"dimensions\":[{\"slug\":\"comprehension_unclear\",\"name_display\":\"审题不清\",\"severity\":\"medium\",\"suggestion\":\"先圈限定词再比较选项。\"}],"
        "\"suggested_actions\":[\"先做题干拆解\"],"
        "\"related_questions\":[]"
        "}"
    )


def _deep_payload(summary: str = "deep summary") -> str:
    return (
        "{"
        f"\"summary\":\"{summary}\","
        "\"dimensions\":[{\"slug\":\"concept_confusion\",\"name_display\":\"概念混淆\",\"severity\":\"high\",\"suggestion\":\"先回到概念边界，再做变式题验证。\"}],"
        "\"suggested_actions\":[\"整理高频误判对照表\",\"再做 3 道同类题\"],"
        "\"related_questions\":[]"
        "}"
    )


def _stub_completion(monkeypatch: pytest.MonkeyPatch, *, payload_by_prompt: dict[str, str], calls: list[dict[str, Any]]) -> None:
    async def _fake_call_json_completion(service, *, user_id: int, purpose: str, prompt_version: str, model: str, messages):  # type: ignore[no-untyped-def]
        calls.append(
            {
                "user_id": user_id,
                "purpose": purpose,
                "prompt_version": prompt_version,
                "model": model,
                "messages": [message.content for message in messages],
            }
        )
        return payload_by_prompt[prompt_version], {"prompt_tokens": 111, "completion_tokens": 42}, "mock"

    monkeypatch.setattr(
        "sikao_api.modules.review.application.cause_analysis_execution.call_json_completion",
        _fake_call_json_completion,
    )


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_forced_cause_analysis_caches_and_clears_pending_flag(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_forced@v1": _single_payload("forced summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-001",
            title="Cause single forced",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Forced cause analysis question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "correct_answer": "B",
                    "options": ["A", "B", "C", "D"],
                }
            ],
        )[0]
        created = client.post("/api/v2/review/items", json={"questionId": question_id})
        assert created.status_code == 200, created.text
        item_id = created.json()["id"]
        _set_item_metadata(
            client,
            item_id=item_id,
            updates={
                "forced_cause_analysis_pending": True,
                "forced_reason": "confidence_mismatch",
                "last_answer_hash": sha256(b"A").hexdigest(),
                "last_confidence": "certain",
                "confidence_mismatch_count": 1,
            },
        )

        first = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "forced"},
        )
        assert first.status_code == 200, first.text
        body = first.json()
        assert body["cached"] is False
        assert body["mode"] == "forced"
        assert body["result"]["mode"] == "forced"
        assert body["llmCallId"] > 0
        assert len(calls) == 1
        assert calls[0]["prompt_version"] == "cause_analysis_forced@v1"

        factory = _app_factory(client)
        with factory() as session:
            item = session.get(ReviewItemV2, item_id)
            assert item is not None
            assert item.metadata_json["forced_cause_analysis_pending"] is False

        _set_item_metadata(
            client,
            item_id=item_id,
            updates={"forced_cause_analysis_pending": True, "forced_reason": "confidence_mismatch"},
        )
        second = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "forced"},
        )
        assert second.status_code == 200, second.text
        assert second.json()["cached"] is True
        assert len(calls) == 1
        assert len(_analysis_rows(client)) == 1
        assert len(_llm_calls(client)) == 1
        assert _analysis_rows(client)[0].result_json["_meta"]["current_confidence"] == "certain"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_single_cause_analysis_reuses_db_cache_for_identical_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_single@v1": _single_payload("single cache summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-001B",
            title="Cause single cache",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Single cache question",
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
                "last_answer_hash": sha256(b"C").hexdigest(),
                "last_confidence": "likely",
            },
        )

        first = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert first.status_code == 200, first.text
        assert first.json()["cached"] is False

        second = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert second.status_code == 200, second.text
        assert second.json()["cached"] is True
        assert len(calls) == 1
        assert len(_analysis_rows(client)) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_group_cause_analysis_uses_db_cache(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_group@v1": _group_payload("group cache summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-002",
            title="Cause group",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Group question one",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Group question two",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        first_item = client.post("/api/v2/review/items", json={"questionId": question_ids[0]}).json()["id"]
        second_item = client.post("/api/v2/review/items", json={"questionId": question_ids[1]}).json()["id"]

        first = client.post(
            "/api/v2/review/cause-analysis/group",
            headers={"Idempotency-Key": str(uuid4())},
            json={"itemIds": [first_item, second_item]},
        )
        assert first.status_code == 200, first.text
        assert first.json()["cached"] is False
        assert first.json()["scope"] == "group"
        assert len(calls) == 1

        second = client.post(
            "/api/v2/review/cause-analysis/group",
            headers={"Idempotency-Key": str(uuid4())},
            json={"itemIds": [first_item, second_item]},
        )
        assert second.status_code == 200, second.text
        assert second.json()["cached"] is True
        assert len(calls) == 1
        assert len(_analysis_rows(client)) == 1
        assert len(_llm_calls(client)) == 1

        reversed_order = client.post(
            "/api/v2/review/cause-analysis/group",
            headers={"Idempotency-Key": str(uuid4())},
            json={"itemIds": [second_item, first_item]},
        )
        assert reversed_order.status_code == 200, reversed_order.text
        assert reversed_order.json()["cached"] is True
        assert len(calls) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_single_cause_override_writes_attempt_and_audit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_single@v1": _single_payload("override summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-003",
            title="Cause override",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Override question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        item_id = client.post("/api/v2/review/items", json={"questionId": question_id}).json()["id"]
        response = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert response.status_code == 200, response.text
        analysis_id = response.json()["analysisId"]
        assert len(calls) == 1

        patched = client.patch(
            f"/api/v2/review/cause-analysis/{analysis_id}/dimensions/0",
            json={
                "slug": "knowledge_gap",
                "userSeverity": "medium",
                "userNote": "真正的问题是没学过。",
                "expectedVersion": 1,
            },
        )
        assert patched.status_code == 200, patched.text
        body = patched.json()
        assert body["version"] == 2
        assert body["result"]["dimensions"][0]["slug"] == "knowledge_gap"
        assert body["result"]["dimensions"][0]["userOverride"]["slugOverridden"] == "knowledge_gap"
        assert body["result"]["dimensions"][0]["_llm_original_slug"] == "concept_confusion"

        attempts = _attempt_rows(client)
        assert any(row.outcome == "cause_tag_overridden" for row in attempts)
        audits = _audit_rows(client)
        assert any(row.action == "review.cause_analysis.dimension_overridden" for row in audits)

@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_deep_cause_analysis_for_hard_item_persists_timestamp(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_deep@v1": _deep_payload("deep hard summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-DEEP-001",
            title="Cause deep",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Deep question",
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
                "is_hard": True,
                "re_fail_count": 3,
                "last_answer_hash": sha256(b"D").hexdigest(),
                "last_confidence": "certain",
            },
        )

        response = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["mode"] == "deep"
        assert body["result"]["mode"] == "deep"
        assert calls[0]["prompt_version"] == "cause_analysis_deep@v1"

        factory = _app_factory(client)
        with factory() as session:
            item = session.get(ReviewItemV2, item_id)
            assert item is not None
            first_timestamp = item.metadata_json["last_deep_analysis_at"]
            assert first_timestamp

        cached = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert cached.status_code == 200, cached.text
        assert cached.json()["cached"] is True

        with factory() as session:
            item = session.get(ReviewItemV2, item_id)
            assert item is not None
            assert item.metadata_json["last_deep_analysis_at"] >= first_timestamp


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_forced_cache_miss_when_mismatch_count_changes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_forced@v1": _single_payload("forced cache miss summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-FORCED-MISS",
            title="Cause forced cache miss",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Forced cache miss question",
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
                "forced_cause_analysis_pending": True,
                "forced_reason": "confidence_mismatch",
                "last_answer_hash": sha256(b"A").hexdigest(),
                "last_confidence": "certain",
                "confidence_mismatch_count": 1,
            },
        )

        first = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "forced"},
        )
        assert first.status_code == 200, first.text
        assert len(calls) == 1

        _set_item_metadata(
            client,
            item_id=item_id,
            updates={
                "forced_cause_analysis_pending": True,
                "forced_reason": "confidence_mismatch",
                "confidence_mismatch_count": 2,
            },
        )
        second = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "forced"},
        )
        assert second.status_code == 200, second.text
        assert second.json()["cached"] is False
        assert len(calls) == 2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_deep_cache_miss_when_hard_context_changes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_deep@v1": _deep_payload("deep cache miss summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-DEEP-MISS",
            title="Cause deep cache miss",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Deep cache miss question",
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
                "is_hard": True,
                "re_fail_count": 3,
                "last_answer_hash": sha256(b"deep-1").hexdigest(),
            },
        )

        first = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert first.status_code == 200, first.text
        assert len(calls) == 1

        _set_item_metadata(
            client,
            item_id=item_id,
            updates={"re_fail_count": 4},
        )
        second = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert second.status_code == 200, second.text
        assert second.json()["cached"] is False
        assert len(calls) == 2


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_deep_cache_miss_when_total_wrong_count_changes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_deep@v1": _deep_payload("deep wrong count summary")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-DEEP-WRONG",
            title="Cause deep wrong count",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Deep wrong count question",
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
                "is_hard": True,
                "re_fail_count": 3,
                "last_answer_hash": sha256(b"wrong-count").hexdigest(),
            },
        )

        first = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert first.status_code == 200, first.text
        assert len(calls) == 1

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                ReviewAttemptV2(
                    review_item_id=item_id,
                    outcome="incorrect",
                    notes_json={},
                )
            )
            session.commit()

        second = client.post(
            f"/api/v2/review/items/{item_id}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert second.status_code == 200, second.text
        assert second.json()["cached"] is False
        assert len(calls) == 2


