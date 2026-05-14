# tests

跨子项目的测试入口。

- `e2e/`        — Playwright / Cypress 端到端测试
- `fixtures/`   — 跨测试用 fixture（伪用户、伪题库、伪 session）

## Notes

- 单元测试与组件测试分散在各 package（vitest）和 services/api（pytest）。
- 本目录只放跨子项目共享的 e2e 与 fixture。
- 本轮迁移：`not_started`。
