---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-28
issue: SIK-Rail-v5
multica-issue: SIK-121
parent-multica-issue: SIK-112
parent-issues: SIK-121
prototype:
  - .tmp_review/v5-rail-demo.html
  - .tmp_review/home-frame.html
  - .tmp_review/out/Tab1-Home/Home v2.1.html
---

# SIK-Rail-v5 · Rail 折叠/展开 + 4-tab 收敛 + Me 头像入口（H11）

> Tab1 Home 总线（SIK-112）下 Rail 唯一落地 SSOT。后续任何 Tab1 子 issue（含原 SIK-93）涉及顶部导航 / Rail 视觉 / Me 入口的部分，**全部以本契约为准**，不再从原型 HTML 数 tab。

## 0. Scope 总览

- **当前 wave**：W5 = shared shell baseline freeze。目标不是再扩 sidebar，而是把 RailMe 从直达 `/me` 的 link 收口为唯一 `button + popover` 账户入口，并冻结后续 sidebar 结构变更面。
- **修复对象**：
  - `apps/web/src/layouts/RootLayout/RootLayout.{tsx,module.css,test.tsx}`
  - `apps/web/src/views/Me/{accountNav.ts,SubNav.tsx}`
  - `apps/web/src/components/layout/Rail/Rail.{tsx,module.css,test.tsx}`
  - `apps/web/src/components/layout/AppShell/AppShell.tsx` 增加 768–1023 mediaQuery 占位 hook
- **不修复**：
  - 768–1023 BurgerDrawer 完整实现（仅占位 fallback；具体 spec 归 Mobile/Tablet Shell 未来 phase）
  - Tab2/3/4 的 view 内部视觉
  - tokens.css §7 Rail 折叠状态机变量
- **owner**：本契约 + 4-tab 收敛 + Me 头像入口收口 + 账户地图共享 SSOT；AppShell 高度链由 SIK-FU-A `sik-fu-a-home-visual-contract.md` 收口（不在本契约范围）

## 1. Layout Topology

### 1.1 父链（与 SIK-FU-A 协同）

Rail 是 AppShell 的左侧 sibling，本契约**不**修改 AppShell 高度行为；那是 SIK-90 wave 1 owner。本契约只关心 Rail 自身在父链下的可视行为：

```
<AppShell>                          ← 高度链 owner: SIK-FU-A
  ├─ <Rail>                         ← 本契约 owner（折叠/展开 + nav + Me）
  └─ <Workspace maxWidth="workspace">  ← shared workspace owner: `SIK-128` Route A（默认不再 cap 1440）
      └─ <Outlet />                 ← view 入口（ScreenLockShell 由各 view contract 套）
</AppShell>
```


### 1.2 Rail 内部行布局（原型 `home-frame.html` 行 44–166）

Rail 自身是一个 `flex-direction: column` 容器，宽度由 CSS var `--rail-w` 控制（展开 240px / 折叠 80px），高度 `100vh`，从上到下分 6 段：

```
┌───────────────────────────┐  ← .rail (flex-column, gap: 12px, padding: 14px 12px)
│ 1. .rail-brand            │     展开：S logo + "SIKAO" + .rail-toggle
│                           │     折叠：S logo 居中（整段 hover 触发展开 + Tooltip "展开侧栏 (Ctrl+\\)"）
├───────────────────────────┤
│ 2. .rail-cmd              │     展开：search icon + "命令搜索" + ⌘K kbd（h: 32px 整条 button）
│                           │     折叠：32×32 居中，仅 search icon
├───────────────────────────┤
│ 3. .rail-section "导航"    │     展开：10px uppercase letter-spacing .08em + padding 12px 8px 4px
│                           │     折叠：display: none
├───────────────────────────┤
│ 4. .rail-nav              │     4 项 .rail-btn（首页 / 练习 / 复盘 / 笔记），高 38px gap 2px
│                           │     active：::before 3×24px 黑色 indicator bar + bg sunken + bold
│                           │     折叠：仅 ico 居中 + hover 出 Tooltip（data-tip 属性 + ::after）
├───────────────────────────┤
│ 5. .rail-spacer (flex: 1) │     占位让 bottom 段下沉
├───────────────────────────┤
│ 6. .rail-bottom           │     border-top 1px subtle，padding-top 10px
│   └─ .rail-me             │     展开：Avatar(28px) + meta(me-name 12px/600 + me-sub 10px/meta)
│                           │     折叠：Avatar 居中 + Tooltip "我的"（与 .rail-btn 同 ::after 模式）
└───────────────────────────┘
```

> 原型还有第 5 项 `.rail-btn` "题库"（`home-frame.html` 行 315–319），本契约 H01 删除（4-tab 收敛）。原型 `.rail-bottom` 还包含一个未在 demo 中出现的占位 hook 区，本次只渲染 `.rail-me`。

### 1.3 折叠/展开状态机

状态源（已存在，不在本契约 scope，仅引用）：
- `tokens.css §7` 提供 `--rail-w: var(--rail-w-expanded)` 默认 + `:root[data-rail="collapsed"] { --rail-w: var(--rail-w-collapsed) }` 覆写。
- `Rail.tsx` 内部已用 `useEffect` 同步 `document.documentElement.dataset.rail = collapsed ? 'collapsed' : 'expanded'`。
- localStorage key：`v5-rail-collapsed`（boolean，stringified）。

