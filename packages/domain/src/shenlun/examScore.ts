// examScore — 整卷模考加权得分
//
// R2.1（2026-05-13）：核心算法 computeWeightedTotal 抽到
// @sikao/answer-engine/scoring/shenlun（ADR-0002）。本文件仅作 backward-compatible
// re-export，避免破坏旧 import 路径 `@sikao/domain/shenlun/examScore`。
//
// 新代码应直接从 @sikao/answer-engine/scoring/shenlun 引入。

export {
  computeWeightedTotal,
  type QuestionScore,
  type WeightedTotal,
} from '@sikao/answer-engine/scoring/shenlun';
