from __future__ import annotations

from datetime import date
from typing import Annotated, Any, Literal

from pydantic import ConfigDict, Field

from sikao_api.core.schemas import CamelModel, UtcDatetime, to_camel


class TagSummaryV2(CamelModel):
    id: int
    name: str


class QuestionAssetOutV2(CamelModel):
    id: int
    asset_role: str
    mime_type: str
    display_order: int
    metadata: dict[str, Any]
    url: str


class MaterialGroupAssetOutV2(CamelModel):
    id: int
    asset_role: str
    mime_type: str
    display_order: int
    metadata: dict[str, Any]
    url: str


class OptionOutV2(CamelModel):
    id: int
    option_key: str
    option_text: str
    display_order: int
    key: str | None = None
    text: str | None = None
    is_correct: bool | None = None


class PaperRevisionSummary(CamelModel):
    id: int
    revision_number: int
    sort_order: int
    paper_name: str
    exam_year: int | None
    source_provider: str | None
    source_kind: str | None
    is_gradable: bool
    uses_placeholder_answers: bool
    visible_in_public: bool
    question_count: int
    status: Literal["draft", "published"]
    created_at: UtcDatetime
    published_at: UtcDatetime | None = None


class PaperSummaryV2(CamelModel):
    id: int
    paper_code: str
    paper_name: str
    exam_year: int | None
    source_provider: str | None
    source_kind: str | None
    is_gradable: bool
    visible_in_public: bool
    sort_order: int
    question_count: int
    uses_placeholder_answers: bool
    current_revision_id: int | None = None
    current_revision_number: int | None = None
    description: str | None = None


class PaperDetailV2(CamelModel):
    paper: PaperSummaryV2 | None = None
    current_revision: PaperRevisionSummary | None = None
    revision_id: int | None = None
    paper_code: str | None = None
    status: str | None = None
    question_count: int | None = None


class QuestionListItemV2(CamelModel):
    id: int
    position: int
    source_uuid: str
    question_kind: str
    subtype_name: str
    second_subtype_name: str | None
    raw_render_type: str | None = None
    stem_text: str
    difficulty_code: str
    exam_year: int | None
    source_provider: str | None
    source_kind: str | None
    is_gradable: bool
    renderer_key: str
    enabled: bool
    tags: list[TagSummaryV2]
    material_group_id: int | None
    paper_code: str
    paper_name: str
    revision_number: int


class QuestionDetailV2(QuestionListItemV2):
    explanation_text: str
    options: list[OptionOutV2]
    assets: list[QuestionAssetOutV2]
    special_payload: dict[str, Any]
    type_payload: dict[str, Any]
    selection_mode: str
    canonical_top_type: str | None
    canonical_subtype: str | None
    canonical_second_subtype: str | None
    question_id: int | None = None
    paper_revision_id: int | None = None
    section_id: str | None = None
    block_id: int | None = None
    question_no: int | None = None
    content: dict[str, Any] | None = None


class AdminQuestionDetailV2(QuestionDetailV2):
    answer_text: str
    answer_keys: list[str]
    source_payload: dict[str, Any]
    canonical_mapping_source: str | None = None


class PaperQuestionItemV2(QuestionDetailV2):
    pass


class PracticeQuestionItemV2(QuestionListItemV2):
    options: list[OptionOutV2]
    assets: list[QuestionAssetOutV2]
    special_payload: dict[str, Any]
    type_payload: dict[str, Any]
    selection_mode: str
    canonical_top_type: str | None
    canonical_subtype: str | None
    canonical_second_subtype: str | None
    question_id: int | None = None
    paper_revision_id: int | None = None
    section_id: str | None = None
    block_id: int | None = None
    question_no: int | None = None
    content: dict[str, Any] | None = None


class PaperExamSectionOutV2(CamelModel):
    id: str
    title: str
    instruction_text: str
    question_count: int
    section_id: str | None = None
    description: str | None = None
    blocks: list[PaperExamBlockOutV2] = Field(default_factory=list)


class PaperExamBlockOutV2(CamelModel):
    type: str
    section_id: str
    question_id: int | None = None
    material_group_id: int | None = None
    question_ids: list[int] = Field(default_factory=list)
    block_id: int | None = None
    question: PracticeQuestionItemV2 | None = None
    material_group: MaterialGroupOutV2 | None = None


class MaterialGroupOutV2(CamelModel):
    id: int
    source_group_uuid: str
    group_kind: str
    title: str
    material_text: str
    instruction_text: str
    payload: dict[str, Any]
    assets: list[MaterialGroupAssetOutV2]
    question_ids: list[int]
    material_group_id: int | None = None
    block_id: int | None = None
    content: str | None = None
    questions: list[PracticeQuestionItemV2] = Field(default_factory=list)


class PracticeSessionMetaV2(CamelModel):
    session_id: int
    mode: str
    total_questions: int
    started_at: UtcDatetime


class PracticeSavedAnswerV2(CamelModel):
    question_id: int
    selected_answer_keys: list[str]


class PracticeSessionStartV2(CamelModel):
    session: PracticeSessionMetaV2 | None = None
    paper: PaperSummaryV2 | None = None
    sections: list[PaperExamSectionOutV2]
    blocks: list[PaperExamBlockOutV2] | None = None
    questions: list[PracticeQuestionItemV2] | None = None
    material_groups: list[MaterialGroupOutV2] | None = None
    saved_answers: dict[str, list[str]]
    session_id: int | None = None
    paper_code: str | None = None
    paper_revision_id: int | None = None
    paper_name: str | None = None


class CustomPracticeStartPayload(CamelModel):
    top_type: str = Field(..., min_length=1)
    subtype: str | None = Field(default=None, min_length=1)
    second_subtype: str | None = Field(default=None, min_length=1)
    years: list[int] | None = None
    question_count: int = Field(..., ge=1, le=50)


class CustomPracticeSecondSubtypeFacetV2(CamelModel):
    name: str
    question_count: int
    years: list[int]


class CustomPracticeSubtypeFacetV2(CamelModel):
    name: str
    question_count: int
    years: list[int]
    second_subtypes: list[CustomPracticeSecondSubtypeFacetV2]


class CustomPracticeTopTypeFacetV2(CamelModel):
    name: str
    question_count: int
    years: list[int]
    subtypes: list[CustomPracticeSubtypeFacetV2]


class CustomPracticeFacetsResponseV2(CamelModel):
    total_questions: int
    years: list[int]
    top_types: list[CustomPracticeTopTypeFacetV2]


# Phase 1.1 (fenbi-merge) — 题库专项练习入口数据.
# 6 大类按 Question.canonical_top_type 聚合, 复用 custom_practice facets 已有
# 的分类字段. done_by_user = 该用户在此 top_type 下答对+答错的去重题数 (per
# D1: 单题 attempt 提交即记). 未登录调用方该字段为 0.
class CategorySummaryV2(CamelModel):
    top_type: str
    name: str
    total: int
    done_by_user: int


class CategoriesResponseV2(CamelModel):
    categories: list[CategorySummaryV2]


# Phase 1.2 (fenbi-merge) — 卷级用户状态 overlay.
# 独立 endpoint /papers/me/status, 不污染匿名 /papers 主响应 (SRP).
# 状态机 (D1):
#   untouched   : 该用户该 paperCode 下无任何 paper-bound session
#   in_progress : 存在 mode='paper_bound' AND completed_at IS NULL 的 session
#   done        : 至少 1 个 mode='paper_bound' AND completed_at IS NOT NULL session
# attempt_count 仅算 done; progress 仅 in_progress 时填 (取最新 in-progress
# session 的 answered/total).
class PaperProgressV2(CamelModel):
    answered: int
    total: int


class PaperUserStatusV2(CamelModel):
    paper_code: str
    user_status: Literal["untouched", "in_progress", "done"]
    attempt_count: int
    progress: PaperProgressV2 | None = None


class PaperUserStatusResponseV2(CamelModel):
    items: list[PaperUserStatusV2]


# Phase 5.2 (fenbi-merge) — 用户中心预测分.
# 算法 (D4 决策, 见 docs/plan/fenbi-merge-prototype-vs-reality.md):
#   - 取该用户近 N=30 套 paper-bound 已交卷 session
#   - 每套的 score = is_correct count / total_questions × 100  (0-100)
#   - 加权平均: w_i = 0.85^i (i=0 是最近一套), 自动归一
# MVP 不出击败 % 和趋势 — 那需要全站同卷分数分布, 推 follow-up.
# sample_size < 3 时 is_reference_only=True, 前端标 "参考值 · 样本少".
class PredictedScorePaperEntryV2(CamelModel):
    paper_code: str
    paper_name: str
    score: float
    completed_at: UtcDatetime


class PredictedScoreV2(CamelModel):
    predicted_score: float | None  # None = sample_size=0 (从未交卷)
    sample_size: int
    is_reference_only: bool  # True = sample_size < 3
    recent_papers: list[PredictedScorePaperEntryV2]


# Phase 5.5 (fenbi-merge) — 用户目标 (D5).
# MVP 范围: 只存 target_score (总分目标), 不依赖 exam_track 字段.
# 老 user 没有 row → GET 返 has_goal=False + 默认 None, 前端引导设置.
# module_targets 推 follow-up: 需 D5 全站均值阈值 200 数据先到位.
class UserGoalV2(CamelModel):
    has_goal: bool
    target_score: int | None  # 0-150 公考总分上限留余地


class UserGoalUpdateV2(CamelModel):
    target_score: Annotated[int, Field(ge=0, le=150)]


# Phase 3.7 (fenbi-merge) — 题级笔记 (markdown).
# 一个用户对一道题最多一条笔记 (PUT upsert). content 上限 16384 字符 (UTF-8
# 中文 ≈ 48KB, 一万汉字典型笔记仍宽松). qlink 用 [[#017]] markdown 语法,
# FE 渲染时自己解析跳转.
class QuestionNoteV2(CamelModel):
    has_note: bool
    content: str  # 没 note 时返 "" (FE 不需要二次判 null)
    updated_at: UtcDatetime | None  # 没 note 时 None


