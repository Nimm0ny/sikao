# Phase-Review · 12 · Debt Management

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §14（Debt-1 ~ Debt-8）· [05-SRS-Engine](./05-SRS-Engine.md) · [01-Boundary-Rules](./01-Boundary-Rules.md) PR-R9

---

## 1. 为什么需要复盘债务管理

公考备考典型断档场景（已观察）：
- 周末加班 → 连续 3-5 天没碰复盘
- 出差/出游 → 连续 7-14 天断档
- 备考前期"先刷题不复盘"心态 → 错题累积 200+ 道但 SRS 队列从未消化

不做债务管理会导致 3 类硬翻车：
1. **打开即崩塌**：用户回归当天打开 `/review`，看到 "今日 due 230 题"，直接放弃
2. **SRS 节奏失真**：所有逾期题 next_review_at 都是过去时，再做时算法无法判断"该升档还是该回退"
3. **三卡聚合饱和**：CardC "预测再错" 因为 `days_overdue` 权重过高，把全部题挤进同一张卡

本文定义：何谓"债务"、如何度量、如何打散、如何 ramp-up、如何检测"难题专项"。

---

## 2. 核心概念

### 2.1 复盘债务（Review Debt）

**定义**：用户的 `ReviewItemV2.next_review_at` 已经过期但条目仍处于 active 状态的总数。

```python
def compute_debt(user_id: int, user_tz: str) -> ReviewDebtSnapshot:
    today_end = get_today_end(user_tz)
    overdue_items = db.query(ReviewItemV2).filter(
        ReviewItemV2.user_id == user_id,
        ReviewItemV2.status.in_([ReviewItemStatus.PENDING, ReviewItemStatus.IN_PROGRESS]),
        ReviewItemV2.next_review_at <= today_end,
    ).all()

    if not overdue_items:
        return ReviewDebtSnapshot.empty()

    oldest_overdue_days = max(
        (today_end - item.next_review_at).days for item in overdue_items
    )
    return ReviewDebtSnapshot(
        overdue_count=len(overdue_items),
        oldest_overdue_days=oldest_overdue_days,
        debt_severity=classify_severity(len(overdue_items), oldest_overdue_days),
    )
```

### 2.2 债务等级（Debt Severity）

| 等级 | 触发条件 | UI 表现 | 系统行为 |
|---|---|---|---|
| `none` | overdue=0 | 不显示债务条 | 正常推送 due |
| `light` | 1 ≤ overdue ≤ daily_limit | 灰色提示"今日 N 道复盘" | 正常推送 due |
| `moderate` | daily_limit < overdue ≤ daily_limit × 3 | 黄色条"已积压 N 道，建议今日完成 K 道" | 推送 daily_limit；剩余进入 `deferred` |
| `heavy` | daily_limit × 3 < overdue ≤ daily_limit × 7 | 橙色条"已积压 N 道，系统将在 X 天内打散" | 触发**打散重排**（§3） |
| `critical` | overdue > daily_limit × 7 OR oldest > 14d | 红色条"已严重积压，启用回归模式" | 触发**回归 ramp-up**（§4） |

`daily_limit` 默认 30，可由 `profile_v2.info.review_daily_limit` 覆盖（10 ~ 100）。

### 2.3 三种状态机修饰

债务管理给 ReviewItemV2 状态加 3 个**修饰位**（写在 metadata_json，不改 status 主字段）：

```json
{
  "debt_status": "due | deferred | redistributed | ramp_up_protected",
  "debt_assigned_date": "2026-05-21",
  "debt_redistributed_to": "2026-05-25"
}
```

| 修饰位 | 含义 |
|---|---|
| `due` | 正常 due（next_review_at 在 today_end 之前，且未被任何打散/限流挪动） |
| `deferred` | 因今日 daily_limit 已满被推到下一日（不算逾期，明日重新评估） |
| `redistributed` | 被打散重排到未来 N 天（next_review_at 已被改写，原过期时间存 metadata.original_overdue_at） |
| `ramp_up_protected` | 处于回归保护期，强制不进队，待 ramp_up 阶段结束自动解锁 |

---

## 3. 打散重排（Redistribution）

### 3.1 触发条件

满足任一即触发：
- `debt_severity = heavy`（overdue > daily_limit × 3）
- 用户从 critical 或 heavy 阶段执行了"清账（reset debt）"操作
- cron 每日 03:00 检测到当前用户 debt_severity ≥ heavy 且尚未打散

### 3.2 算法

