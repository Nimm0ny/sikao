# 02 · Token System（V5 三层 token + 多端断点 + Rail 折叠）

> **Status**: LOCKED
> **Phase 父目录**：[../README.md](../README.md)
> **来源**：`design.md` §A.1 / §A.2 / §C.1–C.6
> **实施 SSOT**：[`packages/design-system/src/tokens.css`](../../../../../packages/design-system/src/tokens.css)（Phase 1 落地）
> **设计镜像**：[`docs/vault/04-design/Design-System.md`](../../../04-design/Design-System.md)（Phase 8 同步）
> **Last Updated**: 2026-05-24

> **2026-05-24 UPDATE — V5-M0.5 big-bang rebuild**：§7（V4 → V5 Token Mapping）整章 ARCHIVED；§7.6（Deprecate 时间线）ARCHIVED。tokens.css §8 V4 alias 区块在 V5-M0.5 commit ② 一并删除。其他 §1–§6 / §8 / §9 不变。详见 [00-Decisions.md §0](./00-Decisions.md)。

---

## 1. 三层架构

```
┌─ Primitive (无语义、可计算的最底层取值) ────────────────────────┐
│  --color-yellow-500 / --space-4 / --radius-16 / --font-13      │
└────────────────┬───────────────────────────────────────────────┘
                 │ reference
┌─ Semantic (带语义、light/dark 在此层覆写) ──────────────────────┐
│  --color-bg-page / --color-text-primary / --color-brand-primary│
└────────────────┬───────────────────────────────────────────────┘
                 │ reference
┌─ Component (组件契约、不被主题覆写、稳定不变) ───────────────────┐
│  --card-radius / --card-padding / --btn-h-md / --row-h-md      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 硬规则

- 业务代码**只**能引用 component 层；component 不存在的视觉字段才退到 semantic；**primitive 仅供 token 文件内部组合，不对外暴露**。
- light/dark 切换**只**改 semantic 层；primitive 与 component 层在两个主题下数值完全一致（CP.2 不变性）。
- 所有 hardcoded 视觉常量（hex / rgba / px-as-color / box-shadow 字面量 / z-index 数字 / hardcoded `border-radius` / `padding`-`margin`-`gap` 上的硬编码 px / rem）**禁止**出现在 `apps/**/src/**`（CP.1 不变性，5 个 lint 闸门联合校验：hardcode / radius-token / shadow-token / zindex-token / spacing-token）。

### 1.2 文件分区（Phase 1 落地结构）

```css
/* packages/design-system/src/tokens.css */

/* §1 primitive */
:root {
  /* color scales */     --color-yellow-50..900, --color-neutral-* ...
  /* spacing scale */    --space-1..8 (mobile 紧凑覆写在 @media)
  /* radius scale */     --radius-10/12/14/16/22/999
  /* font sizes */       --font-10..40
  /* font weights */     --font-weight-regular/medium/semibold/bold
  /* shadows */          --shadow-l1/l2/l3/l4
  /* easings */          --ease-out / --ease-emphasized
  /* durations */        --dur-fast/base/slow
}

/* §2 semantic - light (default) */
:root { --color-bg-page / --color-text-primary / ... }

/* §3 semantic - dark */
.dark, [data-theme="dark"] { --color-bg-page: ...; ... }

/* §4 component */
:root { --card-radius / --card-padding / --btn-h-md / --exam-* / ... }

/* §5 breakpoints + max-width 限宽 */
/* §6 mobile-only tokens + safe-area */
/* §7 rail collapse 状态变量 */
/* §8 V4 alias 双轨期（@deprecated 2026-05-23 — 失效 2026-06-06）*/
```


---

## 2. Primitive 层

### 2.1 颜色 scale（每 scale 50/100/.../900 共 10 档）

| Scale | 锚点 500 | 用途 |
|---|---|---|
| `--color-neutral-*` | `#ADB5BD` | 中性灰阶（文字 / 边框 / 背景） |
| `--color-yellow-*` | `#FFD200` | brand-yellow，对应 V4 `--brand-yellow` |
| `--color-blue-*` | `#2B6CFF` | info / focus-ring |
| `--color-green-*` | `#1F7A4D` | ok |
| `--color-amber-*` | `#B45309` | warn |
| `--color-red-*` | `#DC2626` | err |

