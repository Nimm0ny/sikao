"""Static guard: every alembic-named identifier must fit PostgreSQL's 63-char cap.

PG silently truncates identifiers > NAMEDATALEN-1 (= 63 by default), but
SQLAlchemy raises IdentifierError at compile time once it sees the over-long
name on a PG dialect. Our test bench runs on SQLite which does not validate
identifier length at all, so a too-long FK / index / constraint name slips
through CI and only blows up on the real PG verification gate.

This test reads every migration file under database/migrations/alembic/versions/
and pulls out string literals passed to:
- create_foreign_key (first positional arg)
- create_index       (first positional arg)
- create_unique_constraint (first positional arg, batch_op)
- create_table       (first positional arg)
- create_check_constraint (named via `name=` kwarg)
- UniqueConstraint   (`name=` kwarg)
- ForeignKeyConstraint (`name=` kwarg)

For each name found we assert len(name) <= 63. The test is deliberately a
syntactic AST scan rather than a runtime PG round-trip — it must run on the
SQLite-only test bench and still catch PG-only regressions before merge.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

PG_MAX_IDENTIFIER = 63

REPO_ROOT = Path(__file__).resolve().parents[3]
VERSIONS_DIR = REPO_ROOT / "database" / "migrations" / "alembic" / "versions"

# alembic op / batch_op calls whose first positional arg is the identifier
_POSITIONAL_NAME_FUNCS = frozenset(
    {
        "create_foreign_key",
        "create_index",
        "create_unique_constraint",
        "create_check_constraint",
        "create_table",
        "create_primary_key",
    }
)
# constructors / calls whose identifier is in the `name=` kwarg
_KWARG_NAME_FUNCS = frozenset(
    {
        "UniqueConstraint",
        "ForeignKeyConstraint",
        "CheckConstraint",
        "PrimaryKeyConstraint",
        "Index",
    }
)


def _iter_named_identifiers(tree: ast.AST) -> list[tuple[str, int]]:
    """Yield (identifier, lineno) tuples for every named DDL identifier in `tree`."""
    found: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if isinstance(func, ast.Attribute):
            func_name = func.attr
        elif isinstance(func, ast.Name):
            func_name = func.id
        else:
            continue

        if func_name in _POSITIONAL_NAME_FUNCS and node.args:
            first = node.args[0]
            if isinstance(first, ast.Constant) and isinstance(first.value, str):
                found.append((first.value, node.lineno))

        if func_name in _KWARG_NAME_FUNCS:
            for kw in node.keywords:
                if kw.arg == "name" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                    found.append((kw.value.value, node.lineno))
    return found


def _collect_overlong_identifiers() -> list[tuple[Path, str, int]]:
    overlong: list[tuple[Path, str, int]] = []
    for migration in sorted(VERSIONS_DIR.glob("*.py")):
        source = migration.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(migration))
        for name, lineno in _iter_named_identifiers(tree):
            if len(name) > PG_MAX_IDENTIFIER:
                overlong.append((migration, name, lineno))
    return overlong


def test_no_alembic_identifier_exceeds_pg_limit() -> None:
    """Every alembic-named DDL identifier must be <= 63 chars (PG NAMEDATALEN-1).

    Catches identifier-length regressions before they hit the PG verification
    gate. SQLite happily accepts arbitrary lengths; PG raises IdentifierError.
    """
    overlong = _collect_overlong_identifiers()
    if overlong:
        lines = [
            f"  {path.name}:{lineno}  ({len(name)} chars)  {name!r}"
            for path, name, lineno in overlong
        ]
        pytest.fail(
            "Migration identifiers exceed PostgreSQL's 63-char limit:\n"
            + "\n".join(lines)
            + "\n\nPG silently fails on these but SQLite test bench does not. "
            "Shorten the identifier, e.g. drop the redundant <col>_<ref_table> "
            "suffix when the prefix already names the source table.",
        )
