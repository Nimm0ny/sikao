# Scope

- Mode: `Reviewer Mode`
- Review target: current worktree changes for the issue titled `[Tab1 Home] SIK-138 per-wave review-report debt (W2/W4/W4.5/W5/W6)`
- Files reviewed:
  - `apps/web/src/views/Home/sections/calendarViewConfig/factory.test.ts`
  - `apps/web/src/views/Home/sections/CalendarPanel.test.tsx`
  - `apps/web/src/views/Home/sections/MonthCalendarView.tsx`
  - `apps/web/src/views/Home/sections/WeekCalendarView.tsx`
  - `apps/web/src/views/Home/sections/MonthCalendarView.test.tsx`
  - `apps/web/src/views/Home/sections/WeekCalendarView.test.tsx`
  - `docs/reviews/sik-138-w2.md`
  - `docs/reviews/sik-138-w4.md`
  - `docs/reviews/sik-138-w4.5.md`
  - `docs/reviews/sik-138-w5.md`
  - `docs/reviews/sik-138-w6.md`
- Review focus:
  - whether live residuals found during retrospective review were truly closed on current `main`
  - whether the retrospective reports preserve enough evidence to support debt closure
  - whether any new blocker was introduced by the regression tests or report edits

# Findings

- No blocking findings.

1. `Low` W4 write-path evidence is behavior-level rather than helper-call-level.
   Evidence:
   - `CalendarPanel.test.tsx:79-93` proves that clicking the second tab changes `currentView` and persists `patchPreferences({ homeCalendarView: 'month' })`.
   - `docs/reviews/sik-138-w4.md` now describes this as locking the persisted payload path rather than overclaiming direct helper invocation evidence.
   Impact:
   - The seam is sufficiently covered for behavior closure.
   - Remaining nuance is documentation precision, not a runtime gap.

# Suggested Actions

- Keep the W4 report wording at the behavior level (`persisted payload path`), unless a future cleanup intentionally adds helper-call spies.
- No additional runtime or documentation action is required before closing this debt issue.

# Risk Level

- `Low`
- Reason:
  - W2 typed-error residual is fully closed by structured assertions.
  - W4 Sunday-first window mismatch is covered by current runtime code and explicit query-window tests.
  - W4.5 zero-projection empty-state residual is covered by current runtime code and explicit empty-state tests.
  - Retrospective reports now include concrete evidence anchors instead of narrative-only summaries.

# Decision

`review pass`

`No blocking findings`
