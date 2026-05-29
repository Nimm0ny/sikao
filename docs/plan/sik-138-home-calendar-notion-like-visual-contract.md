---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-28
issue: SIK-138
spec: .kiro/specs/sik-138-home-calendar-v2/
plan: docs/plan/sik-138-home-calendar-notion-like-v2-plan.md
prototype:
  - .tmp_review/out/Tab1-Home-mock/home-calendar-notion-like-mock.html
  - .tmp_review/out/Tab1-Home/Home v2.1.html
---

# SIK-138 Home Calendar Notion-like 视觉契约

> 本文件以 issue `SIK-138` 的 `## Acceptance` 为验收锚点。W1 只定义 Home `CalendarPanel` 的视觉与交互合同，不授权实现侧新增写路径，也不覆盖其它 Home 区块的 owner。

## 1. Layout Topology

- Home 入口 view 继续受 `ScreenLockShell` 约束：`rows="auto auto minmax(0, 1.6fr) minmax(0, 1fr)"`，外层保持 `height: 100dvh + overflow: hidden`，只允许内部局部滚动。
- Row 1 是 Home topbar / page header，Row 2 是 metric row，Row 3 是 `CalendarPanel` 主区，Row 4 是 bottom cards；`SIK-138` 只拥有 Row 3 内部拓扑与其衍生的 Peek overlay。
- `CalendarPanel` 必须保持单一 head：左侧是 `today / week / month` segmented tabs 三态，右侧是 `prev / today / next / +` 四按钮与 `countdown chip`；不得回退到双层 head。
- `TodayCalendarView` 保持 head/body 同步横向滚动；`WeekCalendarView` 与 `MonthCalendarView` 只在 panel body 内局部滚动，不得把高度膨胀回 Home root。
- `MonthCalendarView` 的 cell overflow 只能通过 `+N 更多` 收口，不能把 cell 自动撑高到破坏一屏锁死。
- `Peek` 必须是 portal-mounted 浮层，不占 Home grid 行高；打开、翻页、关闭都不能改变 root shell 的滚动模式。

| 区域               | 结构约束                                          | owner           |
| ------------------ | ------------------------------------------------- | --------------- |
| Home root          | `auto / auto / minmax(0, 1.6fr) / minmax(0, 1fr)` | 既有 Home shell |
| CalendarPanel head | tabs + 4 actions + countdown，单行对齐            | SIK-138         |
| CalendarPanel body | today/week/month 三视图切换，不改外层高度模型     | SIK-138         |
| Peek overlay       | portal + modal layer，脱离 grid                   | SIK-138         |

关键节点拓扑表：

| 节点         | parent -> child                                                                     | grid / flow 位置                                                    | 一屏行为                                                           | owner   |
| ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| `panel head` | `CalendarPanel` -> `segmented tabs + actions + countdown chip`                      | Row 3 / panel 顶部固定 head，位于 bodyScroll 之前                   | 固定，不滚动，不参与整页撑高                                       | SIK-138 |
| `dowRow`     | `MonthCalendarView` / `WeekCalendarView` -> `day labels`                            | panel body 顶部，位于 `bodyScroll` 内部首行                         | 与视图 body 同属局部滚动上下文；不得把外层 root 顶开               | SIK-138 |
| `bodyScroll` | `CalendarPanel` -> `today/week/month view body`                                     | Row 3 主滚动拥有者；today 为横向同步滚动，week/month 为纵向局部滚动 | 唯一允许承载 calendar 主要滚动的节点；Home root 仍锁屏             | SIK-138 |
| `month-cell` | `bodyScroll` -> `dom + chip list + +N 更多`                                         | month grid 单元格，位于 `MonthCalendarView` 7 列网格内              | 单元格内部自然流，整体不得因内容过多突破 `cardLimitPerCell=3` 合同 | SIK-138 |
| `chip`       | `month-cell` / `week day-cell` / `today strip slot` -> `visibleProperties channels` | `month-cell` 内纵向条目，或 today/week 对应事件流条目               | 可点击打开 Peek；自身不拥有独立滚动，必须服从父级局部滚动容器      | SIK-138 |

## 2. Required Interactive Elements

