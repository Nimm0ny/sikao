# Phase-Home · 04 · Frontend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: 每个 WU 对应一组 PR；PR 按 AGENTS-H9 ≤15 文件 / ≤400 行；前端视觉 PR 必须经 browser smoke
>
> **2026-05-21 口径重定基线**：本文档当前仅作 legacy Home 前端轨参考。旧 Home 前端 `F1-F8` 在新的前端全量重构计划落档前不作为当前执行主线；`M0.5` 也仅继续约束这条 legacy 轨。

---

## 0. WU 总览

| # | WU | 估算 | PR 数 | 依赖 |
|---|---|---|---|---|
| WU-F1 | API client + queries（含 types 重生成） | 1,300 | 4 | B9 |
| WU-F2 | domain stores | 700 | 3 | F1 |
| WU-F3 | calendar-engine 包 | 1,400 | 5 | - |
| WU-F4 | Section A · 学习计划 | 4,200 | 12 | F1 / F2 / F3 |
| WU-F5 | Section B · 学习进度 + `/profile/learning` 钻取 | 1,800 | 5 | F1 |
| WU-F6 | Section C · 今日推荐 | 1,000 | 4 | F1 |
| WU-F7 | 首页整合 + 路由 + 老 view 删除 + `/profile/records` | 1,100 | 7 | F4 / F5 / F6 |
| WU-F8 | E2E + MSW + a11y test | 1,200 | 4 | F7 |
| **合计** | | **12,700** | **44** | |

> 前端总量上调（原 8,500），原因：补 loading/empty/error/skeleton 状态、a11y、`/profile/learning` 完整页面、stores 拆分、错误边界。

---

## 1. 全局规范

### 1.1 包路径

```
apps/web/src/                        ← 应用层（路由 / 视图 / 全屏组件）
packages/api-client/                  ← V2 queries + axios + types
packages/domain/                      ← stores + 业务模型
packages/calendar-engine/             ← 纯逻辑日历（新建 WU-F3）
packages/ui/                          ← 共享 UI（icons / brand / button / drawer / dialog）
packages/design-system/               ← tokens.css SSOT
packages/shared-utils/                ← cn / logger / hooks / motion
```

### 1.2 状态机式组件约定

每个数据驱动组件必须实现 4 状态：

| 状态 | 触发 | 视觉 |
|---|---|---|
| `loading` | query.isPending | 骨架屏（Skeleton component） |
| `empty` | query.data 为空 | EmptyState 组件（统一用 `packages/ui/EmptyState`） |
| `error` | query.isError | ErrorCard（含重试按钮） |
| `ready` | query.isSuccess && data | 真实渲染 |

任何组件缺这 4 状态都不许过 review。

### 1.3 错误边界

每个 Section 包一层 `<SectionErrorBoundary>`：单个 Section 挂掉不能让首页白屏；boundary 内显示降级提示 + "重试"按钮。boundary 实现位于 `packages/ui/SectionErrorBoundary.tsx`。

### 1.4 路由清单（5 tab，未变更）

> 实现前置（A0 修订）：当前代码现实仍是 4 tab + `/` public marketing。任何 F7 路由实现都必须先完成 A0 §1.3 的 4→5 升级，再收口到以下目标态。

```
公开层（保留）：marketing/* / Health / NotFound / auth/*
私有层（5 tab）：
  /                           Dashboard（A/B/C 三 Section）
  /practice                   Practice
  /review                     Review
  /notes                      Notes
  /profile                    Profile（overview）
  /profile/learning           ← 新增（H-Plan-7 钻取）
  /profile/records            ← 新增
  /profile/settings           ← 占位（D-Profile-Bind 不实现，仅留路由）
  /practice/sessions/:id      Session（脱壳）
  /practice/sessions/:id/result   Result（脱壳）
  /onboarding                 Onboarding（脱壳）
  /diagnosis                  DiagnosisResult（脱壳）
```

