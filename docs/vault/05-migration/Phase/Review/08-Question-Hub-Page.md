# Phase-Review · 08 · Question Hub Page

> **Status**: ACCEPTED (REWRITTEN)
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §9（QHub-1 ~ QHub-12）· [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) §8 · [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) · [14-Confidence-Rating](./14-Confidence-Rating.md)

---

## 1. 路由定义

```
/q/:id           — 题目中枢页（不脱壳，保留 RailMini / TabBar）
/q/:id/redo      — 重做页（脱壳，全屏 session）
```

- `/q/:id` 是顶层路由，不在 AppShell children 内（QHub-1）
- 但**不脱壳**——仍渲染 RailMini（桌面）/ TabBar（移动）
- `/q/:id/redo` 是脱壳路由（D15）

```tsx
// apps/web/src/router/index.tsx
{ path: "/q/:id", element: <QuestionHub /> },
{ path: "/q/:id/redo", element: <QuestionRedo /> },
```

---

## 2. URL 参数（修订）

| 参数 | 说明 | 值 |
|---|---|---|
| `:id` | QuestionV2.id | 必填 |
| `?ctx` | 来源上下文 | `practice` \| `review` \| `note` \| `favorite` \| `home` \| `topic_drill` |
| `&review_id` | ReviewItemV2.id | ctx=review 时必填 |
| `&session_id` | PracticeSessionV2.id | ctx=practice 时可选 |
| `&note_id` | NoteV2.id | ctx=note 时可选 |
| `&topic_drill_seed` | 触发 topic_drill 的 seed_question_id | ctx=topic_drill 时可选 |
| `&dim_focus` | 跳转时高亮的 cause dimension slug | 可选；任何 ctx |

### 2.1 ctx 解析

```typescript
// packages/domain/src/review/useQuestionHub.ts
function parseQuestionHubContext(searchParams: URLSearchParams): QuestionHubContext {
  const ctx = searchParams.get("ctx") ?? "review";
  const validCtxs = ["practice", "review", "note", "favorite", "home", "topic_drill"];
  return {
    source: validCtxs.includes(ctx) ? ctx : "review",
    reviewId: searchParams.get("review_id") ? Number(searchParams.get("review_id")) : null,
    sessionId: searchParams.get("session_id") ? Number(searchParams.get("session_id")) : null,
    noteId: searchParams.get("note_id") ? Number(searchParams.get("note_id")) : null,
    topicDrillSeed: searchParams.get("topic_drill_seed") ? Number(searchParams.get("topic_drill_seed")) : null,
    dimFocus: searchParams.get("dim_focus") ?? null,
  };
}
```

---

## 3. 布局规格

### 3.1 移动端（< 768px）

```
┌──────────────────────────────────────┐
│ TabBar (fixed bottom)                │
├──────────────────────────────────────┤
│ ← 返回 {ctx_label}     ⋯ 更多       │  ← 顶部导航
├──────────────────────────────────────┤
│ ⚠️ ConfidenceMismatchBanner（如有）   │
│ 🔴 HardQuestionBadge（如 is_hard）    │
│ 📋 OfflineBanner（如题目 is_active=false）│
│ 🎓 ProbationaryBanner（如 status=probationary）│
├──────────────────────────────────────┤
│ [关联笔记提示条]（如有笔记）          │
├──────────────────────────────────────┤
│ 题面                                  │
│ 选项 A/B/C/D                         │
├──────────────────────────────────────┤
│ ▼ 我的答题历史 (折叠 + confidence)    │
├──────────────────────────────────────┤
│ ▼ 思路对比（如 ≥ 2 次错）             │  ← 新增
├──────────────────────────────────────┤
│ ▼ 正确答案 + 解析 (折叠)              │
├──────────────────────────────────────┤
│ ▼ AI 错因分析（含演进时间线）         │
│   - EvolutionTimeline（如 ≥ 2 次分析）│
│   - 找相关笔记 链接                   │
├──────────────────────────────────────┤
│ ▼ 题级笔记 (折叠)                    │
├──────────────────────────────────────┤
│ [操作按钮组 — 固定底部浮层]           │
│   ├ 主操作：去重做 / 写笔记            │
│   └ 更多：练同类 / 加入计划 / ...      │
└──────────────────────────────────────┘
```