**说明**：每个 scale 的 500 为视觉锚点，对应 V4 `--brand-yellow` / `--info` / `--ok` / `--warn` / `--err`；50 用于软底色（替代 V4 `*-50`）；600 用于 hover；900 用于深色文字。完整 10 档值表见 [`design.md` §C.1.1](../../../../../.kiro/specs/frontend-style-guide-v5/design.md)。

### 2.2 间距 scale（8 档 + mobile 紧凑覆写）

| Token | Web 默认 | Mobile 紧凑（≤768px）|
|---|---|---|
| `--space-1` | 4 | 2 |
| `--space-2` | 8 | 6 |
| `--space-3` | 12 | 10 |
| `--space-4` | 16 | 12 |
| `--space-5` | 24 | 18 |
| `--space-6` | 32 | 24 |
| `--space-7` | 48 | 36 |
| `--space-8` | 64 | 48 |

紧凑档生效条件：`@media (max-width: 768px)` 下覆盖；token 名不变。

### 2.3 圆角 scale（5 档，R1/Q1 决策）

| Token | 值 | 用途 |
|---|---|---|
| `--radius-10` | 10px | 按钮 / input / chip |
| `--radius-12` | 12px | 微卡 / list-item / card-sm |
| `--radius-16` | 16px | 标准卡片（V4 18px → 16，R1/Q1） |
| `--radius-22` | 22px | Sheet / 大型容器 / floating shell |
| `--radius-999` | 9999px | pill / 全圆角导航 / 头像 |

### 2.4 字号 scale（Web / Mobile 双档）

| Token | Web | Mobile | 行高 | 用途 |
|---|---|---|---|---|
| `--font-display` | 40 | 34 | 1.2 | 大型展示数字 |
| `--font-h1` | 32 | 28 | 1.3 | 页面主标题 |
| `--font-h2` | 24 | 20 | 1.35 | 模块大标题 |
| `--font-h3` | 18 | 16 | 1.4 | 模块标题 / SemiBold |
| `--font-card` | 16 | 14 | 1.5 | 卡片标题 |
| `--font-body` | 13 | 13 | 1.55 | 正文 |
| `--font-meta` | 12 | 11 | 1.4 | 时间 / 辅助 |
| `--font-tiny` | 11 | 10 | 1.4 | badge / 极小标签 |

### 2.5 字重（4 档）

`--font-weight-regular` 400 / `--font-weight-medium` 500 / `--font-weight-semibold` 600 / `--font-weight-bold` 700

### 2.6 阴影 scale（4 档 + light/dark 双值）

| Token | Light | Dark |
|---|---|---|
| `--shadow-l1` | `0 1px 2px rgba(26,29,32,.04), 0 1px 0 rgba(26,29,32,.02) inset` | `0 1px 0 rgba(255,255,255,.04) inset, 0 1px 2px rgba(0,0,0,.4)` |
| `--shadow-l2` | `0 1px 2px rgba(26,29,32,.04), 0 8px 24px -12px rgba(26,29,32,.10)` | `0 1px 0 rgba(255,255,255,.04) inset, 0 12px 28px rgba(0,0,0,.4)` |
| `--shadow-l3` | `0 12px 32px -12px rgba(26,29,32,.18)` | `0 16px 40px rgba(0,0,0,.5)` |
| `--shadow-l4` | `0 24px 48px -16px rgba(26,29,32,.25)` | `0 24px 56px rgba(0,0,0,.6)` |

### 2.7 动效（缓动 + 时长）

| Token | 值 | 用途 |
|---|---|---|
| `--ease-out` | `cubic-bezier(.16, 1, .3, 1)` | 默认进入 / 退出 |
| `--ease-emphasized` | `cubic-bezier(.2, .8, .2, 1)` | 强调动作 |
| `--dur-fast` | 120ms | hover / press |
| `--dur-base` | 200ms | 主要过渡 |
| `--dur-slow` | 360ms | Sheet / Modal |

`prefers-reduced-motion: reduce` 生效时三档时长自动归零或 ≤ 200ms 内的 fade，禁止位移 / 弹性。


---

## 3. Semantic 层（light 默认 + dark 覆写）

### 3.1 表面 surface（paper / bg）

