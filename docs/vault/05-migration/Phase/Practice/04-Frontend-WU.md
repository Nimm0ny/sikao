# Phase-Practice · 04 · Frontend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: 每个 WU 对应一组 PR；PR 按 AGENTS-H9 ≤15 文件 / ≤400 行；前端视觉 PR 必须经 browser smoke

---

## 0. WU 总览

| # | WU | 估算 | PR 数 | 依赖 |
|---|---|---|---|---|
| WU-F9 | API client + queries 扩展（含 types 重生成） | 1,800 | 5 | Phase-Practice WU-B24 |
| WU-F10 | domain stores | 700 | 3 | F9 |
| WU-F11 | PracticeCenter 主 view + Section A 历史记录 | 1,400 | 4 | F9 / F10 |
| WU-F12 | Section B 专项练习入口 | 600 | 2 | F9 |
| WU-F13 | Section C 套卷练习入口 | 900 | 3 | F9 |
| WU-F14 | 自定义刷题对话框 | 1,200 | 4 | F9 / F10 |
| WU-F15 | AI 出题等待页 + 答题 view 扩展 | 1,400 | 5 | F9 / F10 |
| WU-F16 | 申论答题 view + 异步批改流程 | 1,800 | 5 | F9 |
| WU-F17 | PracticeCenter 整合 + 老 view 删除 | 1,200 | 4 | F11-F16 |
| WU-F18 | E2E + MSW + a11y test | 1,500 | 4 | F17 |
| **合计** | | **12,500** | **39** | |

> 前端总量上调（README 估算 10,500），原因：补 loading/empty/error/skeleton 状态、a11y、bundle 控制、错误边界。

---

## 1. 全局规范

### 1.1 包路径

```
apps/web/src/                        ← 应用层（路由 / 视图 / 全屏组件）
packages/api-client/                  ← V2 queries + axios + types
packages/domain/                      ← stores + 业务模型
packages/calendar-engine/             ← 已建（Phase-Home）
packages/ui/                          ← 共享 UI（icons / brand / button / drawer / dialog / EmptyState / SkeletonCard）
packages/design-system/               ← tokens.css SSOT
packages/shared-utils/                ← cn / logger / hooks / motion
```

### 1.2 状态机式组件约定（继承 Phase-Home）

每个数据驱动组件必须实现 4 状态：

| 状态 | 触发 | 视觉 |
|---|---|---|
| `loading` | query.isPending | 骨架屏（Skeleton component） |
| `empty` | query.data 为空 | EmptyState 组件 |
| `error` | query.isError | ErrorCard（含重试按钮） |
| `data` | query.data 有值 | 正常渲染 |

### 1.3 路由表（最终）

```ts
// apps/web/src/router/index.tsx 增量
const PRACTICE_ROUTES = [
  // 主 tab（在 AppShell 内）
  { path: '/practice', element: <PracticeCenter /> },
  { path: '/practice/questions/:id', element: <QuestionDetail /> },  // Tab 4 笔记跳转目标
  { path: '/practice/daily', element: <DailyPracticeStart /> },

  // 脱壳路由（全屏，不在 AppShell 内）
  { path: '/practice/sessions/:id', element: <PracticeSession />, fullscreen: true },
  { path: '/practice/sessions/:id/result', element: <SessionResult />, fullscreen: true },
  { path: '/practice/sessions/:id/grading', element: <EssayGradingResult />, fullscreen: true },  // 申论批改详情
  { path: '/practice/ai-questions/generating', element: <AiQuestionsGenerating />, fullscreen: true },
];
```

### 1.4 Bundle 预算（NF-Bundle 继承 Phase-Home + 本 Phase 追加）

| 路由 | 初始 chunk gzip | 关键依赖 |
|---|---|---|
| `/practice` | ≤ 280KB | + recharts（懒加载，仅 Section A 用） |
| `/practice/sessions/:id` | ≤ 320KB | + answer-engine + editor（已有） |
| `/practice/sessions/:id/grading` | ≤ 280KB | recharts 懒加载 |
| `/practice/ai-questions/generating` | ≤ 80KB | 极简动画页 |

recharts 在所有用到的路由都必须懒加载（`lazy()`）。

### 1.5 a11y 约定

