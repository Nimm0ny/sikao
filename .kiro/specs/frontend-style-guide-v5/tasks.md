# Implementation Plan: Frontend Style Guide V5

> **2026-05-24 UPDATE — V5-M0.5 Big-Bang Rebuild**
>
> lhr 拍板 big-bang 重建。tasks 影响：
> - **任务 1.7（V4 token alias 层）ARCHIVED**：tokens.css §8 V4 alias 在 V5-M0.5 commit ② 一并删除
> - **Phase 6 任务 21.x（整页 surface 切换 + sunset）整段 ARCHIVED**：21.1a-g、21.2、21.3、21.3a 全部失效
> - **任务 23.1（V5 Baseline Report）ARCHIVED 部分**：扫描 V4 现存 HTML 章节失效；保留对 V5 实现源码的 lint 统计
> - **任务 8（lint-v4-token-residual）改为可选**：big-bang 后 V4 token 名零残留是删除事实保证的，lint 仅作 regression guard
> - **Wave 21–24 ARCHIVED**：从依赖图移除
> - 其他 wave / Phase 1–5 / Phase 7（除 23.1 部分）/ Phase 8 全部不变
>
> V5 主线收敛：原 13 milestone 砍到 8 个：M0 / M0.5(NEW) / M1 / M2 / M3 / M4 / M9（兜底+视觉回归 baseline）/ M11（文档同步）。原 M5..M8（surface 切换）+ M10（sunset）作废，由各业务 Phase（Home/Practice/Notes/Review）直接消费 V5 spec。
>
> 详见 [11-Implementation-Plan.md](../../../docs/vault/05-migration/Phase/Style-Guide-V5/11-Implementation-Plan.md) §V5-M0.5 章节。

## Overview

把 `requirements.md`（12 REQ + 12 Resolved Decisions，REQ-12 ARCHIVED）+ `design.md`（三层 token + 35 个组件契约 D.3.1–D.3.35 + 6 桌面页 + Mobile Shell + 10 Correctness Properties；§C.6 V4→V5 mapping ARCHIVED）落地为可执行 commit 序列。

**模式**：Runner Mode（前端视觉 phase，按 AGENT-H5 进入需 review gate；每个 sub-task 完成后由独立 reviewer 兜底）。
**事实来源**：`packages/design-system/src/tokens.css`（token SSOT）+ `docs/vault/04-design/Design-System.md`（规范镜像）+ `apps/web/src/components/**`（V5 组件骨架落点）。
**Commit 规则**：每个 leaf sub-task 对应一个原子 commit，遵守 AGENT-H9：≤15 文件、≤400 行净增、不混合 plan/schema/实现/测试。
**dev port**：18080；禁 docker（AGENT-H10）。

**通用产出物字段约定（每 sub-task 含）**：依赖（前置任务）/ 产出物（文件路径）/ 验收（lint / unit / e2e / 人工）/ 回滚（git revert 后续状态）。
**优化范围**：本 spec 只产出"骨架 + token + lint 闸门 + 视觉验证"，不绑定后端 API 或业务态；业务数据接入由各页面后续 spec 承担。

## Tasks

### Phase 1 — Tokens.css 三层落地（primitive / semantic / component + 多端 + 移动端）

- [ ] 1. Tokens.css 三层 + 多端断点 + 移动端钩子
  - 设计 §A.1 / §A.2 / §C.1 / §C.2 / §C.3 / §C.4 / §D.5.1 / §D.4.6 落地。

  - [ ] 1.1 Primitive layer（color scales / spacing / radius / font / weight / shadow / easing / duration）
    - 依赖：无。
    - 产出物：`packages/design-system/src/tokens.css`（新建 §1 primitive 区块）。
    - 验收：tokens.css `:root` 块含全部 §C.1.1–C.1.7 token；node script 校验 token 名集合与 design §C.1 表格一致。
    - 回滚：`git revert <sha>` 即恢复无 V5 token 状态，V4 仍可用。
    - _Requirements: 1.2, 2.1, 3.1, 3.2, 4.1, 5.1, 5.3, 6.1_

  - [ ] 1.2 Semantic layer（light 默认 + dark 覆写 + categorical 题型色）
    - 依赖：1.1。
    - 产出物：`packages/design-system/src/tokens.css` §2 semantic light + §3 semantic dark 区块。
    - 验收：`.dark` 与 `:root` semantic key 集合 diff 后必须完全一致（CP.2）；axe 跑首页 demo HTML 检查 ink-on-paper 对比度 ≥ 4.5:1。
    - 回滚：`git revert <sha>`，dark 主题失效但 V5 primitive 仍存。
    - _Requirements: 1.3, 1.5, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 1.3 Property test for token theme stability
    - **Property 2: Theme Switching Stability**
    - **Validates: Requirements 1.4, 1.5**
    - 产出物：`packages/design-system/scripts/check-theme-keys.mjs` + `packages/design-system/src/__tests__/theme-keys.test.ts`。
    - 验收：脚本 diff `:root` vs `.dark` 的 semantic key 集合，0 差异通过；diff 出 primitive / component key 即报错。
    - 回滚：删除脚本与 test。
    - _Requirements: 1.4, 1.5_

  - [ ] 1.4 Component layer（card / button / input / row / topbar / rail / z-index / exam hooks）
    - 依赖：1.2。
    - 产出物：`packages/design-system/src/tokens.css` §4 component 区块（含 §D.4.6 exam hooks `--exam-pane-padding` / `--exam-divider-handle-w` / `--exam-topbar-h`）。
    - 验收：lint-radius-token / lint-shadow-token 跑空仓不报错；component 层不被 dark 覆写（CP.2）。
    - 回滚：`git revert <sha>`。
    - _Requirements: 1.4, 3.1, 4.4, 6.3, 7.1, 8.2, 9.5_

  - [ ] 1.5 Breakpoints + max-w-workspace + safe-area
    - 依赖：1.4。
    - 产出物：tokens.css §5 breakpoint 与限宽区块；`--max-w-workspace = none`（`SIK-128` Route A supersede） / `--max-w-reading 720` / `--max-w-form 560` / `--max-w-modal 640` / `--max-w-prose 800`；safe-area `env()` 注册。
    - 验收：浏览器 1920 / 1440 / 1280 / 1024 / 768 / 480 / 375 各档加载 demo HTML，验证 shared workspace 无 hidden 1440 cap；safe-area 在 iOS 模拟器命中。
    - 回滚：`git revert <sha>`，限宽失效但 token 不会被业务引用所以无破坏。
    - _Requirements: 4.1, 4.2, 4.3, 9.5, 10.1_

  - [ ] 1.6 Mobile-only tokens + Rail collapse 状态变量
    - 依赖：1.5。
    - 产出物：tokens.css §6 mobile（`--mobile-topbar-h` 48 / `--mobile-bottom-nav-h` 64 / `--mobile-rail-drawer-w` 280 / `--touch-target-min` 40 / `--sheet-handle-*`） + §7 rail collapse（`--rail-w-expanded` 240 / `--rail-w-collapsed` 80，由 `:root[data-rail="collapsed"]` 切换 `--rail-w`）。
    - 验收：手动切换 `data-rail` attribute 验证 `--rail-w` 切到 80；`prefers-reduced-motion` 下 transition 缩短。
    - 回滚：`git revert <sha>`。
    - _Requirements: 9.1, 10.1, 10.3_

  - [ ] 1.7 ~~V4 token alias 层 + @deprecated 标注（双轨期开始）~~ — **ARCHIVED 2026-05-24（V5-M0.5 big-bang）**
    - 依赖：1.4。
    - **作废原因**：big-bang 重建后无 V4 surface 需要兼容；tokens.css §8 V4 alias 区块在 V5-M0.5 commit ② 一并删除。
    - 历史产出物：~~tokens.css §8 V4 alias 区块——所有 V4 token 名通过 `var(--v5-name)` 间接引用~~（已删除）。
    - 替代规则：V4 token 名 (`--paper-* / --ink-* / --brand-yellow / --r-*` 等) 在 V5 SSOT 全部消失，达成 REQ-1.6 字面要求。

