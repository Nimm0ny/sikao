---
type: migration
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Legacy Feature Inventory

> new_web 现有功能盘点。本次盘点为顶层结构 + 关键文件，单 view 级别的字段细节待迁移阶段补。

## 前端（`new_web/frontend/`）

### 工程化

| 文件 | 用途 | 是否需要迁移 |
|------|------|-------------|
| `package.json` | npm deps + scripts | 是（重写到 apps/web/package.json，添加 @sikao/* workspace 依赖） |
| `vite.config.ts` | Vite 配置 + proxy + alias | 是（已迁，path 调整） |
| `tsconfig.{json,app,node}.json` | TS 配置 | 是（已迁） |
| `tailwind.config.js` + `postcss.config.js` | Tailwind | 是（迁到 apps/web，preset 抽 design-system） |
| `eslint.config.js` | ESLint | 是 |
| `vitest.config.ts` + `setupTests.ts` | Vitest | 是 |
| `Dockerfile` + `nginx.conf` | 部署 | **否** —— 2026-05-13 用户拍板 sikao 不用 docker，文件已删除 |
| `scripts/lint-*.mjs` + `scripts/generate-types.mjs` | 自定义 lint + 类型生成 | 是 |
| `index.html` | Vite 入口 | 是 |
| `dist/` | 构建产物 | 否（gitignored） |

### 路由（`src/router/index.tsx`）

37 个路由（含 redirect alias）。完整列表已记录在 docs/vault/01-product/Feature-Map.md。

### 页面（`src/views/`，38 个 .tsx + 子目录）

| 路径 | 功能 | 优先级 |
|------|------|--------|
| `auth/Login.tsx` | 登录 | P0 |
| `auth/RegisterEmail.tsx` | 邮箱注册 | P0 |
| `auth/RegisterPhone.tsx` | 手机注册 | P0 |
| `auth/ForgotPassword.tsx` | 忘记密码 | P1 |
| `auth/ResetPassword.tsx` | 重置密码 | P1 |
| `auth/VerifyEmailLanding.tsx` | 邮箱验证 | P1 |
| `auth/BindEmail.tsx` | 绑定邮箱 | P1 |
| `auth/BindPhone.tsx` | 绑定手机 | P1 |
| `auth/CompleteProfile.tsx` | 补全身份过渡期 | P1 |
| `Health.tsx` | 健康检查 | system |
| `NotFound.tsx` | 404 | P2 |
| `marketing/` | 落地页 | P1 |
| `Dashboard.tsx` + `dashboard/DashboardMobile.tsx` | 学情中心 | P0 |
| `PracticeCenter.tsx` | 行测/申论入口中枢 | P1 |
| `Papers.tsx` | 行测套卷库 | P1 |
| `CategoryTree.tsx` | 行测分类树 | P1 |
| `EssayPapers.tsx` | 申论套卷库 | P1 |
| `EssayPaperDetail.tsx` | 申论单卷详情 | P1 |
| `EssaySpecialty.tsx` | 申论专项 | P1 |
| `EssayCategoryTree.tsx` | 申论分类树（旧，已被 EssaySpecialty 替代） | legacy_skipped 候选 |
| `PracticeStart.tsx` | 答题准备 | P0 |
| `CustomPracticeStart.tsx` | 自定义练习准备 | P1 |
| `PracticeSession.tsx` | 行测答题考场 | P0 |
| `Result.tsx` | 行测成绩单 | P0 |
| `EssayExamSikao.tsx` | 申论 v2 考场 | P1 |
| `EssaySpecialtyExamSikao.tsx` | 申论专项单题答题 | P1 |
| `ShenlunSession/ShenlunSession.tsx` | 申论双模考场 dispatcher | P1 |
| `EssayExamResults.tsx` | 申论整卷成绩单 | P2 |
| `EssayGradingResult.tsx` | 申论单题批改结果 | P1 |
| `EssayHistory.tsx` | 申论历史 | P2 |
| `WrongBook.tsx` | 错题本主页 | P1 |
| `WrongQuestionDetailView.tsx` | 错题详情 | P1 |
| `WrongQuestionRedoView.tsx` | 错题重做 | P2 |
| `SmartReviewView.tsx` | 智能复盘 | P2 |
| `Plan.tsx` | 学习计划周视图 | P1 |
| `NotesHome.tsx` | 笔记本主页 | P1 |
| `NoteEditor.tsx` | 笔记编辑 | P1 |
| `Profile.tsx` | 个人中心 | P1 |
| `ExamCalendar.tsx` | 国考日历 | P2 |
| `ConversationsHistory.tsx` | AI 对话历史 | P2 |
| `result/` | 成绩单子组件 | P0 |

### 业务组件（`src/components/`）

| 子目录 | 数量 | 归属（迁移目标） |
|--------|------|-----------------|
| `ui/` | ~15 | `packages/ui` |
| `icons/` | 40+ | `packages/ui` |
| `brand/` | Logo/Wordmark | `packages/ui` |
| `layout/` | AppShell + sidebar | `apps/web/src/layouts` |
| `auth/` | RedirectGuard / SendCodeButton / OAuth | `apps/web/src/components/auth` |
| `dashboard/` + `dashboard-sikao/` | Hero/Continue/TodayPlan/Upcoming/WeakModules | `apps/web/src/components/dashboard` |
| `home/` | PaperListCard / PaperListGrid / RecentWrongMini | `apps/web/src/components/home` |
| `practice/` | PracticeDeck / AnswerCardGrid / AnswerCardPanel / NoteEditor / scroll/ScrollSession | `apps/web/src/components/practice` |
| `questions/` | QuestionDispatcher + 各题型 renderer | `packages/domain`（renderer 接口） + `apps/web`（具体渲染） |
| `essay/` | EssayFeedbackLists / Radar / groupByExamSession | `apps/web/src/components/essay` |
| `exam/` | 申论考场组件入口 | `packages/editor` |
| `result/` | ScoreModuleCard / Strength/Weakness / WrongReviewCard / AiSuggestion / Skeleton | `apps/web/src/components/result` |
| `wrong-book/` | Hero / Heatmap / Graduation / Filters | `apps/web/src/components/wrong-book` |
| `wrongbook/` | WrongQuestionList / Filters / Skeleton | 合并到上一项 |
| `notes/` | NoteCard / CaptureBar / NoteTools | `apps/web/src/components/notes` |
| `plan/` | PlanHead / PlanDay / PlanAssistant | `apps/web/src/components/plan` |
| `profile/` | AccountSecuritySection 等 | `apps/web/src/components/profile` |
| `llm/` | MessageBubble / ChatPanel + useConversationStream | `apps/web/src/components/llm` |
| `ask/` | AskDrawer | `apps/web/src/components/ask` |
| `data/` | QueryBoundary | `apps/web/src/components/data` |

### Features（`src/features/`）

| 目录 | 功能 | 归属 |
|------|------|------|
| `essay-exam/ExamShell.tsx` | 申论考场壳 | `packages/editor` |
| `essay-exam/TopBar.tsx` | 题号导航 | `packages/editor` |
| `essay-exam/hooks/useExamSession.ts` | session zustand store | `packages/domain/shenlun` |
| `essay-exam/modals/` | Prestart/Paused/Submit/Warn | `packages/editor` |
| `essay-exam/panels/` | Materials/AnswerArea/HighlightRail/Scratch | `packages/editor` |
| `essay-exam/pieces/` | GridPaper/MaterialOverview/etc | `packages/editor` |
| `essay-exam/lib/bodyChars.ts` | 字符计数 | `packages/answer-engine/word-limit` |
| `essay-exam/lib/gridLayout.ts` | 田字格布局 | `packages/answer-engine/grid-layout` |
| `essay-exam/lib/highlightRanges.ts` | 划线合并 | `packages/answer-engine/highlight` |
| `essay-exam/lib/wordLimits.ts` | 字数限制 | `packages/answer-engine/word-limit` |
| `essay-exam/lib/mapBackendPaper.ts` | API → 域模型 | `packages/domain/shenlun` |
| `essay-exam/lib/EssayClient.ts` | API 客户端 | `packages/api-client` |
| `essay-exam/data/essayExamMock.ts` | 测试 mock | `tests/fixtures` |
| `essay-exam/styles/exam.css` | 样式 | `packages/editor/styles` |
| `essay-exam/types.ts` | 域类型 | `packages/domain/shenlun` |

### Hooks（`src/hooks/`，14 个）

业务 hooks（迁到 `packages/domain`）：

- `useAskSession.ts` — AI 对话
- `useEssayDraft.ts` — 申论草稿 autosave
- `useEssaySessionElapsed.ts` — 申论计时
- `useWrongQuestionItem.ts` — 错题详情缓存
- `useWrongBookHeatmap.ts` — 错题热力图
- `useCommunityNotes.ts` — 社区笔记
- `useHomeData.ts` — 主页数据集合
- `useStudyPlanRouting.ts` — 计划路由
- `useFbSettings.ts` — 行测设置

UI 工具 hooks（迁到 `packages/shared-utils`）：

- `useDevice.ts` `useOrientation.ts` `useOnline.ts`
- `useLongPress.ts` `useSwipeAction.ts` `usePullToRefresh.ts`
- `useInputMode.ts` `useTweaks.ts`
- `useScrollSpyTab.ts`

### Stores（`src/store/`）

- `useAuthStore.ts` — `packages/domain/auth`
- `usePracticeStore.ts` — `packages/domain/answer-session`
- `useHighlightStore.ts` — `packages/domain/xingce`（划线属于行测）
- `useThemeStore.ts` — `apps/web/src/styles`（端侧偏好）

### API & Lib（`src/api/`, `src/lib/`）

| 文件 | 归属 |
|------|------|
| `api/wrongBookQueries.ts` | `packages/api-client` |
| `api/studyPlanQueries.ts` | 同上 |
| `api/essaySpecialtyQueries.ts` | 同上 |
| `api/xingceSpecialtyQueries.ts` | 同上 |
| `api/examEventsQueries.ts` | 同上 |
| `api/notebookQueries.ts` | 同上 |
| `lib/cn.ts` | `packages/shared-utils` |
| `lib/logger.ts` | 同上 |
| `lib/toast.*` + `ToastHost.tsx` | 同上 |
| `lib/motion.ts` + `useReducedMotion.ts` | 同上 |
| `lib/timing.ts` `silent-refresh.ts` `queryRetry.ts` `isAuthError.ts` | 同上 |
| `lib/exam-countdown.ts` `exam-tracking.ts` | `packages/domain/study-record` |
| `lib/category-canonicalize.ts` | `packages/domain/question-bank` |
| `lib/viewMode.ts` `practiceFontSize.ts` | `packages/domain/xingce` |
| `lib/isGraphicReasoning.ts` | `packages/answer-engine/graphic-detect` |
| `lib/ui-copy/*` | `apps/web/src/lib/ui-copy`（保留在 web 端，brief §文案 SSOT 铁律） |

## 后端（`new_web/apps/exam-api/`）

### Routes（`app/api/routes/`，18 个 v2 文件）

| Route 文件 | 主要 endpoint | 领域 |
|-----------|---------------|------|
| `auth_v2.py` | POST login/refresh/logout/send-*-code/confirm/bind/reset | auth |
| `me_v2.py` | GET predicted-score / goals; PUT goals | user / analytics |
| `papers_v2.py` | GET papers/categories/{code}/questions/assets | question-bank |
| `practice_v2.py` | POST start/submit/retry/save-answer; GET history/stats | answer-session |
| `essay_v2.py` | POST draft/submit; GET grade/drafts; PATCH mark-reviewed | essay |
| `essay_specialty_v2.py` | GET categories/questions/stats | essay-specialty |
| `xingce_specialty_v2.py` | GET categories/heatmap/weakness | analytics |
| `notes_v2.py` | CRUD `/notes/{question_id}` | notes |
| `notebook_v2.py` | CRUD notebooks/notes; GET tags | notes |
| `note_social_v2.py` | visibility/likes/comments/favorite | notes |
| `llm_v2.py` | usage / configs / test-config | llm |
| `llm_conversations_v2.py` | conversations / messages | llm |
| `study_plan_v2.py` | today / stats / task | study-record |
| `exam_events_v2.py` | list / detail / admin CRUD | exam-events |
| `user_exams_v2.py` | CRUD user exams | user |
| `admin_v2.py` | papers / questions / revisions / import-jobs | admin |
| `admin_note_reports_v2.py` | reports / mark reviewed | admin |
| `system_v2.py` | bootstrap | system |
| `ops.py` | health checks | system |

### Services（`app/services/`，~30 顶层 + 子目录）

按领域归类见 [[Backend]] § Module 清单。

### Domain（`app/domain/`）

- `models.py` — 40+ SQLAlchemy ORM，跨领域混合（按 module 拆分）
- `schemas.py` — 50+ Pydantic response/request schema

### DB（`app/db/`）

- `base.py` — declarative base + JSONB_COMPAT 跨方言
- `session.py` — DatabaseManager + 连接池

### Core（`app/core/`）

- `config.py` — Settings
- `deps.py` — get_db_session / get_current_user
- `limiter.py` — rate limiter
- `schemas.py` — CamelModel 基类 + UtcDatetime + HealthResponse

### CLI / Scripts（`app/cli/`, `app/scripts/`）

- `cli/main.py` — sikao-api 命令行入口
- `scripts/import_fenbi_batch.py` ⭐ — 题库批量导入主入口
- `scripts/sync_fenbi_mirror.py` — fenbi 镜像同步
- `scripts/fenbi_to_standard.py` — fenbi → 标准 JSON
- `scripts/fenbi_shenlun_to_standard.py` — 申论专用转换
- `scripts/aipta_text_to_standard.py` — AIPTA 转换
- `scripts/backfill_question_subject.py` — canonical_top_type 回填
- `scripts/backfill_asset_mime.py` — MIME 回填

> 数据导入脚本本轮**不迁**（用户补数据中）。R3 阶段迁到 `scripts/import/`。

### Alembic（`apps/exam-api/alembic/versions/`）

- 23 个 migration，head `0023_essay_draft_sessions`
- 本轮**不迁**

### Tests（`apps/exam-api/tests/`）

存在但本轮不审计。R1 阶段迁移时一并搬。

## 不迁清单（per brief §1.3 与 §1.2）

- ❌ `new_web/design/`（设计稿，含 `_archive`、`SIKAO`、`sikao-zip-extracted`、`redesign-v2*`）
- ❌ `new_web/element/`（marketing landing 原型 + ui_kits + preview）
- ❌ `new_web/sop/`（设计流程图）
- ❌ `new_web/tmp/`
- ❌ `new_web/data/`（数据，用户补完再迁）
- ❌ `new_web/new_web_data/` 镜像目录
- ❌ `new_web/E2E/`（不属于运行必需，待 R3 评估）
- ❌ `new_web/reports/`（历史报告）
- ❌ `new_web/CHANGELOG.md` 等历史记录（属于 new_web 历史）
- ❌ `new_web/AGENTS.md` 与 `new_web/CLAUDE.md`（agent 工作守则；sikao 应该单独立 `AGENTS.md` 而不是拷贝）

## 待决 / 需用户确认

1. **Favorite 是否独立模块**：new_web 未独立，可能并入 `note_likes_favorites`。需要在迁移到该模块时确认数据流。
2. **`/essay/practice/:questionId` 旧单题路由已下线**：是否还需要保留入口？（brief 默认不补，标 `legacy_skipped`）
3. **Marketing 落地页**：复用 `new_web/frontend/src/views/marketing/` 还是重做？（brief 默认复用）
4. **lint:cn-simplified 等部分 lint 是否保留**：迁到 sikao 后所有 lint 路径需要重指向 monorepo 结构。
5. **数据导入时机**：用户补完数据后告知，启动 R3。

## 关联

- [[Migration-Status]] / [[Migration-Plan]] / [[Data-Migration]]
