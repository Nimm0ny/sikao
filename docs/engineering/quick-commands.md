---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-21
---

# Quick Commands

> 不确定参数时先跑 `--help`，禁止编造 CLI。

## Gates

```bash
npm run gate:preflight
node scripts/gates/gate-runner.mjs multica-intake --issue <issue-id>
node scripts/gates/gate-runner.mjs review --reviewed
npm run gate:validation
node scripts/gates/gate-runner.mjs git
```

PowerShell 如果拦截 `npm.ps1`，用 `npm.cmd` 执行同一 npm 命令。

## Multica

```bash
multica version
multica auth status
multica daemon status --output json
multica issue get <issue-id> --output json
multica issue comment list <issue-id>
multica issue runs <issue-id> --output json
multica issue comment add <issue-id> --content "<message>"
multica issue status --help
```

## Frontend

```bash
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
```

Hard constraints:

- Dev / preview frontend port is `18080` only.
- Do not start Vite on `5173`.
- UI changes require browser smoke.

## Backend

```bash
cd services/api
pip install -e ".[dev,postgres]"
ruff check src tests
mypy src
pytest
uvicorn sikao_api.main:app --reload --port 8000 --host 127.0.0.1
```

Alembic from repo root:

```bash
alembic -c database/migrations/alembic.ini upgrade head
alembic -c database/migrations/alembic.ini current
alembic -c database/migrations/alembic.ini revision -m "add foo column"
```

## Data Import

```bash
python -m scripts.import.sync_fenbi_mirror
python -m scripts.import.fenbi_to_standard --input <paper-dir> --output <staging-dir>
python -m scripts.import.import_fenbi_batch
```

Rule: data import must stay `mirror -> staging -> DB`.

## Deploy

- No docker in any scenario.
- Build locally, commit locally, push, then VPS pull.
- Production version tag format: `YYYY-MM-DD-HHMM`.

## Links

- `docs/engineering/gate-automation.md`
- `docs/vault/03-tech/Architecture.md`
- `docs/vault/04-design/Design-System.md`
