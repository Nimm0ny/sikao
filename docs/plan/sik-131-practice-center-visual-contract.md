---
type: plan
status: active
owner: lhr
last-reviewed: 2026-05-31
sik: SIK-131
prototype: .tmp_review/out/Tab2-Practice/Practice v1.html
supersedes-note: >
  SIK-150 prep issue (Notion) 声称已交付 docs/plan/sik-150-practice-visual-contract.md
  (commit 2850f61)，但该 commit 与文件在当前 main (ae56b841d) + 全部远端 ref 均不存在
  (lhr 2026-05-31 确认：另一台机器在跑，尚未 push)。本契约在当前 main 基础上新落，
  归 SIK-118 子线 SIK-131 (M-Center) + SIK-133 (M-Entry)。待另一台机器 push 后，
  若 sik-150-practice-visual-contract.md 出现，需做一次 reconcile（见 §8 Reconcile）。
---

# SIK-131 · Practice 练习中心主视图 视觉契约（H11 Define-First）

> 原型 SSOT：`.tmp_review/out/Tab2-Practice/Practice v1.html`（1591 行，已通读）。
> 目标：把原型卡片布局 / 字体 / 颜色 / 交互 100% 还原到生产 `/practice` 入口主视图
> `apps/web/src/views/Practice/`。本契约覆盖**练习中心主视图**（练习中心容器 +
> Row1 quick + history + 专项练习 + 套卷练习），不含答题运行时 / 结果 / 模考（属
> SIK-132 / SIK-134）。
>
> lhr 拍板汇总（2026-05-31）：C1 以原型 / C2 新建 CategoryTree / C3 双模式默认 segment /
> C4 沿用 ScopeToggle / C5 = D1 黑岛黄岛反相 / C6 后端字段 H6 定义另开子任务。

## 0. 现状与差距（原型 vs 现有实现 vs D.4.2）

现有实现 `apps/web/src/views/Practice/`（SIK-26/27/28 骨架）功能接线齐全
（query/store/dialog/session 全通），但**视觉是通用 3-col Panel grid**，与原型不是
一个东西。本任务保留全部数据接线（hooks / store / mutation），**只重写视觉骨架**。

| 区块 | 原型 | 现有实现 | 本任务动作 |
|---|---|---|---|
| 整体 grid | 4 行 topbar/row1/专项/套卷 | `auto auto auto 1fr` + 3-col Panel | 重写为 4 行 grid |
| Row1 左 | 2×2 quick-grid（continue 黑岛 + 3 入口） | 一排按钮 | 新建 quick-grid |
| Row1 右 | history-panel + segment + 5 分数态 | 双列文字 | 新建 history-panel |
| 专项 | 单列 L1 可展开 + L2 嵌套 | details group | 新建 CategoryTree |
| 套卷 | 单列 paper-row + segment | filterBar 5-Select | 重写 + 双模式 |

## 1. Layout Topology

### 1.1 Root grid（原型行号 164-177）

原型 `.workspace`：`grid-template-rows: var(--topbar-h) minmax(0,224px) minmax(0,1fr) minmax(0,1fr)`，
gap `--sp-4`(16px)，`height:100vh; overflow:hidden`。`@media (max-height:800px)` 时
row1 收到 192px（原型行号 146-161）。

生产实现：`/practice` 在 Web-Layout §1.1 白名单，**强制 `<ScreenLockShell>`**。

```
<ScreenLockShell rows="auto minmax(0,224px) minmax(0,1fr) minmax(0,1fr)" testId="practice-view">
  <PageHeader />                {/* row0 · topbar 替身 (含 ScopeToggle + CTA) */}
  <section class=row1>          {/* row1 · 224 · quick-grid(3fr) + history-panel(2fr) */}
  <CategoryTree section />      {/* row2 · 1fr · 专项练习, 内部局部滚 */}
  <PaperList section />         {/* row3 · 1fr · 套卷练习, 内部局部滚 */}
</ScreenLockShell>
```

