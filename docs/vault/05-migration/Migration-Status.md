---
type: migration
status: active
owner: lhr
last-reviewed: 2026-05-21
---

# Migration Status

> 动态文档。每完成一个模块迁移必须更新本文件。第一轮迁移（R0+R1 部分）已完成。

## Summary

| Area | Status | Notes |
|------|--------|-------|
| 仓库骨架（apps/packages/services/database/docs） | complete | npm workspaces + 8 包 + 16 backend module 占位就位 |
| docs/vault 文档仓库 | complete | 主要文档就位（00-index/01-product/02-domain/03-tech/04-design/05-migration/06-decisions/08-archive） |
| Legacy Feature Inventory | complete | 顶层盘点 + 单 view 级路由清单 + components 归属表 |
| ADR | partial | 0001 Monorepo / 0002 Answer-Engine / 0003 Document-Vault 已写；0004 Models 拆分待 R2 |
| Home Phase（2026-05-22 restart baseline） | partial | M0-M2 已完成；M0.5 / SIK-31 已解锁前端 full typecheck blocker；M3 后端 deliverables 已落地主干；M4 / SIK-35、M5 / SIK-36、M6 / SIK-37 已完成；backend-first 契约与 scheduler 链已收口；前端 runtime 轨已在 `main` 上显式重启，当前 tranche 只覆盖 M7 / SIK-38 与 M8 / SIK-39；M9-M12 仍待后续 UI tranche |
| **前端代码迁移** | **complete** | **770+ 文件**已搬到正确位置；0 个 MIGRATION_TODO 残留；编码 mojibake 已修复（507 文件 binary-copy 重做）；`tsc -b --noEmit` 0 errors（test exclude）；`vite build` 1.81s 38 chunks pass |
| Auth（前端） | partial | views/auth/* + components/auth/* + domain/auth/useAuthStore 已迁；登录页面具体功能未验证 |
| User（前端） | partial | views/Profile + components/profile 已迁 |
| Question Bank（前端） | partial | views/{Papers,CategoryTree,EssayPapers,EssayPaperDetail} + components/questions 已迁 |
| Paper / Practice Set（前端） | partial | 含在 question bank 中 |
| Answer Session（前端） | partial | domain/answer-session/usePracticeStore + views/PracticeSession 已迁；视图内 scoring/state 计算未抽到 answer-engine |
| Xingce 答题（前端） | partial | domain/xingce/{useHighlightStore,useFbSettings,viewMode,practiceFontSize} + components/practice 已迁 |
| Submit / Scoring（前端） | partial | 评分逻辑仍混在 PracticeSession.tsx 与 Result.tsx，未抽到 answer-engine/scoring |
| Review / Explanation（前端） | partial | views/Result + components/result 已迁 |
| Shenlun 申论（前端） | partial | views/{EssayExamSikao,EssaySpecialty*,EssayPaperDetail,...} + domain/shenlun 已迁；批改逻辑接口未验证 |
| Editor 申论编辑器（前端） | partial | packages/editor 含 ExamShell + TopBar + modals/panels/pieces + styles + tests（36 文件） |
| Wrong Book（前端） | partial | views/{WrongBook,WrongQuestion*,SmartReview} + components/wrong-book 已合并并迁完；wrong-book 与 wrongbook 重名目录已合并 |
| Favorite（前端） | needs_review | new_web 没有独立 favorite 模块；逻辑可能并入 wrong-book 或 note_likes_favorites |
| Study Record / Plan（前端） | partial | `views/Plan` 已不存在；当前仅保留 `domain/study-record` + `components/plan` 历史资产，Home 新计划 runtime 改由 M7-M8 的 canonical queries / stores / calendar-engine 重建 |
| Notes（前端） | partial | views/{NotesHome,NoteEditor} + components/notes + domain/notes 已迁 |
| LLM / AI Chat（前端） | partial | views/ConversationsHistory + components/llm + components/ask + domain/llm 已迁 |
| Analytics / Predicted Score（前端） | partial | api-client/queries/{xingce,essay}SpecialtyQueries 已迁；具体页面消费在 Dashboard / WrongBook |
| Exam Events 考试日历（前端） | partial | views/ExamCalendar + api-client/queries/examEventsQueries 已迁 |
| Admin 后台（前端） | not_started | new_web 无独立 admin 前端 view |
| Marketing 落地页（前端） | partial | views/marketing/* 整目录已迁（运行功能，非原型） |
| @sikao/ui | partial | 167 文件（ui + icons + brand + TweaksDrawer），barrel index.ts 就位 |
| @sikao/design-system | partial | tokens.css 已收敛到 `packages/design-system/src/tokens.css`（SSOT，2026-05-13 落地）；apps/web 改 shim 完成；R2 清理 alias 层 |
| @sikao/api-client | partial | 已有 `request` / `apiQueries` / legacy query 集合；Home `M7 / SIK-38` 已重启，当前要补 canonical `plans/recommendations/progress/dashboard/profile` 模块并收口 Home helper |
| @sikao/domain | partial | 现有 10 个子领域仍偏 legacy；Home `M8 / SIK-39` 已重启，当前要新增 `plan/usePlanStore` 与 dashboard preference / adjustment / recommendation draft stores |
| @sikao/answer-engine | partial | 16+ 文件：word-limit/grid-layout/highlight/graphic-detect + **scoring/{shenlun,xingce} (R2.1) + session/examPhase (R2.2) + timing/elapsed (R2.3)** |
| @sikao/editor | partial | 36 文件，所有 modals/panels/pieces 已迁 |
| @sikao/shared-utils | partial | 31 文件，9 hooks + cn/logger/toast/motion/timing/queryRetry/isAuthError/silent-refresh/useReducedMotion + ToastHost 转发 |
| @sikao/config | not_started | 仅占位 index.ts；env / endpoints / feature-flags 待 R2 |
| **后端代码迁移** | partial | **完整 18 路由 + 49 services + 16 modules 重组完成**，main.py smoke test 通过 138 routes |
| Auth（后端 module） | partial | 1 routes + 6 services（auth/binding/recovery/sms_code/phone/security） |
| User（后端） | partial | 2 routes（routes/exams）+ 2 services（goals/exams） |
| Question Bank（后端） | partial | 1 routes + 2 services（exam_papers + aipta_import） |
| Paper（后端 module） | not_started | 占位 module；逻辑未从 question_bank 拆出（per brief 允许） |
| Answer Session（后端） | partial | 1 routes + 1 service（practice_session_last） |
| Grading（后端 module） | not_started | 占位 module；行测评分逻辑仍混在 practice，申论评分在 essay |
| Wrong Book（后端） | partial | 4 services（heatmap/mastery/weakness/wrong_book），无独立 routes（端点在 practice_v2 内） |
| Favorite（后端） | needs_review | 同前端，无独立 module |
| Study Record（后端） | partial | 1 routes + 1 service |
| Notes（后端） | partial | 3 routes（routes/notebook/social）+ 6 services |
| LLM（后端） | partial | 2 routes + 3 services + llm/ 子包 11 文件；子包嵌套 `application/llm/` 较深，待二轮扁平化 |
| Analytics（后端） | partial | 1 routes（xingce_specialty）+ 2 services（predicted_score + xingce_specialty） |
| Exam Events（后端） | partial | 1 routes + 1 service（public_router + admin_router） |
| Admin（后端） | partial | 2 routes（routes/note_reports）+ 1 service（exam_support） |
| Essay（后端 module，新建） | partial | 2 routes（routes/specialty）+ 3 services（essay_grading/essay_draft/essay_specialty） |
| System（后端） | partial | 2 routes（routes/ops）+ 3 services（errors/idempotency/ops）+ infrastructure/{email,sms} 共 8 文件 |
| services/api Dockerfile | n/a | 2026-05-13 用户拍板 sikao **不用 docker**，文件已删除（apps/web Dockerfile + nginx.conf 同步删除） |
| services/api spec/openapi.json | partial | 已复制，需配 OpenAPI export script 重新生成 |
| services/api tests/ | partial | 75 个 test 文件复制，import 已重写；run pytest 等数据迁移后再验 |
| db/models.py（共享） | partial | 40+ ORM 类保留为单文件 `services/api/src/sikao_api/db/models.py`；各 module/domain/__init__.py re-export 自身用到的类（Question 5 模块 / User 9 模块），待 R2 ADR 拆分 |
| db/schemas.py（共享） | partial | 同上 |
| database/migrations | **complete** | 2026-05-13 R3：23 个 alembic version 已迁入；env.py 切到 `sikao_api.{core,db}`；alembic.ini 用 `%(here)s` 不依赖 cwd |
| database/seeds | partial | 题库种子在 `backend_data/`，由 `scripts/import/` 灌库 |
| database/schema | partial | `exam_papers.schema.sql` 已复制作对照；真实 schema SSOT 仍是 ORM + alembic |
| scripts/import | **complete** | 5 个批量脚本（sync_fenbi_mirror / fenbi_to_standard / fenbi_shenlun_to_standard / aipta_text_to_standard / import_fenbi_batch）已从 `services/api/src/sikao_api/scripts/` 挪到 `scripts/import/`；默认路径切到 `$BACKEND_DATA_ROOT/xingce` |
| tests/e2e | not_started | new_web/E2E/ 整体未迁 |
| apps/mobile | not_started | 占位 |
| apps/tablet | not_started | 占位 |
| apps/admin | not_started | 占位 |
| services/worker | not_started | 占位 |
| services/storage | not_started | 占位 |

## 迁移成果

- **770+ 前端文件** 复制到正确位置（apps/web 459 + packages/ 286 + tests/fixtures 2 + scripts 9 + public 5）
- **138 后端 routes 注册** 在 `sikao_api.main:app`，0 个 `from app.` 残留 import
- **16 个后端 module** 按 brief §7.2 四层结构（domain/application/infrastructure/interface）就位
- **5 个连字符目录改 snake_case**（question_bank / answer_session / wrong_book / study_record / exam_events），Python 包名合法

## 关键 needs_review / 跟进项

### 前端跨包引用（39 个 MIGRATION_TODO）

按 FE 子代理报告，packages/ 内部还有 39 处 `@/` 引用回 apps/web（违反 packages → apps 不能反向依赖）：

| 类型 | 影响 | 二轮修法 |
|------|------|---------|
| `@/types/api` `@/types/study-plan` | packages 引用 web 的 types | 抽到 `packages/api-client/src/types/` 或 `packages/domain/src/` |
| `@/utils/request` `@/utils/apiQueries` | packages 引用 web 的 axios 实例 | 抽到 `packages/api-client/src/` |
| `@/test-utils/server` `renderWithProviders` | packages 测试引用 web test-utils | 建 `packages/test-utils/` 或迁到 `tests/` |
| `@/components/essay/sikao/types` | domain/shenlun 引用 web 组件 types | 把 types 上提到 `packages/domain/src/shenlun/` |
| `@/components/practice/ViewModeToggle` | domain/xingce/viewMode 引用 web 组件 prop 类型 | 同上 |
| `@/lib/ui-copy` | packages/ui 引用 web ui-copy | brief 允许，保持 |

### 业务逻辑深抽（R2 完成 2026-05-13）

- ✅ **R2.1 scoring**：`packages/answer-engine/src/scoring/`
  - `shenlun/weightedTotal.ts` — 申论 fullScore 加权（抽自 domain/shenlun/examScore.ts）
  - `shenlun/rubricTone.ts` — 维度判定 + ESSAY_WEAK_THRESHOLD（抽自 _essayResultHelpers.ts）
  - `xingce/aggregate.ts` — classifyCell / buildClassificationSets / buildWrongItems / calcDurationSeconds（抽自 _resultHelpers.ts）
- ✅ **R2.2 session**：`packages/answer-engine/src/session/examPhase.ts` — 5 状态机 + 8 个 can*/assert/isTerminal/isTicking/acceptsShortcut 守卫（抽自 domain/shenlun/types.ts）
- ✅ **R2.3 timing**：`packages/answer-engine/src/timing/elapsed.ts` — computeElapsedSeconds (wallclock) + nextTickElapsed (tick) + formatElapsed + remainingSeconds + defaultXingceExamSeconds（抽自 useFbSession + useEssaySessionElapsed）

