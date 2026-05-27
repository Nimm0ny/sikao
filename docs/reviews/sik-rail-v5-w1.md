---
type: review
status: conditional-pass
owner: lhr
reviewer: self-review (subagent unavailable)
target: bbcfdf4f8 (SIK-121 W1 — 4 files, +203 net)
wave: w1
last-reviewed: 2026-05-25
---

# SIK-Rail-v5 W1 · Code Review

## 检查范围

只读审查 git commit `bbcfdf4f8` —— "feat(layout): SIK-121 W1 collapse Rail nav to 4 tabs + RailMe entry"。改动范围 4 文件 / +203 行净增（224 ins / 21 del），全部落在 `apps/web/src/`：

1. `apps/web/src/layouts/RootLayout/RootLayout.tsx`（+29 行）
2. `apps/web/src/layouts/RootLayout/RootLayout.module.css`（+89 行）
3. `apps/web/src/layouts/RootLayout/RootLayout.test.tsx`（+106 / -21）
4. `apps/web/src/components/layout/Rail/Rail.test.tsx`（+21 行）

对照下列 SSOT 逐项核对：

- `docs/plan/sik-rail-v5-visual-contract.md` —— §6 Acceptance Hooks H01–H11、§5 Visual Drift、§7 Wave Plan W1 段（估 ≤ 6 文件 ≤ 200 行净增）
- `docs/reviews/sik-rail-v5-w0.md` —— 报告格式模板 + W0 conditional-pass 4 条收口结果
- `AGENTS.md` —— §0.2 H5 / H8 / H9 / H11、§6.3 review 必含字段
- `.tmp_review/home-frame.html` —— 原型 SSOT（行 127-138 tooltip 模式本体 / 142-155 `.rail-me` 容器 / 297-319 5 项 nav 原型 / 322-328 me 段）

核对方式：

- `git show bbcfdf4f8 -- <path>` 看精确 diff
- `grep_search` 跨 `apps/web/src/**/*.tsx` 扫 5-tab 残留（`id:\s*['"]me['"]`）
- `grep_search` 扫 token 红线（`color-mix` / `--paper-1` / `--ink-1` / `--t-meta` / `--r-card` / `--shadow-1`）
- `grep_search` 扫 axe 接入面（`vitest-axe` / `axe-core` / `toHaveNoViolations`）

reviewer 字段说明：本 session subagent invocation 三连失败（每次 `Sub-agent execution was cancelled`），按 AGENTS.md §2.3 "subagent 不可用 fallback" 改走 self-review，Evidence Block 同步标记 `Independent subagent review: not available`。

## 发现项