### 3.2 桌面端（≥ 768px）

```
┌─────────┬─────────────────────────────────┬────────────────────┐
│ RailMini│ ← 返回 {ctx_label}              │                    │
│         │ [警示条群（mismatch/hard/...）]  │   侧栏 (320px)     │
├─────────┼─────────────────────────────────┼────────────────────┤
│         │  题面                            │  题级笔记           │
│         │  选项 A/B/C/D                   │  ──────────         │
│         │  答题历史时间线（含 confidence）│  知识点关联         │
│         │  思路对比（new）                  │  ──────────         │
│         │  正确答案 + 解析                  │  上/下题导航        │
│         │  AI 错因分析                       │  ──────────         │
│         │   ├ EvolutionTimeline             │  [操作按钮组]      │
│         │   └ 找相关笔记 / 练同类            │   主操作 + 更多     │
└─────────┴─────────────────────────────────┴────────────────────┘
```

---

## 4. 警示条群（顶部）

按优先级从高到低渲染（如有多个，纵向叠放）：

| 优先级 | 警示条 | 触发条件 | 颜色 | 文案 |
|---|---|---|---|---|
| 1 | `OfflineBanner` | QuestionV2.is_active=false | 灰色 | "该题已被题库标记为下线，仅供复盘使用" |
| 2 | `ConfidenceMismatchBanner` | metadata.confidence_mismatch_count > 0 | 红色 | "你之前对这题'完全确定'但答错了 N 次，建议优先复习" |
| 3 | `HardQuestionBadge` | metadata.is_hard=true | 橙色 | "这是难题：你已反复犯错 N 次，下方有深度分析建议" |
| 4 | `ProbationaryBanner` | item.status=probationary | 蓝色 | "试毕业期：本题将在 X 天后系统抽查；提前点'我已掌握'可跳过等待" |
| 5 | `ForcedAnalysisPendingHint` | metadata.forced_cause_analysis_pending | 黄色 | "正在分析你的错因..."（异步加载，完成后自动消失） |

每个 Banner 都有"了解更多"链接（跳到对应文档/帮助页）。

---

## 5. 内容区块（详细）

### 5.1 题面 + 选项（QuestionBody）

```typescript
// 简单展示，与 Practice 题面组件复用
<QuestionBody
  body={question.body}
  options={question.options}
  questionType={question.type}
/>
```

### 5.2 答题历史时间线（AnswerTimeline）

```
┌────────────────────────────────────────────────┐
│ 我的答题历史                                     │
├────────────────────────────────────────────────┤
│ 今天 14:30  ❌ 选 B（正确：A）  🟦 比较确定        │
│ 5 天前 09:12 ✅ 选 A           🟨 半懵            │
│ 12 天前 19:45 ❌ 选 D（正确：A）🟥 完全确定 ⚠️    │
│ 18 天前 16:20 ❌ 选 C（正确：A）⬜ 完全猜          │
│ 25 天前 11:00 ❌ 选 B（正确：A）⬜ 完全猜（首答）│
└────────────────────────────────────────────────┘

每个 confidence badge 用颜色区分：
  ⬜ guess (灰)  🟨 unsure (黄)  🟦 likely (蓝)  🟥 certain (红)

⚠️ = confidence_mismatch（certain + 错）
```

数据来源：合并 `ReviewAttemptV2` + `PracticeSessionAnswerV2`，按时间倒序。

### 5.3 思路对比（ThoughtComparison · 新增）

仅当 `total_wrong_count >= 2` 时显示。

```
┌────────────────────────────────────────────────┐
│ 思路对比                                         │
├────────────────────────────────────────────────┤
│ 第 1 次错（25 天前）                             │
│   选项：B → 当时信心：完全猜                      │
│   错因诊断：knowledge_gap (high) + careless_calc │
│                                                │
│ 最近一次错（今天）                                │
│   选项：B → 当前信心：比较确定                    │
│   错因诊断：concept_confusion (high)             │
│                                                │
│ 进步：从"完全不会"→"被概念干扰"，记忆已建立但仍混淆│
│ 建议：完成上次的"知识点系统学习"                  │
└────────────────────────────────────────────────┘
```

