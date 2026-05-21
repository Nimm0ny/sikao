# Phase-Review · 08 · Question Hub Page

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §9（QHub-1 ~ QHub-7）· [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) §8

---

## 1. 路由定义

```
/q/:id           — 题目中枢页（不脱壳，保留 RailMini / TabBar）
/q/:id/redo      — 重做页（脱壳，全屏 session）
```

- `/q/:id` 是**顶层路由**，不在 AppShell children 内（QHub-1）
- 但不属于"脱壳路由"——仍渲染 RailMini（桌面）/ TabBar（移动）
- `/q/:id/redo` 是脱壳路由（D15，与 Practice session 一致）

在 `apps/web/src/router/index.tsx` 中：

```tsx
// 顶层路由（保留 shell 但不在 tab children 内）
{ path: "/q/:id", element: <QuestionHub /> },

// 脱壳路由
{ path: "/q/:id/redo", element: <QuestionRedo /> },
```

---

## 2. URL 参数

| 参数 | 说明 | 值 |
|---|---|---|
| `:id` | QuestionV2.id | 必填 |
| `?ctx` | 来源上下文 | `practice` \| `review` \| `note` \| `favorite` \| `home` |
| `&review_id` | ReviewItemV2.id | ctx=review 时必填 |
| `&session_id` | PracticeSessionV2.id | ctx=practice 时可选（用于高亮历史） |
| `&note_id` | NoteV2.id | ctx=note 时可选（用于高亮关联笔记） |

### 2.1 ctx 参数解析逻辑

```typescript
// packages/domain/src/review/useQuestionHub.ts
function parseQuestionHubContext(searchParams: URLSearchParams): QuestionHubContext {
  const ctx = searchParams.get('ctx') ?? 'review';  // 默认 review
  return {
    source: ctx as ContextSource,
    reviewId: searchParams.get('review_id') ? Number(searchParams.get('review_id')) : null,
    sessionId: searchParams.get('session_id') ? Number(searchParams.get('session_id')) : null,
    noteId: searchParams.get('note_id') ? Number(searchParams.get('note_id')) : null,
  };
}
```

---

## 3. 布局规格

### 3.1 移动端（< 768px）

```
┌──────────────────────────────┐
│ TabBar (fixed bottom)        │
├──────────────────────────────┤
│ ← 返回 {ctx_label}  ⋯ 更多  │  ← 顶部导航
├──────────────────────────────┤
│ [关联笔记提示条]              │  ← 有笔记时显示
├──────────────────────────────┤
│ 题面                          │
│ 选项 A/B/C/D                 │
├──────────────────────────────┤
│ ▼ 我的答题历史 (折叠)         │
├──────────────────────────────┤
│ ▼ 正确答案 + 解析 (折叠)      │
├──────────────────────────────┤
│ ▼ AI 错因分析 (懒加载)        │
├──────────────────────────────┤
│ ▼ 题级笔记 (折叠)            │
├──────────────────────────────┤
│ [操作按钮组 — 固定底部浮层]    │
└──────────────────────────────┘
```

### 3.2 桌面端（≥ 768px）

```
┌─────────┬────────────────────────────────────┬────────────────────┐
│ RailMini│  ← 返回 {ctx_label}               │                    │
│         ├────────────────────────────────────┤    侧栏 (320px)    │
│         │                                    │                    │
│         │  题面                               │  题级笔记          │
│         │  选项 A/B/C/D                      │  ──────────        │
│         │                                    │  知识点关联         │
│         │  答题历史 (展开)                    │  ──────────        │
│         │  正确答案 + 解析 (展开)             │  上/下题导航        │
│         │  AI 错因分析 (懒加载)              │                    │
│         │                                    │  [操作按钮组]       │
│         │                                    │                    │
└─────────┴────────────────────────────────────┴────────────────────┘
```

---

## 4. 内容区块

| 区块 | 组件 | 说明 |
|---|---|---|
| 题面 + 选项 | `QuestionBody.tsx` | 展示 QuestionV2.body + options；已下线题顶部 Banner（PR-R3） |
| 答题历史时间线 | `AnswerTimeline.tsx` | 全部 ReviewAttemptV2 + PracticeSessionAnswerV2 混合时间线 |
| 正确答案 + 解析 | `CorrectAnswer.tsx` | QuestionV2.correct_answer + explanation |
| AI 错因卡 | `CauseCard.tsx` | 懒加载；有缓存直接展示，无缓存显示"分析错因"按钮 |
| 题级笔记 | `NotesSection.tsx` | NoteV2(linked_question_id=:id) 列表 + "写笔记"入口 |
| 关联笔记提示 | `RelatedNotesHint.tsx` | 顶部小条"你 X 天前写过笔记 →" |