本契约仅校核 3 件事：

1. **断点**：≤1280 默认折叠（首次访问）；>1280 默认展开。手动切换通过点击 toggle / Ctrl+\\ 后写入 localStorage，下次访问保持。
2. **Ctrl/Cmd+\\ 全局快捷键**：通过 `KeyboardShortcuts` 注册（不与 Ctrl+K 冲突；Ctrl+K = CommandPalette）。
3. **触发面**：展开 → 折叠用 `.rail-toggle` 按钮；折叠 → 展开用 brand 行整体（trailing icon 已 `display: none`）+ Tooltip 提示 `展开侧栏 (Ctrl+\\)`。


## 2. Required Interactive Elements

### 2.1 brand 行（`.rail-brand`）

| 元素 | 位置 | 行为 | 必须？ |
|---|---|---|---|
| `S` 28×28 mark（黑底白字 700 14px） | 左 | 静态品牌符；折叠态整 brand 行可点击展开 | 必须 |
| `SIKAO` wordmark 14px/700 letter-spacing -.02em | 中 | 静态文字；折叠态 `display: none` | 必须 |
| `.rail-toggle` 24×24 sprite `rail-toggle` | 右 trailing | 展开态点击 → 折叠并写 localStorage；折叠态 `display: none`（触发面让给整 brand 行）| 必须 |
| brand 行折叠态 hover Tooltip `展开侧栏 (Ctrl+\\)` | 居中 ::after | hover 0.4s 后浮现 | 必须 |

`.rail-toggle` aria-label：展开态 `"折叠侧栏"`；折叠态隐藏，由 brand `aria-label="展开侧栏"` 接管。

### 2.2 cmd 行（`.rail-cmd`）

| 元素 | 位置 | 行为 | 必须？ |
|---|---|---|---|
| search icon 14×14 | 左 | 静态 | 必须 |
| `命令搜索` ph 文字 12px/meta | 中 | 静态；折叠态 `display: none` | 必须 |
| `⌘K` kbd（10px monospace + border subtle + bg surface） | 右 | 静态；折叠态 `display: none` | 必须 |
| 整条 button 整体 `aria-label="命令搜索"` | - | 点击触发 `CommandPalette.open()`；Ctrl/Cmd+K 也触发同 callback | 必须 |

接线：`CommandPalette` 由 `apps/web/src/components/overlay/CommandPalette/CommandPalette.tsx` 提供；快捷键由 `KeyboardShortcuts` 注册（已存在）。RootLayout 通过 `<Rail cmd={...} />` 注入按钮元素。

### 2.3 nav 行（`.rail-nav`）

4 项，**没有第 5 项「我的」**（H01 / H02）：

| id | aria-label / label | sprite id | href | 行为 |
|---|---|---|---|---|
| home | 首页 | `nav-home` | `/` | navigate(/) |
| practice | 练习 | `nav-practice` | `/practice` | navigate(/practice) |
| review | 复盘 | `nav-review` | `/review` | navigate(/review) |
| note | 笔记 | `nav-note` | `/note` | navigate(/note) |

active 判定：`pathname === HOME_PATH`（精确匹配 `/`）或 `pathname.startsWith(target)`（其余 3 项）。每条 `<a>` 含 `aria-current={active ? 'page' : undefined}` + 折叠态 `data-tip="<label>"` 用于 ::after Tooltip。

modifier-click（meta/ctrl/shift/alt 或非左键）穿透到原生 href，允许「在新标签打开」；plain click 走 `useNavigate` SPA 跳转。

### 2.4 Me 头像入口（`.rail-me`）

`.rail-me` 是 nav 之外的独立段，在 `.rail-bottom`：

| 元素 | 行为 | 必须？ |
|---|---|---|
| host `button` trigger（Avatar 28×28 + meta） | click 切换账户 popover；trigger 自身**不再**直达 `/me` | 必须 |
| meta `me-name` 12px/600（`displayName`） | 静态；折叠态 `display: none` | 必须 |
| meta `me-sub` 10px/meta（`Lv.N <title>` 或 fallback `Lv.4 学习达人`） | 静态；折叠态 `display: none` | 必须 |
| 折叠态 Tooltip `我的`（::after，与 nav-btn 同模式） | hover 0.4s 浮现 | 必须 |
| `aria-label="我的"`（trigger 上唯一命中） | 屏幕阅读器入口；DOM 中只能出现 1 个同名 trigger | 必须 |
| `data-testid="rail-me-trigger"` | 测试断言锚点 | 必须 |
| popover panel | portal-mounted 账户菜单；outside click / route change 自动关闭 | 必须 |

popover 承载完整 8 项账户地图，来源统一走 `views/Me/accountNav.ts` 共享 SSOT：

| key | label | to | enabled |
|---|---|---|---|
| overview | 概览 | `/me` | true |
| info | 个人信息 | `/me/info` | false |
| goals | 考试目标 | `/me/goals` | false |
| learning | 学情 | `/profile/learning` | true |
| records | 学习记录 | `/profile/records` | true |
| preferences | 偏好 | `/profile/practice-preferences` | true |
| security | 安全 | `/me/security` | false |
| settings | 设置 | `/me/settings` | false |