数据来源：`AnswerTimeline` 第一次错 + 最近一次错的 attempt + 关联的 `AiCauseAnalysisV2.evolution_context`。

实现细节：
- 当 `evolution_context.comparison_judgment.overall_trend` ∈ {improved, partial_improvement} → 文案"进步"
- ∈ {regressed} → 文案"恶化警示"
- ∈ {stagnant} → 文案"未改善"
- 无 evolution → 仅展示原始对比，不给文案判断

### 5.4 正确答案 + 解析（CorrectAnswer）

不变，沿用既有 component。

### 5.5 AI 错因卡（CauseCard · 重写）

```
┌────────────────────────────────────────────────┐
│ AI 错因分析                                      │
│ ─────────────────                                │
│                                                │
│ ──○────○────●─── 错因演进时间线（如 ≥ 2 次分析）│
│  4/15  4/28  今日                                │
│                                                │
│ ✅ 改善：审题不清 (上次 medium → 本次未出现)      │
│ ⚠️ 持续：概念混淆 (high → high)                  │
│ 🆕 新出现：公式记错 (medium)                      │
│                                                │
│ 上次建议执行情况：                                │
│ ✅ 整理期限对比表 (已完成)                        │
│ ❌ 重做 5 道同类题 (未完成)                      │
│                                                │
│ 整体趋势：部分改善                                │
│ ───────────────────                             │
│                                                │
│ 错因维度：                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔴 概念混淆 (high)         [我不同意 ↺]     │ │
│ │   建议：整理 15/30/60/90 天期限对比表       │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🟡 公式记错 (medium)       [我不同意 ↺]     │ │
│ │   建议：复习增长率公式                       │ │
│ └─────────────────────────────────────────────┘ │
│                                                │
│ 建议动作：                                        │
│ 1. 立即重新学习 X 知识点（上次未做）              │
│ 2. 挑 5 道同类题重做                              │
│                                                │
│ ┌──────────┬──────────┬──────────┬──────────┐  │
│ │保存为笔记│找相关笔记│ 👍 有用   │ 👎 不准   │  │
│ └──────────┴──────────┴──────────┴──────────┘  │
└────────────────────────────────────────────────┘
```

#### 5.5.1 EvolutionTimeline 组件

来源 `result_json.evolution_context`，组件位置 `components/q-hub/EvolutionTimeline.tsx`。

#### 5.5.2 维度卡（DimensionCard）每行

- 显示 name_display（来自 [13] 词典）
- severity 颜色（high=红/medium=黄/low=蓝）
- "我不同意 ↺" 按钮 → 弹出 `<CauseTagOverrideModal>` （选择新 slug + 可选 severity + note）

#### 5.5.3 找相关笔记（FindRelatedNotes）

按钮跳转：`/notes?cause_tag={top_dim.slug}` 或 `/notes?cause_tags={dim1.slug,dim2.slug}` 多 tag。

跳转逻辑由 [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) Cross-12 定义；Phase-Notes 实施时消费这些 query 参数。

#### 5.5.4 错因区块加载状态

| 状态 | UI |
|---|---|
| 无缓存 + 用户未点 "分析错因" | 折叠占位 + "点击分析错因（今日剩余 18/20）" |
| Loading | Skeleton 占位 + "AI 正在分析..." |
| 错误 | "AI 分析暂时不可用，请稍后再试" + retry（PR-R6） |
| 成功 | 完整展示 |
| forced 异步触发中 | 顶部 ForcedAnalysisPendingHint banner + 自动展开 |

### 5.6 题级笔记（NotesSection）

不变，沿用既有 component。

### 5.7 关联笔记提示（RelatedNotesHint）

如该题有 `NoteV2(linked_question_id=:id)`，顶部小条："你 X 天前写过笔记 →"。

---

## 6. 操作按钮组（ActionBar · 大改）

### 6.1 主操作 / 更多 拆分

移动端固定底部浮层 + "更多" 抽屉；桌面端侧栏直排。