原 view / hook 留 backward-compat re-export shim（`from './examScore'` / `from '@/lib/cn'` 等老路径仍能工作）。新代码请直接从 `@sikao/answer-engine/*` 引入。

### R2.4 跨包反向引用清理（完成 2026-05-13）

- ✅ `@/utils/request` → `@sikao/api-client/request`（axios 实例统一）
- ✅ `@/utils/apiQueries` → `@sikao/api-client/apiQueries`
- ✅ `@/types/api`、`@/types/api.generated`、`@/types/study-plan` → `@sikao/api-client/types/*`
- ✅ `@/test-utils/*` → `@sikao/test-utils/*`（path 映射到 `tests/fixtures/`）
- ✅ `@/components/practice/ViewModeToggle.PracticeViewMode` → `@sikao/domain/xingce/viewMode`
- ✅ `@/components/essay/sikao/types` → `@sikao/domain/shenlun/sikaoTypes`
- ✅ `@/lib/*`、`@/hooks/*`、`@/store/*`、`@/api/*`、`@/components/{icons,ui,brand}/*`、`@/features/essay-exam/*` 全量批改
- ✅ 33 个 MIGRATION_TODO 注释删除
- ✅ 剩 1 处 `@/lib/ui-copy`（brief §4 文案 SSOT 铁律允许）

