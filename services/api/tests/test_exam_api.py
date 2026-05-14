from __future__ import annotations

import base64
import json
import shutil
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from sikao_api.core.config import Settings
from sikao_api.db.models import PracticeSessionAnswer, User
from sikao_api.main import create_app
from sikao_api.modules.auth.application.security import hash_password

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
COMPLEX_PAPER_PATH = FIXTURES_DIR / "complex-paper.json"
SAMPLE_ASSET_PATH = FIXTURES_DIR / "sample-figure.svg"


def admin_headers(username: str = "admin", password: str = "adminpass") -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode()).decode("ascii")
    return {"Authorization": f"Basic {token}"}


def bearer_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def assert_utc_timestamp(value: str | None) -> None:
    assert isinstance(value, str)
    assert value.endswith("Z")


@contextmanager
def build_client(tmp_path: Path):
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
        app_version="test-version",
        git_sha="test-sha",
        image_tag="test-tag",
        build_time="2026-04-22T00:00:00Z",
        schema_version="test-schema",
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


def login(client: TestClient, username: str, password: str) -> str:
    """Login + return JWT (extracted from auth_token cookie).

    Post-Phase D N3: access_token 不再在 body, 仅 auth_token cookie. Helper
    从 cookie 拿出 token 然后 clear cookie jar (让后续 bearer_headers(token)
    真测 bearer path), 同时保留 csrf_token cookie + X-CSRF-Token header 让
    state-mutating 调用通过 CSRF.
    """
    response = client.post("/api/v2/auth/login", json={"identifier": f"{username}@test.local", "password": password})
    assert response.status_code == 200
    auth_token = response.cookies["auth_token"]
    csrf = response.cookies.get("csrf_token")
    client.cookies.clear()
    if csrf is not None:
        client.cookies.set("csrf_token", csrf)
        client.headers["X-CSRF-Token"] = csrf
    return auth_token


def load_complex_payload() -> dict[str, Any]:
    return json.loads(COMPLEX_PAPER_PATH.read_text(encoding="utf-8"))


def encode_payload(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def prepare_nested_paper(root_dir: Path, relative_dir: str, *, paper_code: str, paper_name: str) -> tuple[str, bytes]:
    payload = load_complex_payload()
    payload["paperCode"] = paper_code
    payload["paperName"] = paper_name

    target_dir = root_dir / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SAMPLE_ASSET_PATH, target_dir / SAMPLE_ASSET_PATH.name)

    filename = f"{relative_dir.replace('\\', '/')}/{paper_code.lower()}.standard.json"
    return filename, encode_payload(payload)


def import_standard_json(client: TestClient, *, files: list[tuple[str, bytes]], base_dir: Path) -> dict[str, Any]:
    response = client.post(
        "/api/v2/admin/import-jobs/standard-json",
        files=[("uploads", (filename, content, "application/json")) for filename, content in files],
        data={"base_dir": base_dir.as_posix()},
        headers=admin_headers(),
    )
    assert response.status_code == 200
    return response.json()


def publish_revision(
    client: TestClient,
    paper_code: str,
    revision_id: int,
    *,
    execution_id: str | None = None,
) -> dict[str, Any]:
    headers = admin_headers()
    if execution_id:
        headers["X-Release-Execution-Id"] = execution_id
    response = client.post(f"/api/v2/admin/papers/{paper_code}/revisions/{revision_id}/publish", headers=headers)
    assert response.status_code == 200
    return response.json()


def iter_session_questions(session_payload: dict[str, Any]) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    for section in session_payload["sections"]:
        for block in section["blocks"]:
            if block["type"] == "question" and block.get("question"):
                questions.append(block["question"])
            elif block["type"] == "material_group" and block.get("materialGroup"):
                questions.extend(block["materialGroup"].get("questions", []))
    return questions


def build_answer_map(client: TestClient, session_payload: dict[str, Any]) -> dict[str, list[str]]:
    answers: dict[str, list[str]] = {}
    for question in iter_session_questions(session_payload):
        detail_response = client.get(f"/api/v2/admin/questions/{question['id']}", headers=admin_headers())
        assert detail_response.status_code == 200
        answers[str(question["questionId"])] = detail_response.json()["answerKeys"]
    return answers