| Semantic | Light | Dark | 用途 |
|---|---|---|---|
| `--color-bg-page` | `#F4F5F7` | `#0E0F11` | 全局页面背景 |
| `--color-bg-app` | `#ECEEF1` | `#16181B` | App 容器底色 |
| `--color-bg-surface` | `#FFFFFF` | `#1C1F23` | 卡片底色（paper-1） |
| `--color-bg-elevated` | `#F8F9FA` | `#22262B` | 嵌套子卡（paper-2） |
| `--color-bg-sunken` | `#EEF0F3` | `#2A2F35` | 输入框 / 凹陷区域（paper-3） |
| `--color-bg-overlay` | `rgba(26,29,32,.42)` | `rgba(0,0,0,.6)` | Modal / Sheet 后景遮罩 |

### 3.2 文字 ink

| Semantic | Light | Dark | 对比度 (on bg-surface) |
|---|---|---|---|
| `--color-text-primary` | `#1A1D20` | `#F2F4F7` | 16.6 / 14.8（AAA） |
| `--color-text-secondary` | `#495057` | `#C8CDD4` | 9.1 / 9.5（AAA） |
| `--color-text-meta` | `#6B7280` | `#8C949E` | 4.7 / 4.6（AA） |
| `--color-text-meta-soft` | `#868E96` | `#6F7780` | 3.3（**仅装饰、不承载关键信息**，REQ-10.2） |
| `--color-text-disabled` | `#ADB5BD` | `#545B63` | non-reading |
| `--color-text-on-brand` | `#1A1D20` | `#1A1D20` | 黄底强制黑字 |

### 3.3 边框 border（3 档）

| Semantic | Light | Dark |
|---|---|---|
| `--color-border-subtle` | `#E9ECEF` | `rgba(255,255,255,.06)` |
| `--color-border-default` | `#DEE2E6` | `rgba(255,255,255,.10)` |
| `--color-border-strong` | `#CED4DA` | `rgba(255,255,255,.16)` |

### 3.4 品牌 / 状态 / 焦点

| Semantic | Light | Dark | Soft 变体（badge/tag 用） |
|---|---|---|---|
| `--color-brand-primary` | `#FFD200` | `#FFEB38` | `--color-brand-soft`：`#FFF4B3` / `rgba(255,235,56,.16)` |
| `--color-brand-hover` | `#E6BD00` | `#FFD200` | — |
| `--color-state-ok` | `#1F7A4D` | `#4CC38A` | `#E8F4EE` / `rgba(76,195,138,.14)` |
| `--color-state-warn` | `#B45309` | `#E0A23B` | `#FDF2DA` / `rgba(224,162,59,.14)` |
| `--color-state-err` | `#DC2626` | `#F36F77` | `#FCE8E8` / `rgba(243,111,119,.14)` |
| `--color-state-info` | `#2B6CFF` | `#7BA8FF` | `#E5EEFF` / `rgba(123,168,255,.14)` |
| `--color-focus-ring` | `#2B6CFF` | `#7BA8FF` | — |

### 3.5 题型分类色（categorical, REQ-2.5）

| Semantic | Light | Dark | 用途 |
|---|---|---|---|
| `--color-cat-yanyu` | `#7373FF` | `#9999FF` | 行测·言语理解 |
| `--color-cat-shuliang` | `#FF8573` | `#FF9F8F` | 行测·数量关系 |
| `--color-cat-panduan` | `#FFDD55` | `#FFE680` | 行测·判断推理（与 brand 区分：偏暖橙黄） |
| `--color-cat-ziliao` | `#2F95FF` | `#5FB0FF` | 行测·资料分析 |
| `--color-cat-shenlun` | `#15803D` | `#4CC38A` | 申论 |

**铁律**：分类色**只**用于"题型 / 标签"分类，禁止与 ok/warn/err/info 互换。命名采用业务拼音（避免 cat-1/2/3 这种无意义编号——sikao 业务面只有 5 个题型，不会再扩充）。

---

## 4. Component 层（组件契约）

### 4.1 卡片 card

| Token | 值 | 备注 |
|---|---|---|
| `--card-radius` | `var(--radius-16)` | 标准卡片 |
| `--card-radius-sm` | `var(--radius-12)` | 高密度列表项 / 微卡 |
| `--card-radius-lg` | `var(--radius-22)` | Sheet / 大型容器 |
| `--card-padding` | `var(--space-4)` | 标准内边距 16/12 |
| `--card-padding-sm` | `var(--space-3)` | 紧凑内边距 12/10 |
| `--card-bg` | `var(--color-bg-surface)` | paper-1 |
| `--card-bg-elevated` | `var(--color-bg-elevated)` | paper-2，嵌套外层 |
| `--card-border` | `1px solid var(--color-border-subtle)` | 默认描边 |
| `--card-shadow-rest` | `var(--shadow-l1)` | 默认 |
| `--card-shadow-hover` | `var(--shadow-l2)` | hover/focus |
| `--card-title-h` | 28px | 标题区高度 |
| `--card-body-min-h` | 48px | 正文区最小高度（防空塌） |
| `--card-action-divider` | `1px solid var(--color-border-subtle)` | 操作区分隔线 |