继承 Phase-Home 全套 axe-core 0 violation。本 Phase 关键 a11y 点：
- 自定义刷题双滑块：keyboard 可达（左右箭头）+ aria-label + aria-valuemin/max/now
- AI 出题等待页：aria-live="polite" 公布进度
- 申论批改 polling：成功通知用 aria-live="polite"，失败用 "assertive"
- 答题节奏切换：明确 aria-pressed 状态

### 1.6 错误边界

- `apps/web/src/components/practice/ErrorBoundary.tsx`：包裹整个 PracticeCenter
- 单 Section 错误不影响其他 Section 渲染
- 答题中的错误展示"保存草稿到本地 + 联系支持"

---

## 2. WU-F9 · API client + queries 扩展

**目标**：在 Phase-Home 的 query 文件基础上扩展 + 新增。

### 2.1 文件清单

```
packages/api-client/src/queries/
  contentQueries.ts           ← 重写（categories filter + papers filter）
  sessionQueries.ts           ← 扩展（多 mode + 答题中操作 + as_draft）
  practiceStatsQueries.ts     ← 新建
  aiQuestionsQueries.ts       ← 新建
  essayGradingQueries.ts      ← 新建（含 polling hook）
  essayDraftsQueries.ts       ← 新建（CLP-6：30s 自动保存草稿）
  favoritesQueries.ts         ← 新建
  flagsQueries.ts             ← 新建
  dailyPracticeQueries.ts     ← 新建
  questionDetailQueries.ts    ← 新建（CLP-7：题目详情聚合页用，对接 GET /practice/questions/:id）
  notesQueries.ts             ← 新建（CLP-5：题级笔记最小集 CRUD；Tab 4 主 view 仍由 Phase/Notes 落地）
```

### 2.2 PR 拆分

#### F9.1 重生成 types + contentQueries 重写

文件：
- 重生成 `packages/api-client/src/types/api.generated.ts`（基于 B24.5 OpenAPI）
- 重写 `contentQueries.ts`：useCategories / usePapers + filter
- MSW handlers
- 测试

行数 ~350。

#### F9.2 sessionQueries 扩展 + practiceStatsQueries

文件：
- 扩展 `sessionQueries.ts`：useCreateSession（含 mode 参数）+ useFlagAnswer / useViewSolution / usePersistentFlag
- 新建 `practiceStatsQueries.ts`：useStats / useStatsRealtime / useStatsTrend / useStatsCross / useStatsPercentile

行数 ~400。

#### F9.3 aiQuestionsQueries（含同步等待 hook）+ dailyPracticeQueries

文件：
- 新建 `aiQuestionsQueries.ts`：useGenerateAiQuestions（同步等待）+ useFeedbackAiQuestion
- 新建 `dailyPracticeQueries.ts`：useDaily / useStartDaily / useDailyHistory

⚠️ `useGenerateAiQuestions` 是个长时间 mutation（10-30s），必须设置：
- timeout: 35000ms
- 失败时清晰错误分类（503 vs 429 vs network）

行数 ~380。

#### F9.4 essayGradingQueries（异步轮询）+ essayDraftsQueries + favoritesQueries + flagsQueries

文件：
- 新建 `essayGradingQueries.ts`：
  - useTriggerGrading（同步触发；CLP-1：仅用于失败重试，默认路径无需）
  - useGradingStatus（轮询 hook，3s/5s/10s 退避）
  - useGradingResult
  - useReferenceAnswers
  - useFeedbackReference
- 新建 `essayDraftsQueries.ts`（CLP-6）：
  - useEssayDraft(sessionId)
  - useUpsertEssayDraft：30s 间隔自动 PUT，按 content 覆盖（自然幂等，无 IdempotencyKey）
- 新建 `favoritesQueries.ts`：useFavorites / useToggleFavorite
- 新建 `flagsQueries.ts`：useFlags / useToggleFlag / useResolveFlag

行数 ~480。

#### F9.5 notesQueries + questionDetailQueries + MSW handlers 全套补齐

文件：
- 新建 `notesQueries.ts`（CLP-5）：useQuestionLinkedNotes / useCreateQuestionNote / useUpdateNote / useDeleteNote
- 新建 `questionDetailQueries.ts`（CLP-7）：useQuestionDetail
- `apps/web/src/test-utils/handlers.ts` 增量
- 覆盖所有新 endpoint 的成功 / 失败 fixtures

行数 ~290。