- [ ] 2. Phase 1 检查点 — Token 落地后人工 review
  - 跑 `node packages/design-system/scripts/check-theme-keys.mjs`、本地 `pnpm --filter @sikao/design-system build`、本地 `pnpm --filter @sikao/web dev`（port 18080），人工验证 V4 页面无视觉退化。
  - 有疑问问 user，疑问解除前不进入 Phase 2。

### Phase 2 — Lint Gates 新增 6 脚本（接入 pnpm lint）

设计 §T.1 落地。每个 lint 是独立 commit；脚本风格沿用 `apps/web/scripts/lint-*.mjs`（Node ESM + 直接遍历 `apps/**/src/**`）。

- [ ] 3. lint-shadow-token.mjs
  - 依赖：1.4。
  - 产出物：`apps/web/scripts/lint-shadow-token.mjs` + `apps/web/package.json` 接入 `lint:shadow` 脚本 + 合并到 `pnpm lint`。
  - 行为：扫 `apps/**/src/**/*.{css,scss,ts,tsx,js,jsx}` 中 `box-shadow:` 后跟非 `var(--shadow-` 字面量；命中即 fail。
  - 验收：跑当前 V5 demo HTML 应通过；故意写 `box-shadow: 0 1px 2px #000` 应被拦截。
  - 回滚：`git revert <sha>` 删除脚本。
  - _Requirements: 6.4_

  - [ ]* 3.1 Property test for shadow lint
    - **Property 1: Token Single Source Invariant (shadow 维度)**
    - **Validates: Requirements 1.1, 6.4**
    - 产出物：`apps/web/scripts/__tests__/lint-shadow-token.test.mjs`（fixtures：合规样本 + 反例样本）。
    - 验收：合规样本 0 命中；反例样本必命中且报告行号。
    - _Requirements: 6.4_

- [ ] 4. lint-zindex-token.mjs
  - 依赖：1.4。
  - 产出物：`apps/web/scripts/lint-zindex-token.mjs` + 接入 `pnpm lint`。
  - 行为：扫 `z-index: <num>` 字面量；只允许 `var(--z-*)`。
  - 验收：合规样本通过；反例 `z-index: 999` 拦截。
  - 回滚：`git revert <sha>`。
  - _Requirements: 6.4_

  - [ ]* 4.1 Property test for z-index lint
    - **Property 1: Token Single Source Invariant (z-index 维度)**
    - **Validates: Requirements 1.1, 6.4**
    - 产出物：`apps/web/scripts/__tests__/lint-zindex-token.test.mjs`。
    - _Requirements: 6.4_

- [ ] 5. lint-spacing-token.mjs
  - 依赖：1.1。
  - 产出物：`apps/web/scripts/lint-spacing-token.mjs` + 接入 `pnpm lint`。
  - 行为：扫 `padding|margin|gap` 后的硬编码 `Npx` / `Nrem`；豁免 0 / `auto` / `var(--space-*)` / Tailwind 间距类（在 className 中）。
  - 验收：合规样本通过；反例 `padding: 12px` 拦截，但 `padding: var(--space-3)` / `className="p-3"` 通过。
  - 回滚：`git revert <sha>`。
  - _Requirements: 4.5_

  - [ ]* 5.1 Property test for spacing lint
    - **Property 1: Token Single Source Invariant (spacing 维度)**
    - **Validates: Requirements 1.1, 4.5**
    - _Requirements: 4.5_

- [ ] 6. lint-icon-style.mjs
  - 依赖：无（纯 SVG 风格扫描）。
  - 产出物：`apps/web/scripts/lint-icon-style.mjs` + 接入 `pnpm lint`。
  - 行为：扫 `packages/design-system/src/icons/*.svg` 与 `apps/**/src/**/*.svg`；强制 `viewBox="0 0 24 24"`、`stroke-linecap="round"` / `stroke-linejoin="round"`、`fill="none"`、`stroke="currentColor"`、stroke-width ∈ {1.5, 1.6, 1.7, 1.8, 2.0}（按尺寸档 §C.5.1）；豁免 `*Filled.svg` 与品牌 Logo。
  - 验收：现存 `apps/web/public/icons.svg` 跑过（如不通过须先做 P3 资产收敛任务）；故意改一个 SVG 的 viewBox 应被拦截。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.1, 8.6_

  - [ ]* 6.1 Property test for icon style lint
    - **Property 5: SVG-Only Icon Invariant (style 维度)**
    - **Validates: Requirements 1.1, 8.6**
    - _Requirements: 1.1, 8.6_

- [ ] 7. lint-touch-target.mjs
  - 依赖：无。
  - 产出物：`apps/web/scripts/lint-touch-target.mjs` + 接入 `pnpm lint`。
  - 行为：扫 `*.{css,scss,ts,tsx}` 中所有 `:hover` 选择器，必须包裹在 `@media (hover: hover) and (pointer: fine)` 之内；额外检查 `min-height` / `min-width` 在 `[data-role="touch-target"]` 元素上 ≥ 40px。
  - 验收：合规样本通过；裸 `.btn:hover` 不在 hover-capable media query 内 → 拦截。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 10.1_

  - [ ]* 7.1 Property test for hover-touch lint
    - **Property 9: Hover-Touch Affordance**
    - **Validates: Requirements 8.1, 10.1**
    - _Requirements: 8.1, 10.1_

- [ ] 8. lint-v4-token-residual.mjs（**降级 OPTIONAL，2026-05-24 V5-M0.5**）
  - 依赖：~~1.7~~（已 ARCHIVED）；改为依赖 V5-M0.5 commit ② 完成。
  - 产出物：`apps/web/scripts/lint-v4-token-residual.mjs` + 接入 `pnpm lint:v4-residual`（默认 error，big-bang 后必须 0 命中）。
  - 行为：扫 V4 token 名（`--paper-*` / `--ink-*` / `--brand-yellow*` / `--ok` / `--warn` / `--err` / `--info` / `--r-*` / `--sp-*` / `--t-*` / `--h-xs..lg` / `--row-h` 等）出现位置；在 `apps/**/src/**` 命中即记录。
  - **2026-05-24 调整**：big-bang 后 V4 token 残留是"删除事实保证"，本 lint 改为 regression guard（防止后续误引入 V4 名）；不再有 sunset 时间约束。
  - 验收：合规样本（V5-M0.5 commit ⑤ 后空仓）通过；故意写 `var(--paper-1)` 拦截。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.6, ~~12.1, 12.2~~（REQ-12 ARCHIVED）_

  - [ ]* 8.1 Property test for V4 residual lint
    - **Property 8: V4 Token Residual Convergence**
    - **Validates: Requirements 1.6, 12.1, 12.2**
    - _Requirements: 1.6, 12.1, 12.2_

