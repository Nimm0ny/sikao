# Handoff: 申论 · 专项练习 & 套卷练习

## Overview
两页申论模块的重设计：**专项练习**（按题型分类训练）和 **套卷练习**（按真题套卷训练）。
目标是在 SIKAO 「纸暖 / 墨 / 暗朱」设计系统下，把原 fenbi-style 的功能用更克制、更书卷气的版式重新表达。
两页通过左侧暗色侧栏的二级导航切换；一个续答 hero 把"上次做到哪"提到首屏。

## About the Design Files
本包里的 `essay-redesign.html` 是**设计参考稿** — HTML/CSS/原生 JS 写的高保真原型，用于展示**预期的视觉与交互**，不是直接上线的产品代码。
请按现有代码库的技术栈（React / Vue / Next 等）和组件库习惯重写，**复用项目已有的 `design/tokens.css`**（SIKAO 设计令牌已在仓库 `uploads/SIKAO/design/tokens.css` 定义）。
若仓库已有 `ui/Button` `ui/Chip` `ui/Stamp` `ui/Mark` `ui/Card` 等基础组件（见 `design/components.md`），优先复用它们。

## Fidelity
**高保真 (hifi)** — 颜色、字体、间距、半径、阴影、状态变化都已对齐 SIKAO tokens。请像素级还原。

---

## Screens / Views

### 1. 申论 · 专项练习  (`/essay/specialty`)

**Purpose** — 用户挑选 5 大题型中的一类做专项突破，每类展开后选具体子题型，看到自己的子项完成进度。

**Layout**
- 双区：左侧 240 px 暗色侧栏（站点全局）+ 右侧 main，main 内部最大宽 1200 px，padding 48 px 64 px 96 px
- main 内自上而下：
  1. PageHeader (`.ph`) — 左：eyebrow + stamp + 大 H1 + lede；右：4 格 stat-strip
  2. ResumeHero (`.resume`) — 续答 band（墨黑底）
  3. Cat-list (`.cat-list`) — 5 个 cat 卡片纵向堆叠，`gap: var(--s4)`

**Components**

#### ResumeHero `.resume`
- 容器：`grid-template-columns: auto 1fr auto; gap: var(--s5); padding: 22px 26px; background: var(--ink); color: var(--paper)`
- 右上角伪元素 `::after` 暗朱径向晕染（accent 透明 18 %），强度刚好提示"重点位"
- 左：54 × 54 印章 `.seal`，1 px 描边 rgba(242,234,216,.25)，里面 serif「续」+ mono "RESUME" 副标
- 中：kicker（11 px mono uppercase + 暗朱 5 px 圆点）/ 22 px serif 标题 / 11 px mono meta bar（近三次 / 连续天 / 周目标）
- 右：留到下次（btn-secondary 半透明边框）+ 继续作答（btn-primary 反相：paper 底 ink 字）

#### StatStrip `.stat-strip`
- 4 格水平排列，单格 padding 14 × 22，min-width 114，cell 之间 1 px 内分隔
- k：11 px mono uppercase ink-3，letter-spacing .16em
- v：28 px serif 600 ink，line-height 1.1，副单位 13 px mono ink-3
- 4 格：已练 187/2337 · 连续 14 天 · 本周 23 题 · 平均分 38.4/50

#### CategoryCard `.cat`
- 容器：paper 底，1 px var(--rule) 描边；hover → border-color var(--rule-strong)；data-open=true → border-color var(--ink)
- header 行：`grid-template-columns: 56px 1fr 260px 150px auto; gap: var(--s5); padding: 22px 26px`
  1. **序号** — 32 px serif ink-4，open/hover → ink
  2. **标题块** — 22 px serif 600 标题 + 13 px ink-3 描述
  3. **进度组件** — 上：「N 子项 / 完成 %」mono 11 px uppercase；下：3 px 高 paper-3 槽 + ink 实心填充
  4. **题量计数** — serif 22 px 大数 + mono small "/总数" + "题" 标签
  5. **动作组** — Primary（已开始）/ Secondary（未开始）按钮 + 14 px 折叠箭头（open 翻转 180°）
