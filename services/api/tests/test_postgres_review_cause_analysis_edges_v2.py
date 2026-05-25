from __future__ import annotations

from datetime import UTC, datetime
import os
from hashlib import sha256
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import pytest
from sqlalchemy import select

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import CauseTagV2, IdempotencyKeyV2, LlmCallV2, ReviewItemV2, UserV2
from sikao_api.modules.review.application.cause_analysis_cache import invalidate_cause_tag_cache
from sikao_api.modules.review.application.cause_analysis_queries import load_group_items_or_raise
from sikao_api.modules.system.application.errors import ConflictError


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


def _llm_calls(client) -> list[LlmCallV2]:  # type: ignore[no-untyped-def]
    factory = _app_factory(client)
    with factory() as session:
        rows = list(session.scalars(select(LlmCallV2).order_by(LlmCallV2.id.asc())))
        for row in rows:
            session.expunge(row)
        return rows


def _add_llm_calls(client, *, user_id: int, purpose: str, count: int) -> None:  # type: ignore[no-untyped-def]
    factory = _app_factory(client)
    with factory() as session:
        for index in range(count):
            prompt_version = f"{purpose[:24]}@{index}"
            session.add(
                LlmCallV2(
                    user_id=user_id,
                    purpose=purpose,
                    prompt_version=prompt_version,
                    provider="mock",
                    model="mock-model",
                    latency_ms=1,
                    request_payload={},
                    response_payload={"content": "ok"},
                    parsed_output={"ok": True},
                    parse_status="ok",
                )
            )
        session.commit()


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