`D-Root-Route` 约束：
- `"/"` 未登录继续显示 marketing
- `"/"` 已登录直接渲染 Home Dashboard
- 不引入 `/home` 过渡路由

### 1.5 暗色 / 主题

所有新组件**禁止写死颜色**；只用 tokens：
- 颜色 → `var(--color-*)` 或 tailwind class（已配置 token-driven）
- 圆角 → `var(--radius-*)`
- 字号 → `var(--text-*)`
- 间距 → `var(--space-*)`

### 1.6 a11y 要求（NF-A11y）

| 要求 | 检查项 |
|---|---|
| 键盘可达 | 所有交互组件 `tabIndex` 正确；日历方向键移动焦点 |
| 屏幕阅读器 | 事件块 `aria-label="{title}, {start_time} 至 {end_time}, 状态 {status_zh}"` |
| 焦点环 | 所有 focusable 元素必须可见 focus ring（用 token，非 outline:none） |
| 颜色对比度 | WCAG AA（普通文 4.5:1，大文 3:1） |
| 减少动画 | `@media (prefers-reduced-motion)` 时关掉拖拽动画与 transition |
| 拖拽替代 | 拖拽必须有键盘等价：选中事件后用方向键移动 + Enter 确认 |

a11y 测试：每个新组件配 `@testing-library/jest-dom` + `axe-core/react` 自动化检查（详见 `10-Testing.md` §5）。

### 1.7 Review / Validation Gate（适用于所有 F*.x PR）

- 每个前端 runtime PR 必须先过独立 review；`F4-F8` 额外做前端规范审查。
- `F4-F8` 属于前端视觉 phase，必须做 `Chrome MCP` browser smoke；工具不可用时 fail-fast，不静默改用别的浏览器方案。
- 旧 Home 前端 `F1-F8` 运行时代码启动前，必须先确认前端 full typecheck blocker 已由独立任务解除。
- 默认验证命令：相关范围的 `npm run typecheck`, `npm run lint`, `vitest --run`；`F8` 再补 desktop/mobile e2e、axe、dark mode smoke。

---

## 2. WU-F1 · API client + queries

### 2.1 PR 拆分

#### F1.1 重生成 types + 删 8 个老 query 文件

文件：
- `packages/api-client/src/types/api.generated.ts`（B9.5 生成）
- 删除：`onboardingQueries.ts / studyPlanQueries.ts / wrongBookQueries.ts / notebookQueries.ts / examEventsQueries.ts / xingceSpecialtyQueries.ts / essaySpecialtyQueries.ts / progressQueries.ts(老)`
- 删除对应测试

PR 行数：~340（净增加为负，但删除也算改动）

#### F1.2 plansQueries（events 部分）

文件：
- `packages/api-client/src/plansQueries.ts`：useEvents / useEvent / useCreateEvent / useUpdateEvent / useDeleteEvent / useDetectConflicts / useBulkDeleteEvents / useRestoreEvent
- `tests/queries/plansQueries.test.ts`
- MSW handlers `tests/handlers/plans-handlers.ts`

业务规则：
- `useEvents` 默认 `include_practice_blocks=true`；缓存 key 含 from/to/plan_id
- mutation 成功后 invalidate `['events', from, to]` + `['progress']`（实绩可能改变）

PR 行数：~360

#### F1.3 plansQueries（plan + adjustments）+ recommendationsQueries

文件：
- 增量 `plansQueries.ts`：usePlansList / usePlan / useCreatePlan / useUpdatePlan / useArchivePlan / useActivatePlan / useAutoGeneratePlan / useAutoRegenerateRange / useAdjustmentsPending / useAcceptAdjustment / useRejectAdjustment
- `recommendationsQueries.ts`：useRecommendationsToday / useRefreshRecommendations / useAcceptRecommendation / useRejectRecommendation / useRecommendationsHistory
- 对应测试 + MSW handlers

