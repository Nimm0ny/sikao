// 后端 PaperSummaryV2 (apps/exam-api/app/domain/schemas.py) 的前端契约子集。
// 只声明前端实际消费的字段；新增消费场景时同步补齐（不要一次性全量对齐，
// 避免死字段。已验证 question_count 存在于后端返回）。
export interface PaperSummaryV2 {
  paperCode: string;
  paperName: string;
  currentRevisionId: string | number;
  description?: string;
  questionCount: number;
}

export interface PaperRevisionSummary {
  revisionId: string;
  paperCode: string;
  status: string;
  questionCount: number;
}

export interface QuestionOption {
  key: string;
  text?: string;
  isCorrect?: boolean;
}

// Slice 2a — 申论 metadata. 后端从 question.type_payload_json 抽白名单字段
// 注入 content.essayMetadata, 仅 rendererKey='essay' 时存在.
export interface EssayMetadata {
  materialTexts?: string[];
  wordLimitMin?: number;
  wordLimitMax?: number;
  suggestedMinutes?: number;
  fullScore?: number;
}

export interface QuestionDetailV2 {
  // Backend returns integer primary keys today (e.g. 1, 2, 3); the contract
  // may widen to opaque strings later. Accept both and coerce at any boundary
  // that uses this as a Set/Map key (see PracticeSession.buildAnswerCardSections).
  // Mirrors PaperSummaryV2.currentRevisionId.
  questionId: string | number;
  paperRevisionId: string;
  sectionId: string;
  blockId: string;
  materialGroupId?: string;
  questionNo: number;
  questionKind: string;
  rendererKey: string;
  content: {
    stem: string;
    options?: QuestionOption[];
    answerKeys?: string[];
    explanation?: string;
    essayMetadata?: EssayMetadata;
  };
}

export interface QuestionListItemV2 {
  questionId: string | number;
  questionNo: number;
  questionKind: string;
  rendererKey: string;
}

export interface MaterialGroupAssetV2 {
  id: number;
  assetRole: string;
  mimeType: string;
  displayOrder: number;
  url: string;
}

export interface MaterialGroup {
  materialGroupId: string;
  blockId: string;
  title: string;
  content: string;
  groupKind: string;
  questions: QuestionDetailV2[];
  assets?: readonly MaterialGroupAssetV2[];
}

export interface Section {
  sectionId: string;
  title: string;
  description?: string;
  blocks: Block[];
}

export interface Block {
  blockId: string;
  type: 'question' | 'material_group';
  materialGroup?: MaterialGroup;
  question?: QuestionDetailV2;
}

export interface PracticeSessionStartV2 {
  // Backend ships `session_id` as an integer primary key; see the
  // currentRevisionId / questionId precedent. Accept both and coerce to
  // string at any boundary that uses this as a Set/Map key or compares
  // against `useParams()` output.
  sessionId: string | number;
  // ARCH §7.2 P2 (B-review B1 修): paperCode/paperRevisionId/paperName 改 optional.
  // cross-paper retry session (paper_revision_id NULL on backend) 这三字段都
  // 可能不存在 — backend route 用 response_model_exclude_none=True, None 值
  // 从 body 剥掉而非保留为 null. 老 paper-bound flow 仍 always set 三者.
  // 消费方需 ?? fallback 或 != null 守护 (e.g. "重做本套" button disabled).
  paperCode?: string | null;
  paperRevisionId?: string | null;
  paperName?: string | null;
  sections: Section[];
  savedAnswers: Record<string, string[]>;
}

export interface CustomPracticeSecondSubtypeFacetV2 {
  name: string;
  questionCount: number;
  years: number[];
}

export interface CustomPracticeSubtypeFacetV2 {
  name: string;
  questionCount: number;
  years: number[];
  secondSubtypes: CustomPracticeSecondSubtypeFacetV2[];
}

export interface CustomPracticeTopTypeFacetV2 {
  name: string;
  questionCount: number;
  years: number[];
  subtypes: CustomPracticeSubtypeFacetV2[];
}

export interface CustomPracticeFacetsResponseV2 {
  totalQuestions: number;
  years: number[];
  topTypes: CustomPracticeTopTypeFacetV2[];
}

