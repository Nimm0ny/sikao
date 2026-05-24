/*
 * @/lib/ui-copy — V5 UI copy SSOT.
 *
 * Why: lint-ui-copy-ssot enforces that any inline CJK string > 4
 *      characters in `apps/web/src/{views,components}/**` must come from
 *      this module. Centralising user-facing strings:
 *        1. enables future i18n / variant testing without grepping the codebase
 *        2. surfaces every translatable phrase in one editable file
 *        3. avoids inconsistent phrasing across views / components
 *
 *      Each export is a flat `as const` namespace so consumers can import
 *      a single namespace and access fields by key. Avoid mixing strings
 *      with markup; if a string contains markup, treat it as a value
 *      assembled at render-time, not a lexical export.
 *
 *      Naming convention: namespace is uppercase + underscore-separated
 *      (e.g. `EMPTY` / `ERROR` / `PAGINATION` / `COMMAND_PALETTE`); keys
 *      inside are camelCase semantic identifiers (e.g. `emptyResult` /
 *      `jumpToPage`).
 *
 *      Scope: this initial module covers only the strings that the
 *      Phase 7 baseline report flagged as warn-only. Business Phase
 *      pickups expand the namespace catalog as they pull each view /
 *      component into the SSOT.
 */

// Pagination component (D.3.24).
export const PAGINATION = {
  /** "跳转至指定页" — aria-label on the page-number jumper input. */
  jumpToPage: '跳转至指定页',
} as const;

// Command palette overlay (D.3.26).
export const COMMAND_PALETTE = {
  /** "无匹配结果" — empty-state body when no command / note / question matches. */
  emptyResult: '无匹配结果',
} as const;
