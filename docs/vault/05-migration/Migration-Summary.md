---
type: migration
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Migration Summary — Round 1

> 第一轮 new_web → sikao 迁移总结。

## Completed

### 工程化骨架

- ✅ sikao 根目录 npm workspaces（`apps/*` + `packages/*`）
- ✅ 8 个前端 package 骨架（ui / design-system / api-client / domain / answer-engine / editor / shared-utils / config）
- ✅ apps/web 工程化（package.json + vite.config + tsconfig.{json,app,node} + index.html）
- ✅ apps/{mobile, tablet, admin} 占位 README，状态 `not_started`
- ✅ services/api 工程化（pyproject.toml + 16 个 module 目录）
- ✅ services/{worker, storage} 占位
- ✅ database/{migrations, seeds, schema} 占位 README
- ✅ scripts/{migration, import} + tests/{e2e, fixtures} 占位
- ✅ tsconfig.base.json（顶层 path 映射）
- ✅ .gitignore / README.md / AGENTS.md（sikao 专属，不复制 new_web）

### 文档仓库（docs/vault）

- ✅ 00-index：Home / Roadmap / Glossary
- ✅ 01-product：Product-Overview / Feature-Map / User-Flows
- ✅ 02-domain：Question-Bank / Answer-Session / Xingce / Shenlun / Grading / Study-Record
- ✅ 03-tech：Architecture / Frontend / Backend / Database / API-Standard / Auth
- ✅ 04-design：Design-System / Web-Layout / Mobile-Layout / Tablet-Layout
- ✅ 05-migration：Migration-Plan / Migration-Status / Legacy-Feature-Inventory / Data-Migration / Migration-Summary
- ✅ 06-decisions：ADR-0001 Monorepo / ADR-0002 Answer-Engine / ADR-0003 Document-Vault
- ✅ 08-archive：归档占位
- ✅ templates：module-readme.md / adr.md
- ✅ assets：占位

### 前端代码迁移（770+ 文件）

- ✅ `apps/web/src/`（459 文件）
  - components/ 14 子目录 + __tests__（326 文件）
  - views/ 28 顶层 + 子目录（100 文件）
  - styles/ (5) + lib/ui-copy/ (16) + utils/ + types/ + test-utils/ + router/ + layouts/
- ✅ `apps/web/scripts/`：9 个 lint-*.mjs + generate-types.mjs
- ✅ `apps/web/public/`：favicon / icons / og-image.svg / version.json
- ✅ `packages/ui/`（167 文件）：ui + icons + brand + TweaksDrawer，barrel index.ts 就位
- ✅ `packages/domain/`（34 文件）：auth / answer-session / dashboard / llm / notes / question-bank / shenlun / study-record / wrong-book / xingce 10 子领域
- ✅ `packages/api-client/`（11 文件）：6 个 queries + types/api.generated + essay-client
- ✅ `packages/shared-utils/`（31 文件）：9 hooks + cn / logger / toast / motion / timing / queryRetry / isAuthError / silent-refresh / useReducedMotion / ToastHost
- ✅ `packages/answer-engine/`（7 文件）：word-limit + grid-layout + highlight + graphic-detect 子目录
- ✅ `packages/editor/`（36 文件）：ExamShell + TopBar + modals + panels + pieces + styles + tests
- ✅ `tests/fixtures/`：essayExamMock.ts
- ✅ Import 重写：321 文件、690 处 `from '@sikao/*'` 自动改写完成
- ✅ wrong-book 与 wrongbook 重名目录合并到 `wrong-book/`

### 后端代码迁移（700+ 文件）

- ✅ 16 个 module 按 brief §7.2 分层（domain/application/infrastructure/interface）：
  - auth: 1 routes + 6 services
  - user: 2 routes + 2 services
  - question_bank: 1 routes + 2 services
  - answer_session: 1 routes + 1 service
  - wrong_book: 4 services（端点在 practice_v2 内）
  - essay（新建）: 2 routes + 3 services
  - analytics: 1 routes + 2 services
  - study_record: 1 routes + 1 service
  - notes: 3 routes + 6 services
  - llm: 2 routes + 3 services + 11 文件 llm/ 子包
  - exam_events: 1 routes + 1 service
  - admin: 2 routes + 1 service
  - system: 2 routes + 3 services + 8 文件 email/sms infrastructure
  - paper / favorite / grading: 占位 module（per brief 允许）
