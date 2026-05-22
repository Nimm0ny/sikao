"""Regression guard: alembic must always resolve to exactly one head.

Two parallel head revisions cause `alembic upgrade head` to fail with
"Multiple head revisions are present". The 1011 merge migration unifies them;
this test fails fast if a future PR introduces a new branching head without
adding a corresponding merge migration.
"""

from __future__ import annotations

import os
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


_REPO_ROOT = Path(__file__).resolve().parents[3]
_ALEMBIC_INI = _REPO_ROOT / "database" / "migrations" / "alembic.ini"


def _script_directory() -> ScriptDirectory:
    # alembic env.py imports sikao_api modules at config load time, so PYTHONPATH
    # must include the api src tree before Config() is constructed.
    api_src = str(_REPO_ROOT / "services" / "api" / "src")
    if api_src not in os.environ.get("PYTHONPATH", ""):
        os.environ["PYTHONPATH"] = (
            api_src + os.pathsep + os.environ.get("PYTHONPATH", "")
        )
    cfg = Config(str(_ALEMBIC_INI))
    return ScriptDirectory.from_config(cfg)


def test_alembic_resolves_to_single_head() -> None:
    sd = _script_directory()
    heads = sd.get_heads()
    assert len(heads) == 1, (
        f"alembic must have a single head; got {heads}. "
        "Add a merge migration (`down_revision = (head_a, head_b)`) before "
        "introducing further branching revisions."
    )


def test_alembic_head_is_merge_marker_or_descendant() -> None:
    """The single head must be at or after the 1011 merge marker."""
    sd = _script_directory()
    head = sd.get_current_head()
    assert head is not None
    # Walk the parent chain from head; the merge marker must appear on the path.
    seen: set[str] = set()
    cursor: tuple[str, ...] = (head,)
    while cursor:
        next_cursor: list[str] = []
        for rev_id in cursor:
            if rev_id in seen:
                continue
            seen.add(rev_id)
            rev = sd.get_revision(rev_id)
            if rev is None:
                continue
            down = rev.down_revision
            if down is None:
                continue
            if isinstance(down, tuple):
                next_cursor.extend(down)
            else:
                next_cursor.append(down)
        cursor = tuple(next_cursor)
    assert "1011_merge_home_drop_and_profile_tab5" in seen, (
        f"merge marker 1011 must be reachable from head; reachable revisions: {sorted(seen)}"
    )
