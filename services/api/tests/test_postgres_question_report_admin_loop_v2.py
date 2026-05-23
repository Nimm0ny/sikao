from __future__ import annotations

from base64 import b64encode
import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, QuestionReportV2, QuestionV2


def _admin_headers() -> dict[str, str]:
    token = b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_admin_loop_resolves_and_mutates_question(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="loop-owner@example.com",
            display_name="Loop Owner",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-LOOP-001",
            title="Question Report Loop",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Original prompt before admin fix",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "The prompt has a wording problem that should be fixed by admin.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        acknowledged = client.patch(
            f"/api/v2/admin/practice/reports/{report_id}",
            json={"status": "acknowledged"},
            headers=_admin_headers(),
        )
        assert acknowledged.status_code == 200, acknowledged.text
        assert acknowledged.json()["status"] == "acknowledged"

        fixed = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "stem",
                "adminResponse": "Prompt wording corrected.",
                "textAfter": "Prompt wording corrected by admin",
            },
            headers=_admin_headers(),
        )
        assert fixed.status_code == 200, fixed.text
        fixed_body = fixed.json()
        assert fixed_body["status"] == "resolved_fixed"
        assert fixed_body["appliedFix"]["field"] == "stem"

        listed = client.get(f"/api/v2/practice/questions/{question_id}/reports")
        assert listed.status_code == 200, listed.text
        items = listed.json()["items"]
        assert len(items) == 1
        assert items[0]["id"] == report_id
        assert items[0]["status"] == "resolved_fixed"
        assert items[0]["adminResponse"] == "Prompt wording corrected."

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            report = session.get(QuestionReportV2, report_id)
            question = session.get(QuestionV2, question_id)
            assert report is not None
            assert question is not None
            assert report.status == "resolved_fixed"
            assert report.handled_by_admin_id is not None
            assert report.admin_response == "Prompt wording corrected."
            assert report.applied_fix["field"] == "stem"
            assert question.prompt == "Prompt wording corrected by admin"

            status_audits = list(
                session.query(AuditLogV2)
                .filter_by(
                    action="question_report.status_changed",
                    target_type="question_report_v2",
                    target_id=report_id,
                )
                .order_by(AuditLogV2.id.asc())
            )
            assert [audit.metadata_json["to"] for audit in status_audits] == [
                "acknowledged",
                "resolved_fixed",
            ]

            fix_applied = session.query(AuditLogV2).filter_by(
                action="question_report.fix_applied",
                target_type="question_report_v2",
                target_id=report_id,
            ).one()
            assert fix_applied.metadata_json["field"] == "stem"

            field_updated = session.query(AuditLogV2).filter_by(
                action="question.field_updated",
                target_type="question_v2",
                target_id=question_id,
            ).one()
            assert field_updated.before["field"] == "stem"
            assert field_updated.after["value"] == "Prompt wording corrected by admin"
