# Phase-Review · 05 · SRS Engine

> **Status**: ACCEPTED (REWRITTEN)
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §4（SRS-1 ~ SRS-9）· [02-Data-Model](./02-Data-Model.md) §3.1 · [14-Confidence-Rating](./14-Confidence-Rating.md) · [12-Debt-Management](./12-Debt-Management.md)

---

## 1. 算法概述

简化版 SRS（Spaced Repetition System），基于 `correct_streak` 计数器 + 4 档间隔 + 概率毕业（probationary phase）。

**目标**：
- 4 档间隔 `[1d, 3d, 7d, 21d]` 适配公考 3-6 月备考周期，对抗 Ebbinghaus 长期遗忘
- streak=4 触发"试毕业"（probationary）→ 30 天后系统主动抽查 → 通过才 final_graduated
- 集成 confidence rating（`guess/unsure/likely/certain`）影响 advance 速度
- 集成乐观锁 `version` 列防跨设备并发冲突
- schema 预留 SM-2 算法升级路径

**升级路径**：所有 SM-2 字段已在 metadata_json 中预留，`algorithm_version` 字段支持运行时切换（详见 §10）。

文件位置：`services/api/src/sikao_api/modules/review/application/srs_engine.py`

---

## 2. 4 档间隔表

```python
INTERVALS = [1, 3, 7, 21]  # days; index = correct_streak before advance
GRADUATION_THRESHOLD = 4    # streak >= 4 → probationary
PROBATION_DURATION_DAYS = 30
RECALL_BONUS_MULTIPLIER = 2.0  # used in confidence multiplier table; not standalone
```

| correct_streak | 间隔 | 状态转换 |
|---|---|---|
| 0 → 1 | 1 天 | pending → in_progress |
| 1 → 2 | 3 天 | in_progress |
| 2 → 3 | 7 天 | in_progress |
| 3 → 4 | 21 天 | in_progress |
| 4 → — | 立即 → probationary | in_progress → **probationary** (status changed; next_review_at = +30d for system check) |
| Probationary → final | 系统抽查通过 | probationary → **graduated** |
| Probationary → 答错 | re_failed 新行 | probationary 行保持；新行 source_kind=re_failed |

graduated 状态分两阶段：
- **probationary**（中间状态）：streak=4 后进入；30 天后系统主动抽查
- **graduated**（最终毕业）：抽查答对后进入；不再推送

---

## 3. 状态机（含 probationary）

```
                 ┌────────────────────────────────────────────┐
                 │                                            │
                 ▼                                            │
┌────────────┐  答对  ┌──────────────┐  4 次答对   ┌─────────┴────────┐
│  pending   │──────▶│ in_progress  │──────────▶│   probationary    │
│ streak=0   │       │ streak 1-3   │           │ streak=4 (frozen)  │
└─────┬──────┘       └──────┬───────┘           │ check_at = +30d    │
      │ 答错               │ 答错                └─────────┬──────────┘
      │                    │                              │
      ▼                    ▼                              │ 30d 后系统抽查
  next=+1d                next=+1d                        │
  status=in_progress      streak -=1                     ▼
                          (regress)               ┌─────────────┐
                                                  │ 抽查 question │
                                                  └──────┬──────┘
                                                         │
                                          ┌──────────────┼──────────────┐
                                          │ 答对          │ 答错          │
                                          ▼              ▼
                                    ┌──────────┐   新 ReviewItemV2
                                    │graduated │   source_kind=re_failed
                                    │ (final)  │   原 probationary 行
                                    │ next=NULL│   状态保持 probationary
                                    └──────────┘   (不变)

用户手动操作：
  any active status ──── archive ────▶ archived
  archived          ──── restore ────▶ pending (streak=0)
  in_progress/pending ── mark_resolved ▶ probationary (跳过等待，立刻进试毕业)

注意：
  - probationary 行的 next_review_at = probation_check_at（+30d）
  - probationary 抽查由 cron 主动推送，不依赖用户手动复盘
  - probationary → graduated 是系统转换，用户不可手动跳过
  - probationary 行永不被 UPDATE 为非 graduated 状态（PR-R10）
```

---

## 4. 核心函数签名

