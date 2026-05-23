# Requirements Document

> **2026-05-24 UPDATE — V5-M0.5 Big-Bang Rebuild**
>
> lhr 拍板：放弃 V4→V5 迁移路径，改为 big-bang 重建。`apps/web/src/{views,components,layouts,lib,utils,router,styles,test-utils,types,assets,__tests__}` 与 `packages/ui` 整包删除；前端业务层在 V5 规范下从零实现。
>
> 影响范围：
> - **REQ-12 整段 ARCHIVED**（不再有"迁移"语义可言）
> - **R1/Q6 决策（双轨期 2 周）ARCHIVED**
> - **§C.6 design.md V4→V5 mapping 章节 ARCHIVED**
> - **`packages/design-system/src/tokens.css` §8 V4 alias 区块同步删除**
> - REQ-1.6（V4 token 必须有去向）改为：V4 token 名在 V5 全部消失即为达成
> - REQ-1..REQ-11 全部不变
> - 不变量 INV-1..7 全部不变
> - R1/Q1..Q5 + R2/Q1..Q6 全部不变
>
> 详见 [11-Implementation-Plan.md](../../../docs/vault/05-migration/Phase/Style-Guide-V5/11-Implementation-Plan.md) §V5-M0.5 章节。

## Introduction

V4 前端样式规范（`.tmp_review/out/Frontend Style Guide v4.html` 及同目录页面 HTML）是在没有 Figma 交接包的情况下、基于原型截图由 AI 推断而成，颗粒度粗、组件状态不全、token 分层不清。

V5 的事实来源是 `.tmp_review/tam/Mobile_App_UI_Figma_Handoff_Package.zip`（解压在 `.tmp_review/tam/_unpacked/figma_cloud_handoff/`）：含 Figma 交接文档（PDF/DOCX/MD）和 8 张高保真截图（home / note_detail / templates / keyboard_menu / home_create / home_empty / contact_sheet / dashboard）。

注意：交接包是 Notely（笔记/日历/任务 app）。sikao 是公考刷题产品，业务形态不同。**V5 借鉴的是 Notely 的"设计语言"——token 命名分层、卡片视觉、圆角节奏、模块容器内的信息密度规则、状态机分支**，而不是把 sikao 改成笔记 app。已锁定的页面骨架（Home / Practice / Me / Note）布局结构作为不变量保留；视觉/容器/卡片/状态层面接受大改。

V5 最终交付物是新一版规范文档；规范定稿后需反哺 `docs/vault/04-design/Design-System.md` 与 `packages/design-system/src/tokens.css`，但反哺动作不在本 spec 范围。

## 2. 角色与边界 / Roles & Scope

**适用对象**：sikao 全部前端 surface（apps/web 主战场，apps/mobile / apps/tablet / apps/admin 接入同一 token 与组件契约）。

**纳入范围**：token 体系（color / radius / spacing / typography / shadow / motion / z-index）、卡片与容器规范、组件级状态机（按钮 / 输入 / Tab / 列表项 / Sheet / Modal / Toast / Badge / Tag / 进度 / 空状态 / 骨架屏）、页面级容器分层（Home / Practice / Note / Me / Exam-Shenlun / Exam-Xingce / Question Hub / Review）、可访问性与 i18n、可验证性检查点、V4→V5 迁移策略。

**不纳入范围**：业务流程改造、API 契约、数据模型、产品功能新增、apps/web 之外的 platform 适配实现细节。

## 3. 不变量 / Invariants

以下事项由用户已锁定，V5 不得破坏：

1. **页面骨架**：Home / Practice / Me / Note 的信息架构与纵向模块顺序保留 V4 现状（视觉呈现可改）。
2. **主色调**：light 主题主色 `#FFD200`（brand-yellow），dark 主题 `#FFEB38`（brand-yellow），不变。
3. **CJK 禁 italic**：所有中日韩字符节点不得带 `italic` / `<i>` / `font-style: italic`。
4. **SVG-only 图标**：图标只用 SVG，禁 emoji / 图片字体 / icon font 作为图标承载。
5. **Token 单源**：所有视觉常量必须落 `packages/design-system/src/tokens.css`；apps/web 不得出现独立的 hardcoded 视觉常量。
6. **dev 端口 18080**：示例代码/文档涉及本地启动一律使用 18080。
7. **禁 docker**：示例与建议中不得引入 docker 流程。

