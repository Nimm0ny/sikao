---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-27
issue: SIK-128
multica-issue: SIK-128
prototype:
  - .tmp_review/out/Tab1-Home/Home v2.1.html
  - .tmp_review/out/Tab2-Practice/Practice v1.html
  - .tmp_review/out/Tab3-Review/Review v1.html
  - .tmp_review/out/Tab4-Notes/Note v2.1.html
  - .tmp_review/out/Tab5-Profile/Me v1.html
  - .tmp_review/out/Tab5-Profile/Profile Learning v1.html
  - .tmp_review/out/Tab5-Profile/Profile Records v1.html
  - .tmp_review/out/_cross/Question Hub v2.html
  - .tmp_review/home-frame.html
  - .tmp_review/v5-rail-demo.html
---

# SIK-128 · Workspace 1920 横向画布契约（Route A / H11）

> 目标：把 8 个入口 view 从「1920 下被 `1440px` cap 夹窄」恢复为「吃满 Rail 以外剩余画布」；不改 nav baseline，不重做各 view 内部骨架。

## 0. Scope 总览

- **修复对象**：
  - `packages/design-system/src/tokens.css`
  - `apps/web/src/components/layout/Workspace/**`
  - `apps/web/src/layouts/RootLayout/**`
  - `docs/vault/04-design/**`
  - `docs/vault/05-migration/Phase/Style-Guide-V5/**`
  - `docs/engineering/visual-contract-workflow.md`
  - `AGENTS.md` / `CLAUDE.md`
- **命中入口 view**：
  - `/` Home
  - `/practice` Practice
  - `/review` Review
  - `/note` Note
  - `/me` Me
  - `/profile/learning` ProfileLearning
  - `/profile/records` ProfileRecords
  - `/question-hub` QuestionHub
- **不修复**：
  - `PracticeSession` / `SessionResult` / `PracticeGrading` / `Practice Preferences` 等 Reading/Form surface 的重新限宽方案
  - Mobile / Tablet 的横向行为
  - nav 结构（AGENT-H12 继续锁 4-tab）
- **owner**：本契约只收口共享 `Workspace` 横向画布与 H11 workflow 防线；各入口 view 的纵向 grid / 卡片密度仍由各自 visual contract owner 负责。

## 1. Layout Topology

### 1.1 共享根链

8 个入口 view 当前都走同一条桌面父链：

```tsx
<AppShell>
  <Rail />
  <Workspace maxWidth="workspace">
    <Outlet />
  </Workspace>
</AppShell>
```

`Workspace` 是唯一共享横向 owner。Route A 不给 8 个 view 分别加 wrapper，也不改 `ScreenLockShell` rows；只改 `workspace` token 的含义。

### 1.2 原型横向事实

原型入口页都把 workspace 当成「Rail 右侧剩余画布」，不是「1920 上再 cap 到 1440」：

```css
/* Home v2.1 */
.workspace {
  flex: 1;
  height: 100vh;
  padding: var(--sp-4) var(--sp-5);
}

/* Practice v1 */
.workspace {
  flex: 1;
  height: 100vh;
  padding: var(--sp-4) var(--sp-5);
}
```

Issue 触发点不是内部 grid 漂移，而是共享 `Workspace` 横向默认值与原型默认值冲突。

### 1.3 Route A 目标行为

| 视口 | Rail | 目标 workspace 宽度 | 一屏行为 | owner |
|---|---|---|---|---|
| 1440 desktop | expanded 240 | `1440 - 240 = 1200` | 各 view 继续 ScreenLock / 局部滚 | 各 view contract |
| 1440 desktop | collapsed 80 | `1440 - 80 = 1360` | 同上 | 各 view contract |
| 1920 desktop | expanded 240 | `1920 - 240 = 1680` | 同上 | 各 view contract |
| 1920 desktop | collapsed 80 | `1920 - 80 = 1840` | 同上 | 各 view contract |

**铁律**：Route A 之后 `maxWidth="workspace"` 表示「桌面主工作区默认不 cap」；如果某个 surface 需要阅读/表单限宽，必须显式用 `reading` / `form` / `prose`，不能再借 `workspace` 默认值蹭 cap。

## 2. Required Interactive Elements

本 issue 是共享横向修复，**不允许借机删控件/并骨架**。下面这些入口级关键交互必须原样保留：

