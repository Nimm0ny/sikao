---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-30
issue: SIK-143
parent-issue: SIK-112
prev-owner-contracts:
  - docs/plan/sik-fu-a-home-visual-contract.md
  - docs/plan/sik-fu-d-progress-recommendation-visual-contract.md
review-trigger: docs/reviews/sik-fu-d-bottomrow-density-w1.md
prototype:
  - .tmp_review/out/Tab1-Home/Home v2.1.html
---

# SIK-143 · Home 底栏 4 卡等宽收口 + 卡头瘦身 + 一屏不溢出 视觉契约（H11）

> 收口 SIK-127 落地后独立视觉规范审查（`docs/reviews/sik-fu-d-bottomrow-density-w1.md`，2026-05-30）
> 发现的 P0/P1：左二卡用无收口 `<Panel>` 一屏溢出、57px Panel header + 双重标题、4 处裸 `9999px`、
> `Home.module.css` 死代码。lhr 2026-05-30 拍板修复并调整列口径。

## 0. Scope

- **改动对象（严格限定）**：
  - `apps/web/src/views/Home/Home.tsx`（左二卡 `<Panel title>` → `.bottomCard` + 内部 section；4 卡 `data-testid="panel"` + `aria-label`）
  - `apps/web/src/views/Home/Home.module.css`（`.bottomRow` 列改等宽 + `overflow:hidden`；删死代码 class）
  - `apps/web/src/views/Home/sections/RecommendationSection.{tsx,module.css}`（补 `bc-head`「今日推荐」+ 刷新 icon-btn；list 局部滚）
  - `apps/web/src/views/Home/sections/ProgressSection.module.css`（`9999px`→token）
  - `apps/web/src/views/Home/sections/WeeklyReviewSection.module.css`（`9999px`→token）
  - `apps/web/src/views/Home/sections/RecentPracticeSection.module.css`（`9999px`→token）
- **不碰**：Rail / RootLayout nav / BottomTabBar / navItems（H12）；Workspace / AppShell / Panel 组件；
  Topbar / MetricRow / Calendar；ProgressSection.tsx（已有内部 bc-head，无须改）。
- **owner**：本契约 owner = 底栏 4 卡布局收口 + 卡头统一 + 列口径修订（supersede SIK-127 的 `1.4/1.2/1fr`）。

## 1. Layout Topology

### 1.1 Root grid（bottomRow）

```css
.bottomRow {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1fr);
  gap: var(--space-4);
  min-height: 0;
  overflow: hidden;   /* 新增：四卡被压缩时裁在 row 内，不向 view 外溢出 */
}
```

- **左两列严格等宽**：col1 / col2 都是 `minmax(0, 1.4fr)`；右窄列 `minmax(0, 1fr)` 承载上下两小卡。
- `minmax(0, *)` 强制：避免 `fr` 默认 `min-width:auto` 被长内容撑破等宽。

### 1.2 右列 rightStack（col3）

```css
.rightStack {
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: var(--space-4);
  min-height: 0;
}
```

- 上下两卡 `rows: 1fr 1fr` → **等高**。
- 右栈总高 = 左卡高：四卡同在 `bottomRow` 的 `minmax(0,1fr)` 行（ScreenLockShell 第 4 行），
  grid 默认 `align-items: stretch` 天然等高；前提是 `.bottomRow { overflow: hidden }` + 四卡 `min-height:0`。

### 1.3 一屏行为（lock）

- Home 由 `<ScreenLockShell rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)">` 包裹（不变，H12 范畴外）。
- 底栏整行 = 第 4 行 `minmax(0,1fr)`：**lock**，不整页滚。
- 卡内列表（weak-list / feed-list）= **局部滚**：`min-height:0 + overflow-y:auto`，内容多时滚动不裁切。
- root grid 行/列：行由 ScreenLockShell owner（不动）；本契约只 owner 第 4 行内部的 3 列分配。

### 1.4 子区域 owner