## 4. 用户故事 / User Stories

- **作为前端工程师**，我希望 V5 给出"按 token 名取值即可写组件"的明确路径，避免再凭感觉拍数值。
- **作为设计 reviewer**，我希望 V5 列出每个组件的全部状态（默认 / hover / pressed / disabled / selected / focus-visible / loading / empty / error / read-only），避免遗漏分支。
- **作为 PM / QA**，我希望 V5 的每条规则都带可验收的检查点，能写自动化 lint 或人工 checklist。
- **作为新入场 agent**，我希望 V5 文档结构稳定、目录可索引，能在 5 分钟内定位到"卡片圆角用哪个 token"这种具体问题。

## 5. 需求条目 / Requirements (EARS)
## Requirements

### REQ-1 Token 分层与命名空间

**Description**: V5 必须把视觉常量分成 primitive / semantic / component 三层，命名稳定可索引。

- **REQ-1.1** WHEN 任意源码或文档需要引用视觉常量 THE SYSTEM SHALL 强制取自 `packages/design-system/src/tokens.css`，禁止 hardcoded hex / px / rgba / 阴影字符串出现在 `apps/**/src/**` 之内。
- **REQ-1.2** THE SYSTEM SHALL 提供 primitive 层（如 `--color-yellow-500`、`--space-4`、`--radius-14`），不携带语义。
- **REQ-1.3** THE SYSTEM SHALL 提供 semantic 层（如 `--color-bg-page`、`--color-text-primary`、`--color-border-subtle`、`--color-state-danger`、`--color-brand-primary`），引用 primitive。
- **REQ-1.4** WHEN 组件需要稳定视觉契约 THE SYSTEM SHALL 提供 component 层（如 `--card-radius`、`--card-padding`、`--card-shadow-rest`、`--card-shadow-hover`、`--btn-height-md`），引用 semantic。
- **REQ-1.5** IF 需要 light/dark 切换 THEN THE SYSTEM SHALL 仅在 semantic 层做 dark 覆写，primitive 与 component 层保持稳定语义不被覆写。
- **REQ-1.6 验收**：所有 V4 中已存在的 token（`--paper-*` `--ink-*` `--line-*` `--brand-*` `--ok/warn/err/info` `--shadow-*` `--sp-*` `--r-*` `--t-*` `--icon-*` `--ease-*` `--dur-*` `--z-*` `--row-h` `--topbar-h` `--rail-w` `--h-xs..lg`）必须在 V5 有对应去向：保留 / 重命名 / 拆分 / 废弃，每条都要在 V5 文档"V4→V5 token mapping"章节明确标注。

### REQ-2 颜色体系

- **REQ-2.1** THE SYSTEM SHALL 保留 `--brand-yellow` 体系作为 primary CTA / 强调色；light 用 `#FFD200`、dark 用 `#FFEB38`，hover/soft 变体保留。
- **REQ-2.2** THE SYSTEM SHALL 给出 `paper-1/2/3` 三级 surface（page → card → elevated）和 `ink-1/2/3/3-soft/4` 文字层级，每级注明对比度（>= AA on paper-1）。
- **REQ-2.3** THE SYSTEM SHALL 提供 `border-subtle / border-default / border-strong` 三档分隔线（对应 V4 `--line-1/2/3`）。
- **REQ-2.4** THE SYSTEM SHALL 提供语义色 ok / warn / err / info，每个语义色都要有 `-50` 软底色变体用于 badge/tag 背景。
- **REQ-2.5** WHEN 业务出现"事件分类色"需求（如 Note 标签、题型分类、日历事件） THE SYSTEM SHALL 提供独立的 categorical 色板（不少于 4 色），与语义色严格分离，禁止把 ok/warn/err/info 复用为分类。
- **REQ-2.6** THE SYSTEM SHALL 定义 `--focus-ring` 单一焦点色，用于所有可聚焦元素，且与 paper-1 / ink-1 都满足 4.5:1。
- **REQ-2.7 验收**：lint 脚本必须能扫出 `apps/**/src/**` 中任意 hex / `rgb(` / `rgba(` 字面量，并将其判定为违规（与 REQ-1.1 共用一条 lint）。