**估算**：1,800 行 / 5 PR
**依赖**：Phase-Practice WU-B24
**验收**：MSW 跑通所有新端点；strict typecheck 通过；ai_questions 长 polling 测试通过。

---

## 3. WU-F10 · domain stores

**目标**：练习中心状态管理。

### 3.1 文件清单

```
packages/domain/src/practice/
  usePracticeStore.ts             ← 当前 segment / 当前 filter / 当前 sort
  useSessionConfigStore.ts        ← 自定义刷题配置（持久化 localStorage + profile.info）
  useAnswerSessionStore.ts        ← 扩展 Phase-Home 的（含 flag/favorite/note 操作）
  index.ts
```

### 3.2 PR 拆分

#### F10.1 usePracticeStore

文件：
- 当前 segment（行测/申论）
- 当前 filter 状态（papers tab 的 year/region/exam_type/difficulty）
- 当前 sort
- 持久化到 sessionStorage（页面刷新不重置 segment）

行数 ~180。

#### F10.2 useSessionConfigStore + profile.info 同步

文件：
- 自定义刷题配置（Cust-* 字段集合）
- 持久化策略：localStorage 即时 + profile.info.dashboard_preferences.practice_custom_config 异步同步（继承 Phase-Home D5）

行数 ~250。

#### F10.3 useAnswerSessionStore 扩展

文件：
- 扩展 Phase-Home 已有的 store（如 useSessionStore），加：
  - flag 操作（本次内）
  - favorite 操作
  - 题级笔记操作（与 NoteV2 联动）
  - viewedSolution 状态

行数 ~270。

**估算**：700 行 / 3 PR
**依赖**：F9
**验收**：store 单测通过；preferences 跨设备同步往返。

---

## 4. WU-F11 · PracticeCenter 主 view + Section A 历史记录

**目标**：练习中心一屏 view 的主容器 + Section A。

### 4.1 文件清单

```
apps/web/src/views/PracticeCenter.tsx                          ← 主容器
apps/web/src/components/practice/segment/PracticeSegmentTabs.tsx
apps/web/src/components/practice/quick-actions/QuickActionsBar.tsx
apps/web/src/components/practice/stats/StatsSection.tsx
apps/web/src/components/practice/stats/CategoryStatsCard.tsx
apps/web/src/components/practice/stats/SubcategoryList.tsx
apps/web/src/components/practice/stats/PercentileBadge.tsx
apps/web/src/components/practice/stats/TrendMiniChart.tsx
apps/web/src/components/practice/stats/StatsDrillDownModal.tsx  ← 二级分类钻取
```

### 4.2 PR 拆分

#### F11.1 PracticeCenter 主容器 + segment + quick actions

文件：
- `PracticeCenter.tsx`：编排 Section A/B/C
- `PracticeSegmentTabs.tsx`：行测/申论 segment（写入 usePracticeStore）
- `QuickActionsBar.tsx`：每日一练 / 继续上次 / 自定义刷题 三按钮
- 测试

行数 ~360。

#### F11.2 StatsSection + CategoryStatsCard

文件：
- `StatsSection.tsx`：根据 type=xingce|essay 渲染对应一级分类的卡片堆
- `CategoryStatsCard.tsx`：单卡（一级模块名 + 总正确率 + 趋势 sparkline）
- 4 状态（loading / empty / error / data）
- 测试

行数 ~380。

#### F11.3 SubcategoryList + 钻取详情

文件：
- `SubcategoryList.tsx`：CategoryStatsCard 内部展开二级分类列表（用户做题进度 79/1427 + 正确率）
- `StatsDrillDownModal.tsx`：点击二级分类时弹钻取详情（趋势曲线 + 题型 × 难度交叉矩阵）
- 测试

行数 ~360。

#### F11.4 PercentileBadge + TrendMiniChart + 数据完整性

文件：
- `PercentileBadge.tsx`：百分位徽章（"超过 X% 用户"）
- `TrendMiniChart.tsx`：sparkline 缩略图（recharts，懒加载）
- 测试 + 性能优化（虚拟滚动 if 二级分类 > 20）

行数 ~300。

**估算**：1,400 行 / 4 PR
**依赖**：F9 / F10
**验收**：行测/申论 segment 切换数据正确；二级分类钻取展示完整；4 状态 visual snapshot 通过。

---

## 5. WU-F12 · Section B 专项练习入口

**目标**：二级分类树 + 进入 session。

