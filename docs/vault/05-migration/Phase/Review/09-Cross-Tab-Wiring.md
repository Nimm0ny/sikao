# Phase-Review · 09 · Cross-Tab Wiring

> **Status**: ACCEPTED (REWRITTEN)
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §10（Cross-1 ~ Cross-15）· [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) §6 + §11（修订条目）

---

## 1. 概述与修订范围

本文修订相比 v1：
1. **Cross-1~8 保留**（基础写入/读取/反向流）
2. **Cross-9** Home Streak 包含复盘维度
3. **Cross-10** "练同类"调用契约（[08] §6.3）
4. **Cross-11** "找相关笔记"反向链 query（[08] §5.5.3 + Phase-Notes 消费）
5. **Cross-12** Practice / Review 共用 confidence 评级（[14]）
6. **Cross-13** Session 中途退出处理（已答推进 SRS，未答不变）
7. **Cross-14** Cause-Analysis 用户覆盖触发的笔记自动建议
8. **Cross-15** debt 跨 tab 同步（Home today list 对接 debt-aware 计数）

---

## 2. 数据流全览（升级版）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  WRITE FLOWS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Practice Tab                              Review Tab                       │
│  ─────────────                             ──────────                       │
│  session.commit(per answer)                                                 │
│    ├─ 收集 confidence ★ NEW ────────┐                                       │
│    ├─ 答错 ─────────────┐            │                                       │
│    │  metadata.first_confidence ★    │                                       │
│    └─ 持久标记 ─────────┤            │                                       │
│                          │            │                                       │
│                          ▼            ▼                                       │
│       ReviewItemV2(wrong_answer)  ReviewAttemptV2(confidence)                 │
│       ReviewItemV2(flagged_persistent)                                        │
│                                                                              │
│  Review Tab (WU-R4 hook)                                                    │
│  ────────────────────────                                                   │
│  session.commit 检测 graduated/probationary 后答错                            │
│    ├─ probationary 失败 → ReviewItemV2(re_failed) [新行] + 原 prob 行 next=NULL│
│    ├─ graduated 后答错 → ReviewItemV2(re_failed) [新行]                      │
│    └─ confidence=certain + 错 → metadata.forced_cause_analysis_pending=True   │
│                                                                              │
│  Review Tab (新增写入)                                                       │
│  ────────────────────                                                        │
│    ├─ 用户加入复盘 ────────────▶ ReviewItemV2(manual_add)                     │
│    ├─ "练同类" ★ NEW ──────────▶ PracticeSessionV2(source_mode=topic_drill)  │
│    ├─ "我不同意"覆盖错因 ★ NEW ─▶ AiCauseAnalysisV2.dim.user_override + audit │
│    ├─ 用户跳过 ramp-up ★ NEW ──▶ debt.metadata.ramp_up_unlocked              │
│    └─ 用户主动打散债务 ★ NEW ──▶ ReviewItemV2[].metadata.debt_status          │
│                                                                              │
│  Notes Tab (Phase-Notes 实施)                                                │
│  ─────────────────────────                                                   │
│    └─ AI 摘要拆卡 ──────────────▶ ReviewItemV2(note_card) [预留]             │
│                                                                              │
│  Review Tab → Notes Tab                                                     │
│  ──────────────────────                                                     │
│    ├─ 错因"保存为笔记" ────────▶ NoteV2(type=ai_cause_analysis)              │
│    ├─ 周回顾"生成笔记" ────────▶ NoteV2(type=weekly_review)                  │
│    └─ Cause Override 高频 ★ NEW ▶ Notes 提示"建议为该 tag 写笔记"             │
│                                                                              │
│  Review Tab → Home Tab                                                      │
│  ─────────────────────                                                      │
│    ├─ SRS graduated/probationary  ▶ WeaknessSnapshotV2.contributions.review │
│    ├─ "加入计划" ──────────────▶ RecommendationV2(type=review_session)       │
│    ├─ debt 状态变化 ★ NEW ─────▶ Home today list 数字 debt-aware            │
│    └─ 复盘 streak ★ NEW ───────▶ Home streak source 含复盘维度              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                  READ FLOWS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Review Tab reads from:                                                     │
│  ─────────────────────                                                      │
│  QuestionV2 ◀── 题面 / 选项 / 解析 / category（含 l3）                      │
│  PracticeSessionV2 ◀── 重做 session + topic_drill session 创建              │
│  PracticeSessionAnswerV2 ◀── 三卡聚合 + 答题历史 + confidence 历史           │
│  NoteV2 ◀── 题级笔记 + 周回顾数据 + AI 摘要                                  │
│  QuestionFavoriteV2 ◀── Q-Hub 收藏状态                                      │
│  QuestionFlagV2 ◀── Q-Hub 标记状态                                          │
│  CauseTagV2 ◀── 词典查询（[13]）                                            │
│                                                                             │
│  Home Tab reads from Review:                                                │
│  ───────────────────────────                                                │
│  ReviewItemV2 + DebtSnapshot ◀── today list（debt-aware 数字 ★ NEW）         │
│  WeaknessSnapshotV2.contributions.review ◀── 弱项卡                         │
│  RecommendationV2(type=review_session) ◀── 推荐接受后建 session              │
│  ReviewStreakV2 ★ NEW ◀── 复盘连续打卡天数                                   │
│                                                                             │
│  Practice Tab reads from Review:                                            │
│  ────────────────────────────────                                           │
│  ReviewItemV2 ◀── session 结果页"已加入复盘"徽标                            │
│  ReviewItemV2.metadata.is_hard ★ NEW ◀── Practice 答题中的 hard 题红条       │
│  AiCauseAnalysisV2 ★ NEW ◀── topic_drill 题目筛选反查                       │
│                                                                             │
│  Notes Tab reads from Review:                                               │
│  ───────────────────────────                                                │
│  AiCauseAnalysisV2 ★ NEW ◀── /notes?cause_tag=X 反向链查询                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 写入流表（升级到 W14）

