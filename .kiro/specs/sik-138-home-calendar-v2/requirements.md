# Requirements Document

## V2 Amendment (2026-05-28, SIK-138)

This spec supersedes the earlier `home-calendar-notion-like` draft.
The V2 amendment locks seven corrections before any implementation starts:

- `D14` Peek dialog must reuse `apps/web/src/components/system/FocusTrap`.
- `D15` Production icons must use `lucide-react`; no inline SVG-only plan.
- `D16` All three views must integrate `expandRecurringOccurrences(...)`.
- `D17` Month view must integrate `sliceOccurrenceByDay(...)` so cross-day
  events render on every affected day.
- `D18` Preference hydration must reuse the existing
  `useDashboardPreferenceStore.profileLoaded`; no new hydration guard hook.
- `D19` Phase 3 drag placeholder may add `data-event-id` and
  `data-peek-anchor`, but V1 must not introduce `DndContext`.
- `D20` `optimisticEvents` may be read as a render-time placeholder only; V1
  must not introduce new write paths or mutation behavior.

## Overview

The goal is to upgrade Home `CalendarPanel` toward a Notion-like event-density
model without replacing the existing `today / week / month` shell.

V1 scope includes:

- Phase 1: `CalendarViewConfig` extraction
- Phase 2: configurable month-chip properties
- Read-only central peek card
- Recurring and cross-day rendering fixes required for correctness

Out of scope for V1:

- drag-to-reschedule
- recurrence editing
- inline field editing
- aggregate metrics such as practice count / accuracy

## Requirement 1: CalendarViewConfig is the only view-behavior contract

`CalendarPanel` and its three child views must share a single injected
`CalendarViewConfig` object with these fields:

- `view: 'today' | 'week' | 'month'`
- `startWeekOnMonday: boolean`
- `cardLimitPerCell: number`
- `dateField: 'startAt' | 'endAt'`
- `visibleProperties: readonly CalendarCardProperty[]`

Child views must not hardcode their own copies of these values.

## Requirement 2: ViewConfig construction is fail-fast

The spec must define explicit errors for invalid configuration:

- `InvalidCalendarViewError`
- `InvalidCalendarLimitError`
- `UnknownCalendarPropertyError`
- `UnknownCalendarPresetError`

Silent fallback patterns are forbidden.

## Requirement 3: Supported visible properties are fixed in V1

`visibleProperties` may only reference:

- `title`
- `category`
- `kind`
- `status`
- `source`
- `linkedSession`
- `target`

V1 must not expose aggregate fields such as practice count, accuracy, or
duration because they do not exist on `PlanEventReadV2`.

## Requirement 4: Week-start affects both headers and grid placement

- `startWeekOnMonday=true`
  - DOW order is Monday-first
  - month `gridStart = (monthStart.getDay() + 6) % 7`
- `startWeekOnMonday=false`
  - DOW order is Sunday-first
  - month `gridStart = monthStart.getDay()`

Views must consume this through `CalendarViewConfig`, not by reading storage
directly.

## Requirement 5: cardLimitPerCell controls month overflow

- Month cells render at most `cardLimitPerCell` chips.
- Overflow renders `+N more`.
- V1 must not add an overflow popover.

## Requirement 6: Default config and preset config must be identical for `default`

This is the corrected single source of truth that resolves the old conflict:

- `createCalendarViewConfigPreset(view, 'compact')`
  - `visibleProperties = ['title', 'kind']`
- `createCalendarViewConfigPreset(view, 'default')`
  - `visibleProperties = ['title', 'kind', 'status']`
- `createCalendarViewConfigPreset(view, 'detail')`
  - `visibleProperties = ['title', 'kind', 'status', 'category', 'source', 'linkedSession', 'target']`

Default limits:

- `today`: `Number.MAX_SAFE_INTEGER`
- `week`: `Number.MAX_SAFE_INTEGER`
- `month`: `3`

Shared defaults:

- `startWeekOnMonday = true`
- `dateField = 'startAt'`

And:

- `createDefaultCalendarViewConfig(view)` must equal
  `createCalendarViewConfigPreset(view, 'default')`

## Requirement 7: Preference persistence only covers user-facing knobs

V1 may persist:

- `homeCalendarView`
- `startWeekOnMonday`
- `cardLimitPerCell`

V1 must not persist `visibleProperties`.

Hydration must reuse the existing `profileLoaded` signal.

## Requirement 8: Each chip property owns a distinct visual channel

- `kind`
  - left border + tint background
- `title`
  - primary text
- `category`
  - secondary neutral text
- `status`
  - status dot / mark
- `source`
  - icon
- `linkedSession`
  - link icon
- `target`
  - target badge

No two properties may fight over the same semantic channel.

## Requirement 9: CalendarPanel must not cross the write boundary in V1

V1 keeps reading from existing state/query layers only:

- `usePlanStore`
- `useDashboardPreferenceStore.patchPreferences`
- `useEvents`

V1 must not call:

- `useUpdateEvent`
- `useCreateEvent`
- `useDeleteEvent`

## Requirement 10: Recurring and cross-day rendering correctness is mandatory in V1

All three views must integrate `expandRecurringOccurrences(...)`.
Month view must integrate `sliceOccurrenceByDay(...)`.

This is not a future enhancement; it is required for correctness.

## Requirement 11: Token SSOT must be preserved

New calendar visuals may only consume `packages/design-system/src/tokens.css`
tokens.

The design and implementation must not instruct use of prototype vars such as:

- `--paper-1`
- `--ink-1`
- `--r-card`
- `--t-meta`
- `--shadow-1`

## Requirement 12: Peek card implementation constraints

The read-only peek card must:

- reuse `FocusTrap`
- use `lucide-react`
- render through a portal
- lock body scroll while open
- restore focus on close

V1 peek actions may be visible but must remain read-only placeholders unless a
separate future spec authorizes writes.

## Requirement 13: Visual contract is mandatory before Runner starts

Before implementation, land:

- `docs/plan/sik-138-home-calendar-notion-like-visual-contract.md`

That contract must include:

- Layout Topology
- Required Interactive Elements
- Information Density
- Token Map
- SSOT Conflicts
- Visual Drift from Prototype
- Acceptance Hooks

## Requirement 14: Commit and review gates

Implementation must follow:

- `<= 15` files per commit
- `<= 400` net lines per commit
- independent review for large waves
- browser smoke at `1440` and `1920`

## Requirement 15: Files and responsibilities

The implementation target remains:

- `CalendarPanel.tsx`
- `TodayCalendarView.tsx`
- `WeekCalendarView.tsx`
- `MonthCalendarView.tsx`
- new `MonthEventChip`
- new `peek/` module
- new `calendarViewConfig/` module

No new global store may be introduced for V1.

