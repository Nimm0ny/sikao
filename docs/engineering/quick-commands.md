---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-14
---

# Quick Commands

> 高频命令完整速查。`CLAUDE.md §11.5` 只留 5–6 条最高频，其它在本文件查。
>
> **必读触发条件**：
> - 跑 Multica / Backend / Frontend / 整栈 / 投产 命令不确定参数时
> - 系统架构疑问时，参考本文件 §系统架构速查
> - Alembic / pytest / vitest 不确定子命令时

## Multica

```bash
# 版本
multica version

# 登录状态
multica auth status

# 浏览器登录
multica login

# 启动 daemon
multica daemon start

# daemon 状态
multica daemon status --output json

# daemon 日志
multica daemon logs -n 100

# workspace
multica workspace list
multica workspace get <workspace-id> --output json
multica workspace watch <workspace-id>

# issue 读取
multica issue get <issue-id> --output json
multica issue comment list <issue-id>
multica issue runs <issue-id> --output json

# issue 状态：先查 help，兼容 positional / --set 两种形式
multica issue status --help
multica issue status <issue-id> in_progress
multica issue status <issue-id> in_review
multica issue status <issue-id> blocked
multica issue status <issue-id> done

# issue 评论
multica issue comment add <issue-id> --content "<message>"

# 创建 issue
multica issue create --title "<title>" --description "<description>" --priority medium

# 指派 issue：先查 help，兼容 --to / --agent 两种形式
multica issue assign --help
multica issue assign <issue-id> --to "<agent-or-member-name>"

# agent 列表
multica agent list
```

任何 Multica 命令不确定时，先运行：

```bash
multica --help
multica issue --help
multica issue comment --help
multica issue status --help
multica issue assign --help
multica daemon --help
```

禁止编造 CLI 参数或子命令。

## Backend (`services/api/`)

```bash
# 装依赖
cd services/api && pip install -e ".[dev,postgres]"

# 起 dev server（连本地 PG）
DATABASE_URL=postgresql+psycopg://exam_api:secret@127.0.0.1:5432/exam_api \
  uvicorn sikao_api.main:app --reload --port 8000 --host 127.0.0.1

# 测试
cd services/api && pytest                            # 全套
pytest tests/test_auth.py                            # 单文件
pytest tests/test_auth.py::test_login_ok -v          # 单 case
pytest -k "study_plan and not slow"                  # 关键字筛
pytest --cov=sikao_api --cov-report=term-missing     # 覆盖率

# Alembic（从仓库根，alembic.ini 用 %(here)s 不依赖 cwd）
cd D:/py_pj/sikao
alembic -c database/migrations/alembic.ini upgrade head   # apply 全部 migration
alembic -c database/migrations/alembic.ini downgrade -1   # 回滚一格
alembic -c database/migrations/alembic.ini revision -m "add foo column"   # 新建空 migration
alembic -c database/migrations/alembic.ini current        # 当前 head

# OpenAPI 重新生成（pre-push hook 会检 spec drift；改路由后必跑）
cd services/api && python -m sikao_api.cli.export_openapi --out spec/openapi.json

# Lint / typecheck（ruff + mypy 在 [tool.ruff] / [tool.mypy]）
cd services/api && ruff check src tests
cd services/api && mypy src
```

## Frontend (`apps/web/` —— monorepo npm workspaces)

```bash
# 装依赖（根目录，npm workspaces 一次装齐 apps/* + packages/*）
cd D:/py_pj/sikao && npm install

# Dev server（端口纪律见 CLAUDE.md §11：18080 是唯一端口，5173 完全禁）
npm run dev                                           # 根目录代理到 @sikao/web
# 等价于：cd apps/web && npm run dev -- --host 127.0.0.1 --port 18080 --strictPort

# 测试
cd apps/web && npx vitest run                        # 全套
npx vitest run src/views/__tests__/Foo.test.tsx      # 单文件
npx vitest run -t "renders empty state"              # 单 case 名匹配
npm run test:watch                                   # watch 模式
npm run test:coverage                                # 覆盖率

# 验证三关（CLAUDE.md §7 必过）
cd apps/web && npm run lint                          # ESLint + 7 个自定义 lint:*
cd apps/web && npx tsc -b --noEmit                   # typecheck（npm run build 包含）
cd apps/web && npm run build                         # 生产构建（vite build → dist/）

# API 类型同步（BE 改契约后 FE 跑这个 regen packages/api-client/src/types/api.generated.ts）
cd apps/web && npm run generate:types
```

