"""Manual dry-run smoke helper for Home LLM flows."""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import UserV2
from sikao_api.db.session import DatabaseManager
from sikao_api.modules.llm.application.plan_generator import (
    PlanGenerateParams,
    build_generate_messages,
    parse_generated_plan,
)
from sikao_api.modules.llm.application.recommender import (
    RecommendationContext,
    build_recommendation_messages,
    parse_recommendations,
)
from sikao_api.modules.llm.application.llm import build_llm_provider


async def _run_plan_generate(settings: Settings, session: Any) -> int:
    user = session.scalar(select(UserV2).order_by(UserV2.id.asc()))
    if user is None:
        raise SystemExit("No users_v2 row found for llm_smoke.")
    params = PlanGenerateParams(
        name="Smoke generated plan",
        target_exam_id="smoke-exam",
        target_exam_date=date.today() + timedelta(days=30),
        daily_minutes_target=180,
        style="balanced",
        focus_subjects=["xingce"],
        baseline={},
        user_notes="dry run only",
    )
    provider, _label = build_llm_provider(settings, db=session, user_id=user.id)
    messages = build_generate_messages(params=params, today=date.today(), timezone="Asia/Shanghai")
    result = await provider.chat_completion(
        messages=messages,
        model=settings.llm_model_study_plan,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
    )
    parsed = parse_generated_plan(result.content)
    print(
        json.dumps(
            {
                "messages": [message.__dict__ for message in messages],
                "raw": result.content,
                "parsed": parsed.model_dump(mode="json"),
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
            },
            ensure_ascii=False,
        )
    )
    return 0 if parsed.events else 1


async def _run_recommend_today(settings: Settings, session: Any) -> int:
    user = session.scalar(select(UserV2).order_by(UserV2.id.asc()))
    if user is None:
        raise SystemExit("No users_v2 row found for llm_smoke.")
    provider, _label = build_llm_provider(settings, db=session, user_id=user.id)
    context = RecommendationContext(payload={"signals": {"submitted_sessions_7d": 1}})
    messages = build_recommendation_messages(context=context)
    result = await provider.chat_completion(
        messages=messages,
        model=settings.llm_model_study_plan,
        max_tokens=settings.llm_max_tokens,
        temperature=settings.llm_temperature,
    )
    parsed = parse_recommendations(result.content)
    print(
        json.dumps(
            {
                "messages": [message.__dict__ for message in messages],
                "raw": result.content,
                "parsed": parsed.model_dump(mode="json"),
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
            },
            ensure_ascii=False,
        )
    )
    return 0 if parsed.recommendations else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="llm_smoke")
    parser.add_argument("mode", choices=["plan_generate", "recommend_today"])
    args = parser.parse_args(argv)
    settings = Settings()
    db = DatabaseManager(settings)
    session = db.session_factory()
    try:
        if args.mode == "plan_generate":
            return asyncio.run(_run_plan_generate(settings, session))
        return asyncio.run(_run_recommend_today(settings, session))
    finally:
        session.close()
