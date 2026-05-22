from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import IdempotencyKeyV2, LlmCallV2, PlanV2, UserV2
from sikao_api.modules.llm.application.plan_generator import PlanGenerateParams
from sikao_api.modules.llm.application.service import HomeLlmService

from _home_phase_m4_support import build_client


def test_stream_disconnect_rolls_back_generated_plan(tmp_path: Path) -> None:
    class FakeRequest:
        def __init__(self) -> None:
            self._calls = 0

        async def is_disconnected(self) -> bool:
            self._calls += 1
            return self._calls >= 3

    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.commit()

            service = HomeLlmService(session, app.state.settings)
            request = FakeRequest()
            params = PlanGenerateParams(
                name="Rollback plan",
                target_exam_id="guokao-2027",
                target_exam_date=datetime(2027, 11, 26).date(),
                daily_minutes_target=180,
                style="balanced",
                focus_subjects=["xingce"],
                baseline={},
                user_notes="disconnect test",
            )

            async def drain() -> None:
                gen = service.generate_plan_stream(
                    user=user,
                    params=params,
                    idempotency_key="123e4567-e89b-12d3-a456-426614174201",
                    request_id="disconnect-test",
                    ip=None,
                )
                async for _chunk in __import__(
                    "sikao_api.modules.plans.interface.routes", fromlist=["_stream_home_llm_frames"]
                )._stream_home_llm_frames(request=request, session=session, frames=gen):
                    pass

            asyncio.run(drain())
        finally:
            session.close()

        verify = app.state.db.session_factory()
        try:
            plan = verify.scalar(select(PlanV2).where(PlanV2.name == "Rollback plan"))
            idem = verify.scalar(
                select(IdempotencyKeyV2).where(
                    IdempotencyKeyV2.key == "123e4567-e89b-12d3-a456-426614174201"
                )
            )
            calls = list(verify.scalars(select(LlmCallV2).where(LlmCallV2.purpose == "plan_generate")))
            assert plan is None
            assert idem is None
            assert len(calls) == 1
            assert calls[0].parse_status == "client_disconnected"
        finally:
            verify.close()


def test_stream_aclose_cleans_idempotency_without_committing_plan(tmp_path: Path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.commit()

            service = HomeLlmService(session, app.state.settings)
            params = PlanGenerateParams(
                name="Aclose plan",
                target_exam_id="guokao-2027",
                target_exam_date=datetime(2027, 11, 26).date(),
                daily_minutes_target=180,
                style="balanced",
                focus_subjects=["xingce"],
                baseline={},
                user_notes="aclose test",
            )

            async def abort_mid_stream() -> None:
                gen = service.generate_plan_stream(
                    user=user,
                    params=params,
                    idempotency_key="123e4567-e89b-12d3-a456-426614174205",
                    request_id="aclose-test",
                    ip=None,
                )
                await gen.__anext__()
                await gen.aclose()
                session.rollback()

            asyncio.run(abort_mid_stream())
        finally:
            session.close()

        verify = app.state.db.session_factory()
        try:
            plan = verify.scalar(select(PlanV2).where(PlanV2.name == "Aclose plan"))
            idem = verify.scalar(
                select(IdempotencyKeyV2).where(
                    IdempotencyKeyV2.key == "123e4567-e89b-12d3-a456-426614174205"
                )
            )
            calls = list(verify.scalars(select(LlmCallV2).where(LlmCallV2.purpose == "plan_generate")))
            assert plan is None
            assert idem is None
            assert len(calls) == 1
            assert calls[0].parse_status == "client_disconnected"
        finally:
            verify.close()
