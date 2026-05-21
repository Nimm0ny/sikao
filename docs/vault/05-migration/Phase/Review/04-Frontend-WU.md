# Phase-Review · 04 · Frontend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) · [02-Data-Model](./02-Data-Model.md) §7（Pydantic → TS types）

---

## 概述

12 个前端 Work Unit（WU-FR1 ~ WU-FR12），按依赖顺序排列。每 WU 对应 1 个 PR（AGENTS H9: ≤15 文件 / ≤400 行）。

前端启动前置：后端 WU-R1 ~ WU-R11 全部完工（OpenAPI spec 稳定后才生成 types）。

---

## WU-FR1 · API Client Types + Queries

**描述**：从 OpenAPI spec 生成 TypeScript 类型；新建 reviewQueries.ts + causeAnalysisQueries.ts。

| 组件/文件 | 变更 |
|---|---|
| `packages/api-client/src/generated/review.ts` | 自动生成 types |
| `packages/api-client/src/queries/reviewQueries.ts` | TanStack Query hooks：useReviewItems / useReviewItem / useCreateReviewItem / useGraduateItem / useArchiveItem / useRestoreItem / useBatchAction |
| `packages/api-client/src/queries/causeAnalysisQueries.ts` | useCauseAnalysis / useGroupCauseAnalysis |
| `packages/api-client/src/queries/weeklyReviewQueries.ts` | useWeeklySummary |
| `apps/web/scripts/generate-types.mjs` | 追加 review 模块配置 |

| 预计行数 | ~300 |
|---|---|
| **依赖** | 后端 WU-R11（OpenAPI spec 稳定） |
| **测试要求** | TypeScript strict 编译通过；query key 唯一性 lint 通过 |

---

## WU-FR2 · Domain Stores

**描述**：新建 `packages/domain/src/review/` 目录，10 个 hooks（A0 §3.3 清单）。

| 组件/文件 | 职责 |
|---|---|
| `packages/domain/src/review/useReviewItems.ts` | 列表（支持筛选 / 排序 / 多选状态） |
| `packages/domain/src/review/useReviewItem.ts` | 单条详情 |
| `packages/domain/src/review/useReviewToday.ts` | SRS 今日队列 + 三卡输入数据 fetcher |
| `packages/domain/src/review/useSmartReviewCards.ts` | 三卡 S-front 聚合（依赖 useReviewItems + useRecentAnswers） |
| `packages/domain/src/review/useRecentAnswers.ts` | 最近 N=200 PracticeSessionAnswerV2 |
| `packages/domain/src/review/useCauseAnalysis.ts` | 单题错因状态管理 |
| `packages/domain/src/review/useGroupCauseAnalysis.ts` | 聚合错因状态管理 |
| `packages/domain/src/review/useWeeklyReview.ts` | 周回顾数据（实时聚合） |
| `packages/domain/src/review/useReviewInsights.ts` | 3 张图数据 |
| `packages/domain/src/review/useQuestionHub.ts` | 题目中枢页（含 ctx 解析） |
| `packages/domain/src/review/index.ts` | barrel export |

| 预计行数 | ~400 |
|---|---|
| **依赖** | WU-FR1 |
| **测试要求** | 每个 hook 有对应 vitest 单测（renderHook + MSW mock） |

---

## WU-FR3 · ReviewToday View

**描述**：默认 `/review` 视图 = 周回顾条 + SRS 今日队列 + 三卡容器。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/views/ReviewToday.tsx` | 页面容器 |
| `apps/web/src/components/review/WeeklyBar.tsx` | 周回顾摘要条（本周 N 道 · 正确率 X% · 笔记 Y 条） |
| `apps/web/src/components/review/SrsQueue.tsx` | 今日 due 列表（next_review_at <= today_end） |
| `apps/web/src/components/review/SmartCardsContainer.tsx` | 三卡布局容器 |
| `apps/web/src/components/review/EmptyReview.tsx` | 空状态 |

| 预计行数 | ~350 |
|---|---|
| **依赖** | WU-FR2 |
| **测试要求** | RTL 单测：有数据渲染 / 无数据空状态 / 周回顾条数字正确 |

---

## WU-FR4 · Smart Cards S-front Aggregation

**描述**：实现 useSmartReviewCards 的三卡聚合算法（纯前端计算）。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/components/review/SmartCardA.tsx` | 高频错点卡 |
| `apps/web/src/components/review/SmartCardB.tsx` | 长期未碰卡 |
| `apps/web/src/components/review/SmartCardC.tsx` | 预测再错卡 |
| `packages/domain/src/review/useSmartReviewCards.ts` | 聚合算法实现（依赖 useReviewItems + useRecentAnswers） |
| `packages/domain/src/review/__tests__/useSmartReviewCards.test.ts` | 算法单测（12 边界场景） |

