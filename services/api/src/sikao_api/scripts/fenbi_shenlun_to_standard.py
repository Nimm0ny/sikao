from __future__ import annotations

from sikao_api.scripts._repo_import import load_repo_module

_MODULE = load_repo_module(
    relative_path="scripts/import/fenbi_shenlun_to_standard.py",
    cache_key="repo_scripts_import_fenbi_shenlun_to_standard",
)

FenbiRow = _MODULE.FenbiRow
classify_exam_scope = _MODULE.classify_exam_scope
classify_question = _MODULE.classify_question
classify_variant = _MODULE.classify_variant
convert_paper_id = _MODULE.convert_paper_id
html_to_text = _MODULE.html_to_text
load_manifest_rows = _MODULE.load_manifest_rows
main = _MODULE.main

__all__ = [
    "FenbiRow",
    "classify_exam_scope",
    "classify_question",
    "classify_variant",
    "convert_paper_id",
    "html_to_text",
    "load_manifest_rows",
    "main",
]
