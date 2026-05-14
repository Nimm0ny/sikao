import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// P3b 判断题 (TF) 命中 helper (SIKAO 答题系统行测).
//
// 数据现状 (2026-05-11 BE 调研, see apps/exam-api/app/scripts/fenbi_to_standard.py:334):
//   - BE 当前已支持 4 个 rendererKey: single_choice / multiple_choice
//     / fill_blank / essay. 暂无 'true_false' / 'judgment' rendererKey.
//   - fenbi type 1/2/3/5 全无 TF (公考行测主流题型). 但答题模式 (公基判断 /
//     公文判断 等) 后续 ETL 可能补 TF; 占位 FE 组件先 ship.
//   - Master 拍板: P3b 先建 FbTF + helper 占位, BE 接入后改 helper 实际值即可.
//
// 命中条件 (二选一冗余 fallback, 跟 isGraphicReasoning.ts:34 同 pattern):
//   1. rendererKey === 'true_false' (BE 显式标记)
//   2. questionKind === 'true_false' (BE 部分 ETL 漏标 rendererKey 时兜底)
//
// 误判保护: 两字段都不是 'true_false' 直接 false → 走 FbOpts (single/multi).
//
// Follow-up (推 master): BE ETL 补 fenbi judgment 类型 → 'true_false' rendererKey
// + 此 helper 0 改即可命中.

export function isTrueFalseQuestion(q: QuestionDetailV2): boolean {
  return q.rendererKey === 'true_false' || q.questionKind === 'true_false';
}
