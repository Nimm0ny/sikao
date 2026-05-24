/*
 * V5 business layer barrel.
 *
 * Why: single import surface for product-domain wrappers that compose generic
 *      design-system primitives. Wave 8 (V5-M3) seeds ScopeToggle (R2/Q2
 *      semantic alias of `<Tabs variant="segmented">`). Subsequent waves add
 *      OptionItem (D.3.28), QuestionStem, DifficultyChip etc.
 */
export { ScopeToggle } from './ScopeToggle';
export type { ScopeToggleProps, ScopeToggleItem } from './ScopeToggle';