class QuestionNoteUpdateV2(CamelModel):
    content: Annotated[str, Field(max_length=16384)]


class PracticeSessionAnswerSubmissionV2(CamelModel):
    question_id: int
    selected_answer_keys: list[str] = Field(default_factory=list, max_length=8)


class PracticeSessionAnswerResultV2(CamelModel):
    session_id: int
    question_id: int
    # 独立 review KEY OBS #2 修: paper_position → display_order. answer 在
    # session 内展示顺序, 兼容 paper-bound (=question.position) + cross-paper
    # (=batch index).
    display_order: int
    selected_answer_keys: list[str]
    answered_questions: int
    total_questions: int
    completed: bool


class PracticeSessionSummaryV2(CamelModel):
    session_id: int
    mode: str
    paper_code: str | None
    paper_name: str | None
    started_at: UtcDatetime
    completed_at: UtcDatetime | None = None
    total_questions: int
    answered_questions: int
    correct_count: int
    wrong_count: int
    accuracy_rate: float


class PracticeSectionSummaryV2(CamelModel):
    section_id: str
    title: str
    instruction_text: str
    question_count: int
    answered_questions: int
    correct_count: int
    wrong_count: int
    accuracy_rate: float


class PracticeSessionAnswerOutV2(CamelModel):
    id: int
    question_id: int
    selected_answer_keys: list[str]
    correct_answer_keys: list[str]
    is_correct: bool
    answered_at: UtcDatetime


# v0.2 slice 3 — knowledge-point aggregation. Two layers, both 1-to-1 with
# Question fields:
#   - SubjectSummary: by Question.subject (5-9 行测/申论/公基 大模块)
#   - SubtypeSummary: by Question.canonical_subtype (~几十项 细类)
# Service falls back to scripts/backfill_question_subject.infer_subject when
# DB column is NULL (Phase 5.4a marked nullable). Per
# docs/plan/result-deep-analysis.md slice 3 (D3.B 两层).
class PracticeSubjectSummaryV2(CamelModel):
    subject: str
    question_count: int
    answered_questions: int
    correct_count: int
    wrong_count: int
    accuracy_rate: float


class PracticeSubtypeSummaryV2(CamelModel):
    # parent subject (None when the underlying question has no canonical
    # taxonomy at all). Frontend filters subtypes by subject in the
    # KnowledgePointFocus card.
    subject: str | None
    subtype: str
    question_count: int
    answered_questions: int
    correct_count: int
    wrong_count: int
    accuracy_rate: float


class PracticeSessionResultV2(CamelModel):
    session: PracticeSessionSummaryV2 | None = None
    section_summaries: list[PracticeSectionSummaryV2] | None = None
    # v0.2 slice 3 additive — Optional so old clients that don't request /
    # don't deserialize them stay green. Keep before blocks/questions to
    # match the natural reading order (overview → detail).
    subject_summaries: list[PracticeSubjectSummaryV2] | None = None
    subtype_summaries: list[PracticeSubtypeSummaryV2] | None = None
    blocks: list[PaperExamBlockOutV2] | None = None
    questions: list[PaperQuestionItemV2] | None = None
    material_groups: list[MaterialGroupOutV2] | None = None
    answers: list[PracticeSessionAnswerOutV2] | None = None
    session_id: int | None = None
    score: int | float | None = None
    total_questions: int | None = None
    correct_count: int | None = None
    incorrect_count: int | None = None
    unanswered_count: int | None = None
    user_answers: dict[str, list[str]] = Field(default_factory=dict)


class PracticeAttemptV2(CamelModel):
    id: int
    session_id: int
    question_id: int
    question_stem: str
    selected_option: str
    correct_option: str
    is_correct: bool
    created_at: UtcDatetime


class WrongQuestionV2(CamelModel):
    question_id: int
    question_stem: str
    latest_selected_option: str
    correct_option: str
    wrong_count: int


# ── Phase 5.4a 错题本 schemas ────────────────────────────────────────────────
# 对齐 frontend/src/types/api.d.ts 里的 WrongQuestionDetailV2 / List。
# 老的 WrongQuestionV2 被 /practice/history 继续使用（兼容），新接口用
# WrongQuestionDetailV2（含 mastery_level / options / paper 信息等细节）。


class WrongQuestionOptionV2(CamelModel):
    key: str
    text: str
    is_correct: bool


class WrongQuestionDetailV2(CamelModel):
    question_id: int
    stem: str
    options: list[WrongQuestionOptionV2]
    correct_answer_keys: list[str]
    user_latest_answer_keys: list[str]
    explanation: str
    subject: str | None
    # Phase 6.4 P2 — canonical_subtype 暴露给 frontend, 错题本 chip 筛选 + AI
    # 建议卡 CTA 跳转过来时 URL `?subtype=...` 能落 filter.
    subtype: str | None = None
    question_kind: str
    paper_code: str | None
    paper_name: str | None
    wrong_count: int
    mastery_level: str  # "not_mastered" | "reviewing" | "mastered"
    last_wrong_time: UtcDatetime
    consecutive_correct_count: int


class WrongQuestionListResponseV2(CamelModel):
    items: list[WrongQuestionDetailV2]
    total: int
    page: int
    page_size: int
    available_subjects: list[str]
    # 该用户错题里出现过的 subtype 全集 (sorted, 去 None) — 给 chip 筛选 UI 用.
    # 唯一构造点 services/exam_papers.py:1181 显式传 sorted(subtypes), 移除
    # default_factory 让 OpenAPI 标 required, 前端 generated.ts 同步 required
    # (前后端契约对齐 T-C3 v0.4 backlog P1).
    available_subtypes: list[str]


# ── SIKAO Wave 4 Phase 2C: xingce-wrongbook BE schemas ──────────────────────
# 7 新 endpoint + mastery 评估算法 + 蒙对识破 + peek + smart-review.
# 配 alembic 0019 (wrong_question_attempts 新表) + 0020 (扩 wrong_question_masteries
# 4 字段). FE 配套 wire 推下一 fixer (W2). heatmap endpoint + --data-* token
# 推 Wave 5 (master §3.7 token SSOT 拍板, 不在本 fixer 范围).


WrongBookViewFilter = Literal[
    "all", "todo", "doing", "danger", "meek", "ok", "new", "graduated"
]
WrongBookErrorReason = Literal[
    "knowledge_gap",
    "trap_caught",
    "careless",
    "misread",
    "time_pressure",
    "bluff",
]


class WrongQuestionAttemptOut(CamelModel):
    attempt_no: int
    selected_option_key: str
    duration_ms: int
    attempted_at: UtcDatetime
    error_reason: str | None = None
    is_correct: bool


class WrongBookSummary(CamelModel):
    """主页 hero 5 stat-strip 指标."""

    in_practice: int
    todo_count: int
    danger_count: int
    graduated_count: int
    weekly_new: int


class GraduationCandidate(CamelModel):
    """毕业候选 (consecutive_correct_count == 2)."""

    question_id: int
    stem: str
    knowledge_point: str | None = None
    consecutive_correct: int


class MarkMasteredResult(CamelModel):
    question_id: int
    mastery_level: str
    consecutive_correct_count: int


class PeekResult(CamelModel):
    """重做模式偷看答案 — 扣 peek_count, 返剩余."""

    peeked_reference: bool
    peek_remaining: int


class WrongBookSubmitPayload(CamelModel):
    """错题本提交 (重做模式) — 扩 PracticeSessionAnswerSubmissionV2 加耗时."""

    selected_option_keys: list[str]
    duration_ms: int = 0
    error_reason: str | None = None


class WrongBookSubmitResult(CamelModel):
    question_id: int
    is_correct: bool
    bluff_detected: bool
    mastery_level: str
    consecutive_correct_count: int
    bluff_count: int
    attempt_no: int


class SmartReviewToday(CamelModel):
    """智能复盘"今日"4 stat."""

    pushed_today: int
    finished_today: int
    streak_days: int
    days_to_exam: int


class SmartReviewNext(CamelModel):
    """智能复盘"下一题" — priority by mastery + 时间."""

    question_id: int
    mode: Literal["qifei", "single", "similar", "mock", "danger"]
    stem: str
    knowledge_point: str | None = None
    consecutive_correct_count: int
    last_wrong_time: UtcDatetime


# ── SIKAO Wave 5: xingce-wrongbook Heatmap (plan 5.2 #6) ─────────────────────


# 行测 5 模块短名 — heatmap 行固定顺序 (UI 显示用短名节省宽度).
WrongBookHeatmapSubject = Literal["言语", "数量", "判推", "资分", "常识"]


class WrongBookHeatmapCell(CamelModel):
    """Heatmap 单元格 — 一行内一个日期的错题强度.

    rate 为 None 表示该日无答题数据 (不是 0 错题, 而是没答题). 前端据此
    区分 "空白日" 跟 "答了但全对" 两态.
    """

    date: date  # ISO date e.g. 2026-04-13
    count: int  # 错题数
    rate: float | None = None  # 0-1, 当日错题率, None 表示无数据


class WrongBookHeatmapRow(CamelModel):
    """Heatmap 一行 — 一个 subject 在 days 窗口内的每日错题强度."""

    subject: WrongBookHeatmapSubject
    cells: list[WrongBookHeatmapCell]
    peak_idx: int | None = None  # 行内 max count 的 cell index; 全 0 时 None
    total: int  # 行内 sum count


class WrongBookHeatmapResponse(CamelModel):
    """Heatmap 完整 response — 5 行 × N 天 cell."""

    days: int  # 窗口长度 (7 / 30 / 90 / 180)
    rows: list[WrongBookHeatmapRow]  # 5 行固定 (言语/数量/判推/资分/常识)
    generated_at: UtcDatetime