## 题库导入（backend_data → DB）

```bash
# 配 backend_data 位置（默认 D:/py_pj/backend_data，行测 764 + 申论 745 套）
export BACKEND_DATA_ROOT=D:/py_pj/backend_data

# 批量导入行测（每套独立事务，三层 dedupe）
python -m scripts.import.import_fenbi_batch

# 单 paper 转换
python -m scripts.import.fenbi_to_standard --input $BACKEND_DATA_ROOT/xingce/papers/<id_name> --output $BACKEND_DATA_ROOT/import-staging/<paperCode>
```

## 本地整栈（native，CLAUDE.md §11 全场景禁 docker）

```bash
# 1. PG: 本地 postgres native install 跑 127.0.0.1:5432（已 native PID 跑着，不需要起）
psql -h 127.0.0.1 -p 5432 -U exam_api -d exam_api -c "SELECT 1"  # 验证

# 2. 拉 alembic schema（一次性）
alembic -c database/migrations/alembic.ini upgrade head

# 3. BE: native uvicorn
cd services/api && uvicorn sikao_api.main:app --reload --port 8000 --host 127.0.0.1

# 4. FE: native vite (端口 18080 写死)
cd apps/web && npm run dev -- --host 127.0.0.1 --port 18080 --strictPort

# 访问：http://127.0.0.1:18080
```

## 投产 / 部署（全 native，不用 docker）

sikao **不用 docker**（2026-05-13 lhr 拍板）。投产链路全 native：

- **PG**：生产机 native PostgreSQL install + systemd 守护
- **services/api**：`uvicorn sikao_api.main:app --host 0.0.0.0 --port 8000`，由 systemd / supervisor / pm2-python 守护
- **apps/web**：`npm run build` → `apps/web/dist/`，由 nginx / caddy 静态托管，反代 `/api/v2` 到后端 8000
- **题库灌库**：跑 `python -m scripts.import.import_fenbi_batch` 一次性导入 1509 套（行测 764 + 申论 745）

> 历史：new_web §8 投产 build & push 走 docker 是铁律；sikao 已删除 Dockerfile + nginx.conf，转 native 部署链路。

## 系统架构速查

完整在 `docs/vault/03-tech/Architecture.md`。简版：

- **3 进程单机**：nginx（静态托管 :18080，反代 `/api/v2` 到 :8000）→ `sikao_api` (FastAPI uvicorn, :8000) → `postgres` native (:5432)
- **dev DB**：dev server 用本地 PG (`127.0.0.1:5432`)；pytest 用 function-scoped SQLite；**prod**：native PG 16
- **数据流核心闭环**：登录 → `/papers` → start session → `/practice/sessions/{id}/submit` (per-answer) → `/complete` (terminal) → `/result` → wrong-book
- **题库导入**：host VPS fenbi_scraper → `backend_data/xingce/` (rsync mirror) → adapter → `backend_data/import-staging/` → in-process `ExamPaperService`（详见 [[Question-Bank]]）
- **Design tokens 三处 SSOT**：sikao R2 收敛到 `packages/design-system/src/tokens.css`（apps/web/src/styles/tokens.css 暂留 backward-compat）（详见 CLAUDE.md §4）

## 关联

- [[Master-Role]] — master 模式行为约束
- [[Multica-Workflow]] — Multica issue 完整流程
- [[Question-Bank]] — 题库导入设计 rationale
