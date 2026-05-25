---
type: review
status: pass
owner: lhr
reviewer: self-review (subagent unavailable in Kiro session)
target: d77add443..4cce5796c (SIK-121 W2 — 7 files, +409 net across 3 commits)
wave: w2
last-reviewed: 2026-05-25
---

# SIK-Rail-v5 W2 · Code Review

## 检查范围

只读审查 3 commits on `feat/sik-121-w2`：

1. `d77add443` — test(layout): RED — H05/H06/H07/H10 + Tooltip unify (2 files, +119)
2. `469defc29` — feat(layout): Rail visual alignment H06-H10 + Tooltip (2 files, +164/-56)
3. `4cce5796c` — feat(layout): RootLayout cmd-k surface H05 (4 files, +188/-6)

附加 carry-over commit `00f29a34a`（W1 review finding #1 修复，1 file）。

改动范围 7 文件 / +409 行净增，全部落在 `apps/web/src/`：

- `components/layout/Rail/Rail.tsx` (+104 行重构)
- `components/layout/Rail/Rail.module.css` (+116 行)
- `components/layout/Rail/Rail.test.tsx` (+96 行)
- `layouts/RootLayout/RootLayout.tsx` (+66 行)
- `layouts/RootLayout/RootLayout.module.css` (+110 行)
- `layouts/RootLayout/RootLayout.test.tsx` (+28 行)
- `lib/ui-copy/index.ts` (+7 行)

对照 SSOT：

- `docs/plan/sik-rail-v5-visual-contract.md` §6 H05–H10
- `.tmp_review/home-frame.html` 原型行号
- `AGENTS.md` §0.2 H5/H8/H9/H11


## 发现项

| # | 严重度 | 项 | 证据 | 建议处理 |
|---|---|---|---|---|
| 1 | low | `ProfileLearning.test.tsx` loading test 失败 | vitest full run: 383/384 PASS | pre-existing（SIK-91 scope），非 W2 引入；不阻塞 |
| 2 | low | lint-screen-lock exit 1（Note/Me views） | `scripts/lint-screen-lock.mjs` output | pre-existing（SIK-90/91/93 scope），W2 未动 view 层 |
| 3 | info | W2 行数 +409 超 contract §7 估值 ≤350 | git diff stat | 因 cmd-k 需要 CommandPalette 接线 + CSS 模块较大；每 commit 均 ≤ 400 行硬上限合规 |
| 4 | info | Tooltip `0.4s` hover delay 仍为字面值 | Rail.module.css:137, RootLayout.module.css:103 | 与原型 home-frame.html:135 一致；W1 review 已标 no drift |

## Acceptance Hooks H05–H10（W2 owner）

- **H05 PASS**：`RootLayout.tsx` 注入 `cmd={<button aria-label="命令搜索" ...>}` 接 `openPalette`；`KeyboardShortcuts` 注册 Ctrl+K / Meta+K → `openPalette`；`CommandPalette` 受控 `open={paletteOpen}`。测试 `RootLayout.test.tsx` 断言 click + Ctrl+K 两条路径均打开 `role="dialog" name="命令面板"`。
- **H06 PASS**：`Rail.tsx` `RailToggleButton` 渲染 `<SpriteIcon id="rail-toggle" size={16} />`；`Rail.test.tsx` 断言 toggle 内无 `<path>` 元素（inline SVG 已删）。
- **H07 PASS**：`Rail.tsx` `RailBrand` expanded 态渲染 `<RailToggleButton>` 在 `.brand` 行 trailing；collapsed 态整段替换为 `<button class="brandButton">`（toggle 不渲染）。`Rail.test.tsx` 断言 toggle 在 brand 行内。
- **H08 PASS**：`Rail.module.css` `.navItem[data-active]::before` 3×24px indicator bar，`left: -12px; background: var(--color-text-primary)`。
- **H09 PASS**：`Rail.module.css` `.navItem[data-active] { background: var(--color-bg-sunken) }`；grep 确认 `--color-brand-soft` 仅存于 W2 之前的 git 历史，当前文件 0 命中。
- **H10 PASS**：`Rail.tsx` 渲染 `<RailNavSection label="导航" />`；`Rail.module.css` `.navSection` 10px/600/uppercase/letter-spacing .08em + collapsed `display: none`。`Rail.test.tsx` 断言 expanded 态可见。

## Token 红线

全 `apps/web/src/components/layout/Rail/**` + `apps/web/src/layouts/RootLayout/**` 扫：
- `color-mix` — 0 命中
- `--paper-1 / --ink-1 / --t-meta / --r-card / --shadow-1` — 0 命中
- `--color-brand-soft` — 0 命中（H09 漂移已修）

W2 新增 CSS 全部使用 V5 semantic token。

## H9 cap 合规

| Commit | 文件 | 净增 | 合规 |
|--------|------|------|------|
| d77add443 (RED) | 2 | +119 | ✓ |
| 469defc29 (GREEN Rail) | 2 | +108 | ✓ |
| 4cce5796c (GREEN RootLayout) | 4 | +182 | ✓ |

每 commit ≤ 15 文件 / ≤ 400 行净增。

## TDD 合规

- RED commit `d77add443` 先落 7 个 failing tests
- GREEN commits `469defc29` + `4cce5796c` 让全部 tests 通过
- 符合 RED → GREEN 流程

## Validation 证据

- typecheck: PASS (exit 0)
- eslint: PASS (0 errors, 1 pre-existing warning)
- vitest scoped (Rail + RootLayout): 25/25 PASS
- vitest full: 383/384 PASS (1 pre-existing failure: ProfileLearning loading)
- lint-screen-lock: pre-existing failures only (Note/Me views, SIK-90/91/93)

## 风险等级

**low** — H05–H10 全 PASS；0 high / 0 med / 2 low + 2 info；token 红线 0 命中。

## 结论

**pass** — W2 完成。W3 可启动。