- body 展开：`display: none → block; border-top: 1px solid var(--rule); background: var(--paper-2); padding: 20px 26px 24px`
  - body-head：「↓ 按题型 · 选一子项专攻」mono small label + "＋ 自定义刷题" 链接
  - sub-grid：`grid-template-columns: 1fr 1fr; gap: var(--s2)`，每项 `.sub-row`：
    - 18 × 18 tick（done = ok 实心打勾 / progress = ink 描边 + 中心方块 / pending = rule-strong 描边）
    - 标题 15 px ink + 11 px mono 副标
    - "继续"暗朱描边小标（仅 progress 行）
    - prog: mono 12 px，serif strong 数字
    - hover 箭头从 -4 px 透明 → 0 实色

**5 大类 data**
1. 归纳概括 — 4 子项 · 253/742 · 34 % （default open）
2. 综合分析 — 3 子项 · 73/609 · 12 %
3. 提出对策 — 3 子项 · 64/352 · 18 %
4. 公文 · 应用文 — 空态 `data-empty="true"`：禁用 hover/展开；右侧 "通知我 →" btn-ghost-sm
5. 大作文 — 2 子项 · 38/634 · 6 %

---

### 2. 申论 · 套卷练习  (`/essay/papers`)

**Purpose** — 用户按地区 / 卷型 / 年份筛选真题套卷，看到匹配数和每套的难度、上次得分。

**Layout**
- main 内：PageHeader → FiltersPanel → ListHead → PaperList → Pager
- 同样最大宽 1200，padding 48 64 96

**Components**

#### FiltersPanel `.filters`
- 1 px rule 描边的 paper 容器（无圆角）
- 4 行 row + 1 行 footer
- 每 row：`grid-template-columns: 96px 1fr; gap: var(--s4); padding: 14px 24px`
  - key：mono 11 px uppercase ink-3 letter-spacing .18em
  - chips: `.fchip` 高 30 / 圆角 4 / 1 px transparent 描边
    - default: ink-2 文本，hover → paper-2 底
    - active: ink 底 paper 字
- 4 行：视图（推荐/最新/高频/未做+暗朱小点/进行中）· 地区（全部/国考/省考/20 个省份/更多）· 类型（卷型，sub-row 缩进） · 年份（近 5 年/单年/2018 及更早）
- footer：左 selected-summary（.sum-tag 已选条目 + 匹配总数）· 右 reset-btn（mono uppercase 下划线）

#### PaperRow `.paper-row`
- `grid-template-columns: 88px 1fr 140px 140px 120px; gap: var(--s5); padding: 20px 26px`
- 左侧 3 px 暗朱 `.pin`（默认透明；pinned 行显示）
- 列：
  1. yr-block：32 px serif 600 年份 + 10 px mono 徽（国考 = ink 实心 / 省考 = ink-3 描边）
  2. p-title：17 px serif 600 标题 + p-tags（10 px mono uppercase 1 px rule 描边 region tag 加重）+ last-attempt（done 行：「上次 **42** 分 · 8 天前」mono 10 px 灰）
  3. p-stat：line1（serif 18 px 题数 + mono 总分）+ diff-row（3 点难度 + "难度"）
  4. p-status：p-pill — 未做（dashed rule）/ 进行中（warn-bg）/ 已做（ok-bg）
  5. row-cta：btn-secondary，hover 时整行 → ink 反相

#### Pager `.pager`
- 居中 flex，34 px 高方按钮，1 px rule，active 状态 ink 实心

---

## Interactions & Behavior

| 触发 | 行为 |
|---|---|
| 侧栏「专项练习」/「套卷练习」点击 | 切换 `.page.active`，scrollTo top |
| `.cat-header` 点击 | 切换 `data-open`；body slides open；`.cat-num` & border 加深；箭头旋 180° |
| `.cat[data-empty="true"]` | header 不可点；CTA 改"通知我 →"；进度条用 rule-strong 表示禁用 |
| `.fchip` 同一行点击 | 仅一项 active（单选）。"更多 +" 应展开省份子列表（本稿未画） |
| Filter footer `.x` | 移除该 sum-tag，重新查询，刷新匹配数 |
| `.paper-row` hover | bg → paper-2；row-cta 按钮变 ink 反相 |
| 切换 Tweaks 主题 | `<html data-theme>` 切换 → tokens 整套颜色平滑过渡（120 ms ease） |

**Transitions** — 全部 120 ms ease 或 160 ms 局部。border-color / background-color / transform。无 framer-motion 依赖。

---

## State Management

