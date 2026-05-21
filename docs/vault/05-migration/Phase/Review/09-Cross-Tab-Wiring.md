# Phase-Review · 09 · Cross-Tab Wiring

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §10（Cross-1 ~ Cross-8）· [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) §6

---

## 1. 数据流全览

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            WRITE FLOWS                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Practice Tab                         Review Tab                           │
│  ─────────────                        ──────────                           │
│  session.commit()                     POST /review/items                   │
│    ├─ 答错 ─────────────────────────▶ ReviewItemV2(wrong_answer)          │
│    └─ 持久标记 ─────────────────────▶ ReviewItemV2(flagged_persistent)    │
│                                                                            │
│  Review Tab (WU-R4 hook)                                                   │
│  ────────────────────────                                                  │
│  session.commit() 检测 graduated 后答错                                     │
│    └─────────────────────────────────▶ ReviewItemV2(re_failed) [新行]      │
│                                                                            │
│  Review Tab (手动)                                                          │
│  ────────────────                                                          │
│    └─ 用户加入 ─────────────────────▶ ReviewItemV2(manual_add)            │
│                                                                            │
│  Notes Tab (Phase-Notes 实施)                                               │
│  ─────────────────────────                                                 │
│    └─ AI 摘要拆卡 ─────────────────▶ ReviewItemV2(note_card) [预留]       │
│                                                                            │
│  Review Tab → Notes Tab                                                    │
│  ──────────────────────                                                    │
│  "保存为笔记" ──────────────────────▶ NoteV2(type=ai_cause_analysis)      │
│  "生成周回顾" ──────────────────────▶ NoteV2(type=weekly_review)          │
│                                                                            │
│  Review Tab → Home Tab                                                     │
│  ─────────────────────                                                     │
│  SRS graduated ─────────────────────▶ WeaknessSnapshotV2.contributions    │
│  "加入计划" ────────────────────────▶ RecommendationV2(type=review_session)│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                            READ FLOWS                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Review Tab reads from:                                                    │
│  ─────────────────────                                                     │
│  QuestionV2 ◀─── 题面 / 选项 / 解析 / category                            │
│  PracticeSessionV2 ◀─── 重做 session 创建                                  │
│  PracticeSessionAnswerV2 ◀─── 三卡聚合 + 答题历史                          │
│  NoteV2 ◀─── 题级笔记展示 + 周回顾数据                                     │
│  QuestionFavoriteV2 ◀─── Q-Hub 收藏状态                                    │
│  QuestionFlagV2 ◀─── Q-Hub 标记状态                                        │
│                                                                            │
│  Home Tab reads from Review:                                               │
│  ───────────────────────────                                               │
│  ReviewItemV2 ◀─── today list "今日复盘 N 题"                              │
│  WeaknessSnapshotV2 ◀─── 弱项卡 contributions.review                      │
│  RecommendationV2(type=review_session) ◀─── 推荐接受后建 session           │
│                                                                            │
│  Practice Tab reads from Review:                                           │
│  ────────────────────────────────                                          │
│  ReviewItemV2 ◀─── session 结果页"已加入复盘"徽标                          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 写入流表

| # | 写入方 | 写入目标 | 触发条件 | 自动/手动 | 实施 Phase |
|---|---|---|---|---|---|
| W1 | Practice session.commit | ReviewItemV2(wrong_answer) | 答错 | 自动 | Phase-Practice WU-B15 |
| W2 | Practice session.commit | ReviewItemV2(flagged_persistent) | 持久标记 | 自动 | Phase-Practice WU-B16 |
| W3 | Review session.commit hook | ReviewItemV2(re_failed) | graduated 后答错 | 自动 | **本 Phase WU-R4** |
| W4 | Review POST /items | ReviewItemV2(manual_add) | 用户点"加入复盘" | 手动 | **本 Phase WU-R2** |
| W5 | Notes AI 摘要 | ReviewItemV2(note_card) | AI 摘要拆出卡片 | 自动 | Phase-Notes（预留） |
| W6 | Review cause-analysis | NoteV2(type=ai_cause_analysis) | 用户点"保存为笔记" | 手动 | **本 Phase WU-R5** |
| W7 | Review weekly-review | NoteV2(type=weekly_review) | 用户点"生成回顾笔记" | 手动 | **本 Phase WU-R7** |
| W8 | Review add-to-plan | RecommendationV2(type=review_session) | 用户点"加入计划" | 手动 | **本 Phase WU-R10** |

---

## 3. 读取流表

| # | 读取方 | 数据源 | 用途 | 接口 |
|---|---|---|---|---|
| R1 | Review → Question | QuestionV2 | 题面 / 选项 / 解析 / category | JOIN on review_items_v2.question_id |
| R2 | Review → Practice | PracticeSessionAnswerV2 | 三卡聚合 + 答题历史 | GET /api/v2/practice/answers?user_id&limit=200 |
| R3 | Review → Notes | NoteV2 | 题级笔记展示 | GET /api/v2/notes?linked_question_id=:id |
| R4 | Home → Review | ReviewItemV2 | today list 复盘条目数 | GET /api/v2/review/items?status=pending,in_progress&next_review_at_lte=today_end |
| R5 | Home → Review | WeaknessSnapshotV2 | 弱项卡贡献维度 | SELECT ... WHERE snapshot includes review contributions |
| R6 | Practice result → Review | ReviewItemV2 | "已加入复盘" 徽标 | GET /api/v2/review/items?question_id=:id&status=pending,in_progress |

---

## 4. 反向流表（Review 输出被其他 Tab 消费）