```python
# services/api/src/sikao_api/modules/review/application/srs_engine.py

from typing import Literal
from datetime import datetime, timedelta
import zoneinfo

from sikao_api.modules.review.application.srs_constants import (
    INTERVALS,
    GRADUATION_THRESHOLD,
    PROBATION_DURATION_DAYS,
    DEFAULT_TIMEZONE,
    ALGORITHM_VERSION_SIMPLE,
)
from sikao_api.modules.review.application.confidence import (
    compute_confidence_recall_multiplier,
    is_unsure_blocking_graduation,
    is_certain_with_recall_early_graduate,
)


ConfidenceLevel = Literal["guess", "unsure", "likely", "certain"]


def advance_on_correct(
    item: ReviewItemV2,
    *,
    confidence: ConfidenceLevel | None,
    used_recall: bool,
    user_tz: str,
) -> SRSAdvanceResult:
    """答对路径。"""

def regress_on_incorrect(
    item: ReviewItemV2,
    *,
    confidence: ConfidenceLevel | None,
    user_tz: str,
) -> SRSRegressResult:
    """答错路径。"""

def transition_to_probationary(
    item: ReviewItemV2,
    *,
    user_tz: str,
) -> None:
    """streak=4 时调用：状态推进到 probationary，next_review_at = +30d。"""

def execute_probation_check(
    item: ReviewItemV2,
    *,
    is_correct: bool,
    user_id: int,
    user_tz: str,
) -> ProbationCheckResult:
    """系统抽查路径（30d 后由 cron 触发）。"""

def compute_next_review(
    streak_after: int,
    *,
    confidence: ConfidenceLevel | None,
    used_recall: bool,
    is_hard: bool,
    user_tz: str,
) -> datetime:
    """统一的 next_review_at 计算入口。"""

def bump_version(item: ReviewItemV2) -> None:
    """版本号 +1（乐观锁）；任何 SRS 状态变更都必须调用。"""

def is_due_today(
    item: ReviewItemV2,
    *,
    user_tz: str,
    respect_debt: bool = True,
) -> bool:
    """判断该条目今天是否 due（考虑 debt redistribution / ramp-up）。"""
```

---

## 5. advance_on_correct 完整逻辑

