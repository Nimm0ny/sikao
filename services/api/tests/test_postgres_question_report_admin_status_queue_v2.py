from __future__ import annotations

from base64 import b64encode
import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, EmailContactV2, QuestionReportV2, UserV2


def _admin_headers() -> dict[str, str]:
    token = b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_admin_shadow_email_namespace_is_reserved(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register = client.post(
            "/api/v2/auth/register/email",
            json={
                "email": "__admin__.admin@system.local",
                "password": "secret123",
                "displayName": "Reserved",
            },
        )
        assert register.status_code == 422, register.text
        assert register.json()["code"] == "reserved_email_namespace"

        send_code = client.post(
            "/api/v2/auth/send-code",
            json={
                "targetKind": "email",
                "targetValue": "__admin__.admin@system.local",
                "purpose": "register",
            },
        )
        assert send_code.status_code == 422, send_code.text
        assert send_code.json()["code"] == "reserved_email_namespace"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_admin_list_and_duplicate_flow(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="report-a@example.com",
            display_name="Reporter A",
        )
        question_ids = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-001",
            title="Question Report Admin",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Shared report question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                },
                {
                    "prompt": "Single report question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                },
            ],
        )
        shared_question_id = question_ids[0]
        other_question_id = question_ids[1]

        report_a = client.post(
            f"/api/v2/practice/questions/{shared_question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "The shared question has a typo in the leading sentence.",
            },
        )
        assert report_a.status_code == 200, report_a.text
        report_a_id = report_a.json()["id"]

        register_user(
            client,
            email="report-b@example.com",
            display_name="Reporter B",
        )
        report_b = client.post(
            f"/api/v2/practice/questions/{shared_question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "The same typo is visible for another user as well.",
            },
        )
        assert report_b.status_code == 200, report_b.text
        report_b_id = report_b.json()["id"]

        register_user(
            client,
            email="report-c@example.com",
            display_name="Reporter C",
        )
        report_c = client.post(
            f"/api/v2/practice/questions/{other_question_id}/reports",
            json={
                "category": "formatting",
                "description": "This separate question only has one active report.",
            },
        )
        assert report_c.status_code == 200, report_c.text

        admin_list = client.get(
            "/api/v2/admin/practice/reports?limit=10&offset=0",
            headers=_admin_headers(),
        )
        assert admin_list.status_code == 200, admin_list.text
        body = admin_list.json()
        assert body["total"] == 3
        assert body["pendingCount"] == 3
        assert body["items"][0]["questionId"] == shared_question_id
        assert body["items"][1]["questionId"] == shared_question_id
        assert body["items"][0]["activeReportCount"] == 2
        assert body["items"][2]["activeReportCount"] == 1

        acknowledged = client.patch(
            f"/api/v2/admin/practice/reports/{report_b_id}",
            json={"status": "acknowledged"},
            headers=_admin_headers(),
        )
        assert acknowledged.status_code == 200, acknowledged.text
        assert acknowledged.json()["status"] == "acknowledged"

        duplicated = client.patch(
            f"/api/v2/admin/practice/reports/{report_b_id}",
            json={
                "status": "resolved_duplicate",
                "adminResponse": "Duplicate of the earlier valid report.",
                "duplicateOfReportId": report_a_id,
            },
            headers=_admin_headers(),
        )
        assert duplicated.status_code == 200, duplicated.text
        duplicated_body = duplicated.json()
        assert duplicated_body["status"] == "resolved_duplicate"
        assert duplicated_body["duplicateOfReportId"] == report_a_id
        assert duplicated_body["activeReportCount"] == 1

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            resolved = session.get(QuestionReportV2, report_b_id)
            assert resolved is not None
            assert resolved.status == "resolved_duplicate"
            assert resolved.handled_by_admin_id is not None
            assert resolved.duplicate_of_report_id == report_a_id

            admin_contact = session.query(EmailContactV2).filter_by(
                email="__admin__.admin@system.local"
            )
            admin_contact = admin_contact.one_or_none()
            assert admin_contact is not None
            admin_user = session.get(UserV2, admin_contact.user_id)
            assert admin_user is not None
            assert admin_user.is_active is False

            status_audits = list(
                session.query(AuditLogV2)
                .filter_by(
                    action="question_report.status_changed",
                    target_type="question_report_v2",
                    target_id=report_b_id,
                )
                .order_by(AuditLogV2.id.asc())
            )
            assert [audit.metadata_json["to"] for audit in status_audits] == [
                "acknowledged",
                "resolved_duplicate",
            ]
            dup_marked = session.query(AuditLogV2).filter_by(
                action="question_report.dup_marked",
                target_type="question_report_v2",
                target_id=report_b_id,
            ).one()
            assert dup_marked.metadata_json["duplicateOfReportId"] == report_a_id
