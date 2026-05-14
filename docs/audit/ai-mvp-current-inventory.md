---
type: audit
status: final
owner: claude-sikao (agent 3c88e8dd)
created: 2026-05-14
multica-issue: f4a0b4a2-a3cd-4375-bf56-0a173b5bfb5c
branch: codex/mvp-ai-gongkao
baseline-commit: b5a52fa
---

# AI MVP Current Inventory (PR-0)

**Mode**: Runner Mode
**Requirement source**: Multica issue SIK-10 body
**Purpose**: Inventory existing code, lock drift decisions, freeze contracts before PR-1 begins.
No business behavior changed in this commit.

---

## 1. Drift Decision Record

### Drift #1 — Essay Session Plan [DECISION: PATH A]

**Decision**: Path A — reuse EssayDraftRecord + EssayGradingRecord. Do NOT add new essay_sessions / essay_submissions tables.

**Evidence**:
- models.py:886-898: EssayDraftRecord upsert by (user_id, question_id); no BE session entity needed.
- essay/routes.py:193-220: POST /api/v2/essay/drafts + GET /api/v2/essay/drafts/{question_id} exist.
- router/index.tsx:282-284: FE route /practice/essay/session/:sessionId; sessionId from questionId, no BE session entity.

**PR-4 scope**: Wire ShenlunSession.tsx auto-save to POST /api/v2/essay/drafts. Submit via POST /api/v2/essay/grade. No new tables.

### Drift #2 — Xingce Route Naming

**Decision**: Follow code reality.
- /practice/sessions/:sessionId (plural) - router:226
- /practice/result/:sessionId (not /report) - router:227
- /api/v2/practice/sessions/{id}/submit (not /finish) - answer_session/routes:68

### Drift #3 — Study Plan

**Decision**: Extend task_kind enum via migration 0024; keep existing 4 endpoints; no in_progress state.
- Prefix: /api/v2/study-plan
- Add: wrongbook_review, progress_review to task_kind
- Skip: quota_purchase (PR-7 blocked)
- State machine: pending->completed/skipped (unchanged)

### Drift #4 — PR-7 Billing [BLOCKED]

No payment/credit/membership tables. Carve-out: docs/plan/billing-credit-system.md

### Drift #5 — lint:* Scripts [BLOCKED]

Carve-out: docs/plan/lint-hardcode-tooling.md

### Drift #6 — SOP Compliance

Follow CLAUDE.md §3/§5/§5.1/§7/§7.1. PRD §9 used as content reference only.

---

## 2. Existing Code Inventory

### 2.1 Backend Models (services/api/src/sikao_api/db/models.py)

| Model | Lines | MVP PR |
|-------|-------|--------|
| User | 47-81 | PR-1 |
| UserGoal | 1226-1250 | PR-1 |
| UserExam | 1252-1300 | PR-1 |
| ExamEvent | 657-708 | PR-1 |
| StudyPlan | 940-991 | PR-2 |
| StudyPlanTask | 993-1030 | PR-2 |
| PracticeSession | 391-427 | PR-3 |
| PracticeSessionAnswer | 428-476 | PR-3 (needs elapsed_seconds, wrong_reason_code) |
| WrongQuestionMastery | 479-525 | PR-3 |
| EssayDraftRecord | 886-938 | PR-4 |
| EssayGradingRecord | 836-884 | PR-5 |
| LlmTokenUsage | 688-729 | PR-8 |
| Payment/billing | NONE | BLOCKED PR-7 |

### 2.2 Backend API Routes

- /api/v2/essay: POST /grade, GET /grades/{id}, POST /drafts, GET /drafts/{question_id}
- /api/v2/practice: POST /papers/{code}/start, POST /sessions/{id}/submit
- /api/v2/study-plan: GET /today, PATCH /tasks/{id}, GET /history, GET /{plan_id}
- /api/v2/users: profile GET/PATCH

### 2.3 Frontend Routes Missing (to add)

- /study/onboarding -> apps/web/src/views/study/Onboarding.tsx (PR-1)
- /study/diagnosis-result -> apps/web/src/views/study/DiagnosisResult.tsx (PR-1)
- /study/today -> apps/web/src/views/study/StudyToday.tsx (PR-2)
- /progress -> apps/web/src/views/Progress.tsx (PR-6)

### 2.4 Database Migration Status

- Tool: Alembic
- Latest version: 0023_essay_draft_sessions.py
- DB question counts: Cannot verify without DATABASE_URL

### 2.5 Payment Models

None. PR-7 carved out.

---

## 3. Contract Freeze

### 3.1 Migration 0024 Scope

- practice_session_answers: add elapsed_seconds INTEGER, wrong_reason_code VARCHAR(32), wrong_reason_source VARCHAR(16) DEFAULT 'ai'
- study_plan_tasks: add result_payload JSONB
- study_plan_task_kind enum: add wrongbook_review, progress_review

### 3.2 New API Endpoints

| PR | Method | Path |
|----|--------|------|
| PR-1 | GET | /api/v2/users/me/goal |
| PR-1 | PUT | /api/v2/users/me/goal |
| PR-1 | GET | /api/v2/users/me/exam |
| PR-1 | PUT | /api/v2/users/me/exam |
| PR-1 | GET | /api/v2/exam-events |
| PR-3 | PATCH | /api/v2/practice/sessions/{id}/answers/{answer_id}/diagnosis |
| PR-6 | GET | /api/v2/progress/weekly |
| PR-6 | GET | /api/v2/progress/accuracy-trend |
| PR-8 | POST | /api/v2/analytics/event |

### 3.3 New Frontend Routes

| Route | View | PR |
|-------|------|----|
| /study/onboarding | Onboarding.tsx | PR-1 |
| /study/diagnosis-result | DiagnosisResult.tsx | PR-1 |
| /study/today | StudyToday.tsx | PR-2 |
| /progress | Progress.tsx | PR-6 |

---

## 4. PR Scope Summary

| PR | Scope | Migration | Status |
|----|-------|-----------|--------|
| PR-0 | Audit + freeze | none | DONE |
| PR-1 | User onboarding + goal/exam | none (models exist) | NEXT |
| PR-2 | Today study tasks page | 0024 | — |
| PR-3 | Xingce wrong-reason diagnosis | 0024 | — |
| PR-4 | Essay session (Path A) | none | — |
| PR-5 | Essay grading report | none | — |
| PR-6 | Progress dashboard | none | — |
| PR-7 | Billing/credit | BLOCKED | lhr approval |
| PR-8 | Analytics / smoke | none | — |

Generated by Claude SIKAO (3c88e8dd) on 2026-05-14 in Runner Mode.
