---
type: visual-contract
status: active
owner: lhr
last-reviewed: 2026-05-30
notion-issue-url: https://www.notion.so/36fbc174f6c8816e8108f53a93765ebc
notion-issue-identifier: SIK-141
parent-issue: SIK-138
prototype-baseline: .tmp_review/out/Tab1-Home-mock/home-calendar-notion-like-mock.html
---

# SIK-141 Calendar Aggregation Visual Contract (H11)

> 原型 baseline 没有 aggregation channel。本契约定义的是“在现有 chip / Peek 信息预算内，未来如何加聚合信息”。

## 1. Layout Topology

- month/week chip owner：`MonthEventChip.tsx`
- peek aggregate owner：建议新建 `CalendarPeekAggregation.tsx`
- root topology 不变：
  - chip 仍为单按钮 surface
  - peek 仍为 `head -> body -> kindBar -> title -> properties -> aggregation -> notes`
- page scroll / local scroll 规则不变，不引入第二层 modal

## 2. Required Interactive Elements

本 issue 不新增交互控件，只有只读展示通道。

必须存在：

- chip aggregate channel（ready / empty state）
- peek aggregate block（ready / empty state）
- empty state 文案必须来自 `availability`

禁止新增：

- 聚合编辑入口
- tooltip-only hidden metric
- “加载更多聚合” 单独交互

## 3. Information Density

### Chip

- 只允许 1 行聚合 microline
- ready state 推荐格式：
  - `练 {attemptedCount} · 准 {accuracyPct}%`
- empty state 只允许 1 个短标签：
  - `事件不可用`
  - `未关联`
  - `关联失效`
  - `未提交`
  - `暂不支持`
  - `无判题数据`

### Peek

- ready state：3~4 个 compact metric cells
  - 练习量
  - 正确数
  - 正确率
  - 用时（可选）
- non-ready state：单行显式空态，不渲染伪造数值
  - `事件不可用`
  - `未关联`
  - `关联失效`
  - `未提交`
  - `暂不支持`
  - `无判题数据`

## 4. Token Map

| prototype/current var | V5 token | note |
|---|---|---|
| `--ink-3` | `--color-text-meta` | chip aggregate text / empty labels |
| `--ink-1` | `--color-text-primary` | ready numeric value |
| `--paper-1` | `--color-bg-surface` | chip / peek outer surface |
| `--paper-2` | `--card-bg-elevated` | peek aggregate block background |
| `--line-1` | `--color-border-subtle` | aggregate block divider |
| `--r-card-sm` | `--radius-10` | aggregate block radius |
| `--t-meta` | `--font-meta` | chip aggregate line / labels |
| `--t-body` | `--font-body` | peek aggregate values |

Reference:

- `docs/vault/04-design/Prototype-Token-Map.md`

禁止：

- prototype raw vars
- hardcoded percentage colors
- unsupported state fake success tint

## 5. SSOT Conflicts

| item | current baseline | future authority | decision | date |
|---|---|---|---|---|
| chip currently title-only | SIK-142 chip contract | SIK-141 aggregation contract | aggregation adds one subordinate line only | 2026-05-30 |
| prototype has no aggregation slot | prototype baseline | issue + this contract | issue wins | 2026-05-30 |
| missing aggregate values | easy fallback to `0%` | fail-fast availability states | no fake numbers | 2026-05-30 |
| peek property table vs aggregate block | current 8-row table only | keep 8 rows + add separate block | table stays; aggregate is its own block | 2026-05-30 |

## 6. Visual Drift from Prototype

| item | prototype | future implementation | reason | date |
|---|---|---|---|---|
| chip aggregate line | none | additive microline | follow-up phase | 2026-05-30 |
| peek aggregate block | none | additive read-only block | follow-up phase | 2026-05-30 |
| empty state label | none | explicit availability label | fail-fast requirement | 2026-05-30 |

## 7. Acceptance Hooks

| item | baseline | implementation target | status |
|---|---|---|---|
| visual contract defined for chip aggregate line | current title-only chip | future `MonthEventChip.tsx` | PASS (W0) |
| visual contract defined for peek aggregate block | current peek without aggregation | future `CalendarPeekAggregation.tsx` | PASS (W0) |
| empty state labels come from availability | current no aggregate channel | future api-client + view render | PASS (W0 design) |
| no fake numeric fallback allowed | current no aggregate render | future chip / peek branches | PASS (W0 design) |
| 1440/1920 screenshot archive path reserved | `.tmp_review/visual-diff/sik-141/` | future Wave 2/3 browser evidence | PASS (W0 scaffold) |
| dual-open diff hook reserved | current no aggregation screenshots | `1440/1920` diff archive under `.tmp_review/visual-diff/sik-141/` | PASS (W0 scaffold) |