### REQ-3 圆角规范

- **REQ-3.1** THE SYSTEM SHALL 用 5 档命名圆角：`--radius-tiny`（按钮/输入/chip）、`--radius-card-sm`（高密度列表项 / 微卡）、`--radius-card`（标准卡片）、`--radius-card-lg`（大型容器 / Sheet 顶部）、`--radius-pill`（全圆角导航/标签）。
- **REQ-3.2** THE SYSTEM SHALL 把交接包"卡片常用 16px、底部导航 pill"的视觉节奏吸收为：`--radius-card = 16px`（V4 是 18px，V5 收敛到 16，已由 user 在 Q1/REQ-3.2 拍板），`--radius-card-sm = 12px`（与外层差值 4px，满足 REQ-3.4），`--radius-card-lg = 22px`（用于 Sheet / 大型容器），`--radius-tiny = 10px`，`--radius-pill = 999px`。
- **REQ-3.3** IF 容器是 floating app shell（仅悬浮在视口内时） THEN THE SYSTEM SHALL 使用 `--radius-card-lg`，不再单独保留 V4 的 `--r-app: 28px`。
- **REQ-3.4** WHEN 卡片嵌套（外层卡 + 内层卡） THE SYSTEM SHALL 内层圆角不大于外层，且差值 >= 4px，避免视觉同心。
- **REQ-3.5 验收**：lint 脚本必须能扫出 `border-radius: <hardcoded>` 出现在 `apps/**/src/**`，仅允许 `var(--radius-*)` / Tailwind 映射类。

### REQ-4 间距与栅格

- **REQ-4.1** THE SYSTEM SHALL 提供 8 档基础间距 `--space-1..8`（4 / 8 / 12 / 16 / 24 / 32 / 48 / 64），并提供 mobile 紧凑覆写档（2 / 6 / 10 / 12 / 18 / 24 / 36 / 48）。
- **REQ-4.2** THE SYSTEM SHALL 把交接包"移动端左右边距 16px、模块纵向间距 24/32px"的节奏作为默认 view 内距规则。
- **REQ-4.3** THE SYSTEM SHALL 给出 view 纵向预算规则：单屏一级模块数量 **N = 4**（已由 user 在 Q2/REQ-4.3 拍板，与底部导航 4 项呼应；超过 4 个的内容必须靠滚动或合并）；每个一级模块标题区与正文区的纵向间距固定取自 `--space-3` / `--space-4`；每个一级模块允许的最大首屏占位高度由 design 阶段细化。
- **REQ-4.4** THE SYSTEM SHALL 提供"行高度" token：`--row-h-sm/md/lg`（紧凑列表 / 标准列表 / 大型卡内行），不再混用 `--h-xs..lg`（按钮高度）和 `--row-h`（列表行高度）。
- **REQ-4.5 验收**：lint 脚本必须能扫出 `padding|margin|gap` 上的硬编码 px / rem，仅允许 `var(--space-*)` 或 Tailwind 间距类。

### REQ-5 字体与字号