```typescript
interface ActionBarConfig {
  primary: ActionDef[];        // 移动端底部直接展示，最多 2 个
  secondary: ActionDef[];      // 移动端"更多"抽屉，桌面端侧栏直排
}

// 默认 primary（按 ctx 不同）：
// - ctx=review:    [去重做, 分析错因 (如未做)]
// - ctx=practice:  [去重做, 加入复盘]
// - ctx=note:      [去重做, 写笔记]
// - ctx=favorite:  [去重做, 加入复盘]
// - ctx=home:      [去重做, 加入复盘]
// - ctx=topic_drill: [去重做, 已掌握]
```

### 6.2 完整操作清单

| 操作 | ctx 可见 | 触发 | 实施 |
|---|---|---|---|
| 去重做 | 所有 | → `/q/:id/redo?ctx={ctx}&review_id={id}` | 既有 |
| 收藏 / 取消收藏 | 所有 | toggle QuestionFavoriteV2 | 既有 |
| 持久标记 / 取消标记 | 所有 | toggle QuestionFlagV2 | 既有 |
| 加入复盘 | 当前无 active 行时 | POST /review/items (manual_add) | 既有 |
| 加入计划 | review/home/favorite 且有 review_id | POST /review/items/:id/add-to-plan | 既有 |
| 已掌握 | review/topic_drill, status ∈ active | PATCH /review/items/:id/graduate（mark_resolved） | 既有 |
| 归档 | review, status ∈ active | PATCH /review/items/:id/archive | 既有 |
| 写笔记 | 所有 | → NoteV2 创建（linked_question_id） | 既有 |
| 分析错因 | review 且有 review_id | POST /review/items/:id/cause-analysis | 既有 |
| **练同类 N 道** | 所有 | POST /practice/sessions（source_mode=topic_drill） | **新增（详见 §6.3）** |
| **找相关笔记** | 有 cause_analysis 时 | → /notes?cause_tag={slug} | **新增** |

### 6.3 "练同类 N 道" 详细规格

#### 6.3.1 入口

ActionBar "更多" 抽屉中可见，文案动态：
- 有 cause-analysis 时："练同类 10 道（针对：概念混淆 + 行政法）"
- 无 cause-analysis 时："练同类 10 道（按题型 + 科目）"

按钮点击展开 `<TopicDrillSetupModal>`：

```
练同类设置
─────────────────
题目数量: [5] [10] [15] [20]
难度筛选: [全部] [简单] [中等] [难]
错因聚焦: ☑ 概念混淆  ☐ 公式记错  ☐ 其他
科目范围:
  ● 严格相同（categoryL2）
  ○ 同 categoryL1
  ○ 全部科目

预估匹配题数: 35 题
─────────────────
[取消] [开始练习]
```

#### 6.3.2 后端调用

```http
POST /api/v2/practice/sessions
Body: {
  "source_mode": "topic_drill",
  "config_snapshot": {
    "topic_drill_seed_question_id": 1234,
    "filter": {
      "category_l2": "行政法",
      "cause_tags": ["concept_confusion"],
      "difficulty": ["medium", "hard"]
    },
    "question_count": 10,
    "shuffle_options": true,
    "practice_mode": "per_question",
    "recommended_length": 10
  }
}
```

新 `source_mode = "topic_drill"` 与既有 `wrong_redo` / `practice_mode` enum 平级；
Phase-Practice schema 需要追加该 enum 值（A0 §11 修订条目）。

#### 6.3.3 题目筛选逻辑（后端）

