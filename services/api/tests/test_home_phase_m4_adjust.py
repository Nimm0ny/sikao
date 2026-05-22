from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import select

from sikao_api.db.models_v2 import PlanAdjustmentV2, UserV2
from sikao_api.modules.llm.application.plan_adjustor import PlanAdjustmentContext
from sikao_api.modules.llm.application.service import HomeLlmService

from _home_phase_m4_support import build_client, seed_active_plan


def test_adjust_plan_creates_pending_adjustment(tmp_path: Path) -> None:
    with build_client(tmp_path) as (_client, app):
        session = app.state.db.session_factory()
        try:
            user = UserV2(display_name="Alice")
            session.add(user)
            session.flush()
            plan = seed_active_plan(user=user, name="Adjust plan")
            session.add(plan)
            session.commit()

            service = HomeLlmService(session, app.state.settings)
            adjustment = asyncio.run(
                service.adjust_plan(
                    user=user,
                    context=PlanAdjustmentContext(
                        plan_id=plan.id,
                        source="login_check",
                        payload={"future_events": [], "reason": "dry-run"},
                    ),
                )
            )
            session.commit()

            assert adjustment is not None
            stored = session.scalar(select(PlanAdjustmentV2).where(PlanAdjustmentV2.id == adjustment.id))
            assert stored is not None
            assert stored.status == "pending"
            assert stored.llm_call_id is not None
        finally:
            session.close()
