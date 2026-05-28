# Self-hosted Font Assets

This folder is the SSOT for runtime font assets consumed by
`packages/design-system/src/tokens.css`.

## Families

- `DM Sans` — UI primary
- `Inter` — secondary Latin fallback
- `JetBrains Mono` — mono / kbd / tech metadata

## Policy

- Runtime must not request `fonts.googleapis.com` or `fonts.gstatic.com`
- App code must consume font tokens, not direct font-family literals
- CJK stays on system fallback in this wave; no self-hosted Chinese font here
