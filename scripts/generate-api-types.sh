#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ROOT_ENV="$ROOT" "$ROOT/scripts/dev-python.sh" - <<'PY'
import json
import os
from pathlib import Path

from sikao_api.main import create_app

root = Path(os.environ["ROOT_ENV"])
spec_path = root / "services" / "api" / "spec" / "openapi.json"
spec = create_app().openapi()
spec_path.write_text(
    json.dumps(spec, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
PY

(
  cd "$ROOT"
  npx openapi-typescript services/api/spec/openapi.json -o packages/api-client/src/types/api.generated.ts
)
