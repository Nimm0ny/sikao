"""Slice 3a · 学习计划 Pydantic schema 单测 (commit 1 / TDD RED→GREEN).

不依赖 service / DB / LLM mock — 纯 schema 层 ValidationError 路径覆盖.
对应 docs/plan/slice-3a-study-plan-be.md §6.3 Stage 1 + §4.3 outer
discriminated union narrow 行为. 后续 commit 2 service-level tests + commit 3
route-integration tests 单独建.

Stage 1 sanity 全 5 条:
  1. tasks 数量 ∈ [1, 5]
  2. task_kind 仅 3 类 (study_concept 砍掉 — D1)
  3. payload extra='forbid' 拒多余字段
  4. title ≤30 / subtitle ≤60 字符
  5. display_order ≥ 0

Outer discriminated union narrow:
  - 反向 narrow via TypeAdapter (DB row → Response)
  - LLM 输出 wrapper (StudyPlanLLMOutput) 同样 outer union narrow
"""

from __future__ import annotations

import pytest
from pydantic import TypeAdapter, ValidationError

from sikao_api.db.schemas import (
    EssayWritingLLMTask,
    EssayWritingTaskPayload,
    EssayWritingTaskResponse,
    PracticeLLMTask,
    PracticeTaskPayload,
    PracticeTaskResponse,
    ReviewWrongLLMTask,
    ReviewWrongTaskPayload,
    ReviewWrongTaskResponse,
    StudyLLMTaskUnion,
    StudyPlanLLMOutput,
    StudyTaskResponse,
)

# ─── Stage 1 #1: tasks count ∈ [1, 5] ────────────────────────────────────


def test_llm_output_tasks_empty_rejected() -> None:
    """LLM 输出 tasks=[] → ValidationError (测试 19, P1-new-1)."""
    with pytest.raises(ValidationError) as exc_info:
        StudyPlanLLMOutput.model_validate({"tasks": []})
    assert "at least 1" in str(exc_info.value).lower()


def test_llm_output_tasks_too_many_rejected() -> None:
    """6 个 task 超 max_length=5 → reject."""
    payload = {"paperCode": "P-1", "title": "t"}
    task = {"taskKind": "practice", "payload": payload, "displayOrder": 0}
    with pytest.raises(ValidationError):
        StudyPlanLLMOutput.model_validate({"tasks": [task] * 6})


# ─── Stage 1 #2: task_kind 仅 3 类 (D1 砍 study_concept) ─────────────────


def test_llm_output_rejects_study_concept_task_kind() -> None:
    """D1 砍掉 study_concept; LLM 可能"记得"老 spec 输出, schema 必须拒
    (测试 6 防回归)."""
    bad_task = {
        "taskKind": "study_concept",
        "payload": {"title": "x", "questionIds": [1]},
        "displayOrder": 0,
    }
    with pytest.raises(ValidationError) as exc_info:
        StudyPlanLLMOutput.model_validate({"tasks": [bad_task]})
    err = str(exc_info.value)
    # discriminator error 提示有效值 (3 类) 不含 study_concept
    assert "study_concept" in err or "discriminator" in err.lower()


def test_llm_output_rejects_arbitrary_task_kind() -> None:
    bad_task = {
        "taskKind": "free_writing",  # 完全不存在
        "payload": {"title": "x"},
        "displayOrder": 0,
    }
    with pytest.raises(ValidationError):
        StudyPlanLLMOutput.model_validate({"tasks": [bad_task]})


# ─── Stage 1 #3: payload extra='forbid' ──────────────────────────────────


def test_practice_payload_extra_forbidden() -> None:
    """LLM 多塞字段 → ValidationError (extra='forbid')."""
    with pytest.raises(ValidationError):
        PracticeTaskPayload.model_validate(
            {
                "paperCode": "P-1",
                "title": "t",
                "extraField": "should reject",
            }
        )