| 子区域 | owner | 说明 |
|---|---|---|
| `.bottomRow` 3 列分配 + overflow | SIK-143（本契约） | supersede SIK-127 `1.4/1.2/1fr` |
| col1 今日推荐卡 | SIK-143（卡头收口）/ SIK-92（feed 业务语义） | 业务流程不动 |
| col2 学习进度卡 | SIK-143（卡头收口）/ SIK-91（bar 业务） | bar 视觉不动 |
| col3 上 本周备考回顾 | SIK-FU-A | 仅 token 收敛 |
| col3 下 最近练习 | SIK-127 | 仅 token 收敛 |

## 2. Required Interactive Elements

全底栏 4 卡统一用 `bc-head`（h4 13px/700 + 右侧 link / pill / icon-btn），**移除 57px Panel header**。

| 卡 | bc-head 标题 | bc-head 右侧元素 | 列表/主体 |
|---|---|---|---|
| col1 今日推荐 | h4「今日推荐」 | **刷新 icon-btn**（inline SVG + `aria-label="刷新推荐"`，替换原浮底 `刷新推荐` Button） | feed-list（`min-height:0 + overflow-y:auto`）|
| col2 学习进度 | h4「Top 3 弱项」（内层，已存在） | a「弱项分析 →」→ `/profile/learning?range=30d` | weak-list × 3 |
| col3 上 本周备考回顾 | h4「本周备考回顾」（已存在） | streak pill「坚持 N 天」 | ring 64×64 + 7 dots |
| col3 下 最近练习 | h4「最近练习」（已存在） | a「全部历史」→ `/profile/records` | feed-item × 2 |

### 2.1 刷新 icon-btn 规格

- 替换 `RecommendationSection` 原 `refreshRow` 浮底 `<Button>刷新推荐</Button>`。
- 落点：`bc-head` 右侧，与原型 topbar `.icon-btn` 同款（36×36 方形 + 圆角 + hover）。
- icon 用 **inline SVG**（不是 SpriteIcon）：sprite 无 refresh 图标，新增 sprite 会改 `packages/design-system`（超 Scope）。
  inline SVG 遵循 SVG-only stroke 契约：`viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap/linejoin="round"`。
  `lint-icon-style.mjs` 只扫 `.svg` 文件，不扫 tsx 内 inline svg；与 WeeklyReviewSection ring inline svg 同例。
- a11y：`<button aria-label="刷新推荐">` → 满足 `lint-icon-button`（icon-only button 必须 aria-label）。
- 文案：原 `刷新推荐` 按钮的可见文字移除，但 `aria-label="刷新推荐"` 保留 →
  `Home.test.tsx` / `RecommendationSection.test.tsx` 用 `getByRole('button', { name: '刷新推荐' })` 仍命中。

### 2.2 4 卡 data-testid + aria-label（a11y 保持）

- 4 卡都保留 `data-testid="panel"`（`Home.test.tsx` `getAllByTestId('panel').length===4`）。
- 左二卡从 `<Panel title>`（带 `aria-labelledby`）改为裸 `<section className={bottomCard}>`，
  失去 Panel 的 `aria-labelledby`，故各补 `aria-label` 替代：
  - col1 `aria-label="今日推荐"`
  - col2 `aria-label="学习进度"`
  - col3 上 `aria-label="本周备考回顾"`、下 `aria-label="最近练习"`（右栈两卡补齐，原本无 label）。

## 3. Information Density

| 卡 | 视觉块数 | 视觉编码 |
|---|---|---|
| col1 今日推荐 | bc-head（标题 + 刷新 btn）+ feed-item × N | feed-icon kind 染色（k-practice/k-review/k-rest）+ name + sub + pill |
| col2 学习进度 | bc-head（标题 + link）+ weak-item × 3 | name(90px) + bar(track+fill, err≤50% 红) + val(36px tabular-nums) |
| col3 上 本周回顾 | bc-head（标题 + streak pill）+ ring + 7 dots | ring 完成率 % + dot full/half/empty |
| col3 下 最近练习 | bc-head（标题 + link）+ feed-item × 2 | feed-icon + name + sub + score pill |

- weak-list / feed-list（今日推荐）走 `min-height:0 + overflow-y:auto` 局部滚，内容多时不撑破卡。
- 每卡 `overflow: hidden`（`.bottomCard`），收窄时裁在卡内而非撑破 row。

## 4. Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`（H11 强制查表）。本次涉及的映射：

