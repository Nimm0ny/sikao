# SIK-128 Requirements

> Route A requirements for the shared desktop workspace canvas. This spec exists because the 2026-05-27 decision log explicitly said "Start with Requirements" but the spec folder was missing.

## 0. Context

- On `2026-05-27 16:16` Asia/Shanghai, lhr chose **Route A** for SIK-128.
- The bug is a **shared workspace default** conflict, not eight separate per-view layout bugs.
- The affected routes are:
  - `/`
  - `/practice`
  - `/review`
  - `/note`
  - `/me`
  - `/profile/learning`
  - `/profile/records`
  - `/question-hub`

## 1. Functional Requirements

### REQ-1 Workspace default shall stop capping dashboard entry views

When any of the eight entry routes render inside `RootLayout` with `Workspace maxWidth="workspace"`, the system shall allow the workspace to consume the full width remaining after Rail, rather than capping at `1440px`.

### REQ-2 Reading/Form caps shall stay explicit

When a surface needs narrow reading or form ergonomics, it shall use an explicit `reading`, `form`, or `prose` contract. It shall not rely on `workspace` to provide a hidden `1440px` default cap.

### REQ-3 Shared implementation shall remain centralized

When Route A is implemented, the change shall be centralized in shared workspace/token infrastructure. The system shall not add eight page-local hacks just to defeat the cap one route at a time.

### REQ-4 Design docs shall reflect Route A truth

When the implementation lands, every active SSOT document that currently claims `workspace = 1440px cap` shall be updated to Route A truth, including:

- `packages/design-system/src/tokens.css`
- `docs/vault/04-design/Design-System.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/00-Decisions.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/02-Token-System.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/03-Components.md`

### REQ-5 Visual-contract workflow shall detect SSOT conflicts

When a visual/front-end issue hits H11, the workflow shall require a dedicated `SSOT Conflicts` section that compares prototype CSS/default behavior against current token/system defaults, declares the chosen authority, and records the lhr decision date.

### REQ-6 Visual verification shall prove both 1440 and 1920 desktop behavior

When a visual issue touches desktop layout, acceptance shall require dual-open verification at both `1440` and `1920` desktop widths. Verifying only `1440` shall be treated as incomplete.

### REQ-7 Existing active contracts shall be backfilled

When older active contracts predate the SIK-128 incident, they shall be annotated with the new SSOT-conflict requirement and the `1920` desktop acceptance amendment so reviewers do not read them as complete authority for horizontal canvas behavior.

### REQ-8 Nav baseline shall remain locked

When SIK-128 lands, it shall not change the global nav baseline:

- `navItems` stay `[home, practice, review, note]`
- Me entry stays in RailMe only
- `tabBarItems` stay aligned with `navItems`

### REQ-9 Validation shall include rendered proof

When SIK-128 is delivered, validation shall include:

- `typecheck`
- `lint`
- `tests`
- desktop browser smoke
- screenshot archive for the eight entry routes at `1440` and `1920`

## 2. Non-Requirements

- This spec does **not** redesign the eight entry views' vertical grids.
- This spec does **not** introduce Route B's `dashboard` workspace variant taxonomy.
- This spec does **not** re-evaluate `--max-w-reading`, `--max-w-form`, or `--max-w-prose`.
- This spec does **not** change Mobile/Tablet layout policy.
- This spec does **not** fix every downstream Reading/Form route in the same wave.

## 3. Acceptance Summary

SIK-128 is only ready for `done` when all of the following are true:

1. The Route A visual contract exists and is referenced by the issue acceptance block.
2. Shared workspace/token/docs all reflect Route A truth.
3. H11 workflow and active legacy contracts are backfilled with `SSOT Conflicts` + `1920` desktop verification.
4. The eight entry routes are smoke-tested at `1440` and `1920`.
5. Review/validation gates are satisfied, or the issue stays `in_progress` / `blocked` with explicit evidence.
