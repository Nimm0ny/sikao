"""Canonical content-hash for QuestionV2 dedup.

Single source of truth for the BLAKE2b digest stored in
questions_v2.content_hash; both runtime dedup paths (WU-B18 / WU-B21) and
the WU-B10.3 backfill migration must agree byte-for-byte.

Spec: Phase-Practice 07-AI-Question-Engine §4.1. Codebase mapping (Practice
A0 §3.1) projects spec's stem / options / correct_answer onto the actual
columns prompt + content_json. Canonical input:

  prompt + "|" + json.dumps(content_json, sort_keys=True,
                           ensure_ascii=False, separators=(",", ":"))

Output: 32-char lowercase hex (digest_size=16) matching String(32).

TODO: relocate this helper to ``modules/question_bank/domain/`` once that
module is created (currently lives in ``db/`` because no question_bank
module exists yet, and the migration needs to import it before any modules
package would be ready).
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_question_content_hash(prompt: str, content_json: Any) -> str:
    """Return the canonical 32-hex BLAKE2b digest.

    AGENTS-H7 fail-fast: ``prompt`` and ``content_json`` are NOT NULL in
    questions_v2, so passing ``None`` for either is an impossible state for
    DB callers and would silently coerce two malformed rows into the same
    digest (dedup collision). Raise on those instead. ``content_json`` may
    be a dict / list / pre-serialized JSON string / bytes — the helper
    normalises all four forms before hashing.
    """
    if prompt is None:
        raise ValueError(
            "compute_question_content_hash: prompt must not be None "
            "(questions_v2.prompt is NOT NULL)"
        )
    if content_json is None:
        raise ValueError(
            "compute_question_content_hash: content_json must not be None "
            "(questions_v2.content_json is NOT NULL)"
        )

    if isinstance(content_json, (str, bytes)):
        text = content_json.decode("utf-8") if isinstance(content_json, bytes) else content_json
        normalized = json.loads(text) if text.strip() else {}
    else:
        normalized = content_json
    payload = prompt + "|" + json.dumps(
        normalized, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.blake2b(payload.encode("utf-8"), digest_size=16).hexdigest()
