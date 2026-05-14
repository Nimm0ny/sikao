// View-model helpers for views/Result.tsx — keep Result.tsx ≤500 行
// (frontend/CLAUDE.md §3.5). 没有 React 依赖, 全 pure functions; 测试覆盖通过
// Result.test.tsx 间接验证.
//
// R2.1 (2026-05-13): 核心聚合算法 (classifyCell / buildClassificationSets /
// buildWrongItems / calcDurationSeconds) 抽到 @sikao/answer-engine/scoring/xingce
// (ADR-0002). 本文件仅保留 view-shape 适配 + V2 API 类型 narrow.

import type {
  AnswerCardCell,
  AnswerComparisonCell,
  CellState,
  TimingTimelineSectionLabel,
  WrongReviewItem,
} from '@/components/result';
import { deriveQuestionTimings, type QuestionTiming } from '@sikao/shared-utils';
import {
  classifyCell as classifyCellPure,
  buildClassificationSets as buildClassificationSetsPure,
  buildWrongItems as buildWrongItemsPure,
  calcDurationSeconds as calcDurationSecondsPure,
} from '@sikao/answer-engine/scoring/xingce';
import type {
  PracticeSessionAnswerV2,
  PracticeSessionResultV2,
  QuestionDetailV2,
} from '@sikao/api-client/types/api';

export function pickTitle(result: PracticeSessionResultV2): string {
  return result.session?.paperName ?? '练习结果';
}

export function classifyCell(
  question: QuestionDetailV2,
  userAnswers: Record<string, readonly string[]>,
  answersById: Map<string, PracticeSessionAnswerV2>,
): CellState {
  return classifyCellPure(question, userAnswers, answersById);
}

export function buildComparisonCells(
  result: PracticeSessionResultV2,
): readonly AnswerComparisonCell[] {
  const questions = result.questions;
  if (questions === undefined || questions.length === 0) return [];
  const answersById = new Map<string, PracticeSessionAnswerV2>(
    (result.answers ?? []).map((a) => [String(a.questionId), a]),
  );
  return questions.map((q) => ({
    questionId: String(q.questionId),
    questionNo: q.questionNo,
    sectionId: q.sectionId,
    state: classifyCell(q, result.userAnswers, answersById),
  }));
}

export function buildAnswerCardCells(
  result: PracticeSessionResultV2,
): readonly AnswerCardCell[] {
  const questions = result.questions;
  if (questions === undefined || questions.length === 0) return [];
  const answersById = new Map<string, PracticeSessionAnswerV2>(
    (result.answers ?? []).map((a) => [String(a.questionId), a]),
  );
  return questions.map((q) => ({
    questionId: String(q.questionId),
    questionNo: q.questionNo,
    sectionId: q.sectionId,
    state: classifyCell(q, result.userAnswers, answersById),
  }));
}

export function buildTimings(
  result: PracticeSessionResultV2,
): readonly QuestionTiming[] {
  const session = result.session;
  const answers = result.answers;
  const questions = result.questions;
  if (session === undefined || answers === undefined || questions === undefined) {
    return [];
  }
  // questionNo lives on the question detail, not the answer payload — join.
  const noById = new Map<string, number>(
    questions.map((q) => [String(q.questionId), q.questionNo]),
  );
  // 排序逻辑: 按 answeredAt 升序传给 deriveQuestionTimings (user 跳题答题
  // 时 paper position 顺序 ≠ answer 顺序; 用户感知的"每题用时"是基于答题
  // 时序的). 然后调用方负责重新按 questionNo 排序展示.
  const sorted = [...answers].sort(
    (a, b) => Date.parse(a.answeredAt) - Date.parse(b.answeredAt),
  );
  return deriveQuestionTimings(
    sorted.map((a) => ({
      questionId: String(a.questionId),
      questionNo: noById.get(String(a.questionId)) ?? 0,
      answeredAt: a.answeredAt,
    })),
    session.startedAt,
  );
}

export function buildSectionLabels(
  result: PracticeSessionResultV2,
): readonly TimingTimelineSectionLabel[] {
  const questions = result.questions;
  const sections = result.sectionSummaries;
  if (questions === undefined || sections === undefined || sections.length === 0) {
    return [];
  }
  const titleById = new Map(sections.map((s) => [s.sectionId, s.title]));
  // For each section, find min/max questionNo. Single pass groupby.
  const range = new Map<string, { from: number; to: number }>();
  for (const q of questions) {
    const cur = range.get(q.sectionId);
    if (cur === undefined) {
      range.set(q.sectionId, { from: q.questionNo, to: q.questionNo });
    } else {
      if (q.questionNo < cur.from) cur.from = q.questionNo;
      if (q.questionNo > cur.to) cur.to = q.questionNo;
    }
  }
  // Preserve section ordering as ships in sectionSummaries (matches paper order).
  return sections
    .map((s) => {
      const r = range.get(s.sectionId);
      if (r === undefined) return null;
      return {
        title: titleById.get(s.sectionId) ?? s.title,
        fromNo: r.from,
        toNo: r.to,
      };
    })
    .filter((x): x is TimingTimelineSectionLabel => x !== null);
}

export function buildClassificationSets(
  result: PracticeSessionResultV2,
): {
  readonly wrongIds: ReadonlySet<string>;
  readonly unansweredIds: ReadonlySet<string>;
} {
  return buildClassificationSetsPure(result.questions ?? [], result.answers ?? []);
}

export function buildWrongItems(
  result: PracticeSessionResultV2,
): readonly WrongReviewItem[] {
  const questions = result.questions;
  const answers = result.answers;
  if (questions === undefined || answers === undefined) return [];
  return buildWrongItemsPure(questions, answers) as readonly WrongReviewItem[];
}

export function calcDurationSeconds(
  startedAt: string,
  completedAt: string | null,
): number | undefined {
  return calcDurationSecondsPure(startedAt, completedAt);
}