```python
def advance_on_correct(
    item: ReviewItemV2,
    *,
    confidence: ConfidenceLevel | None,
    used_recall: bool,
    user_tz: str,
) -> SRSAdvanceResult:
    """答对路径，集成 confidence 决策。"""
    require_active_status(item)
    require_algorithm(item, ALGORITHM_VERSION_SIMPLE)

    effective_confidence = confidence or "likely"  # null = likely 等价

    # ─── Branch 1: guess 答对不递增 streak（[14] §3.1）───
    if effective_confidence == "guess":
        item.next_review_at = compute_next_review(
            streak_after=item.correct_streak,  # 不递增
            confidence="guess",
            used_recall=False,  # guess 不享受 recall 加成
            is_hard=item.metadata_json.get("is_hard", False),
            user_tz=user_tz,
        )
        item.metadata_json["last_confidence"] = "guess"
        item.metadata_json["last_reviewed_at"] = utcnow().isoformat()
        record_attempt(item, ReviewAttemptOutcome.CORRECT, {
            "before_streak": item.correct_streak,
            "after_streak": item.correct_streak,
            "confidence": "guess",
            "advance_skipped": True,
            "reason": "guess_correct_does_not_count",
            "interval_multiplier_applied": 1.0,
        })
        bump_version(item)
        return SRSAdvanceResult(
            new_streak=item.correct_streak,
            graduated=False,
            probationary=False,
            advance_skipped=True,
        )

    # ─── Branch 2: 递增 streak ───
    before_streak = item.correct_streak
    item.correct_streak += 1
    item.metadata_json["last_confidence"] = effective_confidence
    item.metadata_json["last_reviewed_at"] = utcnow().isoformat()

    # ─── Branch 3: unsure 阻毕业（[14] §3.2）───
    will_reach_threshold = item.correct_streak >= GRADUATION_THRESHOLD
    if will_reach_threshold and effective_confidence == "unsure":
        # 卡在毕业前一档，强制再做一次
        item.correct_streak = GRADUATION_THRESHOLD - 1
        item.metadata_json["unsure_blocked_graduation"] = True
        item.next_review_at = compute_next_review(
            streak_after=item.correct_streak,
            confidence=effective_confidence,
            used_recall=used_recall,
            is_hard=item.metadata_json.get("is_hard", False),
            user_tz=user_tz,
        )
        record_attempt(item, ReviewAttemptOutcome.CORRECT, {
            "before_streak": before_streak,
            "after_streak": item.correct_streak,
            "confidence": "unsure",
            "unsure_blocked_graduation": True,
        })
        bump_version(item)
        return SRSAdvanceResult(new_streak=item.correct_streak, graduated=False, probationary=False)

    # ─── Branch 4: certain + recall 早毕业（[14] §3.3）───
    if (
        effective_confidence == "certain"
        and used_recall
        and item.correct_streak >= GRADUATION_THRESHOLD - 1
        and not item.metadata_json.get("is_hard", False)  # hard 题不享早毕业
    ):
        transition_to_probationary(item, user_tz=user_tz)
        item.metadata_json["early_graduated"] = True
        record_attempt(item, ReviewAttemptOutcome.PROBATION_ENTERED, {
            "before_streak": before_streak,
            "after_streak": item.correct_streak,
            "confidence": "certain",
            "used_recall": True,
            "early_graduated": True,
        })
        bump_version(item)
        return SRSAdvanceResult(
            new_streak=item.correct_streak,
            graduated=False,
            probationary=True,
            early_graduated=True,
        )

    # ─── Branch 5: 标准毕业（streak ≥ GRADUATION_THRESHOLD）───
    if item.correct_streak >= GRADUATION_THRESHOLD:
        transition_to_probationary(item, user_tz=user_tz)
        record_attempt(item, ReviewAttemptOutcome.PROBATION_ENTERED, {
            "before_streak": before_streak,
            "after_streak": item.correct_streak,
            "confidence": effective_confidence,
            "used_recall": used_recall,
        })
        bump_version(item)
        return SRSAdvanceResult(
            new_streak=item.correct_streak,
            graduated=False,
            probationary=True,
        )

    # ─── Branch 6: 普通 advance ───
    if item.status == ReviewItemStatus.PENDING:
        item.status = ReviewItemStatus.IN_PROGRESS

    item.next_review_at = compute_next_review(
        streak_after=item.correct_streak,
        confidence=effective_confidence,
        used_recall=used_recall,
        is_hard=item.metadata_json.get("is_hard", False),
        user_tz=user_tz,
    )

    multiplier = compute_confidence_recall_multiplier(effective_confidence, used_recall)
    record_attempt(item, ReviewAttemptOutcome.CORRECT, {
        "before_streak": before_streak,
        "after_streak": item.correct_streak,
        "confidence": effective_confidence,
        "used_recall": used_recall,
        "interval_multiplier_applied": multiplier,
    })
    bump_version(item)
    return SRSAdvanceResult(new_streak=item.correct_streak, graduated=False, probationary=False)
```

---

## 6. regress_on_incorrect 完整逻辑

```python
def regress_on_incorrect(
    item: ReviewItemV2,
    *,
    confidence: ConfidenceLevel | None,
    user_tz: str,
) -> SRSRegressResult:
    """答错路径。"""
    require_active_status(item)  # probationary 不走此函数（走 execute_probation_check）

    effective_confidence = confidence or "likely"

    # ─── 答错 streak 回退一档（不回 -1）───
    before_streak = item.correct_streak
    if item.correct_streak > 0:
        item.correct_streak -= 1

    if item.status == ReviewItemStatus.PENDING:
        item.status = ReviewItemStatus.IN_PROGRESS

    # ─── certain + 错 触发 forced cause-analysis 标记（[14] §3.4）───
    confidence_mismatch = effective_confidence == "certain"
    if confidence_mismatch:
        mismatch_count = item.metadata_json.get("confidence_mismatch_count", 0) + 1
        item.metadata_json["confidence_mismatch_count"] = mismatch_count
        item.metadata_json["forced_cause_analysis_pending"] = True
        item.metadata_json["forced_reason"] = "confidence_mismatch"

        # mismatch ≥ 2 → 标记 hard（[12] §5.1）
        if mismatch_count >= 2 and not item.metadata_json.get("is_hard", False):
            item.metadata_json["is_hard"] = True
            item.metadata_json["hard_marked_at"] = utcnow().isoformat()
            record_attempt(item, ReviewAttemptOutcome.HARD_MARKED, {
                "trigger_condition": "confidence_mismatch_threshold",
                "mismatch_count": mismatch_count,
            })

        record_attempt(item, ReviewAttemptOutcome.CONFIDENCE_MISMATCH, {
            "confidence": "certain",
            "is_correct": False,
            "mismatch_count": mismatch_count,
        })

    # ─── 计算 next_review_at ───
    item.next_review_at = compute_next_review(
        streak_after=item.correct_streak,
        confidence=effective_confidence,
        used_recall=False,  # 答错不收集 recall
        is_hard=item.metadata_json.get("is_hard", False),
        user_tz=user_tz,
    )
    item.metadata_json["last_confidence"] = effective_confidence
    item.metadata_json["last_reviewed_at"] = utcnow().isoformat()

    record_attempt(item, ReviewAttemptOutcome.INCORRECT, {
        "before_streak": before_streak,
        "after_streak": item.correct_streak,
        "confidence": effective_confidence,
        "confidence_mismatch": confidence_mismatch,
    })
    bump_version(item)
    return SRSRegressResult(
        new_streak=item.correct_streak,
        confidence_mismatch=confidence_mismatch,
        is_hard_now=item.metadata_json.get("is_hard", False),
    )
```