| # | 写入方 | 写入目标 | 触发 | 自动/手动 | 实施 Phase |
|---|---|---|---|---|---|
| W1 | Practice session.commit | ReviewItemV2(wrong_answer) | 答错 | 自动 | Phase-Practice WU-B15 |
| W2 | Practice session.commit | ReviewItemV2(flagged_persistent) | 持久标记 | 自动 | Phase-Practice WU-B16 |
| W3 | Review session.commit hook | ReviewItemV2(re_failed) | graduated/probationary 后答错 | 自动 | **本 Phase WU-R4** |
| W4 | Review POST /items | ReviewItemV2(manual_add) | 用户点"加入复盘" | 手动 | **本 Phase WU-R2** |
| W5 | Notes AI 摘要 | ReviewItemV2(note_card) | AI 摘要拆卡 | 自动 | Phase-Notes（预留） |
| W6 | Review cause-analysis | NoteV2(type=ai_cause_analysis) | "保存为笔记" | 手动 | **本 Phase WU-R5** |
| W7 | Review weekly-review | NoteV2(type=weekly_review) | "生成回顾笔记" | 手动 | **本 Phase WU-R7** |
| W8 | Review add-to-plan | RecommendationV2(type=review_session) | "加入计划" | 手动 | **本 Phase WU-R10** |
| **W9** ★ | **Practice/Review answer** | **ReviewAttemptV2.notes_json.confidence + ReviewItemV2.metadata.last_confidence/first_confidence** | **答题提交** | **自动** | **本 Phase WU-R3 + Practice WU-B17（confidence 收集 hook）** |
| **W10** ★ | **Q-Hub "练同类"** | **PracticeSessionV2(source_mode=topic_drill, config_snapshot.filter)** | **手动** | **手动** | **本 Phase WU-FR8 + Practice WU-B18** |
| **W11** ★ | **CauseCard "我不同意"** | **AiCauseAnalysisV2.dim.user_override + ReviewAttemptV2(outcome=cause_tag_overridden)** | **手动** | **手动** | **本 Phase WU-R5 + WU-FR9** |
| **W12** ★ | **probationary cron 抽查推送** | **ReviewItemV2 出现在 today queue** | **每日 cron** | **自动** | **本 Phase WU-R7** |
| **W13** ★ | **Debt redistribution** | **多个 ReviewItemV2.next_review_at + metadata.debt_status** | **手动 + cron 自动 heavy 触发** | **混合** | **本 Phase WU-R14** |
| **W14** ★ | **Hard question 标记** | **ReviewItemV2.metadata.is_hard=true** | **mismatch ≥ 2 / re_fail ≥ 3 / cron 检测** | **自动** | **本 Phase WU-R3 + WU-R14** |

