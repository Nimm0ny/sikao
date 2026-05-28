# Design Document

> **2026-05-24 UPDATE — V5-M0.5 Big-Bang Rebuild**
>
> lhr 拍板 big-bang 重建。受影响章节：
> - **§C.6 V4 → V5 Token Mapping** — 整段 ARCHIVED（apps/web 业务层与 packages/ui 整包删除，无 V4 token 名残留需要 mapping）
> - 主线 2 "V4 → V5 token mapping" — ARCHIVED；REQ-1.6 改为"V4 token 名在 SSOT 全部消失即为达成"
> - 其他 6 条主线（三层 token / 5 类卡片 / 35 组件 / 页面容器树 / a11y i18n / Lint traceability）全部不变
> - §A / §B / §C.1..C.5 / §D / §E / §F / §T 全部不变
>
> 详见 [11-Implementation-Plan.md](../../../docs/vault/05-migration/Phase/Style-Guide-V5/11-Implementation-Plan.md) §V5-M0.5 章节。

## Overview

本设计文档把 `requirements.md` 中 12 个 REQ 块的"应该是什么"转化为 V5 规范"具体是什么"。设计阶段的产出严格落在以下 7 条主线，并与 user 已拍板的 6 项决策（见 requirements §7 Resolved Decisions）一致：

1. **三层 token 体系的完整值表**：primitive / semantic / component 三层，含 light/dark 双值（覆盖 REQ-1 / REQ-2 / REQ-3 / REQ-4 / REQ-5 / REQ-6）。
2. ~~**V4 → V5 token mapping**：逐条标注 keep / rename / split / deprecate（覆盖 REQ-1.6 / REQ-12.1）。~~ — **ARCHIVED 2026-05-24**（big-bang，无 V4 残留）
3. **卡片与容器规范**：5 类卡片 × 9 状态的视觉契约（覆盖 REQ-7）。
4. **组件状态机 + Prop API 草案**：button / input / tab / list-item / sheet / modal / toast / chip / segmented / numeric 等（覆盖 REQ-8）。
5. **页面级容器树**：Home / Practice / Note / Me / Question Hub / Review / Exam（占位）（覆盖 REQ-9）。
6. **可访问性、动效、i18n 落地表**：每条 REQ-10 的检查方式都有具体 selector / API 期望。
7. **Lint traceability 矩阵 + V5 自检报告模板**（覆盖 REQ-11 / REQ-12）。

视觉示例：所有卡片状态、组件状态机、页面容器示意将单独输出为 `.tmp_review/v5-design-preview.html`，本文件是规范主文，浏览预览为辅。

## Architecture

### A.1 三层 Token 架构

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

**硬规则**：
- 业务代码只能引用 component 层；component 不存在的视觉字段才退到 semantic；primitive 仅供 token 文件内部组合，**不对外暴露**。
- light/dark 切换**只**改 semantic 层；primitive 与 component 层在两个主题下数值完全一致。
- 所有 hardcoded 视觉常量（hex / rgba / px-as-color / box-shadow 字面量 / z-index 数字）禁止出现在 `apps/**/src/**`（lint 闸门：`lint-hardcode.mjs` / `lint-radius-token.mjs` / `lint-shadow-token.mjs`<sup>新</sup>）。

### A.2 Token 文件组织

`packages/design-system/src/tokens.css` 单源，按以下分区：

```css
/* 1. primitive */
:root {
  /* color scales */     --color-yellow-50..900
  /* spacing scale */    --space-1..8 + --space-mobile-1..8
  /* radius scale */     --radius-10/12/14/16/22/999
  /* font sizes */       --font-10..40
  /* font weights */     --font-weight-regular/medium/semibold/bold
  /* shadows */          --shadow-l1/l2/l3/l4
  /* easings */          --ease-out / --ease-emphasized
  /* durations */        --dur-fast/base/slow
}

/* 2. semantic - light (default) */
:root { --color-bg-page / --color-text-primary / ... }

/* 3. semantic - dark */
.dark, [data-theme="dark"] { --color-bg-page: ...; ... }

/* 4. component */
:root { --card-radius / --card-padding / --btn-h-md / ... }
```

### A.3 V5 文件交付清单

| 文件 | 类型 | 用途 |
|---|---|---|
| `.kiro/specs/frontend-style-guide-v5/requirements.md` | spec | EARS 需求 + 已拍板决策（已存在） |
| `.kiro/specs/frontend-style-guide-v5/design.md` | spec | 本文件，规范主文 |
| `.kiro/specs/frontend-style-guide-v5/tasks.md` | spec | 实施任务（下一阶段产出） |
| `.tmp_review/v5-design-preview.html` | review aid | 视觉示例与状态机预览，本地浏览器打开 |
| `packages/design-system/src/tokens.css` | SSOT | tasks 阶段按本文档落地 |
| `docs/vault/04-design/Design-System.md` | SSOT 镜像 | tasks 阶段同步更新 |
| `docs/engineering/fail-fast-exceptions.md` | 例外账本 | tasks 阶段登记玻璃拟态 fallback |

## Components and Interfaces

### C.1 Primitive Tokens（不带语义）

#### C.1.1 颜色 scale

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| `--color-neutral-*` | `#F8F9FA` | `#F1F3F5` | `#E9ECEF` | `#DEE2E6` | `#CED4DA` | `#ADB5BD` | `#868E96` | `#495057` | `#343A40` | `#1A1D20` |
| `--color-yellow-*` | `#FFF8CC` | `#FFF4B3` | `#FFEB80` | `#FFE34D` | `#FFD933` | `#FFD200` | `#E6BD00` | `#B89700` | `#8A7100` | `#5C4B00` |
| `--color-blue-*` | `#E5EEFF` | `#CCDDFF` | `#99BBFF` | `#6699FF` | `#3377FF` | `#2B6CFF` | `#225AD9` | `#1A47B0` | `#123487` | `#0A215E` |
| `--color-green-*` | `#E8F4EE` | `#D1EADD` | `#A3D5BB` | `#75C098` | `#47AB76` | `#1F7A4D` | `#19623E` | `#134B2F` | `#0D3320` | `#071C11` |
| `--color-amber-*` | `#FDF2DA` | `#FBE4B5` | `#F7C96B` | `#F2AE21` | `#D8930A` | `#B45309` | `#933F08` | `#722C06` | `#511A04` | `#300802` |
| `--color-red-*` | `#FCE8E8` | `#F9D1D1` | `#F3A3A3` | `#ED7575` | `#E74747` | `#DC2626` | `#B01F1F` | `#841717` | `#580F0F` | `#2C0808` |

**说明**：每个 scale 的 500 为视觉锚点，对应 V4 的 `--brand-yellow / --info / --ok / --warn / --err`；50 用于软底色（替代 V4 `*-50`）；600 用于 hover；900 用于深色文字。

#### C.1.2 间距 scale

| Token | Web 默认 | Mobile 紧凑 |
|---|---|---|
| `--space-1` | 4px | 2px |
| `--space-2` | 8px | 6px |
| `--space-3` | 12px | 10px |
| `--space-4` | 16px | 12px |
| `--space-5` | 24px | 18px |
| `--space-6` | 32px | 24px |
| `--space-7` | 48px | 36px |
| `--space-8` | 64px | 48px |

紧凑档生效条件：`@media (max-width: 768px)` 下覆盖；token 名不变。

#### C.1.3 圆角 scale

| Token | 值 | 用途 |
|---|---|---|
| `--radius-10` | 10px | 按钮 / input / chip |
| `--radius-12` | 12px | 微卡 / list-item / card-sm |
| `--radius-16` | 16px | 标准卡片 |
| `--radius-22` | 22px | Sheet / 大型容器 / floating shell |
| `--radius-999` | 9999px | pill / 全圆角导航 / 头像 |

#### C.1.4 字号 scale（Web 默认 / Mobile 紧凑）

| Token | Web | Mobile | 行高 | 用途 |
|---|---|---|---|---|
| `--font-display` | 40px | 34px | 1.2 | 大型展示数字 / 营销 hero |
| `--font-h1` | 32px | 28px | 1.3 | 页面主标题 |
| `--font-h2` | 24px | 20px | 1.35 | 模块大标题 |
| `--font-h3` | 18px | 16px | 1.4 | 模块标题 / SemiBold |
| `--font-card` | 16px | 14px | 1.5 | 卡片标题 |
| `--font-body` | 13px | 13px | 1.55 | 正文 |
| `--font-meta` | 12px | 11px | 1.4 | 时间 / 辅助说明 |
| `--font-tiny` | 11px | 10px | 1.4 | badge / 极小标签 |

#### C.1.5 字重

| Token | 值 |
|---|---|
| `--font-weight-regular` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |

#### C.1.5a 字体族（2026-05-28 DM Sans route）

| Token | 值 | 用途 |
|---|---|---|
| `--font-family-ui` | `"DM Sans", "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | 全局 UI 主字体 |
| `--font-family-ui-secondary` | `"Inter", "DM Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | 次级 Latin fallback / 保留位 |
| `--font-family-mono` | `"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace` | `kbd` / mono / tech metadata |

规则：

- 字体文件通过 design-system 自托管，禁止运行时请求 Google Fonts。
- `apps/**/src/**` 不允许直写 `font-family`，只能走 token 或 `inherit`。
- CJK 继续系统 fallback，不自托管中文字体。

#### C.1.6 阴影 scale

| Token | Light 值 | Dark 值 |
|---|---|---|
| `--shadow-l1` | `0 1px 2px rgba(26,29,32,.04), 0 1px 0 rgba(26,29,32,.02) inset` | `0 1px 0 rgba(255,255,255,.04) inset, 0 1px 2px rgba(0,0,0,.4)` |
| `--shadow-l2` | `0 1px 2px rgba(26,29,32,.04), 0 8px 24px -12px rgba(26,29,32,.10)` | `0 1px 0 rgba(255,255,255,.04) inset, 0 12px 28px rgba(0,0,0,.4)` |
| `--shadow-l3` | `0 12px 32px -12px rgba(26,29,32,.18)` | `0 16px 40px rgba(0,0,0,.5)` |
| `--shadow-l4` | `0 24px 48px -16px rgba(26,29,32,.25)` | `0 24px 56px rgba(0,0,0,.6)` |

#### C.1.7 动效

| Token | 值 | 用途 |
|---|---|---|
| `--ease-out` | `cubic-bezier(.16, 1, .3, 1)` | 默认进入 / 退出 |
| `--ease-emphasized` | `cubic-bezier(.2, .8, .2, 1)` | 强调动作（按钮 press、Sheet 弹起） |
| `--dur-fast` | 120ms | hover / press 反馈 |
| `--dur-base` | 200ms | 主要过渡（默认） |
| `--dur-slow` | 360ms | 大型容器（Sheet / Modal） |