| 原型 var | V5 token | 用途 |
|---|---|---|
| `--r-pill` | `--radius-999`（9999px） | bar-track/bar-fill/streak-pill/feed-pill 圆角 |
| `--r-tiny` | `--radius-10` | feed-item / feed-button 圆角 |
| `--r-card` | `var(--card-radius)`（→ radius-16） | `.bottomCard` 卡圆角 |
| `--paper-1/-2/-3` | `--color-bg-surface/-elevated/-sunken` | 卡底 / feed 底 / track 底 |
| `--ink-1/-2/-3` | `--color-text-primary/-secondary/-meta` | 文字层级 |
| `--line-1/-2` | `--color-border-subtle/-default` | 边框 |
| `--ok/-50` | `--color-state-ok/-soft` | streak pill / 完成态 |
| `--shadow-1` | `var(--card-shadow-rest)`（→ shadow-l1） | 卡阴影 |
| `--icon-md` | n/a → inline `width/height` 16px | 刷新 icon-btn svg 尺寸 |
| `--h-md` | `--btn-h-md`（36px） | 刷新 icon-btn 方形边长 |

> 注：Prototype-Token-Map §5 把 `--r-pill → --radius-999` 标值 `999px` 系上游笔误，
> 生产 `tokens.css:335` 真值为 `9999px`；本契约以生产 token 为准（`--radius-999` = `9999px`）。

### 4.1 本次 token 修复（本契约 4 个 section 内 4 处裸值 → token）

> 范围口径：仅本契约 Scope 的 4 个 section 文件；全仓另有 `MetricRow.module.css` 的 9999px 不在 Scope，不在本次收敛范围。

| 文件:行 | before | after |
|---|---|---|
| `ProgressSection.module.css` barTrack | `border-radius: 9999px` | `border-radius: var(--radius-999)` |
| `ProgressSection.module.css` barFill | `border-radius: 9999px` | `border-radius: var(--radius-999)` |
| `WeeklyReviewSection.module.css` streakPill | `border-radius: 9999px` | `border-radius: var(--radius-999)` |
| `RecentPracticeSection.module.css` feedPill | `border-radius: 9999px` | `border-radius: var(--radius-999)` |

### 4.2 非 token 字号集中登记（spacing-allow，保留不改）

原型密度妥协字号，不在 V5 type-scale 桶（`--font-tiny:11 / --font-meta:12`），带 `spacing-allow` 理由注释保留：

| 文件 | 字号 | 用途 |
|---|---|---|
| `ProgressSection.module.css` weakVal | `10.5px` | 原型 weak-val 10.5 |
| `WeeklyReviewSection.module.css` streakPill | `10px` | 原型 pill 10 |
| `WeeklyReviewSection.module.css` dotLabel | `9.5px` | 原型 day-col 9.5 |
| `RecentPracticeSection.module.css` feedName | `11.5px` | 原型 feed-name 11.5 |
| `RecentPracticeSection.module.css` feedSub/feedPill | `10px` | 原型 feed-sub/pill 10 |

> 本次不新增非 token 字号，仅集中登记既有项（issue Non-goals 明确不改这些字号）。

## 5. SSOT Conflicts

| 冲突 | A 方（原型/前序） | B 方（本次） | 采用 | lhr 拍板 |
|---|---|---|---|---|
| 底栏列比例 | SIK-127 `1.4fr 1.2fr 1fr`（裸 fr，左二不等宽） | `minmax(0,1.4fr) minmax(0,1.4fr) minmax(0,1fr)`（左二严格等宽） | **B（本次）** | 2026-05-30 |
| 左二卡容器 | SIK-127 用 `<Panel title>`（57px header） | `.bottomCard` + 内部 bc-head（无 57px header） | **B（本次）** | 2026-05-30 |
| 学习进度卡标题 | Panel title「学习进度」+ 内层「Top 3 弱项」（双标题） | 仅内层「Top 3 弱项」 | **B（本次）** | 2026-05-30 |

- 采用 B 后须同步更新 `docs/vault/04-design/Web-Layout.md` §5 owner 表的 bottomRow 行（标注 SIK-143 supersede SIK-127 列口径）—— 文档同步在本 issue 收尾或后续 doc commit 处理，不阻塞实现。