### R2 编码修复（附加成果）

发现 subagent bulk-copy 时 PowerShell 编码（GBK → UTF-8 双重编码）破坏了 507 个 .ts/.tsx 文件中的 CJK 字符。修复脚本 `scripts/migration/fix_encoding_v2.py` 通过二进制比对 + 重新从 new_web 拷贝完成 SSOT 恢复。

### 后端待跟进

- **pyproject.toml 依赖缺失**（FE+BE 都跑过后才能完整确认）：`typer`, `aiosqlite`, `email-validator`, `redis`（limiter）, `tencentcloud-sdk-python-sms`, `bcrypt`, `python-dotenv`。需 `pip install -e ".[dev]"` 后跑 `pip check` 补
- **llm 子包嵌套** `modules/llm/application/llm/`：路径太深，二轮 flatten 到 `modules/llm/application/`
- **db/models.py 单文件**：5 个 module re-export Question，9 个 re-export User。R2 提 ADR-0004 拆分到 `db/models/<domain>.py`
- **alembic Dockerfile COPY**：commented out，R3 启用时同步取消注释 + 调整 path

### 重名 / 合并

- `components/wrong-book/` ∪ `components/wrongbook/` → `apps/web/src/components/wrong-book/`（无文件名冲突）。`views/WrongBook.tsx` 内的 `from '@/components/wrongbook'` 已手工改为 `'@/components/wrong-book'`。