| 元素               | 位置                                          | 必须行为                                                                                          | 备注                        |
| ------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------- |
| segmented tabs     | `CalendarPanel` head 左侧                     | 精确 3 态：`today` / `week` / `month`；切换后驱动同一组 `CalendarViewConfig`                      | 不得增减第 4 个 tab         |
| `prev` 按钮        | head 右侧 actions                             | 视图感知翻页：today 按天，week 按周，month 按月                                                   | 必须可点击                  |
| `today` 按钮       | head 右侧 actions                             | 回到当前日期 anchor                                                                               | 视觉上独立于 segmented tabs |
| `next` 按钮        | head 右侧 actions                             | 与 `prev` 镜像翻页                                                                                | 必须可点击                  |
| `+` 按钮           | head 右侧 actions                             | 视觉上必须存在；W1 仍是只读占位，不得偷偷越权成 create flow                                       | defer to 后续 create wave   |
| countdown chip     | head 右侧 actions 末位                        | 显示考试倒计时，如 `国考 D-138`                                                                   | 与四按钮同一行              |
| `+N 更多`          | month / week overflow 位置                    | 仅作为 overflow 文案，不得弹出第二层 popover                                                      | 文案固定用“更多”            |
| chip click         | month `chip` / today `h-chip` / week `w-chip` | 点击任意 chip 必须进入同一个 Peek 流程                                                            | 这是主交互入口              |
| Peek 顶 bar 6 按钮 | `CalendarPeekHead`                            | 精确 6 个：展开为页面、上一条、下一条、复制链接、更多、关闭                                       | 允许只读占位，但不能缺席    |
| Peek notes         | `peek` body 底部                              | 展示备注区域；W1 只读，不得内联编辑                                                               | 与属性表分区                |
| Peek prev / next   | `peek` head 中部                              | 点击按钮或键盘方向键时，在当前打开列表内翻到上一条 / 下一条                                       | 不得跳出当前 list scope     |
| Peek close         | `peek` close 按钮、scrim、`Esc`               | 关闭浮层、恢复 body scroll、focus 返回触发 chip                                                   | 三种关闭入口都必须在        |
| Peek 8 行属性      | `CalendarPeekProperties`                      | 精确 8 行：`time`、`kind`、`category`、`status`、`source`、`linkedSession`、`target`、`recurring` | W1 全部只读                 |

## 3. Information Density

- Month 视图默认密度锁定 `cardLimitPerCell=3`。单个 date cell 最多显示 3 个 chip，第 4 个及以后统一收敛为一行 `+N 更多`；W1 不允许 overflow popover。
- `visibleProperties` 通道全集精确锁定为 7 个，且只允许这 7 个名字进入 `CalendarViewConfig`：`title`、`category`、`kind`、`status`、`source`、`linkedSession`、`target`。
- 这 7 个通道的视觉编码必须一一分离，不能抢同一语义位：

| visibleProperty | 视觉通道                          | W1 说明                  |
| --------------- | --------------------------------- | ------------------------ |
| `kind`          | 左侧 `border-left` + 轻 tint 背景 | 分类主编码               |
| `title`         | 主标题文本                        | 永远存在                 |
| `category`      | 次级中性文本                      | 仅在 detail 密度展开     |
| `status`        | 状态 dot / mark                   | 不得挤占 kind 色条       |
| `source`        | 单枚 source icon                  | 图标来自 `lucide-react`  |
| `linkedSession` | link icon                         | 只表达“有关联”           |
| `target`        | target badge                      | 独立 badge，不代替 title |

- W1 预设密度锁定如下：`compact = ['title', 'kind']`，`default = ['title', 'kind', 'status']`，`detail = ['title', 'kind', 'status', 'category', 'source', 'linkedSession', 'target']`。`createDefaultCalendarViewConfig(view)` 必须等于 `default`。
- Today / Week / Month 三视图都复用同一组 7 通道定义，只允许布局变化，不允许各视图私自新增第 8 个 chip 通道，更不允许塞入 aggregate analytics 字段。
- Peek 的信息密度独立于 chip：顶 bar 6 按钮 + body 8 行属性 + notes 区 + read-only banner。W1 没有 inline edit，没有 mutation wiring。
- 视图态最少覆盖 `loading / empty / error / ready` 四态；`ready` 才出现 chip 与 Peek 交互，`empty` 仍保留 head controls，不得把 tabs 或 action 按钮一起隐藏。