- 一屏行为：**lock**（入口 view 不整页滚）。
- 局部滚区：history-list / 专项 sec-scroll / 套卷 sec-scroll 各自 `min-height:0; overflow:auto`。
- row0 用 `auto`（PageHeader 自然高 ≈ topbar-h），原型是固定 `--topbar-h`；差异见 §6 drift。
- `@media (max-height:800px)` row1 收 192：本任务用 ScreenLockShell rows 媒体覆盖实现（§6 记录）。

### 1.2 子区域 owner（wave 分配）

| 区块 | owner wave | 落点文件 |
|---|---|---|
| token 先行（continue + category + 卡宽/gap） | W1 | `packages/design-system/src/tokens.css` |
| ScreenLockShell grid + PageHeader + ScopeToggle 接线 | W2 | `Practice.tsx` / `Practice.module.css` |
| Row1 quick-grid（4 卡 + continue D1） | W2 | `PracticeQuickGrid.tsx` |
| Row1 history-panel（segment + 5 分数态） | W3 | `PracticeHistoryPanel.tsx` |
| 专项 CategoryTree（L1/L2 可展开） | W4 | `components/practice/CategoryTree/` |
| 套卷 PaperList（segment + 筛选浮层双模式） | W5 | `PracticePaperList.tsx` |

每 wave ≤15 文件、≤400 净增；token 先行（W1）单独 commit，plan 与实现分属不同 commit。

## 2. Required Interactive Elements

按原型逐块列。`行为`列写点击/交互后做什么；`defer` 标记本视觉 wave 不做的。

### 2.1 PageHeader（原型行号 825-845）

| 元素 | 位置 | 行为 | 备注 |
|---|---|---|---|
| 标题 "练习中心" h2 | 左 | — | PageHeader title（现有 h1，drift §6） |
| ScopeToggle 行测/申论 | 标题右侧同排 | 切 scope，全局联动专项/套卷/history | `<ScopeToggle>`（C4） |
| 搜索 icon-btn | 右 | 打开搜索（占位 → `defer`，本 wave 渲染不接线） | aria-label="搜索" |
| 主 CTA "自定义刷题" | 右 | 打开 `CustomPracticeDialog` | 黄底，现有已接线 |

### 2.2 Row1 · quick-grid（原型行号 850-911）

| 元素 | 位置 | 行为 | 备注 |
|---|---|---|---|
| ① 继续做题卡（continue D1） | grid 1,1 | 跳 `/practice/sessions/:activeId` | 黑岛/黄岛，进度条 + CONTINUE tag；无 active session 时态见 §3 |
| ② AI 出题卡 | grid 1,2 | 跳 AI 出题流（`defer` 接线到 SIK-133，本 wave 渲染） | tag "AI" |
| ③ 智能组卷卡 | grid 2,1 | 打开自定义刷题/组卷（接线现有 dialog） | tag "NEW" |
| ④ 每日一练卡 | grid 2,2 | 创建每日一练 session（现有 `handleCreateDaily`） | tag "N 题" |

continue 卡无 active session 时：降级为"开始练习"引导态（不渲染进度条），见 §3.1。

### 2.3 Row1 · history-panel（原型行号 914-1008）

| 元素 | 位置 | 行为 | 备注 |
|---|---|---|---|
| 标题 "历史记录" h3 | panel head 左 | — | — |
| h-segment（全部/专项/套卷） | panel head 右 | 过滤 history-list（data-kind） | `<Tabs variant="segmented" size="sm">` |
| h-row × N | list（局部滚） | 点击跳对应 session 结果/复盘 | 5 分数态见 §3.3 |

### 2.4 专项练习 CategoryTree（原型行号 1011-1287）

| 元素 | 位置 | 行为 | 备注 |
|---|---|---|---|
| sec-head "A 专项练习" + 总题数 | head | — | 总题数随 scope 变（原型 JS 行 1518） |
| cat-l1 行（twig+名+题数+进度条+正确率） | scroll | 点击展开/收起 L2 | 默认首项展开（原型 `is-open`） |
| cat-l2 行（dot+名+题数+正确率+go） | L1 展开后显示 | 点击进专项配置（带 categoryL1/L2 preset 开 dialog） | 现有 `onOpen` 接线 |

