"""SIKAO Wave 4 Phase 2C — 申论专项练习 + 套卷扩字段聚合 service.

配套 docs/plan/sikao-module-essay-specialty-2026-05-11.md §3 schema. 4 个
read-only 聚合 endpoint 集中在此 service (避免污染 EssayGradingService /
ExamPaperService 的核心责任):

  - get_specialty_summary(user_id) → StatStrip totals + ResumeHero
  - get_specialty_categories(user_id) → 5 大类 + per-question 三态
  - list_essay_papers_extended(user_id, filters, page) → PaperRow 扩字段
  - get_essay_papers_filters() → 可选 regions / years / paperTypes

设计原则:
  - 0 schema migration (全部基于现有 essay_grading_records + papers + questions
    + practice_sessions 表的聚合查询)
  - avoid N+1 (聚合 SQL + 一次 LEFT JOIN, 不 per-row 子查询)
  - 跨用户 isolation: user_id 不在则 totals=0 / resume=None / 全 status='todo'
  - Asia/Shanghai 本地日按 +08:00 截断 (避开 PG `AT TIME ZONE` 跨方言问题, 用
    应用层 `convert_to_local_date` 兼容 SQLite test)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session

from sikao_api.db import schemas
from sikao_api.db.models import (
    EssayGradingRecord,
    Paper,
    PaperRevision,
    Question,
)
from sikao_api.modules.system.application.errors import ValidationError

# ── Constants ────────────────────────────────────────────────────────────

# Asia/Shanghai = UTC+08:00 (无 DST), 应用层 offset 截本地日.
_CN_TZ_OFFSET = timedelta(hours=8)

# Week goal MVP 硬编码 7 (每周做 7 题练习目标). 后续接入 user_goals 可读 DB.
_WEEK_GOAL_TOTAL = 7

# CategoryCard 5+1 类硬编码顺序 (跟 essay_grading.py 一致).
# 公文 + 应用文 在后端拆开返, 前端合并显示 "公文 · 应用文" 单卡.
_CATEGORY_ORDER: tuple[str, ...] = (
    "归纳概括",
    "综合分析",
    "提出对策",
    "公文",
    "应用文",
    "大作文",
)

# CategoryCard 描述文案 (按 plan §2.1 hifi essay-redesign.html cat-desc).
_CATEGORY_DESC: dict[str, str] = {
    "归纳概括": "提炼材料要点 · 概括成段",
    "综合分析": "辨析观点 · 论证立场",
    "提出对策": "针对问题 · 给出方案",
    "公文": "通知 / 报告 / 倡议书 等",
    "应用文": "发言稿 / 短评 / 工作方案 等",
    "大作文": "议论文写作 · 1000 字 +",
}


def _convert_to_local_date(dt: datetime) -> str:
    """UTC datetime → "YYYY-MM-DD" Asia/Shanghai local date.

    DB 存的 datetime 是 naive UTC (utc_now 出来的). 加 8h 截 date 部分.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    local = dt + _CN_TZ_OFFSET
    return local.strftime("%Y-%m-%d")


def _derive_region(source_provider: str | None, paper_code: str) -> str:
    """从 source_provider / paper_code 派生 region bucket.

    现实 fenbi 数据 source_provider 多为 "fenbi" 等供应商名, 不是 "国考"/"省考".
    paper_code (如 GUOKAO-2024-01 / SHENDONG-2023) 才是真正区分维度. MVP 启发式:
      - paper_code 含 "GK" / "GUOKAO" / "国考" → 国考
      - paper_code 含 "SK" / "SHENGKAO" / "省考" → 省考
      - 否则 fallback source_provider 或 "其他"
    """
    code_upper = paper_code.upper()
    if "GUOKAO" in code_upper or "GK" in code_upper or "国考" in paper_code:
        return "国考"
    if "SHENGKAO" in code_upper or "SK" in code_upper or "省考" in paper_code:
        return "省考"
    return source_provider or "其他"