popover 视觉骨架以 `.tmp_review/out/Tab1-Home/Home v2.1.html` 254–333 与 1328–1351 为准，最少含 3 段：

1. `pop-head`：44px avatar + name + email/meta + badge
2. `pop-summary`：3 列紧凑统计（浅底容器）
3. `pop-list`：单列 SaaS-style menu rows（单行 icon + label，**不是**双行卡片列表）

enabled 项渲染为 link；disabled 项渲染为非交互行并显式标 `aria-disabled="true"`。`RootLayout` 与 `SubNav` 必须消费同一份地图，禁止各自维护副本。

> Me 入口**唯一**：DOM 中 `aria-label="我的"` 仅命中 RailMe trigger 1 节点。`navItems` 不再含 `id: 'me'`。BottomTabBar 同步保持 4 项；移动端 me 入口仍由 MobileTopBar trailing avatar 或 `/me` 路由承担（不在本契约 scope）。

### 2.5 768–1023 区间策略（H11 占位）

本契约**仅**要求 AppShell 在 768–1023 区间打 mediaQuery hook：

```ts
// AppShell.tsx (示意)
const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023.98px)');
// isTablet 时不渲染 <Rail>，渲染 <BurgerDrawer> 占位
```

`<BurgerDrawer>` 完整实现属 Mobile/Tablet Shell 未来 issue；本契约只要求 fallback 占位（一个 `<button aria-label="打开导航">` + 内部空 drawer，点击切显隐），保证 768–1023 不渲染 collapsed 80px Rail（H11 现状是仍渲染 80px Rail）。


## 3. Information Density

### 3.1 每段视觉块数

| 段 | 展开态视觉块 | 折叠态视觉块 |
|---|---|---|
| brand | 3：mark + wordmark + toggle | 1：mark（整段做 trigger） |
| cmd | 3：icon + ph + kbd | 1：icon |
| section heading | 1：文字 "导航" | 0：display none |
| nav-btn (×4) | 2：ico + label | 1：ico（hover 出 Tooltip） |
| me trigger | 3：Avatar + me-name + me-sub | 1：Avatar（hover 出 Tooltip） |
| me popover | 3：head + summary + list（list 内 8 行账户地图） | 3：同展开态（panel 不因 rail 折叠而改结构） |

每条 `.rail-btn` 的 active 状态额外加 1 个视觉编码：`::before` 3×24px indicator bar（位置 `left: -12px; top: 8px; bottom: 8px`，背景 `--color-text-primary`）。

### 3.2 4 状态

Rail 自身不接 query，没有 loading / error 状态。但本契约要求：

- **loading（外层）**：`user` prop 未到（auth profile 还没 load）→ Avatar 用 `fallback="我"`；me-name / me-sub 各显示 1 行 Skeleton。`useAuthStore.profileLoaded` 是数据源；判定依据是 `displayName` 是否非空。
- **empty**：n/a（导航项是固定 4 项，不会空）。
- **error（外层）**：CommandPalette open 失败 / nav 跳转失败由全局 ErrorBoundary 捕获，Rail 自身不渲染错误态。
- **ready**：所有元素正常渲染。

### 3.3 折叠态对内容的影响（已知不变量）

引用 `v5-rail-demo.html` 行 146–153：

- 1280 屏：折叠后 ws `1040 → 1200 (+160)`；workspace 列数稳定（按展开态 ws 宽度算列数）。
- 1440 屏：折叠后 ws `1200 → 1360 (+160)`；列数稳定。
- 1920 屏：折叠后 ws `1680 → 1840 (+160)`；与 1280 / 1440 一样，列数稳定、卡片与主区一起变宽。

本契约要求：折叠/展开切换不触发 workspace 列数 reflow。

## 4. Token Map

引用 `docs/vault/04-design/Prototype-Token-Map.md`。本契约出现的关键映射（原型 SSOT = `.tmp_review/home-frame.html` 行 7–25）：

| 原型 var | V5 token | 用途 |
|---|---|---|
| `--color-bg-page` | `--color-bg-page` | 同名 |
| `--color-bg-surface` | `--color-bg-surface` | Rail 背景 |
| `--color-bg-elevated` | `--color-bg-elevated` | nav-btn hover / cmd 底色 |
| `--color-bg-sunken` | `--color-bg-sunken` | **active nav-btn 背景**（H09，原代码用 `--color-brand-soft` 是漂移） |
| `--color-text-primary` | `--color-text-primary` | active label / brand mark fg / indicator bar 颜色 |
| `--color-text-secondary` | `--color-text-secondary` | nav-btn idle label / topbar action |
| `--color-text-meta` | `--color-text-meta` | section heading / cmd ph / me-sub / kbd fg |
| `--color-border-subtle` | `--color-border-subtle` | rail right border / cmd border / kbd border / rail-bottom top border |
| `--radius-10` | `--radius-10` | nav-btn / cmd / kbd / me 圆角 |
| `--radius-999` | `--radius-999` | Avatar 圆 |
| `DM Sans + Inter`（原型外链） | `--font-family-ui`（自托管 DM Sans route） |
| `JetBrains Mono`（原型外链） | `--font-family-mono` |
| `--space-2 / -3 / -4` | `--space-2 / -3 / -4` | gap / padding |
| `--topbar-h` | `--topbar-h` | 56px（与 Workspace 同步，本契约不消费）|
| 原型 inline `--rail-w-expanded: 240px` | `--rail-w-expanded` | 来自 tokens.css §7（已存在）|
| 原型 inline `--rail-w-collapsed: 80px` | `--rail-w-collapsed` | 同上 |
| transition `width .25s cubic-bezier(.16,1,.3,1)` | `--dur-base` + `--ease-emphasized` | 折叠展开过渡（240ms 接近 200ms base）|