---

## 7. probationary 状态转换

### 7.1 进入 probationary

```python
def transition_to_probationary(item: ReviewItemV2, *, user_tz: str) -> None:
    """streak=4 / early-graduated 时调用。"""
    require_in_progress_or_pending(item)

    today_end = get_today_end(user_tz)
    probation_check_at = today_end + timedelta(days=PROBATION_DURATION_DAYS)

    item.status = ReviewItemStatus.PROBATIONARY  # 新增 status
    item.next_review_at = probation_check_at
    item.metadata_json["probation_started_at"] = utcnow().isoformat()
    item.metadata_json["probation_check_at"] = probation_check_at.isoformat()
    item.metadata_json["probation_attempts"] = 0
```

### 7.2 系统抽查（cron 触发）

```python
# Cron: probation_check_dispatcher（每日 02:00 用户本地时区）

def dispatch_probation_checks(user_id: int, user_tz: str) -> list[ReviewItemV2]:
    """找出 today 应该抽查的 probationary 行，注入到当日推送。"""
    today_end = get_today_end(user_tz)
    items = db.query(ReviewItemV2).filter(
        ReviewItemV2.user_id == user_id,
        ReviewItemV2.status == ReviewItemStatus.PROBATIONARY,
        ReviewItemV2.next_review_at <= today_end,
    ).all()
    # 这些行会出现在用户的"今日复盘"队列中，与普通 in_progress 题混合
    return items


def execute_probation_check(
    item: ReviewItemV2,
    *,
    is_correct: bool,
    user_id: int,
    user_tz: str,
) -> ProbationCheckResult:
    """用户答完 probationary 题后调用。"""
    require_status(item, ReviewItemStatus.PROBATIONARY)

    item.metadata_json["probation_attempts"] = item.metadata_json.get("probation_attempts", 0) + 1

    if is_correct:
        # ─── 通过 → final graduated ───
        item.status = ReviewItemStatus.GRADUATED
        item.next_review_at = None
        item.metadata_json["graduated_at"] = utcnow().isoformat()
        item.metadata_json["probation_passed"] = True
        record_attempt(item, ReviewAttemptOutcome.GRADUATED, {
            "via_probation": True,
            "probation_attempts": item.metadata_json["probation_attempts"],
        })
        bump_version(item)
        return ProbationCheckResult(passed=True, re_failed_item_id=None)

    # ─── 失败 → 创建 re_failed 新行（PR-R5）───
    new_item = create_review_item(
        user_id=user_id,
        question_id=item.question_id,
        source_kind=ReviewSourceKind.RE_FAILED,
        status=ReviewItemStatus.PENDING,
        correct_streak=0,
        title=item.title,
        metadata_json={
            "original_review_item_id": item.id,
            "from_probation_check": True,
            "first_seen_at": utcnow().isoformat(),
        },
    )

    # 原 probationary 行**保持** PROBATIONARY 状态（PR-R10：probationary 不可降级），
    # 但 next_review_at 设为 NULL 不再被抽查（new_item 接管该题的复盘流）
    item.next_review_at = None
    item.metadata_json["probation_failed_at"] = utcnow().isoformat()

    record_attempt(item, ReviewAttemptOutcome.PROBATION_FAILED, {
        "probation_attempts": item.metadata_json["probation_attempts"],
        "re_failed_new_item_id": new_item.id,
    })
    bump_version(item)
    return ProbationCheckResult(passed=False, re_failed_item_id=new_item.id)
```

