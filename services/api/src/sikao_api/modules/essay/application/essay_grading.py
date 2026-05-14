"""申论批改 service — Slice 2c.

API:
- EssayGradingService(session).submit(user_id, question_id, answer_text) → record (status='pending')
- EssayGradingService(session).get_my_record(user_id, record_id) → record (cross-user 404)
- EssayGradingService(session).list_my_records(user_id, limit) → list[record]
- async grade_essay_record_async(session_factory, settings, record_id) → None
  (BackgroundTask 入口, 跑 LLM call + R6 parse + R10 sanity → status=completed/failed)

R10 sanity check:
  - 每维 score clamp [0, 10]
  - overallScore 按权重 (论点 30 / 材料 25 / 语言 20 / 结构 15 / 字数 10) 重算,
    不信 LLM 返回的 overallScore (LLM 算错的事故概率不低)
  - 5 维全相等差 ≤0.5 → suspicious (LLM 偷懒 / 没认真评)
  - sample_answer 字数偏离题干 wordLimitMax ±20% → suspicious (LLM 没听懂字数约束)

并发: BackgroundTask 在 FastAPI process 内单线程跑 (PoC). 进程重启 → in-flight
record 留 status='pending'; plan §6 R11 grace period (5 min 后标 failed) 留待
Slice 4 / 上 cron 时再做 (memory `worktree_cleanup_sunday`).
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, cast

from sqlalchemy import desc, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from sikao_api.core.config import Settings
from sikao_api.db import schemas
from sikao_api.db.models import (
    EssayGradingRecord,
    Paper,
    PaperRevision,
    Question,
    utc_now,
)
from sikao_api.modules.system.application.errors import NotFoundError, ValidationError
from sikao_api.modules.llm.application.llm import build_llm_provider
from sikao_api.modules.llm.application.llm.json_parser import LlmJsonParseError, parse_with_recovery
from sikao_api.modules.llm.application.llm.prompts.essay_grading import (
    ESSAY_DIMENSIONS,
    build_essay_grading_messages,
)
from sikao_api.modules.llm.application.llm.usage_recorder import UsageRecord, record_usage

logger = logging.getLogger(__name__)

# Sanity check: 5 维度评分差 ≤ 此值时标 suspicious (LLM 全打同分疑似没认真评).
_SUSPICIOUS_DIMENSION_SPREAD = 0.5

# Sample answer 字数偏离 word_limit_max ±此比例 → suspicious.
_SUSPICIOUS_SAMPLE_LENGTH_DEVIATION = 0.20

# Phase D 申论专项: stem 截断长度 (前端 80 字预览, 后端裕量给 200 char).
_SPECIALTY_STEM_PREVIEW_LEN = 200

# Phase D 申论专项: subtype 白名单 (master agent verify, 见 docs/plan).
# `公文` 与 `应用文` 在 canonical_subtype 是分开两类; 前端 chip 合并显示
# `公文 · 应用文`, 后端各自单独查 (chip click 时合并 2 次请求 OR 让前端
# 直接传两 subtype list — 这里走简化, 前端先按一类查).
_ESSAY_SPECIALTY_SUBTYPES = frozenset({
    "归纳概括",
    "大作文",
    "综合分析",
    "公文",
    "应用文",
    "提出对策",
})


def _strip_html_tags(html: str) -> str:
    """Naive HTML strip — 把 <p>...</p> 这类 tag 删掉只留文本.

    专项题列表只显示纯文本预览, 不渲染富文本; 不引 lxml/BeautifulSoup
    避免新依赖. 如果 stem 含 entities (如 &nbsp;) 暂不解, 实际数据 stem
    里不应含 entity (import 已规范). regex 是 fail-soft: 偶发畸形 tag 不炸.
    """
    import re

    text = re.sub(r"<[^>]+>", "", html or "")
    return text.strip()


def _serialize_specialty_item(
    question: Question,
    paper_code: str,
    paper_name: str,
    latest_at: Any,
) -> schemas.EssaySpecialtyQuestionItemV2:
    """Question + paper meta + per-user latest grading row → list item.

    word_requirement 从 type_payload_json.wordLimitMax 派生 ("≤ N 字"),
    缺值返 None (前端隐藏). full_score 同理.
    latest_at 是 sqlalchemy datetime 或 None — 直接透传给 Pydantic.
    """
    type_payload = question.type_payload_json or {}
    word_max = type_payload.get("wordLimitMax")
    full_score = type_payload.get("fullScore")
    word_requirement = (
        f"≤ {int(word_max)} 字" if isinstance(word_max, (int, float)) else None
    )
    stem_plain = _strip_html_tags(question.stem_text)
    if len(stem_plain) > _SPECIALTY_STEM_PREVIEW_LEN:
        stem_plain = stem_plain[:_SPECIALTY_STEM_PREVIEW_LEN] + "…"
    return schemas.EssaySpecialtyQuestionItemV2(
        question_id=question.id,
        paper_code=paper_code,
        paper_name=paper_name,
        position=question.position,
        stem=stem_plain,
        word_requirement=word_requirement,
        full_score=int(full_score) if isinstance(full_score, (int, float)) else None,
        last_answered_at=latest_at,
    )


class EssayGradingService:
    """同步部分: submit + 查询. 异步评分走 grade_essay_record_async."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def submit(
        self, *, user_id: int, question_id: int, answer_text: str
    ) -> EssayGradingRecord:
        """创建 pending record. caller 之后 schedule grade_essay_record_async."""
        question = self.session.get(Question, question_id)
        if question is None:
            raise NotFoundError("question not found")
        if question.renderer_key != "essay":
            raise ValidationError(
                "question is not essay type", code="essay_wrong_kind"
            )

        record = EssayGradingRecord(
            user_id=user_id,
            question_id=question_id,
            answer_text=answer_text,
            status="pending",
        )
        self.session.add(record)
        self.session.flush()
        return record

    def get_my_record(self, *, user_id: int, record_id: int) -> EssayGradingRecord:
        record = self.session.get(EssayGradingRecord, record_id)
        if record is None or record.user_id != user_id:
            # cross-user 404 防 leak record 存在性 (跟 LlmConversation 一致)
            raise NotFoundError("essay grading record not found")
        return record

    def list_my_records(
        self, *, user_id: int, limit: int = 20
    ) -> list[EssayGradingRecord]:
        stmt = (
            select(EssayGradingRecord)
            .where(EssayGradingRecord.user_id == user_id)
            .order_by(EssayGradingRecord.created_at.desc())
            .limit(limit)
        )
        return list(self.session.scalars(stmt))

    # ── Phase D: 申论专项练习 (跨卷单题) ─────────────────────────────────
    def list_specialty_questions(
        self,
        *,
        user_id: int,
        subtypes: list[str],
        page: int = 1,
        page_size: int = 20,
    ) -> schemas.EssaySpecialtyListResponseV2:
        """跨卷列出 N 个 canonical_subtype 下的全部 essay 题, paginate.

        过滤条件 (跟 list_categories / list_public_questions 一致 visibility):
          - question_kind = 'essay' (申论题)
          - canonical_subtype IN subtypes (5 大类的子集)
          - paper.current_revision_id == paper_revision.id (only current rev)
          - paper_revision.visible_in_public IS True
          - question.enabled IS True

        多值 (规范官 P0-3 2026-05-08): subtypes 长度 ≥1, 通常单值; 视觉合并的
        类 (e.g. '公文 · 应用文' = ['公文', '应用文']) 走多值, IN 查询合并结果集.

        排序: paper.exam_year DESC NULLS LAST → paper.paper_code → position
        让用户先看到最新真题; year IS NULL (历史模拟卷 / aipta) 沉到底.

        last_answered_at: per-user MAX(essay_grading_records.created_at)
        WHERE record.user_id == user_id AND status='completed'.
        缺 record (未答 or 未 completed) → None.

        Pydantic 序列化层把 stem_text 截到 200 char (HTML strip 业务层).
        """
        if page < 1:
            raise ValidationError("page must be >= 1", code="invalid_page")
        if page_size < 1 or page_size > 50:
            raise ValidationError(
                "page_size must be in [1, 50]", code="invalid_page_size"
            )
        if not subtypes:
            raise ValidationError(
                "subtypes must contain at least one value", code="invalid_subtypes"
            )

        # Total count — 不带 LEFT JOIN 减负载
        count_stmt = (
            select(func.count(Question.id))
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind == "essay",
                Question.canonical_subtype.in_(subtypes),
            )
        )
        total = self.session.scalar(count_stmt) or 0

        # Page items + per-user latest record (LEFT JOIN subquery on
        # latest completed grading per question for this user).
        offset = (page - 1) * page_size
        last_answered_subq = (
            select(
                EssayGradingRecord.question_id.label("q_id"),
                func.max(EssayGradingRecord.created_at).label("latest_at"),
            )
            .where(
                EssayGradingRecord.user_id == user_id,
                EssayGradingRecord.status == "completed",
            )
            .group_by(EssayGradingRecord.question_id)
            .subquery()
        )
        items_stmt = (
            select(
                Question,
                Paper.paper_code,
                PaperRevision.paper_name,
                last_answered_subq.c.latest_at,
            )
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .outerjoin(
                last_answered_subq,
                last_answered_subq.c.q_id == Question.id,
            )
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind == "essay",
                Question.canonical_subtype.in_(subtypes),
            )
            .order_by(
                desc(Question.exam_year).nulls_last(),
                Paper.paper_code.asc(),
                Question.position.asc(),
            )
            .limit(page_size)
            .offset(offset)
        )
        rows = self.session.execute(items_stmt).all()

        items = [
            _serialize_specialty_item(question, paper_code, paper_name, latest_at)
            for question, paper_code, paper_name, latest_at in rows
        ]
        return schemas.EssaySpecialtyListResponseV2(
            items=items,
            total=int(total),
            page=page,
            page_size=page_size,
        )

    # ── #18 申论专项 category tree (方案 B 修订版) ───────────────────────
    def list_essay_categories(
        self,
        *,
        user_id: int | None,
    ) -> schemas.CategoriesResponseV2:
        """跨卷按 canonical_subtype 聚合 essay 题, doneByUser 走 EssayGradingRecord.

        跟 ExamPaperService.list_categories 视觉对称, 但 SSOT 是 EssayGradingRecord
        而非 PracticeSession.answer (申论独立轨道, 走 LLM 评分流, 无 PracticeSession).

        过滤:
          - question_kind == 'essay' (round 1 reviewer catch: 不用 paper_code LIKE)
          - canonical_subtype IS NOT NULL
          - paper.current_revision_id == paper_revision.id
          - paper_revision.visible_in_public IS True
          - question.enabled IS True

        doneByUser:
          - join EssayGradingRecord WHERE user_id == X AND status == 'completed'
          - distinct question_id 计数 (同题多次评分仍记 1)
          - user_id=None (匿名) → 全 0

        排序: 5 类硬编码顺序 (跟前端 EssaySpecialty.SUBTYPE_CHIPS 对齐), 6 行 raw,
        FE 合并 '公文' + '应用文' → '公文 · 应用文'.
        """
        # 6 类硬编码顺序 (公文 / 应用文 拆开返, FE 合并显 5 卡).
        # 顺序跟前端 EssaySpecialty.SUBTYPE_CHIPS 视觉一致 (公文+应用文 合并卡
        # 落在 综合分析 之后, 大作文 之前).
        canonical_order: tuple[str, ...] = (
            "归纳概括",
            "综合分析",
            "提出对策",
            "公文",
            "应用文",
            "大作文",
        )

        # totals — 跨 public papers 按 canonical_subtype group_by.
        total_stmt = (
            select(Question.canonical_subtype, func.count(Question.id))
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.question_kind == "essay",
                Question.canonical_subtype.is_not(None),
            )
            .group_by(Question.canonical_subtype)
        )
        totals: dict[str, int] = {
            subtype: int(count)
            for subtype, count in self.session.execute(total_stmt).all()
        }

        # doneByUser — join EssayGradingRecord status='completed', distinct question.
        done_counts: dict[str, int] = {}
        if user_id is not None:
            done_stmt = (
                select(
                    Question.canonical_subtype,
                    func.count(func.distinct(Question.id)),
                )
                .join(
                    EssayGradingRecord,
                    EssayGradingRecord.question_id == Question.id,
                )
                .join(Question.paper_revision)
                .join(PaperRevision.paper)
                .where(
                    Paper.current_revision_id == PaperRevision.id,
                    PaperRevision.visible_in_public.is_(True),
                    Question.enabled.is_(True),
                    Question.question_kind == "essay",
                    Question.canonical_subtype.is_not(None),
                    EssayGradingRecord.user_id == user_id,
                    EssayGradingRecord.status == "completed",
                )
                .group_by(Question.canonical_subtype)
            )
            done_counts = {
                subtype: int(count)
                for subtype, count in self.session.execute(done_stmt).all()
            }

        # 按 canonical_order 排序输出 6 行. 库里没题的 subtype 仍返 total=0
        # 让前端可显示 "题库准备中". canonical_subtype 不在白名单的题被丢弃
        # (round 1 reviewer: "canonical_subtype IS NULL question 不进 categories").
        categories = [
            schemas.CategorySummaryV2(
                top_type=subtype,
                name=subtype,
                total=totals.get(subtype, 0),
                done_by_user=done_counts.get(subtype, 0),
            )
            for subtype in canonical_order
        ]
        return schemas.CategoriesResponseV2(categories=categories)


