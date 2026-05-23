from __future__ import annotations

from dataclasses import dataclass

from sikao_api.db.schemas_v2 import PracticePreferencesPayloadV1


@dataclass(frozen=True)
class InvalidPreferenceFieldError(Exception):
    field: str
    message: str


@dataclass(frozen=True)
class SchemaVersionMismatchError(Exception):
    current_version: int
    payload: PracticePreferencesPayloadV1


@dataclass(frozen=True)
class InvalidPatchPathError(Exception):
    path: str
    message: str


@dataclass(frozen=True)
class InvalidResetSectionError(Exception):
    section: str
    message: str


@dataclass(frozen=True)
class UnsupportedPracticePreferencesSchemaVersionError(Exception):
    from_version: int
    to_version: int