业务规则：
- `useAutoGeneratePlan` / `useAutoRegenerateRange` / `useRefreshRecommendations` 必须自动注入 `Idempotency-Key` header（生成 UUID v4）
- `useAutoGeneratePlan` 接收 `onProgress` 回调（SSE 流式事件）

PR 行数：~380

#### F1.4 progressQueries(V2) + dashboardQueries + profileRecordsQuery

文件：
- `progressQueries.ts`：useProgress / useProgressTimeseries / useProgressWeakness / useProgressDiagnosis
- `dashboardQueries.ts`：useDashboardToday / useDashboardWeekly / useDashboardFullPlan
- `profileQueries.ts`：useProfileRecords
- 对应测试 + MSW handlers

PR 行数：~280

---

## 3. WU-F2 · domain stores

### 3.1 PR 拆分

#### F2.1 usePlanStore

文件：
- `packages/domain/src/plan/usePlanStore.ts`（zustand）：
  - `currentPlanId` / `currentView: today|week|month` / `currentDate: ISO`
  - `selectedRange?: {from, to}`（Cust-7 圈选）
  - `optimisticEvents: Map<id, partial>`（拖拽未提交）
- `packages/domain/src/plan/__tests__/usePlanStore.test.ts`

PR 行数：~270

#### F2.2 useDashboardPreferenceStore + 同步

文件：
- `packages/domain/src/dashboard/useDashboardPreferenceStore.ts`：
  - 读：bootstrap 时从 `profile.info.dashboard_preferences` 注入
  - 写：debounce 500ms 后 PUT `/profile/info`
  - localStorage 兜底（profile 未加载时）
- 测试 + MSW handler

PR 行数：~240

#### F2.3 useAdjustmentBannerStore + useRecommendationDraftStore

文件：
- `useAdjustmentBannerStore.ts`：当前 pending adjustment 的 dismiss 状态（per-adjustment-id），sessionStorage 存（关闭浏览器重置）
- `useRecommendationDraftStore.ts`：用户 reject 时填的反馈 draft（防止误关 dialog 丢内容）
- 测试

PR 行数：~190

---

## 4. WU-F3 · calendar-engine 包

详见 `07-Calendar-Engine.md`。本节只列 PR 拆分摘要。

| PR | 内容 | 行数 |
|---|---|---|
| F3.1 | 包基础（package.json / tsconfig / barrel index / types） | ~250 |
| F3.2 | 时区工具 + DST 跳过分支 + 渲染时区转换 | ~270 |
| F3.3 | RRULE expand + EXDATE + detached 应用 | ~340 |
| F3.4 | 冲突检测 + 重叠布局算法 | ~290 |
| F3.5 | 拖拽坐标 + 吸附 + view range + 跨日切片 | ~250 |

---

## 5. WU-F4 · Section A 学习计划

最重的 WU。12 个 PR，4,200 行。

### 5.1 文件组织

```
apps/web/src/components/dashboard-sikao/plan/
  PlanSection.tsx                   主容器
  PlanSegmentTabs.tsx                Today/Week/Month
  PlanGoalChips.tsx                  顶部目标 chips + 倒数考试日
  views/
    TodayCalendarView.tsx
    WeekCalendarView.tsx
    MonthCalendarView.tsx
  blocks/
    EventBlock.tsx                   计划事件块
    PracticeBlock.tsx                实绩块（P4）
    NowLine.tsx                      今日时间线
    DayHeader.tsx
  drawers/
    EventEditDrawer.tsx
    EventCreateDrawer.tsx
    AiPlanGenerateDialog.tsx         （也用于 OnboardingGate）
    AiPlanAdjustBanner.tsx
    AiPlanAdjustDetailDialog.tsx
    RecurringScopeDialog.tsx
    BulkResetMenu.tsx
    ConflictWarning.tsx
  interactions/
    useDragEvent.ts                   dnd-kit 包装
    useResizeEvent.ts
    useShiftRangeSelect.ts            Cust-7 圈选
    useKeyboardEventNav.ts            a11y 键盘导航
  states/
    PlanLoadingSkeleton.tsx
    PlanEmptyState.tsx
    PlanErrorState.tsx
```