---

## 5. 操作按钮

| 按钮 | 说明 | 可见条件 |
|---|---|---|
| 去重做 | → `/q/:id/redo?ctx={ctx}&review_id={id}` | 始终可见 |
| 收藏 / 取消收藏 | 切换 QuestionFavoriteV2 | 始终可见 |
| 持久标记 / 取消标记 | 切换 QuestionFlagV2 | 始终可见 |
| 加入复盘 | POST /review/items (manual_add) | 当前无 active ReviewItemV2 时可见 |
| 加入计划 | POST /review/items/:id/add-to-plan | ctx=review 且有 review_id 时可见 |
| 已掌握 | PATCH /review/items/:id/graduate | ctx=review 且 status ∈ [pending, in_progress] |
| 归档 | PATCH /review/items/:id/archive | ctx=review 且 status ∈ [pending, in_progress, graduated] |
| 写笔记 | → NoteV2 创建（linked_question_id） | 始终可见 |
| 分析错因 | POST /review/items/:id/cause-analysis | ctx=review 且有 review_id 时可见 |

---

## 6. 上下文行为表

| ctx | 返回目标 | 高亮历史项 | 重做 source_mode | 特殊行为 |
|---|---|---|---|---|
| `practice` | `/practice/sessions/:session_id/result` | session_id 对应的答题记录 | wrong_redo | 无"加入计划"按钮 |
| `review` | `/review` | review_id 对应的最新 attempt | wrong_redo | 全部操作按钮可见 |
| `note` | `/notes/:note_id` | 无高亮 | wrong_redo | "关联笔记"高亮 |
| `favorite` | `/favorites` | 无高亮 | wrong_redo | 收藏按钮为已选中状态 |
| `home` | `/` | 无高亮 | wrong_redo | 来自弱项卡 |

---

## 7. 旧路由 Redirect Map

| 旧路由 | 新路由 | 实现方式 |
|---|---|---|
| `/wrong-book/:questionId` | `/q/:questionId?ctx=review&review_id={lookup}` | review-route-bridge.ts |
| `/wrong-book/:questionId/redo` | `/q/:questionId/redo?ctx=review&review_id={lookup}` | review-route-bridge.ts |
| `/practice/questions/:id` | `/q/:id?ctx=practice` | 永久 redirect (301) |
| `/review/items/:id` | `/q/:questionId?ctx=review&review_id=:id` | review-route-bridge.ts (需 lookup question_id) |
| `/review/items/:id/redo` | `/q/:questionId/redo?ctx=review&review_id=:id` | review-route-bridge.ts |
| `/wrong-book` | `/review` | 永久 redirect (301) |

**review-route-bridge.ts 逻辑**：

```typescript
// apps/web/src/lib/review-route-bridge.ts

export async function resolveReviewItemForQuestion(
  questionId: number
): Promise<number | null> {
  // GET /api/v2/review/items?question_id={questionId}&status=pending,in_progress&limit=1
  const res = await apiClient.get('/review/items', {
    params: { question_id: questionId, status: 'pending,in_progress', limit: 1 }
  });
  return res.data.items[0]?.id ?? null;
}
```

---

## 8. 无障碍要求

| 维度 | 要求 |
|---|---|
| 标题层级 | h1=题目标题, h2=各区块标题（答题历史/正确答案/错因/笔记） |
| Focus 管理 | ctx 切换时 focus 回到页面 h1 |
| 键盘导航 | 操作按钮组可 Tab 遍历；Enter/Space 触发 |
| ARIA | 折叠区块用 aria-expanded；错因加载用 aria-live="polite" |
| 颜色对比 | 正确答案绿色 / 错误答案红色 对比度 ≥ 4.5:1 |
| 屏幕阅读器 | 答题历史时间线每项有 aria-label 描述 outcome + 日期 |

---

## 引用矩阵

| 本文被引用 |
|---|
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR7 |
| [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) 题目中枢页跨 tab 导航 |
| [11-Testing](./11-Testing.md) Q-Hub 跨 ctx 测试 |