- [ ] 9. Phase 2 检查点 — 6 lint 全接入 pnpm lint
  - 跑 `pnpm --filter @sikao/web lint` 必须 PASS（V4 残留豁免阶段 warn）。问 user 确认进入 Phase 3。

### Phase 3 — 35 个组件骨架（D.3.1–D.3.35，按依赖：base → composite → layout → domain）

每个组件 sub-task 一个 commit，含 `<Component>.tsx` + `<Component>.module.css`（或 vanilla CSS）+ `index.ts` 出口 + `<Component>.test.tsx`（unit test 必跑）。文件落点 `apps/web/src/components/<group>/<Component>/`。骨架不绑业务态、不接 API；只暴露 prop API（按 design §D.3）+ 状态机视觉。

#### 10. 系统层与浮层基础（依赖 Phase 1 token；后续所有组件依赖此组）

- [ ] 10.1 D.3.34 a11y 系统层 — VisuallyHidden / FocusTrap / Divider / KeyboardShortcuts
  - 依赖：1.4。
  - 产出物：`apps/web/src/components/system/{VisuallyHidden,FocusTrap,Divider,KeyboardShortcuts}/` 各组件骨架 + `index.ts` 聚合出口 `apps/web/src/components/system/index.ts`。
  - 验收：jest unit test 跑 KeyboardShortcuts 监听 Ctrl+\ 触发；FocusTrap active 时 tab 不逃出容器。
  - 回滚：`git revert <sha>`，无业务依赖故无影响。
  - _Requirements: 10.1, 10.7_

- [ ] 10.2 D.3.20 Popover
  - 依赖：10.1。
  - 产出物：`apps/web/src/components/overlay/Popover/`。
  - 验收：unit test 验证 `closeOnClickOutside` / `side` / `align` 行为；axe 检查 `aria-haspopup`。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 10.3 D.3.19 Tooltip
  - 依赖：10.2。
  - 产出物：`apps/web/src/components/overlay/Tooltip/`。
  - 验收：unit test 验证 hover-capable media query 内才触发；触屏 emulate 下不渲染。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 10.1_

#### 11. 视觉原子（依赖 10）

- [ ] 11.1 D.3.18 Avatar
  - 依赖：10.1。
  - 产出物：`apps/web/src/components/atom/Avatar/`。
  - 验收：unit test 验证 `fallback` 必填、`status` dot 描边、`alt` 非装饰性时报错。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 10.1_

- [ ] 11.2 D.3.8 Badge / Tag / Chip
  - 依赖：10.1。
  - 产出物：`apps/web/src/components/atom/Badge/` + `Tag/` + `Chip/`。
  - 验收：unit test 验证 11 种 variant（含 5 个 cat-*）；onRemove 正常触发。
  - 回滚：`git revert <sha>`。
  - _Requirements: 2.5, 8.1_

- [ ] 11.3 D.3.9 Numeric
  - 依赖：10.1。
  - 产出物：`apps/web/src/components/atom/Numeric/`。
  - 验收：unit test 验证 `tabular-nums` className 注入、`thousand` 千位分隔、`trend` 自动连 ok/err 色 + ▲/▼ 图标。
  - 回滚：`git revert <sha>`。
  - _Requirements: 5.5, 8.5_

- [ ] 11.4 D.3.27 Progress（线性 + 环形）
  - 依赖：10.1。
  - 产出物：`apps/web/src/components/atom/ProgressLinear/` + `ProgressRing/`。
  - 验收：unit test 验证 `value` clamp 0-100、`indeterminate` 渲染 spin keyframes、环形 `strokeDasharray` 计算正确。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 11.5 D.3.10 EmptyState + Skeleton
  - 依赖：10.1。
  - 产出物：`apps/web/src/components/atom/EmptyState/` + `Skeleton/`。
  - 验收：unit test 验证 4 种 illustration 渲染 SVG（不是 emoji）；`prefers-reduced-motion` 下 Skeleton 退化为静态 opacity 循环。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 10.3_

#### 12. 表单与列表原子（依赖 10、11）

- [ ] 12.1 D.3.1 Button
  - 依赖：10.3, 11.5。
  - 产出物：`apps/web/src/components/form/Button/`。
  - 验收：unit test 验证 5 variant × 6 状态、icon-only 必带 `aria-label`、`loading` 自动禁点击；render 时 `cursor: pointer` + `background: none` + `border: 0`（D.3.35 gotcha）。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 12.2 D.3.2 Input
  - 依赖：10.1。
  - 产出物：`apps/web/src/components/form/Input/`。
  - 验收：unit test 验证 7 状态、`box-sizing: border-box` + `min-width: 0`（D.3.35 gotcha）；`prefix` / `suffix` slot 正常渲染。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 12.3 D.3.11 Textarea
  - 依赖：12.2。
  - 产出物：`apps/web/src/components/form/Textarea/`。
  - 验收：unit test 验证 `autosize` 行数边界、`showCount` 90% 阈值变 warn 色、`box-sizing: border-box`。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 12.4 D.3.12 Radio / Checkbox / Switch
  - 依赖：12.1。
  - 产出物：`apps/web/src/components/form/{Radio,Checkbox,Switch}/`。
  - 验收：unit test 验证 Checkbox `indeterminate` 状态、focus-visible ring、Switch keyboard 切换。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 12.5 D.3.13 Select / Combobox
  - 依赖：10.2, 12.2。
  - 产出物：`apps/web/src/components/form/Select/`。
  - 验收：unit test 验证 closed/focus/open/searching/selected/disabled 6 状态；Combobox `searchable` 渲染输入框。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 12.6 D.3.14 DatePicker / TimePicker
  - 依赖：10.2, 12.5。
  - 产出物：`apps/web/src/components/form/{DatePicker,TimePicker}/`。
  - 验收：unit test 验证 `presets`（今天/明天/下周一/考试日）、`format` 输出、`min/max` 边界；TimePicker `step` 5/10/15/30/60 分钟。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 12.7 D.3.15 Slider
  - 依赖：12.4。
  - 产出物：`apps/web/src/components/form/Slider/`。
  - 验收：unit test 验证 `marks`（字号档：标准/大字/特大/紧凑）渲染、键盘 ←/→ 步进、`disabled` 视觉。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 12.8 D.3.16 FormField / FormItem 包装器
  - 依赖：12.2, 12.3, 12.4, 12.5, 12.6, 12.7。
  - 产出物：`apps/web/src/components/form/FormField/`。
  - 验收：unit test 验证 `required` 显示 *、`error` / `helper` 互斥、`htmlFor` 关联控件；axe 检查 label-control 关系。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 10.7_

- [ ] 12.9 D.3.17 Search
  - 依赖：12.2, 11.5。
  - 产出物：`apps/web/src/components/form/Search/`。
  - 验收：unit test 验证 `clearable` 显示 X 按钮（值非空时）、`suggestions` 下拉、`onSubmit` Enter 触发。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 12.10 D.3.4 ListItem
  - 依赖：11.1, 11.2。
  - 产出物：`apps/web/src/components/list/ListItem/`。
  - 验收：unit test 验证 6 状态、`size sm/md/lg` 对应 `--row-h-*`、`draggable` 时含 drag-handle；`@media (hover: hover)` 内 hover 视觉（CP.9）。
  - 回滚：`git revert <sha>`。
  - _Requirements: 4.4, 8.1, 10.1_