| # | 严重度 | 项 | 证据（文件:行号） | 建议处理 |
|---|---|---|---|---|
| 1 | med | `views.a11y.test.tsx` 文件级注释**仍写"all 5 rail items + RailMe slot"**，与 W1 已落地的 4-tab 实质冲突；W1 改 RootLayout 时漏改这条文档行，未来 reviewer 抓 axe 套件时容易被误导以为还是 5-tab | `apps/web/src/views/__tests__/views.a11y.test.tsx:42` `RootLayout is tested via the in-memory router so the live nav state is rendered with all 5 rail items + RailMe slot.` | W2 顺手把 `5 rail items` 改成 `4 rail items` 即可；不阻塞 W2 启动 |
| 2 | med | `vitest-axe` 在 `apps/web/package.json:83` devDeps 列了 `^0.1.0` 但安装位为空（同文件 `views.a11y.test.tsx:29` 注释已显式承认 "the install slot is empty in this monorepo"），导致 W1 测试仅通过 `axe-core` 直跑跳过了 vitest-axe 的 `expect.extend(toHaveNoViolations)` 接入面；contract A02 要求 `vitest-axe 0 violation`，**当前不存在 vitest-axe runtime**，只有 axe-core 的人工调用 | `apps/web/src/views/__tests__/views.a11y.test.tsx:5,29-33`（用 `import axe from 'axe-core'` 替代 vitest-axe）；`apps/web/package.json:83`（devDep 声明但 install 为空） | 不在 W1 范围内修；建议在 W4 验收 evidence 里把 A02 的字面 `vitest-axe` 改为 `axe-core invocation` 并把当前实现路径标清楚，或在 W2/W3 期间把 `vitest-axe` 真正装上并替换 import。**不阻塞 W2 启动**（当前 axe-core 已覆盖 RootLayout 全壳） |
| 3 | low | W1 commit message 里 4-state coverage 段写 "loading/empty/error are global ErrorBoundary scope per contract §3.2; not duplicated here"；contract §3.2 的"loading"实际定义是 user prop 缺省时 meName/meSub 用 fallback —— W1 测试已覆盖这条（`RootLayout.test.tsx:127-141` "RailMe falls back to placeholder name + subtitle"），但**测试没有显式标注 `it('loading state', ...)`**，未来 audit 一眼扫不到 | `apps/web/src/layouts/RootLayout/RootLayout.test.tsx:127` it 名字是 "RailMe falls back to placeholder name + subtitle when user prop omitted" | 可选：W2 时把 it 名字改成 `RailMe (loading state — user prop未load) ...` 让 4 状态覆盖一目了然；不修也行 |
| 4 | low | `RootLayout.module.css:103` Tooltip transition 用 `transition: opacity var(--dur-fast) var(--ease-out) 0.4s` —— `0.4s` 是 hover delay 字面值，没走 token；token 体系里 `--dur-base` 200ms / `--dur-fast` 150ms 没有 400ms 项 | `apps/web/src/layouts/RootLayout/RootLayout.module.css:103` | 小漂移；W2 收 RailBrand/RailNav `[data-tip]::after` 时一并考虑加 `--dur-tooltip-delay: 400ms` token 或就保留字面值（原型 `home-frame.html:135` 也是字面 `.4s`，可视为 no drift） |

## 附加观察

不计为发现项，仅信息记录。逐项落 PASS 证据：

### Acceptance Hooks H01-H04（W1 owner）

- **H01 PASS**：`RootLayout.tsx:64-69` `navItems` 长度精确 = 4，元素 id 顺序 `home / practice / review / note`，**无 `id: 'me'`**、**无题库**。`RootLayout.tsx:71-76` `tabBarItems` 同步 4 项（mobile chrome 一致）。`RootLayout.test.tsx:84-93` 断言 `expect(labels).toEqual(['首页', '练习', '复盘', '笔记'])`，`RootLayout.test.tsx:95-103` 反向断言 `expect(labels).not.toContain('我的')`。grep 全 `apps/web/src/**/*.tsx` 扫 `id:\s*['"]me['"]`，命中仅 `BottomTabBar/BottomTabBar.test.tsx:35`（fixture 数据，断言其 4-item subset 之外的渲染分支，**不构成 5-tab 红线失守**；BottomTabBar 组件本身是接 prop 的纯组件，5 项 fixture 仅用于测组件自身能渲染任意长度数组）。
- **H02 PASS**：`RootLayout.tsx:88-117` me 槽是唯一 `aria-label="我的"` + `data-testid="rail-me-link"` 节点；`RootLayout.test.tsx:105-114` 断言 `getAllByLabelText('我的').toHaveLength(1)` + `href="/me"` + `data-testid="rail-me-link"`。`Rail.test.tsx:138-156` 防御性测试断言 `navList.querySelectorAll('[aria-label="我的"]').toHaveLength(0)`，**Rail 组件契约层**（`navItems` vs `me` slot 隔离）也有锚点。
- **H03 PASS**：`RootLayout.module.css:81-107` `.meLink[data-tip]::after` 走纯 CSS `content: attr(data-tip)` 模式，与原型 `home-frame.html:127-138` 字节对齐；`.meLink[data-tip]` `position: relative` + `::after` `position: absolute` + `left: calc(100% + var(--space-3))` + `display: none` 默认 + `:root[data-rail='collapsed'] .meLink[data-tip]::after { display: block }` + `@media (hover: hover) and (pointer: fine) { :root[data-rail='collapsed'] .meLink:hover[data-tip]::after { opacity: 1 } }`。归属契约 §6 H03 说明的 owner = `RootLayout.module.css`（不是 `Rail.module.css`）正确实现。`RootLayout.test.tsx:151-156` 断言 `meEntry.toHaveAttribute('data-tip', '我的')`，CSS ::after 在 jsdom 不可计算，data-tip attr 是测试稳定的契约面。
- **H04 PASS**：`RootLayout.tsx:113-117` 展开态渲染 `<Avatar /> + <span class={meStack}><span class={meName}>{meName}</span><span class={meSub}>{meSub}</span></span>`；`RootLayout.tsx:85-86` `meName` fallback `user?.displayName ?? '我'`，`meSub` fallback `user?.subtitle ?? 'Lv.4 学习达人'`，与契约 §5 drift 表的 `me-sub` fallback 拍板项一致。`RootLayout.module.css:42-78` 三个 class 齐 + `:root[data-rail='collapsed'] .meStack { display: none }` 折叠态正确隐藏文字段。`RootLayout.test.tsx:117-125` 断言 user prop 给定时 `displayName='lhr'` 与 `subtitle='Lv.4 学习达人'` 都渲染；`RootLayout.test.tsx:127-141` 断言 user 缺省时 fallback 都生效。

