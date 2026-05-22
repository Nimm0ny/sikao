import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';
import { usePlanStore } from '@sikao/domain/plan/usePlanStore';

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

beforeEach(() => {
  usePlanStore.setState({
    currentPlanId: null,
    currentView: 'week',
    currentDate: '2026-05-22',
    selectedRange: null,
    optimisticEvents: new Map(),
  });
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
        weaknessTop3: [
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
            bucketStart: '2026-05-17',
            bucketEnd: '2026-05-17',
            minutesPracticed: 45,
            itemsAnswered: 14,
            accuracy: '0.72',
            sessionsCount: 1,
          },
          {
            bucketStart: '2026-05-18',
            bucketEnd: '2026-05-18',
            minutesPracticed: 60,
            itemsAnswered: 18,
            accuracy: '0.75',
            sessionsCount: 1,
          },
          {
            bucketStart: '2026-05-19',
            bucketEnd: '2026-05-19',
            minutesPracticed: 35,
            itemsAnswered: 11,
            accuracy: '0.71',
            sessionsCount: 1,
          },
          {
            bucketStart: '2026-05-20',
            bucketEnd: '2026-05-20',
            minutesPracticed: 50,
            itemsAnswered: 16,
            accuracy: '0.79',
            sessionsCount: 1,
          },
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
          {
            subjectKey: 'panduan',
            subjectLabel: '判断',
            answered: 22,
            correct: 17,
            accuracy: '0.77',
            severity: 'low',
            trend: 'stable',
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
    http.get('/api/v2/dashboard/full-plan', ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json({
        anchorDate: url.searchParams.get('anchorDate') ?? '2026-05-22',
        from: '2026-05-19',
        to: '2026-05-25',
        view: url.searchParams.get('view') ?? 'week',
        planId: 11,
        targets: [
          {
            examId: 'GK-2026',
            examName: '国考',
            examDate: '2026-08-10',
            daysUntil: 80,
          },
        ],
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
        practiceBlocks: [
          {
            id: 'practice-1',
            category: 'practice',
            subject: 'xingce',
            sessionId: 88,
            startAt: '2026-05-22T03:00:00.000Z',
            endAt: '2026-05-22T03:45:00.000Z',
            itemsCount: 18,
            isInProgress: false,
            accuracy: '0.71',
          },
        ],
      });
    }),
  );
});