```python
def redistribute_debt(user_id: int, debt: ReviewDebtSnapshot, user_tz: str) -> int:
    """
    把所有 overdue 条目均匀分布到未来 spread_days 天。
    spread_days = ceil(overdue_count / daily_limit)，cap at 14 天。
    返回被打散的条目数。
    """
    daily_limit = get_user_daily_limit(user_id)
    spread_days = min(14, math.ceil(debt.overdue_count / daily_limit))

    overdue_items = fetch_overdue_items(user_id, user_tz)
    # 按"原 next_review_at 越早越优先"排序，老题先做
    overdue_items.sort(key=lambda i: i.next_review_at)

    today_end = get_today_end(user_tz)
    for idx, item in enumerate(overdue_items):
        target_day = idx // daily_limit  # 0, 1, 2, ...
        new_next = today_end + timedelta(days=target_day)

        # 写 audit before 改字段
        record_attempt(item, ReviewAttemptOutcome.DEBT_REDISTRIBUTED, {
            "original_overdue_at": item.next_review_at.isoformat(),
            "redistributed_to": new_next.isoformat(),
            "spread_days": spread_days,
        })

        item.metadata_json["debt_status"] = "redistributed"
        item.metadata_json["debt_redistributed_to"] = new_next.date().isoformat()
        item.metadata_json["original_overdue_at"] = item.next_review_at.isoformat()
        item.next_review_at = new_next
        bump_version(item)  # 乐观锁

    return len(overdue_items)
```

### 3.3 打散后的可见行为

| 用户视角 | 系统视角 |
|---|---|
| 今日复盘 = `daily_limit` 题（不再爆炸） | overdue=0 in DB |
| 顶部条："已为你打散 N 道积压题，分布在未来 X 天" | 所有原 overdue 行 metadata.debt_status=redistributed |
| 用户提前完成今日 → 可点"加做明日 K 道"（手动消化） | 提前完成不自动消化未来日（保留节奏） |
| 用户答对 → 进入正常 SRS（基于打散后的 streak） | streak 不被打散动作修改 |

### 3.4 打散与 SRS 的边界

打散**不影响 SRS 算法状态**：
- `correct_streak` 不动
- `algorithm_version` 不动
- 只动 `next_review_at` + metadata 修饰位
- 打散后用户答对 → `advance_on_correct` 用当时 streak 计算下一个间隔（与是否曾被打散无关）

---

## 4. 回归 Ramp-up（连续断档 ≥ 7 天）

### 4.1 触发条件

```python
def should_trigger_rampup(user_id: int) -> bool:
    last_attempt = get_last_review_attempt(user_id)
    if not last_attempt:
        return False  # 新用户走新手路径，不走 ramp-up
    days_since_last = (utcnow() - last_attempt.attempted_at).days
    return days_since_last >= 7
```

### 4.2 Ramp-up 节奏表

| Day | 推送上限 | 选题策略 |
|---|---|---|
| 1（回归首日） | min(10, daily_limit) | 优先 `re_failed` + `manual_add`（高用户主动性） |
| 2 | min(15, daily_limit) | 加入 `wrong_answer` 中错误次数最多的 top 5 |
| 3 | min(20, daily_limit) | 加入 7 天内 graduated 的 probationary check（如有） |
| 4 | min(25, daily_limit) | 进入正常 daily_limit |
| 5+ | daily_limit | 完全恢复；剩余 overdue 进入打散流程 |

### 4.3 Ramp-up 期间的"保护"

```json
ReviewItemV2.metadata_json = {
  "debt_status": "ramp_up_protected",
  "ramp_up_phase": "day_2",
  "ramp_up_started_at": "2026-05-21T00:00:00+08:00",
  "ramp_up_unlock_at": "2026-05-26T00:00:00+08:00"
}
```

ramp-up 期间：
- 未被选中推送的 `overdue` 行的 `next_review_at` **不被打散**（避免打散与 ramp-up 双重干扰）
- ramp-up 结束（day 5）时，剩余 overdue 触发一次打散（§3）
- 期间不调用 LLM cause-analysis 自动建议（避免回归首日信息爆炸）

### 4.4 Ramp-up 与 streak 的关系

ramp-up **不重置** correct_streak。原因：
- 用户曾经记住的内容不会因为休假就清零
- 重置 streak 会让 graduated 边缘的题（streak=3）退到 streak=0，浪费用户已投入精力
- 但首次答错时仍触发 SRS-3 回退一档（与正常路径一致）

---

## 5. 难题专项（Hard Question Cohort）

### 5.1 定义