# ── Phase 5.5 Dashboard schemas ─────────────────────────────────────────────


class HeatmapEntryV2(CamelModel):
    date: str  # YYYY-MM-DD (Asia/Shanghai 本地日)
    count: int
    rate: float  # 0-1；count==0 时 rate=0


class TrendEntryV2(CamelModel):
    date: str  # YYYY-MM-DD
    rate: float  # 0-1
    total: int


class KnowledgePointEntryV2(CamelModel):
    name: str  # Question.subject 或 "(未分类)"
    total: int
    correct: int
    rate: float  # 0-1
    category: str  # "strong"(>=0.8) | "ok"(0.6-0.8) | "weak"(<0.6)


class DashboardStatsV2(CamelModel):
    total_answered: int
    overall_accuracy: float
    current_streak_days: int  # Asia/Shanghai 本地日连续计数
    mastered_points_count: int  # wrong_question_masteries where level='mastered'
    total_wrong_questions: int  # wrong_question_masteries where level != 'mastered'
    # Slice 3e ABM: 按 PracticeSession.mode 分桶累计答题数 (answer-level).
    # 学习计划路线 3a 留下的 mode markers 在此首次消费.
    study_plan_answered: int = 0   # MODE_STUDY_PLAN[_CROSS_PAPER]
    retry_wrong_answered: int = 0  # MODE_RETRY_WRONG[_CROSS_PAPER]
    paper_bound_answered: int = 0  # MODE_PAPER + 任何未知 mode 兜底


class PracticeSummaryV2(CamelModel):
    total_attempts: int
    correct_count: int
    wrong_count: int
    accuracy_rate: float


class PracticeHistoryResponseV2(CamelModel):
    summary: PracticeSummaryV2
    recent_attempts: list[PracticeAttemptV2]
    wrong_questions: list[WrongQuestionV2]
    recent_sessions: list[PracticeSessionSummaryV2]
    recent_attempts_limit: int
    recent_sessions_limit: int


class ImportJobItemSummary(CamelModel):
    id: int
    filename: str
    paper_code: str | None
    paper_name: str | None
    revision_id: int | None
    revision_number: int | None
    status: Literal["completed", "failed"]
    imported_question_count: int
    source_hash: str | None
    error_message: str
    created_at: UtcDatetime


class ImportJobSummary(CamelModel):
    id: int
    source_name: str
    status: Literal["completed", "partial", "failed"]
    total_files: int
    imported_files: int
    failed_files: int
    imported_papers: int
    imported_questions: int
    created_at: UtcDatetime
    completed_at: UtcDatetime | None = None
    items: list[ImportJobItemSummary]


class EssayGradingSubmissionV2(CamelModel):
    """Slice 2c: POST /api/v2/essay/grade body — 提交一次申论作答给 LLM 评分.

    answer_text 上限 5000 字 (申论小作文 1000-1200 字 + buffer); 超大答案直接拒,
    防 LLM token 爆 (R7 cost 控制).
    """

    question_id: int
    answer_text: str = Field(min_length=1, max_length=5000)


class EssayDimensionV2(CamelModel):
    """5 维度评分单项 — plan §3.4.

    name: 论点准确 / 材料运用 / 语言 / 结构 / 字数符合度 (业务层 enum).
    weight: 0.30 / 0.25 / 0.20 / 0.15 / 0.10 (5 项加和 1.0).
    score: LLM 给 0-10, sanity check 业务层 clamp.
    """

    name: str
    weight: float
    score: float
    comment: str


class EssayFeedbackV2(CamelModel):
    """plan §4.2 EssayFeedbackV2 — feedback_json 序列化形.

    sample_answer 由 LLM 单 call 双输出 (跟 evaluation 一起返). suspicious 是
    业务层 sanity check 兜底标记 (5 维度全相等差 ≤0.5 / sampleAnswer 字数偏离
    ±20%, R10).
    """

    overall_score: float  # 0-100, 业务层按 weight 重算, 不信 LLM 的 overallScore
    dimensions: list[EssayDimensionV2]
    strengths: list[str]
    weaknesses: list[str]
    suggestions: list[str]
    sample_answer: str | None = None
    suspicious: bool = False


class EssayGradingV2(CamelModel):
    """单条 essay grading record 序列化形.

    pending / failed 时 score / feedback 为 None; failure_reason 仅 failed 时填.
    """

    id: int
    question_id: int
    answer_text: str
    status: Literal["pending", "completed", "failed"]
    score: float | None = None
    feedback: EssayFeedbackV2 | None = None
    failure_reason: str | None = None
    created_at: UtcDatetime
    graded_at: UtcDatetime | None = None


# ── PR13 P5: 申论草稿持久化 schemas ──────────────────────────────────────────


class EssayDraftSubmissionV2(CamelModel):
    """PR13 P5: POST /api/v2/essay/drafts body — 草稿 in-place upsert.

    跟 EssayGradingSubmissionV2 区分:
      - drafts: in-progress, autosave 写入, 同 (user, question) upsert
      - grade: terminal submit, insert-only, BackgroundTask 触发 LLM

    typed_draft 上限 5000 (跟 EssayGradingSubmissionV2.answer_text 同).
    handwritten_draft_metadata 是任意 dict (app-level shape, schema 不约束):
      {path?: str, mime_type?: str, asset_id?: int, uploaded_at?: str,
       stroke_count?: int}
    """

    question_id: int
    typed_draft: str = Field(default="", max_length=5000)
    handwritten_draft_metadata: dict[str, Any] | None = None


class EssayDraftV2(CamelModel):
    """单条 essay draft record 序列化形.

    saved_at = 首次创建时间; updated_at = 最近一次 upsert 时间. FE autosave
    显示 "已保存 X 秒前" 用 updated_at, 不用 saved_at.
    """

    id: int
    question_id: int
    typed_draft: str
    handwritten_draft_metadata: dict[str, Any] | None
    saved_at: UtcDatetime
    updated_at: UtcDatetime


# ── Phase D: 申论专项练习 (跨卷单题) schemas ─────────────────────────────────
# 5 大类 canonical_subtype 集合 (DB verify, 见 docs/plan):
#   归纳概括 / 大作文 / 综合分析 / 公文 / 应用文 / 提出对策
# 注: 公文 vs 应用文 在 canonical_subtype 是分开两类, 前端 chip 时合并显示
# "公文 · 应用文". 后端 endpoint 接收原始 subtype 串, 不在后端做合并.


class EssaySpecialtyQuestionItemV2(CamelModel):
    """专项列表单行: 题号 / 卷源 / stem 截断 / 字数限制 / 用户已练标记.

    stem 走前 200 char 截断 (HTML strip 业务层做); word_requirement 是
    "≤ 300 字" 这类显示串 (从 type_payload_json.wordLimitMax 派生).
    last_answered_at 为 None 表示当前 user 未答过该题 (LEFT JOIN miss).
    """

    question_id: int
    paper_code: str
    paper_name: str
    position: int
    stem: str
    word_requirement: str | None
    full_score: int | None
    last_answered_at: UtcDatetime | None


class EssaySpecialtyListResponseV2(CamelModel):
    """GET /api/v2/essay/specialty/questions 响应.

    page 1-based; total = 当前 subtype 命中题总数 (paginate ceil(total/pageSize)).
    """

    items: list[EssaySpecialtyQuestionItemV2]
    total: int
    page: int
    page_size: int


class EssayPaperListResponseV2(CamelModel):
    """GET /api/v2/papers/essay/list 响应.

    EssayPapers 专用分页 endpoint, 拆自 GET /papers 防 745 套申论卷全量铺
    DOM 把 LCP 拉爆 (CLAUDE.md §4 列表收口). Home 首屏 EssayPreviewCard
    继续走 GET /papers?kind=essay slice 前 2, 不动.

    page 1-based; total = 命中 essay 卷总数 (paginate ceil(total/pageSize)).
    """

    items: list[PaperSummaryV2]
    total: int
    page: int
    page_size: int


# ─── SIKAO Wave 4 Phase 2C: essay-specialty 聚合 endpoint schemas ────────
# 配套 docs/plan/sikao-module-essay-specialty-2026-05-11.md §3.
# 全部 read-only 聚合 (无 schema migration); 视觉/UX 见 design/SIKAO/handoff/
# modules/essay-specialty/essay-redesign.html.


class SpecialtyTotalsV2(CamelModel):
    """StatStrip 4 格汇总 + 平均分.

    practiced: 当前用户已"完成"批改 (status='completed') 的 distinct essay 题数
    total: 当前 public+enabled essay 题总数 (跨全部 paper)
    streak_days: Asia/Shanghai 本地日连续提交批改的天数 (按 graded_at)
    week_done: 最近 7 天内 completed batch 行数 (含重做同题, 跟 streak 区分)
    avg_score: 当前用户所有 completed batch 的算术平均 0-100, 无 batch 返 0
    """

    practiced: int
    total: int
    streak_days: int
    week_done: int
    avg_score: float


class SpecialtyResumeV2(CamelModel):
    """ResumeHero 续答 hero band 数据.

    根据用户最近一条 essay grading 流的"未完成"或"刚 完成 N-1 题"语义派生:
      - 取最近一条 EssayGradingRecord (任意 status), 跟它的 canonical_subtype 匹配
      - q_index = 此 subtype 下当前用户 distinct completed question_id 计数 + 1
      - q_total = 此 subtype 下 public+enabled essay 题总数
      - last_scores = 最近 5 条 completed 的 score (从新到旧)
      - week_goal = [本周 completed 数, 目标=7] (MVP 硬编码 7)

    没有任何 grading record → null (前端隐藏 ResumeHero).
    """

    type_name: str
    question_id: int
    q_index: int
    q_total: int
    last_scores: list[float]
    week_goal: list[int]  # [done, total]


