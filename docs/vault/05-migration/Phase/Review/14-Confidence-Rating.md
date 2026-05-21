# Phase-Review · 14 · Confidence Rating

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §15（Confidence-1 ~ Confidence-7）· [05-SRS-Engine](./05-SRS-Engine.md) · [01-Boundary-Rules](./01-Boundary-Rules.md) PR-R11

---

## 1. 为什么需要信心评级

公考备考普遍痛点：**蒙对的题和真正会的题，SRS 待遇相同**。

观察到的具体场景：
- 用户在四选一题中蒙对（25% 概率），SRS streak +1，再蒙对一次直接 graduated
- 实际考试中遇到同类型题目仍然不会
- 用户从复盘 Tab 自我感觉 "我已经掌握 80% 错题"，但模考正确率没明显提升

**根因**：SRS 仅依赖 `is_correct` 二元信号，无法识别"答对原因"——是真理解、运气好、还是侥幸。

**解法**：引入 4 档主观信心评级（confidence rating），让用户在每次答题后告诉系统"你有多确定"。

---

## 2. 4 档信心评级定义

| 档位 | 值 | 中文标签 | 含义 | UI 颜色 |
|---|---|---|---|---|
| 1 | `guess` | 完全猜 | 完全不会，随便选了一个 | 灰色 |
| 2 | `unsure` | 半懵 | 排除了 1-2 个选项，剩下凭感觉 | 黄色 |
| 3 | `likely` | 比较确定 | 用方法做出来了，但没 100% 把握 | 蓝色 |
| 4 | `certain` | 完全确定 | 知识点扎实，绝对正确 | 绿色 |

数据库存储：枚举字符串（避免数值改动时的破坏性）。
- `notes_json.confidence` 字段值 ∈ {`"guess"`, `"unsure"`, `"likely"`, `"certain"`, `null`}
- `null` = 用户跳过未填（强制规则见 §6）

---

## 3. 信心评级 × is_correct 矩阵

| confidence | is_correct=True | is_correct=False |
|---|---|---|
| `guess` (1) | 蒙对：streak 不变（即使 advance 也不计入毕业进度） | 蒙错：normal regress（streak -1） |
| `unsure` (2) | 半懵答对：streak +1 但**间隔减半** | 半懵答错：normal regress + UI 强制 recall |
| `likely` (3) | 正常 advance（标准间隔） | 正常 regress |
| `certain` (4) | 提前毕业候选：streak +1，且如果次档已是最后一档触发**早毕业**（详见 §4） | 警示：用户错估自己 → UI 强制 cause-analysis 触发 |

### 3.1 蒙对不进毕业的处理

```python
def advance_on_correct(item, used_recall, confidence, user_tz):
    item.correct_streak  # 保留旧值

    if confidence == "guess":
        # 蒙对：streak 不变；next_review_at 仍按原 streak 计算
        # 即"今天蒙对，明天再问一次"
        item.next_review_at = compute_next_review(
            item.correct_streak,  # 不递增
            used_recall=False,    # guess 不享受 recall 加成
            user_tz=user_tz,
        )
        record_attempt(item, ReviewAttemptOutcome.CORRECT, {
            "confidence": "guess",
            "advance_skipped": True,
            "reason": "guess_correct_does_not_count",
        })
        return  # 不递增 streak

    # 其他档位：streak +1
    item.correct_streak += 1
    # ... 后续按 §4 规则
```

### 3.2 半懵答对的间隔减半

```python
if confidence == "unsure":
    # streak 已递增；间隔在原档基础上 ×0.5（不四舍五入，向下取整）
    base_interval = INTERVALS[item.correct_streak - 1]  # streak 已 +1，所以减一
    halved_interval = max(1, base_interval // 2)
    item.next_review_at = today_end + timedelta(days=halved_interval)
```

