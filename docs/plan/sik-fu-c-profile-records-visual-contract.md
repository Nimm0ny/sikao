---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-28
issue: SIK-FU-C
multica-issue: SIK-93
parent-multica-issue: SIK-112
parent-issues: SIK-93
prototype:
  - .tmp_review/out/Tab5-Profile/Profile Records v1.html
---

# SIK-FU-C · ProfileRecords Visual Contract (H11)

## 0. Scope

- Fix target: `apps/web/src/views/ProfileRecords/**`
- Out of scope:
  - global nav baseline changes
  - Workspace horizontal canvas owner changes
- Current nav baseline source of truth:
  - `4-tab + RailMe`
  - owned by `docs/plan/sik-rail-v5-visual-contract.md` and `SIK-128`
- Owner:
  - this contract only owns ProfileRecords timeline / filter / density / footer

## 1. Layout Topology

- Root shell:
  - `ScreenLockShell rows="auto auto auto minmax(0, 1fr)"`
- Row 1:
  - `PageHeader`
- Row 2:
  - shared `SubNav`
- Row 3:
  - `FilterBar`
- Row 4:
  - `RecordsWrap`
  - internal flex column
  - `records-body` scrolls locally
  - `records-foot` stays pinned at bottom

## 2. Required Interactive Elements

### 2.1 Header and sub-nav

- export icon button
  - disabled placeholder allowed
- shared sub-nav
  - active item must be `records`

### 2.2 Filter bar

- kind segment pills
  - all / practice / mock / review / note
- date range picker surface
  - placeholder or disabled state allowed when not implemented
- summary text
  - driven by query result count
- milestone-only control
  - placeholder or disabled state allowed when not implemented

### 2.3 Timeline rows

- sticky day head
  - date
  - weekday
  - right-aligned summary
- event row
  - time
  - colored icon cell by kind
  - title + subtitle + stats
  - hover or always-visible actions depending on pointer mode

### 2.4 Footer

- summary text
- `load earlier` button

## 3. Information Density

- day head:
  - date + week + summary
- event row:
  - time + icon + content + actions
- content block:
  - title
  - subtitle
  - compact stats strip
- states:
  - loading
  - empty
  - error
  - ready

## 4. Token Map

| Prototype token | V5 token |
|---|---|
| `--paper-1` | `--color-bg-surface` |
| `--paper-2 / --paper-3` | `--color-bg-elevated / --color-bg-sunken` |
| `--ok / --ok-50` | `--color-state-ok / --color-state-ok-soft` |
| `--warn / --warn-50` | `--color-state-warn / --color-state-warn-soft` |
| `--err / --err-50` | `--color-state-err / --color-state-err-soft` |
| `--info / --info-50` | `--color-state-info / --color-state-info-soft` |
| `--brand-yellow / --brand-yellow-soft` | `--color-brand-primary / --color-brand-soft` |
| `--r-card / --r-tiny` | `--card-radius / --radius-10` |
| `height: 100vh + overflow: hidden` | `ScreenLockShell` |

## 4.1 SSOT Conflicts

| Conflict | Prototype authority | System authority | Current ruling |
|---|---|---|---|
| Workspace horizontal canvas default | profile prototype uses full Rail-remaining width | old V5 `workspace=1440 cap` default | owned by `SIK-128`; this contract does not redefine workspace width |
| Desktop acceptance viewport | older contract centered on `1440` | post-`SIK-128` desktop requires `1440 + 1920` | this contract follows `1440 + 1920` |
| Rail baseline | older documents still mention `5-tab` | current runtime is `4-tab + RailMe` | this contract follows `4-tab + RailMe` only |

## 5. Visual Drift from Prototype

| Item | Prototype | Current implementation | Reason | Approved |
|---|---|---|---|---|
| Rail grouping reference | older profile docs still carry `5-tab` language | contract follows `4-tab + RailMe` | global nav baseline already superseded by `sik-rail-v5` + `SIK-128` | 2026-05-28 |
| `load earlier` vs generic pagination | prototype uses timeline-native `load earlier` affordance | implementation keeps timeline-native load-more wording | better timeline fit than generic pager chrome | 2026-05-25 |
| export / milestone-only controls | prototype clickable | implementation may use disabled placeholder | business flow not fully landed in this wave | 2026-05-25 |
| hover actions on touch | prototype hover-only | touch mode may keep actions visible | touch accessibility | no drift |

## 6. Acceptance Hooks

| # | Hook | Prototype ref | Implementation ref | Status |
|---|---|---|---|---|
| C1 | 4-row shell + local records scroll | prototype shell | `ProfileRecords.tsx` + `ScreenLockShell` | PASS |
| C2 | shared sub-nav active=`records` | prototype sub-nav | shared `Me/SubNav.tsx` | PASS |
| C3 | filter bar density and controls | prototype filter row | `FilterBar.tsx` | PASS |
| C4 | sticky day head | prototype timeline | `DayGroup.tsx` | PASS |
| C5 | 4-column event row structure | prototype event row | `RecordRow.tsx` | PASS |
| C6 | footer summary + load earlier CTA | prototype foot | `RecordsFoot.tsx` | PASS |
| C7 | badge/icon kind mapping | prototype tinting | `RecordRow.tsx` token mapping | PASS |
| C8 | screen lock + local scroll | prototype shell behavior | browser smoke + contract screenshots | PASS |

Chrome MCP screenshot archive:
- `.tmp_review/visual-diff/sik-fu-c/`
- desktop requires:
  - `prototype-desktop-1440x900.png`
  - `implementation-desktop-1440x900.png`
  - `prototype-desktop-1920x1080.png`
  - `implementation-desktop-1920x1080.png`

## 7. Wave Plan

- Wave 1:
  - shell / timeline / footer alignment
- Wave 2:
  - sticky head / kind tint / density closeout
- Wave 3:
  - optional milestone-only and date controls if business flow lands

## 8. References

- `docs/plan/sik-rail-v5-visual-contract.md`
- `docs/plan/sik-128-workspace-dashboard-visual-contract.md`
- `docs/vault/04-design/Web-Layout.md`
- `.tmp_review/out/Tab5-Profile/Profile Records v1.html`
