# 04 · Pages（V5 页面级容器分层）

> **Status**: LOCKED
> **Phase 父目录**：[../README.md](../README.md)
> **来源**：`design.md` §D.4（桌面 6 页）/ §D.5（Mobile Shell 7 子节）/ §D.4.6（Exam 容器钩子）
> **实施落点**：`apps/web/src/views/<Page>/`（Phase 4 落骨架）+ `apps/web/src/layouts/`（Phase 3 落 Shell）
> **Last Updated**: 2026-05-23

---

## 1. 桌面端 SaaS Shell（所有页面共享）

V5 页面骨架以 `.tmp_review/out/` 下的全 IA 覆盖原型为事实来源（截至 2026-05-23 已覆盖 IA-V2 §4 列出的 layer/tab/子路由约 98%，详见 SIK-85 / [`docs/plan/frontend-ia-prototypes-completion-2026-05-23.md`](../../../../plan/frontend-ia-prototypes-completion-2026-05-23.md)）。新原型走 `<link rel="stylesheet" href="../_shared/v5-base.css" />` 共享 V5 token + shell SSOT，老原型保留作版本对照。所有页面共用一个**桌面端 SaaS Shell**：

```
<AppShell display=flex>
├─ <Rail w=var(--rail-w)/>               ← 左侧固定 240px / 折叠 80px
│   ├─ <RailBrand>                        SIKAO logo + 折叠按钮
│   ├─ <RailCmd>                          命令搜索（Cmd/Ctrl+K）
│   ├─ <RailNav>                          首页 / 练习 / 复盘 / 笔记 / 题库
│   └─ <RailMe>                           avatar popover (我的菜单)
└─ <Workspace flex=1 padding=var(--space-4) var(--space-5)>
    └─ <CSS Grid>                         不同页面 grid-template-rows 不同
        ├─ <Topbar h=var(--topbar-h)>     greeting + 操作区
        └─ <Panels…>                      panel × N，每个 panel 自带 head（含 panel-tabs）
```

Rail 折叠规则详见 [02-Token-System.md §6](./02-Token-System.md)（多分辨率精细规则取代 V4 的"max-width 1180 一刀切"）。

**移动端**：所有页面在 `--bp-md` 以下隐藏 Rail，改用底部 Tab Bar（玻璃拟态 + 自动降级，对应 R1/Q4）；移动端容器树详见 §3 Mobile Shell。


---

## 2. 桌面页面 × 6（D.4.1–D.4.6）

### 2.1 D.4.1 Home（4 行 Grid · metric × 4 + Calendar + 底栏 3 卡片）

```
<Workspace grid-template-rows="topbar-h | auto | minmax(0,1.6fr) | minmax(0,1fr)">
├─ <Topbar>
│   ├─ <Greet>                            早上好，{user} + 倒计时副标
│   └─ <Actions>                          通知 icon-btn + 主 CTA "开始练习"
├─ <MetricRow grid-cols=4 gap=space-4>
│   └─ <MetricCard> × 4                   icon-slot + Numeric 大数 + label + delta
│      （本周练习 / 正确率 / 学习时长 / 同省排名）
├─ <Panel id="calendar">                  ← 中央栏，最大 1.6fr 高度
│   ├─ <PanelHead>                        h3 "日程" + panel-tabs "今天/本周/本月"
│   └─ <Calendar>                         week 视图：7×3 cell；today/practice/mock/milestone 事件
└─ <BottomRow grid-cols=3 gap=space-4>    ← 底栏 3 卡片
    ├─ <Panel "今日任务">                  list（题型 badge + 标题 + 状态 trailing）
    ├─ <Panel "错题回顾">                  Numeric + 难度 badge group + CTA
    └─ <Panel "推荐套题">                  horizontal-scroll · media-card × N
```

模块间距 `--space-4`；calendar `panel-head` 高度 50px（与 metric-card 视觉对齐）。R1/Q2 决策"N=4"在桌面端体现为 metric-row 4 卡 + 底栏 3 卡的对称感（顶部 4 大指标，底部 3 个二级模块）。

### 2.2 D.4.2 Practice（4 行 Grid · 行测/申论 scope）