### 2.5 套卷练习 PaperList（原型行号 1290-1410）

| 元素 | 位置 | 行为 | 备注 |
|---|---|---|---|
| sec-head "B 套卷练习" | head 左 | — | — |
| sec-segment（全部/真题/押题） | head 右 | 过滤 paper-row（data-ptype） | **默认模式**（C3）；`<Tabs segmented sm>` |
| 筛选 icon-btn（漏斗） | head 右，segment 旁 | 打开高级筛选浮层（5-Select） | **C3 第二模式**，收进 Popover/Sheet |
| paper-row × N | scroll（局部滚） | 点击/按钮：继续/复盘/开始 | pill 标签 + 3 项 meta + 状态 + go |

筛选浮层（C3 高级模式）：复用现有 `PapersSection` 的 5-Select（年份/地区/类型/难度/排序），
搬进 `<Popover>`（desktop）/ `<Sheet>`（mobile），由漏斗 icon-btn 触发。segment 与浮层
筛选可叠加（segment 过 ptype，浮层过 year/region 等）。

### 2.6 scope 全局联动（原型 JS 行号 1519-1545 applyScope）

行测/申论切换时**同步**：专项 cat-group 切换 + 套卷 paper-group 切换 + history scope
过滤 + 专项总题数文案。现有 `setSegment` store action 承接，本 wave 补齐三处联动渲染。

## 3. Information Density

### 3.1 continue 卡（D1，原型行号 306-388）

- 信息块：icon(play) / 标题(套卷名) / meta(分类·暂停时间) / CONTINUE tag / 进度条(track+fill) / ratio(已答 X/Y + 百分比)。共 6 块。
- 视觉编码（D1，lhr 2026-05-31 拍板）：
  - light：黑底(`--practice-continue-bg`=text-primary) + 白字(text=bg-surface) + 黄进度(fill=brand-primary)
  - dark：反相黄底(bg=brand-primary) + 黑字(text=text-on-brand) + 黑进度(fill=text-on-brand)
  - 邻居白卡对比：浅色黑岛浮白海 / 深色黄岛浮暗海，两主题都最跳（对比 `.tmp_review/visual-diff/sik-150/continue-card-options.png`）
- 数值排版：进度百分比 + X/Y 用 tabular-nums。
- 状态量（4 态）：
  - ready（有 active session）：渲染全部 6 块
  - empty（无 active session）：降级"开始练习"引导，隐藏进度条 + ratio，标题改引导文案
  - loading：Skeleton 占位（沿用 atom/Skeleton）
  - error：active sessions query 失败 → 降级 empty 态（fail-safe 仅此卡，不抛断整页）

### 3.2 quick 卡 ②③④（原型行号 868-911）

- 信息块：icon / 标题 / 子说明 / tag。共 4 块。
- icon 底 `--color-bg-sunken`，圆角 `--radius-12`，48×48。
- tag pill：默认灰底（bg-elevated + border-default），AI/NEW 文字 tag。

### 3.3 history h-row 5 分数态（原型行号 922-1006）

| 态 | 原型 class | 视觉 | 数据来源（C6） |
|---|---|---|---|
| 完成分数 | `.h-score` | 黑色大数字 + 单位 | `accuracyRate`/score |
| 正确率 X/Y | `.h-score.k-err/.k-ok` | 红/绿 X/Y | answered/total + tone |
| 未完成 | `.h-score.unfin` | warn 色"未完成" | completedAt=null |
| 批改中 | `.h-score.pending` | info 色 + clock icon "批改中" | **C6: 需 grading status 字段** |
| 普通分数 | `.h-score` | 黑色"38 /40" | score |

icon 分色：k-mock(黄)/k-section(info-soft)/k-essay(warn-soft)，按 data-kind 映射。
正确率色码走纯函数 `accuracyTone(rate)`（§3.6）。

### 3.4 cat-l1 / cat-l2（原型行号 548-657）

