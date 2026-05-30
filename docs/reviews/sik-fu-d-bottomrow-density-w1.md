# SIK-FU-D(?) · Home 底栏 4 卡密度 + 一屏收口 视觉规范审查 W1 (2026-05-30)

> Reviewer Mode（独立视觉规范审查官，只读，未改任何源码）。
> 结论先行：**changes-required**，且本次审查的两个前置依赖不成立（见 §0 Blockers）。

## 0. 审查前置 Blockers（最高优先级）

本次任务描述的两个核心输入物在仓库里都不存在，按 H11 / H8 必须先 fail-fast：

- **B1（P0）契约缺失**：任务点名的视觉契约
  `docs/plan/sik-<id>-home-bottomrow-density-visual-contract.md` **不存在**。
  `docs/plan/` 下与底栏相关的契约只有两份 owner：
  - `sik-fu-a-home-visual-contract.md`（SIK-FU-A，owner = bottomRow #1 weekly + AppShell + Calendar）
  - `sik-fu-d-progress-recommendation-visual-contract.md`（SIK-FU-D，owner = bottomRow #2/#3）
  底栏 4 卡 3 列布局本体是 Notion `SIK-127`（已 Done）。
  按 H11：「没有 visual-contract.md，不得开 Runner；不得标 done；issue acceptance 没显式
  引用 contract，issue 视为未完成」。因此本次"密度收口"任务没有可对照的验收 SSOT。

- **B2（P0）无待审改动**：`git status --short` 仅显示 3 个与本主题无关的改动
  （`apps/web/scripts/generate-types.mjs`、`apps/web/scripts/lint-query-key-uniqueness.mjs`、
  `packages/api-client/src/types/api.generated.ts`）+ 若干新 docs。
  **被审的 5 个 Home 文件全部处于 `main` 已提交态，working tree / stash / 本地分支均无
  "底栏密度收口"diff**。最近一笔底栏提交是 SIK-127（`1f6ad83bf` 4-card 3-col）。
  → 当前可审对象只能是 SIK-127 的 as-is 落地状态，不是一笔新的密度收口改动。

> 影响：本报告对"密度收口目标态"只能做 as-is 现状审计 + gap 分析，无法签发
> "本次改动通过"。Runner 若要继续，必须先补 B1 契约。

## 1. 检查范围

- `apps/web/src/views/Home/Home.tsx`（bottomRow 装配，L60-77）
- `apps/web/src/views/Home/Home.module.css`（bottomRow / rightStack / bottomCard）
- `apps/web/src/views/Home/sections/RecommendationSection.{tsx,module.css}`
- `apps/web/src/views/Home/sections/ProgressSection.module.css`（+ 关联 `.tsx`）
- 关联只读对照：`WeeklyReviewSection.*`、`RecentPracticeSection.*`、`RecommendationCard.tsx`、
  `components/layout/Panel/Panel.{tsx,module.css}`、`ScreenLockShell.*`、`atom/EmptyState/*`
- 基准：`.tmp_review/out/Tab1-Home/Home v2.1.html`（`.bottom-row` L1030-1144、DOM L1451-1540）
- 规范：Web-Layout.md §1-5、Prototype-Token-Map.md、sik-fu-a / sik-fu-d 契约

## 2. 逐项判定（任务 7 项）

### 判定 1 · 拓扑：3 列 = 左两等宽大卡 + 右列上下两小卡 — **FAIL（与任务口径不一致）**

- 现状 `Home.module.css:13` `grid-template-columns: 1.4fr 1.2fr 1fr`：三列**不等宽**，
  左二列 `1.4fr` / `1.2fr` 不相等；未用 `minmax(0, *)`，用裸 `fr`。
- 列内容（`Home.tsx:61-76`）：第1列「今日推荐」(Recommendation)、第2列「学习进度」(Progress)、
  第3列 `rightStack` 上下叠「本周备考回顾」+「最近练习」。
