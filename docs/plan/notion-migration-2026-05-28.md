---
type: plan
status: archived
owner: lhr
last-reviewed: 2026-05-28
notion-issue-url: none
---

# Multica to Notion Migration Note (2026-05-28)

> This file is no longer an active execution plan.
> It records the 2026-05-28 ledger migration baseline after the core cutover
> landed in the repository.

## Current Truth

- Notion is now the project ledger SSOT.
- Active workflow authority:
  - `docs/engineering/notion-workflow.md`
- Historical workflow authority:
  - `docs/engineering/multica-workflow.md`
  - archived only, not for active execution
- Local anchor file:
  - `.notion/anchors.json`
  - gitignored, like the old `.multica/`

## What Already Landed

- `docs/engineering/notion-workflow.md`
  - active
- `docs/engineering/multica-workflow.md`
  - archived + deprecated banner
- `.gitignore`
  - now ignores `.notion/`
- root/runtime docs
  - runtime-truth and historical-ledger wording updated where this batch
    explicitly touched them

## Execution Rule

If any follow-up migration work is still needed:

1. Create or locate the Notion issue first.
2. Run intake and status flow through `docs/engineering/notion-workflow.md`.
3. Treat this file as historical context only.

This file must not instruct readers to wait until "everything is done" before
creating a Notion issue. That would conflict with the current Notion SSOT
workflow.

## Remaining Follow-up (Not Included In Core Cutover)

- Rename more historical "Multica" mentions in archived Vault plans/README
  only when those files are intentionally reopened.
- Update any remaining historical field wording such as
  "multica identifier" to neutral issue-ledger wording in a later cleanup.
- Keep `.multica/` ignored locally until historical tooling references are no
  longer needed.

## Commit Status

- Core cutover is already landed.
- This note is archived so future readers do not mistake it for a pending plan.