效果（基于 SRS-1 修订版 4 档间隔 `[1, 3, 7, 21]`）：
- streak=0 → 1 答对 unsure → next=1d (1//2=0, max 1)
- streak=1 → 2 答对 unsure → next=3//2=1d
- streak=2 → 3 答对 unsure → next=7//2=3d
- streak=3 → 4 答对 unsure（即将毕业）→ 不毕业，next=21//2=10d

注意：unsure 答对**不毕业**，即使 streak 达到 GRADUATION_THRESHOLD 也强制再做一次（写 metadata.unsure_blocked_graduation=true，下次 likely+ 才允许毕业）。

> **recall 抵消半懵惩罚**：如果 used_recall=True，multiplier 为 ×1.0（不减半也不加成），因为费曼复述证明了一定程度的理解。详见 §4 multiplier 表。

### 3.3 完全确定的早毕业

```python
if confidence == "certain":
    item.correct_streak += 1
    # 如果当前 streak ≥ GRADUATION_THRESHOLD - 1（再答对一次就毕业）
    # 且 used_recall=True（费曼复述也填了）
    # 触发 early_graduated（提前进入 probationary，不直接 graduated）
    if item.correct_streak >= GRADUATION_THRESHOLD - 1 and used_recall:
        transition_to_probationary(item, user_tz=user_tz)  # ← 走 probationary，不直接 graduated
        item.metadata_json["early_graduated"] = True
        record_attempt(item, ReviewAttemptOutcome.PROBATION_ENTERED, {
            "early_graduated": True,
            "trigger": "certain_with_recall",
        })
        return
    # 否则正常 advance
```

> **注意**：早毕业仍走 probationary 阶段（30d 后系统抽查），不直接进 graduated。
> 与 [05-SRS-Engine](./05-SRS-Engine.md) §5 Branch 4 保持一致。

### 3.4 完全确定但答错（错估自我）

```python
if confidence == "certain" and not is_correct:
    # 用户自信但答错 = 严重知识漏洞，强制深度处理
    # 1. 标记 metadata_json.confidence_mismatch = True
    item.metadata_json["confidence_mismatch_count"] = item.metadata_json.get("confidence_mismatch_count", 0) + 1

    # 2. 触发 cause-analysis 强制弹出（不计入 daily_quota）
    schedule_forced_cause_analysis(item.id, user_id, reason="confidence_mismatch")

    # 3. 写 audit
    record_attempt(item, ReviewAttemptOutcome.CONFIDENCE_MISMATCH, {
        "confidence": "certain",
        "is_correct": False,
        "mismatch_count": item.metadata_json["confidence_mismatch_count"],
    })

    # 4. 正常 regress
    regress_on_incorrect(item, user_tz)
```

如果同一题 `confidence_mismatch_count >= 2` → 自动标记 `is_hard=true`（参见 [12-Debt-Management §5](./12-Debt-Management.md#5-难题专项-hard-question-cohort)）。

---

## 4. 与 SRS-7 费曼复述加成的协同

修订前的 SRS-7：`if used_recall: interval *= 2`

修订后（信心 + recall 复合规则）：

| confidence | used_recall | 间隔倍数 |
|---|---|---|
| `guess` | any | × 1（蒙对不享受加成） |
| `unsure` | False | × 0.5（半懵减半） |
| `unsure` | True | × 1（recall 抵消半懵惩罚，但不再翻倍） |
| `likely` | False | × 1（标准） |
| `likely` | True | × 1.5（介于 1 和 2 之间） |
| `certain` | False | × 1（不享受加成；要享受必须填 recall） |
| `certain` | True | × 2（最高加成 + 触发 early graduated） |

代码：

```python
def apply_confidence_recall_multiplier(base_interval: int, confidence: str, used_recall: bool) -> int:
    multiplier = {
        ("guess", True): 1.0, ("guess", False): 1.0,
        ("unsure", False): 0.5, ("unsure", True): 1.0,
        ("likely", False): 1.0, ("likely", True): 1.5,
        ("certain", False): 1.0, ("certain", True): 2.0,
    }.get((confidence, used_recall), 1.0)
    return max(1, int(base_interval * multiplier))
```

---

## 5. UI 时序契约

### 5.1 答题完成后的 UI 流

```
用户提交答案
  ↓
显示正确/错误 + 解析（既有）
  ↓
弹出 ConfidenceRatingPrompt
  ┌──────────────────────────────────┐
  │  你刚才答这题有多确定？          │
  │  [完全猜] [半懵] [比较确定] [完全确定] │
  │                                  │
  │  [跳过]（仅 likely 默认）         │
  └──────────────────────────────────┘
  ↓
用户选择 → 写入 notes_json.confidence + advance/regress 路径
  ↓
[unsure 答对 OR certain 答错] → 弹出 FeynmanRecall 强制
[其他] → FeynmanRecall 可选
  ↓
[certain 答错] → 自动后台异步触发 cause-analysis
  ↓
显示下一题 / 完成 session
```

### 5.2 强制 vs 可选

| 场景 | 弹出模式 | 跳过行为 |
|---|---|---|
| 默认（首次答此题） | 弹出，可跳过 | 跳过 = `confidence=null` 写入；但下一次重做必须填 |
| `unsure` + 答对 | recall 强制弹出 | recall 不可跳；不填则 session 不能 next |
| `certain` + 答错 | recall + cause-analysis 双强制 | recall 不可跳；cause-analysis 异步进行不阻塞 |
| 该题 `confidence_mismatch_count ≥ 1` | confidence 强制弹出 | 不可跳过 |
| 该题 `is_hard=true` | confidence 强制弹出 | 不可跳过 |
| **ramp-up 保护期间** | confidence 弹出但 **certain 选项隐藏**（Confidence-7） | 用户只能选 guess/unsure/likely |

### 5.3 跳过的处理

`confidence=null` 写入时：
- streak 按 `likely`（档 3）等价处理（保守默认，不奖励不惩罚）
- 不享受 recall 加成
- 不触发任何 forced 路径
- metadata.confidence_skipped_count += 1

如果 `confidence_skipped_count > 5` 在最近 30 题内 → UI 提示 "持续跳过会让 SRS 失准，建议至少做大致选择"，并下一次强制弹出。

---

## 6. 数据 Schema 增量

### 6.1 ReviewAttemptV2.notes_json 字段

```json
{
  "confidence": "guess | unsure | likely | certain | null",
  "confidence_skipped": false,
  "confidence_prompted_forced": false,
  "advance_skipped_due_to_guess": false,
  "early_graduated": false,
  "confidence_mismatch": false,
  "recall_text": "...",
  "interval_multiplier_applied": 1.0
}
```

### 6.2 ReviewItemV2.metadata_json 字段

```json
{
  "confidence_mismatch_count": 0,
  "confidence_skipped_count": 0,
  "unsure_blocked_graduation": false,
  "early_graduated": false,
  "last_confidence": "likely"
}
```

`last_confidence` 用于 Q-Hub UI 显示"上次你说的确定度"，帮助用户回忆。

### 6.3 ReviewAttemptV2.outcome 新增

| outcome | 触发 | notes_json shape |
|---|---|---|
| `CONFIDENCE_RATED` | 用户提交了 confidence（已含在既有 CORRECT/INCORRECT 中作为 notes 字段；无需独立 outcome） | — |
| `CONFIDENCE_MISMATCH` | certain + is_correct=False | `{ confidence, is_correct, mismatch_count }` |

`CONFIDENCE_RATED` 不另起 outcome，复用 CORRECT/INCORRECT 的 notes_json 即可。
`CONFIDENCE_MISMATCH` 是独立 audit 事件，便于查询"信心错估"统计。

---

## 7. 后端实施要点

### 7.1 端点修订（既有）

```
POST /api/v2/review/items/:id/attempt
Body 新增：
  confidence: "guess" | "unsure" | "likely" | "certain" | null
  recall_text: string | null
  is_correct: bool
  user_answer: string
```

```
POST /api/v2/practice/sessions/:id/answers/:question_id (Practice 答题)
Body 新增：
  confidence: ... 同上
  recall_text: ... 同上（仅 review session 收集；普通 practice session 收集 confidence 不收 recall）
```

注意：Practice 普通 session 也收集 confidence——这样首次答错的题进入复盘队列时，原始 confidence 就已经记录（用于 §5.2 判断是否首次"自信答错"）。

### 7.2 SRS 路径整合

`advance_on_correct` / `regress_on_incorrect` 函数签名增加 `confidence: str | None`：

```python
def advance_on_correct(
    item: ReviewItemV2,
    used_recall: bool,
    confidence: str | None,
    user_tz: str,
) -> None:
    # confidence=None → treat as "likely"（保守默认）
    effective_confidence = confidence or "likely"

    # 1. guess 不递增
    if effective_confidence == "guess":
        # ... §3.1
        return

    # 2. 递增
    item.correct_streak += 1
    item.metadata_json["last_confidence"] = effective_confidence

    # 3. unsure blocking graduation
    will_graduate = item.correct_streak >= GRADUATION_THRESHOLD
    if will_graduate and effective_confidence == "unsure":
        # 强制再做一次，不毕业
        item.correct_streak = GRADUATION_THRESHOLD - 1  # 卡在毕业前一档
        item.metadata_json["unsure_blocked_graduation"] = True

    # 4. certain + recall + 临门一脚 → early graduated
    if effective_confidence == "certain" and used_recall and item.correct_streak >= GRADUATION_THRESHOLD - 1:
        item.status = ReviewItemStatus.GRADUATED
        item.metadata_json["early_graduated"] = True
        # ... 写 audit
        return

    # 5. 普通毕业判断
    if item.correct_streak >= GRADUATION_THRESHOLD:
        # ... 标准毕业流程
        return

    # 6. 普通 advance：计算 multiplier 并 set next_review_at
    base_interval = INTERVALS[min(item.correct_streak - 1, len(INTERVALS) - 1)]
    multiplier = compute_confidence_recall_multiplier(effective_confidence, used_recall)
    days = max(1, int(base_interval * multiplier))
    item.next_review_at = today_end_local + timedelta(days=days)
```

### 7.3 强制路径的实施

`schedule_forced_cause_analysis` 函数（异步）：

```python
def schedule_forced_cause_analysis(item_id: int, user_id: int, reason: str) -> None:
    """certain+错 / mismatch 累积 触发；不阻塞 session 提交"""
    # 不直接调 LLM；先在 DB 标记，由前端在 result 页面读取并自动调用
    db.execute(
        update(ReviewItemV2)
        .where(ReviewItemV2.id == item_id)
        .values(
            metadata_json=ReviewItemV2.metadata_json.op("||")(
                json.dumps({"forced_cause_analysis_pending": True, "forced_reason": reason})
            )
        )
    )
```

前端读到 `metadata.forced_cause_analysis_pending=True` 时自动 trigger cause-analysis 并清除标记。

---

## 8. 前端实施要点

### 8.1 新增组件

```
apps/web/src/components/review/
├── ConfidenceRatingPrompt.tsx       ← 4 档选择 UI（含跳过）
├── ConfidenceBadge.tsx              ← 答题历史中显示历史信心档位
└── ConfidenceMismatchBanner.tsx     ← certain+错时的醒目警示

apps/web/src/components/practice/
└── ConfidenceRatingPrompt.tsx       ← Practice 共用同组件（路径上 Practice 也用）
```

### 8.2 SessionStore 状态机修订

```typescript
type AnswerSubmitFlow =
  | "idle"
  | "submitting"
  | "showing_result"             // 显示对错 + 解析
  | "awaiting_confidence"         // 弹 confidence prompt
  | "awaiting_recall"             // 弹 recall（如需强制）
  | "awaiting_cause_analysis"     // certain+错时
  | "complete"                    // 进入下一题
```

### 8.3 Q-Hub 答题历史时间线增强

每个历史 attempt 显示：
- 时间
- 对/错
- confidence badge（彩色小条）
- recall 摘要（如填）

帮助用户复盘时回忆"上次我做这题的状态"。

---

## 9. Insights 拓展

新增 1 张图表（不在原 §8 §3 张图之内，是补充图表）：

`/review/insights/confidence-distribution`：

```
本月信心分布（堆叠条形图，每周一条）
  Week 1: ██████ guess + █ unsure + ████ likely + ██ certain
  Week 2: ████ guess + ██ unsure + ██████ likely + ███ certain
  ...

下方：本月 confidence_mismatch 次数 + 趋势
```

如果用户的 `certain` 占比上升 + `mismatch` 下降 = 真实掌握度提升信号。

---

## 10. 测试矩阵

| # | 场景 | 输入 | 期望 |
|---|---|---|---|
| C1 | guess 答对不递增 | streak=1 + correct + guess | streak=1 不变 |
| C2 | guess 答错正常回退 | streak=2 + incorrect + guess | streak=1 |
| C3 | unsure 答对间隔减半 | streak=0 + correct + unsure | streak=1, next=1d (3//2=1) |
| C4 | unsure 答对临门毕业被阻 | streak=3 + correct + unsure (GRADUATION=4) | streak=3 不变, unsure_blocked_graduation=true |
| C5 | likely 标准 advance | streak=1 + correct + likely + no recall | streak=2, next=7d |
| C6 | likely + recall 1.5× | streak=1 + correct + likely + recall | streak=2, next=10d (7×1.5) |
| C7 | certain + recall 早毕业 | streak=2 + correct + certain + recall (GRADUATION=4) | streak=3, status=graduated, early=true |
| C8 | certain + 答错触发 mismatch | streak=2 + incorrect + certain | mismatch_count=1, forced_cause_analysis_pending=true |
| C9 | mismatch 累积 → is_hard | confidence_mismatch_count 已=1, 又 certain+错 | is_hard=true |
| C10 | confidence=null skip | streak=1 + correct + null | 按 likely 处理, skip_count+1 |
| C11 | skip 累积警告 | confidence_skipped_count=5 | 下次强制弹出 |
| C12 | recall 抵消 unsure 惩罚 | streak=0 + correct + unsure + recall | next=3d (×1 不减半) |
| C13 | guess + recall 不奖励 | streak=0 + correct + guess + recall | streak=0, next 按 streak=0 算 (1d) |
| C14 | last_confidence 记录 | 提交 likely | metadata.last_confidence="likely" |
| C15 | 新增 outcome CONFIDENCE_MISMATCH | certain+错 | ReviewAttemptV2 行 outcome=confidence_mismatch |

---

## 11. 配置默认值

| 参数 | 默认值 | 可调范围 | 来源 |
|---|---|---|---|
| `confidence_required_after_skips` | 5 | 不可调 | 系统常量 |
| `confidence_mismatch_to_hard_threshold` | 2 | 不可调 | 系统常量（同 [12 §5](./12-Debt-Management.md#5-难题专项-hard-question-cohort)） |
| `early_graduation_requires_recall` | true | 不可调 | 系统常量 |
| `unsure_blocks_graduation` | true | 不可调 | 系统常量 |

---

## 12. 与既有设计的边界

### 12.1 与 SRS Engine

- `advance_on_correct` / `regress_on_incorrect` 增加 `confidence` 参数
- INTERVALS 数组保持 `[1, 3, 7, 21]`（4 档版，本文与 [05-SRS-Engine](./05-SRS-Engine.md) 重写后一致）
- GRADUATION_THRESHOLD = 4（streak ≥ 4 毕业）
- 引入 `early_graduated` 状态修饰（streak=3 + certain + recall 提前进 graduated）

### 12.2 与 Cause Analysis

- `certain + 错` 触发 forced cause-analysis（不计 daily_quota，使用 `cause_analysis_forced` prompt 变体）
- evolution_context 注入时附带"上次 confidence"信息（让 LLM 评估"自信度有改善吗"）

### 12.3 与 Debt Management

- `confidence_mismatch_count >= 2` → is_hard=true（路径 [12 §5.1](./12-Debt-Management.md#51-定义)）
- ramp-up 期间 `certain` 默认禁用（避免回归首日错估自我，UI 不展示 certain 选项）

### 12.4 与 Smart Card

- CardA "高频错点" 计算时，按 `effective_confidence_severity` 加权：guess+错 < unsure+错 < likely+错 < certain+错（错估代价更高）
- CardC "预测再错" 算法引入 mismatch 维度：`is_correct=False AND confidence = "certain"` 题权重 ×3（仅 certain，与 [07] §6.3.1 一致）

### 12.5 与 Practice

- Practice 普通 session 也收集 confidence（不收 recall）
- 写入 ReviewItemV2(source_kind=wrong_answer) 时同时写入 metadata.first_confidence
- 后续复盘 session 弹 confidence 时 UI 展示"上次：half-sure"作为参考

### 12.6 与 Weekly Review

- WeeklySummaryResponseV2.biggest_progress 加入 confidence 维度：本周从 `guess/unsure` 转为 `likely/certain` 的题
- biggest_concern 加入 mismatch_emergence：本周新出现 confidence_mismatch 的题

---

## 13. 引用矩阵

| 本文被引用 |
|---|
| [00-Decisions](./00-Decisions.md) §15 Confidence 系列 |
| [01-Boundary-Rules](./01-Boundary-Rules.md) PR-R11 |
| [02-Data-Model](./02-Data-Model.md) §3.2 notes_json + §2.3 outcome 枚举 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR13 |
| [05-SRS-Engine](./05-SRS-Engine.md) §3 advance/regress 参数 |
| [06-AI-Cause-Analysis](./06-AI-Cause-Analysis.md) forced 触发路径 |
| [07-Smart-Review-Aggregation](./07-Smart-Review-Aggregation.md) §6 加权 |
| [12-Debt-Management](./12-Debt-Management.md) §5 hard 触发 |
| [11-Testing](./11-Testing.md) 15 个 C 测试矩阵 |
