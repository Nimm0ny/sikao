# Xingce Answer System Redesign

## Status

Approved for implementation.

## Context

The redesigned Xingce answering surface is based on two local references in
`C:/Users/clown/Downloads`:

- `exam_practice_page_answer_drawer_single_quetion.html`
- `exam_practice_material_analysis_compact_spacing.html`

These files are visual and interaction references only. They are not copied
into the repository and do not replace the SIKAO design token SSOT.

## Scope

- Replace only the active Xingce practice route:
  `/practice/sessions/:sessionId`.
- Keep result pages, Shenlun sessions, backend API, OpenAPI, and database
  schema unchanged.
- Keep existing answer submission:
  `POST /api/v2/practice/sessions/:id/complete` with `{ answers }`.

## Decisions

- Use the HTML references for structure and behavior:
  top exam bar, compact question cards, bottom floating answer drawer, and
  material-analysis split view with synchronized tabs.
- Keep SIKAO tokens for color, type, spacing, radius, and shadow.
- Preserve existing practice capabilities: scratch notes, highlights, notes,
  marks, settings, pause, keyboard shortcuts, and final submit.
- Do not add the prototype download control because the active session has no
  export contract.

## Acceptance

- Normal questions render as compact question cards with accessible SVG-only
  tool buttons.
- Material groups render one material pane and a right-side synchronized
  question pane.
- The floating answer drawer can expand, collapse, show current/done/marked
  state, and jump to the selected question.
- `PracticeSession.tsx` stays below 500 lines by delegating UI state and
  question registry behavior to smaller modules.
- Existing session submit, multi-choice submit guard, scratch sheet, note
  editor, settings popover, and keyboard shortcuts keep working.