| view | 必须存在的交互元素 | 验收方式 |
|---|---|---|
| Home | `topbar-cmd`、通知、设置、`开始今日练习`、Calendar `prev/today/next/+new` | 现有 Home contract + 浏览器 smoke |
| Practice | ScopeToggle、搜索、专项卡、套卷卡 CTA | `Practice.tsx` + smoke |
| Review | 日期范围 / calendar bar、复盘卡 CTA | `Review.tsx` + smoke |
| Note | FilterBar、SubBar、卡片点击开抽屉 | `Note.tsx` + smoke |
| Me | avatar、SubNav、danger actions | `Me.tsx` + smoke |
| ProfileLearning | RangeBar、KnowledgeTree、Heatmap | `ProfileLearning.tsx` + smoke |
| ProfileRecords | Filter pills、timeline/list filters | `ProfileRecords.tsx` + smoke |
| QuestionHub | scope/filter/search、题目卡 CTA | `QuestionHub.tsx` + smoke |

本 issue 如果导致以上任一控件消失、被遮挡、溢出不可点，视为 fail。

## 3. Information Density

Route A 只放宽共享画布，不改变各页信息块数量。密度 contract 维持如下：

| view | 必须保持的密度不变量 |
|---|---|
| Home | 4 个 metric card + 1 个 calendar main panel + 3 个 bottom cards |
| Practice | header + quick/history row + specialty grid + paper grid |
| Review | header + date recap bar + main review panel |
| Note | header + filter bar + sub bar + note wall |
| Me | hero + 2-col grid + danger panel |
| ProfileLearning | KPI / Trend / KnowledgeTree / Heatmap 结构不减块 |
| ProfileRecords | timeline/list drilldown 信息块不减少 |
| QuestionHub | compact 题卡网格 + 顶部过滤条不减块 |

4 状态（loading / empty / error / ready）都只能放宽横向画布，不能因为 Route A 新增整页横滚或把卡片压成单列。

## 4. Token Map

| 原型 / 旧系统语义 | 生产 Route A 对应 |
|---|---|
| `.workspace { flex: 1 }` | `<Workspace className={styles.workspace}>` 保持 `flex: 1 1 auto` |
| `.workspace` 横向吃满 Rail 余宽 | `--max-w-workspace: none`（或等价 unset） |
| `--rail-w-expanded: 240px` | `--rail-w-expanded`（不变） |
| `--rail-w-collapsed: 80px` | `--rail-w-collapsed`（不变） |
| `padding: var(--sp-4) var(--sp-5)` | `padding: var(--space-4) var(--space-5)`（不变） |
| Reading 限宽 | `--max-w-reading`（720，不变） |
| Form 限宽 | `--max-w-form`（560，不变） |
| Prose 限宽 | `--max-w-prose`（800，不变） |

**禁**：
- ❌ 再把 `1440px` 写回 `workspace` 默认值
- ❌ 用 page-level hack 覆写 `Workspace` 去规避共享问题
- ❌ 把 `question-hub`、`/me`、`/profile/*` 单独特判成 page-local `max-width: none`

## 5. SSOT Conflicts

| 冲突 | Prototype / current truth | 冲突方 | 当前裁决 |
|---|---|---|---|
| 1920 workspace 是否 cap 1440 | 入口原型 `.workspace { flex: 1 }`；Home audit 实测要求吃满 Rail 余宽 | V5 `R2/Q5` / `--max-w-workspace = 1440px` / `v5-rail-demo.html` | **Route A 生效**：2026-05-27 lhr 拍板，全局取消 `workspace` 默认 cap |
| issue 描述仍写 Route B 验收项 | `Workspace.tsx` variant 升级 / 8 view 显式声明 / `lint-view-canvas-width` | 2026-05-27 16:16 comment 改成 Route A | 以 comment `f4ee18ab-6294-46a9-9ce3-8b20cc21a87d` 为准，description 需回写 |
| issue source docs 路径过期 | `docs/reviews/sik-fu-a-home-1920-audit.md` / `...postmortem.md` | 仓内真实文件名与其不一致 | description 必须改成仓内真实路径，避免 reviewer 按死链验收 |
| QuestionHub 路由名 | issue 描述写 `/practice/hub` | 实际 router 是 `/question-hub` | 以 `apps/web/src/router/index.tsx` 为准，contract/issue 一律写 `/question-hub` |

如后续某个 Reading/Form surface 需要恢复 cap，必须开 follow-up issue 显式声明 owner，不得偷偷改回 `workspace` 默认值。

## 6. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| 8 个入口 view 横向画布 | 1440/1920 都吃满 Rail 余宽 | Route A 追平原型 | no drift | 2026-05-27 |
| `workspace` token 语义 | 原型无独立 cap token | 生产保留 token 名，但值改成 `none` | 保留 API 名称，减少代码面扩散；仅改语义 | 2026-05-27 |
| Reading/Form surfaces 可能变宽 | 原型 issue 不覆盖这些运行时/表单页 | 本 issue 不在同一 wave 重新限宽 | accepted side effect，后续按 surface 单开 | 2026-05-27 |

