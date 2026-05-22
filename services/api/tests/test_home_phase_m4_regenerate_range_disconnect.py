from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import PlanEventV2, UserV2
from sikao_api.modules.llm.application.plan_generator import RegenerateRangeParams
from sikao_api.modules.llm.application.service import HomeLlmService

from _home_phase_m4_support import build_client, seed_active_plan, seed_plan_event


def test_regenerate_range_disconnect_rolls_back_deleted_window(tmp_path: Path) -> None:
    class FakeRequest:
        def __init__(self) -> None:
            self._calls = 0

        async def is_disconnected(self) -> bool:
            self._calls += 1
            return self._calls >= 2

    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Window rollback plan")
            session.add(plan)
            session.flush()
            original = seed_plan_event(user=user, plan_id=plan.id)
            session.add(original)
            session.commit()
            plan_id = plan.id
            original_id = original.id

            service = HomeLlmService(session, app.state.settings)
            request = FakeRequest()
            params = RegenerateRangeParams(
                plan_id=plan_id,
                from_date=datetime(2027, 11, 20).date(),
                to_date=datetime(2027, 11, 21).date(),
                user_notes="disconnect test",
            )

            async def drain() -> None:
                gen = service.regenerate_range_stream(
                    user=user,
                    params=params,
                    idempotency_key="123e4567-e89b-12d3-a456-426614174204",
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
            original = verify.get(PlanEventV2, original_id)
            alive_rows = list(
                verify.scalars(
                    select(PlanEventV2).where(
                        PlanEventV2.plan_id == plan_id,
                        PlanEventV2.deleted_at.is_(None),
                    )
                )
            )
            assert original is not None
            assert original.deleted_at is None
            assert len(alive_rows) == 1
            assert alive_rows[0].id == original_id
        finally:
            verify.close()