- **REQ-5.1** THE SYSTEM SHALL 保留 V4 字号梯度（display 40 / h1 32 / h2 24 / h3 18 / card 16 / body 13 / meta 12 / tiny 11）作为 web 端默认。
- **REQ-5.2** WHEN 屏幕断点 <= 移动 THE SYSTEM SHALL 提供等价的紧凑梯度（display 34 / h1 28 / h2 20 / h3 16 / card 14 / body 13 / meta 11 / tiny 10），与交接包"模块标题 18 SemiBold ls -1%"的层级一致。
- **REQ-5.3** THE SYSTEM SHALL 把字重抽象为 `--font-weight-regular/medium/semibold/bold`，并明确：标题用 medium 或 semibold，正文用 regular，CTA 按钮文字用 medium，badge/tag 文字用 medium。
- **REQ-5.4** WHEN 任何元素包含 CJK 字符 THE SYSTEM SHALL 禁用 `font-style: italic`、`<i>`、Tailwind `italic` 类（已存在 V4 lint，V5 沿用并强化）。
- **REQ-5.5** THE SYSTEM SHALL 提供两套字体栈：**UI 默认 = 纯系统字体栈 + 中文回退**（已由 user 在 Q3/REQ-5.5 拍板：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`），代码用等宽栈（`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`）；不引入需要在线下载的西文字体（含 DM Sans / Inter / Noto Sans 等）作为运行时依赖；`<Numeric>` 组件契约（REQ-8.5）必须使用 `font-variant-numeric: tabular-nums` 保证数字不抖动。
- **REQ-5.6** THE SYSTEM SHALL 把"长文渐隐遮罩"（交接包 NoteCard 正文底部）抽象成可复用 utility（如 `.text-fade-bottom`），不允许在业务组件里手写 mask-image。
- **REQ-5.7 验收**：CJK italic lint 沿用并扩展，覆盖 Tailwind 类和内联 style。

### REQ-6 阴影与高度

- **REQ-6.1** THE SYSTEM SHALL 提供 4 档阴影：`--shadow-rest`（卡片默认）、`--shadow-hover`（hover/focus 上浮）、`--shadow-pop`（popover/sheet/modal）、`--shadow-toast`（toast）。
- **REQ-6.2** WHEN dark 主题 THE SYSTEM SHALL 用 inset 高光 + 外阴影组合维持卡片层次，禁止把 light 阴影直接套用到 dark。
- **REQ-6.3** THE SYSTEM SHALL 给出 z-index 体系 `--z-rail / --z-topbar / --z-popover / --z-modal / --z-toast`，每层之间预留 >= 10 间距用于第三方插队。
- **REQ-6.4 验收**：lint 必须能扫出硬编码 `box-shadow:` 字面量与硬编码 `z-index: <num>` 在 `apps/**/src/**` 内的违规使用。

### REQ-7 卡片与容器规范

- **REQ-7.1** THE SYSTEM SHALL 定义至少 3 类卡片：standard-card（默认 padding-4、radius-card、shadow-rest）、stat-card（数据展示，强调数字层级）、list-card（多行列表项容器，可包内行 row-h-md）。
- **REQ-7.2** THE SYSTEM SHALL 给出每类卡片的全状态：rest / hover / pressed / focus-visible / selected / disabled / loading（骨架）/ empty（占位）/ error。
- **REQ-7.3** WHEN 卡片承载主要 CTA 时 THE SYSTEM SHALL 内置统一的"标题区 / 正文区 / 操作区"三段结构 token（标题区高度、正文区最小高度、操作区与正文区分隔线规则）。
- **REQ-7.4** THE SYSTEM SHALL 把交接包"卡片内长文底部渐隐"作为 list-card 的标准约束之一（参见 REQ-5.6）。
- **REQ-7.5** WHEN 卡片需要嵌套子卡 THE SYSTEM SHALL 强制使用 `paper-2`（外）+ `paper-1`（内）或反向，且符合 REQ-3.4 的圆角差值规则。
- **REQ-7.6 验收**：所有卡片状态在 V5 文档内必须有对应的视觉示例（HTML 片段或截图节点），缺一不可。

### REQ-8 组件级状态机

- **REQ-8.1** THE SYSTEM SHALL 为以下组件给出完整状态机：button（primary / secondary / tertiary / ghost / danger × rest/hover/pressed/disabled/loading/focus-visible）、input（rest / focus / filled / disabled / read-only / error / success）、tab（rest / hover / active / disabled）、segmented control、list-item（rest / hover / pressed / selected / disabled / dragging-handle）、checkbox / radio / switch、sheet（半屏 / 全屏 / dragging）、modal、toast（info/ok/warn/err）、badge、tag/chip、progress（线性 / 环形）、empty-state、skeleton。
- **REQ-8.2** THE SYSTEM SHALL 把 V4 中"按钮高度 28/32/36/40"统一为 `--btn-h-sm/md/lg/xl`，并明确每档对应的字号、icon 尺寸、圆角档。
- **REQ-8.3** WHEN 按钮内含图标 THE SYSTEM SHALL 给出"icon-only / icon-leading / icon-trailing"三种排布的 padding 与 gap token。
- **REQ-8.4** WHEN tab 是底部导航形态（参考交接包 BottomNavigation） THE SYSTEM SHALL 用 `--radius-pill` + 玻璃拟态背景（已由 user 在 Q4/REQ-8.4 拍板：默认采用玻璃拟态）；THE SYSTEM SHALL 同时提供 `@supports not (backdrop-filter: blur())` 自动降级到不透明 `paper-2`，并把该 fallback 视为 fail-fast 例外，要求在 V5 文档与 `docs/engineering/fail-fast-exceptions.md` 同时显式登记，登记内容含：触发条件（旧 WebView / `prefers-reduced-transparency`）、降级目标值、负责人、复审日期。
- **REQ-8.5** THE SYSTEM SHALL 把"数据/资金/分数"类数字展示抽象为 `<Numeric>` 组件契约，约束：等宽字体或 tabular-nums、千位分隔规则、单位与数值的视觉对比层级。
- **REQ-8.6 验收**：每个组件的状态在 V5 文档必须列出 prop API 草案（不含实现），便于 design 阶段直接落地。

### REQ-9 页面级容器分层

V5 必须给出每个已锁定页面的"容器分层规范"——只描述容器/卡片用法和模块顺序，不重做信息架构。

- **REQ-9.1 Home**：顶部条 + 周历模块 + 今日任务模块 + 快捷入口模块 + 底部导航；明确每个模块用哪类卡片、是否带操作区、空状态与加载态形态。
- **REQ-9.2 Practice**：题型选择卡片网格 + 进度横幅 + 推荐套题 list-card；明确 grid gap、卡片纵横比、空状态。
- **REQ-9.3 Note**：标签栏 + 笔记列表（list-card 带渐隐遮罩） + 详情入口规范；明确长文渐隐与摘要行数约束。
- **REQ-9.4 Me**：用户卡（stat-card） + 设置分组（list-card 折叠） + 危险操作分组（独立 list-card，danger 语义）。
- **REQ-9.5 Exam-Shenlun / Exam-Xingce**：双栏布局（Material/Question）、可拖拽分隔条、TopBar、底部草稿纸 sheet；视为"考试模式 layout"，不与普通页面共用 padding 规则。**纳入范围限定（已由 user 在 Q5/REQ-9.5 拍板）**：V5 只定义考试模式所需的 token 与"容器钩子"——TopBar 高度槽位、Material/Question 双栏的 `--exam-pane-padding` / `--exam-divider-handle-w` token、Sheet 弹起时的 z-index 占位、字号档位（与 REQ-5.1/5.2 共用）；具体的 layout 实现、计时器交互、拖拽 resize 行为、考试状态机由独立的"考试设计 spec"承担，不在 V5 范围内。
- **REQ-9.6 Question Hub / Review**：题目卡片网格、错题筛选条、复习日历；明确卡片密度（紧凑 row-h-sm）。
- **REQ-9.7 验收**：每个页面规范必须给出"容器树"图（HTML 嵌套或文字树），便于实现前对照。

### REQ-10 可访问性 / i18n / 动效

- **REQ-10.1** THE SYSTEM SHALL 要求所有可点击元素满足最小命中区域 40×40 px（或交互区域通过透明 padding 扩展）。
- **REQ-10.2** THE SYSTEM SHALL 要求所有正文-背景对比度 >= 4.5:1，meta 文本 >= 3:1（且 meta 不得作为关键信息载体）。
- **REQ-10.3** WHEN 用户系统设置 `prefers-reduced-motion: reduce` THE SYSTEM SHALL 关闭非必要动效（保留 200ms 内的 fade，禁止位移/弹性动效）。
- **REQ-10.4** THE SYSTEM SHALL 沿用 V4 `--ease-out / --ease-emphasized / --dur-fast/base/slow`，并在 V5 给出"什么场景用哪条"的明示表。
- **REQ-10.5** WHEN UI 文案 THE SYSTEM SHALL 强制取自 ui-copy SSOT（已有 V4 lint），V5 不放宽。
- **REQ-10.6** WHEN 页面为 RTL 语言 THE SYSTEM SHALL 通过 logical properties（`padding-inline-*` / `margin-inline-*`）适配，禁止用 `padding-left/right` 写死方向。
- **REQ-10.7 验收**：可访问性检查点必须能挂到 axe / playwright 自动化里，规范本身需列出每条检查的 selector 或 ARIA 期望。

### REQ-11 可验证性 / Lint Gates

- **REQ-11.1** THE SYSTEM SHALL 提供 / 沿用以下 lint 脚本，全部接入 `apps/web` 的 `pnpm lint`：
  - `lint-hardcode.mjs`：禁 hex / rgba / px-as-color。
  - `lint-radius-token.mjs`：禁 hardcoded `border-radius`。
  - `lint-italic.mjs`：CJK 禁 italic。
  - `lint-no-emoji-as-icon.mjs`：图标不得用 emoji。
  - `lint-practice-svg-only.mjs`：图标 SVG-only。
  - `lint-icon-button.mjs`：icon-only 按钮必须带 aria-label。
  - `lint-cn-simplified.mjs`：中文文案简体校验。
  - `lint-ui-copy-ssot.mjs`：UI 文案取自 SSOT。
- **REQ-11.2** THE SYSTEM SHALL 在 V5 文档"Lint 规则索引"章节，把每条 lint 与上文 REQ-X 关联（一一对应到 traceability 矩阵）。
- **REQ-11.3** IF 某条规则当前没有对应 lint THEN THE SYSTEM SHALL 在 V5 文档明确标注"无自动化、人工 review 兜底"，不允许默认假设有 lint。
- **REQ-11.4** THE SYSTEM SHALL 要求 V5 规范文档提交时附带"V5 自检报告"——对 V4 现存页面 HTML 跑一遍 V5 lint 集，记录基线违规数，作为后续迁移进度衡量。

### REQ-12 V4 → V5 迁移 ~~（ARCHIVED 2026-05-24）~~

> **ARCHIVED 2026-05-24（V5-M0.5 big-bang rebuild 决策）**：本节整段作废。lhr 在 2026-05-24 拍板 big-bang 重建——`apps/web/src/{views,components,layouts,lib,utils,router,styles,test-utils,types,assets,__tests__}` 与 `packages/ui` 整包删除，前端业务层从 V5 规范从零实现，**没有 V4 surface 需要迁移**。Token mapping 表、双轨期、整页 surface 切换、迁移前后对照等机制全部失效。本节保留作历史记录，下游 design / tasks 一并按 ARCHIVED 处理。
>
> 替代规则：
> - V5 spec 三件套与 Phase 文档落地后，业务 Phase（Home / Practice / Notes / Review / Profile / Marketing）在新 V5 框架下从零实现，不再走"V4 → V5 切换"。
> - V4 token alias 双轨期作废；`packages/design-system/src/tokens.css` §8 V4 alias 区块在 V5-M0.5 一并删除。
> - 各业务 Phase 前端任务直接消费 V5 规范，不再依赖"V5-M5..M8 surface 切换"中间层（V5 主线已收敛，详见 [11-Implementation-Plan.md](../../../../docs/vault/05-migration/Phase/Style-Guide-V5/11-Implementation-Plan.md)）。

~~- **REQ-12.1** THE SYSTEM SHALL 提供"token mapping 表"（V4 token → V5 token），逐条标注 keep / rename / split / deprecate。~~
~~- **REQ-12.2** WHEN token 是 deprecate THE SYSTEM SHALL 给出过渡期 = **2 周**……~~
~~- **REQ-12.3** WHEN 视觉变更影响已上线页面 THE SYSTEM SHALL 在 V5 文档给出"页面级迁移清单"……~~
~~- **REQ-12.4** THE SYSTEM SHALL 禁止在迁移期出现"V4 + V5 双套 token 同屏"的页面……~~
~~- **REQ-12.5 验收**：V5 文档必须有一节"迁移前/迁移后对照"，至少给出 Home / Practice / Note / Me 四个页面的对照证据。~~

## Glossary

- **Token**：视觉常量（颜色 / 间距 / 圆角 / 阴影 / 字号 / 动效）的命名引用，落在 `packages/design-system/src/tokens.css`。
- **Primitive token**：不带语义的最底层取值，如 `--color-yellow-500`、`--space-4`。
- **Semantic token**：带语义、可被 dark 主题覆写，如 `--color-bg-page`、`--color-text-primary`。
- **Component token**：组件契约层，引用 semantic，如 `--card-radius`、`--btn-height-md`。
- **Surface**：sikao 的可见前端页面或独立交互流（Home / Practice / Note / Me / Exam-Shenlun 等）。
- **Paper / Ink / Line**：V4 沿用的"纸面 / 墨色 / 分隔线"分层语义，V5 继续保留。
- **Brand-yellow**：sikao 主色调，light=`#FFD200`、dark=`#FFEB38`。
- **交接包**：`.tmp_review/tam/_unpacked/figma_cloud_handoff/`，含 Figma 文档与 8 张参考截图。
- **SSOT**：Single Source of Truth，单源真相。token / ui-copy / design-system 各有独立 SSOT。
- **EARS**：Easy Approach to Requirements Syntax，本文档需求条目使用的标准句式。

## 6. 完成标准 / Definition of Done

V5 requirements 阶段完成需要满足：

1. 本文档全部 REQ 条目通过 user 一轮 review，且每条都能映射到至少一个验收方式（lint / 视觉示例 / 人工 checklist）。
2. 进入 design 前的关键决策点（圆角档位 / 模块上限 N / 字体栈 / 底部导航材质 / 考试模式范围 / 迁移过渡期）已由 user 拍板，结果记录在第 7 节 "Resolved Decisions"，不留隐式假设。
3. 所有不变量（第 3 节）均未被需求条目隐含推翻；如有冲突已显式列出并由 user 拍板。
4. 已识别全部 V4 token 的 V5 去向（REQ-1.6），未出现"未提及就消失"的 V4 token。
5. 已与 AGENTS.md 硬规则（H1–H10）对齐：本 spec 不破坏 token 单源、CJK 禁 italic、SVG-only、ui-copy SSOT、18080、禁 docker 等约束。

## 7. 已拍板决策 / Resolved Decisions

进入 design 前的 6 个开放问题已由 user 在 2026-05-23 通过决策板（`.tmp_review/v5-open-questions.html`）拍板，结果如下；后续 design 与实现一律以本节为准，不再回溯讨论。

| 编号 | 关联 REQ | 决策 | 关键约束 |
|---|---|---|---|
| Q1 | REQ-3.2 | `--radius-card = 16px`（与交接包对齐） | 配套 `--radius-card-sm = 12px`、`--radius-card-lg = 22px`、`--radius-tiny = 10px`、`--radius-pill = 999px`；嵌套差值 >= 4px。 |
| Q2 | REQ-4.3 | 单屏一级模块 N = 4 | 与底部导航 4 项呼应；超出靠滚动或合并，不靠塞密度。 |
| Q3 | REQ-5.5 | 纯系统字体栈 + 中文回退 | 不引入 DM Sans / Inter / Noto Sans 在线字体；数字展示 `<Numeric>` 用 `tabular-nums`。 |
| Q4 | REQ-8.4 | **底部导航采用玻璃拟态 + 自动降级**（user 选 A） | 默认 `backdrop-filter: blur(...)`；`@supports not (backdrop-filter)` 时降级到不透明 `paper-2`；该 fallback 必须同时登记到 `docs/engineering/fail-fast-exceptions.md`，含触发条件、降级目标、负责人、复审日期。 |
| Q5 | REQ-9.5 | V5 只定考试模式所需的 token 与容器钩子 | 具体 layout、resize、计时器、状态机走独立"考试设计 spec"。 |
| Q6 | REQ-12.2 | ~~V4→V5 迁移过渡期 = 2 周~~ **ARCHIVED 2026-05-24**：V5-M0.5 big-bang rebuild 决策已让双轨期失效，apps/web 业务层一次性删除 + 从零按 V5 实现，无 V4 alias 需要 sunset | ~~双轨期内 V4 token 标 `@deprecated` + 失效日期~~ |

### 7.2 R2 决策（2026-05-23 通过决策板 `.tmp_review/v5-open-questions-r2.html`）

P0 补完后又拍板了 6 项方向性选择，结果如下；与 §7.1 一并作为 design / tasks 阶段的强约束。

| 编号 | 关联 | 决策 | 关键约束 |
|---|---|---|---|
| R2-Q1 | D.4.3 | Note 详情用 `<Drawer side="right" size="lg">` | 不用 Modal；移动端自动转底滑 Sheet；左侧保留笔记墙作上下文。 |
| R2-Q2 | D.3.3 | Tabs 与 SegmentedControl 合并 | 单组件 3 variant：underline / pill / segmented；ScopeToggle 是 `variant="segmented"` 的特例。 |
| R2-Q3 | D.3.x | DataTable 仅在 V5 留 token 钩子 | `--table-row-h` 等纳入 component token；具体 prop API 由独立 admin spec 承担。 |
| R2-Q4 | D.5 | Mobile Shell 骨架 + token，4 页结构精简 | §D.5 当前 7 子节保留；移动端启动时新写 mobile spec 细化，但 token 已固化。 |
| R2-Q5 | C.4.2 | `--max-w-workspace = 1440px` | 1920 主战场 ws 居中，左右各 120 留白；折叠后留白增至 200，**workspace 内容不变**（"沉浸感开关"）。**附加规则**：详见 C.4.3 Rail 折叠规则。 |
| R2-Q6 | D.3.28-31 | 答题系统业务组件保留在 V5 | OptionItem / QuestionStem / AnswerSheet / TimerDisplay 由 V5 给契约；layout / 状态机由独立 Exam spec 承担（与 Q5 不冲突）。 |

### 7.3 Q4 玻璃拟态 fail-fast 例外登记草案

为收敛 H7 Fail-Fast 条款，先在本 spec 草拟例外登记，design 阶段落到 `docs/engineering/fail-fast-exceptions.md`：

- **例外名**：`mobile-bottom-nav-glassmorphism-fallback`
- **位置**：BottomNavigation 组件底部容器背景。
- **默认行为**：`background: rgba(paper-1, 0.55); backdrop-filter: blur(18px) saturate(140%);`
- **降级触发**：`@supports not (backdrop-filter: blur(1px))`、或 `prefers-reduced-transparency: reduce`、或运行时检测 `CSS.supports('backdrop-filter', 'blur(1px)') === false`。
- **降级目标**：`background: var(--color-bg-elevated); backdrop-filter: none;`，保持可读性优先。
- **负责人**：lhr。
- **复审日期**：2026-08-23（V5 上线后约 3 个月）。
- **不允许的处理方式**：silent catch、用 `?? defaultValue` 把 backdrop-filter 写成可选字符串、在业务组件里手写 fallback 而不走 token。

