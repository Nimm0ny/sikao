from __future__ import annotations

from pathlib import Path

from _helpers.practice_content_support import build_client, seed_paper


def test_xingce_categories_levels_and_filters(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        seed_paper(
            client,
            paper_code="XC-2024-01",
            title="Xingce 2024",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "A",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "B",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                },
            ],
        )

        level1 = client.get("/api/v2/practice/xingce/categories?level=1")
        assert level1.status_code == 200, level1.text
        level1_items = level1.json()["items"]
        assert level1_items[0]["categoryL1"] == "verbal"
        assert level1_items[0]["count"] == 2

        level2 = client.get("/api/v2/practice/xingce/categories?level=2&category_l1=verbal")
        assert level2.status_code == 200, level2.text
        level2_items = level2.json()["items"]
        level2_titles = {item["title"] for item in level2_items}
        assert level2_titles == {"logic_fill", "reading"}
        level2_hrefs = {item["title"]: item["href"] for item in level2_items}
        assert level2_hrefs["logic_fill"].endswith(
            "/practice/xingce/papers?category_l1=verbal&category_l2=logic_fill"
        )

        legacy_level2 = client.get("/api/v2/practice/xingce/categories?level=2&categoryL1=verbal")
        assert legacy_level2.status_code == 200, legacy_level2.text

        conflict = client.get(
            "/api/v2/practice/xingce/categories?level=2&category_l1=verbal&categoryL1=numeric"
        )
        assert conflict.status_code == 422, conflict.text
        assert conflict.json()["code"] == "category_l1_query_conflict"
