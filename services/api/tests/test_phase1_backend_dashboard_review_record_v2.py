from __future__ import annotations

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Iterator

from fastapi.testclient import TestClient
from sqlalchemy import select

from sikao_api.core.config import Settings
from sikao_api.db.models_v2 import EssayReportV2, EssaySubmissionV2, PracticeSessionV2, UserV2
from sikao_api.main import create_app
from sikao_api.modules.record.application.service import build_learning_record_summary

RECORD_TITLES_BY_KIND = {
    "xingce_practice": "Xingce practice",
    "essay_submission": "Essay submission",
}
RECORD_STATUSES = {"pending", "completed", "failed"}


@contextmanager
def build_client(tmp_path: Path) -> Iterator[tuple[TestClient, object]]:
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'phase1-dashboard-review-record.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        jwt_secret="phase1-dashboard-review-record-secret",
        app_version="phase1-test",
        git_sha="phase1-sha",
        image_tag="phase1-tag",
        build_time="2026-05-20T00:00:00Z",
        schema_version="phase1-schema",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as client:
        yield client, app


def _register_email(
    client: TestClient,
    *,
    email: str = "alice@example.com",
) -> tuple[str, str]:
    response = client.post(
        "/api/v2/auth/register/email",
        json={
            "email": email,
            "password": "secret123",
            "displayName": "Alice",
        },
    )
    assert response.status_code == 200, response.text
    auth_cookie = response.cookies.get("auth_session_v2")
    csrf_cookie = response.cookies.get("csrf_token_v2")
    assert auth_cookie is not None
    assert csrf_cookie is not None
    client.headers["X-CSRF-Token"] = csrf_cookie
    return auth_cookie, csrf_cookie


def _load_user(app: object, *, email: str = "alice@example.com") -> UserV2:
    session = app.state.db.session_factory()
    try:
        user = session.scalar(
            select(UserV2)
            .join(UserV2.email_contacts)
            .where(UserV2.display_name == "Alice")
            .where(UserV2.email_contacts.any(email=email))
        )
        assert user is not None
        session.expunge(user)
        return user
    finally:
        session.close()


def _insert_practice_session(
    app: object,
    *,
    user_id: int,
    started_at: datetime,
    track: str = "xingce",
    entry_kind: str = "papers",
    status: str = "draft",
    submitted_at: datetime | None = None,
) -> None:
    session = app.state.db.session_factory()
    try:
        session.add(
            PracticeSessionV2(
                user_id=user_id,
                track=track,
                entry_kind=entry_kind,
                status=status,
                started_at=started_at,
                submitted_at=submitted_at,
                payload_json={},
            )
        )
        session.commit()
    finally:
        session.close()


def _insert_essay_submission(
    app: object,
    *,
    user_id: int,
    submitted_at: datetime,
    status: str = "submitted",
    score: Decimal | None = None,
    report_status: str | None = None,
) -> None:
    session = app.state.db.session_factory()
    try:
        submission = EssaySubmissionV2(
            user_id=user_id,
            content="essay content",
            status=status,
            submitted_at=submitted_at,
        )
        session.add(submission)
        session.flush()
        if report_status is not None:
            session.add(
                EssayReportV2(
                    submission_id=submission.id,
                    status=report_status,
                    score=score,
                    feedback_json={},
                )
            )
        session.commit()
    finally:
        session.close()


def _assert_records_contract_shape(payload: dict) -> None:
    assert set(payload.keys()) == {"items", "total", "page", "pageSize"}
    assert payload["total"] >= len(payload["items"])
    assert payload["page"] == 1
    assert payload["pageSize"] == 20
    if payload["total"] == 0:
        assert payload["items"] == []
    else:
        assert 0 < len(payload["items"]) <= payload["pageSize"]
    for item in payload["items"]:
        assert set(item.keys()) == {"id", "kind", "title", "status", "href", "score", "occurredAt"}
        assert item["kind"] in RECORD_TITLES_BY_KIND
        assert item["title"] == RECORD_TITLES_BY_KIND[item["kind"]]
        assert item["status"] in RECORD_STATUSES
        assert isinstance(item["href"], str)
        assert item["href"].startswith("/")


def _load_summary_payload(app: object, *, user_id: int) -> dict:
    session = app.state.db.session_factory()
    try:
        user = session.get(UserV2, user_id)
        assert user is not None
        return build_learning_record_summary(session, user=user).model_dump(by_alias=True, mode="json")
    finally:
        session.close()