def test_admin_basic_auth_and_user_jwt_login(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        assert client.get("/api/v2/admin/papers").status_code == 401
        assert client.get("/api/v2/admin/papers", headers=admin_headers(password="wrong")).status_code == 401

        login_response = client.post("/api/v2/auth/login", json={"identifier": "alice@test.local", "password": "alice-pass"})
        assert login_response.status_code == 200
        # Post-Phase D N3: token 从 auth_token cookie 取 (body 不再 echo).
        token = login_response.cookies["auth_token"]

        # Post-Phase D P2-1: 清 cookie jar 让 bearer_headers 真走 bearer path
        # (cookie precedence > bearer 否则 /me 仍走 cookie auth 而非测试期望的 Bearer).
        client.cookies.clear()
        me_response = client.get("/api/v2/auth/me", headers=bearer_headers(token))
        assert me_response.status_code == 200
        assert me_response.json()["username"] == "alice"


def test_register_creates_user_and_returns_token(tmp_path: Path) -> None:
    """Identity v2 (#3d): /register/email 创建账户 + cookie + csrf."""
    with build_client(tmp_path) as client:
        resp = client.post(
            "/api/v2/auth/register/email",
            json={"email": "newbie@test.local", "password": "secret123", "displayName": "New User"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # Identity v2: username=NULL for email-registered users; 检查 email + display.
        assert body["user"]["email"] == "newbie@test.local"
        assert body["user"]["username"] is None
        assert body["user"]["displayName"] == "New User"
        assert "auth_token" in resp.cookies

        # cookie 立即可用 (无需手动 inject Authorization, 后续请求 cookie 自动跟)
        me = client.get("/api/v2/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == "newbie@test.local"


def test_register_rejects_taken_email(tmp_path: Path) -> None:
    """Identity v2: register 时 email 冲突 → 409 code=email_taken."""
    with build_client(tmp_path) as client:
        # alice 已在 fixture 里 (email="alice@test.local")
        resp = client.post(
            "/api/v2/auth/register/email",
            json={"email": "alice@test.local", "password": "anothersecret"},
        )
        assert resp.status_code == 409
        assert resp.json()["code"] == "email_taken"


def test_register_rejects_short_password(tmp_path: Path) -> None:
    """password < 6 字符 → 422 (pydantic Field min_length)."""
    with build_client(tmp_path) as client:
        resp = client.post(
            "/api/v2/auth/register/email",
        json={"email": "shorty@test.local", "password": "abc"},
        )
        assert resp.status_code == 422


def test_login_sets_auth_cookie(tmp_path: Path) -> None:
    """P1 review fix Phase B.2: login 同时 Set-Cookie httpOnly auth_token."""
    with build_client(tmp_path) as client:
        resp = client.post("/api/v2/auth/login", json={"identifier": "alice@test.local", "password": "alice-pass"})
        assert resp.status_code == 200
        # cookie set + 是合法 JWT (decode 成功)
        assert "auth_token" in resp.cookies
        cookie_value = resp.cookies["auth_token"]
        assert cookie_value
        # raw Set-Cookie header has HttpOnly + SameSite (TestClient strips them
        # from .cookies but exposes via headers)
        set_cookie_headers = [v for k, v in resp.headers.multi_items() if k.lower() == "set-cookie"]
        joined = " ".join(set_cookie_headers).lower()
        assert "httponly" in joined
        assert "samesite=strict" in joined
        # Post-Phase D N3: body 不再 echo accessToken — 仅 cookie 渠道.
        assert "accessToken" not in resp.json()


def test_register_sets_auth_cookie(tmp_path: Path) -> None:
    """P1 review fix Phase B.2: register 同样 Set-Cookie."""
    with build_client(tmp_path) as client:
        resp = client.post(
            "/api/v2/auth/register/email",
        json={"email": "cookie_user@test.local", "password": "secret123"},
        )
        assert resp.status_code == 200
        assert "auth_token" in resp.cookies
        # Post-Phase D N3: cookie 唯一 source of truth, body 不 echo accessToken.
        assert "accessToken" not in resp.json()


def test_logout_clears_auth_cookie_and_returns_204(tmp_path: Path) -> None:
    """P1 review fix Phase B.2 + B.3: logout endpoint 清 cookie, 204 No Content,
    require CSRF (D4 防恶意 force logout)."""
    with build_client(tmp_path) as client:
        # Login first to plant cookies (auth + csrf). Use helper since it
        # carries the csrf header forward for subsequent state-mutating calls.
        login(client, "alice", "alice-pass")
        assert client.cookies.get("csrf_token") is not None

        logout_resp = client.post("/api/v2/auth/logout")
        assert logout_resp.status_code == 204
        # Set-Cookie deletion appears as expires=past header
        set_cookie = " ".join(
            v for k, v in logout_resp.headers.multi_items() if k.lower() == "set-cookie"
        ).lower()
        assert "auth_token=" in set_cookie
        # cookie deletion = max-age=0 OR expires in past (depends on httpx)
        assert "max-age=0" in set_cookie or "expires=" in set_cookie


def test_logout_without_csrf_token_403(tmp_path: Path) -> None:
    """P1 review fix Phase B.3: logout 没 CSRF token → 403."""
    with build_client(tmp_path) as client:
        client.post("/api/v2/auth/login", json={"identifier": "alice@test.local", "password": "alice-pass"})
        # 不通过 helper, 不注入 X-CSRF-Token header
        # 但 csrf_token cookie 在 jar 中. 缺 header → 403
        logout_resp = client.post("/api/v2/auth/logout")
        assert logout_resp.status_code == 403


def test_csrf_mismatch_blocks_authenticated_state_change(tmp_path: Path) -> None:
    """P1 review fix Phase B.3: cookie csrf != header csrf → 403."""
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        # Override header to a wrong value, cookie stays
        logout_resp = client.post(
            "/api/v2/auth/logout",
            headers={"X-CSRF-Token": "tampered-value"},
        )
        assert logout_resp.status_code == 403
        assert logout_resp.json()["code"] == "csrf_mismatch"
        # token 仍可用 — confirm logout 没成功
        me = client.get("/api/v2/auth/me", headers=bearer_headers(token))
        assert me.status_code == 200


def test_anonymous_practice_start_works_without_csrf(tmp_path: Path) -> None:
    """Post-Phase D P0-1: 匿名用户调 practice/start 没 cookie 没 csrf header → OK.

    verify_csrf_token_if_cookie_auth 在 cookie 缺失时跳过校验.
    """
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        publish_revision(client, "D1", import_payload["items"][0]["revisionId"])
        # 匿名 — 无 Authorization, 无 cookie, 无 X-CSRF-Token.
        resp = client.post("/api/v2/practice/papers/D1/start")
        assert resp.status_code == 200, resp.json()


def test_refresh_reissues_auth_and_csrf_cookies(tmp_path: Path) -> None:
    """Post-Phase D P1-2: /auth/refresh 续 cookie, 不需要重新输入凭据.

    跳过 login() helper (它 clear auth cookie 让 bearer test 隔离), 直接 post
    /auth/login 让 auth_token + csrf_token cookies 都在 jar.

    P1 review fix (#3e): /refresh response.user 走 serialize_user 跟 /me 同
    source — 必须含 phone / phone_verified / needs_identifier_setup 派生字段.
    """
    with build_client(tmp_path) as client:
        login_resp = client.post(
            "/api/v2/auth/login", json={"identifier": "alice@test.local", "password": "alice-pass"}
        )
        csrf = login_resp.cookies["csrf_token"]
        old_auth = login_resp.cookies["auth_token"]
        # cookies 在 jar, csrf header 手动注入.
        refresh_resp = client.post(
            "/api/v2/auth/refresh", headers={"X-CSRF-Token": csrf}
        )
        assert refresh_resp.status_code == 200
        assert "auth_token" in refresh_resp.cookies
        assert "csrf_token" in refresh_resp.cookies
        # Post-Phase D N4: jti payload field 让同秒 refresh 也产生不同 token.
        # body 不再 echo access_token (N3), 从 cookie 取.
        new_token = refresh_resp.cookies["auth_token"]
        assert new_token != old_auth, "jti payload should make tokens unique even within same second"
        # P1 review fix (#3e): refresh response.user 必须含全部 identity v2 字段
        # (跟 /me 同 serialize_user 来源, 不是手 build).
        user = refresh_resp.json()["user"]
        assert "email" in user and user["email"] == "alice@test.local"
        assert "phone" in user
        assert "needsIdentifierSetup" in user
        assert user["needsIdentifierSetup"] is False  # alice 有 email, 已补全
        client.cookies.clear()
        me = client.get("/api/v2/auth/me", headers=bearer_headers(new_token))
        assert me.status_code == 200
        assert me.json()["username"] == "alice"


def test_refresh_without_csrf_token_403(tmp_path: Path) -> None:
    """Post-Phase D P1-2: refresh 路径必须 CSRF (跟 logout 同标准)."""
    with build_client(tmp_path) as client:
        client.post("/api/v2/auth/login", json={"identifier": "alice@test.local", "password": "alice-pass"})
        # cookies 在 jar, 但不传 X-CSRF-Token header.
        resp = client.post("/api/v2/auth/refresh")
        assert resp.status_code == 403


def test_cookie_authed_practice_start_requires_csrf(tmp_path: Path) -> None:
    """Post-Phase D P0-1: 登录后用 cookie 调 practice/start 必须带 X-CSRF-Token.

    防止跨站攻击者 fetch credentials:'include' 借受害者 cookie 提交.
    跳过 login() helper (它会 clear auth cookie 让 bearer test 隔离), 直接走
    client.post("/auth/login") 让 auth_token + csrf_token cookies 都在 jar.
    """
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        publish_revision(client, "D1", import_payload["items"][0]["revisionId"])
        login_resp = client.post(
            "/api/v2/auth/login", json={"identifier": "alice@test.local", "password": "alice-pass"}
        )
        assert "auth_token" in login_resp.cookies
        assert "csrf_token" in login_resp.cookies
        # Simulate attacker: cookie still in jar (auth_token + csrf_token)
        # but X-CSRF-Token header is tampered or missing.
        resp = client.post(
            "/api/v2/practice/papers/D1/start",
            headers={"X-CSRF-Token": "tampered-attacker-value"},
        )
        assert resp.status_code == 403
        assert resp.json()["code"] == "csrf_mismatch"


def test_cookie_auth_works_for_protected_route(tmp_path: Path) -> None:
    """Phase B.1b dual-fallback: cookie auth (no Bearer header) hits /me OK."""
    with build_client(tmp_path) as client:
        # Login plants cookie in client; subsequent calls auto-send.
        client.post("/api/v2/auth/login", json={"identifier": "alice@test.local", "password": "alice-pass"})
        # No Authorization header — only cookie.
        me = client.get("/api/v2/auth/me")
        assert me.status_code == 200
        assert me.json()["username"] == "alice"


def test_exam_papers_v2_import_publish_and_practice_flow(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        assert import_payload["status"] == "completed"
        assert import_payload["importedFiles"] == 1
        assert import_payload["importedPapers"] == 1
        assert import_payload["importedQuestions"] == 4
        assert import_payload["items"][0]["status"] == "completed"

        job_detail = client.get(f"/api/v2/admin/import-jobs/{import_payload['id']}", headers=admin_headers())
        assert job_detail.status_code == 200
        assert job_detail.json()["id"] == import_payload["id"]

        admin_papers_response = client.get("/api/v2/admin/papers", headers=admin_headers())
        assert admin_papers_response.status_code == 200
        admin_papers = admin_papers_response.json()
        assert len(admin_papers) == 1
        assert admin_papers[0]["paperCode"] == "D1"
        assert admin_papers[0]["currentRevision"] is None

        revisions_response = client.get("/api/v2/admin/papers/D1/revisions", headers=admin_headers())
        assert revisions_response.status_code == 200
        revisions = revisions_response.json()
        assert len(revisions) == 1
        assert revisions[0]["revisionNumber"] == 1
        assert revisions[0]["status"] == "draft"
        assert revisions[0]["questionCount"] == 4

        public_before_publish = client.get("/api/v2/papers")
        assert public_before_publish.status_code == 200
        assert public_before_publish.json() == []

        bootstrap_before = client.get("/api/v2/system/bootstrap")
        assert bootstrap_before.status_code == 200
        assert bootstrap_before.json()["publishedPaperCount"] == 0

        publish_payload = publish_revision(client, "D1", revisions[0]["id"], execution_id="release-001")
        assert publish_payload["paper"]["currentRevisionId"] == revisions[0]["id"]
        assert publish_payload["currentRevision"]["status"] == "published"

        status_response = client.get(
            f"/api/v2/admin/revisions/{revisions[0]['id']}/publish-status",
            headers=admin_headers(),
        )
        assert status_response.status_code == 200
        assert status_response.json()["isPublished"] is True
        assert status_response.json()["releaseExecutionId"] == "release-001"

        public_papers_response = client.get("/api/v2/papers")
        assert public_papers_response.status_code == 200
        public_papers = public_papers_response.json()
        assert len(public_papers) == 1
        assert public_papers[0]["paperCode"] == "D1"
        assert public_papers[0]["currentRevisionNumber"] == 1

        paper_detail_response = client.get("/api/v2/papers/D1")
        assert paper_detail_response.status_code == 200
        paper_detail = paper_detail_response.json()
        assert paper_detail["revisionId"] == revisions[0]["id"]
        assert paper_detail["paperCode"] == "D1"
        assert paper_detail["status"] == "published"
        assert paper_detail["questionCount"] == 4

        paper_questions_response = client.get("/api/v2/papers/D1/questions")
        assert paper_questions_response.status_code == 200
        paper_questions = paper_questions_response.json()
        assert len(paper_questions) == 4
        assert {item["revisionNumber"] for item in paper_questions} == {1}

        question_detail_response = client.get(f"/api/v2/questions/{paper_questions[0]['id']}")
        assert question_detail_response.status_code == 200
        question_detail = question_detail_response.json()
        assert question_detail["selectionMode"] == "single"
        assert question_detail["typePayload"] == {}

        health_response = client.get("/healthz")
        ready_response = client.get("/readyz")
        version_response = client.get("/version")
        version_json_response = client.get("/version.json")
        assert health_response.status_code == 200
        assert ready_response.status_code == 200
        assert version_response.status_code == 200
        assert version_json_response.status_code == 200
        assert version_response.json()["gitSha"] == "test-sha"

        bootstrap_after = client.get("/api/v2/system/bootstrap")
        assert bootstrap_after.status_code == 200
        assert bootstrap_after.json()["publishedPaperCount"] == 1
        assert bootstrap_after.json()["canStartPractice"] is True
        assert bootstrap_after.json()["defaultPaperCode"] == "D1"

        start_session_response = client.post("/api/v2/practice/papers/D1/start")
        assert start_session_response.status_code == 200
        session_payload = start_session_response.json()
        assert session_payload["paperCode"] == "D1"
        assert session_payload["paperRevisionId"] == revisions[0]["id"]
        assert session_payload["paperName"] == "复杂题演示卷"
        assert session_payload["savedAnswers"] == {}
        assert len(session_payload["sections"]) == 2
        first_section_blocks = session_payload["sections"][0]["blocks"]
        assert [item["type"] for item in first_section_blocks] == ["question", "material_group"]
        assert session_payload["sections"][1]["blocks"][0]["type"] == "material_group"

        all_questions = iter_session_questions(session_payload)
        question_asset_url = all_questions[0]["assets"][0]["url"]
        question_asset_response = client.get(question_asset_url)
        assert question_asset_response.status_code == 200
        assert question_asset_response.headers["content-type"].startswith("image/svg+xml")

        material_asset_url = session_payload["sections"][0]["blocks"][1]["materialGroup"]["assets"][0]["url"]
        material_asset_response = client.get(material_asset_url)
        assert material_asset_response.status_code == 200
        assert material_asset_response.headers["content-type"].startswith("image/svg+xml")

        answer_map = build_answer_map(client, session_payload)

        complete_response = client.post(
            f"/api/v2/practice/sessions/{session_payload['sessionId']}/complete",
            json={"answers": answer_map},
        )
        assert complete_response.status_code == 204

        session_result_response = client.get(f"/api/v2/practice/sessions/{session_payload['sessionId']}/result")
        assert session_result_response.status_code == 200
        session_result = session_result_response.json()
        assert session_result["sessionId"] == session_payload["sessionId"]
        assert session_result["score"] == 100
        assert session_result["correctCount"] == 4
        assert session_result["incorrectCount"] == 0
        assert session_result["unansweredCount"] == 0
        assert session_result["totalQuestions"] == 4
        assert session_result["userAnswers"] == answer_map

        # Phase 3.3 深度卡 payload — session / sectionSummaries / questions / answers
        # must ship non-null so the Result page can render without fabricating data.
        session_summary = session_result["session"]
        assert session_summary is not None
        assert session_summary["sessionId"] == session_payload["sessionId"]
        assert session_summary["paperCode"] == "D1"
        assert session_summary["paperName"] == "复杂题演示卷"
        assert session_summary["totalQuestions"] == 4
        assert session_summary["answeredQuestions"] == 4
        assert session_summary["correctCount"] == 4
        assert session_summary["wrongCount"] == 0
        assert session_summary["accuracyRate"] == 100.0
        assert session_summary["startedAt"].endswith("Z")
        assert session_summary["completedAt"] is not None

        section_summaries = session_result["sectionSummaries"]
        assert section_summaries is not None
        assert [item["sectionId"] for item in section_summaries] == ["language", "data-analysis"]
        language_section = section_summaries[0]
        assert language_section["questionCount"] == 3
        assert language_section["answeredQuestions"] == 3
        assert language_section["correctCount"] == 3
        assert language_section["wrongCount"] == 0
        assert language_section["accuracyRate"] == 100.0
        data_section = section_summaries[1]
        assert data_section["questionCount"] == 1
        assert data_section["answeredQuestions"] == 1
        assert data_section["correctCount"] == 1

        # v0.2 slice 3 — knowledge-point aggregation. Fixture canonical taxonomies:
        #   d1-q1: 判断推理 / 图形推理
        #   d1-q2: 言语理解 / 片段阅读
        #   d1-q3: 言语理解 / 片段阅读
        #   d1-q4: 资料分析 / 增长率
        # All 4 answered correctly in this test → 100% accuracy across the board.
        subject_summaries = session_result["subjectSummaries"]
        assert subject_summaries is not None
        # Sorted by question_count desc → 言语理解 (2) first
        assert [s["subject"] for s in subject_summaries] == ["言语理解", "判断推理", "资料分析"]
        yuyan = subject_summaries[0]
        assert yuyan["questionCount"] == 2
        assert yuyan["answeredQuestions"] == 2
        assert yuyan["correctCount"] == 2
        assert yuyan["wrongCount"] == 0
        assert yuyan["accuracyRate"] == 100.0

        subtype_summaries = session_result["subtypeSummaries"]
        assert subtype_summaries is not None
        # Sorted by question_count desc → 片段阅读 (2) first
        assert [s["subtype"] for s in subtype_summaries] == ["片段阅读", "图形推理", "增长率"]
        pian = subtype_summaries[0]
        assert pian["subject"] == "言语理解"
        assert pian["questionCount"] == 2
        assert pian["answeredQuestions"] == 2
        assert pian["correctCount"] == 2

        result_questions = session_result["questions"]
        assert result_questions is not None
        assert len(result_questions) == 4
        assert {q["paperCode"] for q in result_questions} == {"D1"}
        assert result_questions[0]["content"]["stem"] == "这是一道带图片的普通单选题。"

        result_answers = session_result["answers"]
        assert result_answers is not None
        assert len(result_answers) == 4
        first_answer = result_answers[0]
        assert first_answer["questionId"] == result_questions[0]["questionId"]
        assert first_answer["isCorrect"] is True
        assert first_answer["selectedAnswerKeys"] == first_answer["correctAnswerKeys"]
        assert first_answer["answeredAt"].endswith("Z")

        history_response = client.get("/api/v2/practice/history", headers=bearer_headers(login(client, "alice", "alice-pass")))
        assert history_response.status_code == 200
        history_payload = history_response.json()
        assert history_payload["summary"]["totalAttempts"] == 0


def test_exam_papers_v2_revisions_keep_old_session_results_stable(tmp_path: Path) -> None:
    updated_payload = load_complex_payload()
    updated_payload["paperName"] = "复杂题演示卷（修订版）"
    updated_payload["sections"][0]["blocks"][0]["stemText"] = "这是 revision 2 的普通单选题。"

    with build_client(tmp_path) as client:
        first_import = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        first_revision_id = first_import["items"][0]["revisionId"]
        publish_revision(client, "D1", first_revision_id)

        first_session_response = client.post("/api/v2/practice/papers/D1/start")
        assert first_session_response.status_code == 200
        first_session = first_session_response.json()
        client.post(
            f"/api/v2/practice/sessions/{first_session['sessionId']}/complete",
            json={"answers": build_answer_map(client, first_session)},
        )

        second_import = import_standard_json(
            client,
            files=[("updated-d1.standard.json", encode_payload(updated_payload))],
            base_dir=FIXTURES_DIR,
        )
        assert second_import["items"][0]["revisionNumber"] == 2

        revisions_response = client.get("/api/v2/admin/papers/D1/revisions", headers=admin_headers())
        assert revisions_response.status_code == 200
        revisions = revisions_response.json()
        assert [item["revisionNumber"] for item in revisions] == [1, 2]

        publish_revision(client, "D1", second_import["items"][0]["revisionId"])

        old_result_response = client.get(f"/api/v2/practice/sessions/{first_session['sessionId']}/result")
        assert old_result_response.status_code == 200
        old_result = old_result_response.json()
        assert old_result["sessionId"] == first_session["sessionId"]
        assert old_result["totalQuestions"] == 4

        new_session_response = client.post("/api/v2/practice/papers/D1/start")
        assert new_session_response.status_code == 200
        new_session = new_session_response.json()
        assert new_session["paperName"] == "复杂题演示卷（修订版）"
        first_question = iter_session_questions(new_session)[0]
        assert first_question["content"]["stem"] == "这是 revision 2 的普通单选题。"


def test_exam_papers_v2_import_supports_relative_upload_paths_for_nested_directories(tmp_path: Path) -> None:
    upload_root = tmp_path / "nested-upload-root"
    files = [
        prepare_nested_paper(upload_root, "batch-a/paper-01", paper_code="RA1", paper_name="Nested import A"),
        prepare_nested_paper(upload_root, "batch-b/paper-02", paper_code="RB2", paper_name="Nested import B"),
    ]

    with build_client(tmp_path) as client:
        payload = import_standard_json(client, files=files, base_dir=upload_root)
        assert payload["status"] == "completed"
        assert payload["importedFiles"] == 2
        assert payload["importedPapers"] == 2
        assert payload["failedFiles"] == 0
        assert {item["filename"] for item in payload["items"]} == {
            "batch-a/paper-01/ra1.standard.json",
            "batch-b/paper-02/rb2.standard.json",
        }

        admin_papers_response = client.get("/api/v2/admin/papers", headers=admin_headers())
        assert admin_papers_response.status_code == 200
        admin_codes = {item["paperCode"] for item in admin_papers_response.json()}
        assert admin_codes == {"RA1", "RB2"}


def test_exam_papers_v2_import_reports_missing_assets_in_job_items(tmp_path: Path) -> None:
    broken_payload = load_complex_payload()
    broken_payload["paperCode"] = "BROKEN1"
    broken_payload["paperName"] = "Broken asset paper"
    broken_payload["sections"][0]["blocks"][0]["assets"][0]["path"] = "missing-asset.svg"

    with build_client(tmp_path) as client:
        payload = import_standard_json(
            client,
            files=[
                ("complex-paper.json", COMPLEX_PAPER_PATH.read_bytes()),
                ("broken-paper.json", encode_payload(broken_payload)),
            ],
            base_dir=FIXTURES_DIR,
        )
        assert payload["status"] == "partial"
        assert payload["importedFiles"] == 1
        assert payload["failedFiles"] == 1

        failed_item = next(item for item in payload["items"] if item["status"] == "failed")
        assert "asset file not found" in failed_item["errorMessage"]

        jobs_response = client.get("/api/v2/admin/import-jobs", headers=admin_headers())
        assert jobs_response.status_code == 200
        assert jobs_response.json()[0]["status"] == "partial"


def test_practice_requires_user_ownership_and_idempotency(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        publish_revision(client, "D1", import_payload["items"][0]["revisionId"])

        alice_token = login(client, "alice", "alice-pass")
        bob_token = login(client, "bob", "bob-pass")

        start_response = client.post("/api/v2/practice/papers/D1/start", headers=bearer_headers(alice_token))
        assert start_response.status_code == 200
        session_payload = start_response.json()
        session_id = session_payload["sessionId"]
        question_id = iter_session_questions(session_payload)[0]["questionId"]

        # P0-1 fix (security review 2026-04-30): 跨用户访问改返 404 (跟 study_plans /
        # llm_conversations / essay_grading 对齐, 不暴露 session 存在性). 旧期望 403.
        forbidden_response = client.get(f"/api/v2/practice/sessions/{session_id}/result", headers=bearer_headers(bob_token))
        assert forbidden_response.status_code == 404

        submit_headers = bearer_headers(alice_token) | {"Idempotency-Key": "submit-1"}
        submit_payload = {"questionId": question_id, "selectedAnswerKeys": ["B"]}
        first_submit = client.post(f"/api/v2/practice/sessions/{session_id}/submit", json=submit_payload, headers=submit_headers)
        second_submit = client.post(f"/api/v2/practice/sessions/{session_id}/submit", json=submit_payload, headers=submit_headers)
        assert first_submit.status_code == 200
        assert second_submit.status_code == 200
        assert first_submit.json() == second_submit.json()

        conflict_submit = client.post(
            f"/api/v2/practice/sessions/{session_id}/submit",
            json={"questionId": question_id, "selectedAnswerKeys": ["A"]},
            headers=submit_headers,
        )
        assert conflict_submit.status_code == 409

        complete_headers = bearer_headers(alice_token) | {"Idempotency-Key": "complete-1"}
        assert client.post(f"/api/v2/practice/sessions/{session_id}/complete", headers=complete_headers).status_code == 204
        assert client.post(f"/api/v2/practice/sessions/{session_id}/complete", headers=complete_headers).status_code == 204

        db_session = client.app.state.db.session_factory()
        try:
            count = db_session.query(PracticeSessionAnswer).count()
            assert count == 1
        finally:
            db_session.close()


def test_practice_session_anonymous_cannot_read_logged_in_user_session(tmp_path: Path) -> None:
    """P0-1 regression (security review 2026-04-30): anonymous fallthrough leak.

    旧 _get_practice_session(user=None) 跳过 ownership check, 让任意人调用方能枚
    举 session_id 读 logged-in user 的 answers/score. 修后 anonymous (no auth
    cookie/bearer) 必须命中自己的 guest user session, 跨用户返 404.
    """
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        publish_revision(client, "D1", import_payload["items"][0]["revisionId"])

        # alice (logged-in) 起 session
        alice_token = login(client, "alice", "alice-pass")
        start_response = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(alice_token)
        )
        assert start_response.status_code == 200
        session_payload = start_response.json()
        session_id = session_payload["sessionId"]
        # P1-B (回归 review): 用真 question_id 让 ownership 检查作为第一道防线断言.
        # 用 questionId=999 时 service 内部可能 question lookup 先 404 而不是 ownership;
        # 用真 question_id 排除该可能, 强制 ownership 必须是先于 question lookup 拦下.
        real_question_id = iter_session_questions(session_payload)[0]["questionId"]

        # anonymous 调用 (no auth header) 读 alice 的 session → 404, 不是 200
        anon_response = client.get(f"/api/v2/practice/sessions/{session_id}/result")
        assert anon_response.status_code == 404, anon_response.text

        # anonymous submit (用真 question_id, ownership 必先拦下)
        submit_response = client.post(
            f"/api/v2/practice/sessions/{session_id}/submit",
            json={"questionId": real_question_id, "selectedAnswerKeys": ["A"]},
        )
        assert submit_response.status_code == 404, submit_response.text

        complete_response = client.post(
            f"/api/v2/practice/sessions/{session_id}/complete"
        )
        assert complete_response.status_code == 404, complete_response.text


def test_practice_session_anonymous_cross_paper_retry_first_404_not_400(tmp_path: Path) -> None:
    """P1-A regression (回归 review 2026-04-30): cross-paper retry session 在
    匿名访问时, ownership check (404) 必须先于 cross-paper validation (400 'anonymous
    cannot use cross-paper retry session'). 旧 _get_practice_session 跳过 ownership
    时, 匿名能从 400 vs 404 区分 "session 是 cross-paper retry" vs "其他", 是 timing
    /error-channel 侧道. P0-1 fix 后 ownership 是第一道防线, 应 404 而非 400.

    流程: alice 起 session 做错题 → batch retry 创 cross-paper retry session →
    bob anonymous (no cookie) submit/complete → 必须 404 不是 400.
    """
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        publish_revision(client, "D1", import_payload["items"][0]["revisionId"])

        alice_token = login(client, "alice", "alice-pass")
        # Alice 起原始 session, 做 2 题错题, batch retry 创 cross-paper retry session.
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(alice_token)
        )
        session_payload = start.json()
        session_id = session_payload["sessionId"]
        questions = iter_session_questions(session_payload)
        q1 = questions[0]
        amap = build_answer_map(client, session_payload)
        _submit(
            client, session_id, q1["questionId"],
            _pick_wrong_keys(amap[str(q1["questionId"])]), alice_token,
        )
        # batch retry → cross-paper retry session
        retry_response = client.post(
            "/api/v2/practice/wrong-questions/retry-batch",
            json={"questionIds": [q1["questionId"]]},
            headers=bearer_headers(alice_token),
        )
        assert retry_response.status_code == 200
        retry_session_id = retry_response.json()["sessionId"]
        retry_qid = iter_session_questions(retry_response.json())[0]["questionId"]

        # Anonymous submit to alice's cross-paper retry session — ownership 第一防线 → 404
        anon_submit = client.post(
            f"/api/v2/practice/sessions/{retry_session_id}/submit",
            json={"questionId": retry_qid, "selectedAnswerKeys": ["A"]},
        )
        assert anon_submit.status_code == 404, anon_submit.text
        # 验证 *不是* 400 cross-paper validation (那意味着 ownership check 在 mode check 之后)
        assert anon_submit.json().get("code") != "validation_error"

        anon_complete = client.post(
            f"/api/v2/practice/sessions/{retry_session_id}/complete"
        )
        assert anon_complete.status_code == 404, anon_complete.text


def test_practice_session_anonymous_can_read_own_guest_session(tmp_path: Path) -> None:
    """anonymous PoC demo by-design (route 30 注释): 匿名起 session 落 guest user,
    后续匿名读自己起的 session 仍然 200.
    """
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        publish_revision(client, "D1", import_payload["items"][0]["revisionId"])

        # anonymous 起 session (no auth)
        start_response = client.post("/api/v2/practice/papers/D1/start")
        assert start_response.status_code == 200
        session_id = start_response.json()["sessionId"]

        # anonymous 读自己 session → 200 (route 30 注释 by-design)
        result_response = client.get(f"/api/v2/practice/sessions/{session_id}/result")
        assert result_response.status_code == 200
        assert result_response.json()["sessionId"] == session_id


def test_session_result_handles_partial_wrong_and_unanswered(tmp_path: Path) -> None:
    # Phase 4 follow-up (B5 from 2026-04-23 review): the original
    # test_exam_papers_v2_import_publish_and_practice_flow covered the
    # "all correct, all answered" happy path. This test covers the
    # heterogeneous case — one correct, one wrong, two unanswered — to
    # exercise the `correctCount` / `incorrectCount` / `unansweredCount`
    # aggregation, the per-section accuracy rate math, and the empty-section
    # edge (data-analysis section gets 0 answered, so accuracyRate must be
    # 0.0 rather than divide-by-zero).
    with build_client(tmp_path) as client:
        import_payload = import_standard_json(
            client,
            files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
            base_dir=FIXTURES_DIR,
        )
        publish_revision(client, "D1", import_payload["items"][0]["revisionId"])
        alice_token = login(client, "alice", "alice-pass")
        start_response = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(alice_token)
        )
        assert start_response.status_code == 200
        session_payload = start_response.json()
        session_id = session_payload["sessionId"]

        # Build full correct map first, then mutate to partial state.
        correct_map = build_answer_map(client, session_payload)
        questions = iter_session_questions(session_payload)
        assert len(questions) == 4  # guard: fixture shape didn't drift

        # q1 correct (keep as-is), q2 flipped to a deliberately wrong key,
        # q3 + q4 removed entirely -> unanswered.
        partial_map: dict[str, list[str]] = {}
        q1_id = str(questions[0]["questionId"])
        q2_id = str(questions[1]["questionId"])
        partial_map[q1_id] = correct_map[q1_id]
        correct_keys = correct_map[q2_id]
        # pick any single-choice key that's not in correct_keys; keys A-D cover
        # the fixture options.
        wrong_candidates = [k for k in ("A", "B", "C", "D") if k not in correct_keys]
        assert wrong_candidates, "fixture changed — no remaining option to flip wrong"
        partial_map[q2_id] = [wrong_candidates[0]]

        complete = client.post(
            f"/api/v2/practice/sessions/{session_id}/complete",
            json={"answers": partial_map},
            headers=bearer_headers(alice_token),
        )
        assert complete.status_code == 204

        result_response = client.get(
            f"/api/v2/practice/sessions/{session_id}/result",
            headers=bearer_headers(alice_token),
        )
        assert result_response.status_code == 200
        result = result_response.json()

        # Top-level counts
        assert result["correctCount"] == 1
        assert result["incorrectCount"] == 1
        assert result["unansweredCount"] == 2
        assert result["totalQuestions"] == 4
        assert result["score"] == 25

        # Session summary: accuracyRate is of ANSWERED (1 / 2 = 50.0),
        # not of total. answeredQuestions excludes the 2 we skipped.
        summary = result["session"]
        assert summary["answeredQuestions"] == 2
        assert summary["correctCount"] == 1
        assert summary["wrongCount"] == 1
        assert summary["accuracyRate"] == 50.0

        # Section summaries: language (3 Qs) gets q1 correct + q2 wrong,
        # data-analysis (1 Q) gets nothing -> accuracyRate 0.0 without
        # tripping the zero-denominator guard.
        sections = {item["sectionId"]: item for item in result["sectionSummaries"]}
        assert sections["language"]["answeredQuestions"] == 2
        assert sections["language"]["correctCount"] == 1
        assert sections["language"]["wrongCount"] == 1
        assert sections["language"]["accuracyRate"] == 50.0
        assert sections["data-analysis"]["answeredQuestions"] == 0
        assert sections["data-analysis"]["correctCount"] == 0
        assert sections["data-analysis"]["wrongCount"] == 0
        assert sections["data-analysis"]["accuracyRate"] == 0.0

        # Answers array mirrors only the 2 submitted entries; result.questions
        # still lists all 4 questions (Result page can render comparison for
        # unanswered cells via classifyCell's "empty" state).
        assert len(result["answers"]) == 2
        assert {a["isCorrect"] for a in result["answers"]} == {True, False}
        assert len(result["questions"]) == 4


# ── Phase 5.4 wrong-book + mastery tests ────────────────────────────────────


def _setup_published_paper(tmp_path: Path, client: TestClient) -> dict[str, Any]:
    import_payload = import_standard_json(
        client,
        files=[(COMPLEX_PAPER_PATH.name, COMPLEX_PAPER_PATH.read_bytes())],
        base_dir=FIXTURES_DIR,
    )
    publish_revision(client, "D1", import_payload["items"][0]["revisionId"])
    return import_payload


def _pick_wrong_keys(correct_keys: list[str]) -> list[str]:
    wrong = [k for k in ("A", "B", "C", "D") if k not in correct_keys]
    assert wrong, "fixture changed — no remaining option to flip wrong"
    return [wrong[0]]


def _submit(client: TestClient, session_id: int, qid: Any, keys: list[str], token: str) -> None:
    response = client.post(
        f"/api/v2/practice/sessions/{session_id}/submit",
        json={"questionId": qid, "selectedAnswerKeys": keys},
        headers=bearer_headers(token),
    )
    assert response.status_code == 200


def _get_wrong(
    client: TestClient, token: str, **params: Any
) -> dict[str, Any]:
    response = client.get(
        "/api/v2/practice/wrong-questions",
        headers=bearer_headers(token),
        params=params,
    )
    assert response.status_code == 200
    return response.json()


def test_wrong_book_mastery_progression(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        session_payload = start.json()
        session_id = session_payload["sessionId"]
        questions = iter_session_questions(session_payload)
        q = questions[0]
        qid = q["questionId"]
        correct = build_answer_map(client, session_payload)[str(qid)]
        wrong = _pick_wrong_keys(correct)

        # Empty state first.
        empty = _get_wrong(client, token)
        assert empty["total"] == 0
        assert empty["items"] == []

        # Step 1: 做错 → not_mastered, consecutive=0
        _submit(client, session_id, qid, wrong, token)
        step1 = _get_wrong(client, token)
        assert step1["total"] == 1
        assert step1["items"][0]["masteryLevel"] == "not_mastered"
        assert step1["items"][0]["consecutiveCorrectCount"] == 0
        assert step1["items"][0]["userLatestAnswerKeys"] == wrong

        # Step 2: 做对一次 → reviewing, consecutive=1
        _submit(client, session_id, qid, correct, token)
        step2 = _get_wrong(client, token)
        assert step2["items"][0]["masteryLevel"] == "reviewing"
        assert step2["items"][0]["consecutiveCorrectCount"] == 1

        # Step 3: 再做对一次 → mastered, consecutive>=2
        _submit(client, session_id, qid, correct, token)
        step3 = _get_wrong(client, token)
        assert step3["items"][0]["masteryLevel"] == "mastered"
        assert step3["items"][0]["consecutiveCorrectCount"] >= 2

        # Step 4: 再做错 → 重置 not_mastered / consecutive=0
        _submit(client, session_id, qid, wrong, token)
        step4 = _get_wrong(client, token)
        assert step4["items"][0]["masteryLevel"] == "not_mastered"
        assert step4["items"][0]["consecutiveCorrectCount"] == 0

        # mastery_level filter works
        not_mastered = _get_wrong(client, token, mastery_level="not_mastered")
        assert not_mastered["total"] == 1
        mastered = _get_wrong(client, token, mastery_level="mastered")
        assert mastered["total"] == 0

        # 用户隔离：bob 看不到 alice 的错题
        bob_token = login(client, "bob", "bob-pass")
        bob_wb = _get_wrong(client, bob_token)
        assert bob_wb["total"] == 0


def test_wrong_book_paper_code_filter(tmp_path: Path) -> None:
    """规范官 P0-1 (2026-05-08): paperCode query 走 server-side filter.

    跨页错题应能被 paperCode 过滤到 (replace 旧 client-side filter, 后者只
    能在当前页 N 条上 filter, 跨页错题 silently 丢失).
    """
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        session_payload = start.json()
        session_id = session_payload["sessionId"]
        questions = iter_session_questions(session_payload)
        # 做错首题
        q = questions[0]
        qid = q["questionId"]
        correct = build_answer_map(client, session_payload)[str(qid)]
        wrong = _pick_wrong_keys(correct)
        _submit(client, session_id, qid, wrong, token)

        # 不带 paperCode → 包含该错题
        all_wb = _get_wrong(client, token)
        assert all_wb["total"] == 1

        # 带匹配 paperCode → 仍包含
        matching = _get_wrong(client, token, paperCode="D1")
        assert matching["total"] == 1
        assert matching["items"][0]["questionId"] == qid

        # 带不匹配 paperCode → 空集
        non_match = _get_wrong(client, token, paperCode="NOT-EXIST-PAPER")
        assert non_match["total"] == 0
        assert non_match["items"] == []


def test_retry_wrong_question_creates_session(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        session_payload = start.json()
        session_id = session_payload["sessionId"]
        questions = iter_session_questions(session_payload)
        q = questions[0]
        qid = q["questionId"]
        correct = build_answer_map(client, session_payload)[str(qid)]
        wrong = _pick_wrong_keys(correct)

        # 没做错过 → retry 404
        not_yet = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/retry",
            headers=bearer_headers(token),
        )
        assert not_yet.status_code == 404

        # 做错一次后 retry 能成功
        _submit(client, session_id, qid, wrong, token)
        retry = client.post(
            f"/api/v2/practice/wrong-questions/{qid}/retry",
            headers=bearer_headers(token),
        )
        assert retry.status_code == 200
        retry_payload = retry.json()
        assert retry_payload["sessionId"] != session_id
        # retry session 只含该题所在 block（纯 question block 时 total=1）。
        retry_questions = iter_session_questions(retry_payload)
        retry_qids = {item["questionId"] for item in retry_questions}
        assert qid in retry_qids


def test_retry_wrong_batch_creates_session(tmp_path: Path) -> None:
    """Phase 6.4 P2 批量复习 — 多题一起 retry 创建一个 session."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        start = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        )
        session_payload = start.json()
        session_id = session_payload["sessionId"]
        questions = iter_session_questions(session_payload)
        q1 = questions[0]
        q2 = questions[1]
        amap = build_answer_map(client, session_payload)
        # 两题都做错
        _submit(client, session_id, q1["questionId"], _pick_wrong_keys(amap[str(q1["questionId"])]), token)
        _submit(client, session_id, q2["questionId"], _pick_wrong_keys(amap[str(q2["questionId"])]), token)

        # batch retry
        batch = client.post(
            "/api/v2/practice/wrong-questions/retry-batch",
            json={"questionIds": [q1["questionId"], q2["questionId"]]},
            headers=bearer_headers(token),
        )
        assert batch.status_code == 200
        payload = batch.json()
        assert payload["sessionId"] != session_id
        retry_qids = {item["questionId"] for item in iter_session_questions(payload)}
        assert q1["questionId"] in retry_qids
        assert q2["questionId"] in retry_qids


def test_retry_wrong_batch_rejects_empty_or_oversized(tmp_path: Path) -> None:
    """空 / 超过 50 题 → 400."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        empty = client.post(
            "/api/v2/practice/wrong-questions/retry-batch",
            json={"questionIds": []},
            headers=bearer_headers(token),
        )
        # service.errors.ValidationError → 422 (apps/exam-api/app/services/errors.py:14)
        assert empty.status_code == 422
        oversized = client.post(
            "/api/v2/practice/wrong-questions/retry-batch",
            json={"questionIds": list(range(1, 52))},
            headers=bearer_headers(token),
        )
        assert oversized.status_code == 422


def test_retry_wrong_batch_rejects_unknown_question(tmp_path: Path) -> None:
    """题不在错题本 → 404."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        token = login(client, "alice", "alice-pass")
        # 没做错过任何题, batch 直接 404
        no_mastery = client.post(
            "/api/v2/practice/wrong-questions/retry-batch",
            json={"questionIds": [99999]},
            headers=bearer_headers(token),
        )
        assert no_mastery.status_code == 404


def test_retry_wrong_batch_cross_paper(tmp_path: Path) -> None:
    """B-review B-R2 修: HTTP-level cross-paper batch retry (2 papers).

    覆盖 e544e6d + 487536c 引入的 cross-paper 路径完整 e2e:
      - import 2 papers (D1 + D2 prefix)
      - 各做错 1 题
      - batch retry [q_d1, q_d2] → 200 + paperCode "__cross_paper_retry__"
      - submit 2 题 + complete + result → 200, totalQuestions=2,
        sectionSummaries=[], questions 含两题, paperCode null/marker
    """
    with build_client(tmp_path) as client:
        # 第 1 套: D1 (用既有 _setup_published_paper)
        _setup_published_paper(tmp_path, client)
        # 第 2 套: D2, 不同 paperCode 避撞
        d2_filename, d2_bytes = prepare_nested_paper(
            tmp_path, "d2_paper", paper_code="D2", paper_name="2025 D2 套卷"
        )
        d2_import = import_standard_json(
            client, files=[(d2_filename, d2_bytes)], base_dir=tmp_path
        )
        publish_revision(client, "D2", d2_import["items"][0]["revisionId"])

        token = login(client, "alice", "alice-pass")

        # D1 做错 q1
        d1_session_resp = client.post(
            "/api/v2/practice/papers/D1/start",
            headers=bearer_headers(token),
        )
        assert d1_session_resp.status_code == 200
        d1_session = d1_session_resp.json()
        d1_qs = iter_session_questions(d1_session)
        d1_q1 = d1_qs[0]
        d1_amap = build_answer_map(client, d1_session)
        _submit(
            client,
            d1_session["sessionId"],
            d1_q1["questionId"],
            _pick_wrong_keys(d1_amap[str(d1_q1["questionId"])]),
            token,
        )

        # D2 做错 q1
        d2_session_resp = client.post(
            "/api/v2/practice/papers/D2/start",
            headers=bearer_headers(token),
        )
        assert d2_session_resp.status_code == 200
        d2_session = d2_session_resp.json()
        d2_qs = iter_session_questions(d2_session)
        d2_q1 = d2_qs[0]
        d2_amap = build_answer_map(client, d2_session)
        _submit(
            client,
            d2_session["sessionId"],
            d2_q1["questionId"],
            _pick_wrong_keys(d2_amap[str(d2_q1["questionId"])]),
            token,
        )

        # cross-paper batch retry
        batch = client.post(
            "/api/v2/practice/wrong-questions/retry-batch",
            json={"questionIds": [d1_q1["questionId"], d2_q1["questionId"]]},
            headers=bearer_headers(token),
        )
        assert batch.status_code == 200, batch.text
        batch_payload = batch.json()
        # cross-paper marker
        assert batch_payload["paperCode"] == "__cross_paper_retry__"
        # response_model_exclude_none=True 让 None 字段从 body 中剥除 (老调用方
        # 不破), 所以 paperRevisionId 直接缺失而非 null.
        assert "paperRevisionId" not in batch_payload
        assert batch_payload["paperName"] == "跨试卷批量复习"
        retry_qids = {it["questionId"] for it in iter_session_questions(batch_payload)}
        assert d1_q1["questionId"] in retry_qids
        assert d2_q1["questionId"] in retry_qids

        # submit + complete cross-paper session
        retry_sid = batch_payload["sessionId"]
        for qid in (d1_q1["questionId"], d2_q1["questionId"]):
            sub = client.post(
                f"/api/v2/practice/sessions/{retry_sid}/submit",
                json={"questionId": qid, "selectedAnswerKeys": ["A"]},
                headers=bearer_headers(token),
            )
            assert sub.status_code == 200, sub.text
        comp = client.post(
            f"/api/v2/practice/sessions/{retry_sid}/complete",
            headers=bearer_headers(token),
        )
        assert comp.status_code == 204

        # result of cross-paper session
        result_resp = client.get(
            f"/api/v2/practice/sessions/{retry_sid}/result",
            headers=bearer_headers(token),
        )
        assert result_resp.status_code == 200, result_resp.text
        result = result_resp.json()
        assert result["totalQuestions"] == 2
        # cross-paper: section summaries 应空 (没 single revision section 概念)
        assert result["sectionSummaries"] == []
        # questions 列表含两题
        result_qids = {q["questionId"] for q in result["questions"]}
        assert d1_q1["questionId"] in result_qids
        assert d2_q1["questionId"] in result_qids


def test_retry_wrong_batch_cross_paper_rejects_off_batch_submit(tmp_path: Path) -> None:
    """B-review B4 守门 HTTP-level: cross-paper session submit batch 外的题 → 422."""
    with build_client(tmp_path) as client:
        _setup_published_paper(tmp_path, client)
        d2_filename, d2_bytes = prepare_nested_paper(
            tmp_path, "d2_paper", paper_code="D2", paper_name="2025 D2 套卷"
        )
        d2_import = import_standard_json(
            client, files=[(d2_filename, d2_bytes)], base_dir=tmp_path
        )
        publish_revision(client, "D2", d2_import["items"][0]["revisionId"])

        token = login(client, "alice", "alice-pass")
        d1_session = client.post(
            "/api/v2/practice/papers/D1/start", headers=bearer_headers(token)
        ).json()
        d1_qs = iter_session_questions(d1_session)
        d1_q1, d1_q2 = d1_qs[0], d1_qs[1]
        d1_amap = build_answer_map(client, d1_session)
        # 错 q1 + q2
        _submit(client, d1_session["sessionId"], d1_q1["questionId"], _pick_wrong_keys(d1_amap[str(d1_q1["questionId"])]), token)
        _submit(client, d1_session["sessionId"], d1_q2["questionId"], _pick_wrong_keys(d1_amap[str(d1_q2["questionId"])]), token)

        d2_session = client.post(
            "/api/v2/practice/papers/D2/start", headers=bearer_headers(token)
        ).json()
        d2_qs = iter_session_questions(d2_session)
        d2_q1 = d2_qs[0]
        d2_amap = build_answer_map(client, d2_session)
        _submit(client, d2_session["sessionId"], d2_q1["questionId"], _pick_wrong_keys(d2_amap[str(d2_q1["questionId"])]), token)

        # cross-paper batch 仅含 [d1_q1, d2_q1] (不含 d1_q2)
        batch = client.post(
            "/api/v2/practice/wrong-questions/retry-batch",
            json={"questionIds": [d1_q1["questionId"], d2_q1["questionId"]]},
            headers=bearer_headers(token),
        )
        assert batch.status_code == 200
        retry_sid = batch.json()["sessionId"]

        # 提交 batch 外的 d1_q2 (在 wrong-book 但不在 batch) → 422.
        bad_submit = client.post(
            f"/api/v2/practice/sessions/{retry_sid}/submit",
            json={"questionId": d1_q2["questionId"], "selectedAnswerKeys": ["A"]},
            headers=bearer_headers(token),
        )
        assert bad_submit.status_code == 422
        assert "not in this cross-paper retry batch" in bad_submit.json()["detail"]


def test_backfill_infer_subject_rules() -> None:
    from sikao_api.db.models import Question
    from sikao_api.scripts.backfill_question_subject import infer_subject

    def _mk(**kwargs: Any) -> Question:
        # 不要用 `Question.__new__(Question)` + setattr —— SQLAlchemy 2.0 严格
        # 模式下没初始化 `_sa_instance_state` 会炸。走 __init__ 即可（必填字段
        # 缺失只在 flush 时报错，本测试不触 session）。
        return Question(
            canonical_top_type=kwargs.get("canonical_top_type"),
            question_kind=kwargs.get("question_kind"),
            source_kind=kwargs.get("source_kind"),
        )

    assert infer_subject(_mk(canonical_top_type="言语理解")) == "言语理解"
    assert infer_subject(_mk(canonical_top_type="资料分析")) == "资料分析"
    assert infer_subject(_mk(canonical_top_type="申论")) == "申论"
    assert infer_subject(_mk(question_kind="申论·综合分析")) == "申论"
    assert infer_subject(_mk(source_kind="公共基础知识")) == "公共基础知识"
    assert infer_subject(_mk(source_kind="其他")) is None
    assert infer_subject(_mk()) is None

    # v0.2 follow-up — fenbi sub-topic chapter 名映射到行测 5 大模块.
    # 「政治理论」是常识判断的核心子内容，不应回退 NULL（67 套 paper 命中）.
    assert infer_subject(_mk(canonical_top_type="政治理论")) == "常识判断"
    # 推理类细分都归到「判断推理」.
    assert infer_subject(_mk(canonical_top_type="科学推理")) == "判断推理"
    assert infer_subject(_mk(canonical_top_type="逻辑判断")) == "判断推理"
    assert infer_subject(_mk(canonical_top_type="图形推理")) == "判断推理"
    assert infer_subject(_mk(canonical_top_type="类比推理")) == "判断推理"
    assert infer_subject(_mk(canonical_top_type="综合分析能力")) == "判断推理"
    # 数量 / 言语 / 常识 alias.
    assert infer_subject(_mk(canonical_top_type="数学运算")) == "数量关系"
    assert infer_subject(_mk(canonical_top_type="言语理解与表达能力")) == "言语理解"
    assert infer_subject(_mk(canonical_top_type="综合知识")) == "常识判断"
    # 单次出现的边缘 chapter 仍回退 NULL（数据稀疏，不值得猜）.
    assert infer_subject(_mk(canonical_top_type="思维能力测验")) is None


def test_papers_list_kind_query_validates_literal(tmp_path: Path) -> None:
    """Slice 2d D7: GET /papers?kind 是 Literal['essay'] | None.

    'essay' / 缺省 200; 其他 string (e.g. 'mcq' / 'choice') 一律 Pydantic
    Literal 校验失败 422 — 防前端误传 typo 静默返全列表 (混淆 UX).
    Service 层行为已在 test_essay_ingest::test_list_public_papers_kind_essay_filter
    覆盖, 此测试聚焦 route-level 校验.
    """
    with build_client(tmp_path) as client:
        # 缺省 kind: 现行行为, 200 + 空 list (没 ingest 任何 paper)
        no_kind = client.get("/api/v2/papers")
        assert no_kind.status_code == 200
        assert no_kind.json() == []

        # kind=essay (Literal 允许的唯一值): 200 + 空 list
        essay = client.get("/api/v2/papers?kind=essay")
        assert essay.status_code == 200
        assert essay.json() == []

        # kind=invalid: 422
        bad = client.get("/api/v2/papers?kind=mcq")
        assert bad.status_code == 422

        # kind 大小写敏感, ESSAY 也 422 (Literal 严格匹配)
        case = client.get("/api/v2/papers?kind=ESSAY")
        assert case.status_code == 422


# ─── batch 5b · GET /papers/essay/list paginated ────────────────────────


def _build_essay_paper_payload_for_pagination(
    paper_code: str, *, sort_order: int
) -> dict[str, Any]:
    """1 essay question / paper, 用于 batch 5b 分页 endpoint 测试.

    sort_order 控制排序 (DESC 大的在前), paper_code 用作排序 tiebreaker (ASC).
    跟 test_essay_ingest._build_essay_paper_payload 同款 essay payload, inline
    防止 cross-import test 模块.
    """
    return {
        "paperCode": paper_code,
        "paperName": f"申论真题 {paper_code}",
        "examYear": 2024,
        "sourceProvider": "aipta",
        "sourceKind": "demo",
        "sortOrder": sort_order,
        "visibleInPublic": True,
        "sections": [
            {
                "key": "section-1",
                "title": "申论",
                "instructionText": "",
                "blocks": [
                    {
                        "type": "question",
                        "sourceUuid": f"{paper_code}-q1",
                        "questionKind": "essay",
                        "subtypeName": "申论大作文",
                        "stemText": "<p>结合给定材料, 谈谈你的理解...</p>",
                        "answerKeys": [],
                        "options": [],
                        "explanationText": "",
                        "difficultyCode": "unknown",
                        "rendererKey": "essay",
                        "isGradable": False,
                        "typePayload": {
                            "materialTexts": ["材料一", "材料二"],
                            "wordLimitMin": 800,
                            "wordLimitMax": 1000,
                            "fullScore": 40,
                        },
                        "tags": [],
                    }
                ],
            }
        ],
    }


def _seed_essay_papers_for_pagination(client: TestClient, count: int) -> None:
    """灌 count 套 essay paper 到 DB 已 published, 让 GET /papers/essay/list
    能拉数据.

    sort_order 倒序灌 (大的先, 小的后), 这样 paper_code 排序 ASC + sort_order
    DESC 给一个稳定可预测的次序.
    """
    from sqlalchemy import select

    from sikao_api.db.models import Paper
    from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService

    db_session = client.app.state.db.session_factory()
    try:
        service = ExamPaperService(db_session)
        for idx in range(count):
            paper_code = f"ESSAY-PAGE-{idx:03d}"
            payload = _build_essay_paper_payload_for_pagination(
                paper_code, sort_order=10000 - idx
            )
            # essay paper 无 assets, base_dir 只用于 asset path resolve, 复用
            # settings.upload_dir 即可; payload bytes 直接传 files=[].
            content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            service.import_standard_json_files(
                files=[(f"{paper_code}.standard.json", content)],
                base_dir=Path(client.app.state.settings.upload_dir),
                created_by="test-user",
            )
            db_session.flush()
            paper = db_session.scalars(
                select(Paper).where(Paper.paper_code == paper_code)
            ).one()
            revision = paper.revisions[-1]
            service.publish_revision(
                paper_code=paper.paper_code,
                revision_id=revision.id,
                released_by="test-user",
            )
        db_session.commit()
    finally:
        db_session.close()


def test_essay_papers_paginate_page_1_default_page_size(tmp_path: Path) -> None:
    """GET /papers/essay/list 默认 page=1 / pageSize=20."""
    with build_client(tmp_path) as client:
        _seed_essay_papers_for_pagination(client, count=25)

        response = client.get("/api/v2/papers/essay/list")
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 25
        assert body["page"] == 1
        assert body["pageSize"] == 20
        assert len(body["items"]) == 20
        # 排序: sort_order DESC + paper_code ASC. seed 时 idx=0 拿 sort_order
        # 10000 (最大), idx=24 拿 9976. 第一页应为 idx=0..19.
        assert body["items"][0]["paperCode"] == "ESSAY-PAGE-000"
        assert body["items"][19]["paperCode"] == "ESSAY-PAGE-019"


def test_essay_papers_paginate_page_2_smaller_page_size(tmp_path: Path) -> None:
    """page=2&pageSize=5: items 不跟 page=1 重叠."""
    with build_client(tmp_path) as client:
        _seed_essay_papers_for_pagination(client, count=12)

        page1 = client.get("/api/v2/papers/essay/list?page=1&pageSize=5")
        page2 = client.get("/api/v2/papers/essay/list?page=2&pageSize=5")
        assert page1.status_code == 200
        assert page2.status_code == 200

        page1_codes = {item["paperCode"] for item in page1.json()["items"]}
        page2_codes = {item["paperCode"] for item in page2.json()["items"]}
        assert len(page1_codes) == 5
        assert len(page2_codes) == 5
        assert page1_codes.isdisjoint(page2_codes)
        assert page1.json()["total"] == 12
        assert page2.json()["total"] == 12
        assert page1.json()["page"] == 1
        assert page2.json()["page"] == 2
        assert page1.json()["pageSize"] == 5
        assert page2.json()["pageSize"] == 5


def test_essay_papers_paginate_page_size_zero_422(tmp_path: Path) -> None:
    """pageSize=0 → 422 (Query ge=1 校验)."""
    with build_client(tmp_path) as client:
        response = client.get("/api/v2/papers/essay/list?pageSize=0")
        assert response.status_code == 422


def test_essay_papers_paginate_page_size_over_50_422(tmp_path: Path) -> None:
    """pageSize=51 → 422 (Query le=50 校验), 防客户端拉爆."""
    with build_client(tmp_path) as client:
        response = client.get("/api/v2/papers/essay/list?pageSize=51")
        assert response.status_code == 422


def test_essay_papers_paginate_page_zero_422(tmp_path: Path) -> None:
    """page=0 → 422 (Query ge=1 校验, 1-based 分页)."""
    with build_client(tmp_path) as client:
        response = client.get("/api/v2/papers/essay/list?page=0")
        assert response.status_code == 422
