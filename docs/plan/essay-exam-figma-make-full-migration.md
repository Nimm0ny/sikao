---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-19
---

# Essay Exam Figma Make Full Migration

## Goal

Land the Figma Make prototype on `/essay/exam/:paperCode` as a prototype-level
port. The route keeps the existing real paper loading, hydration, autosave,
submission, and results navigation pipeline.

## Decisions

- Do not use Figma mock `materials` or `questions` in production.
- Do not add `react-resizable-panels`; implement the split pane locally.
- Do not treat the current SIKAO frontend visual lint rules as visual blockers
  for this migration.
- Keep TypeScript, React runtime behavior, tests, typecheck, and build green.

## Implementation

- Replace the visible exam shell with the Figma Make structure: 48px topbar,
  material panel, draggable split pane, question panel, answer sheet, and draft
  paper modal.
- Map real state directly:
  - `paper.materials[]` to material tabs and material body.
  - `paper.questions[]` to question tabs and the active prompt.
  - `textsByQ[]` to answer values.
  - `highlights[material.id]` to underline/highlight annotations.
  - `scratch` to draft-paper text.
- Extend `Highlight` with optional annotation kind. Existing snapshots without
  kind render as highlight.
- Keep handwritten/OCR out of `/essay/exam`; this migration only keeps the
  Figma draft canvas as local in-page scratch work.

## Verification

- Focused component tests cover topbar controls, split pane resizing, material
  annotations, answer input isolation, and draft paper text/draw modes.
- Route tests cover existing query, hydrate, autosave, submit, and result
  navigation.
- Final checks: focused tests, `npm run typecheck -w @sikao/web`,
  `npm run build -w @sikao/web`, then Browser MCP screenshots for default
  desktop and narrow/material states.
