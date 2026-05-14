"""Contract tests — Backend API v2 Landing Plan step 2.

把 spec/openapi.json 里的硬契约固化成可执行不变式：
  - camelCase：所有 response 对象 key 都是 camelCase
  - 错误体形状：4xx/5xx body 含 `detail` 字段
  - start endpoint：不泄露 isCorrect / answerKeys / explanation 三字段
  - result.score：0-100 percent 不是答对题数
  - 鉴权错误码：login 密码错=400 / 跨用户=404 / 缺 token=401

后续 step 4/5 会修的项用 `pytest.mark.xfail(strict=True)` 标。strict=True 让
"意外通过"也 fail：step 5 把 schema split 修了 → xfail 标记必须在同一 PR 里
显式删除，强迫 reviewer 看到 contract 状态翻转。

setup 流程参考 tests/test_exam_api.py 的 import → publish 链路；本文件保持
self-contained 不 cross-import，避免测试间隐式耦合。
"""
from __future__ import annotations

import base64
import re
import shutil
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.models import User
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
COMPLEX_PAPER_PATH = FIXTURES_DIR / "complex-paper.json"
SAMPLE_ASSET_PATH = FIXTURES_DIR / "sample-figure.svg"


# --- helpers ----------------------------------------------------------------

@contextmanager
def _client(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        app_version="contract-test",
        git_sha="contract-test",
        image_tag="contract-test",
        build_time="2026-04-26T00:00:00Z",
        schema_version="contract-test",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        session = app.state.db.session_factory()
        try:
            # Identity v2 (#3d): seed users with email so login(identifier=email-form)
            # works. Tests login via "alice@test.local" / "bob@test.local".
            session.add(User(username="alice", email="alice@test.local", display_name="Alice", password_hash=hash_password("alice-pass")))
            session.add(User(username="bob", email="bob@test.local", display_name="Bob", password_hash=hash_password("bob-pass")))
            session.commit()
        finally:
            session.close()
        yield client


def _admin_headers() -> dict[str, str]:
    token = base64.b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


def _publish_complex_paper(client: TestClient, tmp_path: Path) -> int:
    """import + publish complex-paper.json，返回 revision_id。供 start/result 测试用。"""
    target_dir = tmp_path / "import-base"
    target_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SAMPLE_ASSET_PATH, target_dir / SAMPLE_ASSET_PATH.name)

    paper_bytes = COMPLEX_PAPER_PATH.read_bytes()
    response = client.post(
        "/api/v2/admin/import-jobs/standard-json",
        files=[("uploads", (COMPLEX_PAPER_PATH.name, paper_bytes, "application/json"))],
        data={"base_dir": target_dir.as_posix()},
        headers=_admin_headers(),
    )
    assert response.status_code == 200
    revisions = client.get("/api/v2/admin/papers/D1/revisions", headers=_admin_headers()).json()
    revision_id = revisions[0]["id"]
    publish = client.post(
        f"/api/v2/admin/papers/D1/revisions/{revision_id}/publish",
        headers=_admin_headers(),
    )
    assert publish.status_code == 200
    return revision_id


CAMEL_RE = re.compile(r"^[a-z][a-zA-Z0-9]*$")


def _walk_keys(node: Any, path: str = "$") -> Iterator[tuple[str, str]]:
    """递归 yield (path, key) 对，覆盖嵌套 dict / list。"""
    if isinstance(node, dict):
        for key, value in node.items():
            yield path, key
            yield from _walk_keys(value, f"{path}.{key}")
    elif isinstance(node, list):
        for idx, value in enumerate(node):
            yield from _walk_keys(value, f"{path}[{idx}]")


def _assert_all_keys_camel(payload: Any, source: str) -> None:
    bad = [(p, k) for p, k in _walk_keys(payload) if not CAMEL_RE.match(k)]
    if bad:
        sample = ", ".join(f"{p} key={k!r}" for p, k in bad[:5])
        pytest.fail(f"non-camelCase keys in {source} ({len(bad)} total): {sample}")


def _collect_keys(payload: Any) -> set[str]:
    return {k for _, k in _walk_keys(payload)}


ANSWER_FIELD_KEYS = {"isCorrect", "answerKeys", "correctAnswerKeys", "explanation", "explanationText"}


# --- 1. camelCase exhaustive ------------------------------------------------

