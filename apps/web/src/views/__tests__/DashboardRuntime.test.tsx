import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { usePlanStore } from '@sikao/domain/plan/usePlanStore';
import { useRecommendationDraftStore } from '@sikao/domain/dashboard/useRecommendationDraftStore';

import { buildTargetDateOptions } from '@/components/dashboard-sikao/recommend/recommendRuntime';

import Dashboard from '../Dashboard';

const activePlan = {
  id: 11,
  name: 'Sprint plan',
  targetExamId: 'GK-2026',
  targetExamDate: '2026-08-10',
  dailyMinutesTarget: 120,
  style: 'balanced',
  baseline: {},
  focusSubjects: ['xingce'],
  status: 'active',
  source: 'user_manual',
  changeLog: [],
  deletedAt: null,
  archivedAt: null,
  createdAt: '2026-05-22T00:00:00Z',
  updatedAt: '2026-05-22T00:00:00Z',
};

function renderDashboardRoute() {
  return renderWithProviders(
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/profile/learning" element={<div data-testid="profile-learning-route" />} />
      <Route path="/practice/sessions/:sessionId" element={<div data-testid="session-route" />} />
    </Routes>,
    { initialEntries: ['/dashboard'] },
  );
}

beforeEach(() => {
  vi.useRealTimers();
  usePlanStore.setState({
    currentPlanId: null,
    currentView: 'week',
    currentDate: '2026-05-22',
    selectedRange: null,
    optimisticEvents: new Map(),
  });
  useRecommendationDraftStore.setState({ draftsByRecommendationId: {} });
  server.resetHandlers();
  server.use(
    http.get('/api/v2/plans', () =>
      HttpResponse.json({
        items: [activePlan],
        total: 1,
      }),
    ),
    http.get('/api/v2/profile/info', () =>
      HttpResponse.json({
        displayName: 'Tester',
        realName: null,
        region: null,
        bio: null,
        aiAdjustEnabled: true,
        dashboardPreferences: {},
        recommenderPreferences: {},
      }),
    ),
    http.get('/api/v2/profile/goals', () =>
      HttpResponse.json({
        weeklyTargetHours: 14,
        examTargets: [
          {
            examId: 'GK-2026',
            examName: '国考',
            examDate: '2026-08-10',
            subjects: ['xingce'],
          },
        ],
      }),
    ),
    http.get('/api/v2/plans/adjustments', () =>
      HttpResponse.json({
        items: [],
        total: 0,
      }),
    ),
    http.get('/api/v2/dashboard/full-plan', () =>
      HttpResponse.json({
        anchorDate: '2026-05-22',
        from: '2026-05-19',
        to: '2026-05-25',
        view: 'week',
        planId: 11,
        targets: [],
        summary: {
          totalEvents: 1,
          plannedCount: 1,
          inProgressCount: 0,
          doneCount: 0,
          skippedCount: 0,
          eventMinutesTotal: 60,
          practiceMinutesTotal: 0,
          completionRate: '0.00',
        },
        events: [
          {
            id: '11:2026-05-22',
            planId: 11,
            title: 'Morning drill',
            category: 'xingce',
            notes: '',
            startAt: '2026-05-22T01:00:00.000Z',
            endAt: '2026-05-22T02:00:00.000Z',
            timezone: 'Asia/Shanghai',
            status: 'planned',
            source: 'user_manual',
            parentId: null,
            recurringRule: null,
            recurringParentId: null,
            recurringExceptionDates: [],
            linkedSessionId: null,
            targetId: null,
            deletedAt: null,
            isRecurringInstance: false,
          },
        ],
        practiceBlocks: [],
      }),
    ),
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
        weaknessTop3: [],
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
        ],
        nearestExamTarget: {
          examId: 'GK-2026',
          examName: '国考',
          examDate: '2026-08-10',
          daysUntil: 80,
        },
      }),
    ),
    http.get('/api/v2/dashboard/progress/timeseries', () =>
      HttpResponse.json({
        from: '2026-05-16',
        to: '2026-05-22',
        granularity: 'day',
        points: [
          {
            bucketStart: '2026-05-16',
            bucketEnd: '2026-05-16',
            minutesPracticed: 30,
            itemsAnswered: 10,
            accuracy: '0.70',
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
      }),
    ),
    http.get('/api/v2/dashboard/progress/weakness', () =>
      HttpResponse.json({
        items: [
          {
            subjectKey: 'yanyu',
            subjectLabel: '言语',
            answered: 28,
            correct: 18,
            accuracy: '0.64',
            severity: 'medium',
            trend: 'up',
          },
        ],
      }),
    ),
    http.get('/api/v2/recommendations/today', () =>
      HttpResponse.json({
        items: [
          {
            id: 5,
            title: '先复盘薄弱题',
            reason: '言语正确率近期回落，先复盘最划算。',
            estimatedMinutes: 30,
            cta: '去做',
            actionType: 'review',
            payload: {},
            generatedAt: '2026-05-22T00:00:00Z',
            expiresAt: '2026-05-22T23:00:00Z',
            servedCount: 1,
            status: 'pending',
            acceptedAt: null,
            rejectedAt: null,
            sourceSignals: {},
            llmCallId: 101,
          },
        ],
        total: 1,
      }),
    ),
  );
});

