"""学习计划 service — Slice 3a.

API:
- StudyPlanService(session, settings).get_or_create_today(user_id) → (StudyPlan, was_created: bool)
  - cache hit 同 plan_date → 返已存在 plan
  - 用户答题 < _COLD_START_THRESHOLD → fallback_cold_start (不调 LLM)
  - 否则调 LLM 同步阻塞 → sanity Stage 1 (Pydantic) / Stage 2 (业务) / Stage 3 (dedup)
  - LLM 失败 / sanity 全过滤后 < 3 task → fallback_llm_failed
- StudyPlanService(session, settings).patch_task_status(user_id, task_id, status)
  → StudyPlanTask (跨用户 404 / 已 finalized 422)
- assert_fallback_paper_loadable(session) — startup health check (R4)

调性: 同步阻塞 (D2). LLM call 用 settings.llm_timeout_study_plan_seconds=10
压短, 防新用户开 app 久等. 失败降 fallback (用户体验优先, FE 据
generation_status banner 区分).

plan §6.3 三 Stage sanity check **仅作用 LLM 输出路径**, fallback path 跳过 sanity 直接落库.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Literal, cast
from zoneinfo import ZoneInfo

from pydantic import ValidationError
from sqlalchemy import case as sql_case
from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from sikao_api.core.config import Settings
from sikao_api.db.models import (
    Paper,
    PaperRevision,
    Question,
    StudyPlan,
    StudyPlanTask,
    WrongQuestionMastery,
    utc_now,
)
from sikao_api.db.schemas import (
    EssayWritingLLMTask,
    PracticeLLMTask,
    PracticeTaskPayload,
    ReviewWrongLLMTask,
    StudyPlanLLMOutput,
)
from sikao_api.modules.system.application.errors import NotFoundError
from sikao_api.modules.system.application.errors import ValidationError as ServiceValidationError
from sikao_api.modules.question_bank.application.exam_papers import ExamPaperService
from sikao_api.modules.llm.application.llm import build_llm_provider
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError, parse_with_recovery
from sikao_api.modules.llm.application.llm.prompts._shared import strip_html_preview
from sikao_api.modules.llm.application.llm.prompts.study_plan import (
    DailyAnswerStat,
    StudyPlanContext,
    SubjectAccuracy,
    WrongQuestionContext,
    build_study_plan_messages,
)
from sikao_api.modules.llm.application.llm.usage_recorder import UsageRecord, record_usage

if TYPE_CHECKING:
    from sikao_api.db.schemas import StudyLLMTaskUnion

logger = logging.getLogger(__name__)

# Asia/Shanghai 用于 plan_date 计算 (D3 拍板). SQL 层 _query_daily_stats 已用
# AT TIME ZONE / +8h offset, 这里 Python 端独立用 zoneinfo.
_SHANGHAI = ZoneInfo("Asia/Shanghai")

# 冷启动阈值: 用户累计答题 < 此值 → fallback_cold_start, 跳过 LLM (D5).
# v0.1 凭直觉拍 10, 上线 1 周后看 metric 拉分布调 (P1-5).
_COLD_START_THRESHOLD = 10

# 近期活跃窗口 (P1-4 v0.3 review): 全历史 total ≥ 阈值 但近 N 天 0 答题
# 也算冷启动. 沉睡用户半年回来 footprint 不足以喂 LLM, 走 fallback.
_RECENT_WINDOW_DAYS = 7

# Sanity Stage 2/3 后剩余 task 数 < 此值 → 整 plan 降 fallback_llm_failed.
# 阈值 3 是 master plan §5 "3-5 个 task" 下限.
_MIN_TASKS_AFTER_SANITY = 3

# fallback paperCode + question source UUIDs — D5 lhr 方案 2: 1 task 含 3 题入门.
# FENBI-7274732 (2024 广东省考行测 80 题真卷); 选三道不依赖 material_group
# 的 single_choice。DB question.id 是导入顺序相关自增值，不能作为配置常量。
#
# MVP demo/local DB may intentionally omit the full FENBI bank. In that case
# fallback resolves from any visible current paper with >= 3 enabled non-essay
# questions, so clone + seed can open PR-2 without project-external data.
_FALLBACK_PAPER_CODE = "FENBI-7274732"
_FALLBACK_QUESTION_SOURCE_UUIDS: list[str] = [
    "fenbi-10204418",
    "fenbi-16593303",
    "fenbi-16593304",
]
_FALLBACK_QUESTION_COUNT = len(_FALLBACK_QUESTION_SOURCE_UUIDS)

# 文案严格按 docs/design/style-guide.md §1.3 voice & tone — 安静陈述, 不打鸡血.
_FALLBACK_TASK_TITLE = "先做 3 道行测题"
_FALLBACK_TASK_SUBTITLE = "言语 / 常识 各 1 道, 不计时, 认识题型即可"


def today_plan_date_shanghai() -> date:
    """Asia/Shanghai 时区下的当天日期 — plan_date 算法 (D3)."""
    return datetime.now(_SHANGHAI).date()


FlowLiteral = Literal[
    "cache_hit",   # 当天 plan 已存在, 直接返
    "cold_start",  # 用户答题量 < 阈值, 走 fallback_cold_start
    "llm_success", # LLM 路径生成成功
    "llm_failed",  # LLM 路径任一段失败, 走 fallback_llm_failed
]


@dataclass(frozen=True)
class StudyPlanGenerationOutcome:
    """get_or_create_today 内部分支描述, 供 metric / log 用.

    - generation_status: SSOT for FE banner — 来自 plan.generation_status row
      ('success' | 'fallback_cold_start' | 'fallback_llm_failed')
    - flow: 本次 service 调用走的路径, 给 route 层 metric 区分
      "首次生成 success" vs "复访 cache hit" (P1-3, v0.3 review 新增)
    - failure_reason: llm_failed 时填具体异常字符串
    """

    generation_status: str
    flow: FlowLiteral
    failure_reason: str | None = None


GenerationStatusLiteral = Literal[
    "success", "fallback_cold_start", "fallback_llm_failed"
]


@dataclass(frozen=True)
class StudyPlanHistoryRow:
    """Slice 3c: list_history 返回行 — slim, 不含 task payload.

    SQL aggregate 查出的 row 转成 typed dataclass 给 route 层用. Pydantic
    StudyPlanHistoryItemV2 在 route 层从这 dataclass 构造.

    generation_status 走 Literal 让 route 层不需要 # type: ignore. DB enum 约束
    在 alembic 0011 生成时已落地, 这里信任 DB 输出.
    """

    id: int
    plan_date: date
    generation_status: GenerationStatusLiteral
    task_total: int
    task_completed: int
    created_at: datetime


class StudyPlanService:
    """同步部分: get_or_create_today + patch_task_status. LLM call 在
    get_or_create_today 内同步 await (D2 阻塞模式).
    """

    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings

    # ── public entry ─────────────────────────────────────────────────────

    async def get_or_create_today(
        self, *, user_id: int
    ) -> tuple[StudyPlan, StudyPlanGenerationOutcome]:
        """主入口. 返 (plan, outcome). outcome 描述生成路径供 metric 用,
        plan.generation_status 字段是 SSOT 给 FE.

        async 因为内部需要 await LLM provider.chat_completion. 非 LLM 路径
        (cache hit / cold start fallback) 仍同步快速返回.
        """
        today = today_plan_date_shanghai()

        # cache hit: 当天 plan 已生成 → 直接返 (flow='cache_hit')
        existing = self._load_plan_for_date(user_id=user_id, plan_date=today)
        if existing is not None:
            return existing, StudyPlanGenerationOutcome(
                generation_status=existing.generation_status,
                flow="cache_hit",
            )

        # 冷启动判定 (P1-4 v0.3 review 修正): 全历史 total < 阈值 OR 近 7 天 0 答题
        # 都走 fallback. 沉睡半年用户回来 total=500 但近 7 天 0 → 没 footprint
        # 给 LLM 推 → 跳 LLM 直接 fallback.
        exam_service = ExamPaperService(self.session)
        total_answered = exam_service._query_total_accuracy(user_id=user_id)[0]  # noqa: SLF001
        recent_7day = exam_service._query_recent_answered_count(  # noqa: SLF001
            user_id=user_id, days=_RECENT_WINDOW_DAYS
        )
        is_cold = total_answered < _COLD_START_THRESHOLD or recent_7day == 0
        # metric 埋点 (P1-5): log 让 ops 上线 1 周拉分布调阈值
        logger.info(
            "study_plan.cold_start_check user_id=%s total_answered=%s "
            "recent_7day=%s threshold=%s recent_window=%sd is_cold=%s",
            user_id, total_answered, recent_7day,
            _COLD_START_THRESHOLD, _RECENT_WINDOW_DAYS, is_cold,
        )

        if is_cold:
            new_plan = self._make_fallback_plan_instance(
                user_id=user_id,
                plan_date=today,
                generation_status="fallback_cold_start",
                token_usage_id=None,
            )
            stored = self._add_plan_with_savepoint(
                new_plan, user_id=user_id, plan_date=today
            )
            if stored is not new_plan:
                # 并发胜者抢先落库, 我们拿到 pre_existing — outcome flow 转 cache_hit
                # (跟 LLM 路径撞 UNIQUE 同语义)
                return stored, StudyPlanGenerationOutcome(
                    generation_status=stored.generation_status,
                    flow="cache_hit",
                )
            return stored, StudyPlanGenerationOutcome(
                generation_status="fallback_cold_start",
                flow="cold_start",
            )

        # Try LLM 同步阻塞生成. 失败任一步 → fallback_llm_failed.
        plan, outcome = await self._try_generate_via_llm(
            user_id=user_id, plan_date=today
        )
        return plan, outcome

    def list_history(
        self, *, user_id: int, cursor: date | None, limit: int
    ) -> tuple[list[StudyPlanHistoryRow], date | None]:
        """Slice 3c: 列出 user 过去的 plan (排除今日, plan_date < today_shanghai).

        Cursor 分页 by plan_date desc. 多取 1 条判 hasMore, 超出 limit 的最后一条
        plan_date 作 next_cursor 返回.

        SQL 一句出: outer join study_plan_tasks 后 GROUP BY study_plan.id +
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0) 算 task_completed.
        SUM(CASE) 形式两端通用 (SQLite 不支持 Postgres FILTER).

        UNIQUE(user_id, plan_date) 约束 (alembic 0011 line 64) 保证单 user 单日
        最多一行, cursor 单字段 plan_date 无歧义.

        Raises:
            SQLAlchemyError: 走 fail-fast 由 route 层 500 兜底, service 不捕获.
        """
        today = today_plan_date_shanghai()

        where_clauses = [
            StudyPlan.user_id == user_id,
            StudyPlan.plan_date < today,
        ]
        if cursor is not None:
            where_clauses.append(StudyPlan.plan_date < cursor)

        stmt = (
            select(
                StudyPlan.id.label("id"),
                StudyPlan.plan_date.label("plan_date"),
                StudyPlan.generation_status.label("generation_status"),
                StudyPlan.created_at.label("created_at"),
                func.count(StudyPlanTask.id).label("task_total"),
                func.coalesce(
                    func.sum(
                        sql_case(
                            (StudyPlanTask.status == "completed", 1),
                            else_=0,
                        )
                    ),
                    0,
                ).label("task_completed"),
            )
            .outerjoin(StudyPlanTask, StudyPlanTask.plan_id == StudyPlan.id)
            .where(*where_clauses)
            .group_by(StudyPlan.id)
            .order_by(StudyPlan.plan_date.desc())
            .limit(limit + 1)
        )

        rows = self.session.execute(stmt).all()
        has_more = len(rows) > limit
        items = [
            StudyPlanHistoryRow(
                id=int(r.id),
                plan_date=r.plan_date,
                # DB enum (alembic 0011) 已约束三态, 这里 cast 是边界信任 — 真出 enum
                # 外的值, Pydantic Literal 在 route 层 model_construct 时还会再 fail-fast.
                generation_status=cast(GenerationStatusLiteral, r.generation_status),
                task_total=int(r.task_total),
                task_completed=int(r.task_completed),
                created_at=r.created_at,
            )
            for r in rows[:limit]
        ]
        next_cursor = items[-1].plan_date if has_more and items else None
        return items, next_cursor

    def get_plan_by_id(self, *, user_id: int, plan_id: int) -> StudyPlan:
        """Slice 3d: 按 plan_id 拿单 plan + 完整 tasks (joinedload, 不 N+1).

        跨用户 / 不存在 → NotFoundError (route 层 404, 不暴露 plan 存在性,
        跟 patch_task_status 同语义).

        Raises:
            NotFoundError: plan_id 不存在 OR plan.user_id != user_id.
        """
        stmt = (
            select(StudyPlan)
            .where(StudyPlan.id == plan_id)
            .options(joinedload(StudyPlan.tasks))
        )
        plan = self.session.scalars(stmt).unique().one_or_none()
        if plan is None or plan.user_id != user_id:
            raise NotFoundError("study plan not found")
        return plan

    def patch_task_status(
        self, *, user_id: int, task_id: int, new_status: str
    ) -> StudyPlanTask:
        """改 task status. 状态机 D4: pending → completed/skipped (单向不可逆).

        跨用户 → 404 (防 leak task 存在性).
        当前 status != 'pending' → 422 (already finalized).
        """
        if new_status not in ("completed", "skipped"):
            raise ServiceValidationError(
                f"invalid status: {new_status}",
                code="study_plan_task_invalid_status",
            )
        task = self.session.get(StudyPlanTask, task_id)
        if task is None:
            raise NotFoundError("study plan task not found")
        # joinedload plan 验 owner — task → plan.user_id
        plan = self.session.get(StudyPlan, task.plan_id)
        if plan is None or plan.user_id != user_id:
            # cross-user 404
            raise NotFoundError("study plan task not found")
        if task.status != "pending":
            raise ServiceValidationError(
                f"task already finalized (status={task.status})",
                code="study_plan_task_finalized",
            )
        task.status = new_status
        if new_status == "completed":
            task.completed_at = utc_now()
        task.updated_at = utc_now()
        self.session.flush()
        return task

    # ── load / cache ─────────────────────────────────────────────────────

    def _load_plan_for_date(
        self, *, user_id: int, plan_date: date
    ) -> StudyPlan | None:
        stmt = (
            select(StudyPlan)
            .where(StudyPlan.user_id == user_id, StudyPlan.plan_date == plan_date)
            .options(joinedload(StudyPlan.tasks))
        )
        return self.session.scalars(stmt).unique().one_or_none()

    # ── fallback path ────────────────────────────────────────────────────

    def _make_fallback_plan_instance(
        self,
        *,
        user_id: int,
        plan_date: date,
        generation_status: str,
        token_usage_id: int | None,
    ) -> StudyPlan:
        """构造 fallback plan ORM 实例 (1 task / 3 题), 不落库. caller 自己
        decide 用 _add_plan_with_savepoint 提交 + 处理 UNIQUE 撞.
        优先用正式 FENBI fallback; 本地 demo 库无 FENBI 时动态挑可见行测题.
        fallback path 跳过 sanity.
        """
        paper_code, question_ids = _resolve_fallback_practice_task(self.session)
        payload = PracticeTaskPayload(
            paper_code=paper_code,
            question_ids=question_ids,
            title=_FALLBACK_TASK_TITLE,
            subtitle=_FALLBACK_TASK_SUBTITLE,
        )
        plan = StudyPlan(
            user_id=user_id,
            plan_date=plan_date,
            generation_status=generation_status,
            token_usage_id=token_usage_id,
        )
        plan.tasks.append(
            StudyPlanTask(
                task_kind="practice",
                payload_json=payload.model_dump(by_alias=True),
                display_order=0,
                status="pending",
            )
        )
        return plan

    def _add_plan_with_savepoint(
        self, plan: StudyPlan, *, user_id: int, plan_date: date
    ) -> StudyPlan:
        """add+flush plan within SAVEPOINT. 撞 UNIQUE → 仅 rollback SAVEPOINT,
        重 SELECT 拿首个并发胜者; 不影响 outer transaction (P0-1 v0.3 review).
        """
        try:
            with self.session.begin_nested():
                self.session.add(plan)
                self.session.flush()
            return plan
        except IntegrityError:
            existing = self._load_plan_for_date(user_id=user_id, plan_date=plan_date)
            if existing is None:
                # 极小概率: 撞了但又找不到 (delete race / 跨 session 提交未到) — re-raise
                raise
            return existing

    # ── LLM path ─────────────────────────────────────────────────────────

    async def _try_generate_via_llm(
        self, *, user_id: int, plan_date: date
    ) -> tuple[StudyPlan, StudyPlanGenerationOutcome]:
        """Try LLM 路径. 任一段失败 → 走 _create_fallback_plan('fallback_llm_failed').

        分段: 组 context → 调 LLM → parse JSON → Pydantic Stage 1 → Stage 2 业务校验
        + Stage 3 dedup → 落库. record_usage 失败仅 warn 不抛 (跟 essay_grading 一致).
        """
        try:
            ctx = self._build_context(user_id=user_id, today=plan_date)
        except SQLAlchemyError as exc:
            # P0-2 (v0.3 review): SQLAlchemyError 后 session 进 dirty 状态,
            # 必须先 rollback 才能让后续 fallback add+flush work.
            self.session.rollback()
            return self._fallback_with_log(
                user_id=user_id, plan_date=plan_date,
                reason=f"context build failed: {type(exc).__name__}: {exc}",
            )

        messages = build_study_plan_messages(ctx=ctx)

        try:
            provider, label = build_llm_provider(
                self.settings,
                db=self.session,
                user_id=user_id,
                timeout_seconds_override=float(
                    self.settings.llm_timeout_study_plan_seconds
                ),
            )
        except Exception as exc:  # noqa: BLE001 — provider config / SSRF / etc 都降级
            return self._fallback_with_log(
                user_id=user_id, plan_date=plan_date,
                reason=f"LLM provider build failed: {type(exc).__name__}: {exc}",
            )

        try:
            result = await provider.chat_completion(
                messages=messages,
                model=self.settings.llm_model_study_plan,
                max_tokens=self.settings.llm_max_tokens,
                temperature=0.4,  # 轻量 plan 生成, 不需要太低 temperature
            )
        except Exception as exc:  # noqa: BLE001 — httpx / timeout / 4xx-5xx 都降级
            return self._fallback_with_log(
                user_id=user_id, plan_date=plan_date,
                reason=f"LLM call failed: {type(exc).__name__}: {exc}",
            )

        try:
            parsed = parse_with_recovery(result.content)
        except LlmJsonParseError as exc:
            return self._fallback_with_log(
                user_id=user_id, plan_date=plan_date,
                reason=f"LLM JSON parse failed: {exc}",
            )

        # Sanity Stage 1: Pydantic discriminated union (StudyPlanLLMOutput)
        try:
            llm_output = StudyPlanLLMOutput.model_validate(parsed)
        except ValidationError as exc:
            return self._fallback_with_log(
                user_id=user_id, plan_date=plan_date,
                reason=f"Stage 1 sanity failed: {exc}",
            )

        # Sanity Stage 2 (业务) + Stage 3 (跨 task dedup)
        validated_tasks = self._sanity_stage_2_3(
            llm_output.tasks, user_id=user_id, ctx=ctx
        )
        if len(validated_tasks) < _MIN_TASKS_AFTER_SANITY:
            return self._fallback_with_log(
                user_id=user_id, plan_date=plan_date,
                reason=(
                    f"Stage 2/3 sanity dropped to {len(validated_tasks)} task "
                    f"(< {_MIN_TASKS_AFTER_SANITY})"
                ),
            )

        # 记账 — 失败仅 warn (跟 essay_grading 一致, P1-new-1 测试 20)
        # P0-2 (v0.3 review): 用 SAVEPOINT 包 record_usage, 失败仅回滚这段 +
        # session.rollback() 清 dirty 状态, plan 主体仍 success.
        token_usage_id: int | None = None
        try:
            with self.session.begin_nested():
                usage = record_usage(
                    self.session,
                    UsageRecord(
                        feature="study_plan",
                        user_id=user_id,
                        provider=label,
                        model=result.model,
                        prompt_tokens=result.prompt_tokens,
                        prompt_cache_hit_tokens=result.prompt_cache_hit_tokens,
                        prompt_cache_miss_tokens=result.prompt_cache_miss_tokens,
                        completion_tokens=result.completion_tokens,
                        resource_type=None,  # plan 自身有 token_usage_id FK, 不需 resource_type
                        resource_id=None,
                    ),
                )
                token_usage_id = usage.id
        except SQLAlchemyError as exc:
            logger.warning(
                "study_plan.record_usage_failed user_id=%s err=%s", user_id, exc
            )

        # 落库 success — 走 SAVEPOINT 包, UNIQUE 撞重 SELECT 兜底
        plan = StudyPlan(
            user_id=user_id,
            plan_date=plan_date,
            generation_status="success",
            token_usage_id=token_usage_id,
        )
        for idx, task_obj in enumerate(validated_tasks):
            plan.tasks.append(
                StudyPlanTask(
                    task_kind=task_obj.task_kind,
                    payload_json=task_obj.payload.model_dump(by_alias=True),
                    display_order=idx,  # 重新连续编号 0..n-1 (Stage 3)
                    status="pending",
                )
            )
        result_plan = self._add_plan_with_savepoint(
            plan, user_id=user_id, plan_date=plan_date
        )
        # If 撞了 UNIQUE 并 hit 已存在 plan, 用 cache_hit-like outcome (跟首屏命中一致)
        if result_plan is not plan:
            return result_plan, StudyPlanGenerationOutcome(
                generation_status=result_plan.generation_status,
                flow="cache_hit",
            )
        return plan, StudyPlanGenerationOutcome(
            generation_status="success", flow="llm_success"
        )

    def _fallback_with_log(
        self, *, user_id: int, plan_date: date, reason: str
    ) -> tuple[StudyPlan, StudyPlanGenerationOutcome]:
        """LLM 路径任一失败时 → log ERROR + 走 fallback_llm_failed (P1-1 方案 A).

        撞 UNIQUE 拿 pre_existing → outcome flow 转 cache_hit (跟其他路径一致).
        """
        logger.error(
            "study_plan.llm_failed user_id=%s plan_date=%s reason=%s",
            user_id, plan_date, reason,
        )
        new_plan = self._make_fallback_plan_instance(
            user_id=user_id,
            plan_date=plan_date,
            generation_status="fallback_llm_failed",
            token_usage_id=None,
        )
        stored = self._add_plan_with_savepoint(
            new_plan, user_id=user_id, plan_date=plan_date
        )
        if stored is not new_plan:
            return stored, StudyPlanGenerationOutcome(
                generation_status=stored.generation_status,
                flow="cache_hit",
            )
        return stored, StudyPlanGenerationOutcome(
            generation_status="fallback_llm_failed",
            flow="llm_failed",
            failure_reason=reason,
        )

    # ── context build ────────────────────────────────────────────────────

    def _build_context(self, *, user_id: int, today: date) -> StudyPlanContext:
        """组 LLM prompt context. 复用 ExamPaperService private query (跟
        _query_total_accuracy / _query_daily_stats / _query_subject_accuracy
        三个走同 SLF001 noqa pattern).

        7 天 stats 走 _query_daily_stats (Asia/Shanghai 已 SQL 层处理).
        错题走 wrong_question_masteries WHERE mastery_level != 'mastered' (P1-new-3).
        可见 paper 走 list_public_papers.
        """
        exam_service = ExamPaperService(self.session)

        total_answered, overall_accuracy = exam_service._query_total_accuracy(  # noqa: SLF001
            user_id=user_id
        )

        # 7 天 stats — start_date = today - 6
        start_date = today - timedelta(days=6)
        daily_dict = exam_service._query_daily_stats(  # noqa: SLF001
            user_id=user_id, start_date=start_date
        )
        recent_7day_stats: list[DailyAnswerStat] = []
        cursor = start_date
        while cursor <= today:
            count, correct = daily_dict.get(cursor.isoformat(), (0, 0))
            recent_7day_stats.append(
                DailyAnswerStat(plan_date=cursor, total=count, correct=correct)
            )
            cursor += timedelta(days=1)

        # 各科目正确率 (P1-5 v0.3 review: 抽 _query_subject_accuracy 解 SLF001 双 SSOT)
        subject_accuracy: list[SubjectAccuracy] = []
        for subj, count, correct in exam_service._query_subject_accuracy(  # noqa: SLF001
            user_id=user_id
        ):
            subject_accuracy.append(
                SubjectAccuracy(
                    subject=subj,
                    answered_count=count,
                    accuracy=round(correct / count, 4),
                )
            )

        # 最近未掌握错题 (P1-new-3): mastery_level != 'mastered', 按 last_wrong_time 倒序 limit 10
        wq_stmt = (
            select(WrongQuestionMastery)
            .where(
                WrongQuestionMastery.user_id == user_id,
                WrongQuestionMastery.mastery_level != "mastered",
            )
            .options(
                joinedload(WrongQuestionMastery.question)
                .joinedload(Question.paper_revision)
                .joinedload(PaperRevision.paper),
            )
            .order_by(WrongQuestionMastery.last_wrong_time.desc())
            .limit(10)
        )
        recent_wrong_questions: list[WrongQuestionContext] = []
        for mastery in self.session.scalars(wq_stmt).unique().all():
            q = mastery.question
            paper = q.paper_revision.paper if q.paper_revision else None
            stem_preview = strip_html_preview(q.stem_text or "", max_chars=60)
            recent_wrong_questions.append(
                WrongQuestionContext(
                    question_id=q.id,
                    paper_code=paper.paper_code if paper else "(unknown)",
                    subject=q.subject,
                    canonical_subtype=q.canonical_subtype,
                    stem_preview=stem_preview,
                    last_wrong_time=mastery.last_wrong_time,
                    mastery_level=mastery.mastery_level,
                )
            )

        # 可见 paper 列表 — 投影成 paper_code list
        public_papers = exam_service.list_public_papers()
        available_paper_codes = [p.paper_code for p in public_papers]

        return StudyPlanContext(
            today_date=today,
            total_answered=total_answered,
            overall_accuracy=overall_accuracy,
            recent_7day_stats=recent_7day_stats,
            subject_accuracy=subject_accuracy,
            recent_wrong_questions=recent_wrong_questions,
            available_paper_codes=available_paper_codes,
        )

    # ── sanity Stage 2/3 ─────────────────────────────────────────────────

    def _sanity_stage_2_3(
        self,
        llm_tasks: list[StudyLLMTaskUnion],
        *,
        user_id: int,
        ctx: StudyPlanContext,
    ) -> list[StudyLLMTaskUnion]:
        """Stage 2 业务校验 (逐 task 丢) + Stage 3 跨 task dedup.

        Stage 2:
          6. paperCode 存在 + 用户可见 (走 ctx.available_paper_codes)
          7. (合并 6) 用户可见 — list_public_papers 已 visible_in_public 过滤
          8. questionId 存在 + 属于 paper + enabled
          9. review_wrong questionId 真在用户错题表 + mastery != mastered
          10. essay_writing.questionId.renderer_key='essay'

        Stage 3 (P1-new-4):
          - 排序 by display_order 升序 → dedup paperCode/questionId → 重新连续编号
        """
        # Stage 3.1: 先排序
        sorted_tasks = sorted(llm_tasks, key=lambda t: t.display_order)

        validated: list[StudyLLMTaskUnion] = []
        # Stage 3 dedup:
        # (a) question_id 跨 task 重叠 — 同 questionId 一次 plan 内只允许 1 个 task 引
        # (b) 整卷 practice (paperCode + questionIds=null) — 同 paperCode 整卷只允许 1 个
        #     (P1-1 v0.3 review: LLM 易把"complete this paper"输出 5 个一样的整卷 task)
        # 整卷 vs 同卷限定题 (paperCode 同但 questionIds=[...]) — 允许共存
        # (用户做整卷 X 与做该卷某 3 题是不同 task, 不互斥)
        seen_question_ids: set[int] = set()
        seen_full_paper_codes: set[str] = set()

        # Stage 2 数据准备 — 当前用户错题 question_id 集 (mastery != mastered).
        # P1-F (v0.3 全 slice review 注释): 这里用 ctx.recent_wrong_questions
        # 而非查 DB 真集合是 by design — ctx limit 10 (见 _build_context line 491),
        # LLM 看到的就是这 10 条. sanity 用同集合保证"LLM 引的 questionId 必须
        # 在 prompt 给的列表内", 防 LLM 自己编 questionId. 真集合可能 50+ 条但
        # LLM 没看到第 11+ 条, 即使引了也算幻觉. 跟 prompt 列表强一致 (P2-4 接受).
        valid_wrong_qids = {wq.question_id for wq in ctx.recent_wrong_questions}
        # 用户可见 paper_code 集 (case-sensitive, 跟 list_public_papers 一致)
        valid_paper_codes = set(ctx.available_paper_codes)

        for task in sorted_tasks:
            # Stage 2 #6/7: paperCode 校验 (practice / essay_writing 才有)
            paper_code: str | None = None
            if isinstance(task, (PracticeLLMTask, EssayWritingLLMTask)):
                paper_code = task.payload.paper_code
                if paper_code not in valid_paper_codes:
                    logger.info(
                        "study_plan.task_dropped reason=invalid_paper_code "
                        "user_id=%s paper_code=%s", user_id, paper_code,
                    )
                    continue

            # Stage 2 #8: questionId 校验
            question_ids_to_check: list[int] = []
            if isinstance(task, PracticeLLMTask):
                if task.payload.question_ids is not None:
                    question_ids_to_check = list(task.payload.question_ids)
            elif isinstance(task, ReviewWrongLLMTask):
                question_ids_to_check = list(task.payload.question_ids)
                # Stage 2 #9: review_wrong 必须真在用户未掌握错题表
                bad_qids = [
                    qid for qid in question_ids_to_check
                    if qid not in valid_wrong_qids
                ]
                if bad_qids:
                    logger.info(
                        "study_plan.task_dropped reason=review_wrong_not_in_user_wrongs "
                        "user_id=%s bad_qids=%s", user_id, bad_qids,
                    )
                    continue
            elif isinstance(task, EssayWritingLLMTask):
                question_ids_to_check = [task.payload.question_id]

            if question_ids_to_check:
                if not self._questions_exist_and_match_paper(
                    question_ids_to_check, paper_code=paper_code,
                    require_essay=isinstance(task, EssayWritingLLMTask),
                ):
                    logger.info(
                        "study_plan.task_dropped reason=question_invalid "
                        "user_id=%s task_kind=%s", user_id, task.task_kind,
                    )
                    continue

            # Stage 3.2a: 整卷 practice paperCode dedup (P1-1)
            is_full_paper = (
                isinstance(task, PracticeLLMTask)
                and task.payload.question_ids is None
                and paper_code is not None
            )
            if is_full_paper and paper_code in seen_full_paper_codes:
                logger.info(
                    "study_plan.task_dropped reason=duplicate_full_paper "
                    "user_id=%s paper_code=%s", user_id, paper_code,
                )
                continue

            # Stage 3.2b: question_id 集合 dedup
            new_qids = set(question_ids_to_check)
            if new_qids & seen_question_ids:
                logger.info(
                    "study_plan.task_dropped reason=duplicate_question_id "
                    "user_id=%s overlap=%s",
                    user_id, new_qids & seen_question_ids,
                )
                continue

            if is_full_paper and paper_code is not None:
                seen_full_paper_codes.add(paper_code)
            seen_question_ids.update(new_qids)
            validated.append(task)

        return validated

    def _questions_exist_and_match_paper(
        self,
        question_ids: list[int],
        *,
        paper_code: str | None,
        require_essay: bool,
    ) -> bool:
        """Question.id IN (...) AND enabled=True. 若 paper_code 给, 校验所有
        questionId 都属于该 paper.current_revision; 若 require_essay, 加 renderer_key='essay'.
        """
        if not question_ids:
            return True  # 空 list (practice questionIds=null) 已在外层处理

        stmt = select(Question.id).where(
            Question.id.in_(question_ids), Question.enabled.is_(True)
        )
        if paper_code is not None:
            stmt = stmt.join(
                PaperRevision, Question.paper_revision_id == PaperRevision.id
            ).join(
                Paper, Paper.current_revision_id == PaperRevision.id
            ).where(Paper.paper_code == paper_code)
        if require_essay:
            stmt = stmt.where(Question.renderer_key == "essay")

        found_ids = set(self.session.scalars(stmt).all())
        return found_ids == set(question_ids)


# ─── R4 startup health check ─────────────────────────────────────────────


class FallbackPaperMissingError(RuntimeError):
    """Startup 时 fallback paper / questionId 缺失 — 必须修复才能启动.

    PoC 单机部署: 缺这条 fallback 学习计划无法服务任何冷启动用户. fail-fast.
    """


def _load_fallback_question_ids(session: Session) -> list[int]:
    """Resolve fallback question IDs from stable source UUIDs in active revision."""
    rows = session.execute(
        select(Question.source_uuid, Question.id)
        .join(PaperRevision, Question.paper_revision_id == PaperRevision.id)
        .join(Paper, Paper.current_revision_id == PaperRevision.id)
        .where(
            Paper.paper_code == _FALLBACK_PAPER_CODE,
            Question.source_uuid.in_(_FALLBACK_QUESTION_SOURCE_UUIDS),
            Question.enabled.is_(True),
        )
    ).all()
    ids_by_source_uuid = {source_uuid: question_id for source_uuid, question_id in rows}
    missing = [
        source_uuid
        for source_uuid in _FALLBACK_QUESTION_SOURCE_UUIDS
        if source_uuid not in ids_by_source_uuid
    ]
    if missing:
        raise FallbackPaperMissingError(
            f"fallback question sourceUuids {missing} not found in active "
            f"revision of paper {_FALLBACK_PAPER_CODE!r}, or not enabled. "
            "Import the missing questions before starting the app."
        )
    return [
        ids_by_source_uuid[source_uuid]
        for source_uuid in _FALLBACK_QUESTION_SOURCE_UUIDS
    ]


def _load_dynamic_fallback_practice_task(session: Session) -> tuple[str, list[int]]:
    """Pick a visible current paper with enough enabled non-essay questions.

    This is the self-contained MVP/demo fallback for environments that do not
    import the production FENBI paper. It deliberately uses current public data
    only, matching what users can open from the practice center.
    """
    candidates = session.execute(
        select(Paper.paper_code, PaperRevision.id)
        .join(Paper.current_revision)
        .where(
            Paper.current_revision_id.is_not(None),
            PaperRevision.visible_in_public.is_(True),
        )
        .order_by(PaperRevision.sort_order.desc(), Paper.paper_code.asc())
    ).all()

    for paper_code, revision_id in candidates:
        question_ids = list(
            session.scalars(
                select(Question.id)
                .where(
                    Question.paper_revision_id == revision_id,
                    Question.enabled.is_(True),
                    Question.renderer_key != "essay",
                )
                .order_by(Question.position.asc())
                .limit(_FALLBACK_QUESTION_COUNT)
            ).all()
        )
        if len(question_ids) >= _FALLBACK_QUESTION_COUNT:
            return paper_code, question_ids

    raise FallbackPaperMissingError(
        "no fallback practice paper found: need at least "
        f"{_FALLBACK_QUESTION_COUNT} enabled non-essay questions in a visible "
        "current paper. Import FENBI-7274732 or run `npm run seed:mvp-demo`."
    )


def _resolve_fallback_practice_task(session: Session) -> tuple[str, list[int]]:
    """Resolve fallback paperCode + question IDs for cold-start study plans."""
    paper_exists = session.scalar(
        select(exists().where(Paper.paper_code == _FALLBACK_PAPER_CODE))
    )
    if paper_exists:
        return _FALLBACK_PAPER_CODE, _load_fallback_question_ids(session)
    return _load_dynamic_fallback_practice_task(session)


def assert_fallback_paper_loadable(session: Session) -> None:
    """Startup health check (plan §10 R4). 校验 fallback task 可生成.

    生产库仍优先校验 FENBI-7274732 + 3 sourceUuid. 本地 MVP demo 库未导入
    FENBI 时, 允许从可见 current paper 动态挑 3 道非申论题.
    """
    _resolve_fallback_practice_task(session)


__all__ = [
    "FallbackPaperMissingError",
    "StudyPlanGenerationOutcome",
    "StudyPlanHistoryRow",
    "StudyPlanService",
    "assert_fallback_paper_loadable",
    "today_plan_date_shanghai",
]
