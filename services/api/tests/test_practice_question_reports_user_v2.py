from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from fastapi.testclient import TestClient

from _helpers.practice_content_support import build_client, register_user, seed_paper
from sikao_api.db.models_v2 import AuditLogV2, QuestionReportV2


def _session_factory(client: TestClient) -> Any:
    app = cast(Any, client.app)
    return app.state.db.session_factory


def _report_actions(client: TestClient) -> list[str]:
    factory = _session_factory(client)
    with factory() as session:
        rows = list(
            session.query(AuditLogV2)
            .filter(AuditLogV2.target_type == "question_report_v2")
            .order_by(AuditLogV2.id.asc())
        )
        return [row.action for row in rows]


def _has_audit_action(client: TestClient, action: str) -> bool:
    factory = _session_factory(client)
    with factory() as session:
        row = session.query(AuditLogV2).filter_by(action=action).first()
        return row is not None


def test_question_report_user_crud_flow_and_audit(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-QR-CRUD-01",
            title="Question Report CRUD",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Reported question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "Stem wording is missing a key clause.",
            },
        )
        assert created.status_code == 200, created.text
        created_body = created.json()
        report_id = created_body["id"]
        assert created_body["status"] == "pending"

        listed = client.get(f"/api/v2/practice/questions/{question_id}/reports")
        assert listed.status_code == 200, listed.text
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["id"] == report_id

        updated = client.patch(
            f"/api/v2/practice/reports/{report_id}",
            json={"description": "Stem wording is missing a key clause near the end."},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["description"].endswith("near the end.")

        deleted = client.delete(f"/api/v2/practice/reports/{report_id}")
        assert deleted.status_code == 200, deleted.text
        assert deleted.json() == {"ok": True, "status": "deleted"}

        after_delete = client.get(f"/api/v2/practice/questions/{question_id}/reports")
        assert after_delete.status_code == 200, after_delete.text
        assert after_delete.json()["items"] == []

        recreated = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "A fresh report is allowed after soft delete.",
            },
        )
        assert recreated.status_code == 200, recreated.text
        assert recreated.json()["id"] != report_id

        assert _report_actions(client) == [
            "question_report.created",
            "question_report.updated_by_user",
            "question_report.deleted_by_user",
            "question_report.created",
        ]


def test_question_report_duplicate_pending_returns_409(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-QR-DUP-01",
            title="Question Report Duplicate",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Duplicate question",
                    "year": 2024,
                    "region": "shanghai",
                    "exam_type": "national",
                    "category_l1": "judgement",
                    "category_l2": "definition",
                }
            ],
        )[0]

        first = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "answer_disputed",
                "description": "The official answer looks inconsistent with the stem.",
            },
        )
        assert first.status_code == 200, first.text

        duplicate = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "answer_disputed",
                "description": "The official answer still looks inconsistent here.",
            },
        )
        assert duplicate.status_code == 409, duplicate.text
        assert duplicate.json()["code"] == "REPORT_DUPLICATE_PENDING"


def test_question_report_duplicate_acknowledged_still_returns_409(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-QR-DUP-ACK-01",
            title="Question Report Duplicate Acknowledged",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Acknowledged duplicate question",
                    "year": 2024,
                    "region": "anhui",
                    "exam_type": "provincial",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "formatting",
                "description": "The layout breaks around the final option block.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        factory = _session_factory(client)
        with factory() as session:
            report = session.get(QuestionReportV2, report_id)
            assert report is not None
            report.status = "acknowledged"
            session.add(report)
            session.commit()

        duplicate = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "formatting",
                "description": "An acknowledged active report must still block duplicates.",
            },
        )
        assert duplicate.status_code == 409, duplicate.text
        assert duplicate.json()["code"] == "REPORT_DUPLICATE_PENDING"