`prefers-reduced-motion: reduce` 生效时：`--dur-fast/base/slow` 自动归零或最多 200ms 内的 fade，禁止位移/弹性（REQ-10.3）。

### C.2 Semantic Tokens（light 默认 + dark 覆写）

#### C.2.1 表面 surface（paper / bg）

| Semantic | Light | Dark | 用途 |
|---|---|---|---|
| `--color-bg-page` | `#F4F5F7` | `#0E0F11` | 全局页面背景 |
| `--color-bg-app` | `#ECEEF1` | `#16181B` | App 容器底色（floating shell 外） |
| `--color-bg-surface` | `--color-neutral-50` `#F8F9FA` 镜像 ⇒ `#FFFFFF` | `#1C1F23` | 卡片底色（paper-1） |
| `--color-bg-elevated` | `#F8F9FA` | `#22262B` | 嵌套子卡 / 高一级容器（paper-2） |
| `--color-bg-sunken` | `#EEF0F3` | `#2A2F35` | 输入框 / 凹陷区域（paper-3） |
| `--color-bg-overlay` | `rgba(26,29,32,.42)` | `rgba(0,0,0,.6)` | Modal / Sheet 后景遮罩 |

#### C.2.2 文字 ink

| Semantic | Light | Dark | 对比度（on bg-surface） |
|---|---|---|---|
| `--color-text-primary` | `#1A1D20` | `#F2F4F7` | 16.6:1 / 14.8:1（AAA） |
| `--color-text-secondary` | `#495057` | `#C8CDD4` | 9.1:1 / 9.5:1（AAA） |
| `--color-text-meta` | `#6B7280` | `#8C949E` | 4.7:1 / 4.6:1（AA） |
| `--color-text-meta-soft` | `#868E96` | `#6F7780` | 3.3:1（**仅装饰、不承载关键信息**，REQ-10.2） |
| `--color-text-disabled` | `#ADB5BD` | `#545B63` | non-reading |
| `--color-text-on-brand` | `#1A1D20` | `#1A1D20` | 黄底强制黑字 |

#### C.2.3 边框 border

| Semantic | Light | Dark |
|---|---|---|
| `--color-border-subtle` | `#E9ECEF` | `rgba(255,255,255,.06)` |
| `--color-border-default` | `#DEE2E6` | `rgba(255,255,255,.10)` |
| `--color-border-strong` | `#CED4DA` | `rgba(255,255,255,.16)` |

#### C.2.4 品牌 / 状态 / 焦点

| Semantic | Light | Dark | 软底色（badge/tag 用） |
|---|---|---|---|
| `--color-brand-primary` | `#FFD200` | `#FFEB38` | `--color-brand-soft`：`#FFF4B3` / `rgba(255,235,56,.16)` |
| `--color-brand-hover` | `#E6BD00` | `#FFD200` | — |
| `--color-state-ok` | `#1F7A4D` | `#4CC38A` | `#E8F4EE` / `rgba(76,195,138,.14)` |
| `--color-state-warn` | `#B45309` | `#E0A23B` | `#FDF2DA` / `rgba(224,162,59,.14)` |
| `--color-state-err` | `#DC2626` | `#F36F77` | `#FCE8E8` / `rgba(243,111,119,.14)` |
| `--color-state-info` | `#2B6CFF` | `#7BA8FF` | `#E5EEFF` / `rgba(123,168,255,.14)` |
| `--color-focus-ring` | `#2B6CFF` | `#7BA8FF` | — |

#### C.2.5 题型分类色（categorical, REQ-2.5）

| Semantic | Light | Dark | 用途 |
|---|---|---|---|
| `--color-cat-yanyu` | `#7373FF` | `#9999FF` | 行测·言语理解 |
| `--color-cat-shuliang` | `#FF8573` | `#FF9F8F` | 行测·数量关系 |
| `--color-cat-panduan` | `#FFDD55` | `#FFE680` | 行测·判断推理（与 brand 区分：偏暖橙黄） |
| `--color-cat-ziliao` | `#2F95FF` | `#5FB0FF` | 行测·资料分析 |
| `--color-cat-shenlun` | `#15803D` | `#4CC38A` | 申论 |

**铁律**：分类色只用于"题型/标签"分类，禁止与 ok/warn/err/info 互换。命名采用业务拼音（避免 cat-1/2/3 这种无意义编号——sikao 业务面只有 5 个题型，不会再扩充）。

### C.3 Component Tokens（组件契约层）

#### C.3.1 卡片 card

| Token | 值 | 备注 |
|---|---|---|
| `--card-radius` | `var(--radius-16)` | 标准卡片 |
| `--card-radius-sm` | `var(--radius-12)` | 高密度列表项 / 微卡 |
| `--card-radius-lg` | `var(--radius-22)` | Sheet / 大型容器 / floating shell |
| `--card-padding` | `var(--space-4)` | 标准内边距 16/12 |
| `--card-padding-sm` | `var(--space-3)` | 紧凑内边距 12/10 |
| `--card-bg` | `var(--color-bg-surface)` | paper-1 |
| `--card-bg-elevated` | `var(--color-bg-elevated)` | paper-2，用于嵌套外层 |
| `--card-border` | `1px solid var(--color-border-subtle)` | 默认描边 |
| `--card-shadow-rest` | `var(--shadow-l1)` | 默认 |
| `--card-shadow-hover` | `var(--shadow-l2)` | hover/focus |
| `--card-title-h` | `28px` | 标题区高度（标题 + 右侧 action 按钮垂直居中） |
| `--card-body-min-h` | `48px` | 正文区最小高度（防空塌） |
| `--card-action-divider` | `1px solid var(--color-border-subtle)` | 操作区分隔线 |

#### C.3.2 按钮 button

| Token | sm | md（默认） | lg | xl |
|---|---|---|---|---|
| `--btn-h-*` | 32px | 36px | 40px | 48px |
| `--btn-padding-x-*` | `var(--space-3)` | `var(--space-4)` | `var(--space-4)` | `var(--space-5)` |
| `--btn-font-*` | `var(--font-meta)` | `var(--font-body)` | `var(--font-card)` | `var(--font-card)` |
| `--btn-icon-size-*` | 14px | 16px | 18px | 22px |
| `--btn-radius-*` | `var(--radius-10)` | `var(--radius-10)` | `var(--radius-12)` | `var(--radius-12)` |
| `--btn-gap-*` (icon-text) | `var(--space-2)` | `var(--space-2)` | `var(--space-2)` | `var(--space-3)` |

icon-only 按钮：宽 = 高，padding-x 与 padding-y 等值；必须带 `aria-label`（lint：`lint-icon-button.mjs`）。

#### C.3.3 输入 input

| Token | 值 |
|---|---|
| `--input-h-md` | 36px |
| `--input-radius` | `var(--radius-10)` |
| `--input-padding-x` | `var(--space-3)` |
| `--input-bg` | `var(--color-bg-sunken)` |
| `--input-border` | `1px solid var(--color-border-default)` |
| `--input-border-focus` | `1px solid var(--color-focus-ring)` |
| `--input-ring-focus` | `0 0 0 3px rgba(43,108,255,.16)` |

#### C.3.4 行高度 row（list / tab）

| Token | 值 | 用途 |
|---|---|---|
| `--row-h-sm` | 40px | 紧凑列表（Question Hub / Review） |
| `--row-h-md` | 52px | 标准列表项（Note 列表 / 设置项） |
| `--row-h-lg` | 64px | 大型卡内行（Home 任务模块） |

注意：`--btn-h-*` 与 `--row-h-*` 严格分离，不互用（修复 V4 `--h-xs..lg` 与 `--row-h` 混用问题）。

#### C.3.5 导航 / 顶栏 / 侧栏

| Token | 值 |
|---|---|
| `--topbar-h` | 56px（mobile 48px） |
| `--bottom-nav-h` | 64px |
| `--bottom-nav-radius` | `var(--radius-999)`（pill） |
| `--rail-w` | 240px（mobile 不出现） |

#### C.3.6 z-index

| Token | 值 | 层 |
|---|---|---|
| `--z-rail` | 20 | 侧栏 |
| `--z-topbar` | 30 | 顶栏 |
| `--z-popover` | 40 | popover / dropdown |
| `--z-modal` | 60 | modal / sheet |
| `--z-toast` | 80 | toast |

每层间距 ≥ 10，预留第三方插队（REQ-6.3）。

### C.4 Breakpoints & Multi-device Coverage（多端覆盖）

#### C.4.1 断点 token

V5 主战场是 **桌面 1920×1080**，但要同时 cover 手机、平板、小笔记本、4K 大屏。断点必须分档，不能两极切换。

| Token | min-width | 主战场 | Rail | Workspace 行为 |
|---|---|---|---|---|
| `--bp-xs` | 0 | 手机竖屏 | 隐藏，用底导 | 单列、紧凑档 |
| `--bp-sm` | 480px | 大屏手机 / 折叠屏 | 隐藏 | 单列 |
| `--bp-md` | 768px | iPad 竖屏 | 隐藏 | 双列允许，依然紧凑档 |
| `--bp-lg` | 1024px | iPad 横屏 / 13" 笔记本 | 折叠态 80px | 进入舒适档 |
| `--bp-xl` | 1280px | 桌面默认 | 完整 240px | 标准 |
| `--bp-2xl` | 1536px | **1920 主战场（workspace 吃满 Rail 余宽）** | 完整 240px | 标准 |
| `--bp-3xl` | 1920px | 超大屏 / 4K | 完整 240px + 不再强制大屏限宽 | Workspace 跟随共享 token 语义 |

**实现方式**：tasks 阶段用预编译数值进 `tokens.css`（不依赖 `var()` 在 media query 内）：

```css
@media (min-width: 480px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
@media (min-width: 1920px) { /* 3xl */ }
```

#### C.4.2 大屏限宽（避免 1920+ 铺到天涯）

| Token | 值 | 用途 |
|---|---|---|
| `--max-w-workspace` | **none**（2026-05-27 `SIK-128` Route A supersede） | 共享 entry-workspace 默认值；1920+ 不再自动加 1440 cap |
| `--max-w-reading` | 720px | 题目阅读 / 长文正文列宽（line-length ≤ 75 字）|
| `--max-w-form` | 560px | 设置 / 注册 / 表单单列限宽 |
| `--max-w-modal` | 640px | Modal 默认上限（内容繁重场景用 Drawer 替代） |
| `--max-w-prose` | 800px | 富文本笔记编辑 / 申论作答区 |