```python
def select_topic_drill_questions(
    user_id: int,
    seed_question_id: int,
    filter: TopicDrillFilter,
) -> list[QuestionV2]:
    seed = get(QuestionV2, seed_question_id)

    query = db.query(QuestionV2).filter(
        QuestionV2.is_active == True,
        QuestionV2.id != seed_question_id,
    )

    # 科目范围
    if filter.category_l2 == "strict":
        query = query.filter(QuestionV2.category_l2 == seed.category_l2)
    elif filter.category_l1 == "loose":
        query = query.filter(QuestionV2.category_l1 == seed.category_l1)

    # 错因 tag（通过历史 cause-analysis 反查）
    if filter.cause_tags:
        # 找出近 30 天 cause-analysis dim 含指定 tags 的题
        related_qids = db.query(AiCauseAnalysisV2.question_id).filter(
            AiCauseAnalysisV2.user_id == user_id,
            AiCauseAnalysisV2.created_at >= utcnow() - timedelta(days=30),
            AiCauseAnalysisV2.result_json["dimensions"].op("@>")(
                cast(json.dumps([{"slug": tag} for tag in filter.cause_tags]), JSONB)
            ),
        ).distinct().all()
        query = query.filter(QuestionV2.id.in_(related_qids))

    # 难度
    if filter.difficulty:
        query = query.filter(QuestionV2.difficulty.in_(filter.difficulty))

    # 排除用户已 graduated 的题
    graduated_qids = subquery_user_graduated_question_ids(user_id)
    query = query.filter(~QuestionV2.id.in_(graduated_qids))

    # 排序：用户错过且未做对 > 用户没做过 > 用户做对过的
    return query.order_by(custom_priority_clause(user_id)).limit(filter.question_count).all()
```

#### 6.3.4 Session 完成后

完成 topic_drill session 后**不**自动入复盘队列（避免污染 SRS）。但每题答错时仍走 PR-R5 标准路径（如该题已 graduated，触发 re_failed）。

---

## 7. 上下文行为表（修订）

| ctx | 返回目标 | 高亮项 | 重做 source_mode | 特殊行为 |
|---|---|---|---|---|
| `practice` | `/practice/sessions/:session_id/result` | session_id 对应 attempt | wrong_redo | 无"加入计划"按钮 |
| `review` | `/review` | review_id 最新 attempt | wrong_redo | 全部按钮可见 |
| `note` | `/notes/:note_id` | 关联笔记高亮 | wrong_redo | 笔记区块默认展开 |
| `favorite` | `/notes/favorites` | — | wrong_redo | 收藏按钮已选中 |
| `home` | `/` | — | wrong_redo | 来自弱项卡 |
| `topic_drill` | session result 页 | — | wrong_redo | "已掌握"按钮替代"加入计划" |

---

## 8. 旧路由 Redirect Map（修订）

| 旧路由 | 新路由 | 实施 |
|---|---|---|
| `/wrong-book/:questionId` | `/q/:questionId?ctx=review&review_id={lookup}` | review-route-bridge.ts |
| `/wrong-book/:questionId/redo` | `/q/:questionId/redo?ctx=review&review_id={lookup}` | review-route-bridge.ts |
| `/practice/questions/:id` | `/q/:id?ctx=practice` | 永久 301 |
| `/review/items/:id` | `/q/:questionId?ctx=review&review_id=:id` | review-route-bridge.ts |
| `/review/items/:id/redo` | `/q/:questionId/redo?ctx=review&review_id=:id` | review-route-bridge.ts |
| `/wrong-book` | `/review` | 永久 301 |

review-route-bridge.ts 实现见原 §7.x（不变）。

---

## 9. 无障碍要求（升级）

| 维度 | 要求 |
|---|---|
| 标题层级 | h1=题目标题, h2=各区块标题 |
| Focus 管理 | ctx 切换时 focus h1; modal 打开时 focus 第一个可交互元素 |
| 键盘导航 | ActionBar Tab 遍历; Enter/Space 触发 |
| ARIA | 折叠 aria-expanded; 错因 loading aria-live="polite"; 维度卡 role="article" |
| 警示条 | 全部 role="alert" + aria-live="assertive" |
| Confidence badge | aria-label 描述档位 + 是否 mismatch |
| EvolutionTimeline | aria-label 包含完整对比文本 |
| 颜色对比 | Mismatch banner 红色 + 文字对比度 ≥ 7:1（severity high） |
| Color-only 信号 | severity 必须 + icon（不仅靠颜色）：🔴 high / 🟡 medium / 🔵 low |

---

## 10. 测试矩阵（升级到 22 个）

