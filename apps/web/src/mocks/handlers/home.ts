/*
 * Home phase MSW handlers — SIK-90 Home M-A wave 1 (2026-05-24).
 *
 * Covers the read-only endpoints Home Section A needs in DEV / vitest:
 *   - GET /api/v2/dashboard/overview
 *   - GET /api/v2/dashboard/today
 *   - GET /api/v2/dashboard/weekly-plan
 *   - GET /api/v2/plans/events  (window query: from / to / tz)
 *
 * Per docs/plan/frontend-tab-runtime-2026-05-24.md §7.3, each Tab phase
 * owns its own handlers file under src/mocks/handlers/<tab>.ts. SIK-89
 * landed the empty registry; this file appends the Home phase entries.
 *
 * Mocks are minimal stubs — enough for the view's 4-state coverage and
 * for vitest determinism. Real fixture data lives in tests/fixtures/* and
 * is brought in case-by-case via `server.use(...)` overrides.
 */
import { http, HttpResponse } from 'msw';
import type {
  DashboardReviewResponseV2,
  DashboardTodayCompletionResponseV2,
  DashboardTodayResponseV2,
  DashboardWeeklyPlanResponseV2,
  EventWindowResponseV2,
  OverviewResponseV2,
  PlanEventReadV2,
} from '@sikao/api-client/types/home';

const TZ = 'Asia/Shanghai';

function todayLocalStamp(): string {
  // YYYY-MM-DD in local clock — keeps the mock in step with the user's
  // session no matter when DEV starts the worker.
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

const EVENT_DEFAULTS = {
  category: 'practice',
  status: 'planned',
  source: 'manual',
  timezone: TZ,
  notes: '',
  planId: 1,
  isRecurringInstance: false,
  deletedAt: null,
  linkedSessionId: null,
  parentId: null,
  recurringExceptionDates: [] as string[],
  recurringParentId: null,
  recurringRule: null,
  targetId: null,
} as const satisfies Omit<PlanEventReadV2, 'id' | 'startAt' | 'endAt' | 'title'>;

type EventOverrides = Partial<PlanEventReadV2> &
  Pick<PlanEventReadV2, 'id' | 'startAt' | 'endAt' | 'title'>;

function makeEvent(overrides: EventOverrides): PlanEventReadV2 {
  // Explicit base + overrides spread — this is fixture default construction
  // (not silent fallback over arbitrary input), and the base is a typed
  // const so any schema drift surfaces at compile time.
  return { ...EVENT_DEFAULTS, ...overrides };
}

function emptySummary(totalEvents: number) {
  return {
    completionRate: null,
    doneCount: 0,
    eventMinutesTotal: 0,
    inProgressCount: 0,
    plannedCount: totalEvents,
    practiceMinutesTotal: 0,
    skippedCount: 0,
    totalEvents,
  } as const;
}

function defaultEvents(): PlanEventReadV2[] {
  const day = todayLocalStamp();
  return [
    makeEvent({
      id: 'evt-yanyu-am',
      title: '言语理解 · 逻辑填空 30 题',
      startAt: `${day}T08:00:00+08:00`,
      endAt: `${day}T10:00:00+08:00`,
      category: 'yanyu',
      status: 'done',
    }),
    makeEvent({
      id: 'evt-ziliao-mid',
      title: '资料分析 · 增长率专项',
      startAt: `${day}T10:30:00+08:00`,
      endAt: `${day}T11:30:00+08:00`,
      category: 'ziliao',
      status: 'done',
    }),
    makeEvent({
      id: 'evt-mock-pm',
      title: '行测套卷模考',
      startAt: `${day}T14:00:00+08:00`,
      endAt: `${day}T16:00:00+08:00`,
      category: 'mock',
      status: 'planned',
    }),
  ];
}

export const homeHandlers = [
  http.get('/api/v2/plans/events', () => {
    const events = defaultEvents();
    const response: EventWindowResponseV2 = {
      data: { events, practiceBlocks: [] },
      meta: {
        from: events[0]?.startAt ?? '',
        to: events[events.length - 1]?.endAt ?? '',
        tz: TZ,
        includePracticeBlocks: false,
      },
    };
    return HttpResponse.json(response);
  }),

  http.get('/api/v2/dashboard/today', () => {
    const events = defaultEvents();
    const response: DashboardTodayResponseV2 = {
      date: todayLocalStamp(),
      planId: 1,
      events,
      practiceBlocks: [],
      nearestExamTarget: null,
      summary: emptySummary(events.length),
    };
    return HttpResponse.json(response);
  }),

  http.get('/api/v2/dashboard/weekly-plan', () => {
    const day = todayLocalStamp();
    const response: DashboardWeeklyPlanResponseV2 = {
      planId: 1,
      events: defaultEvents(),
      practiceBlocks: [],
      nearestExamTarget: null,
      weekStart: day,
      weekEnd: day,
      summary: emptySummary(defaultEvents().length),
    };
    return HttpResponse.json(response);
  }),

  http.get('/api/v2/dashboard/overview', () => {
    // Minimal shape — views accept undefined fields gracefully; richer
    // payload lands when M-B (progress) and M-D (overview metrics) need it.
    const response = {
      streakDays: 5,
      totalQuestions: 1248,
      weeklyAccuracy: 0.764,
    } as unknown as OverviewResponseV2;
    return HttpResponse.json(response);
  }),

  // SIK-125 Metric Row endpoints. Each card consumes one of these.
  http.get('/api/v2/dashboard/today/review', () => {
    const response: DashboardReviewResponseV2 = {
      total: 47,
      items: [],
    };
    return HttpResponse.json(response);
  }),

  http.get('/api/v2/dashboard/weekly-plan/today-completion', () => {
    const response: DashboardTodayCompletionResponseV2 = {
      date: todayLocalStamp(),
      doneEvents: 8,
      totalEvents: 15,
      completionRate: '0.53',
    };
    return HttpResponse.json(response);
  }),
];