- [ ] 12.11 D.3.3 Tabs（含 SegmentedControl 合并 + ScopeToggle 业务别名）
  - 依赖：11.2, 12.1。
  - 产出物：`apps/web/src/components/nav/Tabs/`（contains 3 variant: underline / pill / segmented）+ `apps/web/src/components/business/ScopeToggle/`（语义化 wrap，底层是 `<Tabs variant="segmented">`）。
  - 验收：unit test 验证 3 variant × 4 状态；ScopeToggle 行测/申论 切换正常；不允许独立 SegmentedControl 实现（R2/Q2 决策）。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

#### 13. 浮层与容器（依赖 10、12）

- [ ] 13.1 D.3.6 Modal
  - 依赖：10.1, 12.1。
  - 产出物：`apps/web/src/components/overlay/Modal/`。
  - 验收：unit test 验证 4 状态、FocusTrap 集成、body scroll lock（D.3.35 gotcha）；`size sm/md/lg` 对应 360/480/640 px；`closeOnOverlay` danger 场景设 false。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 10.1_

- [ ] 13.2 D.3.5 Sheet（半屏 / 全屏）
  - 依赖：13.1。
  - 产出物：`apps/web/src/components/overlay/Sheet/`。
  - 验收：unit test 验证 5 状态（closed/opening/open/dragging/closing）、半屏 `auto` 内容驱动高度、顶部 `--card-radius-lg` 仅顶部两角；`prefers-reduced-motion` 下 transition 0ms。
  - 回滚：`git revert <sha>`。
  - _Requirements: 7.1, 8.1, 10.3_

- [ ] 13.3 D.3.21 Drawer（**Note 详情专用 + Modal 替代**，R2/Q1 决策）
  - 依赖：13.1。
  - 产出物：`apps/web/src/components/overlay/Drawer/`。
  - 验收：unit test 验证 `side left/right/top/bottom`、`size sm/md/lg/full`、桌面 `right` / 移动端自动转 `<Sheet side="bottom">`；body scroll lock。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 9.3_

- [ ] 13.4 D.3.22 ConfirmDialog
  - 依赖：13.1。
  - 产出物：`apps/web/src/components/overlay/ConfirmDialog/`。
  - 验收：unit test 验证 `destructive` 时 confirm 按钮 danger variant、`loading` 处理中禁点击、Esc 关闭由 KeyboardShortcuts modal scope 注册（D.3.34）。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 13.5 D.3.7 Toast（含 ToastProvider）
  - 依赖：10.1, 11.2。
  - 产出物：`apps/web/src/components/overlay/Toast/` + `apps/web/src/components/overlay/ToastProvider/`。
  - 验收：unit test 验证 4 variant、`duration` 默认 3000 / err 默认 5000、左侧 4px 状态色条；多个 toast 堆叠不重叠。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 13.6 D.3.23 Banner / Alert
  - 依赖：11.2, 12.1。
  - 产出物：`apps/web/src/components/overlay/Banner/`。
  - 验收：unit test 验证 4 variant、`dismissible` X 关闭、出现位置 = Topbar 下方全宽。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 13.7 D.3.24 Pagination
  - 依赖：12.1, 12.5。
  - 产出物：`apps/web/src/components/nav/Pagination/`。
  - 验收：unit test 验证紧凑模式与常规模式渲染、`showSizeChanger` / `showJumper` 切换、`current` 1-based 边界。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1_

- [ ] 13.8 D.3.25 Breadcrumb
  - 依赖：11.1。
  - 产出物：`apps/web/src/components/nav/Breadcrumb/`。
  - 验收：unit test 验证 `maxItems` 收成 "首页 / ... / 当前"、768px 以下隐藏。
  - 回滚：`git revert <sha>`。
  - _Requirements: 9.7, 10.6_

- [ ] 13.9 D.3.26 CommandPalette
  - 依赖：13.1, 12.9。
  - 产出物：`apps/web/src/components/overlay/CommandPalette/`。
  - 验收：unit test 验证 Ctrl+K / ⌘K 触发、↑↓ 导航、Enter 选中、Esc 关闭；axe 检查 listbox role。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 10.7_

#### 14. Layout 三件套 + 容器三件套（依赖 10–13）

- [ ] 14.1 D.3.32 AppShell + Rail + Workspace（含折叠状态机）
  - 依赖：10.1, 10.3, 13.3。
  - 产出物：`apps/web/src/components/layout/AppShell/` + `apps/web/src/components/layout/Rail/`（含 RailBrand / RailCmd / RailNav / RailMe 子组件）+ `apps/web/src/components/layout/Workspace/`。
  - 验收：
    - unit test 验证 Rail 折叠状态机（C.4.3）：1024–1279 默认折叠、≥1280 默认展开、localStorage `v5-rail-collapsed` 持久化、Ctrl/Cmd+\ 切换；
    - 折叠态 Toggle 按钮 `display: none`、整个 brand 区可点击展开、Logo 居中对齐 nav-btn 图标垂直中线；
    - workspace 列数稳定（折叠不重排）；
    - Workspace `maxWidth="workspace"` 在 1920 屏居中限到 1440；
    - 移动端不渲染 Rail（`<--bp-md`）。
  - 回滚：`git revert <sha>`。
  - _Requirements: 4.2, 9.1, 9.2, 9.3, 9.4, 10.1, 10.6_

  - [ ]* 14.1a Property test for Rail collapse state machine
    - **Property 10: Multi-device Continuity**
    - **Validates: Requirements 4.1, 4.4, 9.1, 9.2, 9.3, 9.4, 10.6**
    - 产出物：`apps/web/src/components/layout/Rail/__tests__/Rail.collapse.test.tsx`。
    - _Requirements: 9.1, 10.6_

- [ ] 14.2 D.3.33 Panel + PageHeader + Section
  - 依赖：14.1, 11.2。
  - 产出物：`apps/web/src/components/layout/{Panel,PageHeader,Section}/`。
  - 验收：unit test 验证 Panel `variant="danger"` 边框红、`noPadding` 切换、Section `spacing` 三档间距；axe 检查 PageHeader landmark role。
  - 回滚：`git revert <sha>`。
  - _Requirements: 7.1, 7.3, 9.1, 9.2, 9.3, 9.4_

