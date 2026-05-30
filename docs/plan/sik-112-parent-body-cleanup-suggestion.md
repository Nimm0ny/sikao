---
type: plan
status: draft
owner: lhr
last-reviewed: 2026-05-30
notion-issue-url: https://www.notion.so/36dbc174f6c8818689d8c28f01015a57
---

# SIK-112 Parent Body Cleanup Suggestion

## Goal
Keep the current top-level closeout note as the authority, but make the historical body below easier to read in future review and post-mortem work.

## Recommended cleanup pass
1. Keep `Parent Closeout Note — 2026-05-30` at the very top unchanged.
2. Insert a short divider line before the old body:
   `## Historical Archive`
   `> The sections below are preserved for audit history. They are not the current source of truth.`
3. In the old body, do **not** rewrite implementation history. Only normalize obviously stale parent-level wording.

## Safe wording replacements
- Old `Summary` block:
  Add one line at top:
  `> Historical summary only. Current live Home reality is defined by the parent closeout note above.`
- Old `Scope（编排）` block:
  Add one line at top:
  `> Historical child planning snapshot. For actual final issue matrix, use the parent closeout note above.`
- Old `Wave-2 Finetune` block:
  Keep as archive, but prepend:
  `> Historical intermediate ledger. Final status is no longer read from this section.`
- Old `Acceptance（父 issue 收口）` block:
  Rename to `## Historical Acceptance Snapshot`
  Add one line:
  `> Superseded by the final parent acceptance in the top closeout note.`

## Content that should stay historical, not patched inline
- `5-tab Rail + BottomTabBar`
- `today / week / month`
- `countdown chip`
- early `SIK-90~93`-only framing
- any wording that predates `SIK-121 cancelled` and `SIK-138~142 done`

## Content that should only live in the top authority note
- final issue matrix
- current nav baseline = 4 tabs
- `Me` via Rail avatar
- calendar = `week | month`
- countdown removed
- parent closeout decision and `Done` rationale

## Suggested trigger for doing this cleanup
Only do the body cleanup if one of these is true:
- a retrospective explicitly needs a cleaner parent page
- a reviewer reports repeated confusion caused by the archived body
- another parent issue is being standardized and `SIK-112` is used as the template

## Non-goal
Do not reopen `SIK-112` status for this cleanup alone.
