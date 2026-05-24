from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, cast

from sqlalchemy import text

from _helpers.practice_content_support import build_client, register_user, seed_completed_session, seed_paper
from sikao_api.modules.practice_stats.application.snapshot_writer import recompute_user_stats


def test_practice_stats_percentile_reads_from_snapshot_family(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        alpha_id = register_user(client, email="alpha@example.com", display_name="Alpha")
        seed_paper(
            client,
            paper_code="XC-STATS-04",
            title="Stats Percentile",
            subject_kind="xingce",
            questions=[
                {"prompt": "A", "year": 2024, "region": "beijing", "exam_type": "provincial", "category_l1": "verbal", "category_l2": "logic_fill"},
            ],
        )
        seed_completed_session(
            client,
            user_id=alpha_id,
            paper_code="XC-STATS-04",
            submitted_at=datetime(2026, 5, 23, 9, 0, 0),
            answer_outcomes=[True],
        )
        beta_id = register_user(client, email="beta@example.com", display_name="Beta")
        seed_completed_session(
            client,
            user_id=beta_id,
            paper_code="XC-STATS-04",
            submitted_at=datetime(2026, 5, 23, 10, 0, 0),
            answer_outcomes=[False],
        )
        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            recompute_user_stats(session, user_id=beta_id)
            session.commit()

        login = client.post("/api/v2/auth/login", json={"identifier": "alpha@example.com", "password": "secret123"})
        assert login.status_code == 200, login.text
        client.headers["X-CSRF-Token"] = login.cookies["csrf_token_v2"]

        percentile = client.get("/api/v2/practice/stats/percentile?type=xingce&category=verbal")
        assert percentile.status_code == 200, percentile.text
        assert percentile.json()["percentileRank"] == 1.0

        with factory() as session:
            alpha_snapshot = session.execute(
                text(
                    """
                    SELECT total_questions, percentile_rank
                    FROM practice_stats_snapshot_v2
                    WHERE user_id = :user_id AND type = 'xingce' AND scope = 'category_l1' AND category_key = 'verbal'
                    """
                ),
                {"user_id": alpha_id},
            ).one()
        assert alpha_snapshot == (1, 1.0)

        no_l2_inference = client.get("/api/v2/practice/stats/percentile?type=xingce&category=logic_fill")
        assert no_l2_inference.status_code == 200, no_l2_inference.text
        assert no_l2_inference.json()["percentileRank"] is None

        seed_completed_session(
            client,
            user_id=alpha_id,
            paper_code="XC-STATS-04",
            submitted_at=datetime(2026, 5, 23, 11, 0, 0),
            answer_outcomes=[True],
        )

        percentile_after_update = client.get("/api/v2/practice/stats/percentile?type=xingce&category=verbal")
        assert percentile_after_update.status_code == 200, percentile_after_update.text
        assert percentile_after_update.json()["percentileRank"] == 1.0

        login_beta = client.post("/api/v2/auth/login", json={"identifier": "beta@example.com", "password": "secret123"})
        assert login_beta.status_code == 200, login_beta.text
        client.headers["X-CSRF-Token"] = login_beta.cookies["csrf_token_v2"]

        beta_percentile = client.get("/api/v2/practice/stats/percentile?type=xingce&category=verbal")
        assert beta_percentile.status_code == 200, beta_percentile.text
        assert beta_percentile.json()["percentileRank"] == 0.5

        empty_overall = client.get("/api/v2/practice/stats/percentile?type=essay")
        assert empty_overall.status_code == 200, empty_overall.text
        assert empty_overall.json()["percentileRank"] is None
