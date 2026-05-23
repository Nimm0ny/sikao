from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_paper


def test_non_paper_mode_rejects_paper_binding_mix(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        seed_paper(
            client,
            paper_code="XC-MODE-MIX",
            title="Mode Conflict",
            subject_kind="xingce",
            questions=[{"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"}],
        )
        response = client.post(
            "/api/v2/practice/sessions",
            json={"track": "xingce", "entryKind": "daily", "mode": "daily", "paperCode": "XC-MODE-MIX", "config": {"daily_practice_id": 1}},
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "practice_session_mode_conflict"
