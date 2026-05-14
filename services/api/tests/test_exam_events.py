"""ExamEvent CRUD service + endpoint tests — ARCH §7.3 P3 (KEY OBS #5)."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db.base import Base
from sikao_api.db import schemas
from sikao_api.main import create_app
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError
from sikao_api.modules.exam_events.application.exam_events import ExamEventService
from sikao_api.modules.auth.application.security import hash_password

# ─── service-level ────────────────────────────────────────────────────────


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False, future=True
    )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_payload(**overrides: object) -> schemas.ExamEventCreateRequest:
    base = {
        "slug": "test-2027",
        "name": "测试考试",
        "category": "national",
        "exam_date": "2027-04-01",
        "precision": "estimate",
    }
    base.update(overrides)
    return schemas.ExamEventCreateRequest(**base)  # type: ignore[arg-type]


def test_create_then_list_visible(session: Session) -> None:
    service = ExamEventService(session)
    out = service.create(_create_payload())
    assert out.slug == "test-2027"
    assert out.exam_date == "2027-04-01"
    listed = service.list_visible()
    assert any(e.slug == "test-2027" for e in listed)


def test_list_visible_excludes_hidden(session: Session) -> None:
    service = ExamEventService(session)
    service.create(_create_payload(slug="visible-x", visible=True))
    service.create(_create_payload(slug="hidden-y", visible=False))
    listed = service.list_visible()
    slugs = {e.slug for e in listed}
    assert "visible-x" in slugs
    assert "hidden-y" not in slugs


def test_list_all_includes_hidden(session: Session) -> None:
    service = ExamEventService(session)
    service.create(_create_payload(slug="visible-x", visible=True))
    service.create(_create_payload(slug="hidden-y", visible=False))
    all_events = service.list_all()
    slugs = {e.slug for e in all_events}
    assert {"visible-x", "hidden-y"}.issubset(slugs)


def test_list_visible_sorted_by_exam_date(session: Session) -> None:
    service = ExamEventService(session)
    service.create(_create_payload(slug="late", exam_date="2028-01-01"))
    service.create(_create_payload(slug="early", exam_date="2027-01-01"))
    service.create(_create_payload(slug="mid", exam_date="2027-06-01"))
    out = service.list_visible()
    slugs = [e.slug for e in out]
    assert slugs == ["early", "mid", "late"]


def test_create_duplicate_slug_conflict(session: Session) -> None:
    service = ExamEventService(session)
    service.create(_create_payload())
    with pytest.raises(ConflictError) as exc:
        service.create(_create_payload())  # same slug
    assert exc.value.code == "exam_event_slug_taken"


def test_create_invalid_date_format(session: Session) -> None:
    service = ExamEventService(session)
    with pytest.raises(ValidationError, match="examDate"):
        service.create(_create_payload(exam_date="2027/04/01"))


def test_update_partial_patch(session: Session) -> None:
    service = ExamEventService(session)
    created = service.create(_create_payload())
    out = service.update(
        created.id,
        schemas.ExamEventUpdateRequest(name="改名了", precision="confirmed"),
    )
    assert out.name == "改名了"
    assert out.precision == "confirmed"
    # 未传字段保持原值
    assert out.slug == "test-2027"
    assert out.exam_date == "2027-04-01"


def test_update_nonexistent(session: Session) -> None:
    service = ExamEventService(session)
    with pytest.raises(NotFoundError):
        service.update(99999, schemas.ExamEventUpdateRequest(name="x"))


def test_update_visibility_hides_from_public(session: Session) -> None:
    service = ExamEventService(session)
    created = service.create(_create_payload())
    service.update(created.id, schemas.ExamEventUpdateRequest(visible=False))
    public = service.list_visible()
    assert all(e.slug != "test-2027" for e in public)


def test_delete_then_lookup_404(session: Session) -> None:
    service = ExamEventService(session)
    created = service.create(_create_payload())
    service.delete(created.id)
    with pytest.raises(NotFoundError):
        service.update(created.id, schemas.ExamEventUpdateRequest(name="x"))


# ─── endpoint-level ────────────────────────────────────────────────────────


@pytest.fixture
def client(tmp_path):  # type: ignore[no-untyped-def]
    settings = Settings(
        app_env="test",
        database_url=f"sqlite:///{(tmp_path / 'exam-api.db').as_posix()}",
        upload_dir=tmp_path / "uploads",
        import_tmp_dir=tmp_path / "imports",
        admin_username="admin",
        admin_password_hash=hash_password("adminpass"),
        jwt_secret="test-secret-0123456789-test-secret",
    )
    app = create_app(settings=settings, initialize_schema=True)
    with TestClient(app) as c:
        yield c


def _admin_headers() -> dict[str, str]:
    import base64

    token = base64.b64encode(b"admin:adminpass").decode("ascii")
    return {"Authorization": f"Basic {token}"}


def test_endpoint_public_list_empty(client: TestClient) -> None:
    resp = client.get("/api/v2/exam-events")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"items": []}


def test_endpoint_admin_create_then_public_list(client: TestClient) -> None:
    create_resp = client.post(
        "/api/v2/admin/exam-events",
        headers=_admin_headers(),
        json={
            "slug": "national-2028",
            "name": "2028 国考",
            "category": "national",
            "examDate": "2028-12-03",
            "registrationStart": "2028-10-15",
            "registrationEnd": "2028-10-24",
            "precision": "estimate",
            "notes": "估",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    body = create_resp.json()
    assert body["slug"] == "national-2028"
    assert body["examDate"] == "2028-12-03"
    assert body["registrationStart"] == "2028-10-15"

    pub_resp = client.get("/api/v2/exam-events")
    assert pub_resp.status_code == 200
    assert any(it["slug"] == "national-2028" for it in pub_resp.json()["items"])


def test_endpoint_admin_create_requires_auth(client: TestClient) -> None:
    resp = client.post(
        "/api/v2/admin/exam-events",
        json={
            "slug": "x",
            "name": "x",
            "category": "national",
            "examDate": "2027-01-01",
            "precision": "estimate",
        },
    )
    assert resp.status_code == 401


def test_endpoint_admin_update_partial(client: TestClient) -> None:
    create_resp = client.post(
        "/api/v2/admin/exam-events",
        headers=_admin_headers(),
        json={
            "slug": "x-2027",
            "name": "原名",
            "category": "national",
            "examDate": "2027-01-01",
            "precision": "estimate",
        },
    )
    eid = create_resp.json()["id"]
    upd = client.put(
        f"/api/v2/admin/exam-events/{eid}",
        headers=_admin_headers(),
        json={"name": "新名", "precision": "confirmed"},
    )
    assert upd.status_code == 200
    assert upd.json()["name"] == "新名"
    assert upd.json()["precision"] == "confirmed"


def test_endpoint_admin_delete(client: TestClient) -> None:
    create_resp = client.post(
        "/api/v2/admin/exam-events",
        headers=_admin_headers(),
        json={
            "slug": "doomed",
            "name": "doomed",
            "category": "other",
            "examDate": "2027-01-01",
            "precision": "estimate",
        },
    )
    eid = create_resp.json()["id"]
    del_resp = client.delete(
        f"/api/v2/admin/exam-events/{eid}", headers=_admin_headers()
    )
    assert del_resp.status_code == 204
    # public list 不再含
    pub_resp = client.get("/api/v2/exam-events")
    slugs = {it["slug"] for it in pub_resp.json()["items"]}
    assert "doomed" not in slugs
