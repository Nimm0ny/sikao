from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_completed_session, seed_paper
from sikao_api.db.models_v2 import PracticeStatsSnapshotV2, QuestionV2
from sikao_api.modules.session.application.submit_hooks import run_progress_submit_hooks


def test_practice_stats_submit_hook_recomputes_snapshots(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-STATS-05",
            title="Stats Submit Hook",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        session_id = seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-STATS-05",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True],
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            run_progress_submit_hooks(session, user_id=user_id, session_id=session_id)
            session.commit()
            snapshots = list(session.query(PracticeStatsSnapshotV2).filter_by(user_id=user_id, type="xingce").all())
            assert any(row.scope == "overall" for row in snapshots)
            question = session.query(QuestionV2).filter_by(category_l2="logic_fill").one()
            assert question.answer_count == 1
            assert question.historical_accuracy == 1.0