---

## 4. 读取流表（升级到 R10）

| # | 读取方 | 数据源 | 用途 | 接口 |
|---|---|---|---|---|
| R1 | Review → Question | QuestionV2 | 题面 / 选项 / 解析 / category（含 l3） | JOIN on review_items_v2.question_id |
| R2 | Review → Practice | PracticeSessionAnswerV2 | 三卡聚合 + 答题历史 + confidence 历史 | GET /api/v2/practice/answers?user_id&limit=200&include_confidence=true |
| R3 | Review → Notes | NoteV2 | 题级笔记 + 周回顾数据 | GET /api/v2/notes?linked_question_id=:id |
| R4 | Home → Review | ReviewItemV2 + DebtSnapshot | today list（debt-aware 计数） | GET /api/v2/review/items?status=...&debt_aware=true |
| R5 | Home → Review | WeaknessSnapshotV2 | 弱项卡 contributions.review | SELECT ... |
| R6 | Practice result → Review | ReviewItemV2 | "已加入复盘"徽标 | GET /api/v2/review/items?question_id=:id&status=pending,in_progress,probationary |
| R7 ★ | **Practice answer page → Review** | **ReviewItemV2.metadata.is_hard** | **Practice 答题时若该题已 hard 显示红条** | GET /api/v2/practice/questions/:id/review-context |
| R8 ★ | **Q-Hub topic_drill → Review** | **AiCauseAnalysisV2.dimensions** | **筛选与 seed 错因相同的题** | 内部 service 调用 |
| R9 ★ | **Notes /notes?cause_tag=X → Review** | **AiCauseAnalysisV2** | **反向找含该 tag 的题，列出相关笔记** | GET /api/v2/notes?cause_tag=X (Phase-Notes 端点) |
| R10 ★ | **Home → Review streak** | **ReviewStreakV2 视图** | **首页 streak 计数包含复盘** | GET /api/v2/home/streak |

---

## 5. 反向流表（Review 输出被消费 · 升级到 RF8）

| # | 信号 | 消费方 | 触发 | 格式 |
|---|---|---|---|---|
| RF1 | 新 graduated/probationary | Home today list | 实时 | item.status 变化 → today list 该条目打勾或晋级 |
| RF2 | due 题数变化 | Home 卡片 | 前端 polling | count of items WHERE next_review_at <= today_end + debt-aware |
| RF3 | WeaknessSnapshot 更新 | Home 弱项卡 | WU-R7 cron 周更 | WeaknessSnapshotV2.contributions.review |
| RF4 | RecommendationV2 创建 | Home 推荐列表 | 实时 | type=review_session, status=pending |
| RF5 | NoteV2 创建（cause/weekly） | Notes 列表 | 实时 | type IN (ai_cause_analysis, weekly_review) |
| **RF6** ★ | **Hard question 状态** | **Practice 答题中 + Q-Hub 顶部** | **实时** | **item.metadata.is_hard=true → UI 红条** |
| **RF7** ★ | **Debt severity 升级** | **Home 顶部 debt summary（如适用）** | **每日 cron + 实时计算** | **debt severity ∈ {moderate+}时显示提示** |
| **RF8** ★ | **复盘 streak 推进** | **Home achievement 区** | **每日复盘完成达标时** | **review_streak_days +=1 → push 推送** |

