---
type: product
status: active
owner: lhr
last-reviewed: 2026-05-25
---

# Prototype Token Map

> 原型 (`.tmp_review/out/**`) 使用的 CSS var 与生产 V5 token 的一一映射。
> H11 强制查表：抄原型时禁止把原型 var 直接写进生产代码。

源：

- 原型 SSOT：`.tmp_review/out/_shared/v5-base.css`
- 生产 SSOT：`packages/design-system/src/tokens.css`

## 1. 颜色 — 表面 / 文字 / 边框

| 原型 var | V5 token | 备注 |
|---|---|---|
| `--page-bg` | `--color-bg-page` | #F4F5F7 |
| `--app-bg` | `--color-bg-app` | #ECEEF1 |
| `--paper-1` | `--color-bg-surface` | #FFFFFF — card 背景 |
| `--paper-2` | `--color-bg-elevated` | #F8F9FA — hover / sub-nav 底色 |
| `--paper-3` | `--color-bg-sunken` | #EEF0F3 — input / chip 底色 |
| `--ink-1` | `--color-text-primary` | #1A1D20 |
| `--ink-2` | `--color-text-secondary` | #495057 |
| `--ink-3` | `--color-text-meta` | #6B7280 |
| `--ink-3-soft` | `--color-text-meta-soft` | #868E96 — 仅装饰 |
| `--ink-4` | `--color-text-disabled` | #ADB5BD |
| `--line-1` | `--color-border-subtle` | #E9ECEF |
| `--line-2` | `--color-border-default` | #DEE2E6 |
| `--line-3` | `--color-border-strong` | #CED4DA |

## 2. 颜色 — 品牌 / 状态 / focus

| 原型 var | V5 token | 备注 |
|---|---|---|
| `--brand-yellow` | `--color-brand-primary` | #FFD200 |
| `--brand-yellow-hover` | `--color-brand-hover` | #E6BD00 |
| `--brand-yellow-soft` | `--color-brand-soft` | #FFF4B3 |
| `--ok` | `--color-state-ok` | #1F7A4D |
| `--ok-50` | `--color-state-ok-soft` | #E8F4EE |
| `--warn` | `--color-state-warn` | #B45309 |
| `--warn-50` | `--color-state-warn-soft` | #FDF2DA |
| `--err` | `--color-state-err` | #DC2626 |
| `--err-50` | `--color-state-err-soft` | #FCE8E8 |
| `--info` | `--color-state-info` | #2B6CFF |
| `--info-50` | `--color-state-info-soft` | #E5EEFF |
| `--focus-ring` | `--color-focus-ring` | #2B6CFF |

## 3. 颜色 — 题型 categorical（CP.5 严格隔离）

| 原型 var | V5 token | 备注 |
|---|---|---|
| `--cat-yanyu` | `--color-cat-yanyu` | #7373FF — 言语 |
| `--cat-shuliang` | `--color-cat-shuliang` | #FF8573 — 数量 |
| `--cat-panduan` | `--color-cat-panduan` | #FFDD55 — 判断 |
| `--cat-ziliao` | `--color-cat-ziliao` | #2F95FF — 资料 |
| `--cat-shenlun` | `--color-cat-shenlun` | #15803D — 申论 |

> categorical 严禁与 state（ok/warn/err/info）互换；Badge variant 必须按记录类型动态映射（不允许写死单一 cat-*）。

## 4. 间距

| 原型 var | V5 token | 值（comfortable） |
|---|---|---|
| `--sp-1` | `--space-1` | 4px |
| `--sp-2` | `--space-2` | 8px |
| `--sp-3` | `--space-3` | 12px |
| `--sp-4` | `--space-4` | 16px |
| `--sp-5` | `--space-5` | 24px |
| `--sp-6` | `--space-6` | 32px |
| `--sp-7` | `--space-7` | 48px |

## 5. 圆角

| 原型 var | V5 token | 值 |
|---|---|---|
| `--r-tiny` | `--radius-10` | 10px |
| `--r-card-sm` | `--radius-12` | 12px |
| `--r-card` | `--radius-16` | 16px — 与 design.md 校准（原型 18px 已下调到 V5 的 16px） |
| `--r-app` | n/a | 28px — V5 已废弃，不要使用 |
| `--r-pill` | `--radius-999` | 999px |

## 6. 字号 / 行高

| 原型 var | V5 token | 备注 |
|---|---|---|
| `--t-display` | `--font-display` | 40px |
| `--t-h1` | `--font-h1` | 32px |
| `--t-h2` | `--font-h2` | 24px |
| `--t-h3` | `--font-h3` | 18px |
| `--t-card` | `--font-card` | 16px |
| `--t-body` | `--font-body` | 13px |
| `--t-meta` | `--font-meta` | 12px |
| `--t-tiny` | `--font-tiny` | 11px |

