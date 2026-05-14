// 行测结果聚合 — 纯算法
//
// 从单题 isCorrect / selectedAnswerKeys 数据派生：
//   - 单 cell 状态（correct / wrong / empty）
//   - 错题 ID 集合 / 未答 ID 集合
//   - 错题详情列表（用户答案 vs 正确答案）
//   - 整卷耗时
//
// 不依赖具体 API 类型 —— 走 minimal 接口 + 泛型 narrow，跨 API 版本可复用。
// 从 apps/web/src/components/result/_resultHelpers.ts 抽离（R2.1，2026-05-13）。

export type CellState = 'correct' | 'wrong' | 'empty';

/** 单题答题数据的最小约定（具体 V2 / V3 schema 由调用方 narrow） */
export interface AnswerLike {
  readonly questionId: number | string;
  readonly selectedAnswerKeys: readonly string[];
  readonly isCorrect: boolean;
  readonly correctAnswerKeys: readonly string[];
}

/** 单题题目数据的最小约定 */
export interface QuestionLike {
  readonly questionId: number | string;
}

/**
 * 判定单题 cell 状态。
 * 已答 + 后端判 correct → 'correct'；已答 + 后端判 wrong → 'wrong'；
 * 未答或漏选 → 'empty'。
 */
export function classifyCell<Q extends QuestionLike>(
  question: Q,
  userAnswers: Record<string, readonly string[]>,
  answersById: Map<string, AnswerLike>,
): CellState {
  // questionId 强制 string —— Map/Record key 走严格相等，后端可能发整数 id。
  const qid = String(question.questionId);
  const ans = answersById.get(qid);
  if (ans !== undefined) {
    if (ans.selectedAnswerKeys.length === 0) return 'empty';
    return ans.isCorrect ? 'correct' : 'wrong';
  }
  const userKeys = userAnswers[qid] ?? [];
  if (userKeys.length === 0) return 'empty';
  // userAnswers 有 key 但 backend 未回 answer → 视为 empty（保守，避免误显示 correct）
  return 'empty';
}

/**
 * 把答题列表整理成 wrong / unanswered ID 集合。
 * 用于错题入库与统计派生。
 */
export function buildClassificationSets<Q extends QuestionLike>(
  questions: readonly Q[],
  answers: readonly AnswerLike[],
): { readonly wrongIds: ReadonlySet<string>; readonly unansweredIds: ReadonlySet<string> } {
  const wrong = new Set<string>();
  const unanswered = new Set<string>();
  const ansById = new Map<string, AnswerLike>(
    answers.map((a) => [String(a.questionId), a]),
  );
  for (const q of questions) {
    const qid = String(q.questionId);
    const ans = ansById.get(qid);
    if (ans === undefined || ans.selectedAnswerKeys.length === 0) {
      unanswered.add(qid);
    } else if (!ans.isCorrect) {
      wrong.add(qid);
    }
  }
  return { wrongIds: wrong, unansweredIds: unanswered };
}

/** 错题详情条目（用户答案 vs 正确答案 + 题目元数据） */
export interface WrongReviewItem<Q extends QuestionLike = QuestionLike> {
  readonly question: Q;
  readonly questionNo: number;
  readonly userKeys: readonly string[];
  readonly correctKeys: readonly string[];
}

/** 错题列表抽取 —— 过滤已答但 wrong 的题，附带 questionNo */
export function buildWrongItems<Q extends QuestionLike & { questionNo: number }>(
  questions: readonly Q[],
  answers: readonly AnswerLike[],
): readonly WrongReviewItem<Q>[] {
  const ansById = new Map<string, AnswerLike>(
    answers.map((a) => [String(a.questionId), a]),
  );
  const items: WrongReviewItem<Q>[] = [];
  for (const q of questions) {
    const ans = ansById.get(String(q.questionId));
    if (ans === undefined || ans.isCorrect) continue;
    if (ans.selectedAnswerKeys.length === 0) continue; // skip 未答，仅 错答
    items.push({
      question: q,
      questionNo: q.questionNo,
      userKeys: ans.selectedAnswerKeys,
      correctKeys: ans.correctAnswerKeys,
    });
  }
  return items;
}

/**
 * 计算整卷耗时（秒）。
 * 任一时间戳无效或 completedAt < startedAt → undefined（fail-safe，view 显示占位）。
 */
export function calcDurationSeconds(
  startedAt: string,
  completedAt: string | null,
): number | undefined {
  if (completedAt === null) return undefined;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return Math.round((end - start) / 1000);
}
