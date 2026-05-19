import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@sikao/test-utils/server';
import Progress from '../Progress';
import { trackEvent } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
}

function renderProgress() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/progress']}>
        <Routes>
          <Route path="/progress" element={<Progress />} />
          <Route path="/plan" element={<div data-testid="plan-destination">plan</div>} />
          <Route path="/notes" element={<div data-testid="notes-destination">notes</div>} />
          <Route path="/notes/new" element={<div data-testid="note-editor-destination">note-editor</div>} />
          <Route path="/dashboard" element={<div data-testid="dashboard-destination">dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubExamEvents() {
  return http.get('/api/v2/exam-events', () =>
    HttpResponse.json({
      items: [
        {
          id: 1,
          name: '2026 国考',
          category: 'national',
          examDate: '2026-12-01',
          registrationStartDate: null,
          registrationEndDate: null,
          isActive: true,
          visibility: 'public',
          createdAt: '2026-05-01T00:00:00Z',
          updatedAt: '2026-05-01T00:00:00Z',
        },
      ],
    }),
  );
}

function buildTrendPoints(
  total: number,
  latestAccuracy: number,
  peakIndex: number,
  peakAccuracy: number,
) {
  return Array.from({ length: total }, (_, index) => ({
    date: `2026-03-${String((index % 28) + 1).padStart(2, '0')}`,
    accuracy:
      index === total - 1
        ? latestAccuracy
        : index === peakIndex
          ? peakAccuracy
          : 40 + (index % 12),
    answered: index + 1,
  }));
}

describe('Progress · view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading: 初次挂载显示 skeleton', () => {
    server.use(
      http.get('/api/v2/progress/weekly', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return HttpResponse.json({
          weekStart: '2026-05-13',
          weekEnd: '2026-05-19',
          xingceAnswered: 0,
          xingceAccuracy: 0,
          essaySubmitted: 0,
          tasksCompleted: 0,
          tasksTotal: 0,
          streakDays: 0,
        });
      }),
      http.get('/api/v2/progress/accuracy-trend', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return HttpResponse.json({ days: 30, points: [] });
      }),
      stubExamEvents(),
    );

    renderProgress();
    expect(screen.getByTestId('progress-view-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-view')).not.toBeInTheDocument();
  });

  it('data: 渲染统计卡、趋势图，并把主 CTA 导到 /plan', async () => {
    server.use(
      http.get('/api/v2/progress/weekly', () =>
        HttpResponse.json({
          weekStart: '2026-05-13',
          weekEnd: '2026-05-19',
          xingceAnswered: 48,
          xingceAccuracy: 73.5,
          essaySubmitted: 2,
          tasksCompleted: 3,
          tasksTotal: 5,
          streakDays: 6,
        }),
      ),
      http.get('/api/v2/progress/accuracy-trend', ({ request }) => {
        const days = new URL(request.url).searchParams.get('days');
        if (days === '7') {
          return HttpResponse.json({
            days: 7,
            points: [
              { date: '2026-05-13', accuracy: 62.5, answered: 12 },
              { date: '2026-05-19', accuracy: 79.2, answered: 18 },
            ],
          });
        }
        return HttpResponse.json({
          days: 30,
          points: [
            { date: '2026-05-01', accuracy: 55.1, answered: 10 },
            { date: '2026-05-10', accuracy: 68.4, answered: 14 },
            { date: '2026-05-19', accuracy: 73.5, answered: 18 },
          ],
        });
      }),
      stubExamEvents(),
    );

    renderProgress();

    await waitFor(() =>
      expect(screen.getByTestId('progress-view')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('progress-overview-card')).toBeInTheDocument();
    expect(screen.getByTestId('progress-trend-chart')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByTestId('progress-next-action-copy')).toHaveTextContent(
      '还差 2 个任务',
    );

    fireEvent.click(screen.getByTestId('progress-next-action'));
    await waitFor(() =>
      expect(screen.getByTestId('plan-destination')).toBeInTheDocument(),
    );
  });

  it('auth fail: 401 → AuthFallbackEmptyState', async () => {
    server.use(
      http.get('/api/v2/progress/weekly', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
      http.get('/api/v2/progress/accuracy-trend', () =>
        HttpResponse.json({ detail: 'unauthorized' }, { status: 401 }),
      ),
      stubExamEvents(),
    );

    renderProgress();
    await waitFor(() =>
      expect(
        screen.getByTestId('progress-view-auth-fallback'),
      ).toBeInTheDocument(),
    );
  });

  it('all zero: 显 empty state CTA 到 /dashboard', async () => {
    server.use(
      http.get('/api/v2/progress/weekly', () =>
        HttpResponse.json({
          weekStart: '2026-05-13',
          weekEnd: '2026-05-19',
          xingceAnswered: 0,
          xingceAccuracy: 0,
          essaySubmitted: 0,
          tasksCompleted: 0,
          tasksTotal: 0,
          streakDays: 0,
        }),
      ),
      http.get('/api/v2/progress/accuracy-trend', () =>
        HttpResponse.json({ days: 30, points: [] }),
      ),
      stubExamEvents(),
    );

    renderProgress();
    await waitFor(() =>
      expect(screen.getByTestId('progress-view-empty')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('progress-view-empty-cta'));
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-destination')).toBeInTheDocument(),
    );
  });

  it('error: 500 → error empty state + retry', async () => {
    server.use(
      http.get('/api/v2/progress/weekly', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      http.get('/api/v2/progress/accuracy-trend', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      stubExamEvents(),
    );

    renderProgress();
    await waitFor(
      () =>
        expect(screen.getByTestId('progress-view-error')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByTestId('progress-view-retry')).toBeInTheDocument();
  });

  it('90/180 day windows keep full selected-window stats and bars', async () => {
    const ninetyDayPoints = buildTrendPoints(45, 63.2, 4, 98.3);
    const oneEightyDayPoints = buildTrendPoints(61, 71.7, 10, 99.4);

    server.use(
      http.get('/api/v2/progress/weekly', () =>
        HttpResponse.json({
          weekStart: '2026-05-13',
          weekEnd: '2026-05-19',
          xingceAnswered: 36,
          xingceAccuracy: 68.4,
          essaySubmitted: 1,
          tasksCompleted: 2,
          tasksTotal: 4,
          streakDays: 5,
        }),
      ),
      http.get('/api/v2/progress/accuracy-trend', ({ request }) => {
        const days = new URL(request.url).searchParams.get('days');
        if (days === '90') {
          return HttpResponse.json({ days: 90, points: ninetyDayPoints });
        }
        if (days === '180') {
          return HttpResponse.json({ days: 180, points: oneEightyDayPoints });
        }
        return HttpResponse.json({
          days: 30,
          points: [
            { date: '2026-05-10', accuracy: 58.1, answered: 11 },
            { date: '2026-05-19', accuracy: 68.4, answered: 15 },
          ],
        });
      }),
      stubExamEvents(),
    );

    renderProgress();

    await waitFor(() =>
      expect(screen.getByTestId('progress-view')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('progress-range-90'));

    await waitFor(() =>
      expect(screen.getByTestId('progress-trend-latest')).toHaveTextContent(
        '63.2%',
      ),
    );
    expect(screen.getByTestId('progress-trend-peak')).toHaveTextContent(
      '98.3%',
    );
    expect(
      screen.getByTestId('progress-trend-bars').childElementCount,
    ).toBe(45);
    expect(screen.getByTestId('progress-context-trend-copy')).toHaveTextContent(
      '最近 63.2% · 峰值 98.3%',
    );

    fireEvent.click(screen.getByTestId('progress-range-180'));

    await waitFor(() =>
      expect(screen.getByTestId('progress-trend-latest')).toHaveTextContent(
        '71.7%',
      ),
    );
    expect(screen.getByTestId('progress-trend-peak')).toHaveTextContent(
      '99.4%',
    );
    expect(
      screen.getByTestId('progress-trend-bars').childElementCount,
    ).toBe(61);
    expect(screen.getByTestId('progress-context-trend-copy')).toHaveTextContent(
      '最近 71.7% · 峰值 99.4%',
    );
  });

  it('does not lock old users into global empty while 180-day history is still loading', async () => {
    let historyRequested = false;
    let resolveHistoryWindow: (() => void) | null = null;
    const delayedHistoryWindow = new Promise((resolve) => {
      resolveHistoryWindow = () => {
        resolve(
          HttpResponse.json({
            days: 180,
            points: [
              { date: '2026-01-18', accuracy: 82.5, answered: 24 },
              { date: '2026-02-09', accuracy: 76.1, answered: 19 },
            ],
          }),
        );
      };
    });

    server.use(
      http.get('/api/v2/progress/weekly', () =>
        HttpResponse.json({
          weekStart: '2026-05-13',
          weekEnd: '2026-05-19',
          xingceAnswered: 0,
          xingceAccuracy: 0,
          essaySubmitted: 0,
          tasksCompleted: 0,
          tasksTotal: 0,
          streakDays: 0,
        }),
      ),
      http.get('/api/v2/progress/accuracy-trend', ({ request }) => {
        const days = new URL(request.url).searchParams.get('days');
        if (days === '180') {
          historyRequested = true;
          return delayedHistoryWindow;
        }
        return HttpResponse.json({ days: Number(days ?? 30), points: [] });
      }),
      stubExamEvents(),
    );

    renderProgress();

    await waitFor(() => expect(historyRequested).toBe(true));
    expect(screen.getByTestId('progress-view-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-view-empty')).not.toBeInTheDocument();

    resolveHistoryWindow?.();

    await waitFor(() =>
      expect(screen.getByTestId('progress-view')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('progress-trend-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-view-empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('progress-range-180'));

    await waitFor(() =>
      expect(screen.getByTestId('progress-trend-latest')).toHaveTextContent(
        '76.1%',
      ),
    );
  });

  it('切换趋势区间: 重新请求数据并上报 analytics', async () => {
    server.use(
      http.get('/api/v2/progress/weekly', () =>
        HttpResponse.json({
          weekStart: '2026-05-13',
          weekEnd: '2026-05-19',
          xingceAnswered: 24,
          xingceAccuracy: 66.5,
          essaySubmitted: 1,
          tasksCompleted: 4,
          tasksTotal: 4,
          streakDays: 3,
        }),
      ),
      http.get('/api/v2/progress/accuracy-trend', ({ request }) => {
        const days = new URL(request.url).searchParams.get('days');
        if (days === '7') {
          return HttpResponse.json({
            days: 7,
            points: [
              { date: '2026-05-18', accuracy: 88.8, answered: 8 },
              { date: '2026-05-19', accuracy: 91.2, answered: 9 },
            ],
          });
        }
        return HttpResponse.json({
          days: 30,
          points: [
            { date: '2026-05-01', accuracy: 61.1, answered: 10 },
            { date: '2026-05-19', accuracy: 66.5, answered: 14 },
          ],
        });
      }),
      stubExamEvents(),
    );

    renderProgress();

    await waitFor(() =>
      expect(screen.getByTestId('progress-trend-latest')).toHaveTextContent(
        '66.5%',
      ),
    );
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'progress_viewed',
      properties: { trendDays: '30' },
    });

    fireEvent.click(screen.getByTestId('progress-range-7'));

    await waitFor(() =>
      expect(screen.getByTestId('progress-trend-latest')).toHaveTextContent(
        '91.2%',
      ),
    );
    expect(trackEvent).toHaveBeenLastCalledWith({
      eventName: 'progress_viewed',
      properties: { trendDays: '7' },
    });
  });
});