- 任务要求的「左两张等宽大卡 + 右列两小卡 + `minmax(0,*)` 且左两列相等」**未实现**。
- 但这恰好与现行 SSOT（Notion SIK-127 + Web-Layout §5 owner 表）一致：SIK-127 明确拍板
  `1.4fr 1.2fr 1fr`（lhr 2026-05-26）。
- **裁决**：任务的拓扑口径与已落档 SSOT（SIK-127）冲突。这是 `AGENT-H1` 冲突场景，
  不能默默按任务口径判 FAIL，必须由 lhr 拍板：是否要把 SIK-127 的 `1.4/1.2/1fr`
  改为「左两列等宽 + minmax(0,*)」。**未拍板前不得改列定义**（H12 同源精神 + §5 owner：
  bottomRow #1 owner=SIK-FU-A，#2=SIK-91，#3=SIK-92，跨格改列需协调）。
- 证据：`Home.module.css:11-15`；原型 `.bottom-row` 是 `1fr 1fr 1fr` 三等宽且**无 right-stack**
  （`Home v2.1.html:1030-1035` + DOM L1451 注释 `BOTTOM ROW · 3 cards`）。即 right-stack
  本身就是对 v2.1 的扩展（SIK-127 issue 内 lhr 已认这是「对 v2.1 的扩展」）。

### 判定 2 · 一屏锁死 — **PASS（机制）/ 偏 UNVERIFIED（实测）**

- `lint-screen-lock.mjs` 实跑 **exit 0**（`lint-screen-lock: 0 violations`）。
- 底栏链路 min-height/overflow 正确：
  - `Home.module.css:16` `.bottomRow { min-height: 0 }`
  - `:21-25` `.rightStack { min-height: 0 }`
  - `:44` `.bottomCard { min-height: 0; overflow: hidden }`
  - `ScreenLockShell.module.css:13` root `overflow: hidden` + `:16` rows 由 `minmax(0,1fr)` 提供
  - `Home.tsx:51` `rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)"` ✓
  - body 局部滚由 `<ScrollRegion>`（Calendar 行）承载，`scrollRegion { overflow:auto }`。
- **但**：1920×1080 / 1440×900 下 `ScreenLockShell.scrollHeight <= clientHeight` 的实测、
  「无祖先 overflow:hidden 裁切」「document 无整页滚」三项需 Chrome MCP 双开实测，
  **本次未执行**（见 §3）。机制层 PASS，运行时层 UNVERIFIED。

### 判定 3 · 卡头瘦身 — **FAIL（双重标题 + 57px header 仍在）**

- 「今日推荐」「学习进度」用的是 `<Panel title=...>`（`Home.tsx:61,65`），Panel 带完整
  `<header>`：`Panel.module.css:21-27` header = `padding: var(--space-4)`(16px×2=32) +
  `border-bottom 1px` + title 行高 `--font-card(16px) × --line-height-card(1.5)=24px`
  ⇒ header 高 = 32+24+1 ≈ **57px**。任务所述「57px header」属实，且**仍在使用**。
- **双重标题确证**：「学习进度」外层 `<Panel title="学习进度">`（`Home.tsx:65`）+ 内层
  `ProgressSection` 自带 `<h4>Top 3 弱项</h4>`（`ProgressSection.tsx` head/title）。
  即同一张卡同时出现「学习进度」外标题 + 「Top 3 弱项」内标题 = 任务点名的双重标题，**成立 FAIL**。
- 「今日推荐」同样：`<Panel title="今日推荐">` + RecommendationSection 无内标题（这张 OK），
  但 Panel header 的 57px 仍吃高度。
- 对比右栈两卡（WeeklyReview / RecentPractice）走的是 `.bottomCard`（`Home.module.css:36-48`，
  padding 14/16，无 Panel header），内部各自 `bc-head h4`（13px/700）= 原型对齐做法。
  → 说明同一底栏里**两套卡头规格并存**（左二 Panel-header vs 右二 bc-head），是密度不一致根因。