class EssaySpecialtySummaryV2(CamelModel):
    """GET /api/v2/papers/essay/specialty/summary response.

    totals 永远填 (空 user 返 0); resume 可空 (无 grading record → None).
    """

    totals: SpecialtyTotalsV2
    resume: SpecialtyResumeV2 | None = None


class SpecialtySubtypeRowV2(CamelModel):
    """CategoryCard 子类行 (sub-grid 项).

    id / name / meta 同源: meta 形如 "2024 国考 · 第 1 题" 由最新一道该类题派生.
    status 三态:
      - done: 该用户已 completed 此题
      - progress: 用户有 pending grading record (尚未 completed)
      - pending: 用户未做
    """

    id: str  # f"q-{question_id}"
    question_id: int
    name: str
    meta: str
    practiced: int  # 0 / 1 (per-question)
    total: int  # 1 (per-question)
    status: Literal["pending", "progress", "done"]


class SpecialtyCategoryV2(CamelModel):
    """CategoryCard header + body.

    state='empty' 仅"公文" / "应用文" 题库未补齐场景 (MVP: total=0 时设 empty,
    非空设 None). overall_progress = practiced / total clamp [0, 1].
    """

    id: str  # subtype canonical 名 (e.g. "归纳概括")
    idx: int  # 1-based 顺序 (跟前端 SUBTYPE_CHIPS 对齐)
    name: str
    desc: str
    overall_progress: float  # 0..1
    practiced: int
    total: int
    sub_types: list[SpecialtySubtypeRowV2]
    state: Literal["empty"] | None = None


class EssaySpecialtyCategoriesResponseV2(CamelModel):
    """GET /api/v2/papers/essay/specialty/categories response.

    返 5 大类 (公文 / 应用文 已合并为单 "公文 · 应用文" 视觉类, 后端拆开 2 类
    各自返). 5 = 归纳概括 / 综合分析 / 提出对策 / 公文 / 应用文 / 大作文 (6 raw,
    前端合并显 5 卡).
    """

    cats: list[SpecialtyCategoryV2]


class EssayLastAttemptV2(CamelModel):
    """PaperRow lastAttempt: 该用户在此 paper 上最近一次 completed batch."""

    score: float
    submitted_at: UtcDatetime


class EssayPaperListItemV2Extended(CamelModel):
    """GET /api/v2/papers/essay/list (扩展) 单行.

    扩自 PaperSummaryV2: 加 region / track / difficulty / status / progress /
    last_attempt / pinned. region / track 从 source_provider + paper_code 派生
    (国考 / 省考 / sk=申论 vs gk=综合). difficulty 1-3 由 question_count 启发式
    (≤3=1 易 / 4=2 中 / ≥5=3 难). pinned MVP 全 False (pin endpoint 推后).
    """

    # 复用 PaperSummaryV2 核心字段 (camelCase serialize)
    id: int
    paper_code: str
    paper_name: str
    exam_year: int | None = None
    source_provider: str | None = None
    source_kind: str | None = None
    question_count: int
    current_revision_id: int | None = None
    # 扩展字段
    region: str  # "国考" / "省考" / "<provider>" / "其他"
    track: Literal["gk", "sk"] = "sk"  # 全 essay 卷固定 sk
    difficulty: Literal[1, 2, 3] | None = None
    status: Literal["todo", "doing", "done"] = "todo"
    progress: str = "0/0"  # 形如 "3/5" — completed question / total question
    last_attempt: EssayLastAttemptV2 | None = None
    pinned: bool = False


class EssayPapersListExtendedResponseV2(CamelModel):
    """GET /api/v2/papers/essay/list (扩字段版) 响应.

    跟原 EssayPaperListResponseV2 走的是同 endpoint 但 schema 完全不同 — 通过
    `extended=True` query param 切换. MVP 直接走新 schema (Y2-FE wire 完后,
    Home preview slice 走老 endpoint kind=essay, EssayPapers view 走 extended).
    """

    items: list[EssayPaperListItemV2Extended]
    total: int
    page: int
    page_size: int


class EssayPapersFiltersResponseV2(CamelModel):
    """GET /api/v2/papers/essay/filters response.

    返候选 chip 集合, 让前端不靠硬编码 region/year list:
      - regions: distinct source_provider (+ 国考 / 省考 派生 bucket)
      - years: distinct exam_year DESC
      - paper_types: distinct source_kind (按 import 来源, 现实多数 "真题")
    """

    regions: list[str]
    years: list[int]
    paper_types: list[str]


# ─── SIKAO Wave 4 Phase 行测 (sikao (6).zip mirror) — 行测专项聚合 schemas ─
# 配套 essay_specialty schemas 镜像设计, 全部 read-only 聚合 (无 schema migration);
# 视觉/UX 复用 essay-redesign.html (lhr 2026-05-12 zip (6) 提供) → 行测落地. 关键差异:
#   - 行测用 PracticeSession + PracticeSessionAnswer (有 is_correct, 无 score)
#   - 5 大类硬编码: 言语理解 / 判断推理 / 数量关系 / 资料分析 / 常识判断
#   - 实际 question 表 canonical_subtype 真值 (PG 截图 verify): 非 5 大类的杂类
#     (e.g. "公共基础知识" / "知觉速度与准确性" / "图形推理") 走关键字 prefix bucket
#     聚合到 5 大类, 详见 services/xingce_specialty.py _XINGCE_SUBTYPE_BUCKETS.


class XingceSpecialtyTotalsV2(CamelModel):
    """StatStrip 4 格汇总 + 平均正确率 (行测无 score → avgScore 改成 0-100 百分比正确率).

    practiced: 当前用户已答 (distinct question_id, 通过 PracticeSessionAnswer) 行测题数
    total: 当前 public+enabled+question_kind!='essay' 行测题总数 (跨全部 paper)
    streak_days: Asia/Shanghai 本地日连续答题的天数 (按 PracticeSessionAnswer.answered_at)
    week_done: 最近 7 天内 distinct PracticeSessionAnswer 数 (含同题再答, 跟 streak 区分)
    avg_score: 当前用户所有 PracticeSessionAnswer 正确率百分比 0-100, 无 answer 返 0
    """

    practiced: int
    total: int
    streak_days: int
    week_done: int
    avg_score: float


class XingceSpecialtyResumeV2(CamelModel):
    """ResumeHero 续答 hero band 数据 (行测).

    根据用户最近一条 PracticeSessionAnswer 的 question 派生:
      - 取最近一条 answer (按 answered_at), 落到对应 5 大类 bucket
      - q_index = 此类下当前用户 distinct answered question_id 计数 + 1
      - q_total = 此类下 public+enabled 行测题总数
      - last_scores = 最近 5 条 answer 滚动正确率 (per-batch 2-题滚动窗口百分比) — 简化为
        最近 5 个 answer 是否正确 转 0/100
      - week_goal = [本周 done 数, 目标=7] (MVP 硬编码 7)

    没有任何 PracticeSessionAnswer → null (前端隐藏 ResumeHero).
    """

    type_name: str
    question_id: int
    q_index: int
    q_total: int
    last_scores: list[float]
    week_goal: list[int]  # [done, total]


class XingceSpecialtySummaryV2(CamelModel):
    """GET /api/v2/papers/xingce/specialty/summary response.

    totals 永远填 (空 user 返 0); resume 可空 (无 answer record → None).
    """

    totals: XingceSpecialtyTotalsV2
    resume: XingceSpecialtyResumeV2 | None = None


class XingceSpecialtySubtypeRowV2(CamelModel):
    """CategoryCard 子类行 (sub-grid 项, 行测).

    id / name / meta 同源: meta 形如 "2024 国考 · 第 1 题".
    status 三态:
      - done: 该用户已答此题 (PracticeSessionAnswer 存在)
      - progress: 题挂在 in-progress session (started_at 有值, completed_at 为 None) 但
        本题尚未提交 answer
      - pending: 用户未做
    实测行测无 essay 那种"pending grading"中间态, status=progress 概率较低 (一般答完
    就 commit answer); 保 三态语义跟 essay 镜像方便 FE 复用组件.
    """

    id: str  # f"q-{question_id}"
    question_id: int
    name: str
    meta: str
    practiced: int  # 0 / 1 (per-question)
    total: int  # 1 (per-question)
    status: Literal["pending", "progress", "done"]


class XingceSpecialtyCategoryV2(CamelModel):
    """CategoryCard header + body (行测).

    state='empty' 当 total=0 (该类无入库题).
    overall_progress = practiced / total clamp [0, 1].
    """

    id: str  # canonical id (e.g. "yanyu" / "panduan")
    idx: int  # 1-based 顺序 (跟 5 大类硬编码 _XINGCE_CATEGORIES 对齐)
    name: str  # 中文名 (e.g. "言语理解")
    desc: str
    overall_progress: float  # 0..1
    practiced: int
    total: int
    sub_types: list[XingceSpecialtySubtypeRowV2]
    state: Literal["empty"] | None = None


class XingceSpecialtyCategoriesResponseV2(CamelModel):
    """GET /api/v2/papers/xingce/specialty/categories response.

    返 5 大类 (固定顺序: 言语 / 判断 / 数量 / 资料 / 常识). 不在 5 大类
    cleanup 范围的细分 subtype 通过 keyword bucket 归并 (e.g. "图形推理" → 判断
    推理, "公共基础知识" → 常识判断), bucket 映射见 services/xingce_specialty.py.
    """

    cats: list[XingceSpecialtyCategoryV2]


class XingceLastAttemptV2(CamelModel):
    """PaperRow lastAttempt: 该用户在此 paper 上最近一次 PracticeSession.

    score: 此 session 内 distinct correct answer 占 distinct answered 比例 × 100 (0-100).
    submitted_at: PracticeSession.completed_at (无 → 用最新 answer.answered_at fallback).
    """

    score: float
    submitted_at: UtcDatetime