| # | 场景 | 期望 |
|---|---|---|
| QH1 | ctx=review 默认完整按钮 | 全 11 个按钮可见 |
| QH2 | ctx=practice 不显示加入计划 | 无 add-to-plan |
| QH3 | confidence_mismatch_count=1 | ConfidenceMismatchBanner 可见 + 红色 |
| QH4 | is_hard=true | HardQuestionBadge 可见 + 橙色 |
| QH5 | is_active=false | OfflineBanner 可见 + 不阻止重做 |
| QH6 | status=probationary | ProbationaryBanner 可见 + 显示剩余天数 |
| QH7 | total_wrong_count >= 2 | ThoughtComparison 区块可见 |
| QH8 | total_wrong_count < 2 | ThoughtComparison 区块隐藏 |
| QH9 | evolution_context 存在 | EvolutionTimeline 可见 |
| QH10 | 仅 1 次 cause-analysis | EvolutionTimeline 隐藏（only show if ≥ 2） |
| QH11 | 维度卡"我不同意"打开 modal | CauseTagOverrideModal 弹出 + slug enum 列表正确 |
| QH12 | "找相关笔记"跳转 | URL = /notes?cause_tag=concept_confusion |
| QH13 | "练同类 10 道"创建 session | source_mode=topic_drill, filter 正确 |
| QH14 | topic_drill setup modal 估算 | 显示匹配题数 |
| QH15 | topic_drill 完成后不入复盘 | ReviewItemV2 不新增（除非答错触发 PR-R5） |
| QH16 | forced_cause_analysis_pending | 顶部 hint + 自动 trigger |
| QH17 | AnswerTimeline confidence badge 显示 | 5 档颜色正确 |
| QH18 | 5 种 ctx 切换导航 | 返回目标 / 高亮 / 按钮可见性正确 |
| QH19 | 无障碍 axe-core | 0 violations |
| QH20 | 警示条群优先级 | OfflineBanner > Mismatch > Hard > Probationary |
| QH21 | dim_focus 参数 | 跳转后该 dimension 高亮 |
| QH22 | 桌面/移动响应式 | 移动 primary 仅 2 按钮 + 更多抽屉；桌面 11 按钮全展开 |

---

## 11. 与既有设计的边界

### 11.1 与 13-Cause-Taxonomy

- DimensionCard "我不同意" 调用 [13] §6 端点
- "找相关笔记"使用 dimension.slug 跳转
- EvolutionTimeline 渲染 [13] §7 的 evolution_context

### 11.2 与 14-Confidence-Rating

- ConfidenceMismatchBanner 触发条件 [14] §3.4
- AnswerTimeline confidence badge 5 档颜色
- "练同类"按钮的 ConfidenceFilter 选项是用户可选的

### 11.3 与 12-Debt-Management

- HardQuestionBadge 触发条件 [12] §5.1
- ProbationaryBanner 在 ramp-up 期间也可见（不冲突）

### 11.4 与 05-SRS-Engine

- "已掌握"按钮调用 mark_resolved（[05] §7.3）
- ProbationaryBanner 显示 metadata.probation_check_at 剩余天数

### 11.5 与 09-Cross-Tab-Wiring

- "练同类"调用约定见 [09] Cross-10
- "找相关笔记"调用约定见 [09] Cross-12
- ctx=topic_drill 路径见 [09] §3 read flows

### 11.6 与 04-Frontend-WU

- WU-FR8 实施需要新增 7 个组件：
  - `EvolutionTimeline.tsx` / `ConfidenceMismatchBanner.tsx` / `HardQuestionBadge.tsx`
  - `ProbationaryBanner.tsx` / `ThoughtComparison.tsx` / `CauseTagOverrideModal.tsx`
  - `TopicDrillSetupModal.tsx`

---

## 12. 引用矩阵

| 本文被引用 |
|---|
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR8 |
| [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) ctx 跨 tab 导航 |
| [11-Testing](./11-Testing.md) Q-Hub 测试 |
| [12-Debt-Management](./12-Debt-Management.md) HardQuestionBadge UI |
| [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) Override modal + EvolutionTimeline |
| [14-Confidence-Rating](./14-Confidence-Rating.md) MismatchBanner + AnswerTimeline badge |
