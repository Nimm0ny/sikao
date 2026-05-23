from __future__ import annotations

from base64 import b64encode
import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user, seed_paper
from sikao_api.db.content_hash import compute_question_content_hash
from sikao_api.db.models_v2 import QuestionOptionV2, QuestionReportV2, QuestionV2


def _admin_headers() -> dict[str, str]:
    token = b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_apply_fix_text_and_payload_guards(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="text-fix@example.com",
            display_name="Text Fix Reporter",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-004",
            title="Question Report Text Fix",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Question with explanation payload",
                    "year": 2024,
                    "region": "fujian",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                }
            ],
        )[0]

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            question = session.get(QuestionV2, question_id)
            assert question is not None
            question.content_json = {"explanationText": "Old explanation."}
            question.content_hash = compute_question_content_hash(
                question.prompt,
                question.content_json,
            )
            session.add(question)
            session.commit()

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "explanation_wrong",
                "description": "Explanation should be updated through text branch.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        missing_text = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "explanation",
                "adminResponse": "Missing text should fail.",
            },
            headers=_admin_headers(),
        )
        assert missing_text.status_code == 422, missing_text.text
        assert missing_text.json()["code"] == "question_report_fix_text_required"

        payload_mismatch = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "stem",
                "adminResponse": "Options payload should not accompany text field.",
                "textAfter": "New stem text",
                "optionsAfter": [{"key": "A", "text": "bad"}],
            },
            headers=_admin_headers(),
        )
        assert payload_mismatch.status_code == 422, payload_mismatch.text
        assert payload_mismatch.json()["code"] == "question_report_fix_payload_invalid"

        blank_admin_response = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "explanation",
                "adminResponse": "   ",
                "textAfter": "New explanation text.",
            },
            headers=_admin_headers(),
        )
        assert blank_admin_response.status_code == 422, blank_admin_response.text
        assert blank_admin_response.json()["code"] == "question_report_admin_response_required"

        fixed = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "explanation",
                "adminResponse": "Explanation updated.",
                "textAfter": "New explanation text.",
            },
            headers=_admin_headers(),
        )
        assert fixed.status_code == 200, fixed.text
        assert fixed.json()["status"] == "resolved_fixed"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_apply_fix_rejects_missing_content_branch(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="missing-content@example.com",
            display_name="Missing Content Reporter",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-005",
            title="Question Report Missing Content",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Question without explanation payload",
                    "year": 2024,
                    "region": "hunan",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "explanation_wrong",
                "description": "This should fail because the content branch is absent.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        missing_branch = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "explanation",
                "adminResponse": "No explanation payload exists.",
                "textAfter": "New explanation text.",
            },
            headers=_admin_headers(),
        )
        assert missing_branch.status_code == 422, missing_branch.text
        assert missing_branch.json()["code"] == "question_report_fix_field_missing"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_question_report_apply_fix_validates_correct_answer_and_options_payload(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(
            client,
            email="answer-fix@example.com",
            display_name="Answer Fix Reporter",
        )
        question_id = seed_paper(
            client,
            paper_code="XC-QR-ADMIN-006",
            title="Question Report Correct Answer",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Question with answer key payload",
                    "year": 2024,
                    "region": "guangxi",
                    "exam_type": "provincial",
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
            question.content_json = {"answerText": "A"}
            question.content_hash = compute_question_content_hash(
                question.prompt,
                question.content_json,
            )
            session.add(question)
            session.add_all(
                [
                    QuestionOptionV2(
                        question_id=question.id,
                        option_key="A",
                        option_text="Option A",
                        display_order=1,
                    ),
                    QuestionOptionV2(
                        question_id=question.id,
                        option_key="B",
                        option_text="Option B",
                        display_order=2,
                    ),
                ]
            )
            session.commit()

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "answer_disputed",
                "description": "Correct answer should validate against the option key set.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        missing_options_payload = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "options",
                "adminResponse": "Missing options payload should fail.",
            },
            headers=_admin_headers(),
        )
        assert missing_options_payload.status_code == 422, missing_options_payload.text
        assert missing_options_payload.json()["code"] == "question_report_fix_options_required"

        invalid_answer = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "correct_answer",
                "adminResponse": "Invalid option key should fail.",
                "textAfter": "C",
            },
            headers=_admin_headers(),
        )
        assert invalid_answer.status_code == 422, invalid_answer.text
        assert invalid_answer.json()["code"] == "question_report_fix_answer_invalid"

        duplicate_answer = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "correct_answer",
                "adminResponse": "Duplicate option key should fail.",
                "textAfter": "AA",
            },
            headers=_admin_headers(),
        )
        assert duplicate_answer.status_code == 422, duplicate_answer.text
        assert duplicate_answer.json()["code"] == "question_report_fix_answer_invalid"

        valid_answer = client.post(
            f"/api/v2/admin/practice/reports/{report_id}/apply-fix",
            json={
                "field": "correct_answer",
                "adminResponse": "Correct answer updated.",
                "textAfter": "BA",
            },
            headers=_admin_headers(),
        )
        assert valid_answer.status_code == 200, valid_answer.text
        assert valid_answer.json()["status"] == "resolved_fixed"

        with factory() as session:
            question = session.get(QuestionV2, question_id)
            report = session.get(QuestionReportV2, report_id)
            assert question is not None
            assert report is not None
            assert question.content_json["answerText"] == "AB"
            assert report.applied_fix["after"] == "AB"
