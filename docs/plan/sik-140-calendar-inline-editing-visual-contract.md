---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-30
notion-issue-url: https://www.notion.so/36fbc174f6c881bbb1e9db67b249de43
notion-issue-identifier: SIK-140
parent-issue: SIK-138
prototype-baseline: .tmp_review/out/Tab1-Home-mock/home-calendar-notion-like-mock.html
---

# SIK-140 Calendar Inline Editing Visual Contract (H11)

> 原型 baseline 仍是现有只读 Peek mock。编辑态不是新原型，而是对该只读态的 define-first 扩展。

## 1. Layout Topology

- root 仍为 `CalendarPeekCard` portal overlay
- card 拓扑保持：`head -> body -> kindBar -> title -> properties -> notes`
- 编辑态不引入第二层 modal / drawer / full-page editor
- 一屏行为：
  - overlay 固定
  - card body 局部滚动
  - Home root / calendar grid 不变
- owner:
  - `CalendarPeekHead`：只读 head、prev/next/close
  - `CalendarPeekCard`：title display / title editing owner
  - `CalendarPeekProperties`：status/category/targetId editing owner
  - `CalendarPeekNotes`：notes editing + banner owner

## 2. Required Interactive Elements

| 元素 | 位置 | 行为 | 备注 |
|---|---|---|---|
| Expand | head slot 1 | disabled | 保留现有占位 |
| Prev | head slot 2 | 只在 idle/read-only 可用 | editing/saving 禁用 |
| Next | head slot 3 | 只在 idle/read-only 可用 | editing/saving 禁用 |
| Copy | head slot 4 | disabled | 保留现有占位 |
| More | head slot 5 | disabled | 保留现有占位 |
| Close | head slot 6 | 只在 idle/read-only 可用 | saving 禁用 |
| Title Edit | title row trailing action | 进入 title 编辑态 | W1 |
| Title Save | title editor action row | 提交 title | W1 |
| Title Cancel | title editor action row | 取消 title | W1 |
| Notes Edit | notes section header/action | 进入 notes 编辑态 | W1 |
| Notes Save | notes editor action row | 提交 notes | W1 |
| Notes Cancel | notes editor action row | 取消 notes | W1 |
| Status Edit | props row `status` | 进入 row inline 编辑 | W2 |
| Category Edit | props row `category` | 进入 row inline 编辑 | W2 |
| Target Edit | props row `target` | 进入 row inline 编辑 | W2 |

不可缺席元素：

- 8-row properties
- source / linked / target rows
- read-only / partial-editable banner（直到 W3 closeout）

## 3. Information Density

- 单卡仍是单层 peek，不允许转成整页 form
- 同时只允许一个 field 进入 editing/saving
- 编辑态在原位替换 value，不新增第二列/第二卡
- notes textarea 占用原 notes 区域
- `Save / Cancel` 只出现在当前 active field 附近

## 4. Token Map

| prototype / current var | V5 token | 用途 |
|---|---|---|
| `--paper-1` | `--color-bg-surface` | peek surface |
| `--line-1` | `--color-border-subtle` | row / head separators |
| `--r-card-sm` | `--card-radius` / `--cal-peek-radius` | peek 主卡圆角 |
| `--shadow-2` | `--shadow-l3` | peek 主卡阴影 |
| `--ink-1` | `--color-text-primary` | title / value text |
| `--ink-3` | `--color-text-meta` | labels / hint text |
| `--brand-yellow-soft` | `--color-brand-soft` | partial hint / subtle emphasis |

编辑控件继续走：

- `--input-*`
- `--btn-*`
- `--radius-10`
- `--radius-999`

## 5. SSOT Conflicts