**规则**：
- 任何 `<Workspace>` 继续通过 `--max-w-workspace` 接共享语义；`SIK-128` Route A 后该 token 默认解析为 `none`。
- 任何"长文阅读 / 正文连续段落"容器必须限到 `--max-w-reading`，不接受全宽。
- 任何"表单输入序列"必须限到 `--max-w-form`，避免 input 拉到 1200px 横扫。

**1920 屏行为**：`ws = 1920 - rail-w`。展开态 `1680`，折叠态 `1840`；与 1280/1440 一样，折叠后卡片与主区一起变宽，不再制造 1440 synthetic gutter。

#### C.4.3 Rail 折叠规则（多分辨率行为统一）

V5 把 Rail 折叠定为**确定性的 UI 状态**，不允许各页面自己重新设计。

**折叠状态决策**：

| 视口 | Rail 默认 | 用户可手动切换 |
|---|---|---|
| `< 768` 移动 | 不存在（用底部 Tab Bar） | — |
| `768–1023` 平板 | 不存在（用顶部 Burger Drawer）| — |
| `1024–1279` 小桌面 | 默认折叠（80px） | ✓ |
| `≥ 1280` 标准桌面 + 1920 主战场 | 默认展开（240px） | ✓ |

**触发方式**（多入口冗余）：