async def grade_essay_record_async(
    session_factory: sessionmaker[Session],
    settings: Settings,
    record_id: int,
) -> None:
    """BackgroundTask 入口. 跑 LLM call + R6 parse + R10 sanity, 写 record.

    任何错都内部捕获 → 标 status='failed' + failure_reason 不向 caller 抛
    (FastAPI BackgroundTask 异常会写 server log 但不告 client). 异常情况下
    record 仍 commit, 用户轮询 GET 能看到 failure_reason.

    TODO(2026-05-15 lhr): 当前单 session 横跨整 LLM call (~10-30s); prod PG
    pool_size=5 时 5 并发申论饱和池. 优化路径: 拆 3 段 — 起步只读 record/
    question (close); 跑 LLM (无 DB 连接); 结束开 session 写终态 + record_usage.
    PoC 单用户 OK, 真用户量上来再做.
    """
    session = session_factory()
    try:
        await _grade_essay_record_inner(session, settings, record_id)
        session.commit()
    except Exception as exc:  # noqa: BLE001 — fail-safe wrapper for BackgroundTask
        session.rollback()
        # 用 fresh session 标 failed, 避免之前的 session 已 abort 状态
        try:
            with session_factory() as fresh:
                rec = fresh.get(EssayGradingRecord, record_id)
                if rec is not None and rec.status == "pending":
                    rec.status = "failed"
                    rec.failure_reason = f"unexpected error: {type(exc).__name__}: {exc}"
                    rec.updated_at = utc_now()
                    fresh.commit()
        except SQLAlchemyError:
            logger.exception(
                "essay grading: failed to mark failed status record_id=%s", record_id
            )
        logger.exception(
            "essay grading background task failed record_id=%s", record_id
        )
    finally:
        session.close()


