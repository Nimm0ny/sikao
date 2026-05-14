"""Compatibility wrapper for the repo-level AIPTA adapter.

The API package still imports ``sikao_api.scripts.aipta_text_to_standard`` in
the admin ingest path, while the migrated adapter lives under
``scripts/import/aipta_text_to_standard.py`` at the repository root.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


def _load_adapter() -> ModuleType:
    repo_root = Path(__file__).resolve().parents[5]
    adapter_path = repo_root / "scripts" / "import" / "aipta_text_to_standard.py"
    spec = importlib.util.spec_from_file_location("_sikao_repo_aipta_text_to_standard", adapter_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load AIPTA adapter from {adapter_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


_adapter = _load_adapter()

AiptaParseError = _adapter.AiptaParseError
compose_standard_paper = _adapter.compose_standard_paper
parse_aipta_text = _adapter.parse_aipta_text

__all__ = ["AiptaParseError", "compose_standard_paper", "parse_aipta_text"]