def _derive_difficulty(question_count: int) -> int | None:
    """从 question_count 启发式派生 1-3 难度.

    申论卷典型 5 题 (1 归纳 + 1 综合 + 1 应用文 + 1 大作文 + 1 兜底). 偏离视为
    特殊题型 → 调整难度. MVP 简化映射, 后续可接入 difficulty_code 字段 (alembic
    0008 起 question 表已有). 0 题 → None (异常卷, FE 隐藏 dot).
    """
    if question_count <= 0:
        return None
    if question_count <= 3:
        return 1
    if question_count == 4:
        return 2
    return 3


class EssaySpecialtyAggregationService:
    """SIKAO 4 endpoint 聚合 service (read-only)."""

    def __init__(self, session: Session) -> None:
        self.session = session

    # ── 1. /summary ──────────────────────────────────────────────────────

    def get_specialty_summary(
        self, *, user_id: int
    ) -> schemas.EssaySpecialtySummaryV2:
        """StatStrip totals + ResumeHero data.

        totals.total 是 public+enabled+question_kind='essay' 全题数 (跟 user 无关);
        practiced / streak / week_done / avg_score 都基于当前 user 的
        EssayGradingRecord.

        resume: 取 user 最近一条 grading record (任意 status) 的 canonical_subtype,
        派生续答 hero band 信息. 无 record → None.
        """
        # ── total: 全 public essay 题数 (跨 user 共享) ──
        total_stmt = (
            select(func.count(Question.id))
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind == "essay",
            )
        )
        total = int(self.session.scalar(total_stmt) or 0)

        # ── practiced: 当前 user distinct completed question 数 ──
        practiced_stmt = (
            select(func.count(func.distinct(EssayGradingRecord.question_id)))
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
            )
        )
        practiced = int(self.session.scalar(practiced_stmt) or 0)

        # ── week_done: 最近 7 天 (按 graded_at) completed batch 数 ──
        now_utc = datetime.now(UTC).replace(tzinfo=None)
        week_start = now_utc - timedelta(days=7)
        week_done_stmt = (
            select(func.count(EssayGradingRecord.id))
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
                EssayGradingRecord.graded_at.is_not(None),
                EssayGradingRecord.graded_at >= week_start,
            )
        )
        week_done = int(self.session.scalar(week_done_stmt) or 0)

        # ── avg_score: 所有 completed batch 的算术平均 ──
        avg_score_stmt = (
            select(func.avg(EssayGradingRecord.score))
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
                EssayGradingRecord.score.is_not(None),
            )
        )
        avg_raw = self.session.scalar(avg_score_stmt)
        avg_score = float(avg_raw) if avg_raw is not None else 0.0

        # ── streak_days: Asia/Shanghai 本地日连续 (按 graded_at) ──
        # 拉 user 全部 completed graded_at, 应用层算 streak (跨方言安全).
        graded_stmt = (
            select(EssayGradingRecord.graded_at)
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
                EssayGradingRecord.graded_at.is_not(None),
            )
            .order_by(EssayGradingRecord.graded_at.desc())
        )
        graded_dates: set[str] = set()
        for (graded_at,) in self.session.execute(graded_stmt).all():
            if graded_at is None:
                continue
            graded_dates.add(_convert_to_local_date(graded_at))

        streak_days = _compute_streak_days(graded_dates, now_utc)

        totals = schemas.SpecialtyTotalsV2(
            practiced=practiced,
            total=total,
            streak_days=streak_days,
            week_done=week_done,
            avg_score=round(avg_score, 2),
        )

        # ── resume: 取 user 最近一条 record (任意 status) 派生续答 ──
        resume = self._build_resume(user_id=user_id)

        return schemas.EssaySpecialtySummaryV2(totals=totals, resume=resume)

    def _build_resume(
        self, *, user_id: int
    ) -> schemas.SpecialtyResumeV2 | None:
        """ResumeHero: 取最近一条 EssayGradingRecord 的 subtype, 派生续答信息.

        无 grading record → None (前端隐藏 ResumeHero band).
        """
        latest_stmt = (
            select(EssayGradingRecord, Question.canonical_subtype)
            .join(Question, Question.id == EssayGradingRecord.question_id)
            .where(EssayGradingRecord.user_id == user_id)
            .order_by(desc(EssayGradingRecord.created_at))
            .limit(1)
        )
        latest_row = self.session.execute(latest_stmt).first()
        if latest_row is None:
            return None
        latest_record, subtype = latest_row
        if subtype is None:
            # canonical_subtype 没标 — 没法挂到 chip, fail-soft 返 None 让 FE 隐藏
            return None

        # subtype 下 user distinct completed 数 + 1
        done_count_stmt = (
            select(func.count(func.distinct(EssayGradingRecord.question_id)))
            .join(Question, Question.id == EssayGradingRecord.question_id)
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
                Question.canonical_subtype == subtype,
            )
        )
        done_count = int(self.session.scalar(done_count_stmt) or 0)

        # subtype 下 public 题总数
        total_stmt = (
            select(func.count(Question.id))
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind == "essay",
                Question.canonical_subtype == subtype,
            )
        )
        q_total = int(self.session.scalar(total_stmt) or 0)

        # 最近 5 条 completed score
        last_scores_stmt = (
            select(EssayGradingRecord.score)
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
                EssayGradingRecord.score.is_not(None),
            )
            .order_by(desc(EssayGradingRecord.graded_at))
            .limit(5)
        )
        last_scores = [
            float(s) for (s,) in self.session.execute(last_scores_stmt).all()
        ]

        # 本周 completed 数 (Asia/Shanghai 本周一 00:00 → 现在)
        now_utc = datetime.now(UTC).replace(tzinfo=None)
        week_start = now_utc - timedelta(days=7)
        week_done_stmt = (
            select(func.count(EssayGradingRecord.id))
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
                EssayGradingRecord.graded_at.is_not(None),
                EssayGradingRecord.graded_at >= week_start,
            )
        )
        week_done = int(self.session.scalar(week_done_stmt) or 0)

        return schemas.SpecialtyResumeV2(
            type_name=subtype,
            question_id=latest_record.question_id,
            q_index=min(done_count + 1, max(q_total, 1)),
            q_total=q_total,
            last_scores=last_scores,
            week_goal=[week_done, _WEEK_GOAL_TOTAL],
        )

    # ── 2. /categories ───────────────────────────────────────────────────

    def get_specialty_categories(
        self, *, user_id: int | None
    ) -> schemas.EssaySpecialtyCategoriesResponseV2:
        """5 大类 (公文+应用文 后端拆开 → 6 raw, FE 合并) + per-question 子行三态.

        每类返 sub_types: 前 6 道该类题 (按 year DESC, paper_code, position 排序),
        每行带 status (done / progress / pending) + meta ("2024 国考 · 第 1 题").

        匿名 (user_id=None) → 全 status='pending', done count 0.
        """
        # 拉每个类的前 6 道题 (FE sub-grid 2 列 × 3 行典型 = 6 行展示)
        # SQL approach: 1 次大查询拉 (subtype, question_id, position, year,
        # paper_code) 全集, 应用层按 subtype 分桶 + 排序 + slice 6.
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
                Question.question_kind == "essay",
                Question.canonical_subtype.in_(_CATEGORY_ORDER),
            )
        )
        all_rows = self.session.execute(all_qs_stmt).all()

        # 按 subtype 分桶
        buckets: dict[str, list[dict[str, Any]]] = {st: [] for st in _CATEGORY_ORDER}
        for subtype, qid, position, exam_year, paper_code, source_provider in all_rows:
            if subtype not in buckets:
                continue
            buckets[subtype].append({
                "question_id": int(qid),
                "position": int(position),
                "exam_year": int(exam_year) if exam_year is not None else None,
                "paper_code": str(paper_code),
                "source_provider": source_provider,
            })

        # ── 用户对每题的状态 (done / progress / pending) ──
        done_qids: set[int] = set()
        pending_qids: set[int] = set()
        if user_id is not None:
            user_records_stmt = (
                select(
                    EssayGradingRecord.question_id,
                    EssayGradingRecord.status,
                )
                .where(EssayGradingRecord.user_id == user_id)
            )
            for qid, status in self.session.execute(user_records_stmt).all():
                if status == "completed":
                    done_qids.add(int(qid))
                elif status == "pending":
                    pending_qids.add(int(qid))

        cats: list[schemas.SpecialtyCategoryV2] = []
        for idx, subtype in enumerate(_CATEGORY_ORDER, start=1):
            bucket = buckets.get(subtype, [])
            # 排序: year DESC NULLS LAST → paper_code ASC → position ASC
            bucket.sort(
                key=lambda r: (
                    -(r["exam_year"] or -1),
                    r["paper_code"],
                    r["position"],
                )
            )
            total = len(bucket)
            # 仅取前 6 道做 sub-grid 展示
            preview = bucket[:6]
            sub_types: list[schemas.SpecialtySubtypeRowV2] = []
            done_in_category = 0
            for row in preview:
                qid = row["question_id"]
                if qid in done_qids:
                    status_label: str = "done"
                    practiced_one = 1
                elif qid in pending_qids:
                    status_label = "progress"
                    practiced_one = 0
                else:
                    status_label = "pending"
                    practiced_one = 0
                region = _derive_region(row["source_provider"], row["paper_code"])
                year_label = (
                    str(row["exam_year"]) if row["exam_year"] is not None else "未知年份"
                )
                meta = f"{year_label} {region} · 第 {row['position']} 题"
                sub_types.append(
                    schemas.SpecialtySubtypeRowV2(
                        id=f"q-{qid}",
                        question_id=qid,
                        name=f"{subtype} · 第 {row['position']} 题",
                        meta=meta,
                        practiced=practiced_one,
                        total=1,
                        status=status_label,  # type: ignore[arg-type]
                    )
                )
            # 整类 done count: 全部题 (不只 preview) 中 done 的
            for row in bucket:
                if row["question_id"] in done_qids:
                    done_in_category += 1

            overall_progress = (done_in_category / total) if total > 0 else 0.0
            state: str | None = "empty" if total == 0 else None
            cats.append(
                schemas.SpecialtyCategoryV2(
                    id=subtype,
                    idx=idx,
                    name=subtype,
                    desc=_CATEGORY_DESC.get(subtype, ""),
                    overall_progress=round(min(1.0, max(0.0, overall_progress)), 4),
                    practiced=done_in_category,
                    total=total,
                    sub_types=sub_types,
                    state=state,  # type: ignore[arg-type]
                )
            )

        return schemas.EssaySpecialtyCategoriesResponseV2(cats=cats)

    # ── 3. /papers/essay/list (扩字段) ───────────────────────────────────

    def list_essay_papers_extended(
        self,
        *,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        region: str | None = None,
        year: int | None = None,
        paper_type: str | None = None,
        sort: str = "default",
    ) -> schemas.EssayPapersListExtendedResponseV2:
        """扩字段版 essay paper list, 给 EssayPapers view 用.

        filters:
          region: "国考" / "省考" / source_provider 名 / "全部" (None)
          year: exam_year exact match
          paper_type: source_kind exact match

        sort:
          default: paper_revision.sort_order DESC + paper_code ASC (跟老 list 对齐)
          year: exam_year DESC
          recent: last_attempt.submitted_at DESC (用户视角)

        last_attempt: 取 user 在此 paper 上最新 completed grading record (按
        graded_at). progress: <user 此 paper 已 completed question 数> / <total>.
        status: 0 已做 = todo; ≥1 个 pending = doing; 全 completed = done; 中间态 = doing.

        avoid N+1: paper list 拿到后, 一次 IN 查所有 question_ids 关联的
        EssayGradingRecord, 应用层做 user/paper 索引.
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

        # ── base query: public essay papers (复用现有过滤) ──
        from sqlalchemy import exists

        essay_filter = exists().where(
            and_(
                Question.paper_revision_id == PaperRevision.id,
                Question.renderer_key == "essay",
            )
        )
        base_where = [
            Paper.current_revision_id.is_not(None),
            PaperRevision.visible_in_public.is_(True),
            essay_filter,
        ]
        # filter by year (revision.exam_year)
        if year is not None:
            base_where.append(PaperRevision.exam_year == year)
        # filter by paper_type (revision.source_kind)
        if paper_type is not None and paper_type != "全部":
            base_where.append(PaperRevision.source_kind == paper_type)

        # region filter (派生字段, 走 paper_code/source_provider 简化条件)
        # 国考/省考 走 paper_code LIKE; 其他 region 走 source_provider exact
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

        # paper list query (sort by sort_order DESC default)
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
            # default + recent 都先按 sort_order 排; recent 后续在应用层用
            # last_attempt 排 (但需要先拿到 user grading data, 多 1 步)
            list_stmt = list_stmt.order_by(
                desc(PaperRevision.sort_order),
                Paper.paper_code.asc(),
            )
        list_stmt = list_stmt.limit(page_size).offset((page - 1) * page_size)
        # SA row tuples → typed list (mypy 不会推 Row 解构成 tuple, 手动 cast).
        paper_rows: list[tuple[Paper, PaperRevision]] = [
            (row[0], row[1]) for row in self.session.execute(list_stmt).all()
        ]

        if not paper_rows:
            return schemas.EssayPapersListExtendedResponseV2(
                items=[],
                total=total,
                page=page,
                page_size=page_size,
            )

        # ── per-paper user data: completed_count + pending_count + last_attempt ──
        revision_ids = [r.id for _, r in paper_rows]

        # 1 次 join 拉所有 paper 下的 question_id → revision_id 映射
        q_map_stmt = (
            select(Question.id, Question.paper_revision_id)
            .where(
                Question.paper_revision_id.in_(revision_ids),
                Question.enabled.is_(True),
                Question.question_kind == "essay",
            )
        )
        # revision_id → set of question_ids
        qid_to_revision: dict[int, int] = {
            int(qid): int(rev_id)
            for qid, rev_id in self.session.execute(q_map_stmt).all()
        }
        # revision_id → list of question_ids
        revision_to_qids: dict[int, list[int]] = {}
        for qid, rev_id in qid_to_revision.items():
            revision_to_qids.setdefault(rev_id, []).append(qid)

        # ── 1 次大 query 拉 user 所有相关 grading records ──
        user_records_by_qid: dict[int, list[EssayGradingRecord]] = {}
        if qid_to_revision:
            user_records_stmt = (
                select(EssayGradingRecord)
                .where(
                    EssayGradingRecord.user_id == user_id,
                    EssayGradingRecord.question_id.in_(list(qid_to_revision.keys())),
                )
                .order_by(EssayGradingRecord.graded_at.desc().nulls_last())
            )
            for rec in self.session.scalars(user_records_stmt).all():
                user_records_by_qid.setdefault(int(rec.question_id), []).append(rec)

        # ── 装配 items ──
        items: list[schemas.EssayPaperListItemV2Extended] = []
        for paper, revision in paper_rows:
            qids = revision_to_qids.get(revision.id, [])
            paper_total = len(qids)
            done_qids: set[int] = set()
            has_pending = False
            last_attempt: schemas.EssayLastAttemptV2 | None = None
            for qid in qids:
                records = user_records_by_qid.get(qid, [])
                for rec in records:
                    if rec.status == "completed":
                        done_qids.add(qid)
                        if rec.score is not None and rec.graded_at is not None:
                            # 取此 paper 下任意题最新 completed 作 lastAttempt
                            candidate = schemas.EssayLastAttemptV2(
                                score=float(rec.score),
                                submitted_at=rec.graded_at,
                            )
                            if (
                                last_attempt is None
                                or candidate.submitted_at > last_attempt.submitted_at
                            ):
                                last_attempt = candidate
                    elif rec.status == "pending":
                        has_pending = True

            done_count = len(done_qids)
            if paper_total > 0 and done_count >= paper_total:
                status_label: str = "done"
            elif done_count > 0 or has_pending:
                status_label = "doing"
            else:
                status_label = "todo"

            items.append(
                schemas.EssayPaperListItemV2Extended(
                    id=paper.id,
                    paper_code=paper.paper_code,
                    paper_name=revision.paper_name,
                    exam_year=revision.exam_year,
                    source_provider=revision.source_provider,
                    source_kind=revision.source_kind,
                    question_count=revision.question_count,
                    current_revision_id=paper.current_revision_id,
                    region=_derive_region(revision.source_provider, paper.paper_code),
                    track="sk",  # 申论卷固定 sk (申论考试)
                    difficulty=_derive_difficulty(revision.question_count),  # type: ignore[arg-type]
                    status=status_label,  # type: ignore[arg-type]
                    progress=f"{done_count}/{paper_total}",
                    last_attempt=last_attempt,
                    pinned=False,  # MVP: pin endpoint 推后
                )
            )

        # 应用层 recent sort
        if sort == "recent":
            items.sort(
                key=lambda it: (
                    it.last_attempt.submitted_at
                    if it.last_attempt is not None
                    else datetime(1970, 1, 1)
                ),
                reverse=True,
            )

        return schemas.EssayPapersListExtendedResponseV2(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    # ── 4. /papers/essay/filters ─────────────────────────────────────────

    def get_essay_papers_filters(
        self,
    ) -> schemas.EssayPapersFiltersResponseV2:
        """返候选 chip 集合 (regions / years / paper_types).

        regions: 派生的 国考 / 省考 + 真实 source_provider distinct (+ "其他")
        years: distinct revision.exam_year DESC
        paper_types: distinct revision.source_kind ASC
        """
        from sqlalchemy import exists

        essay_filter = exists().where(
            and_(
                Question.paper_revision_id == PaperRevision.id,
                Question.renderer_key == "essay",
            )
        )

        # ── years ──
        years_stmt = (
            select(PaperRevision.exam_year.distinct())
            .join(Paper, Paper.current_revision_id == PaperRevision.id)
            .where(
                PaperRevision.visible_in_public.is_(True),
                PaperRevision.exam_year.is_not(None),
                essay_filter,
            )
            .order_by(desc(PaperRevision.exam_year))
        )
        years = [int(y) for (y,) in self.session.execute(years_stmt).all() if y is not None]

        # ── paper_types ──
        kinds_stmt = (
            select(PaperRevision.source_kind.distinct())
            .join(Paper, Paper.current_revision_id == PaperRevision.id)
            .where(
                PaperRevision.visible_in_public.is_(True),
                PaperRevision.source_kind.is_not(None),
                essay_filter,
            )
        )
        paper_types = sorted(
            {str(k) for (k,) in self.session.execute(kinds_stmt).all() if k is not None}
        )

        # ── regions: paper_code 派生 + source_provider distinct ──
        # 简化: 先看 distinct provider, 加上 "国考" / "省考" 派生 bucket (如果库
        # 里存在对应 paper_code 模式).
        regions_set: set[str] = set()
        # paper_code 含 GUOKAO/GK?
        guokao_count_stmt = (
            select(func.count(Paper.id))
            .join(Paper.current_revision)
            .where(
                PaperRevision.visible_in_public.is_(True),
                essay_filter,
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
                essay_filter,
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
                essay_filter,
            )
        )
        for (provider,) in self.session.execute(provider_stmt).all():
            if provider is not None:
                regions_set.add(str(provider))

        regions = sorted(regions_set)

        return schemas.EssayPapersFiltersResponseV2(
            regions=regions,
            years=years,
            paper_types=paper_types,
        )


def _compute_streak_days(
    local_dates: set[str], now_utc: datetime
) -> int:
    """从 set of "YYYY-MM-DD" Asia/Shanghai local date 算 streak.

    streak = 从今天起往前数, 连续 N 天每天都有 completed batch. 中断即停.
    """
    if not local_dates:
        return 0
    today_local = _convert_to_local_date(now_utc)
    if today_local not in local_dates:
        # 今天没做, 看昨天起算 (允许"今天还没做但连续"逻辑) — 简化为今天没做 = 0
        # plan 没明说, 选保守: 今天没做 streak 强制 0.
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


__all__ = ["EssaySpecialtyAggregationService"]