def _fallback_heavy_payload(summary: str = "fallback summary") -> str:
    return (
        "{"
        f"\"summary\":\"{summary}\","
        "\"dimensions\":["
        "{\"slug\":\"bad_one\",\"name_display\":\"坏一\",\"severity\":\"low\",\"suggestion\":\"s1\"},"
        "{\"slug\":\"bad_two\",\"name_display\":\"坏二\",\"severity\":\"low\",\"suggestion\":\"s2\"},"
        "{\"slug\":\"bad_three\",\"name_display\":\"坏三\",\"severity\":\"low\",\"suggestion\":\"s3\"}"
        "],"
        "\"suggested_actions\":[\"a1\"],"
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
def test_postgres_single_cause_analysis_failure_persists_llm_audit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
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
            paper_code="XC-REVIEW-CAUSE-005",
            title="Cause failure",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Failure question",
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
        assert response.status_code == 503, response.text
        assert response.json()["code"] == "review_cause_analysis_failed"

        listed = client.get("/api/v2/review/items")
        assert listed.status_code == 200, listed.text
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["id"] == item_id

        detail = client.get(f"/api/v2/review/items/{item_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["item"]["id"] == item_id

        calls = _llm_calls(client)
        assert len(calls) == 1
        assert calls[0].purpose == "review_cause_analysis"
        assert calls[0].parse_status == "failed_before_parse"
        assert calls[0].error_class == "TimeoutError"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_single_cause_analysis_enforces_normal_quota_but_forced_is_exempt(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={
            "cause_analysis_single@v1": _single_payload("quota single"),
            "cause_analysis_forced@v1": _single_payload("quota forced"),
        },
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-006",
            title="Cause quota",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Quota single question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Quota forced question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        single_item = client.post("/api/v2/review/items", json={"questionId": question_ids[0]}).json()["id"]
        forced_item = client.post("/api/v2/review/items", json={"questionId": question_ids[1]}).json()["id"]
        _add_llm_calls(client, user_id=user_id, purpose="review_cause_analysis", count=20)
        _set_item_metadata(
            client,
            item_id=forced_item,
            updates={
                "forced_cause_analysis_pending": True,
                "forced_reason": "confidence_mismatch",
                "last_answer_hash": sha256(b"B").hexdigest(),
                "confidence_mismatch_count": 1,
            },
        )

        limited = client.post(
            f"/api/v2/review/items/{single_item}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert limited.status_code == 429, limited.text
        assert limited.json()["code"] == "review_cause_analysis_quota_exceeded"

        allowed = client.post(
            f"/api/v2/review/items/{forced_item}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "forced"},
        )
        assert allowed.status_code == 200, allowed.text
        assert allowed.json()["mode"] == "forced"
        assert len(calls) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_group_cause_analysis_rejects_in_progress_idempotency_claim(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-007",
            title="Cause idempotency",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Idempotency one",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Idempotency two",
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
        idem_key = str(uuid4())
        factory = _app_factory(client)
        with factory() as session:
            session.add(
                IdempotencyKeyV2(
                    key=idem_key,
                    user_id=user_id,
                    endpoint="POST /api/v2/review/cause-analysis/group",
                    request_hash='{"itemIds":[1]}',
                    response_status=202,
                    response_body={"status": "in_progress"},
                    created_at=datetime.now(UTC).replace(tzinfo=None),
                    expires_at=datetime.now(UTC).replace(tzinfo=None),
                )
            )
            session.commit()

        response = client.post(
            "/api/v2/review/cause-analysis/group",
            headers={"Idempotency-Key": idem_key},
            json={"itemIds": [first_item, second_item]},
        )
        assert response.status_code == 409, response.text
        assert response.json()["code"] == "idempotency_key_reused"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_group_cause_analysis_rejects_duplicate_item_ids(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_group@v1": _group_payload("group duplicate ids")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-GROUP-DUP",
            title="Cause group duplicate ids",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Group duplicate ids",
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
            "/api/v2/review/cause-analysis/group",
            headers={"Idempotency-Key": str(uuid4())},
            json={"itemIds": [item_id, item_id]},
        )
        assert response.status_code == 422, response.text
        assert "item_ids must be distinct" in response.text
        assert calls == []


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_query_layer_group_cause_analysis_rejects_duplicate_item_ids(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client, email="dup@example.com", display_name="Dup Owner")
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-GROUP-DUP-Q",
            title="Cause group duplicate ids query",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Group duplicate ids query",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]
        item_id = client.post("/api/v2/review/items", json={"questionId": question_id}).json()["id"]
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            owner = session.scalar(select(UserV2).where(UserV2.display_name == "Dup Owner"))
            assert owner is not None
            with pytest.raises(ConflictError) as excinfo:
                load_group_items_or_raise(session, user=owner, item_ids=[item_id, item_id])
            assert excinfo.value.code == "review_item_duplicate"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_group_override_rejected_and_admin_invalidate_refreshes_tag_cache(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invalidate_cause_tag_cache()
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={
            "cause_analysis_single@v1": _single_payload("single for cache"),
            "cause_analysis_group@v1": _group_payload("group for scope"),
        },
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-004",
            title="Cause invalidate",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Invalidate source one",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Invalidate source two",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        single_item = client.post("/api/v2/review/items", json={"questionId": question_ids[0]}).json()["id"]
        group_item = client.post("/api/v2/review/items", json={"questionId": question_ids[1]}).json()["id"]

        single = client.post(
            f"/api/v2/review/items/{single_item}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert single.status_code == 200, single.text
        single_analysis_id = single.json()["analysisId"]

        group = client.post(
            "/api/v2/review/cause-analysis/group",
            headers={"Idempotency-Key": str(uuid4())},
            json={"itemIds": [single_item, group_item]},
        )
        assert group.status_code == 200, group.text
        group_analysis_id = group.json()["analysisId"]

        group_patch = client.patch(
            f"/api/v2/review/cause-analysis/{group_analysis_id}/dimensions/0",
            json={"slug": "knowledge_gap", "userSeverity": None, "userNote": None, "expectedVersion": 1},
        )
        assert group_patch.status_code == 409, group_patch.text
        assert group_patch.json()["code"] == "cause_analysis_override_scope_invalid"

        factory = _app_factory(client)
        with factory() as session:
            session.add(
                CauseTagV2(
                    slug="custom_new_tag",
                    name="自定义新标签",
                    category="other",
                    severity_default="low",
                    description="runtime inserted for cache invalidation test",
                    display_order=99,
                    is_active=True,
                    taxonomy_version="v2",
                )
            )
            session.commit()

        stale = client.patch(
            f"/api/v2/review/cause-analysis/{single_analysis_id}/dimensions/0",
            json={"slug": "custom_new_tag", "userSeverity": None, "userNote": None, "expectedVersion": 1},
        )
        assert stale.status_code == 422, stale.text
        assert stale.json()["code"] == "cause_tag_invalid"

        invalidated = client.post(
            "/api/v2/admin/review/cause-tags/invalidate-cache",
            auth=("admin", "adminpass"),
        )
        assert invalidated.status_code == 200, invalidated.text
        assert invalidated.json()["status"] == "invalidated"

        refreshed = client.patch(
            f"/api/v2/review/cause-analysis/{single_analysis_id}/dimensions/0",
            json={"slug": "custom_new_tag", "userSeverity": None, "userNote": None, "expectedVersion": 1},
        )
        assert refreshed.status_code == 200, refreshed.text
        assert refreshed.json()["result"]["dimensions"][0]["slug"] == "custom_new_tag"
    invalidate_cause_tag_cache()


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_deep_cause_analysis_requires_hard_item_and_uses_independent_quota(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={
            "cause_analysis_single@v1": _single_payload("single survives deep quota"),
            "cause_analysis_deep@v1": _deep_payload("deep over quota"),
        },
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-DEEP-EDGE",
            title="Cause deep edge",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Deep hard question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "Normal single question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
            ],
        )
        hard_item = client.post("/api/v2/review/items", json={"questionId": question_ids[0]}).json()["id"]
        normal_item = client.post("/api/v2/review/items", json={"questionId": question_ids[1]}).json()["id"]

        not_hard = client.post(
            f"/api/v2/review/items/{normal_item}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert not_hard.status_code == 409, not_hard.text
        assert not_hard.json()["code"] == "review_cause_analysis_mode_invalid"

        _set_item_metadata(
            client,
            item_id=hard_item,
            updates={"is_hard": True, "re_fail_count": 3},
        )
        _add_llm_calls(client, user_id=user_id, purpose="review_cause_analysis_deep", count=5)

        deep_limited = client.post(
            f"/api/v2/review/items/{hard_item}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "deep"},
        )
        assert deep_limited.status_code == 429, deep_limited.text
        assert deep_limited.json()["code"] == "review_cause_analysis_deep_quota_exceeded"

        single_allowed = client.post(
            f"/api/v2/review/items/{normal_item}/cause-analysis",
            headers={"Idempotency-Key": str(uuid4())},
            json={"mode": "single"},
        )
        assert single_allowed.status_code == 200, single_allowed.text
        assert single_allowed.json()["mode"] == "single"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_single_cause_analysis_surfaces_taxonomy_degraded_warning(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []
    _stub_completion(
        monkeypatch,
        payload_by_prompt={"cause_analysis_single@v1": _fallback_heavy_payload("fallback heavy")},
        calls=calls,
    )
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-REVIEW-CAUSE-FALLBACK",
            title="Cause fallback",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Fallback question",
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
        assert response.json()["warningCode"] == "taxonomy_degraded_response"
        assert response.json()["result"]["dimensions"][0]["slug"] == "other"