---

## 6. 接口契约（含新增 Cross-10/11/12）

### 6.1 Review 暴露给其他 Tab 的 API 端点

| 端点 | 消费方 | 用途 |
|---|---|---|
| `GET /api/v2/review/items?question_id=:id&status=pending,in_progress,probationary` | Practice result / Q-Hub | 检查"该题是否在复盘中" |
| `GET /api/v2/review/items?next_review_at_lte=:date&status=pending,in_progress,probationary&debt_aware=true` | Home today | 今日 due 条目（debt-aware） |
| `GET /api/v2/review/items?status=graduated&limit=5&sort=-graduated_at` | Home achievement | 最近毕业题 |
| `GET /api/v2/review/debt/snapshot` | Home 顶部条 | 当前 debt severity + ramp-up 状态 |
| `GET /api/v2/review/streak` | Home achievement | 复盘连续天数 + 本周 / 本月统计 |
| **`GET /api/v2/practice/questions/:id/review-context`** | Practice answer page | **该题的 review 上下文（is_hard/source_kind/streak/last_confidence）** |
| **`GET /api/v2/notes?cause_tag=:slug`**（由 Phase-Notes 实施） | Notes search | **反向查询：找含该 tag 的笔记** |

### 6.2 Review 消费其他 Tab 的 API 端点

| 端点 | 提供方 | 用途 |
|---|---|---|
| `GET /api/v2/questions/:id` | Practice/Question | 题面 + 解析 |
| `GET /api/v2/practice/answers?user_id=:id&limit=200&include_confidence=true&include_duration=true` | Practice | 三卡聚合数据（含 confidence + duration） |
| `POST /api/v2/practice/sessions` | Practice | 创建 redo session 或 topic_drill session |
| `GET /api/v2/notes?linked_question_id=:id` | Notes | 题级笔记 |
| `POST /api/v2/notes` | Notes | 保存为笔记 / 周回顾笔记 |
| `POST /api/v2/recommendations` | Home | 创建"加入计划" |
| `GET /api/v2/profile/info` | Profile | 读取 review_daily_limit / timezone / srs_algorithm_preference |

### 6.3 Cross-10 "练同类"接口契约（详细）

调用链：

```
Q-Hub ActionBar 点 "练同类 N 道"
  → 弹 TopicDrillSetupModal
  → 用户选择 filter
  → POST /api/v2/practice/sessions
     Body: {
       source_mode: "topic_drill",
       config_snapshot: {
         topic_drill_seed_question_id: 1234,
         filter: { category_l2, cause_tags, difficulty },
         question_count: 10,
         shuffle_options: true,
         practice_mode: "per_question"
       }
     }
  → Practice 服务调 select_topic_drill_questions（[08] §6.3.3）
  → 返回 PracticeSessionV2
  → 前端跳转 /practice/sessions/:session_id?ctx=topic_drill
```

后端契约：
- Practice 服务必须支持 source_mode="topic_drill" 枚举值（依赖 Phase-Practice schema 新增）
- topic_drill session 完成后**不**自动入复盘队列；但答错时仍走 PR-R5 标准路径（如该题已 graduated 则触发 re_failed）
- **重要**：Practice session.commit hook 必须对 source_mode=topic_drill 也生效（PR-R5 hook 不限 source_mode，对所有 session 类型统一触发）

### 6.4 Cross-11 "找相关笔记"接口契约（详细）

调用链：

```
Q-Hub CauseCard 点 "找相关笔记"
  → 计算 top dim slugs（用 effective_dim，含 user_override）
  → 跳转 /notes?cause_tags=concept_confusion,formula_misremember
  → Phase-Notes 实施 GET /api/v2/notes?cause_tags=...
     - 反查 AiCauseAnalysisV2 含指定 tag 的 question_ids
     - 然后查这些 question_ids 关联的 NoteV2(linked_question_id IN ...)
     - 返回笔记列表 + tag 命中信息
```

