# Current Route Inventory

Issue: SIK-12  
Generated: 2026-05-19  
Source: `apps/web/src/router/index.tsx`

## Commands

```bash
rg "lazy\(\(\) => import|path:" apps/web/src/router/index.tsx
rg "RedirectPreserveQuery|Navigate to=" apps/web/src/router/index.tsx
```

## Summary

| Item | Count | Notes |
| --- | ---: | --- |
| `path:` entries | 53 | Includes public routes, auth routes, redirects, and catchall |
| Actual page routes | 42 | Routes that render a lazy page module through `routeElement(...)` or direct page element |
| Redirect-only routes | 11 | `Navigate` or `RedirectPreserveQuery` only |
| Lazy page modules | 43 | `studyToday` is declared but `/study/today` redirects to `/dashboard` |

## Lazy Page Modules

| Key | Module |
| --- | --- |
| `papers` | `@/views/Papers` |
| `practiceCenter` | `@/views/PracticeCenter` |
| `categoryTree` | `@/views/CategoryTree` |
| `practiceStart` | `@/views/PracticeStart` |
| `customPracticeStart` | `@/views/CustomPracticeStart` |
| `practiceSession` | `@/views/PracticeSession` |
| `result` | `@/views/Result` |
| `wrongBook` | `@/views/WrongBook` |
| `wrongQuestionDetail` | `@/views/WrongQuestionDetailView` |
| `wrongQuestionRedo` | `@/views/WrongQuestionRedoView` |
| `smartReview` | `@/views/SmartReviewView` |
| `dashboard` | `@/views/Dashboard` |
| `profile` | `@/views/Profile` |
| `examCalendar` | `@/views/ExamCalendar` |
| `conversationsHistory` | `@/views/ConversationsHistory` |
| `essayPapers` | `@/views/EssayPapers` |
| `essayPaperDetail` | `@/views/EssayPaperDetail` |
| `essayGradingResult` | `@/views/EssayGradingResult` |
| `essayHistory` | `@/views/EssayHistory` |
| `essayExam` | `@/views/EssayExamSikao` |
| `essayExamResults` | `@/views/EssayExamResults` |
| `essaySpecialty` | `@/views/EssaySpecialty` |
| `essaySpecialtyExam` | `@/views/EssaySpecialtyExamSikao` |
| `plan` | `@/views/Plan` |
| `notesHome` | `@/views/NotesHome` |
| `noteEditor` | `@/views/NoteEditor` |
| `shenlunSession` | `@/views/ShenlunSession/ShenlunSession` |
| `studyOnboarding` | `@/views/study/Onboarding` |
| `diagnosisResult` | `@/views/study/DiagnosisResult` |
| `studyToday` | `@/views/study/StudyToday` |
| `progress` | `@/views/Progress` |
| `marketing` | `@/views/marketing` |
| `login` | `@/views/auth/Login` |
| `registerEmail` | `@/views/auth/RegisterEmail` |
| `registerPhone` | `@/views/auth/RegisterPhone` |
| `forgotPassword` | `@/views/auth/ForgotPassword` |
| `resetPassword` | `@/views/auth/ResetPassword` |
| `verifyEmailLanding` | `@/views/auth/VerifyEmailLanding` |
| `bindEmail` | `@/views/auth/BindEmail` |
| `bindPhone` | `@/views/auth/BindPhone` |
| `completeProfile` | `@/views/auth/CompleteProfile` |
| `health` | `@/views/Health` |
| `notFound` | `@/views/NotFound` |

## Actual Page Routes

