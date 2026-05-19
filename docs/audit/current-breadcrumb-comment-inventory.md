# Current Breadcrumb Comment Inventory

Issue: SIK-12
Updated: 2026-05-19
Scope: comment cleanup inventory.

## Rule

SIK-12 cleanup removes implementation-history breadcrumbs only when the owning file is touched for a real implementation slice. Do not keep or add comments that only say when a PR, wave, phase, batch, handoff, or commit happened.

Allowed comments explain stable business rules, API contracts, accessibility constraints, or registered fail-fast exceptions.

## Cleanup Targets

| Surface | Handling |
| --- | --- |
| `apps/web/src/components/mvp/index.tsx` | Clean while token-compliance work touches the file. |
| Dashboard / PracticeCenter / Result / WrongBook views | Clean while each page is refactored into the product loop. |
| Auth / Profile views | Clean while visual consistency work touches those pages. |
| Router | Clean with RouteMap and redirect/query-preserve tests. |

## Rejected Comment Patterns

```text
PR*
Wave*
Phase*
Round*
hifi
batch
handoff
commit
temporary implementation history
```

## Acceptance

- Touched files keep only stable explanatory comments.
- No cleanup-only sweep is mixed into product behavior changes.
- Remaining broad cleanup is guarded by lint or an explicit audit command before completion.
