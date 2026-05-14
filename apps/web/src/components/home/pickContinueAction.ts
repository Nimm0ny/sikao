import type {
  PaperSummaryV2,
  PracticeHistoryResponseV2,
  PracticeSessionSummaryV2,
} from '@sikao/api-client/types/api';
import type { StudyPlanResponse, StudyTaskResponse } from '@sikao/api-client/types/study-plan';

// HomeContinueCard 数据派生 helper. 单独 .ts 文件让 react-refresh/only-export-
// components 保持安静 (HomeContinueCard.tsx 只 export React component).

export type ContinueAction =
  | { readonly kind: 'task'; readonly task: StudyTaskResponse }
  | { readonly kind: 'session'; readonly session: PracticeSessionSummaryV2 }
  | { readonly kind: 'paper'; readonly paper: PaperSummaryV2 }
  | { readonly kind: 'empty' };

export function pickContinueAction(args: {
  readonly plan: StudyPlanResponse | undefined;
  readonly history: PracticeHistoryResponseV2 | undefined;
  readonly papers: readonly PaperSummaryV2[];
}): ContinueAction {
  const pendingTask = args.plan?.tasks?.find((t) => t.status === 'pending');
  if (pendingTask !== undefined) return { kind: 'task', task: pendingTask };

  const unfinished = args.history?.recentSessions?.find((s) => s.completedAt === null);
  if (unfinished !== undefined) return { kind: 'session', session: unfinished };

  const firstPaper = args.papers[0];
  if (firstPaper !== undefined) return { kind: 'paper', paper: firstPaper };

  return { kind: 'empty' };
}
