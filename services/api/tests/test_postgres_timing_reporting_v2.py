from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2, QuestionV2


def _seed_submitted_timing_session(client: TestClient, *, user_id: int, paper_code: str) -> tuple[int, int]:
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
        questions = list(
            session.query(QuestionV2)
            .filter_by(revision_id=revision.id)
            .order_by(QuestionV2.item_no.asc())
        )
        submitted_at = datetime.now(UTC).replace(tzinfo=None)
        practice_session = PracticeSessionV2(
            user_id=user_id,
            track="xingce",
            entry_kind="paper",
            status="submitted",
            paper_id=paper.id,
            revision_id=revision.id,
            payload_json={},
            started_at=submitted_at - timedelta(minutes=5),
            submitted_at=submitted_at,
            practice_mode="full_set",
            source_mode="paper",
            total_active_seconds=90,
        )
        session.add(practice_session)
        session.flush()
        session.add(
            PracticeSessionAnswerV2(
                session_id=practice_session.id,
                question_id=questions[0].id,
                question_key=str(questions[0].id),
                display_order=1,
                response_json={"selected": ["A"]},
                is_correct=True,
                answered_at=submitted_at,
                time_spent_ms=30000,
                answer_change_count=1,
                visit_count=1,
                is_overtime=False,
            )
        )
        session.add(
            QuestionTimingBaselineV2(
                question_id=questions[0].id,
                p50_ms=10000,
                p90_ms=18000,
                p95_ms=20000,
                mean_ms=12000,
                sample_size=40,
            )
        )
        session.commit()
        return practice_session.id, questions[0].id


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_timing_report_and_stats(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-REPORT-PG-001",
            title="Timing Report PG",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        session_id, question_id = _seed_submitted_timing_session(client, user_id=user_id, paper_code="XC-TIMING-REPORT-PG-001")

        baseline = client.get(f"/api/v2/practice/questions/{question_id}/timing-baseline")
        assert baseline.status_code == 200, baseline.text
        report = client.get(f"/api/v2/practice/sessions/{session_id}/timing-report")
        assert report.status_code == 200, report.text
        stats = client.get("/api/v2/practice/stats/timing?type=xingce&period=30d&category=verbal")
        assert stats.status_code == 200, stats.text
        assert stats.json()["overall"]["totalMinutes"] == 0

        invalid_period = client.get("/api/v2/practice/stats/timing?type=xingce&period=365d")
        assert invalid_period.status_code == 422, invalid_period.text

        created = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-TIMING-REPORT-PG-001"},
        )
        assert created.status_code == 200, created.text
        blocked_report = client.get(f"/api/v2/practice/sessions/{created.json()['id']}/timing-report")
        assert blocked_report.status_code == 409, blocked_report.text
        assert blocked_report.json()["code"] == "SESSION_NOT_WRITABLE"


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_timing_stats_exclude_daily(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-DAILY-PG-001",
            title="Timing Daily PG",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        session_id, _question_id = _seed_submitted_timing_session(
            client,
            user_id=user_id,
            paper_code="XC-TIMING-DAILY-PG-001",
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            daily_session = session.get(PracticeSessionV2, session_id)
            assert daily_session is not None
            daily_session.source_mode = "daily"
            session.add(daily_session)
            session.commit()

        stats = client.get("/api/v2/practice/stats/timing?type=xingce&period=30d&category=verbal")
        assert stats.status_code == 200, stats.text
        assert stats.json()["overall"]["totalMinutes"] == 0