- **裁决**：卡头瘦身判定 FAIL。修法应为左二卡也改用 `.bottomCard`+内部 `bc-head` 模式
  （去 Panel header），并删 ProgressSection 双标题之一。但该改动跨 owner（#2/#3 = SIK-91/92 +
  右栈 = SIK-127），属 §5 owner 协调 + H11 契约范畴，**需先补 B1 契约**。

### 判定 4 · 4 状态（loading/empty/error/ready）收窄后不溢出 — **PASS（机制）/ UNVERIFIED（实测）**

- 四个 section 的 4 状态实现完整：
  - Recommendation：`RecommendationSection.tsx` loading(Skeleton)/error/empty(EmptyState)/ready 全覆盖。
  - Progress：`ProgressSection.tsx` loading/error/empty(!data)/empty(weakness=0)/ready。
  - WeeklyReview：`WeeklyReviewSection.tsx` loading/error/empty/ready。
  - RecentPractice：`RecentPracticeSection.tsx` loading + ready（empty/error 退化为空 list，
    见 §2 备注 — 设计上「card 仍渲染 head + 空 body」，符合 H7 不伪造）。
- 插画放大风险点：`EmptyState.module.css:18-22` illustration 固定 `80×80` + root
  `padding: var(--space-6) var(--space-4)`(32/16)。在 `minmax(0,1fr)` 的收窄小卡里，
  80px 插画 + 上下 32px padding 可能在矮卡里挤压；但卡 `overflow:hidden` 会裁切而非撑破布局，
  **不会破一屏**，但可能视觉上插画被裁。属 P2 观感问题，需 Chrome MCP 实测确认裁切程度。
- **裁决**：代码层 PASS（状态齐全 + 不破栅格），「收窄后不溢出/不放大插画」的视觉实测 UNVERIFIED。

### 判定 5 · Token 合规 — **FAIL（P1：圆角硬编码绕过 token）**

- **F-TOKEN-1（P1）裸 `9999px` 绕过 `--radius-999`**：
  - `ProgressSection.module.css:67`（barTrack）、`:75`（barFill）`border-radius: 9999px`
  - `WeeklyReviewSection.module.css:67`（streakPill）`border-radius: 9999px`
  - `RecentPracticeSection.module.css:100`（feedPill）`border-radius: 9999px`
  - tokens.css 已有 `--radius-999: 9999px`（`tokens.css:335`）。按 Prototype-Token-Map §12
    反模式：圆角必须走 token，裸值是红线。应改 `var(--radius-999)`。
  - （旁证：`RecentPracticeSection.module.css:90` feedIcon `border-radius: 6px` 带
    `spacing-allow` 注释说明「比 radius-10 更小」——这是合规写法范例；上面 4 处 9999px 无此豁免。）
- **F-TOKEN-2（P2）spacing-allow 字号硬编码**：`ProgressSection.module.css:88` `font-size: 10.5px`、
  `WeeklyReviewSection.module.css` 10px/9.5px、`RecentPracticeSection.module.css` 11.5px/10px。
  均带 `/* spacing-allow: prototype ... */` 理由注释，**合规**（有理由），但偏离 type-scale token
  （`--font-tiny:11px / --font-meta:12px`）。原型 10/10.5/11.5px 不在 V5 字号桶，属已知密度妥协。
  保留可接受，但建议契约里集中登记，避免每文件散落非 token 字号。
- **F-TOKEN-3（P2）`spacing-allow` 标记被复用到非 spacing 维度**：上述 `10.5px` 是 font-size，
  却用 `spacing-allow` 注释名。建议区分 `font-allow` / `spacing-allow` 语义，否则 lint 白名单语义混淆。
- CJK italic：未发现任何 `font-style: italic`，**PASS**。
- 颜色/阴影：四文件颜色均走 `--color-*`、阴影走 `--card-shadow-rest`，**未发现 hex / paper-* / ink-* /
  color-mix 百分比硬编码**，PASS。Home.module.css 死代码区见 F-DEAD-1。

### 判定 6 · 契约对照（§Acceptance Hooks 逐条） — **BLOCKED（契约缺失）**

