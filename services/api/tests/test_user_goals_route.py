"""Phase 5.5 fenbi-merge — GET/PUT /api/v2/me/goals integration tests.

覆盖:
  - 401 未登录
  - 未设置 → has_goal=False, target_score=None
  - PUT 60 → insert, GET 返 60
  - PUT 60 → PUT 70 → upsert (update, 不重复 row)
  - PUT 越界 (-1 / 200) → 422 校验
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password


@contextmanager
def _build_client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        llm_api_key="sk-test-key",
        llm_base_url="https://api.deepseek.com/v1",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, settings


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, Settings]]:
    with _build_client(tmp_path) as (c, s):
        yield c, s


def _register(c: TestClient) -> None:
    resp = c.post(
        "/api/v2/auth/register/email",
        json={"email": "alice@test.local", "password": "passw0rd", "displayName": "alice"},
    )
    assert resp.status_code == 200, resp.text


def test_goals_anonymous_returns_401(client) -> None:
    c, _ = client
    assert c.get("/api/v2/me/goals").status_code == 401
    assert c.put("/api/v2/me/goals", json={"targetScore": 60}).status_code == 401


def test_goals_unset_returns_has_goal_false(client) -> None:
    c, _ = client
    _register(c)
    resp = c.get("/api/v2/me/goals")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"hasGoal": False, "targetScore": None}


def test_goals_put_inserts_and_get_returns(client) -> None:
    c, _ = client
    _register(c)
    put_resp = c.put("/api/v2/me/goals", json={"targetScore": 65})
    assert put_resp.status_code == 200, put_resp.text
    assert put_resp.json() == {"hasGoal": True, "targetScore": 65}

    get_resp = c.get("/api/v2/me/goals")
    assert get_resp.json() == {"hasGoal": True, "targetScore": 65}


def test_goals_put_twice_upserts_no_duplicate(client) -> None:
    c, _ = client
    _register(c)
    c.put("/api/v2/me/goals", json={"targetScore": 60})
    second = c.put("/api/v2/me/goals", json={"targetScore": 72})
    assert second.json() == {"hasGoal": True, "targetScore": 72}
    # Sanity: GET 也是 72 (不是返第一次插的 row)
    assert c.get("/api/v2/me/goals").json()["targetScore"] == 72


def test_goals_put_negative_score_422(client) -> None:
    c, _ = client
    _register(c)
    resp = c.put("/api/v2/me/goals", json={"targetScore": -1})
    assert resp.status_code == 422


def test_goals_put_above_max_score_422(client) -> None:
    c, _ = client
    _register(c)
    resp = c.put("/api/v2/me/goals", json={"targetScore": 200})
    assert resp.status_code == 422
