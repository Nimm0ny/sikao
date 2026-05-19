import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Lightbulb,
  Target,
} from 'lucide-react';
import { cn } from '@sikao/shared-utils';
import type {
  PracticeSessionSummary,
  StudyPlanResponse,
  UserExamRead,
  WeakModule,
} from '@sikao/domain/dashboard/useHomeData';
import type { StudyTaskResponse } from '@sikao/api-client/types/study-plan';
import {
  MvpButton,
  MvpCard,
  MvpChip,
  MvpIconButton,
  MvpProgressRing,
} from '@/components/mvp';
import { DASHBOARD_COPY } from '@/lib/ui-copy';
import { DashboardCardState, DashboardEmptyText } from './DashboardCardState';

function taskKindFallback(taskKind: string): string {
  if (taskKind in DASHBOARD_COPY.taskKindLabel) {
    return DASHBOARD_COPY.taskKindLabel[taskKind as keyof typeof DASHBOARD_COPY.taskKindLabel];
  }
  return taskKind;
}

function taskTitle(task: StudyTaskResponse): string {
  if (task.payload.title) return task.payload.title;
  return taskKindFallback(task.taskKind);
}

function taskSubtitle(task: StudyTaskResponse): string {
  if (task.payload.subtitle) return task.payload.subtitle;
  const fallback = taskKindFallback(task.taskKind);
  if (fallback.length > 0) return fallback;
  return DASHBOARD_COPY.taskFallbackSubtitle;
}

function formatExamDate(exam: UserExamRead): string {
  if (exam.daysUntil > 0) return `${exam.daysUntil} ${DASHBOARD_COPY.exam.afterSuffix}`;
  if (exam.daysUntil === 0) return DASHBOARD_COPY.exam.today;
  return `${DASHBOARD_COPY.exam.pastPrefix} ${Math.abs(exam.daysUntil)} ${DASHBOARD_COPY.exam.dayUnit}`;
}

export function ExamCountdownCard({
  exams,
  loading,
  error,
  onOpenCalendar,
}: {
  readonly exams: readonly UserExamRead[];
  readonly loading: boolean;
  readonly error: boolean;
  readonly onOpenCalendar: () => void;
}) {
  const nextExam = exams[0] ?? null;
  return (
    <MvpCard className="p-5" testId="dashboard-exam-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-ink">{DASHBOARD_COPY.exam.title}</h2>
        <MvpIconButton
          label={DASHBOARD_COPY.exam.calendarLabel}
          className="h-9 w-9"
          onClick={onOpenCalendar}
          data-testid="dashboard-exam-calendar"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </MvpIconButton>
      </div>
      <DashboardCardState loading={loading} error={error} testId="dashboard-exam-card">
        {nextExam ? (
          <div>
            <p className="text-h1 font-bold text-ink">{formatExamDate(nextExam)}</p>
            <p className="mt-1 text-body text-ink-3">{nextExam.name}</p>
            <p className="mt-3 text-tiny text-ink-3">{nextExam.examDate}</p>
          </div>
        ) : (
          <DashboardEmptyText testId="dashboard-exam-empty">{DASHBOARD_COPY.exam.empty}</DashboardEmptyText>
        )}
      </DashboardCardState>
    </MvpCard>
  );
}