- 因 B1：不存在 `home-bottomrow-density` 契约，无 §Acceptance Hooks 表可逐条核对。
- 退而用最接近的 SIK-FU-D §6 表（D1-D7）+ SIK-127 Acceptance 做对照：
  - D1 Top3 弱项 bar：实现存在（`ProgressSection.tsx` WeakItem bar）✓
  - D3 feed-item 4 kind 染色：`RecommendationSection.module.css` 只定义 `k-practice/k-review/k-rest`
    **3 种**，契约 §2.2 要求 4 种含 `k-mock`（mock-exam）。**偏离/缺 k-mock 通道** → P2，
    且与 `recommendationActionType.ts` 的 actionType 映射需交叉核对（本次未深入）。
  - SIK-127「今日推荐：开始练习 + 换一批」：现实现只有「刷新推荐」按钮（`RecommendationSection.tsx`
    refreshRow），**无「开始练习」主按钮** → 与 SIK-127 Acceptance 偏离 P2。
- **裁决**：契约对照无法签发，记 BLOCKED。补 B1 后必须重跑本项。

### 判定 7 · 回归（误改 rightStack / 共享 Panel） — **PASS**

- rightStack（`Home.module.css:21-25`）+ bottomCard（`:36-48`）仅 Home 内部使用，未改 Panel 组件。
- 共享 `Panel.tsx` / `Panel.module.css` 本次无改动（main 已提交态，git 无 diff）。
- 响应式 `@media 1279.98 / 767.98`（`Home.module.css:79-89`）保留 SIK-127 的 2x2 / 单列降级，未破坏。
- 无跨 view 副作用证据。**PASS**。

## 3. 验证证据

- `node apps/web/scripts/lint-screen-lock.mjs` → **exit 0**，输出 `lint-screen-lock: 0 violations`。
- typecheck / vitest：本次为 Reviewer Mode 只读审查，未跑（无源码改动可验；属 Runner 职责）。
- **Chrome MCP 1440/1920 双开 diff 截图：未执行 / 未归档**。
  - 期望归档路径（按 SIK-FU-D §6 + SIK-128 supersede）：
    `.tmp_review/visual-diff/sik-fu-d/{prototype,implementation}-desktop-{1440x900,1920x1080}.png`
  - 实查 `.tmp_review/visual-diff/sik-fu-a/` 与 `.../sik-fu-d/` **均不存在**（`Test-Path` False）。
  - 任务要求的 1440/1920 双开 diff 截图缺失 → 判定 2 / 4 的运行时层无法签发 PASS，记 UNVERIFIED。

## 4. 发现项汇总（编号 · 严重度 · 证据行号）

| 编号 | 严重度 | 标题 | 证据 |
|---|---|---|---|
| B1 | P0 | 视觉契约 `sik-<id>-home-bottomrow-density-visual-contract.md` 不存在（违 H11） | `docs/plan/` 无此文件 |
| B2 | P0 | 无待审改动；被审 5 文件均 main 已提交态，无 density-closeout diff | `git status` / `git log` |
| F-TOPO-1 | P1 | 底栏列 `1.4fr 1.2fr 1fr` 非等宽、未用 minmax(0,*)，与任务"左两列等宽"口径冲突（但与 SIK-127 SSOT 一致，需 lhr 拍板） | `Home.module.css:13` |
| F-HEAD-1 | P1 | 「学习进度」双重标题：Panel title + 内层 `<h4>Top 3 弱项</h4>` | `Home.tsx:65` + `ProgressSection.tsx` head |
| F-HEAD-2 | P1 | 左二卡仍用 57px Panel header；与右栈 bc-head 两套卡头并存，密度不一致 | `Home.tsx:61,65` + `Panel.module.css:21-27` |
| F-TOKEN-1 | P1 | 裸 `9999px` 圆角绕过 `--radius-999`（4 处） | `ProgressSection:67,75` / `WeeklyReview:67` / `RecentPractice:100` |
| F-REC-1 | P2 | RecommendationSection 仅 3 种 kind 染色，缺契约 §2.2 的 `k-mock` 通道 | `RecommendationSection.module.css` |
| F-REC-2 | P2 | 缺 SIK-127 Acceptance 的「开始练习」主按钮（只有刷新） | `RecommendationSection.tsx` |
| F-TOKEN-2 | P2 | 非 token 字号（10/10.5/11.5/9.5px），有 spacing-allow 理由但散落 | 4 section module.css |
| F-TOKEN-3 | P2 | `spacing-allow` 注释被复用到 font-size，语义混淆 | `ProgressSection.module.css:88` |
| F-DEAD-1 | P2 | `Home.module.css` 残留 `.taskList/.taskItem/.recommendList/.recommendItem/.reviewSummary/.reviewBadges` 全无引用（PLACEHOLDER 时代死代码） | `Home.module.css:50-127` grep 0 命中 |
| F-VERIFY-1 | P1 | 缺 1440/1920 Chrome MCP 双开 diff 截图，一屏实测 UNVERIFIED | `.tmp_review/visual-diff/` 无 sik-fu-* |