1. **展开态**：右上角 Toggle 按钮 (`IconRailToggle`)，点击折叠
2. **折叠态**：整个 brand 区域作为可点击元素，点击展开（不再显示 Toggle 按钮）
3. **快捷键**：`Ctrl/Cmd + \` 全场景可用，不受焦点位置影响

**折叠态视觉规则（必须遵守）**：

- Logo (`mark` 28×28) **居中对齐**到 nav-btn 图标的垂直中线（X 坐标一致）；不允许 Logo 偏左 + Toggle 偏右的"两元素水平"布局
- Toggle 按钮**完全隐藏**（`display: none`），不挪到底部
- brand 区域 hover 时背景变 `--color-bg-elevated`，光标 `cursor: pointer`
- 右侧 Tooltip 浮出"展开侧栏 (Ctrl+\\)"，延迟 400ms（比普通 Tooltip 600ms 短，因为这是必需引导而非辅助提示）

**列数稳定规则（走法 X）**：

- workspace 内组件的列数**按"展开态 ws 宽度"计算**，折叠不触发列数变化。
- 折叠后效果是"卡片变宽 / 留白增大"，不是"列数重排"。
- 例外：`<Exam>` 模式不属于 SaaS Shell（Exam 是独立 layout，无 Rail），不受此规则约束。

**持久化规则**：

- 状态写 `localStorage['v5-rail-collapsed']: 'true' | 'false'`，全局生效，不按路由记忆。
- 用户偏好覆盖断点默认值——例如用户在 1280 屏手动展开后，下次访问 1280 屏仍是展开态。
- 跨设备同步标为可选增强，由后端账号系统承担，不卡 V5。

**工程实现要点**：

- `--rail-w` 由 `--rail-w-expanded`(240) / `--rail-w-collapsed`(80) 通过 `:root[data-rail="collapsed"]` 切换；`.rail { width: var(--rail-w); transition: width .25s var(--ease-out) }`。
- workspace 用 `flex: 1 + max-width: var(--max-w-workspace)`；Route A 后共享 token 默认等于 `none`，宽度变化由 transition 自然过渡。
- `prefers-reduced-motion` 下 transition 缩短为 0ms，但**不禁用折叠功能**。

#### C.4.4 Tablet 中间档（768–1279px）

V4 的硬伤：`@media (max-width: 1180px)` 一刀切到 80px Rail，没考虑 iPad 横屏。V5 按断点分三段（与 §C.4.1 / §C.4.3 对齐）：

| 视口 | Rail | Practice 网格 | Calendar | 触屏适配 |
|---|---|---|---|---|
| `< 768` | 隐藏 | 1 列纵向 | 隐藏，用 day-list | 全触屏档 |
| `768–1023` | 隐藏（用顶部 burger 抽屉）| 2 列 | day view | 触屏档 |
| `1024–1279` | 折叠 80px（仅图标）| 3 列 | week 简化（5 天） | 触屏 + 鼠标双适配 |
| `≥ 1280` | 完整 240px | 4 列 | 完整 week | 鼠标档 |

#### C.4.5 Safe area（移动端必需）

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
- TopBar / BottomNav / Sheet / Modal **必须**用 `padding-inline: var(--safe-left) var(--safe-right)`。
- 全屏 Modal `padding-block: var(--safe-top) var(--safe-bottom)`。
- 业务组件不得 hardcode `padding-top: 44px` 类似的 iOS 状态栏值。

### C.5 SVG 图标规范（REQ-1.1 / Property 5 落地）

V4 的图标只规定了"必须 SVG"，但没有规定**风格、尺寸、用法边界**，导致原型里出现描边粗细 1.5 / 1.7 / 1.8 / 2 混杂、有的 fill 实心有的 stroke 线性、`viewBox` 宽高不一。V5 在此处一次性收敛。

#### C.5.1 风格统一

| 维度 | 规则 |
|---|---|
| 形态 | **outline / stroke-only**（线性图标）；不允许实心 fill / 双色 / 拟物 |
| viewBox | 固定 `0 0 24 24`（无论实际渲染尺寸）|
| stroke-width | 默认 `1.7`；尺寸 ≥ 22 时 `1.8`，尺寸 ≤ 14 时 `1.6` |
| stroke-linecap | `round` |
| stroke-linejoin | `round` |
| fill | `none`（外层 svg 与 path 都不带 fill） |
| stroke | `currentColor`（继承文字色，自动适配 light/dark） |
| 端点对齐 | 所有路径栅格对齐到 0.5px，避免亚像素模糊 |
| 内部留白 | 图标主体不超过 `2 2 20 20`（四周保留 2px 视觉边距） |

例外：仅 **状态徽标**（如完成 ✓、错误 ✗）允许带 fill 实心；这种图标必须命名以 `Filled` 后缀（如 `CheckFilled`），与同名 outline 版本（`CheckOutline`）共存。

#### C.5.2 尺寸 token

| Token | 值 | 用途 |
|---|---|---|
| `--icon-12` | 12px | meta-text 内联图标（时间前缀、subtle hint）|
| `--icon-14` | 14px | rail-cmd / chip 内嵌图标 |
| `--icon-16` | 16px | **默认**：按钮内 icon、icon-btn、Rail nav |
| `--icon-18` | 18px | h3 标题前缀、卡片头部 |
| `--icon-22` | 22px | 大型 metric-card icon-slot、空状态插画收口 |

**铁律**：禁止图标使用非 token 尺寸（如 `width: 17px`）；Tailwind 类 `w-4 h-4 / w-5 h-5` 必须映射到 token。

#### C.5.3 必须使用 SVG 图标的场景（白名单）

V5 强制以下场景**只**接受 SVG 图标，禁止文字符号 / emoji / 图片字体替代：

| 场景 | 位置 | 大小 | stroke-width |
|---|---|---|---|
| **导航栏 / Rail nav** | 首页 / 练习 / 复盘 / 笔记（Me 独立走 RailMe） | 18 | 1.7 |
| **顶部命令搜索 trigger** | rail-cmd 放大镜 | 14 | 1.8 |
| **顶部 icon-btn** | 通知、字号切换、收藏、分享、更多 (...) | 16 | 1.8 |
| **按钮内 icon-leading / icon-trailing** | btn-primary "+ 新建"、"开始练习"、"继续上次" 等 | 16 | 2.0 |
| **icon-only 按钮** | 关闭 ✕、菜单 ⋯、折叠箭头、复制 | 16 | 1.8（必须带 `aria-label`） |
| **答题系统专用按钮** | 上一题 / 下一题 / 标记 / 标注笔 / 删除 / 计时器 / 暂停 / 字号档 / 草稿纸 / **交卷** | 16 | 1.8 |
| **题型分类标识** | rail-btn 前置图标、Practice scope 切换、Note 来源 chip | 14 | 1.7 |
| **状态指示** | 已完成 ✓、错误 ✗、警告 !、信息 i | 14–16 | 1.8（或允许 `Filled` 变体）|
| **空状态插画** | EmptyState illustration | 40–80 | 1.5（视觉减弱） |
| **品牌 Logo** | rail-brand `mark` | 32 | — (Logo 是品牌资产，不走线性规则) |
| **趋势箭头** | metric-card delta、Numeric trend | 12 | 2.0 |

#### C.5.4 答题系统图标清单（业务关键，固化命名）

由于"答题系统"是 sikao 的核心场景且按钮密集，以下命名固化：

| 业务名 | 图标 ID | 形态描述 | 必带 aria-label |
|---|---|---|---|
| 上一题 | `IconChevronLeft` | < 形 chevron | "上一题" |
| 下一题 | `IconChevronRight` | > 形 chevron | "下一题" |
| 标记 / 收藏 | `IconBookmark` | 书签 | "标记本题" / "收藏本题" |
| 标注笔 | `IconHighlighter` | 荧光笔 | "标注笔" |
| 删除 | `IconTrash` | 垃圾桶 | "删除" |
| 计时器 | `IconTimer` | 圆 + 指针 | "考试计时" |
| 暂停 / 继续 | `IconPause` / `IconPlay` | || / ▷ | "暂停" / "继续" |
| 字号档切换 | `IconType` | A↕ | "切换字号" |
| 草稿纸 | `IconScratchPad` | 网格纸 | "打开草稿纸" |
| **交卷** | `IconSubmit` | 飞机 paper-plane | "交卷"（**必须二次确认 modal**）|
| 答题卡总览 | `IconAnswerSheet` | 网格四宫格 | "答题卡" |
| 笔记 | `IconNotebook` | 笔记本 | "笔记" |
| 设置 | `IconSettings` | 齿轮 | "设置" |
| 退出 / 离开考试 | `IconExit` | 门 + 箭头 | "退出考试"（**必须二次确认**）|

#### C.5.4b 导航辅助图标（Rail 专用）

| 业务名 | 图标 ID | 形态描述 | 必带 aria-label |
|---|---|---|---|
| Rail 折叠开关 | `IconRailToggle` | 侧栏框 + 内嵌左箭头（折叠态视觉旋转 180° 自动变右箭头）| "折叠侧栏" / "展开侧栏" |
| 命令搜索 | `IconSearch` | 放大镜 | "命令搜索 (Ctrl+K)" |
| 全局折叠主入口 | `IconBurger` | ≡ 三横线（仅 768-1023 平板顶部用）| "打开导航" |

**`IconRailToggle` 形态规则**：24×24 viewBox 内画一个矩形（代表 Rail 容器）+ 矩形内一条竖线（代表 Rail 边界）+ 内嵌左指箭头。展开态显示原状，折叠态用 `transform: rotate(180deg)` 自动翻转——但**V5 Rail 折叠态完全隐藏 Toggle 按钮**（C.4.3 决策），所以 `rotate` 只在"用户先展开后再次悬停 brand 区"的瞬间状态有效，不是常驻视觉。

#### C.5.5 禁用清单

以下用法**禁止出现**在 `apps/**/src/**`，由 lint 闸门强制：

- 用 emoji 当图标：`📝`、`⭐`、`✅`、`🔔` 等。允许出现在 ui-copy 文案中作为情绪修饰（受 ui-copy SSOT 约束），但**绝不**单独承担"图标"语义。
- icon-font（如 Font Awesome、iconfont 字体方案）：禁。
- 位图图标（PNG/JPG/WebP 作为图标资产）：禁。除"品牌 Logo 多色像素稿"等极端例外，必须经 lhr 批准。
- 不带 `aria-label` 的 icon-only 按钮（lint：`lint-icon-button.mjs`）。

#### C.5.6 SVG 资产组织

- **单一来源**：`packages/design-system/src/icons/*.svg`，每个图标一个文件，文件名 = 业务命名（如 `chevron-left.svg`）。
- **生成 Sprite**：构建期合并为 `icons.svg`（已存在于 `apps/web/public/icons.svg`，V5 沿用）。
- **使用方式**：`<svg><use href="/icons.svg#chevron-left" /></svg>`，配合 `currentColor` 自动取色。
- **新增图标**：必须先在 design-system 仓提 PR，附 SVG 源文件 + 业务命名 + 用途说明，CI 跑 `lint-icon-style.mjs`<sup>新</sup> 校验风格（viewBox / stroke-width / fill / linecap）。

### C.6 V4 → V5 Token Mapping ~~（REQ-1.6 / REQ-12.1）~~ — ARCHIVED 2026-05-24

> **ARCHIVED 2026-05-24（V5-M0.5 big-bang rebuild 决策）**：本章节整段作废。lhr 拍板 big-bang 重建，`apps/web` 业务层与 `packages/ui` 整包删除；`packages/design-system/src/tokens.css` §8 V4 alias 区块同步删除。**没有 V4 token 名残留需要逐条 mapping**——V5 token 名（`--color-bg-* / --color-text-* / --space-* / --radius-* / --font-* / --shadow-l*` 等）是 SSOT 的全部内容。
>
> 影响：
> - 下游 tasks.md 1.7（V4 alias 区块）+ Phase 6（21.x 整页 surface 切换）+ 21.3（sunset）+ 23.1（baseline report 含 V4 残留扫描）整段 ARCHIVED。
> - REQ-1.6 字面"所有 V4 token 必须有 V5 去向"达成方式改为：V4 token 名在 SSOT 全部不存在即为达成。
> - 本表保留作历史参考，**不作为 V5 实现的输入**。
>
> 替代规则：业务 Phase（Home / Practice / Notes / Review / Profile / Marketing）在新 V5 框架下从零按 §C.1–C.5 token 与 §D.1–D.5 组件契约实现。

下表内容保留作历史参考。

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
| `--line-1` | `--color-border-subtle` | rename | — |
| `--line-2` | `--color-border-default` | rename | — |
| `--line-3` | `--color-border-strong` | rename | — |
| `--brand-1` | `--color-text-primary` 或 `--color-brand-primary` 视上下文 | split | V4 把 dark CTA 也叫 brand-1 容易混；split |
| `--brand-yellow` | `--color-brand-primary` | rename | 主色不变 |
| `--brand-yellow-hover` | `--color-brand-hover` | rename | — |
| `--brand-yellow-soft` | `--color-brand-soft` | rename | — |
| `--ok` / `--ok-50` | `--color-state-ok` / `--color-state-ok-soft` | rename | — |
| `--warn` / `--warn-50` | `--color-state-warn` / `--color-state-warn-soft` | rename | — |
| `--err` / `--err-50` | `--color-state-err` / `--color-state-err-soft` | rename | — |
| `--info` / `--info-50` | `--color-state-info` / `--color-state-info-soft` | rename | — |
| `--focus-ring` | `--color-focus-ring` | rename | — |
| `--shadow-1` | `--shadow-l1` | rename | — |
| `--shadow-2` | `--shadow-l2` | rename | — |
| `--shadow-pop` | `--shadow-l3` | rename | 增加 `--shadow-l4` |
| `--sp-1..8` | `--space-1..8` | rename | mobile 紧凑覆写改为媒体查询自动切换，不需要单独 token |
| `--row-h` | `--row-h-md` | split | 拆为 sm/md/lg |
| `--topbar-h` | `--topbar-h` | keep | 值不变 |
| `--rail-w` | `--rail-w` | keep | 值不变 |
| `--r-tiny` | `--radius-10` (primitive) + `--btn-radius-*` (component) | split | 拆分 primitive 与 component |
| `--r-card-sm` | `--radius-12` + `--card-radius-sm` | split | 同上 |
| `--r-card` | `--radius-16` + `--card-radius` | split | 18→16（Q1 决策） |
| `--r-app` | `--card-radius-lg` (`--radius-22`) | split | 不再单独 r-app |
| `--r-pill` | `--radius-999` | rename | — |
| `--t-display` | `--font-display` | rename | — |
| `--t-h1/h2/h3` | `--font-h1/h2/h3` | rename | — |
| `--t-card` | `--font-card` | rename | — |
| `--t-body/meta/tiny` | `--font-body/meta/tiny` | rename | — |
| `--h-xs/sm/md/lg` | `--btn-h-sm/md/lg/xl` | split + rename | 高度档命名收敛；与 row-h 严格分离 |
| `--icon-xs..xl` | `--icon-12/14/16/18/22` | rename | 换成尺寸值命名，更直观 |
| `--ease-out / --ease-emphasized` | 同名 | keep | — |
| `--dur-fast/base/slow` | 同名 | keep | — |
| `--z-rail/topbar/popover/modal/toast` | 同名 | keep | 值微调（Modal 50→60，预留插队） |

**deprecate 时间线**：所有 V4 token 在 V5 落地时同步标 `@deprecated 2026-05-23 — 失效 2026-06-06`（2 周过渡期，REQ-12.2 决策）；过渡期满 Verifier 跑 `lint-v4-token-residual.mjs`，0 引用后从 SSOT 删除。

## Data Models

### D.1 卡片类别 5 类（REQ-7.1）

| 类型 | 用途 | radius | padding | 关键约束 |
|---|---|---|---|---|
| `standard-card` | 默认通用卡片 | `--card-radius` | `--card-padding` | 三段结构：title-bar / body / action-bar，可选 |
| `stat-card` | 数据展示（正确率 / 题量 / 用时） | `--card-radius` | `--card-padding` | 数字用 `<Numeric>`；视觉权重数字 > 标签；至少 1 个 metric |
| `list-card` | 多行列表项容器 | `--card-radius` | 0（行内自带 padding） | 内行用 `--row-h-md/sm`；行间分隔 `--color-border-subtle`；首尾行不加分隔 |
| `media-card` | 含视觉/插图（推荐套题封面、空状态插图卡） | `--card-radius` | `--card-padding` | 媒体区与文本区比例 ≥ 16:9 或固定 120px 高 |
| `compact-card` | 高密度网格（题型选择、Question Hub 题目卡） | `--card-radius-sm` | `--card-padding-sm` | 边长 88–112px，正方形或 4:3 |

### D.2 卡片状态机（REQ-7.2）

每类卡片至少支持 9 状态：

| 状态 | 视觉变化 | 触发 |
|---|---|---|
| `rest` | `--card-shadow-rest` + `--card-border` | 默认 |
| `hover` | `--card-shadow-hover` + 上移 -2px | mouse enter（仅 hover-capable 设备：`@media (hover: hover)`） |
| `pressed` | shadow 回 l1 + 下移 0px + 内底色 -2% | mousedown / touchstart |
| `focus-visible` | `--card-border` 替换为 `--color-focus-ring` 2px ring | keyboard tab 进入 |
| `selected` | 内底色 = `--color-brand-soft`，左侧 4px brand 条 | 业务标记选中 |
| `disabled` | opacity .5 + cursor not-allowed + 禁 shadow-hover | disabled prop |
| `loading` | 渲染骨架屏（`<Skeleton>` 占位） | 数据未就绪 |
| `empty` | 渲染 `<EmptyState>` 占位（图标 + 文案 + CTA） | data length === 0 |
| `error` | `--card-border` 替换为 `--color-state-err` 1px + 错误文案 | data fetch failed |

**视觉示例统一在** `.tmp_review/v5-design-preview.html` 的 §D.2 区块。

### D.3 组件 Prop API 草案（REQ-8.6）

> 仅列契约，不写实现；命名以 React + TypeScript 为基础，apps/mobile/tablet 平台映射保持等价。

#### D.3.1 Button

```ts
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';        // default 'md'
  iconLeading?: ReactElement;               // SVG only (lint 强制)
  iconTrailing?: ReactElement;
  iconOnly?: ReactElement;                  // 三种 icon 排布互斥
  loading?: boolean;                        // 自动禁点击 + 显示 spinner
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: (e: MouseEvent) => void;
  'aria-label'?: string;                    // iconOnly 时必填（lint 强制）
}
```

状态：rest / hover / pressed / focus-visible / disabled / loading（6 态）。

#### D.3.2 Input

```ts
interface InputProps {
  type?: 'text' | 'number' | 'password' | 'search';
  size?: 'sm' | 'md' | 'lg';                // 默认 md
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;                        // 触发 error 视觉
  errorText?: string;                       // 与 invalid 配合
  successText?: string;
  prefix?: ReactNode;                       // 前缀 icon / unit
  suffix?: ReactNode;
  'aria-label'?: string;
}
```

状态：rest / focus / filled / disabled / read-only / error / success（7 态）。

#### D.3.3 Tab / SegmentedControl

> R2/Q2 决策：Tabs 与 SegmentedControl **合并为单组件 3 variant**，不拆。`underline` 用于"切换视图"（panel-tabs / TagBar），`pill` 用于装饰性标签切换，`segmented` 用于"切换数据范围"。**ScopeToggle**（行测/申论）= `variant='segmented'` 的特例：业务侧可以 wrap 一层名为 ScopeToggle 的语义化组件，但底层契约必须是 Tabs。

```ts
interface TabsProps {
  variant?: 'underline' | 'pill' | 'segmented';  // 默认 underline
  items: Array<{ key: string; label: string; icon?: ReactElement; disabled?: boolean }>;
  active: string;
  onChange: (key: string) => void;
  size?: 'sm' | 'md';
}
```

状态：rest / hover / active / disabled（4 态 × variant）。

#### D.3.4 ListItem

```ts
interface ListItemProps {
  size?: 'sm' | 'md' | 'lg';                // 对应 row-h-sm/md/lg
  leading?: ReactElement;                   // icon / avatar / checkbox
  title: string;
  subtitle?: string;
  trailing?: ReactElement;                  // chevron / value / button
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  draggable?: boolean;                      // 含 drag-handle 时启用
  'aria-label'?: string;
}
```

状态：rest / hover / pressed / selected / disabled / dragging-handle（6 态）。

#### D.3.5 Sheet（半屏 / 全屏）

```ts
interface SheetProps {
  open: boolean;
  onClose: () => void;
  variant?: 'half' | 'full' | 'auto';       // auto = 内容驱动高度
  draggable?: boolean;                      // 是否允许下拉关闭
  title?: string;
  trailingAction?: ReactElement;            // 顶部右侧按钮
  children: ReactNode;
  footer?: ReactNode;
}
```

状态：closed / opening / open / dragging / closing（5 态）。Sheet 顶部圆角 = `--card-radius-lg`（22px），仅顶部两角，底部贴边。

#### D.3.6 Modal

```ts
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';                // 360 / 480 / 640 px
  primaryAction: { label: string; onClick: () => void; variant?: 'primary' | 'danger' };
  secondaryAction?: { label: string; onClick: () => void };
  closeOnOverlay?: boolean;                 // 默认 true，danger 场景设 false
  children?: ReactNode;
}
```

状态：closed / opening / open / closing（4 态）。

#### D.3.7 Toast

```ts
interface ToastOptions {
  variant?: 'info' | 'ok' | 'warn' | 'err'; // 默认 info
  title: string;
  description?: string;
  duration?: number;                        // 默认 3000ms，err 默认 5000ms
  action?: { label: string; onClick: () => void };
}
```

视觉：`--shadow-l4`（toast 专用层级，比 `--shadow-l3` 更显著），背景 `--color-bg-surface`，左侧 4px 状态色条。

#### D.3.8 Badge / Tag / Chip

```ts
interface BadgeProps {
  variant: 'neutral' | 'brand' | 'ok' | 'warn' | 'err' | 'info' | 'cat-yanyu' | 'cat-shuliang' | 'cat-panduan' | 'cat-ziliao' | 'cat-shenlun';
  size?: 'sm' | 'md';
  leading?: ReactElement;                   // 可选 icon
  children: ReactNode;
}
```

状态：static（无交互）。Tag/Chip 在 Badge 基础上加可关闭：`onRemove?: () => void`。

#### D.3.9 Numeric（REQ-8.5）

```ts
interface NumericProps {
  value: number | string;
  unit?: string;                            // %、题、秒、min...
  precision?: number;                       // 小数位
  thousand?: boolean;                       // 千位分隔，默认 true
  size?: 'meta' | 'body' | 'card' | 'h3' | 'h2' | 'h1' | 'display';
  emphasis?: 'value' | 'unit' | 'balanced'; // 视觉对比层级
  trend?: 'up' | 'down' | 'flat';           // 自动接 ok/err 色 + ▲/▼
}
```

CSS 必带 `font-variant-numeric: tabular-nums`（Q3 决策）。

#### D.3.10 EmptyState / Skeleton

```ts
interface EmptyStateProps {
  illustration?: 'no-data' | 'no-result' | 'error' | 'first-time';
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
}

interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  width?: number | string;
  height?: number | string;
  lines?: number;                           // text 模式行数
}
```

骨架动效：`animation: skeleton-pulse 1.4s var(--ease-out) infinite`，`prefers-reduced-motion` 下保留 0.4 → 0.7 → 0.4 的 opacity 静态循环。

#### D.3.11 Textarea（申论作答 / 笔记编辑）

```ts
interface TextareaProps {
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md' | 'lg';
  rows?: number;                            // 固定行数；与 autosize 互斥
  autosize?: { min?: number; max?: number };
  maxLength?: number;                       // 触发字数计数
  showCount?: boolean;                      // 右下角显示 N/maxLength
  placeholder?: string;
  invalid?: boolean;
  errorText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  'aria-label'?: string;
}
```

约束：申论作答区强制 `autosize: { min: 8, max: 24 }` + `showCount: true`；字数接近 maxLength 90% 时计数变 warn 色。

#### D.3.12 Radio / Checkbox / Switch

```ts
interface RadioProps {
  name: string;                             // group 名
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}
interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}
```

注意：**Radio / Checkbox 是普通表单选项**，与"答题选项 ABCD"（D.3.28 OptionItem）严格区分；后者是业务专属、视觉权重不同。

#### D.3.13 Select / Combobox

```ts
interface SelectProps<T = string> {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; icon?: ReactElement; disabled?: boolean }>;
  placeholder?: string;
  searchable?: boolean;                     // true → Combobox 模式
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  disabled?: boolean;
}
```

状态：closed / focus / open / searching / selected / disabled。下拉面板用 D.3.20 Popover token。

#### D.3.14 DatePicker / TimePicker

```ts
interface DatePickerProps {
  value: Date | null;
  onChange: (v: Date | null) => void;
  min?: Date; max?: Date;
  placeholder?: string;
  format?: 'YYYY-MM-DD' | 'YYYY/MM/DD' | 'MM/DD';
  presets?: Array<{ label: string; value: Date | (() => Date) }>;  // "今天" / "明天" / "下周一"
  disabled?: boolean;
}
interface TimePickerProps {
  value: { h: number; m: number } | null;
  onChange: (v: { h: number; m: number } | null) => void;
  step?: 5 | 10 | 15 | 30 | 60;             // 分钟步长
  format?: '24h' | '12h';
  disabled?: boolean;
}
```

DatePicker 默认开 `presets: ["今天", "明天", "下周一", "考试日"]`（考试日由业务注入）。

#### D.3.15 Slider

```ts
interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  min: number; max: number; step?: number;
  marks?: Array<{ value: number; label: string }>;  // 字号档：14/15/17/19
  showValue?: boolean;
  disabled?: boolean;
}
```

字号档切换专用：`marks` 必填，每档显示中文标签（标准 / 大字 / 特大 / 紧凑）。

#### D.3.16 FormField / FormItem（包装器）

```ts
interface FormFieldProps {
  label: string;
  required?: boolean;                       // 显示红色 *
  helper?: string;                          // 灰色辅助说明
  error?: string;                           // 红色错误（与 helper 互斥）
  htmlFor?: string;                         // 关联 input id
  children: ReactElement;                   // 实际 input/select/textarea
}
```

强制规则：所有表单控件**必须**包在 FormField 内；不允许裸 label + input 组合。布局：label 顶部 + 控件 + helper/error 底部，纵向 6px 间距。

#### D.3.17 Search（页面内搜索，与 rail-cmd 区分）

```ts
interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  width?: number | string;                  // 默认 240
  suggestions?: string[];                   // 输入触发的下拉建议
  clearable?: boolean;                      // 默认 true
}
```

视觉：`--input-bg` 底色 + 前置放大镜（`IconSearch` 14px）+ 后置 X 清空按钮（值非空时显示）。

#### D.3.18 Avatar

```ts
interface AvatarProps {
  src?: string;                             // 缺省走 fallback initials
  fallback: string;                         // 1-2 字（"L" / "李明"）
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';  // 24 / 28 / 32 / 44 / 64
  status?: 'online' | 'offline' | 'busy' | 'away';  // 右下角圆点
  shape?: 'circle' | 'square';              // 默认 circle
  alt?: string;                             // a11y 必填（非装饰性时）
}
```

规则：`fallback` 必填——image 加载失败时显示带 `--color-text-primary` 反色背景的首字母；`status` dot 用 2px paper-1 描边避免与背景混。

#### D.3.19 Tooltip（hover 设备专属）

```ts
interface TooltipProps {
  content: string | ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';   // 默认 'top'
  align?: 'start' | 'center' | 'end';
  delayIn?: number;                              // 默认 600ms
  delayOut?: number;                             // 默认 200ms
  shortcut?: string[];                           // 显示快捷键，如 ['Ctrl', 'K']
  children: ReactElement;                        // 触发元素
}
```

强制规则：触屏（`pointer: coarse`）下不渲染 Tooltip，改用长按 700ms 触发 Sheet 提示（参见 D.3.20 Popover）。所有 icon-only 按钮**必须**配 Tooltip（鼠标 hover 显示 aria-label 同名文案）。

#### D.3.20 Popover

```ts
interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;                    // 触发元素，自动绑定 aria-haspopup
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  width?: number | 'auto' | 'trigger';      // trigger = 跟随触发元素宽
  closeOnClickOutside?: boolean;            // 默认 true
  children: ReactNode;
}
```

视觉：`--menu-bg` + `--shadow-l3` + `var(--radius-12)` 圆角；箭头可选（默认无箭头，避免与卡片冲突）。

#### D.3.21 Drawer（侧滑面板）

```ts
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right' | 'top' | 'bottom';   // 桌面默认 right，移动端默认 bottom
  size?: 'sm' | 'md' | 'lg' | 'full';            // 360 / 480 / 640 / 100%
  title?: string;
  trailingAction?: ReactElement;
  children: ReactNode;
  footer?: ReactNode;
}
```

与 Sheet 区分：**Drawer 是侧滑（桌面常用），Sheet 是底滑（移动端常用）**。Note 详情、Modal 内容超过 640px 高度时用 Drawer 替代。

#### D.3.22 ConfirmDialog（Modal 二次确认快捷封装）

```ts
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;                            // "确认交卷？"
  description: string;                      // "提交后无法修改答案"
  confirmText: string;                      // "确认交卷"
  cancelText?: string;                      // 默认 "取消"
  destructive?: boolean;                    // true 时 confirm 按钮 danger
  onConfirm: () => void | Promise<void>;
  loading?: boolean;                        // confirm 处理中
}
```

强制规则：**交卷 / 退出考试 / 删除笔记 / 注销账号** 等不可逆操作必须走 ConfirmDialog，不允许用普通 Modal 拼装。

#### D.3.23 Banner / Alert（页面级常驻提醒）

```ts
interface BannerProps {
  variant: 'info' | 'ok' | 'warn' | 'err';
  title: string;
  description?: string;
  icon?: ReactElement;                      // 默认按 variant 自动取
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;                    // 显示关闭按钮
  onDismiss?: () => void;
}
```

与 Toast 区分：**Banner 是页面顶部常驻**（如"考试模式不可切换网络"），Toast 是临时浮层。Banner 必须出现在 Topbar 下方、Workspace 顶部，全宽。

#### D.3.24 Pagination

```ts
interface PaginationProps {
  current: number;                          // 1-based
  total: number;                            // 总条目数
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
  showSizeChanger?: boolean;                // 显示 "10/20/50/100 条"
  showJumper?: boolean;                     // 显示 "跳至 N 页"
  size?: 'sm' | 'md';
}
```

视觉：紧凑模式（题库 grid 用）= `<` `1` `2` `…` `99` `>`；常规模式（admin 表格用）= 含 size + jumper。

#### D.3.25 Breadcrumb

```ts
interface BreadcrumbProps {
  items: Array<{ label: string; href?: string; icon?: ReactElement }>;
  separator?: ReactNode;                    // 默认 IconChevronRight 12px
  maxItems?: number;                        // 超过则收成 "首页 / ... / 当前"
}
```

约束：`@media (max-width: 768px)` 下默认隐藏（移动端用 TopBar 返回按钮）。

#### D.3.26 CommandPalette（⌘K 全局命令）

```ts
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  groups: Array<{
    label: string;                          // "导航 / 操作 / 最近"
    items: Array<{
      id: string;
      label: string;
      icon?: ReactElement;
      shortcut?: string[];
      onSelect: () => void;
    }>;
  }>;
  placeholder?: string;                     // 默认 "搜索命令、笔记、题目..."
}
```

约束：触发快捷键固定 `Ctrl+K` / `⌘K`；Esc 关闭；上下箭头导航；Enter 选中。所有"页面级主操作"应注册到 CommandPalette。

#### D.3.27 Progress（线性 / 环形）

```ts
interface ProgressLinearProps {
  value: number;                            // 0-100
  variant?: 'brand' | 'ok' | 'warn' | 'err';
  size?: 'sm' | 'md' | 'lg';                // 高度 4 / 6 / 10 px
  showLabel?: boolean;                      // 右侧显示百分比
  indeterminate?: boolean;                  // loading 不确定态
}
interface ProgressRingProps {
  value: number;                            // 0-100
  size?: 'sm' | 'md' | 'lg';                // 24 / 40 / 64 px
  strokeWidth?: number;                     // 默认 size*0.1
  variant?: 'brand' | 'ok' | 'warn' | 'err';
  children?: ReactNode;                     // 中间嵌入文字（如 "75%" 或 Numeric）
}
```

#### D.3.28 OptionItem（答题选项 ABCD，业务专属）

```ts
interface OptionItemProps {
  label: 'A' | 'B' | 'C' | 'D' | string;    // 字母选项
  text: string;                             // 选项内容
  state: 'rest' | 'selected' | 'correct' | 'wrong' | 'disabled' | 'reviewing';
  onClick?: () => void;
  showLetter?: boolean;                     // 默认 true
  showExplanation?: boolean;                // 复盘态显示解析
  explanation?: string;
}
```

状态视觉：
- `rest`：`--card-bg` + `--color-border-default`
- `selected`：`--color-brand-soft` + brand 边框
- `correct`：`--color-state-ok-soft` + ok 边框 + 右侧 `IconCheck` 实心
- `wrong`：`--color-state-err-soft` + err 边框 + 右侧 `IconClose` 实心
- `disabled`：opacity .5，禁点击
- `reviewing`：仅复盘视图，可同时高亮 correct 和 wrong（用户选错的）

**铁律**：**禁止用普通 Radio 模拟答题选项**，必须用 OptionItem 组件。

#### D.3.29 QuestionStem（题干容器）

```ts
interface QuestionStemProps {
  number: number | string;                  // 题号
  type?: string;                            // "单选" / "多选" / "申论"
  difficulty?: 'easy' | 'medium' | 'hard';  // badge 显示
  content: ReactNode;                       // 富文本，支持图片 / 标注 highlight
  fontSize?: 14 | 15 | 17 | 19;             // 字号档（与 D.3.15 Slider 联动）
  enableSelection?: boolean;                // 允许选词标注
  marks?: Array<{ start: number; end: number; color: string }>;  // 用户标注位置
}
```

#### D.3.30 AnswerSheet（答题卡总览）

```ts
interface AnswerSheetProps {
  questions: Array<{
    number: number;
    state: 'unanswered' | 'answered' | 'marked' | 'current';
  }>;
  cols?: number;                            // 每行题数，默认 5（行测）/ 10（密集）
  onJump: (number: number) => void;
}
```

视觉：网格布局；每个 cell 是 `IconAnswerSheet` 风格的方块按钮；状态色：unanswered = `--color-bg-sunken` / answered = `--color-bg-elevated` 实心 / marked = `--color-state-warn` 边框 / current = `--color-brand-primary` 实心。

#### D.3.31 TimerDisplay（考试计时器）

```ts
interface TimerDisplayProps {
  remainingMs: number;                      // 剩余毫秒
  totalMs?: number;                         // 总时长（用于进度环）
  warningThreshold?: number;                // 进入警告色的剩余毫秒，默认 5 分钟
  paused?: boolean;
  onTick?: (remainingMs: number) => void;   // 秒级回调
}
```

视觉：等宽数字 `00:00:00`；进入 warningThreshold 后整体变 `--color-state-warn`；归零后变 `--color-state-err`。

#### D.3.32 AppShell / Rail / Workspace（Layout 三件套）

```ts
interface AppShellProps {
  rail?: ReactNode;                         // 桌面端 Rail
  topbar?: ReactNode;                       // 移动端顶部栏
  bottomNav?: ReactNode;                    // 移动端底部导航
  children: ReactNode;                      // Workspace 内容
}
interface RailProps {
  brand: ReactNode;                         // 品牌 + 折叠按钮（展开态可见，折叠态隐藏）
  cmd?: ReactNode;                          // 命令搜索 trigger
  navItems: Array<{
    id: string;
    icon: ReactElement;
    label: string;
    href: string;
    active?: boolean;
  }>;
  me: ReactNode;                            // 用户区
  collapsed?: boolean;                      // 受控折叠态；不传则受 localStorage + 断点默认控制
  onCollapseChange?: (v: boolean) => void;
  /**
   * 折叠态规则（C.4.3 落地）：
   * - Toggle 按钮 (IconRailToggle) 仅在展开态显示
   * - 折叠态：整个 brand 区作为可点击展开触发，hover 显示 Tooltip
   * - 折叠 Logo 必须居中（与 nav-btn 图标垂直对齐）
   * - 快捷键 Ctrl/Cmd+\ 全场景触发，由 KeyboardShortcuts (D.3.34) 注册 global scope
   * - 持久化：localStorage['v5-rail-collapsed']
   */
}
interface WorkspaceProps {
  maxWidth?: 'workspace' | 'reading' | 'form' | 'prose' | 'none';
  children: ReactNode;
}
```

强制规则：所有桌面页面**必须**用 `<AppShell>` 包裹，禁止业务页面手写 Rail+main 结构。Rail 的 `navItems` 顺序固定为 [首页, 练习, 复盘, 笔记]；Me 入口仅由 RailMe 提供，不允许业务侧重排。

#### D.3.33 Panel / PageHeader / Section（容器三件套）

```ts
interface PanelProps {
  title?: string;
  trailing?: ReactNode;                     // panel-tabs / icon-btn / 链接
  children: ReactNode;
  noPadding?: boolean;                      // body 是否带 padding
  variant?: 'default' | 'danger';           // danger 边框红
}
interface PageHeaderProps {
  title: string;                            // h2 主标题
  subtitle?: string;                        // 副标
  breadcrumb?: ReactNode;                   // <Breadcrumb /> 实例
  actions?: ReactNode;                      // 右侧按钮组
}
interface SectionProps {
  title?: string;                           // 可选 h3
  children: ReactNode;
  spacing?: 'sm' | 'md' | 'lg';             // 与上下其他 Section 间距
}
```

#### D.3.34 a11y / 系统层（VisuallyHidden / FocusTrap / Divider / KeyboardShortcuts）

```ts
interface VisuallyHiddenProps {
  children: ReactNode;                      // 仅屏幕阅读器读，视觉隐藏
}
interface FocusTrapProps {
  active: boolean;
  initialFocus?: RefObject<HTMLElement>;
  returnFocus?: boolean;                    // 关闭后焦点回到触发元素
  children: ReactNode;
}
interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'subtle' | 'default' | 'strong';   // 对应 border-* token
  inset?: boolean;                          // 横向时缩进 padding
}
interface KeyboardShortcutsProps {
  shortcuts: Array<{
    keys: string[];                         // ['Ctrl', 'K'] / ['n']
    handler: (e: KeyboardEvent) => void;
    scope?: 'global' | 'page' | 'modal';    // 受 FocusTrap 影响
    description: string;                    // CommandPalette 索引用
  }>;
}
```

`<Modal>` / `<Sheet>` / `<Drawer>` 必须内置 `<FocusTrap active>`；Esc 关闭由 KeyboardShortcuts 在 modal scope 注册。

#### D.3.35 实施级 gotcha 清单（避免重复踩坑）

以下规则不直接由 prop API 表达，但实施时必须遵守：

- **Input 强制 `box-sizing: border-box`**：浏览器 user-agent stylesheet 把 `<input>` 默认 `content-box`，覆盖全局 `* { box-sizing: border-box }`。`<Input>` / `<Textarea>` / `<Select>` 内部 CSS 必须显式 `box-sizing: border-box`，否则 `width: 100%` + padding + border 会撑出父容器，撞到右邻居。
- **Input 默认 `min-width: 0`**：grid / flex 子项里的 `<input>` 默认 `min-width` 受 `size` HTML 属性影响（≈ 20ch ≈ 256px），即使外层 grid 列只有 200px 也会溢出。强制 `min-width: 0` 让 grid item 收缩。
- **`button` 标签清零样式**：浏览器默认 `<button>` 带 native border / background / font-family，必须在组件根处 `background: none; border: 0; font: inherit; cursor: pointer;`。
- **`<a>` 标签默认 underline**：rail-btn / list-item 用 `<a>` 时必须 `text-decoration: none`，仅在内容中的 link 文字保留。
- **触屏 hover 残影**：所有 `:hover` 视觉规则必须包裹 `@media (hover: hover) and (pointer: fine)`，否则触屏点击后 hover 状态卡住到下次点击。
- **Modal / Drawer body scroll lock**：打开时必须给 `<body>` 加 `overflow: hidden` + 计算 scrollbar 宽度补偿；关闭时还原。否则打开 Modal 后下层页面可滚动。
- **Note 详情容器固定 Drawer，不允许 Modal**（R2/Q1 决策）：Note 笔记详情含富文本编辑，Modal 默认 max 640px 太窄；必须用 `<Drawer side="right" size="lg">`，移动端自动转 `<Sheet side="bottom">`。直觉上想用 Modal 是错的。
- **Exam 不复用 SaaS Shell**：进入 Exam 是切 layout，不是折叠 Rail。禁止在 Exam 内嵌 `<AppShell>` / `<Rail>`；详见 §D.4.6。



V5 页面骨架以 `.tmp_review/out/Home v2.1.html` / `Practice v1.html` / `Note v2.1.html` / `Me v1.html` 等已敲定原型为事实来源。所有页面共用一个**桌面端 SaaS Shell**：

```
<AppShell display=flex>
├─ <Rail w=var(--rail-w)/>               ← 左侧固定 240px / 折叠 80px
│   ├─ <RailBrand>                        SIKAO logo + 折叠按钮
│   ├─ <RailCmd>                          命令搜索（Cmd/Ctrl+K）
│   ├─ <RailNav>                          首页 / 练习 / 复盘 / 笔记
│   └─ <RailMe>                           avatar entry (我的)
└─ <Workspace flex=1 padding=var(--space-4) var(--space-5)>
    └─ <CSS Grid>                         不同页面 grid-template-rows 不同
        ├─ <Topbar h=var(--topbar-h)>     greeting + 操作区
        └─ <Panels…>                      panel × N，每个 panel 自带 head（含 panel-tabs）
