# Current UI Hardcode Inventory

Issue: SIK-12
Updated: 2026-05-19
Scope: inventory plus current visible-surface remediation notes.

## Rule

This inventory is not permission to defer touched code. Any file modified by SIK-12 must remove hardcoded hex, default Tailwind radius, arbitrary shadow, arbitrary tracking, and arbitrary type size in the touched foundation surface.

## Current Slice Status

`apps/web/src/components/mvp/index.tsx` is the visible foundation layer consumed by AppShell, Dashboard, PracticeCenter, PracticeStart, and Result. Slice 1 removed the previous hardcoded shell/card/button/chip/progress classes from that file instead of creating unused `components/app` wrappers.

Slice 2 moves Dashboard loop cards into live Dashboard-owned components and consumes them from `apps/web/src/views/Dashboard.tsx` in the same change. The slice covers default, loading, empty, error, and auth states.

`apps/web/src/components/app/*` is not an accepted standalone target. Add it only when a real page consumes the new composition components in the same implementation slice.

## Audit Command

```bash
rg "bg-\[|text-\[|border-\[|shadow-\[|tracking-\[|text-\[[^\]]+\]|rounded-lg|rounded-xl|rounded-full|#[0-9A-Fa-f]{3,8}" apps/web/src/components/mvp/index.tsx apps/web/src/views/Dashboard.tsx apps/web/src/components/dashboard/DashboardCardState.tsx apps/web/src/components/dashboard/DashboardLoopCards.tsx apps/web/src/components/dashboard/DashboardLoopStageCard.tsx apps/web/src/views/PracticeCenter.tsx apps/web/src/views/Result.tsx
```

## Known Remaining Surfaces

| Surface | Status | Handling |
| --- | --- | --- |
| `apps/web/src/components/mvp/index.tsx` | Slice 1 remediated | Keep token-compliant while consumers migrate. |
| `apps/web/src/views/Dashboard.tsx` | Slice 2 remediated | Chrome evidence still required before closing slice. |
| `apps/web/src/components/dashboard/DashboardCardState.tsx` | Slice 2 remediated | Shared Dashboard loading/error/empty state rendering. |
| `apps/web/src/components/dashboard/DashboardLoopCards.tsx` | Slice 2 remediated | Dashboard loop cards and state matrix. |
| `apps/web/src/components/dashboard/DashboardLoopStageCard.tsx` | Slice 2 remediated | Visible product-loop stage strip. |
| `apps/web/src/views/PracticeCenter.tsx` | Product-loop slice | Refactor with recommendation, filters, active subject, empty states. |
| `apps/web/src/views/Result.tsx` | Product-loop slice | Refactor with diagnosis, wrong-book/note/next-practice actions. |
| `apps/web/src/views/WrongBook.tsx` | Product-loop slice | Refactor as review center with filtered and empty states. |

## Acceptance

- Touched visible foundation code has no hardcoded hex.
- Touched visible foundation code has no `rounded-lg`, `rounded-xl`, or `rounded-full`.
- Touched visible foundation code has no arbitrary `shadow-*`, `tracking-*`, or `text-*` class.
- Automated checks and browser smoke are recorded in Multica evidence.