### 7.3 用户主动 mark_resolved

```python
def mark_resolved(item: ReviewItemV2, *, user_tz: str) -> None:
    """用户在 Q-Hub 点'已掌握'：跳过等待立刻进 probationary。"""
    require_active_status(item)
    if item.status == ReviewItemStatus.PROBATIONARY:
        raise AlreadyProbationaryError()

    item.metadata_json["mark_resolved_skipped_streak"] = item.correct_streak
    item.correct_streak = GRADUATION_THRESHOLD  # streak 强制拉满
    transition_to_probationary(item, user_tz=user_tz)
    record_attempt(item, ReviewAttemptOutcome.MARK_RESOLVED, {
        "skipped_streak_to_threshold": True,
    })
    bump_version(item)
```

mark_resolved 是用户的"主动声明"——不绕过 probationary（系统仍然 30d 后抽查），但跳过中间答对的等待。

---

## 8. compute_next_review 统一计算

```python
def compute_next_review(
    streak_after: int,
    *,
    confidence: ConfidenceLevel | None,
    used_recall: bool,
    is_hard: bool,
    user_tz: str,
) -> datetime:
    """
    统一的 next_review_at 计算。
    输入：递增/回退后的 streak。
    输出：基于 user_timezone 的 today_end + interval。
    """
    if streak_after >= GRADUATION_THRESHOLD:
        raise ValueError("streak_after >= GRADUATION_THRESHOLD; should call transition_to_probationary instead")

    base_interval = INTERVALS[min(streak_after, len(INTERVALS) - 1)]
    multiplier = compute_confidence_recall_multiplier(
        confidence or "likely",
        used_recall,
    )

    # is_hard 强制不超过 ×1（覆盖加成但保留惩罚；详见 [12] §5.2）
    if is_hard:
        multiplier = min(1.0, multiplier)  # 保留 unsure ×0.5 惩罚，仅阻止 >1 的加成

    final_interval = max(1, int(base_interval * multiplier))
    today_end = get_today_end(user_tz)
    return today_end + timedelta(days=final_interval)
```

### 8.1 各档 × 各 confidence × recall 速查

| streak_after | 基础 | guess | unsure (¬R) | unsure (R) | likely (¬R) | likely (R) | certain (¬R) | certain (R) |
|---|---|---|---|---|---|---|---|---|
| 0 | 1d | 1d | 1d (×0.5→1) | 1d | 1d | 1d (×1.5=1.5→1) | 1d | 2d |
| 1 | 3d | 3d | 1d | 3d | 3d | 4d | 3d | 6d |
| 2 | 7d | 7d | 3d | 7d | 7d | 10d | 7d | 14d |
| 3 | 21d | 21d | 10d | 21d | 21d | 31d | 21d | 42d |

注：streak_after=3 + certain + recall = 42d 看似过长，但配合 §3 Branch 4 此场景已**直接进入 probationary（30d 试毕业）** 而非走 compute_next_review，所以实际不会出现。

is_hard=true 时整列 cap 在基础间隔（加成被阻止），但 unsure ×0.5 惩罚保留（即 hard+unsure 仍得到减半间隔）。

---

## 9. 时区处理（沿用既有 SRS-4/SRS-5）

