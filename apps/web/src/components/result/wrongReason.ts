import type { QuestionDetailV2 } from '@sikao/api-client/types/api';

export type WrongReasonCode =
  | 'calculation_error'
  | 'concept_gap'
  | 'careless_mistake'
  | 'question_misread'
  | 'knowledge_missing'
  | 'logic_error'
  | 'other';

export const WRONG_REASON_OPTIONS: ReadonlyArray<{
  readonly code: WrongReasonCode;
  readonly label: string;
}> = [
  { code: 'calculation_error', label: '计算错误' },
  { code: 'concept_gap', label: '概念没吃透' },
  { code: 'careless_mistake', label: '粗心失误' },
  { code: 'question_misread', label: '审题偏差' },
  { code: 'knowledge_missing', label: '知识点遗漏' },
  { code: 'logic_error', label: '逻辑判断错误' },
  { code: 'other', label: '其他' },
];

export function getWrongReasonLabel(code: WrongReasonCode): string {
  return (
    WRONG_REASON_OPTIONS.find((option) => option.code === code)?.label ?? '其他'
  );
}

export function deriveFallbackWrongReason(
  question: QuestionDetailV2,
): WrongReasonCode {
  const subject = question.subject ?? '';
  const subtype = question.canonicalSubtype ?? '';
  const merged = `${subject} ${subtype}`;

  if (merged.includes('资料') || merged.includes('数量')) {
    return 'calculation_error';
  }
  if (merged.includes('常识')) {
    return 'knowledge_missing';
  }
  if (merged.includes('判断') || merged.includes('逻辑')) {
    return 'logic_error';
  }
  if (merged.includes('言语')) {
    return 'question_misread';
  }
  return 'concept_gap';
}