def test_papers_list_keys_are_camel_case(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        _publish_complex_paper(client, tmp_path)
        response = client.get("/api/v2/papers")
        assert response.status_code == 200
        _assert_all_keys_camel(response.json(), "GET /papers")


def test_login_response_keys_are_camel_case(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@test.local", "password": "alice-pass"},
        )
        assert response.status_code == 200
        _assert_all_keys_camel(response.json(), "POST /auth/login")


def test_practice_start_response_keys_are_camel_case(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        _publish_complex_paper(client, tmp_path)
        response = client.post("/api/v2/practice/papers/D1/start")
        assert response.status_code == 200
        _assert_all_keys_camel(response.json(), "POST /practice/papers/D1/start")


# --- 2. 错误体形状 ----------------------------------------------------------

def test_unauthenticated_endpoint_returns_detail_body(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/api/v2/practice/wrong-questions")
        assert response.status_code == 401
        body = response.json()
        assert "detail" in body, f"401 body 缺 'detail': {body}"


def test_validation_error_returns_detail_body(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        # 缺 password 字段触发 422
        response = client.post("/api/v2/auth/login", json={"identifier": "alice@test.local"})
        assert response.status_code == 422
        body = response.json()
        assert "detail" in body


# --- 3. 缺 token = 401（已对齐契约）-----------------------------------------

def test_missing_token_returns_401(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/api/v2/practice/wrong-questions")
        assert response.status_code == 401


# --- 4. 登录密码错 = 400（xfail；step 4 修）---------------------------------

@pytest.mark.xfail(
    strict=True,
    reason="step 4 (Auth slice) 把 login 失败从 401 改 400，避免前端 axios "
    "interceptor 401 → clearSession 死循环（spec §0.4 + plan §Auth）",
)
def test_login_wrong_password_returns_400_not_401(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.post(
            "/api/v2/auth/login",
            json={"identifier": "alice@test.local", "password": "wrong-password"},
        )
        assert response.status_code == 400


# --- 5. start 不泄露答案三字段 ---------------------------------------------
def test_practice_start_does_not_leak_answers(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        _publish_complex_paper(client, tmp_path)
        response = client.post("/api/v2/practice/papers/D1/start")
        assert response.status_code == 200
        keys = _collect_keys(response.json())
        leaks = keys & ANSWER_FIELD_KEYS
        assert not leaks, f"start payload leaks answer fields: {leaks}"


def test_practice_start_top_level_questions_schema_is_safe() -> None:
    schema = create_app().openapi()
    start_schema = schema["components"]["schemas"]["PracticeSessionStartV2"]
    questions_ref = start_schema["properties"]["questions"]["anyOf"][0]["items"]["$ref"]
    assert questions_ref == "#/components/schemas/PracticeQuestionItemV2"


# --- 6. result.score 是 0-100 percent -------------------------------------
def test_result_score_is_percentage(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        _publish_complex_paper(client, tmp_path)
        # 启动 + 收集所有正确答案 + 交卷
        start = client.post("/api/v2/practice/papers/D1/start")
        assert start.status_code == 200
        session_payload = start.json()
        session_id = session_payload["sessionId"]

        # 从 admin 接口拿正确答案构造提交
        answer_map: dict[str, list[str]] = {}
        for section in session_payload["sections"]:
            for block in section["blocks"]:
                if block["type"] == "question" and block.get("question"):
                    qs = [block["question"]]
                else:
                    qs = (
                        block.get("materialGroup", {}).get("questions", [])
                        if block["type"] == "material_group"
                        else []
                    )
                for question in qs:
                    detail = client.get(
                        f"/api/v2/admin/questions/{question['id']}",
                        headers=_admin_headers(),
                    )
                    assert detail.status_code == 200
                    answer_map[str(question["questionId"])] = detail.json()["answerKeys"]

        complete = client.post(
            f"/api/v2/practice/sessions/{session_id}/complete",
            json={"answers": answer_map},
        )
        assert complete.status_code == 204

        result = client.get(f"/api/v2/practice/sessions/{session_id}/result")
        assert result.status_code == 200
        body = result.json()
        score = body["score"]
        total = body["totalQuestions"]
        correct = body["correctCount"]
        # 全对 → score 应为 100，不是 4
        expected = round(correct / total * 100) if total else 0
        assert score == expected, f"score={score} ≠ percent {expected} (correct={correct}, total={total})"
        assert 0 <= score <= 100


# --- 6. T-C3 真前后端契约对齐 schema 锁 ----------------------------------------

def test_wrong_question_list_response_v2_requires_available_subtypes() -> None:
    """T-C3 真契约对齐 (8feeec4): WrongQuestionListResponseV2.available_subtypes
    不再有 Field(default_factory=list), 必须 required. 防止有人加回 default
    让 OpenAPI 重新标 optional → frontend api.generated.ts 漂移回 optional →
    SSOT 双源再次不对齐.
    """
    from pydantic import ValidationError

    from sikao_api.db import schemas

    with pytest.raises(ValidationError) as exc_info:
        schemas.WrongQuestionListResponseV2(
            items=[],
            total=0,
            page=1,
            page_size=20,
            available_subjects=[],
            # 故意缺 available_subtypes — 应触发 ValidationError.
        )  # type: ignore[call-arg]
    # CamelModel 报错走 camelCase 字段名 (availableSubtypes), 非 snake_case.
    assert "availableSubtypes" in str(exc_info.value)
