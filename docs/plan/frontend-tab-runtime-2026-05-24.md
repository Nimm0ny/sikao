---
type: plan
status: active
owner: lhr
created: 2026-05-24
updated: 2026-05-26
mode: Master
issue: Frontend-Tab-Runtime-Rewire-2026-05-24

> **2026-05-28 ledger update**：本计划中的实现拆分仍可作为历史编排参考，但账本执行与 Evidence Block 回写规则已切到 `docs/engineering/notion-workflow.md`。文中 `Multica` 相关章节自此按历史账本说明处理。
---

# Frontend Tab Runtime Rewire — Post Big-Bang Wiring Plan

> **目标**：在 V5-M0.5 big-bang 之后，将各 Tab 的 V5 骨架视图与已存在的
> `packages/api-client` queries + `packages/domain` stores 接通，落实
> `.tmp_review/out/*.html` 47 个原型作为视觉事实输入对应的 React 实现。

> **2026-05-26 sync note**：Practice 前端 active parent 已在 2026-05-25 从 `SIK-19` 解耦到 `SIK-118`。本计划保留原始 milestone 拆分，但凡涉及 Practice 前端的 active execution / review / Evidence Block，均以 `SIK-118` 为准；`SIK-19` 仅保留后端 epic / 历史账本语义。

## 0. 排序与并行性

主线顺序：**Home → Practice → Review → Note**。

- 4 条线 file-level 隔离（`apps/web/src/views/{Home,Practice,Review,Note}/`
  各自子目录；`packages/api-client/src/queries/*.ts` 已按 phase 拆文件；
  `packages/domain/src/<phase>/` 同样按子领域拆目录）
- Home 是阻塞起点：`RootLayout` + 4-tab nav（Me 独立走 RailMe）+ `/` 已登录路由收口、AuthGuard
  钩子、`/profile/records` 跨 tab 回链都在 Home 线落地，其余 Tab 必须等
  Home 线 M-Auth 收口后才能拿到「真实登录态」做接入
- Home 线 M-Auth 收口后，Practice / Review / Note 三线允许并行，但每条
  线内部仍按各自的 milestone 串行（依赖关系来自 04-Frontend-WU.md）

并行性边界硬约束：

- 任意两条线同时改 `apps/web/src/router/index.tsx` 必须串行，不允许同时
  push（root router 是唯一的写冲突点，每次 PR 加路由前先 rebase）
- `apps/web/src/layouts/RootLayout/` 在 Home 线 M-Auth 完成后冻结，其余
  Tab 不得改这两个文件（除非显式声明该 PR 是 RootLayout 修改 PR）
- `packages/api-client/src/queries/*` 各 phase 自己的 queries 文件互不
  影响；如需跨 phase 共享 query key prefix，先在 `homeQueryKeys.ts` 同
  款风格扩 `<phase>QueryKeys.ts`
- `packages/domain/src/<phase>/` 同上

## 1. 根级总览

| 线 | 父 issue | 起点条件 | 阶段数 | 视觉原型对应目录 |
|---|---|---|---|---|
| Home | SIK-29（in_progress） | 立即可启动 | 5 | `.tmp_review/out/Tab1-Home/` + `Tab5-Profile/Profile Learning v1.html` + `Profile Records v1.html` |
| Practice | SIK-118（in_progress） | 后端 SIK-22/23 done；2026-05-25 从 `SIK-19` 解耦 | 8 | `.tmp_review/out/Tab2-Practice/` |
| Review | SIK-45（backlog） | 后端 SIK-60 done（已满足） | 5 | `.tmp_review/out/Tab3-Review/` + `_cross/Question Hub v1.html` + `v2.html` |
| Note | SIK-44（backlog） | 后端 SIK-47-52 排期后启动 | 5 | `.tmp_review/out/Tab4-Notes/` |

每条线在所属父 issue 下新增 `post-big-bang frontend rewire · <Tab> M<N>`
子 issue，与 V5-M0.5 之前的 done child 区分开（不重开 SIK-38~SIK-43 等
旧 child）。

## 2. 共享前置（一次性，全 4 Tab 共用）

落在 Home 线第一个 milestone（M-Auth）里，但所有 Tab 都消费这层产出：

- AuthGuard hook：`apps/web/src/router/AuthGuard.tsx` 包 RootLayout，
  未登录跳 marketing 占位（marketing 已被 big-bang 删，先用 `BootCard`
  代替；Auth Phase 启动后替换）
- DEV 旁路：`apps/web/src/main.tsx` 增 `import.meta.env.DEV` 守卫，DEV
  模式调 `useAuthStore.setState({ user: DEV_USER, accessToken: 'dev' })`
  跳过登录墙，生产 build 时该分支 tree-shaken 掉
- MSW 基础设施：`apps/web/src/mocks/{browser,server,handlers}.ts` 接入
  `setupTests.ts` 与 `vitest.config.ts`，每个 Phase 自己加 handlers 文件
- 4 状态约定：所有数据驱动组件实现 `loading / empty / error / ready`，
  使用 `Skeleton / EmptyState / ErrorCard` 三件套（已在 V5 components 里）


## 3. Home 线（5 milestone）

> 父 issue：SIK-29（in_progress）。本计划落 5 个新 child。Home 后端 +
> packages 层全 done；前端骨架已在 main（commit `b1eebb236` `f4e86c998`），
> 只需 wire-up + 补 4 个共享前置 + 补 2 个钻取页。

### 3.1 Home M-Auth · AuthGuard + DEV bypass + MSW infra + BootCard 占位升级

**目标**：把根级共享前置一次性落齐，让后续所有 Tab 线都能消费。

| 项 | 说明 |
|---|---|
| 视觉原型 | n/a（无视觉，只补基础设施） |
| 落地路径 | `apps/web/src/router/AuthGuard.tsx`（新建）、`apps/web/src/main.tsx`（DEV bypass + prod 守卫，约 12 行）、`apps/web/src/mocks/{browser,server,handlers}.ts`（新建）、`apps/web/src/setupTests.ts`（接 MSW server）、`apps/web/src/router/BootCard.tsx`（升级支持 `?reason=` query 参数 + 4 种文案：missing-route / coming-soon-practice / coming-soon-review / coming-soon-notes，被各 Tab 的占位回退共用） |
| 接线对象 | `useAuthStore`（`packages/domain/src/auth/useAuthStore.ts`）、`startSilentRefreshScheduler`（已在 `main.tsx`） |
| DEV_USER 字段 | `{ id: -1, displayName: 'DEV', email: 'dev@local', onboardingCompleted: true, accessToken: 'dev-bypass' }`；`onboardingCompleted: true` 跳过 Onboarding Phase 拦截（Onboarding Phase 启动后接管） |
| Prod 守卫 | `main.tsx` 用 `import.meta.env.DEV` 包 DEV bypass 调用；vite tree-shake 验证：`npm run build` 后 grep `DEV_USER` 在 dist/ 必须 0 命中；同时确保 MSW `setupWorker()` 仅在 DEV 启动 |
| 验证 | typecheck / lint / vitest（新增 AuthGuard render test + BootCard reason switch test）+ `npm run build` 后 dist 反向验证 |
| PR 数 | 2（PR1 AuthGuard + DEV bypass + MSW infra；PR2 BootCard 升级 + reason 文案，各 ≤15 文件 / ≤400 行） |

