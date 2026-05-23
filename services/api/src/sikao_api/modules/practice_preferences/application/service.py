from __future__ import annotations

from threading import RLock
from typing import Any

from cachetools import TTLCache
from sqlalchemy.orm import Session

from sikao_api.db.models_v2 import UserPracticePreferencesV2, UserV2
from sikao_api.db.schemas_v2 import (
    PracticePreferencesPatchV2,
    PracticePreferencesPayloadV1,
    PracticePreferencesResponseV2,
)
from sikao_api.modules.practice_preferences.application.defaults import (
    build_default_preferences,
)
from sikao_api.modules.practice_preferences.application.patch import (
    apply_patches_to_preferences_payload,
)
from sikao_api.modules.practice_preferences.application.reset import (
    apply_reset_sections,
)
from sikao_api.modules.practice_preferences.application.upgrader import (
    upgrade_preferences_payload,
)
from sikao_api.modules.practice_preferences.application.validators import (
    validate_preferences_payload,
)
from sikao_api.modules.practice_preferences.domain.errors import (
    SchemaVersionMismatchError,
)
from sikao_api.modules.practice_preferences.domain.types import (
    AUDIT_TRACKED_PAYLOAD_PATHS,
    CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
)
from sikao_api.modules.system.application.audit_v2 import add_audit_log

_CACHE: TTLCache[int, PracticePreferencesResponseV2] = TTLCache(maxsize=512, ttl=60)
_LOCK = RLock()


class PracticePreferencesService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_preferences(self, *, user: UserV2) -> PracticePreferencesResponseV2:
        return self._get_preferences(user=user, use_cache=True, write_cache=True)

    def put_preferences(
        self,
        *,
        user: UserV2,
        schema_version: int,
        payload: PracticePreferencesPayloadV1 | dict[str, Any],
    ) -> PracticePreferencesResponseV2:
        self._ensure_current_schema_version(user=user, schema_version=schema_version)
        before = self._existing_preferences_snapshot(user=user)
        validated = validate_preferences_payload(payload)
        response = self._write_preferences(user=user, payload=validated)
        self._audit_create_or_update(user=user, before=before, after=response)
        return response

    def patch_preferences(
        self,
        *,
        user: UserV2,
        schema_version: int,
        patches: list[PracticePreferencesPatchV2],
    ) -> PracticePreferencesResponseV2:
        self._ensure_current_schema_version(user=user, schema_version=schema_version)
        current = self._get_preferences(user=user, use_cache=False, write_cache=False)
        merged = apply_patches_to_preferences_payload(
            payload=current.payload,
            patches=patches,
        )
        validated = validate_preferences_payload(merged)
        response = self._write_preferences(user=user, payload=validated)
        self._audit_create_or_update(user=user, before=current, after=response)
        return response

    def reset_preferences(
        self,
        *,
        user: UserV2,
        sections: list[str],
    ) -> PracticePreferencesResponseV2:
        current = self._get_preferences(user=user, use_cache=False, write_cache=False)
        merged, resolved_sections = apply_reset_sections(
            payload=current.payload,
            sections=sections,
        )
        validated = validate_preferences_payload(merged)
        response = self._write_preferences(user=user, payload=validated)
        self._audit_reset(
            user=user,
            before=current,
            after=response,
            sections=resolved_sections,
        )
        return response

    def invalidate_cache(self, *, user_id: int) -> None:
        with _LOCK:
            _CACHE.pop(user_id, None)

    def _ensure_current_schema_version(
        self,
        *,
        user: UserV2,
        schema_version: int,
    ) -> None:
        if schema_version == CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION:
            return
        current = self._get_preferences(user=user, use_cache=False, write_cache=False)
        raise SchemaVersionMismatchError(
            current_version=CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
            payload=current.payload,
        )

    def _existing_preferences_snapshot(
        self,
        *,
        user: UserV2,
    ) -> PracticePreferencesResponseV2 | None:
        row = self.session.get(UserPracticePreferencesV2, user.id)
        if row is None:
            return None
        return self._get_preferences(user=user, use_cache=False, write_cache=False)

    def _get_preferences(
        self,
        *,
        user: UserV2,
        use_cache: bool,
        write_cache: bool,
    ) -> PracticePreferencesResponseV2:
        if use_cache:
            with _LOCK:
                cached = _CACHE.get(user.id)
            if cached is not None:
                return cached

        row = self.session.get(UserPracticePreferencesV2, user.id)
        if row is None:
            response = PracticePreferencesResponseV2(
                schema_version=CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
                payload=build_default_preferences(),
                is_default=True,
                updated_at=None,
            )
        else:
            response = self._build_response_from_row(user=user, row=row)

        if write_cache:
            with _LOCK:
                _CACHE[user.id] = response
        return response

    def _build_response_from_row(
        self,
        *,
        user: UserV2,
        row: UserPracticePreferencesV2,
    ) -> PracticePreferencesResponseV2:
        if row.schema_version == CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION:
            payload = PracticePreferencesPayloadV1.model_validate(row.payload)
            schema_version = row.schema_version
        else:
            upgrade = upgrade_preferences_payload(
                payload=row.payload,
                from_version=row.schema_version,
            )
            payload = upgrade.payload
            schema_version = upgrade.to_version
            self._audit_lazy_upgrade(
                user=user,
                from_version=row.schema_version,
                to_version=upgrade.to_version,
            )
        return PracticePreferencesResponseV2(
            schema_version=schema_version,
            payload=payload,
            is_default=False,
            updated_at=row.updated_at,
        )

    def _write_preferences(
        self,
        *,
        user: UserV2,
        payload: PracticePreferencesPayloadV1,
    ) -> PracticePreferencesResponseV2:
        row = self.session.get(UserPracticePreferencesV2, user.id)
        serialized = payload.model_dump(mode="json")
        if row is None:
            row = UserPracticePreferencesV2(
                user_id=user.id,
                payload=serialized,
                schema_version=CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
            )
            self.session.add(row)
        else:
            row.payload = serialized
            row.schema_version = CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION
            self.session.add(row)
        self.session.flush()
        self.invalidate_cache(user_id=user.id)
        return PracticePreferencesResponseV2(
            schema_version=CURRENT_PRACTICE_PREFERENCES_SCHEMA_VERSION,
            payload=payload,
            is_default=False,
            updated_at=row.updated_at,
        )

    def _audit_lazy_upgrade(
        self,
        *,
        user: UserV2,
        from_version: int,
        to_version: int,
    ) -> None:
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="system",
            actor_id="practice_preferences_upgrader",
            action="practice_preferences.schema_upgraded",
            target_type="user_practice_preferences_v2",
            target_id=user.id,
            before={"schemaVersion": from_version},
            after={"schemaVersion": to_version},
            metadata={
                "fromVersion": from_version,
                "toVersion": to_version,
            },
        )

    def _audit_create_or_update(
        self,
        *,
        user: UserV2,
        before: PracticePreferencesResponseV2 | None,
        after: PracticePreferencesResponseV2,
    ) -> None:
        after_snapshot = _tracked_audit_snapshot(after)
        if before is None:
            add_audit_log(
                self.session,
                user_id=user.id,
                actor_type="user",
                actor_id=str(user.id),
                action="practice_preferences.created",
                target_type="user_practice_preferences_v2",
                target_id=user.id,
                after=after_snapshot,
            )
            return

        before_snapshot = _tracked_audit_snapshot(before)
        if before_snapshot == after_snapshot:
            return
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="practice_preferences.updated",
            target_type="user_practice_preferences_v2",
            target_id=user.id,
            before=before_snapshot,
            after=after_snapshot,
            diff=_build_diff(before_snapshot, after_snapshot),
        )

    def _audit_reset(
        self,
        *,
        user: UserV2,
        before: PracticePreferencesResponseV2,
        after: PracticePreferencesResponseV2,
        sections: list[str],
    ) -> None:
        add_audit_log(
            self.session,
            user_id=user.id,
            actor_type="user",
            actor_id=str(user.id),
            action="practice_preferences.reset",
            target_type="user_practice_preferences_v2",
            target_id=user.id,
            before=_tracked_audit_snapshot(before),
            after=_tracked_audit_snapshot(after),
            diff=_build_diff(
                _tracked_audit_snapshot(before),
                _tracked_audit_snapshot(after),
            ),
            metadata={
                "reason": "user_reset",
                "sections": sections,
            },
        )


