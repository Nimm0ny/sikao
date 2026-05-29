---
type: feature
status: planned
owner: lhr
last-reviewed: 2026-05-29
notion-issue-url: https://www.notion.so/36fbc174f6c8816e8108f53a93765ebc
notion-issue-identifier: SIK-141
parent-issue: SIK-138
parent-issue-url: https://www.notion.so/36ebc174f6c88187840ac2623a1666f7
spec: .kiro/specs/sik-141-calendar-aggregation-properties/
depends-on: SIK-138
related: SIK-139, SIK-140, SIK-112
blocked-by: aggregation-data-source-undefined
---

# Calendar Aggregation Properties (练习数 / 准确率) Plan

> Define-First 立项文档（H6）。只定义边界与依赖；不含实现。
> 本 Phase **就绪度最低**——核心 blocker 是聚合数据源 / 端点尚未定义，
> 需先 Define-First 定义跨服务聚合契约（H6 触发），才能进入实现。

## 1. Why / 目标

在月视图 chip / Peek 卡片上展示事件维度的聚合学习数据（练习数、准确率等），
让用户在日历层面直接看到「这场学习产出了什么」。

目标：

- 定义事件 → 聚合数据的来源与计算口径（practice sessions → 事件维度聚合）
- chip / Peek 的聚合属性渲染通道
- 聚合查询的性能边界

## 2. 非目标

- ❌ 拖拽改期（SIK-139）/ inline 编辑（SIK-140）
- ❌ 新增可编辑聚合字段（聚合是只读派生数据）
- ❌ 全站统计报表（Profile / Review 已有各自统计页，本 Phase 只做日历内嵌）

## 3. 关键 Blocker（H1 / H6 必读）

立项核查（2026-05-29，main HEAD `7fbf18a82`）：

1. **`PlanEventReadV2` 不含聚合字段**
   - SIK-138 Requirement 3 已明确："V1 must not expose aggregate fields such as
     practice count, accuracy, or duration because they do not exist on
     `PlanEventReadV2`"
   - 当前 `PlanEventReadV2` 仅有 `linkedSessionId?: number | null`，无 accuracy / count
2. **没有「事件/会话维度聚合端点」**
   - 聚合数值散落在多个 schema：`PracticeStatsCellV2.accuracy` /
     `DailyPracticeResponseV2.completedAccuracy` / `MockExamHistoryItem.accuracy` /
     `SubjectAccuracyV2` 等，但**无按 event 聚合的查询通道**
   - `linkedSessionId` 是 event → session 的唯一现有链路，但 session → 聚合指标
     的读取端点未定义
3. **结论**：SIK-141 进入实现前，必须先做**跨服务聚合契约 Define-First**
   （H6：跨服务 API + 数据模型变更）。这是后端 + 前端协同的边界定义任务，
   不是纯前端渲染任务。

> 因此本 Phase 不应在 SIK-139 / SIK-140 之前排期；建议作为 Calendar follow-up
> 三件套中**最后**一项，且其 Wave 0 是「聚合契约定义」而非直接渲染。

## 4. 待定义的稳定边界（H6 · 需后端协同拍板）

进入实现前必须先定义清楚（任一未定义不得 Runner）：

- **聚合数据源**：event → linkedSession → 哪些指标（练习题数 / 正确数 / 准确率 /
  用时）；聚合口径（单 session vs 跨 session）
- **聚合端点 DTO**：是扩展 `PlanEventReadV2`（加只读聚合子对象）还是新增
  `GET /plans/events/{id}/aggregate` / 批量聚合端点；批量 vs 单条；缓存策略
- **性能边界**：月视图一屏 N 个 chip，是否预聚合 / 批量查询 / 懒加载；查询预算
- **空值语义**：无 linkedSession / 无练习数据时 chip 如何显示（Fail-Fast：不伪造 0%）

这些属于跨服务 API + 数据模型变更（§3.2 必须先对齐 + H6），由 Master + 后端拍板，
落 `docs/plan/` 定义性文档或定义性提交后才进入前端渲染实现。

## 5. Fail-Fast 点（H7）

- 聚合数据缺失（无 session / 查询失败）→ 显式空态，禁伪造 0% / 占位数字
- 聚合端点错误 → 抛错 / 显式降级提示，禁 silent catch 后显示陈旧值
- 准确率等派生值的除零 → 显式 N/A，禁 `?? 0`

## 6. Wave 拆分建议（高度依赖 §4 拍板）

| Wave | 内容 | Gate |
|---|---|---|
| Wave 0 | **聚合契约 Define-First**（数据源 + 端点 DTO + 性能边界），后端协同 | Define-First doc + 跨服务 review（H5/H6） |
| Wave 1 | api-client 类型 + query hook（按拍板端点） | 独立 review（跨服务契约）+ validation |
| Wave 2 | chip / Peek 聚合属性渲染通道 + 空态 | 独立 review（视觉 phase H11）+ full validation |
| Wave 3 | 性能验证（一屏 N chip 批量聚合）+ a11y + 验收 closeout | review + browser smoke |

## 7. Acceptance Hooks 骨架

- [ ] Wave 0 聚合契约定义落档（数据源 / 端点 DTO / 性能边界 / 空值语义）
- [ ] 跨服务契约独立 review（H5/H6）
- [ ] api-client 聚合类型 + query hook
- [ ] 视觉契约 `docs/plan/sik-141-calendar-aggregation-visual-contract.md`（聚合属性在 chip/Peek 的视觉通道）
- [ ] chip / Peek 聚合渲染 + 空态（Fail-Fast，不伪造数字）
- [ ] 性能边界验证（一屏批量聚合预算）
- [ ] `pnpm typecheck + lint + test` 全 PASS
- [ ] 1440 / 1920 双开 Chrome MCP，有数据 / 空态截图
- [ ] vitest-axe 0 violation
- [ ] 独立 subagent review → `docs/reviews/sik-141-w<N>.md`
- [ ] Evidence Block 回写 issue body + Work Log Type=Evidence

## 8. Rollback

- Wave 0 是文档定义，无运行时回退
- Wave 1+ 每 wave 独立可 revert，回退后 chip / Peek 退回 SIK-138 无聚合态

## 9. Next Owner

- Master + 后端：§4 聚合契约拍板（最关键，阻塞全 Phase）
- Runner：Wave 1-3（待契约定义后）
- Verifier：browser + axe + 性能 + Evidence