V5 比原型多了配套的 `--line-height-*` 和 `--font-weight-*`，必须配对使用。

## 7. 阴影

| 原型 var | V5 token | 备注 |
|---|---|---|
| `--shadow-1` | `--shadow-l1` | card-rest |
| `--shadow-2` | `--shadow-l2` | card-hover / popover-l2 |
| `--shadow-pop` | `--shadow-l3` | popover / dropdown |
| `--shadow-modal` | `--shadow-l4` | modal / toast |

## 8. 高度 / icon size / 行高

| 原型 var | V5 token | 值 |
|---|---|---|
| `--row-h` | `--row-h-md` | 52px（原型用 `--row-h`，V5 拆 sm 40 / md 52 / lg 64） |
| `--topbar-h` | `--topbar-h` | 56px（V5 同名）|
| `--rail-w` | `--rail-w` | 240px expanded / 80px collapsed |
| `--h-xs` | n/a (32 + 28 不在 V5 button 桶) | 28px — 用 `--btn-h-sm` 32px 替代或显式 px |
| `--h-sm` | `--btn-h-sm` | 32px |
| `--h-md` | `--btn-h-md` | 36px |
| `--h-lg` | `--btn-h-lg` | 40px |
| `--icon-xs` | n/a | 12px |
| `--icon-sm` | n/a | 14px |
| `--icon-md` | n/a | 16px — 用 SpriteIcon size=16 |
| `--icon-lg` | n/a | 18px — 用 SpriteIcon size=18 |
| `--icon-xl` | n/a | 22px |

> V5 尚未把 icon size 抽 token；原型按 px 直接写，生产代码统一走 `<SpriteIcon size={N} />` 接口。

## 9. 动效

| 原型 var | V5 token | 值 |
|---|---|---|
| `--ease-out` | `--ease-out` | 同名 |
| `--ease-emphasized` | `--ease-emphasized` | 同名 |
| `--dur-fast` | `--dur-fast` | 120ms |
| `--dur-base` | `--dur-base` | 200ms |
| `--dur-slow` | `--dur-slow` | 360ms |

## 10. z-index

| 原型 var | V5 token | 值 |
|---|---|---|
| `--z-rail` | `--z-rail` | 20 |
| `--z-topbar` | `--z-topbar` | 30（原型 25，V5 拉到 30）|
| `--z-popover` | `--z-popover` | 40 |
| `--z-modal` | `--z-modal` | 60 |
| `--z-toast` | `--z-toast` | 80 |

## 11. 布局类映射（不是 var，是行为）

| 原型 CSS | V5 实现 | 备注 |
|---|---|---|
| `html, body { height: 100vh; overflow: hidden }` | `<ScreenLockShell>` 包裹入口 view | 见 `Web-Layout.md` §3 |
| `.app { display: flex; height: 100vh; overflow: hidden }` | `<AppShell>` 已有 `min-height: 100vh`，**待升级** `height: 100dvh + overflow: hidden`（SIK-FU-A） | - |
| `.ws { height: 100vh; overflow: hidden; display: grid; grid-template-rows: ... }` | `<Workspace>` + `<ScreenLockShell rows="...">` | - |
| `.panel { background: var(--paper-1); border: 1px solid var(--line-1); border-radius: var(--r-card); box-shadow: var(--shadow-1) }` | `<Panel>` 组件 | 已存在 |
| `.panel-head { height: 48px; ... }` | `<Panel title actions>` slot | - |
| `.panel-body { flex: 1; min-height: 0; overflow: auto }` | Panel 内部 scrollRegion | - |

## 12. 反模式（红线）

- ❌ 直接在生产 .module.css 写 `var(--paper-1)` / `var(--ink-1)` 等原型 var
- ❌ `color-mix(in srgb, var(--color-brand-primary) 6%, var(--color-bg-surface))` 这种百分比硬编码（V5 已有 `--color-brand-soft`，染色用它）
- ❌ 直接写 `#FFD200` / `#1A1D20` 等 hex（必须走 token）
- ❌ 直接写 `1.6fr / 1fr` 之外的非 token 比例（特殊比例必须在 visual-contract 里说明）

## 13. 状态

`active` — 本表是 H11 视觉契约 Token Map 段的强制查表来源。

## 14. 参考

- `.tmp_review/out/_shared/v5-base.css`（原型 SSOT）
- `packages/design-system/src/tokens.css`（生产 SSOT）
- `docs/vault/04-design/Design-System.md`
- `docs/vault/04-design/Web-Layout.md`
- `docs/engineering/visual-contract-workflow.md`
