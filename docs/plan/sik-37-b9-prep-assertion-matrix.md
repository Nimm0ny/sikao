---
type: plan
status: accepted
owner: codex
last-reviewed: 2026-05-22
source: subagent-prep
---

# SIK-37 B9-Prep Assertion Matrix

## Purpose
- Freeze what `B9-prep` must already prove without pretending `B9-lock` is done.
- Make the later shim-removal/spec-lock change a simple assertion flip instead of a fresh test design pass.

## B9-Prep Assertions

| Area | Assertion |
|---|---|
| OpenAPI export harness | `export_openapi()` output equals default runtime `create_app().openapi()` schema |
| Non-cron contract presence | OpenAPI still exposes `/api/v2/plans`, `/api/v2/plans/events`, `/api/v2/recommendations/today`, `/api/v2/dashboard/progress`, `/api/v2/dashboard/full-plan`, `/api/v2/profile/records` |
| Shim still present | OpenAPI still exposes `/api/v2/dashboard/records` |
| Plans/events smoke | Authenticated user can hit `GET /api/v2/plans` and `GET /api/v2/plans/events` successfully |
| Recommendations smoke | Authenticated user can hit `GET /api/v2/recommendations/today` successfully |
| Progress smoke | Authenticated user can hit `GET /api/v2/dashboard/progress` successfully |
| Planning smoke | Authenticated user can hit `GET /api/v2/dashboard/full-plan` successfully |
| Records canonical endpoint | Authenticated user can hit `GET /api/v2/profile/records` successfully |
| Records shim payload | `GET /api/v2/dashboard/records` still returns compatible payload with `sections[0].href == /profile/records` and `actions[0].href == /profile/records` |

## B9-Lock Flips

| Prep assertion | Lock-stage replacement |
|---|---|
| `/api/v2/dashboard/records` exists in OpenAPI | `/api/v2/dashboard/records` is absent from OpenAPI |
| Shim route returns compatibility payload | Shim route is removed or rejected according to final contract |
| Checked-in spec/types not yet touched | `services/api/spec/openapi.json` and `packages/api-client/src/types/api.generated.ts` are regenerated and locked |
| Only non-cron smoke covered | Add final cron/login/submit-refresh assertions after `SIK-36` runtime hooks stabilize |

## Non-Goals
- This matrix does not authorize deleting the shim during `B9-prep`.
- This matrix does not replace the final `B9-lock` review and validation gates.
