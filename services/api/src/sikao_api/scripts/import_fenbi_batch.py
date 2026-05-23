from __future__ import annotations

from sikao_api.scripts._repo_import import load_repo_module

_MODULE = load_repo_module(
    relative_path="scripts/import/import_fenbi_batch.py",
    cache_key="repo_scripts_import_import_fenbi_batch",
)

run_batch = _MODULE.run_batch
main = _MODULE.main

__all__ = ["run_batch", "main"]