### 5.2 PR 拆分

#### F4.1 PlanSection 主容器 + PlanSegmentTabs + 全 4 状态

文件：
- `PlanSection.tsx`（编排：goal chips + segment + view + drawers slot）
- `PlanSegmentTabs.tsx`（accessible tabs）
- `PlanGoalChips.tsx`（顶部 plan name + multi-target chips + 倒数考试日 chip）
- `states/*`（3 个）
- `__tests__/PlanSection.test.tsx`

业务规则：
- 加载时显示 PlanLoadingSkeleton（保留 grid 骨架）
- 无 active plan 时显示 PlanEmptyState（"还没有学习计划，立即生成"按钮 → AiPlanGenerateDialog）
- 错误时 PlanErrorState + 重试按钮

PR 行数：~360

#### F4.2 TodayCalendarView

文件：
- `views/TodayCalendarView.tsx`（24h 纵向 grid，1h 一格，15min 吸附）
- `blocks/NowLine.tsx`
- `blocks/EventBlock.tsx` v1（只读渲染，不含拖拽）
- `__tests__/TodayCalendarView.test.tsx`

业务规则：
- 视图高度 = 24 × 60px = 1440px（CSS variables `--cal-hour-px: 60px`）
- 当前时刻 NowLine 跟踪（每分钟刷新一次）
- 滚动到 (now - 2h) 居中

PR 行数：~340

#### F4.3 WeekCalendarView

文件：
- `views/WeekCalendarView.tsx`（7 列 × 24h）
- `blocks/DayHeader.tsx`
- 多日事件跨列条带渲染（Cal-3）
- `__tests__/WeekCalendarView.test.tsx`

业务规则：
- 顶部固定一行 7 个 DayHeader（含日期 + "今日" 标记）
- 多日事件在跨日处用连接条带（不重复绘制每日事件块）
- 实绩块在 Week 视图同样渲染

PR 行数：~380

#### F4.4 MonthCalendarView + 倒数考试日

文件：
- `views/MonthCalendarView.tsx`（标准月历 6×7，溢出显示 +N more）
- 月历右上角倒数考试日 chip（Cal-6）
- 点格子弹日详情 dialog（DayDetailDialog 在本 PR 含简版）
- `__tests__/MonthCalendarView.test.tsx`

业务规则：
- 每天最多显示 3 个事件块 + "+N more"（Cal-12）
- 月历不显示实绩块（密度太大），仅显示计数 chip"今日 X 题"

PR 行数：~370

#### F4.5 EventBlock 完整版 + EventEditDrawer

文件：
- `blocks/EventBlock.tsx` 增量（点击 / 长按 / 拖拽 handle / source chip / 状态 chip / a11y）
- `drawers/EventEditDrawer.tsx`（基础字段 + scope 选择 + 删除按钮）
- 编辑表单：title / category / start_at / end_at / notes / target_id
- `__tests__/EventEditDrawer.test.tsx`

业务规则：
- source=ai_generated 显示 ✨ chip；source=ai_adjusted 显示 🔧 chip
- 删除时 recurring 事件弹 RecurringScopeDialog（F4.10）
- 保存时 invalidate events query

PR 行数：~390

#### F4.6 EventCreateDrawer + 拖拽空白创建

文件：
- `drawers/EventCreateDrawer.tsx`
- `interactions/useDragEvent.ts` 之"空白拖创建"分支（拖拽空白格 → 调出 drawer 预填时间）
- `__tests__/EventCreateDrawer.test.tsx`