```python
def get_today_end(user_timezone: str | None) -> datetime:
    """用户本地时区今日 23:59:59 对应的 UTC datetime。"""
    tz = zoneinfo.ZoneInfo(user_timezone or DEFAULT_TIMEZONE)
    now_local = datetime.now(tz)
    end_of_day = now_local.replace(hour=23, minute=59, second=59, microsecond=0)
    return end_of_day.astimezone(timezone.utc)


def is_due_today(
    item: ReviewItemV2,
    *,
    user_tz: str,
    respect_debt: bool = True,
) -> bool:
    """考虑 debt redistribution / ramp-up 后的 due 判断。"""
    if item.next_review_at is None:
        return False

    today_end = get_today_end(user_tz)

    # debt-aware: ramp_up_protected 期间不算 due
    if respect_debt:
        debt_status = item.metadata_json.get("debt_status")
        if debt_status == "ramp_up_protected":
            return False
        if debt_status == "deferred":
            # 看 deferred_to 是否为今天
            deferred_to_str = item.metadata_json.get("debt_redistributed_to")
            if deferred_to_str:
                deferred_to = datetime.fromisoformat(deferred_to_str)
                return deferred_to.date() == today_end.date()

    return item.next_review_at <= today_end
```

---

## 10. 乐观锁 version 列

### 10.1 schema

`ReviewItemV2.version: int = mapped_column(default=1)` —— 提升为 top-level column（不在 metadata_json 中），用于 SQL UPDATE WHERE 条件。

### 10.2 bump_version

```python
def bump_version(item: ReviewItemV2) -> None:
    """SRS 任何状态变更后必调。version +1，用于乐观锁。"""
    item.version = (item.version or 1) + 1
```

### 10.3 commit 路径乐观锁

```python
def commit_srs_change(item: ReviewItemV2, expected_version: int) -> None:
    """同事务 UPDATE 时检查 version 一致性。"""
    rows_updated = db.execute(
        update(ReviewItemV2)
        .where(ReviewItemV2.id == item.id)
        .where(ReviewItemV2.version == expected_version)
        .values(
            correct_streak=item.correct_streak,
            status=item.status,
            next_review_at=item.next_review_at,
            metadata_json=item.metadata_json,
            version=item.version,  # 已由 bump_version +1
        )
    ).rowcount

    if rows_updated == 0:
        # 跨设备并发：另一端已写入新 version
        raise OptimisticLockError(item_id=item.id, expected=expected_version)
```

### 10.4 跨设备冲突处理

```
设备 A: 答对题 (version 5 → 6)
设备 B: 同时答错题 (基于 version 5 计算)
设备 B commit: WHERE version=5 → 0 rows updated → OptimisticLockError
设备 B 处理: 重新拉 item (version 6) → 用最新 version 重新计算 → 再 commit (version 6 → 7)
```

attempt 的合并策略：按 `attempted_at` 时间戳排序，**后写胜出**——即 attempt 时间晚的覆盖早的（因为是同一题相邻几秒的答题，user intent 是后者）。

冲突场景 metrics 计数 `srs_optimistic_lock_collision`，监控阈值 > 5/小时告警（说明同设备同步频率有 bug）。

---

## 11. 算法版本切换路径

### 11.1 schema

`ReviewItemV2.metadata_json.algorithm_version` ∈ `{"simple_v1", "sm2_v1"}`，默认 `simple_v1`。

### 11.2 切换策略

**用户级别（推荐 MVP 后期）**：
- 在 profile_v2.info 加 `srs_algorithm_preference: "auto" | "simple_v1" | "sm2_v1"`，默认 `"auto"`
- `"auto"`：系统判定（新用户 30 天后自动切到 `sm2_v1`，老用户保持当前）
- 用户主动切换：触发"算法迁移"（详见 §11.4）

**系统级别（不推荐）**：禁止——会伤害已校准的用户体验。

### 11.3 算法迁移流程

```python
def migrate_to_sm2(user_id: int, dry_run: bool = False) -> AlgorithmMigrationReport:
    """从 simple_v1 → sm2_v1。"""
    items = db.query(ReviewItemV2).filter(
        ReviewItemV2.user_id == user_id,
        ReviewItemV2.metadata_json["algorithm_version"].astext == "simple_v1",
        ReviewItemV2.status.in_([ReviewItemStatus.PENDING, ReviewItemStatus.IN_PROGRESS]),
    ).all()

    migrated = 0
    for item in items:
        # 简化映射：simple streak → SM-2 (ease_factor, repetitions, interval)
        sm2_state = simple_to_sm2_initial_state(item.correct_streak, item.next_review_at)
        if not dry_run:
            item.metadata_json["algorithm_version"] = "sm2_v1"
            item.metadata_json["ease_factor"] = sm2_state.ease_factor
            item.metadata_json["repetitions"] = sm2_state.repetitions
            item.metadata_json["interval_days"] = sm2_state.interval_days
            item.metadata_json["migrated_from_simple_v1_at"] = utcnow().isoformat()
            bump_version(item)
            record_attempt(item, ReviewAttemptOutcome.ALGORITHM_MIGRATED, {
                "from": "simple_v1",
                "to": "sm2_v1",
                "preserved_state": sm2_state.dict(),
            })
        migrated += 1

    return AlgorithmMigrationReport(total=len(items), migrated=migrated, dry_run=dry_run)
```

