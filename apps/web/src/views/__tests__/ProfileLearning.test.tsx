import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';

import ProfileLearning from '../ProfileLearning';

beforeEach(() => {
  vi.useRealTimers();
  if (!window.ResizeObserver) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver =
      ResizeObserverMock as unknown as typeof window.ResizeObserver;
  }

  server.resetHandlers();
  server.use(
    http.get('/api/v2/dashboard/progress', () =>
      HttpResponse.json({
        summary: {
          today: {
            minutesPracticed: 45,
            itemsAnswered: 15,
            accuracy: '0.80',
            sessionsCount: 1,
          },
          week: {
            minutesPracticed: 240,
            itemsAnswered: 80,
            accuracy: '0.76',
            sessionsCount: 5,
          },
          allTime: {
            minutesPracticed: 960,
            itemsAnswered: 320,
            accuracy: '0.74',
            sessionsCount: 24,
          },
          planSlice: {
            planId: 11,
            rangeFrom: '2026-05-19',
            rangeTo: '2026-05-25',
            eventsInWindowTotal: 8,
            eventsDone: 2,
            eventsSkipped: 0,
            minutesTargetInWindow: 600,
            minutesPracticedInWindow: 240,
          },
        },
        subjectAccuracies: [
          {
            subjectKey: 'yanyu',
            subjectLabel: '言语',
            answered: 28,
            correct: 18,
            accuracy: '0.64',
          },
          {
            subjectKey: 'panduan',
            subjectLabel: '判断',
            answered: 22,
            correct: 17,
            accuracy: '0.77',
          },
          {
            subjectKey: 'shuliang',
            subjectLabel: '数量',
            answered: 18,
            correct: 10,
            accuracy: '0.55',
          },
        ],
        weaknessTop3: [],
        nearestExamTarget: {
          examId: 'GK-2026',
          examName: '国考',
          examDate: '2026-08-10',
          daysUntil: 80,
        },
      }),
    ),
    http.get('/api/v2/dashboard/progress/diagnosis', () =>
      HttpResponse.json({
        generatedAt: '2026-05-22T00:00:00Z',
        strengths: ['连续 7 天保持练习'],
        weaknesses: ['言语正确率波动较大'],
        suggestions: ['先做一轮薄弱项复盘'],
      }),
    ),
    http.get('/api/v2/dashboard/progress/timeseries', ({ request }) => {
      const granularity = new URL(request.url).searchParams.get('granularity');
      return HttpResponse.json({
        from: granularity === 'week' ? '2026-03-01' : '2026-05-09',
        to: '2026-05-22',
        granularity: granularity === 'week' ? 'week' : 'day',
        points:
          granularity === 'week'
            ? [
                {
                  bucketStart: '2026-05-05',
                  bucketEnd: '2026-05-11',
                  minutesPracticed: 120,
                  itemsAnswered: 48,
                  accuracy: '0.71',
                  sessionsCount: 3,
                },
                {
                  bucketStart: '2026-05-12',
                  bucketEnd: '2026-05-18',
                  minutesPracticed: 180,
                  itemsAnswered: 64,
                  accuracy: '0.76',
                  sessionsCount: 4,
                },
              ]
            : [
                {
                  bucketStart: '2026-05-21',
                  bucketEnd: '2026-05-21',
                  minutesPracticed: 42,
                  itemsAnswered: 13,
                  accuracy: '0.78',
                  sessionsCount: 1,
                },
                {
                  bucketStart: '2026-05-22',
                  bucketEnd: '2026-05-22',
                  minutesPracticed: 45,
                  itemsAnswered: 15,
                  accuracy: '0.80',
                  sessionsCount: 1,
                },
              ],
      });
    }),
    http.post('/api/v2/recommendations/refresh', () =>
      HttpResponse.json({
        items: [],
        total: 0,
      }),
    ),
  );
});