**Acceptance**

- DEV mode `npm run dev` 直接进 Home 不被任何登录墙拦截
- Prod build `npm run build` bundle 不含 `DEV_USER` 字面量；不含 MSW worker；不含 `onboardingCompleted: true` 字面量（vite tree-shake 验证）
- 任意 Tab 的 vitest test 在 setupTests.ts 拿到 MSW server 实例
- AuthGuard 在未登录时（清掉 useAuthStore.user）渲染 BootCard 占位；`onboardingCompleted=false` 时同样落 BootCard（Onboarding Phase 未上）
- BootCard 接 `?reason=` 渲染对应文案，无 reason 时回退 generic 「页面骨架尚未落地」

**Non-goals**

- 不实现真实登录页（属于 Auth Phase）
- 不实现真正的 OnboardingGate 跳转逻辑（Onboarding Phase 范畴；DEV bypass 暂时让 onboardingCompleted=true 绕过）
- 不动 RootLayout 内部结构

### 3.2 Home M-A · Section A · 学习计划接入

**目标**：把 Home.tsx 中的 PLACEHOLDER_METRICS / PLACEHOLDER_TASKS 替换为
真实 query + store wire-up，落地 Section A 的日程视图（Today / Week / Month）。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab1-Home/Home v2.1.html`（dashboard 主屏）+ `Home Today Calendar v1.html` + `Home Week Calendar v1.html` + `Home Month Calendar v1.html` |
| 落地路径 | `apps/web/src/views/Home/Home.tsx` 重写（接 `useDashboardOverview` / `useEvents` / `usePlanStore` / calendar-engine）；新增 `apps/web/src/views/Home/sections/PlanSection.tsx`、`TodayCalendarView.tsx`、`WeekCalendarView.tsx`、`MonthCalendarView.tsx`、`EventBlock.tsx` |
| 接线对象 | `dashboardQueries.useDashboardOverview / useDashboardToday / useDashboardTodayContinue / useDashboardTodayReview / useDashboardWeeklyPlan / useDashboardFullPlan`（`packages/api-client/src/dashboardQueries.ts`）、`plansQueries.useEvents({from,to,tz})` 取日历事件窗口（`packages/api-client/src/plansQueries.ts`）、`usePlanStore`（`packages/domain/src/plan/usePlanStore.ts`）、`useDashboardPreferenceStore`（`packages/domain/src/dashboard/`）、`@sikao/calendar-engine`（layout / view / recurrence / timezone 完整） |
| MSW handlers | `apps/web/src/mocks/handlers/home.ts`（plans/today/week/month + dashboard preferences） |
| 验证 | typecheck / lint / vitest（calendar 渲染 + 4 状态机覆盖）/ Chrome MCP smoke 桌面 + 移动 |
| PR 数 | 5 |

**Acceptance**

- Today / Week / Month 三视图键盘可达 + axe 0 violation
- 4 状态：loading 显 Skeleton；empty 显 EmptyState；error 显 ErrorCard；ready
  显真实 events
- 切换视图时 `useDashboardPreferenceStore.persist` 写 localStorage
- Bundle：Home 路由初始 chunk gzip ≤ 280KB（recharts 留到 Section B 懒加载）

**Non-goals**

- 不实现 AI 制定 / 调整对话（属 M-D）
- 不实现 EventCreate / Edit / Delete（属 M-A 后续 PR，本 milestone 只做读视图）
- 不动 Section B / C


### 3.3 Home M-B · Section B · 学习进度 + /profile/learning 钻取

**目标**：底栏第二格「学习进度」迷你卡接入 progressQueries；新建
`/profile/learning` 钻取页，含 PlanSlice / DiagnosisReport / WeaknessRadar
/ TimeseriesChart 4 个分块。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab5-Profile/Profile Learning v1.html`（钻取页完整布局）+ `Tab1-Home/Home v2.1.html` 底栏第 2 格 |
| 落地路径 | `apps/web/src/views/Home/sections/ProgressSection.tsx`（mini sparkline + key metric + top3 weakness）；新建 `apps/web/src/views/ProfileLearning/{ProfileLearning.tsx,Header.tsx,PlanSlice.tsx,DiagnosisReport.tsx,WeaknessRadar.tsx,TimeseriesChart.tsx}` |
| 接线对象 | `progressQueries.useProgressOverview / useProgressTimeseries / useProgressWeakness / useProgressDiagnosis`（`packages/api-client/src/progressQueries.ts` — ProfileLearning 数据来自 progress 模块，不是 profile 模块）、`recharts` lazy import |
| 路由 | `apps/web/src/router/index.tsx` 新增 `/profile/learning`；nav 收口在 Home M-Records |
| MSW handlers | `apps/web/src/mocks/handlers/progress.ts` |
| 验证 | typecheck / lint / vitest（ProfileLearning 4 状态 + recharts mock）/ Chrome MCP smoke |
| PR 数 | 5 |

**Acceptance**

- `/profile/learning` desktop / mobile 渲染对照原型无视觉退化
- recharts 仅在 `/profile/learning` 路由触发时下载（验证 bundle chunk
  分片：`profile-learning-*.js` + `recharts-vendor-*.js`）
- 4 状态全覆盖；ProfileLearning 路由直接访问可达，不依赖 Home 入口
- axe 0 violation；reduced-motion 下 chart 动画静默

**Non-goals**

- 不实现 PracticeStatsTimingView（属 Practice 线 M-Stats）
- 不动 ProfileRecords（属 M-Records）

### 3.4 Home M-C · Section C · 今日推荐

