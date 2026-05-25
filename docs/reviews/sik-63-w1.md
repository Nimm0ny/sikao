---
type: review
status: final
owner: codex
last-reviewed: 2026-05-25
---

# SIK-63 W1 Review

## Scope

- Issue: `SIK-63`
- Review type: independent subagent review
- Files:
  - `services/api/src/sikao_api/core/home_scheduler.py`
  - `services/api/src/sikao_api/db/enums_v2.py`
  - `services/api/src/sikao_api/db/schemas_v2.py`
  - `services/api/src/sikao_api/modules/profile_v2/application/service.py`
  - `services/api/src/sikao_api/modules/review/application/debt_preferences.py`
  - `services/api/src/sikao_api/modules/review/application/debt_redistribution.py`
  - `services/api/src/sikao_api/modules/review/application/debt_hard_question.py`
  - `services/api/src/sikao_api/modules/review/application/debt_rampup.py`
  - `services/api/src/sikao_api/modules/review/application/debt_service.py`
  - `services/api/src/sikao_api/modules/review/application/hooks.py`
  - `services/api/src/sikao_api/modules/review/application/srs_probation.py`
  - `services/api/src/sikao_api/modules/review/interface/routes.py`
  - `services/api/src/sikao_api/modules/system/application/home_runtime.py`
  - `services/api/tests/test_home_scheduler_review_debt_jobs.py`
  - `services/api/tests/test_postgres_review_debt_v2.py`
- Acceptance focus:
  - 4 debt endpoints
  - 3 cron jobs
  - ramp-up / redistribute mutex
  - hard multiplier cap
  - `profile_v2.info` 4 fields
  - D1-D15 coverage evidence

## Findings

- No blocking findings.
- Low: `review_debt_redistribute_enabled` still has a policy-consistency risk if future callers bypass UI gating; current acceptance does not require a stricter service-level rejection.
- Low: ramp-up `recommended_today_count` remains a display-level estimate, not a guaranteed live queue cardinality.

## Suggested Actions

- Keep `review_debt_redistribute_enabled` under regression watch when FE wiring lands.
- Revisit user-timezone support in a later Review/Note hardening pass if non-Asia/Shanghai users enter scope.

## Risk Level

- Low

## Decision

- review pass
