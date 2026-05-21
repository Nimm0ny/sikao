# Phase-Review · 05 · SRS Engine

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §4（SRS-1 ~ SRS-7）· [02-Data-Model](./02-Data-Model.md) §3.1

---

## 1. 算法概述

简化版 SRS（Spaced Repetition System），基于 `correct_streak` 计数器 + 固定三档间隔。
- **目标**：最少代码实现"间隔越来越大"的复习节奏 + 自动毕业
- **升级路径**：所有 SM-2 字段已在 metadata_json 中预留，algorithm_version 字段支持运行时切换

文件位置：`services/api/src/sikao_api/modules/review/application/srs_engine.py`

---

## 2. 三档间隔表

| correct_streak | 间隔 | 公式 | 动作 |
|---|---|---|---|
| 0 | 1 天 | `next_review_at = now + timedelta(days=1)` | 进入 in_progress |
| 1 | 3 天 | `next_review_at = now + timedelta(days=3)` | 保持 in_progress |
| 2 | — | — | **graduated**（`status = graduated, graduated_at = now`） |

**费曼复述加成（SRS-7）**：

```
if used_recall:
    interval *= 2
    # 注意：interval 基于递增后的 streak 查表
    # 初始 streak=0 → 递增后 streak=1 → INTERVALS[1]=3 → ×2 = 6d
    # 初始 streak=1 → 递增后 streak=2 → 直接 graduated（interval 不适用）
```

---

## 3. 核心伪代码

```python
# services/api/src/sikao_api/modules/review/application/srs_engine.py

from datetime import timedelta
from sikao_api.modules.review.application.srs_constants import (
    INTERVALS, GRADUATION_THRESHOLD, RECALL_BONUS_MULTIPLIER,
)

INTERVALS = [1, 3]  # days; index = correct_streak (graduation fires at streak=2, so only index 0 and 1 are reachable)
GRADUATION_THRESHOLD = 2  # correct_streak >= this → graduated
RECALL_BONUS_MULTIPLIER = 2


def compute_next_review(
    correct_streak: int,
    used_recall: bool,
    user_timezone: str,
) -> datetime:
    """计算下一次复习时间（SRS-4: 用户本地时区）"""
    if correct_streak >= GRADUATION_THRESHOLD:
        raise AlreadyGraduatedError()

    base_interval = INTERVALS[min(correct_streak, len(INTERVALS) - 1)]
    if used_recall:
        base_interval *= RECALL_BONUS_MULTIPLIER

    today_end_local = get_today_end(user_timezone)
    return today_end_local + timedelta(days=base_interval)


def advance_on_correct(item: ReviewItemV2, used_recall: bool, user_tz: str) -> None:
    """答对：streak +1，检查毕业，计算下次"""
    item.correct_streak += 1

    if item.correct_streak >= GRADUATION_THRESHOLD:
        # 毕业
        item.status = ReviewItemStatus.GRADUATED
        item.metadata_json["graduated_at"] = utcnow().isoformat()
        item.next_review_at = None
        _record_attempt(item, ReviewAttemptOutcome.GRADUATED)
    else:
        # 升档
        if item.status == ReviewItemStatus.PENDING:
            item.status = ReviewItemStatus.IN_PROGRESS
        item.next_review_at = compute_next_review(
            item.correct_streak, used_recall, user_tz
        )
        item.metadata_json["last_reviewed_at"] = utcnow().isoformat()
        _record_attempt(item, ReviewAttemptOutcome.CORRECT)


def regress_on_incorrect(item: ReviewItemV2, user_tz: str) -> None:
    """答错：streak 回退一档（不回 new），重算 next（SRS-3）"""
    if item.correct_streak > 0:
        item.correct_streak -= 1

    if item.status == ReviewItemStatus.PENDING:
        item.status = ReviewItemStatus.IN_PROGRESS

    item.next_review_at = compute_next_review(
        item.correct_streak, used_recall=False, user_tz=user_tz
    )
    item.metadata_json["last_reviewed_at"] = utcnow().isoformat()
    _record_attempt(item, ReviewAttemptOutcome.INCORRECT)


def check_graduation(item: ReviewItemV2) -> bool:
    """检查是否满足毕业条件"""
    return item.correct_streak >= GRADUATION_THRESHOLD
```

---

## 4. 时区处理（SRS-4 / SRS-5）

```python
def get_today_end(user_timezone: str) -> datetime:
    """
    获取用户本地时区的"今日 23:59:59"对应的 UTC datetime。
    与 Home today 定义一致（SRS-5）。
    
    来源：profile_v2.info.timezone（如 "Asia/Shanghai"）
    默认值：如 timezone 为空，fallback "Asia/Shanghai"
    """
    import zoneinfo
    tz = zoneinfo.ZoneInfo(user_timezone or "Asia/Shanghai")
    now_local = datetime.now(tz)
    end_of_day = now_local.replace(hour=23, minute=59, second=59, microsecond=0)
    return end_of_day.astimezone(timezone.utc)


def is_due_today(item: ReviewItemV2, user_timezone: str) -> bool:
    """判断该条目今天是否 due（SRS-5）"""
    if item.next_review_at is None:
        return False
    today_end = get_today_end(user_timezone)
    return item.next_review_at <= today_end
```

---

## 5. 边缘情况

### 5.0 设计规则：pending 是瞬态

> **pending 是瞬态状态**：任何首次交互（无论答对还是答错）都将 status 从 pending 推进到 in_progress。pending 仅表示"已入队但用户尚未做过"，不表示"SRS 未开始"。这与 SRS-3"答错回退一档（不回 new）"不冲突——SRS-3 控制的是 correct_streak 的回退，不控制 status 字段。

