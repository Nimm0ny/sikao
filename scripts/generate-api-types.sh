#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT/scripts/dev-python.sh" \
  "$ROOT/services/api/scripts/export_openapi.py" \
  --out "$ROOT/services/api/spec/openapi.json"

(
  cd "$ROOT"
  npx openapi-typescript services/api/spec/openapi.json -o packages/api-client/src/types/api.generated.ts
)
