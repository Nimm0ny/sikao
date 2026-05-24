from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, cast

from _helpers.practice_content_support import build_client, register_user, seed_completed_session, seed_paper
from sikao_api.db.models_v2 import PracticeSessionAnswerV2, PracticeSessionV2, PracticeStatsSnapshotV2, QuestionV2
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
            overall = next(row for row in stored if row.scope == "overall" and row.type == "xingce")
            assert overall.percentile_rank == 1.0
            assert overall.percentile_updated_at is not None
            incremental_update(session, user_id=user_id, session_id=1)
            session.commit()
            refreshed_questions = list(session.query(QuestionV2).filter(QuestionV2.id.in_(question_ids)).order_by(QuestionV2.id.asc()))
            assert refreshed_questions[0].answer_count == 1
            assert refreshed_questions[0].historical_accuracy == 1.0
            assert refreshed_questions[1].answer_count == 1
            assert refreshed_questions[1].historical_accuracy == 0.0


def test_practice_stats_writer_refreshes_peers_when_bucket_shrinks(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        alpha_id = register_user(client, email="alpha-stats@example.com", display_name="Alpha Stats")
        beta_id = register_user(client, email="beta-stats@example.com", display_name="Beta Stats")
        seed_paper(
            client,
            paper_code="XC-STATS-SHRINK",
            title="Stats Shrink",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        alpha_session_id = seed_completed_session(
            client,
            user_id=alpha_id,
            paper_code="XC-STATS-SHRINK",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True],
        )
        seed_completed_session(
            client,
            user_id=beta_id,
            paper_code="XC-STATS-SHRINK",
            submitted_at=datetime(2026, 5, 23, 10, 0, 0),
            answer_outcomes=[False],
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            recompute_user_stats(session, user_id=alpha_id)
            recompute_user_stats(session, user_id=beta_id)
            session.commit()
            beta_before = session.query(PracticeStatsSnapshotV2).filter_by(
                user_id=beta_id,
                type="xingce",
                scope="category_l1",
                category_key="verbal",
            ).one()
            assert beta_before.percentile_rank == 0.5

            session.query(PracticeSessionAnswerV2).filter_by(session_id=alpha_session_id).delete()
            session.query(PracticeSessionV2).filter_by(id=alpha_session_id).delete()
            recompute_user_stats(session, user_id=alpha_id)
            session.commit()

            beta_after = session.query(PracticeStatsSnapshotV2).filter_by(
                user_id=beta_id,
                type="xingce",
                scope="category_l1",
                category_key="verbal",
            ).one()
            assert beta_after.percentile_rank == 1.0
