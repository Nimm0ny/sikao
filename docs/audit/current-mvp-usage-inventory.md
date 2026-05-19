# Current Mvp Usage Inventory

Issue: SIK-12
Updated: 2026-05-19
Scope: usage inventory plus visible-surface remediation notes.

## Exported Surface

Source: `apps/web/src/components/mvp/index.tsx`

| Export | Kind | Current requirement |
| --- | --- | --- |
| `MvpCard` | component | Token-compliant card shell used by live pages. |
| `MvpButton` | component | Token-compliant primary/secondary/ghost button API. |
| `MvpIconButton` | component | Token-compliant icon button with required `aria-label`. |
| `MvpChip` | component | Token-compliant semantic tones. |
| `MvpActionCard` | component | Token-compliant action card using existing `MvpCard` and `MvpButton`. |
| `MvpProgressRing` | component | CSS variable based progress ring; no hex colors. |
| `MvpFilterPanel` | component | Token-compliant card wrapper, API unchanged. |
| `MvpPage` | component | Token-compliant page container and heading block. |
| `MvpShell` | component | Token-compliant desktop/mobile navigation shell. |

## Live Consumers

| File | Usage |
| --- | --- |
| `apps/web/src/layouts/AppShell.tsx` | `MvpShell` |
| `apps/web/src/views/Dashboard.tsx` | `MvpActionCard`, `MvpButton`, `MvpCard`, `MvpPage` |
| `apps/web/src/components/dashboard/DashboardCardState.tsx` | Dashboard state renderer used by `DashboardLoopCards`. |
| `apps/web/src/components/dashboard/DashboardLoopCards.tsx` | `MvpButton`, `MvpCard`, `MvpChip`, `MvpIconButton`, `MvpProgressRing` consumed by live Dashboard. |
| `apps/web/src/components/dashboard/DashboardLoopStageCard.tsx` | `MvpCard` consumed by live Dashboard. |
| `apps/web/src/views/PracticeCenter.tsx` | `MvpButton`, `MvpCard`, `MvpChip`, `MvpFilterPanel`, `MvpPage` |
| `apps/web/src/views/PracticeStart.tsx` | `MvpButton`, `MvpCard`, `MvpChip`, `MvpPage` |
| `apps/web/src/views/Result.tsx` | `MvpActionCard`, `MvpButton`, `MvpCard`, `MvpChip`, `MvpPage`, `MvpProgressRing` |

## Current Slice Requirement

Slice 1 keeps all exported names and props stable while removing the old visual hardcode from the visible compatibility layer. Slice 2 adds Dashboard-owned composition components only with the live Dashboard consumer in the same change.

No `components/app` composition component is allowed without a live page consumer in the same implementation slice.

## Browser Strategy

```text
Auth strategy:
Data strategy:
Desktop assertion:
Mobile assertion:
Screenshot path:
```

The authenticated page check must prove the shell and active navigation behavior. A redirected `/login` page is only useful as auth evidence, not as product-loop UI evidence.
