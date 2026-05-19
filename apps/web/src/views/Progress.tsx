import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAccuracyTrend,
  useWeeklyProgress,
  type AccuracyTrendPoint,
  type WeeklyProgressSummary,
} from '@sikao/api-client/queries/progressQueries';
import { useNationalExamCountdown } from '@sikao/api-client/queries/examEventsQueries';
import { isAuthError } from '@sikao/shared-utils';
import { trackEvent } from '@/lib/analytics';
import { PLAN_COPY } from '@/lib/ui-copy';
import { PageHeader } from '@sikao/ui/ui/PageHeader';
import {
  AuthFallbackEmptyState,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
} from '@sikao/ui/ui';
import {
  AlertCircleIcon,
  BarChartIcon,
  NoteIcon,
  RefreshIcon,
} from '@sikao/ui/icons';

const TREND_DAYS = [7, 30, 90, 180] as const;
type TrendDays = (typeof TREND_DAYS)[number];

interface NextAction {
  readonly label: string;
  readonly description: string;
  readonly to: string;
}

interface StatTileProps {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}

interface TrendSummary {
  readonly latestAccuracy: number;
  readonly peakAccuracy: number;
}

function buildNextAction(weekly: WeeklyProgressSummary): NextAction {
  const remaining = Math.max(weekly.tasksTotal - weekly.tasksCompleted, 0);
  if (remaining > 0) {
    return {
      label: PLAN_COPY.progressNextActionPlanCta,
      description: `${PLAN_COPY.progressRemainingTasks(remaining)} ${PLAN_COPY.progressNextActionToPlan}`,
      to: '/plan',
    };
  }
  if (weekly.xingceAnswered > 0 || weekly.essaySubmitted > 0) {
    return {
      label: PLAN_COPY.progressNextActionNotesCta,
      description: PLAN_COPY.progressNextActionToNotes,
      to: '/notes/new',
    };
  }
  return {
    label: PLAN_COPY.progressNextActionDashboardCta,
    description: PLAN_COPY.progressNextActionToDashboard,
    to: '/dashboard#today-plan',
  };
}

function hasWeeklyProgress(weekly: WeeklyProgressSummary): boolean {
  return (
    weekly.xingceAnswered > 0 ||
    weekly.essaySubmitted > 0 ||
    weekly.tasksCompleted > 0 ||
    weekly.tasksTotal > 0 ||
    weekly.streakDays > 0
  );
}

function accuracyTone(accuracy: number): string {
  if (accuracy >= 70) return 'bg-ok';
  if (accuracy >= 50) return 'bg-accent';
  return 'bg-warn';
}

function formatAccuracy(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildTrendSummary(
  points: readonly AccuracyTrendPoint[],
): TrendSummary | null {
  if (points.length === 0) {
    return null;
  }

  return {
    latestAccuracy: points[points.length - 1].accuracy,
    peakAccuracy: points.reduce(
      (max, point) => Math.max(max, point.accuracy),
      points[0].accuracy,
    ),
  };
}

function StatTile({ label, value, detail }: StatTileProps): ReactElement {
  return (
    <div className="rounded-card border border-line bg-paper p-4" data-testid={`progress-stat-${label}`}>
      <p className="text-meta font-mono uppercase tracking-wide text-ink-4">
        {label}
      </p>
      <p className="mt-2 font-serif text-h2 font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {detail != null ? (
        <p className="mt-2 text-small text-ink-3">{detail}</p>
      ) : null}
    </div>
  );
}

