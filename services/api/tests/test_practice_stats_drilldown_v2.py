from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

from _helpers.practice_content_support import build_client, register_user, seed_completed_session, seed_paper


def test_practice_stats_realtime_trend_and_cross(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-STATS-03",
            title="Stats Drilldown",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill", "historical_accuracy": 0.2},
                {"prompt": "B", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "reading", "historical_accuracy": 0.8},
            ],
        )
        seed_completed_session(
            client,
            user_id=user_id,
            paper_code="XC-STATS-03",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True, False],
        )

        realtime = client.get("/api/v2/practice/stats/realtime?type=xingce&category=verbal")
        assert realtime.status_code == 200, realtime.text
        assert realtime.json()["overall"]["totalQuestions"] == 2
        assert realtime.json()["overall"]["accuracy"] == 0.5

        trend = client.get("/api/v2/practice/stats/trend?type=xingce&period=30d&category=verbal")
        assert trend.status_code == 200, trend.text
        assert len(trend.json()["points"]) == 1
        assert trend.json()["points"][0]["accuracy"] == 0.5

        cross = client.get("/api/v2/practice/stats/cross?type=xingce&category=verbal")
        assert cross.status_code == 200, cross.text
        difficulties = {item["difficulty"] for item in cross.json()["items"]}
        assert difficulties == {"easy", "hard"}


def test_practice_stats_trend_respects_period_without_recent_limit(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        user_id = register_user(client)
        seed_paper(
            client,
            paper_code="XC-STATS-06",
            title="Stats Trend Limit",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        for day in range(11):
            seed_completed_session(
                client,
                user_id=user_id,
                paper_code="XC-STATS-06",
                submitted_at=(datetime(2026, 5, 23, 9, 0, 0) - timedelta(days=day)),
                answer_outcomes=[True],
            )

        trend = client.get("/api/v2/practice/stats/trend?type=xingce&period=30d&category=verbal")
        assert trend.status_code == 200, trend.text
        assert len(trend.json()["points"]) == 11