- [ ] 14.3 Mobile Shell — MobileAppShell / MobileTopBar / BottomTabBar（玻璃拟态 + fail-fast 例外登记）
  - 依赖：14.1, 13.3。
  - 产出物：
    - `apps/web/src/components/layout/MobileAppShell/`；
    - `apps/web/src/components/layout/MobileTopBar/`；
    - `apps/web/src/components/layout/BottomTabBar/`（含 §E.1 玻璃拟态默认 + `@supports not (backdrop-filter)` 自动降级 + `prefers-reduced-transparency: reduce` 降级）；
    - **`docs/engineering/fail-fast-exceptions.md` 追加 `mobile-bottom-nav-glassmorphism-fallback` 例外条目**（按 requirements §7.3 草案字段：name / 位置 / 默认行为 / 降级触发 / 降级目标 / 负责人 lhr / 复审日期 2026-08-23）。
  - 验收：
    - playwright 模拟 `prefers-reduced-transparency: reduce` 截图回归 → 必须降级到不透明 `--color-bg-elevated`；
    - 旧 WebView UA 模拟（不支持 backdrop-filter）→ 降级生效；
    - safe-area `env()` 在 iOS 模拟器命中；
    - fail-fast 例外账本记录可被 `grep mobile-bottom-nav-glassmorphism-fallback docs/engineering/fail-fast-exceptions.md` 命中。
  - 回滚：`git revert <sha>` 同时撤销 fail-fast-exceptions.md 追加段。
  - _Requirements: 8.4, 9.1, 9.2, 9.3, 9.4, 10.1_

  - [ ]* 14.3a Property test for glassmorphism fallback
    - **Property 7: Glassmorphism Fallback Closure**
    - **Validates: Requirements 8.4**
    - 产出物：`apps/web/src/components/layout/BottomTabBar/__tests__/glass-fallback.test.tsx` + 配套 playwright 截图对比。
    - 验收：模拟 `@supports not (backdrop-filter)` 与 `prefers-reduced-transparency: reduce` 各自截图必须显示不透明背景，文字与下层无重叠。
    - _Requirements: 8.4_

#### 15. 业务专属组件（答题系统 + Exam，依赖 14）

- [ ] 15.1 D.3.28 OptionItem（答题选项 ABCD）
  - 依赖：12.4（视觉风格借鉴但禁止直接复用 Radio）, 11.2。
  - 产出物：`apps/web/src/components/business/OptionItem/`。
  - 验收：unit test 验证 6 状态视觉（rest / selected / correct / wrong / disabled / reviewing）、`reviewing` 同时高亮 correct + 用户错选项；axe 检查 button role + `aria-pressed`。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.1, 8.6_

- [ ] 15.2 D.3.29 QuestionStem
  - 依赖：14.2, 12.7。
  - 产出物：`apps/web/src/components/business/QuestionStem/`。
  - 验收：unit test 验证 `fontSize 14/15/17/19` 与 D.3.15 Slider 联动、`enableSelection` 选词高亮、`marks` 渲染位置正确。
  - 回滚：`git revert <sha>`。
  - _Requirements: 5.1, 5.2, 8.6_

- [ ] 15.3 D.3.30 AnswerSheet
  - 依赖：15.1, 11.2。
  - 产出物：`apps/web/src/components/business/AnswerSheet/`。
  - 验收：unit test 验证 4 状态色（unanswered / answered / marked / current）、`onJump` 回调、键盘 ↑↓←→ 导航。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.6_

- [ ] 15.4 D.3.31 TimerDisplay
  - 依赖：11.3。
  - 产出物：`apps/web/src/components/business/TimerDisplay/`。
  - 验收：unit test 验证 `warningThreshold` 进入 warn 色、归零变 err 色、`paused` 暂停 onTick；等宽数字 `tabular-nums`。
  - 回滚：`git revert <sha>`。
  - _Requirements: 5.5, 8.6, 9.5_

- [ ] 15.5 ExamLayout 容器钩子（D.4.6，仅骨架 + token，不写交互）
  - 依赖：14.2, 13.2。
  - 产出物：`apps/web/src/layouts/ExamLayout/`（含 ExamTopBar slot + PanelGroup + ResizeHandle + Sheet 槽位；不实现 resize 拖拽与计时器逻辑——交独立 Exam spec）。
  - 验收：unit test 验证 ExamLayout 不嵌套 `<AppShell>` / `<Rail>`（D.3.35 gotcha 强制约束）、`--exam-pane-padding` / `--exam-divider-handle-w` token 应用正确。
  - 回滚：`git revert <sha>`。
  - _Requirements: 9.5_

- [ ] 16. Phase 3 检查点 — 35 组件骨架全绿 + axe 自动化跑通
  - 跑 `pnpm --filter @sikao/web test` 全部 unit 必须 PASS；`pnpm --filter @sikao/web lint` 包含 6 新 lint 必须 PASS（V4 残留 warn 豁免）；问 user 确认进入 Phase 4。

### Phase 4 — 6 个桌面页面骨架（Home / Practice / Note / Me / Question Hub / Review）

每页一个 commit；只搭骨架（容器树 + 占位数据 + Empty / Loading 态），不接 API。落点 `apps/web/src/views/<Page>/`。

- [ ] 17.1 Home 页面骨架（D.4.1）
  - 依赖：14.1, 14.2, 11.3, 12.10, 13.5。
  - 产出物：`apps/web/src/views/Home/`（含 4 metric-row + Calendar Panel 占位 + 底栏 3 卡片）；路由接入 `apps/web/src/router/`。
  - 验收：lint 全绿；本地 dev (port 18080) 渲染无视觉退化；axe 跑首页对比度 ≥ 4.5:1；`prefers-reduced-motion` 模拟下卡片 hover 无位移。
  - 回滚：`git revert <sha>`，路由回退到 V4 Home。
  - _Requirements: 4.3, 7.1, 7.2, 9.1, 10.2, 10.3_

- [ ] 17.2 Practice 页面骨架（D.4.2，含 ScopeToggle 行测/申论）
  - 依赖：14.1, 14.2, 12.11, 11.4。
  - 产出物：`apps/web/src/views/Practice/`（quick-grid 2×2 + 最近练习 list + 专项 4 列网格 + 套卷 4 列网格）。
  - 验收：lint 全绿；ScopeToggle 切换行测/申论副标更新；`@media (max-height: 800px)` row1 收紧到 192px；axe 全绿。
  - 回滚：`git revert <sha>`。
  - _Requirements: 4.3, 7.1, 7.2, 9.2, 10.2_

- [ ] 17.3 Note 页面骨架（D.4.3，**Drawer 详情，R2/Q1 决策**）
  - 依赖：14.1, 14.2, 13.3, 11.2, 12.9。
  - 产出物：`apps/web/src/views/Note/`（FilterBar 来源 chip + sub-bar + sticky 卡片墙带微旋转 + Drawer 详情入口）。
  - 验收：
    - lint 全绿；
    - 点击卡片打开 `<Drawer side="right" size="lg">`，**禁止用 Modal**（D.3.35 gotcha 校验）；
    - 移动端模拟下自动转 `<Sheet side="bottom">`；
    - sticky 卡片 inline `--tilt` 微旋转 hover 归零；
    - 来源 chip 高亮态使用反色实心黑 chip。
  - 回滚：`git revert <sha>`。
  - _Requirements: 5.6, 7.1, 7.2, 7.4, 9.3_

- [ ] 17.4 Me 页面骨架（D.4.4，含危险操作 Panel）
  - 依赖：14.1, 14.2, 11.1, 12.10, 13.4。
  - 产出物：`apps/web/src/views/Me/`（MeHero stat-card 横排 3 numeric + 学习设置 + 账号 + 危险操作 Panel `variant="danger"` 跨满底行）。
  - 验收：lint 全绿；危险操作 list-card variant=danger 左侧 4px err 条 + 全行 err 文字色仅在 danger panel 内生效；点击注销触发 ConfirmDialog。
  - 回滚：`git revert <sha>`。
  - _Requirements: 7.1, 7.2, 9.4_

