from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_paper


def test_question_favorite_auth_and_csrf_requirements(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        question_id = seed_paper(
            client,
            paper_code="XC-FAV-03",
            title="Favorites Auth",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Favorite auth question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                }
            ],
        )[0]

        unauthenticated = client.post(
            f"/api/v2/practice/questions/{question_id}/favorite",
            json={"note": "x"},
        )
        assert unauthenticated.status_code == 401, unauthenticated.text
        assert unauthenticated.json()["code"] == "auth_required"

        register_user(client)
        client.headers.pop("X-CSRF-Token", None)
        missing_csrf = client.post(
            f"/api/v2/practice/questions/{question_id}/favorite",
            json={"note": "x"},
        )
        assert missing_csrf.status_code == 403, missing_csrf.text
        assert missing_csrf.json()["code"] == "csrf_missing"

        client.headers["X-CSRF-Token"] = "csrf-mismatch"
        mismatch_csrf = client.post(
            f"/api/v2/practice/questions/{question_id}/favorite",
            json={"note": "x"},
        )
        assert mismatch_csrf.status_code == 403, mismatch_csrf.text
        assert mismatch_csrf.json()["code"] == "csrf_mismatch"