### 5.1 首次复盘（首答）

- 新入队的 ReviewItemV2：`status=pending, correct_streak=0, next_review_at=NULL`
- 首次答对 → `advance_on_correct()` → `streak=1, status=in_progress, next_review_at=+3d`
- 首次答错 → `regress_on_incorrect()` → `streak=0(不变), status=in_progress, next_review_at=+1d`

### 5.2 re_failed 新行

- graduated 后在 Practice session 答错 → WU-R4 hook 创建新行
- 新行：`source_kind=re_failed, status=pending, correct_streak=0, next_review_at=NULL`
- 与首次复盘行为一致（从头开始 SRS）
- metadata_json.original_review_item_id = 原 graduated 行 ID

### 5.3 manual_add 入队

- 用户手动加入：`source_kind=manual_add, status=pending, correct_streak=0`
- next_review_at 初始为 NULL（表示"立即可做"）
- 首次答对/答错后进入 SRS 正常流程

### 5.4 时区跨越

- 用户在 UTC+8 做题，next_review_at 基于 UTC+8 today_end 计算
- 跨时区旅行：下次打开 app 时 timezone 从 profile 读取（不自动更新）
- 如果用户改了 timezone，已有的 next_review_at 不追溯修改（下次答题时重算）

### 5.5 费曼复述场景

- 用户答对后填写 recall_text → `advance_on_correct(used_recall=True)`
- interval 翻倍（基于递增后的 streak 查表：streak 0→1 查 INTERVALS[1]=3, ×2=6d；streak 1→2 直接 graduated 不受 interval 影响）
- 跳过 recall → `advance_on_correct(used_recall=False)` 正常间隔
- 答错后不展示 recall 输入框

---

## 6. 未来 SM-2 升级路径

当 `algorithm_version` 从 `simple_v1` 切换为 `sm2_v1` 时：

```python
def advance_sm2(item: ReviewItemV2, quality: int) -> None:
    """SM-2 算法（未来启用）"""
    meta = item.metadata_json
    ef = meta.get("ease_factor", 2.5)
    reps = meta.get("repetitions", 0)
    interval = meta.get("interval_days", 1)

    if quality >= 3:  # 答对
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = round(interval * ef)
        reps += 1
    else:  # 答错
        reps = 0
        interval = 1

    ef = max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    meta["ease_factor"] = ef
    meta["repetitions"] = reps
    meta["interval_days"] = interval
    item.next_review_at = compute_from_interval(interval, user_tz)
```

**升级时机**：用户量 > 1000 且有足够数据验证效果后评估。
**兼容策略**：新用户默认 sm2_v1；老用户保持 simple_v1 直到手动切换。

---

## 7. 常量定义

```python
# services/api/src/sikao_api/modules/review/application/srs_constants.py

INTERVALS = [1, 3]                        # days per streak level (only index 0 and 1 reachable; graduation at streak=2)
GRADUATION_THRESHOLD = 2                  # streak >= this → graduated
RECALL_BONUS_MULTIPLIER = 2              # interval multiplier when recall filled
ALGORITHM_VERSION_SIMPLE = "simple_v1"
ALGORITHM_VERSION_SM2 = "sm2_v1"         # 预留
DEFAULT_TIMEZONE = "Asia/Shanghai"
```

---

## 8. 测试矩阵

| # | 场景 | 初始状态 | 操作 | 期望结果 |
|---|---|---|---|---|
| T1 | 新题首次答对 | pending, streak=0 | advance_on_correct | status=in_progress, streak=1, next=+3d |
| T2 | 新题首次答错 | pending, streak=0 | regress_on_incorrect | status=in_progress, streak=0, next=+1d |
| T3 | streak=1 答对 | in_progress, streak=1 | advance_on_correct | status=graduated, streak=2, next=None |
| T4 | streak=1 答错 | in_progress, streak=1 | regress_on_incorrect | status=in_progress, streak=0, next=+1d |
| T5 | 毕业确认 | in_progress, streak=1 | advance + check_graduation | graduated=True |
| T6 | re_failed 后重新SRS | pending(re_failed), streak=0 | advance_on_correct | streak=1, next=+3d |
| T7 | re_failed 连续答对毕业 | pending(re_failed), streak=0 | advance × 2 | graduated |
| T8 | 费曼加成 streak=0 | pending, streak=0 | advance(recall=True) | streak=1, next=+6d (INTERVALS[1]=3 × 2) ※ |
| T9 | 费曼加成 streak=1 | in_progress, streak=1 | advance(recall=True) | graduated (不受 interval 影响) |
| T10 | 时区 UTC+8 | — | compute_next_review(tz=Asia/Shanghai) | next 基于 CST today_end |
| T11 | 时区空值 fallback | — | compute_next_review(tz=None) | fallback Asia/Shanghai |
| T12 | 答错不低于 0 | in_progress, streak=0 | regress_on_incorrect | streak=0 (不变), next=+1d |

> ※ **注意**：`advance_on_correct` 先递增 streak（0→1），再用递增后的 streak 值查 INTERVALS 表。因此 T8 初始 streak=0 → 递增后 streak=1 → INTERVALS[1]=3 → ×2 = 6d。T1 同理：初始 streak=0 → 递增后 streak=1 → INTERVALS[1]=3d。

---

## 引用矩阵

| 本文被引用 |
|---|
| [03-Backend-WU](./03-Backend-WU.md) WU-R3 |
| [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) SRS 触发时机 |
| [11-Testing](./11-Testing.md) SRS 状态机测试 |