describe('Dashboard runtime host', () => {
  it('renders Section A/B/C and opens /profile/learning from Section B', async () => {
    const user = userEvent.setup();
    renderDashboardRoute();

    await screen.findByTestId('dashboard-home-plan-view');
    expect(await screen.findByTestId('dashboard-progress-section')).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-recommendation-section')).toBeInTheDocument();
    expect(screen.getByText('复盘')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /今日已答题数/i }));

    expect(await screen.findByTestId('profile-learning-route')).toBeInTheDocument();
  });

  it('accepts a recommendation into a session and navigates to the session route', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/v2/recommendations/5/accept', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.action).toBe('session');
        return HttpResponse.json({
          recommendationId: 5,
          sessionId: 321,
          redirectUrl: '/practice/sessions/321',
          status: 'accepted_session',
        });
      }),
    );

    renderDashboardRoute();

    await screen.findByTestId('recommendation-card-5');
    await user.click(screen.getByRole('button', { name: '去做' }));

    expect(await screen.findByTestId('session-route')).toBeInTheDocument();
  });

  it('accepts a recommendation into plan and keeps reject drafts across reopen', async () => {
    const user = userEvent.setup();
    let acceptedTargetDate: string | null = null;
    let rejectedBody: Record<string, unknown> | null = null;
    const targetDate = buildTargetDateOptions()[1]?.value ?? buildTargetDateOptions()[0]!.value;

    server.use(
      http.post('/api/v2/recommendations/5/accept', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        if (body.action === 'plan') {
          acceptedTargetDate = String(body.targetDate);
          return HttpResponse.json({
            recommendationId: 5,
            eventId: 902,
            status: 'accepted_plan',
          });
        }
        return HttpResponse.json({
          recommendationId: 5,
          sessionId: 321,
          redirectUrl: '/practice/sessions/321',
          status: 'accepted_session',
        });
      }),
      http.post('/api/v2/recommendations/5/reject', async ({ request }) => {
        rejectedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true, status: 'rejected' });
      }),
    );

    renderDashboardRoute();

    await screen.findByTestId('recommendation-card-5');
    await user.click(screen.getByRole('button', { name: '加入计划' }));
    await user.selectOptions(
      screen.getByLabelText('recommendation target date'),
      targetDate,
    );
    await user.click(screen.getByRole('button', { name: '确认加入' }));

    await waitFor(() => expect(acceptedTargetDate).toBe(targetDate));
    expect(await screen.findByText(`已加入 ${targetDate} 的计划。`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '不合适，给反馈' }));
    await user.click(screen.getByLabelText('建议焦点不对'));
    await user.type(screen.getByLabelText('备注（可选）'), '今天先不做这类题');
    await user.click(screen.getByRole('button', { name: '取消' }));

    await user.click(screen.getByRole('button', { name: '不合适，给反馈' }));
    expect(screen.getByLabelText('建议焦点不对')).toBeChecked();
    expect(screen.getByLabelText('备注（可选）')).toHaveValue('今天先不做这类题');
    await user.click(screen.getByRole('button', { name: '提交反馈' }));

    await waitFor(() =>
      expect(rejectedBody).toMatchObject({
        reason: 'wrong-focus',
        note: '今天先不做这类题',
      }),
    );
  });

  it('shows a fail-fast error when recommendation refresh fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/v2/recommendations/refresh', () =>
        HttpResponse.json({ detail: 'refresh failed' }, { status: 500 }),
      ),
    );

    renderDashboardRoute();

    await screen.findByTestId('dashboard-recommendation-section');
    await user.click(await screen.findByRole('button', { name: '换一批' }));

    expect(
      await screen.findByText(/刷新今日推荐失败/i),
    ).toBeInTheDocument();
  });
});