### 5.1 文件清单

```
apps/web/src/components/practice/specialty/SpecialtySection.tsx
apps/web/src/components/practice/specialty/CategoryAccordion.tsx
apps/web/src/components/practice/specialty/CategoryItem.tsx
apps/web/src/components/practice/specialty/SpecialtyConfigDialog.tsx  ← 选数量/难度
```

### 5.2 PR 拆分

#### F12.1 SpecialtySection + CategoryAccordion + CategoryItem

文件：
- `SpecialtySection.tsx`：从 contentQueries.useCategories 取数据
- `CategoryAccordion.tsx`：一级展开 / 二级列表
- `CategoryItem.tsx`：含进度 79/1427 + "去练习"按钮
- 测试

行数 ~340。

#### F12.2 进入 session 流 + 配置对话框

文件：
- `SpecialtyConfigDialog.tsx`：选数量（5/10/20/30）+ 选难度（不限/简单/中等/困难）
- 提交后调 `useCreateSession({ mode: 'category', config: {...} })`
- 测试

行数 ~260。

**估算**：600 行 / 2 PR
**依赖**：F9
**验收**：分类树展开折叠正常；点击"去练习"正确进 session；空 catalog 优雅降级。

---

## 6. WU-F13 · Section C 套卷练习入口

**目标**：套卷列表 + filter（如截图样式）。

### 6.1 文件清单

```
apps/web/src/components/practice/papers/PapersSection.tsx
apps/web/src/components/practice/papers/PaperFilterBar.tsx
apps/web/src/components/practice/papers/PaperList.tsx
apps/web/src/components/practice/papers/PaperCard.tsx
apps/web/src/components/practice/papers/PaperFilterChips.tsx
```

### 6.2 PR 拆分

#### F13.1 PapersSection + PaperFilterBar

文件：
- `PapersSection.tsx`：主容器
- `PaperFilterBar.tsx`：四维 filter（年份 / 地区 / 考试类型 / 难度）
- `PaperFilterChips.tsx`：filter chip 单元
- 测试

行数 ~320。

#### F13.2 PaperList + PaperCard

文件：
- `PaperList.tsx`：列表渲染（虚拟滚动 if > 50 套）
- `PaperCard.tsx`：标题 + 难度 + 已完成状态徽章
- 测试

行数 ~320。

#### F13.3 已完成状态显示 + 排序

文件：
- 已完成状态 chip（"未完成 / 已完成 / 进行中"）
- "查看上次成绩"按钮（跳到 result 页）
- 排序选择器（年份降序 / 难度 / 完成状态）
- 测试

行数 ~260。

**估算**：900 行 / 3 PR
**依赖**：F9
**验收**：filter 多维组合正确；已完成状态准确；排序正确。

---

## 7. WU-F14 · 自定义刷题对话框

**目标**：截图功能完整实现（Cust-* 字段集合）。

### 7.1 文件清单

```
apps/web/src/components/practice/custom/CustomPracticeDialog.tsx
apps/web/src/components/practice/custom/SourceModeRadio.tsx        ← 真题 / AI 出题
apps/web/src/components/practice/custom/YearRangeRadio.tsx          ← 不限 / 近 3 / 近 5 / 近 10 年
apps/web/src/components/practice/custom/DifficultyRangeSlider.tsx   ← 双滑块
apps/web/src/components/practice/custom/QuestionCountStepper.tsx    ← 5/10/15/20/30
apps/web/src/components/practice/custom/PaceRadio.tsx               ← 逐题 / 整组
apps/web/src/components/practice/custom/CategoryFilter.tsx          ← 一级 + 二级多选（可选）
apps/web/src/components/practice/custom/AdvancedToggle.tsx          ← 仅刷错题 / 排除已做
apps/web/src/components/practice/custom/CustomSubmitButton.tsx
```

### 7.2 PR 拆分

#### F14.1 主容器 + SourceModeRadio + YearRangeRadio

文件：
- `CustomPracticeDialog.tsx`：主对话框（drawer / dialog）
- `SourceModeRadio.tsx`
- `YearRangeRadio.tsx`
- 集成 useSessionConfigStore
- 测试

行数 ~320。

#### F14.2 DifficultyRangeSlider + QuestionCountStepper

