from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_completed_session, seed_paper
from sikao_api.db.models_v2 import PracticeStatsSnapshotV2, QuestionV2
from sikao_api.modules.practice_stats.application.snapshot_writer import incremental_update, recompute_user_stats


def test_practice_stats_writer_persists_snapshots_and_question_metrics(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-STATS-02",
            title="Stats Writer",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-STATS-02",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True, False],
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            rows = recompute_user_stats(session, user_id=user_id)
            session.commit()
            assert any(row.scope == "overall" and row.type == "xingce" for row in rows)
            stored = list(session.query(PracticeStatsSnapshotV2).filter_by(user_id=user_id).all())
            assert any(row.scope == "category_l2" for row in stored)
            incremental_update(session, user_id=user_id, session_id=1)
            session.commit()
            refreshed_questions = list(session.query(QuestionV2).filter(QuestionV2.id.in_(question_ids)).order_by(QuestionV2.id.asc()))
            assert refreshed_questions[0].answer_count == 1
            assert refreshed_questions[0].historical_accuracy == 1.0
            assert refreshed_questions[1].answer_count == 1
            assert refreshed_questions[1].historical_accuracy == 0.0