| 项 | 原型 / 旧实现 authority | 本次 authority | 结论 | 日期 |
|---|---|---|---|---|
| Peek 是否只读 | SIK-138 readonly peek | SIK-140 issue/spec | 本 issue 允许局部可写 | 2026-05-30 |
| Requirement 19 | issue 背景误称存在 | 实际父 requirements 只到 15 | 不可再引用 19 | 2026-05-30 |
| 时间字段编辑 | 用户可能直觉在 Peek 改时间 | SIK-139 是唯一时间写入口 | 本 issue 不碰时间字段 | 2026-05-30 |
| Banner 文案 | 旧文案 `V1 只读...` | 新 partial-editable 文案 | W1/W2 必须换文案 | 2026-05-30 |
| 键盘 ownership | 旧全局 Esc/Arrow 导航 | editing 时字段接管 | global nav 暂停 | 2026-05-30 |

## 6. Visual Drift from Prototype

| 项 | 原型 | 本次实现 | 原因 | 日期 |
|---|---|---|---|---|
| editable title | 无 | 有 | follow-up phase | 2026-05-30 |
| editable notes | 无 | 有 | follow-up phase | 2026-05-30 |
| editable props | 无 | 有 | follow-up phase | 2026-05-30 |
| partial-editable banner | 仅只读 banner | 新文案同位置 | 过渡态明确化 | 2026-05-30 |
| Save/Cancel controls | 无 | 有 | explicit commit model | 2026-05-30 |

## 7. Acceptance Hooks

| 项 | 原型行 / 基线 | 实现位置 | 状态 |
|---|---|---|---|
| Peek head 6 buttons retained | SIK-138 mock head | `CalendarPeekHead.tsx` | PASS (W0 design) |
| 8 property rows retained | mock lines / SIK-138 contract row | `CalendarPeekProperties.tsx` | PASS (W0 design) |
| title owner fixed to card layer | current readonly card title | `CalendarPeekCard.tsx` / future title editor | PASS (W0 design) |
| notes owner fixed to notes section | current readonly notes section | `CalendarPeekNotes.tsx` | PASS (W0 design) |
| partial-editable banner policy defined | old readonly banner baseline | `CalendarPeekNotes.tsx` future W1/W2 | PASS (W0 design) |
| keyboard ownership defined | current global Esc/Arrow behavior | requirements/design | PASS (W0 design) |
| title inline edit opens in place | read-only title baseline | `CalendarPeekCard.tsx` | PASS (W1) |
| notes inline edit opens in place | read-only notes baseline | `CalendarPeekNotes.tsx` | PASS (W1) |
| editing hides partial banner | partial banner baseline | `CalendarPeekNotes.tsx` | PASS (W1) |
| explicit Save/Cancel present | none | title/notes editor actions | PASS (W1) |
| 1440/1920 screenshot archive path | `.tmp_review/visual-diff/sik-140/` | browser smoke archive exists | PASS (W1) |
| axe command/log path recorded | `npm run test` / `test:a11y` alias | W1 evidence references root test pass; edit-state axe remains待 W3 closeout | PASS (W1 scoped) |
| status inline edit works in place | read-only `status` row baseline | `CalendarPeekProperties.tsx` | PASS (W2) |
| category inline edit works in place | read-only `category` row baseline | `CalendarPeekProperties.tsx` | PASS (W2) |
| target inline edit works in place | read-only `target` row baseline | `CalendarPeekProperties.tsx` | PASS (W2) |
| select panel stays above peek action row | W1/W2 modal-inline select baseline | `Select.module.css` + `Popover` layering | PASS (W2) |
| provider snapshot keeps saved value across next/prev round-trip | original peek list snapshot baseline | `CalendarPeekProvider.tsx` + `CalendarPeekCard.test.tsx` | PASS (W2) |
| transient browser-smoke write path remains deterministic | old GET-only Home MSW baseline | `apps/web/src/mocks/handlers/home.ts` | PASS (W2) |
| 1440 target edit/save screenshots archived | `.tmp_review/visual-diff/sik-140/` | `w2-1440-target-edit.png` / `w2-1440-target-saved.png` | PASS (W2) |
| 1920 failure rollback screenshots archived | `.tmp_review/visual-diff/sik-140/` | `w2-1920-status-edit.png` / `w2-1920-status-failure.png` | PASS (W2) |
| edit-state axe passes for prop editor | edit-state a11y requirement | `CalendarPeekCard.test.tsx` (`axe.run(...)`) | PASS (W2) |