Phase-Notes 端点契约（本 Phase 仅约定，不实施）：

```
GET /api/v2/notes
Query Params:
  - cause_tags: comma-separated slugs
  - linked_question_in: comma-separated question_ids (alternative to cause_tags)
  - limit / page
Response: NoteListResponseV2
```

### 6.5 Cross-12 Confidence 跨 Tab 流转

| 节点 | 数据写入 | 数据读取 |
|---|---|---|
| Practice answer page | 答题后弹 ConfidenceRatingPrompt | — |
| Practice session.commit | 写 ReviewAttemptV2.notes_json.confidence + ReviewItemV2.metadata.first_confidence (首次) / last_confidence | — |
| Review session.commit | 同上 + 触发 SRS confidence 路径（[14]） | — |
| Q-Hub AnswerTimeline | — | 读 attempt 时间线含 confidence badge |
| Q-Hub ConfidenceMismatchBanner | — | 读 metadata.confidence_mismatch_count |
| 三卡聚合（CardC） | — | 读 recentAnswers[].confidence 加权 |

---

## 7. Cross-13 Session 中途退出处理

### 7.1 用户行为

用户进入复盘 session（10 题），做完 3 题后关闭 tab / 浏览器。

### 7.2 系统处理（已答 vs 未答）

| 类型 | 数据 | 行为 |
|---|---|---|
| 已答 3 题 | session.commit per answer 已写入 | SRS 已推进；ReviewAttemptV2 已写入；下次打开看到这 3 题状态已变 |
| 未答 7 题 | session 中途中断 | 它们的 ReviewItemV2 状态、next_review_at、metadata 完全不变 |

### 7.3 Session 状态更新

```python
def handle_session_abandoned(session: PracticeSessionV2) -> None:
    """前端 beforeunload / 后端 session 超时 30min 时调用。"""
    if session.status not in [SessionStatus.IN_PROGRESS]:
        return

    answered_count = count_answers(session.id)
    if answered_count == 0:
        session.status = SessionStatus.ABANDONED_EMPTY
    elif answered_count < session.config_snapshot["question_count"]:
        session.status = SessionStatus.ABANDONED_PARTIAL
    else:
        session.status = SessionStatus.COMPLETED  # 全部答完即使未点 finish

    session.finished_at = utcnow()
```

### 7.4 SRS 影响

- 已答题：完整 SRS 路径已通过 commit hook 走完（advance/regress/probationary/...）
- 未答题：维持原 next_review_at——**今日 due 但被跳过 → 计入 debt overdue（每日 03:00 cron 评估）**

不存在"半 commit"——每个 answer 独立 commit。

### 7.5 跨 Tab 影响

- Home today list：已答题打勾、未答题维持显示（next_review_at <= today_end）
- Debt severity 评估：未答题数加入 overdue_count
- Review streak：今日是否达标按"已答数 ≥ daily_target_completed"判断

### 7.6 用户回归后

下次进入 `/review` 时：
- 看到原 SRS 队列（含未答题，仍然今日 due）
- DebtBar 反映新 severity（如已升级到 moderate）
- 三卡基于最新数据重算

---

## 8. Cross-14 Cause Override 高频 → Notes 建议

### 8.1 触发条件

用户对同一 cause_tag 在 30 天内 override > 5 次（说明 LLM 持续误判此 tag），系统在 Notes tab 顶部建议：

```
┌─────────────────────────────────────────────────┐
│ 💡 建议：你已多次修正"概念混淆"的诊断结果         │
│                                                  │
│ 看起来你对这个错因有自己的判断，建议为它写一篇    │
│ 专项笔记，方便以后参考。                          │
│                                                  │
│ [基于历史诊断生成草稿] [稍后]                     │
└─────────────────────────────────────────────────┘
```