**禁**：
- ❌ 在 `Rail.module.css` 用 `--paper-1 / --ink-1` 等原型 var
- ❌ 在 active 用 `--color-brand-soft`（H09 漂移）
- ❌ 把 `40px / 240px / 80px` 等关键 px 直接写死，必须走 `--rail-w-*` token
- ❌ Tooltip 文字硬编码到 CSS `content: attr(...)` 之外的位置（必须走 i18n / data-tip 属性）
- ❌ `color-mix(in srgb, ...)` 百分比硬编码（折叠态半透明 / Tooltip 背景 / hover 染色一律走 V5 semantic token，禁直接 color-mix；要透明度变体走 `--color-bg-elevated / --color-bg-sunken / --color-brand-soft` 预定义层）


## 5. SSOT Conflicts

| 冲突项 | 原型 authority | 运行时 authority | 当前真相源 | lhr 拍板 |
|---|---|---|---|---|
| `.rail-me` 入口形态 | `.tmp_review/home-frame.html` 322–328：Rail bottom 仅给出直接可点击的 avatar/meta 块，没有二级菜单 | shared shell baseline 2026-05-28：RailMe 改为唯一 `button + popover` 账户地图入口；Profile 子页继续用 `SubNav` | **运行时 shared shell baseline**；原型保留为视觉骨架参考，不再主导账户入口信息架构 | 2026-05-28 |
| 账户导航 SSOT | 原型未定义 8 项账户地图，也未定义 disabled/account-family route 语义 | `views/Me/accountNav.ts` 共享账户地图被 `RootLayout` + `SubNav` 共同消费 | **`accountNav.ts`** | 2026-05-28 |
| sidebar 后续扩展面 | 旧文档与早期实现曾允许从 profile/home issue 顺手增改 rail | `.kiro/steering/nav-baseline.md` + 本契约 W5：后续只能改共享账户地图，不能再改 `navItems` / `tabBarItems` / Rail 结构 | **nav baseline + 本契约** | 2026-05-28 |


## 6. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 偏离原因 | lhr 拍板 |
|---|---|---|---|---|
| nav 项数 | 5 项（首页/练习/复盘/笔记/题库）| 4 项（删 `题库`）| 「题库」入口归 Review M-Hub QuestionHub（`SIK-93` Home M-Records 注释已声明）；Rail 不再保留 | 2026-05-25 |
| Me 入口呈现 | 原型 `home-frame.html` `.rail-bottom` 仅有 `.rail-me` 一段 | 同（保留 `.rail-me` 不再单独建 nav 项）| 这是 **W1 历史背景**：当时用来说明从旧 runtime 的双 Me 入口收口到唯一 RailMe；当前运行时已完成收口，后续以 §2 / §7 / W5 为准 | 2026-05-25 |
| Me 二级入口 | 原型未给出 popover，仅有直接入口 avatar/meta | 运行时改为 `button + popover`，弹出完整 8 项账户地图 | `/me`、`/profile/*` 已演化为账户家族路由；继续把所有账户入口塞回 rail 会污染 4-tab baseline，故改由 RailMe 承载二级地图 | 2026-05-28 |
| 768–1023 区间 | 原型未给出 | 占位 BurgerDrawer hook（仅切显隐 button），完整 drawer 内容 defer 到 Mobile/Tablet Shell | 完整移动 drawer 不在 Tab1 Home 范围 | 2026-05-25 |
| `me-sub` 文案 | 原型字面 `Lv.4 学习达人` | 用 `user.subtitle ?? "Lv.4 学习达人"` | 用户等级未接线（auth.profile 不含 `subtitle` 字段），先用原型 fallback；接线归未来 Auth Tab | 2026-05-25 |
| Tooltip 实现 | 原型 `::after content: attr(data-tip)` 纯 CSS | 目标态：纯 CSS `[data-tip]::after`；W1 仅在 RailMe 折叠态落 ::after Tooltip（与原型一致）；RailBrand / RailNav 折叠态现用的 React `<Tooltip>` 组件（`Rail.tsx:106-115, 161`）由 W2「视觉对齐 H05–H10」一起退化为 ::after，避免 W1 文件鼓胀越过 H9 200 行净增 cap | W1 范围聚焦 4-tab + Me 收敛；Tooltip 模式统一在 W2 与 toggle sprite / active indicator / section heading 一起做更内聚 | 2026-05-25 |
| transition 时长 | 原型 `width .25s cubic-bezier(.16,1,.3,1)` | 用 `var(--dur-base)` (200ms) + `var(--ease-emphasized)` | tokens 化 + 与 V5 motion 系统一致；240ms→200ms 视觉差异不可感知 | 2026-05-25 |
| `.rail-cmd` 折叠态 | 原型行 121–123：`width: 32px; height: 32px; align-self: center` | 同 | - | no drift |
| Ctrl/Cmd+\\ 快捷键 | 原型 demo 中由 iframe postMessage 模拟；生产用 `KeyboardShortcuts.register` | 生产实现 | 原型是 demo 不是生产 spec | no drift |
| icon 实现 | 原型 inline `<svg>` 元素 | 用 `<SpriteIcon id="nav-home" />` 等 | sprite 系统已落地，直接复用；id 列表在 §2.3 表中 | no drift |
| brand mark 形态（W2.5 修复）| 原型行 107–113：`.mark` 28×28 ink 底 + 白色 `S` 字符 grid place | W1/W2 误用 `.brandDot` 12×12 黄色品牌色圆点；W2.5 改为 inline JSX `<BrandMark>` 28×28 ink 底圆角 + 白「田」+ 白圆点（与 `apps/web/public/favicon.svg` 同源 element/preview/logo.html SSOT）| 原型 mark 用字符 `S`，favicon SSOT 用「田」+ 圆点（"思考"语义）；二者均为 ink 底 28×28 圆角，本仓选 favicon SSOT 与品牌字「思考」一致 | 2026-05-26 |
| brand wordmark 折叠态（W2.5 修复）| 原型行 230：`:root[data-rail='collapsed'] .rail-brand .name { display: none }` | W1/W2 漏写折叠态 hide rule，`brandWord` 在 80px 折叠态仍渲染并被挤压 | bug, not drift; W2.5 补 `:root[data-rail='collapsed'] .brandWord { display: none }` | 2026-05-26 |
| Rail 行高梯队（W2.5 修复）| 原型 brand 36 / cmd 32 / nav 38 / me 44 px | W1/W2 用 `--row-h-md` 52px 给 navItem 折叠/展开态，brand/me 自适应 → 行高参差 | 用 V5 token `--row-h-sm` (40px) 拉齐 brand + nav + me 三段，cmd 保持 32；与原型 38 差 2px 不可感知，比原型梯队更内聚 | 2026-05-26 |

