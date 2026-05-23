from __future__ import annotations

import concurrent.futures
import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_daily_practice,
    seed_paper,
)
from sikao_api.cron.daily_practice_cron import generate_daily_practice
from sikao_api.db.models_v2 import AuditLogV2, DailyPracticeV2, UserPracticePreferencesV2, UserV2
from sikao_api.db.schemas_v2 import PracticePreferencesPayloadV1
from sikao_api.modules.daily_practice.application.service import ensure_daily_for_date
from sikao_api.modules.progress.application.aggregates import today_cn


def _seed_preferences(
    client: Any,
    *,
    user_id: int,
    source_mode: str = "real_exam",
    difficulty_range: tuple[float, float] = (0.0, 1.0),
    count: int = 5,
) -> None:
    app = cast(Any, client.app)
    factory = app.state.db.session_factory
    with factory() as session:
        payload = PracticePreferencesPayloadV1()
        payload.custom_practice.last_used_source_mode = source_mode
        payload.custom_practice.last_used_difficulty_range = difficulty_range
        payload.custom_practice.last_used_count = count
        session.merge(
            UserPracticePreferencesV2(
                user_id=user_id,
                payload=payload.model_dump(mode="json"),
                schema_version=1,
            )
        )
        session.commit()


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_daily_practice_cron_generates_rows_and_success_audit(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_a = register_user(client, email="daily-cron-a@example.com", display_name="Daily Cron A")
        user_b = register_user(client, email="daily-cron-b@example.com", display_name="Daily Cron B")
        for user_id in (user_a, user_b):
            _seed_preferences(client, user_id=user_id, count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-CRON-001",
            title="Daily Cron Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "Q3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
                {"prompt": "Q4", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "logic"},
                {"prompt": "Q5", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "data", "category_l2": "chart"},
            ],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            result = generate_daily_practice(
                session,
                app.state.settings,
                target_date=today_cn(),
                type_names=("xingce",),
            )
            session.commit()
            rows = list(
                session.query(DailyPracticeV2)
                .filter_by(type="xingce", date=today_cn())
                .order_by(DailyPracticeV2.user_id.asc())
            )
            audits = list(
                session.query(AuditLogV2)
                .filter_by(action="daily.generate", target_type="daily_practice_v2")
                .order_by(AuditLogV2.target_id.asc())
            )
            assert result.generated_count == 2
            assert result.skipped_count == 0
            assert result.failure_count == 0
            assert len(rows) == 2
            assert len(audits) == 2
            assert {audit.metadata_json["strategy"] for audit in audits} <= {
                "random_balanced",
                "weakness_weighted",
            }


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_daily_practice_cron_skips_existing_rows(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="daily-cron-skip@example.com", display_name="Daily Cron Skip")
        _seed_preferences(client, user_id=user_id, count=5)
        question_ids = seed_paper(
            client,
            paper_code="XC-DAILY-CRON-002",
            title="Daily Cron Skip Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "Q3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
            ],
        )
        seed_daily_practice(
            client,
            user_id=user_id,
            type_name="xingce",
            question_ids=question_ids[:3],
            date_value=today_cn(),
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            result = generate_daily_practice(
                session,
                app.state.settings,
                target_date=today_cn(),
                type_names=("xingce",),
            )
            session.commit()
            rows = list(
                session.query(DailyPracticeV2)
                .filter_by(user_id=user_id, type="xingce", date=today_cn())
            )
            assert result.generated_count == 0
            assert result.skipped_count == 1
            assert result.failure_count == 0
            assert len(rows) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_daily_practice_cron_records_failure_without_blocking_other_users(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_ok = register_user(client, email="daily-cron-ok@example.com", display_name="Daily Cron OK")
        user_fail = register_user(client, email="daily-cron-fail@example.com", display_name="Daily Cron Fail")
        _seed_preferences(client, user_id=user_ok, count=5)
        _seed_preferences(client, user_id=user_fail, difficulty_range=(0.95, 1.0), count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-CRON-003",
            title="Daily Cron Failure Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "Q3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
                {"prompt": "Q4", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "logic"},
                {"prompt": "Q5", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "data", "category_l2": "chart"},
            ],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            result = generate_daily_practice(
                session,
                app.state.settings,
                target_date=today_cn(),
                type_names=("xingce",),
            )
            session.commit()
            success_rows = list(
                session.query(DailyPracticeV2)
                .filter_by(type="xingce", date=today_cn())
                .order_by(DailyPracticeV2.user_id.asc())
            )
            failure_audit = session.query(AuditLogV2).filter_by(
                action="daily.generate_failed",
                target_type="user_v2",
                target_id=user_fail,
            ).one()
            assert result.generated_count == 1
            assert result.skipped_count == 0
            assert result.failure_count == 1
            assert [row.user_id for row in success_rows] == [user_ok]
            assert failure_audit.metadata_json["type"] == "xingce"
            assert failure_audit.metadata_json["error"]["code"] == "daily_practice_empty"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_daily_practice_cron_default_batch_generates_xingce_and_essay_without_sessions(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="daily-cron-dual@example.com", display_name="Daily Cron Dual")
        _seed_preferences(client, user_id=user_id, count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-CRON-004",
            title="Daily Cron Xingce Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "Q3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
                {"prompt": "Q4", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "logic"},
                {"prompt": "Q5", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "data", "category_l2": "chart"},
            ],
        )
        seed_paper(
            client,
            paper_code="ES-DAILY-CRON-004",
            title="Daily Cron Essay Source",
            subject_kind="essay",
            questions=[
                {"prompt": "Essay Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "essay", "category_l2": "policy_analysis"},
            ],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            result = generate_daily_practice(
                session,
                app.state.settings,
                target_date=today_cn(),
            )
            session.commit()
            rows = list(
                session.query(DailyPracticeV2)
                .filter_by(user_id=user_id, date=today_cn())
                .order_by(DailyPracticeV2.type.asc())
            )
            assert result.generated_count == 2
            assert result.failure_count == 0
            assert [row.type for row in rows] == ["essay", "xingce"]
            assert all(row.started_at is None for row in rows)
            assert all(row.completed_session_id is None for row in rows)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_daily_practice_cron_default_batch_can_fail_one_type_and_keep_other_type(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="daily-cron-mixed@example.com", display_name="Daily Cron Mixed")
        _seed_preferences(client, user_id=user_id, count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-CRON-005",
            title="Daily Cron Mixed Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "Q3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
                {"prompt": "Q4", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "logic"},
                {"prompt": "Q5", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "data", "category_l2": "chart"},
            ],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            result = generate_daily_practice(
                session,
                app.state.settings,
                target_date=today_cn(),
            )
            session.commit()
            rows = list(
                session.query(DailyPracticeV2)
                .filter_by(user_id=user_id, date=today_cn())
                .order_by(DailyPracticeV2.type.asc())
            )
            failure_audit = session.query(AuditLogV2).filter_by(
                action="daily.generate_failed",
                target_type="user_v2",
                target_id=user_id,
            ).one()
            assert result.generated_count == 1
            assert result.failure_count == 1
            assert [row.type for row in rows] == ["xingce"]
            assert failure_audit.metadata_json["type"] == "essay"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_ensure_daily_for_date_concurrent_calls_degrade_to_existing_row(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client, email="daily-cron-race@example.com", display_name="Daily Cron Race")
        _seed_preferences(client, user_id=user_id, count=5)
        seed_paper(
            client,
            paper_code="XC-DAILY-CRON-006",
            title="Daily Cron Race Source",
            subject_kind="xingce",
            questions=[
                {"prompt": "Q1", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Q2", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "Q3", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "definition"},
                {"prompt": "Q4", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "judgment", "category_l2": "logic"},
                {"prompt": "Q5", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "data", "category_l2": "chart"},
            ],
        )

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        settings = app.state.settings

        def run_once() -> bool:
            session = factory()
            try:
                user = session.get(UserV2, user_id)
                assert user is not None
                _, created = ensure_daily_for_date(
                    session,
                    settings=settings,
                    user=user,
                    type_name="xingce",
                    date_value=today_cn(),
                )
                session.commit()
                return created
            finally:
                session.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results = [future.result() for future in [
                executor.submit(run_once),
                executor.submit(run_once),
            ]]

        assert results.count(True) == 1
        assert results.count(False) == 1

        with factory() as session:
            rows = list(
                session.query(DailyPracticeV2)
                .filter_by(user_id=user_id, type="xingce", date=today_cn())
            )
            assert len(rows) == 1