- ✅ `services/api/src/sikao_api/main.py`：完整改写，18 router 注册，**138 路由** smoke pass
- ✅ `services/api/src/sikao_api/{core,db,cli,scripts}`：完整迁入
- ✅ `services/api/src/sikao_api/db/{models,schemas}.py`：单文件保留（短期共享），各 module/domain/__init__.py re-export
- ✅ `services/api/tests/`：75 个测试文件复制 + import 重写
- ✅ `services/api/spec/openapi.json` 已复制；~~Dockerfile~~ 2026-05-13 用户拍板 sikao 不用 docker，已删除
- ✅ Python 包名 snake_case：5 个连字符目录已改名
- ✅ Import 重写：0 个 `from app.` 残留（全量重写完成）

## Partial

- **业务逻辑深抽未完成**：行测/申论评分仍在 views 内联，未抽到 `packages/answer-engine/scoring`；session 状态机、计时器同样未独立。这是 brief §9.4-9.6 的核心抽离，需 R2 专题做。
- **39 个 MIGRATION_TODO**：packages 内部反向引用 apps/web 的 39 处（types / utils / test-utils / 部分组件 prop 类型），需 R2 修正。
- **db/models.py 单文件**：40+ ORM 跨 5-9 个 module re-export。需 R2 ADR-0004 拆分。
- **llm 子包嵌套** `modules/llm/application/llm/`：路径过深，待 R2 flatten。
- **`@sikao/config`**：仅占位 index.ts，env/endpoint/feature-flags 未实现。
- **`@sikao/design-system`**：tokens.css 仍在 `apps/web/src/styles/tokens.css`，未集中到本包；待 R2 把三处 SSOT 收敛。

## Blocked

- **数据迁移**（alembic versions / fenbi 题库 / seeds）：用户告知"数据有缺漏在补"，**整体阻塞**，等用户告知后启动 R3。
- 因此 services/api 实际 DB 连接 / pytest 跑业务用例会失败，本轮不验。

## Skipped

按 brief §1.3 + 用户指示明确不迁的目录与文件：

- ❌ `new_web/design/` `element/` `sop/` `tmp/`（设计原型、流程图、临时文件）
- ❌ `new_web/data/` `new_web_data/`（数据，跟 R3 一起）
- ❌ `new_web/E2E/`（暂跳，R3 评估）
- ❌ `new_web/reports/`（历史报告）
- ❌ `new_web/CHANGELOG.md` `README.md`（new_web 历史，不复制为 sikao 文档）
- ❌ `new_web/AGENTS.md` `new_web/CLAUDE.md`（new_web agent 守则；sikao 已立独立 AGENTS.md）
- ❌ `apps/exam-api/alembic/`（R3）
- ❌ `apps/exam-api/var/` `__pycache__/` `*.pyc` `exam_api.egg-info/`
- ❌ `apps/exam-api/AGENTS.md` `CHANGELOG.md` `README.md`
- ❌ `frontend/dist/` `node_modules/` `*.log`
- ❌ `views/EssayCategoryTree.tsx` + 测试（路由 redirect 到 EssaySpecialty）— `legacy_skipped`

## Not Migrated

本轮明确不做（brief §3.2 后置功能）：

- 新 UI 设计重做
- 新原型落地
- 新业务流程扩展
- AI 批改增强
- 智能组卷增强
- 复杂学习分析
- 文档关系图谱
- 多人协作
- 复杂权限系统

## Prototype Handling

✅ 确认 `new_web/design/`、`new_web/element/`、`new_web/sop/`、`new_web/tmp/` 等所有设计原型路径**未迁入** `sikao` 新项目路径。