文件：
- `DifficultyRangeSlider.tsx`：双滑块（基于 `@radix-ui/react-slider` 或自实现）
  - keyboard 可达（左右箭头改最低/最高）
  - aria-valuemin/max/now
  - 显示百分比 chip "0% - 100%"
- `QuestionCountStepper.tsx`：5/10/15/20/30 segment 按钮
- 测试

行数 ~300。

#### F14.3 PaceRadio + CategoryFilter + AdvancedToggle

文件：
- `PaceRadio.tsx`：逐题 / 整组（默认整组）
- `CategoryFilter.tsx`：分类多选（用 CategoryAccordion 复用）
- `AdvancedToggle.tsx`：高级选项展开
- 测试

行数 ~280。

#### F14.4 提交流程（含 AI 出题分支跳转）

文件：
- `CustomSubmitButton.tsx`：根据 sourceMode 分支
  - 真题：调 `useCreateSession({ mode: 'custom', config: {...} })` → 跳 `/practice/sessions/:id`
  - **AI 出题（CLP-2 流程）**：跳 `/practice/ai-questions/generating?config=...`（带 query 参数）
    - 等待页主流程：
      1. 调 `useGenerateAiQuestions(config)` 同步等待（10-30s）→ 拿到 `{ requestId, questionIds }`
      2. 立即调 `useCreateSession({ mode: 'ai_generated', config: { questionIds, requestId } })`
      3. 拿到 session_id 后 `navigate('/practice/sessions/:id', { replace: true })`
      4. 等待页 unmount；若用户再退回浏览器历史，重定向到 `/practice`（不复用同 requestId）
- 失败处理：
  - 503（AI_AUDIT_FAILED）：等待页显示"切换到真题"按钮（不调 createSession）
  - 429（AI_QUOTA_EXCEEDED）：等待页 toast "今日 AI 出题次数已用完"（不调 createSession）
- 测试

行数 ~300。

**估算**：1,200 行 / 4 PR
**依赖**：F9 / F10
**验收**：所有配置组合都能正确发出 session.create 或跳转 AI 等待页；a11y 通过（双滑块键盘可达）。

---

## 8. WU-F15 · AI 出题等待页 + 答题 view 扩展

**目标**：
1. AI 出题等待页（同步等待 10-30s 的转圈页）
2. 答题 view 扩展：收藏/标记/笔记/答题节奏

### 8.1 文件清单

```
apps/web/src/views/AiQuestionsGenerating.tsx
apps/web/src/components/practice/session/SessionToolbar.tsx
apps/web/src/components/practice/session/QuestionFavoriteButton.tsx
apps/web/src/components/practice/session/QuestionFlagButton.tsx          ← 基础（本次内）
apps/web/src/components/practice/session/QuestionPersistentFlagDialog.tsx ← submit 后持久化
apps/web/src/components/practice/session/QuestionNoteSheet.tsx           ← 题级笔记编辑
apps/web/src/components/practice/session/PaceIndicator.tsx
apps/web/src/components/practice/session/SolutionPanel.tsx               ← 答题节奏控制
```

### 8.2 PR 拆分

#### F15.1 AiQuestionsGenerating view + 失败 fallback

文件：
- `AiQuestionsGenerating.tsx`（CLP-2 流程）：
  - 旋转动画 + 进度提示分阶段："分析弱项..." → "改编题目..." → "审核质量..."
  - aria-live="polite"
  - 主流程：调 `useGenerateAiQuestions` → 成功后立即 `useCreateSession(mode=ai_generated, config={ questionIds, requestId })` → `navigate(/practice/sessions/:id, replace)`
  - 30s 超时显示重试按钮
  - 503 失败提示"切换到真题"按钮（清空 config.sourceMode → custom dialog）
  - **不**在等待页落 DRAFT session（CLP-4：mode=ai_generated 路径 as_draft=false）
- 测试（mock 各种失败路径 + mock generate 成功后 createSession 失败的边界）

行数 ~340。

#### F15.2 SessionToolbar + QuestionFavoriteButton

文件：
- `SessionToolbar.tsx`：答题界面顶部工具栏（收藏 / 标记 / 笔记 三按钮）
- `QuestionFavoriteButton.tsx`：toggle 收藏（即时反馈 + optimistic update）
- 测试

行数 ~260。

#### F15.3 QuestionFlagButton + 基础标记 + 持久标记弹窗

