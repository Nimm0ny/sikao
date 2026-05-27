import { http, HttpResponse } from 'msw';

import type {
  CauseAnalysisResponseV2,
  CauseTagListResponseV2,
  DashboardReviewResponseV2,
  PracticeAnswerFeedResponseV2,
  ReviewDebtPlanResponseV2,
  ReviewDebtSnapshotResponseV2,
  ReviewDetailResponseV2,
  ReviewInsightsCausesResponseV2,
  ReviewInsightsRedoAccuracyResponseV2,
  ReviewInsightsTrendsResponseV2,
  ReviewItemV2,
  ReviewListResponseV2,
  ReviewWeeklySummaryResponseV2,
} from '@sikao/api-client/types/review';
import type { RequestHandler } from 'msw';

function makeReviewItem(id: number, overrides: Partial<ReviewItemV2> = {}): ReviewItemV2 {
  return {
    id,
    kind: 'wrong_answer',
    title: `Review item ${id}`,
    href: `/q/${id}?ctx=review&review_id=${id}`,
    status: 'pending',
    questionId: id,
    correctStreak: 0,
    hasCauseAnalysis: id % 2 === 0,
    hasUserNotes: id % 3 === 0,
    createdAt: '2026-05-27T09:00:00Z',
    updatedAt: '2026-05-27T09:00:00Z',
    nextReviewAt: '2026-05-28T09:00:00Z',
    ...overrides,
  };
}

const reviewItems: ReviewItemV2[] = [
  makeReviewItem(101),
  makeReviewItem(102, { status: 'in_progress', correctStreak: 1 }),
  makeReviewItem(103, { status: 'graduated', correctStreak: 3 }),
];

const reviewListResponse: ReviewListResponseV2 = {
  items: reviewItems,
  total: reviewItems.length,
  page: 1,
  pageSize: 20,
};

const reviewDetailResponse: ReviewDetailResponseV2 = {
  item: reviewItems[0],
  history: [
    { id: 1, outcome: 'incorrect', attemptedAt: '2026-05-21T09:00:00Z', notesJson: {} },
    { id: 2, outcome: 'correct', attemptedAt: '2026-05-25T09:00:00Z', notesJson: {} },
  ],
  actions: [
    { key: 'redo', label: '去重做', href: '/q/101/redo?ctx=review&review_id=101', enabled: true },
  ],
  metadata: { sourceKind: 'wrong_answer' },
};

const dashboardReviewResponse: DashboardReviewResponseV2 = {
  items: reviewItems.slice(0, 2),
  total: 2,
};

const reviewWeeklySummaryResponse: ReviewWeeklySummaryResponseV2 = {
  week: '2026-W22',
  itemsReviewed: 12,
  redoAccuracyPct: 75,
  newGraduatedCount: 3,
  newNotesCount: 2,
  generatedNoteId: null,
  nextWeekFocus: '数量关系',
  biggestConcern: {
    label: '概念混淆',
    slug: 'concept_confusion',
    summary: '数量关系概念混淆仍是本周最大风险。',
  },
  biggestProgress: {
    title: '资料分析',
    summary: '从 likely 提升到 certain。',
    questionId: 101,
    fromConfidence: 'likely',
    toConfidence: 'certain',
  },
};

const reviewDebtSnapshotResponse: ReviewDebtSnapshotResponseV2 = {
  canRedistribute: true,
  dailyLimit: 20,
  debtSeverity: 'moderate',
  oldestOverdueDays: 8,
  overdueCount: 14,
  rampupActive: false,
  rampupPhase: null,
  rampupStartedAt: null,
  rampupUnlockAt: null,
  recommendedTodayCount: 12,
  redistributedCount: 3,
};

const reviewDebtPlanResponse: ReviewDebtPlanResponseV2 = {
  buckets: [
    { date: '2026-05-28', count: 4 },
    { date: '2026-05-29', count: 5 },
  ],
  spreadDays: 2,
  totalCount: 9,
};

const reviewInsightsTrendsResponse: ReviewInsightsTrendsResponseV2 = {
  days: [
    { date: '2026-05-24', newIncorrect: 3, graduated: 1, netAccumulation: 2 },
    { date: '2026-05-25', newIncorrect: 1, graduated: 2, netAccumulation: 1 },
  ],
};

const reviewInsightsCausesResponse: ReviewInsightsCausesResponseV2 = {
  causes: [
    {
      slug: 'concept_confusion',
      name: '概念混淆',
      count: 5,
      severityDistribution: { high: 3, medium: 2 },
    },
  ],
};

const reviewInsightsRedoAccuracyResponse: ReviewInsightsRedoAccuracyResponseV2 = {
  weeks: [
    { week: '2026-W21', accuracyPct: 60, correctCount: 6, totalAttempts: 10 },
    { week: '2026-W22', accuracyPct: 75, correctCount: 9, totalAttempts: 12 },
  ],
};

