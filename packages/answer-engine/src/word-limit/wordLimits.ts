import type { Question } from '@sikao/domain/shenlun/types';

export function getWordLimitText(question: Question): string {
  if (question.minWords !== undefined && question.maxWords !== undefined) {
    return `不少于 ${question.minWords} 字 · 不超过 ${question.maxWords} 字`;
  }
  if (question.minWords !== undefined) {
    return `不少于 ${question.minWords} 字`;
  }
  if (question.maxWords !== undefined) {
    return `不超过 ${question.maxWords} 字`;
  }
  throw new Error(`question word limit missing: ${question.no}`);
}

export function getWordLimitTarget(question: Question): number {
  const target = question.minWords ?? question.maxWords;
  if (target === undefined) {
    throw new Error(`question word limit missing: ${question.no}`);
  }
  return target;
}

export function hasMinimumWordLimit(question: Question): boolean {
  return question.minWords !== undefined;
}

export function hasReachedMinimum(question: Question, written: number): boolean {
  return question.minWords !== undefined && written >= question.minWords;
}

export function hasExceededMaximum(question: Question, written: number): boolean {
  return question.maxWords !== undefined && written > question.maxWords;
}
