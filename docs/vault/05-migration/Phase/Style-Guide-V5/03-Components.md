# 03 · Components（V5 组件契约 + 5 类卡片 + 35 组件 + SVG 规范）

> **Status**: LOCKED
> **Phase 父目录**：[../README.md](../README.md)
> **来源**：`design.md` §C.5（SVG）/ §D.1（卡片）/ §D.2（状态机）/ §D.3.1–D.3.35（组件 prop API）
> **实施落点**：`apps/web/src/components/<group>/<Component>/`（Phase 3 落骨架）
> **Last Updated**: 2026-05-23

---

## 1. 5 类卡片（REQ-7.1）

| 类型 | 用途 | radius | padding | 关键约束 |
|---|---|---|---|---|
| `standard-card` | 默认通用卡片 | `--card-radius` | `--card-padding` | 三段结构：title-bar / body / action-bar，可选 |
| `stat-card` | 数据展示（正确率 / 题量 / 用时） | `--card-radius` | `--card-padding` | 数字用 `<Numeric>`；视觉权重数字 > 标签；至少 1 个 metric |
| `list-card` | 多行列表项容器 | `--card-radius` | 0（行内自带 padding） | 内行用 `--row-h-md/sm`；行间分隔 `--color-border-subtle`；首尾行不加分隔 |
| `media-card` | 含视觉/插图（推荐套题封面、空状态插图卡） | `--card-radius` | `--card-padding` | 媒体区与文本区比例 ≥ 16:9 或固定 120px 高 |
| `compact-card` | 高密度网格（题型选择、Question Hub 题目卡） | `--card-radius-sm` | `--card-padding-sm` | 边长 88–112px，正方形或 4:3 |

---

## 2. 卡片状态机（REQ-7.2，9 状态）

每类卡片至少支持 9 状态，由 `card-shadow / border / bg / opacity / 内置占位组件` 组合表达：

| 状态 | 视觉变化 | 触发 |
|---|---|---|
| `rest` | `--card-shadow-rest` + `--card-border` | 默认 |
| `hover` | `--card-shadow-hover` + 上移 -2px | mouse enter（仅 hover-capable 设备：`@media (hover: hover) and (pointer: fine)`） |
| `pressed` | shadow 回 l1 + 下移 0px + 内底色 -2% | mousedown / touchstart |
| `focus-visible` | `--card-border` 替换为 `--color-focus-ring` 2px ring | keyboard tab 进入 |
| `selected` | 内底色 = `--color-brand-soft`，左侧 4px brand 条 | 业务标记选中 |
| `disabled` | opacity .5 + cursor not-allowed + 禁 shadow-hover | disabled prop |
| `loading` | 渲染骨架屏（`<Skeleton>` 占位） | 数据未就绪 |
| `empty` | 渲染 `<EmptyState>` 占位（图标 + 文案 + CTA） | data length === 0 |
| `error` | `--card-border` 替换为 `--color-state-err` 1px + 错误文案 | data fetch failed |

**铁律 CP.9**：所有 `:hover` 视觉规则**必须**包裹在 `@media (hover: hover) and (pointer: fine)` 之内；触屏（pointer: coarse）下不渲染 hover 残影、Tooltip 改为长按 700ms 触发 Sheet、所有可点击元素命中区 ≥ 40×40 px（用透明 padding 扩展或显式 min-height）。


---

## 3. 35 组件契约清单（D.3.1–D.3.35，按依赖序列）

