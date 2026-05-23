from __future__ import annotations

import importlib.util
from functools import lru_cache
from pathlib import Path
import sys
from types import ModuleType


@lru_cache(maxsize=None)
def load_repo_module(*, relative_path: str, cache_key: str) -> ModuleType:
    repo_root = Path(__file__).resolve().parents[5]
    target_path = repo_root / relative_path
    spec = importlib.util.spec_from_file_location(cache_key, target_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load repo module from {target_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[cache_key] = module
    spec.loader.exec_module(module)
    return module
