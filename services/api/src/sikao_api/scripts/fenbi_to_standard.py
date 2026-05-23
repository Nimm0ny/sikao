from __future__ import annotations

from sikao_api.scripts._repo_import import load_repo_module

_MODULE = load_repo_module(
    relative_path="scripts/import/fenbi_to_standard.py",
    cache_key="repo_scripts_import_fenbi_to_standard",
)

convert_paper = _MODULE.convert_paper
_build_canonical_taxonomy = _MODULE._build_canonical_taxonomy
_extract_answer_keys = _MODULE._extract_answer_keys
main = _MODULE.main

__all__ = [
    "convert_paper",
    "_build_canonical_taxonomy",
    "_extract_answer_keys",
    "main",
]
