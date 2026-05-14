# SIKAO · Archived Implementation Brief for Claude Code

> **Status**: archived/source-only. This file records the older SIKAO handoff and is
> not an active visual SSOT. Current active rules are `docs/design/style-guide.md`,
> `docs/plan/sikao-landing-master-plan-2026-05-09.md`, and the root token SSOTs.
> When this file conflicts with those documents, the active SSOTs win.
>
> **Active module SSOT**: `modules/{xingce-exam,xingce-wrongbook,essay-specialty,notes,sikao-redesign}/` + `docs/plan/sikao-module-*-2026-05-11.md`.

## Project
公考备考产品 SIKAO 的全栈重设计落地。slogan：**让备考从刷题变成思考**。
受众：22–35 岁上班族 / 在校生。气质：ink-first · 留白 · 克制陪伴，蓝色只作 accent，
反对花哨配色和卡片大圆角。

## Tech baseline (建议，可调整)
- Next.js 14 App Router · TypeScript · Tailwind 关掉默认 reset，CSS Variables 作 token 唯一源
- 字体：Source Serif 4 (display) · Inter (UI) · JetBrains Mono (numerals) · Noto Serif SC (中文衬线 fallback)
- 图标：自绘的 1.4–1.5px 描边 SVG（参考 HTML 内 `.icon-btn svg`），不引入 lucide / heroicons

## 目录约定
```
app/
  (marketing)/page.tsx              ← 落地页
  (auth)/login | register
  (app)/dashboard | plan | xingce | essay | result | wrongbook | profile
components/
  ui/                  ← Button / Chip / IconBtn / Card / Rail
  practice/            ← FbCard, FbDock, FbPassage, FbOpt（行测列表式）
  essay/               ← EssayGrid, ScratchPad, MaterialPanel, EditorPanel, MmStrip
  dash/                ← MetricCard, PlanRow, AsideCard, CalWeek
styles/
  tokens.css           ← 直接搬 design/tokens.css，不要重写
  globals.css          ← base + .serif/.sans/.mono utilities
```

## 不可妥协的原则
1. **Token 一处定义** — 所有颜色/字体/间距走 `tokens.css` 里的 CSS variables，不要在组件里硬编码。
2. **不要圆胖卡片** — 默认无圆角 (`--r-sm 4px` 用于 chip)，只在 dock / drawer 这类悬浮浮层用 `--r-md`。
3. **不要 emoji 当图标** — 用 SVG。文档里 ★⤴⌾⏸ 仅作占位，落地必须替成线性 SVG。
4. **不要 Inter 当中文** — 中文先衬线 (`Noto Serif SC`)，UI 控件用 Inter，数字用 JetBrains Mono (tabular)。
5. **斜体** — `em, i { font-style: normal }`；强调用衬线 + 字号差，不用斜体。
6. **accent 用量** — 一屏最多两处 `--accent`（blue accent）。多了立刻廉价。
7. **Logo 不变** — 保留现版本，配色可走 token 主题切换。
8. **shenlun bundle** — `design/v3-shenlun.bundle.html` (用户原文件) 仅许换颜色样式，不动功能/布局。

## Tweak 协议（必做）
顶部工具栏的"Tweaks"开关必须能：
- 切换 reading size（lg/xl）→ `<html data-reading>`
- 切换 density（compact/cozy）→ `<html data-density>`
- 切换 nav 位置（左 / 顶）→ 全局
- 切换 theme（warm / pure / night）→ `<html data-theme>`
- 切换 option 样式（fenbi 圆形 / 方形 letter）

## 实现顺序
见 `TODO.md`。粗粒度顺序：tokens → 全局壳 → 行测列表 → 申论双栏 → 报告 → 错题/计划 → 营销 → 认证。

## 每页规范
见 `specs/` 目录。每个 spec 文件包含：
- 路径 (`/practice/xingce/...`) 与对应 HTML artboard 标签 (`03 · 练习答题 · 行测 · 标准版`)
- 关键交互
- 数据契约（可拆 mock）
- 验收点（你完成后自查）