### 11.4 simple_v1 → sm2_v1 状态映射

| simple streak | 映射 SM-2 状态 |
|---|---|
| 0 | repetitions=0, ease=2.5, interval=1 |
| 1 | repetitions=1, ease=2.5, interval=1 |
| 2 | repetitions=2, ease=2.5, interval=6 |
| 3 | repetitions=3, ease=2.5, interval=15 |
| ≥ 4 | 不迁移（已 probationary/graduated） |

graduated / probationary 行不参与算法迁移（保持原算法版本，作为"该算法成功毕业"的纪念碑）。

### 11.5 SM-2 完整算法（启用后）

```python
def advance_sm2(item: ReviewItemV2, *, quality: int, user_tz: str) -> None:
    """
    quality ∈ {0..5}; 由 confidence + is_correct 映射：
      guess+错=0, guess+对=2, unsure+错=1, unsure+对=3,
      likely+错=2, likely+对=4, certain+错=2, certain+对=5
    """
    meta = item.metadata_json
    ef = meta.get("ease_factor", 2.5)
    reps = meta.get("repetitions", 0)
    interval = meta.get("interval_days", 1)

    if quality >= 3:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = round(interval * ef)
        reps += 1
    else:
        reps = 0
        interval = 1

    ef = max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    meta["ease_factor"] = ef
    meta["repetitions"] = reps
    meta["interval_days"] = interval
    item.next_review_at = get_today_end(user_tz) + timedelta(days=interval)
    bump_version(item)
```

切换到 SM-2 时间预期：单机用户量 > 1000 + 简化算法运行 ≥ 6 个月数据后（独立 Phase 验证）。

---

## 12. 边缘情况

### 12.1 设计规则

> **pending 是瞬态状态**：任何首次交互（无论答对还是答错）都将 status 从 pending 推进到 in_progress。pending 仅表示"已入队但用户尚未做过"。
>
> **probationary 是终态前的最后状态**：进入后只能转移到 graduated 或维持（re_failed 走新行）。

### 12.2 完整 advance/regress 边缘表