```
<Workspace grid-template-rows="topbar-h | minmax(0,224px) | minmax(0,1fr) | minmax(0,1fr)">
├─ <Topbar>
│   ├─ <Greet>                            "练习中心" + scope 副标
│   ├─ <ScopeToggle pill>                 "行测 / 申论" segmented control（=Tabs variant=segmented）
│   └─ <Actions>                          主 CTA "继续上次"
├─ <Row1 grid-cols="3fr 2fr" gap=space-4>
│   ├─ <QuickGrid cols=2 rows=2>          quick-card × 4（每日一练 / 薄弱专项 / 真题模考 / 错题回顾）
│   └─ <Panel "最近练习">                  list-card row-h-sm
├─ <Panel id="specialty">                 ← 行 2 · 专项练习
│   ├─ <PanelHead>                        h3 "专项练习" + panel-tabs "全部/掌握/巩固"
│   └─ <Grid cols=4 gap=space-3>          specialty-card：cat 色块 + 标题 + 题数 + 进度条
└─ <Panel id="paper">                     ← 行 3 · 套卷
    ├─ <PanelHead>                        h3 "套卷" + panel-tabs "国考/省考/事业单位"
    └─ <Grid cols=4 gap=space-3>          套卷卡：标题 + 题数·时长 + 状态 badge
```

ScopeToggle = pill 形 segmented control（V4 已有，V5 沿用 + R2/Q2 合并到 Tabs）；`@media (max-height: 800px)` 时 row1 自动收紧到 192px（已在 Practice v1 原型中验证）。

### 2.3 D.4.3 Note（3 行 Grid · filter-bar + sub-bar + sticky 卡片墙）

```
<Workspace grid-template-rows="topbar-h | auto | auto | minmax(0,1fr)">
├─ <Topbar>
│   ├─ <Greet>                            "笔记" + 计数副标
│   └─ <Actions>                          搜索 input + 主 CTA "新建手记"
├─ <FilterBar>                            ← 来源 chip 多选 + 状态 toggle
│   ├─ <ChipGroup "来源">                  全部 / 自由 / 题级 / 知识点 / 错题反思
│   ├─ <Divider />
│   └─ <ToggleRow>                         收藏 / 近 7 天（pill toggle，可叠加）
├─ <SubBar>                                ← 计数 + 视图切换
│   ├─ <Count>                             共 N 条 · 排序方式
│   └─ <ViewToggle>                        卡片 / 列表
└─ <NotesGrid>                             ← sticky 便签纸卡片墙（不是 master-detail）
    └─ <Sticky 200×140> × N                 src badge + h4 + 摘要 + meta-bar (时间 + ★)
        └─ 每张卡 inline `--tilt` 微旋转（-2deg ~ +2deg）模拟便签效果
        └─ hover 上浮 -2px + 旋转归零
```

**视觉特征**：Note 是 sikao 中**唯一**用便签纸 + 微旋转表达"个人记录"的页面；卡片不走标准 `card-shadow-rest`，用专属 `0 1px 0 rgba(255,255,255,.6) inset, 0 12px 28px -10px rgba(26,29,32,.10)`。来源 chip 高亮态用 `--color-text-primary` 反色背景（实心黑 chip），与"收藏"toggle 的暖黄高亮形成层级对比。

**详情交互（R2/Q1 决策）**：点击卡片打开 `<Drawer side="right" size="lg">`——Note 详情含富文本编辑，宽度 480-640px 比 Modal 的 640 上限更适合，且左侧仍可见笔记墙作上下文。**禁止用 Modal**（D.3.35 gotcha 强制）。详情容器走 D.3.21 Drawer prop API；移动端自动转 `<Sheet side="bottom">`。

### 2.4 D.4.4 Me（4 行 Grid · Hero + 设置 + 危险操作）

