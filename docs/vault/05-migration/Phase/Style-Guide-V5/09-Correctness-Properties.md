# 09 · Correctness Properties + Lint Traceability + V5 Baseline

> **Status**: LOCKED
> **Phase 父目录**：[../README.md](../README.md)
> **来源**：`design.md` §F Correctness Properties（10 条）+ §T.1 Lint Traceability（14 lint）+ §T.2 V5 Baseline 模板
> **校验时机**：每个 Phase 检查点（tasks.md 任务 2 / 9 / 16 / 18 / 20 / 22 / 24 / 26）
> **Last Updated**: 2026-05-23

---

## 1. 10 条 Correctness Properties

V5 规范在落地与运行期必须始终满足以下不变性。任意一条违反都视为缺陷，**不靠规约对齐而是靠实证 / lint / 测试持续校验**。

### CP.1 Token Single Source Invariant

- **校验对象**：Requirements 1.1, 2.7, 3.5, 4.5, 6.4
- **不变性**：`apps/**/src/**` 内不出现任何 hex / rgb() / rgba() / `box-shadow:` 字面量 / `z-index: <num>` / `border-radius: <hardcoded>` / `padding|margin|gap` 上的硬编码 px / rem
- **校验**：`lint-hardcode` / `lint-radius-token` / `lint-shadow-token` / `lint-zindex-token` / `lint-spacing-token` 任一报错即违反
- **任务编号**：3.1, 4.1, 5.1（property test fixtures）

### CP.2 Theme Switching Stability

- **校验对象**：Requirements 1.4, 1.5
- **不变性**：light ↔ dark 切换时，primitive 与 component 层数值不变；只 semantic 层切换
- **校验**：构建期 diff `tokens.css` 中 `:root` 与 `.dark` 的 key 集合必须完全一致；diff 出现 primitive / component key 即违反
- **任务编号**：1.3（`check-theme-keys.mjs`）+ 23.2c（playwright theme-switch e2e）

### CP.3 Nested Radius Difference

- **校验对象**：Requirements 3.4, 7.5
- **不变性**：任意"卡片包卡片"渲染中，外层圆角 ≥ 内层圆角，且差值 ≥ 4px
- **校验**：人工 review + 视觉预览（`.tmp_review/v5-design-preview.html` §D.1 嵌套示例）+ playwright nested-radius.spec.ts（计算 `getBoundingClientRect` + `getComputedStyle border-radius`）
- **任务编号**：23.2d


### CP.4 CJK No-Italic Invariant

- **校验对象**：Requirements 5.4, 5.7
- **不变性**：含 CJK 字符的节点不携带 `italic` / `<i>` / `font-style: italic` / Tailwind `italic` 类
- **校验**：`lint-italic.mjs`（V4 沿用 + V5 扩展覆盖 Tailwind 类与 inline style）+ playwright cjk-italic.spec.ts（遍历 6 页面所有 text node，含 CJK 字符的节点 `getComputedStyle('font-style') !== 'italic'`）
- **任务编号**：23.2e

### CP.5 SVG-Only Icon Invariant

- **校验对象**：Requirements 1.1, 8.6
- **不变性**：所有视觉图标承载用 SVG；emoji / icon-font / 图片字体禁止用作图标
- **校验**：`lint-no-emoji-as-icon.mjs` + `lint-practice-svg-only.mjs` + `lint-icon-style.mjs`（新增，校验 viewBox / stroke-width / fill / linecap）
- **任务编号**：6.1, 19.7

### CP.6 Focus Visibility Invariant

- **校验对象**：Requirements 2.6, 10.1, 10.7
- **不变性**：所有 `tabIndex >= 0` 元素在 `focus-visible` 下必须可见 ring（取自 `--color-focus-ring`），且与 paper-1 / ink-1 同时满足 4.5:1
- **校验**：playwright 跑键盘导航 + axe 检查（focus-ring.spec.ts）
- **任务编号**：23.2b

### CP.7 Glassmorphism Fallback Closure

- **校验对象**：Requirements 8.4
- **不变性**：BottomNavigation 在 `@supports not (backdrop-filter)` 与 `prefers-reduced-transparency: reduce` 下必须降级到不透明 `--color-bg-elevated`，**不允许出现透明背景下文字与下层内容重叠不可读**
- **校验**：playwright 模拟 `prefers-reduced-transparency` + 截图回归对比 + 人工 review；`grep mobile-bottom-nav-glassmorphism-fallback docs/engineering/fail-fast-exceptions.md` 必命中（账本兜底）
- **任务编号**：14.3a