满足以下任一条件即标记 `is_hard=true`（写 metadata_json）：

| 条件 | 阈值 |
|---|---|
| `re_fail_count` | ≥ 3（毕业后又错 3 次） |
| `total_wrong_count` | ≥ 5 + 历史正确率 < 30% |
| 平均答题用时 | 该题 > 用户平均 × 2 倍 + 错过 ≥ 2 次 |
| LLM 错因 dimensions[].severity | 连续 2 次包含 `high` |

`re_fail_count` 在 WU-R4 hook 中维护：每次 graduated 后再失败，原 graduated 行的 metadata.re_fail_count += 1（注意：这里**改的是原 graduated 行**，不是新 re_failed 行）。

### 5.2 难题专项的系统行为

| 维度 | 行为 |
|---|---|
| 复盘队列优先级 | 在三卡 CardA "高频错点" 中权重 ×2 |
| Q-Hub UI | 题目顶部红条 "这道题你已多次重复犯错，建议深度分析" |
| Cause-Analysis | 自动触发深度分析（不计入 daily 配额，使用 `cause_analysis_deep` prompt 变体） |
| Insights 错因聚类 | 难题在条形图中用 `severity=critical` 标色 |
| SRS 节奏 | 答对后加成被阻止（multiplier cap 在 ×1.0，recall/certain 不翻倍）；但 unsure ×0.5 惩罚保留（`min(1.0, multiplier)`） |

### 5.3 难题"出狱"

满足任一即清除 `is_hard` 标记：
- 连续 4 次答对（即 graduated 后 + 30 天 probationary check 也通过）
- 用户在 Q-Hub 手动点 "我现在掌握了" 触发 fresh start（streak=0, is_hard=false, re_fail_count 不清零作为审计）

---

## 6. UI 行为契约

### 6.1 复盘 Tab 顶部 Debt Bar

永远占据 1 行（即使 severity=none 也展示，强化日常感知，但 severity=none 时极简化为"今日 N 道"）。