文件：
- `QuestionFlagButton.tsx`：toggle flagged（本次 session 内）
- `QuestionPersistentFlagDialog.tsx`：session.submit 时若有 flagged answers，弹窗确认是否持久化（用户可选择性勾选）
- 测试

行数 ~280。

#### F15.4 QuestionNoteSheet（CLP-5：题级笔记后端 CRUD 已就绪）

文件：
- `QuestionNoteSheet.tsx`：题级笔记 drawer（list 该题相关笔记 + 创建新笔记）
- 调 `notesQueries.useQuestionLinkedNotes / useCreateQuestionNote / useUpdateNote / useDeleteNote`（CLP-5：本 Phase B16.4 已建后端 CRUD）
- 笔记保存后立即可在 Tab 4 看到（联动验证；Tab 4 主 view 由 Phase/Notes 落地，但数据层闭环完整）
- 模考期间（exam_mode=true）UI 隐藏"加笔记"入口（与 13-Mock-Exam §3.4 / MockExam-Notes-Forbidden 后端兜底一致）
- 测试

行数 ~280。

#### F15.5 SolutionPanel + 答题节奏闭卷逻辑

文件：
- `SolutionPanel.tsx`：解析展示
  - 整组模式（session.practice_mode=full_set + status != submitted）→ 渲染锁定 placeholder + "提交后解锁"
  - 逐题模式（per_question）→ 答完一题立即显示
- `PaceIndicator.tsx`：当前节奏指示（顶部 chip）
- 测试（含整组模式严格闭卷 invariant）

⚠️ 关键：前端必须严格遵守闭卷规则。后端会双重校验 view-solution 端点；但前端不能依赖后端来禁止 UI 显示——必须主动隐藏。

行数 ~240。

**估算**：1,400 行 / 5 PR
**依赖**：F9 / F10
**验收**：整组模式严格闭卷 visual snapshot 通过；逐题模式答完立即看解析；笔记保存后 Tab 4 可见。

---

## 9. WU-F16 · 申论答题 view + 异步批改流程

**目标**：申论 UI shell + 异步批改 + 范文展示。

### 9.1 文件清单

```
apps/web/src/components/practice/session/essay/EssayShell.tsx                ← 申论答题主壳
apps/web/src/components/practice/session/essay/MaterialReader.tsx            ← 材料阅读面板
apps/web/src/components/practice/session/essay/EssayInput.tsx                ← 大文本 + 字数统计
apps/web/src/components/practice/session/essay/EssaySubmitDialog.tsx         ← 提交确认 + 触发批改
apps/web/src/views/EssayGradingResult.tsx                                    ← 批改结果详情页
apps/web/src/components/practice/essay/GradingStatusBanner.tsx               ← pending/graded banner
apps/web/src/components/practice/essay/GradingDimensions.tsx                 ← 评分维度
apps/web/src/components/practice/essay/ReferenceAnswerList.tsx
apps/web/src/components/practice/essay/ReferenceAnswerCard.tsx               ← 含点赞/收藏/举报
```

### 9.2 PR 拆分

#### F16.1 EssayShell + MaterialReader + EssayInput

文件：
- `EssayShell.tsx`：左材料 / 右输入 双栏布局（响应式）
- `MaterialReader.tsx`：材料阅读 + 标记 + 滚动同步
- `EssayInput.tsx`：textarea + 字数实时统计 + 自动保存草稿（CLP-6：30s 间隔调 `useUpsertEssayDraft(sessionId)` → `PUT /api/v2/practice/essay/sessions/:id/draft`）
- 测试（含 30s 自动保存 + 离线缓冲 + submit 时草稿归档可见）

⚠️ 此处可参考现有 `views/ShenlunSession/` 已有的 MaterialPane / TypedEditor 等，但代码已被 V2 重构边缘化，建议**完全重写**而非渐进改造。

行数 ~400。

#### F16.2 EssaySubmitDialog + 异步批改触发（CLP-1：仅依赖 session.submit）

文件：
- `EssaySubmitDialog.tsx`：提交确认（字数低于阈值时警告）
- **CLP-1**：调 `useSubmitSession(sessionId)`（已含申论草稿归档 + 隐式触发批改 hook）；**不**单独调 `useTriggerGrading`
- 跳转 `/practice/sessions/:id/result` 进入 pending 状态 → polling `useGradingStatus`
- `useTriggerGrading` 仅在 result 页 `status=failed` 时显式调用作为重试入口
- 测试