class XingcePaperListItemV2Extended(CamelModel):
    """GET /api/v2/papers/xingce/list/extended 单行.

    扩自 PaperSummaryV2 同 essay 镜像: 加 region / track / difficulty / status /
    progress / last_attempt / pinned. region / track 从 source_provider + paper_code
    派生 (国考 / 省考 / track='gk' 行测综合). difficulty 1-3 由 question_count
    启发式 (≤30=1 易 / 31-80=2 中 / ≥81=3 难, 行测一般 90-130 题). pinned MVP 全 False.
    """

    id: int
    paper_code: str
    paper_name: str
    exam_year: int | None = None
    source_provider: str | None = None
    source_kind: str | None = None
    question_count: int
    current_revision_id: int | None = None
    region: str  # "国考" / "省考" / "<provider>" / "其他"
    track: Literal["gk", "sk"] = "gk"  # 行测固定 gk (公共基础)
    difficulty: Literal[1, 2, 3] | None = None
    status: Literal["todo", "doing", "done"] = "todo"
    progress: str = "0/0"  # 形如 "12/100" — answered question / total question
    last_attempt: XingceLastAttemptV2 | None = None
    pinned: bool = False


class XingcePapersListExtendedResponseV2(CamelModel):
    """GET /api/v2/papers/xingce/list/extended response."""

    items: list[XingcePaperListItemV2Extended]
    total: int
    page: int
    page_size: int


class XingcePapersFiltersResponseV2(CamelModel):
    """GET /api/v2/papers/xingce/filters response.

    返候选 chip 集合 (跟 essay 镜像):
      - regions: distinct source_provider (+ 国考 / 省考 派生 bucket)
      - years: distinct exam_year DESC
      - paper_types: distinct source_kind
    """

    regions: list[str]
    years: list[int]
    paper_types: list[str]


# ─── Slice 3a · 学习计划 schemas ────────────────────────────────────────
#
# 跨层 SSOT 设计 (P0-new-1):
#   1. LLM sanity check (StudyPlanLLMOutput.model_validate)
#   2. service 层处理 (静态类型 narrow)
#   3. DB 落库 (Pydantic → dict 序列化)
#   4. Pydantic response (FastAPI auto OpenAPI 输出 oneOf+discriminator)
#   5. FE TypeScript (openapi-typescript regen 拿到 narrow union)
#
# discriminator 必须打在含 `task_kind` 字段的 outer model union 上, 不是
# payload union 上. 见 docs/plan/slice-3a-study-plan-be.md §4.3 完整 rationale.

_TITLE_MAX = 30
_SUBTITLE_MAX = 60


class _BaseTaskPayload(CamelModel):
    """共享 payload 字段 (title/subtitle), 不带 task_kind. 子类 narrow 时
    Pydantic 不允许 LLM 多塞字段 (extra='forbid')."""

    # Pydantic v2 子类 model_config 完全覆盖父类, 这里重声明全套 (CamelModel
    # 4 项 + extra='forbid'). 跟 app/core/schemas.py CamelModel 保持同步.
    # ⚠️ 子类 (PracticeTaskPayload 等) **不要再写 model_config**, 否则会
    # 覆盖此处声明丢掉 extra='forbid' 防线. 同理 _LLMTaskBase 子类.
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )

    title: str = Field(..., min_length=1, max_length=_TITLE_MAX)
    subtitle: str | None = Field(default=None, max_length=_SUBTITLE_MAX)


class PracticeTaskPayload(_BaseTaskPayload):
    """task_kind='practice' payload — 跳 /papers/{paperCode}.

    questionIds: None=整卷, 限定题列表=用户只看选定 N 道.
    """

    paper_code: str = Field(..., min_length=1)
    question_ids: list[int] | None = None


class ReviewWrongTaskPayload(_BaseTaskPayload):
    """task_kind='review_wrong' payload — 跳错题复习视图.

    questionIds 至少 1 个 (sanity Stage 1 结构层); Stage 2 还会校验是否真在
    用户错题表 + mastery_level != 'mastered'.
    """

    question_ids: list[int] = Field(..., min_length=1)


class EssayWritingTaskPayload(_BaseTaskPayload):
    """task_kind='essay_writing' payload — 跳 /essay/practice/{questionId}.

    Stage 2 校验 questionId.renderer_key='essay'.
    """

    paper_code: str = Field(..., min_length=1)
    question_id: int = Field(..., gt=0)


# ── LLM 输入侧 union (LLM 输出 / sanity check) ──────────────────────────


