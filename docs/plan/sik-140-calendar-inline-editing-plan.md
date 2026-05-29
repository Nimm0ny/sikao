---
type: feature
status: planned
owner: lhr
last-reviewed: 2026-05-29
notion-issue-url: https://www.notion.so/36fbc174f6c881bbb1e9db67b249de43
notion-issue-identifier: SIK-140
parent-issue: SIK-138
parent-issue-url: https://www.notion.so/36ebc174f6c88187840ac2623a1666f7
spec: .kiro/specs/sik-140-calendar-inline-editing/
depends-on: SIK-138, SIK-139
related: SIK-139, SIK-141, SIK-112
---

# Calendar Inline Editing (Phase 4) Plan

> Define-First 立项文档（H6）。只定义边界与依赖；不含实现。
> 本 Phase 比 SIK-139 更晚就绪——见 §3 关键 blocker。

## 1. Why / 目标

SIK-138 V1 的 Peek 卡片锁死只读（design.md 明确 Non-goal）。Phase 4 在 Peek
卡片内解锁 inline 编辑：title / notes / 可编辑 props（status / category / target），
配乐观更新 + 失败回滚，并移除 read-only banner。

目标：

- Peek 卡片 title / notes inline 编辑 + 落库
- 可编辑 props（status / category / targetId）inline 修改 + 落库
- 乐观更新 + 失败回滚（Fail-Fast，不 silent catch）
- read-only banner 在写能力解锁后按条件移除

## 2. 非目标

- ❌ 拖拽改期（SIK-139 / Phase 3）
- ❌ 聚合属性（SIK-141）
- ❌ recurring series 级字段编辑 UI（V1 仅 scope 透传单次 occurrence）
- ❌ 新建事件（仅编辑既有）
- ❌ 月视图 chip 上的直接 inline 编辑（编辑只在 Peek 卡片内）

## 3. 关键依赖与 Blocker（H1 必读）

> 本 Phase 的最大风险：父 issue 与本任务背景都称
> 「inline 编辑契约 Requirement 19 已前置定义于 requirements.md」——
> **该 Requirement 19 不存在**。

立项核查（2026-05-29，main HEAD `7fbf18a82`）：

- `.kiro/specs/sik-138-home-calendar-v2/requirements.md` 只到 **Requirement 15**
- inline 编辑在 `.kiro/specs/sik-138-home-calendar-v2/design.md` 是明确 **Non-goal**
  （"V1 scope: read-only only / no mutation wiring / no inline editing"；
  Non-goals 段含 "inline editable peek fields"）
- 因此 **Phase 4 的 inline 编辑契约必须从零定义**，不能援引一个不存在的 Requirement 19

依赖：

- **依赖 SIK-138**：Peek 卡片组件（`CalendarPeekCard` / `CalendarPeekProperties` /
  `CalendarPeekNotes` / `CalendarPeekHead`）已存在，但全为只读渲染
- **建议在 SIK-139 之后**：SIK-139 已先把乐观更新 + 回滚 + mutation 回写编排
  跑通一遍（同一 `useUpdateEvent` 端点），Phase 4 复用该编排模式可少踩坑；
  且 SIK-139 Wave 0 会先补 chip optimistic merge 通道
- 写边界已就绪：`useUpdateEvent` / `PlanEventUpdateRequestV2`（与 SIK-139 同端点）

## 4. 稳定边界定义（H6 · 待 spec 细化）

### 4.1 可编辑字段集（来自 PlanEventUpdateRequestV2，需 Master 拍板子集）

`PlanEventUpdateRequestV2` 提供字段：`title / notes / category / status /
targetId / startAt / endAt / recurringRule / timezone`。

Phase 4 inline 编辑**候选子集**（最终子集待拍板）：

- `title`（文本）
- `notes`（多行文本）
- `status`（枚举 planned / in_progress / done / skipped）
- `category`（文本 / 受控选择，待定）
- `targetId`（关联，待定是否纳入 V1）

时间字段（startAt / endAt）由 SIK-139 拖拽负责，**不在 Phase 4 inline 范围**
（避免两个 Phase 争夺同一字段的编辑入口）。

### 4.2 乐观更新 + 回滚