```

Rail 折叠规则详见 §C.4.3（多分辨率精细规则取代 V4 的"max-width 1180 一刀切"）。

**移动端**：所有页面在 `--bp-md` 以下隐藏 Rail，改用底部 Tab Bar（玻璃拟态 + 自动降级，对应 Q4 决策）；移动端容器树由独立的"移动端 Shell spec"承担，本节聚焦桌面端。

#### D.4.1 Home（4 行 Grid · metric × 4 + Calendar + 底栏 3 卡片）

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

模块间距 `--space-4`；calendar `panel-head` 高度 50px（与 metric-card 视觉对齐）。Q2 决策"N=4"在桌面端体现为 metric-row 4 卡 + 底栏 3 卡的对称感（顶部 4 大指标，底部 3 个二级模块）。

#### D.4.2 Practice（4 行 Grid · 行测/申论 scope）

```
<Workspace grid-template-rows="topbar-h | minmax(0,224px) | minmax(0,1fr) | minmax(0,1fr)">
├─ <Topbar>
│   ├─ <Greet>                            "练习中心" + scope 副标
│   ├─ <ScopeToggle pill>                 "行测 / 申论" segmented control
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

ScopeToggle = pill 形 segmented control（V4 已有，V5 沿用）；`@media (max-height: 800px)` 时 row1 自动收紧到 192px（已在 Practice v1 原型中验证）。

