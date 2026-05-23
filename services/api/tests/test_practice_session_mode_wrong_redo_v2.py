from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_paper, seed_review_item


def test_session_mode_wrong_redo_picks_pending_review_items(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        question_ids = seed_paper(
            client,
            paper_code="XC-MODE-REDO",
            title="Wrong Redo Mode",
            subject_kind="xingce",
            questions=[
                {"prompt": "Redo A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
                {"prompt": "Redo B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading"},
            ],
        )
        seed_review_item(client, user_id=user_id, question_id=question_ids[0], title="Redo A")
        seed_review_item(client, user_id=user_id, question_id=question_ids[1], title="Redo B", status="resolved")

        response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "wrong_redo", "mode": "wrong_redo", "config": {"count": 1}},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["sourceMode"] == "wrong_redo"
        assert payload["items"][0]["prompt"] == "Redo A"


def test_session_mode_wrong_redo_filters_track_and_deduplicates_queue(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        xingce_question = seed_paper(
            client,
            paper_code="XC-MODE-REDO-X",
            title="Wrong Redo Xingce",
            subject_kind="xingce",
            questions=[{"prompt": "Xingce Q", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )[0]
        essay_question = seed_paper(
            client,
            paper_code="ES-MODE-REDO-E",
            title="Wrong Redo Essay",
            subject_kind="essay",
            questions=[{"prompt": "Essay Q", "year": 2024, "region": "guokao", "exam_type": "national", "category_l1": "argument", "category_l2": "summary"}],
        )[0]
        seed_review_item(client, user_id=user_id, question_id=xingce_question, title="Redo X1")
        seed_review_item(client, user_id=user_id, question_id=xingce_question, title="Redo X2")
        seed_review_item(client, user_id=user_id, question_id=essay_question, title="Redo Essay")

        response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "wrong_redo", "mode": "wrong_redo", "config": {"count": 1}},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert [item["prompt"] for item in payload["items"]] == ["Xingce Q"]
        assert len(payload["configSnapshot"]["review_item_ids"]) == 1
