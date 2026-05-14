---
type: engineering
status: archived
owner: lhr
last-reviewed: 2026-05-09
---

# SIKAO · Archived Implementation TODO

> Archived/source-only. This checklist points to the older SIKAO handoff and must
> not be used as active implementation order. Current active rules are ink-first +
> blue accent in `docs/design/style-guide.md` and the 2026-05-09 SIKAO plans.

## Phase 0 · Foundation (Week 1)
- [ ] 把 `design/tokens.css` 原样落到 `styles/tokens.css`，在 `app/layout.tsx` 顶层 import
- [ ] 配置 `<html data-theme="reading" data-density="cozy" data-reading="lg" data-nav="left">`
- [ ] 字体：next/font 引入 Source Serif 4 / Inter / JetBrains Mono / Noto Serif SC
- [ ] 写 `components/ui/`：Button (primary/secondary/ghost/accent), Chip, IconBtn, Eyebrow, Stamp, Mark (logo dot)
- [ ] 写 `components/icons/`：搬 HTML 里所有 inline `<svg>`（answer-card / chat / pause / arrow-left / settings / scratch …），统一 `1.4` stroke，currentColor
- [ ] Tweaks 协议：参考 HTML 末尾的 TweaksPanel；落地为顶部工具栏的 Drawer/Popover

## Phase 1 · Shell & Marketing (Week 2)
- [ ] `09 · 全局壳` — 左侧 nav (默认) / 顶部 nav (Tweak) 切换。logo + 5 项 + 用户区
- [ ] 营销首页 (`/`) — 见 `specs/07-marketing.md`，hero "让备考从刷题变成思考" 不可改
- [ ] `01 · 登录 / 注册` — 见 `specs/08-auth-profile.md`

## Phase 2 · 主线 · 学习闭环 (Week 3-6)
- [ ] `02 · 今日 Dashboard`（1920 native）— `specs/01-dashboard.md`
- [ ] `07 · 学习计划` — `specs/02-plan.md`
- [ ] `03 · 行测 · 标准版`（fenbi 列表） — `specs/03-xingce.md`
- [ ] `03b · 行测 · 解析栏`（同上 + 右栏解析）— 同 spec
- [ ] `03c · 行测 · 题组` — 同 spec
- [ ] `04 · 申论 · 单题`（含草稿纸）— `specs/04-essay.md`
- [ ] `04b · 申论 · 多材料多题目` — 同 spec
- [ ] `05 · 行测成绩报告` — `specs/05-result.md`
- [ ] `05b · 申论成绩报告` — 同 spec

## Phase 3 · 长尾 (Week 7-10)
- [ ] `06 · 错题本` — `specs/06-wrongbook.md`
- [ ] `08 · 个人中心` — `specs/08-auth-profile.md`
- [ ] 订阅管理
- [ ] 多端适配 (≤980px 已在 HTML 给到示例)

## 全程必做
- [ ] 每个 PR 都跑 `npm run lint` + 截图 vs HTML artboard
- [ ] 不允许出现硬编码颜色 / px (除组件内必要的描边 1.4 等)
- [ ] 不允许 emoji 当 UI 图标
- [ ] `design/v3-shenlun.bundle.html` 只许换 token，不许改功能 / 布局
