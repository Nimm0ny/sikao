import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Lightbulb,
  RefreshCcw,
  Target,
} from 'lucide-react';
import {
  useContinueLastSession,
  useTodayStudyPlan,
  useUpcomingExams,
  useWeakModules,
  type PracticeSessionSummary,
  type StudyPlanResponse,
  type UserExamRead,
  type WeakModule,
} from '@sikao/domain/dashboard/useHomeData';
import { usePatchStudyTask } from '@sikao/api-client/queries/studyPlanQueries';
import { useStudyPlanRouting } from '@sikao/domain/study-record/useStudyPlanRouting';
import { logger, toast } from '@sikao/shared-utils';
import type { StudyTaskResponse } from '@sikao/api-client/types/study-plan';
import {
  MvpActionCard,
  MvpButton,
  MvpCard,
  MvpChip,
  MvpPage,
  MvpProgressRing,
} from '@/components/mvp';

const taskKindLabel: Record<string, string> = {
  practice: '行测练习',
  review_wrong: '错题复盘',
  essay_writing: '申论练习',
};

function calcPlanProgress(plan: StudyPlanResponse | null): number {
  const tasks = plan?.tasks ?? [];
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status !== 'pending').length;
  return Math.round((done / tasks.length) * 100);
}

function taskTitle(task: StudyTaskResponse): string {
  return task.payload.title || taskKindLabel[task.taskKind] || task.taskKind;
}

function taskSubtitle(task: StudyTaskResponse): string {
  return task.payload.subtitle || taskKindLabel[task.taskKind] || '今日任务';
}

function formatExamDate(exam: UserExamRead): string {
  if (exam.daysUntil > 0) return `${exam.daysUntil} 天后`;
  if (exam.daysUntil === 0) return '今天';
  return `已过 ${Math.abs(exam.daysUntil)} 天`;
}