| # | 初始 | confidence | used_recall | 操作 | 结果 |
|---|---|---|---|---|---|
| E1 | pending, streak=0 | likely | False | advance | streak=1, status=in_progress, next=+3d |
| E2 | pending, streak=0 | guess | False | advance | streak=0 不变, status=in_progress, next=+1d |
| E3 | in_progress, streak=3 | likely | False | advance | streak=4, status=probationary, next=+30d |
| E4 | in_progress, streak=2 | certain | True | advance | streak=3, status=probationary (early), next=+30d |
| E5 | in_progress, streak=3 | unsure | False | advance | streak=3 不变 (blocked), unsure_blocked=true, next=+10d (21//2) |
| E6 | in_progress, streak=2 | guess | True | advance | streak=2 不变, recall 不奖励, next=+7d |
| E7 | probationary | likely | False | answer attempt（不调 advance）| 走 execute_probation_check |
| E8 | in_progress, streak=2 | certain | False | regress (答错) | streak=1, mismatch=true, mismatch_count=1 |
| E9 | mismatch_count=1 | certain | False | regress | mismatch_count=2, is_hard=true |
| E10 | is_hard=true, streak=1 | certain | True | advance | streak=2, next=+7d (multiplier=1, hard 禁加成) |
| E11 | probationary, +30d | — | — | execute_probation_check(correct) | status=graduated, next=NULL |
| E12 | probationary, +30d | — | — | execute_probation_check(incorrect) | 新 re_failed 行, 原行 next=NULL |
| E13 | archived | — | — | restore | status=pending, streak=0, next=NULL |
| E14 | streak=2 | None (skip) | False | advance | streak=3 (按 likely), skip_count+=1 |
| E15 | 跨设备并发 | likely | False | commit version=5 但 DB version=6 | OptimisticLockError → retry |

---

## 13. 常量定义

```python
# services/api/src/sikao_api/modules/review/application/srs_constants.py

INTERVALS = [1, 3, 7, 21]
GRADUATION_THRESHOLD = 4
PROBATION_DURATION_DAYS = 30
DEFAULT_TIMEZONE = "Asia/Shanghai"

ALGORITHM_VERSION_SIMPLE = "simple_v1"
ALGORITHM_VERSION_SM2 = "sm2_v1"

# Confidence × Recall multiplier table（与 [14] §4 一致）
CONFIDENCE_RECALL_MULTIPLIER = {
    ("guess", False): 1.0, ("guess", True): 1.0,
    ("unsure", False): 0.5, ("unsure", True): 1.0,
    ("likely", False): 1.0, ("likely", True): 1.5,
    ("certain", False): 1.0, ("certain", True): 2.0,
}
```

---

## 14. 测试矩阵（24 场景）

| # | 场景 | 见 §|
|---|---|---|
| T1-T6 | 基础档位 advance/regress（4 档间隔） | §5/§6 |
| T7-T9 | confidence × is_correct 矩阵核心路径 | §5 Branch 1-5 |
| T10-T12 | unsure 阻毕业 / certain 早毕业 / certain+错 mismatch | §5 Branch 3-4 / §6 |
| T13-T15 | probationary 进入 / 抽查通过 / 抽查失败 | §7.1-§7.2 |
| T16-T17 | mark_resolved 跳过等待 / 已 probationary 不能再 mark | §7.3 |
| T18-T19 | is_hard 禁加成 / mismatch ≥ 2 触发 hard | §6 |
| T20-T21 | confidence=null skip / 累积警告 | §5 Branch 1 / [14] §5.3 |
| T22 | 时区 UTC+8 today_end 计算 | §9 |
| T23 | 跨设备 OptimisticLockError | §10.4 |
| T24 | 算法迁移 simple_v1 → sm2_v1 | §11.3 |

详见 [11-Testing](./11-Testing.md) §3。

---

## 15. 与既有设计的边界

### 15.1 与 12-Debt-Management

- compute_next_review 不感知 debt；debt 在 SRS 之外修改 next_review_at
- is_due_today 函数 `respect_debt=True` 时考虑 debt_status (ramp_up_protected / deferred)
- redistribute / ramp-up 不调 advance/regress；不修改 streak/version

### 15.2 与 14-Confidence-Rating

- 本文 advance/regress 函数签名包含 `confidence` 参数
- 详细 confidence × is_correct 决策表见 [14](./14-Confidence-Rating.md) §3
- multiplier 表见 [14](./14-Confidence-Rating.md) §4

### 15.3 与 13-Cause-Taxonomy

- forced_cause_analysis_pending 由 SRS 标记，cause-analysis 服务消费

### 15.4 与 02-Data-Model

- ReviewItemV2 新增 `version: int` 列（top-level）
- ReviewItemV2.status 新增枚举值 `probationary`
- ReviewAttemptV2.outcome 新增 `PROBATION_ENTERED / PROBATION_FAILED / CONFIDENCE_MISMATCH / HARD_MARKED / MARK_RESOLVED / ALGORITHM_MIGRATED`

### 15.5 与 03-Backend-WU

- WU-R3 SRS Engine 复杂度 ~200 行 → ~480 行（4 档 + probation + confidence + version + algorithm migration）
- WU-R7 cron 增加 `probation_check_dispatcher`（每日 02:00 用户本地时区）

---

## 16. 引用矩阵

| 本文被引用 |
|---|
| [00-Decisions](./00-Decisions.md) §4 SRS 系列 |
| [01-Boundary-Rules](./01-Boundary-Rules.md) PR-R5 / PR-R10 |
| [02-Data-Model](./02-Data-Model.md) §3.1 字段 / §4 状态机 |
| [03-Backend-WU](./03-Backend-WU.md) WU-R3 / WU-R7 |
| [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) SRS 触发时机 |
| [11-Testing](./11-Testing.md) SRS 测试矩阵 |
| [12-Debt-Management](./12-Debt-Management.md) is_due_today debt-aware |
| [14-Confidence-Rating](./14-Confidence-Rating.md) advance/regress confidence 集成 |