业务规则：
- "+" 按钮入口 + 拖拽空白入口 都走同一 drawer
- 拖拽空白时，拖拽距离 < 30px 视为单击，调起 drawer 默认时长 30min
- ≥ 30px 按拖拽距离推断 end_at

PR 行数：~370

#### F4.7 拖拽 + resize handler + 跨日 + 键盘等价

文件：
- `interactions/useDragEvent.ts`（dnd-kit 集成）
- `interactions/useResizeEvent.ts`
- `interactions/useKeyboardEventNav.ts`（方向键 / Enter / Delete）
- `blocks/EventBlock.tsx` 增量（resize handles 上下两端）
- `__tests__/dragdrop.test.tsx`

业务规则：
- 拖拽时显示 ghost block + 时间提示 tooltip
- 跨日拖拽：在 Week/Month 视图允许；Today 视图禁止
- prefers-reduced-motion 时关掉 ghost 动画

PR 行数：~390

#### F4.8 AiPlanGenerateDialog（含 onboarding 复用）+ SSE

文件：
- `drawers/AiPlanGenerateDialog.tsx`（独立组件，可在 onboarding 与首页 CTA 复用）
- 表单：考试日 / 每日时长 / 起点（baseline 简版） / 重点科目（多选） / 风格（loose/standard/aggressive）
- SSE 进度条：流式接收 plan_generate 事件
- 失败重试按钮 + 引导手动模式（AI-5）
- `__tests__/AiPlanGenerateDialog.test.tsx`

业务规则：
- 表单校验：考试日 ≥ tomorrow + 1d；每日时长 60-720
- 提交按钮 disabled 直到表单有效
- SSE 事件 `event_generated` 实时把已生成事件填到日历（乐观渲染）
- 完成 / 失败时 invalidate events + plans queries

PR 行数：~390

#### F4.9 AiPlanAdjustBanner + 详情 dialog

文件：
- `drawers/AiPlanAdjustBanner.tsx`（顶部固定 banner，含简短摘要 + "查看详情" CTA + "稍后" / "拒绝"）
- `drawers/AiPlanAdjustDetailDialog.tsx`（diff 列表 + accept/reject）
- `__tests__/AiPlanAdjustBanner.test.tsx`

业务规则：
- 仅当存在 status=pending 的 adjustment 时显示
- "稍后"按钮存 sessionStorage 24h 不再弹（per id）
- accept 后 banner 消失 + invalidate events
- 用 `useAdjustmentBannerStore`（F2.3）

PR 行数：~340

#### F4.10 RecurringScopeDialog + ConflictWarning + BulkResetMenu

文件：
- `drawers/RecurringScopeDialog.tsx`（仅此次 / 后续所有 / 整个序列 三选）
- `drawers/ConflictWarning.tsx`（Cust-4：保存前调 conflict detect API；冲突时 inline 弹警告；用户选"仍保存"或"返回修改"）
- `drawers/BulkResetMenu.tsx`（Cust-5：清空本周 / 全部 / 重新让 AI 生成）
- 对应测试

PR 行数：~310

#### F4.11 PracticeBlock（实绩块）+ Day Detail Dialog

文件：
- `blocks/PracticeBlock.tsx`（虚线半透明 + chip "已完成 X 题" + 不可拖拽）
- `drawers/DayDetailDialog.tsx`（Month 视图点开 + 多事件展开）
- 接入 events query 的 `practice_blocks` 字段
- 测试

业务规则：
- 实绩块点击 → 跳 `/profile/records?session_id=X`
- 实绩块在 Today/Week 渲染；Month 不渲染（仅 chip 计数）

PR 行数：~290

#### F4.12 局部 AI 重生成圈选（Cust-7）

文件：
- `interactions/useShiftRangeSelect.ts`（shift+drag 在 Week 视图选择连续日期段）
- 右键/长按菜单 "AI 重新生成此段"
- 调 `useAutoRegenerateRange`（SSE）+ 进度条
- 测试