export function WeakTrendCard({
  weakModules,
  loading,
  error,
}: {
  readonly weakModules: readonly WeakModule[];
  readonly loading: boolean;
  readonly error: boolean;
}) {
  return (
    <MvpCard className="p-5" testId="dashboard-weak-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-ink">{DASHBOARD_COPY.weak.title}</h2>
        <Target className="h-5 w-5 text-ink-3" aria-hidden="true" />
      </div>
      <DashboardCardState loading={loading} error={error} testId="dashboard-weak-card">
        {weakModules.length === 0 ? (
          <DashboardEmptyText testId="dashboard-weak-empty">{DASHBOARD_COPY.weak.empty}</DashboardEmptyText>
        ) : (
          <div className="space-y-3">
            {weakModules.slice(0, 3).map((item) => (
              <div key={item.subject} className="space-y-1.5">
                <div className="flex items-center justify-between text-body">
                  <span className="font-semibold text-ink">{item.subject}</span>
                  <span className="text-ink-3">{Math.round(item.score)}</span>
                </div>
                <div className="h-2 rounded-pill bg-paper-3">
                  <div
                    className="h-2 rounded-pill bg-accent"
                    style={{ width: `${Math.max(8, Math.min(100, item.score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCardState>
    </MvpCard>
  );
}

export function AiHintCard({
  weakModules,
  loading,
  error,
}: {
  readonly weakModules: readonly WeakModule[];
  readonly loading: boolean;
  readonly error: boolean;
}) {
  const top = weakModules[0];
  return (
    <MvpCard className="p-5" testId="dashboard-ai-hint">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-accent" aria-hidden="true" />
        <h2 className="text-h3 font-semibold text-ink">{DASHBOARD_COPY.ai.title}</h2>
      </div>
      <DashboardCardState loading={loading} error={error} testId="dashboard-ai-hint">
        <p className="text-body leading-6 text-ink-3">
          {top
            ? `${top.subject} ${DASHBOARD_COPY.ai.topModuleSuffix}`
            : DASHBOARD_COPY.ai.empty}
        </p>
      </DashboardCardState>
    </MvpCard>
  );
}

export function MainTaskCard({
  plan,
  tasks,
  completedCount,
  loading,
  error,
  isStarting,
  isPatching,
  onStart,
  onSkip,
  onRetry,
  onOpenPractice,
}: {
  readonly plan: StudyPlanResponse | null;
  readonly tasks: readonly StudyTaskResponse[];
  readonly completedCount: number;
  readonly loading: boolean;
  readonly error: boolean;
  readonly isStarting: boolean;
  readonly isPatching: boolean;
  readonly onStart: (task: StudyTaskResponse) => void;
  readonly onSkip: (task: StudyTaskResponse) => void;
  readonly onRetry: () => void;
  readonly onOpenPractice: () => void;
}) {
  const mainTask = tasks.find((task) => task.status === 'pending') ?? null;
  return (
    <MvpCard className="flex min-h-96 flex-col p-6 md:p-8" testId="dashboard-main-task">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <MvpChip tone="blue">{DASHBOARD_COPY.main.chip}</MvpChip>
        {plan ? <MvpChip>{completedCount} / {tasks.length} {DASHBOARD_COPY.main.completedSuffix}</MvpChip> : null}
      </div>
      <DashboardCardState loading={loading} error={error} testId="dashboard-main-task">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-6 grid place-items-center">
            <div className="grid h-24 w-24 place-items-center rounded-pill bg-accent-50 text-accent">
              <Target className="h-12 w-12" aria-hidden="true" />
            </div>
          </div>
          <h2 className="text-center text-h1 font-bold text-ink">{DASHBOARD_COPY.main.title}</h2>
          {mainTask ? (
            <>
              <p className="mt-3 text-center text-h3 font-semibold text-ink">{taskTitle(mainTask)}</p>
              <p className="mx-auto mt-2 max-w-md text-center text-body leading-6 text-ink-3">{taskSubtitle(mainTask)}</p>
              <div className="mt-8 grid gap-3">
                <MvpButton
                  className="w-full"
                  icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => onStart(mainTask)}
                  disabled={isStarting || isPatching}
                  data-testid="dashboard-main-start"
                  data-dashboard-role="primary-next-action"
                >
                  {isStarting ? DASHBOARD_COPY.main.starting : DASHBOARD_COPY.main.start}
                </MvpButton>
                <MvpButton
                  variant="secondary"
                  className="w-full"
                  onClick={() => onSkip(mainTask)}
                  disabled={isStarting || isPatching}
                  data-testid="dashboard-main-skip"
                >
                  {DASHBOARD_COPY.main.skip}
                </MvpButton>
              </div>
            </>
          ) : tasks.length === 0 ? (
            <>
              <p
                className="mt-3 text-center text-h3 font-semibold text-accent"
                data-testid="dashboard-main-task-empty"
              >
                {DASHBOARD_COPY.main.emptyTitle}
              </p>
              <p className="mx-auto mt-2 max-w-md text-center text-body leading-6 text-ink-3">
                {DASHBOARD_COPY.main.emptyDescription}
              </p>
              <MvpButton
                className="mx-auto mt-8"
                onClick={onOpenPractice}
                data-testid="dashboard-main-empty-practice"
                data-dashboard-role="primary-next-action"
              >
                {DASHBOARD_COPY.recent.openPractice}
              </MvpButton>
            </>
          ) : (
            <>
              <p className="mt-3 text-center text-h3 font-semibold text-ok">{DASHBOARD_COPY.main.completeTitle}</p>
              <p className="mx-auto mt-2 max-w-md text-center text-body leading-6 text-ink-3">
                {DASHBOARD_COPY.main.completeDescription}
              </p>
              <MvpButton className="mx-auto mt-8" onClick={onOpenPractice} data-dashboard-role="primary-next-action">
                {DASHBOARD_COPY.main.extraPractice}
              </MvpButton>
            </>
          )}
        </div>
      </DashboardCardState>
      {error ? (
        <MvpButton variant="secondary" className="mt-4" onClick={onRetry} data-testid="dashboard-main-task-retry">
          {DASHBOARD_COPY.main.retry}
        </MvpButton>
      ) : null}
    </MvpCard>
  );
}

export function TodayPlanMini({
  tasks,
  loading,
  error,
  onOpenPlan,
}: {
  readonly tasks: readonly StudyTaskResponse[];
  readonly loading: boolean;
  readonly error: boolean;
  readonly onOpenPlan: () => void;
}) {
  return (
    <MvpCard className="p-5" testId="dashboard-plan-mini">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-ink">{DASHBOARD_COPY.planMini.title}</h2>
        <MvpButton variant="ghost" className="min-h-8 px-2 py-1" onClick={onOpenPlan}>
          {DASHBOARD_COPY.planMini.open}
        </MvpButton>
      </div>
      <DashboardCardState loading={loading} error={error} testId="dashboard-plan-mini">
        {tasks.length === 0 ? (
          <DashboardEmptyText testId="dashboard-plan-mini-empty">{DASHBOARD_COPY.planMini.empty}</DashboardEmptyText>
        ) : (
          <div className="space-y-3">
            {tasks.slice(0, 4).map((task) => (
              <div key={task.id} className="flex items-start gap-3 text-body">
                <CheckCircle2
                  className={cn('mt-0.5 h-4 w-4', task.status === 'pending' ? 'text-line-3' : 'text-ok')}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{taskTitle(task)}</p>
                  <p className="text-tiny text-ink-3">
                    {task.status === 'pending' ? DASHBOARD_COPY.planMini.pending : DASHBOARD_COPY.planMini.handled}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCardState>
    </MvpCard>
  );
}

export function RecentSessionCard({
  session,
  loading,
  error,
  onResume,
  onOpenPractice,
}: {
  readonly session: PracticeSessionSummary | null;
  readonly loading: boolean;
  readonly error: boolean;
  readonly onResume: (session: PracticeSessionSummary) => void;
  readonly onOpenPractice: () => void;
}) {
  return (
    <MvpCard className="p-5" testId="dashboard-recent-session">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h3 font-semibold text-ink">{DASHBOARD_COPY.recent.title}</h2>
        <ArrowRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
      </div>
      <DashboardCardState loading={loading} error={error} testId="dashboard-recent-session">
        {session ? (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-ink">{session.paperTitle}</p>
              <p className="mt-1 text-body text-ink-3">
                {session.answeredCount} / {session.total} {DASHBOARD_COPY.recent.questionUnit}
              </p>
            </div>
            <MvpButton variant="secondary" className="w-full" onClick={() => onResume(session)}>
              {DASHBOARD_COPY.recent.resume}
            </MvpButton>
          </div>
        ) : (
          <div>
            <DashboardEmptyText testId="dashboard-recent-session-empty">{DASHBOARD_COPY.recent.empty}</DashboardEmptyText>
            <MvpButton variant="secondary" className="mt-4 w-full" onClick={onOpenPractice}>
              {DASHBOARD_COPY.recent.openPractice}
            </MvpButton>
          </div>
        )}
      </DashboardCardState>
    </MvpCard>
  );
}

export function StudyProgressCard({
  progress,
  tasksTotal,
  completedCount,
}: {
  readonly progress: number;
  readonly tasksTotal: number;
  readonly completedCount: number;
}) {
  return (
    <MvpCard className="p-5" testId="dashboard-progress-card">
      <h2 className="mb-4 text-h3 font-semibold text-ink">{DASHBOARD_COPY.progress.title}</h2>
      <MvpProgressRing value={progress} label={DASHBOARD_COPY.progress.label} />
      <div className="mt-4 grid grid-cols-2 gap-3 text-body">
        <div className="rounded-card bg-paper-2 p-3">
          <p className="text-tiny text-ink-3">{DASHBOARD_COPY.progress.learned}</p>
          <p className="mt-1 font-bold text-ink">{completedCount} {DASHBOARD_COPY.progress.groupUnit}</p>
        </div>
        <div className="rounded-card bg-paper-2 p-3">
          <p className="text-tiny text-ink-3">{DASHBOARD_COPY.progress.total}</p>
          <p className="mt-1 font-bold text-ink">{tasksTotal} {DASHBOARD_COPY.progress.groupUnit}</p>
        </div>
      </div>
    </MvpCard>
  );
}