### CP.8 V4 Token Residual Convergence

- **校验对象**：Requirements 1.6, 12.1, 12.2
- **不变性**：过渡期满（2026-06-06）后，`apps/**/src/**` 与 `packages/design-system/src/tokens.css` 内不再出现任何 V4 token 名（如 `--paper-*` / `--ink-*` / `--brand-yellow` / `--r-card` / `--sp-*` / `--t-*` / `--h-xs..lg`）
- **校验**：`lint-v4-token-residual.mjs` 必须 0 命中（sunset 起切到 error）
- **任务编号**：8.1, 21.3a

### CP.9 Hover-Touch Affordance

- **校验对象**：Requirements 8.1, 10.1
- **不变性**：所有 `:hover` 视觉规则必须包裹在 `@media (hover: hover) and (pointer: fine)` 之内；触屏（`pointer: coarse`）下：
  - 不渲染 hover 残影
  - Tooltip 改为长按 700ms 触发 Sheet
  - 所有可点击元素（按钮 / icon-btn / list-row / chip）实际命中区 ≥ 40×40 px（用透明 padding 扩展或显式 min-height）
- **校验**：`lint-touch-target.mjs`（新增）扫描组件源码中 `:hover` 选择器是否在 hover-capable 媒体查询内 + e2e 测试在触屏 emulate 下命中区 ≥ 40px
- **任务编号**：7.1

### CP.10 Multi-device Continuity

- **校验对象**：Requirements 4.1, 4.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.6
- **不变性**：从 `--bp-xs`(0) 到 `--bp-3xl`(1920+) 全部断点下，所有页面：
  - 不出现横向滚动条（除非业务显式 horizontal-scroll 容器）
  - 不出现关键内容被裁剪、按钮被遮挡、文字与下层重叠
  - Safe area 在移动端 ≥ 0px 时所有 fixed 元素正确避让
  - Workspace 在 `--bp-3xl` 自动 max-width 居中
- **校验**：playwright 跑 6 档断点（375 / 480 / 768 / 1024 / 1440 / 1920）下 Home / Practice / Note / Me 4 页 + 3 个 Modal 的截图回归对比；视觉差异 > 5% 即违反
- **任务编号**：14.1a, 23.2a

---

## 2. Lint Gates Traceability（14 lint）

V5 完整 lint 集 = 8 V4 沿用 + 6 新增；每条 lint 必须接入 `apps/web` 的 `pnpm lint`。

| Lint 脚本 | 关联 REQ | 检测内容 | 状态 |
|---|---|---|---|
| `lint-hardcode.mjs` | REQ-1.1 / REQ-2.7 | hex / `rgb()` / `rgba()` 字面量 | 沿用 |
| `lint-radius-token.mjs` | REQ-3.5 | hardcoded `border-radius` | 沿用 |
| `lint-shadow-token.mjs` | REQ-6.4 | hardcoded `box-shadow` 字面量 | **新增** |
| `lint-zindex-token.mjs` | REQ-6.4 | hardcoded `z-index: <num>` | **新增** |
| `lint-spacing-token.mjs` | REQ-4.5 | `padding/margin/gap` 上的硬编码 px / rem | **新增** |
| `lint-italic.mjs` | REQ-5.4 / REQ-5.7 | CJK 节点 italic | 沿用 + 扩展 Tailwind 类与 inline style |
| `lint-no-emoji-as-icon.mjs` | REQ-1.1 / 图标契约 | emoji 用作图标 | 沿用 |
| `lint-practice-svg-only.mjs` | REQ-1.1 / 图标契约 | 非 SVG 图标资源 | 沿用 |
| `lint-icon-button.mjs` | REQ-8.3 / D.3.1 | icon-only 按钮缺 `aria-label` | 沿用 |
| `lint-icon-style.mjs` | C.5.1 / C.5.2 | SVG 风格统一（viewBox / stroke-width / fill / linecap）+ 尺寸取自 token | **新增** |
| `lint-touch-target.mjs` | REQ-10.1 / CP.9 | 触屏命中区 ≥ 40px / hover 必须在 hover-capable 媒体查询内 | **新增** |
| `lint-cn-simplified.mjs` | REQ-10.5 | 简体中文校验 | 沿用 |
| `lint-ui-copy-ssot.mjs` | REQ-10.5 | UI 文案取自 SSOT | 沿用 |
| `lint-v4-token-residual.mjs` | REQ-12.2 | V4 token 在过渡期满后的残留扫描 | **新增** |
| **人工 review 兜底** | REQ-7.6 / REQ-9.7 / REQ-10.4 | 卡片视觉示例齐全、容器树齐全、动效场景表 | 无自动化（REQ-11.3） |