prop API 完整签名见 [`design.md` §D.3`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md)；本表只列**用途 / 状态数 / 关键约束**，便于跨 Phase 联调时快速定位。

> **关于组件计数**：spec design §D.3 给出 35 个 ID（D.3.1–D.3.35）；本表分组小计为 41，差额来自 D.3.34 拆 4 个子契约（VisuallyHidden / FocusTrap / Divider / KeyboardShortcuts）+ D.3.32 / D.3.33 各拆 3 个子契约（layout 三件套 + 容器三件套）。35 个唯一 ID 不变，分组小计是为读者按职责定位组件的便利视图。D.3.35 是 gotcha 清单（详见 §4），不计入组件契约。

### 3.1 系统层与浮层基础（4 个）

| # | 组件 | 用途 | 状态 | 关键约束 |
|---|---|---|---|---|
| D.3.34a | `<VisuallyHidden>` | 仅屏幕阅读器读，视觉隐藏 | static | `aria-live` 区域必备 |
| D.3.34b | `<FocusTrap>` | 焦点限制在容器内 | active / inactive | Modal / Sheet / Drawer 必须内嵌 |
| D.3.34c | `<Divider>` | 分隔线 | static（subtle/default/strong 3 档）| 横向时支持 inset 缩进 padding |
| D.3.34d | `<KeyboardShortcuts>` | 快捷键注册 | scope: global / page / modal | 受 FocusTrap 影响 |

### 3.2 浮层（2 个）

| # | 组件 | 用途 | 状态 | 关键约束 |
|---|---|---|---|---|
| D.3.20 | `<Popover>` | 触发式浮层 | open / closed | `--menu-bg` + `--shadow-l3` + `--radius-12`；`aria-haspopup` 自动绑定 |
| D.3.19 | `<Tooltip>` | hover 设备专属提示 | hover 触发 | 触屏（pointer: coarse）**不渲染**，改长按 Sheet；icon-only 按钮**必须**配 |

### 3.3 视觉原子（5 个）

| # | 组件 | 用途 | 状态 | 关键约束 |
|---|---|---|---|---|
| D.3.18 | `<Avatar>` | 用户头像 | static + status dot | `fallback` 必填；image 失败时显示反色背景首字母；`status` dot 用 2px paper-1 描边 |
| D.3.8 | `<Badge>` / `<Tag>` / `<Chip>` | 标签 | static + onRemove | 11 variant：6 语义 + 5 cat-*；Tag/Chip 支持 onRemove |
| D.3.9 | `<Numeric>` | 数字展示 | static | CSS 必带 `font-variant-numeric: tabular-nums`（R1/Q3）；`thousand` 千位 / `trend` 自动接 ok/err 色 + ▲/▼ |
| D.3.27 | `<ProgressLinear>` / `<ProgressRing>` | 进度 | indeterminate / value | `value` clamp 0-100；indeterminate 渲染 spin keyframes |
| D.3.10 | `<EmptyState>` / `<Skeleton>` | 占位 | 4 illustration / pulse | EmptyState illustration 必须 SVG；Skeleton `prefers-reduced-motion` 退化为静态 opacity 循环 |

`kbd` / mono surfaces（如 Rail `⌘K` hint、Tooltip shortcut、CommandPalette shortcut）必须消费 `--font-family-mono`，不得继续 `inherit`。

### 3.4 表单原子（10 个）

| # | 组件 | 用途 | 状态 | 关键约束 |
|---|---|---|---|---|
| D.3.1 | `<Button>` | 按钮 | rest/hover/pressed/focus/disabled/loading（6） | 5 variant；icon-only 必带 `aria-label`；`loading` 自动禁点击；根处 `background: none; border: 0; cursor: pointer`（D.3.35 gotcha） |
| D.3.2 | `<Input>` | 输入框 | rest/focus/filled/disabled/read-only/error/success（7） | **必须** `box-sizing: border-box` + `min-width: 0`（D.3.35 gotcha） |
| D.3.11 | `<Textarea>` | 多行文本 | 同 Input + autosize | 申论作答区强制 `autosize: { min: 8, max: 24 }` + `showCount: true`；接近 90% maxLength 计数变 warn 色 |
| D.3.12 | `<Radio>` / `<Checkbox>` / `<Switch>` | 选项控件 | rest/checked/indeterminate/disabled | **与答题选项 OptionItem 严格区分**（D.3.28） |
| D.3.13 | `<Select>` / `<Combobox>` | 下拉选择 | closed/focus/open/searching/selected/disabled（6） | 下拉面板用 D.3.20 Popover；`searchable: true` → Combobox 模式 |
| D.3.14 | `<DatePicker>` / `<TimePicker>` | 日期 / 时间 | 同 Select | DatePicker 默认开 presets `[今天, 明天, 下周一, 考试日]`；TimePicker step ∈ {5,10,15,30,60} 分钟 |
| D.3.15 | `<Slider>` | 滑块 | rest/focus/dragging/disabled | 字号档专用：`marks: [{14,标准},{15,大字},{17,特大},{19,紧凑}]`；与 D.3.29 QuestionStem 联动 |
| D.3.16 | `<FormField>` | 表单字段包装器 | static | **所有表单控件必须包在 FormField 内**；不允许裸 label + input；label 顶 + 控件 + helper/error 底，纵向 6px |
| D.3.17 | `<Search>` | 页面内搜索 | rest/focus/filled/clearing | 与 rail-cmd 区分；前置 IconSearch 14px + 后置 X 清空（值非空时） |
| D.3.4 | `<ListItem>` | 列表项 | rest/hover/pressed/selected/disabled/dragging（6） | size `sm/md/lg` 对应 `--row-h-sm/md/lg`；hover 视觉必须包在 hover-capable media query（CP.9） |

### 3.5 导航与组合控件（1 + 多 variant）

| # | 组件 | 用途 | 状态 | 关键约束 |
|---|---|---|---|---|
| D.3.3 | `<Tabs>`（含 SegmentedControl 合并）| 切换面板 / 范围 | rest/hover/active/disabled（4 × variant） | **3 variant**：underline / pill / segmented（R2/Q2）；ScopeToggle = `variant='segmented'` 业务别名；**禁独立 SegmentedControl 实现** |

### 3.6 浮层与容器（9 个）

| # | 组件 | 用途 | 状态 | 关键约束 |
|---|---|---|---|---|
| D.3.6 | `<Modal>` | 模态对话框 | closed/opening/open/closing（4） | size `sm/md/lg` = 360/480/640；FocusTrap 必嵌；body scroll lock；`closeOnOverlay` danger 场景设 false |
| D.3.5 | `<Sheet>` | 半屏 / 全屏底滑 | closed/opening/open/dragging/closing（5） | 顶部圆角 = `--card-radius-lg` 仅顶部两角；`prefers-reduced-motion` 下 transition 0ms |
| D.3.21 | `<Drawer>` | 侧滑面板 | 同 Sheet | 桌面默认 `side="right"`；移动端自动转 `<Sheet side="bottom">`；**Note 详情专用，不允许 Modal**（R2/Q1） |
| D.3.22 | `<ConfirmDialog>` | 二次确认快捷封装 | 同 Modal | **交卷 / 退出考试 / 删除笔记 / 注销账号 必须用此组件**，不允许普通 Modal 拼装 |
| D.3.7 | `<Toast>` + `<ToastProvider>` | 临时提示 | 4 variant | `--shadow-l4`；`duration` 默认 3000 / err 默认 5000；左侧 4px 状态色条 |
| D.3.23 | `<Banner>` / `<Alert>` | 页面级常驻提醒 | 4 variant | 与 Toast 区分：Banner 在 Topbar 下方全宽常驻；`dismissible` 显示 X 关闭 |
| D.3.24 | `<Pagination>` | 分页 | static | 紧凑模式（题库 grid）= `< 1 2 … 99 >`；常规模式（admin 表格）= 含 size + jumper |
| D.3.25 | `<Breadcrumb>` | 面包屑 | static | `maxItems` 收成 "首页 / ... / 当前"；`@media (max-width: 768px)` 默认隐藏 |
| D.3.26 | `<CommandPalette>` | ⌘K 全局命令 | open / closed | `Ctrl+K` / `⌘K` 触发；↑↓ 导航；Enter 选中；Esc 关闭；所有"页面级主操作"应注册到此处 |

### 3.7 Layout 三件套 + 容器三件套（6 个）

| # | 组件 | 用途 | 关键约束 |
|---|---|---|---|
| D.3.32a | `<AppShell>` | 桌面端 Shell | 桌面页面**必须**用 `<AppShell>` 包裹，禁手写 Rail+main 结构 |
| D.3.32b | `<Rail>` | 左侧固定侧栏 | navItems 顺序固定为 [首页, 练习, 复盘, 笔记]，Me 入口仅由 RailMe 提供，**不允许业务侧重排**；含 RailBrand / RailCmd / RailNav / RailMe 子组件；折叠规则详见 [02-Token-System §6](./02-Token-System.md) |
| D.3.32c | `<Workspace>` | 内容主体 | `maxWidth="workspace"` = 共享 desktop 默认（SIK-128 Route A 后不再自动 1440 cap）；窄列 surface 必须显式用 `reading` / `form` / `prose` |
| D.3.33a | `<Panel>` | 通用容器 | `variant="danger"` 边框红 + 左侧 4px err 条 + 全行 err 文字色（仅在 danger panel 内生效） |
| D.3.33b | `<PageHeader>` | 页面头 | h2 主标题 + 副标 + breadcrumb + 右侧 actions |
| D.3.33c | `<Section>` | 页面分段 | spacing `sm/md/lg` 三档间距 |

### 3.8 业务专属（4 个，R2/Q6 决策）

| # | 组件 | 用途 | 状态 | 关键约束 |
|---|---|---|---|---|
| D.3.28 | `<OptionItem>` | 答题选项 ABCD | rest/selected/correct/wrong/disabled/reviewing（6） | **禁止用普通 Radio 模拟**；`reviewing` 同时高亮 correct + 用户错选；`correct` 配 `IconCheck` 实心、`wrong` 配 `IconClose` 实心 |
| D.3.29 | `<QuestionStem>` | 题干容器 | static + selection / marks | `fontSize 14/15/17/19` 与 D.3.15 Slider 联动；`enableSelection: true` 允许选词标注 |
| D.3.30 | `<AnswerSheet>` | 答题卡总览 | 4 状态色 | unanswered/answered/marked/current；网格按钮；状态色 sunken/elevated/warn-border/brand 实心 |
| D.3.31 | `<TimerDisplay>` | 考试计时器 | rest/warning/expired/paused | 等宽 `00:00:00`（`tabular-nums`）；进入 warningThreshold 整体 warn；归零 err |


---

## 4. 实施级 gotcha 清单（D.3.35）

以下规则不直接由 prop API 表达，但实施时必须遵守。这些是 V5 落地阶段最容易踩的坑：

| Gotcha | 规则 | 后果 |
|---|---|---|
| **Input box-sizing** | `<Input>` / `<Textarea>` / `<Select>` 内部 CSS **必须**显式 `box-sizing: border-box` | 浏览器 user-agent stylesheet 把 `<input>` 默认 `content-box`，覆盖全局 `* { box-sizing: border-box }`；否则 `width: 100%` + padding + border 撑出父容器，撞到右邻居 |
| **Input min-width** | `<Input>` 默认 **`min-width: 0`** | grid / flex 子项里 `<input>` 默认 `min-width` 受 `size` HTML 属性影响（≈20ch≈256px），即使外层 grid 列只有 200px 也会溢出；强制 `min-width: 0` 让 grid item 收缩 |
| **button 标签清零** | 组件根处 `background: none; border: 0; font: inherit; cursor: pointer;` | 浏览器默认 `<button>` 带 native border / background / font-family |
| **`<a>` 标签 underline** | rail-btn / list-item 用 `<a>` 时 `text-decoration: none`；仅内容中 link 文字保留 underline | 否则导航栏全是下划线 |
| **触屏 hover 残影** | 所有 `:hover` 视觉规则**必须**包裹 `@media (hover: hover) and (pointer: fine)` | 否则触屏点击后 hover 状态卡住到下次点击（CP.9） |
| **Modal / Drawer body scroll lock** | 打开时给 `<body>` 加 `overflow: hidden` + 计算 scrollbar 宽度补偿；关闭时还原 | 否则打开 Modal 后下层页面可滚动 |
| **Note 详情用 Drawer 不用 Modal** | Note 笔记详情含富文本编辑，必须用 `<Drawer side="right" size="lg">`，移动端自动转 `<Sheet side="bottom">` | Modal 默认 max 640px 太窄；R2/Q1 决策 |
| **Exam 不复用 SaaS Shell** | 进入 Exam 是切 layout，不是折叠 Rail；**禁止在 Exam 内嵌 `<AppShell>` / `<Rail>`** | 详见 [04-Pages.md §D.4.6](./04-Pages.md) |

---

## 5. SVG 图标规范（CP.5 落地）

V4 只规定"必须 SVG"，未规定风格 / 尺寸 / 用法边界，导致原型里描边粗细 1.5 / 1.7 / 1.8 / 2 混杂、有的 fill 实心有的 stroke 线性、`viewBox` 宽高不一。V5 在此处一次性收敛。

### 5.1 风格统一

| 维度 | 规则 |
|---|---|
| 形态 | **outline / stroke-only**（线性图标）；不允许实心 fill / 双色 / 拟物 |
| viewBox | 固定 `0 0 24 24`（无论实际渲染尺寸） |
| stroke-width | 默认 1.7；尺寸 ≥ 22 时 1.8，尺寸 ≤ 14 时 1.6 |
| stroke-linecap / linejoin | `round` |
| fill | `none`（外层 svg 与 path 都不带 fill） |
| stroke | `currentColor`（继承文字色，自动适配 light/dark） |
| 端点对齐 | 所有路径栅格对齐到 0.5px，避免亚像素模糊 |
| 内部留白 | 图标主体不超过 `2 2 20 20`（四周保留 2px 视觉边距） |

**例外**：仅**状态徽标**（如完成 ✓、错误 ✗）允许带 fill 实心；命名以 `Filled` 后缀（如 `CheckFilled`），与同名 outline 版本（`CheckOutline`）共存。

### 5.2 必须用 SVG 的场景白名单

| 场景 | 大小 | stroke-width |
|---|---|---|
| 导航栏 / Rail nav | 18 | 1.7 |
| 顶部命令搜索 trigger | 14 | 1.8 |
| 顶部 icon-btn（通知 / 字号 / 收藏 / 分享 / 更多） | 16 | 1.8 |
| 按钮内 icon-leading / icon-trailing（"+ 新建" / "开始练习" 等） | 16 | 2.0 |
| icon-only 按钮（关闭 / 菜单 / 折叠 / 复制） | 16 | 1.8（必须带 `aria-label`） |
| **答题系统专用按钮** | 16 | 1.8 |
| 题型分类标识（rail-btn 前置 / Practice scope / Note 来源 chip） | 14 | 1.7 |
| 状态指示（已完成 ✓ / 错误 ✗ / 警告 ! / 信息 i） | 14–16 | 1.8（或允许 Filled 变体） |
| 空状态插画 | 40–80 | 1.5（视觉减弱） |
| 品牌 Logo | 32 | — (Logo 不走线性规则) |
| 趋势箭头（metric delta / Numeric trend） | 12 | 2.0 |

### 5.3 答题系统图标清单（业务关键，固化命名）

由于"答题系统"是 sikao 的核心场景且按钮密集，以下 14 个图标命名固化：

| 业务名 | 图标 ID | 形态 | 必带 aria-label |
|---|---|---|---|
| 上一题 | `IconChevronLeft` | < 形 | "上一题" |
| 下一题 | `IconChevronRight` | > 形 | "下一题" |
| 标记 / 收藏 | `IconBookmark` | 书签 | "标记本题" / "收藏本题" |
| 标注笔 | `IconHighlighter` | 荧光笔 | "标注笔" |
| 删除 | `IconTrash` | 垃圾桶 | "删除" |
| 计时器 | `IconTimer` | 圆 + 指针 | "考试计时" |
| 暂停 | `IconPause` | \|\| | "暂停" |
| 继续 | `IconPlay` | ▷ | "继续" |
| 字号档切换 | `IconType` | A↕ | "切换字号" |
| 草稿纸 | `IconScratchPad` | 网格纸 | "打开草稿纸" |
| **交卷** | `IconSubmit` | 飞机 paper-plane | "交卷"（**必须二次确认 ConfirmDialog**） |
| 答题卡总览 | `IconAnswerSheet` | 网格四宫格 | "答题卡" |
| 笔记 | `IconNotebook` | 笔记本 | "笔记" |
| 设置 | `IconSettings` | 齿轮 | "设置" |
| 退出 / 离开考试 | `IconExit` | 门 + 箭头 | "退出考试"（**必须二次确认**） |

### 5.4 Rail 导航辅助图标（3 个）

| 业务名 | 图标 ID | 形态 | 必带 aria-label |
|---|---|---|---|
| Rail 折叠开关 | `IconRailToggle` | 侧栏框 + 内嵌左箭头（折叠态视觉旋转 180° 自动变右箭头） | "折叠侧栏" / "展开侧栏" |
| 命令搜索 | `IconSearch` | 放大镜 | "命令搜索 (Ctrl+K)" |
| 全局折叠主入口 | `IconBurger` | ≡ 三横线（仅 768–1023 平板顶部用） | "打开导航" |

`IconRailToggle` 形态规则：24×24 viewBox 内画一个矩形（代表 Rail 容器）+ 矩形内一条竖线（代表 Rail 边界）+ 内嵌左指箭头。展开态显示原状，折叠态用 `transform: rotate(180deg)` 自动翻转——但 V5 Rail 折叠态完全隐藏 Toggle 按钮（[02-Token-System §6.3](./02-Token-System.md)），所以 rotate 只在"用户先展开后再次悬停 brand 区"的瞬间状态有效，不是常驻视觉。

### 5.5 禁用清单（CP.5 + lint 强制）

以下用法**禁止**出现在 `apps/**/src/**`：

- 用 emoji 当图标：`📝` / `⭐` / `✅` / `🔔` 等。允许出现在 ui-copy 文案中作为情绪修饰，但**绝不**单独承担"图标"语义
- icon-font（如 Font Awesome、iconfont 字体方案）：禁
- 位图图标（PNG/JPG/WebP 作为图标资产）：禁。除"品牌 Logo 多色像素稿"等极端例外，必须经 lhr 批准
- 不带 `aria-label` 的 icon-only 按钮（lint：`lint-icon-button.mjs`）

### 5.6 SVG 资产组织（Phase 5 落地）

- **单一来源**：`packages/design-system/src/icons/*.svg`，每个图标一个文件，文件名 = 业务命名（如 `chevron-left.svg`）
- **生成 Sprite**：构建期合并为 `icons.svg`（已存在于 `apps/web/public/icons.svg`，V5 沿用）
- **使用方式**：`<svg><use href="/icons.svg#chevron-left" /></svg>`，配合 `currentColor` 自动取色
- **新增图标**：必须先在 design-system 仓提 PR，附 SVG 源文件 + 业务命名 + 用途说明，CI 跑 `lint-icon-style.mjs` 校验风格

---

## 6. 关联文档

- [`design.md` §C.5 / §D.1–D.3`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md) — 完整 SVG 规范 + 卡片状态机 + 35 prop API 原文
- [02-Token-System.md](./02-Token-System.md) — 卡片 / 按钮 / 输入 / 行高 component token 来源
- [00-Decisions.md](./00-Decisions.md) — R2/Q1（Drawer）/ R2/Q2（Tabs 合并）/ R2/Q6（答题业务组件）落地处
- [04-Pages.md](./04-Pages.md) — 这些组件如何在 6 桌面页 + Mobile Shell 组合
- [09-Correctness-Properties.md](./09-Correctness-Properties.md) — CP.1 / CP.5 / CP.9 lint 校验