// ── Phase 1 fenbi-merge — 题库专项练习入口 ──────────────────────────────────

// GET /api/v2/categories — 6 大类聚合.
// done_by_user 按 D1: 单题 attempt 提交即记 (paper-bound 需整卷交卷).
// 匿名调用 doneByUser=0.
export interface CategorySummaryV2 {
  topType: string;
  name: string;
  total: number;
  doneByUser: number;
}

export interface CategoriesResponseV2 {
  categories: CategorySummaryV2[];
}

// GET /api/v2/papers/me/status — 卷级用户状态 overlay (需登录).
// 走独立 endpoint, 不污染匿名 /papers 主响应. 前端登录态时拉取并跟
// /papers 列表 join 显示 status chip 三态.
export type PaperUserStatusKind = 'untouched' | 'in_progress' | 'done';

export interface PaperProgressV2 {
  answered: number;
  total: number;
}

export interface PaperUserStatusV2 {
  paperCode: string;
  userStatus: PaperUserStatusKind;
  attemptCount: number;
  // 仅 userStatus='in_progress' 时填 — 后端 response_model_exclude_none=True,
  // 其他状态 wire 上无此 key.
  progress?: PaperProgressV2;
}

export interface PaperUserStatusResponseV2 {
  items: PaperUserStatusV2[];
}

// Phase 5.2 (fenbi-merge) — 用户中心预测分.
// D4 算法: 0.85^i 加权 + 归一. sample_size < 3 时 isReferenceOnly=True.
export interface PredictedScorePaperEntryV2 {
  paperCode: string;
  paperName: string;
  score: number;
  completedAt: string;  // ISO datetime
}

export interface PredictedScoreV2 {
  predictedScore: number | null;  // null = 0 样本
  sampleSize: number;
  isReferenceOnly: boolean;
  recentPapers: PredictedScorePaperEntryV2[];
}

// Phase 5.5 (fenbi-merge) — 用户目标分 (D5 minimal: target_score only).
export interface UserGoalV2 {
  hasGoal: boolean;
  targetScore: number | null;
}

export interface UserGoalUpdateV2 {
  targetScore: number;  // 0-150, BE 校验
}

// Phase 3.7 (fenbi-merge) — 题级笔记 (markdown). 一人一题一行 (PUT upsert).
export interface QuestionNoteV2 {
  hasNote: boolean;
  content: string;            // 没 note 时返 ""
  updatedAt: string | null;   // 没 note 时 null
}

export interface QuestionNoteUpdateV2 {
  content: string;            // 上限 16KB, BE 校验
}

export interface CustomPracticeStartPayload {
  topType: string;
  subtype?: string;
  secondSubtype?: string;
  years?: number[];
  questionCount: number;
}

export interface PracticeSessionSummaryV2 {
  sessionId: string | number;
  mode: string;
  paperCode: string | null;
  paperName: string | null;
  startedAt: string;
  completedAt: string | null;
  totalQuestions: number;
  answeredQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracyRate: number;
}

export interface PracticeSectionSummaryV2 {
  sectionId: string;
  title: string;
  instructionText: string;
  questionCount: number;
  answeredQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracyRate: number;
}

export interface PracticeSessionAnswerV2 {
  id: string;
  questionId: string | number;
  selectedAnswerKeys: readonly string[];
  correctAnswerKeys: readonly string[];
  isCorrect: boolean;
  answeredAt: string;
}

// v0.2 slice 3 — knowledge-point aggregation. Mirrors backend
// PracticeSubjectSummaryV2 / PracticeSubtypeSummaryV2 (see
// apps/exam-api/app/domain/schemas.py). Per
// docs/plan/result-deep-analysis.md slice 3 (D3.B 两层).
export interface PracticeSubjectSummaryV2 {
  subject: string;
  questionCount: number;
  answeredQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracyRate: number;
}

export interface PracticeSubtypeSummaryV2 {
  // Parent subject; null when the underlying question has no canonical
  // taxonomy at all (rare in production after backfill).
  subject: string | null;
  subtype: string;
  questionCount: number;
  answeredQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracyRate: number;
}