describe('Dashboard Section A host', () => {
  it('renders an empty state when there is no active plan', async () => {
    server.use(
      http.get('/api/v2/plans', () =>
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
          planId: null,
          targets: [],
          summary: {
            totalEvents: 0,
            plannedCount: 0,
            inProgressCount: 0,
            doneCount: 0,
            skippedCount: 0,
            eventMinutesTotal: 0,
            practiceMinutesTotal: 0,
            completionRate: '0.00',
          },
          events: [],
          practiceBlocks: [],
        }),
      ),
    );

    renderWithProviders(<Dashboard />);

    expect(await screen.findByText('还没有 active plan')).toBeInTheDocument();
  });

  it('creates events from the dashboard host', async () => {
    const user = userEvent.setup();
    let requestBody: Record<string, unknown> | null = null;
    server.use(
      http.post('/api/v2/plans/events', async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: '11:2026-05-23',
          planId: 11,
          title: 'Focused review',
          category: 'review',
          notes: '',
          startAt: '2026-05-23T01:00:00.000Z',
          endAt: '2026-05-23T02:00:00.000Z',
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
        });
      }),
    );

    renderWithProviders(<Dashboard />);

    await screen.findByText('Sprint plan');
    await user.click(screen.getAllByRole('button', { name: '新建' })[0]);
    await user.type(screen.getByLabelText('标题'), 'Focused review');
    await user.click(screen.getByRole('button', { name: '创建事件' }));

    await waitFor(() => expect(requestBody).not.toBeNull());
    expect(requestBody?.title).toBe('Focused review');
  });

  it('surfaces invalid date/time edits as UI errors instead of throwing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await screen.findByText('Sprint plan');
    await user.click(screen.getByRole('button', { name: /Morning drill/ }));
    await user.clear(screen.getByLabelText('开始日期'));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(
      await screen.findByText('Event start date/time is required'),
    ).toBeInTheDocument();
  });

  it('resizes events through the quick +15 action', async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch('/api/v2/plans/events/:eventId', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: '11:2026-05-22',
          planId: 11,
          title: 'Morning drill',
          category: 'xingce',
          notes: '',
          startAt: '2026-05-22T01:00:00.000Z',
          endAt: String(patchBody?.endAt),
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
        });
      }),
    );

    renderWithProviders(<Dashboard />);

    await screen.findByText('Sprint plan');
    await user.click(screen.getAllByRole('button', { name: '+15' })[0]);

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(String(patchBody?.endAt)).toContain('2026-05-22T02:15:00.000Z');
  });

  it('renders practice blocks with a duration-based height', async () => {
    renderWithProviders(<Dashboard />);

    await screen.findByText('Sprint plan');
    const practiceBlock = screen.getByTestId('practice-block-practice-1-2026-05-22');

    expect(practiceBlock.getAttribute('style')).toContain('height: 36px');
  });

  it('forces recurring quick actions through explicit scope selection', async () => {
    const user = userEvent.setup();
    let scopeValue: string | null = null;
    server.use(
      http.get('/api/v2/dashboard/full-plan', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          anchorDate: url.searchParams.get('anchorDate') ?? '2026-05-22',
          from: '2026-05-19',
          to: '2026-05-25',
          view: url.searchParams.get('view') ?? 'week',
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
              title: 'Recurring drill',
              category: 'xingce',
              notes: '',
              startAt: '2026-05-22T01:00:00.000Z',
              endAt: '2026-05-22T02:00:00.000Z',
              timezone: 'Asia/Shanghai',
              status: 'planned',
              source: 'user_manual',
              parentId: null,
              recurringRule: 'FREQ=WEEKLY;COUNT=4',
              recurringParentId: null,
              recurringExceptionDates: [],
              linkedSessionId: null,
              targetId: null,
              deletedAt: null,
              isRecurringInstance: false,
            },
          ],
          practiceBlocks: [],
        });
      }),
      http.patch('/api/v2/plans/events/:eventId', async ({ request }) => {
        scopeValue = new URL(request.url).searchParams.get('scope');
        return HttpResponse.json({
          id: '11:2026-05-22',
          planId: 11,
          title: 'Recurring drill',
          category: 'xingce',
          notes: '',
          startAt: '2026-05-22T01:00:00.000Z',
          endAt: '2026-05-22T02:15:00.000Z',
          timezone: 'Asia/Shanghai',
          status: 'planned',
          source: 'user_manual',
          parentId: null,
          recurringRule: 'FREQ=WEEKLY;COUNT=4',
          recurringParentId: null,
          recurringExceptionDates: [],
          linkedSessionId: null,
          targetId: null,
          deletedAt: null,
          isRecurringInstance: false,
        });
      }),
    );

    renderWithProviders(<Dashboard />);

    await screen.findByText('Sprint plan');
    await user.click(screen.getAllByRole('button', { name: '+15' })[0]);
    expect(scopeValue).toBeNull();
    await user.click(screen.getByRole('button', { name: '整个系列' }));
    await waitFor(() => expect(scopeValue).toBe('all'));
  });

  it('preserves wall-clock time for non-Asia/Shanghai events when saving unchanged edits', async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/v2/dashboard/full-plan', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          anchorDate: url.searchParams.get('anchorDate') ?? '2026-05-22',
          from: '2026-05-19',
          to: '2026-05-25',
          view: url.searchParams.get('view') ?? 'week',
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
              id: '11:nyc',
              planId: 11,
              title: 'NYC block',
              category: 'review',
              notes: '',
              startAt: '2026-05-22T13:00:00.000Z',
              endAt: '2026-05-22T14:00:00.000Z',
              timezone: 'America/New_York',
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
        });
      }),
      http.patch('/api/v2/plans/events/:eventId', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: '11:nyc',
          planId: 11,
          title: 'NYC block',
          category: 'review',
          notes: '',
          startAt: String(patchBody?.startAt),
          endAt: String(patchBody?.endAt),
          timezone: 'America/New_York',
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
        });
      }),
    );

    renderWithProviders(<Dashboard />);

    await screen.findByText('Sprint plan');
    await user.click(screen.getByRole('button', { name: /NYC block/ }));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(String(patchBody?.startAt)).toBe('2026-05-22T13:00:00.000Z');
    expect(String(patchBody?.endAt)).toBe('2026-05-22T14:00:00.000Z');
  });

  it('resyncs a stale currentPlanId to the latest active plan before creating events', async () => {
    const user = userEvent.setup();
    usePlanStore.setState({
      currentPlanId: 11,
      currentView: 'week',
      currentDate: '2026-05-22',
      selectedRange: null,
      optimisticEvents: new Map(),
    });
    let planIdValue: number | null = null;
    server.use(
      http.get('/api/v2/plans', () =>
        HttpResponse.json({
          items: [
            {
              ...activePlan,
              id: 22,
              name: 'Replacement plan',
              targetExamId: 'GK-2027',
              targetExamDate: '2027-01-10',
            },
          ],
          total: 1,
        }),
      ),
      http.get('/api/v2/dashboard/full-plan', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          anchorDate: url.searchParams.get('anchorDate') ?? '2026-05-22',
          from: '2026-05-19',
          to: '2026-05-25',
          view: url.searchParams.get('view') ?? 'week',
          planId: 22,
          targets: [],
          summary: {
            totalEvents: 0,
            plannedCount: 0,
            inProgressCount: 0,
            doneCount: 0,
            skippedCount: 0,
            eventMinutesTotal: 0,
            practiceMinutesTotal: 0,
            completionRate: '0.00',
          },
          events: [],
          practiceBlocks: [],
        });
      }),
      http.post('/api/v2/plans/events', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        planIdValue = Number(body.planId);
        return HttpResponse.json({
          id: '22:2026-05-23',
          planId: 22,
          title: 'Fresh event',
          category: 'review',
          notes: '',
          startAt: '2026-05-23T01:00:00.000Z',
          endAt: '2026-05-23T02:00:00.000Z',
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
        });
      }),
    );

    renderWithProviders(<Dashboard />);

    await screen.findByText('Replacement plan');
    await user.click(screen.getAllByRole('button', { name: '新建' })[0]);
    await user.type(screen.getByLabelText('标题'), 'Fresh event');
    await user.click(screen.getByRole('button', { name: '创建事件' }));

    await waitFor(() => expect(planIdValue).toBe(22));
  });

  it('streams AI generate progress from the dashboard host', async () => {
    const user = userEvent.setup();
    const responseBody = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            'data: {"type":"event","event":{"id":"11:2026-05-23","planId":11,"title":"Draft day","category":"review","notes":"","startAt":"2026-05-23T01:00:00.000Z","endAt":"2026-05-23T02:00:00.000Z","timezone":"Asia/Shanghai","status":"planned","source":"user_manual","parentId":null,"recurringRule":null,"recurringParentId":null,"recurringExceptionDates":[],"linkedSessionId":null,"targetId":null,"deletedAt":null,"isRecurringInstance":false}}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"done","plan":{"id":11,"name":"Sprint plan","targetExamId":"GK-2026","targetExamDate":"2026-08-10","dailyMinutesTarget":120,"style":"balanced","baseline":{},"focusSubjects":["xingce"],"status":"active","source":"user_manual","changeLog":[],"deletedAt":null,"archivedAt":null,"createdAt":"2026-05-22T00:00:00Z","updatedAt":"2026-05-22T00:00:00Z"},"events":[],"eventCount":1,"llmCallId":10}\n\n',
          ),
        );
        controller.close();
      },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(responseBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    renderWithProviders(<Dashboard />);

    await screen.findByText('Sprint plan');
    await user.click(screen.getByRole('button', { name: 'AI 制定计划' }));
    await user.click(screen.getByRole('button', { name: '开始生成' }));

    expect(await screen.findByText('event: Draft day')).toBeInTheDocument();
    expect(await screen.findByText('done')).toBeInTheDocument();

    fetchSpy.mockRestore();
  });
});
