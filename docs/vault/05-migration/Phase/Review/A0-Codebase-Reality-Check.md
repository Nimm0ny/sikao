# Phase-Review · A0 · Codebase Reality Check

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **目的**：把当前代码库与 Tab 3 目标态的 delta 摊开，避免下游 WU 文档撞到代码现实。
> **必读对象**：所有 Review Phase 的 PR agent。开工前必读，比 00-Decisions 更前置。

> **2026-05-28 runtime truth update**：本文中的 `/q/:id` / `/q/:id/redo` 主要用于历史设计与 delta 对照；本文不再承担当前 router authority，当前 QuestionHub 入口以 `/question-hub` 为准。

---

## 0. 为什么有这份文档

子文档（00~11）基于 [Frontend-IA-V2.md](../../Frontend-IA-V2.md) + Tab 3 IA 讨论编写，描述的是**目标态**。本文记录**当前态**与目标态的 delta，让 PR 拆分能正确估算工作量。

下游文档若与本文冲突，**以本文为准**；本文 §11 给出受影响章节的精确修订指引。

---

## 1. 与 Phase-Home / Phase-Practice 共享 schema 的现状

Phase-Home / Phase-Practice 完成后会建立的基础（Tab 3 直接复用，不重复建）：

| 表 / 模块 | Phase-Home/Practice 完工后状态 | Tab 3 在此基础上做什么 |
|---|---|---|
| QuestionV2 | Practice 已扩展 source / category_l1/l2 / historical_accuracy / quality_score / is_active 等 | **不再扩展**；Review 仅读 |
| PracticeSessionV2 | Practice 已扩展 practice_mode / source_mode（含 wrong_redo 枚举） / config_snapshot / linked_review_id | **不再扩展**；Review 仅消费 source_mode=wrong_redo |
| PracticeSessionAnswerV2 | Practice 已扩展 flagged / viewed_solution | **不再扩展** |
| QuestionFavoriteV2 | Practice 新建 | **不动 schema**；归属由 [D-Fav-Location](../../Frontend-IA-V2.md#5-决策清单) 拍板归 Notes tab |
| QuestionFlagV2 | Practice 新建；Flag-AutoReview 写入 ReviewItemV2(source_kind=flagged_persistent) | **本 Phase 消费侧**：list / detail / redo / resolve |
| NoteV2 | Practice 已扩展 linked_question_id / visibility | **不动 schema**；Review 仅读"题级笔记关联" |
| ReviewItemV2 | 已建表 stub（源字段 source_kind / source_id / metadata_json） | **WU-R1**：完整化（source_kind 枚举扩展 + SRS state 字段 + audit） |
| ReviewAttemptV2 | 已建表 stub（id / review_item_id / outcome / notes_json / attempted_at） | **WU-R1.2**：扩展 outcome 枚举 + notes_json shape 规范化 |
| `modules/review/` | 已建（4 端点 stub） | **WU-R2 / WU-R5 / WU-R7**：完整化 + 新增 cause-analysis / weekly / insights 子模块 |
| `modules/llm/` | Phase-Home WU-B7 完工后含 plan/recommend/cause_analysis 基础设施 | **WU-R5**：在同模块内追加 cause_analysis prompt / parser / generator |
| AuditLogV2 / IdempotencyKeyV2 / LlmCallV2 | Phase-Home WU-B1 已建表；`core/audit.py` 已就位 | 直接复用，不再建 |
| WeaknessSnapshotV2 | Phase-Home 已建表 | **WU-R7**：加 contributions.review 聚合逻辑（cron 每周更新）|
| RecommendationV2 | Phase-Home 已建表 | **WU-R8**：加 type=review_session 枚举值 + accept→session 流（Rec-9 兼容）|
| APScheduler 框架 | Phase-Home WU-B8 已就位 | **WU-R7**：注册 1 个新 cron（每周一 02:00 周回顾快照）|

⚠️ **强约束**：Tab 3 启动的硬前置 = Phase-Home WU-B1 + WU-B7 + WU-B8 完工 + Phase-Practice WU-B10/B11/B16 完工。否则 schema / LLM / Flag-AutoReview hook 都不可用。

---

## 2. ReviewItemV2 / ReviewAttemptV2 stub 现状（最重要）

### 2.1 ReviewItemV2 stub 字段（grep `db/models_v2.py:477-498`）

```python
class ReviewItemV2(Base):
    __tablename__ = "review_items_v2"
    __table_args__ = (
        Index("ix_review_items_v2_user_created", "user_id", "created_at"),
    )

    id: Mapped[int]
    user_id: Mapped[int]                              # FK users_v2
    source_kind: Mapped[str] = mapped_column(String(32))   # ← 关键字段，不是 reason
    source_id: Mapped[int | None]
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    question_id: Mapped[int | None]                  # FK questions_v2 ON DELETE SET NULL
    essay_submission_id: Mapped[int | None]          # FK essay_submissions_v2
    metadata_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict)
    created_at / updated_at
```

**关键发现**：
- 字段叫 `source_kind` 而**不是 `reason`**。下游 IA 讨论稿与本 Phase 文档中提到 "reason" 时，**实际落地字段名一律是 `source_kind`**。
- `metadata_json` 是 JSONB（PostgreSQL）/ JSON（SQLite）兼容字段，所有扩展状态（SRS / source_note_id / used_recall 等）放进去。
- 缺少 SRS 状态字段：`correct_streak / next_review_at / algorithm_version / ease_factor / interval_days / repetitions / used_recall / last_answer_hash / first_seen_at / last_reviewed_at / graduated_at / archived_at`。WU-R1 需要全部新增（部分到 metadata_json，部分提升为列以便索引）。
- `essay_submission_id` 字段已存在（申论错题预留）；本 Phase **不消费它**（申论无错题语义，PR-R7 边界规则保证）。

### 2.2 ReviewAttemptV2 stub 字段

```python
class ReviewAttemptV2(Base):
    __tablename__ = "review_attempts_v2"
    __table_args__ = (
        Index("ix_review_attempts_v2_item_attempted", "review_item_id", "attempted_at"),
    )

    id: Mapped[int]
    review_item_id: Mapped[int]                      # FK review_items_v2 ON DELETE CASCADE
    outcome: Mapped[str] = mapped_column(String(32))
    notes_json: Mapped[dict] = mapped_column(JSONB_COMPAT, default=dict)
    attempted_at: Mapped[datetime]
```

**关键发现**：
- 这就是事件日志表！下游 IA 讨论稿提到的 "ReviewItemEventV2" **不另建表**，扩展 ReviewAttemptV2 的 `outcome` 枚举即可。
- `notes_json` 用作所有非主键扩展字段的容器（before_streak / after_streak / before_status / after_status / session_id / recall_text 等）。
- 缺索引 `(user_id, attempted_at)` 用于跨题查事件序列（WU-R1.2 加，user_id 通过 join review_item 推导）。

### 2.3 现有 review router 端点（grep `modules/review/interface/routes.py`）

```python
GET  /api/v2/review/items               → list_review_items（stub，无筛选/排序）
GET  /api/v2/review/smart               → OverviewResponseV2 envelope（stub）
GET  /api/v2/review/items/{item_id}     → get_review_item（stub，仅 item + history）
POST /api/v2/review/items/{item_id}/redo → redo_review_item（OperationAckV2，未真实建 session）
```

WU-R2 / WU-R3 / WU-R5 / WU-R7 的全部新端点：
- 现有 4 个全部重写（list 加筛选 / detail 加 SRS 状态 / smart 改前端聚合不再走后端 / redo 真建 PracticeSessionV2(source_mode=wrong_redo)）
- 新增端点：
  - `POST /review/items` 手动加入复盘（manual_add）
  - `PATCH /review/items/:id/graduate` / `archive` / `restore`
  - `POST /review/items/:id/cause-analysis`（单题）
  - `POST /review/cause-analysis/group`（多题聚合）
  - `GET /review/insights/trends` / `causes` / `redo-accuracy`
  - `GET /review/weekly-summary?week=YYYY-WW`

### 2.4 Pydantic schema 现状（`db/schemas_v2.py:188-216`）

```python
class ReviewItemV2(CamelModel):       # ← 注意：与 SQLAlchemy 同名，Pydantic 模型
    id, kind, title, status, href, created_at

class ReviewListResponseV2(CamelModel):
    items, total, page, page_size

class ReviewAttemptOutV2(CamelModel):
    id, outcome, attempted_at

class ReviewDetailResponseV2(CamelModel):
    item, history, actions
```

WU-R1.3 升级：
- `ReviewItemV2` Pydantic 增加：source_kind / next_review_at / correct_streak / has_user_notes / has_cause_analysis / question_envelope（join question_v2 简版）
- 新增：`ReviewItemCreateV2 / ReviewItemUpdateV2 / CauseAnalysisRequestV2 / CauseAnalysisResponseV2 / InsightsTrendsResponseV2 / WeeklySummaryResponseV2`
- `ReviewItemV2` Pydantic 与 SQLAlchemy 同名是 **Phase-Home/Practice 既定约定**（沿用，不重命名以避免大面积 import 改动）

---

## 3. Legacy wrong-book 前端整族现状

### 3.1 views（4 个，全部重写或删）

| view | 路径 | 当前职责 | 本 Phase 动作 |
|---|---|---|---|
| `WrongBook.tsx` | `apps/web/src/views/WrongBook.tsx` | `/wrong-book` 主入口；hero + heatmap + filters + list + smart-review CTA | **删**：替换为 `ReviewToday.tsx` + `ReviewAll.tsx` 两个 view |
| `WrongQuestionDetailView.tsx` | `apps/web/src/views/WrongQuestionDetailView.tsx` | `/wrong-book/:questionId` 错题详情 | **删**：内容迁移到 `QuestionHub.tsx`（`/q/:id`） |
| `WrongQuestionRedoView.tsx` | `apps/web/src/views/WrongQuestionRedoView.tsx` | `/wrong-book/:questionId/redo` 重做 | **删**：用 `/q/:id/redo` 直接进 PracticeSession |
| `SmartReviewView.tsx` | `apps/web/src/views/SmartReviewView.tsx` | `/wrong-book/smart-review` 5-mode + Flashcard | **删**：替换为 `/review` 默认视图三卡 |

### 3.2 components（`apps/web/src/components/wrong-book/`，11 个）

| 组件 | 当前用途 | 本 Phase 动作 |
|---|---|---|
| `WrongBookHero.tsx` | 顶部 metrics 摘要 | **删**：被周回顾条替代 |
| `WrongBookHeatmap.tsx` | 365 天热力图 | **删**：[已划出范围](./README.md#22-不在范围内)（观赏性 > 决策性） |
| `WrongBookFilters.tsx` / `WrongBookFiltersPanel.tsx` | 筛选条 | **重写**：迁到 `components/review/AllFilters.tsx`，按新筛选项（reason / 题型 / 题源 / 时间窗 / SRS 档位） |
| `WrongQuestionList.tsx` | 列表容器 | **复用**：迁到 `components/review/AllList.tsx`，调整列内容 |
| `WrongQuestionCard.tsx` | 单题卡片 | **复用**：迁到 `components/review/ItemCard.tsx`，加 SRS 徽标 / source_kind 角标 |
| `WrongQuestionDetail.tsx` | 详情主体 | **重写**：内容迁到 `views/QuestionHub.tsx`（含上下文参数处理）|
| `WrongDetailSection.tsx` | 详情段落折叠组件 | **复用**：迁到 `components/q-hub/Section.tsx` |
| `Flashcard.tsx` | smart-review qifei 模式卡片堆 | **删**：替换为 `components/review/SmartCardA/B/C.tsx` 三卡 |
| `SmartReviewModes.tsx` | 5-mode 选择器 | **删**：替换为三卡固定布局 |
| `StandoutGraduation.tsx` | 已掌握强化反馈视觉 | **复用**：迁到 `components/review/GraduatedBanner.tsx`，触发条件改为"今日新 graduated" |
| `WrongBookSkeleton.tsx` | loading 占位 | **复用**：迁到 `components/review/Skeleton.tsx` |
| `__tests__/` | 单测 | **重写**：按新组件路径与 testid 全部更新 |

### 3.3 domain（`packages/domain/src/wrong-book/`，2 个）

| 文件 | 当前职责 | 本 Phase 动作 |
|---|---|---|
| `useWrongQuestionItem.ts` | 错题详情 cache | **重写**：替换为 `packages/domain/src/review/useReviewItem.ts` + `useQuestionHub.ts` |
| `useWrongBookHeatmap.ts` | 热力图数据 | **删**：热力图已划出范围 |

新建 `packages/domain/src/review/`：
```
useReviewItems.ts            列表（支持筛选 / 排序 / 多选状态）
useReviewItem.ts             单条
useReviewToday.ts            SRS 今日队列 + 三卡输入数据 fetcher
useSmartReviewCards.ts       三卡 S-front 聚合（依赖 useReviewItems + useRecentAnswers）
useRecentAnswers.ts          最近 N=200 PracticeSessionAnswerV2（聚合源数据）
useCauseAnalysis.ts          单题错因
useGroupCauseAnalysis.ts     聚合错因
useWeeklyReview.ts           周回顾数据（实时聚合）
useReviewInsights.ts         3 张图数据
useQuestionHub.ts            题目中枢页（含 ctx 解析）
```

### 3.4 api-client queries

| 文件 | 当前职责 | 本 Phase 动作 |
|---|---|---|
| `wrongBookQueries.ts` | wrong-book / smart-review API | **删**：替换为 `reviewQueries.ts` + `causeAnalysisQueries.ts` + `weeklyReviewQueries.ts` |

### 3.5 router 现状（已在 Phase-Home A0 §1.4 给出迁移清单，本 Phase 实施）

```
/wrong-book                   → /review                              （4→5 tab 时改 label 复盘）
/wrong-book/smart-review      → /review                              （智能默认就在 /review 三卡）
/wrong-book/:questionId       → /q/:questionId?ctx=review&review_id={lookup}
/wrong-book/:questionId/redo  → /q/:questionId/redo?ctx=review&review_id={lookup}
/practice/questions/:id       → /q/:id?ctx=practice
/review/items/:id             → /q/:id?ctx=review&review_id={lookup}
/review/items/:id/redo        → /q/:id/redo?ctx=review&review_id={lookup}
```

⚠️ `?review_id={lookup}` 的获取：从 `/wrong-book/:qid` 跳来时，前端先调 `GET /api/v2/review/items?question_id=:qid&status=active` 取最新 active 行，再带参数跳。这个 helper 在 `lib/review-route-bridge.ts` 中实现（WU-FR11）。

---

## 4. 缺失依赖清单

### 4.1 后端依赖（services/api/pyproject.toml）

| 包 | 用途 | 引入 PR |
|---|---|---|
| 无新增 | — | — |

> 后端不需要新依赖。SRS 简化算法纯 Python 实现；周回顾聚合用现有 SQLAlchemy；cause-analysis 沿用 Phase-Home `modules/llm/` 框架。

### 4.2 前端依赖（apps/web/package.json）

| 包 | 用途 | 引入 PR |
|---|---|---|
| `recharts@^2.15` | `/review/insights` 三张图 | **复用** Phase-Home WU-F5.4 已引；本 Phase 不新增 |
| 无其他新增 | — | — |

> 前端也不需要新依赖。三卡聚合是普通 selector 计算；题目中枢页用现有 react-router；错因分析 UI 用现有组件库。

### 4.3 测试依赖

复用 Phase-Home / Phase-Practice 已建：pytest / vitest / RTL / MSW / axe-core / OpenAPI drift。

---

## 5. AGENTS.md 关键约束摘录（Phase-Review 易踩雷）

| 约束 | 说明 |
|---|---|
| H6 Define First | 任一实现 PR 前必须有对应 plan 文档；本 Phase 已就绪 |
| H7 Fail Fast | LLM cause-analysis 失败必须显式 503，不可静默吞 → 见 PR-R6 |
| H9 PR Batch | ≤15 文件 / ≤400 行变更（含测试）；超出必拆 |
| H10 No Docker | 全场景禁止 docker；SRS / cron 进 API 进程 |
| H8 Validation | 写完测试必须实跑（pytest -q / vitest --run），证据贴 PR description |
| H4.4 No console.log | 前端禁 console.log，用 `packages/shared-utils/logger` |

---

## 6. 跨 Phase 写入侧 hook 清单

本 Phase 所有"自动入队"的写入由 **Phase-Practice 持有**：

| 触发 | 写入 | hook 位置 | 归属 Phase |
|---|---|---|---|
| session.commit 答错 | ReviewItemV2(source_kind=wrong_answer) | Phase-Practice WU-B15 session.submit | Practice |
| session.commit 持久标记 | ReviewItemV2(source_kind=flagged_persistent) | Phase-Practice WU-B16 Flag-AutoReview | Practice |
| review session 答错（graduated 之后） | ReviewItemV2(source_kind=re_failed) **新行** | **WU-R4**（本 Phase）| **Review** |
| 用户从笔记 / 收藏 / 答题历史 / Q-Hub 加入复盘 | ReviewItemV2(source_kind=manual_add) | **WU-R2** POST /review/items（本 Phase）| **Review** |
| 笔记 AI 摘要拆出复盘卡 | ReviewItemV2(source_kind=note_card) | **Phase-Notes**（待启动）| Notes |

> **注意**：Phase-Practice 的 hook 已经会写入 wrong_answer / flagged_persistent；本 Phase 启动时**只需消费**（list / detail / SRS 推进）。但 WU-R4 需要在 review session 的 commit 路径上额外写 re_failed（新行），因为 Practice 的 session.commit 不知道"这是从复盘来的"。具体见 [03-Backend-WU §WU-R4](./03-Backend-WU.md#wu-r4-跨-phase-hook).

---

## 7. /review/insights 复用 Phase-Home Recharts 设置

[Phase-Home WU-F5.4](../Home/04-Frontend-WU.md) 已引入 recharts@^2.15 并配置 lazy load。本 Phase 三张图（错题趋势 / 错因聚类 / 再做正确率）：
- 沿用 Phase-Home 的 lazy load 模式（仅 `/review/insights` 路由 chunk 中）
- 沿用 Phase-Home 的颜色 token（Design-System.md）
- 沿用 Phase-Home 的 `<EmptyChartPlaceholder>` 组件

---

## 8. AppShell 与脱壳路由

Phase-Home A0 已经为脱壳路由扩到 6 条：
```
/practice/sessions/:id             ★ 脱壳
/practice/sessions/:id/result      ★ 脱壳
/practice/sessions/:id/grading     ★ 脱壳（Practice）
/practice/ai-questions/generating  ★ 脱壳（Practice）
/notes/:id                         ★ 脱壳
/q/:id/redo                        ★ 脱壳（**本 Phase 新增**）
```

`/q/:id` 中枢页本身**不脱壳**——用户可以从复盘 tab 跳进去仍保留 RailMini / TabBar 上下文（这与原 `/review/items/:id` 的"半屏壳"行为一致）。仅 redo 路径完全脱壳。

实施在 WU-FR11，在 `apps/web/src/router/index.tsx` 与 `AppShell.tsx` 中加 `/q/:id` 路由 + `/q/:id/redo` 加入脱壳清单。

---

## 9. 测试体系现状

Phase-Home / Practice 已建：
- pytest + invariant tests（含 P1-P6、PR1-PR8 invariant）
- vitest + RTL + MSW
- a11y（axe-core）
- OpenAPI drift 测试

本 Phase 在此基础上新增（WU-R12 + WU-FR12）：
- 7 条 PR-R 边界 invariant
- SRS 状态机 invariant（连续答对毕业 / 答错回退 / re_failed 不覆盖）
- 跨 tab 联动 e2e（练习答错 → 复盘可见 / 复盘加入计划 → 首页可见 / 笔记加入复盘 → 复盘可见）
- 题目中枢页跨 ctx 切换 e2e（5 种 ctx）
- 路由 redirect e2e（`/wrong-book/*` / `/practice/questions/*` / 老 `/review/items/*`）

---

## 10. AGENTS-H6 Define First 清单

每个 PR 开工前必查：
- 决策依据：[00-Decisions.md](./00-Decisions.md) 对应条目
- 边界规则：[01-Boundary-Rules.md](./01-Boundary-Rules.md) 对应条目
- 数据模型：[02-Data-Model.md](./02-Data-Model.md) 对应字段
- 测试规范：[11-Testing.md](./11-Testing.md) 对应模块

WU 描述与本文 §11 冲突时，以本文为准；WU 描述与 [00-Decisions](./00-Decisions.md) 冲突时，以 00-Decisions 为准（除非 00-Decisions 自身被 A0 §11 修订）。

---

## 11. 子文档修订清单（受 A0 影响）

| 子文档 | 章节 | 原写法 | 修订为 |
|---|---|---|---|
| 02-Data-Model | 全文 | "ReviewItemV2.reason 字段" | 实际字段名是 `source_kind`（沿用 stub）；"reason" 字眼仅在讨论时使用，schema 中是 source_kind |
| 02-Data-Model | 全文 | "新建 `db/models/review_v2.py`" | 实际是在 `db/models_v2.py` 中追加字段（ReviewItemV2 已存在） |
| 02-Data-Model | "ReviewItemEventV2 新表" | — | **不新建**，扩展 ReviewAttemptV2.outcome 枚举 + notes_json shape；详见 §2.2 |
| 02-Data-Model | "WeeklyReviewSummaryV2 新表" | — | **不建**，已划出范围（用 NoteV2(type=weekly_review) + 实时聚合替代） |
| 02-Data-Model | AiCauseAnalysisV2 字段 | 保持新增 | `question_id` nullable + `question_ids_signature` for group scope |
| 03-Backend-WU | 全文 LLM 路径 | "新建 `modules/llm_v2/`" | 沿用 Phase-Home 路径修订：`modules/llm/`（在已有目录追加文件，详见 [Phase/Home/A0 §2.6](../Home/A0-Codebase-Reality-Check.md#26-修订后的-llm-模块演进策略替换-05-llm-module-1-2)）|
| 03-Backend-WU | WU-R2 端点 | "新建 review router" | 实际是**重写** `modules/review/interface/routes.py` 的 4 个 stub 端点 + 新增 N 个端点 |
| 03-Backend-WU | WU-R7 cron | "新建 cron 服务" | 在 Phase-Home `services/api/src/sikao_api/cron/` 已有目录追加文件 |
| 04-Frontend-WU | "新建 `views/Review*.tsx`" | 同时 | 删除 4 个 legacy view + 11 个 component 与"新建" 同步处理；详见 §3 |
| 04-Frontend-WU | 路由 redirect | 实施 | 在 `router/index.tsx` 加 redirect map；helper 在 `lib/review-route-bridge.ts` |
| 04-Frontend-WU | F5.4 recharts | "新增依赖" | **复用** Phase-Home 已引入的 recharts；本 Phase 不引依赖 |
| 04-Frontend-WU | domain 目录 | "新建 `packages/domain/src/review/`" | 同时**删除** `packages/domain/src/wrong-book/` 整目录（含 `useWrongBookHeatmap.ts` / `useWrongQuestionItem.ts`）|
| 05-SRS-Engine | "新建 SRS service" | 写在 `modules/review/application/srs_engine.py` | 不新建独立模块 |
| 06-AI-Cause-Analysis | LLM 路径 | "新建 `modules/llm_v2/...`" | 沿用 `modules/llm/application/llm/` 路径，详见 [Phase/Home/A0 §2.6](../Home/A0-Codebase-Reality-Check.md#26-修订后的-llm-模块演进策略替换-05-llm-module-1-2) |
| 08-Question-Hub-Page | 路由 | "新建 `/q/:id` 路由" | 在 `router/index.tsx` 中作为顶层路由（不在 AppShell children 内）；ctx 参数解析逻辑在 `views/QuestionHub.tsx` |
| 09-Cross-Tab-Wiring | Practice hook | "本 Phase 写入 wrong_answer hook" | 已在 Phase-Practice WU-B15 完工写入；**本 Phase 仅消费** |
| 09-Cross-Tab-Wiring | Notes hook | "本 Phase 实施 note_card 写入" | **不在范围**；归 Phase-Notes 启动后实施（schema 兼容预留） |

任何 PR 提交时，PR description 写"已读 A0 §X.Y"作为 acknowledge。

---

## 12. 启动顺序建议

按本文件修订后，开工顺序：

```
P0  本文件 + §11 修订指引被各文档读懂（M0 启动周）
P1  WU-R1 数据建模（按 §2 真实路径在 db/models_v2.py 追加 ReviewItemV2 字段 + 新建 AiCauseAnalysisV2）
P2  WU-R2 review CRUD 完整化 + manual_add / graduate / archive / restore 端点
P3  WU-R3 SRS engine（modules/review/application/srs_engine.py）
P4  WU-R4 跨 Phase hook（review session.commit 路径写 re_failed）
P5  WU-R5 / R6 cause-analysis 模块 + LLM prompt 追加
P6  WU-R7 / R8 / R9 weekly cron + insights 端点 + audit
P7  WU-R10 / R11 / R12 scheduler + e2e + OpenAPI
─────────────────────────────────────────────────────
P8  WU-FR1 / FR2 / FR3 API client + types + domain stores
P9  WU-FR4 默认视图（周回顾条 + SRS 队列 + 三卡 容器）
P10 WU-FR5 智能三卡 S-front 聚合
P11 WU-FR6 / FR7 全部错题视图 + 数据洞察 三图
P12 WU-FR8 题目中枢页 /q/:id（最重，跨 tab 兼容）
P13 WU-FR9 / FR10 错因 UI + 加入计划 CTA
P14 WU-FR11 路由 redirect + legacy 组件清理（删 wrong-book/ 整目录）
P15 WU-FR12 e2e + a11y + 验收
```

---

## 13. 引用矩阵

| 本文档被引用 |
|---|
| [README.md](./README.md) 顶部"开工前必读"提示 |
| 所有 00-11 子文档的"路径错误" / "字段名错误" / "新建 vs 扩展" 自动以本文 §11 为准 |

---

## 14. 维护

发现下游文档与本文 §11 已同步修订后，将本文 Status 从 ACCEPTED 改为 SUPERSEDED，并保留作为审计记录。

修改 §11 修订指引时 PR description 必须标 `[A0 update]`，触发 reviewer 同步检查下游文档是否一致。