// Phase 3.3 expansion: the backend's PracticeSessionResultV2 already returns
// session / sectionSummaries / answers / questions; the frontend type was a
// strict subset and the old Result page silently ignored them. Adding them
// makes the contract honest (CLAUDE.md §3.4) and unlocks ScoreRing /
// SectionBars / AnswerComparisonGrid / WrongReviewCard without fabricating
// data. Legacy flat fields are kept so existing call sites keep compiling.
export interface PracticeSessionResultV2 {
  sessionId: string | number;
  score: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  userAnswers: Record<string, string[]>;
  session?: PracticeSessionSummaryV2;
  sectionSummaries?: readonly PracticeSectionSummaryV2[];
  // v0.2 slice 3 additive — Optional so old clients & legacy fixtures stay valid.
  subjectSummaries?: readonly PracticeSubjectSummaryV2[];
  subtypeSummaries?: readonly PracticeSubtypeSummaryV2[];
  answers?: readonly PracticeSessionAnswerV2[];
  questions?: readonly QuestionDetailV2[];
}

export interface AdminPaperSummaryV2 extends PaperSummaryV2 {
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobSummary {
  jobId: string;
  status: string;
  createdAt: string;
}

// ── Phase 5.4 WrongBook 契约 ────────────────────────────────────────────────
// 对齐 apps/exam-api/app/domain/schemas.py 的 WrongQuestionDetailV2 /
// WrongQuestionListResponseV2。frontend/CLAUDE.md §3.4 — 前端不编造后端字段。

export type MasteryLevel = 'not_mastered' | 'reviewing' | 'mastered';

export interface WrongQuestionOptionV2 {
  key: string;
  text: string;
  isCorrect: boolean;
}

export interface WrongQuestionDetailV2 {
  questionId: number;
  stem: string;
  options: WrongQuestionOptionV2[];
  correctAnswerKeys: string[];
  userLatestAnswerKeys: string[];
  explanation: string;
  subject: string | null;
  // Phase 6.4 P2 — canonical_subtype 暴露给前端 (chip filter / KP focus jump).
  subtype?: string | null;
  questionKind: string;
  paperCode: string | null;
  paperName: string | null;
  wrongCount: number;
  masteryLevel: MasteryLevel;
  lastWrongTime: string;
  consecutiveCorrectCount: number;
}

export interface WrongQuestionListResponseV2 {
  items: WrongQuestionDetailV2[];
  total: number;
  page: number;
  pageSize: number;
  availableSubjects: string[];
  // 该用户错题里出现过的 subtype 全集 (sorted, 去 null) — chip 筛选 UI 用.
  // 后端 schemas.py:380 已移除 default_factory, OpenAPI 标 required, 跟
  // api.generated.ts:3130 SSOT 对齐 (T-C3 v0.4 backlog 真契约对齐 8feeec4).
  availableSubtypes: string[];
}

// ── Phase 5.5 Dashboard 契约 ────────────────────────────────────────────────

export interface HeatmapEntryV2 {
  date: string; // YYYY-MM-DD (Asia/Shanghai 本地日)
  count: number;
  rate: number; // 0-1
}

export interface TrendEntryV2 {
  date: string;
  rate: number;
  total: number;
}

export type KnowledgeCategory = 'strong' | 'ok' | 'weak';

export interface KnowledgePointEntryV2 {
  name: string;
  total: number;
  correct: number;
  rate: number;
  category: KnowledgeCategory;
}

export interface DashboardStatsV2 {
  totalAnswered: number;
  overallAccuracy: number;
  currentStreakDays: number;
  masteredPointsCount: number;
  totalWrongQuestions: number;
  // Slice 3e ABM: PracticeSession.mode 累计答题分桶 (answer-level). BE
  // schema `int = 0` 永远返字段 (additive change), 跟 generated.ts required
  // 对齐. 老 BE 部署顺序: BE 必先 deploy 不破 (R1).
  studyPlanAnswered: number;
  retryWrongAnswered: number;
  paperBoundAnswered: number;
}

// Practice history 契约（Phase 5.5 dashboard RecentExamsList 消费）。对齐
// apps/exam-api/app/domain/schemas.py PracticeHistoryResponseV2 的前端子集。

export interface PracticeAttemptV2 {
  id: number;
  sessionId: string | number;
  questionId: string | number;
  questionStem: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  createdAt: string;
}

export interface PracticeSummaryV2 {
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  accuracyRate: number;
}

export interface WrongQuestionV2 {
  questionId: number;
  questionStem: string;
  latestSelectedOption: string;
  correctOption: string;
  wrongCount: number;
}

export interface PracticeHistoryResponseV2 {
  summary: PracticeSummaryV2;
  recentAttempts: PracticeAttemptV2[];
  wrongQuestions: WrongQuestionV2[];
  recentSessions: PracticeSessionSummaryV2[];
  recentAttemptsLimit: number;
  recentSessionsLimit: number;
}

// ── LLM token usage (Slice 0b) ───────────────────────────────────────────

export interface LlmUsageByFeatureV2 {
  promptTokens: number;
  completionTokens: number;
  // null 当聚合内任一行 BYOM 无价格 (避免 lower-bound 误判)
  costCents: number | null;
}

export interface LlmUsageDayV2 {
  // YYYY-MM-DD
  date: string;
  // prompt + completion sum
  tokens: number;
  costCents: number | null;
}

// Admin-only: 全用户烧 token 排行 (sorted desc). user view 永远 null.
export interface LlmUsageByUserV2 {
  userId: number | null;
  username: string | null;
  totalTokens: number;
  totalCostCents: number | null;
}

export interface LlmUsageSummaryV2 {
  totalTokens: number;
  totalCostCents: number | null;
  byFeature: Record<string, LlmUsageByFeatureV2>;
  recentDays: LlmUsageDayV2[];
  // null for user view (Profile LlmUsageCard); set for admin endpoint.
  byUser?: LlmUsageByUserV2[] | null;
}

// ── BYOM user_llm_configs (Slice 0c) ──────────────────────────────────────

export type LlmConfigTestStatus = 'ok' | 'unreachable' | 'auth_failed' | 'timeout';

export interface LlmConfigV2 {
  id: number;
  label: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  // 'sk-30...8f3c'. Backend never returns raw api_key.
  apiKeyMasked: string;
  lastTestedAt: string | null;
  lastTestedStatus: LlmConfigTestStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface LlmConfigCreateRequest {
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LlmConfigUpdateRequest {
  label?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface LlmConfigTestResponse {
  status: LlmConfigTestStatus;
}

// ── AI 答疑会话 (Slice 1a/1b) ──────────────────────────────────────────────

// 5 类意图 (前端 UI chip 选, freeform 走默认对话风).
export type LlmIntentHint =
  | 'why_wrong'
  | 'common_traps'
  | 'solving_path'
  | 'category_summary'
  | 'freeform';

// 上下文类型. context_id 仅 'general' 时 null.
export type LlmContextKind =
  | 'question'
  | 'wrong_question'
  | 'session_result'
  | 'general';

export interface LlmMessageTokenUsageV2 {
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface LlmMessageV2 {
  id: number;
  role: 'system' | 'user' | 'assistant';
  // user role: 后端 strip 了 intent guidance suffix, 永远是 raw user input.
  content: string;
  createdAt: string;
  tokenUsage: LlmMessageTokenUsageV2 | null;
}

export interface LlmConversationSummaryV2 {
  id: number;
  title: string;
  contextKind: LlmContextKind;
  contextId: number | null;
  messageCount: number;
  // 末条 assistant 消息前 80 字 (无 assistant 时 null)
  lastPreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LlmConversationDetailV2 {
  id: number;
  title: string;
  contextKind: LlmContextKind;
  contextId: number | null;
  createdAt: string;
  updatedAt: string;
  messages: LlmMessageV2[];
}

export interface LlmConversationCreateRequest {
  title?: string | null;
  contextKind: LlmContextKind;
  contextId?: number | null;
  userMessage: string;
  intentHint?: LlmIntentHint;
}

export interface LlmConversationContinueRequest {
  userMessage: string;
  intentHint?: LlmIntentHint;
}

// ── Slice 2c/2d 申论批改 ─────────────────────────────────────────────────
// 1:1 对齐 backend apps/exam-api/app/domain/schemas.py 440-496 (CamelModel).

// 5 维度评分单项 (论点/材料/语言/结构/字数, weight 0.30/0.25/0.20/0.15/0.10).
export interface EssayDimensionV2 {
  name: string;
  weight: number;
  score: number;     // 0-10, 业务层 sanity check 后 clamp
  comment: string;
}

// feedback_json 序列化形. overallScore 是业务层按 weight 重算的 0-100, 不
// 信 LLM 的 overallScore. suspicious 是 R10 sanity check 兜底标 (5 维度
// 全等差 ≤0.5 / sample 字数偏离 ±20%).
export interface EssayFeedbackV2 {
  overallScore: number;
  dimensions: EssayDimensionV2[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  // LLM 单 call 双输出, 通常有; sanity check 失败时可能 null. 后端
  // routes/essay_v2.py 不开 response_model_exclude_none, key 始终在 wire 上.
  sampleAnswer: string | null;
  suspicious: boolean;
}

export type EssayGradingStatus = 'pending' | 'completed' | 'failed';

// 单条 grading record. pending/failed 时 score/feedback 为 null;
// failureReason 仅 failed 时填. record immutable — 重新提交走新 record.
//
// questionId 是 EssayGradingRecord.question_id (ORM int FK), 不跟
// QuestionDetailV2.questionId 走 string|number widen 路线 — record 整数
// PK 永远 number, contract 无 widen 计划.
export interface EssayGradingV2 {
  id: number;
  questionId: number;
  answerText: string;
  status: EssayGradingStatus;
  score: number | null;
  feedback: EssayFeedbackV2 | null;
  failureReason: string | null;
  createdAt: string;
  gradedAt: string | null;
}

// POST /api/v2/essay/grade body. answerText 上限 5000 字 (后端 R7 cost 控制).
export interface EssayGradingSubmissionRequest {
  questionId: number;
  answerText: string;
}

// Phase D: 申论专项练习 (跨卷单题) — list view item.
// stem 是 HTML stripped + 截 200 char (尾"…"). lastAnsweredAt = 当前 user
// 在该题最近一次 status='completed' 的 essay_grading_records.created_at
// (UTC ISO string), 缺则 null = 未练.
export interface EssaySpecialtyQuestionItemV2 {
  questionId: number;
  paperCode: string;
  paperName: string;
  position: number;
  stem: string;
  wordRequirement: string | null;
  fullScore: number | null;
  lastAnsweredAt: string | null;
}

// Phase D 列表分页响应. total = 当前 subtype 命中题总数, page 1-based.
export interface EssaySpecialtyListResponseV2 {
  items: EssaySpecialtyQuestionItemV2[];
  total: number;
  page: number;
  pageSize: number;
}

// batch 5b — GET /api/v2/papers/essay/list 分页响应. 拆自 GET /papers 防
// 745 套申论卷全量铺 ~67000px DOM 把 LCP 拉爆 (CLAUDE.md §4 列表收口).
// page 1-based; total = 命中 essay 卷总数 (paginate ceil(total/pageSize)).
export interface EssayPaperListResponseV2 {
  items: PaperSummaryV2[];
  total: number;
  page: number;
  pageSize: number;
}

// SSE frame discriminated union, parsed by streamingFetch.
// 帧序列保证: stream 开头必发 `created` 带 conversationId, 让前端在任何时刻
// abort (mid-stream cancel) 都能拿到 id 续话, 不创建孤立 row (3rd review P1 #3).
// 之后 0..N 个 `delta` 帧, 最后 `done` 或 `error` 终结.
// `done.conversationId` / `error.conversationId` 冗余多一层防 created 帧丢失.
export type LlmStreamFrame =
  | { type: 'created'; conversationId: number }
  | { type: 'delta'; content: string }
  | { type: 'done'; messageId: number; conversationId: number }
  | { type: 'error'; code: string; message: string; conversationId?: number };