**目标**：底栏第三格「今日推荐」接入 recommendationsQueries，落 4 状态
+ accept(session) / accept(plan) / reject 三个 action。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab1-Home/Home v2.1.html` 底栏第 3 格 |
| 落地路径 | `apps/web/src/views/Home/sections/RecommendationSection.tsx`、`RecommendationCard.tsx`、`AcceptOptionMenu.tsx`、`RejectFeedbackDialog.tsx` |
| 接线对象 | `recommendationsQueries.useRecommendationsToday / useRefreshRecommendations / useAcceptRecommendation / useRejectRecommendation`（`packages/api-client/src/recommendationsQueries.ts` — `useAcceptRecommendation` 接收 `RecommendationAcceptRequestV2`，内含 `action=session|plan` 分支，不是两个独立 hook）、`useRecommendationDraftStore`（`packages/domain/src/dashboard/useRecommendationDraftStore.ts`） |
| MSW handlers | `apps/web/src/mocks/handlers/recommendations.ts` |
| 验证 | typecheck / lint / vitest（accept/reject 三分支 + draft restore）/ Chrome MCP smoke |
| PR 数 | 4 |

**Acceptance**

- accept(session) action（调 `useAcceptRecommendation` with `action: 'session'`）→ 跳 `/practice/sessions/:id`（Practice 线 M-Session 落地前跳到 BootCard 占位 + toast「答题功能即将上线」）
- accept(plan) action（调 `useAcceptRecommendation` with `action: 'plan', target_date: ...`）触发日期选择 → 写入 plan store + 关闭 dialog
- reject 调 `useRejectRecommendation` 触发 RejectFeedbackDialog；submit 后 refetch；取消后从 `useRecommendationDraftStore` 恢复草稿
- 4 状态全覆盖；axe 0 violation

**Non-goals**

- 不实现 AI 制定对话（属 Practice 线 M-AiGenerate）
- 不实现真正的 session 跳转目标页（属 Practice 线）


### 3.5 Home M-Records · /profile/records + 4-tab nav 收口

**目标**：落 `/profile/records` 钻取页 + RootLayout 4-tab nav 收口
（Home / Practice / Review / Note；Me 独立走 RailMe）+ legacy redirect 占位。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab5-Profile/Profile Records v1.html` + `home-frame.html` 4-tab nav / RailMe 区 |
| 落地路径 | 新建 `apps/web/src/views/ProfileRecords/{ProfileRecords.tsx,RecordList.tsx,FilterBar.tsx,Pagination.tsx}`；`apps/web/src/layouts/RootLayout/Rail.tsx` + `BottomTabBar.tsx` 收口 4-tab + RailMe 唯一入口；`apps/web/src/router/index.tsx` 加 `/profile/records` + 6 条 legacy redirect |
| 接线对象 | `profileQueries.useProfileRecords`（含 `LearningRecordItemV2.href` 必填字段，已锁 contract）、Pagination 已在 V5 components |
| MSW handlers | `apps/web/src/mocks/handlers/records.ts`（mock 含 xingce / shenlun / mock-exam / weekly review 4 类 record） |
| 验证 | typecheck / lint / vitest（redirect coverage + ProfileRecords 集成 test + a11y vitest-axe）/ Chrome MCP smoke 4-tab + RailMe |
| PR 数 | 4 |

**Acceptance**

- 4-tab nav desktop（Rail）+ mobile（BottomTabBar）都到位且 active 状
  态正确；Me 入口仅由 RailMe 提供
- 6 条 legacy redirect：`/app /study/today /dashboard /practice/center
  /wrong-book /plan /progress /me` 全部跳到 canonical 路径
- ProfileRecords 4 状态 + 分组（按 record type）+ 分页 + filter（type
  / date range）全工作；点击 row 跳 `LearningRecordItemV2.href`
- axe 0 violation；vitest-axe 覆盖所有新增 view

**Non-goals**

- 不实现 marketing 落地页（属未来 Marketing Phase 重启）
- 不动 Onboarding / Diagnosis 路由（属 Onboarding Phase）
- 不实现 Login 页（属 Auth Phase）

### 3.6 Home 线 Completion Gate

Home 5 个 milestone 全过 H8 验证后，给 SIK-29 父 issue 加最终
Evidence Block，列出：

- 5 个新 child 各自的 commit 链
- typecheck / lint / vitest / a11y / Chrome MCP smoke 的最终命令与输出
- bundle 预算实测（Home 路由 / `/profile/learning` / `/profile/records`
  各自的初始 chunk gzip 大小）
- 旧 SIK-42 / SIK-43 在 Multica 同步标 cancelled，附 cancellation 链接到
  本计划的 M-Records milestone


## 4. Practice 线（8 milestone）

> 父 issue：SIK-118（Tab2 · Practice 前端父 issue，in_progress）。本计划落 8 个新
> child，覆盖 Phase-Practice 04-Frontend-WU.md WU-F9 ~ WU-F22。
>
> `SIK-19` 自 2026-05-25 起只保留为 Practice backend epic / 历史 phase 总线。
>
> **启动条件**：后端 SIK-22（P2 后端基础能力）+ SIK-23（P3 session
> runtime）done；当前 in_progress，启动前由 Master 确认。

### 4.1 Practice M-Api · WU-F9 · API client + queries 扩展

**目标**：扩展 `packages/api-client/src/queries/` 增 8 个 queries 文件
（contentQueries 重写 + 新建 sessionQueries / practiceStatsQueries /
aiQuestionsQueries / essayGradingQueries / favoritesQueries / flagsQueries
/ dailyPracticeQueries），types 重生成。

| 项 | 说明 |
|---|---|
| 视觉原型 | n/a（query 层不直接对应 view） |
| 落地路径 | `packages/api-client/src/queries/{contentQueries,sessionQueries,practiceStatsQueries,aiQuestionsQueries,essayGradingQueries,favoritesQueries,flagsQueries,dailyPracticeQueries}.ts`；types 重生成走 `apps/web/scripts/generate-types.mjs` |
| MSW handlers | 新建 `apps/web/src/mocks/handlers/practice.ts`（覆盖 8 个 query family） |
| 验证 | typecheck / lint / vitest（每个 query hook 有 RTL renderHook test） |
| PR 数 | 5（按 04-Frontend-WU.md WU-F9 PR Breakdown） |

**Acceptance**

- TS strict 编译通过
- 每个 query 有 query key 唯一性 lint 通过
- essayGradingQueries 的 polling hook 有 retry / backoff 单测覆盖
- types.generated.ts diff 与 OpenAPI spec 对齐，无 manual edit

**Non-goals**

- 不接 view（属 M-Center 之后）
- 不实现 stores（属 M-Stores）

### 4.2 Practice M-Stores · WU-F10 · domain stores

**目标**：新建 `packages/domain/src/practice/`，落 6 个 zustand store。

| 项 | 说明 |
|---|---|
| 视觉原型 | n/a |
| 落地路径 | `packages/domain/src/practice/{usePracticeFilterStore,useSessionTimerStore,useAiGenerateDraftStore,useFavoriteStore,useFlagStore,useDailyPracticeStore}.ts` |
| 接线对象 | M-Api 的 8 query family |
| 验证 | typecheck / lint / vitest（每个 store 4 ~ 6 个 case） |
| PR 数 | 3 |

**Acceptance**

- 每个 store 持久化字段标 `persist`，非持久化字段不写 localStorage
- store 之间无循环依赖（`madge --circular packages/domain/src/practice`）
- 每个 store 有 reset action

**Non-goals**

- 不实现 view 接入（属 M-Center 之后）

### 4.3 Practice M-Center · WU-F11 · PracticeCenter + Section A 历史记录

**目标**：把 V5 骨架 Practice.tsx 重写为 PracticeCenter 容器，落 Section
A 历史记录（最近 N=20 session 列表）。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab2-Practice/Practice v1.html` |
| 落地路径 | `apps/web/src/views/Practice/Practice.tsx` 重写；新增 `apps/web/src/views/Practice/sections/HistorySection.tsx`、`SessionHistoryCard.tsx` |
| 接线对象 | `sessionQueries.useRecentSessions`、`usePracticeFilterStore` |
| 验证 | typecheck / lint / vitest（4 状态 + filter 切换）/ Chrome MCP smoke |
| PR 数 | 4 |

**Acceptance**

- 4 状态全覆盖；空态显「开始第一次练习」CTA 跳 `/practice/daily`
- ScopeToggle（行测 / 申论）切换 filter 即时生效
- session card 点击跳 `/practice/sessions/:id`（脱壳路由，不加 RootLayout）
- `@media (max-height: 800px)` row1 收紧到 192px（V5 spec）


### 4.4 Practice M-Entry · WU-F12 + WU-F13 + WU-F14 · 三种入口

**目标**：落 Section B（专项练习入口）、Section C（套卷练习入口）、自定义
刷题对话框（双滑块 + 范围选择）。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab2-Practice/Practice v1.html`（Section B/C） |
| 落地路径 | `apps/web/src/views/Practice/sections/SpecialtySection.tsx`、`PaperSection.tsx`；`apps/web/src/views/Practice/dialogs/CustomPracticeDialog.tsx`、`DailyPracticeStart.tsx`（路由 `/practice/daily`） |
| 接线对象 | `contentQueries.useSpecialtyTree` / `usePapersList` / `dailyPracticeQueries` |
| 验证 | typecheck / lint / vitest（双滑块键盘可达 + 范围联动）/ Chrome MCP smoke |
| PR 数 | 9（4 + 2 + 3） |

