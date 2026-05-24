/*
 * V5 business layer barrel.
 *
 * Why: single import surface for product-domain wrappers that compose generic
 *      design-system primitives. Wave 8 (V5-M3) seeds ScopeToggle (R2/Q2
 *      semantic alias of `<Tabs variant="segmented">`); wave 14 adds the
 *      4 answer-system primitives (D.3.28-31): OptionItem / QuestionStem /
 *      AnswerSheet / TimerDisplay.
 */
export { ScopeToggle } from './ScopeToggle';
export type { ScopeToggleProps, ScopeToggleItem } from './ScopeToggle';

export { OptionItem } from './OptionItem';
export type { OptionItemProps, OptionItemState } from './OptionItem';

export { QuestionStem } from './QuestionStem';
export type {
  QuestionStemProps,
  QuestionStemFontSize,
  QuestionStemDifficulty,
  QuestionStemMark,
} from './QuestionStem';

export { AnswerSheet } from './AnswerSheet';
export type {
  AnswerSheetProps,
  AnswerSheetQuestion,
  AnswerSheetCellState,
} from './AnswerSheet';

export { TimerDisplay } from './TimerDisplay';
export type { TimerDisplayProps } from './TimerDisplay';
