from __future__ import annotations

from datetime import datetime
from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_completed_session, seed_paper


def test_session_mode_custom_respects_wrong_filter(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MODE-CUSTOM",
            title="Custom Mode",
            subject_kind="xingce",
            questions=[
                {"prompt": "Wrong target", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill", "historical_accuracy": 0.3},
                {"prompt": "Done target", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading", "historical_accuracy": 0.3},
                {"prompt": "Fresh target", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "summary", "historical_accuracy": 0.3},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-MODE-CUSTOM",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[False, True, None],
        )
        response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "custom", "mode": "custom", "config": {"count": 1, "only_wrong": True, "difficulty_range": [0.2, 0.4]}},
        )
        assert response.status_code == 200, response.text
        assert response.json()["items"][0]["prompt"] == "Wrong target"


def test_session_mode_custom_respects_exclude_done(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-MODE-DONE",
            title="Custom Done Filter",
            subject_kind="xingce",
            questions=[
                {"prompt": "Done question", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill", "historical_accuracy": 0.3},
                {"prompt": "Fresh question", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading", "historical_accuracy": 0.3},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-MODE-DONE",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True, None],
        )
        response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "custom", "mode": "custom", "config": {"count": 1, "exclude_done": True, "difficulty_range": [0.2, 0.4]}},
        )
        assert response.status_code == 200, response.text
        assert response.json()["items"][0]["prompt"] == "Fresh question"