## 7. Acceptance Hooks

| # | 项 | 原型 / source | 实现位置 | 状态 |
|---|---|---|---|---|
| H01 | `docs/plan/sik-128-workspace-dashboard-visual-contract.md` 已落地，且 issue `## Acceptance` 显式引用 | 本文件 | Multica issue description | ☐ |
| H02 | `--max-w-workspace` 不再是 `1440px` | `.tmp_review/home-frame.html` / old V5 docs | `packages/design-system/src/tokens.css` | ☐ |
| H03 | `Workspace maxWidth="workspace"` 默认仍由 `RootLayout` 统一提供，不引入 8 个 page hack | 共享 RootLayout | `apps/web/src/layouts/RootLayout/RootLayout.tsx` | ☐ |
| H04 | `00-Decisions` / `02-Token-System` / `03-Components` / `Design-System` 全部写成 Route A 真相 | 旧文档 claims `1440` | 对应文档 | ☐ |
| H05 | `visual-contract-workflow.md` + `AGENTS.md` + `CLAUDE.md` + `agent-hard-rules.md` 新增 `SSOT Conflicts` 与 `1920/1440` 桌面验收要求 | issue action items | 对应文档 | ☐ |
| H06 | FU-A / FU-B / FU-C / FU-D 旧 contract 已回扫补 `SSOT Conflicts` 节，并注明 1920 desktop mandatory | 4 份旧 contract | 对应文档 | ☐ |
| H07 | 8 个入口 route 在 1920 expanded/collapsed 下不再出现 1440 cap gutter | 入口原型 | Browser smoke + screenshot archive | ☐ |
| H08 | 8 个入口 route 在 1440 expanded/collapsed 下仍无横向裁切、无控件丢失 | 入口原型 | Browser smoke + screenshot archive | ☐ |
| H09 | 关键交互元素（§2）在 Route A 后全部仍可见可点 | 各入口原型 / contracts | Browser smoke + existing tests | ☐ |
| H10 | `typecheck + lint + tests + browser smoke` 有 PASS 证据；未授权 subagent review 时不得标 done | AGENTS H5/H8 | Evidence Block | ☐ |

Chrome MCP 双开 diff 截图归档到 `.tmp_review/visual-diff/sik-1920-cap/`：

- 命名模式：
  - 独立原型页：`prototype-<slug>-<viewport>-expanded.png`
  - 实现页：`implementation-<slug>-<viewport>-<state>.png`
- `slug ∈ {home,practice,review,note,me,profile-learning,profile-records,question-hub}`
- `viewport ∈ {1440,1920}`
- `state ∈ {expanded,collapsed}`

说明：

- 当前 8 个独立 prototype page 没有统一暴露 live collapse 控件，所以 prototype 侧按 `expanded` 基线归档。
- `collapsed` 对比以实现页为准；若后续需要原型 collapse 基线，owner 应补 shared `home-frame` / `v5-rail-demo` 对照图。

最少 48 张图（16 张 prototype expanded + 32 张 implementation expanded/collapsed）；若某 route 无独立 prototype page，必须在对照表里显式写明复用依据。

## 8. Wave Plan

- **Wave 0**：落本契约 + requirements + issue description truth sync
- **Wave 1**：Route A 代码与 V5 / Vault 文档同步
- **Wave 2**：workflow / AGENTS / old contract backfill
- **Wave 3**：1920/1440 browser smoke + screenshot archive + Evidence Block

## 9. 参考

- `docs/reviews/sik-128-merge-main-w1.md`
- `docs/vault/04-design/Design-System.md`
- `docs/vault/04-design/Web-Layout.md`
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/engineering/visual-contract-workflow.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/00-Decisions.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/02-Token-System.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/03-Components.md`
- `.tmp_review/out/Tab1-Home/Home v2.1.html`
- `.tmp_review/out/Tab2-Practice/Practice v1.html`
- `.tmp_review/out/Tab3-Review/Review v1.html`
- `.tmp_review/out/Tab4-Notes/Note v2.1.html`
- `.tmp_review/out/Tab5-Profile/Me v1.html`
- `.tmp_review/out/Tab5-Profile/Profile Learning v1.html`
- `.tmp_review/out/Tab5-Profile/Profile Records v1.html`
- `.tmp_review/out/_cross/Question Hub v2.html`