```
<Workspace grid-template-rows="topbar-h | auto | auto | 1fr">
├─ <Topbar>                                "我的" + 副标
├─ <MeHero stat-card grid-cols="auto 1fr auto">
│   ├─ <AvatarLg 64×64>
│   ├─ <Info>                              用户名 H2 + 注册时长 + Lv badge
│   └─ <MeStats grid-cols=3 border-left>   3 个 Numeric（连续天 / 总题数 / 正确率）
├─ <MeGrid grid-cols=2 gap=space-4>
│   ├─ <Panel "学习设置">                  list-card：每日目标 / 提醒时间 / 外观主题 / 密度
│   └─ <Panel "账号">                       list-card：邮箱 / 密码 / 导出
└─ <Panel "危险操作" border=err col-span=2>
    └─ list-card variant=danger             退出 / 清缓存 / 注销
```

Hero 与左下两卡之间 `--space-4`；danger panel 强制 `grid-column: span 2`，跨满底行。danger list-card 左侧 4px `--color-state-err` 条 + 全行 err 文字色（**仅在 danger panel 内生效**，不污染普通 list-card）。

注销 / 清缓存 / 退出登录 等不可逆操作必须走 D.3.22 ConfirmDialog（不允许普通 Modal 拼装）。

### 2.5 D.4.5 Question Hub / Review

```
<Workspace grid-template-rows="topbar-h | auto | minmax(0,1fr)">
├─ <Topbar>
├─ <FilterBar>                              chips 多选：科目 / 题型 / 错题状态
└─ <Panel>
    └─ <Grid cols=3 gap=space-3>
        └─ compact-card                     题号 + cat-* badge + 状态 icon
```

Question Hub 用 `--card-radius-sm` (12px) 提升信息密度；与 Practice 的 specialty-grid 区分（specialty 用大网格 4 列，Hub 用紧凑 3 列）。Pagination 用紧凑模式 `< 1 2 … 99 >`。

Review 在 Hub 风格基础上加复习日历，DatePicker 集成 `presets: [今天, 明天, 下周一, 考试日]`。

### 2.6 D.4.6 Exam-Shenlun / Exam-Xingce（仅 token 钩子，R1/Q5 + R2/Q3）

**强约束**：Exam **不使用 SaaS Shell**——无 Rail / 无 SaaS Topbar / 不复用 AppShell；Exam 是**独立 layout**，由 ExamTopBar + 双栏 PanelGroup + Sheet 组成。这条约束源自 [02-Token-System.md §6.4](./02-Token-System.md) 列数稳定规则的例外，在此处显式声明，避免实施时把 Rail 套上去。

```
<ExamLayout>                                ← 不嵌套 <AppShell> / <Rail>
├─ <ExamTopBar h=var(--exam-topbar-h)>     计时器 / 暂停 / 字号切换 / 退出
├─ <PanelGroup direction="horizontal">
│   ├─ <Panel padding=var(--exam-pane-padding)>
│   │   <MaterialPanel />
│   ├─ <ResizeHandle w=var(--exam-divider-handle-w)>
│   └─ <Panel padding=var(--exam-pane-padding)>
│       <QuestionPanel />
└─ <Sheet>                                  草稿纸（z-modal）
```

V5 在此处**只**定义：

- `--exam-pane-padding: var(--space-4)`
- `--exam-divider-handle-w: 4px`
- `--exam-topbar-h: var(--topbar-h)`

具体交互（拖拽 resize / 计时器 / 答题状态机 / 草稿纸交互）由独立"考试设计 spec"承担，**不在 V5 范围内**。

退出考试 / 交卷 必须走 D.3.22 ConfirmDialog 二次确认（D.3.22 强制规则：交卷 / 退出考试 / 删除笔记 / 注销账号 等不可逆操作必须用此组件，不允许普通 Modal 拼装）。

---

## 3. Mobile Shell（D.5.1–D.5.7，R2/Q4 决策）

V4 完全没定义移动端，V5 必须 cover。Mobile Shell 在 `--bp-md`（768px）以下生效，与桌面 Shell 共用所有 token 但布局不同。详细 mobile spec 由后续独立 Phase 承接，**V5 仅固化 token 与骨架**。

### 3.1 Mobile-only 组件 token（D.5.1）