业务规则：
- 选中段必须 ≥ 1 天 ≤ 14 天，超出 toast 提示
- 重生成期间该段事件半透明 + spinner，完成时替换

PR 行数：~270

---

## 6. WU-F5 · Section B + `/profile/learning`

### 6.1 文件组织

```
apps/web/src/components/dashboard-sikao/progress/
  ProgressSection.tsx                首页 Section B
  KeyMetricCard.tsx
  TrendSparkline.tsx
  WeaknessTopMini.tsx               top3 mini list
apps/web/src/views/
  ProfileLearning.tsx                /profile/learning
apps/web/src/components/profile/learning/
  LearningHeader.tsx
  WeaknessRadar.tsx                  弱项雷达
  TimeseriesChart.tsx                趋势全量
  PlanSliceCard.tsx
  DiagnosisReport.tsx
```

### 6.2 PR 拆分

#### F5.1 ProgressSection + KeyMetricCard + 4 状态

文件：
- `ProgressSection.tsx`
- `KeyMetricCard.tsx`（数字 + 标签 + 趋势箭头 + 占比）
- `__tests__/`

业务规则（H-Plan-7）：
- 显示 6 张数值卡：今日已答题数 / 今日正确率 / 本周分钟 / 距考试日 / 言语正确率 / 判断正确率
- 卡片整组点击 → 跳 `/profile/learning`

PR 行数：~340

#### F5.2 TrendSparkline + WeaknessTopMini

文件：
- `TrendSparkline.tsx`（基于 timeseries 7 天 mini）
- `WeaknessTopMini.tsx`（弱项 top3 + chip）
- 测试

PR 行数：~280

#### F5.3 ProfileLearning 页面骨架 + 路由 + Header + PlanSliceCard

文件：
- `views/ProfileLearning.tsx`
- `components/profile/learning/LearningHeader.tsx`
- `components/profile/learning/PlanSliceCard.tsx`
- 路由注册 `/profile/learning`
- 测试

PR 行数：~370

#### F5.4 WeaknessRadar + TimeseriesChart 完整版

文件：
- `WeaknessRadar.tsx`（基于 recharts，按科目维度）
- `TimeseriesChart.tsx`（按 day/week 切换 + 多指标 toggle）
- 测试

PR 行数：~390

#### F5.5 DiagnosisReport

文件：
- `DiagnosisReport.tsx`（strengths / weaknesses / suggestions 三块，含建议 → 跳推荐刷新）
- 测试

PR 行数：~270

---

## 7. WU-F6 · Section C 今日推荐

### 7.1 文件组织

```
apps/web/src/components/dashboard-sikao/recommend/
  RecommendationSection.tsx
  RecommendationCard.tsx
  AcceptOptionMenu.tsx
  RejectFeedbackDialog.tsx
  EmptyRecommendation.tsx
```

### 7.2 PR 拆分

#### F6.1 RecommendationSection + Card + 4 状态

文件：
- `RecommendationSection.tsx`（含"换一批"按钮）
- `RecommendationCard.tsx`（标题 + reason + estimated_minutes + action_type chip + CTA）
- `EmptyRecommendation.tsx`（Rec-6 兜底）
- 4 状态
- 测试

业务规则：
- action_type=review 显示蓝色 chip "复盘"
- action_type=continue 显示绿色 chip "继续"
- action_type=rest 显示灰色 chip "休息"
- chip 颜色用 token，不写死

PR 行数：~330

#### F6.2 AcceptOptionMenu + 进 session（含 D-Link-Session + Rec-9）

文件：
- `AcceptOptionMenu.tsx`（默认按钮 "去做"；下拉 "加入计划"）
- 进 session 流：调 useAcceptRecommendation + redirect to session
- 测试（含 linked_recommendation_id 验证）

PR 行数：~270

#### F6.3 加入计划分支