def _assert_review_item_contract_shape(
    item: dict,
    *,
    expected_id: int,
    expected_kind: str,
    expected_title: str,
    expected_status: str,
    expected_href: str,
) -> None:
    assert set(item.keys()) == {"id", "kind", "title", "status", "href", "createdAt"}
    assert item["id"] == expected_id
    assert item["kind"] == expected_kind
    assert item["title"] == expected_title
    assert item["status"] == expected_status
    assert item["href"] == expected_href
    assert isinstance(item["createdAt"], str)


def test_dashboard_progress_review_and_record_routes_require_auth(tmp_path: Path) -> None:
    protected_paths = [
        "/api/v2/dashboard/overview",
        "/api/v2/dashboard/today",
        "/api/v2/dashboard/today/continue",
        "/api/v2/dashboard/today/review",
        "/api/v2/dashboard/weekly-plan",
        "/api/v2/dashboard/weekly-plan/goal",
        "/api/v2/dashboard/weekly-plan/today-completion",
        "/api/v2/dashboard/full-plan",
        "/api/v2/dashboard/progress",
        "/api/v2/dashboard/progress/timeseries?from=2026-05-21&to=2026-05-21&granularity=day",
        "/api/v2/dashboard/progress/weakness",
        "/api/v2/dashboard/progress/diagnosis",
        "/api/v2/profile/records",
        "/api/v2/review/items",
        "/api/v2/review/smart",
        "/api/v2/review/items/1",
    ]
    with build_client(tmp_path) as (client, _app):
        for path in protected_paths:
            response = client.get(path)
            assert response.status_code == 401, (path, response.text)
            assert response.json()["code"] == "auth_required"
        assert client.get("/api/v2/dashboard/records").status_code == 404
        adjust = client.put("/api/v2/dashboard/weekly-plan/adjust", json={"dailyMinutesTarget": 120})
        assert adjust.status_code == 401, adjust.text
        assert adjust.json()["code"] == "auth_required"