行数 ~280。

#### F16.3 GradingStatusBanner + 轮询逻辑

文件：
- `GradingStatusBanner.tsx`：批改状态 banner
  - pending: "AI 正在批改中..." + 进度提示 + aria-live="polite"
  - graded: 隐藏（直接展示 GradingDimensions）
  - failed: "批改失败" + 重试按钮
- `useGradingStatus` 轮询：3s / 5s / 10s 退避；30s 后停止轮询提示用户刷新
- 测试

行数 ~340。

#### F16.4 GradingDimensions + 批改详情展示

文件：
- `GradingDimensions.tsx`：分维度评分（立意 / 论据 / 结构 / 语言 / 字数）
- 总分卡 + 雷达图（recharts，懒加载）
- 答案中的"亮点 / 问题"原文标注（基于 LLM 输出的 highlights / issues）
- "改进建议"列表
- 测试

行数 ~360。

#### F16.5 ReferenceAnswerList + 点赞/收藏/举报

文件：
- `ReferenceAnswerList.tsx`：列表（按 source + quality_score 排序）
- `ReferenceAnswerCard.tsx`：单条范文（折叠 / 展开 + 三个反馈按钮）
- 反馈即时反馈（optimistic update）+ 失败回滚
- 测试

行数 ~420。

**估算**：1,800 行 / 5 PR
**依赖**：F9
**验收**：申论提交 → 立即看到 result 页 pending → 批改完成自动刷新 → 范文交互闭环。

---

## 10. WU-F17 · PracticeCenter 整合 + 老 view 删除

**目标**：拼整 PracticeCenter，删除 V2 重构期遗留的老 view。

### 10.1 PR 拆分

#### F17.1 PracticeCenter 最终整合

文件：
- `apps/web/src/views/PracticeCenter.tsx` 最终编排（Section A + B + C + ErrorBoundary）
- 路由表更新：`router/index.tsx` 加新路由
- 测试

行数 ~280。

#### F17.2 删除老 view 第一批（独立 view）

文件删除（连带测试）：
- `views/CustomPracticeStart.tsx`
- `views/EssaySpecialty.tsx`
- `views/EssayPapers.tsx`
- `views/Papers.tsx`
- `views/CategoryTree.tsx`
- `views/EssayPaperDetail.tsx`
- `views/ConversationsHistory.tsx`
- `views/ExamCalendar.tsx`

新增 redirect（兼容旧链接）：
- `/categories` → `/practice` (segment=xingce, 一级 categories 视图)
- `/papers` → `/practice` (segment=xingce, papers 视图)
- `/essay/specialty` → `/practice` (segment=essay, categories)
- `/essay/papers` → `/practice` (segment=essay, papers)
- `/exam-calendar` → `/`（已废弃）
- `/conversations` → `/`（已废弃）

行数 ~250（删除多于新增）。

#### F17.3 删除老 view 第二批（申论旧 view）

文件删除：
- `views/EssayExamSikao.tsx`
- `views/EssayExamResults.tsx`
- `views/EssayHistory.tsx`
- `views/EssaySpecialtyExamSikao.tsx`

redirect:
- `/essay/exam/:paperCode` → `/practice/sessions/:id`（最近 active session）
- `/essay/grading/:recordId` → `/practice/sessions/:id/grading`
- `/essay/history` → `/profile/records`（继承 Phase-Home 决策）

行数 ~200。

#### F17.4 ShenlunSession 重构对接 EssayShell

文件：
- `views/ShenlunSession/` 设备适配 shell 保留（desktopFallback / tabletLandscapeShell / tabletPortraitShell）
- 内部 MaterialPane / TypedEditor 等替换为 `components/practice/session/essay/*`（F16 已建）
- 旧 HandwriteEditor / OcrPanel / OutlineAside / TopBar 全部删除（手写 OCR 不在本 Phase 范围）
- 测试

行数 ~470。

**估算**：1,200 行（净，含删除）/ 4 PR
**依赖**：F11-F16 完成
**验收**：练习 tab 完整可用；老路由 redirect 正确；ShenlunSession 仅保留设备适配 shell。

---

## 11. WU-F18 · E2E + MSW + a11y test

**目标**：练习 tab 完工签收。

### 11.1 PR 拆分

#### F18.1 PracticeCenter 整体测试 + segment + Section A

