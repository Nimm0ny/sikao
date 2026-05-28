---
type: feature
status: planned
owner: lhr
last-reviewed: 2026-05-28
notion-issue-url: https://www.notion.so/36ebc174f6c88187840ac2623a1666f7
notion-issue-identifier: SIK-138
spec: .kiro/specs/sik-138-home-calendar-v2/
visual-contract: docs/plan/sik-138-home-calendar-notion-like-visual-contract.md
supersedes: docs/plan/sik-home-calendar-notion-like-plan.md
supersedes-issue: SIK-137
---

# Home Calendar Notion-Like V2 Plan

## 1. Why V2 Exists

SIK-137 was replaced because the earlier draft diverged from repository
reality in four places:

1. it planned a custom `peekFocusTrap.ts` even though `FocusTrap` already
   exists
2. it planned inline SVG icons even though `lucide-react` is already the live
   icon dependency
3. it missed `expandRecurringOccurrences(...)` and
   `sliceOccurrenceByDay(...)`, which are required for correctness
4. it introduced a new hydration-guard concept instead of reusing
   `profileLoaded`

V2 corrects those assumptions before Runner starts.

## 2. Current Authority

- requirements:
  - `.kiro/specs/sik-138-home-calendar-v2/requirements.md`
- design:
  - `.kiro/specs/sik-138-home-calendar-v2/design.md`
- this file:
  - execution slicing only

## 3. Scope

V1 delivery in this plan includes:

- ViewConfig extraction
- configurable month chip fields
- recurring and cross-day rendering correctness
- read-only central peek card

Still out of scope:

- drag-to-reschedule
- recurrence editing
- inline field editing in peek
- aggregate analytics fields inside calendar chips

## 4. Locked Decisions

- `D14`
  - reuse `FocusTrap`
- `D15`
  - production icons use `lucide-react`
- `D16`
  - all three views integrate `expandRecurringOccurrences(...)`
- `D17`
  - month view integrates `sliceOccurrenceByDay(...)`
- `D18`
  - reuse `profileLoaded`
- `D19`
  - only leave dnd placeholders; no `DndContext` in V1
- `D20`
  - `optimisticEvents` may be read-only merged as a placeholder, but V1 adds
    no new write behavior

## 5. Wave Plan

### W1

- land `docs/plan/sik-138-home-calendar-notion-like-visual-contract.md`
- must complete H11 before Runner starts

### W2

- add `calendarViewConfig/`
- add config/registry tests

### W3

- extend dashboard preference fields:
  - `startWeekOnMonday`
  - `cardLimitPerCell`

### W4

- wire `CalendarPanel` and all three views through `CalendarViewConfig`

### W4.5

- integrate recurring expansion and cross-day slicing
- add fixtures/tests for both

### W5

- introduce `MonthEventChip`
- add chip token families

### W6

- add read-only peek card
- add peek token families

### W7

- a11y cleanup
- browser acceptance at `1440` and `1920`
- acceptance-hook closeout

## 6. Commit Slicing

All implementation commits must satisfy:

- `<= 15` files
- `<= 400` net lines
- no mixing spec/plan/impl/test in one commit unless the batch is
  unavoidably tiny and still coherent

Suggested slices:

1. visual contract
2. `calendarViewConfig/` implementation
3. config/registry tests
4. preference-store extension
5. panel/view wiring
6. recurring/cross-day correctness
7. recurring/cross-day tests
8. chip tokens
9. `MonthEventChip`
10. peek tokens
11. peek provider/card
12. peek tests
13. acceptance docs

## 7. Review Gate

Independent review is required for any wave that crosses the repo thresholds
or touches stable boundaries. At minimum:

- config module wave
- panel/view wiring wave
- recurring/cross-day wave
- chip wave
- peek wave

Visual waves also require browser-based acceptance against the visual
contract.

## 8. Validation Gate

Before claiming implementation complete:

- typecheck
- lint
- tests
- browser smoke at `1440` and `1920`

If a wave is docs-only, scoped validation is acceptable, but the final
implementation wave must still satisfy the full validation gate.

## 9. Risks

- recurring events may silently disappear if `expandRecurringOccurrences(...)`
  is skipped
- cross-day events may only render on the start date if
  `sliceOccurrenceByDay(...)` is skipped
- chip channel encoding may drift if the visual contract does not lock token
  mapping
- peek can easily violate a11y if it does not reuse `FocusTrap`

## 10. Rollback

Each wave must stay independently revertable.

- config module can revert without touching store schema
- W4.5 revert returns to the previous incorrect rendering behavior, so treat
  it as a correctness rollback, not just a feature rollback
- peek revert removes the dialog while preserving calendar views

## 11. Next Owner

- Master:
  - visual contract
  - issue/ledger alignment
  - wave sequencing
- Runner:
  - implementation waves
- Verifier:
  - final browser acceptance and evidence

