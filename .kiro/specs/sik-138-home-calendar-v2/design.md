# Design Document

## V2 Amendment (2026-05-28, SIK-138)

Implementation must follow these corrected assumptions:

- Reuse `FocusTrap`; do not introduce `peekFocusTrap.ts`
- Use `lucide-react`; do not plan inline SVG-only production icons
- Integrate `expandRecurringOccurrences(...)` in all views
- Integrate `sliceOccurrenceByDay(...)` in month view
- Reuse `profileLoaded`; do not introduce a new hydration guard hook
- Keep drag and recurring editing out of V1
- Read-only `optimisticEvents` merge is allowed as a future-proof placeholder

## Overview

This design upgrades Home `CalendarPanel` with a config-driven month chip and
peek system while preserving the current page shell and state model.

The design has three goals:

1. make view behavior configurable through one source
2. make month chips denser without changing the outer panel contract
3. fix recurring and cross-day rendering correctness in V1

## Architecture

### Target modules

```text
apps/web/src/views/Home/sections/
  CalendarPanel.tsx
  TodayCalendarView.tsx
  WeekCalendarView.tsx
  MonthCalendarView.tsx
  MonthEventChip.tsx
  MonthEventChip.module.css
  eventKind.ts
  calendarViewConfig/
    index.ts
    types.ts
    errors.ts
    propertyRegistry.ts
    factory.ts
  peek/
    index.ts
    CalendarPeekProvider.tsx
    CalendarPeekCard.tsx
    CalendarPeekHead.tsx
    CalendarPeekProperties.tsx
    CalendarPeekNotes.tsx
    useCalendarPeek.ts
    CalendarPeekCard.module.css
```

### Why `calendarViewConfig` stays in `apps/web`

It is a view-layer contract bound to:

- `PlanEventReadV2`
- `CalendarPanel`
- `eventKindOf`

It is not a generic calendar-engine concern.

## State and Data Flow

```text
useDashboardPreferenceStore
  homeCalendarView
  startWeekOnMonday
  cardLimitPerCell

usePlanStore
  currentView
  currentDate
  optimisticEvents

CalendarPanel
  resolves CalendarViewConfig
  passes config to today/week/month views

MonthEventChip
  renders visibleProperties
  may merge optimisticEvents.get(event.id) as read-only placeholder

Peek provider
  open(event, list)
  close()
  next()
  prev()
```

## CalendarViewConfig

### Types

```ts
type CalendarCardProperty =
  | 'title'
  | 'category'
  | 'kind'
  | 'status'
  | 'source'
  | 'linkedSession'
  | 'target';

type CalendarDensityPreset = 'compact' | 'default' | 'detail';

interface CalendarViewConfig {
  readonly view: 'today' | 'week' | 'month';
  readonly startWeekOnMonday: boolean;
  readonly cardLimitPerCell: number;
  readonly dateField: 'startAt' | 'endAt';
  readonly visibleProperties: readonly CalendarCardProperty[];
}
```

### Factory rules

- `compact`
  - `['title', 'kind']`
- `default`
  - `['title', 'kind', 'status']`
- `detail`
  - `['title', 'kind', 'status', 'category', 'source', 'linkedSession', 'target']`

Default config equals preset `default`.

This resolves the old contradiction permanently.

### Validation

Factory throws:

- `InvalidCalendarViewError`
- `InvalidCalendarLimitError`
- `UnknownCalendarPropertyError`
- `UnknownCalendarPresetError`

No silent fallback.

## View Integration

### CalendarPanel

- keeps current `usePlanStore` view/date ownership
- reads `profileLoaded` from `useDashboardPreferenceStore`
- resolves config from prop or default factory
- persists only:
  - `homeCalendarView`
  - `startWeekOnMonday`
  - `cardLimitPerCell`

It must not add a new hydration hook.

### Today and Week views

- consume `viewConfig`
- integrate `expandRecurringOccurrences(...)`
- keep local-density layout already defined by the page contract

### Month view

- consume `viewConfig`
- replace hardcoded DOW / limit logic with config
- integrate `expandRecurringOccurrences(...)`
- integrate `sliceOccurrenceByDay(...)`
- render `MonthEventChip`

## MonthEventChip

### Visual channels

| Channel | Property |
|---|---|
| border-left + tint | `kind` |
| primary text | `title` |
| secondary text | `category` |
| status dot/mark | `status` |
| icon | `source` |
| link icon | `linkedSession` |
| target badge | `target` |

### Icons

Use `lucide-react` only, such as:

- `Sparkles`
- `Plus`
- `Download`
- `Link2`
- `Target`
- `Repeat`

## Peek Card

### V1 scope

- read-only only
- no mutation wiring
- no inline editing

### Implementation constraints

- portal-mounted central card
- wrap with `<FocusTrap active={open}>`
- body scroll lock while open
- restore focus on close
- keyboard:
  - `Esc` close
  - arrow navigation if a list was provided

### Components

- `CalendarPeekProvider`
- `CalendarPeekCard`
- `CalendarPeekHead`
- `CalendarPeekProperties`
- `CalendarPeekNotes`
- `useCalendarPeek`

## Token Policy

All new visuals must use `tokens.css`.

Allowed new token families:

- `--cal-kind-*`
- `--cal-chip-*`
- `--cal-peek-*`

Disallowed in both design and implementation:

- `--paper-1`
- `--ink-1`
- raw prototype shadow values
- raw prototype scrim values

The visual contract owns exact mapping.

## Error Handling

- invalid config values throw at factory time
- peek `open(event, list)` throws if list is empty
- peek throws if event is not found in list
- missing optional event fields simply hide their visual channel

## Testing Strategy

### Unit

- `factory.test.ts`
- `propertyRegistry.test.ts`
- `MonthCalendarView.test.tsx`
- `MonthEventChip.test.tsx`
- `useCalendarPeek.test.ts`
- `CalendarPeekCard.test.tsx`

### Browser

At minimum:

- `1440` and `1920`
- today / week / month
- Monday-first and Sunday-first
- compact / default / detail
- peek open / next-prev / close

### Validation

- typecheck
- lint
- test
- browser smoke

## Rollout

### W1

- visual contract

### W2

- `calendarViewConfig/`
- tests for config + registry

### W3

- preference-store fields

### W4

- wire `CalendarPanel` and all views through `CalendarViewConfig`

### W4.5

- recurring + cross-day correctness fixes

### W5

- `MonthEventChip`
- calendar chip tokens

### W6

- read-only peek card
- peek tokens

### W7

- visual acceptance hooks
- a11y cleanup

## Non-goals

- drag-to-reschedule
- recurring edit UI
- inline editable peek fields
- aggregate analytics fields in chips

## References

- `docs/plan/sik-138-home-calendar-notion-like-v2-plan.md`
- `docs/vault/04-design/Design-System.md`
- `docs/vault/04-design/Web-Layout.md`
- `docs/vault/04-design/Prototype-Token-Map.md`
- `packages/calendar-engine/src/**`
- `apps/web/src/components/system/FocusTrap`