describe('ProfileLearning view', () => {
  it('renders radar, plan slice, diagnosis, and full timeseries chart', async () => {
    renderWithProviders(<ProfileLearning />, {
      initialEntries: ['/profile/learning'],
    });

    expect(await screen.findByTestId('profile-learning-plan-slice')).toBeInTheDocument();
    expect(await screen.findByTestId('profile-learning-radar')).toBeInTheDocument();
    expect(await screen.findByTestId('profile-learning-timeseries')).toBeInTheDocument();
    expect(await screen.findByTestId('profile-learning-diagnosis')).toBeInTheDocument();
  });

  it('switches timeseries granularity and metric, then refreshes recommendations from diagnosis', async () => {
    const user = userEvent.setup();
    let requestedGranularity = 'day';
    let refreshCalled = false;

    server.use(
      http.get('/api/v2/dashboard/progress/timeseries', ({ request }) => {
        requestedGranularity =
          new URL(request.url).searchParams.get('granularity') ?? 'day';
        return HttpResponse.json({
          from: requestedGranularity === 'week' ? '2026-03-01' : '2026-05-09',
          to: '2026-05-22',
          granularity: requestedGranularity,
          points:
            requestedGranularity === 'week'
              ? [
                  {
                    bucketStart: '2026-05-05',
                    bucketEnd: '2026-05-11',
                    minutesPracticed: 120,
                    itemsAnswered: 48,
                    accuracy: '0.71',
                    sessionsCount: 3,
                  },
                  {
                    bucketStart: '2026-05-12',
                    bucketEnd: '2026-05-18',
                    minutesPracticed: 180,
                    itemsAnswered: 64,
                    accuracy: '0.76',
                    sessionsCount: 4,
                  },
                ]
              : [
                  {
                    bucketStart: '2026-05-22',
                    bucketEnd: '2026-05-22',
                    minutesPracticed: 45,
                    itemsAnswered: 15,
                    accuracy: '0.80',
                    sessionsCount: 1,
                  },
                ],
        });
      }),
      http.post('/api/v2/recommendations/refresh', () => {
        refreshCalled = true;
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );

    renderWithProviders(<ProfileLearning />, {
      initialEntries: ['/profile/learning'],
    });

    await screen.findByTestId('profile-learning-timeseries');
    await user.selectOptions(screen.getByLabelText('timeseries granularity'), 'week');

    await waitFor(() => expect(requestedGranularity).toBe('week'));

    await user.selectOptions(screen.getByLabelText('timeseries metric'), 'minutesPracticed');
    expect(await screen.findByText('最新值：3h')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '刷新今日推荐' }));
    await waitFor(() => expect(refreshCalled).toBe(true));
  });

  it('renders empty radar state when subject accuracies are missing and surfaces refresh failure', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/v2/dashboard/progress', () =>
        HttpResponse.json({
          summary: {
            today: {
              minutesPracticed: 45,
              itemsAnswered: 15,
              accuracy: null,
              sessionsCount: 1,
            },
            week: {
              minutesPracticed: 240,
              itemsAnswered: 80,
              accuracy: null,
              sessionsCount: 5,
            },
            allTime: {
              minutesPracticed: 960,
              itemsAnswered: 320,
              accuracy: null,
              sessionsCount: 24,
            },
            planSlice: {
              planId: 11,
              rangeFrom: '2026-05-19',
              rangeTo: '2026-05-25',
              eventsInWindowTotal: 8,
              eventsDone: 2,
              eventsSkipped: 0,
              minutesTargetInWindow: 600,
              minutesPracticedInWindow: 240,
            },
          },
          subjectAccuracies: [
            {
              subjectKey: 'yanyu',
              subjectLabel: '言语',
              answered: 28,
              correct: 18,
              accuracy: null,
            },
            {
              subjectKey: 'panduan',
              subjectLabel: '判断',
              answered: 22,
              correct: 17,
              accuracy: null,
            },
            {
              subjectKey: 'shuliang',
              subjectLabel: '数量',
              answered: 18,
              correct: 10,
              accuracy: null,
            },
          ],
          weaknessTop3: [],
          nearestExamTarget: null,
        }),
      ),
      http.post('/api/v2/recommendations/refresh', () =>
        HttpResponse.json({ detail: 'refresh failed' }, { status: 500 }),
      ),
    );

    renderWithProviders(<ProfileLearning />, {
      initialEntries: ['/profile/learning'],
    });

    expect(
      await screen.findByText('弱项雷达暂不可用'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '刷新今日推荐' }));
    expect(
      await screen.findByText(/刷新今日推荐失败/i),
    ).toBeInTheDocument();
  });
});
