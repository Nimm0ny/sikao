from __future__ import annotations

import hashlib
import json
import logging
import mimetypes
import re
from collections import OrderedDict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal, Protocol, cast, overload

from sqlalchemy import exists, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.sql.elements import ColumnElement

from sikao_api.db import schemas
from sikao_api.db.models import (
    ImportJob,
    ImportJobItem,
    MaterialGroup,
    MaterialGroupAsset,
    Paper,
    PaperBlock,
    PaperRevision,
    PaperSection,
    PracticeSession,
    PracticeSessionAnswer,
    Question,
    QuestionAsset,
    QuestionOption,
    ReleaseAudit,
    Tag,
    User,
    WrongQuestionMastery,
    utc_now,
)
from sikao_api.scripts.backfill_question_subject import infer_subject
from sikao_api.modules.system.application.errors import ConflictError, NotFoundError, ValidationError
from sikao_api.modules.admin.application.exam_support import (
    deserialize_answer_text,
    format_answer_summary,
    infer_renderer_key,
    is_answer_correct,
    normalize_answer_keys,
    selection_mode_for_renderer,
    serialize_answer_keys,
)
from sikao_api.modules.wrong_book.application.mastery import update_mastery

RECENT_ATTEMPTS_LIMIT = 20
RECENT_SESSIONS_LIMIT = 10
ALLOWED_BLOCK_TYPES = {"question", "material_group"}
ALLOWED_GROUP_KINDS = {"passage_reading", "data_analysis"}

logger = logging.getLogger(__name__)


# PracticeSession.mode 字面量. 仅列出实际有 use site 的:
#   paper                    — 普通 paper 答题 (start_paper_session)
#   retry_wrong              — 单 revision retry (start_retry_wrong / batch 单 paper)
#   retry_wrong_cross_paper  — 跨 revision retry batch (独立 review KEY OBS #1)
# dispatch 读 mode 字段而非 paper_revision_id is None 的 in-band marker, 减脆性.
# 避免造未用的 "exam" / "free_practice" 等占位常量 (speculative, mode field 也
# 不带 type narrowing).
MODE_PAPER = "paper"
MODE_RETRY_WRONG = "retry_wrong"
MODE_RETRY_WRONG_CROSS_PAPER = "retry_wrong_cross_paper"
MODE_CUSTOM_PRACTICE = "custom_practice"
# Slice 3b: 学习计划 session mode. 行为跟 retry_wrong 一致 (复用 helper),
# 仅 mode 字段区分入口给统计 / ABM 用 (study_plan 完成 N 题 vs 复习错题 M 题).
# cross-paper 路径同样区分 (见 _CROSS_PAPER_MODES dispatch helper).
MODE_STUDY_PLAN = "study_plan"
MODE_STUDY_PLAN_CROSS_PAPER = "study_plan_cross_paper"

# session.mode dispatch helper. paper_revision_id IS NULL 的 session 必属本集合;
# 反之必绑 paper_revision. 4 处 dispatch (line 695/745/781/2487) 用此判断.
_CROSS_PAPER_MODES = frozenset({
    MODE_RETRY_WRONG_CROSS_PAPER,
    MODE_CUSTOM_PRACTICE,
    MODE_STUDY_PLAN_CROSS_PAPER,
})

# Slice 3e ABM dashboard breakdown — 已知的 5 个 mode. 不在此集合的 mode 视为
# unknown, _compute_mode_breakdown 走 logger.warning + 兜底归 paper_bound 桶.
_KNOWN_DASHBOARD_MODES = frozenset({
    MODE_PAPER,
    MODE_RETRY_WRONG,
    MODE_RETRY_WRONG_CROSS_PAPER,
    MODE_CUSTOM_PRACTICE,
    MODE_STUDY_PLAN,
    MODE_STUDY_PLAN_CROSS_PAPER,
})

# fenbi adapter 把 raw HTML 里的 <img src="assets/<basename>"> 直接落进 stem /
# explanation / option_text。前端不会重写 src，浏览器以页面 URL 为 base
# 解析就是 404。read 时按 question.assets[].file_path basename 配对，把 src
# 改写成公开 asset endpoint URL。
_ASSET_SRC_PATTERN = re.compile(r'src="assets/([^"]+)"')


class _AssetLike(Protocol):
    id: int
    file_path: str


@overload
def _rewrite_asset_urls(html: None, assets: Iterable[_AssetLike]) -> None: ...


@overload
def _rewrite_asset_urls(html: str, assets: Iterable[_AssetLike]) -> str: ...


def _rewrite_asset_urls(html: str | None, assets: Iterable[_AssetLike]) -> str | None:
    """Rewrite `src="assets/<basename>"` → `src="/api/v2/assets/questions/<id>"`.

    Fail-soft：basename 在 assets[] 找不到时保留原 src + 一条 WARNING log。
    Why fail-soft：dangling reference 是数据完整性问题（可能是 import 漏 asset
    或 stem HTML 引用了已删的图），不该让单题的数据完整性破坏整 paper 的 read。
    前端会得到 broken img，运维从 log 找回。
    """
    if not html:
        return html
    by_basename = {Path(a.file_path).name: a.id for a in assets}
    if not by_basename:
        # 全 paper 无 asset 但 html 有 <img> → 全部命中 fail-soft 路径。
        # 不做特殊处理，让下面循环走完，每个 unknown 都打 log。
        pass

    def repl(match: re.Match[str]) -> str:
        basename = match.group(1)
        asset_id = by_basename.get(basename)
        if asset_id is None:
            logger.warning("rewrite_asset_urls: basename %r not in question.assets", basename)
            return match.group(0)
        return f'src="/api/v2/assets/questions/{asset_id}"'

    return _ASSET_SRC_PATTERN.sub(repl, html)


def _import_job_status(value: str) -> Literal["completed", "partial", "failed"]:
    if value not in {"completed", "partial", "failed"}:
        raise ValidationError(f"invalid import job status: {value}")
    return cast(Literal["completed", "partial", "failed"], value)


def _import_job_item_status(value: str) -> Literal["completed", "failed"]:
    if value not in {"completed", "failed"}:
        raise ValidationError(f"invalid import job item status: {value}")
    return cast(Literal["completed", "failed"], value)


_ESSAY_METADATA_KEYS = (
    "materialTexts",
    "wordLimitMin",
    "wordLimitMax",
    "suggestedMinutes",
    "fullScore",
)


def _extract_essay_metadata(type_payload: dict[str, Any]) -> dict[str, Any] | None:
    """essay 题型从 type_payload 提取白名单字段; 非 essay 或字段全缺返 None.

    Slice 2a: 申论 metadata (材料文本数组 / 字数上下限 / 建议时长 / 满分) 借用
    `type_payload_json`（跟 fill_blank 同套 type-specific 容器, 不新加列）. 序列化
    回前端时单独抽出走 `content.essayMetadata`, 避免前端误读 type_payload 杂字段.

    shape 校验放 ingest 时 (fail-fast, CLAUDE.md §4); 这里只做白名单过滤, 信任
    DB 数据. 2nd review P2 调整: 不在序列化层做 silent drop.
    """
    extracted = {key: type_payload[key] for key in _ESSAY_METADATA_KEYS if key in type_payload}
    return extracted or None


def _build_question_content(
    rewritten_stem: str,
    sorted_options: list[QuestionOption],
    rewritten_option_text: dict[int, str],
    rewritten_explanation: str,
    *,
    essay_metadata: dict[str, Any] | None = None,
) -> dict[str, object]:
    """Question.content 字段 (stem + options + explanation [+ essayMetadata]) 序列化.

    P1 review fix Phase A.1: 从 `_serialize_question_detail` 提取的 SRP helper.
    pure function, 无 self / db 依赖, 测试容易.

    Slice 2a: essay 题型时 essay_metadata 注入 content.essayMetadata; 其他题型保持
    原 shape 不变 (essayMetadata 字段缺省).
    """
    content: dict[str, object] = {
        "stem": rewritten_stem,
        "options": [
            {
                "key": option.option_key,
                "text": rewritten_option_text[option.id],
            }
            for option in sorted_options
        ],
        "explanation": rewritten_explanation,
    }
    if essay_metadata is not None:
        content["essayMetadata"] = essay_metadata
    return content


def _build_practice_question_content(
    rewritten_stem: str,
    sorted_options: list[QuestionOption],
    rewritten_option_text: dict[int, str],
    *,
    essay_metadata: dict[str, Any] | None = None,
) -> dict[str, object]:
    content: dict[str, object] = {
        "stem": rewritten_stem,
        "options": [
            {
                "key": option.option_key,
                "text": rewritten_option_text[option.id],
            }
            for option in sorted_options
        ],
    }
    if essay_metadata is not None:
        content["essayMetadata"] = essay_metadata
    return content


def _score_percent(correct_count: int, total_questions: int) -> int:
    if total_questions <= 0:
        return 0
    return round(correct_count / total_questions * 100)


@dataclass
class _ImportCounters:
    """P1 review fix Phase A.3: import 时 sections × blocks × questions 嵌套
    loop 用 mutable counter dataclass 跨 helper 累加, 避免 returning 复杂 tuple
    或散落 nonlocal int.
    """
    question_position: int = 1
    block_order: int = 1
    group_order: int = 1
    question_count: int = 0


def _aggregate_wrong_groups(
    answers: list[PracticeSessionAnswer],
) -> OrderedDict[int, schemas.WrongQuestionV2]:
    """聚合答错记录为按 question_id 分组的 wrong_count 累加 dict.

    P1 review fix Phase A.1: 从 `get_history` 提取的 SRP helper.
    pure function, 不读 db, 仅依赖入参 answers (含 selectinloaded question.assets).
    """
    wrong_groups: OrderedDict[int, schemas.WrongQuestionV2] = OrderedDict()
    for item in answers:
        if item.is_correct:
            continue
        existing = wrong_groups.get(item.question_id)
        latest_selected = format_answer_summary(deserialize_answer_text(item.selected_answer))
        correct_summary = format_answer_summary(deserialize_answer_text(item.correct_answer_snapshot))
        if existing is None:
            wrong_groups[item.question_id] = schemas.WrongQuestionV2(
                question_id=item.question_id,
                question_stem=_rewrite_asset_urls(item.question.stem_text, item.question.assets),
                latest_selected_option=latest_selected,
                correct_option=correct_summary,
                wrong_count=1,
            )
        else:
            wrong_groups[item.question_id] = schemas.WrongQuestionV2(
                question_id=item.question_id,
                question_stem=existing.question_stem,
                latest_selected_option=latest_selected,
                correct_option=correct_summary,
                wrong_count=existing.wrong_count + 1,
            )
    return wrong_groups


def _build_question_json_payloads(
    question_payload: dict[str, Any],
    special_payload: dict[str, Any],
    type_payload: dict[str, Any],
    section: PaperSection,
    filename: str,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """3 个 JSON 字段 (type_payload / special_payload + section meta /
    source_payload + filename) 构造.

    v1 上线设计 (alembic 0012): 返 dict 而非 json str — 列升级到 JSONB 后 ORM
    自动序列化, 应用层永远拿 dict (CLAUDE.md 一刀切, 无 json.dumps 中间层).
    """
    type_dict = dict(type_payload)
    special_dict = {
        **special_payload,
        "sectionKey": section.section_key,
        "sectionTitle": section.title,
        "sectionInstruction": section.instruction_text,
    }
    source_dict = {
        key: value for key, value in question_payload.items() if not key.startswith("__")
    }
    source_dict["sourceFilename"] = filename
    return type_dict, special_dict, source_dict


def _extract_canonical_fields(canonical_payload: dict[str, Any]) -> dict[str, str | None]:
    """canonicalTaxonomy → 5 个 ORM 字段. Pure helper, **kwargs spread 到
    Question(...).
    """

    def _opt(key: str) -> str | None:
        return str(canonical_payload.get(key) or "").strip() or None

    return {
        "canonical_top_type": _opt("canonicalTopType"),
        "canonical_subtype": _opt("canonicalSubtype"),
        "canonical_second_subtype": _opt("canonicalSecondSubtype"),
        "raw_render_type": _opt("rawRenderType"),
        "canonical_mapping_source": _opt("mappingSource"),
    }


def _aggregate_cross_paper_subject_summaries(
    answers: list[PracticeSessionAnswer],
    question_by_id: dict[int, Question],
) -> list[schemas.PracticeSubjectSummaryV2]:
    """Cross-paper retry session 的 subject summary —— 按 question.subject
    flat 聚合, 不依赖 revision 结构."""
    from collections import defaultdict

    buckets: dict[str, dict[str, int]] = defaultdict(
        lambda: {"total": 0, "answered": 0, "correct": 0}
    )
    for ans in answers:
        q = question_by_id.get(ans.question_id)
        if q is None:
            continue
        subject = q.subject or infer_subject(q) or "未分类"
        b = buckets[subject]
        b["total"] += 1
        b["answered"] += 1
        if ans.is_correct:
            b["correct"] += 1
    return [
        schemas.PracticeSubjectSummaryV2(
            subject=subject,
            question_count=b["total"],
            answered_questions=b["answered"],
            correct_count=b["correct"],
            wrong_count=b["answered"] - b["correct"],
            accuracy_rate=(b["correct"] / b["answered"]) if b["answered"] > 0 else 0.0,
        )
        for subject, b in sorted(buckets.items())
    ]


def _collect_wrong_chip_facets(
    records: list[WrongQuestionMastery],
) -> tuple[set[str], set[str]]:
    """available_subjects / available_subtypes 给前端 chip filter UI.

    Phase D (P3 backlog): 从 list_wrong_questions 提取的 pure helper.
    """
    subjects: set[str] = set()
    subtypes: set[str] = set()
    for record in records:
        if record.question.subject:
            subjects.add(record.question.subject)
        if record.question.canonical_subtype:
            subtypes.add(record.question.canonical_subtype)
    return subjects, subtypes


def _sorted_years(years: set[int]) -> list[int]:
    return sorted(years, reverse=True)


def _empty_custom_facet_bucket() -> dict[str, Any]:
    return {"question_count": 0, "years": set(), "subtypes": {}}


def _empty_custom_subtype_bucket() -> dict[str, Any]:
    return {"question_count": 0, "years": set(), "second_subtypes": {}}


def _empty_custom_second_subtype_bucket() -> dict[str, Any]:
    return {"question_count": 0, "years": set()}


def _build_custom_practice_top_type_facets(
    top_buckets: dict[str, dict[str, Any]],
) -> list[schemas.CustomPracticeTopTypeFacetV2]:
    return [
        schemas.CustomPracticeTopTypeFacetV2(
            name=name,
            question_count=bucket["question_count"],
            years=_sorted_years(bucket["years"]),
            subtypes=_build_custom_practice_subtype_facets(bucket["subtypes"]),
        )
        for name, bucket in sorted(
            top_buckets.items(),
            key=lambda item: (-item[1]["question_count"], item[0]),
        )
    ]


def _build_custom_practice_subtype_facets(
    subtype_buckets: dict[str, dict[str, Any]],
) -> list[schemas.CustomPracticeSubtypeFacetV2]:
    return [
        schemas.CustomPracticeSubtypeFacetV2(
            name=name,
            question_count=bucket["question_count"],
            years=_sorted_years(bucket["years"]),
            second_subtypes=_build_custom_practice_second_subtype_facets(
                bucket["second_subtypes"]
            ),
        )
        for name, bucket in sorted(subtype_buckets.items())
    ]


def _build_custom_practice_second_subtype_facets(
    second_buckets: dict[str, dict[str, Any]],
) -> list[schemas.CustomPracticeSecondSubtypeFacetV2]:
    return [
        schemas.CustomPracticeSecondSubtypeFacetV2(
            name=name,
            question_count=bucket["question_count"],
            years=_sorted_years(bucket["years"]),
        )
        for name, bucket in sorted(second_buckets.items())
    ]


def _serialize_recent_attempts(
    answers: list[PracticeSessionAnswer], limit: int
) -> list[schemas.PracticeAttemptV2]:
    """最近 N 次答题序列化 (倒序 by answered_at, take limit).

    P1 review fix Phase A.1: 从 `get_history` 提取的 SRP helper.
    """
    return [
        schemas.PracticeAttemptV2(
            id=item.id,
            session_id=item.session_id,
            question_id=item.question_id,
            question_stem=_rewrite_asset_urls(item.question.stem_text, item.question.assets),
            selected_option=format_answer_summary(deserialize_answer_text(item.selected_answer)),
            correct_option=format_answer_summary(deserialize_answer_text(item.correct_answer_snapshot)),
            is_correct=item.is_correct,
            created_at=item.answered_at,
        )
        for item in answers[:limit]
    ]


def _detect_image_mime_from_bytes(path: Path) -> str | None:
    """Detect image MIME by magic-byte sniff. Returns None if unknown/unreadable.

    Why: fenbi 上游对没扩展名的资源 URL（最常见 `/api/planet/accessories/formulas?latex=...`
    公式图）fallback 命名 `.bin`。`mimetypes.guess_type(".bin")` 在 Windows 返回
    `application/octet-stream`，导致 DB `mime_type` 列脏（实际 bytes 是 PNG）。
    `<img>` context 下浏览器会 image-sniff 仍能渲染，但 admin/curl/CDN/直接 URL
    打开等非 `<img>` 链路会触发下载。这里 import 时优先按 magic header 推断，
    把 PNG/JPEG/GIF/WebP/BMP/SVG 还原成准确 MIME。
    """
    try:
        with open(path, "rb") as f:
            head = f.read(16)
    except OSError:
        return None
    if not head:
        return None
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
        return "image/gif"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"BM"):
        return "image/bmp"
    stripped = head.lstrip()
    if stripped.startswith(b"<svg"):
        return "image/svg+xml"
    if stripped.startswith(b"<?xml"):
        # `<?xml ...?>` 也可能是 RSS / SOAP / XSLT，需要看后续是否有 <svg> 根元素
        try:
            with open(path, "rb") as f:
                blob = f.read(512)
        except OSError:
            return None
        if b"<svg" in blob:
            return "image/svg+xml"
    return None


@dataclass(slots=True)
class ResolvedAsset:
    role: str
    # v1 上线设计 (alembic 0012): file_path 是 settings.assets_root 下的相对路径
    # `<paperCode>/assets/<basename>`. 物理文件已 copy 到 assets_root 下. routes
    # FileResponse 拼回 absolute. 字段名 `_json` 历史遗留 — 实际是 dict (JSONB).
    file_path: str
    mime_type: str
    metadata: dict[str, Any]
    display_order: int