### 4.2 按钮 button（4 档高度，与 row-h 严格分离）

| Token | sm | md（默认） | lg | xl |
|---|---|---|---|---|
| `--btn-h-*` | 32 | 36 | 40 | 48 |
| `--btn-padding-x-*` | space-3 | space-4 | space-4 | space-5 |
| `--btn-font-*` | font-meta | font-body | font-card | font-card |
| `--btn-icon-size-*` | 14 | 16 | 18 | 22 |
| `--btn-radius-*` | radius-10 | radius-10 | radius-12 | radius-12 |
| `--btn-gap-*` | space-2 | space-2 | space-2 | space-3 |

icon-only 按钮：宽 = 高，padding-x 与 padding-y 等值；必须带 `aria-label`（lint：`lint-icon-button.mjs`）。

### 4.3 输入 input

| Token | 值 |
|---|---|
| `--input-h-md` | 36 |
| `--input-radius` | `var(--radius-10)` |
| `--input-padding-x` | `var(--space-3)` |
| `--input-bg` | `var(--color-bg-sunken)` |
| `--input-border` | `1px solid var(--color-border-default)` |
| `--input-border-focus` | `1px solid var(--color-focus-ring)` |
| `--input-ring-focus` | `0 0 0 3px rgba(43,108,255,.16)` |

### 4.4 行高度 row（list / tab）

| Token | 值 | 用途 |
|---|---|---|
| `--row-h-sm` | 40 | 紧凑列表（Question Hub / Review） |
| `--row-h-md` | 52 | 标准列表（Note 列表 / 设置项） |
| `--row-h-lg` | 64 | 大型卡内行（Home 任务模块） |

`--btn-h-*` 与 `--row-h-*` 严格分离，**不互用**（修复 V4 `--h-xs..lg` 与 `--row-h` 混用问题）。

### 4.5 导航 / 顶栏 / 侧栏

| Token | 值 |
|---|---|
| `--topbar-h` | 56（mobile 48） |
| `--bottom-nav-h` | 64 |
| `--bottom-nav-radius` | `var(--radius-999)`（pill） |
| `--rail-w` | 由 `--rail-w-expanded`(240) / `--rail-w-collapsed`(80) 切换（详见 §6） |

### 4.6 z-index（每层间距 ≥ 10，预留插队）

| Token | 值 | 层 |
|---|---|---|
| `--z-rail` | 20 | 侧栏 |
| `--z-topbar` | 30 | 顶栏 |
| `--z-popover` | 40 | popover / dropdown |
| `--z-modal` | 60 | modal / sheet |
| `--z-toast` | 80 | toast |

### 4.7 Exam 容器钩子（R1/Q5 决策）

V5 **只**提供 3 个 exam token，不实现 layout / resize / 计时器逻辑：

| Token | 值 |
|---|---|
| `--exam-pane-padding` | `var(--space-4)` |
| `--exam-divider-handle-w` | 4px |
| `--exam-topbar-h` | `var(--topbar-h)` |


---

## 5. 多端断点与限宽（多分辨率覆盖）

### 5.1 断点 token（7 档）

V5 主战场是**桌面 1920×1080**，但同时 cover 手机、平板、小笔记本、4K 大屏。断点必须分档，不能两极切换。

| Token | min-width | 主战场 | Rail | Workspace 行为 |
|---|---|---|---|---|
| `--bp-xs` | 0 | 手机竖屏 | 隐藏，用底导 | 单列、紧凑档 |
| `--bp-sm` | 480 | 大屏手机 / 折叠屏 | 隐藏 | 单列 |
| `--bp-md` | 768 | iPad 竖屏 | 隐藏，用顶部 burger 抽屉 | 双列允许，紧凑档 |
| `--bp-lg` | 1024 | iPad 横屏 / 13" 笔记本 | 折叠 80px | 进入舒适档 |
| `--bp-xl` | 1280 | 桌面默认 | 完整 240px | 标准 |
| `--bp-2xl` | 1536 | 1920 主战场（实际 1440 限宽） | 完整 240 | 标准 |
| `--bp-3xl` | 1920 | 超大屏 / 4K | 完整 240 + 大屏限宽生效 | `max-width: 1440px` 居中 |