function TrendChart({
  points,
  isLoading,
  summary,
}: {
  readonly points: readonly AccuracyTrendPoint[];
  readonly isLoading: boolean;
  readonly summary: TrendSummary | null;
}): ReactElement {
  if (isLoading) {
    return (
      <div data-testid="progress-trend-loading" className="space-y-4">
        <Skeleton heightClass="h-6" />
        <Skeleton heightClass="h-24" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div
        data-testid="progress-trend-empty"
        className="rounded-card border border-dashed border-line bg-paper p-6 text-small text-ink-3"
      >
        {PLAN_COPY.progressTrendEmpty}
      </div>
    );
  }

  return (
    <div data-testid="progress-trend-chart" className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-small text-ink-3">
        <span data-testid="progress-trend-latest">
          {PLAN_COPY.progressLatest}{' '}
          <span className="font-serif font-semibold text-ink">
            {summary == null ? PLAN_COPY.progressTrendEmpty : formatAccuracy(summary.latestAccuracy)}
          </span>
        </span>
        <span data-testid="progress-trend-peak">
          {PLAN_COPY.progressPeak}{' '}
          <span className="font-serif font-semibold text-ok">
            {summary == null ? PLAN_COPY.progressTrendEmpty : formatAccuracy(summary.peakAccuracy)}
          </span>
        </span>
      </div>
      <div
        className="flex h-24 items-end gap-1"
        aria-label={PLAN_COPY.progressBarAria}
        data-testid="progress-trend-bars"
      >
        {points.map((point) => (
          <div
            key={`${point.date}-${point.answered}`}
            className="flex-1"
            title={`${point.date}: ${formatAccuracy(point.accuracy)}`}
          >
            <div
              className={`w-full rounded-1 ${accuracyTone(point.accuracy)}`}
              style={{ height: `${Math.max(point.accuracy, 4)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Progress(): ReactElement {
  const navigate = useNavigate();
  const [trendDays, setTrendDays] = useState<TrendDays>(30);

  const weeklyQuery = useWeeklyProgress();
  const trendQuery = useAccuracyTrend(trendDays);
  const historyGuardQuery = useAccuracyTrend(180);
  const countdown = useNationalExamCountdown();

  useEffect(() => {
    trackEvent({
      eventName: 'progress_viewed',
      properties: { trendDays: String(trendDays) },
    });
  }, [trendDays]);

  const hasAuthError =
    isAuthError(weeklyQuery.error) ||
    isAuthError(trendQuery.error) ||
    isAuthError(historyGuardQuery.error);
  if (hasAuthError) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto"
        data-testid="progress-view-auth-fallback"
      >
        <AuthFallbackEmptyState description={PLAN_COPY.progressRequireLogin} />
      </div>
    );
  }

  const isInitialLoading =
    weeklyQuery.isLoading || (trendQuery.isLoading && weeklyQuery.data == null);
  if (isInitialLoading) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto space-y-4"
        data-testid="progress-view-loading"
      >
        <Skeleton heightClass="h-20" testId="progress-header-skeleton" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton heightClass="h-72" />
          <Skeleton heightClass="h-72" />
        </div>
        <Skeleton heightClass="h-56" />
      </div>
    );
  }

  if (weeklyQuery.data == null) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto"
        data-testid="progress-view-error"
      >
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={PLAN_COPY.progressLoadFailedTitle}
          description={PLAN_COPY.progressLoadFailedDesc}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void weeklyQuery.refetch();
                void trendQuery.refetch();
              }}
              data-testid="progress-view-retry"
            >
              <RefreshIcon className="w-4 h-4 mr-2" />
              {PLAN_COPY.progressRetry}
            </Button>
          }
        />
      </div>
    );
  }

  const weekly = weeklyQuery.data;
  const weeklyHasProgress = hasWeeklyProgress(weekly);
  const trendPoints = trendQuery.data?.points ?? [];
  const historyGuardPoints =
    trendDays === 180 ? trendPoints : historyGuardQuery.data?.points ?? [];
  const needsHistoryGuard =
    !weeklyHasProgress &&
    trendQuery.data != null &&
    trendPoints.length === 0 &&
    trendDays !== 180;
  const isAwaitingEmptyStateDecision =
    !weeklyHasProgress &&
    (trendQuery.data == null || (needsHistoryGuard && historyGuardQuery.data == null));
  if (isAwaitingEmptyStateDecision) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto space-y-4"
        data-testid="progress-view-loading"
      >
        <Skeleton heightClass="h-20" testId="progress-header-skeleton" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton heightClass="h-72" />
          <Skeleton heightClass="h-72" />
        </div>
        <Skeleton heightClass="h-56" />
      </div>
    );
  }

  if (
    weeklyQuery.isError ||
    trendQuery.isError ||
    (needsHistoryGuard && historyGuardQuery.isError)
  ) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto"
        data-testid="progress-view-error"
      >
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-8 h-8" />}
          title={PLAN_COPY.progressLoadFailedTitle}
          description={PLAN_COPY.progressLoadFailedDesc}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void weeklyQuery.refetch();
                void trendQuery.refetch();
                void historyGuardQuery.refetch();
              }}
              data-testid="progress-view-retry"
            >
              <RefreshIcon className="w-4 h-4 mr-2" />
              {PLAN_COPY.progressRetry}
            </Button>
          }
        />
      </div>
    );
  }

  const nextAction = buildNextAction(weekly);
  const completionPercent = weekly.tasksTotal === 0
    ? 0
    : Math.round((weekly.tasksCompleted / weekly.tasksTotal) * 100);
  const trendSummary = buildTrendSummary(trendPoints);

  if (!weeklyHasProgress && trendPoints.length === 0 && historyGuardPoints.length === 0) {
    return (
      <div
        className="p-4 md:p-8 max-w-5xl mx-auto"
        data-testid="progress-view-empty"
      >
        <EmptyState
          icon={<BarChartIcon className="w-8 h-8" />}
          title={PLAN_COPY.progressEmptyTitle}
          description={PLAN_COPY.progressEmptyDesc}
          action={
            <Button
              variant="secondary"
              onClick={() => navigate('/dashboard#today-plan')}
              data-testid="progress-view-empty-cta"
            >
              {PLAN_COPY.progressEmptyCta}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-8 max-w-5xl mx-auto space-y-5"
      data-testid="progress-view"
    >
      <PageHeader
        eyebrow={PLAN_COPY.progressEyebrow}
        title={PLAN_COPY.progressTitle}
        subtitle={PLAN_COPY.progressSubtitle(weekly.weekStart, weekly.weekEnd)}
        actions={
          <Button
            variant="primary"
            onClick={() => navigate(nextAction.to)}
            data-testid="progress-next-action"
          >
            {nextAction.label}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          as="section"
          padding="md"
          variant="muted"
          data-testid="progress-overview-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-tiny uppercase tracking-wide text-ink-4">
                {PLAN_COPY.progressWindowLabel}
              </p>
              <h2 className="mt-2 font-serif text-h3 font-semibold text-ink">
                {PLAN_COPY.progressOverviewTitle}
              </h2>
            </div>
            <p className="text-small text-ink-3">
              {weekly.weekStart} — {weekly.weekEnd}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2" data-testid="progress-stats-grid">
            <StatTile
              label={PLAN_COPY.progressStatsXingce}
              value={weekly.xingceAnswered}
              detail={PLAN_COPY.progressAccuracySuffix(weekly.xingceAccuracy)}
            />
            <StatTile
              label={PLAN_COPY.progressStatsEssay}
              value={weekly.essaySubmitted}
            />
            <StatTile
              label={PLAN_COPY.progressStatsStreak}
              value={PLAN_COPY.progressStreakValue(weekly.streakDays)}
            />
            <StatTile
              label={PLAN_COPY.progressStatsTasks}
              value={PLAN_COPY.progressTasksValue(
                weekly.tasksCompleted,
                weekly.tasksTotal,
              )}
              detail={`${completionPercent}%`}
            />
          </div>

          <div className="mt-5 space-y-2" data-testid="progress-task-progress">
            <div className="flex items-center justify-between text-small text-ink-3">
              <span>{PLAN_COPY.progressStatsTasks}</span>
              <span className="font-serif font-semibold text-ink">
                {completionPercent}%
              </span>
            </div>
            <ProgressBar
              value={weekly.tasksCompleted}
              max={Math.max(weekly.tasksTotal, 1)}
              ariaLabel={PLAN_COPY.progressStatsTasks}
            />
          </div>
        </Card>

        <Card
          as="aside"
          padding="md"
          data-testid="progress-context-card"
          className="space-y-4"
        >
          <div>
            <p className="font-mono text-tiny uppercase tracking-wide text-ink-4">
              {countdown.daysUntil >= 0
                ? PLAN_COPY.progressCountdownLabel
                : PLAN_COPY.examEnded}
            </p>
            <p className="mt-2 font-serif text-h3 font-semibold text-ink">
              {countdown.daysUntil >= 0
                ? `${countdown.examLabel} · ${countdown.daysUntil} ${PLAN_COPY.progressDayUnit}`
                : PLAN_COPY.examEndedNext}
            </p>
          </div>

          <div className="rounded-card border border-line bg-paper p-4">
            <p className="font-mono text-tiny uppercase tracking-wide text-ink-4">
              {PLAN_COPY.progressNextActionTitle}
            </p>
            <p
              className="mt-2 text-small leading-relaxed text-ink-2"
              data-testid="progress-next-action-copy"
            >
              {nextAction.description}
            </p>
          </div>

          <div className="rounded-card border border-line bg-paper p-4 text-small text-ink-3">
            <p className="font-mono text-tiny uppercase tracking-wide text-ink-4">
              {PLAN_COPY.progressTrendTitle}
            </p>
            <p
              className="mt-2 leading-relaxed"
              data-testid="progress-context-trend-copy"
            >
              {trendSummary == null
                ? PLAN_COPY.progressTrendEmpty
                : `${PLAN_COPY.progressLatest} ${formatAccuracy(trendSummary.latestAccuracy)} · ${PLAN_COPY.progressPeak} ${formatAccuracy(trendSummary.peakAccuracy)}`}
            </p>
          </div>
        </Card>
      </div>

      <Card
        as="section"
        padding="md"
        variant="muted"
        data-testid="progress-trend-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-h3 font-semibold text-ink">
            {PLAN_COPY.progressTrendTitle}
          </h2>
          <div className="flex flex-wrap gap-2">
            {TREND_DAYS.map((days) => (
              <Button
                key={days}
                variant="ghost"
                size="sm"
                active={trendDays === days}
                onClick={() => setTrendDays(days)}
                data-testid={`progress-range-${days}`}
              >
                {PLAN_COPY.progressTrendRangeLabel(days)}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <TrendChart
            points={trendPoints}
            isLoading={trendQuery.isLoading && trendQuery.data == null}
            summary={trendSummary}
          />
        </div>
      </Card>

      <Card
        as="section"
        padding="md"
        variant="muted"
        data-testid="progress-loop-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-tiny uppercase tracking-wide text-ink-4">
              {PLAN_COPY.progressNextActionTitle}
            </p>
            <p className="mt-2 text-small leading-relaxed text-ink-2">
              {nextAction.description}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate('/notes')}
            leftIcon={<NoteIcon className="w-4 h-4" />}
            data-testid="progress-notes-link"
          >
            {PLAN_COPY.progressNextActionNotesCta}
          </Button>
        </div>
      </Card>
    </div>
  );
}
