"""SIKAO 行测专项 — 4 endpoint 聚合 service (mirror essay_specialty.py).

配套 sikao (6).zip lhr 提供的 essay-redesign.html hifi 复用到行测专项. 4 个
read-only 聚合 endpoint 集中在此 service:

  - get_specialty_summary(user_id) → StatStrip totals + ResumeHero
  - get_specialty_categories(user_id) → 5 大类 + per-question 三态
  - list_xingce_papers_extended(user_id, filters, page) → PaperRow 扩字段
  - get_xingce_papers_filters() → regions / years / paperTypes

跟 essay_specialty 关键差异:
  - 行测无 score 维度 → avg_score 用 PracticeSessionAnswer.is_correct 算正确率百分比
  - 行测用 PracticeSession + PracticeSessionAnswer (替代 EssayGradingRecord)
  - 5 大类硬编码: 言语 / 判断 / 数量 / 资料 / 常识. 实际 question 表 canonical_subtype
    真值杂(来自 PG 抽样: 35 distinct value), 用关键字 prefix bucket 归并
  - track='gk' (行测综合) vs essay 'sk' (申论)

设计原则同 essay:
  - 0 schema migration (基于 questions + practice_sessions + practice_session_answers)
  - avoid N+1 (聚合 SQL + 一次 LEFT JOIN, 不 per-row 子查询)
  - 跨用户 isolation: user_id 不在则 totals=0 / resume=None / 全 status='pending'
  - Asia/Shanghai 本地日按 +08:00 截断
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, desc, exists, func, select
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import (
    Paper,
    PaperRevision,
    PracticeSession,
    PracticeSessionAnswer,
    Question,
)
from sikao_api.modules.system.application.errors import ValidationError

# ── Constants ────────────────────────────────────────────────────────────

# Asia/Shanghai = UTC+08:00 (无 DST), 应用层 offset 截本地日.
_CN_TZ_OFFSET = timedelta(hours=8)

# Week goal MVP 硬编码 7. 后续接入 user_goals 可读 DB.
_WEEK_GOAL_TOTAL = 7

# 5 大类硬编码顺序 + 关键字 bucket 规则.
#
# 关键设计: PG 真值 (35 distinct subtype) 大量细分名 (e.g. "图形推理" /
# "逻辑推理" / "公共基础知识-单项选择题"), 不能 IN 列表精确 match. 用 keyword
# prefix bucket — 应用层 string contains 判断, 优先级按本列表顺序 (上到下).
#
# **优先级关键**: "常识判断" 必须在 "判断推理" 之前 check (常识判断 contains
# "判断" 会被误归到 panduan), 所以 changshi 列在 panduan 后但单独显式 keyword
# 避免误触. 应用层 bucket() 函数走 explicit keyword 优先 + suffix tail check.
_XINGCE_CATEGORIES: list[dict[str, Any]] = [
    {
        "id": "yanyu",
        "idx": 1,
        "name": "言语理解",
        "desc": "片段阅读 · 选词填空 · 语句表达",
        # 含 "言语" 的全部 subtype (言语理解 / 言语理解与表达 / 言语理解与表达能力 /
        # 言语能力与表达 / 言语能力)
        "keywords": ["言语", "选词填空", "段落阅读", "阅读理解", "语句表达"],
    },
    {
        "id": "panduan",
        "idx": 2,
        "name": "判断推理",
        "desc": "图形推理 · 定义判断 · 类比推理 · 逻辑判断",
        # 注意: "常识判断" 虽含 "判断" 但归 changshi, _bucket() 函数走显式优先
        "keywords": [
            "判断推理",
            "图形推理",
            "定义判断",
            "类比推理",
            "逻辑推理",
            "演绎推理",
            "数字推理",
            "思维能力测验",
        ],
    },
    {
        "id": "shuliang",
        "idx": 3,
        "name": "数量关系",
        "desc": "数学运算 · 数学推理",
        "keywords": ["数量", "数学运算", "数理", "数学"],
    },
    {
        "id": "ziliao",
        "idx": 4,
        "name": "资料分析",
        "desc": "图表数据 · 复合资料 · 计算分析",
        # "资科分析" / "资料分斩" 是 OCR typo, 同样吞
        "keywords": ["资料", "资科", "资料分析", "资料分斩"],
    },
    {
        "id": "changshi",
        "idx": 5,
        "name": "常识判断",
        "desc": "政治 · 法律 · 经济 · 人文 · 科技 · 地理",
        "keywords": [
            "常识",
            "公共基础",
            "综合知识",
            "综合基础",
            "综合分析",
            "知觉速度与准确性",
            "科学推理",
            "常识应用能力",
        ],
    },
]


def _bucket_subtype(subtype: str | None) -> str | None:
    """Map raw canonical_subtype → 5 大类 id (yanyu / panduan / shuliang / ziliao / changshi).

    返 None 表示该 subtype 不属于任何 5 大类 (e.g. 全空 / "其他"). 当前
    PG 真值全部都能落到 5 大类 (验证过 35 distinct), 但留 fallback 防空值.

    优先级顺序 = _XINGCE_CATEGORIES 顺序; **常识 bucket 在判断 bucket 之后但
    走显式 keyword 排他 — "常识判断" 含 "判断" 但 keyword "常识" 命中早, 所以
    先 yanyu → panduan → shuliang → ziliao → changshi 顺序中, 命中第一个就 break.
    "常识判断" 在 panduan check 时 keyword "判断推理" / "图形推理" / "定义判断" /
    "类比推理" / "逻辑推理" 都不命中 (因为是 contains 不是 prefix), 所以不会误归
    panduan, 接着 changshi check "常识" 命中 → ✓. 此设计 explicit cover edge case.
    """
    if subtype is None:
        return None
    for cat in _XINGCE_CATEGORIES:
        for kw in cat["keywords"]:
            if kw in subtype:
                return str(cat["id"])
    return None


def _convert_to_local_date(dt: datetime) -> str:
    """UTC datetime → "YYYY-MM-DD" Asia/Shanghai local date.

    DB 存的 datetime 是 naive UTC (utc_now 出来). 加 8h 截 date 部分.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    local = dt + _CN_TZ_OFFSET
    return local.strftime("%Y-%m-%d")


