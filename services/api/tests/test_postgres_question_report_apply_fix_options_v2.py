from __future__ import annotations

from base64 import b64encode
import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import AuditLogV2, QuestionOptionV2, QuestionReportV2, QuestionV2


def _admin_headers() -> dict[str, str]:
    token = b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_apply_fix_updates_question_and_dual_audits(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="fixer@example.com",
            display_name="Fix Reporter",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-002",
            title="Question Report Apply Fix",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Question needing option fixes",
                    "year": 2024,
                    "region": "shanghai",
                    "exam_type": "national",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            question.content_json = {
                "answerText": "A",
                "explanationText": "Old explanation.",
            }
            question.content_hash = compute_question_content_hash(
                question.prompt,
                question.content_json,
            )
            session.add(question)
            session.flush()
            old_hash = question.content_hash
            session.add_all(
                [
                    QuestionOptionV2(
                        question_id=question.id,
                        option_key="A",
                        option_text="Old option A",
                        display_order=1,
                    ),
                    QuestionOptionV2(
                        question_id=question.id,
                        option_key="B",
                        option_text="Old option B",
                        display_order=2,
                    ),
                ]
            )
            session.commit()

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "option_missing",
                "description": "The option wording is stale and one option is effectively missing.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        fixed = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "options",
                "adminResponse": "Options repaired and normalized.",
                "optionsAfter": [
                    {"key": "A", "text": "New option A"},
                    {"key": "B", "text": "New option B"},
                ],
            },
            headers=_admin_headers(),
        )
        assert fixed.status_code == 200, fixed.text
        body = fixed.json()
        assert body["status"] == "resolved_fixed"
        assert body["appliedFix"]["field"] == "options"

        with factory() as session:
            report = session.get(QuestionReportV2, report_id)
            question = session.get(QuestionV2, question_id)
            assert report is not None
            assert question is not None
            assert report.status == "resolved_fixed"
            assert report.handled_by_admin_id is not None
            assert report.applied_fix is not None
            assert report.applied_fix["field"] == "options"
            assert question.content_hash == old_hash
            assert "options" not in question.content_json

            option_rows = list(
                session.query(QuestionOptionV2)
                .filter_by(question_id=question_id)
                .order_by(QuestionOptionV2.display_order.asc())
            )
            assert [(row.option_key, row.option_text) for row in option_rows] == [
                ("A", "New option A"),
                ("B", "New option B"),
            ]

            status_changed = session.query(AuditLogV2).filter_by(
                action="question_report.status_changed",
                target_type="question_report_v2",
                target_id=report_id,
            ).one()
            assert status_changed.metadata_json["to"] == "resolved_fixed"

            fix_applied = session.query(AuditLogV2).filter_by(
                action="question_report.fix_applied",
                target_type="question_report_v2",
                target_id=report_id,
            ).one()
            assert fix_applied.metadata_json["field"] == "options"

            field_updated = session.query(AuditLogV2).filter_by(
                action="question.field_updated",
                target_type="question_v2",
                target_id=question_id,
            ).one()
            assert field_updated.before["field"] == "options"
            assert field_updated.after["value"][1]["key"] == "B"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_apply_fix_rejects_option_key_mismatch(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="mismatch@example.com",
            display_name="Mismatch Reporter",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-003",
            title="Question Report Option Mismatch",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Question with fixed option key set",
                    "year": 2024,
                    "region": "jiangsu",
                    "exam_type": "provincial",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            session.add_all(
                [
                    QuestionOptionV2(
                        question_id=question_id,
                        option_key="A",
                        option_text="Old option A",
                        display_order=1,
                    ),
                    QuestionOptionV2(
                        question_id=question_id,
                        option_key="B",
                        option_text="Old option B",
                        display_order=2,
                    ),
                ]
            )
            session.commit()

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "option_missing",
                "description": "Trying to inject a new option key should be rejected.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        mismatch = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "options",
                "adminResponse": "This should fail.",
                "optionsAfter": [
                    {"key": "A", "text": "New option A"},
                    {"key": "C", "text": "Injected option C"},
                ],
            },
            headers=_admin_headers(),
        )
        assert mismatch.status_code == 422, mismatch.text
        assert mismatch.json()["code"] == "question_report_fix_option_keys_mismatch"