#### D.4.3 Note（3 行 Grid · filter-bar + sub-bar + sticky 卡片墙）

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

**详情交互**：点击卡片打开 `<Drawer side="right" size="lg">`（按 R2/Q1 决策：Drawer 替代 Modal——Note 详情含富文本编辑，宽度 480-640px 比 Modal 的 640 上限更适合，且左侧仍可见笔记墙作上下文）。详情容器走 D.3.21 Drawer prop API；移动端自动转 `<Sheet side="bottom">`。

#### D.4.4 Me（4 行 Grid · Hero + 设置 + 危险操作）

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

Hero 与左下两卡之间 `--space-4`；danger panel 强制 `grid-column: span 2`，跨满底行。danger list-card 左侧 4px `--color-state-err` 条 + 全行 err 文字色（仅在 danger panel 内生效，不污染普通 list-card）。

#### D.4.5 Question Hub / Review

```
<Workspace grid-template-rows="topbar-h | auto | minmax(0,1fr)">
├─ <Topbar>
├─ <FilterBar>                              chips 多选：科目 / 题型 / 错题状态
└─ <Panel>
    └─ <Grid cols=3 gap=space-3>
        └─ compact-card                     题号 + cat-* badge + 状态 icon
```

Question Hub 用 `--card-radius-sm` (12px) 提升信息密度；与 Practice 的 specialty-grid 区分（specialty 用大网格 4 列，Hub 用紧凑 3 列）。

