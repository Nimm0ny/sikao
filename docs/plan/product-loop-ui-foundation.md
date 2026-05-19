---
type: engineering-plan
status: proposed
owner: lhr
created: 2026-05-18
updated: 2026-05-19
repo: Nimm0ny/sikao
execution_agent: Codex
issue: SIK-12
---

# SIKAO Product Loop UI Foundation Plan

## 2026-05-19 Revision

This plan is revised after the new `AGENTS.md` rule: thorough delivery over shortcut delivery.

The old split that created unused `apps/web/src/components/app/*` first is rejected. UI foundation work must affect a real user-visible surface in the same implementation slice. New app-level composition components are only allowed when a consuming page is changed in the same slice and the page covers loading, empty, error, auth, and default states.

## Goal

Turn the current function-entry experience into a learning loop:

```text
Dashboard
-> recommended practice
-> practice session
-> result diagnosis
-> wrong-book review
-> note capture
-> weekly plan adjustment
-> progress feedback
-> next practice
```

The UI foundation is not a component shelf. It is the visible shell, shared page primitives, and page-level state matrix that lets the loop read as one product.

## Current Findings

- `apps/web/src/components/mvp/index.tsx` is the visible shell layer used by Dashboard, PracticeCenter, PracticeStart, Result, and AppShell.
- The former `components/app` draft had no consumers and is removed from the active implementation scope.
- Route paths are frozen during this issue. Route changes require a separate contract review because redirects and query preservation already exist.
- The immediate visible defect is hardcoded color/radius/type styling in `Mvp*`, not a missing abstract component directory.

## Non-Negotiable Rules

- No unused UI component directories.
- No standalone component delivery for product-loop work.
- No new route strings without a RouteMap contract.
- No hardcoded hex, default Tailwind radius, arbitrary shadow, arbitrary tracking, or arbitrary type size in touched UI foundation code.
- No silent fallback and no mocked business completion.
- Every implementation slice must include automated validation and browser evidence, or it remains in progress.

## Component Boundary

```text
packages/ui
  Primitive UI: Button / Card / Chip / Tabs / Select / Modal / Toast / EmptyState

apps/web/src/components/mvp
  Current visible compatibility layer used by live pages. It must be token-compliant now.

apps/web/src/components/app
  Product-loop composition components. Add only with the first real consuming page.

apps/web/src/views/*
  Data loading, auth/error/empty/default states, and product-loop decisions.
```

## Token Contract

Use the existing Tailwind token classes:

| Role | Class family |
| --- | --- |
| Primary action | `bg-accent hover:bg-accent-2 text-white` |
| Active/current state | `bg-accent-50 text-accent` |
| Text | `text-ink` / `text-ink-2` / `text-ink-3` / `text-ink-4` |
| Surface | `bg-paper` / `bg-paper-2` |
| Border | `border-line` / `border-line-1` / `border-line-2` / `border-line-3` |
| Radius | `rounded-tiny` / `rounded-card` / `rounded-card-lg` / `rounded-pill` |
| Shadow | `shadow-card` / `shadow-pop` |
| Tracking | `tracking-eyebrow` / `tracking-wide` / `tracking-wider` / `tracking-widest` |
| Type | `text-display` / `text-h1` / `text-h2` / `text-h3` / `text-body` / `text-small` / `text-meta` / `text-tiny` |

Rejected in touched foundation code:

```text
rounded-lg
rounded-xl
rounded-full
shadow-[...]
tracking-[...]
text-[...]
bg-[#...]
text-[#...]
border-[#...]
```

## Implementation Slices

| Slice | Scope | User-visible acceptance |
| --- | --- | --- |
| 0 | Plan and inventories | Route, hardcode, breadcrumb, and Mvp usage baseline exists. |
| 1 | `apps/web/src/components/mvp/index.tsx` plus removal of unused `components/app` draft | AppShell, Dashboard, PracticeCenter, PracticeStart, and Result consume token-compliant shell/card/button/chip/progress styles without caller API changes. |
| 2 | Dashboard loop | Dashboard has one primary next action, visible loop stage, loading/default/empty/error/auth handling, and Browser evidence. |
| 3 | PracticeCenter loop | PracticeCenter shows recommendation, subject state, filters, recent/empty states, and clear next action. |
| 4 | Result loop | Result routes users to wrong-book review, note capture, or next practice with wrong/all-correct/error states. |
| 5 | WrongBook loop | WrongBook becomes review center with smart review, batch redo, graduation, empty, and filtered states. |
| 6 | Notes / Plan / Progress | Notes, weekly plan, and progress close the second half of the loop with source context and next action. |
| 7 | Auth / Profile visual consistency | Non-loop pages follow blue-white tokens without competing with the study flow. |
| 8 | RouteMap and redirect tests | Typed route builders and redirect/query-preserve tests land after visible loop behavior is stable. |
| 9 | Lint guards and breadcrumb cleanup | Guard scripts prevent new drift in hardcode, radius, ui-copy, icon, and breadcrumb rules. |

## Slice 2 Acceptance

Slice 2 covers the Dashboard learning loop. It is not complete until all checks below pass:

```bash
npm.cmd run test -w @sikao/web -- src/views/__tests__/Dashboard.test.tsx
npm.cmd run typecheck -w @sikao/web
npm.cmd run lint -w @sikao/web
npm.cmd run build -w @sikao/web
```

Browser evidence must cover:

```text
Auth strategy: real login / seeded API / explicit visual mock
Data strategy: real seed / fixture-backed local API for default and empty states
Desktop: /dashboard default state with loop stage and one primary next action
Desktop: /dashboard auth fallback or real authenticated page behavior
Mobile: /dashboard responsive shell with no overlapping loop/action cards
```

The Dashboard implementation slice must touch a real consuming page and its state matrix in the same change. New Dashboard composition components are accepted only because `apps/web/src/views/Dashboard.tsx` consumes them directly in this slice.

If Browser MCP is unavailable, the issue must stay `in_progress` and the Evidence Block must say so. A `/login` screenshot alone never proves Dashboard product-loop UI.

## Evidence Block Template

```text
Mode:
Multica issue:
Changed files:
Requirement source:
Plan doc:
Implementation summary:
Tests run:
Lint:
Typecheck:
Build:
Browser smoke:
Subagent review:
Security review:
Known gaps:
Rollback notes:
Next owner:
```

## PR0 Audit Outputs

- Route inventory: `docs/audit/current-route-inventory.md`
- UI hardcode inventory: `docs/audit/current-ui-hardcode-inventory.md`
- Breadcrumb comment inventory: `docs/audit/current-breadcrumb-comment-inventory.md`
- Mvp usage inventory: `docs/audit/current-mvp-usage-inventory.md`