- L1 信息块：twig 箭头(可转) / 类目名 / 题数 / 进度条(64×4) / 正确率(带色码 lbl)。5 块。
- L2 信息块：dot / 名 / 题数 / 正确率 / go 箭头。5 块。
- 进度条 fill 色码 `k-ok/k-warn/k-err` 按正确率阈值；L1 默认 fill 黑（text-primary）。
- 状态量：loading(Skeleton) / empty(EmptyState) / error(Banner) / ready。

### 3.5 paper-row（原型行号 660-740）

- 信息块：pill 标签(NEW/押题/真题/申论/行测) / 标题 / meta 三项(时长 icon + 题数 icon + 人数 icon) / 状态(已答X/Y or 已完成分数 or 未开始) / go 按钮(继续cta/复盘ghost/开始)。
- meta 三项：时长(`timeLimitMinutes` C6 补) / 题数(`questionCount` 有) / 人数(`attemptUserCount` C6 补)。
- C6 缺字段处理：后端未补前，时长/人数渲染占位（"—"）或隐藏该 meta item，标 drift §6，不抛错。

### 3.6 确定性纯函数（方法论第3层）

原型无随机视觉，但有两处需抽纯函数 + 单测：
- `accuracyTone(rate: number): 'ok'|'warn'|'err'` — 正确率→色码阈值映射（L1/L2/history 共用）
- `historyScoreState(session): 'score'|'ratio'|'unfin'|'pending'|'plain'` — 5 分数态判定
阈值在 W1/W4 定义时锁死并写单测（RED→GREEN）。

## 4. Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`。本视图用到的原型 var → V5 token：

### 4.1 通用映射（查表既有）

| 原型 var | V5 token |
|---|---|
| `--paper-1` | `--color-bg-surface` |
| `--paper-2` | `--color-bg-elevated` |
| `--paper-3` | `--color-bg-sunken` |
| `--ink-1` | `--color-text-primary` |
| `--ink-2` | `--color-text-secondary` |
| `--ink-3` | `--color-text-meta` |
| `--ink-3-soft` | `--color-text-meta-soft` |
| `--ink-4` | `--color-text-disabled` |
| `--line-1` | `--color-border-subtle` |
| `--line-2` | `--color-border-default` |
| `--line-3` | `--color-border-strong` |
| `--brand-yellow` | `--color-brand-primary` |
| `--brand-yellow-hover` | `--color-brand-hover` |
| `--brand-yellow-soft` | `--color-brand-soft` |
| `--ok / --ok-50` | `--color-state-ok / -soft` |
| `--warn / --warn-50` | `--color-state-warn / -soft` |
| `--err / --err-50` | `--color-state-err / -soft` |
| `--info / --info-50` | `--color-state-info / -soft` |
| `--sp-3 / --sp-4 / --sp-5` | `--space-3 / -4 / -5` |
| `--r-card-sm(14)` | `--card-radius-sm`(12) |
| `--r-card(18)` | `--card-radius`(16) |
| `--r-tiny(10)` | `--radius-10` |
| `--r-pill` | `--radius-999` |
| `--shadow-1 / -2` | `--shadow-l1 / -l2` |
| `--row-h(52)` | `--row-h-md`(52) |
| `height:100vh + overflow:hidden` | `<ScreenLockShell>` |

### 4.2 新增 Practice 专属 component token（W1 落 tokens.css）

原型无对应、需立 token（按四层方法论"资产先行"；component 层主题稳定，dark 由内部
引用的 semantic token 自动跟随，照搬 tokens.css §8 calendar token 同主题双块范式）：

**continue 卡 D1（§4 component layer，light 默认 + dark 反相块）：**

```css
/* :root (light) — 黑岛 */
--practice-continue-bg:        var(--color-text-primary);
--practice-continue-text:      var(--color-bg-surface);
--practice-continue-text-soft: var(--color-neutral-400);
--practice-continue-line:      var(--color-border-strong);
--practice-continue-fill:      var(--color-brand-primary);

/* [data-v5-theme='dark'] — 黄岛反相 */
--practice-continue-bg:        var(--color-brand-primary);
--practice-continue-text:      var(--color-text-on-brand);
--practice-continue-text-soft: var(--color-neutral-700);
--practice-continue-line:      var(--color-text-on-brand);
--practice-continue-fill:      var(--color-text-on-brand);
```