def _derive_region(source_provider: str | None, paper_code: str) -> str:
    """从 source_provider / paper_code 派生 region bucket (跟 essay 同逻辑)."""
    code_upper = paper_code.upper()
    if "GUOKAO" in code_upper or "GK" in code_upper or "国考" in paper_code:
        return "国考"
    if "SHENGKAO" in code_upper or "SK" in code_upper or "省考" in paper_code:
        return "省考"
    return source_provider or "其他"


def _derive_xingce_difficulty(question_count: int) -> int | None:
    """从 question_count 启发式派生 1-3 难度 (行测).

    行测一般 100-135 题 (国考行测 130-135, 省考 100-120, 模考 80-100). 偏离视为
    特殊小卷 (如知识测验) → 调低难度. 0 题 → None (异常卷, FE 隐藏 dot).
    """
    if question_count <= 0:
        return None
    if question_count <= 30:
        return 1
    if question_count <= 80:
        return 2
    return 3


class XingceSpecialtyAggregationService:
    """SIKAO 行测专项 4 endpoint 聚合 service (read-only)."""

    def __init__(self, session: Session) -> None:
        self.session = session

    # ── 1. /summary ──────────────────────────────────────────────────────

    def get_specialty_summary(
        self, *, user_id: int
    ) -> schemas.XingceSpecialtySummaryV2:
        """StatStrip totals + ResumeHero data (行测).

        行测没有 score 字段; avg_score 改算"正确率百分比" =
        sum(is_correct=True) / sum(distinct answered) * 100. 用 PracticeSessionAnswer
        作为答题记录主表.
        """
        # ── total: 全 public 行测 题数 ──
        total_stmt = (
            select(func.count(Question.id))
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind != "essay",
            )
        )
        total = int(self.session.scalar(total_stmt) or 0)

        # ── practiced: 当前 user distinct answered question 数 ──
        practiced_stmt = (
            select(func.count(func.distinct(PracticeSessionAnswer.question_id)))
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(PracticeSession.user_id == user_id)
        )
        practiced = int(self.session.scalar(practiced_stmt) or 0)

        # ── week_done: 最近 7 天 PracticeSessionAnswer 数 (含同题再答) ──
        now_utc = datetime.now(UTC).replace(tzinfo=None)
        week_start = now_utc - timedelta(days=7)
        week_done_stmt = (
            select(func.count(PracticeSessionAnswer.id))
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(
                PracticeSession.user_id == user_id,
                PracticeSessionAnswer.answered_at >= week_start,
            )
        )
        week_done = int(self.session.scalar(week_done_stmt) or 0)

        # ── avg_score: 正确率百分比 0-100, 跨全部 answer (含重答) ──
        all_answer_stmt = (
            select(
                func.count(PracticeSessionAnswer.id).label("total_n"),
                func.sum(
                    func.cast(PracticeSessionAnswer.is_correct, type_=type(Question.enabled.type))
                ).label("correct_n"),
            )
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(PracticeSession.user_id == user_id)
        )
        # 简化: 直接两条 query 算 (避开 cast 兼容 SQLite/PG 麻烦)
        total_n_stmt = (
            select(func.count(PracticeSessionAnswer.id))
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(PracticeSession.user_id == user_id)
        )
        correct_n_stmt = (
            select(func.count(PracticeSessionAnswer.id))
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(
                PracticeSession.user_id == user_id,
                PracticeSessionAnswer.is_correct.is_(True),
            )
        )
        # `all_answer_stmt` 仅占位避免 lint unused — 上方双 query 才是真算法 (兼容 SQLite/PG)
        _ = all_answer_stmt
        total_n = int(self.session.scalar(total_n_stmt) or 0)
        correct_n = int(self.session.scalar(correct_n_stmt) or 0)
        avg_score = (correct_n / total_n * 100) if total_n > 0 else 0.0

        # ── streak_days: Asia/Shanghai 本地日连续 (按 PracticeSessionAnswer.answered_at) ──
        answered_stmt = (
            select(PracticeSessionAnswer.answered_at)
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(PracticeSession.user_id == user_id)
            .order_by(PracticeSessionAnswer.answered_at.desc())
        )
        local_dates: set[str] = set()
        for (answered_at,) in self.session.execute(answered_stmt).all():
            if answered_at is None:
                continue
            local_dates.add(_convert_to_local_date(answered_at))

        streak_days = _compute_streak_days(local_dates, now_utc)

        totals = schemas.XingceSpecialtyTotalsV2(
            practiced=practiced,
            total=total,
            streak_days=streak_days,
            week_done=week_done,
            avg_score=round(avg_score, 2),
        )

        resume = self._build_resume(user_id=user_id)
        return schemas.XingceSpecialtySummaryV2(totals=totals, resume=resume)

    def _build_resume(
        self, *, user_id: int
    ) -> schemas.XingceSpecialtyResumeV2 | None:
        """ResumeHero: 取最近一条 PracticeSessionAnswer, 派生续答信息.

        无 answer record → None (前端隐藏 ResumeHero).
        """
        # 拉 user 最新一条 PracticeSessionAnswer + 关联 question.canonical_subtype
        latest_stmt = (
            select(
                PracticeSessionAnswer.question_id,
                PracticeSessionAnswer.answered_at,
                Question.canonical_subtype,
            )
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .join(Question, Question.id == PracticeSessionAnswer.question_id)
            .where(PracticeSession.user_id == user_id)
            .order_by(desc(PracticeSessionAnswer.answered_at))
            .limit(1)
        )
        latest_row = self.session.execute(latest_stmt).first()
        if latest_row is None:
            return None
        latest_qid, _latest_at, raw_subtype = latest_row
        bucket_id = _bucket_subtype(raw_subtype)
        if bucket_id is None:
            # 该 subtype 没归到 5 大类 — fail-soft 隐藏 resume
            return None
        cat_meta = next(c for c in _XINGCE_CATEGORIES if c["id"] == bucket_id)
        cat_name = str(cat_meta["name"])

        # 计算该类下 user distinct answered + total
        # 注: bucket 是 keyword contains, SQL 没办法直接 IN 一个 list 然后再字符
        # contains; 走 OR LIKE 列表 (≤8 关键字, 不会爆 query plan).
        keyword_filters = [
            Question.canonical_subtype.like(f"%{kw}%") for kw in cat_meta["keywords"]
        ]

        from sqlalchemy import or_

        # subtype 下 user distinct answered 数
        done_count_stmt = (
            select(func.count(func.distinct(PracticeSessionAnswer.question_id)))
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .join(Question, Question.id == PracticeSessionAnswer.question_id)
            .where(
                PracticeSession.user_id == user_id,
                or_(*keyword_filters),
            )
        )
        done_count = int(self.session.scalar(done_count_stmt) or 0)

        # 该 bucket 下 public 题总数
        total_stmt = (
            select(func.count(Question.id))
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind != "essay",
                or_(*keyword_filters),
            )
        )
        q_total = int(self.session.scalar(total_stmt) or 0)

        # 最近 5 条 answer 是否正确 → 100/0
        last_correct_stmt = (
            select(PracticeSessionAnswer.is_correct)
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(PracticeSession.user_id == user_id)
            .order_by(desc(PracticeSessionAnswer.answered_at))
            .limit(5)
        )
        last_scores = [
            (100.0 if c else 0.0)
            for (c,) in self.session.execute(last_correct_stmt).all()
        ]

        # 本周 answer 数
        now_utc = datetime.now(UTC).replace(tzinfo=None)
        week_start = now_utc - timedelta(days=7)
        week_done_stmt = (
            select(func.count(PracticeSessionAnswer.id))
            .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
            .where(
                PracticeSession.user_id == user_id,
                PracticeSessionAnswer.answered_at >= week_start,
            )
        )
        week_done = int(self.session.scalar(week_done_stmt) or 0)

        return schemas.XingceSpecialtyResumeV2(
            type_name=cat_name,
            question_id=int(latest_qid),
            q_index=min(done_count + 1, max(q_total, 1)),
            q_total=q_total,
            last_scores=last_scores,
            week_goal=[week_done, _WEEK_GOAL_TOTAL],
        )

    # ── 2. /categories ───────────────────────────────────────────────────

    def get_specialty_categories(
        self, *, user_id: int | None
    ) -> schemas.XingceSpecialtyCategoriesResponseV2:
        """5 大类 + per-question 子行三态 (行测).

        每类返 sub_types: 前 6 道该类题 (按 year DESC NULLS LAST → paper_code →
        position 排序), 每行带 status (done / progress / pending) + meta.

        匿名 (user_id=None) → 全 status='pending', done count 0.
        """
        # 拉所有 public 行测 question + canonical_subtype, 应用层做 bucket
        all_qs_stmt = (
            select(
                Question.canonical_subtype,
                Question.id,
                Question.position,
                Question.exam_year,
                Paper.paper_code,
                Paper.source_provider,
            )
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind != "essay",
                Question.canonical_subtype.is_not(None),
            )
        )
        all_rows = self.session.execute(all_qs_stmt).all()

        # 按 5 大类 bucket id 分桶
        buckets: dict[str, list[dict[str, Any]]] = {
            str(c["id"]): [] for c in _XINGCE_CATEGORIES
        }
        for subtype, qid, position, exam_year, paper_code, source_provider in all_rows:
            bucket_id = _bucket_subtype(subtype)
            if bucket_id is None:
                continue
            buckets[bucket_id].append({
                "question_id": int(qid),
                "position": int(position),
                "exam_year": int(exam_year) if exam_year is not None else None,
                "paper_code": str(paper_code),
                "source_provider": source_provider,
                "raw_subtype": subtype,
            })

        # ── 用户对每题状态 (done / progress / pending) ──
        done_qids: set[int] = set()
        progress_qids: set[int] = set()
        if user_id is not None:
            # done: 任何 PracticeSessionAnswer 存在 → done
            done_stmt = (
                select(func.distinct(PracticeSessionAnswer.question_id))
                .join(PracticeSession, PracticeSession.id == PracticeSessionAnswer.session_id)
                .where(PracticeSession.user_id == user_id)
            )
            for (qid,) in self.session.execute(done_stmt).all():
                if qid is not None:
                    done_qids.add(int(qid))

            # progress: in-progress session (completed_at IS NULL) 关联的
            # batch 中题 — 用户开始了但还没 commit answer. 需要走
            # session.paper_revision_id 反查 question, 或 retry batch 走
            # retry_question_ids_json. MVP 简化: 跳过 progress 检测,
            # 全 essay 三态语义在行测意义不大 (一般答完即 commit). 留 stub
            # 接 retry 系统时再 wire.
            # progress_qids 永远空 set → status 只有 done / pending 两态.
            pass

        cats: list[schemas.XingceSpecialtyCategoryV2] = []
        for cat in _XINGCE_CATEGORIES:
            cat_id = str(cat["id"])
            cat_name = str(cat["name"])
            cat_idx = int(cat["idx"])
            cat_desc = str(cat["desc"])
            bucket = buckets.get(cat_id, [])
            # 排序: year DESC NULLS LAST → paper_code ASC → position ASC
            bucket.sort(
                key=lambda r: (
                    -(r["exam_year"] or -1),
                    r["paper_code"],
                    r["position"],
                )
            )
            total = len(bucket)
            preview = bucket[:6]
            sub_types: list[schemas.XingceSpecialtySubtypeRowV2] = []
            done_in_category = 0
            for row in preview:
                qid = row["question_id"]
                if qid in done_qids:
                    status_label: str = "done"
                    practiced_one = 1
                elif qid in progress_qids:
                    status_label = "progress"
                    practiced_one = 0
                else:
                    status_label = "pending"
                    practiced_one = 0
                region = _derive_region(row["source_provider"], row["paper_code"])
                year_label = (
                    str(row["exam_year"])
                    if row["exam_year"] is not None
                    else "未知年份"
                )
                meta = f"{year_label} {region} · 第 {row['position']} 题"
                # name 用 raw subtype 跟具体题号区分 (e.g. "图形推理 · 第 3 题")
                raw_st = row["raw_subtype"] or cat_name
                sub_types.append(
                    schemas.XingceSpecialtySubtypeRowV2(
                        id=f"q-{qid}",
                        question_id=qid,
                        name=f"{raw_st} · 第 {row['position']} 题",
                        meta=meta,
                        practiced=practiced_one,
                        total=1,
                        status=status_label,  # type: ignore[arg-type]
                    )
                )
            for row in bucket:
                if row["question_id"] in done_qids:
                    done_in_category += 1
            overall_progress = (done_in_category / total) if total > 0 else 0.0
            state: str | None = "empty" if total == 0 else None
            cats.append(
                schemas.XingceSpecialtyCategoryV2(
                    id=cat_id,
                    idx=cat_idx,
                    name=cat_name,
                    desc=cat_desc,
                    overall_progress=round(min(1.0, max(0.0, overall_progress)), 4),
                    practiced=done_in_category,
                    total=total,
                    sub_types=sub_types,
                    state=state,  # type: ignore[arg-type]
                )
            )

        return schemas.XingceSpecialtyCategoriesResponseV2(cats=cats)

    # ── 3. /list/extended ────────────────────────────────────────────────

    def list_xingce_papers_extended(
        self,
        *,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        region: str | None = None,
        year: int | None = None,
        paper_type: str | None = None,
        sort: str = "default",
    ) -> schemas.XingcePapersListExtendedResponseV2:
        """扩字段版 行测 paper list.

        filters: region / year / paper_type — 跟 essay 镜像
        sort: default(sort_order DESC) / year(year DESC) / recent(lastAttempt DESC)
        last_attempt: 取 user 在此 paper 上最新 PracticeSession (按 completed_at,
          NULL → 用最新 answer.answered_at). score = 此 session 内正确率百分比.
        progress: <distinct user answered question 数> / <revision question total>
        status: 0 已做 = todo; 0<done<total = doing; done==total = done
        avoid N+1: 一次 IN 查所有 question_ids 关联的 PracticeSessionAnswer.
        """
        if page < 1:
            raise ValidationError("page must be >= 1", code="invalid_page")
        if page_size < 1 or page_size > 50:
            raise ValidationError(
                "page_size must be in [1, 50]", code="invalid_page_size"
            )
        if sort not in {"default", "year", "recent"}:
            raise ValidationError(
                "sort must be one of default/year/recent", code="invalid_sort"
            )

        xingce_filter = exists().where(
            and_(
                Question.paper_revision_id == PaperRevision.id,
                Question.question_kind != "essay",
                Question.enabled.is_(True),
            )
        )
        base_where = [
            Paper.current_revision_id.is_not(None),
            PaperRevision.visible_in_public.is_(True),
            xingce_filter,
        ]
        if year is not None:
            base_where.append(PaperRevision.exam_year == year)
        if paper_type is not None and paper_type != "全部":
            base_where.append(PaperRevision.source_kind == paper_type)
        if region is not None and region != "全部":
            if region == "国考":
                base_where.append(
                    func.lower(Paper.paper_code).like("%guokao%")
                )
            elif region == "省考":
                base_where.append(
                    func.lower(Paper.paper_code).like("%shengkao%")
                )
            else:
                base_where.append(PaperRevision.source_provider == region)

        count_stmt = (
            select(func.count(Paper.id))
            .join(Paper.current_revision)
            .where(*base_where)
        )
        total = int(self.session.scalar(count_stmt) or 0)

        list_stmt = (
            select(Paper, PaperRevision)
            .join(Paper.current_revision)
            .where(*base_where)
        )
        if sort == "year":
            list_stmt = list_stmt.order_by(
                desc(PaperRevision.exam_year).nulls_last(),
                Paper.paper_code.asc(),
            )
        else:
            list_stmt = list_stmt.order_by(
                desc(PaperRevision.sort_order),
                Paper.paper_code.asc(),
            )
        list_stmt = list_stmt.limit(page_size).offset((page - 1) * page_size)
        paper_rows: list[tuple[Paper, PaperRevision]] = [
            (row[0], row[1]) for row in self.session.execute(list_stmt).all()
        ]

        if not paper_rows:
            return schemas.XingcePapersListExtendedResponseV2(
                items=[],
                total=total,
                page=page,
                page_size=page_size,
            )

        revision_ids = [r.id for _, r in paper_rows]

        # 1 次 join 拉所有 paper 下的 question_id → revision_id 映射
        q_map_stmt = (
            select(Question.id, Question.paper_revision_id)
            .where(
                Question.paper_revision_id.in_(revision_ids),
                Question.enabled.is_(True),
                Question.question_kind != "essay",
            )
        )
        qid_to_revision: dict[int, int] = {
            int(qid): int(rev_id)
            for qid, rev_id in self.session.execute(q_map_stmt).all()
        }
        revision_to_qids: dict[int, list[int]] = {}
        for qid, rev_id in qid_to_revision.items():
            revision_to_qids.setdefault(rev_id, []).append(qid)

        # 1 次大 query 拉 user 所有相关 PracticeSessionAnswer + session metadata
        # (joined 拿 session.paper_revision_id + completed_at). 索引方向: paper
        # → answer / answer → paper.
        user_answers_by_qid: dict[
            int, list[tuple[PracticeSessionAnswer, PracticeSession]]
        ] = {}
        if qid_to_revision:
            user_answers_stmt = (
                select(PracticeSessionAnswer, PracticeSession)
                .join(
                    PracticeSession,
                    PracticeSession.id == PracticeSessionAnswer.session_id,
                )
                .where(
                    PracticeSession.user_id == user_id,
                    PracticeSessionAnswer.question_id.in_(
                        list(qid_to_revision.keys())
                    ),
                )
                .order_by(PracticeSessionAnswer.answered_at.desc())
            )
            for ans, sess in self.session.execute(user_answers_stmt).all():
                qid = int(ans.question_id)
                user_answers_by_qid.setdefault(qid, []).append((ans, sess))

        items: list[schemas.XingcePaperListItemV2Extended] = []
        for paper, revision in paper_rows:
            qids = revision_to_qids.get(revision.id, [])
            paper_total = len(qids)
            done_qids: set[int] = set()
            session_correct: dict[int, int] = {}  # session_id → correct count
            session_total: dict[int, int] = {}  # session_id → answered count
            session_latest_at: dict[int, datetime] = {}  # session_id → latest answered_at
            session_completed_at: dict[int, datetime | None] = {}

            for qid in qids:
                rows = user_answers_by_qid.get(qid, [])
                for ans, sess in rows:
                    done_qids.add(qid)
                    sid = int(sess.id)
                    session_total[sid] = session_total.get(sid, 0) + 1
                    if ans.is_correct:
                        session_correct[sid] = session_correct.get(sid, 0) + 1
                    if (
                        sid not in session_latest_at
                        or ans.answered_at > session_latest_at[sid]
                    ):
                        session_latest_at[sid] = ans.answered_at
                    session_completed_at[sid] = sess.completed_at

            done_count = len(done_qids)
            if paper_total > 0 and done_count >= paper_total:
                status_label: str = "done"
            elif done_count > 0:
                status_label = "doing"
            else:
                status_label = "todo"

            # last_attempt: 选最新一个 session (用 completed_at NULLS-LAST,
            # fallback latest_at). 用 default-arg 绑定避免 B023 loop variable.
            last_attempt: schemas.XingceLastAttemptV2 | None = None
            if session_total:
                def _attempt_at(
                    sid: int,
                    _completed: dict[int, datetime | None] = session_completed_at,
                    _latest: dict[int, datetime] = session_latest_at,
                ) -> datetime:
                    return _completed.get(sid) or _latest[sid]

                top_sid = max(session_total.keys(), key=_attempt_at)
                ans_at = _attempt_at(top_sid)
                if ans_at.tzinfo is None:
                    ans_at = ans_at.replace(tzinfo=UTC)
                top_correct = session_correct.get(top_sid, 0)
                top_total = session_total[top_sid]
                score = (top_correct / top_total * 100) if top_total > 0 else 0.0
                last_attempt = schemas.XingceLastAttemptV2(
                    score=round(score, 2),
                    submitted_at=ans_at,
                )

            items.append(
                schemas.XingcePaperListItemV2Extended(
                    id=paper.id,
                    paper_code=paper.paper_code,
                    paper_name=revision.paper_name,
                    exam_year=revision.exam_year,
                    source_provider=revision.source_provider,
                    source_kind=revision.source_kind,
                    question_count=revision.question_count,
                    current_revision_id=paper.current_revision_id,
                    region=_derive_region(
                        revision.source_provider, paper.paper_code
                    ),
                    track="gk",  # 行测固定 gk
                    difficulty=_derive_xingce_difficulty(
                        revision.question_count
                    ),  # type: ignore[arg-type]
                    status=status_label,  # type: ignore[arg-type]
                    progress=f"{done_count}/{paper_total}",
                    last_attempt=last_attempt,
                    pinned=False,
                )
            )

        # 应用层 recent sort
        if sort == "recent":
            items.sort(
                key=lambda it: (
                    it.last_attempt.submitted_at
                    if it.last_attempt is not None
                    else datetime(1970, 1, 1, tzinfo=UTC)
                ),
                reverse=True,
            )

        return schemas.XingcePapersListExtendedResponseV2(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    # ── 4. /filters ──────────────────────────────────────────────────────

    def get_xingce_papers_filters(
        self,
    ) -> schemas.XingcePapersFiltersResponseV2:
        """返候选 chip 集合 (regions / years / paper_types) — 行测."""
        xingce_filter = exists().where(
            and_(
                Question.paper_revision_id == PaperRevision.id,
                Question.question_kind != "essay",
                Question.enabled.is_(True),
            )
        )

        # ── years ──
        years_stmt = (
            select(PaperRevision.exam_year.distinct())
            .join(Paper, Paper.current_revision_id == PaperRevision.id)
            .where(
                PaperRevision.visible_in_public.is_(True),
                PaperRevision.exam_year.is_not(None),
                xingce_filter,
            )
            .order_by(desc(PaperRevision.exam_year))
        )
        years = [
            int(y)
            for (y,) in self.session.execute(years_stmt).all()
            if y is not None
        ]

        # ── paper_types ──
        kinds_stmt = (
            select(PaperRevision.source_kind.distinct())
            .join(Paper, Paper.current_revision_id == PaperRevision.id)
            .where(
                PaperRevision.visible_in_public.is_(True),
                PaperRevision.source_kind.is_not(None),
                xingce_filter,
            )
        )
        paper_types = sorted(
            {
                str(k)
                for (k,) in self.session.execute(kinds_stmt).all()
                if k is not None
            }
        )

        # ── regions: paper_code 派生 + source_provider distinct ──
        regions_set: set[str] = set()
        guokao_count_stmt = (
            select(func.count(Paper.id))
            .join(Paper.current_revision)
            .where(
                PaperRevision.visible_in_public.is_(True),
                xingce_filter,
                func.lower(Paper.paper_code).like("%guokao%"),
            )
        )
        if int(self.session.scalar(guokao_count_stmt) or 0) > 0:
            regions_set.add("国考")

        shengkao_count_stmt = (
            select(func.count(Paper.id))
            .join(Paper.current_revision)
            .where(
                PaperRevision.visible_in_public.is_(True),
                xingce_filter,
                func.lower(Paper.paper_code).like("%shengkao%"),
            )
        )
        if int(self.session.scalar(shengkao_count_stmt) or 0) > 0:
            regions_set.add("省考")

        provider_stmt = (
            select(PaperRevision.source_provider.distinct())
            .join(Paper, Paper.current_revision_id == PaperRevision.id)
            .where(
                PaperRevision.visible_in_public.is_(True),
                PaperRevision.source_provider.is_not(None),
                xingce_filter,
            )
        )
        for (provider,) in self.session.execute(provider_stmt).all():
            if provider is not None:
                regions_set.add(str(provider))

        regions = sorted(regions_set)

        return schemas.XingcePapersFiltersResponseV2(
            regions=regions,
            years=years,
            paper_types=paper_types,
        )


def _compute_streak_days(
    local_dates: set[str], now_utc: datetime
) -> int:
    """从 set of "YYYY-MM-DD" Asia/Shanghai local date 算 streak.

    streak = 从今天起往前数, 连续 N 天每天都有 answer. 中断即停.
    今天没做 → 0 (跟 essay 同保守策略, 不 +1 昨天起算).
    """
    if not local_dates:
        return 0
    today_local = _convert_to_local_date(now_utc)
    if today_local not in local_dates:
        return 0
    streak = 0
    cursor = now_utc
    while True:
        cursor_local = _convert_to_local_date(cursor)
        if cursor_local in local_dates:
            streak += 1
            cursor = cursor - timedelta(days=1)
        else:
            break
    return streak


__all__ = ["XingceSpecialtyAggregationService"]
