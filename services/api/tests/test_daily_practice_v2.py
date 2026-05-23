from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from sqlalchemy import select

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import DailyPracticeV2, EssayReportV2, EssaySubmissionV2, PracticeSessionV2, PracticeStatsSnapshotV2, QuestionV2, UserPracticePreferencesV2
from sikao_api.db.schemas_v2 import PracticePreferencesPayloadV1
from sikao_api.modules.daily_practice.application.service import _pick_real_exam_questions
from sikao_api.modules.progress.application.aggregates import today_cn


def _seed_preferences(
    client,
    *,
    user_id: int,
    count: int,
    source_mode: str = "real_exam",
) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        payload_model = PracticePreferencesPayloadV1()
        payload_model.custom_practice.last_used_count = count
        payload_model.custom_practice.last_used_source_mode = source_mode
        session.merge(
            UserPracticePreferencesV2(
                user_id=user_id,
                payload=payload_model.model_dump(mode="json"),
                schema_version=1,
            )
        )
        session.commit()


def _seed_category_snapshot(
    client,
    *,
    user_id: int,
    category_key: str,
    accuracy: float,
) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        session.add(
            PracticeStatsSnapshotV2(
                user_id=user_id,
                scope="category_l1",
                category_key=category_key,
                type="xingce",
                total_questions=10,
                correct_count=int(round(10 * accuracy)),
                accuracy=accuracy,
                total_sessions=1,
                total_minutes=10,
                average_score=None,
                recent_trend=[],
            )
        )
        session.commit()