### 8.2 实施

- Phase-Notes 加 hint 计算逻辑
- 数据来源：`ReviewAttemptV2(outcome=cause_tag_overridden)` 按 user_id × from_slug 聚合
- 不强制 Phase-Review 实施；预约定接口让 Phase-Notes 消费

---

## 9. Cross-15 Debt 跨 Tab 同步

### 9.1 Home today 计数 = debt-aware

```
Home today list "今日复盘 N 题" 数字来源：
  N = min(debt.daily_limit_remaining, due_count)

而非:
  N = due_count  # 原算法

具体：
  if debt.severity == "critical" and rampup_active:
    N = ramp_up_phase 推送数（10 / 15 / 20 / 25）
  elif debt.severity in ("heavy", "moderate"):
    N = daily_limit  # 30 默认
  else:
    N = min(due_count, daily_limit)
```

### 9.2 Practice 答题与 debt 的解耦

Practice 普通 session 的答题**不影响** debt（debt 仅由 review session 完成消化）。
但 wrong_answer 入队后会增加 overdue_count（如答错后 next_review_at <= today_end，且未来某日打散后）。

### 9.3 Home achievement "复盘连续天数" 定义

```python
def compute_review_streak(user_id: int, user_tz: str) -> int:
    """
    复盘连续天数：今日（或昨日，如今日还未做）往前推，
    每日"已答 ReviewAttemptV2 数 >= daily_target_completed" 算达标。
    daily_target_completed = max(5, debt.daily_limit_recommended_today * 0.5)
    """
    streak = 0
    cursor_date = today_local(user_tz)
    while True:
        attempts = count_review_attempts(user_id, date=cursor_date)
        target = compute_daily_target(user_id, date=cursor_date)
        if attempts >= target:
            streak += 1
            cursor_date -= timedelta(days=1)
        else:
            break
    return streak
```

streak 计入 Home `streak_days`（与 Practice 的 streak 合并显示，但两个数字独立维护）。

---

## 10. 时序保证（升级）

| 流向 | 保证级别 | 机制 |
|---|---|---|
| Practice → Review (W1/W2) | 同事务 | session.commit 同 DB transaction 内写 ReviewItemV2 |
| Review → Review (W3 re_failed) | 同事务 | session.commit hook 同 transaction |
| Review → Notes (W6/W7) | 同事务 | API handler 同 transaction |
| Review → Home (W8 recommendation) | 同事务 | API handler 同 transaction |
| Home ← Review (RF2 due count) | 最终一致 | 前端 staleTime=30s |
| Home ← Review (RF3 weakness) | 最终一致 | cron 每周一 02:00 |
| **Home ← Review (RF6 hard 状态)** | **实时（next refetch）** | **Practice answer page 的 review-context 端点 staleTime=10s** |
| **Home ← Review (RF7 debt)** | **每日 03:00 cron + 实时计算** | **on demand 计算 + cache 5min** |
| **Home ← Review (RF8 streak)** | **实时（事务内）** | **review attempt 写入时同步更新 streak 缓存** |
| **probationary check 推送** | **每日 02:00 cron** | **dispatch_probation_checks** |
| **Forced cause-analysis** | **异步（不阻塞 commit）** | **前端 useEffect 触发** |

---

## 11. 错误隔离（升级）

| 原则 | 实现 |
|---|---|
| 一个 Tab 写入失败不影响其他 | 每个 write 独立 try/catch |
| 跨 Tab 读取失败降级 | Review 读 Practice answers 失败 → 三卡不展示 |
| LLM 失败不阻塞 | PR-R6：错因区块独立 error boundary |
| Cron 失败不影响实时 | RF3/RF7 cron 失败 → 用上次 cache |
| 前端 hook 异常 | 每个 domain hook 独立 error state |
| **Forced cause-analysis 失败** | **不重试；用户下次访问 Q-Hub 时仍可见 mismatch banner** |
| **Topic_drill 题目不足** | **筛选 < 5 题时 fallback 到 loose 范围；< 2 题时返回 422 + 文案** |
| **Cause Override 端点失败** | **前端 toast + dim 状态回滚（不写持久化）** |
| **Probation cron 漏跑** | **下次 cron 自动追加（基于 next_review_at <= today_end）** |

