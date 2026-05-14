"""Export FastAPI app's OpenAPI schema to JSON.

Backend API v2 Landing Plan step 1（docs/plan/backend-api-v2-landing-plan.md）。
作为机器可校验的契约：脚本输出被冻结到 apps/exam-api/spec/openapi.json，
.github/workflows/contract-check.yml 在 PR 跑相同导出并与文件 diff，非空即
fail。强迫 PR 作者要么撤回契约改动、要么显式更新冻结文件让 reviewer 在 diff
里看到契约变化。

Determinism：keys 全递归 sort，避免路由注册顺序 / Python dict-insertion
顺序产生噪音 diff。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def export_openapi(out: Path | None) -> int:
    # 延迟 import：避免脚本被 import 时就构造 FastAPI app。
    from sikao_api.main import create_app

    app = create_app()
    schema = app.openapi()
    payload = json.dumps(schema, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if out is None:
        sys.stdout.write(payload)
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(payload, encoding="utf-8")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="export-openapi",
        description="Dump FastAPI OpenAPI schema as deterministic JSON.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output file path; defaults to stdout.",
    )
    args = parser.parse_args(argv)
    return export_openapi(args.out)


if __name__ == "__main__":
    raise SystemExit(main())