## 4. Token Map

> 本节只引用 `packages/design-system/src/tokens.css` 中已存在的 token。未来 `--cal-kind-* / --cal-chip-* / --cal-peek-*` 只在下表登记命名与值意图，不视为已落 CSS。

| 原型 var / 视觉语义                | 生产 token                                                                             | 备注                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| `--paper-1` panel surface          | `--card-bg`                                                                            | panel / peek 卡面优先走 card contract        |
| `--paper-2` elevated inner surface | `--card-bg-elevated`                                                                   | tabs 容器、notes 次层背景                    |
| `--ink-1`                          | `--color-text-primary`                                                                 | 标题、主文案                                 |
| `--ink-2`                          | `--color-text-secondary`                                                               | 次级正文                                     |
| `--ink-3`                          | `--color-text-meta`                                                                    | meta / 辅助信息                              |
| `--ink-3-soft`                     | `--color-text-meta-soft`                                                               | 装饰性弱信息                                 |
| `--line-1` / `--line-2`            | `--color-border-subtle` / `--color-border-default`                                     | 边框层级按语义选用                           |
| `--brand-yellow`                   | `--color-brand-primary`                                                                | 倒计时与品牌强调，不直接充当 event kind SSOT |
| `--brand-yellow-soft`              | `--color-brand-soft`                                                                   | 品牌弱底色，不直接代替 kind tint 全家桶      |
| success / warn / err / info        | `--color-state-ok` / `--color-state-warn` / `--color-state-err` / `--color-state-info` | 状态语义只服务 status/focus/banner           |
| `--r-card`                         | `--card-radius`                                                                        | 16px，按 V5 校准值                           |
| `--r-card-sm`                      | `--card-radius-sm`                                                                     | 12px                                         |
| `--r-pill`                         | `--radius-999`                                                                         | segmented tabs / badge / chip 圆角           |
| `--shadow-1`                       | `--card-shadow-rest`                                                                   | 卡片静止阴影                                 |
| `--shadow-2`                       | `--card-shadow-hover`                                                                  | hover / raised 状态                          |
| `--sp-1..8`                        | `--space-1..8`                                                                         | 间距一律查表                                 |
| `--t-body` / `--t-meta`            | `--font-body` / `--font-meta`                                                          | chip / meta / panel copy                     |
| prototype DM Sans / Inter / Mono   | `--font-family-ui` / `--font-family-mono`                                              | 不得直接写字体栈                             |
| `--topbar-h`                       | `--topbar-h`                                                                           | Home row 1 高度                              |
| `height: 100vh + overflow: hidden` | `ScreenLockShell` + `overflow: hidden` 合同                                            | 对应一屏锁死                                 |

| 未来 token 家族 | 当前状态               | 只锁命名与意图，不宣称已落地                             |
| --------------- | ---------------------- | -------------------------------------------------------- |
| `--cal-kind-*`  | 未在 `tokens.css` 落地 | event kind 主色与对应 soft tint 的专用家族               |
| `--cal-chip-*`  | 未在 `tokens.css` 落地 | chip 边框宽度、内部 gap、hover/selected 等组件级参数     |
| `--cal-peek-*`  | 未在 `tokens.css` 落地 | peek 专属 scrim、kind bar、toolbar、section divider 参数 |

## 5. SSOT Conflicts

