/*
 * Recommendations phase MSW handlers — SIK-92 Home M-C (2026-05-24).
 *
 * Covers:
 *   - GET  /api/v2/recommendations/today
 *   - POST /api/v2/recommendations/refresh
 *   - POST /api/v2/recommendations/{id}/accept
 *   - POST /api/v2/recommendations/{id}/reject
 *
 * Stubs are minimal to satisfy the SIK-92 wave 1 acceptance plus the
 * accept(session) / accept(plan) / reject branches added in wave 2.
 */
import { http, HttpResponse } from 'msw';
import type {
  RecommendationListResponseV2,
  RecommendationReadV2,
  RecommendationAcceptResponseV2,
} from '@sikao/api-client/types/home';

const SAMPLE_RECS: RecommendationReadV2[] = [
  {
    id: 1, title: '言语理解 · 主旨题专项', actionType: 'practice',
    cta: '开始练习', estimatedMinutes: 20, expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:00:00Z', servedCount: 1, status: 'served',
    reason: '近 7 天主旨题正确率 58%，低于目标 70%',
    payload: {}, sourceSignals: {}, llmCallId: null,
    acceptedAt: null, rejectedAt: null,
  },
  {
    id: 2, title: '资料分析 · 增长率综合', actionType: 'practice',
    cta: '开始练习', estimatedMinutes: 30, expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:00:00Z', servedCount: 1, status: 'served',
    reason: '资料分析模块未练习 5 天，趋势下行',
    payload: {}, sourceSignals: {}, llmCallId: null,
    acceptedAt: null, rejectedAt: null,
  },
];

export const recommendationsHandlers = [
  http.get('/api/v2/recommendations/today', () => {
    const response: RecommendationListResponseV2 = { items: SAMPLE_RECS, total: SAMPLE_RECS.length };
    return HttpResponse.json(response);
  }),

  http.get('/api/v2/recommendations/history', () => {
    const response: RecommendationListResponseV2 = { items: [], total: 0 };
    return HttpResponse.json(response);
  }),

  http.post('/api/v2/recommendations/refresh', () => {
    const response: RecommendationListResponseV2 = { items: SAMPLE_RECS, total: SAMPLE_RECS.length };
    return HttpResponse.json(response);
  }),

  http.post('/api/v2/recommendations/:id/accept', ({ params }) => {
    const id = Number(params.id);
    const response: RecommendationAcceptResponseV2 = {
      recommendationId: id,
      status: 'accepted',
      sessionId: 9000 + id,
      eventId: null,
      redirectUrl: null,
    };
    return HttpResponse.json(response);
  }),

  http.post('/api/v2/recommendations/:id/reject', () => HttpResponse.json({ ok: true, status: 'rejected' })),
];
