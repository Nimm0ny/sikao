"""SIKAO Wave 5: xingce-wrongbook Heatmap 子 module (plan 5.2 #6).

Heatmap 计算逻辑 — 从 wrong_book.py 拆出以满足单文件 ≤500 行 (§4 铁律).

5 行 × N 天 错题强度 + 当日错题率:
  - 行 5 模块固定顺序: 言语 / 数量 / 判推 / 资分 / 常识
  - 列 N 天: cells[N-1] = 今天, cells[0] = (N-1) 天前
  - Asia/Shanghai 本地日 (+8h offset, answered_at 是 UTC naive 写库)

Fail-Fast: days 不在 {7,30,90,180} 抛 ValidationError. 无数据返
5 行 × N cell count=0/rate=None (合法 empty state, 不抛).

Entry point: `compute_heatmap(session, *, user, days)` — free function.
`WrongBookService.compute_heatmap` 是 thin wrapper 透明转发 (router 不动).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import (
    PracticeSession,
    PracticeSessionAnswer,
    Question,
    User,
)
from sikao_api.modules.system.application.errors import ValidationError

# Heatmap: 行测 5 模块固定顺序 + 短名 (跟 xingce_specialty 5 大类对齐, 但用 UI 短名).
# Question.subject 真值是 Chinese full name (e.g. "言语理解"), keyword bucket
# 映射到短名 (e.g. "言语"). 跟 xingce_specialty._bucket_subtype 同思路 — keyword
# contains 优先级按本列表顺序 (上到下), 首个命中即归类. NULL subject 不归任何行.
_HEATMAP_SUBJECT_ORDER: tuple[schemas.WrongBookHeatmapSubject, ...] = (
    "言语",
    "数量",
    "判推",
    "资分",
    "常识",
)
_HEATMAP_SUBJECT_KEYWORDS: tuple[
    tuple[schemas.WrongBookHeatmapSubject, tuple[str, ...]], ...
] = (
    ("言语", ("言语", "选词填空", "段落阅读", "阅读理解", "语句表达")),
    ("数量", ("数量", "数学运算", "数理", "数学")),
    # 注意优先级: "常识" 必须先于 "判推" 匹配, 否则 "常识判断" 会被误归 "判推".
    ("常识", ("常识", "公共基础", "综合知识", "综合基础", "综合分析", "知觉速度", "科学推理")),
    ("判推", ("判断", "图形推理", "定义判断", "类比推理", "逻辑推理", "演绎推理", "数字推理")),
    ("资分", ("资料", "资科", "资料分析")),
)
_HEATMAP_ALLOWED_DAYS: frozenset[int] = frozenset({7, 30, 90, 180})
_CN_TZ_OFFSET = timedelta(hours=8)  # Asia/Shanghai (无 DST)


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _bucket_subject_short(
    subject_raw: str | None,
) -> schemas.WrongBookHeatmapSubject | None:
    """Map Question.subject (Chinese full name) → 行测 5 模块短名 (heatmap 行 key).

    e.g. "言语理解" → "言语" / "判断推理" → "判推" / "常识判断" → "常识".
    NULL / 未匹配 → None (该 question 不归入 heatmap 任何行).

    优先级见 _HEATMAP_SUBJECT_KEYWORDS — "常识" 关键字优先于 "判推" 防误归
    ("常识判断" 含 "判断" 但应归 "常识").
    """
    if subject_raw is None:
        return None
    for short_name, keywords in _HEATMAP_SUBJECT_KEYWORDS:
        for kw in keywords:
            if kw in subject_raw:
                return short_name
    return None


def compute_heatmap(
    session: Session, *, user: User, days: int
) -> schemas.WrongBookHeatmapResponse:
    """5 行 × N 天 错题强度 + 当日错题率.

    行 5 模块固定顺序: 言语 / 数量 / 判推 / 资分 / 常识.
    列 N 天: cells[N-1] = 今天, cells[0] = (N-1) 天前.
    Asia/Shanghai 本地日 (+8h offset, answered_at 是 UTC naive 写库).

    - count : 当日该 subject 答错题数 (PracticeSessionAnswer.is_correct=False)
    - rate  : 当日该 subject 错题率 = count / 当日 subject 总答题数; 无答题 → None
    - peak_idx : 行内 max count 的 cell index; 全 0 时 None
    - total : 行 sum count

    Fail-Fast: days 不在 {7,30,90,180} 抛 ValidationError. 无数据返
    5 行 × N cell count=0/rate=None (合法 empty state, 不抛).
    """
    if days not in _HEATMAP_ALLOWED_DAYS:
        raise ValidationError(
            f"days must be one of {sorted(_HEATMAP_ALLOWED_DAYS)}",
            code="invalid_days",
        )

    # 本地日窗口 (Asia/Shanghai). 今日 = (UTC now + 8h).date().
    today_local = (_utc_now_naive() + _CN_TZ_OFFSET).date()
    start_local = today_local - timedelta(days=days - 1)

    # 一次 SQL: 拉窗口内该 user 所有 (subject, local_date, is_correct) → 内存聚合.
    # 比走 N*5 个子查询省 RTT, 30 天 5 行 = 150 cell 内存聚合 O(N) 量级.
    wrong_by_cell, total_by_cell = _query_heatmap_buckets(
        session, user_id=user.id, start_local=start_local, today_local=today_local
    )

    rows = [
        _build_heatmap_row(
            subject_short=subject,
            start_local=start_local,
            days=days,
            wrong_by_cell=wrong_by_cell,
            total_by_cell=total_by_cell,
        )
        for subject in _HEATMAP_SUBJECT_ORDER
    ]
    return schemas.WrongBookHeatmapResponse(
        days=days,
        rows=rows,
        generated_at=_utc_now_naive(),
    )


def _query_heatmap_buckets(
    session: Session,
    *,
    user_id: int,
    start_local: date,
    today_local: date,
) -> tuple[dict[tuple[str, date], int], dict[tuple[str, date], int]]:
    """聚合 PracticeSessionAnswer 到 (subject_short, local_date) bucket.

    返 (wrong_by_cell, total_by_cell) 两个 dict. key=(subject_short, date).
    - wrong_by_cell : 错题数 (is_correct=False)
    - total_by_cell : 总答题数 (含对错)

    local_date 截法: answered_at 是 UTC naive, +8h 后取 date 部分 (应用层
    做, 避开 SQLite/PG 方言差异).
    """
    # window: 含今天的 days 天 → answered_at >= start_utc - 8h (容错跨日).
    start_utc_lower = datetime.combine(
        start_local, datetime.min.time()
    ) - _CN_TZ_OFFSET
    end_utc_upper = datetime.combine(
        today_local + timedelta(days=1), datetime.min.time()
    ) - _CN_TZ_OFFSET

    stmt = (
        select(
            Question.subject,
            PracticeSessionAnswer.answered_at,
            PracticeSessionAnswer.is_correct,
        )
        .join(Question, PracticeSessionAnswer.question_id == Question.id)
        .join(
            PracticeSession, PracticeSessionAnswer.session_id == PracticeSession.id
        )
        .where(
            PracticeSession.user_id == user_id,
            PracticeSessionAnswer.answered_at >= start_utc_lower,
            PracticeSessionAnswer.answered_at < end_utc_upper,
            Question.subject.is_not(None),
        )
    )
    wrong_by_cell: dict[tuple[str, date], int] = {}
    total_by_cell: dict[tuple[str, date], int] = {}
    for subject_raw, answered_at, is_correct in session.execute(stmt).all():
        subject_short = _bucket_subject_short(subject_raw)
        if subject_short is None:
            continue
        local_date = (answered_at + _CN_TZ_OFFSET).date()
        if local_date < start_local or local_date > today_local:
            continue
        cell_key = (subject_short, local_date)
        total_by_cell[cell_key] = total_by_cell.get(cell_key, 0) + 1
        if not is_correct:
            wrong_by_cell[cell_key] = wrong_by_cell.get(cell_key, 0) + 1
    return wrong_by_cell, total_by_cell


def _build_heatmap_row(
    *,
    subject_short: schemas.WrongBookHeatmapSubject,
    start_local: date,
    days: int,
    wrong_by_cell: dict[tuple[str, date], int],
    total_by_cell: dict[tuple[str, date], int],
) -> schemas.WrongBookHeatmapRow:
    """构造一行 N cell — count / rate / peak_idx / total."""
    cells: list[schemas.WrongBookHeatmapCell] = []
    peak_idx: int | None = None
    peak_count = 0
    total = 0
    for idx in range(days):
        day = start_local + timedelta(days=idx)
        cell_key = (subject_short, day)
        count = wrong_by_cell.get(cell_key, 0)
        total_day = total_by_cell.get(cell_key, 0)
        rate = (count / total_day) if total_day > 0 else None
        cells.append(
            schemas.WrongBookHeatmapCell(
                date=day,
                count=count,
                rate=round(rate, 4) if rate is not None else None,
            )
        )
        total += count
        if count > peak_count:
            peak_count = count
            peak_idx = idx
    return schemas.WrongBookHeatmapRow(
        subject=subject_short,
        cells=cells,
        peak_idx=peak_idx,
        total=total,
    )
