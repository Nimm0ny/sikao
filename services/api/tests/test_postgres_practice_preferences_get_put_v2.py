from __future__ import annotations

import os
from pathlib import Path
from typing import Any, cast

import pytest

from _helpers.practice_content_support import build_postgres_client, register_user
from sikao_api.db.models_v2 import AuditLogV2, UserPracticePreferencesV2, UserV2
from sikao_api.modules.practice_preferences.application.service import (
    PracticePreferencesService,
)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_preferences_get_default_and_put(tmp_path: Path) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)

        get_response = client.get("/api/v2/profile/practice-preferences")
        assert get_response.status_code == 200, get_response.text
        body = get_response.json()
        assert body["schemaVersion"] == 1
        assert body["isDefault"] is True
        assert body["payload"]["customPractice"]["lastUsedCount"] == 10

        put_response = client.put(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "payload": {
                    **body["payload"],
                    "customPractice": {
                        **body["payload"]["customPractice"],
                        "lastUsedCount": 20,
                    },
                    "ui": {
                        **body["payload"]["ui"],
                        "themePreference": "dark",
                    },
                },
            },
        )
        assert put_response.status_code == 200, put_response.text
        assert put_response.json()["payload"]["customPractice"]["lastUsedCount"] == 20

        second_get = client.get("/api/v2/profile/practice-preferences")
        assert second_get.status_code == 200, second_get.text
        assert second_get.json()["isDefault"] is False
        assert second_get.json()["payload"]["customPractice"]["lastUsedCount"] == 20

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            row = session.get(UserPracticePreferencesV2, user_id)
            assert row is not None
            assert row.schema_version == 1
            assert row.payload["customPractice"]["lastUsedCount"] == 20
            audits = list(
                session.query(AuditLogV2)
                .filter_by(
                    user_id=user_id,
                    target_type="user_practice_preferences_v2",
                    target_id=user_id,
                )
                .order_by(AuditLogV2.id.asc())
            )
            assert [audit.action for audit in audits] == [
                "practice_preferences.created"
            ]


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_preferences_put_validates_schema_and_bindings(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        register_user(client)
        current = client.get("/api/v2/profile/practice-preferences").json()

        mismatch = client.put(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 99,
                "payload": current["payload"],
            },
        )
        assert mismatch.status_code == 422, mismatch.text
        assert mismatch.json()["code"] == "schema_version_mismatch"
        assert mismatch.json()["schemaVersion"] == 1

        duplicate = client.put(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "payload": {
                    **current["payload"],
                    "keyboard": {
                        "enabled": True,
                        "bindings": {
                            **current["payload"]["keyboard"]["bindings"],
                            "favorite": "a",
                        },
                    },
                },
            },
        )
        assert duplicate.status_code == 422, duplicate.text
        assert duplicate.json()["code"] == "invalid_preference_field"
        assert duplicate.json()["field"] == "keyboard.bindings"

        unknown_field = client.put(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "payload": {
                    **current["payload"],
                    "ui": {
                        **current["payload"]["ui"],
                        "unexpectedField": True,
                    },
                },
            },
        )
        assert unknown_field.status_code == 422, unknown_field.text
        detail = unknown_field.json()["detail"]
        assert any(item["loc"][-1] == "unexpectedField" for item in detail)


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_preferences_patch_is_atomic_and_reset_writes_audit(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        current = client.get("/api/v2/profile/practice-preferences").json()

        seed = client.put(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "payload": {
                    **current["payload"],
                    "ui": {
                        **current["payload"]["ui"],
                        "themePreference": "dark",
                    },
                    "customPractice": {
                        **current["payload"]["customPractice"],
                        "lastUsedCount": 20,
                    },
                    "keyboard": {
                        **current["payload"]["keyboard"],
                        "bindings": {
                            **current["payload"]["keyboard"]["bindings"],
                            "favorite": "g",
                        },
                    },
                },
            },
        )
        assert seed.status_code == 200, seed.text

        untracked_patch = client.patch(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "patches": [
                    {"path": "customPractice.lastUsedCount", "value": 30},
                ],
            },
        )
        assert untracked_patch.status_code == 200, untracked_patch.text

        invalid_patch = client.patch(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "patches": [
                    {"path": "ui.themePreference", "value": "light"},
                    {"path": "keyboard.bindings.favorite", "value": "a"},
                ],
            },
        )
        assert invalid_patch.status_code == 422, invalid_patch.text
        assert invalid_patch.json()["code"] == "invalid_preference_field"

        object_patch = client.patch(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "patches": [
                    {"path": "ui", "value": {"themePreference": "light"}},
                ],
            },
        )
        assert object_patch.status_code == 422, object_patch.text
        assert object_patch.json()["code"] == "invalid_patch_path"

        malformed_patch = client.patch(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "patches": [
                    {"path": "ui..themePreference", "value": "light"},
                ],
            },
        )
        assert malformed_patch.status_code == 422, malformed_patch.text
        assert malformed_patch.json()["code"] == "invalid_patch_path"

        extra_patch_field = client.patch(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "patches": [
                    {
                        "path": "ui.themePreference",
                        "value": "light",
                        "unexpected": True,
                    }
                ],
            },
        )
        assert extra_patch_field.status_code == 422, extra_patch_field.text
        detail = extra_patch_field.json()["detail"]
        assert any(item["loc"][-1] == "unexpected" for item in detail)

        after_invalid = client.get("/api/v2/profile/practice-preferences").json()
        assert after_invalid["payload"]["ui"]["themePreference"] == "dark"
        assert after_invalid["payload"]["keyboard"]["bindings"]["favorite"] == "g"
        assert after_invalid["payload"]["customPractice"]["lastUsedCount"] == 30

        tracked_patch = client.patch(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "patches": [
                    {"path": "ui.themePreference", "value": "light"},
                ],
            },
        )
        assert tracked_patch.status_code == 200, tracked_patch.text
        assert tracked_patch.json()["payload"]["ui"]["themePreference"] == "light"
        assert tracked_patch.json()["payload"]["customPractice"]["lastUsedCount"] == 30

        reset = client.post(
            "/api/v2/profile/practice-preferences/reset",
            json={"sections": ["custom_practice", "keyboard"]},
        )
        assert reset.status_code == 200, reset.text
        body = reset.json()
        assert body["payload"]["customPractice"]["lastUsedCount"] == 10
        assert body["payload"]["keyboard"]["bindings"]["favorite"] == "s"
        assert body["payload"]["ui"]["themePreference"] == "light"

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            audits = list(
                session.query(AuditLogV2)
                .filter_by(
                    user_id=user_id,
                    target_type="user_practice_preferences_v2",
                    target_id=user_id,
                )
                .order_by(AuditLogV2.id.asc())
            )
            assert [audit.action for audit in audits] == [
                "practice_preferences.created",
                "practice_preferences.updated",
                "practice_preferences.reset",
            ]
            assert audits[-1].metadata_json["reason"] == "user_reset"
            assert audits[-1].metadata_json["sections"] == [
                "custom_practice",
                "keyboard",
            ]


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_preferences_requires_auth_and_csrf(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        assert client.get("/api/v2/profile/practice-preferences").status_code == 401

        register_user(client)
        current = client.get("/api/v2/profile/practice-preferences").json()
        client.headers.pop("X-CSRF-Token")

        csrf_missing = client.put(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "payload": current["payload"],
            },
        )
        assert csrf_missing.status_code == 403, csrf_missing.text
        assert csrf_missing.json()["code"] == "csrf_missing"