| Route | Module | Auth / shell |
| --- | --- | --- |
| `/` | `marketing` | `redirect-if-authed`, no AppShell |
| `/login` | `login` | public |
| `/register/email` | `registerEmail` | `redirect-if-authed` |
| `/register/phone` | `registerPhone` | `redirect-if-authed` |
| `/forgot-password` | `forgotPassword` | public |
| `/reset-password` | `resetPassword` | public |
| `/verify-email` | `verifyEmailLanding` | public |
| `/complete-profile` | `completeProfile` | `require-auth`, no AppShell |
| `/health` | `health` | public |
| `/essay/exam/:paperCode` | `essayExam` | `require-auth`, no AppShell |
| `/practice/center` | `practiceCenter` | `require-auth`, AppShell |
| `/practice/center/xingce/categories` | `categoryTree` | `require-auth`, AppShell |
| `/practice/center/xingce/papers` | `papers` | `require-auth`, AppShell |
| `/practice/center/essay/categories` | `essaySpecialty` | `require-auth`, AppShell |
| `/practice/center/essay/papers` | `essayPapers` | `require-auth`, AppShell |
| `/practice/custom/start` | `customPracticeStart` | `require-auth`, AppShell |
| `/practice/:paperCode/start` | `practiceStart` | `require-auth`, AppShell |
| `/practice/sessions/:sessionId` | `practiceSession` | `require-auth`, AppShell |
| `/practice/result/:sessionId` | `result` | `require-auth`, AppShell |
| `/wrong-book` | `wrongBook` | `require-auth`, AppShell |
| `/wrong-book/smart-review` | `smartReview` | `require-auth`, AppShell |
| `/wrong-book/:questionId` | `wrongQuestionDetail` | `require-auth`, AppShell |
| `/wrong-book/:questionId/redo` | `wrongQuestionRedo` | `require-auth`, AppShell |
| `/dashboard` | `dashboard` | `require-auth`, AppShell |
| `/profile` | `profile` | `require-auth`, AppShell |
| `/bind-email` | `bindEmail` | `require-auth`, AppShell |
| `/bind-phone` | `bindPhone` | `require-auth`, AppShell |
| `/calendar` | `examCalendar` | `require-auth`, AppShell |
| `/conversations` | `conversationsHistory` | `require-auth`, AppShell |
| `/essay/papers/:paperCode` | `essayPaperDetail` | `require-auth`, AppShell |
| `/essay/grades/:recordId` | `essayGradingResult` | `require-auth`, AppShell |
| `/essay/history` | `essayHistory` | `require-auth`, AppShell |
| `/essay/exam/results` | `essayExamResults` | `require-auth`, AppShell |
| `/essay/specialty/:questionId` | `essaySpecialtyExam` | `require-auth`, AppShell |
| `/practice/essay/session/:sessionId` | `shenlunSession` | `require-auth`, AppShell |
| `/plan` | `plan` | `require-auth`, AppShell |
| `/study/onboarding` | `studyOnboarding` | `require-auth`, AppShell |
| `/study/diagnosis-result` | `diagnosisResult` | `require-auth`, AppShell |
| `/progress` | `progress` | `require-auth`, AppShell |
| `/notes` | `notesHome` | `require-auth`, AppShell |
| `/notes/:noteId` | `noteEditor` | `require-auth`, AppShell |
| `*` | `notFound` | `require-auth`, AppShell |

## Redirect-Only Routes

| Route | Target | Query behavior |
| --- | --- | --- |
| `/register` | `/register/email` | replace, no query preservation helper |
| `/app` | `/dashboard` | replace, no query preservation helper |
| `/papers` | `/practice/center/xingce/papers` | preserves search via `RedirectPreserveQuery` |
| `/xingce/specialty` | `/practice/center/xingce/categories` | replace |
| `/categories` | `/practice/center/xingce/categories` | replace |
| `/essay/papers` | `/practice/center/essay/papers` | preserves search via `RedirectPreserveQuery` |
| `/essay/specialty` | `/practice/center/essay/categories` | replace |
| `/essay/categories` | `/practice/center/essay/categories` | replace |
| `/study-plan/history` | `/plan` | replace |
| `/study-plan/history/:planId` | `/plan` | replace |
| `/study/today` | `/dashboard` | replace |

## Browser MCP Auth / Data Notes

Routes inside the `require-auth` AppShell must not be accepted with only a `/login` screenshot. Use one of these strategies before PR1b+ screenshots:

- Real login: valid test account and persistent browser storage.
- Seeded API: run the local API and use `npm run bootstrap:mvp-demo` or `npm run seed:mvp-demo` when needed.
- MSW/mock: allowed only for visual state verification, with explicit auth and fixture documentation.

Core PR1b screenshot targets are `/dashboard`, `/practice/center`, and mobile AppShell bottom navigation.
