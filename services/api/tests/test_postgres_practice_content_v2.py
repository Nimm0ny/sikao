from __future__ import annotations

from datetime import datetime
import os
from pathlib import Path

import pytest

from _helpers.practice_content_support import (
    build_postgres_client,
    register_user,
    seed_completed_session,
    seed_paper,
)


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRESQL_URL"), reason="TEST_POSTGRESQL_URL is not set")
def test_postgres_xingce_content_filters_and_completion(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-PG-2024-01",
            title="Xingce PG 2024",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "A",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                    "historical_accuracy": 0.2,
                },
                {
                    "prompt": "B",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "reading",
                    "historical_accuracy": 0.3,
                },
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-PG-2024-01",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True, False],
        )

        categories = client.get("/api/v2/practice/xingce/categories?level=1")
        assert categories.status_code == 200, categories.text
        assert categories.json()["items"][0]["categoryL1"] == "verbal"

        response = client.get(
            "/api/v2/practice/xingce/papers?"
            "category_l1=verbal&category_l2=logic_fill&year=2024&region=beijing"
            "&exam_type=provincial&sort=recent"
        )
        assert response.status_code == 200, response.text
        items = response.json()["items"]
        assert len(items) == 1
        item = items[0]
        assert item["paperCode"] == "XC-PG-2024-01"
        assert item["isCompleted"] is True
        assert item["bestScore"] == 50.0
        assert item["difficulty"] == "hard"
