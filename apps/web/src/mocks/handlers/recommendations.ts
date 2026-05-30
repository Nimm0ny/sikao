/*
 * Recommendations phase MSW handlers — SIK-92 closeout.
 *
 * Mirrors the backend contract audited on 2026-05-30:
 *   - actionType: review / continue / rest
 *   - accept(session): returns sessionId + redirectUrl
 *   - accept(plan): returns eventId only; FE builds the optimistic event
 *     locally from targetDate + recommendation payload.
 */
import { http, HttpResponse } from 'msw';
import type {
  RecommendationAcceptResponseV2,
  RecommendationListResponseV2,
  RecommendationReadV2,
} from '@sikao/api-client/types/home';

const SAMPLE_RECS: RecommendationReadV2[] = [
  {
    id: 1,
    title: 'Review weak items first',
    actionType: 'review',
    cta: 'Review',
    estimatedMinutes: 20,
    expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:00:00Z',
    servedCount: 1,
    status: 'pending',
    reason: 'Your last submitted session shows a weak cluster that should be revisited.',
    payload: { session_template: { track: 'xingce', entry_kind: 'review' } },
    sourceSignals: {},
    llmCallId: null,
    acceptedAt: null,
    rejectedAt: null,
  },
  {
    id: 2,
    title: 'Continue the unfinished xingce set',
    actionType: 'continue',
    cta: 'Continue',
    estimatedMinutes: 30,
    expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:05:00Z',
    servedCount: 1,
    status: 'pending',
    reason: 'You already have an in-progress session, so resuming keeps context intact.',
    payload: { session_template: { track: 'xingce', entry_kind: 'practice' } },
    sourceSignals: { in_progress_session_id: 301 },
    llmCallId: null,
    acceptedAt: null,
    rejectedAt: null,
  },
  {
    id: 3,
    title: 'Reserve a short recovery block',
    actionType: 'rest',
    cta: 'Rest',
    estimatedMinutes: 15,
    expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:10:00Z',
    servedCount: 1,
    status: 'pending',
    reason: 'No higher-confidence practice card is available, so preserve a short recovery block.',
    payload: { rest_minutes: 15 },
    sourceSignals: { strategy: 'fallback_rest' },
    llmCallId: null,
    acceptedAt: null,
    rejectedAt: null,
  },
  {
    id: 4,
    title: 'Legacy review-session carry-over',
    actionType: 'review_session',
    cta: 'Review',
    estimatedMinutes: 30,
    expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:12:00Z',
    servedCount: 1,
    status: 'pending',
    reason: 'This older pending row should still render with the review visual channel.',
    payload: { session_template: { track: 'xingce', entry_kind: 'review', mode: 'wrong_redo' } },
    sourceSignals: {},
    llmCallId: null,
    acceptedAt: null,
    rejectedAt: null,
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

  http.post('/api/v2/recommendations/:id/accept', async ({ params, request }) => {
    const id = Number(params.id);
    const body = await request.json() as { action?: string; targetDate?: string | null };
    const recommendation = SAMPLE_RECS.find((item) => item.id === id);
    if (recommendation === undefined) {
      return HttpResponse.json({ detail: 'recommendation not found' }, { status: 404 });
    }
    if (body.action !== 'session' && body.action !== 'plan') {
      return HttpResponse.json({ detail: 'action must be session or plan' }, { status: 400 });
    }
    if (body.action === 'plan' && (typeof body.targetDate !== 'string' || body.targetDate.length === 0)) {
      return HttpResponse.json({ detail: 'targetDate is required for plan acceptance' }, { status: 400 });
    }
    if (body.action === 'session' && recommendation.actionType === 'rest') {
      return HttpResponse.json({ detail: 'rest recommendation cannot open a practice session' }, { status: 400 });
    }
    const response: RecommendationAcceptResponseV2 = {
      recommendationId: id,
      status: body.action === 'plan' ? 'accepted_plan' : 'accepted_session',
      sessionId: body.action === 'plan' ? null : 9000 + id,
      eventId: body.action === 'plan' ? 7000 + id : null,
      redirectUrl: body.action === 'plan' ? null : `/practice/sessions/${9000 + id}`,
    };
    return HttpResponse.json(response);
  }),

  http.post('/api/v2/recommendations/:id/reject', async ({ request }) => {
    const body = await request.json() as { reason?: string; note?: string | null };
    if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return HttpResponse.json({ detail: 'reason is required' }, { status: 400 });
    }
    if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
      return HttpResponse.json({ detail: 'note must be string or null' }, { status: 400 });
    }
    return HttpResponse.json({ ok: true, status: 'rejected' });
  }),
];