文件：
- `AcceptOptionMenu.tsx` 增量（target_date 选择 popover：今日 / 明日 / 本周内某日）
- 调 useAcceptRecommendation action=plan
- 成功后 toast + invalidate events
- 测试

PR 行数：~220

#### F6.4 RejectFeedbackDialog

文件：
- `RejectFeedbackDialog.tsx`（4 reason 单选 + 可选 note + 提交）
- 接入 useRecommendationDraftStore（F2.3）防丢稿
- 测试

PR 行数：~210

---

## 8. WU-F7 · 首页整合 + 路由 + 老 view 删除

### 8.1 PR 拆分

#### F7.1 Dashboard.tsx 重写

文件：
- 重写 `apps/web/src/views/Dashboard.tsx`：编排 Section A/B/C；按 dashboard_preferences 控制顺序与可见性；每个 Section 包 SectionErrorBoundary
- 测试

PR 行数：~260

#### F7.2a `/me` bug 修复 + 5 tab 校对

文件：
- 修复 `"/me" -> "/profile"` 错路由
- 校对 `apps/web/src/layouts/AppShell.tsx`：5 tab 不变（首页 / 练习 / 复盘 / 笔记 / 我的）；移除任何 H-Plan-6 残留
- 校对 `RailMini.tsx` / `TabBar.tsx` 同步 5 tab，并新增 `/notes` 入口
- 测试

PR 行数：~180

#### F7.2b canonical 路由 rename + legacy redirect

文件：
- `apps/web/src/router/index.tsx`
- 相关 redirect 测试

业务规则：
- `"/study/today" -> "/"`，`"/practice/center*" -> "/practice*"`，`"/wrong-book*" -> "/review*"`
- 保留 legacy redirect 直到 F8 完整回归通过
- `"/"` 采用 `D-Root-Route` 双态：未登录 marketing，已登录 Home Dashboard

PR 行数：~220

#### F7.2c view 迁移：Dashboard -> ProfileLearning

文件：
- `apps/web/src/views/Dashboard.tsx`
- `apps/web/src/views/ProfileLearning.tsx`
- 相关测试

业务规则：
- 现有 `Dashboard.tsx` 的“学情数据”内容迁到 `ProfileLearning.tsx`
- `Dashboard.tsx` 只保留登录态首页三 Section 编排

PR 行数：~260

#### F7.3 OnboardingGate 接 AiPlanGenerateDialog

文件：
- `router/OnboardingGate.tsx` 增量：bootstrap.canStartPractice=false 且未有 active plan 时强制流：先 onboarding 收集 baseline → 弹 AiPlanGenerateDialog（F4.8 复用）→ 生成完成跳 `/`
- 测试

PR 行数：~290

#### F7.4 `/profile/records` 子页

文件：
- `apps/web/src/views/ProfileRecords.tsx`（按日分组的 session 列表 + 筛选 + 详情链接）
- 路由注册
- 接 `GET /api/v2/profile/records`
- 测试

PR 行数：~280

#### F7.5 删除老 view + 路由 cleanup + ⼊⼝改写

文件：
- 删除：`Plan.tsx / studyToday.tsx`
- 删除对应测试
- 老路由 redirect：`/plan` → `/`，`/study/today` → `/`，`/progress`（老）→ `/profile/learning`
- `Onboarding.tsx` / `DiagnosisResult.tsx` 不删（D-Layer 保留），但确保从 `/onboarding` 进入后能正确接 dialog

PR 行数：~280（净增加为负）

---

## 9. WU-F8 · E2E + MSW + a11y

### 9.1 PR 拆分

#### F8.1 Dashboard.test.tsx 重写 + MSW handlers 全集

文件：
- `views/__tests__/Dashboard.test.tsx`
- `tests/handlers/v2/*.ts`：plans / events / recommendations / progress / dashboard 全集 handler

PR 行数：~360

#### F8.2 拖拽 / AI 制定 / AI 调整 e2e