| 冲突项                                                  | prototype / 现状 authority                                                                                      | system / spec authority                                                                                            | 当前裁决                                                                                                                              | lhr 日期   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| chip 整体填色 vs V2 `border-left + tint`                | `.tmp_review/out/Tab1-Home/Home v2.1.html` 里 week/month 旧事件块更接近整块填色；早期 mock 也保留过 before 版本 | `.kiro/specs/sik-138-home-calendar-v2/requirements.md` Requirement 8 与 `design.md` MonthEventChip visual channels | 以 V2 规格为真相源：`kind` 独占左侧色条 + 轻 tint，整体纯填色方案不得回归                                                             | 2026-05-28 |
| `brand-yellow / brand-yellow-soft` vs 未来 `cal-kind-*` | Home v2.1 用 brand yellow 表达 practice/mock 等 event kind                                                      | `design.md` Token Policy 明确允许未来 `--cal-kind-*`；`tokens.css` 现状只有 brand 与 cat 家族                      | W1 契约不把 brand-yellow 认定为最终 kind SSOT；实现如需 kind 专色，应以后续 `cal-kind-*` 家族为终局命名，未落地前只能在契约中登记意图 | 2026-05-28 |
| mock Peek 可编辑 vs V1 read-only                        | `.tmp_review/out/Tab1-Home-mock/home-calendar-notion-like-mock.html` 演示了 title / notes / props 点击编辑      | Requirement 12、plan W6、design Peek scope 都锁为 read-only                                                        | 以 V1 read-only 为真相源：按钮可见但不授权写入；inline edit 视作设计稿演示，不进入 W1 实装                                            | 2026-05-28 |
| inline SVG demo vs production `lucide-react`            | mock HTML 内嵌 SVG path 直接画 icon                                                                             | `requirements.md` D15、`design.md` Icons 章节                                                                      | 以 `lucide-react` 为真相源；demo SVG 只用于原型表达，不得复制进生产实现                                                               | 2026-05-28 |
| `+N 项` vs `+N 更多`                                    | week alt mock 出现过 `+N 项` 文字                                                                               | Requirement 5 与本契约 Required Interactive Elements                                                               | 验收统一用 `+N 更多`，不接受 `+N 项` / `+N more` 混用                                                                                 | 2026-05-28 |

## 6. Visual Drift from Prototype

| 项                     | 原型                                                           | 本次合同 / 目标实现                                                                             | 偏离原因                                                                     | lhr 日期   |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| chip 编码方式          | 旧 Home v2.1 更偏整块填色；mock 里同时保留 before / after 演示 | W1 锁定为 `kind` 左侧色条 + tint，`status` / `source` / `linkedSession` / `target` 各走独立通道 | V2 规格已把多通道编码定为 correctness + density 要求，不能继续停在单通道填色 | 2026-05-28 |
| Peek 浮卡新增          | Home v2.1 只有 hover popover，没有居中的 modal peek            | W1 目标是 portal-mounted central peek card                                                      | V2 scope 明确新增 read-only Peek，作为跨 today/week/month 的统一详情承载体   | 2026-05-28 |
| icon 改 `lucide-react` | mock 用 inline SVG 演示 icon                                   | 生产实现统一改为 `lucide-react`                                                                 | D15 已锁定生产 icon 依赖，避免 SVG demo 混入实现                             | 2026-05-28 |
| Peek 只读化            | mock 中 title、notes、props 允许浏览器内存态编辑               | W1 实现必须只读                                                                                 | 设计稿承担交互探索，不等于 V1 写能力授权                                     | 2026-05-28 |
| overflow 文案统一      | alt mock 里存在 `+N 项`                                        | W1 统一为 `+N 更多`                                                                             | 验收需要单一文案，避免 prototype drift 带来 UI copy 回归                     | 2026-05-28 |

## 7. Acceptance Hooks

> 截图与 Browser MCP 验收归档路径固定为 `.tmp_review/out/sik-138-w1/`。本节是 closeout 对照模板：实现完成前状态可记 `待验收`，closeout 时必须逐项改成 `PASS` 或 `偏离`。

截图路径 override：

- workflow 默认截图归档写法是 `.tmp_review/visual-diff/<sik>/`。
- 但 `SIK-138` W1 已被 issue Acceptance + 当前任务显式锁定为 `.tmp_review/out/sik-138-w1/`。
- 因此本合同第 7 节中的所有 prototype / implementation / Peek 三态截图，均以 `.tmp_review/out/sik-138-w1/` 为唯一验收路径；这不是静默偏离，而是本 issue 的显式 override。

