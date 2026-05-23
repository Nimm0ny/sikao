from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import PaperRevisionV2, PaperV2, PracticeSessionAnswerV2, PracticeSessionV2, QuestionTimingBaselineV2, QuestionV2


def _seed_submitted_timing_session(
    client: TestClient,
    *,
    user_id: int,
    paper_code: str,
    submitted_at: datetime,
    first_time_ms: int,
    second_time_ms: int,
) -> tuple[int, int, int]:
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
            paused_total_seconds=30,
        )
        session.add(practice_session)
        session.flush()
        answer_one = PracticeSessionAnswerV2(
            session_id=practice_session.id,
            question_id=questions[0].id,
            question_key=str(questions[0].id),
            display_order=1,
            response_json={"selected": ["A"]},
            is_correct=True,
            answered_at=submitted_at,
            time_spent_ms=first_time_ms,
            answer_change_count=1,
            visit_count=2,
            is_overtime=False,
        )
        answer_two = PracticeSessionAnswerV2(
            session_id=practice_session.id,
            question_id=questions[1].id,
            question_key=str(questions[1].id),
            display_order=2,
            response_json={"selected": ["B"]},
            is_correct=False,
            answered_at=submitted_at,
            time_spent_ms=second_time_ms,
            answer_change_count=3,
            visit_count=1,
            is_overtime=True,
        )
        session.add_all([answer_one, answer_two])
        session.add_all(
            [
                QuestionTimingBaselineV2(
                    question_id=questions[0].id,
                    p50_ms=10000,
                    p90_ms=18000,
                    p95_ms=20000,
                    mean_ms=12000,
                    sample_size=40,
                ),
                QuestionTimingBaselineV2(
                    question_id=questions[1].id,
                    p50_ms=20000,
                    p90_ms=28000,
                    p95_ms=30000,
                    mean_ms=24000,
                    sample_size=40,
                ),
            ]
        )
        session.commit()
        return practice_session.id, questions[0].id, questions[1].id


def test_timing_report_and_baseline_endpoints(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-REPORT-001",
            title="Timing Report",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        session_id, first_question_id, second_question_id = _seed_submitted_timing_session(
            client,
            user_id=user_id,
            paper_code="XC-TIMING-REPORT-001",
            submitted_at=datetime.now(UTC).replace(tzinfo=None),
            first_time_ms=30000,
            second_time_ms=60000,
        )

        baseline = client.get(f"/api/v2/practice/questions/{first_question_id}/timing-baseline")
        assert baseline.status_code == 200, baseline.text
        assert baseline.json()["p95Ms"] == 20000

        report = client.get(f"/api/v2/practice/sessions/{session_id}/timing-report")
        assert report.status_code == 200, report.text
        payload = report.json()
        assert payload["totalActiveSeconds"] == 90
        assert payload["pausedTotalSeconds"] == 30
        assert payload["summary"]["overtimeCount"] == 1
        assert payload["summary"]["fastestAnswerId"] == payload["questions"][0]["answerId"]
        assert payload["summary"]["slowestAnswerId"] == payload["questions"][1]["answerId"]
        assert payload["summary"]["mostChangedAnswerId"] == payload["questions"][1]["answerId"]
        assert payload["questions"][0]["baselineP95Ms"] == 20000
        assert payload["questions"][1]["baselineP95Ms"] == 30000

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            baseline_row = session.get(QuestionTimingBaselineV2, first_question_id)
            assert baseline_row is not None
            baseline_row.p50_ms = 1
            baseline_row.p90_ms = 1
            baseline_row.p95_ms = 1
            baseline_row.mean_ms = 1
            baseline_row.sample_size = 10
            session.add(baseline_row)
            session.commit()
        insufficient = client.get(f"/api/v2/practice/questions/{first_question_id}/timing-baseline")
        assert insufficient.status_code == 404, insufficient.text
        assert insufficient.json()["code"] == "BASELINE_INSUFFICIENT"


def test_timing_stats_endpoint(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-STATS-001",
            title="Timing Stats",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill", "historical_accuracy": 0.2},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading", "historical_accuracy": 0.8},
            ],
        )
        _seed_submitted_timing_session(
            client,
            user_id=user_id,
            paper_code="XC-TIMING-STATS-001",
            submitted_at=datetime.now(UTC).replace(tzinfo=None),
            first_time_ms=30000,
            second_time_ms=60000,
        )

        response = client.get("/api/v2/practice/stats/timing?type=xingce&period=30d&category=verbal")
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["overall"]["totalMinutes"] == 2
        assert payload["overall"]["avgSecondsPerQuestion"] == 45.0
        assert payload["overall"]["vsBaselineRatio"] == 2.5
        assert payload["byCategoryL1"][0]["category"] == "verbal"
        assert {item["difficultyBucket"] for item in payload["byDifficulty"]} == {"easy", "hard"}
        assert payload["overtimeQuestions"]["count"] == 1
        assert payload["pacingPattern"] in {"steady", "fast_start_slow_end", "slow_start_fast_end", "irregular"}


def test_timing_stats_exclude_daily_and_invalid_period_and_non_submitted_report(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-TIMING-DAILY-001",
            title="Timing Daily",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill", "historical_accuracy": 0.2},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading", "historical_accuracy": 0.8},
            ],
        )
        daily_session_id, _, _ = _seed_submitted_timing_session(
            client,
            user_id=user_id,
            paper_code="XC-TIMING-DAILY-001",
            submitted_at=datetime.now(UTC).replace(tzinfo=None),
            first_time_ms=60000,
            second_time_ms=60000,
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            daily_session = session.get(PracticeSessionV2, daily_session_id)
            assert daily_session is not None
            daily_session.source_mode = "daily"
            session.add(daily_session)
            session.commit()

        stats = client.get("/api/v2/practice/stats/timing?type=xingce&period=30d&category=verbal")
        assert stats.status_code == 200, stats.text
        assert stats.json()["overall"]["totalMinutes"] == 0

        invalid_period = client.get("/api/v2/practice/stats/timing?type=xingce&period=365d")
        assert invalid_period.status_code == 422, invalid_period.text

        created = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "paper", "paperCode": "XC-TIMING-DAILY-001"},
        )
        assert created.status_code == 200, created.text
        report = client.get(f"/api/v2/practice/sessions/{created.json()['id']}/timing-report")
        assert report.status_code == 409, report.text
        assert report.json()["code"] == "SESSION_NOT_WRITABLE"