def test_review_redo_requires_auth_when_not_logged_in(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        response = client.post("/api/v2/review/items/1/redo")

        assert response.status_code == 401, response.text
        assert response.json()["code"] == "auth_required"


def test_review_redo_requires_csrf_for_cookie_auth(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _register_email(client)
        client.headers.pop("X-CSRF-Token", None)

        response = client.post("/api/v2/review/items/1/redo")

        assert response.status_code == 403, response.text
        assert response.json()["code"] == "csrf_missing"


def test_review_redo_rejects_cookie_auth_with_csrf_mismatch(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _register_email(client)
        client.headers["X-CSRF-Token"] = "csrf-mismatch-marker"

        response = client.post("/api/v2/review/items/1/redo")

        assert response.status_code == 403, response.text
        assert response.json()["code"] == "csrf_mismatch"


def test_review_redo_accepts_cookie_auth_with_matching_csrf(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _register_email(client)

        response = client.post("/api/v2/review/items/1/redo")

        assert response.status_code == 200, response.text
        assert response.json() == {"ok": False, "status": "unavailable"}


def test_review_redo_accepts_bearer_auth_without_csrf_cookie(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        auth_cookie, _csrf_cookie = _register_email(client)
        client.cookies.clear()
        client.headers.pop("X-CSRF-Token", None)

        response = client.post(
            "/api/v2/review/items/1/redo",
            headers={"Authorization": f"Bearer {auth_cookie}"},
        )

        assert response.status_code == 200, response.text
        assert response.json() == {"ok": False, "status": "unavailable"}


def test_review_redo_rejects_mixed_credentials_without_csrf_when_cookie_present(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        auth_cookie, _csrf_cookie = _register_email(client)
        client.headers.pop("X-CSRF-Token", None)

        response = client.post(
            "/api/v2/review/items/1/redo",
            headers={"Authorization": f"Bearer {auth_cookie}"},
        )

        assert response.status_code == 403, response.text
        assert response.json()["code"] == "csrf_missing"


def test_review_redo_prefers_cookie_session_over_bearer_when_both_are_present(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        auth_cookie, csrf_cookie = _register_email(client)
        client.cookies.set("auth_session_v2", "cookie-precedence-invalid-token")
        client.headers["X-CSRF-Token"] = csrf_cookie

        response = client.post(
            "/api/v2/review/items/1/redo",
            headers={"Authorization": f"Bearer {auth_cookie}"},
        )

        assert response.status_code == 401, response.text
        assert response.json()["code"] == "session_not_found"


def test_review_items_returns_empty_paginated_skeleton_payload(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _register_email(client)

        response = client.get("/api/v2/review/items")

        assert response.status_code == 200, response.text
        assert response.json() == {"items": [], "total": 0, "page": 1, "pageSize": 20}


def test_review_item_detail_returns_placeholder_skeleton_payload(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, _app):
        _register_email(client)

        response = client.get("/api/v2/review/items/7")

        assert response.status_code == 200, response.text
        payload = response.json()
        assert set(payload.keys()) == {"item", "history", "actions"}
        _assert_review_item_contract_shape(
            payload["item"],
            expected_id=7,
            expected_kind="placeholder",
            expected_title="review-item-7",
            expected_status="empty",
            expected_href="/wrong-book/7",
        )
        assert payload["history"] == []
        assert len(payload["actions"]) == 1
        assert payload["actions"][0]["key"] == "redo"
        assert payload["actions"][0]["href"] == "/wrong-book/7/redo"
        assert payload["actions"][0]["enabled"] is False
        assert isinstance(payload["actions"][0]["label"], str)


def test_dashboard_today_continue_reads_latest_in_progress_session(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)
        now = datetime.now(UTC).replace(tzinfo=None)
        _insert_practice_session(
            app,
            user_id=user.id,
            started_at=now - timedelta(minutes=30),
            status="in_progress",
        )

        response = client.get("/api/v2/dashboard/today/continue")

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["hasActiveSession"] is True
        assert payload["status"] == "in_progress"
        assert payload["track"] == "xingce"
        assert payload["href"].startswith("/practice/sessions/")


def test_dashboard_records_empty_contract_is_consistent(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)

        response = client.get("/api/v2/profile/records")

        assert response.status_code == 200, response.text
        payload = response.json()
        summary = _load_summary_payload(app, user_id=user.id)
        _assert_records_contract_shape(payload)
        assert summary["totalAttempts"] == 0
        assert summary["xingceAttempts"] == 0
        assert summary["essayAttempts"] == 0
        assert summary["completedAttempts"] == 0
        assert payload["items"] == []
        assert payload["total"] == 0


def test_dashboard_records_xingce_only_uses_single_aggregate_semantics(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)
        now = datetime.now(UTC).replace(tzinfo=None)
        _insert_practice_session(
            app,
            user_id=user.id,
            started_at=now - timedelta(hours=2),
            status="draft",
        )
        _insert_practice_session(
            app,
            user_id=user.id,
            started_at=now - timedelta(hours=1),
            status="submitted",
            submitted_at=now - timedelta(minutes=30),
        )

        response = client.get("/api/v2/profile/records")

        assert response.status_code == 200, response.text
        payload = response.json()
        summary = _load_summary_payload(app, user_id=user.id)
        _assert_records_contract_shape(payload)
        assert summary["totalAttempts"] == 2
        assert summary["xingceAttempts"] == 2
        assert summary["essayAttempts"] == 0
        assert summary["completedAttempts"] == 1
        assert payload["total"] == 2
        assert len(payload["items"]) == 2
        assert [item["kind"] for item in payload["items"]] == ["xingce_practice", "xingce_practice"]
        assert [item["status"] for item in payload["items"]] == ["completed", "pending"]
        assert [item["href"] for item in payload["items"]] == [
            "/practice/result/2",
            "/practice/sessions/1",
        ]


def test_dashboard_records_essay_only_uses_single_aggregate_semantics(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)
        now = datetime.now(UTC).replace(tzinfo=None)
        _insert_essay_submission(
            app,
            user_id=user.id,
            submitted_at=now - timedelta(minutes=20),
            score=Decimal("72.50"),
            report_status="completed",
        )

        response = client.get("/api/v2/profile/records")

        assert response.status_code == 200, response.text
        payload = response.json()
        summary = _load_summary_payload(app, user_id=user.id)
        _assert_records_contract_shape(payload)
        assert summary["totalAttempts"] == 1
        assert summary["xingceAttempts"] == 0
        assert summary["essayAttempts"] == 1
        assert summary["completedAttempts"] == 1
        assert summary["avgEssayScore"] == "72.50"
        assert payload["total"] == 1
        assert len(payload["items"]) == 1
        assert payload["items"][0]["kind"] == "essay_submission"
        assert payload["items"][0]["title"] == "Essay submission"
        assert payload["items"][0]["status"] == "completed"
        assert payload["items"][0]["score"] == "72.50"
        assert payload["items"][0]["href"] == "/essay/grades/1"


def test_dashboard_records_mixed_data_keeps_summary_items_and_total_in_sync(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)
        now = datetime.now(UTC).replace(tzinfo=None)
        _insert_practice_session(
            app,
            user_id=user.id,
            started_at=now - timedelta(hours=5),
            status="draft",
        )
        _insert_essay_submission(
            app,
            user_id=user.id,
            submitted_at=now - timedelta(hours=3),
            score=Decimal("68.00"),
            report_status="completed",
        )
        _insert_practice_session(
            app,
            user_id=user.id,
            started_at=now - timedelta(hours=1),
            status="submitted",
            submitted_at=now - timedelta(minutes=50),
        )

        response = client.get("/api/v2/profile/records")

        assert response.status_code == 200, response.text
        payload = response.json()
        summary = _load_summary_payload(app, user_id=user.id)
        _assert_records_contract_shape(payload)
        assert summary["totalAttempts"] == 3
        assert summary["xingceAttempts"] == 2
        assert summary["essayAttempts"] == 1
        assert summary["completedAttempts"] == 2
        assert summary["avgEssayScore"] == "68.00"
        assert payload["total"] == 3
        assert len(payload["items"]) == 3
        assert [item["kind"] for item in payload["items"]] == [
            "xingce_practice",
            "essay_submission",
            "xingce_practice",
        ]
        assert [item["status"] for item in payload["items"]] == [
            "completed",
            "completed",
            "pending",
        ]
        assert [item["href"] for item in payload["items"]] == [
            "/practice/result/2",
            "/essay/grades/1",
            "/practice/sessions/1",
        ]


def test_dashboard_records_support_paginated_items_with_global_total_and_summary(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)
        now = datetime.now(UTC).replace(tzinfo=None)
        for index in range(18):
            status = "submitted" if index % 2 == 0 else "draft"
            _insert_practice_session(
                app,
                user_id=user.id,
                started_at=now - timedelta(minutes=index),
                status=status,
                submitted_at=now - timedelta(minutes=index) if status == "submitted" else None,
            )
        for index, score in enumerate(
            [Decimal("80.00"), Decimal("75.00"), Decimal("70.00"), Decimal("65.00"), Decimal("60.00")]
        ):
            _insert_essay_submission(
                app,
                user_id=user.id,
                submitted_at=now - timedelta(hours=10 + index),
                score=score,
                report_status="completed",
            )

        response = client.get("/api/v2/profile/records")

        assert response.status_code == 200, response.text
        payload = response.json()
        summary = _load_summary_payload(app, user_id=user.id)
        _assert_records_contract_shape(payload)
        assert summary["totalAttempts"] == 23
        assert summary["xingceAttempts"] == 18
        assert summary["essayAttempts"] == 5
        assert summary["completedAttempts"] == 14
        assert summary["avgEssayScore"] == "70.00"
        assert payload["total"] == 23
        assert len(payload["items"]) == 20
        assert sum(1 for item in payload["items"] if item["kind"] == "xingce_practice") == 18
        assert sum(1 for item in payload["items"] if item["kind"] == "essay_submission") == 2
        assert sum(1 for item in payload["items"] if item["status"] == "completed") == 11


def test_dashboard_records_unscored_essay_without_report_normalizes_to_pending(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)
        now = datetime.now(UTC).replace(tzinfo=None)
        _insert_essay_submission(
            app,
            user_id=user.id,
            submitted_at=now - timedelta(minutes=20),
        )

        response = client.get("/api/v2/profile/records")

        assert response.status_code == 200, response.text
        payload = response.json()
        summary = _load_summary_payload(app, user_id=user.id)
        _assert_records_contract_shape(payload)
        assert summary["totalAttempts"] == 1
        assert summary["xingceAttempts"] == 0
        assert summary["essayAttempts"] == 1
        assert summary["completedAttempts"] == 0
        assert summary["avgEssayScore"] is None
        assert payload["total"] == 1
        assert payload["items"][0]["kind"] == "essay_submission"
        assert payload["items"][0]["title"] == "Essay submission"
        assert payload["items"][0]["status"] == "pending"
        assert payload["items"][0]["score"] is None
        assert payload["items"][0]["href"] == "/essay/history"


def test_dashboard_records_unscored_essay_with_pending_report_stays_pending(tmp_path: Path) -> None:
    with build_client(tmp_path) as (client, app):
        _register_email(client)
        user = _load_user(app)
        now = datetime.now(UTC).replace(tzinfo=None)
        _insert_essay_submission(
            app,
            user_id=user.id,
            submitted_at=now - timedelta(minutes=20),
            report_status="pending",
        )

        response = client.get("/api/v2/profile/records")

        assert response.status_code == 200, response.text
        payload = response.json()
        summary = _load_summary_payload(app, user_id=user.id)
        _assert_records_contract_shape(payload)
        assert summary["totalAttempts"] == 1
        assert summary["xingceAttempts"] == 0
        assert summary["essayAttempts"] == 1
        assert summary["completedAttempts"] == 0
        assert summary["avgEssayScore"] is None
        assert payload["total"] == 1
        assert payload["items"][0]["kind"] == "essay_submission"
        assert payload["items"][0]["title"] == "Essay submission"
        assert payload["items"][0]["status"] == "pending"
        assert payload["items"][0]["score"] is None
        assert payload["items"][0]["href"] == "/essay/history"