文件：
- `views/__tests__/PracticeCenter.test.tsx`：
  - 段切换（行测 ↔ 申论）
  - Section A 二级分类钻取
  - PercentileBadge 渲染
- a11y test（axe-core）

行数 ~360。

#### F18.2 Section B + Section C + 自定义刷题 e2e

文件：
- 测试：
  - Section B 专项练习 → 进 session → 答题 → 结果
  - Section C 套卷 + filter → 进 session
  - 自定义刷题 真题路径
  - 自定义刷题 AI 出题路径（mock 三段退化）
- a11y（双滑块键盘可达）

行数 ~400。

#### F18.3 AI 出题 + 答题节奏 + 答题中操作 e2e

文件：
- AI 出题等待 → 成功路径
- AI 出题等待 → 失败路径（503 切真题）
- AI 出题等待 → 限流路径（429 提示）
- 答题中收藏 + 标记 + 加笔记（含笔记 Tab 4 可见性验证）
- 整组模式严格闭卷验证（前端 UI + 后端 403 响应双重）
- a11y（aria-live 公布）

行数 ~360。

#### F18.4 申论批改 + 范文 + 每日一练 e2e

文件：
- 申论提交 → 异步批改 banner → 批改完成 → 范文展示 + 点赞
- 申论批改失败 → 重试
- 每日一练 → 进 session → 完成 → status 转 completed
- a11y（pending banner aria-live）

行数 ~380。

**估算**：1,500 行 / 4 PR
**依赖**：F17
**验收**：CI 全绿；vitest --run 全部通过；axe-core 0 violation；bundle 预算未超。

---

## 12. 引用矩阵

| WU | 决策依据 | 边界规则 | 数据契约 | 测试 |
|---|---|---|---|---|
| F9 | 全部 Tab 2 endpoints | - | §6 OpenAPI types | F18 e2e |
| F10 | Cust-* / D-Q5 | - | §6.1 / §6.5 | unit test |
| F11 | Q2 / Q6 / D-Q3 / Stat-* | - | §3.1 stats response | F18.1 |
| F12 | Q1 + Cust-* category 模式 | - | session.create body | F18.2 |
| F13 | Stat-2 + Cust-Year/Region | - | papers filter | F18.2 |
| F14 | Cust-* / D-Q10 | Pace-* | session.create / ai-questions | F18.2 / F18.3 |
| F15 | D-Q12 基础+拓展 / D-Q15 / D-Q5 | Pace-Closed-Book / Flag-* / Note-* | answer flag / view-solution | F18.3 |
| F16 | Q4 / D-Q4 / D-Q16 / Essay-* | PR8 / Essay-Reference | grading-status / reference list | F18.4 |
| F17 | D7 脱壳 + Phase-Home D1 | - | 路由表 | F18.* |
| F18 | 全部 invariant | 全部 | - | - |

---

## 13. 与 Phase-Home WU 的依赖

```
Phase-Home WU-F1 (api-client + queries 基础)  ─→ Tab 2 WU-F9 (扩展 + 新建 9 query 文件)
Phase-Home WU-F3 (calendar-engine)           ─→ Tab 2 WU-F11 (用 calendar-engine 显示首页"继续上次"，已由 Phase-Home 处理)
Phase-Home WU-F7 (AppShell 5 tab + 老 view 清理) ─→ Tab 2 WU-F17 (本 Phase 仅清理练习相关 11 个 view + ShenlunSession)
Phase-Home WU-F8 (e2e + MSW 基础)            ─→ Tab 2 WU-F18 (扩展 MSW handlers + 新增 e2e)
```

⚠️ Phase-Home WU-F7 已经完成大部分老 view 清理工作，Tab 2 仅清理练习相关。

---

## 14. 进度跟踪与 PR review checklist

每个 PR description 必须包含：
- [ ] 决策依据（00-Decisions 对应条目）
- [ ] 边界规则（01-Boundary-Rules 对应条目）
- [ ] 数据契约（02-Data-Model + OpenAPI types）
- [ ] 测试覆盖（unit + integration + invariant + a11y）
- [ ] A0 acknowledge（如适用）
- [ ] AGENTS-H9（≤15 文件 / ≤400 行）

CI 必跑：
- typecheck (tsc --strict)
- lint:* (9 个脚本)
- vitest --run
- axe-core
- bundle size check
- a11y smoke