def test_question_report_owner_scope_and_pending_only_mutation(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client, email="owner@example.com", display_name="Owner")
        question_id = seed_paper(
            client,
            paper_code="XC-QR-SCOPE-01",
            title="Question Report Scope",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Scoped report question",
                    "year": 2024,
                    "region": "guangdong",
                    "exam_type": "provincial",
                    "category_l1": "numeric",
                    "category_l2": "calculation",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "formatting",
                "description": "The option layout breaks after choice C.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        register_user(client, email="viewer@example.com", display_name="Viewer")

        foreign_list = client.get(f"/api/v2/practice/questions/{question_id}/reports")
        assert foreign_list.status_code == 200, foreign_list.text
        assert foreign_list.json()["items"] == []

        foreign_patch = client.patch(
            f"/api/v2/practice/reports/{report_id}",
            json={"description": "Another user should not edit this report."},
        )
        assert foreign_patch.status_code == 404, foreign_patch.text
        assert foreign_patch.json()["code"] == "question_report_not_found"

        foreign_delete = client.delete(f"/api/v2/practice/reports/{report_id}")
        assert foreign_delete.status_code == 404, foreign_delete.text
        assert foreign_delete.json()["code"] == "question_report_not_found"


def test_question_report_user_mutation_requires_pending_status(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-QR-PENDING-01",
            title="Question Report Pending",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Pending-only question",
                    "year": 2024,
                    "region": "zhejiang",
                    "exam_type": "provincial",
                    "category_l1": "data_analysis",
                    "category_l2": "table",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "other",
                "description": "This report will be acknowledged before mutation.",
            },
        )
        assert created.status_code == 200, created.text
        report_id = created.json()["id"]

        factory = _session_factory(client)
        with factory() as session:
            report = session.get(QuestionReportV2, report_id)
            assert report is not None
            report.status = "acknowledged"
            session.add(report)
            session.commit()

        patch_after_ack = client.patch(
            f"/api/v2/practice/reports/{report_id}",
            json={"description": "Pending-only mutation should now be blocked."},
        )
        assert patch_after_ack.status_code == 409, patch_after_ack.text
        assert patch_after_ack.json()["code"] == "question_report_not_pending"

        delete_after_ack = client.delete(f"/api/v2/practice/reports/{report_id}")
        assert delete_after_ack.status_code == 409, delete_after_ack.text
        assert delete_after_ack.json()["code"] == "question_report_not_pending"


def test_question_report_auth_csrf_and_validation(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        question_id = seed_paper(
            client,
            paper_code="XC-QR-AUTH-01",
            title="Question Report Auth",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Auth question",
                    "year": 2024,
                    "region": "tianjin",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                }
            ],
        )[0]

        unauthenticated_post = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "Unauthenticated requests must fail here.",
            },
        )
        assert unauthenticated_post.status_code == 401, unauthenticated_post.text
        assert unauthenticated_post.json()["code"] == "auth_required"

        unauthenticated_get = client.get(f"/api/v2/practice/questions/{question_id}/reports")
        assert unauthenticated_get.status_code == 401, unauthenticated_get.text
        assert unauthenticated_get.json()["code"] == "auth_required"

        register_user(client)
        client.headers.pop("X-CSRF-Token", None)
        missing_csrf = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "Missing csrf token should be blocked.",
            },
        )
        assert missing_csrf.status_code == 403, missing_csrf.text
        assert missing_csrf.json()["code"] == "csrf_missing"

        client.headers["X-CSRF-Token"] = "csrf-mismatch"
        mismatch_csrf = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "Mismatched csrf token should be blocked.",
            },
        )
        assert mismatch_csrf.status_code == 403, mismatch_csrf.text
        assert mismatch_csrf.json()["code"] == "csrf_mismatch"

        client.headers["X-CSRF-Token"] = client.cookies["csrf_token_v2"]
        too_short = client.post(
            f"/api/v2/practice/questions/{question_id}/reports",
            json={
                "category": "stem_typo",
                "description": "too short",
            },
        )
        assert too_short.status_code == 422, too_short.text


def test_question_report_daily_limit_returns_429(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-QR-LIMIT-01",
            title="Question Report Limit",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": f"Limit question {idx}",
                    "year": 2024,
                    "region": "jiangsu",
                    "exam_type": "provincial",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                }
                for idx in range(1, 22)
            ],
        )

        for question_id in question_ids[:20]:
            response = client.post(
                f"/api/v2/practice/questions/{question_id}/reports",
                json={
                    "category": "other",
                    "description": f"Daily limit test report for question {question_id}.",
                },
            )
            assert response.status_code == 200, response.text

        limited = client.post(
            f"/api/v2/practice/questions/{question_ids[20]}/reports",
            json={
                "category": "other",
                "description": "This report should exceed the per-user daily cap.",
            },
        )
        assert limited.status_code == 429, limited.text
        assert limited.json()["code"] == "RATE_LIMITED"
        assert _has_audit_action(client, "question_report.rate_limited") is True
