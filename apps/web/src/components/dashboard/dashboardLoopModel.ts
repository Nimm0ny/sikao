import type {
  PracticeSessionSummary,
  StudyPlanResponse,
  WeakModule,
} from '@sikao/domain/dashboard/useHomeData';
import type { StudyTaskResponse } from '@sikao/api-client/types/study-plan';

export const dashboardLoopStageIds = [
  'plan',
  'practice',
  'diagnosis',
  'review',
  'notes',
  'adjust',
  'feedback',
] as const;

export type DashboardLoopStageId = (typeof dashboardLoopStageIds)[number];

export function calcDashboardPlanProgress(plan: StudyPlanResponse | null): number {
  const tasks = plan?.tasks ?? [];
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => task.status !== 'pending').length;
  return Math.round((done / tasks.length) * 100);
}

export function deriveDashboardLoopStage({
  tasks,
  lastSession,
  weakModules,
}: {
  readonly tasks: readonly StudyTaskResponse[];
  readonly lastSession: PracticeSessionSummary | null;
  readonly weakModules: readonly WeakModule[];
}): DashboardLoopStageId {
  if (tasks.some((task) => task.status === 'pending')) return 'practice';
  if (lastSession !== null) return 'practice';
  if (weakModules.length > 0) return 'review';
  if (tasks.length > 0) return 'feedback';
  return 'plan';
}