class _LLMTaskBase(CamelModel):
    """LLM 输出 task 公共字段, 子类各自 narrow `task_kind` Literal + payload."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )

    display_order: int = Field(..., ge=0)


class PracticeLLMTask(_LLMTaskBase):
    task_kind: Literal["practice"]
    payload: PracticeTaskPayload


class ReviewWrongLLMTask(_LLMTaskBase):
    task_kind: Literal["review_wrong"]
    payload: ReviewWrongTaskPayload


class EssayWritingLLMTask(_LLMTaskBase):
    task_kind: Literal["essay_writing"]
    payload: EssayWritingTaskPayload


StudyLLMTaskUnion = Annotated[
    PracticeLLMTask | ReviewWrongLLMTask | EssayWritingLLMTask,
    Field(discriminator="task_kind"),
]


class StudyPlanLLMOutput(CamelModel):
    """LLM 输出严格 schema, sanity Stage 1 用.

    tasks min_length=1 防 LLM 输出 `{tasks: []}` (测试 19);
    max_length=5 防 LLM 失控塞太多 (master plan §5 "3-5 task" 上限).
    Stage 1 失败 → ValidationError → 整 plan 降 fallback_llm_failed.
    """

    tasks: list[StudyLLMTaskUnion] = Field(..., min_length=1, max_length=5)


# ── HTTP Response 侧 union (含 DB id / status / completed_at) ─────────


class _StudyTaskResponseBase(CamelModel):
    """response 公共字段 (DB row 元数据). 子类各 narrow task_kind + payload."""

    id: int
    display_order: int
    status: Literal["pending", "completed", "skipped"]
    completed_at: UtcDatetime | None
    created_at: UtcDatetime


class PracticeTaskResponse(_StudyTaskResponseBase):
    task_kind: Literal["practice"]
    payload: PracticeTaskPayload


class ReviewWrongTaskResponse(_StudyTaskResponseBase):
    task_kind: Literal["review_wrong"]
    payload: ReviewWrongTaskPayload


class EssayWritingTaskResponse(_StudyTaskResponseBase):
    task_kind: Literal["essay_writing"]
    payload: EssayWritingTaskPayload


StudyTaskResponse = Annotated[
    PracticeTaskResponse | ReviewWrongTaskResponse | EssayWritingTaskResponse,
    Field(discriminator="task_kind"),
]


class StudyPlanResponse(CamelModel):
    """GET /api/v2/study-plan/today response.

    generation_status 三态 (P1-1 方案 A): FE 据此渲不同 banner.
    tasks 走 outer discriminated union, FastAPI auto OpenAPI 输出
    oneOf+discriminator, FE openapi-typescript regen 拿到 narrow.

    SIKAO Wave 8 Phase A: 加 3 quota 字段 (Home block 4 "今日配额"). 全
    Optional — 老 plan / 新用户未设配额时 None, FE 渲空态.
    """

    id: int
    plan_date: date
    generation_status: Literal[
        "success", "fallback_cold_start", "fallback_llm_failed"
    ]
    created_at: UtcDatetime
    tasks: list[StudyTaskResponse]
    daily_quota: int | None = None
    daily_accuracy_target: float | None = None
    subject_quotas: dict[str, int] | None = None


class StudyTaskPatchRequest(CamelModel):
    """PATCH /api/v2/study-plan/tasks/{id} body.

    只允许 pending → completed/skipped (不允许改回 pending — D4 单向不可逆).
    跨用户 / 已 finalized 由 service 层校验 (404 / 422).
    """

    status: Literal["completed", "skipped"]


class StudyPlanHistoryItemV2(CamelModel):
    """Slice 3c: GET /api/v2/study-plan/history list item — slim (无 task payload).

    详情页 (Slice 3d, 暂未做) 才用 full StudyPlanResponse. 列表只显示日期 + 完成
    比例 + generation_status 副标. task_total / task_completed 走 SQL 一句
    GROUP BY + SUM(CASE) 算出 (服务层 list_history, plan §3.1).
    """

    id: int
    plan_date: date
    generation_status: Literal[
        "success", "fallback_cold_start", "fallback_llm_failed"
    ]
    task_total: int
    task_completed: int
    created_at: UtcDatetime


class StudyPlanHistoryListV2(CamelModel):
    """GET /api/v2/study-plan/history response — cursor-paginated slim list.

    next_cursor: 下一页的 cursor 值 (= 当前页最后一条 plan_date), null = 已到底.
    FE useInfiniteQuery 拿 next_cursor 作 pageParam 翻下一页.
    """

    items: list[StudyPlanHistoryItemV2]
    next_cursor: date | None = None


class AiptaTextImportRequest(CamelModel):
    """Slice 2b: admin POST body — paste 申论 plain text + 显式 metadata.

    parser 不猜年份 / 卷类型 / 标题, admin 直接给; rawText 走 parse_aipta_text 拆
    材料 + 5 道 essay. paperCode 自动 upper-case.
    """

    paper_code: str = Field(min_length=1, max_length=64)
    paper_name: str = Field(min_length=1, max_length=128)
    exam_year: int = Field(ge=2000, le=2100)
    source_kind: str = Field(min_length=1, max_length=32)
    raw_text: str = Field(min_length=1)


class AdminPaperSummaryV2(CamelModel):
    id: int
    paper_code: str
    paper_name: str
    exam_year: int | None
    source_provider: str | None
    source_kind: str | None
    revision_count: int
    current_revision: PaperRevisionSummary | None = None
    latest_revision: PaperRevisionSummary | None = None
    updated_at: UtcDatetime


class UserSummaryV2(CamelModel):
    """Phase B (auth recovery): 加 email + email_verified.
    Identity v2 (D6/D7): username 改 nullable (新 phone 注册无 username);
    加 phone / phone_verified / needs_identifier_setup. needs_identifier_setup
    是 service 层派生 (email 与 phone 都 NULL → True), 不进 DB; 前端 router
    guard 据此 push /complete-profile.
    """

    id: int
    username: str | None = None
    display_name: str
    email: str | None = None
    email_verified: bool = False
    phone: str | None = None
    phone_verified: bool = False
    needs_identifier_setup: bool = False


class LoginResponseV2(CamelModel):
    """Login / register response.

    Post-Phase D P1-1 + N3: csrf_token + access_token 都从 body 删掉.
    cookie 是 single source of truth:
      - auth_token: httpOnly + samesite=strict, JS 不可读, 浏览器自动跟 (Phase B.2)
      - csrf_token: NOT httpOnly, JS 读 + axios 注 X-CSRF-Token (Phase B.3)
    body 只 echo 期望客户端用得上的非敏感信息: token_type / expires_in / user.
    expires_in 让前端能预判 cookie 过期时间, 提前调 /auth/refresh (N1).
    """
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserSummaryV2


# ─── Phase B (auth recovery) schemas ──────────────────────────────────────
# 单独 cluster 让 forgot/reset/verify 的 contract 一目了然. dev_magic_link
# 字段固定 alias `_devMagicLink` (前下划线), 信号是 "调试 only, 客户端别
# 依赖该字段持续存在".


class ForgotPasswordRequest(CamelModel):
    email: str = Field(..., min_length=3, max_length=255)


class ForgotPasswordResponse(CamelModel):
    """D5 silent-200 + P0-3 byte-identical (route 用 exclude_none=True 让
    `_devMagicLink` 在 None 时不进 body)."""

    ok: Literal[True] = True
    # 显式 alias 覆盖 CamelModel.to_camel — 否则会序列成 "devMagicLink"
    # (无下划线), 跟 plan §1.D7 + frontend 期望不符.
    dev_magic_link: str | None = Field(default=None, alias="_devMagicLink")


class ResetPasswordRequest(CamelModel):
    # token 是 secrets.token_urlsafe(32) 输出, 43 char base64 url-safe.
    # min/max 给硬边界让 schema 拦掉空 / 异常长 payload.
    token: str = Field(..., min_length=20, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class ResetPasswordResponse(CamelModel):
    ok: Literal[True] = True


class VerifyEmailSendResponse(CamelModel):
    """跟 ForgotPasswordResponse 同 shape — dev gate 决定 _devMagicLink."""

    ok: Literal[True] = True
    dev_magic_link: str | None = Field(default=None, alias="_devMagicLink")


class VerifyEmailConfirmRequest(CamelModel):
    token: str = Field(..., min_length=20, max_length=128)


class VerifyEmailConfirmResponse(CamelModel):
    ok: Literal[True] = True
    user: UserSummaryV2


# ─── Identity v2 schemas (email/phone login + binding) ────────────────────
# 详见 docs/plan/email-phone-login-and-binding.md.
# Commit #3d 切完, 老 LoginRequestV2 / RegisterRequestV2 / UpdateEmailRequest
# 已删. /auth/login 接 LoginIdentifierRequest, register 拆 /register/email +
# /register/phone, PUT /email 删 (改用 /bind/email/* commit #4 接).


class LoginIdentifierRequest(CamelModel):
    """Identity v2 login: identifier + password.

    Identifier 后端 detect_identifier_kind 探测:
      - 含 `@` → email
      - normalize_phone 命中 → phone
      - 其他 + email/phone 都 NULL 的老 user → username legacy fallback (D15)
      - 不命中 → 401 invalid_credentials (不区分 "格式错" vs "用户不存在")

    legacy username 路径有 90 天 deprecation 期, 老用户登录后强制 /complete-profile.
    """

    identifier: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class RegisterEmailRequest(CamelModel):
    """Email 注册 (D3): write-then-verify — 注册即可登录, verify 事后单独走.

    `display_name` 不填 fallback `email.split("@")[0]` (review fix #6).
    """

    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    display_name: str | None = Field(default=None, max_length=64)


class RegisterPhoneRequest(CamelModel):
    """Phone 注册 (D4): verify-then-write — 6 位 SMS code 必须先验.

    Server 端 normalize_phone 会清 +86/空格/横线; 长度 max=20 容纳 "+86 138 0013 8000"
    最长输入. `display_name` 不填 fallback `f"用户{phone[-4:]}"` (review fix #6).
    """

    phone: str = Field(..., min_length=11, max_length=20)
    sms_code: str = Field(..., pattern=r"^\d{6}$")
    password: str = Field(..., min_length=6, max_length=128)
    display_name: str | None = Field(default=None, max_length=64)


# ─── SMS / Email send-code (anonymous + logged-in) ───────────────────────


class SmsSendCodeRequest(CamelModel):
    """Send 6-digit SMS code. `purpose` 决定限流维度 + 短信模板.

    - register: anonymous-allowed (注册阶段还没 user)
    - bind_phone: logged-in only (绑/换绑阶段已登录)
    - login_otp: future (Phase 1 不做, D5)
    """

    phone: str = Field(..., min_length=11, max_length=20)
    purpose: Literal["register", "bind_phone", "login_otp"] = Field(...)


class SmsSendCodeResponse(CamelModel):
    """跟 ForgotPasswordResponse 同 shape — dev gate (`dev_expose_magic_code`)
    决定 `_devMagicCode` 是否在 body 暴露 6-digit code.
    """

    ok: Literal[True] = True
    dev_magic_code: str | None = Field(default=None, alias="_devMagicCode")


# ─── Bind / Unbind (D10 先验后写, D11 解绑保护, D12 password confirm) ────


class BindPhoneSendCodeRequest(CamelModel):
    """Logged-in user 给 newPhone 发 SMS code. D10: 不写 user.phone, 验通过后才写."""

    phone: str = Field(..., min_length=11, max_length=20)


class BindPhoneConfirmRequest(CamelModel):
    """Code + password 验通过 → 写 user.phone + phone_verified=True.

    D18: confirm 入口先查 newPhone 是否被占 (即使别 user 未 verified), 撞 unique
    直接拒带 code=`identifier_taken`, 不让到 DB IntegrityError 500.
    """

    phone: str = Field(..., min_length=11, max_length=20)
    sms_code: str = Field(..., pattern=r"^\d{6}$")
    password: str = Field(..., min_length=6, max_length=128)


class BindEmailSendLinkRequest(CamelModel):
    """Logged-in user 给 newEmail 发 verify link. D10 先验后写.

    D16: 跟 register 流的 `KIND_EMAIL_VERIFY` 隔离, 走 pre_register_codes
    purpose='bind_email' + 链接 token (而非 6-digit code).
    """

    email: str = Field(..., min_length=5, max_length=255)


class BindEmailConfirmRequest(CamelModel):
    """Token + password 验通过 → 写 user.email + email_verified=True.

    D18 同 BindPhoneConfirm: confirm 入口先查 newEmail 是否被占.
    Token 跟 reset_password 同模式 (sha256 hash 存 DB, single-use).
    """

    token: str = Field(..., min_length=20, max_length=128)
    password: str = Field(..., min_length=6, max_length=128)


class UnbindRequest(CamelModel):
    """Unbind email / phone (D11): 必须保留至少一个**已 verified** identifier.

    解绑 phone 允许 ⇔ `email IS NOT NULL AND email_verified=True`.
    解绑 email 允许 ⇔ `phone IS NOT NULL AND phone_verified=True`.
    否则拒带 code=`identifier_must_remain_verified`.
    D12: password confirm 必填.
    """

    password: str = Field(..., min_length=6, max_length=128)


class IdentifierActionResponse(CamelModel):
    """Bind / Unbind / Confirm 通用 response — 返刷新后的 user state
    (含 phone / phone_verified / email / email_verified / needs_identifier_setup).
    """

    ok: Literal[True] = True
    user: UserSummaryV2


class HealthResponse(CamelModel):
    status: Literal["ok"]


class ReadyzDependency(CamelModel):
    name: str
    status: Literal["ok", "skipped", "error"]
    detail: str


class ReadyzResponse(CamelModel):
    status: Literal["ok", "error"]
    dependencies: list[ReadyzDependency]


class VersionResponse(CamelModel):
    app_name: str
    app_version: str
    git_sha: str
    image_tag: str
    build_time: str
    schema_version: str
    env: str


# ─── Exam events (考试日历, ARCH §7.3 P3) ─────────────────────────────────


ExamEventCategory = Literal["national", "provincial", "institution", "other"]
ExamEventPrecision = Literal["confirmed", "estimate"]


class ExamEventOutV2(CamelModel):
    """Public exam event row. Frontend ExamCalendar view consumes via
    GET /api/v2/exam-events. visible=False rows excluded from public list."""

    id: int
    slug: str
    name: str
    category: ExamEventCategory
    # date 序列化为 "YYYY-MM-DD" 字符串 (Pydantic 默认), 跟 frontend types
    # exam-calendar.ts ExamEvent.examDate 同 shape.
    exam_date: str
    registration_start: str | None = None
    registration_end: str | None = None
    precision: ExamEventPrecision
    notes: str | None = None


class ExamEventCreateRequest(CamelModel):
    slug: str = Field(..., min_length=2, max_length=60)
    name: str = Field(..., min_length=1, max_length=255)
    category: ExamEventCategory
    exam_date: str = Field(..., min_length=10, max_length=10)  # YYYY-MM-DD
    registration_start: str | None = Field(default=None, min_length=10, max_length=10)
    registration_end: str | None = Field(default=None, min_length=10, max_length=10)
    precision: ExamEventPrecision = "estimate"
    notes: str | None = None
    visible: bool = True


class ExamEventUpdateRequest(CamelModel):
    """Partial update — 任意字段 None 跳, 已 set 的覆盖."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: ExamEventCategory | None = None
    exam_date: str | None = Field(default=None, min_length=10, max_length=10)
    registration_start: str | None = Field(default=None, min_length=10, max_length=10)
    registration_end: str | None = Field(default=None, min_length=10, max_length=10)
    precision: ExamEventPrecision | None = None
    notes: str | None = None
    visible: bool | None = None


class ExamEventListResponse(CamelModel):
    items: list[ExamEventOutV2]


# ─── User exams (Home block 1 "我的考试", SIKAO Wave 8 Phase A) ───────────


class UserExamCreate(CamelModel):
    """POST /api/v2/user-exams body (Phase B). 用户添加一场自定义考试.

    `exam_event_id` 可选: 用户从 ExamEvent 库选 (auto-fill name/date) 或纯
    手填 (None). `study_plan_id` 可选: 后续 /sync 绑定专属计划. `notes`
    用户自由备注 (动机 / 复习重点 / 报名号 / ...).
    """

    name: str = Field(..., min_length=1, max_length=120)
    exam_date: date
    exam_event_id: int | None = None
    study_plan_id: int | None = None
    notes: str | None = None


class UserExamUpdate(CamelModel):
    """PATCH /api/v2/user-exams/{id} body — partial update.

    任意字段 None 表示不改. service 层 dict(exclude_unset=True) 按需 set.
    """

    name: str | None = Field(default=None, min_length=1, max_length=120)
    exam_date: date | None = None
    exam_event_id: int | None = None
    study_plan_id: int | None = None
    notes: str | None = None


class UserExamRead(CamelModel):
    """单条用户考试 — list + detail 共用.

    `days_until` 是 service 派生 ((exam_date - today).days), 不进 DB.
    可负 (考试已过); FE 据此渲 "倒计时 X 天" / "已过 N 天" 两态.
    """

    id: int
    name: str
    exam_date: date
    exam_event_id: int | None
    study_plan_id: int | None
    notes: str | None
    created_at: UtcDatetime
    days_until: int


class UserExamList(CamelModel):
    """GET /api/v2/user-exams 响应 — 全量返回 (Home block 1 极少, ≤10 row)."""

    exams: list[UserExamRead]
    total: int


# ─── LLM token usage (Slice 0b) ───────────────────────────────────────────


class LlmUsageByFeatureV2(CamelModel):
    """Per-feature breakdown row. Slice 1a/2c/3a 各 feature 一行."""

    prompt_tokens: int
    completion_tokens: int
    cost_cents: int | None  # None 当聚合内任一行 BYOM 无价格 (避免 lower-bound 误判)


class LlmUsageDayV2(CamelModel):
    """Per-day bucket. zero-padded N 天 (今天往前数 days), 升序排."""

    date: str  # YYYY-MM-DD
    tokens: int  # prompt + completion sum
    cost_cents: int | None


class LlmUsageByUserV2(CamelModel):
    """Admin-only: 全用户烧 token 排行 (sorted desc).

    user_id=None 用于匿名 / 已删除用户 (ON DELETE SET NULL dangling row).
    username=None when user_id is None or lookup miss.
    """

    user_id: int | None
    username: str | None
    total_tokens: int
    total_cost_cents: int | None


class LlmUsageSummaryV2(CamelModel):
    """User Profile + admin 共享 schema. by_user 是 admin-only 字段
    (user view 永远 None) — admin dashboard 看 '哪个用户烧最多 token'.
    """

    total_tokens: int
    total_cost_cents: int | None
    by_feature: dict[str, LlmUsageByFeatureV2]
    recent_days: list[LlmUsageDayV2]
    by_user: list[LlmUsageByUserV2] | None = None


# ─── BYOM (user_llm_configs, Slice 0c) ────────────────────────────────────


class LlmConfigV2(CamelModel):
    """User BYOM config (用户自己看). api_key 始终 mask, 永不返 raw."""

    id: int
    label: str
    base_url: str
    model: str
    is_default: bool
    api_key_masked: str  # 'sk-30...c8f3', 永不返 raw
    last_tested_at: str | None = None
    last_tested_status: Literal["ok", "unreachable", "auth_failed", "timeout"] | None = None
    created_at: str
    updated_at: str


class LlmConfigListResponse(CamelModel):
    items: list[LlmConfigV2]


class LlmConfigCreateRequest(CamelModel):
    """新建 BYOM config. baseUrl 必须 https:// 或 http://localhost (dev)."""

    label: str = Field(..., min_length=1, max_length=64)
    base_url: str = Field(..., min_length=8, max_length=255)
    api_key: str = Field(..., min_length=1, max_length=256)
    model: str = Field(..., min_length=1, max_length=64)


class LlmConfigUpdateRequest(CamelModel):
    """Partial update — None 字段跳过. api_key 改时触发 re-encrypt; base_url
    改时触发 SSRF re-check."""

    label: str | None = Field(default=None, min_length=1, max_length=64)
    base_url: str | None = Field(default=None, min_length=8, max_length=255)
    api_key: str | None = Field(default=None, min_length=1, max_length=256)
    model: str | None = Field(default=None, min_length=1, max_length=64)


class LlmConfigTestResponse(CamelModel):
    status: Literal["ok", "unreachable", "auth_failed", "timeout"]


# ─── LLM conversations (Slice 1a) ─────────────────────────────────────────


# 5 类意图 (前端 UI 让用户选, freeform 走默认对话风). 详 plan §4.4 qa.py.
LlmIntentHint = Literal[
    "why_wrong",
    "common_traps",
    "solving_path",
    "category_summary",
    "freeform",
]

# 上下文类型. context_id NULL 仅 'general'.
LlmContextKind = Literal["question", "wrong_question", "session_result", "general"]


class LlmMessageTokenUsageV2(CamelModel):
    """Per-message token 数 (assistant 消息有, user/system 无)."""

    prompt_tokens: int
    completion_tokens: int
    model: str


class LlmMessageV2(CamelModel):
    """单条会话消息. role 字面量 'system'|'user'|'assistant'."""

    id: int
    role: Literal["system", "user", "assistant"]
    content: str
    created_at: UtcDatetime
    token_usage: LlmMessageTokenUsageV2 | None = None


class LlmConversationSummaryV2(CamelModel):
    """会话列表项 (GET /llm/conversations). last_preview = 末条 assistant
    消息前 80 字 (前端列表预览, 无 assistant 时 None)."""

    id: int
    title: str
    context_kind: LlmContextKind
    context_id: int | None = None
    message_count: int
    last_preview: str | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class LlmConversationListResponse(CamelModel):
    items: list[LlmConversationSummaryV2]


class LlmConversationDetailV2(CamelModel):
    """单会话明细 (GET /llm/conversations/{id}) — summary + messages 全文."""

    id: int
    title: str
    context_kind: LlmContextKind
    context_id: int | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    messages: list[LlmMessageV2]


class LlmConversationCreateRequest(CamelModel):
    """POST /llm/conversations — 创建会话 + 首条 user message + SSE stream
    第一条 assistant 回复.

    title 可选: None → service 用 user_message 前 32 字截断兜底.
    intent_hint 默认 freeform (用户没选意图时).
    """

    title: str | None = Field(default=None, max_length=128)
    context_kind: LlmContextKind
    context_id: int | None = None
    user_message: str = Field(..., min_length=1, max_length=4000)
    intent_hint: LlmIntentHint = "freeform"


class LlmConversationContinueRequest(CamelModel):
    """POST /llm/conversations/{id}/messages — 续 user message + SSE stream
    assistant 回复. intent_hint 可在续话时切意图 (e.g. 第一轮 why_wrong, 第二轮
    common_traps)."""

    user_message: str = Field(..., min_length=1, max_length=4000)
    intent_hint: LlmIntentHint = "freeform"


class BootstrapResponseV2(CamelModel):
    app_name: str
    env: str
    published_paper_count: int
    can_start_practice: bool
    default_paper_code: str | None = None


class PublishStatusResponseV2(CamelModel):
    paper_code: str
    revision_id: int
    is_published: bool
    is_current_revision: bool
    published_at: UtcDatetime | None = None
    release_execution_id: str | None = None


class CompleteSessionPayloadV2(CamelModel):
    answers: dict[str, list[str]] = Field(default_factory=dict)


# ── SIKAO Wave 4 Phase 2B (notebook module) schemas ─────────────────────────


NoteType = Literal["quote", "method", "reflect", "material"]
NoteSourceKind = Literal["paper", "specialty", "manual", "practice", "grading"]
NoteSourceDomain = Literal["xingce", "essay"]
NoteVisibility = Literal["self", "group"]


class NoteAttachedToV2(CamelModel):
    """Optional links to wrong answers / questions / papers (cross-domain bridge)."""

    wrong_answer_ids: list[int] = Field(default_factory=list)
    question_type_ids: list[str] = Field(default_factory=list)
    xingce_question_ids: list[int] = Field(default_factory=list)
    paper_ids: list[int] = Field(default_factory=list)


class NoteCreateV2(CamelModel):
    """Create 单条 note. body shape 由 type 决定, 业务层校验.

    SIKAO Wave 10 Phase A: 新增 question_id (绑题) optional. 社交字段
    (is_public/display_anonymous) 不在 create 时设, 默认 false/true, 用户
    通过 PATCH (NoteUpdateV2) 主动 "发表" 才切换 is_public=true.
    """

    type: NoteType
    body: dict[str, Any]
    source_kind: NoteSourceKind
    source_ref: Annotated[str, Field(min_length=1, max_length=255)]
    source_quote: Annotated[str | None, Field(max_length=2000)] = None
    source_domain: NoteSourceDomain
    title: Annotated[str, Field(max_length=255)] = ""
    tags: list[Annotated[str, Field(max_length=50)]] = Field(
        default_factory=list, max_length=20
    )
    attached_to: NoteAttachedToV2 | None = None
    visibility: NoteVisibility = "self"
    # SIKAO Wave 10 Phase A: 绑题 optional. None = 跨题型笔记 (不绑题).
    question_id: int | None = None


class NoteUpdateV2(CamelModel):
    """Update partial.

    SIKAO Wave 10 Phase A: 加 is_public / display_anonymous / question_id
    让用户能 PATCH 发表/取消公开 + 切换匿名 + 后期绑题. likes_count /
    comments_count / public_at 是服务端字段, 不允许 client 直接 PATCH.
    """

    type: NoteType | None = None
    body: dict[str, Any] | None = None
    source_kind: NoteSourceKind | None = None
    source_ref: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    source_quote: Annotated[str | None, Field(max_length=2000)] = None
    source_domain: NoteSourceDomain | None = None
    title: Annotated[str | None, Field(max_length=255)] = None
    tags: list[Annotated[str, Field(max_length=50)]] | None = Field(
        default=None, max_length=20
    )
    attached_to: NoteAttachedToV2 | None = None
    visibility: NoteVisibility | None = None
    # SIKAO Wave 10 Phase A: 社交字段 PATCH. is_public true→false 取消公开
    # (Phase B service 不清 public_at, 保留 audit). display_anonymous 切换
    # 立即生效, 公开池里历史展示同步切换 (FE 渲染逻辑读最新值).
    is_public: bool | None = None
    display_anonymous: bool | None = None
    question_id: int | None = None


class NoteOutV2(CamelModel):
    """Single note 完整字段.

    SIKAO Wave 10 Phase A: 加 6 社交字段. likes_count / comments_count 是
    服务端缓存读出 (note_likes/note_comments 行数). public_at 首次置
    is_public=true 的时间. question_id None = 笔记不绑题.
    """

    id: int
    type: NoteType
    body: dict[str, Any]
    source_kind: NoteSourceKind
    source_ref: str
    source_quote: str | None
    source_domain: NoteSourceDomain
    title: str
    tags: list[str]
    attached_to: NoteAttachedToV2 | None
    visibility: NoteVisibility
    ease: float
    review_count: int
    reviewed_at: UtcDatetime | None
    next_review_at: UtcDatetime | None
    # SIKAO Wave 10 Phase A: 6 社交字段.
    is_public: bool
    public_at: UtcDatetime | None
    display_anonymous: bool
    likes_count: int
    comments_count: int
    question_id: int | None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class NoteListOutV2(CamelModel):
    items: list[NoteOutV2]
    next_cursor: int | None = None


class NoteReviewSubmitV2(CamelModel):
    recall_quality: Annotated[int, Field(ge=0, le=5)]


class NoteReviewOutV2(CamelModel):
    id: int
    note_id: int
    reviewed_at: UtcDatetime
    recall_quality: int
    ease_before: float
    ease_after: float
    interval_days: int
    next_review_at: UtcDatetime


class NoteReviewListOutV2(CamelModel):
    items: list[NoteReviewOutV2]


class NoteStatsV2(CamelModel):
    total: int
    due_count: int
    by_type: dict[NoteType, int]
    by_source_domain: dict[NoteSourceDomain, int]


# ── SIKAO Wave 10 Phase A — 笔记本社交化 schemas ─────────────────────────────
# 配 alembic 0022 (notes 扩 6 字段 + 4 新表). Phase B (service / endpoint)
# 复用. 详 docs/plan/sikao-wave-10-notes-social.md (Phase B 出).


NoteReportTargetType = Literal["note", "comment"]
NoteReportStatus = Literal["pending", "reviewed", "dismissed"]


class NoteCommentCreateV2(CamelModel):
    """评论创建. parent_comment_id None=顶层 comment, 非空=回复某 comment.

    一级嵌套: Phase B service 校验 parent.parent_id IS NULL (拒绝 grand-child).
    content ≤500 char (Phase B 业务规则, schema 此处约束硬上限).
    """

    content: Annotated[str, Field(min_length=1, max_length=500)]
    parent_comment_id: int | None = None


class NoteCommentOutV2(CamelModel):
    """评论详情. 匿名展示由父 note.display_anonymous 决定, 评论本身不带匿名
    flag (设计: 公开笔记下的评论跟笔记同步匿名/具名). user_display_name None
    表示该评论应匿名展示 (FE 直接渲染 '匿名用户' 或类似).
    """

    id: int
    note_id: int
    user_id: int
    user_display_name: str | None
    content: str
    parent_comment_id: int | None
    likes_count: int
    created_at: UtcDatetime
    updated_at: UtcDatetime


class NoteCommentListV2(CamelModel):
    """评论列表 (Phase B GET /notes/{id}/comments)."""

    items: list[NoteCommentOutV2]
    total: int


class NoteLikeToggleResponseV2(CamelModel):
    """Like 切换响应. liked=true 表示当前状态已点赞, false 表示已取消.
    likes_count 是切换后 notes.likes_count 真值 (Phase B service 同 transaction
    更新).
    """

    liked: bool
    likes_count: int


class NoteFavoriteToggleResponseV2(CamelModel):
    """Favorite 切换响应. favorited=true 表当前已收藏. 不返回 favorites_count
    (notes 表不缓存 favorites 总数, 见 NoteFavorite model docstring).
    """

    favorited: bool


class NoteReportCreateV2(CamelModel):
    """举报创建. target_type/target_id 在 Phase B service create 时校验 target
    存在 (polymorphic FK 无法在 schema 层强约束).
    """

    target_type: NoteReportTargetType
    target_id: int
    reason: Annotated[str, Field(min_length=1, max_length=500)]


class NoteReportOutV2(CamelModel):
    """举报详情 (admin queue 用)."""

    id: int
    target_type: NoteReportTargetType
    target_id: int
    reporter_user_id: int
    reason: str
    status: NoteReportStatus
    reviewed_by_admin_id: int | None
    created_at: UtcDatetime


class NoteAdminQueueItemV2(CamelModel):
    """Admin /admin/reports queue 列表项. 比 NoteReportOutV2 多带 target 摘要
    (Phase B service 单 query 拼出, 减少 admin 端 N+1).

    target_preview shape (Phase B 实现 camelCase keys for FE alignment):
      - target_type='note':    { "title": str, "bodyText": str (≤200 char) }
      - target_type='comment': { "noteId": int, "content": str (≤200 char) }
      - 已删 target -> { "deleted": True }
    FE admin 渲染时按 target_type discriminate.
    """

    id: int
    target_type: NoteReportTargetType
    target_id: int
    target_preview: dict[str, Any]
    reporter_user_id: int
    reporter_display_name: str | None
    reason: str
    status: NoteReportStatus
    created_at: UtcDatetime


class NoteAdminQueueResponseV2(CamelModel):
    """Admin queue 列表响应."""

    items: list[NoteAdminQueueItemV2]
    total: int
    pending_count: int


class NotePublicListItemV2(CamelModel):
    """单题视图 "下方公开笔记" 列表项. 跟 NoteOutV2 差异: 隐藏 user_id 之类
    PII (display_anonymous=true 时), 不返 ease/review_count/reviewed_at
    (SM-2 是 owner 私有). liked_by_me / favorited_by_me 是 viewer-specific
    flag (Phase B service 按当前登录 user JOIN note_likes/favorites).
    """

    id: int
    type: NoteType
    body: dict[str, Any]
    title: str
    tags: list[str]
    user_display_name: str | None
    likes_count: int
    comments_count: int
    liked_by_me: bool
    favorited_by_me: bool
    public_at: UtcDatetime | None
    created_at: UtcDatetime


class NotePublicListResponseV2(CamelModel):
    """单题视图 GET /questions/{id}/notes 响应."""

    items: list[NotePublicListItemV2]
    total: int


# ─── SIKAO Wave 8 Phase B — Home 4-block data sources ─────────────────────


class PracticeSessionSummary(CamelModel):
    """GET /api/v2/practice/last-session 响应 (nullable).

    Home "继续答题" block 数据源. 服务端返 None 表示无中断 session, FE
    据此渲 "今日推荐" 替代入口. paper_id=0 是 cross-paper retry session
    (paper_id IS NULL) 的 sentinel — FE 用 paper_title 区分文案.
    """

    id: int
    paper_id: int  # 0 = cross-paper retry (no anchor paper)
    paper_title: str
    current_question_id: int | None  # 最后答过的 qid; None 表示一道没答过
    answered_count: int
    total: int
    started_at: UtcDatetime


class WeakModule(CamelModel):
    """单一薄弱模块 score row.

    score = wrong_rate × (1 - completion_rate) × subject_weight × 100.
    suggested_action 三态: 重做错题 / 继续复盘 / 去练习 (按 wrong_rate 分).
    """

    subject: WrongBookHeatmapSubject  # 复用 Wave 7 行测 5 模块 Literal
    score: float  # 0-100 (服务端 round(2))
    wrong_rate: float  # 0-1 (服务端 round(4))
    completion_rate: float  # 0-1 (服务端 round(4))
    suggested_action: str  # "去练习" / "继续复盘" / "重做错题"


class WeakModuleListResponse(CamelModel):
    """GET /api/v2/wrong-questions/weakness 响应 — top-N 薄弱模块."""

    modules: list[WeakModule]
    generated_at: UtcDatetime


# ─── SIKAO Wave 10 Phase B — public-toggle 请求体 (Phase A 漏加, B append) ───


class NotePublicToggleV2(CamelModel):
    """PATCH /api/v2/notebook/notes/{id}/public-toggle 请求体.

    is_public=true 首次公开 → service 设 public_at=now (Phase B service.toggle_public
    实现). display_anonymous 默认 true (lhr 决议, 隐私优先).
    """

    is_public: bool
    display_anonymous: bool = True


PaperExamSectionOutV2.model_rebuild()
PaperExamBlockOutV2.model_rebuild()
MaterialGroupOutV2.model_rebuild()
PracticeSessionStartV2.model_rebuild()