| 预计行数 | ~380 |
|---|---|
| **依赖** | WU-FR2, WU-FR3 |
| **测试要求** | 算法 12 边界场景全覆盖（见 [07-Smart-Review-Aggregation](./07-Smart-Review-Aggregation.md)） |

---

## WU-FR5 · ReviewAll View

**描述**：`/review/all` — 4 segments（错题/标记/手动/智能）+ 筛选 + 排序 + 批量操作。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/views/ReviewAll.tsx` | 页面容器 |
| `apps/web/src/components/review/AllSegments.tsx` | 4 segment tabs |
| `apps/web/src/components/review/AllFilters.tsx` | 筛选面板（source_kind / 题型 / 题源 / 时间窗 / SRS 档位） |
| `apps/web/src/components/review/AllList.tsx` | 列表（复用 WrongQuestionList 迁移） |
| `apps/web/src/components/review/ItemCard.tsx` | 单题卡片（SRS 徽标 + source_kind 角标） |
| `apps/web/src/components/review/BatchBar.tsx` | 多选批量操作条 |
| `apps/web/src/components/review/GraduatedToggle.tsx` | "显示已掌握" toggle |

| 预计行数 | ~400 |
|---|---|
| **依赖** | WU-FR2 |
| **测试要求** | RTL：segment 切换 / 筛选 / 排序 / 批量选中 + 操作 / 空状态 |

---

## WU-FR6 · ReviewInsights View

**描述**：`/review/insights` — 3 张 recharts 图表（lazy-loaded）。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/views/ReviewInsights.tsx` | 页面容器 |
| `apps/web/src/components/review/TrendsChart.tsx` | 错题趋势线（90d） |
| `apps/web/src/components/review/CausesChart.tsx` | 错因聚类条形图 |
| `apps/web/src/components/review/RedoAccuracyChart.tsx` | 再做正确率曲线 |

| 预计行数 | ~280 |
|---|---|
| **依赖** | WU-FR2, Phase-Home recharts 配置 |
| **测试要求** | RTL：图表容器渲染 / 无数据 EmptyChartPlaceholder / lazy load chunk 加载 |

---

## WU-FR7 · QuestionHub View

**描述**：`/q/:id` 题目中枢页 — ctx 参数解析、布局、全部操作按钮。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/views/QuestionHub.tsx` | 页面容器 + ctx 路由参数解析 |
| `apps/web/src/components/q-hub/QuestionBody.tsx` | 题面 + 选项展示 |
| `apps/web/src/components/q-hub/AnswerTimeline.tsx` | 答题历史时间线 |
| `apps/web/src/components/q-hub/CorrectAnswer.tsx` | 正确答案 + 解析 |
| `apps/web/src/components/q-hub/CauseCard.tsx` | AI 错因卡（懒加载） |
| `apps/web/src/components/q-hub/NotesSection.tsx` | 题级笔记区 |
| `apps/web/src/components/q-hub/ActionBar.tsx` | 操作按钮组 |
| `apps/web/src/components/q-hub/Section.tsx` | 折叠段落组件（迁移自 WrongDetailSection） |
| `apps/web/src/components/q-hub/RelatedNotesHint.tsx` | 关联笔记提示条 |

| 预计行数 | ~400 |
|---|---|
| **依赖** | WU-FR2 |
| **测试要求** | RTL：5 种 ctx 切换 / 操作按钮可用性 / 无笔记隐藏区块 / 响应式布局 |

---

## WU-FR8 · QuestionRedo View

**描述**：`/q/:id/redo` — 脱壳，创建 PracticeSessionV2(source_mode=wrong_redo, shuffle_options=true) + 费曼复述。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/views/QuestionRedo.tsx` | 脱壳容器 + session 创建逻辑 |
| `apps/web/src/components/review/FeynmanRecall.tsx` | 费曼复述输入框（答完后可填可跳） |
| `apps/web/src/components/review/RedoFeedback.tsx` | "第 N 次重做，X 对 Y 错" 反馈 |

| 预计行数 | ~250 |
|---|---|
| **依赖** | WU-FR2, Phase-Practice session 组件 |
| **测试要求** | RTL：session 创建参数正确(source_mode/shuffle) / 费曼填写触发 SRS 加成 / 跳过不报错 |

---

## WU-FR9 · CauseAnalysis UI