async def _grade_essay_record_inner(
    session: Session, settings: Settings, record_id: int
) -> None:
    record = session.get(EssayGradingRecord, record_id)
    if record is None:
        logger.warning("essay grading: record %s not found", record_id)
        return
    if record.status != "pending":
        # 已被前一次跑完 / 标 failed, 不重复评分
        return

    question = session.get(Question, record.question_id)
    if question is None:
        record.status = "failed"
        record.failure_reason = "question not found at grading time"
        record.updated_at = utc_now()
        return

    # v1 上线设计 (alembic 0012): type_payload_json 列升级 JSONB, ORM 直接拿 dict.
    # not nullable + default=dict 保证不会 None. 非 dict 是 bug (manual SQL /
    # 测试 fixture 用 json.dumps 喂字符串) — fail-fast 抛错而非 silent 降级
    # (CLAUDE.md §4: 防 grading flow 拿空 type_payload 但测试 happy path PASS).
    if not isinstance(question.type_payload_json, dict):
        raise TypeError(
            f"essay grading: type_payload_json must be dict, got "
            f"{type(question.type_payload_json).__name__} for question_id={question.id}"
        )
    type_payload = question.type_payload_json
    raw_materials = type_payload.get("materialTexts")
    materials = [
        item for item in raw_materials
        if isinstance(item, str)
    ] if isinstance(raw_materials, list) else []
    word_min = type_payload.get("wordLimitMin")
    word_max = type_payload.get("wordLimitMax")
    full_score = type_payload.get("fullScore")

    messages = build_essay_grading_messages(
        question_stem=question.stem_text,
        materials=materials,
        word_limit_min=word_min if isinstance(word_min, int) else None,
        word_limit_max=word_max if isinstance(word_max, int) else None,
        full_score=full_score if isinstance(full_score, int) else None,
        user_answer=record.answer_text,
    )

    try:
        provider, label = build_llm_provider(
            settings, db=session, user_id=record.user_id
        )
    except Exception as exc:  # noqa: BLE001 — provider config / SSRF / etc 都标 failed
        record.status = "failed"
        record.failure_reason = f"LLM provider build failed: {type(exc).__name__}: {exc}"
        record.updated_at = utc_now()
        return

    try:
        result = await provider.chat_completion(
            messages=messages,
            model=settings.llm_model_essay,
            max_tokens=settings.llm_max_tokens,
            temperature=0.3,  # 评分要稳定, 不发散
        )
    except Exception as exc:  # noqa: BLE001 — httpx / timeout / 4xx-5xx 都标 failed
        record.status = "failed"
        record.failure_reason = f"LLM call failed: {type(exc).__name__}: {exc}"
        record.updated_at = utc_now()
        return

    try:
        parsed = parse_with_recovery(result.content)
    except LlmJsonParseError as exc:
        record.status = "failed"
        record.failure_reason = f"LLM JSON parse failed: {exc}"
        record.updated_at = utc_now()
        return

    try:
        feedback = _build_feedback_with_sanity_check(
            parsed, word_limit_max=word_max if isinstance(word_max, int) else None
        )
    except ValueError as exc:
        record.status = "failed"
        record.failure_reason = f"feedback shape invalid: {exc}"
        record.updated_at = utc_now()
        return

    # 记账 — 失败仅丢记账, 不影响 grade (跟 Slice 1a 同 pattern)
    token_usage_id: int | None = None
    try:
        usage = record_usage(
            session,
            UsageRecord(
                feature="essay_grading",
                user_id=record.user_id,
                provider=label,
                model=result.model,
                prompt_tokens=result.prompt_tokens,
                prompt_cache_hit_tokens=result.prompt_cache_hit_tokens,
                prompt_cache_miss_tokens=result.prompt_cache_miss_tokens,
                completion_tokens=result.completion_tokens,
                resource_type="essay",
                resource_id=record.id,
            ),
        )
        token_usage_id = usage.id
    except SQLAlchemyError as exc:
        logger.warning(
            "essay grading: record_usage failed record_id=%s err=%s", record_id, exc
        )

    record.status = "completed"
    # 1st review P1-C: feedback["overallScore"] 已 round(*, 2) 过 (line 295), 这里
    # 不重复 round, 直接 Decimal(str(...)) 避免 float→Decimal 隐式转换误差.
    overall = cast(float, feedback["overallScore"])
    record.score = Decimal(str(overall))
    record.feedback_json = feedback
    record.token_usage_id = token_usage_id
    record.graded_at = utc_now()
    record.updated_at = utc_now()