const causeTagsResponse: CauseTagListResponseV2 = {
  items: [
    {
      id: 1,
      slug: 'concept_confusion',
      name: '概念混淆',
      description: '基础概念理解不稳。',
      category: 'cognition',
      severityDefault: 'high',
      taxonomyVersion: 'v1',
      displayOrder: 1,
      isActive: true,
    },
  ],
  total: 1,
};

const causeAnalysisResponse: CauseAnalysisResponseV2 = {
  analysisId: 501,
  cached: false,
  expiresAt: '2026-05-27T12:00:00Z',
  llmCallId: 901,
  mode: 'single',
  scope: 'single',
  version: 1,
  warningCode: null,
  result: {
    summary: '主要问题在概念混淆。',
    mode: 'single',
    dimensions: [
      {
        slug: 'concept_confusion',
        nameDisplay: '概念混淆',
        severity: 'high',
        suggestion: '回看概念定义并重做同类题。',
        userOverride: null,
      },
    ],
    suggestedActions: ['回看概念定义', '重做 5 道同类题'],
    relatedQuestions: [101, 102],
    evolutionContext: null,
  },
};

const practiceAnswerFeedResponse: PracticeAnswerFeedResponseV2 = {
  items: [
    {
      questionId: 101,
      sessionId: 7001,
      isCorrect: false,
      answeredAt: '2026-05-26T08:00:00Z',
      confidence: null,
      durationSeconds: 42,
    },
    {
      questionId: 102,
      sessionId: 7002,
      isCorrect: true,
      answeredAt: '2026-05-25T08:00:00Z',
      confidence: null,
      durationSeconds: 35,
    },
  ],
  total: 2,
  limit: 200,
};

export const reviewHandlers: RequestHandler[] = [
  http.get('/api/v2/dashboard/today/review', () => HttpResponse.json(dashboardReviewResponse)),
  http.get('/api/v2/review/items', () => HttpResponse.json(reviewListResponse)),
  http.get('/api/v2/review/items/:itemId', () => HttpResponse.json(reviewDetailResponse)),
  http.post('/api/v2/review/items', () => HttpResponse.json(reviewItems[0])),
  http.post('/api/v2/review/items/batch', () =>
    HttpResponse.json({ successCount: 1, failureCount: 0, errors: [] })),
  http.patch('/api/v2/review/items/:itemId/graduate', () => HttpResponse.json(reviewItems[1])),
  http.patch('/api/v2/review/items/:itemId/archive', () => HttpResponse.json(reviewItems[1])),
  http.patch('/api/v2/review/items/:itemId/restore', () => HttpResponse.json(reviewItems[0])),
  http.post('/api/v2/review/items/:itemId/redo', () =>
    HttpResponse.json({ ok: true, status: 'started', sessionId: 8001 })),
  http.post('/api/v2/review/items/:itemId/add-to-plan', () =>
    HttpResponse.json({ ok: true, status: 'accepted' })),
  http.post('/api/v2/review/items/:itemId/attempt', () => HttpResponse.json(reviewDetailResponse)),
  http.get('/api/v2/review/weekly-summary', () => HttpResponse.json(reviewWeeklySummaryResponse)),
  http.get('/api/v2/review/insights/trends', () => HttpResponse.json(reviewInsightsTrendsResponse)),
  http.get('/api/v2/review/insights/causes', () => HttpResponse.json(reviewInsightsCausesResponse)),
  http.get('/api/v2/review/insights/redo-accuracy', () =>
    HttpResponse.json(reviewInsightsRedoAccuracyResponse)),
  http.get('/api/v2/review/debt/snapshot', () => HttpResponse.json(reviewDebtSnapshotResponse)),
  http.get('/api/v2/review/debt/plan', () => HttpResponse.json(reviewDebtPlanResponse)),
  http.post('/api/v2/review/debt/redistribute', () => HttpResponse.json(reviewDebtSnapshotResponse)),
  http.post('/api/v2/review/debt/skip-rampup', () => HttpResponse.json(reviewDebtSnapshotResponse)),
  http.get('/api/v2/review/cause-tags', () => HttpResponse.json(causeTagsResponse)),
  http.post('/api/v2/review/items/:itemId/cause-analysis', () => HttpResponse.json(causeAnalysisResponse)),
  http.post('/api/v2/review/cause-analysis/group', () =>
    HttpResponse.json({ ...causeAnalysisResponse, mode: 'group', scope: 'group' })),
  http.patch('/api/v2/review/cause-analysis/:analysisId/dimensions/:dimensionIndex', () =>
    HttpResponse.json(causeAnalysisResponse)),
  http.post('/api/v2/review/cause-analysis/:analysisId/feedback', () =>
    HttpResponse.json({ ok: true, status: 'recorded' })),
  http.get('/api/v2/practice/answers', () => HttpResponse.json(practiceAnswerFeedResponse)),
];