- [ ] 17.5 Question Hub 页面骨架（D.4.5）
  - 依赖：14.1, 14.2, 11.2, 13.7。
  - 产出物：`apps/web/src/views/QuestionHub/`（FilterBar chips 多选：科目 / 题型 / 错题状态 + compact-card 3 列网格）。
  - 验收：lint 全绿；compact-card 用 `--card-radius-sm` (12px) 提升信息密度；Pagination 紧凑模式渲染。
  - 回滚：`git revert <sha>`。
  - _Requirements: 7.1, 9.6_

- [ ] 17.6 Review 页面骨架（D.4.5 同 Hub 风格 + 复习日历）
  - 依赖：17.5, 12.6。
  - 产出物：`apps/web/src/views/Review/`（错题筛选条 + 复习日历 + 紧凑 3 列网格）。
  - 验收：lint 全绿；DatePicker 集成 `presets`（今天/明天/下周一）；compact-card 与 Hub 同密度。
  - 回滚：`git revert <sha>`。
  - _Requirements: 7.1, 9.6_

- [ ] 18. Phase 4 检查点 — 6 桌面页全绿 + axe a11y 全绿
  - 跑 `pnpm --filter @sikao/web test`、`pnpm --filter @sikao/web lint`、`pnpm --filter @sikao/web test:a11y`；问 user 确认进入 Phase 5。

### Phase 5 — SVG 资产收敛（答题系统 14 + 导航 8 + 状态指示等）

按 §C.5.4 / §C.5.4b 命名固化；每批 5–8 个图标一个 commit（≤15 文件）；落点 `packages/design-system/src/icons/<icon-name>.svg`；构建期合并到 `apps/web/public/icons.svg`。每个 SVG 必跑 `lint-icon-style.mjs`（任务 6）。

- [ ] 19.1 答题系统图标 batch A（导航类 6 个）
  - 依赖：6（lint-icon-style）。
  - 产出物：`packages/design-system/src/icons/{chevron-left,chevron-right,bookmark,highlighter,trash,timer}.svg` + 同步更新 `apps/web/public/icons.svg` sprite。
  - 验收：lint-icon-style 跑过；浏览器加载 `<svg><use href="/icons.svg#chevron-left" /></svg>` 显示正确并继承 currentColor。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.1, 8.6_

- [ ] 19.2 答题系统图标 batch B（控制类 5 个）
  - 依赖：19.1。
  - 产出物：`packages/design-system/src/icons/{pause,play,type,scratch-pad,submit}.svg` + sprite 更新。
  - 验收：lint-icon-style 跑过；`IconSubmit`（飞机 paper-plane）形态符合设计 §C.5.4。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.1, 8.6_

- [ ] 19.3 答题系统图标 batch C（辅助类 3 个）
  - 依赖：19.2。
  - 产出物：`packages/design-system/src/icons/{answer-sheet,notebook,settings,exit}.svg`（共 4 个，仍 ≤15 文件）。
  - 验收：lint-icon-style 跑过。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.1, 8.6_

- [ ] 19.4 导航辅助图标（Rail 专用 3 个）
  - 依赖：19.3。
  - 产出物：`packages/design-system/src/icons/{rail-toggle,search,burger}.svg` + sprite 更新。
  - 验收：lint-icon-style 跑过；`IconRailToggle` 24×24 viewBox 内含矩形 + 内嵌左指箭头，折叠态 `transform: rotate(180deg)` 兼容（即使 V5 折叠态隐藏 toggle，但 hover brand 区瞬间状态依赖此变换）。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.1, 8.6, 9.1_

- [ ] 19.5 状态指示图标（Outline + Filled 双版本各 4 对，共 8 个）
  - 依赖：19.4。
  - 产出物：`packages/design-system/src/icons/{check,close,warning,info}.svg` + 同名 `*-filled.svg`。
  - 验收：lint-icon-style 跑过（Filled 变体豁免 stroke 校验，但 fill 必须 `currentColor`）；`OptionItem` correct/wrong 状态正确加载 Filled 版本。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.1, 8.6_

- [ ] 19.6 题型分类图标（5 cat-* + Rail nav 5 + 其他通用 5）
  - 依赖：19.5。
  - 产出物：`packages/design-system/src/icons/{cat-yanyu,cat-shuliang,cat-panduan,cat-ziliao,cat-shenlun,nav-home,nav-practice,nav-review,nav-note,nav-question}.svg` 共 10 个（拆 2 commit 各 5 个，避免单 commit > 15 文件）。
    - 19.6a `cat-*.svg` 5 个
    - 19.6b `nav-*.svg` 5 个
  - 验收：lint-icon-style 跑过；Rail nav 图标在 18px stroke-width 1.7 渲染居中。
  - 回滚：`git revert <sha>`。
  - _Requirements: 1.1, 8.6_

  - [ ]* 19.7 Property test for SVG-only icon invariant
    - **Property 5: SVG-Only Icon Invariant**
    - **Validates: Requirements 1.1, 8.6**
    - 产出物：`apps/web/scripts/__tests__/svg-only.test.mjs`（fixtures：合规 vs 反例如 emoji 图标 / icon-font / PNG icon）。
    - 验收：合规通过；emoji `<span>📝</span>` 命中 `lint-no-emoji-as-icon`；PNG `<img src="icon.png">` 命中 `lint-practice-svg-only`。
    - _Requirements: 1.1, 8.6_

- [ ] 20. Phase 5 检查点 — SVG 资产全绿
  - 跑 `pnpm --filter @sikao/web lint`（含 lint-icon-style / lint-practice-svg-only / lint-no-emoji-as-icon）必须全 PASS；浏览器目检 sprite。问 user 进入 Phase 6。

### Phase 6 — ~~V4→V5 Token 迁移 + 残留扫描~~ — **ARCHIVED 2026-05-24（V5-M0.5 big-bang rebuild）**

> **整章作废**：lhr 拍板 big-bang 重建，apps/web 业务层与 packages/ui 整包删除，没有 V4 surface 需要切换、没有 V4 alias 需要 sunset。
>
> 替代规则：V5 spec 落地后，业务 Phase（Home / Practice / Notes / Review / Profile / Marketing）直接消费 V5 规范从零实现，不走"surface 切换"中间步骤。
>
> 影响 sub-task：21.1a-g、21.2、21.3、21.3a 全部 ARCHIVED。
>
> 历史内容保留作记录，**不作为 V5 实现的输入**。

- [ ] ~~21.1 全量替换 V4 token 引用（按页面 surface 整页切换，不允许局部混用，REQ-12.4）~~ — ARCHIVED
  - 依赖：1.7, 17.x。
  - 产出物：把 `apps/web/src/{styles,views,components,layouts}/**` 中的 V4 token 引用（`var(--paper-1)` / `var(--ink-2)` / `var(--brand-yellow)` 等）替换为 V5 名（`var(--color-bg-surface)` / `var(--color-text-secondary)` / `var(--color-brand-primary)`）；按 surface 拆 commit（每 surface 一个 commit，≤15 文件）：
    - 21.1a `apps/web/src/styles/**` 全局样式替换
    - 21.1b `apps/web/src/views/Home/**` 整页切换
    - 21.1c `apps/web/src/views/Practice/**`
    - 21.1d `apps/web/src/views/Note/**`
    - 21.1e `apps/web/src/views/Me/**`
    - 21.1f `apps/web/src/views/{QuestionHub,Review}/**`
    - 21.1g `apps/web/src/components/**` 与 `apps/web/src/layouts/**` 残余替换
  - 验收：每个 sub-commit 跑 `pnpm --filter @sikao/web lint`（lint-v4-token-residual 在该 surface 范围内 0 命中）+ 本地 dev (port 18080) 视觉无退化；axe 全绿。
  - 回滚：每 sub-commit 独立 `git revert`，可整页回退。
  - _Requirements: 1.6, 12.1, 12.3, 12.4_

