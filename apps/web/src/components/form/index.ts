/*
 * V5 form layer barrel.
 *
 * Why: single import surface for form / action primitives so downstream
 *      panels (Topbar / Card-action / Modal-footer) pull from
 *      `@/components/form` without per-file relative imports. Wave 7
 *      seeds Button (D.3.1); subsequent waves add Input / Textarea /
 *      Select / Checkbox / Radio / Switch.
 */
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
