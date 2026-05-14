import { api } from './request';
import type { ExamEvent } from '@sikao/domain/study-record/exam-calendar';
import type {
  DashboardStatsV2,
  CustomPracticeFacetsResponseV2,
  CustomPracticeStartPayload,
  EssayGradingSubmissionRequest,
  EssayGradingV2,
  EssayPaperListResponseV2,
  EssaySpecialtyListResponseV2,
  HeatmapEntryV2,
  KnowledgePointEntryV2,
  LlmConfigCreateRequest,
  LlmConfigTestResponse,
  LlmConfigUpdateRequest,
  LlmConfigV2,
  LlmConversationDetailV2,
  LlmConversationSummaryV2,
  LlmUsageSummaryV2,
  MasteryLevel,
  PracticeHistoryResponseV2,
  PracticeSessionStartV2,
  PredictedScoreV2,
  QuestionNoteUpdateV2,
  QuestionNoteV2,
  TrendEntryV2,
  UserGoalUpdateV2,
  UserGoalV2,
  WrongQuestionListResponseV2,
} from './types/api';

// Phase 5.4e — WrongBook / Dashboard / 后续阶段共用的 React Query keys + API
// wrappers。集中在一处便于 invalidate 逻辑编写（例如交卷后失效 wrongBookKeys.all
// 刷新错题本）。

export interface WrongQuestionFilters {
  readonly masteryLevel?: MasteryLevel;
  readonly subject?: string;
  // Phase 6.4 P2 — canonical_subtype filter (AiSuggestionCard / KP focus
  // CTAs use this when navigating to /wrong-book?subject=X&subtype=Y).
  readonly subtype?: string;
  // 规范官 P0-1 (2026-05-08): server-side paperCode filter. WrongBook
  // "本套错题" mode 走此参数, 解决 client-side filter 跨页丢失问题.
  readonly paperCode?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export const wrongBookKeys = {
  all: ['wrong-book'] as const,
  list: (filters: WrongQuestionFilters) => ['wrong-book', 'list', filters] as const,
} as const;

export function fetchWrongQuestions(filters: WrongQuestionFilters) {
  return api.get<WrongQuestionListResponseV2>('/practice/wrong-questions', {
    params: filters,
  });
}

export function retryWrongQuestion(questionId: number) {
  return api.post<PracticeSessionStartV2>(
    `/practice/wrong-questions/${questionId}/retry`,
  );
}

// Phase 6.4 P2 — batch retry. Backend 限制：所有 questionIds 必须属于同一
// paper_revision_id (PracticeSession 一对一 paper). 跨 paper 由前端 disable.
export function retryWrongBatch(questionIds: readonly number[]) {
  return api.post<PracticeSessionStartV2>(
    '/practice/wrong-questions/retry-batch',
    { questionIds: [...questionIds] },
  );
}

// ── Phase 5.5 Dashboard ─────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: ['dashboard', 'summary'] as const,
  heatmap: ['dashboard', 'heatmap'] as const,
  trend: (days: number) => ['dashboard', 'trend', days] as const,
  knowledge: ['dashboard', 'knowledge'] as const,
} as const;

export function fetchDashboardSummary() {
  return api.get<DashboardStatsV2>('/practice/stats/summary');
}

export function fetchHeatmap() {
  return api.get<HeatmapEntryV2[]>('/practice/stats/heatmap');
}

export function fetchTrend(days = 14) {
  return api.get<TrendEntryV2[]>('/practice/stats/trend', { params: { days } });
}

export function fetchKnowledgePoints() {
  return api.get<KnowledgePointEntryV2[]>('/practice/stats/knowledge-points');
}

// ── Phase 5.2 + 5.5 fenbi-merge — /me/* 用户中心 ──────────────────────────

export const meKeys = {
  all: ['me'] as const,
  predictedScore: ['me', 'predicted-score'] as const,
  goal: ['me', 'goal'] as const,
} as const;

export function fetchPredictedScore() {
  return api.get<PredictedScoreV2>('/me/predicted-score');
}

export function fetchUserGoal() {
  return api.get<UserGoalV2>('/me/goals');
}

export function putUserGoal(payload: UserGoalUpdateV2) {
  return api.put<UserGoalV2, UserGoalUpdateV2>('/me/goals', payload);
}

// ── Phase 3.7 + 3.8 fenbi-merge — 题级笔记 ────────────────────────────────

export const noteKeys = {
  all: ['notes'] as const,
  byQuestion: (questionId: number | string) =>
    ['notes', 'question', String(questionId)] as const,
} as const;

export function fetchQuestionNote(questionId: number | string) {
  return api.get<QuestionNoteV2>(`/notes/${questionId}`);
}

export function putQuestionNote(
  questionId: number | string,
  payload: QuestionNoteUpdateV2,
) {
  return api.put<QuestionNoteV2, QuestionNoteUpdateV2>(
    `/notes/${questionId}`,
    payload,
  );
}

export function deleteQuestionNote(questionId: number | string) {
  return api.delete<void>(`/notes/${questionId}`);
}

// ── Phase 5.5 复用 history（最近练习列表） ─────────────────────────────────

export const historyKeys = {
  all: ['practice-history'] as const,
} as const;

export function fetchPracticeHistory() {
  return api.get<PracticeHistoryResponseV2>('/practice/history');
}

// ── Custom practice ────────────────────────────────────────────────────────

export const customPracticeKeys = {
  all: ['custom-practice'] as const,
  facets: () => ['custom-practice', 'facets'] as const,
} as const;