#### D.4.6 Exam-Shenlun / Exam-Xingce（仅 token 钩子，REQ-9.5 / Q5）

**强约束**：Exam **不使用 SaaS Shell**——无 Rail / 无 SaaS Topbar / 不复用 AppShell；Exam 是**独立 layout**，由 ExamTopBar + 双栏 PanelGroup + Sheet 组成。这条约束源自 §C.4.3 列数稳定规则的例外，在此处显式声明，避免实施时把 Rail 套上去。

```
<ExamLayout>
├─ <ExamTopBar h=topbar-h>          计时器 / 暂停 / 字号切换 / 退出
├─ <PanelGroup direction="horizontal">
│   ├─ <Panel padding=var(--exam-pane-padding)>
│   │   <MaterialPanel />
│   ├─ <ResizeHandle w=var(--exam-divider-handle-w)>
│   └─ <Panel padding=var(--exam-pane-padding)>
│       <QuestionPanel />
└─ <Sheet>                           草稿纸（z-modal）
```

V5 在此处只定义：
- `--exam-pane-padding: var(--space-4)`
- `--exam-divider-handle-w: 4px`
- `--exam-topbar-h: var(--topbar-h)`

具体交互（拖拽 resize、计时器、状态机）由独立"考试设计 spec"承担。

### D.5 Mobile Shell（移动端骨架与 token 钩子）

V4 完全没定义移动端，V5 必须 cover。Mobile Shell 在 `--bp-md`（768px）以下生效，与桌面 Shell 共用所有 token 但布局不同。

#### D.5.1 Mobile-only 组件 token

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

#### D.5.2 移动端 AppShell 骨架

```
<MobileAppShell display=grid grid-template-rows="topbar | 1fr | bottom-nav">
├─ <MobileTopBar h=mobile-topbar-h padding-top=safe-top>
│   ├─ <BackBtn / BurgerBtn>             返回箭头 / 折叠菜单
│   ├─ <Title>                            页面标题
│   └─ <Action>                           主操作 icon-btn / 主 CTA（可省略）
├─ <Workspace overflow=auto padding-inline=safe-left/right>
│   └─ 业务内容（单列纵向，紧凑档间距）
└─ <BottomTabBar h=mobile-bottom-nav-h padding-bottom=safe-bottom>
    └─ 4 个 tab：首页 / 练习 / 复盘 / 笔记
        玻璃拟态 + 自动降级（Q4 决策）；我的入口独立于 navItems
```

`<BurgerBtn>` 触发的抽屉 = `<Drawer side="left" size="sm">` 内嵌 Rail 内容，与桌面 Rail 复用 navItems。

#### D.5.3 移动端 Home

```
<Workspace>
├─ <Greet card=stat-card>                早上好，lhr + 倒计时
├─ <MetricStrip horizontal-scroll>        4 个 metric 横滑（不再 4 列展开）
├─ <Section "今日任务">                    list-card 纵向
├─ <Section "本周进度">                    单 stat-card
└─ <Section "推荐套题">                    horizontal-scroll · media-card
```

#### D.5.4 移动端 Practice

```
<Workspace>
├─ <ScopeToggle full-width>               行测 / 申论
├─ <QuickGrid cols=2>                     4 个 quick-card 2×2
├─ <Section "专项">                        compact-card 2 列网格
└─ <Section "套卷">                        list-card 纵向
```

#### D.5.5 移动端 Note

```
<Workspace>
├─ <FilterBar overflow-x=auto>            chip-group 横向滚动
├─ <SubBar>                                计数 + 视图切换
└─ <NotesGrid cols=2 gap=space-3>         sticky 卡片 2 列（保留微旋转）
```

#### D.5.6 移动端 Me

```
<Workspace>
├─ <MeHero card=stat-card vertical>       avatar + 信息 纵向，3 stats 横排
├─ <Section "学习设置">                    list-card
├─ <Section "账号">                        list-card
└─ <Section "危险操作">                    list-card variant=danger
```

#### D.5.7 平板 (768–1023px) 行为

平板视口介于移动与桌面：
- 顶部用 Mobile TopBar 但保留更多操作（搜索条不折叠到 burger）。
- 底部用 BottomTabBar（与移动端共用）。
- 内容区双列允许（如 Note 用 2 列、Me 用 2 列分组），但仍紧凑档间距。
- Practice 4 列网格降到 2 列，避免每卡 < 160px。

## Error Handling

### E.1 玻璃拟态 fail-fast 例外（Q4 决策对应）

**默认实现**：
```css
.bottom-nav {
  background: rgba(255, 255, 255, .55);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
}
```

**自动降级**（视为唯一允许的 fallback，已在 requirements §7.1 登记）：
```css
@supports not (backdrop-filter: blur(1px)) {
  .bottom-nav { background: var(--color-bg-elevated); }
}
@media (prefers-reduced-transparency: reduce) {
  .bottom-nav {
    background: var(--color-bg-elevated);
    backdrop-filter: none;
  }
}
```

**禁止的处理方式**：
- silent catch（背景色取错时无声忽略）。
- `?? defaultValue` 把 backdrop-filter 写成可选字符串。
- 在业务组件里手写 fallback 而不走 token。

例外账本字段：name / 位置 / 默认行为 / 降级触发 / 降级目标 / 负责人 / 复审日期，按 `docs/engineering/fail-fast-exceptions.md` 既有格式登记。

### E.2 Token 引用错误处理

**禁止的写法**：
```tsx
// ❌ silent fallback
<div style={{ background: theme.bg ?? '#fff' }} />
// ❌ try-catch 屏蔽 token 缺失
try { return getToken('--card-radius'); } catch { return 16; }
```

**正确写法**：
```tsx
// ✅ token 缺失时让 CSS 直接报红
<div style={{ background: 'var(--color-bg-surface)' }} />
// ✅ 用 PostCSS plugin 在构建期校验未定义 token
```

### E.3 数据缺失的可视化降级

| 场景 | 处理 |
|---|---|
| 数字加载中 | `<Numeric>` 渲染 `<Skeleton variant="text" width="3ch" />` |
| 列表为空 | `<list-card>` 内嵌 `<EmptyState illustration="no-data">` |
| 列表请求失败 | `<list-card error>` + 重试按钮，禁止静默置空 |
| 图标缺失 | 渲染占位方块 + 控制台警告，禁止 emoji 兜底（lint：`lint-no-emoji-as-icon.mjs`） |

## Testing Strategy

### T.1 Lint Gates Traceability（REQ-11.2）