- [ ] 21.2 V4→V5 迁移前/迁移后页面对照（REQ-12.5）
  - 依赖：21.1。
  - 产出物：`apps/web/v5-migration-evidence/{home,practice,note,me}.md`，每文件含 V4 / V5 截图路径（playwright 跑 `apps/web` dev 服务器 port 18080）+ token 替换 diff 表（V4 名 → V5 名）。
  - 验收：4 页面 evidence 全部存在；diff 表无遗漏 token。
  - 回滚：`git revert <sha>` 删除 evidence 目录。
  - _Requirements: 12.5_

- [ ] 21.3 V4 token sunset — 从 SSOT 删除（**条件**：21.1 完成 + lint-v4-token-residual 0 命中）
  - 依赖：21.1。
  - 产出物：`packages/design-system/src/tokens.css` 删除 §8 V4 alias 区块；同步删除 `apps/web/src/styles/tokens.css` 中 V4 双份镜像（如还存在）。
  - 验收：
    - `pnpm --filter @sikao/web lint`（lint-v4-token-residual 切换到 error，0 命中）；
    - 全量 `apps/web` 视觉无退化（人工 review 4 页对比 21.2 evidence 截图）。
    - **执行时机**：≥ 2026-06-06；早于该日期 sub-task 进入 blocked 状态。
  - 回滚：`git revert <sha>` 恢复 V4 alias 与残余引用——这是 H7 fail-fast 兜底，确保过渡期未结束前不会误删。
  - _Requirements: 1.6, 12.1, 12.2_

  - [ ]* 21.3a Property test for V4 residual convergence
    - **Property 8: V4 Token Residual Convergence**
    - **Validates: Requirements 1.6, 12.1, 12.2**
    - 产出物：`apps/web/scripts/__tests__/lint-v4-residual.test.mjs`（合规：纯 V5 仓库通过；反例：故意写 `var(--paper-1)` 拦截）。
    - _Requirements: 1.6, 12.1, 12.2_

- [ ] 22. Phase 6 检查点 — 迁移闭环
  - 跑 `pnpm --filter @sikao/web lint`、`pnpm --filter @sikao/web test`、`pnpm --filter @sikao/web test:a11y` 三连必须全 PASS；问 user 进入 Phase 7。

### Phase 7 — V5 Baseline Report + 视觉验证（playwright 截图回归 6 档断点）

- [ ] 23.1 V5 Baseline Report（REQ-11.4 / §T.2，**2026-05-24 调整**）
  - 依赖：~~8（lint-v4-residual）, 21.3~~ → V5-M0.5 commit ⑦ 完成（lint 全绿） + Phase 4 桌面页骨架完成。
  - 产出物：`apps/web/v5-baseline-report.md`（按 §T.2 模板：扫描范围 / 违规统计 / Top 5 修复优先级 / ~~迁移阻塞~~（已无 V4 surface））。
  - **2026-05-24 调整**：扫描对象去掉 `.tmp_review/out/*.html`（V4 现存原型）章节；只保留 V5 落地后 `apps/web/src/views/**` + `apps/web/src/components/**` 的 lint 统计作 V5 基线。
  - 验收：报告生成可被 `cat apps/web/v5-baseline-report.md` 读取；每条 lint 违规数与实际跑 lint 输出一致。
  - 回滚：`git revert <sha>` 删除报告。
  - _Requirements: 11.4_

- [ ] 23.2 Playwright 截图回归 — 6 档断点 × 6 页面 = 36 截图
  - 依赖：14.x, 17.x。
  - 产出物：
    - `apps/web/playwright.config.ts`（如无）；
    - `apps/web/e2e/visual/`：每页 1 个 spec；
    - 6 档断点：375 (xs) / 480 (sm) / 768 (md) / 1024 (lg) / 1280 (xl) / 1920 (3xl)；
    - 6 页面：Home / Practice / Note / Me / QuestionHub / Review；
    - dev server fixed at port 18080（H10）；
    - 基线截图存 `apps/web/e2e/visual/__snapshots__/`。
  - 验收：所有 36 截图生成且 `pnpm --filter @sikao/web test:visual` 跑通（首次为 baseline，后续作为回归基线）；prefers-reduced-motion / prefers-reduced-transparency 模拟下 BottomTabBar 截图正确降级。
  - 回滚：`git revert <sha>` 删除截图基线。
  - _Requirements: 4.1, 4.2, 9.1, 9.2, 9.3, 9.4, 9.6, 10.3_

  - [ ]* 23.2a Property test for multi-device continuity
    - **Property 10: Multi-device Continuity**
    - **Validates: Requirements 4.1, 4.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.6**
    - 产出物：`apps/web/e2e/visual/__tests__/multi-device.spec.ts`（断言每个断点下页面有可见 nav + 主内容、无水平 overflow、安全区域 padding 命中）。
    - _Requirements: 4.1, 9.1, 9.2, 9.3, 9.4, 10.6_

  - [ ]* 23.2b Property test for focus visibility
    - **Property 6: Focus Visibility Invariant**
    - **Validates: Requirements 2.6, 10.1, 10.7**
    - 产出物：`apps/web/e2e/a11y/focus-ring.spec.ts`（playwright 跑 6 页面键盘 Tab 导航，每个 focus-visible 元素必须能看到 ring 且色值 = `--color-focus-ring`）。
    - _Requirements: 2.6, 10.1_

  - [ ]* 23.2c Property test for theme switching stability (e2e)
    - **Property 2: Theme Switching Stability**
    - **Validates: Requirements 1.4, 1.5**
    - 产出物：`apps/web/e2e/visual/theme-switch.spec.ts`（同一页面 light/dark 各截图，diff 排除 semantic 层差异，primitive / component 层 token 数值 stable）。
    - _Requirements: 1.4, 1.5_

  - [ ]* 23.2d Property test for nested radius difference
    - **Property 3: Nested Radius Difference**
    - **Validates: Requirements 3.4, 7.5**
    - 产出物：`apps/web/e2e/visual/nested-radius.spec.ts`（在 Home / Practice 渲染卡中卡场景，从 DOM 计算 `getBoundingClientRect` + `getComputedStyle border-radius`，断言外层 ≥ 内层 + 差值 ≥ 4px）。
    - _Requirements: 3.4, 7.5_

  - [ ]* 23.2e Property test for CJK no-italic invariant
    - **Property 4: CJK No-Italic Invariant**
    - **Validates: Requirements 5.4, 5.7**
    - 产出物：`apps/web/e2e/visual/cjk-italic.spec.ts`（遍历 6 页面所有 text node，含 CJK 字符的节点 `getComputedStyle('font-style') !== 'italic'`）。
    - _Requirements: 5.4, 5.7_

- [ ] 24. Phase 7 检查点 — 视觉回归基线全绿
  - 跑 `pnpm --filter @sikao/web test:visual`、`pnpm --filter @sikao/web test:a11y` 全绿；问 user 进入 Phase 8。

### Phase 8 — 文档同步（Design-System.md + fail-fast 例外账本）