**描述**：单题 + 多题聚合错因分析 UI（loading / error / success 状态 + 保存为笔记 + 反馈）。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/components/review/CauseAnalysisSingle.tsx` | 单题错因面板 |
| `apps/web/src/components/review/CauseAnalysisGroup.tsx` | 多题聚合错因面板 |
| `apps/web/src/components/review/CauseAnalysisResult.tsx` | 结果展示（dimensions + actions） |
| `apps/web/src/components/review/CauseAnalysisFeedback.tsx` | 👍/👎 反馈 |
| `apps/web/src/components/review/SaveAsNoteButton.tsx` | 保存为笔记 CTA |

| 预计行数 | ~320 |
|---|---|
| **依赖** | WU-FR2, WU-FR7 |
| **测试要求** | RTL：loading skeleton / error 兜底文案(PR-R6) / 成功展示 / 反馈提交 / 保存为笔记 |

---

## WU-FR10 · Weekly Review UI

**描述**：周回顾顶部条组件 + "生成本周回顾笔记" CTA。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/components/review/WeeklyBar.tsx` | 已在 WU-FR3 创建，此 WU 完善交互 |
| `apps/web/src/components/review/WeeklyGenerateNote.tsx` | "生成回顾笔记" 按钮 + loading + 跳转 |
| `packages/domain/src/review/useWeeklyReview.ts` | 已在 WU-FR2 创建，此 WU 补充 generate 逻辑 |

| 预计行数 | ~150 |
|---|---|
| **依赖** | WU-FR3 |
| **测试要求** | RTL：生成笔记 loading / 成功跳转 / 失败 toast |

---

## WU-FR11 · Route Migration

**描述**：路由 redirect map + review-route-bridge.ts + legacy wrong-book 组件/目录清理。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/router/index.tsx` | 追加 /q/:id 路由 + /q/:id/redo 脱壳 + redirect rules |
| `apps/web/src/lib/review-route-bridge.ts` | /wrong-book/:qid → /q/:qid?ctx=review&review_id={lookup} helper |
| `apps/web/src/components/wrong-book/` | **整目录删除**（11 个组件） |
| `apps/web/src/views/WrongBook.tsx` | **删除** |
| `apps/web/src/views/WrongQuestionDetailView.tsx` | **删除** |
| `apps/web/src/views/WrongQuestionRedoView.tsx` | **删除** |
| `apps/web/src/views/SmartReviewView.tsx` | **删除** |
| `packages/domain/src/wrong-book/` | **整目录删除** |
| `packages/api-client/src/queries/wrongBookQueries.ts` | **删除** |

**Redirect 规则（6 条）**：

| 旧路由 | 新路由 | 方式 |
|---|---|---|
| `/wrong-book` | `/review` | 永久 redirect |
| `/wrong-book/smart-review` | `/review` | 永久 redirect |
| `/wrong-book/:questionId` | `/q/:questionId?ctx=review&review_id={lookup}` | bridge helper |
| `/wrong-book/:questionId/redo` | `/q/:questionId/redo?ctx=review&review_id={lookup}` | bridge helper |
| `/practice/questions/:id` | `/q/:id?ctx=practice` | 永久 redirect |
| `/review/items/:id` | `/q/:id?ctx=review&review_id={lookup}` | bridge helper |

| 预计行数 | ~250（含删除行） |
|---|---|
| **依赖** | WU-FR3 ~ WU-FR9 全部完成 |
| **测试要求** | vitest：6 条 redirect 全覆盖 / bridge helper 查询逻辑 / 404 fallback |

---

## WU-FR12 · E2E + A11y

**描述**：端到端测试 + axe-core 无障碍检测 + 跨 ctx 导航 + redirect 覆盖。

| 组件/文件 | 职责 |
|---|---|
| `apps/web/src/__tests__/e2e/review-happy-path.test.tsx` | 默认视图 → 详情 → 重做 → graduated 全流程 |
| `apps/web/src/__tests__/e2e/review-redirects.test.tsx` | 6 条旧路由 redirect |
| `apps/web/src/__tests__/e2e/review-cross-ctx.test.tsx` | 5 种 ctx 切换导航 |
| `apps/web/src/__tests__/a11y/review-a11y.test.tsx` | axe-core 扫描全部 review 视图 |
| `packages/domain/src/review/__tests__/useSmartReviewCards.test.ts` | 三卡算法 12 场景 |

| 预计行数 | ~400 |
|---|---|
| **依赖** | WU-FR1 ~ WU-FR11 全部完成 |
| **测试要求** | vitest --run 全绿 / axe-core 0 violations / 桌面+移动 viewport |

---

## 依赖图

```
WU-FR1 ─→ WU-FR2 ──┐
        ├─→ WU-FR3 ┼─→ WU-FR4 ─→ WU-FR5 ──┐
        ├─→ WU-FR8 ┘                       ├─→ WU-FR10 ─→ WU-FR11 ─→ WU-FR12
        └─→ WU-FR6 / FR7 / FR9 ────────────┘
```

---

## 引用矩阵

| 本文被引用 |
|---|
| [README.md](./README.md) §6 依赖图 |
| [07-Smart-Review-Aggregation](./07-Smart-Review-Aggregation.md) WU-FR4 实施参考 |
| [08-Question-Hub-Page](./08-Question-Hub-Page.md) WU-FR7 实施参考 |
| [11-Testing](./11-Testing.md) 前端测试清单 |