| Lint 脚本 | 关联 REQ | 检测内容 | 状态 |
|---|---|---|---|
| `lint-hardcode.mjs` | REQ-1.1 / REQ-2.7 | hex / rgb() / rgba() 字面量 | 沿用 |
| `lint-radius-token.mjs` | REQ-3.5 | hardcoded `border-radius` | 沿用 |
| `lint-shadow-token.mjs` | REQ-6.4 | hardcoded `box-shadow` 字面量 | **新增** |
| `lint-zindex-token.mjs` | REQ-6.4 | hardcoded `z-index: <num>` | **新增** |
| `lint-spacing-token.mjs` | REQ-4.5 | `padding/margin/gap` 上的硬编码 px / rem | **新增** |
| `lint-italic.mjs` | REQ-5.4 / REQ-5.7 | CJK 节点 italic | 沿用 + 扩展 Tailwind 类与 inline style |
| `lint-no-emoji-as-icon.mjs` | REQ-1.1（图标契约） | emoji 用作图标 | 沿用 |
| `lint-practice-svg-only.mjs` | REQ-1.1（图标契约） | 非 SVG 图标资源 | 沿用 |
| `lint-icon-button.mjs` | REQ-8.3 / D.3.1 | icon-only 按钮缺 aria-label | 沿用 |
| `lint-icon-style.mjs` | C.4.1 / C.4.2 | SVG 风格统一（viewBox / stroke-width / fill / linecap）+ 尺寸取自 token | **新增** |
| `lint-touch-target.mjs` | REQ-10.1 / Property 9 | 触屏命中区 ≥ 40px / hover 必须在 hover-capable 媒体查询内 | **新增** |
| `lint-cn-simplified.mjs` | REQ-10.5 | 简体中文校验 | 沿用 |
| `lint-ui-copy-ssot.mjs` | REQ-10.5 | UI 文案取自 SSOT | 沿用 |
| `lint-v4-token-residual.mjs` | REQ-12.2 | V4 token 在过渡期满后的残留扫描 | **新增** |
| **人工 review 兜底** | REQ-7.6 / REQ-9.7 / REQ-10.4 | 卡片视觉示例齐全、容器树齐全、动效场景表 | 无自动化（REQ-11.3） |

### T.2 V5 自检报告模板（REQ-11.4）

V5 规范文档提交时附带 `apps/web/v5-baseline-report.md`，对 V4 现存 `out/*.html` 跑一遍 V5 lint 集，记录基线违规数。模板：

```markdown
# V5 Baseline Report
Date: 2026-05-23
Commit: <sha>

## 扫描范围
.tmp_review/out/*.html (10 文件)

## 违规统计
| Lint | 违规数 | 主要文件 |
|---|---|---|
| lint-hardcode | <n> | … |
| lint-radius-token | <n> | … |
| lint-spacing-token | <n> | … |
| ...

## Top 5 修复优先级
1. ...

## 迁移阻塞（blocking）
- ...
```

### T.3 视觉与交互验证

| 场景 | 工具 | 命令（占位） |
|---|---|---|
| 视觉示例齐全 | `.tmp_review/v5-design-preview.html` 浏览器人工 review | 直接打开 |
| 卡片状态机 9 态 | playwright + axe（tasks 阶段加） | `pnpm --filter web test:visual` |
| 对比度 ≥ 4.5:1 | axe-core 自动 | `pnpm --filter web test:a11y` |
| `prefers-reduced-motion` | playwright emulate | 跑 a11y suite 时附加 |
| dev server 端口 | hardcoded 18080（H10） | `pnpm --filter web dev` |

### T.4 迁移期校验流程

1. V5 token 落地（tasks 阶段第一批）+ V4 token 标 `@deprecated`。
2. 双轨期 2 周内：所有新增代码必须用 V5 token；改动既有页面时整页切换（不允许局部混用）。
3. 过渡期满（2026-06-06）：Verifier 跑 `lint-v4-token-residual.mjs`：
   - 0 引用 → 删除 V4 token，关闭 spec。
   - 仍有引用 → 列出残留位置，禁止删除 V4 token，blocked 直至迁移完成。

## Correctness Properties

V5 规范在落地与运行期必须始终满足以下不变性（任意一条违反都视为缺陷，不靠规约对齐而是靠实证 / lint / 测试持续校验）：

### Property 1: Token Single Source Invariant
- **Validates: Requirements 1.1, 2.7, 3.5, 4.5, 6.4**
- **不变性 (CP.1)**：`apps/**/src/**` 内不出现任何 hex / rgb() / rgba() / `box-shadow:` 字面量 / `z-index: <num>` / `border-radius: <hardcoded>` / `padding|margin|gap` 上的硬编码 px / rem。
- **校验**：`lint-hardcode` / `lint-radius-token` / `lint-shadow-token` / `lint-zindex-token` / `lint-spacing-token` 任一报错即违反。

### Property 2: Theme Switching Stability
- **Validates: Requirements 1.4, 1.5**
- **不变性 (CP.2)**：light ↔ dark 切换时，primitive 与 component 层数值不变；只 semantic 层切换。
- **校验**：构建期 diff `tokens.css` 中 `:root` 与 `.dark` 的 key 集合，必须完全一致；diff 出现 primitive / component key 即违反。

### Property 3: Nested Radius Difference
- **Validates: Requirements 3.4, 7.5**
- **不变性 (CP.3)**：任意"卡片包卡片"渲染中，外层圆角 ≥ 内层圆角，且差值 ≥ 4px。
- **校验**：人工 review + 视觉预览（`.tmp_review/v5-design-preview.html` §D.1 嵌套示例）。

### Property 4: CJK No-Italic Invariant
- **Validates: Requirements 5.4, 5.7**
- **不变性 (CP.4)**：含 CJK 字符的节点不携带 `italic` / `<i>` / `font-style: italic` / Tailwind `italic` 类。
- **校验**：`lint-italic.mjs`（V4 沿用 + V5 扩展覆盖）。

### Property 5: SVG-Only Icon Invariant
- **Validates: Requirements 1.1, 8.6**
- **不变性 (CP.5)**：所有视觉图标承载用 SVG；emoji / icon-font / 图片字体禁止用作图标。
- **校验**：`lint-no-emoji-as-icon.mjs` + `lint-practice-svg-only.mjs`。

### Property 6: Focus Visibility Invariant
- **Validates: Requirements 2.6, 10.1, 10.7**
- **不变性 (CP.6)**：所有 `tabIndex >= 0` 元素在 `focus-visible` 下必须可见 ring（取自 `--color-focus-ring`），且与 paper-1 / ink-1 同时满足 4.5:1。
- **校验**：playwright 跑键盘导航 + axe 检查（tasks 阶段补 e2e）。

### Property 7: Glassmorphism Fallback Closure
- **Validates: Requirements 8.4**
- **不变性 (CP.7)**：BottomNavigation 在 `@supports not (backdrop-filter)` 与 `prefers-reduced-transparency: reduce` 下必须降级到不透明 `--color-bg-elevated`，**不允许出现透明背景下文字与下层内容重叠不可读**。
- **校验**：playwright 模拟 `prefers-reduced-transparency` + 截图回归对比 + 人工 review。

### Property 8: V4 Token Residual Convergence
- **Validates: Requirements 1.6, 12.1, 12.2**
- **不变性 (CP.8)**：过渡期满（2026-06-06）后，`apps/**/src/**` 与 `packages/design-system/src/tokens.css` 内不再出现任何 V4 token 名（如 `--paper-*` / `--ink-*` / `--brand-yellow` / `--r-card` / `--sp-*` / `--t-*` / `--h-xs..lg`）。
- **校验**：`lint-v4-token-residual.mjs` 必须 0 命中。

### Property 9: Hover-Touch Affordance
- **Validates: Requirements 8.1, 10.1**
- **不变性 (CP.9)**：所有 `:hover` 视觉规则（card hover 上浮、按钮 hover 变色、Tooltip 悬浮提示、自定义滚动条）必须包裹在 `@media (hover: hover) and (pointer: fine)` 之内；触屏（`pointer: coarse`）下：
  - 不渲染 hover 残影；
  - Tooltip 改为长按 700ms 触发 Sheet；
  - 所有可点击元素（按钮 / icon-btn / list-row / chip）实际命中区 ≥ 40×40 px（用透明 padding 扩展或显式 min-height）。
- **校验**：`lint-touch-target.mjs`<sup>新</sup> 扫描组件源码中 `:hover` 选择器是否在 hover-capable 媒体查询内 + e2e 测试在触屏 emulate 下命中区 ≥ 40px。

### Property 10: Multi-device Continuity
- **Validates: Requirements 4.1, 4.4, 9.1, 9.2, 9.3, 9.4, 9.5, 10.6**
- **不变性 (CP.10)**：从 `--bp-xs`(0) 到 `--bp-3xl`(1920+) 全部断点下，所有页面：
  - 不出现横向滚动条（除非业务显式 horizontal-scroll 容器）；
  - 不出现关键内容被裁剪、按钮被遮挡、文字与下层重叠；
  - Safe area 在移动端 ≥ 0px 时所有 fixed 元素正确避让；
  - Workspace 在 `--bp-3xl` 自动 max-width 居中。
- **校验**：playwright 跑 6 档断点（375 / 480 / 768 / 1024 / 1440 / 1920）下 Home / Practice / Note / Me 4 页 + 3 个 Modal 的截图回归对比；视觉差异 > 5% 即违反。

## Glossary

- **Primitive / Semantic / Component**：token 三层架构（见 §A.1）。
- **paper / ink / line**：V4 沿用的"纸面 / 墨色 / 分隔线"分层语义；V5 已在 §C.6 mapping 表中重命名为 `--color-bg-* / --color-text-* / --color-border-*`，但人类讨论仍可继续使用旧名作 shorthand。
- **categorical color**：题型分类色板（`cat-yanyu / cat-shuliang / cat-panduan / cat-ziliao / cat-shenlun`），与语义色严格隔离。
- **floating shell**：仅当 App 整体悬浮在视口内（不贴边）时才使用的容器圆角档（`--card-radius-lg`）。
- **fail-fast 例外**：经登记后允许的降级路径，必须有 marker 注释 + 账本登记。
- **breakpoint**：xs/sm/md/lg/xl/2xl/3xl 七档断点（0/480/768/1024/1280/1536/1920），见 §C.4.1。
- **safe area**：iPhone 刘海 / Home Indicator / Android 导航栏占用的物理区域，用 `--safe-*` token 避让。
- **hover-capable / pointer:fine**：能精确指向的输入设备（鼠标 / trackpad）；触屏（pointer:coarse）不属于此类，hover 视觉必须包裹在 `@media (hover: hover) and (pointer: fine)` 内。
- **AppShell / Rail / Workspace / Panel**：Layout 三件套，见 §D.3.32–D.3.33；所有桌面页面必须用 AppShell 包裹。
- **OptionItem / QuestionStem / AnswerSheet / TimerDisplay**：答题系统业务专属组件，见 §D.3.28–D.3.31。