```ts
// 专项练习
type SpecialtyVM = {
  totals: { practiced:number, total:number, streakDays:number, weekDone:number, avgScore:number };
  resume?: { typeName:string, qIndex:number, qTotal:number, subTypeName:string, lastScores:number[], weekGoal:[done,total] };
  cats: Array<{
    id:string; idx:number; name:string; desc:string;
    overallProgress:number;   // 0..1
    practiced:number; total:number;
    subTypes: Array<{ id:string; name:string; meta:string; practiced:number; total:number; status:'pending'|'progress'|'done' }>;
    state?: 'empty';          // 公文 = empty
  }>;
  openCatId?:string;
};

// 套卷练习
type PapersVM = {
  filters: {
    view: 'recommend'|'latest'|'frequent'|'todo'|'doing';
    region: string;           // 全部 / 国考 / 省考 / <province>
    paperType: string;        // 全部卷型 / 副省级 / 地市级 / ...
    year: string;             // 近5年 / 年份字符串 / 2018及更早
  };
  total:number;
  page:number; pageSize:number;
  sort:'default'|'year'|'difficulty'|'recent';
  rows: Array<{
    id:string; year:number; track:'gk'|'sk';
    title:string; region:string; tags:string[];
    qCount:number; totalScore:number;
    difficulty:1|2|3;
    status:'todo'|'doing'|'done';
    progress?:string;        // "3/5"
    doneCount?:number;       // 已做次数 × N
    lastAttempt?:{ score:number; when:string };
    pinned?:boolean;
  }>;
};
```

---

## Design Tokens — 必须从 `design/tokens.css` 引入；不要在组件里重定义

```
--paper        #FAF7F0    main bg
--paper-2      #F4F0E6    card alt / hover
--paper-3      #ECE6D7    muted block
--rule         #E2DBC8    hairline
--rule-strong  #C9C0A8

--ink          #1A1815    primary text / dark surfaces
--ink-2        #3A352D
--ink-3        #6B6358
--ink-4        #948A7A

--accent       #9B2F2F    暗朱 — 一屏最多 1–2 处
--accent-2     #7A2424
--accent-50    #F5E6E2

--ok #4A6B3A / --ok-bg #E7E9D9
--warn #A66A18 / --warn-bg #F4E5C8
--err #8B2F2F / --err-bg #F1DCD7

--serif: Source Serif 4, Noto Serif SC, Georgia, Songti SC, serif
--sans:  Inter, system-ui, PingFang SC, sans-serif
--mono:  JetBrains Mono, SF Mono, ui-monospace, monospace

type scale: --t-h1 44 / --t-h2 30 / --t-h3 22 / --t-h4 18 / --t-body 15 / --t-sm 13 / --t-cap 12 / --t-eyebrow 11
spacing:    --s1 4 / --s2 8 / --s3 12 / --s4 16 / --s5 24 / --s6 32 / --s7 48 / --s8 72
radii:      --r-sm 4 / --r-md 6 / --r-lg 10 / --r-xl 14    (paper 风格——几乎不用 r-lg/r-xl)
shadow-1, shadow-2, shadow-3 见 tokens.css
```

Themes (在 `<html data-theme="...">` 切换)：
- `paper` (default, 暗朱)
- `pure` (素白 + 蓝 accent #1F4FD8)
- `night` (深色 + 暗金 accent #D9A055)

Density：`data-density="compact|regular|cozy"`
Reading：`data-reading="md|lg|xl"`

---

## Components Referenced
按 `design/components.md` 的契约复用：
- **ui/Button** — variant `primary | secondary | ghost | accent` × size `sm | md`，36 px / 28 px，r-sm
- **ui/Chip** — 22 px mono uppercase 11 px（**英文 / 单数**用）；filter 场景用本文档的 `.fchip` 变体（CJK 兼容，sans 13 px）
- **ui/Stamp** — `.stamp` 暗朱小圆点 + mono uppercase
- **ui/Mark** — 思字方块 logo
- **ui/Card** (`.comp-card`) — 1 px rule paper 底
- **AppSidebar** — 站点已有；本设计内嵌只为预览效果

---

## Assets
- 字体走 Google Fonts CDN（Source Serif 4 / Inter / JetBrains Mono / Noto Serif SC）；如有内网，需把 woff2 落到 `public/fonts/`
- 不用 lucide-react / heroicons — 全部 SVG 自绘（侧栏图标 + 折叠箭头 + 续答箭头）
- 纸面噪点：`body::before` 双 radial-gradient + multiply blend，opacity .35

---

## Files in this bundle
- `essay-redesign.html` — 唯一原型文件。两页通过侧栏切换；包含 Tweaks 浮窗用于切换 theme/density/reading
