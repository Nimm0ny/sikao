// 申论 rubric 维度判定 — 纯阈值算法
//
// 来自 apps/web/src/components/result/_essayResultHelpers.ts（R2.1，2026-05-13 抽离）。
// 跟 EssayGradingCard.WEAK_THRESHOLD 一致避免双源。

/**
 * 弱项阈值：单条 rubric 得分率 < 此值 → 弱项标红 / 整 qrow 弱项背景。
 * 0.6 = 60% 维度得分率。
 */
export const ESSAY_WEAK_THRESHOLD = 0.6;

/**
 * 单条 rubric tone —— 决定 .ok b 绿色 / .err b 红色 / 默认 ink。
 *   ok      : score / max >= 0.85（优秀，绿色）
 *   err     : score / max < 0.6（弱项，红色）
 *   neutral : 中间（默认 ink 不染色）
 */
export type RubricTone = 'ok' | 'err' | 'neutral';

export function classifyRubricTone(score: number, max: number): RubricTone {
  if (max <= 0) return 'neutral';
  const ratio = score / max;
  if (ratio >= 0.85) return 'ok';
  if (ratio < ESSAY_WEAK_THRESHOLD) return 'err';
  return 'neutral';
}

/** qrow weak 判定（整行得分率 < 60% → 弱项行染色）。 */
export function isWeakQuestion(score: number, max: number): boolean {
  if (max <= 0) return false;
  return score / max < ESSAY_WEAK_THRESHOLD;
}