```
┌─────────────────────────────────────────────────────────────┐
│  📚 今日复盘 12 / 30  · 已完成 5  · 已掌握 +3 (本周)        │  ← severity=none/light
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚠️ 已积压 65 道，建议今日先做 30 道；剩余明日继续           │  ← severity=moderate
│  [今日先做 30] [全部清账(打散)]                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🟧 已积压 120 道；系统已打散到未来 4 天，今日 30 道          │  ← severity=heavy（已打散后）
│  [今日 30] [查看打散计划]                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🚨 你已 11 天未复盘，已启用回归保护：今日仅 10 道精选        │  ← severity=critical (ramp-up day 1)
│  Day 1/5 · 明日 15 道 · [开始回归] [跳过保护]                │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 完成后的反馈

- 完成今日推荐数 → 顶部条变绿 + "今日复盘已达标"
- 用户主动加做 → 不阻止，但提示"继续节奏可能影响明日记忆窗口"
- 用户跳过保护（critical 状态） → 弹确认对话框 "保护可避免一次性推送过多导致放弃，确认跳过？"

### 6.3 打散计划查看

`[查看打散计划]` 按钮打开 modal：

```
打散计划（120 道 → 未来 4 天）
─────────────────────────────────
今日 (5/21):  30 道  ← 当前
明日 (5/22):  30 道
后天 (5/23):  30 道
5/24:        30 道
─────────────────────────────────
[关闭] [取消打散，恢复原节奏]  ← 取消会回到 critical
```

---

## 7. 数据 Schema 增量

### 7.1 ReviewItemV2.metadata_json 新增字段

```json
{
  "debt_status": "due | deferred | redistributed | ramp_up_protected",
  "debt_assigned_date": "YYYY-MM-DD",
  "debt_redistributed_to": "YYYY-MM-DD",
  "original_overdue_at": "ISO datetime",
  "ramp_up_phase": "day_1 | day_2 | day_3 | day_4",
  "ramp_up_started_at": "ISO datetime",
  "ramp_up_unlock_at": "ISO datetime",
  "is_hard": false,
  "re_fail_count": 0,
  "hard_marked_at": "ISO datetime"
}
```

### 7.2 ReviewAttemptV2.outcome 新增枚举

| outcome | notes_json shape |
|---|---|
| `DEBT_REDISTRIBUTED` | `{ original_overdue_at, redistributed_to, spread_days }` |
| `DEBT_DEFERRED` | `{ deferred_from, deferred_to, daily_limit_at_time }` |
| `RAMPUP_STARTED` | `{ started_at, unlock_at, days_since_last }` |
| `RAMPUP_PHASE_CHANGED` | `{ from_phase, to_phase }` |
| `RAMPUP_COMPLETED` | `{ started_at, completed_at, total_protected_count }` |
| `HARD_MARKED` | `{ trigger_condition, re_fail_count, total_wrong_count }` |
| `HARD_CLEARED` | `{ cleared_by: "user_manual" | "auto_4_correct_streak" }` |

### 7.3 profile_v2.info 新增字段

```json
{
  "review_daily_limit": 30,
  "review_debt_redistribute_enabled": true,
  "review_rampup_enabled": true,
  "review_hard_question_auto_deep_analysis": true
}
```

四个字段都有默认值，用户在 Profile/Settings 中可调。

---

## 8. 后端实现要点

### 8.1 新增模块文件

```
services/api/src/sikao_api/modules/review/application/
├── debt_service.py              ← 主入口
├── debt_redistribution.py       ← 打散算法
├── debt_rampup.py               ← ramp-up 状态机
└── debt_hard_question.py        ← 难题检测与标记
```

### 8.2 关键端点

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| get_debt_snapshot | GET | `/api/v2/review/debt/snapshot` | 当前债务等级 + 计数 + ramp-up 状态 |
| trigger_redistribute | POST | `/api/v2/review/debt/redistribute` | 用户主动触发打散（severity ≥ moderate 才允许） |
| skip_rampup | POST | `/api/v2/review/debt/skip-rampup` | 用户跳过保护（写 audit） |
| get_redistribute_plan | GET | `/api/v2/review/debt/plan` | 已打散的未来 N 日分布预览 |

### 8.3 Cron Job

| Job | 时机 | 职责 |
|---|---|---|
| `debt_severity_evaluator` | 每日 03:00（用户本地时区） | 计算每用户 debt_severity；severity=heavy 自动触发 redistribute；critical 触发 ramp-up |
| `hard_question_detector` | 每日 03:30 | 扫描 metadata.re_fail_count ≥ 3 等条件，写 is_hard 标记 |
| `rampup_phase_advancer` | 每日 00:30（用户本地时区） | 推进 ramp-up phase（day_1 → day_2 → ...） |

每个 cron job 都必须幂等（重复执行不产生副作用）。

### 8.4 边界规则

PR-R9 完整定义见 [01-Boundary-Rules](./01-Boundary-Rules.md)：
- daily_limit 不可绕过（即使用户手动加做，不会越过 next_review_at）
- 打散不修改 streak
- ramp-up 期间不打散
- HARD 标记不影响数据查询（list/detail 端点 status 不变）

---

## 9. 前端实现要点

### 9.1 新增 Hook

```
packages/domain/src/review/
├── useDebtSnapshot.ts           ← 顶部条数据源
├── useDebtRedistributePlan.ts   ← 打散计划 modal 数据
├── useRampupStatus.ts           ← ramp-up phase + unlock 时间
└── useHardQuestionMarker.ts     ← Q-Hub is_hard 状态
```

### 9.2 新增组件

```
apps/web/src/components/review/
├── DebtBar.tsx                  ← 顶部条（5 种 severity 模式）
├── DebtRedistributeModal.tsx    ← 打散计划 modal
├── DebtRedistributeCTA.tsx      ← 主动打散按钮
├── RampupBanner.tsx             ← critical 状态 banner
├── RampupPhaseIndicator.tsx     ← Day N/5 进度
└── HardQuestionBadge.tsx        ← Q-Hub 红条 + 题卡角标
```

### 9.3 与 SRS 队列的渲染优先级

```
DebtBar (永远顶部)
   ↓
[ramp-up 期间] RampupBanner（替代正常 SRS 队列）
   ↓