✅ 确认 `sikao/` 下**不存在**以下被 brief §1.3 禁止的目录：

- `sikao/prototype/` `sikao/prototypes/` `sikao/design-prototype/`
- `sikao/apps/web/prototype/` `sikao/apps/web/design/`
- `sikao/docs/prototype-from-new-web/`

`apps/web/src/views/marketing/` 内的落地页是**运行功能**而非原型（带路由 `/`），按 brief §3.1 属于"现有运行功能"，允许迁移。

## Validation

| Check | Result | Notes |
|-------|--------|-------|
| install | not_run | 待 `npm install`（无 lockfile 一次性大装包） |
| typecheck (frontend) | not_run | 39 个 MIGRATION_TODO 跨包引用会先报错，需 R2 修后再跑 |
| typecheck (backend) | not_run | `mypy app` 待 pyproject 补缺失 deps |
| lint (frontend) | not_run | `npm run lint` 含 7 个自定义 lint:* 脚本，路径需 path-rewrite |
| lint (backend) | not_run | `ruff check app tests` 待 deps 装齐 |
| web start | not_run | `npm run dev`（端口 18080）待 npm install 完成 |
| api smoke (no DB) | **pass** | `create_app()` 跑通，**138 路由**全部注册，0 import 错误 |
| api start (with DB) | blocked | 数据未迁（用户在补） |
| pytest | not_run | 75 个测试文件已就位，待 deps + DB 补完 |

## Next Steps

### R1 收尾（用户拍板后）

1. 跑 `npm install` 验证 workspaces 解析
2. 跑 `npx tsc -b --noEmit -w @sikao/web` 看 typescript 报错清单（预计 ~39 处与 MIGRATION_TODO 对应）
3. 修复 39 个 MIGRATION_TODO（types / utils / test-utils 上提到 packages）

### R2 业务逻辑深抽

1. 把 PracticeSession.tsx + Result.tsx 内的 scoring 抽到 `@sikao/answer-engine/scoring/xingce.ts`
2. session 状态机独立到 `@sikao/answer-engine/session/`
3. 计时器独立到 `@sikao/answer-engine/timing/`
4. **ADR-0004**：db/models.py 单文件拆分时机
5. **ADR-0005**：llm 子包扁平化
6. 补 `@sikao/config` 内容（env / endpoints / feature-flags）
7. token SSOT 收敛到 `@sikao/design-system`（三处对齐 → 收口到本包）

### R3 数据迁移（用户补完数据后）

1. `apps/exam-api/alembic/` → `database/migrations/`
2. ~~启用 Dockerfile 内 alembic COPY 行~~ 不用 docker，跳过
3. `data/import/fenbi_shenlun_*` → `database/seeds/` 或 `scripts/import/` 输入源
4. `data/artifacts/exam_papers.schema.sql` → `database/schema/`
5. fenbi adapter 与 backfill 脚本移到 `scripts/import/`

### R4 多端

1. apps/mobile 选型 ADR（PWA / Capacitor / RN / Expo）
2. apps/tablet 申论双模 device-aware shell 收敛
3. apps/admin 独立前端立项

### 工程化跟进

1. **CHANGELOG.md**：sikao 建立自己的 Keep-a-Changelog
2. **CI**：GitHub Actions / harness 流水线在 sikao 重新配置
3. **OpenAPI export**：services/api 内置 export script，与 `api-client/types/api.generated.ts` 同步
4. **Lint 路径**：apps/web/scripts/lint-*.mjs 内 hardcode `frontend/src/` 改 `apps/web/src/`
5. **package.json deps**：pyproject 补 typer / aiosqlite / email-validator / redis / tencent SMS / bcrypt

## 关联

- [[Migration-Plan]] / [[Migration-Status]] / [[Legacy-Feature-Inventory]] / [[Data-Migration]]
- [[ADR-0001-Monorepo]] / [[ADR-0002-Answer-Engine]] / [[ADR-0003-Document-Vault]]