复用 SIK-139 已验证的编排：`upsertOptimisticEvent` → `useUpdateEvent` →
成功 `removeOptimisticEvent` / 失败回滚。inline 编辑的乐观粒度是「单字段提交」
（失焦 / 确认即提交，待 spec 拍板交互），失败回滚到编辑前值并显式提示。

### 4.3 readonly banner 移除条件

SIK-138 Peek 有 readonly placeholder / banner。Phase 4 解锁写后，banner
移除条件需明确（全字段可写才移除 vs 部分可写时改文案），spec 拍板。

## 5. Fail-Fast 点（H7）

- 字段校验失败（空 title / 非法枚举）→ 阻止提交 + 显式提示，禁 silent 丢弃
- mutation reject → 回滚乐观 patch + 显式提示，禁 silent catch
- recurring scope 缺省由后端裁决，前端禁伪造默认 scope
- 并发编辑（Peek 翻页中途提交）→ 明确取消或提交语义，禁丢更新

## 6. Wave 拆分建议

| Wave | 内容 | Gate |
|---|---|---|
| Wave 0 | spec（requirements + design）从零定义 inline 契约 + 视觉契约（编辑态 Peek） | docs review + H11 |
| Wave 1 | Peek title / notes inline 编辑 + 乐观 + 回滚 | 独立 review（跨写边界）+ full validation |
| Wave 2 | 可编辑 props（status / category / targetId）inline | 独立 review + full validation |
| Wave 3 | readonly banner 移除 + a11y（编辑态键盘 / focus）+ 验收 closeout | review + 双开 diff 截图 |

## 7. Acceptance Hooks 骨架

- [ ] spec 从零定义 inline 契约（**不援引不存在的 Requirement 19**）
- [ ] 视觉契约 `docs/plan/sik-140-calendar-inline-editing-visual-contract.md`（编辑态 Peek）
- [ ] title / notes inline 编辑 + 乐观 + 回滚（Fail-Fast）
- [ ] 可编辑 props inline 修改 + 落库
- [ ] readonly banner 按拍板条件移除
- [ ] `pnpm typecheck + lint + test` 全 PASS
- [ ] 1440 / 1920 双开 Chrome MCP，编辑 / 提交成功 / 提交失败回滚 三态截图
- [ ] vitest-axe 0 violation（编辑态）
- [ ] 独立 subagent review → `docs/reviews/sik-140-w<N>.md`
- [ ] Evidence Block 回写 issue body + Work Log Type=Evidence

## 8. Rollback

- 每个 wave 独立可 revert，回退后 Peek 退回 SIK-138 只读态，不影响月视图渲染

## 9. Next Owner

- Master：可编辑字段子集拍板 + banner 移除策略拍板 + 提交交互（失焦 vs 显式按钮）拍板
- Runner：Wave 0-3 实现（建议排在 SIK-139 之后）
- Verifier：双开 browser + axe + Evidence

## 10. W0 Closeout Decisions (2026-05-30)

本节覆盖前文里所有“候选 / 待拍板”旧措辞，作为当前 W0 define-first 的收口版本：

- Phase 4 V1 固定可编辑字段集合：
  - `title`
  - `notes`
  - `status`
  - `category`
  - `targetId`
- `targetId` 已纳入 V1，不再是“待定是否纳入”。
- `category` 是受控选择，不是自由文本。
- readonly banner 三态已经锁定：
  - `read-only`：保留旧 banner
  - `partial-editable`：文案改为 `部分字段现已可编辑；时间与重复规则仍为只读。`
  - `fully-editable`：静态 banner 全局移除
- 键盘 ownership 已锁定：
  - idle/read-only：`Esc` 关闭 Peek，`ArrowUp/ArrowDown` 做 prev/next
  - editing(single-line/select)：`Esc` cancel，`ArrowUp/ArrowDown` 只归当前控件，`Enter` save
  - editing(notes textarea)：`Esc` cancel，`ArrowUp/ArrowDown` 只归 textarea，`Ctrl/Cmd+Enter` save
  - saving：`prev/next/close` disabled，`Esc` ignored，禁止切条目
- scrim 规则已锁定：
  - editing：先 cancel 当前字段，再 close Peek
  - saving：ignored，不允许通过遮罩关闭
