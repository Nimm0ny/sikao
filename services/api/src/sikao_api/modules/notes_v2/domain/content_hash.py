from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_content_hash(body_json: dict[str, Any] | None) -> str:
    canonical = json.dumps(
        body_json or {},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.blake2b(
        canonical.encode("utf-8"),
        digest_size=32,
    ).hexdigest()