def test_review_wrong_payload_extra_forbidden() -> None:
    with pytest.raises(ValidationError):
        ReviewWrongTaskPayload.model_validate(
            {
                "questionIds": [1, 2],
                "title": "t",
                "junk": True,
            }
        )


# ─── Stage 1 #4: title/subtitle 长度上限 ─────────────────────────────────


def test_title_too_long_rejected() -> None:
    """title > 30 字符 reject."""
    with pytest.raises(ValidationError):
        PracticeTaskPayload.model_validate(
            {"paperCode": "P-1", "title": "x" * 31}
        )


def test_subtitle_too_long_rejected() -> None:
    """subtitle > 60 字符 reject."""
    with pytest.raises(ValidationError):
        PracticeTaskPayload.model_validate(
            {"paperCode": "P-1", "title": "ok", "subtitle": "y" * 61}
        )


def test_title_empty_rejected() -> None:
    """title min_length=1 — 空字符串 reject."""
    with pytest.raises(ValidationError):
        PracticeTaskPayload.model_validate({"paperCode": "P-1", "title": ""})


# ─── Stage 1 #5: display_order ≥ 0 ───────────────────────────────────────


def test_display_order_negative_rejected() -> None:
    bad_task = {
        "taskKind": "practice",
        "payload": {"paperCode": "P-1", "title": "t"},
        "displayOrder": -1,
    }
    with pytest.raises(ValidationError):
        StudyPlanLLMOutput.model_validate({"tasks": [bad_task]})


# ─── Payload-specific 必填字段 ────────────────────────────────────────────


def test_practice_payload_paper_code_required() -> None:
    with pytest.raises(ValidationError):
        PracticeTaskPayload.model_validate({"title": "t"})


def test_review_wrong_payload_question_ids_min_length() -> None:
    """review_wrong questionIds 至少 1 个 (空 list reject)."""
    with pytest.raises(ValidationError):
        ReviewWrongTaskPayload.model_validate(
            {"questionIds": [], "title": "t"}
        )


def test_essay_writing_payload_question_id_must_positive() -> None:
    """questionId gt=0."""
    with pytest.raises(ValidationError):
        EssayWritingTaskPayload.model_validate(
            {"paperCode": "P-1", "questionId": 0, "title": "t"}
        )


# ─── Outer discriminated union narrow ────────────────────────────────────


def test_llm_task_union_narrow_to_practice() -> None:
    """LLM 侧 union: task_kind='practice' 自动 narrow PracticeLLMTask."""
    adapter = TypeAdapter(StudyLLMTaskUnion)
    task = adapter.validate_python(
        {
            "taskKind": "practice",
            "payload": {
                "paperCode": "FENBI-7274732",
                "questionIds": [7841, 7842],
                "title": "做 3 道题",
            },
            "displayOrder": 0,
        }
    )
    assert isinstance(task, PracticeLLMTask)
    assert task.payload.paper_code == "FENBI-7274732"


def test_llm_task_union_narrow_to_review_wrong() -> None:
    adapter = TypeAdapter(StudyLLMTaskUnion)
    task = adapter.validate_python(
        {
            "taskKind": "review_wrong",
            "payload": {"questionIds": [101], "title": "复习"},
            "displayOrder": 1,
        }
    )
    assert isinstance(task, ReviewWrongLLMTask)


def test_llm_task_union_narrow_to_essay_writing() -> None:
    adapter = TypeAdapter(StudyLLMTaskUnion)
    task = adapter.validate_python(
        {
            "taskKind": "essay_writing",
            "payload": {
                "paperCode": "ESSAY-X",
                "questionId": 555,
                "title": "试一题",
            },
            "displayOrder": 2,
        }
    )
    assert isinstance(task, EssayWritingLLMTask)


# ─── Response 侧 union (反向 narrow: DB row → Response) ──────────────────