- [ ] 25.1 同步 `docs/vault/04-design/Design-System.md` 至 V5
  - 依赖：1.x–14.x（token + 组件契约稳定后）。
  - 产出物：`docs/vault/04-design/Design-System.md` 整章节重写——含 V5 三层 token 表、35 组件契约速查、DM Sans 自托管字体体系、断点与 Rail 折叠规则、Tabs 3-variant 合并说明（R2/Q2）、Note 用 Drawer 不用 Modal 强制约束（R2/Q1）、`max-w-workspace = none`（`SIK-128` Route A supersede / R2/Q5）、Exam 独立 layout 不复用 SaaS Shell；指向 `.kiro/specs/frontend-style-guide-v5/{requirements,design,tasks}.md` 作为详细出处。
  - 验收：H5 review gate 触发（>50 行文档新增），独立 subagent review 通过；diff `docs/vault/04-design/Design-System.md` 与 spec 三件套 token 表 0 差异。
  - 回滚：`git revert <sha>` 恢复 V4 版 Design-System.md。
  - _Requirements: 11.2, 11.4_

- [ ] 25.2 fail-fast 例外账本最终核对
  - 依赖：14.3。
  - 产出物：核对 `docs/engineering/fail-fast-exceptions.md` 中 `mobile-bottom-nav-glassmorphism-fallback` 条目字段完整（name / 位置 / 默认行为 / 降级触发 / 降级目标 / 负责人 lhr / 复审日期 2026-08-23 / 不允许的处理方式）；与 design §E.1 / requirements §7.3 三处对齐。
  - 验收：`grep mobile-bottom-nav-glassmorphism-fallback docs/engineering/fail-fast-exceptions.md` 命中且字段无缺失。
  - 回滚：`git revert <sha>`。
  - _Requirements: 8.4_

- [ ] 25.3 Spec 三件套交付完成 + 关闭 V5 spec
  - 依赖：所有上游任务完成且对应 evidence 落档。
  - 产出物：在 `.kiro/specs/frontend-style-guide-v5/` 同目录追加 `evidence.md`，含每个 Phase 检查点的 PASS 证据（lint / unit / visual / a11y / 人工 review 节选）+ baseline-report 链接 + migration evidence 链接。
  - 验收：H8 Validation Gate 全部 PASS；H5 review gate 已经过；问 user 拍板关闭 V5 spec。
  - 回滚：`git revert <sha>` 删除 evidence.md，spec 重新 in_progress。
  - _Requirements: 11.4, 12.5_

- [ ] 26. 最终检查点 — 全量 PASS + 关闭 V5
  - 跑 `pnpm --filter @sikao/web lint && pnpm --filter @sikao/web test && pnpm --filter @sikao/web test:visual && pnpm --filter @sikao/web test:a11y` 必须 PASS；问 user 拍板关闭 V5 spec，进入下一阶段（移动端 spec / 考试 spec）。

## Notes

- 任务原子化按 AGENT-H9 Commit Batch：每个 sub-task 对应一次原子 commit（≤15 文件、≤400 行净增）；不混合 plan/schema/实现/测试，必要时进一步拆分（如 21.1 已按 surface 拆 7 sub-commit、19.6 已拆 a/b 两 commit）。
- 标 `*` 的 sub-task 是可选 property test / unit test，可跳过加快交付；标无 `*` 的核心任务必须实现并验证。
- 6 个新 lint（Phase 2）必须全部接入 `pnpm --filter @sikao/web lint`；任何 lint 缺位 = Property 1 / 5 / 7 / 8 / 9 不可校验，违反 Correctness Properties 落地承诺。
- Phase 6 V4→V5 切换严格按 surface 整页迁移，禁止局部混用（REQ-12.4）；过渡期满 2026-06-06 前不得删除 V4 alias，21.3 sub-task 早于该日期保持 blocked。
- 玻璃拟态 fallback 是当前 V5 唯一允许的 fail-fast 例外（requirements §7.3 / design §E.1）；其他 fallback / silent catch / `?? defaultValue` 一律按 H7 拒绝。
- Note 详情、Modal 内容超 640px 必须用 Drawer（R2/Q1 + D.3.35 gotcha）；Tabs 与 SegmentedControl 合并 3 variant，禁独立 SegmentedControl 实现（R2/Q2）；Exam 不嵌套 SaaS Shell（D.3.35 gotcha + D.4.6）。
- dev port 固定 18080；禁 docker（AGENT-H10）。
- Property tests 与 Correctness Properties 一一映射：CP.1 → 3.1/4.1/5.1（lint 测试）；CP.2 → 1.3 + 23.2c；CP.3 → 23.2d；CP.4 → 23.2e；CP.5 → 19.7；CP.6 → 23.2b；CP.7 → 14.3a；CP.8 → 21.3a + 8.1；CP.9 → 7.1；CP.10 → 14.1a + 23.2a。

## Task Dependency Graph

> **2026-05-24 V5-M0.5 调整**：wave 4 移除 `1.7`（V4 alias ARCHIVED）；wave 21–24 整段 ARCHIVED；`8.1`（V4 residual property test）从 wave 4 移除（task 8 改可选）；保留 wave 0–20 + 25–28 用于实施。

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3", "4", "5", "6", "7"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.1", "4.1", "5.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["1.5", "8"] },
    { "id": 4, "tasks": ["1.6"] },
    { "id": 5, "tasks": ["10.1"] },
    { "id": 6, "tasks": ["10.2", "11.1", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 7, "tasks": ["10.3", "12.1"] },
    { "id": 8, "tasks": ["12.2", "12.4", "12.10", "12.11", "13.6"] },
    { "id": 9, "tasks": ["12.3", "12.5", "12.7", "12.9"] },
    { "id": 10, "tasks": ["12.6", "12.8", "13.1"] },
    { "id": 11, "tasks": ["13.2", "13.3", "13.4", "13.5", "13.7", "13.8"] },
    { "id": 12, "tasks": ["13.9", "14.1"] },
    { "id": 13, "tasks": ["14.1a", "14.2", "14.3"] },
    { "id": 14, "tasks": ["14.3a", "15.1", "15.2", "15.4", "15.5"] },
    { "id": 15, "tasks": ["15.3", "19.1"] },
    { "id": 16, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "19.2"] },
    { "id": 17, "tasks": ["17.6", "19.3"] },
    { "id": 18, "tasks": ["19.4"] },
    { "id": 19, "tasks": ["19.5"] },
    { "id": 20, "tasks": ["19.6a", "19.6b", "19.7"] },
    { "id": 25, "tasks": ["23.1", "23.2"] },
    { "id": 26, "tasks": ["23.2a", "23.2b", "23.2c", "23.2d", "23.2e"] },
    { "id": 27, "tasks": ["25.1", "25.2"] },
    { "id": 28, "tasks": ["25.3"] }
  ],
  "archived_waves": [
    { "id": 21, "reason": "V5-M0.5 big-bang: 21.1a styles 切换 ARCHIVED" },
    { "id": 22, "reason": "V5-M0.5 big-bang: 21.1b-g surface 切换 ARCHIVED" },
    { "id": 23, "reason": "V5-M0.5 big-bang: 21.2 evidence ARCHIVED" },
    { "id": 24, "reason": "V5-M0.5 big-bang: 21.3 sunset ARCHIVED + 21.3a property test ARCHIVED" }
  ]
}
```