def _tracked_audit_snapshot(
    response: PracticePreferencesResponseV2,
) -> dict[str, Any]:
    payload = response.payload.model_dump(mode="json")
    snapshot: dict[str, Any] = {
        "schemaVersion": response.schema_version,
    }
    tracked_payload: dict[str, Any] = {}
    for path in AUDIT_TRACKED_PAYLOAD_PATHS:
        _copy_path(payload, tracked_payload, path)
    if tracked_payload:
        snapshot["payload"] = tracked_payload
    return snapshot


def _copy_path(source: dict[str, Any], target: dict[str, Any], path: str) -> None:
    segments = path.split(".")
    cursor: Any = source
    for segment in segments:
        if not isinstance(cursor, dict) or segment not in cursor:
            return
        cursor = cursor[segment]

    target_cursor: dict[str, Any] = target
    source_cursor: Any = source
    for segment in segments[:-1]:
        source_cursor = source_cursor[segment]
        child = target_cursor.setdefault(segment, {})
        if not isinstance(child, dict):
            child = {}
            target_cursor[segment] = child
        target_cursor = child
    target_cursor[segments[-1]] = cursor


def _build_diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    diff: dict[str, Any] = {}
    keys = set(before) | set(after)
    for key in keys:
        before_value = before.get(key)
        after_value = after.get(key)
        if before_value == after_value:
            continue
        if isinstance(before_value, dict) and isinstance(after_value, dict):
            nested = _build_diff(before_value, after_value)
            if nested:
                diff[key] = nested
            continue
        diff[key] = {
            "before": before_value,
            "after": after_value,
        }
    return diff