```css
:root {
  --mobile-topbar-h:    48px;
  --mobile-bottom-nav-h: 64px;
  --mobile-tab-bar-h:    var(--mobile-bottom-nav-h);  /* alias */
  --mobile-rail-drawer-w: 280px;                       /* 从左侧滑出的菜单 */
  --touch-target-min:   40px;                          /* REQ-10.1 命中区 */
  --sheet-handle-w:     32px;                          /* Sheet 顶部下拉手柄 */
  --sheet-handle-h:     4px;
}
```

### 3.2 移动端 AppShell 骨架（D.5.2）

```
<MobileAppShell display=grid grid-template-rows="topbar | 1fr | bottom-nav">
├─ <MobileTopBar h=mobile-topbar-h padding-top=safe-top>
│   ├─ <BackBtn / BurgerBtn>             返回箭头 / 折叠菜单
│   ├─ <Title>                            页面标题
│   └─ <Action>                           主操作 icon-btn / 主 CTA（可省略）
├─ <Workspace overflow=auto padding-inline=safe-left/right>
│   └─ 业务内容（单列纵向，紧凑档间距）
└─ <BottomTabBar h=mobile-bottom-nav-h padding-bottom=safe-bottom>
    └─ 5 个 tab：首页 / 练习 / 复盘 / 笔记 / 我的
        玻璃拟态 + 自动降级（R1/Q4 决策）
```

`<BurgerBtn>` 触发的抽屉 = `<Drawer side="left" size="sm">` 内嵌 Rail 内容，与桌面 Rail 复用 navItems。

### 3.3 移动端 Home / Practice / Note / Me（D.5.3–D.5.6）

| 页面 | 移动端布局要点 |
|---|---|
| **Home（D.5.3）** | Greet stat-card + 4 个 metric 横滑（不再 4 列展开）+ "今日任务" list-card 纵向 + "本周进度" 单 stat-card + "推荐套题" horizontal-scroll media-card |
| **Practice（D.5.4）** | ScopeToggle full-width + quick-card 2×2 + 专项 compact-card 2 列网格 + 套卷 list-card 纵向 |
| **Note（D.5.5）** | FilterBar `overflow-x: auto`（chip-group 横向滚动）+ SubBar + 卡片 2 列网格（保留微旋转） |
| **Me（D.5.6）** | MeHero stat-card 纵向（avatar + 信息）+ 3 stats 横排 + 学习设置 / 账号 / 危险操作 list-card 纵向 |

### 3.4 平板中间档（D.5.7，768–1023px）

平板视口介于移动与桌面：

- 顶部用 Mobile TopBar 但保留更多操作（搜索条不折叠到 burger）
- 底部用 BottomTabBar（与移动端共用）
- 内容区双列允许（如 Note 用 2 列、Me 用 2 列分组），但仍紧凑档间距
- Practice 4 列网格降到 2 列，避免每卡 < 160px

---

## 4. 关联文档

- [`design.md` §D.4 / §D.5`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md) — 6 桌面页 + Mobile Shell 容器树原文
- [02-Token-System.md §5–6](./02-Token-System.md) — 断点 / max-width / Rail 折叠规则（页面骨架的多分辨率行为来源）
- [03-Components.md](./03-Components.md) — 35 组件契约（页面骨架的组装件）
- [00-Decisions.md](./00-Decisions.md) — R1/Q5（Exam）/ R2/Q1（Note Drawer）/ R2/Q4（Mobile Shell）落地处
- [Frontend-IA-V2.md](../../Frontend-IA-V2.md) — IA 决策 SSOT（5 tab 信息架构来源）
- [`.tmp_review/out/_shared/v5-base.css`](../../../../../.tmp_review/out/_shared/v5-base.css) — 原型共享 V5 token + rail/workspace shell（Phase 4 React 实施前的视觉事实来源）
- [`docs/plan/frontend-ia-prototypes-completion-2026-05-23.md`](../../../../plan/frontend-ia-prototypes-completion-2026-05-23.md) — `.tmp_review/out` 全 IA 原型覆盖记账（SIK-85）
- 业务 Phase 接力对应：[Home/](../Home/) / [Practice/](../Practice/) / [Notes/](../Notes/) / [Profile/](../Profile/) / [Review/](../Review/)
