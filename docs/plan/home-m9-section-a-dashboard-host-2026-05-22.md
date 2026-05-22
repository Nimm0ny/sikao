---
type: plan
status: active
owner: Codex
created: 2026-05-22
updated: 2026-05-22
issue: SIK-40
---

# Home M9 Section A Dashboard Host

## Goal

Restart `SIK-40 / M9` as an active runtime tranche and land the first real Home UI slice on `main` without pulling `M10-M12` forward.

## Current Reality

1. `M7 / SIK-38` and `M8 / SIK-39` are already complete on `main`.
- Home canonical queries, mutations, stores, and `@sikao/calendar-engine` are available now.
- `M8` still had two small testing gaps that must be closed before `M9` can claim a clean base.

2. The current shell still does not expose a real Home entrypoint.
- `"/"` remains marketing with authed redirect behavior.
- `"/dashboard"` and `"/plan"` currently redirect to `/practice/center`.
- `MvpShell` still renders both "首页" and "计划" links, so leaving those routes dead would break the `M9` runtime tranche immediately.

3. `M11` route-shell convergence is still explicitly out of scope.
- No `"/"` dual-state rewrite in this tranche.
- No 5-tab cleanup, no `/profile/learning`, no `/profile/records`, no legacy route family rename in this tranche.

## Locked Scope For This Tranche

1. Included
- `M8.5`: close the remaining `usePlanStore` and `useDashboardPreferenceStore` test gaps with the smallest possible store change.
- `M9 / SIK-40`: Section A runtime only.
- Minimal router exception:
  - `"/dashboard"` becomes the temporary Section A host.
  - `"/plan"` becomes an alias/redirect to the same host.

2. Explicitly excluded
- No `"/"` logged-in Home shell.
- No 5-tab or `/me` cleanup beyond avoiding dead links for `"/dashboard"` and `"/plan"`.
- No Section B/C.
- No `/profile/learning` or `/profile/records`.
- No backend contract expansion.

## Contract Decisions

1. Data/runtime sources
- Section A consumes only existing Home canonical modules:
  - `@sikao/api-client`
  - `@sikao/domain`
  - `@sikao/calendar-engine`
- No legacy query modules are reintroduced.

2. Dashboard preference persistence
- `profileLoaded=true` still writes through the canonical `PUT /api/v2/profile/info`.
- Debounced persistence must no longer depend on unhandled timer rejection behavior.
- Failure must leave `isPersisting=false` and must not fake-update `lastPersistedAt`.

3. Section A behavior baseline
- Today / Week / Month all render from canonical Home runtime data.
- Event create / edit / delete / restore / bulk reset / recurring scope / conflict warning all stay inside the Section A host.
- AI plan generate / regenerate-range / pending adjustment accept/reject stay inside the Section A host.
- Drag, resize, cross-day handling, and keyboard-equivalent interaction are required in this tranche.

## Validation

- Required local validation:
  - `npm.cmd run typecheck`
  - `npm.cmd run lint`
  - `npm.cmd run test --workspaces --if-present`
  - `npm.cmd run build -w @sikao/web`
- Required acceptance gate:
  - independent review
  - frontend spec review
  - browser smoke with real interaction evidence

## Known Gate Conflict

- Repo-local `AGENTS-H5` requires independent review and browser evidence for this frontend visual tranche.
- Current session can implement and locally validate, but cannot claim final completion unless those gates are explicitly satisfied in-session.