def _build_feedback_with_sanity_check(
    parsed: dict[str, Any], *, word_limit_max: int | None
) -> dict[str, Any]:
    """R10 sanity check + shape normalization → feedback_json 落库形.

    输入: LLM 返的 parsed dict (含 evaluation + sample_answer 顶级键, 见
    essay_grading.py prompt schema).
    输出: feedback_json 形 (overallScore / dimensions / strengths / weaknesses
    / suggestions / sampleAnswer / suspicious).
    """
    evaluation = parsed.get("evaluation")
    if not isinstance(evaluation, dict):
        raise ValueError("'evaluation' is not an object")
    raw_dims = evaluation.get("dimensions") or []
    if not isinstance(raw_dims, list):
        raise ValueError("'evaluation.dimensions' is not a list")

    dim_by_name = {
        d.get("name"): d for d in raw_dims if isinstance(d, dict)
    }
    # 1st review P2-C + 2nd review P2-NEW: LLM 字段名错位 (e.g. 'criteria' 代替
    # 'dimensions', 或维度 name 用英文 'argument') → dim_by_name 0 个匹配预期名,
    # 或者 LLM 干脆返 `dimensions: []` 摆烂 → 所有 dim 默认 0 → score=0 'completed'
    # UX 误导. 两种 case 都标 failed 让用户看到 'feedback shape invalid'.
    expected_names = {name for name, _, _ in ESSAY_DIMENSIONS}
    matched = [name for name in dim_by_name if name in expected_names]
    if not matched:
        raise ValueError(
            "evaluation.dimensions has no recognized dimension name; "
            f"got {sorted(n for n in dim_by_name if n is not None)!r}, "
            f"expected at least one of {sorted(expected_names)!r}"
        )
    out_dims: list[dict[str, Any]] = []
    overall_weighted = 0.0
    for name, weight, _rubric in ESSAY_DIMENSIONS:
        item = dim_by_name.get(name) or {}
        raw_score = item.get("score", 0)
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0
        score = max(0.0, min(10.0, score))  # clamp [0, 10]
        comment = str(item.get("comment") or "").strip()
        out_dims.append(
            {"name": name, "weight": weight, "score": score, "comment": comment}
        )
        overall_weighted += weight * score
    overall_score = round(overall_weighted * 10, 2)  # 0-100

    scores = [d["score"] for d in out_dims]
    suspicious = (
        max(scores) - min(scores) <= _SUSPICIOUS_DIMENSION_SPREAD
    )

    sample_raw = parsed.get("sample_answer")
    sample_answer = (
        str(sample_raw).strip() if sample_raw is not None else None
    )

    if sample_answer and word_limit_max is not None:
        sample_len = len(sample_answer)
        if (
            sample_len < word_limit_max * (1 - _SUSPICIOUS_SAMPLE_LENGTH_DEVIATION)
            or sample_len > word_limit_max * (1 + _SUSPICIOUS_SAMPLE_LENGTH_DEVIATION)
        ):
            suspicious = True

    return {
        "overallScore": overall_score,
        "dimensions": out_dims,
        "strengths": _str_list(evaluation, "strengths"),
        "weaknesses": _str_list(evaluation, "weaknesses"),
        "suggestions": _str_list(evaluation, "suggestions"),
        "sampleAnswer": sample_answer,
        "suspicious": suspicious,
    }


def _str_list(d: dict[str, Any], key: str) -> list[str]:
    items = d.get(key) or []
    if not isinstance(items, list):
        return []
    return [str(i).strip() for i in items if str(i).strip()]


__all__ = [
    "EssayGradingService",
    "grade_essay_record_async",
]
