---
type: engineering
status: draft
owner: lhr
last-reviewed: 2026-05-14
source: ai-gongkao-mvp-value-loop carve-out + CLAUDE.md §4 implementation gap
---

# Lint Hardcode Tooling

> **本 plan 处于 stub 状态。从 `docs/vault/01-product/ai-gongkao-mvp-value-loop.md` §8 验证段 + CLAUDE.md §4 多处硬巡检引用 拆出，等待独立 worktree 实施。**
>
> **任何业务 PR 禁止顺手补 `lint:*` 脚本**（违反 Small Batch ≤15 文件 / ≤400 行净增，且业务 review 看不到工具链 noise）。

## Why this is carved out

CLAUDE.md §4 多处把以下脚本列为硬巡检，但 `apps/web/package.json:6-15` 实际 scripts 全部缺失：

| Script | CLAUDE.md 引用位置 | 用途 |
|---|---|---|
| `lint:hardcode` | §4 Design Token SSOT / Type scale SSOT / Letter-spacing SSOT | 禁裸 hex / radius / tracking / type 任意值 |
| `lint:italic` | §4 italic 政策 | CJK 禁 italic + 三类例外白名单（serif 数字 / ASCII editorial / error SVG） |
| `lint:radius-token` | §4 组件圆角 SSOT 铁律 | 7 档 radius SSOT (`--r-1` / `tiny` / `2` / `card` / `card-lg` / `pill`) |
| `lint:practice-svg-only` | §4 答题系统按钮 SVG-only 铁律 | 行测 / 申论 / result view 内 toolbar 按钮禁文字 label |
| `lint:ui-copy-ssot` | §4 文案 SSOT | view 内联中文 ≤4 字符；其余从 `apps/web/src/lib/ui-copy/` import |

实际 package.json scripts：`dev / build / preview / typecheck / lint / test / test:watch / test:coverage` —— 工具链债历史欠账。

## Scope

1. **实现 5 个 lint 脚本**（建议放 `apps/web/scripts/lint-*.mjs`，npm scripts 串起来）
2. **修历史命中**（按 lint output 一条条改；escape hatch `// xxx-allow: <reason>` 谨慎用，需 reason 说明 why）
3. **CI 接入**（GitHub Actions PR check + 可选 pre-commit hook）
4. **同步 SSOT 文档**（CLAUDE.md §4 / `docs/vault/04-design/Design-System.md` 如有漂移）

## 实施 PR 拆分建议

- PR-1: `lint:hardcode` 脚本 + 历史命中修复（最大命中量，最先做）
- PR-2: `lint:radius-token` 脚本 + 历史命中修复
- PR-3: `lint:italic` 脚本 + CJK Unicode 范围实现 + 三类例外白名单 + 历史命中
- PR-4: `lint:practice-svg-only` 脚本 + 路径范围 + 三检查
- PR-5: `lint:ui-copy-ssot` 脚本（先 `--warn-only`，迁移完成后转 error）
- PR-6: CI 接入 + SSOT 文档同步

每 PR 走 Small Batch ≤15 文件 / ≤400 行净增；historical-hit 修复如超出阈值，按"机械改动"豁免（需 master review）。

## Status

- [ ] PR-1: `lint:hardcode`
- [ ] PR-2: `lint:radius-token`
- [ ] PR-3: `lint:italic`
- [ ] PR-4: `lint:practice-svg-only`
- [ ] PR-5: `lint:ui-copy-ssot`
- [ ] PR-6: CI 接入 + 文档同步

## Owner / 排期

待 lhr 指派独立 worktree。本 plan 不阻塞 MVP worktree（MVP 验证只跑现有 `lint` + `typecheck` + `test` + `build`）。
