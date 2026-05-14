"""SIKAO Wave 8 Phase B: /api/v2/user-exams CRUD endpoint tests.

覆盖 (8 test):
  - create + list 基本流
  - update partial patch
  - delete then 404
  - list 排序 (exam_date asc)
  - get single ownership 404
  - update ownership 404
  - delete ownership 404
  - create payload validation (name 空 / exam_date 缺) — 422
"""

from __future__ import annotations

from pathlib import Path

from tests.test_exam_api import bearer_headers, build_client, login


def _create_payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "name": "2027 国考",
        "examDate": "2027-12-03",
    }
    base.update(overrides)
    return base


# ─── basic CRUD ──────────────────────────────────────────────────────────


def test_create_then_list_returns_row(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        create = client.post(
            "/api/v2/user-exams",
            json=_create_payload(),
            headers=bearer_headers(token),
        )
        assert create.status_code == 201, create.text
        body = create.json()
        assert body["name"] == "2027 国考"
        assert body["examDate"] == "2027-12-03"
        assert body["id"] > 0
        assert "daysUntil" in body  # 派生字段

        lst = client.get("/api/v2/user-exams", headers=bearer_headers(token))
        assert lst.status_code == 200
        body = lst.json()
        assert body["total"] == 1
        assert body["exams"][0]["name"] == "2027 国考"


def test_update_partial_patch(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        created = client.post(
            "/api/v2/user-exams",
            json=_create_payload(),
            headers=bearer_headers(token),
        ).json()

        patched = client.patch(
            f"/api/v2/user-exams/{created['id']}",
            json={"name": "改名", "notes": "复习重点"},
            headers=bearer_headers(token),
        )
        assert patched.status_code == 200
        body = patched.json()
        assert body["name"] == "改名"
        assert body["notes"] == "复习重点"
        # 未传字段不变
        assert body["examDate"] == "2027-12-03"


def test_delete_then_get_404(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        created = client.post(
            "/api/v2/user-exams",
            json=_create_payload(),
            headers=bearer_headers(token),
        ).json()
        exam_id = created["id"]

        delete = client.delete(
            f"/api/v2/user-exams/{exam_id}", headers=bearer_headers(token)
        )
        assert delete.status_code == 204

        get_resp = client.get(
            f"/api/v2/user-exams/{exam_id}", headers=bearer_headers(token)
        )
        assert get_resp.status_code == 404


def test_list_sorted_by_exam_date_asc(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        client.post(
            "/api/v2/user-exams",
            json=_create_payload(name="后考", examDate="2028-01-01"),
            headers=bearer_headers(token),
        )
        client.post(
            "/api/v2/user-exams",
            json=_create_payload(name="先考", examDate="2027-06-01"),
            headers=bearer_headers(token),
        )
        client.post(
            "/api/v2/user-exams",
            json=_create_payload(name="中考", examDate="2027-11-15"),
            headers=bearer_headers(token),
        )

        lst = client.get(
            "/api/v2/user-exams", headers=bearer_headers(token)
        ).json()
        names = [e["name"] for e in lst["exams"]]
        assert names == ["先考", "中考", "后考"]


def test_get_single_by_id(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        created = client.post(
            "/api/v2/user-exams",
            json=_create_payload(),
            headers=bearer_headers(token),
        ).json()

        got = client.get(
            f"/api/v2/user-exams/{created['id']}", headers=bearer_headers(token)
        )
        assert got.status_code == 200
        body = got.json()
        assert body["id"] == created["id"]
        assert body["name"] == "2027 国考"


# ─── ownership ───────────────────────────────────────────────────────────


def test_get_ownership_returns_404_for_other_user(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        alice_token = login(client, "alice", "alice-pass")
        created = client.post(
            "/api/v2/user-exams",
            json=_create_payload(),
            headers=bearer_headers(alice_token),
        ).json()

        bob_token = login(client, "bob", "bob-pass")
        resp = client.get(
            f"/api/v2/user-exams/{created['id']}",
            headers=bearer_headers(bob_token),
        )
        assert resp.status_code == 404


def test_update_ownership_returns_404_for_other_user(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        alice_token = login(client, "alice", "alice-pass")
        created = client.post(
            "/api/v2/user-exams",
            json=_create_payload(),
            headers=bearer_headers(alice_token),
        ).json()

        bob_token = login(client, "bob", "bob-pass")
        resp = client.patch(
            f"/api/v2/user-exams/{created['id']}",
            json={"name": "盗用"},
            headers=bearer_headers(bob_token),
        )
        assert resp.status_code == 404


def test_delete_ownership_returns_404_for_other_user(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        alice_token = login(client, "alice", "alice-pass")
        created = client.post(
            "/api/v2/user-exams",
            json=_create_payload(),
            headers=bearer_headers(alice_token),
        ).json()

        bob_token = login(client, "bob", "bob-pass")
        resp = client.delete(
            f"/api/v2/user-exams/{created['id']}",
            headers=bearer_headers(bob_token),
        )
        assert resp.status_code == 404


# ─── validation ──────────────────────────────────────────────────────────


def test_create_empty_name_returns_422(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        resp = client.post(
            "/api/v2/user-exams",
            json={"name": "", "examDate": "2027-12-03"},
            headers=bearer_headers(token),
        )
        assert resp.status_code == 422


def test_create_missing_exam_date_returns_422(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        token = login(client, "alice", "alice-pass")
        resp = client.post(
            "/api/v2/user-exams",
            json={"name": "国考"},
            headers=bearer_headers(token),
        )
        assert resp.status_code == 422


# ─── auth ────────────────────────────────────────────────────────────────


def test_list_unauthorized_returns_401(tmp_path: Path) -> None:
    with build_client(tmp_path) as client:
        resp = client.get("/api/v2/user-exams")
        assert resp.status_code == 401


def test_create_unauthorized_returns_403_or_401(tmp_path: Path) -> None:
    """POST without auth: CSRF runs first → 403; both 401/403 are valid auth-gate."""
    with build_client(tmp_path) as client:
        resp = client.post("/api/v2/user-exams", json=_create_payload())
        # CSRF dependency runs before auth → 403; either way the request fails.
        assert resp.status_code in (401, 403)
