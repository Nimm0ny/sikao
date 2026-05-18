---
type: product
status: draft
owner: lhr
last-reviewed: 2026-05-19
---

# Design System

> 详见 [[Frontend]] 与 `packages/design-system/README.md`。

## 完整规范

- **HTML 规范（权威）**：[Frontend Style Guide.html](./Frontend%20Style%20Guide.html) — 2026-05-19 蓝白主色修订，按《新前端规范落地计划》落地
- **中文工程化补充**：本文档 + [[Web-Layout]] / [[Mobile-Layout]] / [[Tablet-Layout]]
- **设计原型参考**：`design/`（仓库根，14MB，从 new_web/design/ 镜像；详见 `design/README.md`）

## SSOT

`packages/design-system/src/tokens.css`（单一权威源，CLAUDE.md §4 硬约束）。运行时由 `apps/web/src/styles/tokens.css` 作 shim 通过 `@import "@sikao/design-system/tokens.css"` 注入 React app；该 shim 仅一行 import，R2 删除（届时 `apps/web/src/index.css` 直接 import design-system 包）。

## Token 类别

- **主色规则**：白 + 蓝为主，黑灰做点缀。蓝色承担主 CTA / 当前选中 / active / focus / link；黑灰承担正文、题干、边框和弱状态。禁止把正文整片刷蓝。
- **paper**：`--paper-1` (#FFFFFF) / `--paper-2` (#F7F9FC) / `--paper-3` (#EEF2F7)
- **ink**：`--ink-1` (#111827) / `--ink-2` (#374151) / `--ink-3` (#6B7280) / `--ink-4` (#9CA3AF)
- **line**：`--line-1` (#E5E7EB) / `--line-2` (#D1D5DB) / `--line-3` (#CBD5E1)
- **accent**：`--accent-1` (#2563EB) / `--accent-2` (#1D4ED8) / `--accent-50` (#EFF6FF)
- **semantic**：`--ok` (#15803D) / `--ok-50` (#F0FDF4) / `--warn` (#D97706) / `--warn-50` (#FFFBEB) / `--err` (#DC2626) / `--err-50` (#FEF2F2)
- **dark**：深蓝黑夜间模式，非反相；`--paper-1` (#0F172A) / `--paper-2` (#111827) / `--paper-3` (#1E293B) / `--accent-1` (#60A5FA)
- **spacing 9 档**：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- **shadow 2 档**：`--shadow-card` / `--shadow-pop`
- **radius 7 档**：`--r-1` (2) / `--r-tiny` (4) / `--r-2` (6) / `--r-card` (10) / `--r-card-lg` (14) / `--r-pill` (999)
- **type scale 8 档**：display 44 / h1 32 / h2 24 / h3 18 / body 14 / small 13 / meta 12 / tiny 11
- **letter-spacing 7 档**：tight / normal / loose / eyebrow / wide / wider / widest

## 详细规范（从 CLAUDE.md §4 下沉）

> CLAUDE.md 保留 token 名 / 七档 radius / 8 档 type scale 标题表 + lint 命令名 + 一句话铁律。
> 反模式列表、例外白名单、巡检实现、Escape hatch 等"参考材料"在此。
> **必读触发条件**：处理前端视觉改造 phase / 写新组件涉及圆角 italic 字号 / 修改 lint 脚本前。

### 圆角组件 SSOT 反模式与例外

**触发返工的反模式**：

- ❌ Home 上半部 Card 圆角 + 下半部 paper grid 直角（混用）
- ❌ 有些 Chip 用 `rounded-md`（Tailwind 默认）+ 有些用 `rounded-pill`（token 999px）→ 字符不同，后续 token 改值会撕裂
- ❌ Modal `rounded-lg`（Tailwind 默认）而不是 `rounded-card-lg`（token）
- ❌ Button 用 `rounded-card`（10px）而不是 `rounded-tiny`（4px）

**audit 步骤**：每次 view 完成后，master agent 必须 `grep "rounded-" view + 子组件`，确认全用 token 名（`rounded-1` / `rounded-tiny` / `rounded-2` / `rounded-card` / `rounded-card-lg` / `rounded-pill`），0 命中 Tailwind 默认（`sm/md/lg/xl/2xl/3xl/full`）且 0 任意值。**自动化**：`npm run lint:radius-token`（实现 `apps/web/scripts/lint-radius-token.mjs`）。CI 0 命中。

**例外**（lint 不报）：小圆点 / spinner / Skeleton 内部 ≤16px 的 `rounded-full` 视为合法 dot pattern。必须满足 (1) 元素显式宽高 ≤16px（e.g. `w-3.5 h-3.5` / `w-2 h-2`）(2) 元素附 `data-pattern="dot"` 显式 marker。二者缺一即违规。**首选**仍是 `rounded-pill` token（值等效，命名一致）。**Escape hatch**：行尾 `// radius-allow: <reason>` 跳过本行（跟 `hardcode-allow` 同款）。

### italic 政策三类例外详述

默认禁止 `italic` / `font-italic` / `font-style: italic`（跟 `font-serif` 解耦）。三类例外允许：

1. **serif 数字强调** —— 大数字（StatCallout / ScoreRing / Badge.count / ExamCountdownCard / WrongQuestionDetail consecutiveCorrectCount 等）走 `font-serif italic` 是 design signature（D2c, 2026-05-08 lhr 授权）。实例 ~30+ 处由 design system primitive 内嵌。
2. **ASCII editorial 符号** —— `← → + − × /` 等单字符 ASCII（Breadcrumb 分隔符 / ResultActions 箭头 / error-404.svg 状态码）当 editorial 排版传统（D3a）。
3. **error page SVG illustration** —— `apps/web/src/assets/illustrations/error-{404,500}.svg` 内 `<text>` 节点 italic（§4.1 第 2 条已点名）。

**CJK 字符（中文 / 日文 / 全角标点）禁 italic**，包括 design treatment 不算例外。中文 title 想要 editorial 调性走 `font-serif` 不带 `italic`（落到 Songti SC / Noto Serif SC，见 §4.1 扩规）。表强调走 `font-weight` + 字号 + serif（大数字），见 §4.2 字号阶梯。

**巡检自动化**：`npm run lint:italic`（实现 `apps/web/scripts/lint-italic.mjs`）。用 ripgrep 抓 `italic` / `font-italic` className，解析 JSX 子节点字符：命中 CJK Unified Ideographs（U+4E00-U+9FFF）/ CJK Symbols and Punctuation（U+3000-U+303F）/ Halfwidth and Fullwidth Forms（U+FF00-U+FFEF）即报错。三类例外（数字 / ASCII 符号 / error svg）自动 whitelist。CI 0 命中。Escape hatch：行尾 `// italic-allow: <reason>`。

### Type scale 8 档完整表

字号阶梯**必须**从 8 档 token 中选，禁止 `text-[Npx]` 任意值（`lint:hardcode` 巡检）：

| Token | px | 用途 | 字体 |
|---|---|---|---|
| `--t-display` | 44 | 营销 hero / cover h1 | Source Serif 4 600, letter-spacing -0.01em |
| `--t-h1` | 32 | 页面主标题 | Source Serif 4 600 |
| `--t-h2` | 24 | 区块标题 | Source Serif 4 600 |
| `--t-h3` | 18 | 卡片标题 | Source Serif 4 600 |
| `--t-body` | 14 | 正文 / button | Inter 400, line-height 1.55 |
| `--t-small` | 13 | 次要正文 / button label | Inter 400 |
| `--t-meta` | 12 | meta 信息 / code chip | Source Serif 4 italic / JetBrains Mono |
| `--t-tiny` | 11 | tiny uppercase label | Source Serif 4 italic, tracking 0.06em |

> **变更说明**（2026-05-12 Frontend Style Guide v1）：type scale 全站压缩 ~45%（h1: 56→32 / display: 88→44），跟新规范字号阶梯对齐。PR1 落 token + tailwind utility，PR2 grep-replace 旧名。

### Letter-spacing 7 档完整表

| Token | 值 | Tailwind utility | 用途 |
|---|---|---|---|
| `--tracking-tight` | `-0.02em` | `tracking-tight` | h1-h2 大字 collapse |
| `--tracking-normal` | `0` | `tracking-normal` | 正文默认 |
| `--tracking-loose` | `0.06em` | `tracking-loose` | **caption / 数字微宽**（2026-05-08 lhr 授权新增，audit 25 处 `[0.06em]` 任意值合法落点） |
| `--tracking-eyebrow` | `0.08em` | `tracking-eyebrow` | eyebrow 区块前缀 |
| `--tracking-wide` | `0.10em` | `tracking-wide` | 强 eyebrow / 弱 caps |
| `--tracking-wider` | `0.12em` | `tracking-wider` | meta tag 加宽 |
| `--tracking-widest` | `0.14em` | `tracking-widest` | 极加宽（marketing） |

**禁止** `tracking-[Nem]` 任意值（已在 `lint:hardcode` 巡检）。加 token 必须三处同步（tokens.css / colors_and_type.css / design/tokens.css）+ tailwind.config.js `letterSpacing` extend + 本表登记。

### 答题系统按钮 SVG-only 详述

**适用范围**：行测（`/practice/xingce/...`）+ 申论（`/essay/...`）+ 答题相关 result（`/result/...`）view 内的所有 **toolbar / topbar / option-actions / dock / drawer / 工具按钮 / IconBtn**。

**反模式**（出现即返工）：

- ❌ `<button>答题卡</button>` 在 FbTopbar
- ❌ `<button><Icon/> 收藏</button>` 在 FbCard 操作条
- ❌ `<button>📝 笔记</button>` emoji 当图标
- ❌ Tooltip 用 `title="..."` 而不是 design system `<Tooltip>` primitive
- ❌ IconBtn 缺 `aria-label`

**lint 巡检**：新增 `npm run lint:practice-svg-only`（实现 `apps/web/scripts/lint-practice-svg-only.mjs`），针对 `apps/web/src/views/practice/**` + `apps/web/src/views/essay/**` + `apps/web/src/components/practice/**` + `apps/web/src/components/essay/**` 路径的所有 `<button>` / `<IconBtn>` / `[role="button"]`：(a) 必须含 `<svg>` 子节点 (b) 不允许直接 textContent 是 CJK / 半角中文字符 (c) 必须带 `aria-label` 属性。CI 0 命中。Escape hatch：行尾 `// svg-only-allow: <reason>`（用于主 CTA / dialog / modal 例外）。

### 文案 SSOT 详述

所有 empty / error / toast / placeholder / aria-label 文案**必须**来自 `apps/web/src/lib/ui-copy/`（已就位 7 namespace ~320 行：EMPTY / ERROR / BYOM / LLM_QA / ESSAY / ESSAY_GRADING / AUTH / OFFLINE）。

- ❌ view 内联中文超过 4 字符（非来自 `@/lib/ui-copy` import）= 阻塞 PR
- ✅ Marketing landing / `<title>` 节点 / 测试文件白名单豁免
- **巡检**：`npm run lint:ui-copy-ssot`（PR4 落地，初期 `--warn-only`，PR5 转 error）

## 状态

`partial` — token CSS 已收敛到 `packages/design-system/src/tokens.css`（2026-05-13 落地）；`apps/web/src/styles/tokens.css` 改 shim 完成；R2 清理 shim + 收敛 alias 兼容层。
