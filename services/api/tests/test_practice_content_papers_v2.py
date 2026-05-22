from __future__ import annotations

from datetime import datetime
from pathlib import Path

from _helpers.practice_content_support import (
    build_client,
    register_user,
    seed_completed_session,
    seed_paper,
)


def test_xingce_papers_filters_and_completion(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
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
        seed_paper(
            client,
            paper_code="XC-2023-01",
            title="Xingce 2023",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "C",
                    "year": 2023,
                    "region": "shanghai",
                    "exam_type": "national",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                    "historical_accuracy": 0.8,
                }
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-2024-01",
            answer_outcomes=[True, False],
        )

        response = client.get(
            "/api/v2/practice/xingce/papers?"
            "category_l1=verbal&category_l2=logic_fill&year=2024&region=beijing"
            "&exam_type=provincial&sort=difficulty"
        )
        assert response.status_code == 200, response.text
        items = response.json()["items"]
        assert len(items) == 1
        item = items[0]
        assert item["paperCode"] == "XC-2024-01"
        assert item["isCompleted"] is True
        assert item["bestScore"] == 50.0
        assert item["categoryL2"] == "logic_fill"
        assert item["difficulty"] == "hard"
        assert item["year"] == 2024
        assert item["region"] == "beijing"


def test_xingce_papers_filter_conditions_must_match_same_question(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        seed_paper(
            client,
            paper_code="XC-MIXED-01",
            title="Xingce Mixed",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "A",
                    "year": 2024,
                    "region": "guangdong",
                    "exam_type": "national",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                },
                {
                    "prompt": "B",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "numeric",
                    "category_l2": "calculation",
                },
            ],
        )
        seed_paper(
            client,
            paper_code="XC-MATCH-01",
            title="Xingce Match",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "C",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )

        response = client.get(
            "/api/v2/practice/xingce/papers?"
            "category_l1=verbal&category_l2=logic_fill&year=2024&region=beijing&exam_type=provincial"
        )
        assert response.status_code == 200, response.text
        assert [item["paperCode"] for item in response.json()["items"]] == ["XC-MATCH-01"]


def test_xingce_papers_recent_sort_handles_answerless_completed_sessions(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
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
                    "historical_accuracy": 0.2,
                }
            ],
        )
        seed_paper(
            client,
            paper_code="XC-2023-01",
            title="Xingce 2023",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "B",
                    "year": 2023,
                    "region": "shanghai",
                    "exam_type": "national",
                    "category_l1": "judgement",
                    "category_l2": "logic",
                    "historical_accuracy": 0.8,
                }
            ],
        )
        seed_paper(
            client,
            paper_code="XC-2022-01",
            title="Xingce 2022",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "C",
                    "year": 2022,
                    "region": "guangdong",
                    "exam_type": "provincial",
                    "category_l1": "numeric",
                    "category_l2": "calculation",
                    "historical_accuracy": 0.6,
                }
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-2023-01",
            submitted_at=datetime(2026, 5, 22, 9, 0, 0),
            answer_outcomes=[True],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-2024-01",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=None,
        )

        response = client.get("/api/v2/practice/xingce/papers?sort=recent")
        assert response.status_code == 200, response.text
        items = response.json()["items"]
        assert [item["paperCode"] for item in items] == [
            "XC-2024-01",
            "XC-2023-01",
            "XC-2022-01",
        ]
        assert items[0]["isCompleted"] is True
        assert items[0]["bestScore"] is None
        assert items[1]["bestScore"] == 100.0
        assert items[2]["isCompleted"] is False


def test_public_papers_ignore_invalid_optional_session(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        seed_paper(
            client,
            paper_code="XC-PUBLIC-01",
            title="Xingce Public",
            subject_kind="xingce",
            questions=[
                {
                    "prompt": "A",
                    "year": 2024,
                    "region": "beijing",
                    "exam_type": "provincial",
                    "category_l1": "verbal",
                    "category_l2": "logic_fill",
                }
            ],
        )
        client.cookies.set("auth_session_v2", "stale-session-token")

        response = client.get("/api/v2/practice/xingce/papers")
        assert response.status_code == 200, response.text
        assert response.json()["items"][0]["paperCode"] == "XC-PUBLIC-01"
        assert response.json()["items"][0]["isCompleted"] is False


def test_essay_categories_and_papers_use_category_filters(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        seed_paper(
            client,
            paper_code="ES-2024-01",
            title="Essay 2024",
            subject_kind="essay",
            questions=[
                {
                    "prompt": "Essay A",
                    "year": 2024,
                    "region": "guokao",
                    "exam_type": "national",
                    "category_l1": "argument",
                    "category_l2": "summary",
                }
            ],
        )

        categories = client.get("/api/v2/practice/essay/categories?level=1")
        assert categories.status_code == 200, categories.text
        assert categories.json()["items"][0]["categoryL1"] == "argument"

        papers = client.get("/api/v2/practice/essay/papers?category_l1=argument&category_l2=summary&year=2024")
        assert papers.status_code == 200, papers.text
        items = papers.json()["items"]
        assert len(items) == 1
        assert items[0]["paperCode"] == "ES-2024-01"
        assert items[0]["categoryL2"] == "summary"