def test_response_union_narrow_practice_via_type_adapter() -> None:
    """plan §4.3 反向 narrow 用法 — service 层从 DB row 组 response 时
    用 TypeAdapter(StudyTaskResponse).validate_python 自动按 task_kind narrow."""
    adapter = TypeAdapter(StudyTaskResponse)
    row_dict = {
        "id": 42,
        "taskKind": "practice",
        "payload": {
            "paperCode": "FENBI-7274732",
            "questionIds": [7841, 7842, 7844],
            "title": "先做 3 道行测题",
            "subtitle": "言语 / 常识 各 1 道, 不计时, 认识题型即可",
        },
        "displayOrder": 0,
        "status": "pending",
        "completedAt": None,
        "createdAt": "2026-04-29T12:00:00Z",
    }
    resp = adapter.validate_python(row_dict)
    assert isinstance(resp, PracticeTaskResponse)
    assert resp.id == 42
    assert resp.payload.title == "先做 3 道行测题"


def test_response_union_narrow_review_wrong() -> None:
    adapter = TypeAdapter(StudyTaskResponse)
    resp = adapter.validate_python(
        {
            "id": 7,
            "taskKind": "review_wrong",
            "payload": {"questionIds": [99], "title": "复习"},
            "displayOrder": 0,
            "status": "completed",
            "completedAt": "2026-04-29T13:00:00Z",
            "createdAt": "2026-04-29T12:00:00Z",
        }
    )
    assert isinstance(resp, ReviewWrongTaskResponse)
    assert resp.status == "completed"


# ─── P2-5 (Commit 1 review 补) ─────────────────────────────────────────────


def test_subtitle_default_none() -> None:
    """subtitle 不传 → 默认 None (Pydantic Field default)."""
    payload = PracticeTaskPayload.model_validate(
        {"paperCode": "P-1", "title": "ok"}
    )
    assert payload.subtitle is None


def test_display_order_zero_accepted() -> None:
    """ge=0 边界: display_order=0 应该过 (跟 -1 reject 互补)."""
    task = PracticeLLMTask.model_validate(
        {
            "taskKind": "practice",
            "payload": {"paperCode": "P-1", "title": "ok"},
            "displayOrder": 0,
        }
    )
    assert task.display_order == 0


def test_task_kind_missing_rejected() -> None:
    """LLM 输出忘填 task_kind → discriminator 报错."""
    bad_task = {
        "payload": {"paperCode": "P-1", "title": "t"},
        "displayOrder": 0,
    }
    with pytest.raises(ValidationError) as exc_info:
        StudyPlanLLMOutput.model_validate({"tasks": [bad_task]})
    err = str(exc_info.value).lower()
    assert "task" in err and ("discriminator" in err or "tag" in err or "missing" in err)


def test_payload_serialize_camelcase() -> None:
    """model_dump(by_alias=True) 输出 camelCase 字段名 — FE openapi-typescript
    regen 拿到 camelCase 接 frontend convention. CamelModel.model_dump 默认 by_alias.
    """
    task = PracticeLLMTask.model_validate(
        {
            "taskKind": "practice",
            "payload": {
                "paperCode": "FENBI-7274732",
                "questionIds": [7841],
                "title": "做 1 题",
            },
            "displayOrder": 0,
        }
    )
    dumped = task.model_dump()  # CamelModel 默认 by_alias=True
    assert dumped["taskKind"] == "practice"
    assert dumped["displayOrder"] == 0
    assert dumped["payload"]["paperCode"] == "FENBI-7274732"
    assert dumped["payload"]["questionIds"] == [7841]


def test_response_union_narrow_essay_writing() -> None:
    adapter = TypeAdapter(StudyTaskResponse)
    resp = adapter.validate_python(
        {
            "id": 8,
            "taskKind": "essay_writing",
            "payload": {"paperCode": "ESSAY-Y", "questionId": 1, "title": "写"},
            "displayOrder": 0,
            "status": "skipped",
            "completedAt": None,
            "createdAt": "2026-04-29T12:00:00Z",
        }
    )
    assert isinstance(resp, EssayWritingTaskResponse)
    assert resp.status == "skipped"