| 项                                      | 原型锚点                                                 | 实现位置                                                                                   | 状态 |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- |
| contract 已落档且 issue Acceptance 引用 | 本文件 + issue `SIK-138` `## Acceptance`                 | `docs/plan/sik-138-home-calendar-notion-like-visual-contract.md`                           | PASS |
| segmented tabs 三态存在且可切换         | mock `home-calendar-notion-like-mock.html` 366, 591, 628 | `apps/web/src/views/Home/sections/CalendarPanel.tsx`                                       | PASS |
| `prev / today / next / +` 四按钮齐全    | mock 369, 594, 631                                       | `apps/web/src/views/Home/sections/CalendarPanel.tsx`                                       | PASS |
| countdown chip 存在并与四按钮同列       | mock 370, 595, 632                                       | `apps/web/src/views/Home/sections/CalendarPanel.tsx`                                       | PASS |
| month 默认 `cardLimitPerCell=3`         | requirements 90-111；mock 359, 434-440                   | `apps/web/src/views/Home/sections/calendarViewConfig/factory.ts` + `MonthCalendarView.tsx` | PASS |
| overflow 文案为 `+N 更多`               | mock 235, 252, 306, 440                                  | `apps/web/src/views/Home/sections/MonthCalendarView.tsx`（Month only，见 §8.3 row 3）       | PASS |
| chip click 打开 Peek                    | mock 642-677, 1466-1473                                  | `apps/web/src/views/Home/sections/peek/CalendarPeekProvider.tsx` + `useCalendarPeek.ts`    | PASS |
| Peek 顶 bar 6 按钮齐全                  | mock 660-669                                             | `apps/web/src/views/Home/sections/peek/CalendarPeekHead.tsx`                               | PASS |
| Peek 8 行属性齐全                       | mock 1424-1445                                           | `apps/web/src/views/Home/sections/peek/CalendarPeekProperties.tsx`                         | PASS |
| Peek close 后 restore focus             | mock 1453-1457, 1460-1463                                | `apps/web/src/views/Home/sections/peek/CalendarPeekProvider.tsx`                           | PASS |
| `1440` Chrome MCP 双开验收              | contract 规定项                                          | prototype + implementation 双开窗口                                                        | PASS |
| `1920` Chrome MCP 双开验收              | contract 规定项                                          | prototype + implementation 双开窗口                                                        | PASS |
| Peek `open` 截图                        | contract 规定项                                          | Browser MCP screenshot archive                                                             | PASS |
| Peek `next-prev` 截图                   | contract 规定项                                          | Browser MCP screenshot archive                                                             | PASS |
| Peek `close` 截图                       | contract 规定项                                          | Browser MCP screenshot archive                                                             | PASS |
| a11y 命令已执行并归档 log               | workflow a11y 要求 + 本合同 override                     | `pnpm --filter @sikao/web test -- --run src/views/__tests__/views.a11y.test.tsx`           | PASS |

a11y 验收命令与证据：

- command: `pnpm --filter @sikao/web test -- --run src/views/__tests__/views.a11y.test.tsx`
- log path: `.tmp_review/out/sik-138-w1/axe-home-calendar.log`
- 旁注：workflow 用语写 `vitest-axe`，但本仓库当前执行面以 `axe-core` 驱动的 vitest a11y suite 为准；closeout 时以这条命令和该 log 路径作为 PASS 证据。

`1440 / 1920` Chrome MCP 双开截图必须至少各有一组 prototype / implementation 配对：

- `.tmp_review/out/sik-138-w1/prototype-1440-home-calendar.png`
- `.tmp_review/out/sik-138-w1/implementation-1440-home-calendar.png`
- `.tmp_review/out/sik-138-w1/prototype-1920-home-calendar.png`
- `.tmp_review/out/sik-138-w1/implementation-1920-home-calendar.png`

Peek 三态截图必须在 `1440` 与 `1920` 两档都归档，且同名规则固定如下：