实施方式：`tokens.css` 内用预编译数值进 media query（不依赖 `var()` 在 media query 内）。

### 5.2 大屏限宽（R2/Q5 决策）

| Token | 值 | 用途 |
|---|---|---|
| `--max-w-workspace` | **1440** | 主 workspace 内容上限，1920+ 屏自动居中 |
| `--max-w-reading` | 720 | 题目阅读 / 长文正文列宽（line-length ≤ 75 字） |
| `--max-w-form` | 560 | 设置 / 注册 / 表单单列限宽 |
| `--max-w-modal` | 640 | Modal 默认上限（超过时用 Drawer 替代） |
| `--max-w-prose` | 800 | 富文本笔记编辑 / 申论作答区 |

**强制规则**：

- 任何 `<Workspace>` 在 `--bp-3xl` 必须居中 + `max-width: var(--max-w-workspace)`
- 任何"长文阅读 / 正文连续段落"容器必须限到 `--max-w-reading`，不接受全宽
- 任何"表单输入序列"必须限到 `--max-w-form`

**1920 屏行为**：`ws = min(1920 - rail-w, 1440)`。展开态左右各 120 留白；折叠态左右各 200 留白。**workspace 内容尺寸不变**——折叠在主战场是纯沉浸开关。

### 5.3 移动端 mobile-only token

```css
:root {
  --mobile-topbar-h:    48px;
  --mobile-bottom-nav-h: 64px;
  --mobile-rail-drawer-w: 280px;     /* 从左侧滑出的菜单 */
  --touch-target-min:   40px;        /* REQ-10.1 命中区 */
  --sheet-handle-w:     32px;        /* Sheet 顶部下拉手柄 */
  --sheet-handle-h:     4px;
}
```

### 5.4 Safe area（移动端必需）

iPhone 刘海 / Home Indicator / Android 导航栏会撞 UI。强制 token 化：

```css
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}
```

**强制规则**：

- TopBar / BottomNav / Sheet / Modal **必须**用 `padding-inline: var(--safe-left) var(--safe-right)`
- 全屏 Modal `padding-block: var(--safe-top) var(--safe-bottom)`
- 业务组件不得 hardcode `padding-top: 44px` 类似的 iOS 状态栏值

---

## 6. Rail 折叠规则（多分辨率行为统一）

V5 把 Rail 折叠定为**确定性的 UI 状态**，不允许各页面自己重新设计。

### 6.1 折叠状态决策

| 视口 | Rail 默认 | 用户可手动切换 |
|---|---|---|
| `< 768` 移动 | 不存在（用底部 Tab Bar） | — |
| `768–1023` 平板 | 不存在（用顶部 Burger Drawer） | — |
| `1024–1279` 小桌面 | 默认折叠（80px） | ✓ |
| `≥ 1280` 标准桌面 + 1920 主战场 | 默认展开（240px） | ✓ |

### 6.2 触发方式（多入口冗余）