文件：
- `tests/e2e/plan-section.spec.ts`：
  - 拖拽事件改时间 → patch 成功
  - AI 制定全流程
  - AI 调整 banner accept

PR 行数：~340

#### F8.3 推荐 accept/reject + 实绩块 + 多日事件

文件：
- `tests/e2e/recommendation.spec.ts`
- `tests/e2e/practice-block.spec.ts`
- `tests/e2e/multi-day-event.spec.ts`

PR 行数：~290

#### F8.4 a11y 自动化 + 键盘流

文件：
- `tests/a11y/dashboard-a11y.spec.ts`（axe-core 扫描）
- `tests/a11y/calendar-keyboard.spec.ts`（键盘流：方向键 / Enter / Delete）
- `tests/a11y/ai-dialog-a11y.spec.ts`

PR 行数：~210

### 9.2 完工 gate

- `vitest --run` 全绿
- `tsc --strict` 无错
- 9 个 lint:* 脚本全过
- `axe-core` 0 violation
- MSW e2e 覆盖：日历 CRUD / AI 制定 / AI 调整 / 推荐 accept/reject / 实绩块 / 多日事件 / 键盘流
- 桌面 + 移动 viewport 都过
- 暗色模式 smoke

---

## 10. PR 列表（44 个）

```
F1.1  重生成 types + 删 8 个老 query
F1.2  plansQueries(events)
F1.3  plansQueries(plan+adjustments) + recommendationsQueries
F1.4  progressQueries + dashboardQueries + profileRecordsQuery

F2.1  usePlanStore
F2.2  useDashboardPreferenceStore + sync
F2.3  useAdjustmentBannerStore + useRecommendationDraftStore

F3.1  calendar-engine 包基础
F3.2  时区 + DST stub
F3.3  RRULE expand + EXDATE + detached
F3.4  冲突 + 重叠布局
F3.5  拖拽坐标 + 吸附 + 跨日

F4.1  PlanSection 主容器 + segment + 4 状态
F4.2  TodayCalendarView
F4.3  WeekCalendarView
F4.4  MonthCalendarView + 倒数
F4.5  EventBlock + EventEditDrawer
F4.6  EventCreateDrawer + 拖拽空白
F4.7  拖拽 + resize + 键盘
F4.8  AiPlanGenerateDialog + SSE
F4.9  AiPlanAdjustBanner + 详情
F4.10 RecurringScope + Conflict + BulkReset
F4.11 PracticeBlock + DayDetailDialog
F4.12 局部 AI 重生成圈选

F5.1  ProgressSection + KeyMetricCard
F5.2  TrendSparkline + WeaknessTopMini
F5.3  ProfileLearning Header + PlanSliceCard
F5.4  WeaknessRadar + TimeseriesChart
F5.5  DiagnosisReport

F6.1  RecommendationSection + Card + 空态
F6.2  AcceptOptionMenu + session 流
F6.3  AcceptOptionMenu 加入计划
F6.4  RejectFeedbackDialog

F7.1  Dashboard.tsx 重写
F7.2a /me bug 修复 + 5 tab 校对
F7.2b canonical 路由 rename + legacy redirect
F7.2c Dashboard 内容迁到 ProfileLearning
F7.3  OnboardingGate 接 AiPlanGenerateDialog
F7.4  /profile/records 子页
F7.5  删除老 view + 路由 redirect

F8.1  Dashboard test + MSW handlers
F8.2  拖拽 / AI 制定 / 调整 e2e
F8.3  推荐 / 实绩块 / 多日 e2e
F8.4  a11y 自动化
```

---

## 11. 引用矩阵

| 本文档被引用 |
|---|
| `07-Calendar-Engine.md` 实现细节 |
| `08-NonFunctional.md` 性能预算 / 离线 / a11y |
| `10-Testing.md` MSW handlers / e2e / a11y 测试 |
