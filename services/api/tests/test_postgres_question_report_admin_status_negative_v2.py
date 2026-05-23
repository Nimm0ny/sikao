from __future__ import annotations

from base64 import b64encode
import os
from pathlib import Path

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper


def _admin_headers() -> dict[str, str]:
    token = b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_admin_status_negative_paths(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="neg-a@example.com",
            display_name="Negative A",
        )
        question_ids = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-NEG-01",
            title="Question Report Admin Negative",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Duplicate target question",
                    "year": 2024,
                    "region": "zhejiang",
                    "exam_type": "provincial",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                },
                {
                    "prompt": "Cross-question target",
                    "year": 2024,
                    "region": "zhejiang",
                    "exam_type": "provincial",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                },
            ],
        )
        question_id = question_ids[0]
        other_question_id = question_ids[1]

        first = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "First report for duplicate validation path.",
            },
        )
        assert first.status_code == 200, first.text
        first_id = first.json()["id"]

        register_user(
            client,
            email="neg-b@example.com",
            display_name="Negative B",
        )
        second = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "Second report for duplicate validation path.",
            },
        )
        assert second.status_code == 200, second.text
        second_id = second.json()["id"]

        cross = client.post(
            f"/api/v2/practice/questions/{other_question_id}/reports",
            json={
                "category": "formatting",
                "description": "Cross-question report for duplicate validation.",
            },
        )
        assert cross.status_code == 200, cross.text
        cross_id = cross.json()["id"]

        missing_response = client.patch(
            f"/api/v2/admin/practice/reports/{second_id}",
            json={"status": "resolved_invalid"},
            headers=_admin_headers(),
        )
        assert missing_response.status_code == 422, missing_response.text
        assert missing_response.json()["code"] == "question_report_admin_response_required"

        missing_duplicate = client.patch(
            f"/api/v2/admin/practice/reports/{second_id}",
            json={
                "status": "resolved_duplicate",
                "adminResponse": "Duplicate target missing.",
            },
            headers=_admin_headers(),
        )
        assert missing_duplicate.status_code == 422, missing_duplicate.text
        assert missing_duplicate.json()["code"] == "question_report_duplicate_target_required"

        self_duplicate = client.patch(
            f"/api/v2/admin/practice/reports/{second_id}",
            json={
                "status": "resolved_duplicate",
                "adminResponse": "Self duplicate should fail.",
                "duplicateOfReportId": second_id,
            },
            headers=_admin_headers(),
        )
        assert self_duplicate.status_code == 422, self_duplicate.text
        assert self_duplicate.json()["code"] == "question_report_duplicate_target_invalid"

        cross_question_duplicate = client.patch(
            f"/api/v2/admin/practice/reports/{second_id}",
            json={
                "status": "resolved_duplicate",
                "adminResponse": "Cross-question duplicate should fail.",
                "duplicateOfReportId": cross_id,
            },
            headers=_admin_headers(),
        )
        assert cross_question_duplicate.status_code == 422, cross_question_duplicate.text
        assert cross_question_duplicate.json()["code"] == "question_report_duplicate_target_invalid"

        resolved = client.patch(
            f"/api/v2/admin/practice/reports/{second_id}",
            json={
                "status": "resolved_invalid",
                "adminResponse": "Closed as invalid.",
            },
            headers=_admin_headers(),
        )
        assert resolved.status_code == 200, resolved.text

        terminal_reject = client.patch(
            f"/api/v2/admin/practice/reports/{second_id}",
            json={
                "status": "resolved_duplicate",
                "adminResponse": "Should stay terminal.",
                "duplicateOfReportId": first_id,
            },
            headers=_admin_headers(),
        )
        assert terminal_reject.status_code == 409, terminal_reject.text
        assert terminal_reject.json()["code"] == "question_report_already_resolved"

        first_resolved = client.patch(
            f"/api/v2/admin/practice/reports/{first_id}",
            json={
                "status": "resolved_invalid",
                "adminResponse": "Original report is no longer active.",
            },
            headers=_admin_headers(),
        )
        assert first_resolved.status_code == 200, first_resolved.text

        register_user(
            client,
            email="neg-d@example.com",
            display_name="Negative D",
        )
        late_report = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "formatting",
                "description": "Late report tries to point at a resolved_invalid target.",
            },
        )
        assert late_report.status_code == 200, late_report.text
        late_report_id = late_report.json()["id"]

        invalid_terminal_target = client.patch(
            f"/api/v2/admin/practice/reports/{late_report_id}",
            json={
                "status": "resolved_duplicate",
                "adminResponse": "Resolved-invalid target should be rejected.",
                "duplicateOfReportId": first_id,
            },
            headers=_admin_headers(),
        )
        assert invalid_terminal_target.status_code == 422, invalid_terminal_target.text
        assert invalid_terminal_target.json()["code"] == "question_report_duplicate_target_invalid"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_admin_rejects_invalid_ack_transition(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="transition@example.com",
            display_name="Transition Reporter",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-TRANS-01",
            title="Question Report Transition",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Transition question",
                    "year": 2024,
                    "region": "sichuan",
                    "exam_type": "provincial",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "This report will be acknowledged twice to test invalid transition.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        first_ack = client.patch(
            f"/api/v2/admin/practice/reports/{report_id}",
            json={"status": "acknowledged"},
            headers=_admin_headers(),
        )
        assert first_ack.status_code == 200, first_ack.text

        second_ack = client.patch(
            f"/api/v2/admin/practice/reports/{report_id}",
            json={"status": "acknowledged"},
            headers=_admin_headers(),
        )
        assert second_ack.status_code == 422, second_ack.text
        assert second_ack.json()["code"] == "question_report_status_transition_invalid"