**Acceptance**

- 双滑块 keyboard：左右箭头调整 / Home End 跳极值 / aria-valuenow 即时
  更新
- 范围选择（specialty 树 + paper 列表）支持多选 + 全选 / 反选
- DailyPracticeStart 显示 difficulty + 题数；提交后跳
  `/practice/sessions/:id`

**Non-goals**

- 不实现答题运行时（属 M-Session）
- 不实现 AI 出题（属 M-AiGenerate）

### 4.5 Practice M-Session · WU-F15 + WU-F16 · 答题闭环

**目标**：落答题 view（行测 + 申论）+ AI 出题等待页 + 申论批改详情 +
session result 落地页。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab2-Practice/Exam Xingce v2.html`、`Exam Shenlun v2.html`、`Session Result v1.html`、`Essay Grading Result v1.html`、`Ai Questions Generating v1.html` |
| 落地路径 | 新建脱壳 view：`apps/web/src/views/PracticeSession/{PracticeSession.tsx,XingceLayout.tsx,ShenlunLayout.tsx}`、`apps/web/src/views/SessionResult/SessionResult.tsx`、`apps/web/src/views/EssayGradingResult/EssayGradingResult.tsx`、`apps/web/src/views/AiQuestionsGenerating/AiQuestionsGenerating.tsx`；ExamLayout 已在 V5 |
| 接线对象 | `sessionQueries.useSession` / `useSubmitSession`、`@sikao/answer-engine` 完整、`@sikao/editor`（申论解冻路径，独立 Exam spec 决定，本 milestone 暂用占位 textarea）、`aiQuestionsQueries.useAiSession` polling、`essayGradingQueries.useGradingResult` polling |
| 路由 | `/practice/sessions/:id`（fullscreen / 不挂 RootLayout，挂 ExamLayout）、`/practice/sessions/:id/result`、`/practice/sessions/:id/grading`、`/practice/ai-questions/generating` |
| 验证 | typecheck / lint / vitest（answer-engine scoring 集成 + state machine + a11y）/ Chrome MCP smoke 横竖屏 |
| PR 数 | 10（5 + 5） |

**Acceptance**

- 行测：题目导航 / option 多选 / 标记 / flag / 倒计时（answer-engine
  timing）/ submit 触发 scoring
- 申论：作答区 word-limit + grid-layout（answer-engine word-limit）；
  submit 触发 polling；每秒 aria-live="polite" 公布进度
- AiQuestionsGenerating：aria-live + 30s 后未返回结果显示 fallback CTA
- SessionResult：分数 + 题目对错 + 链接到 QuestionHub
- EssayGradingResult：rubric 维度评分 + LLM 评语 + 重做 CTA

**Non-goals**

- 不解冻 `@sikao/editor`（属 Exam spec）
- 不实现 mock exam 倒计时 auto submit（属 M-Mock）
- 不实现 timing 上报详细分析（属 M-Stats）


### 4.6 Practice M-Mock · WU-F21 · 模考 UI 三件套

**目标**：落 Mock Exam 入口 / 进行中 / 历史对比三个 view。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab2-Practice/Mock Exam Start v1.html`、`Mock Exam History v1.html`、`Mock Exam Comparison v1.html` |
| 落地路径 | `apps/web/src/views/MockExam/{MockExamStart.tsx,MockExamHistory.tsx,MockExamComparison.tsx,MockExamConfig.tsx}` |
| 接线对象 | `sessionQueries`（mock mode）、`practiceStatsQueries.useMockExamHistory` |
| 路由 | `/practice/mock-exam/start`、`/practice/mock-exam/history`、`/practice/mock-exam/:id/comparison` |
| 验证 | typecheck / lint / vitest（倒计时 auto submit + 对比图表）/ Chrome MCP smoke |
| PR 数 | 4 |

**Acceptance**

- Start：选套卷 + 倒计时配置 + 严格模式 toggle；进入答题用
  `/practice/sessions/:id?mode=mock`
- 倒计时 = 0 触发 auto submit（answer-engine timing.remainingSeconds）；
  浏览器关闭 / 刷新有 beforeunload 警告
- History：列表 + 分页 + 单次成绩详情
- Comparison：与上一次成绩对比图表（recharts lazy）

**Non-goals**

- 不动 SessionResult（属 M-Session）
- 不实现 mock exam 排行榜（产品未确认）

### 4.7 Practice M-Stats · WU-F19 + WU-F22 · timing 与偏好