### 11.1 具体降级矩阵

```
Practice answers 加载失败:
  → useSmartReviewCards 返回 { cards: [], isEmpty: true }
  → SRS 队列正常渲染

Notes 加载失败:
  → Q-Hub 笔记区块显示"加载失败，点击重试"
  → ActionBar 写笔记按钮仍可用

Review items 加载失败:
  → Home today list 显示"复盘数据加载中..."
  → 不影响 Home 其他卡片

RecommendationV2 创建失败:
  → toast "加入计划失败，请重试"
  → ReviewItemV2 状态不变

Topic_drill question selection failed:
  → 422 + "未找到足够同类题，请放宽筛选"
  → 关闭 modal 不影响其他状态

Cause Override 失败:
  → toast "修改未保存"
  → DimensionCard slug 显示回 LLM 原值
```

---

## 12. 数据一致性边界（升级）

| 场景 | 处理 |
|---|---|
| 用户在 Practice 答错，同时在 Review 查看同题 | Practice commit → 新 ReviewItemV2；Review 下次 refetch 可见 |
| Probationary 后 Practice 出该题 | Practice 出题不检查 probationary 状态；答错触发 re_failed 新行（PR-R5） |
| Q-Hub "加入复盘"已有 active 行 | 409 + "该题已在复盘队列中" |
| **跨设备 attempt 并发** | **OptimisticLockError（[05] §10）；后写胜出** |
| **Confidence 与 Recall 不一致**（用户填了 confidence=guess + recall_text） | **以 confidence 为准；recall_text 仍记录但不享受加成** |
| **Topic_drill 题目部分已 graduated** | **优先选未 graduated；如不足则放宽（避免空 session）** |
| **Cause tag override 后聚类延迟** | **CardA/Insights 立即用 effective_slug；缓存 5min** |

---

## 13. Phase 间修订条目（A0 §11 同步）

本文涉及的 schema / 接口变更需要在 A0 §11 修订清单中同步标记：

| 修订点 | 涉及 Phase | 说明 |
|---|---|---|
| Practice source_mode 加 `topic_drill` enum | Phase-Practice | 需要在 Practice schema migration 中追加 |
| Practice 答题写入 confidence + first_confidence | Phase-Practice | 答题端点 body 增加 confidence 字段；hook 写入 ReviewItemV2.metadata |
| GET /practice/questions/:id/review-context 端点 | Phase-Practice 或本 Phase | 提供给 Practice answer page 的 join 数据 |
| Notes /notes?cause_tags=... query 参数 | Phase-Notes | Notes Phase 实施时消费 |
| Notes Cause Override 高频建议（Cross-14） | Phase-Notes | Notes Phase 实施 |
| Home review streak 端点 | Phase-Home | 提供给本 Phase 消费 + Home Achievement 区使用 |

---

## 14. 引用矩阵

| 本文被引用 |
|---|
| [03-Backend-WU](./03-Backend-WU.md) WU-R4 / WU-R10 / WU-R14 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR7 / WU-FR8 / WU-FR11 |
| [08-Question-Hub-Page](./08-Question-Hub-Page.md) ctx 跨 tab 导航 + 练同类 + 找相关笔记 |
| [11-Testing](./11-Testing.md) 跨 tab 集成测试 |
| [12-Debt-Management](./12-Debt-Management.md) Cross-15 debt 同步 |
| [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) Cross-11 反向链 query |
| [14-Confidence-Rating](./14-Confidence-Rating.md) Cross-12 confidence 流转 |
| A0 §11 修订条目同步 |