function sortPendingFirst(tasks: readonly StudyTaskResponse[]): readonly StudyTaskResponse[] {
  return [...tasks].sort((a, b) => {
    if (a.status === b.status) return a.displayOrder - b.displayOrder;
    return a.status === 'pending' ? -1 : 1;
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
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
  const progress = calcPlanProgress(plan);
  const lastSession = continueQ.data ?? null;
  const exams = examsQ.data?.exams ?? [];
  const weakModules = weakQ.data?.modules ?? [];

  const handleSkipTask = (task: StudyTaskResponse) => {
    patchTask.mutate(
      { id: task.id, status: 'skipped' },
      {
        onError: (err) => {
          logger.error('dashboard.task.skip_failed', { taskId: task.id, err: String(err) });
          toast.error('跳过任务失败', '请稍后重试');
        },
      },
    );
  };

  return (
    <MvpPage
      title="Dashboard"
      hideHeading
      action={
        <MvpButton
          variant="secondary"
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          onClick={() => navigate('/calendar')}
        >
          考试日历
        </MvpButton>
      }
      testId="dashboard-view"
    >
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <ExamCountdownCard exams={exams} loading={examsQ.isLoading} error={examsQ.isError} />
          <WeakTrendCard weakModules={weakModules} loading={weakQ.isLoading} error={weakQ.isError} />
          <AiHintCard weakModules={weakModules} />
        </div>

        <MainTaskCard
          plan={plan}
          tasks={tasks}
          completedCount={completedCount}
          progress={progress}
          loading={planQ.isLoading}
          error={planQ.isError}
          isStarting={startingTaskId !== null}
          isPatching={patchTask.isPending}
          onStart={handleTaskClick}
          onSkip={handleSkipTask}
          onRetry={() => void planQ.refetch()}
          onOpenPractice={() => navigate('/practice/center')}
        />

        <div className="space-y-5">
          <TodayPlanMini
            tasks={tasks}
            loading={planQ.isLoading}
            error={planQ.isError}
            onOpenPlan={() => navigate('/plan')}
          />
          <RecentSessionCard
            session={lastSession}
            loading={continueQ.isLoading}
            error={continueQ.isError}
            onResume={(session) => navigate(`/practice/sessions/${session.id}`)}
            onOpenPractice={() => navigate('/practice/center')}
          />
          <StudyProgressCard progress={progress} tasksTotal={tasks.length} completedCount={completedCount} />
        </div>
      </div>

      <section className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label="下一步行动">
        <MvpActionCard
          icon={<RefreshCcw className="h-5 w-5" aria-hidden="true" />}
          title="加入错题重做"
          description="把本周高频错题重新打一遍，先处理最影响提分的模块。"
          actionLabel="去错题本"
          onAction={() => navigate('/wrong-book')}
          testId="dashboard-action-wrong-book"
        />
        <MvpActionCard
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          title="生成复盘笔记"
          description="把练习结果沉淀成可复用笔记，后续复盘不用重新翻卷。"
          actionLabel="打开笔记"
          onAction={() => navigate('/notes')}
          testId="dashboard-action-notes"
        />
        <MvpActionCard
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          title="下一步计划"
          description="查看本周安排和完成情况，把任务量压回可执行范围。"
          actionLabel="查看计划"
          onAction={() => navigate('/plan')}
          testId="dashboard-action-plan"
        />
        <MvpActionCard
          icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
          title="申论训练"
          description="进入申论套卷或专项，完成写作后查看评分与建议。"
          actionLabel="进入申论"
          onAction={() => navigate('/practice/center?subject=essay')}
          testId="dashboard-action-essay"
        />
      </section>
    </MvpPage>
  );
}

function CardStatus({
  loading,
  error,
  empty,
  children,
}: {
  readonly loading: boolean;
  readonly error: boolean;
  readonly empty?: string;
  readonly children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-24 items-center gap-2 text-sm text-[#4B5563]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>正在加载</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-24 items-start gap-2 rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#991B1B]">
        <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <span>接口加载失败，请稍后重试。</span>
      </div>
    );
  }
  if (empty) {
    return <p className="min-h-16 text-sm leading-6 text-[#4B5563]">{empty}</p>;
  }
  return <>{children}</>;
}

function ExamCountdownCard({
  exams,
  loading,
  error,
}: {
  readonly exams: readonly UserExamRead[];
  readonly loading: boolean;
  readonly error: boolean;
}) {
  const nextExam = exams[0] ?? null;
  return (
    <MvpCard className="p-5" testId="dashboard-exam-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#111827]">考试倒计时</h2>
        <CalendarDays className="h-5 w-5 text-[#4B5563]" aria-hidden="true" />
      </div>
      <CardStatus loading={loading} error={error} empty={nextExam === null ? '还没有设置目标考试，建档后可在计划里补充。' : undefined}>
        {nextExam ? (
          <div>
            <p className="text-3xl font-bold text-[#111827]">{formatExamDate(nextExam)}</p>
            <p className="mt-1 text-sm text-[#4B5563]">{nextExam.name}</p>
            <p className="mt-3 text-xs text-[#4B5563]">{nextExam.examDate}</p>
          </div>
        ) : null}
      </CardStatus>
    </MvpCard>
  );
}

function WeakTrendCard({
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
        <h2 className="text-base font-semibold text-[#111827]">薄弱模块趋势</h2>
        <Target className="h-5 w-5 text-[#4B5563]" aria-hidden="true" />
      </div>
      <CardStatus loading={loading} error={error} empty={weakModules.length === 0 ? '暂无错题统计，先完成一次练习后再看趋势。' : undefined}>
        <div className="space-y-3">
          {weakModules.slice(0, 3).map((item) => (
            <div key={item.subject} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[#111827]">{item.subject}</span>
                <span className="text-[#4B5563]">{Math.round(item.score)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEF2F8]">
                <div
                  className="h-2 rounded-full bg-[#2563EB]"
                  style={{ width: `${Math.max(8, Math.min(100, item.score))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardStatus>
    </MvpCard>
  );
}

function AiHintCard({ weakModules }: { readonly weakModules: readonly WeakModule[] }) {
  const top = weakModules[0];
  return (
    <MvpCard className="p-5" testId="dashboard-ai-hint">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />
        <h2 className="text-base font-semibold text-[#111827]">AI 建议</h2>
      </div>
      <p className="text-sm leading-6 text-[#4B5563]">
        {top
          ? `${top.subject} 是当前优先模块，建议先做专项训练，再回到错题本复盘原因。`
          : '先完成一套行测或一次申论训练，系统会基于结果生成更明确的建议。'}
      </p>
    </MvpCard>
  );
}

function MainTaskCard({
  plan,
  tasks,
  completedCount,
  progress,
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
  readonly progress: number;
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
    <MvpCard className="flex min-h-[520px] flex-col p-6 md:p-8" testId="dashboard-main-task">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <MvpChip tone="blue">今日主任务</MvpChip>
        {plan ? <MvpChip>{completedCount} / {tasks.length} 已完成</MvpChip> : null}
      </div>
      <CardStatus loading={loading} error={error} empty={tasks.length === 0 ? '今日计划为空。可以先进入练习中心选择专项或套卷。' : undefined}>
        <div className="flex flex-1 flex-col">
          <div className="mb-6 grid place-items-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
              <Target className="h-12 w-12" aria-hidden="true" />
            </div>
          </div>
          <h2 className="text-center text-3xl font-bold text-[#111827]">今日主任务</h2>
          {mainTask ? (
            <>
              <p className="mt-3 text-center text-base font-semibold text-[#111827]">{taskTitle(mainTask)}</p>
              <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-[#4B5563]">{taskSubtitle(mainTask)}</p>
              <div className="mt-8 grid gap-3">
                <MvpButton
                  className="w-full"
                  icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => onStart(mainTask)}
                  disabled={isStarting || isPatching}
                  data-testid="dashboard-main-start"
                >
                  {isStarting ? '正在创建练习' : '继续主任务'}
                </MvpButton>
                <MvpButton
                  variant="secondary"
                  className="w-full"
                  onClick={() => onSkip(mainTask)}
                  disabled={isStarting || isPatching}
                  data-testid="dashboard-main-skip"
                >
                  跳过今日任务
                </MvpButton>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-center text-base font-semibold text-[#15803D]">今日计划已完成</p>
              <p className="mx-auto mt-2 max-w-md text-center text-sm leading-6 text-[#4B5563]">可以进入错题本复盘，或补一组薄弱专项保持手感。</p>
              <MvpButton className="mx-auto mt-8" onClick={onOpenPractice}>
                加练一组
              </MvpButton>
            </>
          )}
          <div className="mt-auto pt-8">
            <MvpProgressRing value={progress} label="学习进度" />
          </div>
        </div>
      </CardStatus>
      {error ? (
        <MvpButton variant="secondary" className="mt-4" onClick={onRetry}>
          重试加载
        </MvpButton>
      ) : null}
    </MvpCard>
  );
}

function TodayPlanMini({
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
        <h2 className="text-base font-semibold text-[#111827]">今日计划</h2>
        <MvpButton variant="ghost" className="min-h-8 px-2 py-1" onClick={onOpenPlan}>
          查看
        </MvpButton>
      </div>
      <CardStatus loading={loading} error={error} empty={tasks.length === 0 ? '暂无计划任务。' : undefined}>
        <div className="space-y-3">
          {tasks.slice(0, 4).map((task) => (
            <div key={task.id} className="flex items-start gap-3 text-sm">
              <CheckCircle2
                className={['mt-0.5 h-4 w-4', task.status === 'pending' ? 'text-[#B8C4D8]' : 'text-[#16A34A]'].join(' ')}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#111827]">{taskTitle(task)}</p>
                <p className="text-xs text-[#4B5563]">{task.status === 'pending' ? '待完成' : '已处理'}</p>
              </div>
            </div>
          ))}
        </div>
      </CardStatus>
    </MvpCard>
  );
}

function RecentSessionCard({
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
        <h2 className="text-base font-semibold text-[#111827]">最近练习</h2>
        <ArrowRight className="h-4 w-4 text-[#4B5563]" aria-hidden="true" />
      </div>
      <CardStatus loading={loading} error={error} empty={session === null ? '还没有未完成练习。' : undefined}>
        {session ? (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-[#111827]">{session.paperTitle}</p>
              <p className="mt-1 text-sm text-[#4B5563]">{session.answeredCount} / {session.total} 题</p>
            </div>
            <MvpButton variant="secondary" className="w-full" onClick={() => onResume(session)}>
              继续练习
            </MvpButton>
          </div>
        ) : (
          <MvpButton variant="secondary" className="mt-4 w-full" onClick={onOpenPractice}>
            去练习中心
          </MvpButton>
        )}
      </CardStatus>
    </MvpCard>
  );
}

function StudyProgressCard({
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
      <h2 className="mb-4 text-base font-semibold text-[#111827]">学习进度</h2>
      <MvpProgressRing value={progress} label="今日完成" />
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-[#F7F8FB] p-3">
          <p className="text-xs text-[#4B5563]">已学</p>
          <p className="mt-1 font-bold text-[#111827]">{completedCount} 组</p>
        </div>
        <div className="rounded-lg bg-[#F7F8FB] p-3">
          <p className="text-xs text-[#4B5563]">总任务</p>
          <p className="mt-1 font-bold text-[#111827]">{tasksTotal} 组</p>
        </div>
      </div>
    </MvpCard>
  );
}