### 5-tab 防御红线（用户硬约束 §1）

- 全 `apps/web/src/**/*.tsx` 扫 `id:\s*['"]me['"]` 仅 1 命中 = `BottomTabBar.test.tsx:35`（组件自检 fixture，前述）。
- 全 `apps/web/src/**/*.test.tsx` 扫 `5.tab|5 tab|toHaveLength\(5\)` 仅 1 命中 = `RootLayout.test.tsx:12` 注释 `The 5-tab variant is gone` —— 是反向声明不是断言，正确。
- 唯一**主动遗留**的"5"字符是 `views.a11y.test.tsx:42` 注释（见发现项 #1），med 级别。

### Token 红线（contract §4 末禁清单）

- 全 `apps/web/src/layouts/RootLayout/**` 扫 `color-mix` / `--paper-1` / `--ink-1` / `--t-meta` / `--r-card` / `--shadow-1` —— **0 命中**。
- W1 改的 css 用的全是 V5 semantic token（`--color-text-primary` / `--color-bg-surface` / `--color-text-meta` / `--color-bg-elevated` / `--color-bg-sunken` / `--color-border-subtle` / `--space-1/2/3` / `--radius-10` / `--radius-999` / `--font-meta` / `--font-tiny` / `--font-weight-semibold` / `--font-weight-medium` / `--dur-fast` / `--ease-out` / `--z-popover` / `--color-focus-ring` / `--color-brand-primary`），与 contract §4 token map 完全一致。
- `--color-brand-soft` 漂移（H09，W2 owner）**未在 W1 中新增**：grep 整个 RootLayout 模块 + Rail 模块，brand-soft 仅出现在 `Rail.module.css:71` 既存代码（W1 没动，正是 W2 要修的目标），无 W1 带入新 brand-soft 引用。

### H9 cap 合规性

- 实际 4 文件 / +203 行净增 vs contract §7 W1 估 ≤ 6 文件 ≤ 200 行。
- 文件数 ✓（4 ≤ 6）。行数 +3 行**微越界**（203 vs 200 估值，1.5% 漂移）。
- AGENTS.md §0.5 §5 git gate 给的硬上限是 ≤ 15 文件 ≤ 400 行净增 / commit；W1 远低于硬上限，仅是越契约 §7 软估值。**不构成 H9 违规**，但建议在结论标注。

