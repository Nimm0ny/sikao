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
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_question_content_hash(prompt: str, content_json: Any) -> str:
    """Return the canonical 32-hex BLAKE2b digest. Accepts dict / list /
    JSON string / None for content_json (NULL -> empty object)."""
    if isinstance(content_json, (str, bytes)):
        text = content_json.decode("utf-8") if isinstance(content_json, bytes) else content_json
        normalized = json.loads(text) if text.strip() else {}
    elif content_json is None:
        normalized = {}
    else:
        normalized = content_json
    payload = (prompt or "") + "|" + json.dumps(
        normalized, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    )
    return hashlib.blake2b(payload.encode("utf-8"), digest_size=16).hexdigest()
