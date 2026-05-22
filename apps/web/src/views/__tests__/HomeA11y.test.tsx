import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { axe } from 'vitest-axe';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '@sikao/test-utils/renderWithProviders';
import { server } from '@sikao/test-utils/server';

import { MvpShell } from '@/components/mvp';
import { PlanAiDialog } from '@/components/dashboard-sikao/plan/PlanAiDialog';
import Dashboard from '../Dashboard';
import ProfileRecords from '../ProfileRecords';

function registerDashboardHandlers() {
  server.use(
    http.get('/api/v2/plans', () =>
      HttpResponse.json({
        items: [
          {
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
          },
        ],
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
}

describe('Home a11y coverage', () => {
  beforeEach(() => {
    vi.useRealTimers();
    server.resetHandlers();
  });

  it('keeps the 5-tab MvpShell accessible', async () => {
    const { container } = renderWithProviders(
      <MvpShell>
        <div data-testid="shell-page">shell page</div>
      </MvpShell>,
      { initialEntries: ['/notes'] },
    );

    expect(await screen.findByTestId('mvp-shell')).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps the dashboard host accessible in the ready state', async () => {
    registerDashboardHandlers();
    const { container } = renderWithProviders(<Dashboard />, {
      initialEntries: ['/'],
    });

    expect(await screen.findByTestId('dashboard-home-plan-view')).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-home-view')).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-progress-section')).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-recommendation-section')).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps profile records empty state accessible', async () => {
    server.use(
      http.get('/api/v2/profile/records', () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        }),
      ),
    );

    const { container } = renderWithProviders(<ProfileRecords />, {
      initialEntries: ['/profile/records'],
    });

    expect(await screen.findByText('暂无学习记录')).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps the AI plan dialog accessible when opened', async () => {
    const { container } = renderWithProviders(
      <PlanAiDialog
        open={true}
        mode="generate"
        generateDefaults={{
          name: 'Sprint plan',
          targetExamId: 'GK-2026',
          targetExamDate: '2026-08-10',
          dailyMinutesTarget: 120,
          style: 'balanced',
          baseline: {},
          focusSubjects: ['xingce'],
          userNotes: '',
        }}
        regenerateRange={null}
        isRunning={false}
        progressFrames={[]}
        onClose={() => {}}
        onGenerate={async () => {}}
        onRegenerate={async () => {}}
      />,
      { initialEntries: ['/'] },
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });
});
