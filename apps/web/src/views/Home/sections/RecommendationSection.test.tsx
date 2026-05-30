/*
 * RecommendationSection tests — SIK-92 closeout.
 * Covers ready / empty / error / loading + accept(session) / accept(plan)
 * + reject reason-first validation + close/reopen draft restore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { usePlanStore, useRecommendationDraftStore } from '@sikao/domain';
import { server } from '../../../mocks/server';
import { RecommendationSection } from './RecommendationSection';
import { WeekCalendarView } from './WeekCalendarView';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: vi.fn() };
});

function renderWithEnv() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <RecommendationSection />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function renderWithCalendar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <>
          <RecommendationSection />
          <WeekCalendarView />
        </>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const READY_RECS = [
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
    estimatedMinutes: 25,
    expiresAt: '2026-05-25T00:00:00Z',
    generatedAt: '2026-05-24T08:01:00Z',
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
    generatedAt: '2026-05-24T08:02:00Z',
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
    generatedAt: '2026-05-24T08:03:00Z',
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

beforeEach(() => {
  sessionStorage.clear();
  usePlanStore.setState({
    currentPlanId: null,
    currentView: 'week',
    currentDate: '2026-05-30',
    selectedRange: null,
    optimisticEvents: new Map(),
  });
  useRecommendationDraftStore.setState({ draftsByRecommendationId: {} });
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
});

describe('RecommendationSection (SIK-92)', () => {
  it('ready: renders current backend actionType contract without legacy practice alias', async () => {
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: READY_RECS, total: READY_RECS.length }),
      ),
    );

    renderWithEnv();

    await waitFor(() => expect(screen.getByTestId('home-recommendation')).toBeInTheDocument());
    expect(screen.getByTestId('home-recommendation-1')).toHaveAttribute('data-kind', 'k-review');
    expect(screen.getByTestId('home-recommendation-2')).toHaveAttribute('data-kind', 'k-practice');
    expect(screen.getByTestId('home-recommendation-3')).toHaveAttribute('data-kind', 'k-rest');
    expect(screen.getByTestId('home-recommendation-4')).toHaveAttribute('data-kind', 'k-review');
  });

  it('empty: renders EmptyState + refresh CTA', async () => {
    server.use(http.get('/api/v2/recommendations/today', () => HttpResponse.json({ items: [], total: 0 })));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation-empty')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '刷新推荐' })).toBeInTheDocument();
  });

  it('SIK-143: renders bc-head 今日推荐 + refresh icon-btn (ready state)', async () => {
    // SIK-143: refresh moved from a floating bottom Button into the bc-head
    // as an icon-only button. The visible label is dropped but aria-label
    // "刷新推荐" is preserved, and a bc-head h4 "今日推荐" replaces the
    // removed 57px Panel header title.
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: [READY_RECS[1]], total: 1 }),
      ),
    );
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '今日推荐', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新推荐' })).toBeInTheDocument();
  });

  it('error: renders EmptyState on 500', async () => {
    server.use(http.get('/api/v2/recommendations/today', () => HttpResponse.json({}, { status: 500 })));
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation-error')).toBeInTheDocument());
  });

  it('loading: renders Skeleton while in flight', async () => {
    server.use(http.get('/api/v2/recommendations/today', async () => {
      await delay(50);
      return HttpResponse.json({ items: [], total: 0 });
    }));
    renderWithEnv();
    expect(screen.getByTestId('home-recommendation-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('home-recommendation-loading')).not.toBeInTheDocument());
  });

  it('accept(session): feed-item click opens AcceptOptionMenu, 立即开始 navigates', async () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: [READY_RECS[1]], total: 1 }),
      ),
      http.post('/api/v2/recommendations/:id/accept', () =>
        HttpResponse.json({
          recommendationId: 2,
          status: 'accepted_session',
          sessionId: 9001,
          eventId: null,
          redirectUrl: '/practice/sessions/9001',
        }),
      ),
    );

    const user = userEvent.setup();
    renderWithEnv();
    await waitFor(() => expect(screen.getByTestId('home-recommendation-2')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Continue the unfinished xingce set/i }));
    await waitFor(() => expect(screen.getByTestId('accept-option-menu')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '立即开始' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/practice/sessions/9001'));
  });

  it('accept(plan): posts targetDate and writes backend-aligned optimistic event', async () => {
    let receivedBody: { action?: string; targetDate?: string | null } | null = null;
    let createdEvent = false;
    usePlanStore.setState({ currentDate: '2026-06-01', currentView: 'week', selectedRange: null });
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: [READY_RECS[0]], total: 1 }),
      ),
      http.get('/api/v2/plans/events', () =>
        createdEvent
          ? delay(50).then(() => HttpResponse.json({
              data: {
                events: [{
                  id: '701',
                  title: 'Review weak items first',
                  startAt: '2026-06-01T18:00:00+08:00',
                  endAt: '2026-06-01T18:20:00+08:00',
                  category: 'custom',
                  status: 'planned',
                  source: 'ai_generated',
                  timezone: 'Asia/Shanghai',
                  notes: 'Your last submitted session shows a weak cluster that should be revisited.',
                  planId: 1,
                  isRecurringInstance: false,
                  deletedAt: null,
                  linkedSessionId: null,
                  parentId: null,
                  recurringExceptionDates: [],
                  recurringParentId: null,
                  recurringRule: null,
                  targetId: null,
                }],
                practiceBlocks: [],
              },
              meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
            }))
          : HttpResponse.json({
          data: {
            events: [],
            practiceBlocks: [],
          },
          meta: { from: '', to: '', tz: 'Asia/Shanghai', includePracticeBlocks: false },
        }),
      ),
      http.post('/api/v2/plans/events/aggregates', () => HttpResponse.json({ items: [] })),
      http.post('/api/v2/recommendations/:id/accept', async ({ request }) => {
        receivedBody = (await request.json()) as { action?: string; targetDate?: string | null };
        createdEvent = true;
        return HttpResponse.json({
          recommendationId: 1,
          status: 'accepted_plan',
          sessionId: null,
          eventId: 701,
          redirectUrl: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithCalendar();

    await waitFor(() => expect(screen.getByTestId('home-recommendation-1')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Review weak items first/i }));
    await waitFor(() => expect(screen.getByTestId('accept-option-menu')).toBeInTheDocument());
    await user.clear(screen.getByTestId('accept-option-target-date'));
    await user.type(screen.getByTestId('accept-option-target-date'), '2026-06-01');
    await user.click(screen.getByTestId('accept-option-plan-submit'));

    await waitFor(() => expect(receivedBody).toEqual({ action: 'plan', targetDate: '2026-06-01' }));
    await waitFor(() => {
      expect(usePlanStore.getState().optimisticEvents.get('701')).toMatchObject({
        id: '701',
        startAt: '2026-06-01T18:00:00+08:00',
        endAt: '2026-06-01T18:20:00+08:00',
      });
    });
    await waitFor(() => {
      expect(screen.getAllByTestId('home-week-event')).toHaveLength(1);
    });
    expect(screen.getByTestId('home-week-cell-2026-06-01-2')).toContainElement(
      screen.getByTestId('home-week-event'),
    );
    await waitFor(() => expect(usePlanStore.getState().optimisticEvents.get('701')).toBeUndefined());
  });

  it('rest: does not expose session accept and routes primary action through plan acceptance', async () => {
    let receivedBody: { action?: string; targetDate?: string | null } | null = null;
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: [READY_RECS[2]], total: 1 }),
      ),
      http.post('/api/v2/recommendations/:id/accept', async ({ request }) => {
        receivedBody = (await request.json()) as { action?: string; targetDate?: string | null };
        return HttpResponse.json({
          recommendationId: 3,
          status: 'accepted_plan',
          sessionId: null,
          eventId: 703,
          redirectUrl: null,
        });
      }),
    );

    const user = userEvent.setup();
    renderWithEnv();

    await waitFor(() => expect(screen.getByTestId('home-recommendation-3')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Reserve a short recovery block/i }));
    await waitFor(() => expect(screen.getByTestId('accept-option-menu')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '加入计划' })).toBeInTheDocument();
    expect(screen.queryByTestId('accept-option-plan-submit')).toBeNull();

    await user.clear(screen.getByTestId('accept-option-target-date'));
    await user.click(screen.getByRole('button', { name: '加入计划' }));
    expect(await screen.findByText('请选择有效日期后再加入计划。')).toBeInTheDocument();

    await user.type(screen.getByTestId('accept-option-target-date'), '2026-05-30');
    await user.click(screen.getByRole('button', { name: '加入计划' }));
    await waitFor(() => expect(receivedBody?.action).toBe('plan'));
    expect(receivedBody?.targetDate).toBe('2026-05-30');
  });

  it('reject: note-only draft restores across close/reopen, but submit stays reason-first', async () => {
    let rejectCount = 0;
    let receivedBody: { reason?: string; note?: string | null } | null = null;
    server.use(
      http.get('/api/v2/recommendations/today', () =>
        HttpResponse.json({ items: [READY_RECS[0]], total: 1 }),
      ),
      http.post('/api/v2/recommendations/:id/reject', async ({ request }) => {
        rejectCount += 1;
        receivedBody = (await request.json()) as { reason?: string; note?: string | null };
        return HttpResponse.json({ ok: true, status: 'rejected' });
      }),
    );

    const user = userEvent.setup();
    renderWithEnv();

    await waitFor(() => expect(screen.getByTestId('home-recommendation-1')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Review weak items first/i }));
    await waitFor(() => expect(screen.getByTestId('accept-option-reject')).toBeInTheDocument());
    await user.click(screen.getByTestId('accept-option-reject'));
    await waitFor(() => expect(screen.getByTestId('reject-feedback')).toBeInTheDocument());

    await user.type(screen.getByLabelText('补充说明（可选）'), 'Need a different slot');
    await user.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByTestId('reject-feedback')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Review weak items first/i }));
    await user.click(screen.getByTestId('accept-option-reject'));
    await waitFor(() => expect(screen.getByTestId('reject-feedback')).toBeInTheDocument());
    expect(screen.getByLabelText('补充说明（可选）')).toHaveValue('Need a different slot');

    await user.click(screen.getByRole('button', { name: '提交反馈' }));
    expect(await screen.findByText('请选择原因后再提交反馈。')).toBeInTheDocument();
    expect(rejectCount).toBe(0);

    await user.click(screen.getByTestId('reject-reason-wrong-time'));
    await user.click(screen.getByRole('button', { name: '提交反馈' }));

    await waitFor(() => expect(receivedBody).toEqual({ reason: 'wrong-time', note: 'Need a different slot' }));
    await waitFor(() => expect(screen.queryByTestId('reject-feedback')).not.toBeInTheDocument());
    expect(useRecommendationDraftStore.getState().getDraft(1)).toBeNull();
  });
});
