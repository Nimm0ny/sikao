---
type: review
status: conditional-pass
owner: lhr
reviewer: subagent (general-task-execution)
target: docs/plan/sik-rail-v5-visual-contract.md
wave: w0
last-reviewed: 2026-05-25
---

# SIK-Rail-v5 W0 · Contract Review

## 检查范围

只读审查 `docs/plan/sik-rail-v5-visual-contract.md`（330 行 W0 视觉契约）。
对照 `docs/engineering/visual-contract-workflow.md` §2 / §4 H11 反模式标准、`docs/vault/04-design/Web-Layout.md` 一屏锁死规则、`docs/vault/04-design/Prototype-Token-Map.md` 原型 var ↔ V5 token 映射 SSOT、原型 SSOT `.tmp_review/home-frame.html` 与多分辨率 demo `.tmp_review/v5-rail-demo.html`。

并对引用对象做存在性核查：
- 当前实现 `apps/web/src/layouts/RootLayout/RootLayout.tsx`（5-tab 漂移 + 双 Me 入口）
- 当前实现 `apps/web/src/components/layout/Rail/Rail.tsx`（已有 `data-rail` 同步 + `KeyboardShortcuts` 注册 + `Tooltip` 组件实现折叠态 tooltip）
- `apps/web/src/components/layout/AppShell/AppShell.tsx`（已有 `useIsMobile` 但暂无 768–1023 区间 hook）
- `apps/web/src/components/overlay/CommandPalette/CommandPalette.tsx`（存在）
- `apps/web/src/components/system/KeyboardShortcuts/KeyboardShortcuts.tsx`（存在）
- `apps/web/src/components/atom/SpriteIcon/SpriteIcon.tsx`（存在）
- `packages/design-system/src/tokens.css` §7 Rail 折叠状态机（`--rail-w-expanded` 240 / `--rail-w-collapsed` 80 + `[data-rail]` 覆写均落档）
- `packages/design-system/src/icons/` 目录：`rail-toggle.svg` / `nav-home.svg` / `nav-practice.svg` / `nav-review.svg` / `nav-note.svg` 全部存在

逐项对照 8 个 checklist 给出发现。

## 发现项

| # | 严重度 | 项 | 证据（文件:行号） | 建议处理 |
|---|---|---|---|---|
| 1 | med | §4 Token Map 末尾「禁」清单**未覆盖 color-mix 百分比硬编码**。H11 workflow §2.4 明确把 "color-mix 百分比硬编码" 列为红线之一，本契约只列了 `--paper-1/--ink-1` 原型 var、`--color-brand-soft` 漂移、关键 px 写死、Tooltip 文字硬编码 4 条 | `docs/plan/sik-rail-v5-visual-contract.md:213-217`（grep `color-mix` 整文 0 命中）；workflow 红线源 `docs/engineering/visual-contract-workflow.md:75`「**禁**：直接复制原型 var 进生产代码 / color-mix 百分比硬编码 / 无来源的 px 数值」 | 在 §4 禁清单补一条 `❌ color-mix(in srgb, ...) 百分比硬编码（折叠态半透明 / Tooltip 背景一律走 V5 semantic token，禁直接 color-mix）` |
| 2 | med | §6 Acceptance Hooks「Chrome MCP 双开 diff 截图归档」**8 张主表只在 1280 给了 prototype 基线**，1440 / 1920 只有 impl 没有 prototype 对照。任务标准要求 "1280/1440/1920 × expanded/collapsed × prototype/impl"（= 12 张）；现状是 2 张 prototype + 6 张 impl = 8 张，1440 / 1920 折叠/展开切换无法做像素级双开对照，只能依赖 1280 单一基线 | `docs/plan/sik-rail-v5-visual-contract.md:268-278`（截图清单表）；多分辨率 demo `.tmp_review/v5-rail-demo.html:113-141` 已支持 1280/1440/1920 三档 iframe，原型截图工程上可获取 | 把表扩成 12 行（增 `prototype-1440-expanded.png` / `prototype-1440-collapsed.png` / `prototype-1920-expanded.png` / `prototype-1920-collapsed.png` 四张），或在表下方明文说明「1440/1920 无 native prototype 基线，因 V5 demo 在 1920 屏 max-width 1440 cap 下视觉等价 1440 expanded → 复用 prototype-1280」并把 lhr 拍板日期落 §5 drift 表 |
| 3 | low | §6 H03 行号引用「137–146」**与「同 `.rail-btn[data-tip]::after` 模式」语义不严密对齐**：原型中 `.rail-btn[data-tip]::after` 模式真正定义在 `home-frame.html:127-138`（`content: attr(data-tip)` + 折叠态 hover 显示 + 展开态 display: none）；引用的 137–146 跨了 tooltip 模式收尾（137-138）+ `.rail-bottom`（141）+ `.rail-me`（142-146），不是 tooltip 模式本体 | `.tmp_review/home-frame.html:127-138`（tooltip 模式本体）vs 契约引用 `137-146`（实际是 rail-me 容器） | 把 H03 行号改成 `127–138`（tooltip 模式本体）+ `142–155`（`.rail-me` 容器），或合并为 `127–155`，避免 reviewer 在「tooltip 同模式」语义下找错锚点 |
| 4 | low | §5 drift 表「Tooltip 实现 \| no drift」与现状代码一致性需要再确认。契约目标用纯 CSS `::after content: attr(data-tip)`（与原型一致），但当前 `Rail.tsx` 折叠态实际用的是 `<Tooltip content=... side="right">` React overlay 组件（见 `Rail.tsx:106-115, 161`），W1/W2 落地时若不显式收口会同时存在两套 tooltip | `apps/web/src/components/layout/Rail/Rail.tsx:106-115`（`RailBrand` 折叠态用 React `<Tooltip>`）；`apps/web/src/components/layout/Rail/Rail.tsx:161`（`RailNav` 折叠态用 React `<Tooltip>`）；契约 §5 行 199 写 "no drift" | 把这条 drift 行改写为「目标态：纯 CSS ::after / 现状：React `<Tooltip>` / 偏离原因：W1 收口将 React Tooltip 退化为 ::after / lhr 拍板：2026-05-25」，或在 §6 加一条 H12「实现侧 React `<Tooltip>` 已替换为 `[data-tip]::after`」便于 reviewer 验收 |