class ExamPaperService:
    def __init__(self, session: Session, *, assets_root: Path | None = None) -> None:
        """assets_root: import 时把 staging 资产 copy 到的根目录, 也是 read 路径
        FileResponse 拼绝对路径用的 root. None → fallback `get_settings().assets_root`
        (生产 / dev 走 .env 默认). 测试 fixture 显式传 tmp_path 隔离.
        """
        self.session = session
        self._assets_root_override = assets_root

    @property
    def _assets_root(self) -> Path:
        if self._assets_root_override is not None:
            return self._assets_root_override
        from sikao_api.core.config import get_settings
        return get_settings().assets_root

    def list_public_papers(
        self,
        kind: Literal["essay"] | None = None,
    ) -> list[schemas.PaperSummaryV2]:
        """列 public papers, 可选 kind filter.

        Slice 2d D7: 'essay' filter 用 EXISTS subquery 选含 essay
        question 的 papers (paper 表无 paper_kind 列, 走 question.renderer_key
        marker). Slice 2b ingest 路径下申论卷 questions 全 essay, 等价于
        "全 essay 卷"; 混合卷 (含 1 道 essay 测试题) 也会被 match — 现实
        数据基本不出现.
        """
        stmt = (
            select(Paper)
            .join(Paper.current_revision)
            .where(Paper.current_revision_id.is_not(None), PaperRevision.visible_in_public.is_(True))
            .options(joinedload(Paper.current_revision))
            .order_by(PaperRevision.sort_order.desc(), Paper.paper_code.asc())
        )
        if kind == "essay":
            stmt = stmt.where(
                exists().where(
                    Question.paper_revision_id == PaperRevision.id,
                    Question.renderer_key == "essay",
                )
            )
        papers = list(self.session.scalars(stmt).unique())
        return [
            self._serialize_paper_summary(paper, paper.current_revision)
            for paper in papers
            if paper.current_revision is not None
        ]

    def list_essay_papers_paginated(
        self, *, page: int, page_size: int
    ) -> schemas.EssayPaperListResponseV2:
        """batch 5b: 申论卷分页 list, 给 GET /papers/essay/list 用.

        过滤条件复用 list_public_papers(kind='essay'): EXISTS subquery 找含
        renderer_key='essay' 题的 paper revision. 排序复用同款
        sort_order DESC + paper_code ASC. Home `/papers?kind=essay`
        slice 前 2 走老 endpoint 不影响.

        page 1-based; pageSize ∈ [1, 50] (route Query 已 422 卡, service
        同步 fail-fast 防直接调用绕开校验).
        """
        if page < 1:
            raise ValidationError("page must be >= 1")
        if page_size < 1 or page_size > 50:
            raise ValidationError("pageSize must be in [1, 50]")

        essay_filter = exists().where(
            Question.paper_revision_id == PaperRevision.id,
            Question.renderer_key == "essay",
        )

        count_stmt = (
            select(func.count(Paper.id))
            .join(Paper.current_revision)
            .where(
                Paper.current_revision_id.is_not(None),
                PaperRevision.visible_in_public.is_(True),
                essay_filter,
            )
        )
        total = self.session.scalar(count_stmt) or 0

        stmt = (
            select(Paper)
            .join(Paper.current_revision)
            .where(
                Paper.current_revision_id.is_not(None),
                PaperRevision.visible_in_public.is_(True),
                essay_filter,
            )
            .options(joinedload(Paper.current_revision))
            .order_by(PaperRevision.sort_order.desc(), Paper.paper_code.asc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
        papers = list(self.session.scalars(stmt).unique())
        items = [
            self._serialize_paper_summary(paper, paper.current_revision)
            for paper in papers
            if paper.current_revision is not None
        ]
        return schemas.EssayPaperListResponseV2(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    def get_public_paper_detail(self, paper_code: str) -> schemas.PaperDetailV2:
        paper = self._get_paper_with_current_revision(paper_code)
        revision = paper.current_revision
        if revision is None or not revision.visible_in_public:
            raise NotFoundError("paper not found")
        return schemas.PaperDetailV2(
            paper=None,
            current_revision=None,
            revision_id=revision.id,
            paper_code=paper.paper_code,
            status="published" if revision.is_published else "draft",
            question_count=revision.question_count,
        )

    def list_public_questions(self, paper_code: str) -> list[schemas.PaperQuestionItemV2]:
        paper = self._get_paper_with_current_revision(paper_code)
        revision = paper.current_revision
        if revision is None or not revision.visible_in_public:
            raise NotFoundError("paper not found")
        revision = self._load_revision_with_content(revision.id)
        return [
            self._serialize_paper_question(question, revision.paper, revision)
            for question in self._ordered_questions(revision)
        ]

    def get_public_question(self, question_id: int) -> schemas.QuestionDetailV2:
        question = self._get_question(question_id)
        revision = question.paper_revision
        paper = revision.paper
        if paper.current_revision_id != revision.id or not revision.visible_in_public:
            raise NotFoundError("question not found")
        return self._serialize_question_detail(question, paper, revision)

    def list_categories(
        self,
        user_id: int | None = None,
    ) -> schemas.CategoriesResponseV2:
        """Phase 1.1 fenbi-merge — 6 大类聚合 + 用户已做计数.

        total: distinct enabled+gradable questions per canonical_top_type
        from public papers (matches custom_practice facets visibility filter).

        done_by_user (D1):
          - paper-bound mode: 必须 session.completed_at IS NOT NULL (整卷交卷)
          - 其他 mode (custom_practice / retry_wrong / study_plan): 单题 answer
            行入库即记 (用户提交单题即记)

        user_id=None (匿名) → done_by_user 全 0.
        """
        total_stmt = (
            select(Question.canonical_top_type, func.count(Question.id))
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.is_gradable.is_(True),
                Question.canonical_top_type.is_not(None),
            )
            .group_by(Question.canonical_top_type)
        )
        totals: dict[str, int] = {
            top_type: int(count)
            for top_type, count in self.session.execute(total_stmt).all()
        }

        done_counts: dict[str, int] = {}
        if user_id is not None:
            done_stmt = (
                select(
                    Question.canonical_top_type,
                    func.count(func.distinct(Question.id)),
                )
                .join(
                    PracticeSessionAnswer,
                    PracticeSessionAnswer.question_id == Question.id,
                )
                .join(
                    PracticeSession,
                    PracticeSession.id == PracticeSessionAnswer.session_id,
                )
                .where(
                    PracticeSession.user_id == user_id,
                    Question.canonical_top_type.is_not(None),
                    or_(
                        PracticeSession.mode != MODE_PAPER,
                        PracticeSession.completed_at.is_not(None),
                    ),
                )
                .group_by(Question.canonical_top_type)
            )
            done_counts = {
                top_type: int(count)
                for top_type, count in self.session.execute(done_stmt).all()
            }

        # canonical_top_type 已是中文人类可读名 ("判断推理" / "言语理解" 等),
        # 直接复用做 display name. 排序按字母固定, 给前端可预期顺序.
        categories = [
            schemas.CategorySummaryV2(
                top_type=top_type,
                name=top_type,
                total=total,
                done_by_user=done_counts.get(top_type, 0),
            )
            for top_type, total in sorted(totals.items())
        ]
        return schemas.CategoriesResponseV2(categories=categories)

    def list_paper_user_status(
        self,
        user_id: int,
    ) -> schemas.PaperUserStatusResponseV2:
        """Phase 1.2 fenbi-merge — 卷级用户状态 overlay (D1 状态机).

        独立 endpoint, 不污染匿名 /papers 主响应. 走 paper_revision_id 关联
        而非 paper_id (paper-bound session 的 paper_revision_id 才是 source
        of truth, 见 PracticeSession.paper_revision_id 注释).

        状态机:
          done        — 至少 1 个 mode='paper' AND completed_at IS NOT NULL
          in_progress — 否则有 mode='paper' AND completed_at IS NULL
          untouched   — 否则
        attempt_count = done sessions 计数; progress 仅 in_progress 时填 (取
        最新 in-progress session 的 answered/total).
        """
        # 拉所有 public papers 的 (paper_id, paper_code, current_revision_id).
        # 必须 LEFT JOIN sessions, 即使没记录也要返回 untouched 行.
        papers_stmt = (
            select(Paper.id, Paper.paper_code, Paper.current_revision_id)
            .join(PaperRevision, Paper.current_revision_id == PaperRevision.id)
            .where(PaperRevision.visible_in_public.is_(True))
        )
        paper_rows = self.session.execute(papers_stmt).all()
        # 用户 paper-bound sessions, 按 paper_revision_id 索引.
        sessions_stmt = (
            select(
                PracticeSession.id,
                PracticeSession.paper_revision_id,
                PracticeSession.completed_at,
                PracticeSession.total_questions,
            )
            .where(
                PracticeSession.user_id == user_id,
                PracticeSession.mode == MODE_PAPER,
                PracticeSession.paper_revision_id.is_not(None),
            )
        )
        # 索引: paper_revision_id → list[(session_id, completed_at, total)]
        sessions_by_rev: dict[int, list[tuple[int, datetime | None, int]]] = {}
        for sid, rev_id, completed_at, total in self.session.execute(sessions_stmt).all():
            sessions_by_rev.setdefault(int(rev_id), []).append(
                (int(sid), completed_at, int(total))
            )

        # 第一遍走 paper_rows 算 status / 收集需查 answered count 的
        # latest_in_progress_session_ids, 然后一次 GROUP BY 查全部 answered
        # counts 避免 N+1 (用户多 paper in_progress 时退化).
        latest_in_progress: dict[str, int] = {}  # paper_code -> session_id
        in_progress_totals: dict[str, int] = {}  # paper_code -> total_questions
        prelim: list[tuple[str, str, int]] = []  # (paper_code, status, attempt_count)
        for _paper_id, paper_code, current_rev_id in paper_rows:
            sessions = (
                sessions_by_rev.get(int(current_rev_id), [])
                if current_rev_id is not None
                else []
            )
            done_sessions = [s for s in sessions if s[1] is not None]
            in_progress_sessions = [s for s in sessions if s[1] is None]
            attempt_count = len(done_sessions)
            if attempt_count > 0:
                prelim.append((paper_code, "done", attempt_count))
            elif in_progress_sessions:
                latest = max(in_progress_sessions, key=lambda s: s[0])
                latest_in_progress[paper_code] = latest[0]
                in_progress_totals[paper_code] = latest[2]
                prelim.append((paper_code, "in_progress", 0))
            else:
                prelim.append((paper_code, "untouched", 0))

        # 一次 GROUP BY 拉所有 latest in-progress session 的 answered count.
        answered_by_session: dict[int, int] = {}
        if latest_in_progress:
            session_ids = list(latest_in_progress.values())
            answered_stmt = (
                select(
                    PracticeSessionAnswer.session_id,
                    func.count(PracticeSessionAnswer.id),
                )
                .where(PracticeSessionAnswer.session_id.in_(session_ids))
                .group_by(PracticeSessionAnswer.session_id)
            )
            answered_by_session = {
                int(sid): int(count)
                for sid, count in self.session.execute(answered_stmt).all()
            }

        items: list[schemas.PaperUserStatusV2] = []
        for paper_code, status, attempt_count in prelim:
            progress: schemas.PaperProgressV2 | None = None
            if status == "in_progress":
                session_id = latest_in_progress[paper_code]
                progress = schemas.PaperProgressV2(
                    answered=answered_by_session.get(session_id, 0),
                    total=in_progress_totals[paper_code],
                )
            items.append(
                schemas.PaperUserStatusV2(
                    paper_code=paper_code,
                    user_status=status,  # type: ignore[arg-type]
                    attempt_count=attempt_count,
                    progress=progress,
                )
            )
        return schemas.PaperUserStatusResponseV2(items=items)

    def list_custom_practice_facets(
        self,
    ) -> schemas.CustomPracticeFacetsResponseV2:
        stmt = (
            select(
                Question.canonical_top_type,
                Question.canonical_subtype,
                Question.canonical_second_subtype,
                Question.exam_year,
            )
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(
                Paper.current_revision_id == PaperRevision.id,
                PaperRevision.visible_in_public.is_(True),
                Question.enabled.is_(True),
                Question.is_gradable.is_(True),
                Question.renderer_key != "essay",
                Question.canonical_top_type.is_not(None),
            )
        )
        rows = self.session.execute(stmt).all()
        top_buckets: dict[str, dict[str, Any]] = {}
        total_questions = 0
        all_years: set[int] = set()
        for row in rows:
            top_type, subtype, second_subtype, exam_year = row
            total_questions += 1
            if exam_year is not None:
                all_years.add(exam_year)
            top_bucket = top_buckets.setdefault(
                top_type, _empty_custom_facet_bucket()
            )
            top_bucket["question_count"] += 1
            if exam_year is not None:
                top_bucket["years"].add(exam_year)
            if subtype is None:
                continue
            subtype_buckets = top_bucket["subtypes"]
            subtype_bucket = subtype_buckets.setdefault(
                subtype, _empty_custom_subtype_bucket()
            )
            subtype_bucket["question_count"] += 1
            if exam_year is not None:
                subtype_bucket["years"].add(exam_year)
            if second_subtype is None:
                continue
            second_buckets = subtype_bucket["second_subtypes"]
            second_bucket = second_buckets.setdefault(
                second_subtype,
                _empty_custom_second_subtype_bucket(),
            )
            second_bucket["question_count"] += 1
            if exam_year is not None:
                second_bucket["years"].add(exam_year)
        return schemas.CustomPracticeFacetsResponseV2(
            total_questions=total_questions,
            years=_sorted_years(all_years),
            top_types=_build_custom_practice_top_type_facets(top_buckets),
        )

    def start_custom_practice_session(
        self,
        payload: schemas.CustomPracticeStartPayload,
        *,
        user: User,
    ) -> schemas.PracticeSessionStartV2:
        # P1-8: 拆 orchestrator (原 93 行) 成 5 个职责清晰的 helper, 主函数 ≤20 行.
        candidates = self._load_custom_practice_candidates(payload)
        selected = self._select_custom_practice_questions(
            candidates, question_count=payload.question_count
        )
        if len(selected) != payload.question_count:
            raise ValidationError(
                f"匹配条件下可用题数为 {len(selected)}, 不足 {payload.question_count} 题",
                code="custom_practice_not_enough_questions",
            )
        selected_ids = [question.id for question in selected]
        selected_full = self._load_full_questions_in_order(selected_ids)
        session = self._persist_custom_practice_session(
            user, selected_full=selected_full, selected_ids=selected_ids
        )
        blocks = self._build_custom_practice_blocks(selected_full)
        return self._build_custom_practice_response(session, blocks, len(selected_full))

    def _load_custom_practice_candidates(
        self, payload: schemas.CustomPracticeStartPayload
    ) -> list[Question]:
        filters: list[ColumnElement[bool]] = [
            Paper.current_revision_id == PaperRevision.id,
            PaperRevision.visible_in_public.is_(True),
            Question.enabled.is_(True),
            Question.is_gradable.is_(True),
            Question.renderer_key != "essay",
            Question.canonical_top_type == payload.top_type,
        ]
        if payload.subtype is not None:
            filters.append(Question.canonical_subtype == payload.subtype)
        if payload.second_subtype is not None:
            filters.append(Question.canonical_second_subtype == payload.second_subtype)
        if payload.years:
            filters.append(Question.exam_year.in_(payload.years))
        light_stmt = (
            select(Question)
            .join(Question.paper_revision)
            .join(PaperRevision.paper)
            .where(*filters)
            .options(
                joinedload(Question.material_group).selectinload(
                    MaterialGroup.questions
                ),
            )
            .order_by(
                Question.exam_year.desc().nullslast(), Question.id.asc()
            )
        )
        return list(self.session.scalars(light_stmt).unique())

    def _load_full_questions_in_order(
        self, selected_ids: list[int]
    ) -> list[Question]:
        full_stmt = (
            select(Question)
            .where(Question.id.in_(selected_ids))
            .options(
                joinedload(Question.options),
                selectinload(Question.assets),
                joinedload(Question.material_group).selectinload(
                    MaterialGroup.assets
                ),
                joinedload(Question.paper_revision).joinedload(
                    PaperRevision.paper
                ),
            )
        )
        full_map = {
            question.id: question
            for question in self.session.scalars(full_stmt).unique()
        }
        return [full_map[qid] for qid in selected_ids]

    def _persist_custom_practice_session(
        self,
        user: User,
        *,
        selected_full: list[Question],
        selected_ids: list[int],
    ) -> PracticeSession:
        session = PracticeSession(
            mode=MODE_CUSTOM_PRACTICE,
            user=user,
            paper=None,
            paper_revision=None,
            total_questions=len(selected_full),
            retry_question_ids_json=selected_ids,
        )
        self.session.add(session)
        self.session.flush()
        return session

    def _build_custom_practice_response(
        self,
        session: PracticeSession,
        blocks: list[schemas.PaperExamBlockOutV2],
        question_count: int,
    ) -> schemas.PracticeSessionStartV2:
        return schemas.PracticeSessionStartV2(
            sections=[
                schemas.PaperExamSectionOutV2(
                    id="__custom_practice__",
                    section_id="__custom_practice__",
                    title="专项练习",
                    instruction_text="",
                    question_count=question_count,
                    blocks=blocks,
                )
            ],
            saved_answers={},
            session_id=session.id,
            paper_code="__custom_practice__",
            paper_revision_id=None,
            paper_name="专项练习",
        )

    def _select_custom_practice_questions(
        self, candidates: list[Question], *, question_count: int
    ) -> list[Question]:
        selected: list[Question] = []
        selected_group_ids: set[int] = set()
        for question in candidates:
            if question.material_group is not None:
                if question.material_group.id in selected_group_ids:
                    continue
                group_questions = [
                    group_question
                    for group_question in sorted(
                        question.material_group.questions,
                        key=lambda item: item.position,
                    )
                    if group_question in candidates
                ]
                if len(selected) + len(group_questions) > question_count:
                    continue
                selected.extend(group_questions)
                selected_group_ids.add(question.material_group.id)
            else:
                selected.append(question)
            if len(selected) == question_count:
                break
        return selected

    def _build_custom_practice_blocks(
        self, questions: list[Question]
    ) -> list[schemas.PaperExamBlockOutV2]:
        blocks: list[schemas.PaperExamBlockOutV2] = []
        emitted_group_ids: set[int] = set()
        selected_question_ids = {question.id for question in questions}
        for question in questions:
            if question.material_group is not None:
                group = question.material_group
                if group.id in emitted_group_ids:
                    continue
                group_questions = [
                    item
                    for item in sorted(
                        group.questions,
                        key=lambda group_question: group_question.position,
                    )
                    if item.id in selected_question_ids
                ]
                blocks.append(
                    schemas.PaperExamBlockOutV2(
                        type="material_group",
                        section_id="__custom_practice__",
                        material_group_id=group.id,
                        question_ids=[item.id for item in group_questions],
                        block_id=group.block_id,
                        material_group=self._serialize_custom_material_group(
                            group,
                            group_questions=group_questions,
                            paper=question.paper_revision.paper,
                            revision=question.paper_revision,
                        ),
                    )
                )
                emitted_group_ids.add(group.id)
                continue
            blocks.append(
                schemas.PaperExamBlockOutV2(
                    type="question",
                    section_id="__custom_practice__",
                    question_id=question.id,
                    question_ids=[question.id],
                    block_id=question.id,
                    question=self._serialize_practice_question(
                        question,
                        question.paper_revision.paper,
                        question.paper_revision,
                    ),
                )
            )
        return blocks

    def _serialize_custom_material_group(
        self,
        material_group: MaterialGroup,
        *,
        group_questions: list[Question],
        paper: Paper,
        revision: PaperRevision,
    ) -> schemas.MaterialGroupOutV2:
        material_group_out = self._serialize_material_group(
            material_group, paper=paper, revision=revision
        )
        material_group_out.question_ids = [question.id for question in group_questions]
        material_group_out.questions = [
            self._serialize_practice_question(question, paper, revision)
            for question in group_questions
        ]
        return material_group_out

    def list_admin_papers(self) -> list[schemas.AdminPaperSummaryV2]:
        stmt = (
            select(Paper)
            .options(
                joinedload(Paper.current_revision),
                selectinload(Paper.revisions),
            )
            .order_by(Paper.updated_at.desc(), Paper.paper_code.asc())
        )
        papers = list(self.session.scalars(stmt).unique())
        return [self._serialize_admin_paper_summary(paper) for paper in papers]

    def list_paper_revisions(self, paper_code: str) -> list[schemas.PaperRevisionSummary]:
        paper = self._get_paper_with_revisions(paper_code)
        return [self._serialize_revision_summary(revision) for revision in self._ordered_revisions(paper)]

    def publish_revision(
        self,
        paper_code: str,
        revision_id: int,
        *,
        released_by: str,
        release_execution_id: str | None = None,
        release_note: str = "",
    ) -> schemas.PaperDetailV2:
        paper = self._get_paper_with_revisions(paper_code)
        target = next((revision for revision in paper.revisions if revision.id == revision_id), None)
        if target is None:
            raise NotFoundError("revision not found")

        switched = paper.current_revision_id != target.id
        now = utc_now()
        for revision in paper.revisions:
            revision.is_published = revision.id == target.id
            if revision.id != target.id:
                revision.published_at = None
        paper.current_revision = target
        target.published_at = now

        should_write_audit = switched or not target.release_audits
        if release_execution_id:
            should_write_audit = not any(
                audit.release_execution_id == release_execution_id
                for audit in target.release_audits
            )
        if should_write_audit:
            self.session.add(
                ReleaseAudit(
                    revision=target,
                    released_by=released_by,
                    release_note=release_note,
                    release_execution_id=release_execution_id,
                )
            )

        self.session.flush()
        return schemas.PaperDetailV2(
            paper=self._serialize_paper_summary(paper, target),
            current_revision=self._serialize_revision_summary(target),
        )

    def list_admin_questions(
        self,
        *,
        paper_code: str | None = None,
        revision_id: int | None = None,
        keyword: str | None = None,
    ) -> list[schemas.QuestionListItemV2]:
        stmt = (
            select(Question)
            .options(
                joinedload(Question.paper_revision).joinedload(PaperRevision.paper),
                selectinload(Question.tags),
            )
            .order_by(Question.position.asc(), Question.id.asc())
        )
        if paper_code:
            stmt = (
                stmt.join(Question.paper_revision)
                .join(PaperRevision.paper)
                .where(Paper.paper_code == paper_code.strip().upper())
            )
        if revision_id is not None:
            stmt = stmt.where(Question.paper_revision_id == revision_id)
        if keyword:
            stmt = stmt.where(Question.stem_text.ilike(f"%{keyword.strip()}%"))
        questions = list(self.session.scalars(stmt).unique())
        return [
            self._serialize_question_list_item(
                question,
                question.paper_revision.paper,
                question.paper_revision,
            )
            for question in questions
        ]

    def get_admin_question(self, question_id: int) -> schemas.AdminQuestionDetailV2:
        question = self._get_question(question_id)
        revision = question.paper_revision
        return self._serialize_admin_question_detail(question, revision.paper, revision)

    def list_import_jobs(self) -> list[schemas.ImportJobSummary]:
        stmt = (
            select(ImportJob)
            .options(selectinload(ImportJob.items))
            .order_by(ImportJob.created_at.desc(), ImportJob.id.desc())
        )
        jobs = list(self.session.scalars(stmt).unique())
        return [self._serialize_import_job(job) for job in jobs]

    def get_import_job(self, job_id: int) -> schemas.ImportJobSummary:
        stmt = select(ImportJob).where(ImportJob.id == job_id).options(selectinload(ImportJob.items))
        job = self.session.scalar(stmt)
        if job is None:
            raise NotFoundError("import job not found")
        return self._serialize_import_job(job)

    def import_standard_json_files(
        self,
        *,
        files: list[tuple[str, bytes]],
        base_dir: Path,
        source_name: str = "standard-json-upload",
        created_by: str | None = None,
    ) -> schemas.ImportJobSummary:
        # Phase D (P3 backlog): 拆 _create_import_job_record /
        # _import_one_file_into_job / _finalize_import_job 三 helper.
        if not files:
            raise ValidationError("no files uploaded")
        job = self._create_import_job_record(files, source_name, created_by)
        for raw_filename, content in files:
            self._import_one_file_into_job(job, raw_filename, content, base_dir)
        self._finalize_import_job(job)
        return self._serialize_import_job(job)

    def _create_import_job_record(
        self,
        files: list[tuple[str, bytes]],
        source_name: str,
        created_by: str | None,
    ) -> ImportJob:
        job = ImportJob(
            source_name=source_name,
            status="completed",
            total_files=len(files),
            created_by=created_by,
            source_filename=files[0][0] if len(files) == 1 else None,
            started_at=utc_now(),
        )
        self.session.add(job)
        self.session.flush()
        return job

    def _import_one_file_into_job(
        self,
        job: ImportJob,
        raw_filename: str,
        content: bytes,
        base_dir: Path,
    ) -> None:
        """Import single file into a savepoint; fail isolates to that item."""
        normalized_filename = self._normalize_upload_filename(raw_filename)
        file_base_dir = self._resolve_upload_base_dir(base_dir, normalized_filename)
        item = ImportJobItem(
            import_job=job,
            filename=normalized_filename,
            status="failed",
            error_message="",
        )
        self.session.add(item)
        self.session.flush()
        try:
            with self.session.begin_nested():
                revision = self._import_single_payload(
                    filename=normalized_filename,
                    content=content,
                    base_dir=file_base_dir,
                )
                item.paper_code = revision.paper.paper_code
                item.paper_name = revision.paper_name
                item.revision_id = revision.id
                item.revision_number = revision.revision_number
                item.status = "completed"
                item.imported_question_count = revision.question_count
                item.source_hash = revision.source_hash
                item.error_message = ""
        except Exception as exc:
            item.status = "failed"
            item.error_message = str(exc)
        self.session.flush()

    def _finalize_import_job(self, job: ImportJob) -> None:
        """Aggregate per-item counters back onto the parent job + set final status."""
        completed_items = [item for item in job.items if item.status == "completed"]
        failed_items = [item for item in job.items if item.status == "failed"]
        job.imported_files = len(completed_items)
        job.failed_files = len(failed_items)
        job.imported_papers = len(
            {item.paper_code for item in completed_items if item.paper_code}
        )
        job.imported_questions = sum(item.imported_question_count for item in completed_items)
        job.status = (
            "failed" if not completed_items else "partial" if failed_items else "completed"
        )
        job.completed_at = utc_now()
        self.session.flush()

    def start_paper_session(self, paper_code: str, *, user: User | None) -> schemas.PracticeSessionStartV2:
        owner = user or self._get_or_create_guest_user()
        paper = self._get_paper_with_current_revision(paper_code)
        revision = paper.current_revision
        if revision is None or not revision.visible_in_public:
            raise NotFoundError("paper not found")
        if not revision.is_gradable:
            raise ConflictError("paper is not gradable", code="paper_not_gradable")

        revision = self._load_revision_with_content(revision.id)
        session = PracticeSession(
            mode=MODE_PAPER,
            user=owner,
            paper=paper,
            paper_revision=revision,
            total_questions=revision.question_count,
        )
        self.session.add(session)
        self.session.flush()

        _paper_summary, sections, _blocks, _questions, _material_groups = self._build_blueprint(revision)
        return schemas.PracticeSessionStartV2(
            session=None,
            paper=None,
            sections=sections,
            blocks=None,
            questions=None,
            material_groups=None,
            saved_answers={},
            session_id=session.id,
            paper_code=paper.paper_code,
            paper_revision_id=revision.id,
            paper_name=revision.paper_name,
        )

    def submit_session_answer(
        self,
        session_id: int,
        payload: schemas.PracticeSessionAnswerSubmissionV2,
        *,
        user: User | None,
    ) -> schemas.PracticeSessionAnswerResultV2:
        session = self._get_practice_session(session_id, user=user)
        question = self._get_question(payload.question_id)
        # 独立 review KEY OBS #1 修: dispatch 读 mode 字段, 不读 in-band
        # paper_revision_id NULL marker. mode 是 source of truth.
        if session.mode in _CROSS_PAPER_MODES:
            if user is None:
                raise ValidationError("anonymous cannot use cross-paper retry session")
            self._validate_question_in_cross_paper_batch(session, question.id)
        elif question.paper_revision_id != session.paper_revision_id:
            raise ValidationError("question does not belong to this paper revision")

        selected_answer_keys = normalize_answer_keys(payload.selected_answer_keys)
        self._validate_selected_answer_keys(question, selected_answer_keys, allow_empty=True)
        answer = self._upsert_session_answer(
            session=session,
            question=question,
            selected_answer_keys=selected_answer_keys,
        )
        # Phase 5.4b: mastery hook —— 仅对显式登录的 user 维护错题本。
        # 匿名 session（user is None）跳过，避免 guest 累计无意义数据。
        if answer is not None and user is not None:
            update_mastery(
                self.session,
                user_id=user.id,
                question_id=question.id,
                is_correct=answer.is_correct,
                answered_at=answer.answered_at,
            )
        answered_questions = self._answered_question_count(session.id)
        session.completed_at = utc_now() if answered_questions >= session.total_questions else None
        self.session.flush()

        return schemas.PracticeSessionAnswerResultV2(
            session_id=session.id,
            question_id=question.id,
            display_order=answer.display_order if answer is not None else question.position,
            selected_answer_keys=selected_answer_keys,
            answered_questions=answered_questions,
            total_questions=session.total_questions,
            completed=session.completed_at is not None,
        )

    def complete_session(
        self,
        session_id: int,
        *,
        user: User | None,
        payload: schemas.CompleteSessionPayloadV2 | None = None,
    ) -> None:
        session = self._get_practice_session(session_id, user=user)
        if payload is not None:
            for raw_question_id, selected_answer_keys in payload.answers.items():
                try:
                    question_id = int(raw_question_id)
                except (TypeError, ValueError) as exc:
                    raise ValidationError(f"invalid question id: {raw_question_id}") from exc
                question = self._get_question(question_id)
                # 独立 review KEY OBS #1 修: dispatch 读 mode 字段.
                if session.mode in _CROSS_PAPER_MODES:
                    if user is None:
                        raise ValidationError("anonymous cannot use cross-paper retry session")
                    self._validate_question_in_cross_paper_batch(session, question.id)
                elif question.paper_revision_id != session.paper_revision_id:
                    raise ValidationError("question does not belong to this paper revision")
                normalized_answer_keys = normalize_answer_keys(selected_answer_keys)
                self._validate_selected_answer_keys(question, normalized_answer_keys, allow_empty=True)
                answer = self._upsert_session_answer(
                    session=session, question=question, selected_answer_keys=normalized_answer_keys
                )
                # Phase 5.4b: 同 submit_session_answer —— 仅对登录 user 更新 mastery。
                if answer is not None and user is not None:
                    update_mastery(
                        self.session,
                        user_id=user.id,
                        question_id=question.id,
                        is_correct=answer.is_correct,
                        answered_at=answer.answered_at,
                    )
        session.completed_at = utc_now()
        self.session.flush()

    def get_session_result(self, session_id: int, *, user: User | None) -> schemas.PracticeSessionResultV2:
        # Single combined query: pulls session + answers + the full revision
        # content graph (sections/blocks/material_groups/questions with their
        # options/assets/tags/release_audits) in one round-trip. Previously
        # split into `_get_practice_session` + `_load_revision_with_content`
        # which issued ~12 SQLs on a 50Q paper; consolidating keeps it flat
        # regardless of question count. Correctness quirks: `session.answers`
        # and `revision.questions` share `Question` rows via SQLAlchemy's
        # identity map, so both paths resolve to the same Python objects
        # (no double-fetch of options/assets).
        session = self._get_session_with_revision_content(session_id, user=user)
        # 独立 review KEY OBS #1 修: dispatch 读 mode 字段 (而非 paper_revision_id
        # NULL in-band marker).
        if session.mode in _CROSS_PAPER_MODES:
            return self._get_cross_paper_session_result(session)
        return self._get_paper_bound_session_result(session)

    def _get_paper_bound_session_result(
        self, session: PracticeSession
    ) -> schemas.PracticeSessionResultV2:
        """老路径: session 绑单 revision, 完整 section/subject/subtype summaries."""
        answers = sorted(session.answers, key=lambda item: (item.display_order, item.id))
        correct_count = sum(1 for item in answers if item.is_correct)
        incorrect_count = len(answers) - correct_count
        unanswered_count = max(session.total_questions - len(answers), 0)

        revision = session.paper_revision
        if revision is None:
            # Fail-fast: paper_revision_id non-null 但 revision 加载不出来 — DB
            # invariant violation, 非 graceful-degradation territory.
            raise NotFoundError("revision not found for session")
        paper = revision.paper
        questions = [
            self._serialize_paper_question(question, paper, revision)
            for question in self._ordered_questions(revision)
        ]
        answer_outs = [
            schemas.PracticeSessionAnswerOutV2(
                id=item.id,
                question_id=item.question_id,
                selected_answer_keys=deserialize_answer_text(item.selected_answer),
                correct_answer_keys=deserialize_answer_text(item.correct_answer_snapshot),
                is_correct=item.is_correct,
                answered_at=item.answered_at,
                wrong_reason_code=item.wrong_reason_code,
                wrong_reason_source=item.wrong_reason_source,
            )
            for item in answers
        ]

        return schemas.PracticeSessionResultV2(
            session=self._serialize_session_summary(session),
            section_summaries=self._build_section_summaries(revision, answers),
            subject_summaries=self._build_subject_summaries(revision, answers),
            subtype_summaries=self._build_subtype_summaries(revision, answers),
            blocks=None,
            questions=questions,
            material_groups=None,
            answers=answer_outs,
            session_id=session.id,
            score=_score_percent(correct_count, session.total_questions),
            total_questions=session.total_questions,
            correct_count=correct_count,
            incorrect_count=incorrect_count,
            unanswered_count=unanswered_count,
            user_answers={str(item.question_id): deserialize_answer_text(item.selected_answer) for item in answers},
        )

    def _get_cross_paper_session_result(
        self, session: PracticeSession
    ) -> schemas.PracticeSessionResultV2:
        """跨 paper retry session: 没单一 revision, 题目从 PracticeSessionAnswer
        反查每题各自 revision. section_summaries 留空 (跨 revision 无意义),
        subject_summaries / subtype_summaries 仍可按 question.subject 聚合.
        """
        answers = sorted(session.answers, key=lambda item: (item.display_order, item.id))
        correct_count = sum(1 for item in answers if item.is_correct)
        incorrect_count = len(answers) - correct_count
        unanswered_count = max(session.total_questions - len(answers), 0)

        question_ids = [a.question_id for a in answers]
        question_rows = list(
            self.session.scalars(
                select(Question)
                .where(Question.id.in_(question_ids))
                .options(
                    joinedload(Question.options),
                    selectinload(Question.assets),
                    joinedload(Question.paper_revision).joinedload(PaperRevision.paper),
                )
            ).unique()
        )
        question_by_id = {q.id: q for q in question_rows}
        questions = [
            self._serialize_paper_question(
                question_by_id[a.question_id],
                question_by_id[a.question_id].paper_revision.paper,
                question_by_id[a.question_id].paper_revision,
            )
            for a in answers
            if a.question_id in question_by_id
        ]
        answer_outs = [
            schemas.PracticeSessionAnswerOutV2(
                id=item.id,
                question_id=item.question_id,
                selected_answer_keys=deserialize_answer_text(item.selected_answer),
                correct_answer_keys=deserialize_answer_text(item.correct_answer_snapshot),
                is_correct=item.is_correct,
                answered_at=item.answered_at,
                wrong_reason_code=item.wrong_reason_code,
                wrong_reason_source=item.wrong_reason_source,
            )
            for item in answers
        ]

        # cross-paper subject/subtype summaries — 按 question 反查 (build_subject_
        # summaries 当前签名 takes revision; 不复用, 写 inline 临时聚合).
        subject_summaries = _aggregate_cross_paper_subject_summaries(
            answers, question_by_id
        )

        return schemas.PracticeSessionResultV2(
            session=self._serialize_session_summary(session),
            section_summaries=[],  # 跨 paper 没 section 概念
            subject_summaries=subject_summaries,
            subtype_summaries=[],  # 留空 — subtype 聚合需要每题 canonical_subtype 反查, 先省
            blocks=None,
            questions=questions,
            material_groups=None,
            answers=answer_outs,
            session_id=session.id,
            score=_score_percent(correct_count, session.total_questions),
            total_questions=session.total_questions,
            correct_count=correct_count,
            incorrect_count=incorrect_count,
            unanswered_count=unanswered_count,
            user_answers={
                str(item.question_id): deserialize_answer_text(item.selected_answer)
                for item in answers
            },
        )

    @staticmethod
    def _resolve_subject(question: Question) -> str | None:
        """Return Question.subject, falling back to infer rule when DB is NULL.

        Covers the Phase 5.4a window where new imports land with subject=NULL
        until backfill runs (model.py §261). Aggregation must work either way,
        so we infer in-process — same rule as the standalone backfill script.
        """
        if question.subject:
            return question.subject
        return infer_subject(question)

    def _build_subject_summaries(
        self,
        revision: PaperRevision,
        answers: list[PracticeSessionAnswer],
    ) -> list[schemas.PracticeSubjectSummaryV2]:
        """Group questions + answers by Question.subject (resolved with fallback).

        Single pass over revision.questions to bucket by subject, second pass
        over answers to count answered/correct. Mirrors _build_section_summaries
        shape so the consumer pattern is consistent. Sorted by question_count
        desc so the most-tested subject is first (UI shows a 强项/需巩固
        ranking).
        """
        subject_by_qid: dict[int, str | None] = {q.id: self._resolve_subject(q) for q in revision.questions}
        counts: dict[str, dict[str, int]] = {}
        for q in revision.questions:
            subject = subject_by_qid[q.id]
            if subject is None:
                continue
            counts.setdefault(subject, {"q": 0, "ans": 0, "correct": 0})["q"] += 1
        for ans in answers:
            subject = subject_by_qid.get(ans.question_id)
            if subject is None:
                continue
            counts[subject]["ans"] += 1
            if ans.is_correct:
                counts[subject]["correct"] += 1
        summaries: list[schemas.PracticeSubjectSummaryV2] = []
        for subject, c in sorted(counts.items(), key=lambda kv: -kv[1]["q"]):
            accuracy = round(c["correct"] / c["ans"] * 100, 1) if c["ans"] else 0.0
            summaries.append(
                schemas.PracticeSubjectSummaryV2(
                    subject=subject,
                    question_count=c["q"],
                    answered_questions=c["ans"],
                    correct_count=c["correct"],
                    wrong_count=c["ans"] - c["correct"],
                    accuracy_rate=accuracy,
                )
            )
        return summaries

    def _build_subtype_summaries(
        self,
        revision: PaperRevision,
        answers: list[PracticeSessionAnswer],
    ) -> list[schemas.PracticeSubtypeSummaryV2]:
        """Group by Question.canonical_subtype, also expose the parent subject
        so the frontend can filter subtypes by subject. NULL subtypes are
        skipped entirely (the frontend has no use for an "unknown" bucket).
        """
        subject_by_qid: dict[int, str | None] = {q.id: self._resolve_subject(q) for q in revision.questions}
        subtype_by_qid: dict[int, str | None] = {q.id: q.canonical_subtype for q in revision.questions}
        counts: dict[str, dict[str, Any]] = {}
        for q in revision.questions:
            subtype = subtype_by_qid[q.id]
            if not subtype:
                continue
            bucket = counts.setdefault(
                subtype,
                {"q": 0, "ans": 0, "correct": 0, "subject": subject_by_qid[q.id]},
            )
            bucket["q"] += 1
        for ans in answers:
            subtype = subtype_by_qid.get(ans.question_id)
            if not subtype:
                continue
            counts[subtype]["ans"] += 1
            if ans.is_correct:
                counts[subtype]["correct"] += 1
        summaries: list[schemas.PracticeSubtypeSummaryV2] = []
        for subtype, c in sorted(counts.items(), key=lambda kv: -kv[1]["q"]):
            accuracy = round(c["correct"] / c["ans"] * 100, 1) if c["ans"] else 0.0
            summaries.append(
                schemas.PracticeSubtypeSummaryV2(
                    subject=c["subject"],
                    subtype=subtype,
                    question_count=c["q"],
                    answered_questions=c["ans"],
                    correct_count=c["correct"],
                    wrong_count=c["ans"] - c["correct"],
                    accuracy_rate=accuracy,
                )
            )
        return summaries

    def _build_section_summaries(
        self,
        revision: PaperRevision,
        answers: list[PracticeSessionAnswer],
    ) -> list[schemas.PracticeSectionSummaryV2]:
        sections = self._ordered_sections(revision)
        question_section_ids = {question.id: question.section_id for question in revision.questions}
        answered_by_section: dict[int, int] = {section.id: 0 for section in sections}
        correct_by_section: dict[int, int] = {section.id: 0 for section in sections}
        for answer in answers:
            section_id = question_section_ids.get(answer.question_id)
            if section_id is None:
                continue
            answered_by_section[section_id] = answered_by_section.get(section_id, 0) + 1
            if answer.is_correct:
                correct_by_section[section_id] = correct_by_section.get(section_id, 0) + 1

        summaries: list[schemas.PracticeSectionSummaryV2] = []
        for section in sections:
            answered = answered_by_section.get(section.id, 0)
            correct = correct_by_section.get(section.id, 0)
            accuracy_rate = round((correct / answered * 100), 1) if answered else 0.0
            summaries.append(
                schemas.PracticeSectionSummaryV2(
                    section_id=section.section_key,
                    title=section.title,
                    instruction_text=section.instruction_text,
                    question_count=section.question_count,
                    answered_questions=answered,
                    correct_count=correct,
                    wrong_count=answered - correct,
                    accuracy_rate=accuracy_rate,
                )
            )
        return summaries

    def get_history(self, *, user: User) -> schemas.PracticeHistoryResponseV2:
        # P1 review fix Phase A.1: 拆 _aggregate_wrong_groups /
        # _serialize_recent_attempts / _serialize_recent_sessions 三 SRP helper.
        all_answers = self._fetch_user_answers(user_id=user.id)
        correct_count = sum(1 for item in all_answers if item.is_correct)
        wrong_count = len(all_answers) - correct_count
        accuracy_rate = round((correct_count / len(all_answers) * 100), 1) if all_answers else 0.0
        wrong_groups = _aggregate_wrong_groups(all_answers)
        recent_attempts = _serialize_recent_attempts(all_answers, RECENT_ATTEMPTS_LIMIT)
        recent_sessions = self._serialize_recent_sessions(user_id=user.id)
        return schemas.PracticeHistoryResponseV2(
            summary=schemas.PracticeSummaryV2(
                total_attempts=len(all_answers),
                correct_count=correct_count,
                wrong_count=wrong_count,
                accuracy_rate=accuracy_rate,
            ),
            recent_attempts_limit=RECENT_ATTEMPTS_LIMIT,
            recent_sessions_limit=RECENT_SESSIONS_LIMIT,
            recent_attempts=recent_attempts,
            wrong_questions=sorted(wrong_groups.values(), key=lambda item: item.wrong_count, reverse=True),
            recent_sessions=recent_sessions,
        )

    def _fetch_user_answers(self, *, user_id: int) -> list[PracticeSessionAnswer]:
        """N+1 防护: selectinload(Question.assets) 是 _rewrite_asset_urls 的硬依赖."""
        answer_stmt = (
            select(PracticeSessionAnswer)
            .join(PracticeSessionAnswer.session)
            .where(PracticeSession.user_id == user_id)
            .options(
                joinedload(PracticeSessionAnswer.question).selectinload(Question.assets),
                joinedload(PracticeSessionAnswer.session).joinedload(PracticeSession.paper),
            )
            .order_by(PracticeSessionAnswer.answered_at.desc(), PracticeSessionAnswer.id.desc())
        )
        return list(self.session.scalars(answer_stmt).unique())

    def _serialize_recent_sessions(self, *, user_id: int) -> list[schemas.PracticeSessionSummaryV2]:
        session_stmt = (
            select(PracticeSession)
            .where(PracticeSession.user_id == user_id, PracticeSession.answers.any())
            .options(
                joinedload(PracticeSession.paper),
                joinedload(PracticeSession.user),
                selectinload(PracticeSession.answers),
            )
            .order_by(PracticeSession.started_at.desc(), PracticeSession.id.desc())
            .limit(RECENT_SESSIONS_LIMIT)
        )
        return [self._serialize_session_summary(item) for item in self.session.scalars(session_stmt).unique()]

    # ── Phase 5.4b：错题本 + 重做 ────────────────────────────────────────────

    def list_wrong_questions(
        self,
        *,
        user: User,
        mastery_level: str | None = None,
        subject: str | None = None,
        subtype: str | None = None,
        paper_code: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> schemas.WrongQuestionListResponseV2:
        # Phase D (P3 backlog): 拆 query / paginate / chip 三 helper.
        if page < 1 or page_size < 1 or page_size > 100:
            raise ValidationError("invalid pagination")
        all_records = self._query_wrong_question_records(
            user_id=user.id,
            mastery_level=mastery_level,
            subject=subject,
            subtype=subtype,
            paper_code=paper_code,
        )
        start_idx = (page - 1) * page_size
        page_records = all_records[start_idx : start_idx + page_size]
        # B.2 修订: facets 从 "subject+mastery 过滤后, subtype 未过滤" 的集合算 ——
        # 否则 user 选了一个 subtype 后 availableSubtypes 会折叠到只剩选中那
        # 一个 chip, UI 看不到其他可切换选项. subjects 同理 (但当前 UI 不让
        # 跨 subject, subjects 影响小, 一并处理保持对称).
        # 规范官 P0-1 (2026-05-08): facets 仍按 subtype=None 算, 让 chip 可
        # 切换; paper_code filter 不影响 chip 集合 (paper-bound mode 视觉上
        # 独立, paper_code 持续生效到用户主动 ×).
        if subtype is None:
            facet_records = all_records
        else:
            facet_records = self._query_wrong_question_records(
                user_id=user.id,
                mastery_level=mastery_level,
                subject=subject,
                subtype=None,
                paper_code=paper_code,
            )
        subjects, subtypes = _collect_wrong_chip_facets(facet_records)
        items = [self._serialize_wrong_question_detail(record, user.id) for record in page_records]
        return schemas.WrongQuestionListResponseV2(
            items=items,
            total=len(all_records),
            page=page,
            page_size=page_size,
            available_subjects=sorted(subjects),
            available_subtypes=sorted(subtypes),
        )

    def _query_wrong_question_records(
        self,
        *,
        user_id: int,
        mastery_level: str | None,
        subject: str | None,
        subtype: str | None,
        paper_code: str | None = None,
    ) -> list[WrongQuestionMastery]:
        """Build + execute the wrong-mastery query with optional filters.

        N+1 防护: selectinload(Question.assets) 是 _rewrite_asset_urls 的硬依赖.

        paper_code (规范官 P0-1, 2026-05-08): server-side filter via Question
        → PaperRevision → Paper.paper_code. frontend WrongBook "本套错题"
        mode 走此参数, 解决 client-side filter 跨页丢失的 silently wrong 数据.
        Question 表本身无 paper_code, 通过 paper_revision_id 联到 Paper.
        """
        stmt = (
            select(WrongQuestionMastery)
            .join(Question, WrongQuestionMastery.question_id == Question.id)
            .where(WrongQuestionMastery.user_id == user_id)
            .options(
                joinedload(WrongQuestionMastery.question).joinedload(Question.options),
                joinedload(WrongQuestionMastery.question).selectinload(Question.assets),
                joinedload(WrongQuestionMastery.question)
                .joinedload(Question.paper_revision)
                .joinedload(PaperRevision.paper),
            )
            .order_by(
                WrongQuestionMastery.last_wrong_time.desc(),
                WrongQuestionMastery.id.desc(),
            )
        )
        if mastery_level is not None:
            stmt = stmt.where(WrongQuestionMastery.mastery_level == mastery_level)
        if subject is not None:
            stmt = stmt.where(Question.subject == subject)
        # Phase 6.4 P2 — subtype filter for AiSuggestionCard CTA / KP focus rows.
        if subtype is not None:
            stmt = stmt.where(Question.canonical_subtype == subtype)
        if paper_code is not None:
            # WrongQuestionMastery → Question → PaperRevision → Paper. join 是
            # explicit (避免依赖 joinedload 的 implicit join 状态).
            stmt = (
                stmt.join(PaperRevision, Question.paper_revision_id == PaperRevision.id)
                .join(Paper, PaperRevision.paper_id == Paper.id)
                .where(Paper.paper_code == paper_code)
            )
        return list(self.session.scalars(stmt).unique())

    def start_retry_wrong_batch(
        self, question_ids: list[int], *, user: User
    ) -> schemas.PracticeSessionStartV2:
        """创建一个 mode=retry_wrong 的 session, 含 N 个目标错题.

        ARCH §7.2 Pages P2 (2026-04-28) 解除 "同一 paper" 限制.

        Two paths by question 跨 revision 数:
          - 单 revision (≥99% 用户场景): 走老路, session.paper_revision_id 绑
            该 revision, 完整 blueprint 过滤 (材料组联动等).
          - 多 revision (跨 paper batch retry): session.paper_revision_id NULL
            (cross-paper marker). 合成单 section blueprint, 顺序 by paper_code +
            position. submit/complete/result 路径 dispatch on paper_revision_id
            is None.
        """
        unique_ids = self._validate_retry_batch_input(question_ids)
        self._validate_questions_in_wrong_book(unique_ids, user_id=user.id)
        questions = list(
            self.session.scalars(
                select(Question)
                .where(Question.id.in_(unique_ids))
                .options(
                    joinedload(Question.options),
                    selectinload(Question.assets),
                    joinedload(Question.paper_revision).joinedload(PaperRevision.paper),
                )
            ).unique()
        )
        revision_ids = {q.paper_revision_id for q in questions}
        if len(revision_ids) == 1:
            return self._start_retry_single_revision(unique_ids, user, mode=MODE_RETRY_WRONG)
        return self._start_retry_cross_paper(questions, user)

    def _start_retry_single_revision(
        self, unique_ids: list[int], user: User, *, mode: str = MODE_RETRY_WRONG
    ) -> schemas.PracticeSessionStartV2:
        """单 revision retry — 老路径. mode 默认 MODE_RETRY_WRONG, study_plan 入口传 MODE_STUDY_PLAN."""
        revision = self._validate_single_revision_for_questions(unique_ids)
        target_qid_set = set(unique_ids)
        session = self._create_retry_session_record(
            user=user, revision=revision, total_questions=len(unique_ids), mode=mode
        )
        filtered_sections, actual_total = self._filter_blueprint_for_questions(
            revision, target_qid_set
        )
        if actual_total != session.total_questions:
            session.total_questions = actual_total
            self.session.flush()
        return self._build_retry_session_response(session, revision, filtered_sections)

    def _start_retry_cross_paper(
        self,
        questions: list[Question],
        user: User,
        *,
        mode: str = MODE_RETRY_WRONG_CROSS_PAPER,
    ) -> schemas.PracticeSessionStartV2:
        """跨 revision retry — 合成单 section blueprint, session 不绑 paper.

        排序: paper_code asc → position asc, 让 user 看到的题序按试卷分组.
        Material group 不带 — cross-paper 不联动材料 (UX 复杂度爆炸, 后续可加).

        B-review B2 修: 含 material_group 的题 (资料分析/阅读理解) 在 cross-
        paper 路径下读不到原文, 用户答不了. 先 fail-fast 让用户分套复习,
        而不是给一个看似可用但缺材料的 session.

        独立 review KEY OBS #1 修: session.mode = MODE_RETRY_WRONG_CROSS_PAPER
        显式 (而非 mode='retry_wrong' + paper_revision_id NULL 的 in-band
        marker). dispatch 改读 mode 字段, 减脆性: 误把 paper_revision_id 设
        NULL 不再静默走 cross-paper 路径.
        """
        material_bound = [q for q in questions if q.material_group_id is not None]
        if material_bound:
            mids = sorted({q.id for q in material_bound})
            raise ValidationError(
                f"跨试卷批量复习暂不支持含材料题 (资料分析 / 阅读理解), "
                f"题目 {mids[:5]} 需单独按试卷复习",
                code="cross_paper_material_unsupported",
            )
        sorted_questions = sorted(
            questions,
            key=lambda q: (q.paper_revision.paper.paper_code, q.position),
        )
        # B-review B4 修: 持久化 batch question_ids 给 submit 守门.
        # B-review B-R3 修: 保 sorted_questions 顺序 (paper_code asc → position asc),
        # 让 _cross_paper_synthetic_position 算出来的 paper_position 跟 blueprint
        # 显示顺序一致 (result page 不错乱).
        # 直接 list comprehension 不用 set, 已 dedupe via _validate_retry_batch_input.
        batch_qids = [q.id for q in sorted_questions]
        session = PracticeSession(
            mode=mode,
            user=user,
            paper=None,
            paper_revision=None,
            total_questions=len(sorted_questions),
            retry_question_ids_json=batch_qids,
        )
        self.session.add(session)
        self.session.flush()

        # 合成 single section: 题目按 paper+position 已排序, 直接 wrap.
        # PaperExamSectionOutV2.id 是 str (section_key 风格), section_id 同源.
        # 用 "__cross_paper_retry__" 当 synthetic key.
        cross_section_key = "__cross_paper_retry__"
        synthetic_blocks = [
            schemas.PaperExamBlockOutV2(
                type="question",
                section_id=cross_section_key,
                question_id=q.id,
                question_ids=[q.id],
                block_id=q.id,  # synthetic, 借 question.id (唯一) 当 block id
                question=self._serialize_practice_question(
                    q, q.paper_revision.paper, q.paper_revision
                ),
            )
            for q in sorted_questions
        ]
        synthetic_section = schemas.PaperExamSectionOutV2(
            id=cross_section_key,
            section_id=cross_section_key,
            title="跨试卷批量复习",
            instruction_text="",
            question_count=len(sorted_questions),
            blocks=synthetic_blocks,
        )
        return schemas.PracticeSessionStartV2(
            sections=[synthetic_section],
            saved_answers={},
            session_id=session.id,
            # paper_code marker — frontend 看 "__cross_paper_retry__" 知 cross-paper.
            # paper_revision_id 留 None (synthetic, 没真 revision).
            paper_code="__cross_paper_retry__",
            paper_revision_id=None,
            paper_name="跨试卷批量复习",
        )

    def start_retry_wrong(
        self, question_id: int, *, user: User
    ) -> schemas.PracticeSessionStartV2:
        """创建一个 mode=retry_wrong 的 session 只含目标题。

        校验：用户必须有该题的 mastery 记录（做错过）。已 mastered 的题不阻塞
        （用户可能想再做一遍保持手感），但 UI 默认不给 retry 入口。

        P1 review fix Phase A.2: 复用 batch 同源 helper.
        """
        question = self._get_question(question_id)
        self._validate_questions_in_wrong_book([question_id], user_id=user.id)
        revision = self._load_revision_with_content(question.paper_revision_id)
        session = self._create_retry_session_record(
            user=user, revision=revision, total_questions=1, mode=MODE_RETRY_WRONG
        )
        filtered_sections, actual_total = self._filter_blueprint_for_questions(
            revision, {question_id}
        )
        if actual_total > 1:
            session.total_questions = actual_total
            self.session.flush()
        return self._build_retry_session_response(session, revision, filtered_sections)

    # ── Phase A.2 retry helpers (shared between single + batch retry) ────────

    def _validate_retry_batch_input(self, question_ids: list[int]) -> list[int]:
        """batch 输入校验: 非空 + ≤50 + dedup排序."""
        if not question_ids:
            raise ValidationError("question_ids must be non-empty")
        if len(question_ids) > 50:
            raise ValidationError("batch retry capped at 50 questions")
        return sorted(set(question_ids))

    def _validate_question_in_cross_paper_batch(
        self, session: PracticeSession, question_id: int
    ) -> None:
        """B-review B4 修: cross-paper retry session 提交时检查 question_id 在
        创建时的 batch allowlist 内. 防恶意 user 提 batch 外的题污染 session.

        v1 上线设计 (alembic 0012): retry_question_ids_json 列升级 JSONB,
        ORM 直接 list[int]. corrupted defensively narrow type 检查保留 — 手工 SQL
        修改 / 未来 schema 变化可能让它变 dict / str.
        """
        allowlist = session.retry_question_ids_json
        if allowlist is None:
            # session 创建时未持久 batch — 异常 (cross-paper marker NULL 但 batch 也 NULL).
            raise ValidationError("cross-paper session missing batch allowlist")
        if not isinstance(allowlist, list):
            raise ValidationError("cross-paper session batch corrupted (not a list)")
        if question_id not in allowlist:
            raise ValidationError(
                f"question {question_id} not in this cross-paper retry batch"
            )

    def _validate_questions_in_wrong_book(
        self, question_ids: list[int], *, user_id: int
    ) -> None:
        """所有 question_ids 必须在 user 的错题本里 (有 mastery 记录)."""
        mastery_records = list(
            self.session.scalars(
                select(WrongQuestionMastery).where(
                    WrongQuestionMastery.user_id == user_id,
                    WrongQuestionMastery.question_id.in_(question_ids),
                )
            )
        )
        found_qids = {m.question_id for m in mastery_records}
        missing = [qid for qid in question_ids if qid not in found_qids]
        if missing:
            if len(question_ids) == 1:
                raise NotFoundError("question not in your wrong book")
            raise NotFoundError(f"questions not in your wrong book: {missing[:5]}")

    def _validate_single_revision_for_questions(
        self, question_ids: list[int]
    ) -> PaperRevision:
        """所有 question 必须属于同一 paper_revision_id, 返回该 revision."""
        questions = list(
            self.session.scalars(select(Question).where(Question.id.in_(question_ids)))
        )
        revision_ids = {q.paper_revision_id for q in questions}
        if len(revision_ids) > 1:
            raise ValidationError(
                f"batch retry requires all questions from the same paper revision; "
                f"got {len(revision_ids)} revisions"
            )
        return self._load_revision_with_content(next(iter(revision_ids)))

    def _create_retry_session_record(
        self,
        *,
        user: User,
        revision: PaperRevision,
        total_questions: int,
        mode: str = MODE_RETRY_WRONG,
    ) -> PracticeSession:
        session = PracticeSession(
            mode=mode,
            user=user,
            paper=revision.paper,
            paper_revision=revision,
            total_questions=total_questions,
        )
        self.session.add(session)
        self.session.flush()
        return session

    def _filter_blueprint_for_questions(
        self, revision: PaperRevision, target_qid_set: set[int]
    ) -> tuple[list[schemas.PaperExamSectionOutV2], int]:
        """从 revision 完整 blueprint 过滤出仅含 target_qid 的 sections.

        material_group 内若有任一 target qid, 整组带上 (材料共通, 方便联系上下文).
        返回 (filtered_sections, actual_total) — actual_total 计材料组联动后实际题数,
        可能 > len(target_qid_set).
        """
        _paper_summary, full_sections, _b, _q, _mg = self._build_blueprint(revision)
        filtered_sections: list[schemas.PaperExamSectionOutV2] = []
        actual_total = 0
        for sec in full_sections:
            filtered_blocks: list[schemas.PaperExamBlockOutV2] = []
            for block in sec.blocks:
                if (
                    block.type == "question"
                    and block.question is not None
                    and block.question.question_id in target_qid_set
                ):
                    filtered_blocks.append(block)
                    actual_total += 1
                elif (
                    block.type == "material_group"
                    and block.material_group is not None
                    and any(qid in target_qid_set for qid in block.material_group.question_ids)
                ):
                    filtered_blocks.append(block)
                    actual_total += len(block.material_group.question_ids)
            if filtered_blocks:
                filtered_sections.append(
                    schemas.PaperExamSectionOutV2(
                        id=sec.id,
                        # Phase 5.6 E2E fix: 前端 Section.sectionId 读 section_id 不是 id.
                        section_id=sec.id,
                        title=sec.title,
                        instruction_text=sec.instruction_text,
                        question_count=sum(
                            1
                            if b.type == "question"
                            else (len(b.material_group.question_ids) if b.material_group else 0)
                            for b in filtered_blocks
                        ),
                        blocks=filtered_blocks,
                    )
                )
        return filtered_sections, actual_total

    def _build_retry_session_response(
        self,
        session: PracticeSession,
        revision: PaperRevision,
        filtered_sections: list[schemas.PaperExamSectionOutV2],
    ) -> schemas.PracticeSessionStartV2:
        return schemas.PracticeSessionStartV2(
            sections=filtered_sections,
            saved_answers={},
            session_id=session.id,
            paper_code=revision.paper.paper_code,
            paper_revision_id=revision.id,
            paper_name=revision.paper_name,
        )

    # ── Phase 5.5：Dashboard stats ─────────────────────────────────────────

    def get_heatmap(self, *, user: User) -> list[schemas.HeatmapEntryV2]:
        """返回最近 53 周（371 天）的每日答题计数与正确率。
        空日补零。日期按 Asia/Shanghai 本地日（answered_at 存 UTC naive，查询时
        +8h 后再截日）。SQLite 和 PG 方言差异在 _query_daily_stats 里封装。
        """
        today = datetime.now().date()
        start_date = today - timedelta(days=370)  # 含今天共 371 天

        daily = self._query_daily_stats(user_id=user.id, start_date=start_date)

        entries: list[schemas.HeatmapEntryV2] = []
        cursor = start_date
        while cursor <= today:
            key = cursor.isoformat()
            count, correct = daily.get(key, (0, 0))
            rate = (correct / count) if count > 0 else 0.0
            entries.append(
                schemas.HeatmapEntryV2(date=key, count=count, rate=round(rate, 4))
            )
            cursor += timedelta(days=1)
        return entries

    def get_trend(self, *, user: User, days: int = 14) -> list[schemas.TrendEntryV2]:
        if days < 1 or days > 365:
            raise ValidationError("days must be between 1 and 365")
        today = datetime.now().date()
        start_date = today - timedelta(days=days - 1)
        daily = self._query_daily_stats(user_id=user.id, start_date=start_date)
        entries: list[schemas.TrendEntryV2] = []
        cursor = start_date
        while cursor <= today:
            key = cursor.isoformat()
            count, correct = daily.get(key, (0, 0))
            rate = (correct / count) if count > 0 else 0.0
            entries.append(
                schemas.TrendEntryV2(date=key, rate=round(rate, 4), total=count)
            )
            cursor += timedelta(days=1)
        return entries

    def get_knowledge_points(
        self, *, user: User
    ) -> list[schemas.KnowledgePointEntryV2]:
        """按 Question.subject 聚合该 user 的答题正确率。subject 为 NULL 的
        题目归入 "(未分类)" 分组。"""
        from sqlalchemy import case as sql_case

        stmt = (
            select(
                Question.subject,
                func.count(PracticeSessionAnswer.id).label("total"),
                func.sum(
                    sql_case((PracticeSessionAnswer.is_correct, 1), else_=0)
                ).label("correct"),
            )
            .join(Question, PracticeSessionAnswer.question_id == Question.id)
            .join(
                PracticeSession, PracticeSessionAnswer.session_id == PracticeSession.id
            )
            .where(PracticeSession.user_id == user.id)
            .group_by(Question.subject)
        )
        rows = self.session.execute(stmt).all()
        entries: list[schemas.KnowledgePointEntryV2] = []
        for subject, total, correct in rows:
            total_int = int(total or 0)
            correct_int = int(correct or 0)
            rate = (correct_int / total_int) if total_int > 0 else 0.0
            category = "strong" if rate >= 0.8 else "ok" if rate >= 0.6 else "weak"
            entries.append(
                schemas.KnowledgePointEntryV2(
                    name=subject if subject else "(未分类)",
                    total=total_int,
                    correct=correct_int,
                    rate=round(rate, 4),
                    category=category,
                )
            )
        entries.sort(key=lambda e: (-e.total, e.name))
        return entries

    def get_dashboard_summary(self, *, user: User) -> schemas.DashboardStatsV2:
        # P1 review fix Phase A.1: 拆 3 helper SRP. 主函数 ≤ 50 行规则.
        total_answered, overall_accuracy = self._query_total_accuracy(user_id=user.id)
        streak = self._compute_streak(user_id=user.id)
        mastered_count, total_wrong = self._count_mastery_buckets(user_id=user.id)
        breakdown = self._compute_mode_breakdown(user_id=user.id)
        return schemas.DashboardStatsV2(
            total_answered=total_answered,
            overall_accuracy=overall_accuracy,
            current_streak_days=streak,
            mastered_points_count=mastered_count,
            total_wrong_questions=total_wrong,
            study_plan_answered=breakdown["study_plan"],
            retry_wrong_answered=breakdown["retry_wrong"],
            paper_bound_answered=breakdown["paper_bound"],
        )

    def _query_answered_by_mode(self, *, user_id: int) -> dict[str, int]:
        """Slice 3e ABM: 按 PracticeSession.mode 聚合 answer-level 累计.

        PracticeSession.mode 已 indexed (models.py:374). 单 query GROUP BY 1 round-trip.
        """
        stmt = (
            select(
                PracticeSession.mode,
                func.count(PracticeSessionAnswer.id),
            )
            .join(PracticeSession, PracticeSessionAnswer.session_id == PracticeSession.id)
            .where(PracticeSession.user_id == user_id)
            .group_by(PracticeSession.mode)
        )
        return {row[0]: int(row[1] or 0) for row in self.session.execute(stmt).all()}

    def _compute_mode_breakdown(self, *, user_id: int) -> dict[str, int]:
        """Slice 3e ABM: 把 mode→count map 按 D2 三桶定义分桶.

        - study_plan: MODE_STUDY_PLAN[_CROSS_PAPER] 学习计划全部入口 (含计划内的
          review_wrong task — 这些 session.mode 是 study_plan, 不是 retry_wrong).
        - retry_wrong: MODE_RETRY_WRONG[_CROSS_PAPER] 错题本独立入口.
        - paper_bound: MODE_PAPER 整卷 + 未知 mode 兜底 (logger.warning 提醒 ops).

        Plan §3 v0.2 P1-2 修: 仅未知 mode 才 warn 静默已知, 防 dashboard
        每次请求都打 log.
        """
        mode_counts = self._query_answered_by_mode(user_id=user_id)
        study_plan = (
            mode_counts.get(MODE_STUDY_PLAN, 0)
            + mode_counts.get(MODE_STUDY_PLAN_CROSS_PAPER, 0)
        )
        retry_wrong = (
            mode_counts.get(MODE_RETRY_WRONG, 0)
            + mode_counts.get(MODE_RETRY_WRONG_CROSS_PAPER, 0)
        )
        paper_bound = mode_counts.get(MODE_PAPER, 0)
        unknown = {
            m: c
            for m, c in mode_counts.items()
            if m not in _KNOWN_DASHBOARD_MODES
        }
        if unknown:
            logger.warning(
                "dashboard.unknown_mode_in_breakdown user=%s modes=%s",
                user_id, unknown,
            )
            paper_bound += sum(unknown.values())  # 兜底归整卷, 不丢
        return {
            "study_plan": study_plan,
            "retry_wrong": retry_wrong,
            "paper_bound": paper_bound,
        }

    def _query_total_accuracy(self, *, user_id: int) -> tuple[int, float]:
        """累计答题数 + 总体正确率. 返回 (total, accuracy)."""
        from sqlalchemy import case as sql_case

        total_stmt = (
            select(
                func.count(PracticeSessionAnswer.id),
                func.sum(sql_case((PracticeSessionAnswer.is_correct, 1), else_=0)),
            )
            .join(PracticeSession, PracticeSessionAnswer.session_id == PracticeSession.id)
            .where(PracticeSession.user_id == user_id)
        )
        total_row = self.session.execute(total_stmt).one()
        total = int(total_row[0] or 0)
        correct = int(total_row[1] or 0)
        accuracy = round((correct / total) if total > 0 else 0.0, 4)
        return total, accuracy

    def _query_recent_answered_count(self, *, user_id: int, days: int) -> int:
        """近 N 天答题量. Slice 3a P1-4: 沉睡用户判定 — 全历史 total ≥ 阈值
        但近期 0 答题, 也算冷启动 (避免 LLM 拿空 ctx 推空气数据).

        SQL 层用 answered_at >= now-Nd, 不走 daily_stats 时区聚合 (这里只看
        总数, 不用按日分桶).
        """
        cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=days)
        stmt = (
            select(func.count(PracticeSessionAnswer.id))
            .join(
                PracticeSession,
                PracticeSessionAnswer.session_id == PracticeSession.id,
            )
            .where(
                PracticeSession.user_id == user_id,
                PracticeSessionAnswer.answered_at >= cutoff,
            )
        )
        return int(self.session.scalar(stmt) or 0)

    def _query_subject_accuracy(
        self, *, user_id: int
    ) -> list[tuple[str, int, int]]:
        """按 Question.subject 分组的 (subject, answered_count, correct_count).

        Slice 3a P1-5: 抽出来给 StudyPlanService._build_context 复用, 解
        SLF001 双 SSOT 风险. 跟 _query_total_accuracy / _query_daily_stats 同
        pattern (private method + caller 走 SLF001 noqa).

        排除 Question.subject IS NULL 的题 (老数据未补 subject 字段).
        """
        from sqlalchemy import case as sql_case

        stmt = (
            select(
                Question.subject,
                func.count(PracticeSessionAnswer.id),
                func.sum(sql_case((PracticeSessionAnswer.is_correct, 1), else_=0)),
            )
            .join(
                PracticeSession,
                PracticeSessionAnswer.session_id == PracticeSession.id,
            )
            .join(Question, PracticeSessionAnswer.question_id == Question.id)
            .where(
                PracticeSession.user_id == user_id,
                Question.subject.is_not(None),
            )
            .group_by(Question.subject)
        )
        result: list[tuple[str, int, int]] = []
        for subj, cnt, correct in self.session.execute(stmt).all():
            count = int(cnt or 0)
            if count == 0:
                continue
            result.append((str(subj), count, int(correct or 0)))
        return result

    def _compute_streak(self, *, user_id: int) -> int:
        """连续打卡天数 (从今天倒推, 直到第一个 0 答题日)."""
        today = datetime.now().date()
        start_date = today - timedelta(days=370)
        daily = self._query_daily_stats(user_id=user_id, start_date=start_date)
        streak = 0
        cursor = today
        while cursor >= start_date:
            count, _correct = daily.get(cursor.isoformat(), (0, 0))
            if count <= 0:
                break
            streak += 1
            cursor -= timedelta(days=1)
        return streak

    def _count_mastery_buckets(self, *, user_id: int) -> tuple[int, int]:
        """已掌握 vs 待复习错题数. 返回 (mastered, total_wrong)."""
        mastered = int(
            self.session.scalar(
                select(func.count(WrongQuestionMastery.id)).where(
                    WrongQuestionMastery.user_id == user_id,
                    WrongQuestionMastery.mastery_level == "mastered",
                )
            ) or 0
        )
        total_wrong = int(
            self.session.scalar(
                select(func.count(WrongQuestionMastery.id)).where(
                    WrongQuestionMastery.user_id == user_id,
                    WrongQuestionMastery.mastery_level != "mastered",
                )
            ) or 0
        )
        return mastered, total_wrong

    def _query_daily_stats(
        self, *, user_id: int, start_date: date
    ) -> dict[str, tuple[int, int]]:
        """按 Asia/Shanghai 本地日聚合每日答题量与答对量。
        返回 {date_str: (count, correct_count)}。
        方言分支：PG 用 `AT TIME ZONE` 转时区；SQLite 用 `+8 hours` 再 DATE()。
        """
        dialect = self.session.bind.dialect.name if self.session.bind else "sqlite"
        if dialect == "postgresql":
            local_date_expr = (
                "CAST((answered_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') "
                "AS DATE)"
            )
        else:
            local_date_expr = "DATE(answered_at, '+8 hours')"

        sql = text(
            f"""
            SELECT
                {local_date_expr} AS d,
                COUNT(psa.id) AS total,
                SUM(CASE WHEN psa.is_correct THEN 1 ELSE 0 END) AS correct
            FROM practice_session_answers psa
            JOIN practice_sessions ps ON ps.id = psa.session_id
            WHERE ps.user_id = :user_id
              AND {local_date_expr} >= :start_date
            GROUP BY d
            """
        )
        rows = self.session.execute(
            sql,
            {"user_id": user_id, "start_date": start_date.isoformat()},
        ).all()
        result: dict[str, tuple[int, int]] = {}
        for row in rows:
            d = row[0]
            key = d.isoformat() if isinstance(d, date) else str(d)
            result[key] = (int(row[1] or 0), int(row[2] or 0))
        return result

    def _serialize_wrong_question_detail(
        self, mastery: WrongQuestionMastery, user_id: int
    ) -> schemas.WrongQuestionDetailV2:
        # Phase D (P3 backlog): 拆 _query_user_question_history (db) helper.
        question = mastery.question
        revision = question.paper_revision
        latest_answer, wrong_count = self._query_user_question_history(
            user_id=user_id, question_id=question.id
        )
        correct_keys = list(deserialize_answer_text(question.answer_text))
        user_keys: list[str] = (
            list(deserialize_answer_text(latest_answer.selected_answer))
            if latest_answer is not None
            else []
        )
        return schemas.WrongQuestionDetailV2(
            question_id=question.id,
            stem=_rewrite_asset_urls(question.stem_text, question.assets),
            options=[
                schemas.WrongQuestionOptionV2(
                    key=opt.option_key,
                    text=_rewrite_asset_urls(opt.option_text, question.assets),
                    is_correct=opt.option_key in correct_keys,
                )
                for opt in sorted(question.options, key=lambda o: o.display_order)
            ],
            correct_answer_keys=correct_keys,
            user_latest_answer_keys=user_keys,
            explanation=_rewrite_asset_urls(question.explanation_text, question.assets),
            subject=self._resolve_subject(question),
            subtype=question.canonical_subtype,
            question_kind=question.question_kind,
            paper_code=revision.paper.paper_code,
            paper_name=revision.paper_name,
            wrong_count=wrong_count,
            mastery_level=mastery.mastery_level,
            last_wrong_time=mastery.last_wrong_time,
            consecutive_correct_count=mastery.consecutive_correct_count,
        )

    def _query_user_question_history(
        self, *, user_id: int, question_id: int
    ) -> tuple[PracticeSessionAnswer | None, int]:
        """Latest answer + cumulative wrong count for a user × question.

        Phase D (P3 backlog): 从 _serialize_wrong_question_detail 提取的 db helper.
        """
        latest_answer = self.session.scalar(
            select(PracticeSessionAnswer)
            .join(PracticeSession, PracticeSessionAnswer.session_id == PracticeSession.id)
            .where(
                PracticeSession.user_id == user_id,
                PracticeSessionAnswer.question_id == question_id,
            )
            .order_by(
                PracticeSessionAnswer.answered_at.desc(),
                PracticeSessionAnswer.id.desc(),
            )
            .limit(1)
        )
        wrong_count = self.session.scalar(
            select(func.count(PracticeSessionAnswer.id))
            .join(PracticeSession, PracticeSessionAnswer.session_id == PracticeSession.id)
            .where(
                PracticeSession.user_id == user_id,
                PracticeSessionAnswer.question_id == question_id,
                PracticeSessionAnswer.is_correct.is_(False),
            )
        ) or 0
        return latest_answer, wrong_count

    def get_question_asset(self, asset_id: int) -> QuestionAsset:
        asset = self.session.get(QuestionAsset, asset_id)
        if asset is None:
            raise NotFoundError("question asset not found")
        return asset

    def get_material_group_asset(self, asset_id: int) -> MaterialGroupAsset:
        asset = self.session.get(MaterialGroupAsset, asset_id)
        if asset is None:
            raise NotFoundError("material group asset not found")
        return asset

    def get_publish_status(self, revision_id: int) -> schemas.PublishStatusResponseV2:
        revision = self._load_revision_with_content(revision_id)
        latest_audit = (
            max(revision.release_audits, key=lambda item: item.created_at)
            if revision.release_audits
            else None
        )
        return schemas.PublishStatusResponseV2(
            paper_code=revision.paper.paper_code,
            revision_id=revision.id,
            is_published=revision.is_published,
            is_current_revision=revision.paper.current_revision_id == revision.id,
            published_at=revision.published_at,
            release_execution_id=latest_audit.release_execution_id if latest_audit is not None else None,
        )

    def _import_single_payload(self, *, filename: str, content: bytes, base_dir: Path) -> PaperRevision:
        # P1 review fix Phase A.3: 主函数 ≤ 50 行, 拆 5 helper.
        payload, source_hash, sections_payload = self._parse_paper_payload(content)
        paper = self._get_or_create_paper_from_payload(payload)
        existing_revision = self.session.scalar(
            select(PaperRevision).where(
                PaperRevision.paper_id == paper.id,
                PaperRevision.source_hash == source_hash,
            )
        )
        if existing_revision is not None:
            return existing_revision
        revision = self._create_revision_from_payload(paper, payload, source_hash)
        counters = _ImportCounters()
        for section_order, section_payload in enumerate(sections_payload, start=1):
            self._persist_section_with_blocks(
                revision=revision,
                section_payload=section_payload,
                section_order=section_order,
                counters=counters,
                base_dir=base_dir,
                filename=filename,
                paper_code=paper.paper_code,
            )
        revision.question_count = counters.question_count
        self.session.flush()
        return revision

    # ── Phase A.3 _import_single_payload helpers ─────────────────────────────

    def _parse_paper_payload(
        self, content: bytes
    ) -> tuple[dict[str, Any], str, list[Any]]:
        """Parse + validate paper JSON. 返回 (payload, source_hash, sections_payload).

        sections_payload 必须 non-empty list, 上层无需再校验.
        """
        try:
            payload = json.loads(content.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValidationError(f"invalid json: {exc}") from exc
        if not isinstance(payload, dict):
            raise ValidationError("payload must be a JSON object")
        sections_payload = payload.get("sections")
        if not isinstance(sections_payload, list) or not sections_payload:
            raise ValidationError("sections must be a non-empty array")
        source_hash = hashlib.sha256(content).hexdigest()
        return payload, source_hash, sections_payload

    def _get_or_create_paper_from_payload(self, payload: dict[str, Any]) -> Paper:
        """从 payload 顶层字段提取 paper identity, get-or-create."""
        return self._get_or_create_paper(
            paper_code=self._required_string(payload, "paperCode").upper(),
            paper_name=self._required_string(payload, "paperName"),
            exam_year=self._optional_year(payload.get("examYear")),
            source_provider=self._optional_source_value(payload.get("sourceProvider")),
            source_kind=self._optional_source_value(payload.get("sourceKind")),
        )

    def _create_revision_from_payload(
        self, paper: Paper, payload: dict[str, Any], source_hash: str
    ) -> PaperRevision:
        """Fresh revision 创建 (前提: 调用方已确认无同 hash 老 revision)."""
        revision = PaperRevision(
            paper=paper,
            revision_number=self._next_revision_number(paper.id),
            sort_order=self._resolve_sort_order(payload),
            paper_name=self._required_string(payload, "paperName"),
            exam_year=self._optional_year(payload.get("examYear")),
            source_provider=self._optional_source_value(payload.get("sourceProvider")),
            source_kind=self._optional_source_value(payload.get("sourceKind")),
            is_gradable=self._infer_paper_is_gradable(payload),
            uses_placeholder_answers=self._infer_uses_placeholder_answers(payload),
            visible_in_public=self._optional_bool(payload.get("visibleInPublic"), default=True),
            question_count=0,
            source_hash=source_hash,
            source_snapshot_json=payload,
        )
        self.session.add(revision)
        self.session.flush()
        return revision

    def _persist_section_with_blocks(
        self,
        *,
        revision: PaperRevision,
        section_payload: Any,
        section_order: int,
        counters: _ImportCounters,
        base_dir: Path,
        filename: str,
        paper_code: str,
    ) -> None:
        """Persist 单 section + 内部全部 block (question / material group). counters 原地累加."""
        if not isinstance(section_payload, dict):
            raise ValidationError("section must be an object")
        section_key = self._required_string(section_payload, "key")
        section = PaperSection(
            paper_revision=revision,
            section_key=section_key,
            title=self._required_string(section_payload, "title"),
            instruction_text=str(section_payload.get("instructionText") or "").strip(),
            display_order=section_order,
            question_count=0,
        )
        self.session.add(section)
        self.session.flush()

        blocks_payload = section_payload.get("blocks")
        if not isinstance(blocks_payload, list) or not blocks_payload:
            raise ValidationError(f"section {section_key} is missing blocks")
        for block_payload in blocks_payload:
            self._persist_one_block(
                revision=revision,
                section=section,
                block_payload=block_payload,
                counters=counters,
                base_dir=base_dir,
                filename=filename,
                paper_code=paper_code,
            )

    def _persist_one_block(
        self,
        *,
        revision: PaperRevision,
        section: PaperSection,
        block_payload: Any,
        counters: _ImportCounters,
        base_dir: Path,
        filename: str,
        paper_code: str,
    ) -> None:
        """Dispatch question vs material_group block creation."""
        if not isinstance(block_payload, dict):
            raise ValidationError("block must be an object")
        block_type = self._required_string(block_payload, "type")
        if block_type not in ALLOWED_BLOCK_TYPES:
            raise ValidationError(f"unsupported block type: {block_type}")
        block = PaperBlock(
            paper_revision=revision,
            section=section,
            block_type=block_type,
            display_order=counters.block_order,
        )
        counters.block_order += 1
        self.session.add(block)
        self.session.flush()
        if block_type == "question":
            self._create_question_from_payload(
                question_payload=block_payload,
                filename=filename,
                base_dir=base_dir,
                revision=revision,
                section=section,
                block=block,
                material_group=None,
                position=counters.question_position,
                paper_code=paper_code,
            )
            section.question_count += 1
            counters.question_position += 1
            counters.question_count += 1
            return
        self._persist_material_group_block(
            revision=revision,
            section=section,
            block=block,
            block_payload=block_payload,
            counters=counters,
            base_dir=base_dir,
            filename=filename,
            paper_code=paper_code,
        )

    def _persist_material_group_block(
        self,
        *,
        revision: PaperRevision,
        section: PaperSection,
        block: PaperBlock,
        block_payload: dict[str, Any],
        counters: _ImportCounters,
        base_dir: Path,
        filename: str,
        paper_code: str,
    ) -> None:
        """Material group block: 创建 group + assets + 内嵌 questions.

        Phase D (P3 backlog): 拆 _create_material_group_record /
        _persist_material_group_questions 两 helper.
        """
        material_group = self._create_material_group_record(
            revision=revision,
            block=block,
            block_payload=block_payload,
            counters=counters,
            base_dir=base_dir,
            paper_code=paper_code,
        )
        self._persist_material_group_questions(
            revision=revision,
            section=section,
            block=block,
            material_group=material_group,
            block_payload=block_payload,
            counters=counters,
            base_dir=base_dir,
            filename=filename,
            paper_code=paper_code,
        )

    def _create_material_group_record(
        self,
        *,
        revision: PaperRevision,
        block: PaperBlock,
        block_payload: dict[str, Any],
        counters: _ImportCounters,
        base_dir: Path,
        paper_code: str,
    ) -> MaterialGroup:
        group_kind = self._required_string(block_payload, "groupKind")
        if group_kind not in ALLOWED_GROUP_KINDS:
            raise ValidationError(f"unsupported material group kind: {group_kind}")
        material_group = MaterialGroup(
            paper_revision=revision,
            block=block,
            source_group_uuid=self._required_string(block_payload, "sourceGroupUuid"),
            group_kind=group_kind,
            title=self._required_string(block_payload, "title"),
            material_text=str(block_payload.get("materialText") or "").strip(),
            instruction_text=str(block_payload.get("instructionText") or "").strip(),
            payload_json=block_payload.get("payload") or {},
            display_order=counters.group_order,
        )
        counters.group_order += 1
        material_group.assets = [
            MaterialGroupAsset(
                asset_role=item.role,
                file_path=item.file_path,
                mime_type=item.mime_type,
                metadata_json=item.metadata,
                display_order=item.display_order,
            )
            for item in self._resolve_assets(
                block_payload.get("assets"), base_dir, paper_code=paper_code
            )
        ]
        self.session.add(material_group)
        self.session.flush()
        return material_group

    def _persist_material_group_questions(
        self,
        *,
        revision: PaperRevision,
        section: PaperSection,
        block: PaperBlock,
        material_group: MaterialGroup,
        block_payload: dict[str, Any],
        counters: _ImportCounters,
        base_dir: Path,
        filename: str,
        paper_code: str,
    ) -> None:
        """持久化 material_group 下挂的 questions (loop + counter 累加).

        Phase D (P3 backlog): 从 _persist_material_group_block 提取的 SRP helper.
        """
        questions_payload = block_payload.get("questions")
        if not isinstance(questions_payload, list) or not questions_payload:
            raise ValidationError("material_group.questions must be a non-empty array")
        for question_payload in questions_payload:
            if not isinstance(question_payload, dict):
                raise ValidationError("material group question must be an object")
            self._create_question_from_payload(
                question_payload=question_payload,
                filename=filename,
                base_dir=base_dir,
                revision=revision,
                section=section,
                block=block,
                material_group=material_group,
                position=counters.question_position,
                paper_code=paper_code,
            )
            section.question_count += 1
            counters.question_position += 1
            counters.question_count += 1

    def _create_question_from_payload(
        self,
        *,
        question_payload: dict[str, Any],
        filename: str,
        base_dir: Path,
        revision: PaperRevision,
        section: PaperSection,
        block: PaperBlock,
        material_group: MaterialGroup | None,
        position: int,
        paper_code: str,
    ) -> Question:
        # P1 review fix Phase A.3 (subagent follow-up): 主函数 ≤ 50 行,
        # 拆 5 helper (validate_options / extract_options / validate_answer_keys /
        # validate_metadata / construct_orm + 这次又抽 attach_options_assets).
        source_uuid = self._required_string(question_payload, "sourceUuid")
        renderer_key_raw = str(question_payload.get("rendererKey") or "").strip()
        is_fill_blank = renderer_key_raw == "fill_blank"
        is_essay = renderer_key_raw == "essay"
        self._validate_question_options(
            question_payload, source_uuid, is_fill_blank, is_essay=is_essay
        )
        option_records, option_keys, option_assets = self._extract_question_options(
            question_payload, source_uuid, base_dir, paper_code=paper_code
        )
        answer_keys = self._validate_question_answer_keys(
            question_payload, source_uuid, option_keys, is_fill_blank, is_essay=is_essay
        )
        special_payload, type_payload, canonical_payload = self._validate_question_metadata(
            question_payload, source_uuid
        )
        question = self._construct_question_orm(
            question_payload=question_payload,
            source_uuid=source_uuid,
            revision=revision,
            section=section,
            block=block,
            material_group=material_group,
            position=position,
            answer_keys=answer_keys,
            option_keys=option_keys,
            special_payload=special_payload,
            type_payload=type_payload,
            canonical_payload=canonical_payload,
            filename=filename,
        )
        self._attach_question_options_and_assets(
            question, option_records, option_assets, question_payload, base_dir,
            paper_code=paper_code,
        )
        question.tags = self._resolve_tags(question_payload.get("tags"))
        self.session.add(question)
        self.session.flush()
        return question

    def _attach_question_options_and_assets(
        self,
        question: Question,
        option_records: list[dict[str, Any]],
        option_assets: list[ResolvedAsset],
        question_payload: dict[str, Any],
        base_dir: Path,
        *,
        paper_code: str,
    ) -> None:
        """Attach options + assets to a Question ORM (no-flush, caller flushes)."""
        question.options = [
            QuestionOption(
                option_key=item["option_key"],
                option_text=item["option_text"],
                display_order=item["display_order"],
            )
            for item in option_records
        ]
        question.assets = [
            QuestionAsset(
                asset_role=item.role,
                file_path=item.file_path,
                mime_type=item.mime_type,
                metadata_json=item.metadata,
                display_order=item.display_order,
            )
            for item in [
                *self._resolve_assets(
                    question_payload.get("assets"), base_dir, paper_code=paper_code
                ),
                *option_assets,
            ]
        ]

    # ── Phase A.3 _create_question_from_payload helpers ─────────────────────

    def _validate_question_options(
        self,
        question_payload: dict[str, Any],
        source_uuid: str,
        is_fill_blank: bool,
        is_essay: bool = False,
    ) -> None:
        """Phase 6.5: fill_blank 不需要 options (用户输入文本判分);
        单选/多选/不定项需 ≥2 options.

        Slice 2a: essay 同 fill_blank — 申论开放写作无选项, options 可空; 若给必须
        是 list (空 list 或缺 key 都允许).
        """
        options_payload = question_payload.get("options") or []
        if is_fill_blank or is_essay:
            if not isinstance(options_payload, list):
                raise ValidationError(f"{source_uuid} options must be a list (or empty)")
        else:
            if not isinstance(options_payload, list) or len(options_payload) < 2:
                raise ValidationError(f"{source_uuid} options must contain at least two items")

    def _extract_question_options(
        self,
        question_payload: dict[str, Any],
        source_uuid: str,
        base_dir: Path,
        *,
        paper_code: str,
    ) -> tuple[list[dict[str, Any]], list[str], list[ResolvedAsset]]:
        """从 payload 提取 (option_records, option_keys, option_assets) 三元组."""
        options_payload = question_payload.get("options") or []
        option_records: list[dict[str, Any]] = []
        option_keys: list[str] = []
        option_assets: list[ResolvedAsset] = []
        for index, option_payload in enumerate(options_payload, start=1):
            if not isinstance(option_payload, dict):
                raise ValidationError(f"{source_uuid} option must be an object")
            option_key = self._required_string(option_payload, "key").upper()
            option_keys.append(option_key)
            option_records.append(
                {
                    "option_key": option_key,
                    "option_text": str(option_payload.get("text") or "").strip(),
                    "display_order": index,
                }
            )
            option_assets.extend(
                self._resolve_assets(
                    option_payload.get("assets"),
                    base_dir,
                    paper_code=paper_code,
                    role_prefix=f"option:{option_key}",
                    display_offset=len(option_assets),
                )
            )
        return option_records, option_keys, option_assets

    def _validate_question_answer_keys(
        self,
        question_payload: dict[str, Any],
        source_uuid: str,
        option_keys: list[str],
        is_fill_blank: bool,
        is_essay: bool = False,
    ) -> list[str]:
        """answer_keys 非空 + fill_blank 跳过 in-options 校验.

        Slice 2a: essay 跳过整段 answer_keys 校验 — 申论无 expected answer, 由 LLM
        异步评分 (Slice 2c). 返回空 list, 上游 serialize_answer_keys 写入 answer_text=''.
        """
        if is_essay:
            return []
        answer_keys = normalize_answer_keys(question_payload.get("answerKeys", []))
        if not answer_keys:
            raise ValidationError(f"{source_uuid} is missing answerKeys")
        if not is_fill_blank:
            invalid_keys = [key for key in answer_keys if key not in set(option_keys)]
            if invalid_keys:
                raise ValidationError(
                    f"{source_uuid} answerKeys contain invalid options: {', '.join(invalid_keys)}"
                )
        return answer_keys

    def _validate_question_metadata(
        self, question_payload: dict[str, Any], source_uuid: str
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        """specialPayload / typePayload / canonicalTaxonomy 必须 dict.

        Slice 2a 2nd review P2: essay 时额外校验 type_payload.materialTexts 必须 list[str]
        (CLAUDE.md fail-fast — ingest 时炸, 别让 bad shape 进 DB 后到序列化/FE 才出错).
        """
        special_payload = question_payload.get("specialPayload") or {}
        if not isinstance(special_payload, dict):
            raise ValidationError(f"{source_uuid} specialPayload must be an object")
        type_payload = question_payload.get("typePayload") or {}
        if not isinstance(type_payload, dict):
            raise ValidationError(f"{source_uuid} typePayload must be an object")
        canonical_payload = question_payload.get("canonicalTaxonomy") or {}
        if canonical_payload and not isinstance(canonical_payload, dict):
            raise ValidationError(f"{source_uuid} canonicalTaxonomy must be an object")
        renderer_key = str(question_payload.get("rendererKey") or "").strip()
        if renderer_key == "essay":
            self._validate_essay_type_payload(type_payload, source_uuid)
        return special_payload, type_payload, canonical_payload

    def _validate_essay_type_payload(
        self, type_payload: dict[str, Any], source_uuid: str
    ) -> None:
        """Slice 2a essay metadata shape (fail-fast at ingest, 2nd review P2).

        - materialTexts (若给): list, 元素都是 str
        - wordLimitMin/wordLimitMax/suggestedMinutes/fullScore (若给): int
        缺字段允许 (PoC, 数据可能不完整); 给了就必须 shape 对.
        """
        if "materialTexts" in type_payload:
            mats = type_payload["materialTexts"]
            if not isinstance(mats, list) or not all(isinstance(m, str) for m in mats):
                raise ValidationError(
                    f"{source_uuid} essay typePayload.materialTexts must be list[str]"
                )
        for key in ("wordLimitMin", "wordLimitMax", "suggestedMinutes", "fullScore"):
            if key in type_payload:
                value = type_payload[key]
                # bool 是 int 子类, 显式排除避免 True/False 当数字传
                if not isinstance(value, int) or isinstance(value, bool):
                    raise ValidationError(
                        f"{source_uuid} essay typePayload.{key} must be int"
                    )

    def _construct_question_orm(
        self,
        *,
        question_payload: dict[str, Any],
        source_uuid: str,
        revision: PaperRevision,
        section: PaperSection,
        block: PaperBlock,
        material_group: MaterialGroup | None,
        position: int,
        answer_keys: list[str],
        option_keys: list[str],
        special_payload: dict[str, Any],
        type_payload: dict[str, Any],
        canonical_payload: dict[str, Any],
        filename: str,
    ) -> Question:
        """Question ORM 构建 (无 options/assets/tags wiring; 调用方自行 attach).

        Phase D (P3 backlog) **已完成**: 拆 _build_question_text_fields /
        _build_question_meta_fields / _build_question_json_payloads /
        _extract_canonical_fields helper, 主函数 50 code-lines, 满足 ≤50 cap.
        """
        renderer_key = infer_renderer_key(
            answer_keys,
            option_keys,
            explicit_renderer=str(question_payload.get("rendererKey") or "").strip() or None,
        )
        text_fields = self._build_question_text_fields(
            question_payload, answer_keys, option_keys
        )
        meta_fields = self._build_question_meta_fields(question_payload, revision)
        type_dict, special_dict, source_dict = _build_question_json_payloads(
            question_payload, special_payload, type_payload, section, filename
        )
        canonical_fields = _extract_canonical_fields(canonical_payload)
        return Question(
            paper_revision=revision,
            section=section,
            block=block,
            material_group=material_group,
            position=position,
            source_uuid=source_uuid,
            renderer_key=renderer_key,
            type_payload_json=type_dict,
            special_payload_json=special_dict,
            source_payload_json=source_dict,
            **text_fields,
            **meta_fields,
            **canonical_fields,
        )

    def _build_question_text_fields(
        self,
        question_payload: dict[str, Any],
        answer_keys: list[str],
        option_keys: list[str],
    ) -> dict[str, Any]:
        """Question 文本类字段 (kind/subtype/stem/answer/explanation/difficulty)."""
        return {
            "question_kind": self._required_string(question_payload, "questionKind"),
            "subtype_name": self._required_string(question_payload, "subtypeName"),
            "second_subtype_name": str(question_payload.get("secondSubtypeName") or "").strip()
            or None,
            "stem_text": self._required_string(question_payload, "stemText"),
            "answer_text": serialize_answer_keys(answer_keys, option_keys),
            "explanation_text": str(question_payload.get("explanationText") or "").strip(),
            "difficulty_code": self._normalize_difficulty(
                str(question_payload.get("difficultyCode") or "")
            ),
        }

    def _build_question_meta_fields(
        self, question_payload: dict[str, Any], revision: PaperRevision
    ) -> dict[str, Any]:
        """Question meta 字段 (exam_year/source/is_gradable/enabled, 跟 revision 兜底).

        Subagent review P1-2: essay 永远 is_gradable=False (无 expected answer, 无法
        auto-compare). 否则 ingest 漏掉 isGradable 字段 + revision.is_gradable=True
        时 essay 会被错误标 gradable, 后续 submit/grading flow 当行测题处理报错.
        """
        renderer_key = str(question_payload.get("rendererKey") or "").strip()
        if renderer_key == "essay":
            is_gradable = False
        else:
            is_gradable = self._infer_question_is_gradable(
                question_payload, fallback=revision.is_gradable
            )
        return {
            "exam_year": self._optional_year(
                question_payload.get("examYear"), fallback=revision.exam_year
            ),
            "source_provider": self._optional_source_value(
                question_payload.get("sourceProvider"), fallback=revision.source_provider
            ),
            "source_kind": self._optional_source_value(
                question_payload.get("sourceKind"), fallback=revision.source_kind
            ),
            "is_gradable": is_gradable,
            "enabled": self._optional_bool(question_payload.get("enabled"), default=True),
        }

    def _upsert_session_answer(
        self,
        *,
        session: PracticeSession,
        question: Question,
        selected_answer_keys: list[str],
    ) -> PracticeSessionAnswer | None:
        """Phase 5.4b: 返回 upsert 后的 answer（或 None 表示清空）。
        调用方根据返回值决定是否触发 mastery hook。

        B-review B-R3 修: cross-paper retry session 用 batch index 当
        paper_position (而非 question.position), 避免不同 paper 同 position
        碰撞导致 result page 顺序错乱.
        """
        existing = next((item for item in session.answers if item.question_id == question.id), None)
        if not selected_answer_keys:
            if existing is not None:
                self.session.delete(existing)
                self.session.flush()
            session.completed_at = None
            return None

        # cross-paper 用 batch index, 老 paper-bound 用 question.position.
        # 独立 review KEY OBS #1 修: dispatch 读 mode. KEY OBS #2 修: 字段
        # 从 paper_position 改名 display_order.
        if session.mode in _CROSS_PAPER_MODES:
            display_order = self._cross_paper_synthetic_position(session, question.id)
        else:
            display_order = question.position

        option_order = [option.option_key for option in sorted(question.options, key=lambda item: item.display_order)]
        selected_answer_text = serialize_answer_keys(selected_answer_keys, option_order)
        correct_answer_keys = deserialize_answer_text(question.answer_text)
        is_correct = is_answer_correct(selected_answer_keys, correct_answer_keys)

        if existing is None:
            existing = PracticeSessionAnswer(
                session=session,
                question=question,
                display_order=display_order,
                selected_answer=selected_answer_text,
                correct_answer_snapshot=question.answer_text,
                is_correct=is_correct,
                answered_at=utc_now(),
            )
            self.session.add(existing)
        else:
            existing.display_order = display_order
            existing.selected_answer = selected_answer_text
            existing.correct_answer_snapshot = question.answer_text
            existing.is_correct = is_correct
            existing.answered_at = utc_now()
        self.session.flush()
        return existing

    def _cross_paper_synthetic_position(
        self, session: PracticeSession, question_id: int
    ) -> int:
        """1-indexed position of question within session's batch allowlist.
        Falls back to 0 if allowlist missing — caller has 已 validated
        membership before this call.
        """
        allowlist = session.retry_question_ids_json
        if allowlist is None or not isinstance(allowlist, list):
            return 0
        try:
            return allowlist.index(question_id) + 1
        except ValueError:
            return 0

    def _get_or_create_paper(
        self,
        *,
        paper_code: str,
        paper_name: str,
        exam_year: int | None,
        source_provider: str | None,
        source_kind: str | None,
    ) -> Paper:
        paper = self.session.scalar(select(Paper).where(Paper.paper_code == paper_code))
        if paper is None:
            paper = Paper(
                paper_code=paper_code,
                paper_name=paper_name,
                exam_year=exam_year,
                source_provider=source_provider,
                source_kind=source_kind,
            )
            self.session.add(paper)
            self.session.flush()
            return paper

        paper.paper_name = paper_name
        paper.exam_year = exam_year
        paper.source_provider = source_provider
        paper.source_kind = source_kind
        self.session.flush()
        return paper

    def _get_or_create_guest_user(self) -> User:
        # P0-A fix (回归 review 2026-04-30): 并发匿名请求同时跑这函数, 两 worker
        # 都 SELECT 无 row → INSERT → 第二个 flush 抛 IntegrityError(unique
        # username) → 500. 由于 P0-1 fix 后所有匿名 cross-user 都触发本函数,
        # 这成了"匿名枚举 session 触发 500" 的存在性侧道. 用 SAVEPOINT
        # 包 INSERT, 撞 UNIQUE → rollback SAVEPOINT + re-SELECT 拿并发胜者.
        guest = self.session.scalar(select(User).where(User.username == "__guest__"))
        if guest is not None:
            return guest
        new_guest = User(
            username="__guest__", display_name="Guest",
            password_hash="guest", is_active=True,
        )
        try:
            with self.session.begin_nested():
                self.session.add(new_guest)
                self.session.flush()
            return new_guest
        except IntegrityError:
            # 并发胜者抢先 INSERT 提交, re-SELECT 拿现有 row
            existing = self.session.scalar(
                select(User).where(User.username == "__guest__")
            )
            if existing is None:
                # 极小概率: 撞 UNIQUE 但又找不到 (delete race) — re-raise
                raise
            return existing

    def _next_revision_number(self, paper_id: int) -> int:
        latest = self.session.scalar(
            select(func.max(PaperRevision.revision_number)).where(PaperRevision.paper_id == paper_id)
        )
        return int(latest or 0) + 1

    def _resolve_sort_order(self, payload: dict[str, Any]) -> int:
        raw_value = payload.get("sortOrder")
        if raw_value is not None and raw_value != "":
            try:
                return int(raw_value)
            except (TypeError, ValueError) as exc:
                raise ValidationError(f"invalid sortOrder: {raw_value}") from exc
        exam_year = self._optional_year(payload.get("examYear"))
        return int(exam_year or 0)

    def _resolve_tags(self, raw_tags: Any) -> list[Tag]:
        if raw_tags is None:
            return []
        if not isinstance(raw_tags, list):
            raise ValidationError("tags must be an array")

        resolved: list[Tag] = []
        for raw_tag in raw_tags:
            name = str(raw_tag).strip()
            if not name:
                continue
            existing = self.session.scalar(select(Tag).where(func.lower(Tag.name) == name.lower()))
            if existing is None:
                existing = Tag(name=name)
                self.session.add(existing)
                self.session.flush()
            resolved.append(existing)
        return resolved

    def _resolve_assets(
        self,
        raw_assets: Any,
        base_dir: Path,
        *,
        paper_code: str,
        role_prefix: str | None = None,
        display_offset: int = 0,
    ) -> list[ResolvedAsset]:
        """Resolve + copy staging assets to `settings.assets_root / <paperCode>/assets/`.

        v1 上线设计 (alembic 0012, M1 assets 路径相对化):
        - 物理 src: `(base_dir / raw_path).resolve()` — adapter 输出的 staging 资产
        - 物理 dst: `self._assets_root / paper_code / assets / <basename>` — SSOT 落点
        - DB 存: `<paperCode>/assets/<basename>` (相对 assets_root)
        - 搬运 idempotent: dst 已存在且 size 一致则跳过 copy

        基线 fail-fast: src 不存在 / 非 file / metadata 非 dict 直接抛 ValidationError.
        Fenbi 单题资产缺失在 adapter 层转 data-missing 占位，标准 JSON import 不吞。
        """
        if raw_assets is None:
            return []
        if not isinstance(raw_assets, list):
            raise ValidationError("assets must be an array")

        assets: list[ResolvedAsset] = []
        for index, raw_asset in enumerate(raw_assets, start=1 + display_offset):
            if not isinstance(raw_asset, dict):
                raise ValidationError("asset must be an object")
            raw_path = self._required_string(raw_asset, "path")
            staging_path = (
                (base_dir / raw_path).resolve()
                if not Path(raw_path).is_absolute()
                else Path(raw_path).resolve()
            )
            if not staging_path.exists() or not staging_path.is_file():
                raise ValidationError(f"asset file not found: {staging_path}")
            relative_path = self._copy_asset_to_root(staging_path, paper_code)
            mime_type = str(
                raw_asset.get("mimeType")
                or _detect_image_mime_from_bytes(staging_path)
                or mimetypes.guess_type(staging_path.name)[0]
                or ""
            ).strip()
            role = str(raw_asset.get("role") or "").strip() or (role_prefix or "stem")
            metadata_payload = raw_asset.get("metadata") or {}
            if not isinstance(metadata_payload, dict):
                raise ValidationError("asset.metadata must be an object")
            assets.append(
                ResolvedAsset(
                    role=role,
                    file_path=relative_path,
                    mime_type=mime_type,
                    metadata=metadata_payload,
                    display_order=index,
                )
            )
        return assets

    def _copy_asset_to_root(self, staging_path: Path, paper_code: str) -> str:
        """Copy staging asset to `assets_root / paper_code / assets / <basename>`.

        Returns the **relative** path (`<paper_code>/assets/<basename>`) for DB
        storage. Idempotent — same size at dst skips copy. paper_code 已 upper()
        过 (跟 Paper.paper_code 一致), 不再 normalize.
        """
        import shutil

        basename = staging_path.name
        relative_path = f"{paper_code}/assets/{basename}"
        target_path = (self._assets_root / relative_path).resolve()
        target_path.parent.mkdir(parents=True, exist_ok=True)
        if target_path.exists() and target_path.stat().st_size == staging_path.stat().st_size:
            return relative_path
        shutil.copy2(staging_path, target_path)
        return relative_path

    def _infer_paper_is_gradable(self, payload: dict[str, Any]) -> bool:
        explicit = self._optional_bool(payload.get("isGradable"), default=None)
        if explicit is not None:
            return explicit
        return not self._infer_uses_placeholder_answers(payload)

    def _infer_uses_placeholder_answers(self, payload: dict[str, Any]) -> bool:
        explicit = self._optional_bool(payload.get("usesPlaceholderAnswers"), default=None)
        if explicit is not None:
            return explicit
        sections = payload.get("sections")
        if not isinstance(sections, list):
            return False
        for section in sections:
            if not isinstance(section, dict):
                continue
            blocks = section.get("blocks")
            if not isinstance(blocks, list):
                continue
            for block in blocks:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "question":
                    if self._question_uses_placeholder_answers(block):
                        return True
                    continue
                for question_payload in block.get("questions", []):
                    if isinstance(question_payload, dict) and self._question_uses_placeholder_answers(question_payload):
                        return True
        return False

    def _question_uses_placeholder_answers(self, question_payload: dict[str, Any]) -> bool:
        explicit = self._optional_bool(question_payload.get("usesPlaceholderAnswers"), default=None)
        if explicit is not None:
            return explicit
        special_payload = question_payload.get("specialPayload")
        if (
            isinstance(special_payload, dict)
            and self._optional_bool(special_payload.get("placeholderAnswer"), default=None)
        ):
            return True
        tags = question_payload.get("tags")
        if isinstance(tags, list) and any(str(tag).strip().lower() == "placeholder-answer" for tag in tags):
            return True
        explanation_text = str(question_payload.get("explanationText") or "")
        return "Placeholder answer for render verification only." in explanation_text

    def _infer_question_is_gradable(self, payload: dict[str, Any], *, fallback: bool) -> bool:
        explicit = self._optional_bool(payload.get("isGradable"), default=None)
        if explicit is not None:
            return explicit
        return not self._question_uses_placeholder_answers(payload) and fallback

    def _get_paper_with_current_revision(self, paper_code: str) -> Paper:
        stmt = (
            select(Paper)
            .where(Paper.paper_code == paper_code.strip().upper())
            .options(joinedload(Paper.current_revision))
        )
        paper = self.session.scalar(stmt)
        if paper is None:
            raise NotFoundError("paper not found")
        return paper

    def _get_paper_with_revisions(self, paper_code: str) -> Paper:
        stmt = (
            select(Paper)
            .where(Paper.paper_code == paper_code.strip().upper())
            .options(
                joinedload(Paper.current_revision),
                selectinload(Paper.revisions).selectinload(PaperRevision.release_audits),
            )
        )
        paper = self.session.scalar(stmt)
        if paper is None:
            raise NotFoundError("paper not found")
        return paper

    def _load_revision_with_content(self, revision_id: int) -> PaperRevision:
        stmt = (
            select(PaperRevision)
            .where(PaperRevision.id == revision_id)
            .options(
                joinedload(PaperRevision.paper),
                selectinload(PaperRevision.sections),
                selectinload(PaperRevision.blocks).joinedload(PaperBlock.section),
                selectinload(PaperRevision.material_groups).selectinload(MaterialGroup.assets),
                selectinload(PaperRevision.questions).selectinload(Question.options),
                selectinload(PaperRevision.questions).selectinload(Question.assets),
                selectinload(PaperRevision.questions).selectinload(Question.tags),
                selectinload(PaperRevision.release_audits),
            )
        )
        revision = self.session.scalar(stmt)
        if revision is None:
            raise NotFoundError("revision not found")
        return revision

    def _get_question(self, question_id: int) -> Question:
        stmt = (
            select(Question)
            .where(Question.id == question_id)
            .options(
                joinedload(Question.paper_revision).joinedload(PaperRevision.paper),
                selectinload(Question.options),
                selectinload(Question.assets),
                selectinload(Question.tags),
            )
        )
        question = self.session.scalar(stmt)
        if question is None:
            raise NotFoundError("question not found")
        return question

    def _get_practice_session(self, session_id: int, *, user: User | None) -> PracticeSession:
        stmt = (
            select(PracticeSession)
            .where(PracticeSession.id == session_id)
            .options(
                joinedload(PracticeSession.paper),
                joinedload(PracticeSession.user),
                joinedload(PracticeSession.paper_revision).joinedload(PaperRevision.paper),
                selectinload(PracticeSession.answers).joinedload(PracticeSessionAnswer.question).selectinload(Question.options),
            )
        )
        session = self.session.scalar(stmt)
        if session is None:
            raise NotFoundError("practice session not found")
        # P0-1 fix (security review 2026-04-30): anonymous fallthrough 跨用户
        # data leak — 旧逻辑 `if user is not None and session.user_id != user.id`
        # 在 user=None (anonymous, get_optional_current_user 路径) 时跳过 ownership
        # check, 让任意人能枚举 session_id 读 logged-in user 的 answers/score.
        # 修: anonymous 必须命中自己的 guest user (route 30 注释 "anonymous PoC
        # demo OK" 是 by-design — 匿名 demo 起 session 落 guest user, 后续读必须
        # 仍是同 guest). 跨用户返 404 不暴露存在性, 跟 study_plans /
        # llm_conversations / essay_grading 对齐.
        owner = user or self._get_or_create_guest_user()
        if session.user_id != owner.id:
            raise NotFoundError("practice session not found")
        return session

    def _get_session_with_revision_content(
        self, session_id: int, *, user: User | None
    ) -> PracticeSession:
        # Specialised helper for `get_session_result`. Mirrors the base
        # `_get_practice_session` options and extends them with the revision
        # content graph so the caller doesn't have to issue a second query via
        # `_load_revision_with_content`. Kept separate rather than inlined into
        # `_get_practice_session` because the other callers (`submit_session_answer`,
        # `complete_session`) don't need the sections/blocks/material_groups
        # tree and shouldn't pay for that eager-load every call.
        stmt = (
            select(PracticeSession)
            .where(PracticeSession.id == session_id)
            .options(
                joinedload(PracticeSession.paper),
                joinedload(PracticeSession.user),
                joinedload(PracticeSession.paper_revision).joinedload(PaperRevision.paper),
                joinedload(PracticeSession.paper_revision).selectinload(PaperRevision.sections),
                joinedload(PracticeSession.paper_revision)
                .selectinload(PaperRevision.blocks)
                .joinedload(PaperBlock.section),
                joinedload(PracticeSession.paper_revision)
                .selectinload(PaperRevision.material_groups)
                .selectinload(MaterialGroup.assets),
                joinedload(PracticeSession.paper_revision)
                .selectinload(PaperRevision.questions)
                .selectinload(Question.options),
                joinedload(PracticeSession.paper_revision)
                .selectinload(PaperRevision.questions)
                .selectinload(Question.assets),
                joinedload(PracticeSession.paper_revision)
                .selectinload(PaperRevision.questions)
                .selectinload(Question.tags),
                joinedload(PracticeSession.paper_revision).selectinload(
                    PaperRevision.release_audits
                ),
                selectinload(PracticeSession.answers)
                .joinedload(PracticeSessionAnswer.question)
                .selectinload(Question.options),
            )
        )
        session = self.session.scalar(stmt)
        if session is None:
            raise NotFoundError("practice session not found")
        # P0-1 fix: 同 _get_practice_session, anonymous 跨用户 leak fix.
        owner = user or self._get_or_create_guest_user()
        if session.user_id != owner.id:
            raise NotFoundError("practice session not found")
        return session

    def _answered_question_count(self, session_id: int) -> int:
        count = self.session.scalar(
            select(func.count())
            .select_from(PracticeSessionAnswer)
            .where(PracticeSessionAnswer.session_id == session_id)
        )
        return int(count or 0)

    def _build_blueprint(
        self,
        revision: PaperRevision,
    ) -> tuple[
        schemas.PaperSummaryV2,
        list[schemas.PaperExamSectionOutV2],
        list[schemas.PaperExamBlockOutV2],
        list[schemas.PracticeQuestionItemV2],
        list[schemas.MaterialGroupOutV2],
    ]:
        # Phase D (P3 backlog): 拆 _build_blueprint_lookups /
        # _build_blueprint_sections / _build_blueprint_blocks 三 SRP helper.
        paper = revision.paper
        question_lookup, material_group_lookup, question_ids_by_block = (
            self._build_blueprint_lookups(revision)
        )
        sections = self._build_blueprint_sections(revision)
        blocks = self._build_blueprint_blocks(
            revision, question_lookup, material_group_lookup, question_ids_by_block
        )
        # 把 blocks 按 section_id 分组挂回 sections.
        section_blocks: dict[str, list[schemas.PaperExamBlockOutV2]] = {}
        for block in blocks:
            section_blocks.setdefault(block.section_id, []).append(block)
        for section in sections:
            section.blocks = section_blocks.get(section.section_id or section.id, [])
        return (
            self._serialize_paper_summary(paper, revision),
            sections,
            blocks,
            list(question_lookup.values()),
            list(material_group_lookup.values()),
        )

    def _build_blueprint_lookups(
        self, revision: PaperRevision
    ) -> tuple[
        dict[int, schemas.PracticeQuestionItemV2],
        dict[int, schemas.MaterialGroupOutV2],
        dict[int, list[int]],
    ]:
        """3 个 lookup dict 一次性聚合 (paper question + material group + ids-by-block)."""
        paper = revision.paper
        question_lookup = {
            question.id: self._serialize_practice_question(question, paper, revision)
            for question in self._ordered_questions(revision)
        }
        material_group_lookup = {
            group.id: self._serialize_material_group(group, paper=paper, revision=revision)
            for group in sorted(revision.material_groups, key=lambda item: item.display_order)
        }
        question_ids_by_block: dict[int, list[int]] = {}
        for question in self._ordered_questions(revision):
            question_ids_by_block.setdefault(question.block_id, []).append(question.id)
        return question_lookup, material_group_lookup, question_ids_by_block

    def _build_blueprint_sections(
        self, revision: PaperRevision
    ) -> list[schemas.PaperExamSectionOutV2]:
        """Section schema list (空 blocks, 上层挂)."""
        return [
            schemas.PaperExamSectionOutV2(
                id=section.section_key,
                section_id=section.section_key,
                title=section.title,
                instruction_text=section.instruction_text,
                question_count=section.question_count,
                description=section.instruction_text or None,
            )
            for section in self._ordered_sections(revision)
        ]

    def _build_blueprint_blocks(
        self,
        revision: PaperRevision,
        question_lookup: dict[int, schemas.PracticeQuestionItemV2],
        material_group_lookup: dict[int, schemas.MaterialGroupOutV2],
        question_ids_by_block: dict[int, list[int]],
    ) -> list[schemas.PaperExamBlockOutV2]:
        """Block schema list, 跟 question / material_group lookup wire."""
        blocks: list[schemas.PaperExamBlockOutV2] = []
        for block in self._ordered_blocks(revision):
            question_ids = question_ids_by_block.get(block.id, [])
            block_question = (
                question_lookup.get(question_ids[0])
                if block.block_type == "question" and question_ids
                else None
            )
            block_material_group = (
                material_group_lookup.get(block.material_group.id)
                if block.material_group is not None
                else None
            )
            blocks.append(
                schemas.PaperExamBlockOutV2(
                    type=block.block_type,
                    section_id=block.section.section_key,
                    question_id=question_ids[0]
                    if block.block_type == "question" and question_ids
                    else None,
                    material_group_id=block.material_group.id
                    if block.material_group is not None
                    else None,
                    question_ids=question_ids,
                    block_id=block.id,
                    question=block_question,
                    material_group=block_material_group,
                )
            )
        return blocks

    def _serialize_paper_summary(self, paper: Paper, revision: PaperRevision) -> schemas.PaperSummaryV2:
        return schemas.PaperSummaryV2(
            id=paper.id,
            paper_code=paper.paper_code,
            paper_name=revision.paper_name,
            exam_year=revision.exam_year,
            source_provider=revision.source_provider,
            source_kind=revision.source_kind,
            is_gradable=revision.is_gradable,
            visible_in_public=revision.visible_in_public,
            sort_order=revision.sort_order,
            question_count=revision.question_count,
            uses_placeholder_answers=revision.uses_placeholder_answers,
            current_revision_id=paper.current_revision_id,
            current_revision_number=(
                paper.current_revision.revision_number
                if paper.current_revision is not None
                else None
            ),
            description=revision.source_kind,
        )

    def _serialize_revision_summary(self, revision: PaperRevision) -> schemas.PaperRevisionSummary:
        return schemas.PaperRevisionSummary(
            id=revision.id,
            revision_number=revision.revision_number,
            sort_order=revision.sort_order,
            paper_name=revision.paper_name,
            exam_year=revision.exam_year,
            source_provider=revision.source_provider,
            source_kind=revision.source_kind,
            is_gradable=revision.is_gradable,
            uses_placeholder_answers=revision.uses_placeholder_answers,
            visible_in_public=revision.visible_in_public,
            question_count=revision.question_count,
            status="published" if revision.is_published else "draft",
            created_at=revision.created_at,
            published_at=revision.published_at,
        )

    def _serialize_admin_paper_summary(self, paper: Paper) -> schemas.AdminPaperSummaryV2:
        revisions = self._ordered_revisions(paper)
        latest_revision = revisions[-1] if revisions else None
        return schemas.AdminPaperSummaryV2(
            id=paper.id,
            paper_code=paper.paper_code,
            paper_name=paper.paper_name,
            exam_year=paper.exam_year,
            source_provider=paper.source_provider,
            source_kind=paper.source_kind,
            revision_count=len(revisions),
            current_revision=(
                self._serialize_revision_summary(paper.current_revision)
                if paper.current_revision is not None
                else None
            ),
            latest_revision=self._serialize_revision_summary(latest_revision) if latest_revision is not None else None,
            updated_at=paper.updated_at,
        )

    def _serialize_question_list_item(
        self,
        question: Question,
        paper: Paper,
        revision: PaperRevision,
    ) -> schemas.QuestionListItemV2:
        return schemas.QuestionListItemV2(
            id=question.id,
            position=question.position,
            source_uuid=question.source_uuid,
            question_kind=question.question_kind,
            subtype_name=question.subtype_name,
            second_subtype_name=question.second_subtype_name,
            raw_render_type=question.raw_render_type,
            stem_text=_rewrite_asset_urls(question.stem_text, question.assets),
            difficulty_code=question.difficulty_code,
            exam_year=question.exam_year,
            source_provider=question.source_provider,
            source_kind=question.source_kind,
            is_gradable=question.is_gradable,
            renderer_key=question.renderer_key,
            enabled=question.enabled,
            tags=[
                schemas.TagSummaryV2(id=tag.id, name=tag.name)
                for tag in sorted(question.tags, key=lambda item: item.name)
            ],
            material_group_id=question.material_group_id,
            paper_code=paper.paper_code,
            paper_name=revision.paper_name,
            revision_number=revision.revision_number,
        )

    def _serialize_question_detail(
        self,
        question: Question,
        paper: Paper,
        revision: PaperRevision,
    ) -> schemas.QuestionDetailV2:
        # P1 review fix Phase A.1: 拆 _serialize_question_options /
        # _serialize_question_assets / _build_question_content helper SRP.
        # asset URL 一处算一次, 主函数仅做 wire.
        rewritten_stem = _rewrite_asset_urls(question.stem_text, question.assets)
        rewritten_explanation = _rewrite_asset_urls(question.explanation_text, question.assets)
        sorted_options = sorted(question.options, key=lambda item: item.display_order)
        rewritten_option_text = {
            option.id: _rewrite_asset_urls(option.option_text, question.assets)
            for option in sorted_options
        }
        type_payload = question.type_payload_json
        essay_metadata = (
            _extract_essay_metadata(type_payload)
            if question.renderer_key == "essay"
            else None
        )
        return schemas.QuestionDetailV2(
            **self._serialize_question_list_item(question, paper, revision).model_dump(),
            explanation_text=rewritten_explanation,
            options=self._serialize_question_options(sorted_options, rewritten_option_text),
            assets=self._serialize_question_assets(question.assets),
            special_payload=question.special_payload_json,
            type_payload=type_payload,
            selection_mode=selection_mode_for_renderer(question.renderer_key),
            canonical_top_type=question.canonical_top_type,
            canonical_subtype=question.canonical_subtype,
            canonical_second_subtype=question.canonical_second_subtype,
            question_id=question.id,
            paper_revision_id=revision.id,
            section_id=question.section.section_key,
            block_id=question.block_id,
            question_no=question.position,
            content=_build_question_content(
                rewritten_stem,
                sorted_options,
                rewritten_option_text,
                rewritten_explanation,
                essay_metadata=essay_metadata,
            ),
        )

    def _serialize_question_options(
        self,
        sorted_options: list[QuestionOption],
        rewritten_option_text: dict[int, str],
    ) -> list[schemas.OptionOutV2]:
        return [
            schemas.OptionOutV2(
                id=option.id,
                option_key=option.option_key,
                option_text=rewritten_option_text[option.id],
                display_order=option.display_order,
                key=option.option_key,
                text=rewritten_option_text[option.id],
                is_correct=None,
            )
            for option in sorted_options
        ]

    def _serialize_question_assets(
        self, assets: list[QuestionAsset]
    ) -> list[schemas.QuestionAssetOutV2]:
        return [
            schemas.QuestionAssetOutV2(
                id=asset.id,
                asset_role=asset.asset_role,
                mime_type=asset.mime_type,
                display_order=asset.display_order,
                metadata=asset.metadata_json,
                url=f"/api/v2/assets/questions/{asset.id}",
            )
            for asset in sorted(assets, key=lambda item: item.display_order)
        ]

    def _serialize_admin_question_detail(
        self,
        question: Question,
        paper: Paper,
        revision: PaperRevision,
    ) -> schemas.AdminQuestionDetailV2:
        return schemas.AdminQuestionDetailV2(
            **self._serialize_question_detail(question, paper, revision).model_dump(),
            answer_text=question.answer_text,
            answer_keys=deserialize_answer_text(question.answer_text),
            source_payload=question.source_payload_json,
            canonical_mapping_source=question.canonical_mapping_source,
        )

    def _serialize_paper_question(
        self,
        question: Question,
        paper: Paper,
        revision: PaperRevision,
    ) -> schemas.PaperQuestionItemV2:
        return schemas.PaperQuestionItemV2(
            **self._serialize_question_detail(question, paper, revision).model_dump()
        )

    def _serialize_practice_question(
        self, question: Question, paper: Paper, revision: PaperRevision
    ) -> schemas.PracticeQuestionItemV2:
        rewritten_stem = _rewrite_asset_urls(question.stem_text, question.assets)
        sorted_options = sorted(question.options, key=lambda item: item.display_order)
        rewritten_option_text = {
            option.id: _rewrite_asset_urls(option.option_text, question.assets)
            for option in sorted_options
        }
        type_payload = question.type_payload_json
        essay_metadata = (
            _extract_essay_metadata(type_payload)
            if question.renderer_key == "essay"
            else None
        )
        return schemas.PracticeQuestionItemV2(
            **self._serialize_question_list_item(question, paper, revision).model_dump(),
            options=self._serialize_question_options(sorted_options, rewritten_option_text),
            assets=self._serialize_question_assets(question.assets),
            special_payload=question.special_payload_json,
            type_payload=type_payload,
            selection_mode=selection_mode_for_renderer(question.renderer_key),
            canonical_top_type=question.canonical_top_type,
            canonical_subtype=question.canonical_subtype,
            canonical_second_subtype=question.canonical_second_subtype,
            question_id=question.id,
            paper_revision_id=revision.id,
            section_id=question.section.section_key,
            block_id=question.block_id,
            question_no=question.position,
            content=_build_practice_question_content(
                rewritten_stem,
                sorted_options,
                rewritten_option_text,
                essay_metadata=essay_metadata,
            ),
        )

    def _serialize_material_group(
        self,
        material_group: MaterialGroup,
        *,
        paper: Paper,
        revision: PaperRevision,
    ) -> schemas.MaterialGroupOutV2:
        return schemas.MaterialGroupOutV2(
            id=material_group.id,
            source_group_uuid=material_group.source_group_uuid,
            group_kind=material_group.group_kind,
            title=material_group.title,
            material_text=material_group.material_text,
            instruction_text=material_group.instruction_text,
            payload=material_group.payload_json,
            assets=[
                schemas.MaterialGroupAssetOutV2(
                    id=asset.id,
                    asset_role=asset.asset_role,
                    mime_type=asset.mime_type,
                    display_order=asset.display_order,
                    metadata=asset.metadata_json,
                    url=f"/api/v2/assets/material-groups/{asset.id}",
                )
                for asset in sorted(material_group.assets, key=lambda item: item.display_order)
            ],
            question_ids=[question.id for question in sorted(material_group.questions, key=lambda item: item.position)],
            material_group_id=material_group.id,
            block_id=material_group.block_id,
            content=material_group.material_text,
            questions=[
                self._serialize_practice_question(question, paper, revision)
                for question in sorted(material_group.questions, key=lambda item: item.position)
            ],
        )

    def _serialize_import_job(self, job: ImportJob) -> schemas.ImportJobSummary:
        return schemas.ImportJobSummary(
            id=job.id,
            source_name=job.source_name,
            status=_import_job_status(job.status),
            total_files=job.total_files,
            imported_files=job.imported_files,
            failed_files=job.failed_files,
            imported_papers=job.imported_papers,
            imported_questions=job.imported_questions,
            created_at=job.created_at,
            completed_at=job.completed_at,
            items=[
                schemas.ImportJobItemSummary(
                    id=item.id,
                    filename=item.filename,
                    paper_code=item.paper_code,
                    paper_name=item.paper_name,
                    revision_id=item.revision_id,
                    revision_number=item.revision_number,
                    status=_import_job_item_status(item.status),
                    imported_question_count=item.imported_question_count,
                    source_hash=item.source_hash,
                    error_message=item.error_message,
                    created_at=item.created_at,
                )
                for item in job.items
            ],
        )

    def _serialize_session_summary(self, session: PracticeSession) -> schemas.PracticeSessionSummaryV2:
        answers = sorted(session.answers, key=lambda item: (item.display_order, item.id))
        answered_questions = len(answers)
        correct_count = sum(1 for item in answers if item.is_correct)
        wrong_count = answered_questions - correct_count
        accuracy_rate = round((correct_count / answered_questions * 100), 1) if answered_questions else 0.0
        return schemas.PracticeSessionSummaryV2(
            session_id=session.id,
            mode=session.mode,
            paper_code=session.paper.paper_code if session.paper is not None else None,
            paper_name=session.paper_revision.paper_name if session.paper_revision is not None else None,
            started_at=session.started_at,
            completed_at=session.completed_at,
            total_questions=session.total_questions,
            answered_questions=answered_questions,
            correct_count=correct_count,
            wrong_count=wrong_count,
            accuracy_rate=accuracy_rate,
        )

    def _validate_selected_answer_keys(
        self,
        question: Question,
        selected_answer_keys: list[str],
        *,
        allow_empty: bool = False,
    ) -> None:
        # Subagent review P1-3: essay 走 LLM 异步评分 (Slice 2c POST /api/v2/essay/grade),
        # 不能走标准 submit 路径 (无 options 可对照, 评分逻辑完全不同). EssayRenderer
        # 已 wire 进 dispatcher, 防止任何路径误把 essay 答案当行测题塞进 sessions.
        # Empty submit (清空) 仍允许 (allow_empty), 否则报清晰错误指向 essay endpoint.
        if question.renderer_key == "essay":
            if not selected_answer_keys and allow_empty:
                return
            raise ValidationError(
                "essay questions are graded via /api/v2/essay/grade (Slice 2c), not via session answer endpoints"
            )
        if not selected_answer_keys:
            if allow_empty:
                return
            raise ValidationError("selectedAnswerKeys cannot be empty")
        available_keys = {option.option_key for option in question.options}
        invalid_keys = [key for key in selected_answer_keys if key not in available_keys]
        if invalid_keys:
            raise ValidationError(f"invalid answer keys: {', '.join(invalid_keys)}")

    def _ordered_sections(self, revision: PaperRevision) -> list[PaperSection]:
        return sorted(revision.sections, key=lambda item: (item.display_order, item.id))

    def _ordered_blocks(self, revision: PaperRevision) -> list[PaperBlock]:
        return sorted(revision.blocks, key=lambda item: (item.display_order, item.id))

    def _ordered_questions(self, revision: PaperRevision) -> list[Question]:
        return sorted(revision.questions, key=lambda item: (item.position, item.id))

    def _ordered_revisions(self, paper: Paper) -> list[PaperRevision]:
        return sorted(paper.revisions, key=lambda item: (item.revision_number, item.id))

    def _required_string(self, payload: dict[str, Any], key: str) -> str:
        value = str(payload.get(key) or "").strip()
        if not value:
            raise ValidationError(f"{key} is required")
        return value

    def _optional_source_value(self, value: Any, fallback: str | None = None) -> str | None:
        resolved = str(value or "").strip()
        return resolved or fallback

    def _optional_year(self, value: Any, *, fallback: int | None = None) -> int | None:
        if value in (None, ""):
            return fallback
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError(f"invalid year: {value}") from exc

    def _normalize_upload_filename(self, filename: str | None) -> str:
        return str(filename or "paper.standard.json").replace("\\", "/").strip("/")

    def _resolve_upload_base_dir(self, base_dir: Path, normalized_filename: str) -> Path:
        parent = Path(normalized_filename).parent
        return (base_dir / parent).resolve() if str(parent) != "." else base_dir.resolve()

    def _optional_bool(self, value: Any, *, default: bool | None) -> bool | None:
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "y"}:
            return True
        if normalized in {"0", "false", "no", "n"}:
            return False
        raise ValidationError(f"invalid boolean: {value}")

    def _normalize_difficulty(self, raw_value: str) -> str:
        value = raw_value.strip().lower()
        return value or "unknown"