> 「nav 项数 5→4」+「Me 入口去重」+「768–1023 BurgerDrawer hook」是 lhr 2026-05-25 拍板的 3 条主漂移；W5 再追加一条「Me 直接入口 → button + popover 账户地图」以冻结 shared shell baseline；「brand mark / wordmark / row-height」3 条是 W2.5 lhr 2026-05-26 修复的 carry-over bug（W1/W2 漏写折叠态 hide rule + 用错行高 token）；其余为 token 化 / 实现技术细节。

## 7. Acceptance Hooks

实现 vs 原型对照表（Reviewer 逐项打勾）。原型行号引用 `home-frame.html`（见 frontmatter prototype 列表）：

| # | 项 | 原型行号 | 实现位置 | 状态 |
|---|---|---|---|---|
| H01 | nav 项数 = 4（首页/练习/复盘/笔记，**无题库无我的**）| 297–319（5 项原型） | `RootLayout.tsx` `navItems` 数组长度 = 4 | ☐ |
| H02 | Me 入口唯一 = RailMe trigger button（`button[aria-label="我的"]` 在 DOM 仅 1 节点，且不进 nav）| 322–328 | `RootLayout.tsx` `Popover` trigger + `Rail.tsx` me slot；`RootLayout.test.tsx` 断言 `getAllByRole('button', { name: '我的' }).length === 1` | ☐ |
| H03 | 折叠态 RailMe trigger 仍有 `data-tip="我的"`，纯 CSS ::after Tooltip 生效 | 127–138（`.rail-btn[data-tip]::after` tooltip 模式本体）+ 142–155（`.rail-me` 容器）| `RootLayout.module.css` `.meTrigger[data-tip]::after` + trigger 自带 `data-tip="我的"` | ☐ |
| H04 | 展开态 RailMe = button trigger（Avatar + me-name + me-sub）+ click 打开 popover | 322–328 | `RootLayout.module.css` `.meTrigger / .meStack / .meName / .meSub` + `RootLayout.tsx` me trigger | ☐ |
| H05 | Ctrl/Cmd+K 触发 CommandPalette 打开；点击 `.rail-cmd` 触发同 callback | 89–101（cmd-k 槽存在但 demo 未注册快捷键） | `RootLayout.tsx` 注入 `cmd={...}` slot 接 `CommandPalette.open`；`KeyboardShortcuts` 注册 `Ctrl+K / Meta+K` | ☐ |
| H06 | toggle 按钮用 sprite `rail-toggle`（不再 inline `<svg>`） | 286–290（inline svg）| `Rail.tsx` `<SpriteIcon id="rail-toggle" size={16} />` | ☐ |
| H07 | toggle 位于 brand 行 trailing；折叠态 `display: none` | 78–86 | `Rail.module.css` `.railBrand .railToggle` 在 brand 行；`:root[data-rail="collapsed"] .railToggle { display: none }` | ☐ |
| H08 | active nav-btn 左侧 3×24px 黑色 indicator bar | 110–112（`.rail-btn.is-on::before`）| `Rail.module.css` `.navItem[data-active]::before` `width: 3px; height: 24px; left: -12px; background: var(--color-text-primary)` | ☐ |
| H09 | active nav-btn 背景 = `--color-bg-sunken` | 109 | `Rail.module.css` `.navItem[data-active] { background: var(--color-bg-sunken) }`（**修当前 brand-soft 漂移**）| ☐ |
| H10 | section heading "导航" 在展开态可见（10px uppercase letter-spacing .08em）；折叠态 `display: none` | 101–102, 120 | `Rail.tsx` 渲染 `<div className={styles.navSection}>导航</div>`；`Rail.module.css` `.navSection`（10px 600 uppercase）+ collapsed override | ☐ |
| H11 | 768–1023 区间不渲染 collapsed 80px Rail；渲染 BurgerDrawer 占位（button + 空 drawer）| n/a（原型未含）| `AppShell.tsx` `useMediaQuery` 切支；`BurgerDrawer.tsx` 占位实现 | ☐ |
| H12 | 折叠态 brand 行**仅**渲染 ink 底 28×28 BrandMark；`brandWord` `display: none`；整 brand button 触发展开 | 88–100, 230 | `RootLayout.tsx` `<BrandMark>` inline svg + `<span class={brandWord}>SIKAO</span>`；`RootLayout.module.css` `:root[data-rail='collapsed'] .brandWord { display: none }`；W1 误用 `.brandDot` 12×12 在 W2.5 修复为 favicon SSOT 28×28「田」+ 圆点 | ☐ |
| H13 | Rail 折叠态各行宽高对齐：brand 40 / cmd 32 / nav 40 / me 40（用 `--row-h-sm` 拉齐 brand+nav+me）| 实现选项见 §6 Drift "Rail 行高梯队" | `Rail.module.css` `.navItem { min-height: var(--row-h-sm) }` + 折叠态 `width: var(--row-h-sm)`；`.brandButton { width/height: var(--row-h-sm) }`；`RootLayout.module.css` `:root[data-rail='collapsed'] .meTrigger { width: 40px; height: 40px }` | ☐ |
| H14 | RailMe popover 渲染完整 8 项账户地图，且 `RootLayout` / `SubNav` 消费同一份共享 SSOT | n/a（原型未含） | `views/Me/accountNav.ts` + `RootLayout.tsx` + `SubNav.tsx`；`RootLayout.test.tsx` / `accountNav.test.ts` | ☐ |
| H15 | Me trigger 在任一 profile-family 路由高亮（至少 `/me`、`/profile/learning`、`/profile/records`、`/profile/practice-preferences`） | n/a（原型未含） | `views/Me/accountNav.ts` route-match helper + `RootLayout.tsx` trigger `data-active` | ☐ |
| H16 | RailMe popover 视觉回到 Home v2.1 的 `pop-head + pop-summary + pop-list` 骨架，不再是双行卡片列表 | 254–333, 1328–1351 | `RootLayout.tsx` menu DOM + `RootLayout.module.css` `.meMenu*` | ☐ |
| H17 | RailMe trigger 显式声明 `aria-haspopup="dialog"`，与 popover panel 的 `role="dialog"` 一致 | 1329（原型 role=menu；本仓以当前运行时 a11y 语义为准） | `RootLayout.tsx` trigger attr + `Popover.tsx` panel role | ☐ |
| H18 | RailMe summary 只显示真实 query 数据；无数据时显示 `—`，禁止写死用户统计 | n/a（原型为静态 demo） | `RootLayout.tsx` `useProgressOverview/useProgressWeeklySummary` summary mapping | ☐ |

