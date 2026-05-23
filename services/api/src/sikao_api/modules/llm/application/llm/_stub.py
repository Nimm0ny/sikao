"""Structured in-process LLM stub used by tests and local dry-run flows."""

from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone

from sikao_api.modules.llm.application.llm.provider import (
    ChatCompletionChunk,
    ChatCompletionResult,
    LLMMessage,
    ResponseFormat,
)

_UTC = timezone.utc

_ESSAY_PAYLOAD: dict[str, object] = {
    "evaluation": {
        "dimensions": [
            {"name": "论点准确", "score": 8.0, "comment": "Thesis stays on topic."},
            {"name": "材料运用", "score": 7.5, "comment": "Uses the provided material."},
            {"name": "语言", "score": 7.0, "comment": "Language is controlled."},
            {"name": "结构", "score": 7.5, "comment": "Sections are ordered logically."},
            {"name": "字数符合度", "score": 9.0, "comment": "Length fits the prompt window."},
        ],
        "strengths": ["clear thesis", "good structure", "material is cited"],
        "weaknesses": ["could deepen evidence", "closing can be sharper"],
        "suggestions": ["add one contrast paragraph", "tighten the final conclusion"],
    },
    "sample_answer": "x" * 950,
}

_QUESTION_AUDIT_PAYLOAD: dict[str, object] = {
    "passed": True,
    "confidence": 0.91,
    "reason": "Answer, stem, and options are internally consistent.",
    "issues": [],
}
_REFERENCE_ANSWER_PAYLOAD: dict[str, object] = {
    "content": "A" * 950,
    "structure_outline": [
        "Opening thesis",
        "Body analysis",
        "Closing summary",
    ],
    "key_points": [
        "Grounded in materials",
        "Clear argument",
        "Complete structure",
    ],
    "estimated_score": 86.0,
}
_REFERENCE_ANSWER_AUDIT_PAYLOAD: dict[str, object] = {
    "passed": True,
    "confidence": 0.93,
    "reason": "Grounded in the materials and structurally sound.",
    "issues": [],
}


