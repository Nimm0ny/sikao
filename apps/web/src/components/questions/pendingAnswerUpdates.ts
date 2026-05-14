import type { DebouncedFunc } from 'lodash-es';

type AnswerUpdateFn = DebouncedFunc<(val: string[]) => void>;

const pendingAnswerUpdates = new Set<AnswerUpdateFn>();

export function registerPendingAnswerUpdate(update: AnswerUpdateFn): () => void {
  pendingAnswerUpdates.add(update);
  return () => pendingAnswerUpdates.delete(update);
}

export function flushPendingPracticeAnswers(): void {
  for (const update of pendingAnswerUpdates) update.flush();
}