**CategoryTree 特殊几何（无对应 token 的卡宽/条宽，立 token 而非裸值）：**

```css
--practice-cat-bar-w:      64px;   /* L1 进度条宽 (原型行 590) */
--practice-cat-bar-h:      4px;    /* L1 进度条高 */
--practice-l2-indent:      var(--space-5);  /* L2 缩进 (原型 padding-left 42px≈sp-5+sp-2) */
```

> continue 卡 icon 底原型用 `rgba(255,255,255,.12)`（黑底上的半透明白）。生产禁裸 rgba，
> 用 `color-mix(in srgb, var(--practice-continue-text) 12%, transparent)` —— 但 Prototype-Token-Map
> §12 红线禁 color-mix 百分比硬编码。**裁定**：此处 color-mix 的是 token 而非裸 hex，且无
> 等价既有 token，立专属 token `--practice-continue-icon-bg` 收编（W1），view 不写 color-mix。

### 4.3 categorical 题型色（cat-l1 icon / 题型标识）

专项类目若按题型上色，用 `--color-cat-{yanyu,shuliang,panduan,ziliao,shenlun}` +
`-soft`（既有）。**禁**与 state 色互换（Prototype-Token-Map §3 红线）。

## 5. SSOT Conflicts

| # | 冲突项 | 原型 authority | 系统 authority | 采用真相源 | lhr 拍板 |
|---|---|---|---|---|---|
| C1 | 专项/套卷布局：单列列表 vs 4-col grid | 原型单列 L1可展开+L2 / 单列 paper-row | Design-System D.4.2 "specialty 4-col grid + paper 4-col grid" | **原型单列列表** | 2026-05-31 |
| C2 | 专项练习组件 | bespoke 可展开树 | 组件库无现成两级可展开列表 | **新建可复用 `CategoryTree`**（`components/practice/`，不进 design-system） | 2026-05-31 |
| C3 | 套卷筛选 | 极简 3-段 segment | 现有 5-Select filterBar | **双模式并存，默认 segment**；5-Select 收进筛选浮层 | 2026-05-31 |
| C4 | ScopeToggle 实现 | `.scope-toggle` bespoke pill | Design-System #3：必须 `<Tabs variant="segmented">` 薄封装 | **沿用现有 `<ScopeToggle>`**（已合规），原型样式作视觉目标 | 2026-05-31（不冲突，确认） |
| C5 | continue 卡配色 | 硬编码 rgba + 手动 dark 反相 | V5 无"黑底白字"语义 token | **D1**：立 Practice 专属 component token，light 黑岛 / dark 黄岛反相 | 2026-05-31 |
| C6 | 数据维度（时长/人数/per-cat 正确率/批改中态） | 原型有 | `CatalogItemV2` 缺时长/人数/per-cat 正确率；`PracticeSessionSummaryV2` 缺 grading status | **H6 本契约定义字段（§5.1 DTO 草案），另开后端子任务实现**；前端先占位标 drift §6 | 2026-05-31 |

> C1 follow-up：建议另开小 commit 修正 `Design-System.md` D.4.2 措辞（4-col → 单列列表），
> 不混进本任务。owner = lhr 指派。

### 5.1 C6 后端字段定义（H6 Define-First，DTO 草案 → 另开子任务实现）

本契约只**定义边界**，实现拆给 Practice lane 后端/API 子任务（SIK-129 M-Maint / SIK-135 M-Stats）。
前端按目标字段实现，后端未到位前用占位 + drift。

**`CatalogItemV2` 拟补（套卷 paper-row meta）：**

```
timeLimitMinutes?: number | null   // 套卷标准时长（题库 paper 真实数据，paper-row "120 分钟"）
attemptUserCount?: number | null   // 参与人数（session 表 count distinct user，"3.1 万人"社交证明）
```

**专项 catalog 拟补（cat-l1 / cat-l2 正确率 + 进度）：**

```
// CatalogItemV2 已有 count；补 per-category 统计：
answeredCount?: number | null      // 该类目已答题数
accuracyRate?: number | null       // 该类目正确率（0-1，cat-l1/l2 正确率 + 进度条）
```

