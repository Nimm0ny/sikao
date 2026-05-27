# SIK-128 Merge-Main Review - W1

> Reviewer mode: independent subagent review + local integration follow-up.
> Source authority: merge diff, conflict resolution, validation logs, browser smoke evidence.

## Evidence Block

- Independent review type: subagent
- Review report: `docs/reviews/sik-128-merge-main-w1.md`
- Merge target: `main`
- Integration branch: `codex/sik-128-merge-main`
- Unknowns: branch name and issue name are not the same as the delivered code scope

## Scope

- merge `feat/sik-128-workspace-dashboard-cap` into `main`
- conflict resolution in `apps/web/package.json`
- conflict resolution in `apps/web/src/components/layout/BurgerDrawer/BurgerDrawer.module.css`
- follow-up type fix in `apps/web/src/components/form/Button/Button.tsx`
- DEV smoke fix in `apps/web/src/mocks/handlers/home.ts`
- flaky test stabilization in `apps/web/src/views/ProfileLearning/ProfileLearning.test.tsx`

## Acceptance Mapping

| # | Acceptance | Evidence | Verdict |
|---|---|---|---|
| A1 | merge conflicts are fully resolved | `git ls-files -u` empty; `git diff --check` clean | PASS |
| A2 | nav baseline remains 4-tab | `RootLayout.tsx` still uses `[home, practice, review, note]`; browser smoke from `/` -> `/review` works | PASS |
| A3 | integration keeps both script gates | `apps/web/package.json` keeps `lint-query-key-uniqueness.mjs` and `lint-screen-lock.mjs` | PASS |
| A4 | post-merge code validates | `npm run typecheck`, `npm run lint`, `npm run test` all PASS on `codex/sik-128-merge-main` | PASS |
| A5 | rendered smoke passes on key routes | Home, Review, and ProfileRecords validated at `http://127.0.0.1:18080`; screenshots captured and interaction verified | PASS |
| A6 | local DEV smoke no longer throws weekly progress 502 | `apps/web/src/mocks/handlers/home.ts` now serves `/api/v2/progress/weekly`; Playwright console log is clean | PASS |
| A7 | branch naming does not overclaim completion of Route B workspace-cap work | subagent review + local diff confirm Route B files are not part of the committed branch history; related local WIP remains in stash | NOTE |

## Findings

1. No merge blocker remains after conflict resolution and follow-up fixes.
2. The branch content is merge-ready as a visual/home-profile integration wave.
3. This merge should not be described as "SIK-128 Route B complete". That workspace-cap implementation and its define-first artifacts are not in the branch commit history and remain outside this merge scope.

## Risk Level

**MEDIUM**

Reason:
- code and browser gates passed
- residual risk is scope drift, not a confirmed runtime defect

## Conclusion

**PASS for merge-to-main scope**

Condition:
- final delivery must explicitly state that preserved local stash content still contains separate unmerged WIP, including the Route B workspace-cap line of work