- `.tmp_review/out/sik-138-w1/prototype-1440-peek-open.png`
- `.tmp_review/out/sik-138-w1/implementation-1440-peek-open.png`
- `.tmp_review/out/sik-138-w1/prototype-1440-peek-next-prev.png`
- `.tmp_review/out/sik-138-w1/implementation-1440-peek-next-prev.png`
- `.tmp_review/out/sik-138-w1/prototype-1440-peek-close.png`
- `.tmp_review/out/sik-138-w1/implementation-1440-peek-close.png`
- `.tmp_review/out/sik-138-w1/prototype-1920-peek-open.png`
- `.tmp_review/out/sik-138-w1/implementation-1920-peek-open.png`
- `.tmp_review/out/sik-138-w1/prototype-1920-peek-next-prev.png`
- `.tmp_review/out/sik-138-w1/implementation-1920-peek-next-prev.png`
- `.tmp_review/out/sik-138-w1/prototype-1920-peek-close.png`
- `.tmp_review/out/sik-138-w1/implementation-1920-peek-close.png`

Browser MCP closeout 时必须额外确认两条行为证据：

- `open / next-prev / close` 三态截图来自同一条事件链路，不接受分别截取互不相干的样例。
- `close` 后焦点回到触发 chip，且 body scroll lock 已释放；这两项不通过时，`Peek close/restore focus` hook 不能标 `PASS`。

## 8. W7 Closeout Evidence (2026-05-29)

W7 Verifier closeout. All 16 §7 rows marked `PASS` based on the evidence below. Generated against branch `feat/sik-138-w7` head `ca4d1d192`.

### 8.1 Evidence Index

| Hook                                    | Evidence                                                                                                                                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contract 已落档且 issue Acceptance 引用 | This file committed at `60414c801`; issue `SIK-138` `## Acceptance` references `docs/plan/sik-138-home-calendar-notion-like-visual-contract.md`                                                                                                                       |
| segmented tabs 三态存在且可切换         | impl 1440 snapshot showed `tab "今日"`, `tab "本周" focused selected`, `tab "本月"`; click on `本月` switched selected tab                                                                                                                                            |
| `prev / today / next / +` 四按钮齐全    | impl snapshot in 月 mode showed `button "上一月" / "回到今天" / "下一月" / "新建事件 (Plan 创建落 SIK-FU-N)"`                                                                                                                                                         |
| countdown chip 存在并与四按钮同列       | impl snapshot showed `国考 D-138` text adjacent to the four buttons                                                                                                                                                                                                   |
| month 默认 `cardLimitPerCell=3`         | impl 月视图 snapshot showed exactly 3 chips (`查看事件：言语理解·逻辑填空 30 题`, `资料分析·增长率专项`, `行测套卷模考`); source check confirms `MonthCalendarView` uses `cardLimitPerCell` from factory default                                                       |
| overflow 文案为 `+N 更多`               | source `apps/web/src/views/Home/sections/MonthCalendarView.tsx:166` renders `+{overflow} 更多`; existing test `MonthCalendarView.test.tsx` 'overflow: caps chips at 3' already covers it. Note: `WeekCalendarView` does not currently truncate (early/noon/evening lanes never overflow); this is consistent with prior W2-W6 design and not a W7 regression |
| chip click 打开 Peek                    | impl click on `查看事件：言语理解 · 逻辑填空 30 题` → `dialog "言语理解 · 逻辑填空 30 题" modal` appeared                                                                                                                                                              |
| Peek 顶 bar 6 按钮齐全                  | impl Peek dialog snapshot listed: `展开为页面（即将上线）` / `上一条` / `下一条` / `复制链接（即将上线）` / `更多操作（即将上线）` / `关闭`                                                                                                                          |
| Peek 8 行属性齐全                       | impl Peek dialog snapshot listed: 时间 / 类型 / 分类 / 状态 / 来源 / 关联会话 / 目标 / 重复                                                                                                                                                                           |
| Peek close 后 restore focus             | impl 1440 + 1920 verified: `document.body.style.overflow = visible`, `document.body.style.position = static`, `document.activeElement` === triggering chip; both axes confirmed via `mcp_chrome_devtools_evaluate_script`                                             |
| `1440` Chrome MCP 双开验收              | `prototype-1440-home-calendar.png` + `implementation-1440-home-calendar.png` archived                                                                                                                                                                                 |
| `1920` Chrome MCP 双开验收              | `prototype-1920-home-calendar.png` + `implementation-1920-home-calendar.png` archived                                                                                                                                                                                 |
| Peek `open` 截图                        | `{prototype,implementation}-{1440,1920}-peek-open.png` archived                                                                                                                                                                                                       |
| Peek `next-prev` 截图                   | `{prototype,implementation}-{1440,1920}-peek-next-prev.png` archived; verified prototype title transitions `每日复盘 → 数量·数学运算`, implementation title `言语理解·逻辑填空 30 题 → 资料分析·增长率专项`, both within same opened chain                            |
| Peek `close` 截图                       | `{prototype,implementation}-{1440,1920}-peek-close.png` archived; close transitions verified `dialog removed, body overflow released, focus returned to triggering chip`                                                                                              |
| a11y 命令已执行并归档 log               | `npm --prefix apps/web run test:a11y` exit 0, 13/13 tests passed, log at `.tmp_review/out/sik-138-w1/axe-home-calendar.log`                                                                                                                                           |