来源：practice stats 按 category 聚合（后端已有 stats 基础，需新增 group-by-category 聚合端点或扩展现有）。

**grading status（history 批改中态）：**

```
// PracticeSessionSummaryV2 拟补：
gradingStatus?: 'pending' | 'graded' | null   // 申论批改中态（h-score.pending）
```

落地顺序：本契约定义 → lhr 确认 → 开后端子任务实现 schema + 聚合 → 前端字段自然点亮。
前端 W2-W5 实现时：缺字段渲染占位（"—" / 隐藏 meta item / 不渲染 pending 态），不阻塞视觉还原。

## 6. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| Rail nav 项数 | 原型注释像 5-tab，实为 4-tab [首页/练习/复盘/笔记] | 生产 4-tab + RailMe | H12 nav baseline；原型已是 4-tab，实际无偏离 | 2026-05-31（no drift, 确认） |
| 标题语义 | h2 "练习中心" | PageHeader 渲染 h1（G-PH-1 PageHeader 写死 h1） | 共享原语 gap，PageHeader 无 headingLevel prop | 2026-05-31（已知 gap，沿用 h1） |
| topbar 高度 | 固定 `--topbar-h`(56) | PageHeader `auto` 自然高 | PageHeader 组件自带高度，不强锁 56 | 2026-05-31 |
| continue dark 配色 | 黄底黑字（手动反相） | D1 token 化黄底黑字（视觉等价） | 合规化，视觉 100% 等价原型 | 2026-05-31 |
| 卡圆角 | `--r-card` 18px | `--card-radius` 16px | Prototype-Token-Map §5 已校准 18→16 | 2026-05-31（既有校准） |
| 套卷筛选 | 仅 segment | segment + 筛选浮层（5-Select） | C3 双模式，新增高级筛选入口（增强非偏离） | 2026-05-31 |
| C6 缺字段 | 时长/人数/per-cat 正确率/批改中 | 占位或隐藏 | 后端字段未到位（§5.1 另开子任务） | 2026-05-31 |
| demo-toolbar | 原型右下角 theme/density 切换 | 不实现 | 原型 demo 专用，非生产功能 | 2026-05-31（no drift） |

## 7. Acceptance Hooks

给 Reviewer / Verifier 的对照清单。原型行号已用 grep 核实（`.tmp_review/out/Tab2-Practice/Practice v1.html`）。

