"""More thorough encoding fix: compare every sikao file with its mapped new_web
source. If bytes differ AND the source exists, overwrite sikao with source.

Skips files I created in sikao that don't have a new_web counterpart.
"""

from __future__ import annotations

import os
from pathlib import Path

SIKAO = Path("D:/py_pj/sikao")
NEW_WEB = Path("D:/py_pj/new_web")

MAPPINGS: list[tuple[str, list[str]]] = [
    ("apps/web/src/", ["frontend/src/"]),
    ("apps/web/scripts/", ["frontend/scripts/"]),
    ("apps/web/public/", ["frontend/public/"]),
    ("packages/ui/src/ui/", ["frontend/src/components/ui/"]),
    ("packages/ui/src/icons/", ["frontend/src/components/icons/"]),
    ("packages/ui/src/brand/", ["frontend/src/components/brand/"]),
    ("packages/domain/src/auth/", ["frontend/src/store/", "frontend/src/hooks/"]),
    ("packages/domain/src/answer-session/", ["frontend/src/store/", "frontend/src/hooks/"]),
    ("packages/domain/src/dashboard/", ["frontend/src/hooks/"]),
    ("packages/domain/src/llm/", ["frontend/src/hooks/"]),
    ("packages/domain/src/notes/", ["frontend/src/hooks/"]),
    ("packages/domain/src/question-bank/", ["frontend/src/lib/"]),
    ("packages/domain/src/shenlun/", [
        "frontend/src/features/essay-exam/hooks/",
        "frontend/src/features/essay-exam/lib/",
        "frontend/src/features/essay-exam/",
        "frontend/src/hooks/",
    ]),
    ("packages/domain/src/study-record/", ["frontend/src/hooks/", "frontend/src/lib/"]),
    ("packages/domain/src/wrong-book/", ["frontend/src/hooks/"]),
    ("packages/domain/src/xingce/", [
        "frontend/src/store/",
        "frontend/src/lib/",
        "frontend/src/hooks/",
    ]),
    ("packages/api-client/src/queries/", ["frontend/src/api/"]),
    ("packages/api-client/src/types/", ["frontend/src/types/"]),
    ("packages/answer-engine/src/word-limit/", ["frontend/src/features/essay-exam/lib/"]),
    ("packages/answer-engine/src/grid-layout/", ["frontend/src/features/essay-exam/lib/"]),
    ("packages/answer-engine/src/highlight/", ["frontend/src/features/essay-exam/lib/"]),
    ("packages/answer-engine/src/graphic-detect/", ["frontend/src/lib/"]),
    ("packages/editor/src/modals/", ["frontend/src/features/essay-exam/modals/"]),
    ("packages/editor/src/panels/", ["frontend/src/features/essay-exam/panels/"]),
    ("packages/editor/src/pieces/", ["frontend/src/features/essay-exam/pieces/"]),
    ("packages/editor/src/styles/", ["frontend/src/features/essay-exam/styles/"]),
    ("packages/editor/src/__tests__/", ["frontend/src/features/essay-exam/__tests__/"]),
    ("packages/editor/src/", ["frontend/src/features/essay-exam/"]),
    ("packages/shared-utils/src/hooks/", ["frontend/src/hooks/"]),
    ("packages/shared-utils/src/", ["frontend/src/lib/"]),
    ("tests/fixtures/", ["frontend/src/test-utils/"]),
]

# Files I created or rewrote that should NEVER be re-copied (no new_web source).
SAFE_FILES = {
    "packages/answer-engine/src/scoring/shenlun/weightedTotal.ts",
    "packages/answer-engine/src/scoring/shenlun/rubricTone.ts",
    "packages/answer-engine/src/scoring/shenlun/index.ts",
    "packages/answer-engine/src/scoring/xingce/aggregate.ts",
    "packages/answer-engine/src/scoring/xingce/index.ts",
    "packages/answer-engine/src/scoring/index.ts",
    "packages/answer-engine/src/session/examPhase.ts",
    "packages/answer-engine/src/session/index.ts",
    "packages/answer-engine/src/timing/elapsed.ts",
    "packages/answer-engine/src/timing/index.ts",
    "packages/answer-engine/src/index.ts",
    "packages/api-client/src/request.ts",
    "packages/api-client/src/apiQueries.ts",
    "packages/api-client/src/index.ts",
    "packages/domain/src/index.ts",
    "packages/domain/src/shenlun/examScore.ts",
    "packages/domain/src/shenlun/useEssaySessionElapsed.ts",
    "packages/domain/src/shenlun/sikaoTypes.ts",
    "packages/domain/src/xingce/viewMode.ts",
    "packages/shared-utils/src/index.ts",
    "packages/editor/src/index.ts",
    "packages/ui/src/index.ts",
    "apps/web/src/utils/request.ts",
    "apps/web/src/utils/apiQueries.ts",
    "apps/web/src/types/api.d.ts",
    "apps/web/src/test-utils/renderWithProviders.tsx",
    "apps/web/src/test-utils/server.ts",
    "apps/web/src/test-utils/handlers.ts",
    "apps/web/src/components/result/_resultHelpers.ts",
    "apps/web/src/components/result/_essayResultHelpers.ts",
    "apps/web/src/components/practice/ViewModeToggle.tsx",
    "apps/web/src/components/practice/fb/useFbSession.ts",
    "tests/fixtures/index.ts",
}


def find_source(sikao_path: Path) -> Path | None:
    rel = sikao_path.relative_to(SIKAO).as_posix()
    if rel in SAFE_FILES:
        return None
    for prefix, src_prefixes in MAPPINGS:
        if rel.startswith(prefix):
            tail = rel[len(prefix):]
            for src_prefix in src_prefixes:
                candidate = NEW_WEB / src_prefix / tail
                if candidate.is_file():
                    return candidate
    return None


def main() -> None:
    fixed = 0
    unchanged = 0
    no_source = 0
    for root, _, files in os.walk(SIKAO):
        if "node_modules" in root or ".git" in root:
            continue
        for name in files:
            if not name.endswith((".ts", ".tsx", ".css")):
                continue
            path = Path(root) / name
            src = find_source(path)
            if src is None:
                no_source += 1
                continue
            with path.open("rb") as f:
                cur = f.read()
            with src.open("rb") as f:
                target = f.read()
            if cur == target:
                unchanged += 1
                continue
            # Different bytes — overwrite to canonical source.
            with path.open("wb") as f:
                f.write(target)
            fixed += 1
    print(f"Fixed (bytes differed): {fixed}")
    print(f"Unchanged (already correct): {unchanged}")
    print(f"No source mapping (safe/local): {no_source}")


if __name__ == "__main__":
    main()