| # | 信号 | 消费方 | 触发 | 格式 |
|---|---|---|---|---|
| RF1 | 新 graduated | Home today list | 实时（同事务） | ReviewItemV2.status = graduated → Home today list 该条目打勾 |
| RF2 | due 题数变化 | Home 卡片 | 前端 polling / staleTime refresh | count of items WHERE next_review_at <= today_end |
| RF3 | WeaknessSnapshot 更新 | Home 弱项卡 | WU-R7 cron 更新 contributions | WeaknessSnapshotV2.contributions.review |
| RF4 | RecommendationV2 创建 | Home 推荐列表 | 实时 | type=review_session, status=pending |
| RF5 | NoteV2 创建 | Notes 列表 | 实时 | type IN (ai_cause_analysis, weekly_review) |

---

## 5. 接口契约

### 5.1 Review 暴露给其他 Tab 的 API 端点

| 端点 | 消费方 | 用途 |
|---|---|---|
| `GET /api/v2/review/items?question_id=:id&status=pending,in_progress` | Practice result / Q-Hub | 检查"该题是否在复盘中" |
| `GET /api/v2/review/items?next_review_at_lte=:date&status=pending,in_progress` | Home today | 今日 due 条目 |
| `GET /api/v2/review/items?status=graduated&limit=5&sort=-graduated_at` | Home achievement | 最近毕业题 |

### 5.2 Review 消费其他 Tab 的 API 端点

| 端点 | 提供方 | 用途 |
|---|---|---|
| `GET /api/v2/questions/:id` | Practice/Question | 题面 + 解析 |
| `GET /api/v2/practice/answers?user_id=:id&limit=200` | Practice | 三卡聚合数据 |
| `POST /api/v2/practice/sessions` | Practice | 创建 redo session |
| `GET /api/v2/notes?linked_question_id=:id` | Notes | 题级笔记 |
| `POST /api/v2/notes` | Notes | 保存为笔记 |
| `POST /api/v2/recommendations` | Home | 创建"加入计划" |

### 5.3 前端 Store Selectors（跨 domain 消费）

```typescript
// packages/domain/src/review/ 暴露给其他 domain 的 selector
export function useIsQuestionInReview(questionId: number): boolean;
export function useTodayDueCount(): number;
export function useRecentGraduated(limit?: number): ReviewItemResponseV2[];

// packages/domain/src/practice/ 暴露给 review 的 selector
export function useRecentAnswers(limit?: number): PracticeSessionAnswerV2[];

// packages/domain/src/notes/ 暴露给 review 的 selector
export function useQuestionNotes(questionId: number): NoteV2[];
```

---

## 6. 时序保证

| 流向 | 保证级别 | 机制 |
|---|---|---|
| Practice → Review (W1/W2) | **同事务** | session.commit 在同一 DB transaction 内写 ReviewItemV2 |
| Review → Review (W3 re_failed) | **同事务** | session.commit hook 在同一 transaction |
| Review → Notes (W6/W7) | **同事务** | API handler 内同一 transaction |
| Review → Home (W8 recommendation) | **同事务** | API handler 内同一 transaction |
| Home ← Review (RF2 due count) | **最终一致** | 前端 staleTime=30s（polling / refetch on focus） |
| Home ← Review (RF3 weakness) | **最终一致** | cron 每周一 02:00 更新 |

---

## 7. 错误隔离

| 原则 | 实现 |
|---|---|
| **一个 Tab 写入失败不影响其他 Tab** | 每个 write flow 独立 try/catch；失败时仅本 Tab 展示 error |
| **跨 Tab 读取失败降级** | Review 读 Practice answers 失败 → 三卡不展示（不影响 SRS 队列）|
| **LLM 失败不阻塞** | PR-R6：错因区块独立 error boundary |
| **Cron 失败不影响实时** | RF3 cron 失败 → Home 弱项卡显示上次快照（不清空） |
| **前端 hook 异常** | 每个 domain hook 独立 error state；一个 hook 报错不 crash 整页 |

### 7.1 具体降级策略

```
Practice answers 加载失败:
  → useSmartReviewCards 返回 { cards: [], isEmpty: true }
  → SRS 队列正常渲染

Notes 加载失败:
  → Q-Hub 笔记区块显示"加载失败，点击重试"
  → 其他区块不受影响

Review items 加载失败:
  → Home today list 显示"复盘数据加载中..."
  → 不影响 Home 其他卡片

RecommendationV2 创建失败:
  → toast "加入计划失败，请重试"
  → ReviewItemV2 状态不变（不做任何回滚）
```

---

## 8. 数据一致性边界

| 场景 | 处理 |
|---|---|
| 用户在 Practice 答错，同时在 Review 查看同题 | Practice commit → 新 ReviewItemV2 行；Review 前端下次 refetch 可见 |
| 用户在 Review graduated，同时 Practice 出了该题 | Practice 出题不检查 graduated 状态（不互斥）；答错触发 re_failed |
| 用户在 Q-Hub "加入复盘"，该题已有 active 行 | API 返回 409；前端 toast "该题已在复盘队列中" |
| cron 与用户操作并发 | cron 写 metadata_json；用户操作写 status/streak；不同字段不冲突 |

---

## 引用矩阵

| 本文被引用 |
|---|
| [03-Backend-WU](./03-Backend-WU.md) WU-R4 / WU-R10 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR7 / WU-FR11 |
| [08-Question-Hub-Page](./08-Question-Hub-Page.md) ctx 跨 tab 导航 |
| [11-Testing](./11-Testing.md) 跨 tab 集成测试 |