1. **展开态**：右上角 Toggle 按钮 (`IconRailToggle`)，点击折叠
2. **折叠态**：整个 brand 区域作为可点击元素，点击展开（不再显示 Toggle 按钮）
3. **快捷键**：`Ctrl/Cmd + \` 全场景可用，不受焦点位置影响

### 6.3 折叠态视觉规则（必须遵守）

- Logo (`mark` 28×28) **居中对齐**到 nav-btn 图标的垂直中线（X 坐标一致）；不允许 Logo 偏左 + Toggle 偏右的"两元素水平"布局
- Toggle 按钮**完全隐藏**（`display: none`），不挪到底部
- brand 区域 hover 时背景变 `--color-bg-elevated`，光标 `cursor: pointer`
- 右侧 Tooltip 浮出"展开侧栏 (Ctrl+\\)"，延迟 400ms（比普通 Tooltip 600ms 短，因为这是必需引导而非辅助提示）

### 6.4 列数稳定规则（走法 X）

- workspace 内组件的列数**按"展开态 ws 宽度"计算**，折叠不触发列数变化
- 折叠后效果是"卡片变宽 / 留白增大"，不是"列数重排"
- 例外：`<Exam>` 模式不属于 SaaS Shell（Exam 是独立 layout，无 Rail），不受此规则约束

### 6.5 持久化规则

- 状态写 `localStorage['v5-rail-collapsed']: 'true' | 'false'`，全局生效，不按路由记忆
- 用户偏好覆盖断点默认值——例如用户在 1280 屏手动展开后，下次访问 1280 屏仍是展开态
- 跨设备同步标为可选增强，由后端账号系统承担，**不卡 V5**

### 6.6 工程实现要点

- `--rail-w` 由 `--rail-w-expanded`(240) / `--rail-w-collapsed`(80) 通过 `:root[data-rail="collapsed"]` 切换
- `.rail { width: var(--rail-w); transition: width .25s var(--ease-out) }`
- workspace 用 `flex: 1 + max-width: var(--max-w-workspace)`，宽度变化由 transition 自然过渡
- `prefers-reduced-motion` 下 transition 缩短为 0ms，但**不禁用折叠功能**

### 6.7 Tablet 中间档（768–1279px）

V4 硬伤：`@media (max-width: 1180px)` 一刀切到 80px Rail，没考虑 iPad 横屏。V5 按断点分三段：

| 视口 | Rail | Practice 网格 | Calendar | 触屏适配 |
|---|---|---|---|---|
| `< 768` | 隐藏 | 1 列纵向 | 隐藏，用 day-list | 全触屏档 |
| `768–1023` | 隐藏（顶部 burger 抽屉） | 2 列 | day view | 触屏档 |
| `1024–1279` | 折叠 80px（仅图标） | 3 列 | week 简化（5 天） | 触屏 + 鼠标双适配 |
| `≥ 1280` | 完整 240px | 4 列 | 完整 week | 鼠标档 |


---

## 7. ~~V4 → V5 Token Mapping（双轨期完整去向）~~ — **ARCHIVED 2026-05-24（V5-M0.5 big-bang）**

> **整章作废**：lhr 2026-05-24 拍板 big-bang 重建，apps/web 业务层与 packages/ui 整包删除；`packages/design-system/src/tokens.css` §8 V4 alias 区块同步删除；**没有 V4 token 名残留需要逐条 mapping**。
>
> REQ-1.6 字面"所有 V4 token 必须有 V5 去向"达成方式改为：V4 token 名在 V5 SSOT 全部消失。
>
> 替代规则：V5 SSOT（§1–§6）就是 V5 token 命名的全部内容，业务 Phase 直接按这些命名实现。
>
> 历史 mapping 表内容保留作参考（详见 [`design.md` §C.6](../../../../../.kiro/specs/frontend-style-guide-v5/design.md)，已标 ARCHIVED）。

### 7.1 ~~颜色 / 表面 / 文字（rename 主导）~~ — ARCHIVED

| V4 token | V5 去向 | 处置 | 备注 |
|---|---|---|---|
| `--page-bg` | `--color-bg-page` | rename | 语义化 |
| `--app-bg` | `--color-bg-app` | rename | — |
| `--paper-1` | `--color-bg-surface` | rename | — |
| `--paper-2` | `--color-bg-elevated` | rename | — |
| `--paper-3` | `--color-bg-sunken` | rename | — |
| `--ink-1` | `--color-text-primary` | rename | — |
| `--ink-2` | `--color-text-secondary` | rename | — |
| `--ink-3` | `--color-text-meta` | rename | — |
| `--ink-3-soft` | `--color-text-meta-soft` | rename | 加强警示：仅装饰 |
| `--ink-4` | `--color-text-disabled` | rename | — |
| `--line-1/2/3` | `--color-border-subtle/default/strong` | rename | — |

### 7.2 品牌 / 状态（rename + split）

| V4 token | V5 去向 | 处置 | 备注 |
|---|---|---|---|
| `--brand-1` | `--color-text-primary` 或 `--color-brand-primary`（视上下文） | **split** | V4 把 dark CTA 也叫 brand-1 容易混 |
| `--brand-yellow` | `--color-brand-primary` | rename | 主色不变（INV-2） |
| `--brand-yellow-hover` | `--color-brand-hover` | rename | — |
| `--brand-yellow-soft` | `--color-brand-soft` | rename | — |
| `--ok / --ok-50` | `--color-state-ok / --color-state-ok-soft` | rename | — |
| `--warn / --warn-50` | `--color-state-warn / --color-state-warn-soft` | rename | — |
| `--err / --err-50` | `--color-state-err / --color-state-err-soft` | rename | — |
| `--info / --info-50` | `--color-state-info / --color-state-info-soft` | rename | — |
| `--focus-ring` | `--color-focus-ring` | rename | — |

### 7.3 阴影 / 间距 / 行高（rename + split）

| V4 token | V5 去向 | 处置 | 备注 |
|---|---|---|---|
| `--shadow-1` | `--shadow-l1` | rename | — |
| `--shadow-2` | `--shadow-l2` | rename | — |
| `--shadow-pop` | `--shadow-l3` | rename | 增加 `--shadow-l4` |
| `--sp-1..8` | `--space-1..8` | rename | mobile 紧凑覆写改为媒体查询自动切换 |
| `--row-h` | `--row-h-md` | **split** | 拆为 sm/md/lg |
| `--topbar-h` | `--topbar-h` | keep | 值不变 |
| `--rail-w` | `--rail-w` | keep | 值不变（但内部由折叠状态切换） |

### 7.4 圆角 / 字号 / 高度（split + rename，最多变化）

| V4 token | V5 去向 | 处置 | 备注 |
|---|---|---|---|
| `--r-tiny` | `--radius-10` (primitive) + `--btn-radius-*` (component) | **split** | 拆分 primitive 与 component |
| `--r-card-sm` | `--radius-12` + `--card-radius-sm` | **split** | 同上 |
| `--r-card` | `--radius-16` + `--card-radius` | **split** | 18→16（R1/Q1） |
| `--r-app` | `--card-radius-lg` (`--radius-22`) | split | 不再单独 r-app |
| `--r-pill` | `--radius-999` | rename | — |
| `--t-display` | `--font-display` | rename | — |
| `--t-h1/h2/h3` | `--font-h1/h2/h3` | rename | — |
| `--t-card` | `--font-card` | rename | — |
| `--t-body/meta/tiny` | `--font-body/meta/tiny` | rename | — |
| `--h-xs/sm/md/lg` | `--btn-h-sm/md/lg/xl` | **split + rename** | 高度档命名收敛；与 row-h 严格分离 |
| `--icon-xs..xl` | `--icon-12/14/16/18/22` | rename | 换成尺寸值命名，更直观 |

### 7.5 动效 / z-index（keep 主导）

| V4 token | V5 去向 | 处置 | 备注 |
|---|---|---|---|
| `--ease-out / --ease-emphasized` | 同名 | keep | — |
| `--dur-fast/base/slow` | 同名 | keep | — |
| `--z-rail/topbar/popover/modal/toast` | 同名 | keep | 值微调（Modal 50→60，预留插队） |

### 7.6 ~~Deprecate 时间线~~ — ARCHIVED 2026-05-24

> **作废**：big-bang 后无 V4 alias 需要 sunset。tokens.css §8 V4 alias 区块在 V5-M0.5 commit ② 一并删除；`lint-v4-token-residual.mjs` 改为 regression guard（详见 [tasks.md task 8](../../../../../.kiro/specs/frontend-style-guide-v5/tasks.md)）。

---

## 8. SVG 图标尺寸 token

| Token | 值 | 用途 |
|---|---|---|
| `--icon-12` | 12 | meta-text 内联 / 时间前缀 |
| `--icon-14` | 14 | rail-cmd / chip 内嵌 |
| `--icon-16` | 16 | **默认**：按钮 / icon-btn / Rail nav |
| `--icon-18` | 18 | h3 标题前缀 / 卡片头部 |
| `--icon-22` | 22 | 大型 metric icon-slot / 空状态收口 |

**铁律**：禁止图标使用非 token 尺寸（如 `width: 17px`）；Tailwind `w-4 h-4 / w-5 h-5` 必须映射到 token。完整 SVG 风格规范（viewBox / stroke-width / fill / linecap）见 [03-Components.md §SVG](./03-Components.md)。

---

## 9. 关联文档

- [`design.md` §A.1–A.3 / §C.1–C.6`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md) — 三层 token + 完整 mapping 原文
- [`packages/design-system/src/tokens.css`](../../../../../packages/design-system/src/tokens.css) — Phase 1 落地 SSOT
- [00-Decisions.md](./00-Decisions.md) — R1/Q1（圆角）/ R2/Q5（max-width）落地处
- [03-Components.md](./03-Components.md) — Component token 消费方
- [10-Migration.md](./10-Migration.md) — V4 token sunset 流程