**目标**：落 timing 上报 + 分析 view + practice preferences UI。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab2-Practice/Practice Stats Timing v1.html`、`Tab5-Profile/Practice Preferences v1.html` |
| 落地路径 | `apps/web/src/views/PracticeStats/PracticeStatsTiming.tsx`；`apps/web/src/views/PracticePreferences/{PracticePreferences.tsx, 6 子树各一个 .tsx}` |
| 接线对象 | `practiceStatsQueries.useTimingReport`、`flagsQueries`、`useDailyPracticeStore` 偏好字段 |
| 路由 | `/practice/stats/timing`、`/profile/practice-preferences` |
| 验证 | typecheck / lint / vitest（timing buffer hook + 6 子树切换）/ Chrome MCP smoke |
| PR 数 | 7（4 + 3） |

**Acceptance**

- timing buffer hook：每 10s 批量上报，离线时 localStorage 暂存，回线
  补传
- timing 分析 view：4 状态 + 4 张图表（recharts lazy）
- 偏好 6 子树：练习节奏 / 题量 / 时长 / 提示 / 反馈 / 快捷键，每子树
  独立可保存

**Non-goals**

- 不动 ProfileSettings（属 Profile 后续 milestone）
- 不实现 active session 心跳与继续上次（属 M-Lifecycle）

### 4.8 Practice M-Lifecycle · WU-F20 + WU-F17 + WU-F18 · 收尾

**目标**：active session 心跳 + 继续上次 + 主动废弃；PracticeCenter
整合（Section A/B/C 合并 + favorites + flags 入口）；E2E + MSW + a11y。

| 项 | 说明 |
|---|---|
| 视觉原型 | n/a（功能集成 + 测试） |
| 落地路径 | `apps/web/src/views/Practice/Practice.tsx` 终版整合；`apps/web/src/components/practice/ResumeBanner.tsx`；e2e specs `apps/web/e2e/practice/*.spec.ts` |
| 接线对象 | `useSessionTimerStore` 心跳、所有前面 milestone 落地的 query / store |
| 验证 | typecheck / lint / vitest / Chrome MCP smoke / playwright e2e desktop + mobile / vitest-axe |
| PR 数 | 8（4 + 4） |

**Acceptance**

- 进入 PracticeCenter 检测 active session → 显 ResumeBanner + 30s 倒计
  时无操作自动隐藏
- 主动废弃 session 走 ConfirmDialog
- e2e 覆盖三种入口 + 答题闭环 + mock + result + grading 全链路
- axe 0 violation；reduced-motion 下所有动画静默

**Non-goals**

- 不动其他 Tab

### 4.9 Practice 线 Completion Gate

8 个 milestone 全过 H8 后给 `SIK-118` 父加 Evidence Block。`SIK-26~SIK-28`
已在旧账本中标 `done`，这里只保留历史映射，不再等待 cancel / 重定向动作。


## 5. Review 线（5 milestone）

> 父 issue：SIK-45（backlog）。本计划落 5 个新 child，覆盖 04-Frontend-WU.md
> WU-FR1 ~ WU-FR14。
>
> **启动条件**：Practice M-Center 完成（QuestionHub 跨 tab 跳转源已就绪）+
> Review 后端 SIK-60 done（已满足）；后端 SIK-61 done 后启动 M-Cause。

### 5.1 Review M-Api · WU-FR1 + WU-FR2 · API + Stores

**目标**：从 Review OpenAPI spec 生成 types；新建 reviewQueries +
causeAnalysisQueries + weeklyReviewQueries；新建 `packages/domain/src/review/`
10 个 hooks（A0 §3.3 清单）。

| 项 | 说明 |
|---|---|
| 视觉原型 | n/a |
| 落地路径 | `packages/api-client/src/queries/{reviewQueries,causeAnalysisQueries,weeklyReviewQueries}.ts`；`packages/api-client/src/generated/review.ts`（自动生成）；`packages/domain/src/review/{useReviewItems,useReviewItem,useReviewToday,useSmartReviewCards,useRecentAnswers,useCauseAnalysis,useGroupCauseAnalysis,useWeeklyReview,useReviewInsights,useQuestionHub,index}.ts` |
| MSW handlers | `apps/web/src/mocks/handlers/review.ts` |
| 验证 | typecheck / lint / vitest（每个 hook 单测） |
| PR 数 | 4 |

**Acceptance**

- TS strict 编译通过；query key 唯一性 lint 通过
- 每个 hook 4 状态可达；MSW mock 覆盖所有正常 / 错误路径
- useSmartReviewCards 算法纯前端单测（12 边界场景，详见
  `Phase/Review/07-Smart-Review-Aggregation.md`）

**Non-goals**

- 不接 view（属 M-Today 之后）

### 5.2 Review M-Today · WU-FR3 + WU-FR4 · ReviewToday + Smart Cards

**目标**：默认 `/review` view = WeeklyBar + SrsQueue + 三卡聚合容器。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab3-Review/Review Today v1.html`、`Review v1.html` |
| 落地路径 | `apps/web/src/views/Review/Review.tsx` 重写为 ReviewToday；新增 `apps/web/src/views/Review/sections/{WeeklyBar,SrsQueue,SmartCardsContainer,SmartCardA,SmartCardB,SmartCardC,EmptyReview}.tsx` |
| 接线对象 | `useReviewToday`、`useSmartReviewCards`、`useWeeklyReview` |
| 验证 | typecheck / lint / vitest（4 状态 + 三卡算法 12 边界）/ Chrome MCP smoke |
| PR 数 | 5 |

**Acceptance**

- WeeklyBar 数字与后端 weekly summary 对齐
- 三卡（高频错点 / 长期未碰 / 预测再错）按算法正确分流；空数据时显
  EmptyReview 而非空卡
- SRS due 列表按 next_review_at 升序；点击行跳 QuestionHub
- axe 0 violation

**Non-goals**

- 不实现 ReviewAll / Insights / Graduated / Archived（属 M-All）
- 不实现 cause analysis UI（属 M-Cause）


### 5.3 Review M-All · WU-FR5 + WU-FR6 · ReviewAll + Insights

**目标**：落 `/review/all`（4 segment 全错题）+ `/review/insights`（3 张图）+ `/review/graduated` + `/review/archived` 四个子路由。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab3-Review/Review All v1.html`、`Review Insights v1.html`、`Review Graduated v1.html`、`Review Archived v1.html` |
| 落地路径 | 新建 `apps/web/src/views/ReviewAll/{ReviewAll.tsx,SegmentTabs.tsx,FilterBar.tsx,ReviewItemList.tsx,ReviewItemCard.tsx}`；`apps/web/src/views/ReviewInsights/{ReviewInsights.tsx,WrongTrendChart.tsx,CauseClusterChart.tsx,RetryAccuracyChart.tsx}`；`apps/web/src/views/ReviewGraduated/ReviewGraduated.tsx`；`apps/web/src/views/ReviewArchived/ReviewArchived.tsx` |
| 接线对象 | `useReviewItems`（with filter）、`useReviewInsights`、recharts lazy |
| 路由 | `/review/all`、`/review/insights`、`/review/graduated`、`/review/archived` |
| 验证 | typecheck / lint / vitest（4 segment 切换 + filter 联动 + chart mock）/ Chrome MCP smoke |
| PR 数 | 8 |

**Acceptance**

- 4 segment：全部 / 言语 / 数量 / 资料 / 判断（行测 + 申论可切）
- filter：日期范围 / cause taxonomy / confidence rating
- 3 张图独立 lazy 加载；无数据时 EmptyState
- Graduated / Archived 列表 + restore action

**Non-goals**

- 不实现 cause analysis 编辑（属 M-Cause）
- 不实现 confidence rating UI（属 M-Confidence）

### 5.4 Review M-Hub · WU-FR7 + WU-FR8 + WU-FR9 · QuestionHub + Redo + Cause UI

**目标**：落 `/question-hub` 题目中枢页（含 ctx 解析）+ redo 流程 + cause analysis
UI（单题 + 聚合）。

| 项 | 说明 |
|---|---|
| 视觉原型 | `_cross/Question Hub v1.html`、`Question Hub v2.html`、`Tab3-Review/Review Redo v1.html` |
| 落地路径 | `apps/web/src/views/QuestionHub/QuestionHub.tsx` 重写；新增 `sections/{StemSection,AnswerHistorySection,CauseAnalysisSection,RelatedNotesSection,RedoCTA}.tsx`；如未来恢复独立 redo route，再新建 `apps/web/src/views/QuestionRedo/QuestionRedo.tsx` 并单开 Define-First；`dialogs/CauseAnalysisDialog.tsx`、`GroupCauseAnalysisDialog.tsx` |
| 接线对象 | `useQuestionHub`、`useCauseAnalysis`、`useGroupCauseAnalysis`、`@sikao/answer-engine` 部分（redo 模式） |
| 路由 | `/question-hub`（当前 V5 收口真相；旧 `/q/:id` 方案已过时，需单独重开定义） |
| 验证 | typecheck / lint / vitest（ctx 解析 + redo 状态机 + cause 编辑）/ Chrome MCP smoke |
| PR 数 | 9 |

**Acceptance**

- QuestionHub 接受 `?ctx=review|practice|note` 三种来源 ctx，渲染对应的
  「返回」link + breadcrumb
- AnswerHistory 分组（按 session）；每组可展开看详细
- CauseAnalysis：单题 select 错因 + LLM 自动建议；聚合错因（多题选中后
  批量打 cause tag）
- RelatedNotes：从 NoteV2.linked_question_id 反查（若 Notes 线未上则
  空列表 + 占位文案）
- Redo：脱壳 view，独立 ExamLayout，提交后跳 SessionResult

**Non-goals**

- 不实现 weekly review UI（属 M-Weekly）
- 不实现 confidence / debt UI（属 M-Confidence）
- SaveAsNoteButton 调用 stub（Notes 线 M-Editor 落地后接入）

### 5.5 Review M-Closeout · WU-FR10 + WU-FR13 + WU-FR14 + WU-FR11 + WU-FR12 · Weekly + Confidence + Debt + 路由 + e2e

**目标**：落 weekly review 页 + confidence rating UI + debt management UI；
完成 route migration + e2e + a11y + Chrome MCP 验收。

| 项 | 说明 |
|---|---|
| 视觉原型 | n/a 单页（weekly 在 ReviewToday 顶部已有 bar；本 milestone 落详情页） |
| 落地路径 | `apps/web/src/views/WeeklyReview/WeeklyReview.tsx`（路由 `/review/weekly`）；`apps/web/src/views/Review/components/{ConfidenceRatingControl,DebtPanel}.tsx`；e2e specs `apps/web/e2e/review/*.spec.ts` |
| 接线对象 | `useWeeklyReview` 详情、`useConfidenceRating`、`useDebtSnapshot` |
| 验证 | typecheck / lint / vitest / Chrome MCP smoke / playwright e2e desktop + mobile / vitest-axe |
| PR 数 | 9 |

**Acceptance**

- WeeklyReview 显示本周 SRS 完成 / 错题趋势 / cause cluster top 3 +
  「生成笔记」CTA（点击 → 写 NoteV2.linked_question_id 然后跳 NoteEditor，
  Notes 线未上时 stub 占位）
- ConfidenceRating：5 档星级 + aria-valuenow；变更触发 mutation
- Debt panel：snapshot / redistribute / ramp-up / hard 4 视图
- e2e 覆盖 Today / All / Insights / Hub / Redo / Weekly 全链路；axe 0 violation

**Non-goals**

- 不动 NoteEditor（属 Notes 线）
- 不实现 weekly cron 触发（属后端）

### 5.6 Review 线 Completion Gate

5 milestone 全过 H8 后给 SIK-45 父加 Evidence Block。SIK-66~SIK-70 旧
backlog 在 wave 末决定 cancel 重定向或同步标 done。


## 6. Note 线（5 milestone）

> 父 issue：SIK-44（backlog）。本计划落 5 个新 child，覆盖 03-Frontend-WU.md
> WU-FN1 ~ WU-FN10。
>
> **启动条件**：Note 后端 SIK-47（M1 Notes CRUD）至少 done；后端
> SIK-49（M3 Meilisearch）done 后启动 M-Search。

### 6.1 Note M-Api · WU-FN1 + types + queries

**目标**：路由注册 + Tab nav 第 4 tab + lazy import；types 重生成；
notebookQueries 完整化（已有占位）+ 新建 noteSearchQueries / noteAiQueries /
noteCommunityQueries。

| 项 | 说明 |
|---|---|
| 视觉原型 | n/a |
| 落地路径 | `apps/web/src/router/index.tsx` 增 `/notes`、`/notes/tags`、`/notes/:id`（脱壳）；`apps/web/src/layouts/RootLayout/{Rail,BottomTabBar}.tsx` 增 4-tab；`packages/api-client/src/queries/{notebookQueries,noteSearchQueries,noteAiQueries,noteCommunityQueries}.ts`（已有 notebookQueries 占位，扩展） |
| MSW handlers | `apps/web/src/mocks/handlers/notes.ts` |
| 验证 | typecheck / lint / vitest（query hooks）/ Chrome MCP smoke 4-tab nav |
| PR 数 | 4 |

**Acceptance**

- 4-tab desktop / mobile 都能切到 Notes（active 状态正确）
- types.generated.ts diff 与 OpenAPI spec 对齐
- 每个 query family 有 RTL renderHook test

**Non-goals**

- 不实现 NotesHome / NoteEditor（属 M-Home / M-Editor）

### 6.2 Note M-Home · WU-FN2 + WU-FN3 · NotesHome + 筛选

**目标**：落 NotesHome view（`/notes`）= 3 segment（我的 / 收藏 / 社区）+
NoteCard grid + 筛选器 + URL query sync。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab4-Notes/Note v2.1.html`、`Note v2.html` |
| 落地路径 | `apps/web/src/views/Note/Note.tsx` 重写；新增 `sections/{NoteSegmentTabs,NoteCardGrid,FilterPanel,EmptyNotes}.tsx`；`apps/web/src/views/Note/components/NoteCard.tsx` |
| 接线对象 | `useNotes`（with filter）、`useFavoriteNotes`、`useCommunityNotes`（已有 hook） |
| 验证 | typecheck / lint / vitest（segment 切换 + filter URL sync）/ Chrome MCP smoke |
| PR 数 | 5 |

**Acceptance**

- 3 segment 切换 URL `?seg=my|fav|community`；浏览器后退恢复 segment
- filter（标签 / 日期 / 题目 link）面板支持多选；URL `?tags=a,b&date=...`
- N1 mobile 单列 / N2 tablet+desktop 双列
- 4 状态全覆盖

**Non-goals**

- 不实现 NoteEditor（属 M-Editor）
- 不实现 search（属 M-Search）

### 6.3 Note M-Editor · WU-FN4 + WU-FN5 · TipTap 编辑器 + 标签系统

**目标**：落 NoteEditor 全屏脱壳 view（`/notes/:id`）+ NoteTagsManagement
（`/notes/tags`）。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab4-Notes/NoteEditor v1.html`、`NoteTagsManagement v1.html` |
| 落地路径 | 新建 `apps/web/src/views/NoteEditor/{NoteEditor.tsx,Toolbar.tsx,EditorBody.tsx,SaveStatus.tsx,LinkedQuestionPanel.tsx}`；`apps/web/src/views/NoteTagsManagement/{NoteTagsManagement.tsx,TagList.tsx,TagEditDialog.tsx}` |
| 接线对象 | `notebookQueries.useNote / useUpdateNote / useUploadImage`、TipTap pkg（新依赖：`@tiptap/react`、`@tiptap/starter-kit`、`@tiptap/extension-image`、`@tiptap/extension-link`） |
| 验证 | typecheck / lint / vitest（自动保存 debounce + 图片上传 / 撤销 / 重做）/ Chrome MCP smoke |
| PR 数 | 7 |

**Acceptance**

- 自动保存：keystroke 后 1.5s debounce 触发 mutation；离线写
  localStorage 暂存
- 图片上传：拖拽 / 粘贴 / 工具栏按钮三种入口；进度条 + 失败 retry
- LinkedQuestionPanel：从 NoteV2.linked_question_id 反查题目摘要 +
  跳 QuestionHub link
- NoteTagsManagement：增删改 + 重命名 + 合并 + 排序

**Non-goals**

- 不实现 search（属 M-Search）
- 不实现 AI summary（属 M-Closeout）


### 6.4 Note M-Search · WU-FN6 · Meilisearch 集成

**目标**：落即时搜索 + faceted 结果。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab4-Notes/Note v2.1.html` 顶部搜索条 |
| 落地路径 | `apps/web/src/views/Note/sections/SearchBar.tsx`、`SearchResultPanel.tsx`；`apps/web/src/views/Note/Note.tsx` 增搜索路由参数 `?q=` |
| 接线对象 | `noteSearchQueries.useNoteSearch`（debounced 300ms） |
| 验证 | typecheck / lint / vitest（搜索 debounce + facet 切换）/ Chrome MCP smoke |
| PR 数 | 3 |

**Acceptance**

- 搜索 debounce 300ms；空 query 时显历史 / 推荐
- faceted：标签 / 日期 / 题目 link 同时筛
- 高亮匹配 token；无结果时 EmptyState
- URL `?q=foo&tag=bar` 浏览器分享 / 后退恢复

**Non-goals**

- 不实现 community search（属 M-Closeout）

### 6.5 Note M-Closeout · WU-FN7 + WU-FN8 + WU-FN9 + WU-FN10 · AI/Weekly/Community/Cross-Tab + e2e

**目标**：落 AI summary 卡片 / weekly review banner / community notes /
cross-tab wiring；完成 e2e + a11y + Chrome MCP 验收。

| 项 | 说明 |
|---|---|
| 视觉原型 | `Tab4-Notes/Note v2.1.html`（AI / Weekly / Community 段） |
| 落地路径 | `apps/web/src/views/Note/sections/{AiSummaryCard,WeeklyBanner,CommunityFeed}.tsx`；`apps/web/src/components/notes/SaveAsNoteButton.tsx`（被 Review 线 M-Hub 调用）；e2e specs `apps/web/e2e/notes/*.spec.ts` |
| 接线对象 | `noteAiQueries.useAiSummary / useGenerateAiSummary`、`noteCommunityQueries.useCommunityNotes / usePublish`、`useWeeklyReview`（跨 phase 复用 Review 线 hook） |
| 验证 | typecheck / lint / vitest / Chrome MCP smoke / playwright e2e desktop + mobile / vitest-axe |
| PR 数 | 9 |

**Acceptance**

- AiSummary：「生成总结」CTA → polling → 落到笔记 body 末尾；可重试
- WeeklyBanner：周一显示 + LLM 生成 → 编辑器预填 → 用户编辑 → 保存
- Community：可见性切换（私 / 公开）；公开 feed 卡片 + 点赞 / 评论数
- SaveAsNoteButton：从 Review M-Hub 跳过来，预填 linked_question_id +
  题目摘要 prefix，跳 NoteEditor
- e2e 覆盖 Home → Editor → Search → AI / Weekly / Community 全链路

**Non-goals**

- 不动 Review / Practice
- 不实现 community 评论编辑（产品未确认）

### 6.6 Note 线 Completion Gate

5 milestone 全过 H8 后给 SIK-44 父加 Evidence Block。SIK-53~SIK-57 旧
backlog 在 wave 末决定 cancel 重定向或同步标 done。


## 7. 跨线协调与依赖矩阵

### 7.1 RootLayout / router 写冲突

| 文件 | 写入 milestone | 冻结条件 |
|---|---|---|
| `apps/web/src/router/index.tsx` | Home M-Auth, M-B, M-Records · Practice M-Center / M-Entry / M-Session / M-Mock / M-Stats · Review M-All / M-Hub / M-Closeout · Note M-Api / M-Editor | 每条线 PR 内只增不改其他线的路由；有冲突时按主线顺序优先合 Home |
| `apps/web/src/layouts/RootLayout/Rail.tsx` | Home M-Records 落 4-tab + RailMe 唯一入口（含撤除旧「题库」一级 nav，将题库交互改由 Review M-Hub QuestionHub 承载）；Note M-Api 改第 4 tab 显隐 | Home M-Records 之后冻结；Note M-Api 是仅有的合法后续修改 |
| `apps/web/src/layouts/RootLayout/BottomTabBar.tsx` | 同上 | 同上 |
| `apps/web/src/main.tsx` | Home M-Auth 一次写 DEV bypass + MSW + provider；后续不改 | Home M-Auth 完成后冻结 |
| `apps/web/src/setupTests.ts` | Home M-Auth 一次写 MSW server | 同上 |

### 7.2 跨 Tab 跳转

| 跳转源 | 跳转目标 | 落地 milestone |
|---|---|---|
| Home M-C → /practice/sessions/:id | Practice M-Session | accept(session) 触发；前置条件 Practice M-Session done，否则跳 BootCard 占位 |
| Practice M-Session SessionResult → /question-hub?ctx=practice | Review M-Hub | Review M-Hub done 之前跳 BootCard 占位 |
| Review M-Hub SaveAsNoteButton → /notes/:id | Note M-Editor | Note M-Editor done 之前 stub 占位 + toast「笔记功能即将上线」 |
| Note M-Closeout WeeklyBanner → useWeeklyReview hook | Review M-Closeout | hook 复用（同一个 query family，不 fork） |
| Practice M-Stats `/profile/practice-preferences` | Profile（待规划） | 暂落在 Practice 线，未来 Profile Phase 启动后迁移 |

### 7.3 共享依赖与版本

| 依赖 | 引入 milestone | 落地位置 |
|---|---|---|
| TipTap（`@tiptap/react`、`starter-kit`、`extension-image`、`extension-link`） | Note M-Editor | `apps/web/package.json`；版本 lock SemVer |
| recharts | 已装；Home M-B / Review M-All 各自 lazy | n/a |
| MSW handlers | 4 phase 各自加文件，不共享 module | `apps/web/src/mocks/handlers/{home,practice,review,notes}.ts` |
| answer-engine | Practice M-Session / Review M-Hub redo 共用 | n/a（已是 V5 保留 package） |

### 7.4 验证链路矩阵

每条线 milestone 完成时跑：

```sh
npm run typecheck -w @sikao/web
npm run lint -w @sikao/web
npx vitest run                     # 含 vitest-axe a11y
npm run test:visual -w @sikao/web  # 仅在改了 6 桌面页骨架时跑
```

线收尾 milestone（Home M-Records / Practice M-Lifecycle / Review M-Closeout
/ Note M-Closeout）额外跑：

```sh
npx playwright test                          # e2e
npm run test:a11y -w @sikao/web              # axe vitest 套件
```

每条线收尾必须出 Chrome MCP smoke 截图归档到 `.tmp_review/out/<Tab>/_smoke_*.png`。

### 7.5 commit / PR 约束

- 每个 milestone 拆 PR 数已在表里给定；每个 PR 严格 ≤15 文件 / ≤400 行
  净增（AGENT-H9）
- commit message 格式：`feat(web): <tab>-<milestone> <scope> [<id>]`
  如 `feat(web): home-m-a section A plan view [SIK-29-MA]`
- review gate（AGENT-H5）：每个 PR ≥100 行强制独立 subagent review；
  前端视觉 milestone 额外做规范审查官 + Chrome MCP smoke


## 8. Historical Multica 账本布局

每条线在所属父 issue 下加新 child（不重开旧 child）。命名约定：

```
<父 issue>-<Tab>-<MilestoneId> post-big-bang frontend rewire · <Tab> <Milestone>
```

例：

```
SIK-29-Home-MAuth post-big-bang frontend rewire · Home M-Auth
SIK-29-Home-MA    post-big-bang frontend rewire · Home M-A Section A
SIK-118-Prac-MApi post-big-bang frontend rewire · Practice M-Api
```

### 8.1 父 issue 列表

| 线 | 父 issue | 状态 | 本计划新增 child 数 |
|---|---|---|---|
| Home | SIK-29 | in_progress | 5 |
| Practice | SIK-118 | in_progress | 8 |
| Review | SIK-45 | backlog | 5 |
| Note | SIK-44 | backlog | 5 |

合计 23 个新 child，对应 23 个 milestone。

### 8.2 child issue 模板

每个 child issue body 结构（与 SIK-87 / SIK-88 同款）：

```
# <title>

## Summary
<一句话 + 跳到本计划的章节锚点>

## Decision Source
- lhr 2026-05-24 confirmation
- docs/plan/frontend-tab-runtime-2026-05-24.md §<章节号>

## Scope
<从本计划对应章节复制 落地路径 + 接线对象 + MSW + 验证 + PR 数>

## Depends on
<前置 milestone child 列表>

## Wave Plan
<PR 数 拆成 wave，每 wave 内 PR 串行；wave 之间也串行>

## Acceptance
<从本计划对应章节复制 Acceptance>

## Non-goals
<从本计划对应章节复制 Non-goals>

## Review / Validation Gate
- H5 review gate：每 PR 独立 subagent review；视觉 PR 加规范审查官 + Chrome MCP smoke
- H8 validation：typecheck + lint + vitest + 适用 e2e + a11y PASS 才能标 done
- H9 commit batch：每 PR ≤15 文件 / ≤400 行净增

## Source Docs
- docs/plan/frontend-tab-runtime-2026-05-24.md §<章节号>
- docs/vault/05-migration/Phase/<Tab>/04-Frontend-WU.md（或 03-Frontend-WU.md）
- .tmp_review/out/<Tab>/<相关原型>.html
```

### 8.3 启动节奏

按 lhr 拍板的「Home → Practice → Review → Note」串行：

1. 本会话立即创建 23 个 child（status 默认 backlog；只有 Home M-Auth
   设 backlog，等 lhr 显式 in_progress 才启动）
2. Home 5 个 milestone 串行；每个 milestone 完成才启动下一个
3. Home 全部 done 后 Practice 启动；Practice / Review / Note 各自串行
4. 跨线并行 = 同时 in_progress 不超过 1 个 Tab；Master 在收尾时决定是否
   开第 2 条线并行（依赖 RootLayout 是否冻结 + 后端是否 ready）

### 8.4 旧 child 处置

| 旧 child | 状态 | 处置时机 |
|---|---|---|
| SIK-42（Home M11） | todo | Home M-Records 完成时 cancel，附「重定向到新 child」link |
| SIK-43（Home M12） | todo | 同上 |
| SIK-66~SIK-70（Review FE M8-M12） | backlog | Review 5 个新 child 完成时同步 cancel 或 done |
| SIK-53~SIK-57（Notes FE M7-M11） | backlog | 同上 |
| SIK-26~SIK-28（Practice FE P6-P8） | done | 历史已完成；Practice active frontend ledger 已迁到 `SIK-118` |

不在本轮立即处置，避免并行批量改 Multica 账本。


## 9. 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| Practice / Note 后端未完成 | 阻塞前端 milestone | 先完成 M-Api（query + types + MSW），view 在 MSW mock 下先开发；后端 ready 时只换 endpoint |
| Bundle 预算超 280KB | 用户体验下降 | recharts / TipTap / playwright 全 lazy；vite-bundle-analyzer 在每个收尾 milestone 跑一次 |
| RootLayout 冲突 | 多线 PR 互相覆盖 | 7.1 矩阵；写冲突仲裁权归 Master；冲突时合并不走 fast-forward |
| @sikao/editor 解冻时机 | Practice M-Session 申论作答区降级 | 申论暂用占位 textarea；Exam spec 启动后单独 PR 替换为 editor pkg |
| Auth Phase 未启动 | 真实登录页缺失 | DEV bypass 持续生效；prod build 不含；Auth Phase 启动后 5 分钟切换 |
| Onboarding Phase 未启动 | 新用户首次访问无引导 | Home AuthGuard 在 onboarding=false 时跳 BootCard 占位；Onboarding Phase 启动后切换 |
| 跨 Tab 跳转目标未上 | accept(session) / SaveAsNoteButton 失效 | 7.2 矩阵每个跳转都标占位回退；占位用 BootCard + toast「功能即将上线」 |
| MSW handlers 漂移 | 后端契约改动后前端 mock 失真 | 每个 M-Api milestone 跑 `openapi-typescript` 重新生成；mock 由 generated types 反推 |
| vitest-axe 阈值太松 | a11y 假阳性 | 每条线收尾 milestone 强制启用 wcag2aa；CI 阶段 hard fail |
| 4 Tab 并行降级到串行 | timeline 拉长 | 每条线收尾时 Master 重新评估并行性；后端瓶颈是首要降级原因 |

## 10. 完成判定

整体计划完成判定：

- 23 个新 child 全部 status = done 或 cancelled（重定向）
- 4 个父 issue（SIK-29 / SIK-118 / SIK-45 / SIK-44）都有 final Evidence Block
- `apps/web/src/views/` 下 Home / Practice / Review / Note / Me /
  QuestionHub 6 个目录都有真实接线，无 PLACEHOLDER_*
- 7 个跨 Tab 跳转占位全部替换为真实路由
- bundle 预算 4 条线全过（Home / Practice / Review / Notes 各路由初始
  chunk gzip 都 ≤ 280KB）
- e2e 在 main 跑通（playwright 6 viewport × 4 tab 主路径 ≥ 24/24 PASS）
- a11y 0 violation；vitest-axe 套件 ≥ 60 个 case PASS
- Migration-Status.md 「前端代码迁移」条目从 `scrapped 2026-05-24` 改为
  `complete <date>`，列出 4 条线收尾 commit

## 11. Source docs

- `.tmp_review/out/`（47 原型，按 Tab 分目录，由 SIK-85 落地）
- `docs/vault/05-migration/Phase/Home/04-Frontend-WU.md`（WU-F1~F8）
- `docs/vault/05-migration/Phase/Practice/04-Frontend-WU.md`（WU-F9~F22）
- `docs/vault/05-migration/Phase/Review/04-Frontend-WU.md`（WU-FR1~FR14）
- `docs/vault/05-migration/Phase/Notes/03-Frontend-WU.md`（WU-FN1~FN10）
- `.kiro/specs/frontend-style-guide-v5/evidence.md`（V5 spec close）
- `docs/vault/05-migration/Migration-Status.md`（前端代码迁移当前状态）
- `docs/vault/05-migration/Frontend-IA-V2.md` §4（37 view 总览图）
- `docs/engineering/agent-hard-rules.md` H5 / H7 / H8 / H9 / H10