export function fetchCustomPracticeFacets() {
  return api.get<CustomPracticeFacetsResponseV2>('/practice/custom/facets');
}

export function startCustomPractice(payload: CustomPracticeStartPayload) {
  return api.post<PracticeSessionStartV2, CustomPracticeStartPayload>(
    '/practice/custom/start',
    payload,
  );
}

// ── ARCH §7.3 P3 — exam events (考试日历) ────────────────────────────────

interface ExamEventListResponse {
  readonly items: ReadonlyArray<ExamEvent>;
}

export const examEventsKeys = {
  all: ['exam-events'] as const,
  list: () => ['exam-events', 'list'] as const,
} as const;

export function fetchExamEvents() {
  return api.get<ExamEventListResponse>('/exam-events');
}

// ── Slice 0b — LLM token usage (Profile LlmUsageCard) ────────────────────

export const llmUsageKeys = {
  all: ['llm-usage'] as const,
  me: () => ['llm-usage', 'me'] as const,
} as const;

export function fetchMyLlmUsage() {
  return api.get<LlmUsageSummaryV2>('/llm/usage/me');
}

// ── Slice 0c — BYOM user_llm_configs (Profile LlmConfigsCard) ────────────

interface LlmConfigListResponse {
  readonly items: ReadonlyArray<LlmConfigV2>;
}

export const llmConfigsKeys = {
  all: ['llm-configs'] as const,
  list: () => ['llm-configs', 'list'] as const,
} as const;

export function fetchMyLlmConfigs() {
  return api.get<LlmConfigListResponse>('/llm/configs');
}

export function createLlmConfig(payload: LlmConfigCreateRequest) {
  return api.post<LlmConfigV2, LlmConfigCreateRequest>('/llm/configs', payload);
}

export function updateLlmConfig(id: number, payload: LlmConfigUpdateRequest) {
  return api.patch<LlmConfigV2, LlmConfigUpdateRequest>(`/llm/configs/${id}`, payload);
}

export function deleteLlmConfig(id: number) {
  return api.delete<void>(`/llm/configs/${id}`);
}

export function setDefaultLlmConfig(id: number) {
  return api.post<LlmConfigV2>(`/llm/configs/${id}/set-default`);
}

export function testLlmConfig(id: number) {
  return api.post<LlmConfigTestResponse>(`/llm/configs/${id}/test`);
}

// ── Slice 1b — AI 答疑会话 (REST + history; streaming 走 streamingFetch.ts) ──

interface LlmConversationListResponse {
  readonly items: ReadonlyArray<LlmConversationSummaryV2>;
}

export const llmConversationsKeys = {
  all: ['llm-conversations'] as const,
  list: () => ['llm-conversations', 'list'] as const,
  detail: (id: number) => ['llm-conversations', 'detail', id] as const,
} as const;

export function fetchMyConversations() {
  return api.get<LlmConversationListResponse>('/llm/conversations');
}

export function fetchConversationDetail(id: number) {
  return api.get<LlmConversationDetailV2>(`/llm/conversations/${id}`);
}

export function deleteConversation(id: number) {
  return api.delete<void>(`/llm/conversations/${id}`);
}

// ── Slice 2d — 申论批改 (essay grading) ─────────────────────────────────
// 后端 routes 在 apps/exam-api/app/api/routes/essay_v2.py:
//   POST /essay/grade        → pending record + BackgroundTask
//   GET  /essay/grades/{id}  → poll status (~1s 一次, status != pending 时停)
//   GET  /essay/grades       → 我的批改历史 (latest 20 DESC)

export const essayGradingKeys = {
  all: ['essay-grading'] as const,
  list: () => ['essay-grading', 'list'] as const,
  detail: (id: number) => ['essay-grading', 'detail', id] as const,
} as const;

export function submitEssayGrading(payload: EssayGradingSubmissionRequest) {
  return api.post<EssayGradingV2, EssayGradingSubmissionRequest>(
    '/essay/grade',
    payload,
  );
}

export function fetchEssayGrading(id: number) {
  return api.get<EssayGradingV2>(`/essay/grades/${id}`);
}

export function fetchMyEssayGradings() {
  return api.get<EssayGradingV2[]>('/essay/grades');
}

// ── Phase D — 申论专项练习 (跨卷单题 by canonical_subtype) ───────────────
// Backend: GET /api/v2/essay/specialty/questions?subtype=&page=&pageSize=

export interface EssaySpecialtyFilters {
  readonly subtype: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export const essaySpecialtyKeys = {
  all: ['essay-specialty'] as const,
  list: (filters: EssaySpecialtyFilters) =>
    ['essay-specialty', 'list', filters] as const,
} as const;

export function fetchEssaySpecialtyQuestions(filters: EssaySpecialtyFilters) {
  return api.get<EssaySpecialtyListResponseV2>(
    '/essay/specialty/questions',
    { params: filters },
  );
}

// ── batch 5b — 申论卷分页 (拆自 GET /papers 防 745 套全量铺爆 LCP) ──────
// Backend: GET /api/v2/papers/essay/list?page=&pageSize=

export interface EssayPapersFilters {
  readonly page?: number;
  readonly pageSize?: number;
}

export const essayPapersKeys = {
  all: ['papers', 'essay'] as const,
  paginated: (filters: EssayPapersFilters) =>
    ['papers', 'essay', 'paginated', filters] as const,
} as const;

export function fetchEssayPapersPaginated(filters: EssayPapersFilters) {
  return api.get<EssayPaperListResponseV2>('/papers/essay/list', {
    params: filters,
  });
}