def test_daily_get_creates_once_and_uses_preferences_count(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        _seed_preferences(client, user_id=user_id, count=5)
        _seed_category_snapshot(client, user_id=user_id, category_key="verbal", accuracy=0.2)
        _seed_category_snapshot(client, user_id=user_id, category_key="judgment", accuracy=0.9)
        seed_paper(
            client,
            paper_code="XC-DAILY-001",
            title="Daily Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "V1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "V2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "V3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "summary"},
                {"prompt": "J1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
                {"prompt": "J2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "logic"},
            ],
        )

        first = client.get("/api/v2/practice/daily?type=xingce")
        assert first.status_code == 200, first.text
        second = client.get("/api/v2/practice/daily?type=xingce")
        assert second.status_code == 200, second.text
        assert second.json()["id"] == first.json()["id"]
        assert first.json()["questionCount"] == 5
        assert first.json()["status"] == "pending"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(DailyPracticeV2, first.json()["id"])
            assert row is not None
            assert row.generation_strategy == "weakness_weighted"
            categories = [
                session.get(QuestionV2, question_id).category_l1
                for question_id in row.question_ids
            ]
            assert categories.count("verbal") >= categories.count("judgment")


def test_daily_start_reuses_session_and_submit_completes_row(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        _seed_preferences(client, user_id=user_id, count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-002",
            title="Daily Start Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )

        daily = client.get("/api/v2/practice/daily?type=xingce")
        assert daily.status_code == 200, daily.text
        daily_id = daily.json()["id"]

        first_start = client.post(f"/api/v2/practice/daily/{daily_id}/start")
        assert first_start.status_code == 200, first_start.text
        second_start = client.post(f"/api/v2/practice/daily/{daily_id}/start")
        assert second_start.status_code == 200, second_start.text
        assert second_start.json()["id"] == first_start.json()["id"]
        session_id = first_start.json()["id"]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(DailyPracticeV2, daily_id)
            assert row is not None
            assert row.status == "started"
            assert row.started_at is not None

        first_answer_key = first_start.json()["items"][0]["questionKey"]
        saved = client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": first_answer_key, "answer": {"selected": ["A"]}}]},
        )
        assert saved.status_code == 200, saved.text
        submitted = client.post(f"/api/v2/practice/sessions/{session_id}/submit")
        assert submitted.status_code == 200, submitted.text

        history = client.get("/api/v2/practice/daily/history?period=7d&type=xingce")
        assert history.status_code == 200, history.text
        assert history.json()[0]["completedSessionId"] == session_id
        assert history.json()[0]["status"] == "completed"
        assert history.json()[0]["completedAccuracy"] == 0.0

        with factory() as session:
            row = session.get(DailyPracticeV2, daily_id)
            assert row is not None
            assert row.completed_session_id == session_id
            assert row.status == "completed"


def test_daily_start_can_resume_started_session_after_expiry(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        _seed_preferences(client, user_id=user_id, count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-004",
            title="Daily Resume Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        daily = client.get("/api/v2/practice/daily?type=xingce")
        daily_id = daily.json()["id"]
        started = client.post(f"/api/v2/practice/daily/{daily_id}/start")
        session_id = started.json()["id"]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(DailyPracticeV2, daily_id)
            assert row is not None
            row.expired_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
            session.add(row)
            session.commit()

        resumed = client.post(f"/api/v2/practice/daily/{daily_id}/start")
        assert resumed.status_code == 200, resumed.text
        assert resumed.json()["id"] == session_id


def test_daily_get_can_use_ai_generated_source_mode(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        _seed_preferences(client, user_id=user_id, count=5, source_mode="ai_generated")
        _seed_category_snapshot(client, user_id=user_id, category_key="verbal", accuracy=0.2)
        seed_paper(
            client,
            paper_code="XC-DAILY-003",
            title="Daily AI Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "S1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "S2", "year": 2023, "region": "shanghai", "exam_type": "municipal", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )

        response = client.get("/api/v2/practice/daily?type=xingce")
        assert response.status_code == 200, response.text
        daily_id = response.json()["id"]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(DailyPracticeV2, daily_id)
            assert row is not None
            questions = list(
                session.scalars(select(QuestionV2).where(QuestionV2.id.in_(row.question_ids)))
            )
            assert len(questions) == 5
            assert {question.source for question in questions} == {"ai_generated"}


def test_daily_history_essay_uses_completed_report_scores(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="ESSAY-DAILY-001",
            title="Essay Daily Source",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "essay_expression", "category_l2": "essay_argument"},
            ],
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = DailyPracticeV2(
                user_id=user_id,
                date=today_cn(),
                type="essay",
                question_ids=question_ids,
                generation_strategy="test_seed",
                status="completed",
                completed_session_id=None,
                expired_at=datetime.combine(today_cn(), datetime.max.time()).replace(tzinfo=None),
            )
            session.add(row)
            session.flush()
            practice_session = PracticeSessionV2(
                user_id=user_id,
                track="essay",
                entry_kind="daily",
                status="submitted",
                paper_id=None,
                revision_id=None,
                payload_json={},
                practice_mode="full_set",
                source_mode="daily",
            )
            session.add(practice_session)
            session.flush()
            row.completed_session_id = practice_session.id
            submission = EssaySubmissionV2(
                user_id=user_id,
                question_id=question_ids[0],
                practice_session_id=practice_session.id,
                content="essay answer",
                status="submitted",
            )
            session.add(submission)
            session.flush()
            session.add(
                EssayReportV2(
                    submission_id=submission.id,
                    status="completed",
                    score=75,
                    feedback_json={},
                )
            )
            session.add(row)
            session.commit()

        history = client.get("/api/v2/practice/daily/history?period=7d&type=essay")
        assert history.status_code == 200, history.text
        assert history.json()[0]["completedAccuracy"] == 0.75


def test_daily_generation_exclude_done_ignores_unanswered_items(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        _seed_preferences(client, user_id=user_id, count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-005",
            title="Daily Exclude Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "Q3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "summary"},
                {"prompt": "Q4", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
                {"prompt": "Q5", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "logic"},
                {"prompt": "Q6", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "analogy"},
            ],
        )
        first = client.get("/api/v2/practice/daily?type=xingce")
        daily_id = first.json()["id"]
        started = client.post(f"/api/v2/practice/daily/{daily_id}/start")
        session_id = started.json()["id"]
        first_answer_key = started.json()["items"][0]["questionKey"]
        client.post(
            f"/api/v2/practice/sessions/{session_id}/answers",
            json={"answers": [{"questionKey": first_answer_key, "answer": {"selected": ["A"]}}]},
        )
        client.post(f"/api/v2/practice/sessions/{session_id}/submit")

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(DailyPracticeV2, daily_id)
            assert row is not None
            first_question_ids = list(row.question_ids)
            defaults = PracticePreferencesPayloadV1().custom_practice
            defaults.last_used_count = 5
            picked = _pick_real_exam_questions(
                session,
                user_id=user_id,
                type_name="xingce",
                defaults=defaults,
            )
            assert set(first_question_ids[1:]) & set(picked)