## 6. Visual Drift from Prototype

| 项 | 原型 Home v2.1 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| 底栏结构 | `.bottom-row` 是 **3 等宽卡**（`1fr 1fr 1fr`），无 right-stack | 沿用 SIK-127 right-stack 扩展（col3 上下两小卡）+ 左两列等宽 `1.4/1.4/1fr` | right-stack 是 SIK-127 对 v2.1 的既有扩展（已认定）；本次只把左二列从 `1.4/1.2` 改等宽 | 2026-05-30 |
| 列比例 | 原型 `1fr 1fr 1fr` 三等宽 | `1.4/1.4/1fr`（左二等宽、右窄） | right-stack 占第 3 列承载两卡，需更窄；左二大卡承载主内容需更宽且等宽 | 2026-05-30 |
| 刷新入口 | 原型「今日推荐」对应位是「最近练习」feed，无刷新按钮 | bc-head 右侧刷新 icon-btn | SIK-92 把语义改为「今日推荐」需刷新动作；从浮底 Button 上移到 bc-head 更贴原型 icon-btn 模式 | 2026-05-30 |

> 除上述登记项外，卡头规格 / feed-item / weak-item / ring 视觉一律对齐原型，no further drift。

## 7. Acceptance Hooks

### 7.1 实现 vs 原型对照表

| # | 项 | 原型基准 | 实现位置 | 验收 |
|---|---|---|---|---|
| A1 | 底栏列等宽 + overflow | `.bottom-row`（HTML L1030-1036） | `Home.module.css .bottomRow` | ☐ PASS / 偏离 |
| A2 | 右栈上下等高 | right-stack（SIK-127 扩展） | `Home.module.css .rightStack rows:1fr 1fr` | ☐ |
| A3 | 全 4 卡 `.bottomCard` + bc-head（无 57px Panel header） | `.bottom-card`（L1036-1046）+ `.bc-head`（L1047-1059） | `Home.tsx` + `*.module.css .head` | ☐ |
| A4 | 学习进度卡无双标题（仅 Top 3 弱项） | `.bottom-card` 第 2 格（L1479-1502） | `Home.tsx` col2 去 Panel title | ☐ |
| A5 | 今日推荐 bc-head + 刷新 icon-btn | `.icon-btn`（L390-401）+ bc-head（L1047） | `RecommendationSection.tsx` | ☐ |
| A6 | feed-list / weak-list 局部滚 | `.feed-list`（L1134-1140）/ `.weak-list`（L1101-1104） | `RecommendationSection.module.css .list` | ☐ |
| A7 | 4 处 9999px → `--radius-999` | `--r-pill` 映射（Token-Map §5） | Progress/Weekly/RecentPractice module.css | ☐ |
| A8 | Home.module.css 死代码删除 | n/a | `Home.module.css` | ☐ |
| A9 | 1920×1080 一屏不溢出 | Web-Layout §1 | Chrome MCP 量表 | ☐ |
| A10 | 1440×900 一屏不溢出 | Web-Layout §1 | Chrome MCP 量表 | ☐ |

### 7.2 截图归档路径

`.tmp_review/visual-diff/sik-143/`：
- `prototype-desktop-1440x900.png` / `implementation-desktop-1440x900.png`
- `prototype-desktop-1920x1080.png` / `implementation-desktop-1920x1080.png`

量表证据：`ScreenLockShell.scrollHeight <= clientHeight`、`document.documentElement.scrollHeight <= clientHeight`（无整页滚）、4 卡 `getBoundingClientRect().bottom <= bottomRow.bottom`（卡底不被裁）。

## 8. 参考

- `docs/reviews/sik-fu-d-bottomrow-density-w1.md`（审查触发源 + root cause）
- `docs/vault/04-design/Web-Layout.md` §1 一屏锁死 / §5 owner 表
- `docs/vault/04-design/Prototype-Token-Map.md` §5 圆角 / §12 反模式
- `docs/plan/sik-fu-a-home-visual-contract.md` / `docs/plan/sik-fu-d-progress-recommendation-visual-contract.md`
- 原型：`.tmp_review/out/Tab1-Home/Home v2.1.html` `.bottom-row / .bottom-card / .bc-head / .weak-list / .feed-list`
