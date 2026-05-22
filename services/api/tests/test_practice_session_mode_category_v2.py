from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_paper


def test_session_mode_category_picks_filtered_questions(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-MODE-CAT",
            title="Category Mode",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
                {"prompt": "C", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "numeric", "category_l2": "calculation"},
            ],
        )

        response = client.post(
            "/api/v2/practice/sessions",
            json={
                "track": "xingce",
                "entryKind": "category",
                "mode": "category",
                "practiceMode": "full_set",
                "config": {"category_l1": "verbal", "count": 2},
            },
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["sourceMode"] == "category"
        assert payload["practiceMode"] == "full_set"
        assert len(payload["items"]) == 2
        assert payload["configSnapshot"]["category_l1"] == "verbal"
        assert len(payload["configSnapshot"]["question_ids"]) == 2
