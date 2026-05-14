---
type: architecture
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Architecture

## 总览

SIKAO 是 monorepo（npm workspaces），分层：

```
apps/        端入口（web / mobile / tablet / admin）
packages/    可复用包（ui / design-system / api-client / domain / answer-engine / editor / shared-utils / config）
services/    后端服务（api / worker / storage）
database/    迁移、seed、schema
docs/        类 Obsidian 文档仓库
scripts/     一次性脚本（migration / import）
tests/       e2e + 跨子项目 fixture
```

## 前端

- **框架**：React 19 + TypeScript + Vite 8
- **路由**：react-router-dom 7（lazy）
- **状态**：Zustand 5（store 在 `packages/domain`） + TanStack Query 5（query 在 `packages/api-client`）
- **样式**：Tailwind 4（preset 在 `packages/design-system`）
- **测试**：Vitest + Testing Library

### 包依赖图

```
apps/web → @sikao/ui, @sikao/design-system, @sikao/api-client,
           @sikao/domain, @sikao/answer-engine, @sikao/editor,
           @sikao/shared-utils, @sikao/config

@sikao/ui → @sikao/design-system, @sikao/shared-utils
@sikao/editor → @sikao/answer-engine, @sikao/ui
@sikao/domain → @sikao/api-client（hooks 内 import）
@sikao/answer-engine → 无（纯算法）
```

不允许反向依赖（apps/web 不被 packages 依赖；@sikao/ui 不依赖 @sikao/domain）。

## 后端

- **框架**：FastAPI + SQLAlchemy 2 + Alembic + Pydantic 2
- **数据库**：PostgreSQL（生产） / SQLite（dev/test）
- **认证**：JWT（httpOnly cookie + CSRF token）
- **限流**：fastapi-limiter（Redis 后端 prod / noop dev）
- **加密**：cryptography（AES-256-GCM for BYOM API key 存储）
- **测试**：pytest + httpx + factories

### 模块划分（per brief §7）

```
services/api/src/sikao_api/
  modules/
    auth / user / question-bank / paper / answer-session /
    grading / wrong-book / favorite / study-record /
    notes / llm / analytics / exam-events / admin / system
  core/   config / deps / limiter / schemas
  db/     base / session
  cli/    命令行入口
  scripts/  题库导入、backfill
  main.py
```

每 module 内（brief §7.2）：

```
domain/         领域模型与业务规则
application/    用例服务
infrastructure/ DB repo、外部服务调用
interface/      controller、dto、route
```

## 数据流核心闭环

```
登录
  → /papers
  → start session
  → /practice/sessions/:id/submit (per-answer)
  → /complete (terminal)
  → /result
  → wrong-book
```

## 端口

- 前端 dev：**18080**（硬约束，禁用 5173）
- 后端：8000
- Postgres：5432（默认，native install；端口可由 `DATABASE_URL` 覆盖）

## CORS

后端 `CORS_ALLOWED_ORIGINS`：

```
["http://127.0.0.1:18080","http://localhost:18080"]
```

## 部署

**不用 docker**（2026-05-13 用户拍板）。生产/开发全 native：

- **PostgreSQL**：native install，端口默认 5432（dev 可用 SQLite，由 `DATABASE_URL` 控制）
- **services/api**：`uvicorn sikao_api.main:app`，systemd / supervisor 守护
- **apps/web**：`npm run build` 出静态产物，由 nginx / caddy / 静态托管 host
- **不存在** `Dockerfile` / `docker-compose.yml` / `nginx.conf`（new_web 时代的 3 容器方案被舍弃）

## 数据冷存

- `D:/py_pj/backend_data/`（sikao 仓库之外，gitignored）
  - `xingce/papers/` 行测 fenbi mirror 764 套
  - `shenlun/standard_json/` 申论 standard json 745 套
- 路径由 `BACKEND_DATA_ROOT` 环境变量覆盖（默认 `D:/py_pj/backend_data`）
- 灌库走 `scripts/import/import_fenbi_batch`

## 关联

- [[Frontend]] / [[Backend]] / [[Database]] / [[API-Standard]] / [[Auth]]
- [[ADR-0001-Monorepo]] / [[ADR-0002-Answer-Engine]]
