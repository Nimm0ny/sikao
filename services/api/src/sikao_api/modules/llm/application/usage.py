"""LLM token usage aggregator — Slice 0b.

按 user / 全局 / by feature / by date 聚合 llm_token_usage 表数据, 给前端
Profile LlmUsageCard + admin LlmUsageAdmin view 用.

cost_cents 中任一行 NULL (BYOM 无价格) → 该聚合维度返 None (而非把 NULL 当 0
混入 sum). 让 admin 能区分"真实低成本"vs"BYOM 没价格表无法估算".
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db.models import LlmTokenUsage, User


@dataclass(frozen=True)
class UsageByFeature:
    prompt_tokens: int
    completion_tokens: int
    cost_cents: int | None


@dataclass(frozen=True)
class UsageDay:
    date: date
    tokens: int
    cost_cents: int | None


@dataclass(frozen=True)
class UsageByUser:
    """Admin-only dimension: 每用户聚合, sorted by total_tokens desc.

    user_id=None 用于匿名 (e.g. 已删除用户的 dangling row 走 ON DELETE SET NULL).
    username=None when user_id is None or user 已删除 (lookup miss).
    """

    user_id: int | None
    username: str | None
    total_tokens: int
    total_cost_cents: int | None


@dataclass(frozen=True)
class UsageSummary:
    total_tokens: int
    total_cost_cents: int | None
    by_feature: dict[str, UsageByFeature]
    recent_days: list[UsageDay]
    # Admin-only: 全用户烧 token 排行 (P1 #6 from 2nd review). user view 此字段
    # 永远 None — admin 看 "哪个用户烧最多 token" 是 dashboard 核心问题.
    by_user: list[UsageByUser] | None = None


def _sum_cost_cents(values: list[int | None]) -> int | None:
    """Sum cost_cents. None if 任一是 None (BYOM 无价格 → 总数无法精确).

    Safer than treating None as 0 — 那会让 dashboard 显示 lower-bound 让 admin
    误判"花得不多". 显式 N/A 让 admin 知道某些 call 价格没算.
    """
    if any(v is None for v in values):
        return None
    return sum(v for v in values if v is not None)


def _today_utc() -> date:
    """UTC date anchor — 跟 cutoff 共享同一参考点防 1-day off-by-one."""
    return datetime.now(UTC).date()


def _zero_padded_days(window_days: int, today: date | None = None) -> list[UsageDay]:
    """空 user (没记账) → 返 N 天 0 序列. 避免 chart 空白.

    today 参数让 caller 复用同一 anchor (跟 _aggregate_recent_days 共享),
    防 zero-pad 跟数据 bucket 用不同 today (跨午夜 UTC race).
    """
    anchor = today or _today_utc()
    return [
        UsageDay(date=anchor - timedelta(days=offset), tokens=0, cost_cents=0)
        for offset in range(window_days - 1, -1, -1)
    ]


def _aggregate_by_feature(rows: list[LlmTokenUsage]) -> dict[str, UsageByFeature]:
    feature_groups: dict[str, list[LlmTokenUsage]] = defaultdict(list)
    for row in rows:
        feature_groups[row.feature].append(row)
    return {
        feat: UsageByFeature(
            prompt_tokens=sum(r.prompt_tokens for r in feat_rows),
            completion_tokens=sum(r.completion_tokens for r in feat_rows),
            cost_cents=_sum_cost_cents([r.cost_cents for r in feat_rows]),
        )
        for feat, feat_rows in feature_groups.items()
    }


def _aggregate_recent_days(
    rows: list[LlmTokenUsage], window_days: int, today: date
) -> list[UsageDay]:
    """Bucket rows by UTC date, zero-pad missing days. Returns 升序 (oldest → today).

    today 由 caller 传入 (UTC anchor) 让 cutoff + zero-pad + bucket 三处共享.
    """
    day_groups: dict[date, list[LlmTokenUsage]] = defaultdict(list)
    for row in rows:
        day_groups[row.created_at.date()].append(row)
    days: list[UsageDay] = []
    for offset in range(window_days - 1, -1, -1):
        d = today - timedelta(days=offset)
        day_rows = day_groups.get(d, [])
        if day_rows:
            days.append(UsageDay(
                date=d,
                tokens=sum(r.total_tokens for r in day_rows),
                cost_cents=_sum_cost_cents([r.cost_cents for r in day_rows]),
            ))
        else:
            days.append(UsageDay(date=d, tokens=0, cost_cents=0))
    return days


def _aggregate_by_user(rows: list[LlmTokenUsage], db: Session) -> list[UsageByUser]:
    """Admin: 按 user_id 聚合 + JOIN users 拿 username. Sorted by tokens desc."""
    user_groups: dict[int | None, list[LlmTokenUsage]] = defaultdict(list)
    for row in rows:
        user_groups[row.user_id].append(row)
    # Bulk fetch usernames (单 SQL query 对所有 non-null user_ids).
    user_ids = [uid for uid in user_groups.keys() if uid is not None]
    # Identity v2: User.username 改 nullable, 新 phone 注册用户 username=None.
    usernames: dict[int, str | None] = {}
    if user_ids:
        users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
        usernames = {u.id: u.username for u in users}
    by_user = [
        UsageByUser(
            user_id=uid,
            username=usernames.get(uid) if uid is not None else None,
            total_tokens=sum(r.total_tokens for r in user_rows),
            total_cost_cents=_sum_cost_cents([r.cost_cents for r in user_rows]),
        )
        for uid, user_rows in user_groups.items()
    ]
    by_user.sort(key=lambda u: u.total_tokens, reverse=True)
    return by_user


def _cutoff_for_window(today: date, window_days: int) -> datetime:
    """Cutoff = day-start of (today - (window_days - 1)) days ago, UTC.

    覆盖完整 N 天 (含今天). e.g. days=30 → cutoff = 29 天前 00:00:00, 含
    cutoff 当天的 row. 避免 'now - 30 days' 让 30 天前 23:59 那条 row 漏.
    """
    start_date = today - timedelta(days=window_days - 1)
    return datetime.combine(start_date, time.min)


def _build_summary(
    rows: list[LlmTokenUsage], window_days: int, today: date
) -> UsageSummary:
    """Pure function: rows → UsageSummary. db query 在调用方.

    today 由 caller 传入 (UTC anchor), 让 cutoff + zero-pad + bucket 三处共享
    同一参考点, 防跨午夜 UTC race / off-by-one.
    """
    if not rows:
        return UsageSummary(
            total_tokens=0,
            total_cost_cents=0,
            by_feature={},
            recent_days=_zero_padded_days(window_days, today),
        )
    return UsageSummary(
        total_tokens=sum(r.total_tokens for r in rows),
        total_cost_cents=_sum_cost_cents([r.cost_cents for r in rows]),
        by_feature=_aggregate_by_feature(rows),
        recent_days=_aggregate_recent_days(rows, window_days, today),
    )


def get_user_usage_summary(
    db: Session, *, user_id: int, days: int = 30
) -> UsageSummary:
    """User dashboard: 'My LLM usage' card. Aggregate over last N days (含今天).

    Note: 时区按 UTC bucket. UTC+8 用户在凌晨 1:00 (= UTC 17:00 前一天) 的
    call 显示在前一天 — PoC 阶段接受 UTC 约定. 完整 timezone-aware 处理留
    v0.4 (frontend timezone 转换 OR backend 接 user_tz 参数).
    """
    today = _today_utc()
    cutoff = _cutoff_for_window(today, days)
    stmt = (
        select(LlmTokenUsage)
        .where(LlmTokenUsage.user_id == user_id)
        .where(LlmTokenUsage.created_at >= cutoff)
    )
    rows = list(db.scalars(stmt))
    return _build_summary(rows, days, today)


def get_admin_usage_summary(db: Session, *, days: int = 30) -> UsageSummary:
    """Admin dashboard: system-wide aggregate + by_user 排行.

    含匿名 user_id=NULL 的 call (匿名访问 / 已删除用户 dangling row).
    by_user 是 admin-only 字段 (user view 永远 None).
    """
    today = _today_utc()
    cutoff = _cutoff_for_window(today, days)
    stmt = select(LlmTokenUsage).where(LlmTokenUsage.created_at >= cutoff)
    rows = list(db.scalars(stmt))
    summary = _build_summary(rows, days, today)
    return UsageSummary(
        total_tokens=summary.total_tokens,
        total_cost_cents=summary.total_cost_cents,
        by_feature=summary.by_feature,
        recent_days=summary.recent_days,
        by_user=_aggregate_by_user(rows, db),
    )