@pytest.mark.skipif(
    not os.environ.get("TEST_POSTGRESQL_URL"),
    reason="TEST_POSTGRESQL_URL is not set",
)
def test_postgres_practice_preferences_rollback_does_not_pollute_cache(
    tmp_path: Path,
) -> None:
    with build_postgres_client(tmp_path) as client:
        user_id = register_user(client)
        current = client.get("/api/v2/profile/practice-preferences").json()
        seeded = client.put(
            "/api/v2/profile/practice-preferences",
            json={
                "schemaVersion": 1,
                "payload": {
                    **current["payload"],
                    "customPractice": {
                        **current["payload"]["customPractice"],
                        "lastUsedCount": 20,
                    },
                },
            },
        )
        assert seeded.status_code == 200, seeded.text

        app = cast(Any, client.app)
        factory = app.state.db.session_factory
        with factory() as session:
            db_user = session.get(UserV2, user_id)
            assert db_user is not None
            service = PracticePreferencesService(session)
            service.put_preferences(
                user=db_user,
                schema_version=1,
                payload={
                    **current["payload"],
                    "customPractice": {
                        **current["payload"]["customPractice"],
                        "lastUsedCount": 30,
                    },
                },
            )
            session.rollback()

        reread = client.get("/api/v2/profile/practice-preferences")
        assert reread.status_code == 200, reread.text
        assert reread.json()["payload"]["customPractice"]["lastUsedCount"] == 20