| # | 项 | 原型行号 | 实现位置 | 状态 |
|---|---|---|---|---|
| A1 | workspace 4 行 grid（topbar/224/1fr/1fr）+ 一屏锁死 | 164-177 | `Practice.tsx` ScreenLockShell rows | ☐ |
| A2 | `@media max-height:800px` row1 收 192 | 146-161 | `Practice.module.css` 媒体覆盖 | ☐ |
| A3 | PageHeader 标题 + ScopeToggle 同排 + 搜索 icon + 黄 CTA | 825-845 | `Practice.tsx` PageHeader | ☐ |
| A4 | ScopeToggle 行测/申论（`<Tabs segmented>`） | 830-834 | `<ScopeToggle>` | ☐ |
| A5 | row-1 grid `3fr / 2fr` | 233-239 | `Practice.module.css` `.row1` | ☐ |
| A6 | quick-grid 2×2 | 241-247 | `PracticeQuickGrid.tsx` | ☐ |
| A7 | continue 卡 D1 黑岛（light）+ 进度条 + CONTINUE tag | 306-388, 853-867 | `PracticeQuickGrid` + token | ☐ |
| A8 | continue 卡 D1 黄岛反相（dark） | （token §4.2） | tokens.css dark 块 | ☐ |
| A9 | quick 卡 ②③④（AI/智能组卷/每日一练） | 868-911 | `PracticeQuickGrid` | ☐ |
| A10 | history-panel head + h-segment（全部/专项/套卷） | 914-921 | `PracticeHistoryPanel` | ☐ |
| A11 | h-row 5 分数态（分数/X-Y/未完成/批改中/普通） | 922-1006 | `PracticeHistoryPanel` + `historyScoreState()` | ☐ |
| A12 | h-row icon 分色（k-mock/k-section/k-essay） | 922-1006 | `PracticeHistoryPanel` | ☐ |
| A13 | 专项 sec-head "A" + 总题数随 scope 变 | 1011-1016 | `CategoryTree` | ☐ |
| A14 | cat-l1 可展开（twig 转 + L2 显隐） | 548-609 | `CategoryTree` / `CategoryL1Row` | ☐ |
| A15 | cat-l1 进度条 + 正确率色码 | 562-607 | `CategoryL1Row` + `accuracyTone()` | ☐ |
| A16 | cat-l2 行（dot+名+题数+正确率+go） | 610-657 | `CategoryL2Row` | ☐ |
| A17 | 套卷 sec-head "B" + segment（全部/真题/押题，默认模式） | 1290-1299 | `PracticePaperList` | ☐ |
| A18 | 套卷筛选浮层（5-Select，C3 高级模式） | （现有 PapersSection） | `PracticePaperList` + Popover/Sheet | ☐ |
| A19 | paper-row（pill+标题+3meta+状态+go） | 660-740 | `PracticePaperList` | ☐ |
| A20 | scope 全局联动（专项/套卷/history/总题数） | 1519-1545 | `Practice.tsx` + store | ☐ |
| A21 | 局部滚：history/专项/套卷各自 overflow:auto | 428-435,539-546 | 各 module.css | ☐ |
| A22 | `accuracyTone()` / `historyScoreState()` 纯函数 + 单测 | — | `PracticeModel.ts` + test | ☐ |

### 7.1 截图归档

`.tmp_review/visual-diff/sik-131/`（注：基线截图已先存 `sik-150/`，W2 起新建 sik-131/）：
- desktop **必须** `1440×900` + `1920×1080` 两档 × `prototype` + `implementation`
- 每档再分 light / dark 两主题（continue 卡 D1 反相验收强制双主题）
- 已存基线：`.tmp_review/visual-diff/sik-150/proto-{1440,1920}-xingce.png`、`proto-1440-shenlun.png`、`continue-card-options.png`

### 7.2 a11y

`vitest-axe` 0 violation：ScopeToggle / h-segment / paper-segment tablist 语义；
cat-l1 可展开 button aria-expanded；icon-only btn aria-label。命令 + log 路径在 Evidence Block 记录。

## 8. Reconcile（与另一台机器的 SIK-150 契约）

lhr 2026-05-31：另一台机器在跑 SIK-150 三棒，尚未 push。其声称的
`docs/plan/sik-150-practice-visual-contract.md`（commit 2850f61）在当前 main + 全部远端 ref
均不存在。本契约（sik-131）在当前 main 新落。

**Reconcile 触发**：当另一台机器 push 后，若出现 `sik-150-practice-visual-contract.md`：
1. 比对两份契约的 SSOT Conflicts / Drift / Token Map 是否冲突；
2. 若 sik-150 覆盖"练习中心/行测答题/答题结果三面"且 sik-131 只覆盖练习中心主视图，
   则 sik-131 作为 sik-150 练习中心面的细化版并入，或保留为 SIK-131 子线专档；
3. 由 Master 在 reconcile commit 里显式记录归并决策，避免双契约 drift。

## 9. 参考

- 原型：`.tmp_review/out/Tab2-Practice/Practice v1.html`
- `AGENTS.md` §0.2 H11 / H12
- `docs/engineering/visual-contract-workflow.md`
- `docs/vault/04-design/Design-System.md`（D.4.2 Practice）
- `docs/vault/04-design/Web-Layout.md`（§1 一屏锁死，/practice 白名单）
- `docs/vault/04-design/Prototype-Token-Map.md`（Token Map 查表来源）
- continue 卡方案对比：`.tmp_review/visual-diff/sik-150/continue-card-options.{html,png}`（D1 选定）
- Notion：SIK-131（M-Center）/ SIK-133（M-Entry）/ SIK-118（Tab2 总线）/ SIK-150（prep）
