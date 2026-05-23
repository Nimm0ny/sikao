from __future__ import annotations

from datetime import UTC, datetime
import os
from pathlib import Path
from typing import Any, cast

import pytest
from sqlalchemy.exc import DBAPIError, IntegrityError

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import QuestionReportV2


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_active_unique_allows_recreate_after_resolved(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        reporter_id = register_user(
            client,
            email="reporter@example.com",
            display_name="Reporter",
        )
        admin_id = register_user(
            client,
            email="admin@example.com",
            display_name="Admin",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-PG-UNIQ-01",
            title="Question Report PG Unique",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "PG unique question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            first = QuestionReportV2(
                user_id=reporter_id,
                question_id=question_id,
                category="stem_typo",
                description="The stem has a clear typo in the first sentence.",
            )
            session.add(first)
            session.commit()

            session.add(
                QuestionReportV2(
                    user_id=reporter_id,
                    question_id=question_id,
                    category="stem_typo",
                    description="A duplicate active report must violate the partial index.",
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()

            first.status = "resolved_invalid"
            first.handled_by_admin_id = admin_id
            first.handled_at = _now()
            first.admin_response = "Not reproducible."
            session.add(first)
            session.commit()

            session.add(
                QuestionReportV2(
                    user_id=reporter_id,
                    question_id=question_id,
                    category="stem_typo",
                    description="A new report is allowed once the old one is resolved.",
                )
            )
            session.commit()


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_checks_enforce_state_invariants(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        reporter_id = register_user(
            client,
            email="checks@example.com",
            display_name="Checks",
        )
        admin_id = register_user(
            client,
            email="checks-admin@example.com",
            display_name="Checks Admin",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-PG-CHECK-01",
            title="Question Report PG Checks",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "PG check question",
                    "year": 2024,
                    "region": "shanghai",
                    "exam_type": "national",
                    "category_l1": "judgement",
                    "category_l2": "definition",
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add(
                QuestionReportV2(
                    user_id=reporter_id,
                    question_id=question_id,
                    category="other",
                    description="short",
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()

            session.add(
                QuestionReportV2(
                    user_id=reporter_id,
                    question_id=question_id,
                    category="formatting",
                    description="Resolved rows must provide admin handling fields.",
                    status="resolved_invalid",
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()

            session.add(
                QuestionReportV2(
                    user_id=reporter_id,
                    question_id=question_id,
                    category="answer_disputed",
                    description="Resolved fixed rows require an applied_fix payload.",
                    status="resolved_fixed",
                    handled_by_admin_id=admin_id,
                    handled_at=_now(),
                    admin_response="Fixed.",
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()

            session.add(
                QuestionReportV2(
                    user_id=reporter_id,
                    question_id=question_id,
                    category="explanation_wrong",
                    description="Resolved duplicate rows require duplicate_of_report_id.",
                    status="resolved_duplicate",
                    handled_by_admin_id=admin_id,
                    handled_at=_now(),
                    admin_response="Duplicate.",
                )
            )
            with pytest.raises(IntegrityError):
                session.commit()
            session.rollback()


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_terminal_state_is_immutable(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        reporter_id = register_user(
            client,
            email="terminal@example.com",
            display_name="Terminal Reporter",
        )
        admin_id = register_user(
            client,
            email="terminal-admin@example.com",
            display_name="Terminal Admin",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-PG-TERM-01",
            title="Question Report PG Terminal",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "PG terminal question",
                    "year": 2024,
                    "region": "hubei",
                    "exam_type": "provincial",
                    "category_l1": "data_analysis",
                    "category_l2": "chart",
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            report = QuestionReportV2(
                user_id=reporter_id,
                question_id=question_id,
                category="formatting",
                description="This report starts directly in a terminal resolved state.",
                status="resolved_invalid",
                handled_by_admin_id=admin_id,
                handled_at=_now(),
                admin_response="No issue found.",
            )
            session.add(report)
            session.commit()

            report.admin_response = "Changed after terminal resolution."
            session.add(report)
            with pytest.raises(DBAPIError):
                session.commit()
            session.rollback()

            refreshed = session.get(QuestionReportV2, report.id)
            assert refreshed is not None
            refreshed.status = "acknowledged"
            session.add(refreshed)
            with pytest.raises(DBAPIError):
                session.commit()