### 跳过

- `views/EssayCategoryTree.tsx` + 测试：路由 redirect 到 EssaySpecialty，标 `legacy_skipped`，**未迁**

## 数据迁移

详见 [[Data-Migration]]。本轮**整体跳过**（用户补数据中）。

## 验证

| Check | Result | Notes |
|-------|--------|-------|
| install | not_run | 待 `npm install` + `pip install -e ".[dev]"` |
| typecheck (frontend) | not_run | 跑 `npx tsc -b --noEmit` 前需处理 39 个 MIGRATION_TODO（部分会报错） |
| typecheck (backend) | not_run | `mypy app` 待 deps 补全 |
| lint | not_run | `npm run lint` + `ruff check` 待跑 |
| web start | not_run | apps/web/src/main.tsx 已是 new_web 全量版本，需先 `npm install` 后跑 |
| api smoke | pass | 子代理报告 create_app() 跑通，**138 路由注册**，无 import 错误（不连 DB） |
| api start (with DB) | blocked | 数据未迁，DB schema 缺失，预期失败 |

## 关联

- [[Migration-Plan]] / [[Legacy-Feature-Inventory]] / [[Data-Migration]] / [[Migration-Summary]]
- [[ADR-0001-Monorepo]] / [[ADR-0002-Answer-Engine]] / [[ADR-0003-Document-Vault]]
