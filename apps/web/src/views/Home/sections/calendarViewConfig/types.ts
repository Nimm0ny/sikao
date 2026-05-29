/*
 * calendarViewConfig/types.ts — SIK-138 W2.
 *
 * Why: Single view-behavior contract for Home CalendarPanel and its three
 *      child views (today / week / month). The shape is locked by
 *      `.kiro/specs/sik-138-home-calendar-v2/requirements.md` Requirement 1
 *      and the visual contract `docs/plan/sik-138-home-calendar-notion-like-
 *      visual-contract.md` §3 Information Density.
 *
 *      AGENT-H6 (Define-First): all five fields are readonly. Child views
 *      must never reach back into the preference store for these knobs;
 *      they consume CalendarViewConfig only.
 */

/**
 * The three Calendar segments rendered inside the Home `CalendarPanel`.
 * The list is fixed at exactly three; any new view variant requires a
 * spec change before adoption.
 */
export type CalendarView = 'week' | 'month';

/**
 * The seven visual channels a calendar event chip may occupy. The names
 * are tied to the visual contract §3 channel table; no other property
 * names are allowed in any preset, override, or registry call.
 */
export type CalendarCardProperty =
  | 'title'
  | 'category'
  | 'kind'
  | 'status'
  | 'source'
  | 'linkedSession'
  | 'target';

/**
 * Density preset short-hands. `default` must equal
 * `createDefaultCalendarViewConfig(view).visibleProperties`; the factory
 * tests enforce this.
 */
export type CalendarDensityPreset = 'compact' | 'default' | 'detail';

/**
 * The runtime contract consumed by `CalendarPanel` and the three
 * `*CalendarView` components. Every field is readonly so render code
 * cannot accidentally mutate config received via prop drilling.
 */
export interface CalendarViewConfig {
  readonly view: CalendarView;
  readonly startWeekOnMonday: boolean;
  readonly cardLimitPerCell: number;
  readonly dateField: 'startAt' | 'endAt';
  readonly visibleProperties: readonly CalendarCardProperty[];
}

/**
 * Optional overrides accepted by `createCalendarViewConfig`. Omitted
 * fields fall back to the `default` preset for the requested view.
 *
 * `view` is required because there is no sane default — the panel always
 * knows which view it is mounting.
 */
export interface CalendarViewConfigInput {
  readonly view: CalendarView;
  readonly startWeekOnMonday?: boolean;
  readonly cardLimitPerCell?: number;
  readonly dateField?: 'startAt' | 'endAt';
  readonly visibleProperties?: readonly CalendarCardProperty[];
}
