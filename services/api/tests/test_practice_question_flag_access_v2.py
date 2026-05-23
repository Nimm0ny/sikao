from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_paper


def test_question_flag_owner_scope_returns_404_for_other_user(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client, email="owner@example.com", display_name="Owner")
        question_id = seed_paper(
            client,
            paper_code="XC-FLAG-04",
            title="Flags Scope",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Owner question",
                    "year": 2024,
                    "region": "guangdong",
                    "exam_type": "provincial",
                    "category_l1": "numeric",
                    "category_l2": "calculation",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert created.status_code == 200, created.text

        register_user(client, email="viewer@example.com", display_name="Viewer")
        resolve_foreign = client.patch(f"/api/v2/practice/questions/{question_id}/flag/resolve")
        assert resolve_foreign.status_code == 404, resolve_foreign.text
        assert resolve_foreign.json()["code"] == "question_flag_not_found"

        delete_foreign = client.delete(f"/api/v2/practice/questions/{question_id}/flag")
        assert delete_foreign.status_code == 404, delete_foreign.text
        assert delete_foreign.json()["code"] == "question_flag_not_found"


def test_question_flag_auth_and_csrf_requirements(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        question_id = seed_paper(
            client,
            paper_code="XC-FLAG-05",
            title="Flags Auth",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Auth question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                }
            ],
        )[0]

        unauthenticated = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert unauthenticated.status_code == 401, unauthenticated.text
        assert unauthenticated.json()["code"] == "auth_required"

        register_user(client)
        client.headers.pop("X-CSRF-Token", None)
        missing_csrf = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert missing_csrf.status_code == 403, missing_csrf.text
        assert missing_csrf.json()["code"] == "csrf_missing"

        client.headers["X-CSRF-Token"] = "csrf-mismatch"
        mismatch_csrf = client.post(
            f"/api/v2/practice/questions/{question_id}/flag",
            json={"reason": "uncertain"},
        )
        assert mismatch_csrf.status_code == 403, mismatch_csrf.text
        assert mismatch_csrf.json()["code"] == "csrf_mismatch"