附加自动化门禁（不在表格内但等同必须）：

- A01 `node apps/web/scripts/lint-screen-lock.mjs` exit 0（间接：本契约不动 view，但 lint 运行时不能因 Rail 改动报新 violation）
- A02 `vitest-axe` 0 violation（Rail + RootLayout 测试套件；popover 打开态若暴露 a11y 命名缺口，允许在本 wave 内补最小 overlay API）
- A03 4 状态测试（loading: profile 未 load；empty: n/a 标 skip；error: nav 跳转失败由 ErrorBoundary 捕获标 skip；ready: 全渲染）
- A04 typecheck PASS、`lint` PASS（含 14 lint scripts）、build PASS

### Chrome MCP 双开 diff 截图归档

路径：`.tmp_review/visual-diff/sik-rail-v5/`

**12 张主表**（1280/1440/1920 × expanded/collapsed × prototype/impl）：

| 文件名 | 分辨率 | 状态 | 来源 |
|---|---|---|---|
| `prototype-1280-expanded.png` | 1280×720 | rail expanded | `v5-rail-demo.html` 1280 iframe |
| `prototype-1280-collapsed.png` | 1280×720 | rail collapsed | 同上点击「全部折叠」|
| `prototype-1440-expanded.png` | 1440×720 | rail expanded | `v5-rail-demo.html` 1440 iframe |
| `prototype-1440-collapsed.png` | 1440×720 | rail collapsed | 同上「全部折叠」|
| `prototype-1920-expanded.png` | 1920×720 | rail expanded | `v5-rail-demo.html` 1920 iframe |
| `prototype-1920-collapsed.png` | 1920×720 | rail collapsed | 同上「全部折叠」|
| `impl-1280-expanded.png` | 1280×720 | rail expanded | 实现 `/` 路由 |
| `impl-1280-collapsed.png` | 1280×720 | rail collapsed | 同上 Ctrl+\\ 折叠 |
| `impl-1440-expanded.png` | 1440×900 | rail expanded | 实现 `/` |
| `impl-1440-collapsed.png` | 1440×900 | rail collapsed | 同上 |
| `impl-1920-expanded.png` | 1920×1080 | rail expanded | 实现 `/` |
| `impl-1920-collapsed.png` | 1920×1080 | rail collapsed | 同上 |