## 5. 建议处理

1. **先补 B1 契约**（H11 硬门禁）：新建 `docs/plan/sik-fu-d-bottomrow-density-visual-contract.md`
   （或并入既有 sik-fu-d），明确：列拓扑裁决（等宽 vs 1.4/1.2/1fr）、卡头规格统一（全用 bc-head 还是
   全用 Panel header）、token map、Visual Drift 表、Acceptance Hooks。无契约不得开 Runner。
2. **F-TOPO-1 拍板**：任务"左两列等宽 + minmax(0,*)"与 SIK-127 已落档的 `1.4/1.2/1fr` 冲突。
   按 H1 已显式指出，等 lhr 裁决；裁决前不改列定义。若改，需同步更新 SIK-127 / Web-Layout §5 owner。
3. **F-HEAD-1/2**：统一底栏卡头规格。建议左二卡改 `.bottomCard` + 内部 `bc-head`，删 Panel header，
   并消除「学习进度 / Top 3 弱项」双标题（二选一）。属跨 owner 改动，写进新契约后再 Runner。
4. **F-TOKEN-1（可快速修，P1）**：4 处 `9999px` → `var(--radius-999)`。纯 token 收敛，无视觉变化。
5. **F-REC-1/2**：按契约确认是否补 `k-mock` 通道 + 「开始练习」主按钮（SIK-127 Acceptance 要求）。
6. **F-DEAD-1**：删 Home.module.css 死代码区（taskList 等 6 个 class）。
7. **F-VERIFY-1**：Runner 落地后补 1440/1920 Chrome MCP 双开 diff，归档 `.tmp_review/visual-diff/sik-fu-d/`。

## 6. 风险等级

- **整体：中-高**。机制层（一屏锁死 lint / 4 状态 / 无回归）健康；但 **H11 契约缺失（P0）+
  无实际待审 diff（P0）** 使本次任务前提不成立，且密度核心诉求（卡头统一 / 列等宽）触及
  SIK-127/91/92/FU-A 多 owner 边界，未经契约与 lhr 拍板不得改。
- 数据/鉴权/DB：无关，零风险。
- 可快速无争议修：F-TOKEN-1（圆角 token）、F-DEAD-1（死代码）。

## 7. 总体结论

**changes-required**（且 blocked-on-contract）。

- 不得据此标任何 issue `Status=Done`。
- Runner 进场前必须：补 B1 契约 → lhr 裁决 F-TOPO-1 列口径 → 再按契约改卡头/token → 补双开截图。
- 本审查仅审了 `main` as-is 现状（等价 SIK-127 落地态），**未审到一笔"密度收口"新改动**，
  因为它在仓库里尚不存在。

---
Reviewer: Kiro（独立视觉规范审查官 / Reviewer Mode）
Date: 2026-05-30
Scope basis: main @ `006b5d38d`；lint-screen-lock exit 0；契约 sik-fu-a / sik-fu-d；原型 Home v2.1.html