### 2.1 Lint 与 CP 映射

| CP | 落地 lint | 落地 e2e |
|---|---|---|
| CP.1 | hardcode / radius / shadow / zindex / spacing | — |
| CP.2 | check-theme-keys.mjs（构建期）| theme-switch.spec.ts |
| CP.3 | — | nested-radius.spec.ts |
| CP.4 | italic | cjk-italic.spec.ts |
| CP.5 | no-emoji-as-icon / practice-svg-only / icon-style | svg-only.test.mjs |
| CP.6 | — | focus-ring.spec.ts |
| CP.7 | — | glass-fallback.test.tsx + 账本 grep 兜底 |
| CP.8 | v4-token-residual | lint-v4-residual.test.mjs |
| CP.9 | touch-target | hover-touch lint test |
| CP.10 | — | multi-device.spec.ts + Rail 折叠 unit |

---

## 3. V5 Baseline Report 模板（REQ-11.4，tasks.md 任务 23.1）

V5 规范文档提交时附带 `apps/web/v5-baseline-report.md`，对 V4 现存 `out/*.html` 跑一遍 V5 lint 集，记录基线违规数：

```markdown
# V5 Baseline Report
Date: 2026-05-23
Commit: <sha>

## 扫描范围
.tmp_review/out/**/*.html（截至 2026-05-23 共 ~36 个 v1/v2 原型，IA-V2 §4 覆盖率 ~98%；详见 SIK-85）+ V5 落地后 apps/web/src/views/**

## 违规统计
| Lint | 违规数 | 主要文件 |
|---|---|---|
| lint-hardcode | <n> | … |
| lint-radius-token | <n> | … |
| lint-spacing-token | <n> | … |
| ...

## Top 5 修复优先级
1. ...

## 迁移阻塞（blocking）
- ...
```

---

## 4. 视觉与交互验证（Phase 7）

| 场景 | 工具 | 命令 |
|---|---|---|
| 视觉示例齐全 | `.tmp_review/v5-design-preview.html` 浏览器人工 review | 直接打开 |
| 卡片状态机 9 态 | playwright + axe | `pnpm --filter @sikao/web test:visual` |
| 对比度 ≥ 4.5:1 | axe-core 自动 | `pnpm --filter @sikao/web test:a11y` |
| `prefers-reduced-motion` | playwright emulate | 跑 a11y suite 时附加 |
| Browser MCP 验收 | chrome-devtools MCP | 每个 Phase 检查点 |
| dev server 端口 | hardcoded 18080（H10） | `pnpm --filter @sikao/web dev` |

### 4.1 视觉回归基线矩阵（任务 23.2）

playwright 6 断点 × 6 页面 = 36 截图：

| 断点 | 375 (xs) | 480 (sm) | 768 (md) | 1024 (lg) | 1280 (xl) | 1920 (3xl) |
|---|---|---|---|---|---|---|
| Home | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Practice | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Note | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Me | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Question Hub | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Review | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

基线截图存 `apps/web/e2e/visual/__snapshots__/`；首次跑作为 baseline，后续 PR 作为回归基线。

---

## 5. 关联文档

- [`design.md` §F`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md) — 10 条 CP 完整说明
- [`design.md` §T.1 / §T.2`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md) — 14 lint 矩阵 + V5 baseline 模板
- [`tasks.md`](../../../../../.kiro/specs/frontend-style-guide-v5/tasks.md) — Phase 2（lint 落地）+ Phase 7（视觉回归）
- [01-Boundary-Rules.md §2](./01-Boundary-Rules.md) — AGENTS.md H5 review gate / H8 validation gate
- [10-Migration.md](./10-Migration.md) — CP.8 V4 token sunset 流程