每张图必须可见 H01–H10 全部元素；H11 由 768–1023 区间手动验证（`impl-tablet-820.png` 选交，但不算入 12 张主表）。


## 8. Wave Plan

每 wave ≤ 15 文件 / ≤ 400 行净增（H9）；视觉 wave 全部独立 subagent review（H5）；每 wave 末必须 typecheck + lint + lint-screen-lock + vitest（4 状态）+ vitest-axe + Chrome MCP smoke 全 PASS 才能进下一 wave。

- **Wave 0**（本 wave，已完成）：落 `docs/plan/sik-rail-v5-visual-contract.md`（本文件）。无代码。审查由独立 subagent 出 `docs/reviews/sik-rail-v5-w0.md`。
- **Wave 1 · 4-tab + Me 头像收敛**（高优先，阻塞 SIK-93）：
  - `RootLayout.tsx`：`navItems` 删 `id:'me'`，长度 = 4；`me` 槽改 `Avatar + meStack(meName + meSub)`；本段为历史 W1 记录，运行时锚点已在 W5 切到 `data-testid="rail-me-trigger"`。
  - `RootLayout.module.css`：新增 `.meStack / .meName / .meSub`（folded 态 `display: none`）。
  - `Rail.tsx`：`RailMe` 折叠态加 `data-tip="我的"` 触发 ::after Tooltip（**仅 RailMe**，RailBrand / RailNav 的 React `<Tooltip>` 在 W2 一起退化）。
  - `Rail.module.css`：`.me` 折叠态保持 children 渲染（不强行加 `[data-tip]::after`，因为 data-tip + ::after owner 在当时归 `RootLayout.module.css`；运行时类名已在 W5 收口为 `.meTrigger`）。
  - `RootLayout.test.tsx`：断言 4-tab + Me 仅 1 节点（`getAllByLabelText('我的').length === 1`）；删旧 5-tab 断言。
  - `Rail.test.tsx`：补 RailMe 折叠态 Tooltip 渲染、nav 不含 `我的`。
  - 文件估 ≤ 6；行估 ≤ 200 净增。
  - 验收：typecheck + lint + vitest（4 状态）+ vitest-axe + Chrome MCP smoke + `docs/reviews/sik-rail-v5-w1.md`。
- **Wave 2 · 视觉对齐 H05–H10**：
  - cmd-k 接线：`RootLayout.tsx` 注入 `cmd={...}` 接 `CommandPalette.open`；`KeyboardShortcuts.register` Ctrl/Cmd+K 全局快捷键。
  - toggle sprite：`Rail.tsx` 把 inline `<svg>` 换成 `<SpriteIcon id="rail-toggle" size={16} />`；位置移到 `.railBrand` trailing；折叠态 `display: none`。
  - active 视觉：`Rail.module.css` 改 `data-active` 背景到 `--color-bg-sunken`；新增 `::before` 3×24 indicator bar。
  - section heading：`Rail.tsx` 渲染 `<div className={styles.navSection}>导航</div>`；`Rail.module.css` `.navSection` 10px 600 uppercase + collapsed `display: none`。
  - **Tooltip 模式收尾**：把 `RailBrand` / `RailNav` 折叠态的 React `<Tooltip>` 全部退化为 `[data-tip]::after`（与 W1 RailMe 同模式），删除 `<Tooltip>` import。
  - 文件估 ≤ 8；行估 ≤ 350 净增（含 Tooltip 收尾 + 测试更新）。
  - 验收：同 W1 + `docs/reviews/sik-rail-v5-w2.md`。
- **Wave 2.5 · brand mark + 折叠态 row-height 修复**（lhr 2026-05-26 触发，carry-over bug 收口）：
  - `RootLayout.tsx`：brand 元素从 `.brandDot + brandWord` 改为 inline JSX `<BrandMark>` (28×28 ink 圆角 + 白「田」 6 stroke + 白圆点) + `<span className={brandWord}>SIKAO</span>`；颜色走 `var(--color-text-primary)` / `var(--color-bg-surface)` token，inline svg 不进 sprite 系统但 lint-icon-style 只扫 .svg 文件，不触线。**navItems 与 tabBarItems 数组完全不动**，仅改 `brand` ReactNode 内部结构。
  - `RootLayout.module.css`：删 `.brandDot`；新增 `.brandMark` (width/height 28px + ink bg + radius-10 + grid place-items center)；新增 `:root[data-rail='collapsed'] .brandWord { display: none }`；当时 `.meLink` 折叠态从 padding-only 改为 `width: var(--row-h-sm); height: var(--row-h-sm); padding: 0`（运行时已在 W5 更名为 `.meTrigger`）。
  - `Rail.module.css`：`.navItem { min-height: var(--row-h-sm) }`（52→40），`.navItem[data-collapsed] { width: var(--row-h-sm) }`（同步），`.brandButton { width: var(--row-h-sm); height: var(--row-h-sm) }`（折叠态 40×40 居中），`.brand` 行 `min-height: var(--row-h-sm)`。
  - `RootLayout.test.tsx`：补「折叠态 brandWord display: none」「brand mark 渲染断言（含「田」6 line + 圆点）」。
  - 文件估 ≤ 4；行估 ≤ 80 净增。
  - 验收：typecheck + lint + vitest（保持 W1/W2 全绿）+ Chrome MCP smoke (1280 expanded/collapsed) + 本契约 §7 H12/H13 PASS。

