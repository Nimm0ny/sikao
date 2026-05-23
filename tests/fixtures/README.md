# tests/fixtures

跨子项目共享 fixture。aliased as `@sikao/test-utils` in workspace vitest configs.

## Status (2026-05-24, V5-M0.5)

- **`essayExamMock.ts`** — active. consumed by `packages/editor/src/__tests__/ExamShell.test.tsx`
  via `@sikao/test-utils/essayExamMock`. (editor is FROZEN under V5-M0.5; tests
  also FROZEN until independent Exam spec re-thaws.)
- **`server.ts` + `handlers.ts`** — retained, idle. consumed only by editor +
  domain shenlun tests, both FROZEN. handlers.ts contains 450+ lines of V4 view
  test fixtures; will be slimmed when V5 component tests land in V5-M3.
- **`renderWithProviders.tsx`** — retained, idle. consumed by editor FROZEN tests.
- **`__tests__/cookie-smoke.test.tsx`** — orphan; not collected by any vitest
  config include path.
- **`index.ts`** — barrel exports kept intact for FROZEN consumers.

## Plans

V5-M3 (SIK-75) will reintroduce a focused `renderV5Component` helper for
component-skeleton tests. handlers.ts will be replaced by a fresh, narrow
set of mocks driven by V5 component fixtures (no view-level integration
mocks in the new structure).