class StubLLMProvider:
    """Small structured provider that returns JSON fixtures by feature family."""

    async def chat_completion(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        response_format: ResponseFormat | None = None,
    ) -> ChatCompletionResult:
        del max_tokens, response_format, temperature
        await asyncio.sleep(0.05)
        content = json.dumps(self._build_payload(messages=messages), ensure_ascii=False)
        return ChatCompletionResult(
            content=content,
            prompt_tokens=120,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=120,
            completion_tokens=180,
            model=model,
            finish_reason="stop",
        )

    async def chat_completion_stream(
        self,
        *,
        messages: list[LLMMessage],
        model: str,
        max_tokens: int | None = None,
        temperature: float = 0.7,
        response_format: ResponseFormat | None = None,
    ) -> AsyncIterator[ChatCompletionChunk]:
        del max_tokens, model, response_format, temperature
        await asyncio.sleep(0.02)
        full_content = json.dumps(self._build_payload(messages=messages), ensure_ascii=False)
        yield ChatCompletionChunk(
            content_delta=full_content,
            is_final=False,
            prompt_tokens=None,
            prompt_cache_hit_tokens=None,
            prompt_cache_miss_tokens=None,
            completion_tokens=None,
            finish_reason=None,
        )
        yield ChatCompletionChunk(
            content_delta="",
            is_final=True,
            prompt_tokens=120,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=120,
            completion_tokens=180,
            finish_reason="stop",
        )

    def _build_payload(self, *, messages: list[LLMMessage]) -> dict[str, object]:
        prompt = "\n".join(message.content for message in messages)
        if self._is_reference_answer_self_audit_prompt(prompt):
            return _REFERENCE_ANSWER_AUDIT_PAYLOAD
        if self._is_reference_answer_prompt(prompt):
            return _REFERENCE_ANSWER_PAYLOAD
        if self._is_question_self_audit_prompt(prompt):
            return _QUESTION_AUDIT_PAYLOAD
        if self._is_question_generation_prompt(prompt):
            return self._build_question_generation_payload(prompt)
        if self._is_essay_grading_prompt(prompt):
            return _ESSAY_PAYLOAD
        if "题目质量审核员" in prompt:
            return _QUESTION_AUDIT_PAYLOAD
        if "题目生成器" in prompt:
            return self._build_question_generation_payload(prompt)
        if "plan generator" in prompt.lower() or "generate plan" in prompt.lower():
            return self._build_plan_payload()
        if "plan adjuster" in prompt.lower() or "adjustment proposal" in prompt.lower():
            return self._build_adjustment_payload()
        if "today recommender" in prompt.lower() or "recommendation cards" in prompt.lower():
            return self._build_recommendation_payload()
        return _ESSAY_PAYLOAD

    @staticmethod
    def _is_reference_answer_prompt(prompt: str) -> bool:
        return (
            "structure_outline" in prompt
            and "key_points" in prompt
            and "estimated_score" in prompt
        )

    @staticmethod
    def _is_reference_answer_self_audit_prompt(prompt: str) -> bool:
        return "grounding" in prompt and "coverage" in prompt and "issues" in prompt

    @staticmethod
    def _is_question_generation_prompt(prompt: str) -> bool:
        return (
            "SourceQuestionId:" in prompt
            and "TargetDifficultyRange:" in prompt
            and "options" in prompt.lower()
        )

    @staticmethod
    def _is_question_self_audit_prompt(prompt: str) -> bool:
        return (
            "answer_correctness" in prompt
            and "stem_clarity" in prompt
            and "CorrectAnswer:" in prompt
        )

    @staticmethod
    def _is_essay_grading_prompt(prompt: str) -> bool:
        return (
            "sample_answer" in prompt
            and "evaluation" in prompt
            and "dimensions" in prompt
        )

    def _build_question_generation_payload(self, prompt: str) -> dict[str, object]:
        source_ids = [int(value) for value in re.findall(r"SourceQuestionId:\s*(\d+)", prompt)]
        if not source_ids:
            source_ids = [101]
        count_match = re.search(r"改编生成\s*(\d+)\s*道", prompt)
        count = int(count_match.group(1)) if count_match else min(2, len(source_ids))
        questions: list[dict[str, object]] = []
        for index in range(count):
            source_id = source_ids[index % len(source_ids)]
            question_type = "single_choice" if index % 2 == 0 else "multi_choice"
            correct_answer = "B" if question_type == "single_choice" else "AC"
            questions.append(
                {
                    "source_question_id": source_id,
                    "type": question_type,
                    "stem": f"Stub generated question {index + 1} from source {source_id}.",
                    "options": {
                        "A": "Option A",
                        "B": "Option B",
                        "C": "Option C",
                        "D": "Option D",
                    },
                    "correct_answer": correct_answer,
                    "explanation": (
                        f"Stub explanation for generated question {index + 1} "
                        f"from source {source_id}, detailed enough for parser tests."
                    ),
                    "estimated_difficulty": 0.42,
                }
            )
        return {"questions": questions}

    def _build_plan_payload(self) -> dict[str, object]:
        base = datetime.now(_UTC).replace(second=0, microsecond=0, minute=0)
        first_start = base + timedelta(days=1, hours=10)
        first_end = first_start + timedelta(minutes=90)
        second_start = first_start + timedelta(days=1)
        second_end = second_start + timedelta(minutes=90)
        return {
            "events": [
                {
                    "title": "Xingce verbal drill",
                    "category": "xingce",
                    "subject": "verbal",
                    "start_at": first_start.isoformat(),
                    "end_at": first_end.isoformat(),
                    "notes": "Focus on logic fill-in and passage reading.",
                    "target_id": None,
                },
                {
                    "title": "Essay full answer",
                    "category": "essay",
                    "subject": "essay",
                    "start_at": second_start.isoformat(),
                    "end_at": second_end.isoformat(),
                    "notes": "Write one complete response to the prompt.",
                    "target_id": None,
                },
            ],
            "summary": {
                "total_minutes": 180,
                "events_per_week_avg": 2,
                "review_ratio": 0.0,
                "mock_count": 0,
            },
            "errors": [],
        }

    def _build_adjustment_payload(self) -> dict[str, object]:
        base = datetime.now(_UTC).replace(second=0, microsecond=0, minute=0)
        start_at = base + timedelta(days=2, hours=9)
        end_at = start_at + timedelta(minutes=60)
        return {
            "reason": "Recent skipped review blocks suggest moving one review session to a steadier morning slot.",
            "changes": [
                {
                    "action": "add",
                    "event_id": None,
                    "before": None,
                    "after": {
                        "title": "Review wrong answers",
                        "category": "review",
                        "notes": "Revisit the highest-frequency weak spots from the last three days.",
                        "start_at": start_at.isoformat(),
                        "end_at": end_at.isoformat(),
                        "timezone": "Asia/Shanghai",
                        "status": "planned",
                    },
                    "diff_summary": "Add one morning review block",
                }
            ],
            "skip_reason": None,
        }

    def _build_recommendation_payload(self) -> dict[str, object]:
        return {
            "recommendations": [
                {
                    "title": "Review weak items first",
                    "reason": "Your latest session just ended, so a short review pass has the highest immediate value.",
                    "estimated_minutes": 20,
                    "action_type": "review",
                    "cta": "Review",
                    "payload": {
                        "session_template": {
                            "track": "xingce",
                            "entry_kind": "review",
                            "subject": "verbal",
                        }
                    },
                },
                {
                    "title": "Continue the unfinished session",
                    "reason": "There is still an in-progress practice session, so finishing it beats opening a new task.",
                    "estimated_minutes": 25,
                    "action_type": "continue",
                    "cta": "Continue",
                    "payload": {
                        "session_template": {
                            "track": "xingce",
                            "entry_kind": "manual",
                        }
                    },
                },
                {
                    "title": "Reserve a short recovery block",
                    "reason": "A short break now reduces the chance of skipping the next planned block.",
                    "estimated_minutes": 15,
                    "action_type": "rest",
                    "cta": "Rest",
                    "payload": {"rest_minutes": 15},
                },
            ]
        }
