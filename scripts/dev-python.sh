#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  exec "$ROOT/.venv/bin/python" "$@"
fi

if command -v python3 >/dev/null 2>&1; then
  exec python3 "$@"
fi

if command -v python >/dev/null 2>&1; then
  exec python "$@"
fi

echo "No Python interpreter found. Create .venv or install python3." >&2
exit 127
