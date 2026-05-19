import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  FileText,
  RefreshCcw,
  Target,
} from 'lucide-react';
import {
  useContinueLastSession,
  useTodayStudyPlan,
  useUpcomingExams,
  useWeakModules,
} from '@sikao/domain/dashboard/useHomeData';
import { usePatchStudyTask } from '@sikao/api-client/queries/studyPlanQueries';
import { useStudyPlanRouting } from '@sikao/domain/study-record/useStudyPlanRouting';
import { isAuthError, logger, toast } from '@sikao/shared-utils';
import type { StudyTaskResponse } from '@sikao/api-client/types/study-plan';
import {
  MvpActionCard,
  MvpButton,
  MvpCard,
  MvpPage,
} from '@/components/mvp';
import {
  AiHintCard,
  ExamCountdownCard,
  MainTaskCard,
  RecentSessionCard,
  StudyProgressCard,
  TodayPlanMini,
  WeakTrendCard,
} from '@/components/dashboard/DashboardLoopCards';
import { DashboardLoopStageCard } from '@/components/dashboard/DashboardLoopStageCard';
import {
  calcDashboardPlanProgress,
  deriveDashboardLoopStage,
} from '@/components/dashboard/dashboardLoopModel';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

const dashboardRoutes = {
  practiceCenter: '/practice/center',
  essayPractice: '/practice/center?subject=essay',
  wrongBook: '/wrong-book',
  notes: '/notes',
  plan: '/plan',
  calendar: '/calendar',
  login: '/login',
} as const;

function sortPendingFirst(tasks: readonly StudyTaskResponse[]): readonly StudyTaskResponse[] {
  return [...tasks].sort((a, b) => {
    if (a.status === b.status) return a.displayOrder - b.displayOrder;
    return a.status === 'pending' ? -1 : 1;
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const continueQ = useContinueLastSession();
  const planQ = useTodayStudyPlan();
  const examsQ = useUpcomingExams();
  const weakQ = useWeakModules({ limit: 3 });
  const patchTask = usePatchStudyTask();
  const { handleTaskClick, startingTaskId } = useStudyPlanRouting();

  const plan = planQ.data ?? null;
  const tasks = useMemo(() => sortPendingFirst(plan?.tasks ?? []), [plan?.tasks]);
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const completedCount = tasks.length - pendingTasks.length;
  const progress = calcDashboardPlanProgress(plan);
  const lastSession = continueQ.data ?? null;
  const exams = examsQ.data?.exams ?? [];
  const weakModules = weakQ.data?.modules ?? [];
  const activeStage = deriveDashboardLoopStage({ tasks, lastSession, weakModules });
  const hasAuthError =
    isAuthError(planQ.error) ||
    isAuthError(continueQ.error) ||
    isAuthError(examsQ.error) ||
    isAuthError(weakQ.error);

  const handleSkipTask = (task: StudyTaskResponse) => {
    patchTask.mutate(
      { id: task.id, status: 'skipped' },
      {
        onError: (err) => {
          logger.error('dashboard.task.skip_failed', { taskId: task.id, err: String(err) });
          toast.error(DASHBOARD_COPY.main.skipFailed, DASHBOARD_COPY.retryHint);
        },
      },
    );
  };

  if (hasAuthError) {
    return (
      <MvpPage title="Dashboard" hideHeading testId="dashboard-view">
        <MvpCard className="mx-auto max-w-2xl p-8 text-center" testId="dashboard-auth-fallback">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-card bg-accent-50 text-accent">
            <Target className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-h2 font-semibold text-ink">{DASHBOARD_COPY.auth.title}</h2>
          <p className="mx-auto mt-2 max-w-md text-body leading-6 text-ink-3">
            {DASHBOARD_COPY.auth.description}
          </p>
          <MvpButton
            className="mx-auto mt-6"
            onClick={() => navigate(dashboardRoutes.login, { state: { from: `${location.pathname}${location.search}` } })}
            data-testid="dashboard-auth-login"
          >
            {DASHBOARD_COPY.auth.action}
          </MvpButton>
        </MvpCard>
      </MvpPage>
    );
  }

  return (
    <MvpPage
      title="Dashboard"
      hideHeading
      testId="dashboard-view"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <MainTaskCard
            plan={plan}
            tasks={tasks}
            completedCount={completedCount}
            loading={planQ.isLoading}
            error={planQ.isError}
            isStarting={startingTaskId !== null}
            isPatching={patchTask.isPending}
            onStart={handleTaskClick}
            onSkip={handleSkipTask}
            onRetry={() => void planQ.refetch()}
            onOpenPractice={() => navigate(dashboardRoutes.practiceCenter)}
          />

          <DashboardLoopStageCard activeStage={activeStage} />

          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label={DASHBOARD_COPY.sections.nextActions}>
            <MvpActionCard
              icon={<RefreshCcw className="h-5 w-5" aria-hidden="true" />}
              title={DASHBOARD_COPY.actions.wrongBook.title}
              description={DASHBOARD_COPY.actions.wrongBook.description}
              actionLabel={DASHBOARD_COPY.actions.wrongBook.label}
              onAction={() => navigate(dashboardRoutes.wrongBook)}
              testId="dashboard-action-wrong-book"
            />
            <MvpActionCard
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
              title={DASHBOARD_COPY.actions.notes.title}
              description={DASHBOARD_COPY.actions.notes.description}
              actionLabel={DASHBOARD_COPY.actions.notes.label}
              onAction={() => navigate(dashboardRoutes.notes)}
              testId="dashboard-action-notes"
            />
            <MvpActionCard
              icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
              title={DASHBOARD_COPY.actions.plan.title}
              description={DASHBOARD_COPY.actions.plan.description}
              actionLabel={DASHBOARD_COPY.actions.plan.label}
              onAction={() => navigate(dashboardRoutes.plan)}
              testId="dashboard-action-plan"
            />
            <MvpActionCard
              icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
              title={DASHBOARD_COPY.actions.essay.title}
              description={DASHBOARD_COPY.actions.essay.description}
              actionLabel={DASHBOARD_COPY.actions.essay.label}
              onAction={() => navigate(dashboardRoutes.essayPractice)}
              testId="dashboard-action-essay"
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-2" aria-label={DASHBOARD_COPY.sections.insights}>
            <WeakTrendCard weakModules={weakModules} loading={weakQ.isLoading} error={weakQ.isError} />
            <AiHintCard weakModules={weakModules} loading={weakQ.isLoading} error={weakQ.isError} />
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start" aria-label={DASHBOARD_COPY.sections.overview}>
          <TodayPlanMini
            tasks={tasks}
            loading={planQ.isLoading}
            error={planQ.isError}
            onOpenPlan={() => navigate(dashboardRoutes.plan)}
          />
          <RecentSessionCard
            session={lastSession}
            loading={continueQ.isLoading}
            error={continueQ.isError}
            onResume={(session) => navigate(`/practice/sessions/${session.id}`)}
            onOpenPractice={() => navigate(dashboardRoutes.practiceCenter)}
          />
          <StudyProgressCard progress={progress} tasksTotal={tasks.length} completedCount={completedCount} />
          <ExamCountdownCard
            exams={exams}
            loading={examsQ.isLoading}
            error={examsQ.isError}
            onOpenCalendar={() => navigate(dashboardRoutes.calendar)}
          />
        </aside>
      </div>
    </MvpPage>
  );
}
