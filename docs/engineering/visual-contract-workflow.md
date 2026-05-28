---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-25
---

# Visual Contract Workflow（H11 Define-First）

> 视觉/前端任务的 Define-First 流程。AGENT-H11 触发后，必须按本文件走，不可跳。

## 1. 触发条件

任一命中即触发：

- 新建 view（views/<X>/<X>.tsx）
- 改 view 顶层布局（grid 行列、卡片骨架）
- 改导航 / Rail / BottomTabBar / TopBar
- 改卡片密度（删/加信息块、删/加按钮、改视觉编码）
- 改 Calendar / List / Timeline 骨架
- 任何对应原型 HTML 已存在于 `.tmp_review/out/**` 的 view 改动

## 2. 必须产物

`docs/plan/<sik>-<feature>-visual-contract.md`，7 块结构：

### 2.1 Layout Topology

- root grid 行/列分配（`grid-template-rows: ...`）
- 一屏行为（lock / 自然滚 / 局部滚）
- 子区域 owner（哪个 issue / wave 落哪一块）
- ScreenLockShell 是否启用，启用时 `rows` 值

### 2.2 Required Interactive Elements

按原型逐块列必须存在的按钮 / 控件 / 图标。每条至少含：

- 元素名（label / aria-label）
- 位置（在哪个区块的哪个 slot）
- 行为（点击后做什么）
- 是否原型有但本次不做（标 `defer to wave N`）

### 2.3 Information Density

每张卡列：

- 信息块数量（标题 / 数字 / 子说明 / icon / sparkline / actions...）
- 视觉编码（颜色 / icon / 数值排版）
- 状态量（4 状态 loading / empty / error / ready）

### 2.4 Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`，列本次用到的所有原型 var → V5 token：

```
var(--paper-1) → var(--color-bg-surface)
var(--ink-1)   → var(--color-text-primary)
var(--brand-yellow) → var(--color-brand-primary)
height: 100vh + overflow: hidden → ScreenLockShell
```

**禁**：直接复制原型 var 进生产代码 / color-mix 百分比硬编码 / 无来源的 px 数值。

### 2.5 SSOT Conflicts

把**原型默认行为**与**当前系统默认行为**逐条对比，至少写：

- 冲突项（例如 prototype `.workspace { flex: 1 }` vs token `--max-w-workspace: 1440px`）
- 各自 authority（原型 / tokens / design doc / issue comment / 已落代码）
- 当前采用哪一方作为真相源
- lhr 拍板日期
- 若只做部分收口，明确后续 owner / follow-up issue

如果没有冲突，必须显式写 `no conflicts`；不能省略整节。

### 2.6 Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板日期 |
|---|---|---|---|---|

如完全一致写 `no drift`。**所有偏离必须有 lhr 拍板日期；没有日期视为未授权偏离。**

### 2.7 Acceptance Hooks

这是给 Reviewer / Verifier 用的对照清单：

| 项 | 原型行号 | 实现位置 | 状态 PASS / 偏离 / 待修 |
|---|---|---|---|

加上：

- Chrome MCP 双开 diff 截图归档路径：`.tmp_review/visual-diff/<sik>/`
  - desktop **必须**有 `1440×900` 与 `1920×1080` 两档的 `prototype` + `implementation`
  - mobile / tablet 只在任务 scope 明确涉及对应 surface 时追加；不能用 mobile 代替 1920
- a11y vitest-axe 0 violation 命令 + log 路径

## 3. 流程顺序

```
[Master Mode]
  ├─ 派 Reviewer 跑「原型逐项提取」：读 .tmp_review/out/**.html，输出 contract draft
  ├─ Master 审 contract draft：补 SSOT Conflicts + drift + Acceptance Hooks，定稿
  ├─ contract 落 docs/plan/<sik>-<feature>-visual-contract.md
  └─ Multica issue.description 的 ## Acceptance 段显式引用 contract 文件路径（必须）

[Runner Mode] — contract 不在不得开 Runner
  ├─ 按 contract 实现，每 wave PR commit message 引用 contract section
  ├─ 完成后跑 typecheck / lint / lint-screen-lock / vitest-axe / Chrome MCP smoke
  ├─ 截 prototype + implementation 双图存到 .tmp_review/visual-diff/<sik>/
  └─ 按 contract 2.7 Acceptance Hooks 表逐项打勾或标偏离

[Reviewer Mode] — 独立 subagent
  ├─ 读 contract 2.7 + 实际代码 / smoke 截图
  ├─ 输出 docs/reviews/<sik>-<wave>.md：发现项 / 严重度 / 建议
  └─ 任何 high 未处理项 = review fail

[Master Mode]
  ├─ 收 review 报告 + Evidence Block
  ├─ contract 2.5 / 2.6 / 2.7 全部 PASS 才能标 done
  └─ 标 done 时回写 Evidence Block，包含 contract 路径 + diff 截图路径 + review 报告路径
```

## 4. 反模式（红线）

- ❌ contract 文件不存在直接开 Runner
- ❌ contract 只列原型，不列 drift 和 acceptance hooks
- ❌ 发现 prototype / token / design doc 冲突，却没写 `SSOT Conflicts`
- ❌ 实现与 contract 2.6 drift 表不一致，但 commit message / PR 描述里没解释
- ❌ Chrome MCP smoke 只截实现，没有原型对照
- ❌ desktop 只验 1440，不验 1920
- ❌ Reviewer 报告只写 "review pass"，没列检查项
- ❌ 把 Plan §X 落地路径的"文件清单"当成视觉契约（文件清单不是视觉契约）

## 5. 例外

只有以下场景允许跳过 contract：

- 修 typo / 单行 bug / 非视觉重构（`<= 100` 行 + 不动 view 骨架）
- 临时实验代码（不进 main 分支）

例外必须在 commit message 中显式声明：`visual-contract-skip: <reason>`。

## 6. 与其它硬规则的关系

- H6（Define-First）：H11 是 H6 的视觉子集；H6 没列视觉契约的版本是历史遗留，由 H11 补齐
- H5（Review Gate）：视觉 phase 的 review 必须读 contract 2.6 表，不读不算 review pass
- H8（Validation Before Done）：visual-contract diff 截图 = browser smoke 的强制部分
- H9（Commit Batch）：contract 文档自身可以 `> 100` 行（规范文件例外），但实现 PR 仍须 `<= 15` 文件 / `<= 400` 行净增

## 7. 参考

- `AGENTS.md` §0.2 H11
- `docs/engineering/agent-hard-rules.md`
- `docs/vault/04-design/Web-Layout.md`
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/multica-workflow.md`
