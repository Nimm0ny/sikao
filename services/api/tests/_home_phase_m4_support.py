from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import PlanEventV2, PlanV2, UserV2
from sikao_api.main import create_app


@contextmanager
def build_client(tmp_path: Path) -> Iterator[tuple[TestClient, FastAPI]]:
    settings = Settings(
        app_env="test",
        llm_provider="mock",
        database_url=f"sqlite:///{(tmp_path / 'home-m4.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="home-m4-secret",
        app_version="home-m4-test",
        git_sha="home-m4-sha",
        image_tag="home-m4-tag",
        build_time="2026-05-21T00:00:00Z",
        schema_version="home-m4-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def register_user(client: TestClient) -> None:
    response = client.post(
        "/api/v2/auth/register/email",
        json={"email": "alice@example.com", "password": "secret123", "displayName": "Alice"},
    )
    assert response.status_code == 200, response.text
    client.headers["X-CSRF-Token"] = response.cookies["csrf_token_v2"]


def parse_sse_frames(text: str) -> list[dict[str, object]]:
    frames: list[dict[str, object]] = []
    for chunk in text.split("\n\n"):
        chunk = chunk.strip()
        if not chunk or not chunk.startswith("data: "):
            continue
        frames.append(json.loads(chunk[len("data: "):]))
    return frames


def seed_active_plan(*, user: UserV2, name: str) -> PlanV2:
    return PlanV2(
        user_id=user.id,
        name=name,
        target_exam_id="guokao-2027",
        target_exam_date=datetime(2027, 11, 26).date(),
        daily_minutes_target=180,
        style="balanced",
        baseline={},
        focus_subjects=["xingce"],
        status="active",
        source="user_manual",
        change_log=[],
    )


def seed_plan_event(*, user: UserV2, plan_id: int, title: str = "Existing event") -> PlanEventV2:
    return PlanEventV2(
        plan_id=plan_id,
        user_id=user.id,
        title=title,
        category="custom",
        notes="replace me",
        start_at=datetime(2027, 11, 20, 2, 0),
        end_at=datetime(2027, 11, 20, 3, 0),
        timezone="Asia/Shanghai",
        status="planned",
        source="user_manual",
        recurring_exception_dates=[],
        change_log=[],
    )
