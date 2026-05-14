"""Re-copy files from new_web to sikao preserving UTF-8 bytes exactly.

R2 修复 (2026-05-13)：subagent 用 PowerShell 复制时把 UTF-8 中文字符 mangled
（GBK / Windows-1252 misinterpret），加 BOM，导致 TS 解析失败。本脚本：

  1. 扫 sikao 下所有带 BOM 的 .ts/.tsx/.css/.md
  2. 计算对应 new_web 源路径（多套映射规则覆盖 frontend → apps/web、frontend → packages/*）
  3. 用 binary mode 重新覆盖 sikao 文件

不动我手写或重写过的文件（它们没有 BOM）。
"""

from __future__ import annotations

import os
from pathlib import Path

SIKAO = Path("D:/py_pj/sikao")
NEW_WEB = Path("D:/py_pj/new_web")

# 路径映射：(sikao 子路径前缀) → (new_web 源前缀) 候选。
# 顺序敏感：先匹配的优先。
MAPPINGS: list[tuple[str, list[str]]] = [
    # apps/web/src/* ← new_web/frontend/src/*（直对）
    ("apps/web/src/", ["frontend/src/"]),
    ("apps/web/scripts/", ["frontend/scripts/"]),
    ("apps/web/public/", ["frontend/public/"]),
    # packages/ui ← new_web/frontend/src/components/{ui, icons, brand} + TweaksDrawer
    ("packages/ui/src/ui/", ["frontend/src/components/ui/"]),
    ("packages/ui/src/icons/", ["frontend/src/components/icons/"]),
    ("packages/ui/src/brand/", ["frontend/src/components/brand/"]),
    # packages/domain ← hooks / store / lib / features/essay-exam 部分
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
    # packages/api-client ← src/api + src/features/essay-exam/lib/EssayClient.ts + src/types
    ("packages/api-client/src/queries/", ["frontend/src/api/"]),
    ("packages/api-client/src/types/", ["frontend/src/types/"]),
    # essay-client / request / apiQueries 是我自建的，不在源里
    # packages/answer-engine ← features/essay-exam/lib + src/lib
    ("packages/answer-engine/src/word-limit/", ["frontend/src/features/essay-exam/lib/"]),
    ("packages/answer-engine/src/grid-layout/", ["frontend/src/features/essay-exam/lib/"]),
    ("packages/answer-engine/src/highlight/", ["frontend/src/features/essay-exam/lib/"]),
    ("packages/answer-engine/src/graphic-detect/", ["frontend/src/lib/"]),
    # packages/editor ← features/essay-exam/*
    ("packages/editor/src/modals/", ["frontend/src/features/essay-exam/modals/"]),
    ("packages/editor/src/panels/", ["frontend/src/features/essay-exam/panels/"]),
    ("packages/editor/src/pieces/", ["frontend/src/features/essay-exam/pieces/"]),
    ("packages/editor/src/styles/", ["frontend/src/features/essay-exam/styles/"]),
    ("packages/editor/src/__tests__/", ["frontend/src/features/essay-exam/__tests__/"]),
    ("packages/editor/src/", ["frontend/src/features/essay-exam/"]),
    # packages/shared-utils ← src/hooks + src/lib
    ("packages/shared-utils/src/hooks/", ["frontend/src/hooks/"]),
    ("packages/shared-utils/src/", ["frontend/src/lib/"]),
    # tests/fixtures ← src/test-utils
    ("tests/fixtures/", ["frontend/src/test-utils/"]),
]


def has_bom(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            return f.read(3) == b"\xef\xbb\xbf"
    except (OSError, IOError):
        return False


def find_source(sikao_path: Path) -> Path | None:
    """Map a sikao file back to its new_web source path."""
    rel = sikao_path.relative_to(SIKAO).as_posix()
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
    skipped = 0
    not_found: list[str] = []
    for root, _, files in os.walk(SIKAO):
        # Skip node_modules
        if "node_modules" in root:
            continue
        for name in files:
            if not name.endswith((".ts", ".tsx", ".css", ".md")):
                continue
            path = Path(root) / name
            if not has_bom(path):
                continue
            src = find_source(path)
            if src is None:
                not_found.append(path.relative_to(SIKAO).as_posix())
                continue
            with src.open("rb") as f:
                content = f.read()
            # 去 BOM if 源也带（new_web 不该带，但保险）
            if content.startswith(b"\xef\xbb\xbf"):
                content = content[3:]
            with path.open("wb") as f:
                f.write(content)
            fixed += 1
            skipped += 0
    print(f"Fixed: {fixed} files")
    print(f"Skipped (no source map): {len(not_found)}")
    if not_found:
        print("  Examples (first 20):")
        for p in not_found[:20]:
            print(f"    {p}")


if __name__ == "__main__":
    main()
