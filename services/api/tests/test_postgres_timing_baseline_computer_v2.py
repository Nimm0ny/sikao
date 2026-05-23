from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2, QuestionV2
from sikao_api.modules.timing.application.baseline_computer import recompute_question_timing_baseline


def _seed_samples(client: TestClient, *, user_id: int, paper_code: str, samples: list[int], submitted_at: datetime) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        paper = session.query(PaperV2).filter_by(paper_code=paper_code).one()
        revision = (
            session.query(PaperRevisionV2)
            .filter_by(paper_id=paper.id, status="published")
            .order_by(PaperRevisionV2.revision_number.desc())
            .one()
        )
        question = (
            session.query(QuestionV2)
            .filter_by(revision_id=revision.id)
            .order_by(QuestionV2.item_no.asc())
            .first()
        )
        assert question is not None
        for offset, sample in enumerate(samples):
            practice_session = PracticeSessionV2(
                user_id=user_id,
                track="xingce",
                entry_kind="paper",
                status="submitted",
                paper_id=paper.id,
                revision_id=revision.id,
                payload_json={},
                started_at=submitted_at - timedelta(minutes=5, seconds=offset),
                submitted_at=submitted_at - timedelta(seconds=offset),
                practice_mode="full_set",
                source_mode="paper",
            )
            session.add(practice_session)
            session.flush()
            session.add(
                PracticeSessionAnswerV2(
                    session_id=practice_session.id,
                    question_id=question.id,
                    question_key=str(question.id),
                    display_order=1,
                    response_json={"selected": ["A"]},
                    is_correct=True,
                    answered_at=submitted_at - timedelta(seconds=offset),
                    time_spent_ms=sample,
                )
            )
        session.commit()


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_recompute_question_timing_baseline(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-BASE-PG-001",
            title="Timing Baseline PG",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        now = datetime.now(UTC).replace(tzinfo=None)
        _seed_samples(client, user_id=user_id, paper_code="XC-TIMING-BASE-PG-001", samples=[20000] * 31, submitted_at=now)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            updated = recompute_question_timing_baseline(session, now=now)
            session.commit()
            baseline = session.query(QuestionTimingBaselineV2).one()
            assert updated == 1
            assert baseline.sample_size == 31
            assert baseline.p95_ms == 20000


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_recompute_question_timing_baseline_clears_stale_rows(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-BASE-PG-002",
            title="Timing Baseline PG Rerun",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        now = datetime.now(UTC).replace(tzinfo=None)
        _seed_samples(client, user_id=user_id, paper_code="XC-TIMING-BASE-PG-002", samples=[20000] * 31, submitted_at=now)

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            assert recompute_question_timing_baseline(session, now=now) == 1
            session.commit()
            sessions = list(session.query(PracticeSessionV2).all())
            for practice_session in sessions:
                practice_session.submitted_at = now - timedelta(days=91)
                session.add(practice_session)
            session.commit()

        with factory() as session:
            assert recompute_question_timing_baseline(session, now=now) == 0
            session.commit()
            assert session.query(QuestionTimingBaselineV2).count() == 0