[正常/打散后] SrsQueue（SmartCardsContainer 在下）
```

---

## 10. 测试矩阵

| # | 场景 | 初始 | 操作 | 期望 |
|---|---|---|---|---|
| D1 | severity=none | overdue=0 | GET snapshot | severity=none, count=0 |
| D2 | severity=light | overdue=10, daily=30 | GET snapshot | severity=light |
| D3 | severity=moderate | overdue=50, daily=30 | GET snapshot | severity=moderate |
| D4 | severity=heavy 自动打散 | overdue=120, daily=30, cron run | cron | 全部 redistributed，未来 4 天均分 |
| D5 | severity=critical 触发 ramp-up | last_attempt=12d ago | cron | ramp_up_started, day_1, 推 10 道 |
| D6 | ramp-up day 推进 | day_1 已完 | cron 第二天 | day_2，推 15 道 |
| D7 | ramp-up 完成 | day_5 结束 | cron | rampup_completed + 触发一次打散 |
| D8 | ramp-up 期间不打散 | day_2 + overdue=120 | cron | overdue 不动，仅 ramp-up 推送 |
| D9 | 打散不影响 streak | streak=2 + 被打散 | redistribute | streak 仍=2 |
| D10 | re_fail 触发 hard | streak=2 graduated 后又错 3 次 | 第 3 次 commit | is_hard=true, re_fail_count=3 |
| D11 | hard 题强制标准间隔 | is_hard=true, recall=true | advance_on_correct | next 不翻倍（覆盖 SRS-7 加成） |
| D12 | hard 题手动 fresh start | is_hard=true | 用户点"我掌握了" | streak=0, is_hard=false, re_fail_count 保留 |
| D13 | 用户跳过 ramp-up | severity=critical | POST skip-rampup | rampup 解除 + 立即触发打散 |
| D14 | 主动加做不破节奏 | 今日 30 已完 | 用户点"加做 10 道" | 推 10 道但 next_review_at 不前移 |
| D15 | daily_limit=10（自定义） | profile.review_daily_limit=10 | severity 计算 | 阈值按 10 算（moderate=30, heavy=70） |

---

## 11. 与既有系统的边界

### 11.1 与 SRS Engine

- SRS 只负责**单题间隔计算**；Debt 负责**全局队列流量调度**
- SRS 不感知 debt_status；advance/regress 永远基于当前 streak
- 打散/ramp-up 仅修改 `next_review_at` 和 metadata，不动 SRS 主字段

### 11.2 与 Smart Card S-front 聚合

- Card B "长期未碰" 使用 `original_overdue_at`（如有）而不是被打散后的 next_review_at
- Card C "预测再错" 在 ramp-up 期间隐藏（避免心理负担）
- Card A "高频错点" 中 `is_hard=true` 题权重 ×2

### 11.3 与 Cause Analysis

- HARD 题自动触发 deep analysis，使用 `cause_analysis_deep` prompt 变体
- deep analysis 不计入 daily_quota（独立桶 `daily_deep_quota=5`）
- deep analysis 结果在 Q-Hub 红条中可见，并自动 evolution_context 注入

### 11.4 与跨 Tab Wiring

- Home today list 显示数字基于 debt-aware 后的"今日推荐数"，不是原始 overdue 数
- Practice 答错若该题已 is_hard=true，session.commit 后不另外提示（避免噪音）

### 11.5 与 Weekly Review

- 周回顾摘要包含 `debt_recovery_count`（本周打散的题数）
- biggest_concern 维度可包含 hard_question_emergence（本周新晋难题数）

---

## 12. 配置默认值速查

| 参数 | 默认值 | 可调范围 | 来源 |
|---|---|---|---|
| `review_daily_limit` | 30 | 10 ~ 100 | profile_v2.info |
| `redistribute_max_spread_days` | 14 | 7 ~ 30 | 系统常量 |
| `rampup_threshold_days` | 7 | 不可调 | 系统常量 |
| `rampup_total_phases` | 5 | 不可调 | 系统常量 |
| `hard_re_fail_threshold` | 3 | 不可调 | 系统常量 |
| `hard_total_wrong_threshold` | 5 | 不可调 | 系统常量 |
| `hard_accuracy_threshold` | 30% | 不可调 | 系统常量 |
| `daily_deep_quota` | 5 | 不可调 | 系统常量 |
| `severity_moderate_multiplier` | 1× | — | daily_limit × 1 |
| `severity_heavy_multiplier` | 3× | — | daily_limit × 3 |
| `severity_critical_multiplier` | 7× | — | daily_limit × 7 OR oldest > 14d |

---

## 13. 引用矩阵

| 本文被引用 |
|---|
| [00-Decisions](./00-Decisions.md) §14 Debt 系列 |
| [01-Boundary-Rules](./01-Boundary-Rules.md) PR-R9 |
| [02-Data-Model](./02-Data-Model.md) §3.1 metadata_json + §2.3 outcome 枚举 |
| [03-Backend-WU](./03-Backend-WU.md) WU-R14 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR14 |
| [05-SRS-Engine](./05-SRS-Engine.md) §5 边缘情况 |
| [07-Smart-Review-Aggregation](./07-Smart-Review-Aggregation.md) §6 hard 加权 |
| [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) Home today 计数源 |
| [11-Testing](./11-Testing.md) Debt 测试矩阵 |