附加观察（不计为发现项，仅信息记录）：

- **Checklist 1 6 段结构齐**：§1 Layout Topology / §2 Required Interactive Elements / §3 Information Density / §4 Token Map / §5 Visual Drift from Prototype / §6 Acceptance Hooks 全在且非空（额外含 §0 Scope 总览 / §7 Wave Plan / §8 参考），覆盖 H11 workflow §2.1–§2.6 全部硬框 ✓
- **Checklist 2 Acceptance Hooks**：H01–H11 共 11 条，4 列（项 / 原型行号 / 实现位置 / 状态）齐整，状态全 ☐，附加 A01–A04 自动化门禁 ✓
- **Checklist 3 Drift 表**：9 条偏离，5 列齐整；3 条 lhr 主动拍板（nav 5→4 / Me 入口去重 / 768–1023 BurgerDrawer hook）+ 3 条技术细节 lhr 2026-05-25 拍板（me-sub fallback / transition tokens 化 / cmd 折叠态）+ 3 条 `no drift`（Tooltip / cmd 折叠态 / icon 实现 / Ctrl+\\）；所有有视觉差异的均带日期 ✓（Tooltip 一行需要按发现项 #4 确认）
- **Checklist 4 引用文件存在性**：CommandPalette / KeyboardShortcuts / SpriteIcon / 5 张 sprite svg / tokens.css §7 / RootLayout / Rail / AppShell / Workspace / Web-Layout / Prototype-Token-Map / v5-rail-demo / home-frame **全部存在**，无失效引用 ✓
- **Checklist 5 原型行号**：H01 297–319（实际 5 条 `.rail-btn` 在 299/303/307/311/315，整 nav 区 297–320）✓ 在 ±2 容差；H02 322–328（实际 322 `<div class="rail-me">` / 324 avatar / 325–327 meta / 328 `</div>`）**精确**；H06 286–290（实际 286 `<svg>` / 287 rect / 288–289 path / 290 `</svg>`）**精确**；H07 78–86 ✓；H08 110–112 ✓；H09 109 **精确**；H10 101–102, 120 ✓；H11 n/a（原型未含）；唯一 H03 137–146 见发现项 #3
- **Checklist 6 token map 红线**：§4 11 行映射齐，与 `Prototype-Token-Map.md` §1–§8 一致；transition tokens 化（`--dur-base` + `--ease-emphasized`）正确；H09 修 `--color-brand-soft` 漂移到 `--color-bg-sunken` 与原型 `home-frame.html:109` 完全一致 ✓；唯一缺失见发现项 #1
- **Checklist 7 Wave Plan H9 合规**：W1 ≤ 5 文件 ≤ 200 行 ✓；W2 ≤ 6 文件 ≤ 300 行 ✓；W3 ≤ 5 文件 ≤ 150 行 ✓；W4 ≤ 4 文件 ≤ 200 行 ✓；W1 显式声明 "高优先，阻塞 SIK-93" ✓；W3 BurgerDrawer 占位边界 "本 wave 是 non-goal 边界：BurgerDrawer 内容（nav 列表 / Me 入口）属 Mobile/Tablet Shell 未来 issue" 极清楚 ✓
- **Checklist 8 8 张截图清单**：路径 `.tmp_review/visual-diff/sik-rail-v5/` ✓；命名规范 `<source>-<viewport>-<state>.png` ✓；prototype/impl 对照在 1440/1920 缺失见发现项 #2

## 风险等级

med

理由：H11 反模式无任何 high 命中（6 段齐 / Hooks 表完备 / drift 全有日期 / 引用文件全部存在）。两条 med 都是「漏写 / 漏覆盖」类，不动结构、不影响 W1 启动安全（W1 的 4-tab + Me 收敛只用到 §1/§2/§5/§6 H01/H02/H03/H04，与发现项 #1/#2 解耦）；但 W4 验收前必须修齐 #1（token 红线漏一条会让后续 wave 引入 color-mix 时无门禁可指）+ #2（Chrome MCP 双开缺基线会让 1440/1920 折叠态视觉漂移无法量化）。

## 结论

**conditional-pass** — W1 可启动；W4 验收前必须修齐：

1. **必修（med）**：§4 末「禁」清单补 `color-mix 百分比硬编码` 一条
2. **必修（med）**：§6 Chrome MCP 双开截图表把 1440 / 1920 prototype 基线补齐（4 张），或在 §5 drift 表显式落 lhr 拍板「1440 / 1920 复用 1280 prototype 基线 + 拍板日期」
3. **建议修（low）**：§6 H03 行号 `137–146` 改为 `127–138`（tooltip 模式本体）+ `142–155`（`.rail-me` 容器）
4. **建议修（low）**：§5 drift 表把 Tooltip 一行从 `no drift` 改写为目标态 `[data-tip]::after` vs 现状 React `<Tooltip>` 的收口 drift，避免 W1/W2 落地时同时存在两套 tooltip

修齐后无需重审本 contract；W1 完成后按 H5 落 `docs/reviews/sik-rail-v5-w1.md` 即可继续。
