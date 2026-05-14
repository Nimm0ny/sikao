import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

// Phase 6.5 fenbi-merge — 判断当前 question 是否走图推 renderer.
//
// 数据现状 (2026-05-06 PG 调研):
//   - renderer_key 全是 single_choice/multiple_choice/fill_blank, 0 graphic_reasoning
//   - canonical_top_type='判断推理' 24029 题, 5788 含 img (stem 5464 + opts 468)
//   - canonical_subtype 没细分 (没拆 图推/类比/逻辑/定义)
//   - ETL 漏标 — 推 follow-up backfill renderer_key='graphic_reasoning'
//
// 软方案: 前端 runtime 推断, 不动 BE 数据.
//
// 命中条件:
//   1. questionKind = single_choice (图推都是单选)
//   2. stem 含 <img> 或 options 任一含 <img>
//   3. options 全单字母 (整张题图模式) OR options 任一含 img (分开图模式)
//
// 误判保护:
//   - 数量关系 stem 含 img + options 数字: 第 3 条不命中, 走 SingleChoiceRenderer
//   - 资料分析 stem 含 img + options 数字/文字: 第 3 条不命中
//   - 类比推理 stem 不含 img: 第 2 条不命中
//
// 命中估计 (基于调研): ~5500 题 (判断推理含图 + 选项符合条件).
//
// 为什么 multiple_choice 直接 reject (review-fix #4 数据证据):
// 跑 PG 调研 — multi 题里全站含 img 仅 14 题 (判断推理 1 / 常识应用 9 / 综合
// 分析 2 / 公基多选 1 / 常识 1). 行测主流图推都是单选, multi 图推几乎不存
// 在 (1 题). 不扩契约简化逻辑. 若后续 BE ETL 补图推 backfill 也能命中
// rendererKey === 'graphic_reasoning' 直接 case (在 QuestionDispatcher).

// review-fix #5: 五选 (E/F) 题也算单字母 — 公考五选小样本但不让函数失误判.
const SINGLE_LETTER = /^[A-F]$/;

export function isGraphicReasoning(question: QuestionDetailV2): boolean {
  if (question.questionKind !== 'single_choice') return false;
  const stem = question.content.stem ?? '';
  const options = question.content.options ?? [];
  const stemHasImg = stem.includes('<img');
  const optsHaveImg = options.some((o) => (o.text ?? '').includes('<img'));
  if (!stemHasImg && !optsHaveImg) return false;
  if (optsHaveImg) return true;
  // stem 含 img, options 不含 img — 必须全单字母才算图推 (整张题图模式).
  if (options.length === 0) return false;
  return options.every((o) => SINGLE_LETTER.test((o.text ?? '').trim()));
}