### W0 conditional-pass 4 条收口验证

逐条核对 W0 review 留下的 must-fix / should-fix：

- **必修 #1（color-mix 禁令）✓ 已修齐**：`docs/plan/sik-rail-v5-visual-contract.md:218` 第 5 条 `❌ color-mix(in srgb, ...) 百分比硬编码（折叠态半透明 / Tooltip 背景 / hover 染色一律走 V5 semantic token...）` 已落档。
- **必修 #2（Chrome MCP 12 张截图基线）✓ 已修齐**：契约 §6 截图清单从 8 行扩到 12 行，新增 `prototype-1440-expanded.png` / `prototype-1440-collapsed.png` / `prototype-1920-expanded.png` / `prototype-1920-collapsed.png`，1280/1440/1920 prototype 基线齐。
- **建议修 #3（H03 行号 137-146 → 127-138 + 142-155）✓ 已修齐**：契约 §6 H03 行 245 现写 `127–138（.rail-btn[data-tip]::after tooltip 模式本体）+ 142–155（.rail-me 容器）`，原型行号 reviewer 验证 `home-frame.html:127-138` 是 tooltip 模式本体（`content: attr(data-tip)` + 折叠态 hover 显示）、`home-frame.html:142-155` 是 `.rail-me` 容器，匹配。
- **建议修 #4（Tooltip drift 改写）✓ 已修齐**：契约 §5 drift 表 Tooltip 行已从 `no drift` 改写为 `目标态：纯 CSS [data-tip]::after；W1 仅在 RailMe 折叠态落 ::after Tooltip（与原型一致）；RailBrand / RailNav 折叠态现用的 React <Tooltip> 组件（Rail.tsx:106-115, 161）由 W2「视觉对齐 H05–H10」一起退化为 ::after`，明确分配 W1 / W2 owner。

W0 conditional-pass 4 条**全部收口**，contract 主体可作为 W2 启动 SSOT 直接消费。

### 既有测试不破

- `Rail.test.tsx` 9 个 case 全部保留：collapsed/expanded 渲染、toggle 点击、Ctrl+\\ 快捷键、collapsed-brand 展开、active 标记、modifier-click 穿透、me-slot 与 nav 隔离 —— **没有删除任何测试**。
- `RootLayout.test.tsx` 用 `beforeEach` + `afterEach` 清 localStorage / `document.documentElement.dataset.rail`，避免 jsdom 单 worker 跨文件状态泄漏（`RootLayout.test.tsx:19-31`）—— 这是 W1 commit message 显式声明的 cleanup，正确实现。
- W1 commit message 自报：vitest 376/376 PASS（baseline 371 + 5 new W1 tests），typecheck PASS、lint PASS（eslint + 14 lint scripts）。**当前 review 阶段不重跑 validation**（H8 validation 由 Step A 末 Runner 跑，本 review 仅 H5 review gate）。

### 原型行号验证

- `home-frame.html:127-138` reviewer 抽查：第 127 行起是 `.rail-btn[data-tip]::after { content: attr(data-tip); ... }` 模式本体，第 137-138 行收尾 `}`。✓
- `home-frame.html:142-155` reviewer 抽查：第 142 行起 `.rail-me { ... }` 容器，到 155 行收尾。✓
- `home-frame.html:297-319` reviewer 抽查：5 项 `.rail-btn`（首页/练习/复盘/笔记/题库），第 315-319 行是 `题库` —— W1 删除是契约 §5 drift 拍板项。✓
- `home-frame.html:322-328` reviewer 抽查：`<div class="rail-bottom"> .rail-me { Avatar + meta }`。✓

### 命名 / 注释一致性