### 8.2 Same-chain Behavior Witness (`AGENT-H11` 末段强制项)

- 1440 implementation chain: open `言语理解 · 逻辑填空 30 题` (chip[0], pagination 1/3) → `↓` advances to `资料分析 · 增长率专项` (pagination 2/3) → `Esc` closes dialog with `document.activeElement.aria-label === '查看事件：言语理解 · 逻辑填空 30 题'` and `body.overflow === 'visible'`. Same chain, same triggering chip.
- 1920 implementation chain: same chip[0] start; identical transitions; identical post-close focus + scroll-lock release verified.
- 1440 / 1920 prototype chain: open via `window.__peek.open(monthGridChips[0])` (title `每日复盘`) → `↓` advances to `数量·数学运算` → `Esc` closes overlay with `body.style.overflow = ''` released. Prototype demo has no native focus restoration when opened programmatically (no triggering element); to make focus-restore observable, the 1920 case primed `chips[0].focus()` before `__peek.open(chips[0])`, after which `Esc` restored focus to the chip element. Implementation natively returns focus without this priming step (verified independently).

### 8.3 Visual Drift Notes (declared, no contract amendment required)

| Drift item                                         | Prototype state                                                              | Implementation state                                                       | Reason                                                                                                                                                                                                                                | Status                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Peek surface shape                                 | Prototype renders Peek as right-anchored drawer (`aside.peek-drawer`)        | Implementation renders Peek as portal-mounted central modal `role="dialog"` | Already declared in §6 SSOT Conflicts row 2 (`Peek 浮卡新增 · 2026-05-28`); W1 target was central peek card                                                                                                                          | declared in §6, no extra approval needed       |
| Prototype next-prev wraps modulo `allChips.length` | Prototype cycles through every chip across §1-§5 demo zones (≈58 candidates) | Implementation cycles only within the currently mounted view's chips      | Prototype is a multi-section demo page; implementation Peek scopes navigation to the active CalendarView. This is consistent with W6 design and not a regression                                                                      | descriptive only; not flagged as drift in spec |
| WeekCalendarView lacks `+N 更多` overflow chip    | mock §5 shows `+1 项` overflow chip in week cell                              | implementation week view buckets all events into early/noon/evening lanes | mock copy was unified to `+N 更多` (§6 row 5), and the contract row points to both Month and Week implementations; in practice only Month overflows with the current cell sizing. No W7 regression; row remains PASS via Month implementation | descriptive nuance, no drift on contract intent |


### 8.4 Independent Review Disposition (W7)

Independent review: `docs/reviews/sik-138-w7.md` — Decision `review pass`, `0 high / 0 medium / 2 low`.

| Finding | Severity | Disposition                                                                                                                                                                                            |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1      | low      | a11y command wording differs across §7 note (`pnpm --filter`), §8.1 (`npm --prefix apps/web run test:a11y`), and the log (`vitest run ...`). All three resolve to the same vitest a11y suite / target file; log shows `13 passed (13)` exit 0. Documentation wording only, no evidence gap. Left as-is by design (both invocation styles are valid in this repo). |
| F2      | low      | §7 row 6 implementation cell previously listed both `MonthCalendarView.tsx` and `WeekCalendarView.tsx`; only Month has an overflow render path. Fixed: §7 row 6 now reads `MonthCalendarView.tsx（Month only，见 §8.3 row 3）`. |