- **Wave 3 · 768–1023 BurgerDrawer hook**（占位）：
  - `packages/shared-utils/src/hooks/useMediaQuery.ts`（新建）：标准 `matchMedia` listener hook + SSR safe guard；如 `shared-utils` 已有同名 hook 则跳过新建（preflight 已确认仓库内 grep 无匹配，需新建）。
  - `AppShell.tsx`：`useMediaQuery('(min-width: 768px) and (max-width: 1023.98px)')` → 不渲染 Rail，渲染 `<BurgerDrawer />`。
  - `BurgerDrawer.tsx`（新建占位）：仅 `<button aria-label="打开导航">` + 内部空 `<aside aria-hidden={!open}>`；click 切显隐。
  - 文件估 ≤ 5；行估 ≤ 150 净增。
  - 验收：同上 + `docs/reviews/sik-rail-v5-w3.md`。
  - **本 wave 是 non-goal 边界**：BurgerDrawer 内容（nav 列表、Me 入口）属 Mobile/Tablet Shell 未来 issue，本 wave 仅打 hook + 空占位。
- **Wave 4 · 验收**：
  - Chrome MCP 双开生成 12 张 diff 截图（1280/1440/1920 × expanded/collapsed × prototype/impl），归档 `.tmp_review/visual-diff/sik-rail-v5/`。
  - 4 状态测试（loading 用 profileLoaded=false fixture）+ vitest-axe 0 violation。
  - lint-screen-lock exit 0（与 SIK-90 wave 1 接入后联动）。
  - 在 SIK-93 加 comment「nav 部分 done by SIK-121」（已存在的 comment 升级为 done evidence；本 wave 复述以闭环）。
  - SIK-121 Evidence Block 回写 Multica（含 contract 路径 + Acceptance Hooks 表 + 12 张 diff 路径 + 4 份 review 路径）。
  - 文件估 ≤ 4；行估 ≤ 200 净增（主要测试 + Evidence Block 文档）。
- **Wave 5 · RailMe button + popover 基线锁定**（本次）：
  - `views/Me/accountNav.ts`：抽 8 项账户地图 + route-match helper，作为 `RootLayout` / `SubNav` 共享 SSOT。
  - `RootLayout.tsx`：RailMe 从 `<a href="/me">` 改为 host `<button>` trigger + `<Popover>`；trigger 保留唯一 `aria-label="我的"` + `data-tip="我的"`；popover 内渲染 8 项账户地图，enabled 用 link，disabled 用非交互行；route change / outside click 自动关闭。
  - `RootLayout.module.css`：`.meTrigger` 为唯一运行时类名，active 不再依赖 `aria-current`；账户 popover 视觉以当前 `pop-head + pop-summary + pop-list` 样式为 SSOT。
  - `SubNav.tsx`：消费共享 `accountNav.ts`，不再维护私有 `NAV_ITEMS`。
  - `.kiro/steering/nav-baseline.md`：追加“后续 profile/account 只能改共享账户地图，不能再改 `navItems` / `tabBarItems` / Rail 结构”。
  - `RootLayout.test.tsx`：断言唯一 trigger、popover toggle、8 项地图、disabled 项不可导航、enabled 项导航后关闭、profile-family active 高亮。
  - `Rail.test.tsx`：保留“nav 内没有 `我的`，Me 只来自 slot”防线；不扩写 Rail 主逻辑。
  - `BottomTabBar.test.tsx`：去掉 `id:'me'` fixture，清掉 4-tab 基线回归面。
  - 文件估 ≤ 10；行估 ≤ 350 净增。
  - 验收：typecheck + lint + tests + Browser smoke（`1440/1920` × expanded/collapsed，至少 `/me` + 1 个 `/profile/*`）+ 独立 review `docs/reviews/sik-rail-v5-w5.md`。

## 9. 参考

- `AGENTS.md` §0.2 H11
- `docs/engineering/visual-contract-workflow.md`
- `docs/vault/04-design/Web-Layout.md` — 一屏锁死规则
- `docs/vault/04-design/Prototype-Token-Map.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/02-Token-System.md` §6 — Rail 折叠状态机 SSOT
- `.kiro/specs/frontend-style-guide-v5/design.md` §C.4.3 — Rail 折叠规则
- `.tmp_review/v5-rail-demo.html` — 多分辨率折叠对比 demo
- `.tmp_review/home-frame.html` — Rail DOM + CSS SSOT
- `apps/web/src/components/layout/Rail/Rail.tsx` — 当前实现
- `apps/web/src/layouts/RootLayout/RootLayout.tsx` — 当前 RootLayout
- `apps/web/src/components/overlay/CommandPalette/CommandPalette.tsx`
- `packages/design-system/src/icons/rail-toggle.svg`
- `packages/design-system/src/icons/nav-{home,practice,review,note}.svg`