- `RootLayout.tsx:18-37` 文件级注释完整记录 W1 改动语义、原型对照、回退路径，符合 AGENTS.md §4.4 "Why" 注释规则。
- `RootLayout.test.tsx:8-15` 测试文件注释指向 contract §1-§2 + Acceptance Hooks H01/H02，给未来 audit 留锚点。
- `RootLayout.module.css:74-77` Tooltip ::after 模式注释直接引用原型行号 `home-frame.html:127-138`，符合 H11 token map 引用要求。
- `BottomTabBar/BottomTabBar.test.tsx` 非 W1 改动，但 fixture 仍保留 5 项；建议 W2 顺带把 fixture 改成 4 项（或新增 4 项 fixture 测 SIK-121 渲染分支），保持 BottomTabBar 与 RootLayout 一致 —— **不计为 W1 缺陷**。

## 风险等级

**low**

理由：

- H01-H04 acceptance hooks **全 PASS**；5-tab 防御红线无失守；token 红线 0 命中；既有测试 0 破坏。
- 4 条发现项全是 **med / low**：
  - #1 注释行漏改（views.a11y.test.tsx:42）—— W2 顺手修，不阻塞
  - #2 vitest-axe 不存在但 axe-core 已覆盖（这是 W1 之前就存在的 monorepo 状态，W1 没引入也没修）—— W4 验收时调整文档
  - #3 测试 it 命名 4-state 显式化建议 —— 可选
  - #4 Tooltip transition 0.4s 字面 —— 与原型对齐，可视为 no drift
- W0 conditional-pass 4 条全部收口，contract SSOT 可直接消费。
- H9 cap 微越界 +3 行，距 H9 硬上限 (≤ 400) 还远。

## 时序合规说明

W1 代码 `bbcfdf4f8` 已合入 `main`（HEAD `bbcfdf4f8 (HEAD -> feat/sik-121-finalize, main)`），但本 review 在合 main **之后**才补 —— 违反 AGENTS.md H5 时序（"review gate 未满足，不得宣告完成"）+ §0.5 §2 ("commit message 单写 review pass 不算" 的反向：单 commit 落 main 不能算 review)。

属于历史既成事实，不可逆 (rollback 一个已 push 到 main 的 commit 风险大于补 review)。本 review 报告**显式记录此时序漂移**，作为 audit trail。

后续硬约束（W2 / W3 / W4 起强制）：

1. 每 wave 代码必须在 **feat/sik-121-w&lt;N&gt;** 分支开 PR，**review pass 后再 merge main**，禁止再走"先 push main 再补 review"路径。
2. 每 wave commit message 不得只写 `review pass`；必须附 `docs/reviews/sik-rail-v5-w<N>.md` 文档落档（H5 / §0.5 §2 显式要求）。
3. 本 W1 review 报告 commit 必须是单文件 atomic commit（H9 §0.5 §5 + 用户硬约束 §H9 提示），不混合任何 W2 改动。

reviewer 字段补强：本 review 由 self-review 出（subagent invocation 三连失败，按 AGENTS.md §2.3 fallback），Evidence Block 同步标 `Independent subagent review: not available`，audit 时一并核对。

## 结论

**conditional-pass** —— W2 可启动；但下列条件必须随 W2 / W4 闭环：

1. **W2 必修（顺手）**：把 `apps/web/src/views/__tests__/views.a11y.test.tsx:42` 注释里的 `all 5 rail items` 改成 `all 4 rail items + RailMe slot` —— 见发现项 #1。
2. **W4 必修（验收文档）**：把 contract §6 A02 字面 `vitest-axe 0 violation` 改写为 `axe-core invocation 0 violation`，或 W2/W3 期间真正装上 vitest-axe 并替换 import；当前实现是 axe-core 直跑 —— 见发现项 #2。
3. **W2 / W3 / W4 时序硬约束**（见 §时序合规说明）：必走 PR-then-merge，不再"先 main 再 review"。

W2 启动**不阻塞**：H01-H04 全 PASS，无 high 发现项，contract conditional-pass 4 条已收口，5-tab 红线无失守，token 红线 0 命中。
