// 申论整卷加权得分 — fullScore 加权百分制
//
// 申论真题分值差异大：大作文 35-40 分，小题 10-20 分，总分 100。
// 1/N 平均在 [10,15,20,15,40] 上对 [100%,100%,100%,100%,0%] 给 80 分，
// 真实仅 60 分，误差 20%。必须按 fullScore 加权：
//
//   earned   = Σ(score_i / 100 * fullScore_i)   // 百分制 → 实得分
//   fullSum  = Σ(fullScore_i)
//   weighted = (earned / fullSum) * 100         // 整卷加权百分制
//
// 仅 status === 'completed' 的题计入。全 pending / 全 fullScore 缺失 → 返 null，
// view 显示"无法计算"占位（不静默 1/N 兜底，fail-fast §4）。
//
// 纯函数。无 React / 无 axios / 无 zustand。从 packages/domain/src/shenlun/examScore.ts
// 抽离到此（R2.1，2026-05-13）—— ADR-0002 答题核心算法归位 answer-engine。

export interface QuestionScore {
  readonly backendId: number;
  /** backend essayMetadata.fullScore。缺失时该题不计入分母 */
  readonly fullScore?: number;
  /** backend record.score（0-100 百分制）。pending / failed → null */
  readonly score: number | null;
}

export interface WeightedTotal {
  /** 整卷加权百分制 0-100，1 位小数。若没有有效完成题，返 null */
  readonly value: number | null;
  /**
   * 评分回来的题数（score !== null）。progress UI 用这个 —— paperQuery 比
   * grades poll 慢时，fullScore 还没到位但用户应该看到"已完成评分"
   */
  readonly scored: number;
  /**
   * 可加权题数（score !== null AND fullScore !== undefined）。weighted.value
   * 由这部分题计算；paperQuery 没就绪时为 0，此时 value=null
   */
  readonly completed: number;
  /** 参与计算的总题数（传入 items 的长度） */
  readonly total: number;
}

export function computeWeightedTotal(items: readonly QuestionScore[]): WeightedTotal {
  // fullScore = 0 是后端数据 bug（申论题不可能 0 分），必须 fail-fast throw
  // 让 ops 看到，不静默排除拉低 completed 计数。fullScore === undefined 才是
  // "老导入卷缺字段"的合法已知缺失，排除即可。
  for (const i of items) {
    if (i.fullScore !== undefined && i.fullScore <= 0) {
      throw new Error(
        `invalid fullScore for question backendId=${i.backendId}: ${i.fullScore} (essay question fullScore must be > 0; backend data corruption?)`,
      );
    }
  }

  // scored = 评分回来的题（UI 显示"已完成评分"用这个）。跟 fullScore 解耦，
  // 避免 paperQuery 慢于 grades poll 时 progress 假死在 0/N。
  const scored = items.filter((i) => i.score !== null).length;
  const eligible = items.filter(
    (i): i is QuestionScore & { score: number; fullScore: number } =>
      i.score !== null && i.fullScore !== undefined,
  );
  if (eligible.length === 0) {
    return { value: null, scored, completed: 0, total: items.length };
  }
  const fullSum = eligible.reduce((acc, i) => acc + i.fullScore, 0);
  // fullSum > 0 已被上面 throw 保证（每项 fullScore > 0，至少 1 项）。
  const earned = eligible.reduce(
    (acc, i) => acc + (i.score / 100) * i.fullScore,
    0,
  );
  const weighted = (earned / fullSum) * 100;
  // 1 位小数，避免长尾（60.000000000001）。
  const rounded = Math.round(weighted * 10) / 10;
  return {
    value: rounded,
    scored,
    completed: eligible.length,
    total: items.length,
  };
}
