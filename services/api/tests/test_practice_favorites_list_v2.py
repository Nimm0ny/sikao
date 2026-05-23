from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_paper


def test_question_favorite_create_list_count_and_delete(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        register_user(client)
        question_id = seed_paper(
            client,
            paper_code="XC-FAV-01",
            title="Favorites Sample",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "Favorite question",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )[0]

        created = client.post(
            f"/api/v2/practice/questions/{question_id}/favorite",
            json={"note": "keep this one"},
        )
        assert created.status_code == 200, created.text
        created_payload = created.json()
        assert created_payload["questionId"] == question_id
        assert created_payload["note"] == "keep this one"
        assert created_payload["type"] == "xingce"

        count = client.get("/api/v2/practice/favorites/count")
        assert count.status_code == 200, count.text
        assert count.json() == {"count": 1}

        listing = client.get("/api/v2/practice/favorites?type=xingce&category=verbal")
        assert listing.status_code == 200, listing.text
        items = listing.json()["items"]
        assert len(items) == 1
        assert items[0]["questionId"] == question_id
        assert items[0]["questionStatus"] == "active"

        removed = client.delete(f"/api/v2/practice/questions/{question_id}/favorite")
        assert removed.status_code == 200, removed.text
        assert removed.json() == {"ok": True, "status": "deleted"}

        count_after = client.get("/api/v2/practice/favorites/count")
        assert count_after.status_code == 200, count_after.text
        assert count_after.json() == {"count": 0}
