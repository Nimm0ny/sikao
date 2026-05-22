# Sikao 首页 Phase 落地 Plan（索引）

> **Status**: ACCEPTED
> **Scope**: 一级导航 Tab 1 = 首页（Section A 学习计划 + B 学习进度 + C 今日推荐）+ `/profile/learning` + `/profile/records` 两个钻取页
> **原则**：完整落地（不走最小化路线）/ 后端先行 / 前端 UI 最后做 / 每 PR 受 AGENTS H9 约束（≤15 文件 / ≤400 行）
> **Last Updated**: 2026-05-21
> **Phase 父目录**：[../README.md](../README.md)

> ⚠️ **开工前必读**：[A0-Codebase-Reality-Check.md](./A0-Codebase-Reality-Check.md)
>
> 本 Phase 的 00-10 文档基于 IA 决策稿编写，描述的是**目标态**。**A0** 记录代码现实与目标的 delta（4→5 tab 升级 / 模块路径修正 / `modules/llm` 已存在 / 缺失依赖清单 / 文件路径错误等）。子文档与 A0 §11 冲突时**以 A0 为准**。
>
> **2026-05-21 口径重定基线**：`M3 / SIK-34` 的后端 deliverables 已落到 `origin/main`。`SIK-34` 当前保留 `blocked`，仅反映旧 Home 前端 runtime 触发了既有 full typecheck gate；该阻塞不再卡住后端 `M4-M6`，只继续约束旧 Home 前端 `M7-M12 / F1-F8` 参考轨。
> **2026-05-22 更新**：`M0.5 / SIK-31` 已解锁前端 full typecheck blocker。旧 Home 前端仍未自动重启；`M7-M12` 继续保持 paused reference track，直到新的前端重构计划显式接管。
> **2026-05-22 restart baseline**：前端 runtime 轨已在 `main` 上显式重启，并已完成 `M7 / SIK-38`、`M8 / SIK-39`、`M9 / SIK-40` 与 `M10 / SIK-41`。
> **2026-05-23 closeout**：`M11-M12` 已完成，canonical `"/"` Home、`/profile/records`、5-tab nav、legacy redirect 收口、a11y 自动化与 Browser smoke 已补齐；Home Phase 当前实现面已收口到完成态。

---

## 0. 如何阅读本 Phase

本文是入口索引，不含详细规格。每个 agent / PR 应只读自己所需的子文档，避免把全部 ~5,500 行规格一次性塞进 context。

子文档目录：`docs/vault/05-migration/Phase/Home/`（本目录）

> **路径变更说明**：原 `Frontend-IA-V2-Phase-Home/` 与索引 `Frontend-IA-V2-Phase-Home.md` 已按一级导航统一搬到 `Phase/<TabName>/`，索引改名为各子目录的 `README.md`。

| 子文档 | 何时读 |
|---|---|
| [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) | **任何 PR 开工前必读**（代码现实 vs 目标 delta） |
| [00-Decisions](./00-Decisions.md) | 任何 PR 开工前；决策冲突时以本文档为准（路径冲突时以 A0 为准） |
| [01-Boundary-Rules](./01-Boundary-Rules.md) | 写 plan / event / progress / recommender 任何业务逻辑前 |
| [02-Data-Model](./02-Data-Model.md) | WU-B1~B5 / WU-F1 类型生成 |
| [03-Backend-WU](./03-Backend-WU.md) | 后端 40 个 PR 的总盘 |
| [04-Frontend-WU](./04-Frontend-WU.md) | 前端 44 个 PR 的总盘 |
| [05-LLM-Module](./05-LLM-Module.md) | WU-B7 |
| [06-LLM-Prompts](./06-LLM-Prompts.md) | WU-B7 + 任何调 prompt 的代码 |
| [07-Calendar-Engine](./07-Calendar-Engine.md) | WU-F3 / WU-F4 |
| [08-NonFunctional](./08-NonFunctional.md) | 性能 / 安全 / 限流 / 部署形态 |
| [09-Observability-Audit](./09-Observability-Audit.md) | 任何写入 audit / metrics / log 的 PR |
| [10-Testing](./10-Testing.md) | WU-B9 / WU-F8 + 每 PR 测试约束 |

阅读建议：
- 所有 agent：先读 [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md)（代码现实）→ 00-Decisions
- 后端 agent：A0 → 00 → 01 → 02 → 03 →（按 PR 范围）05/06/08/09/10
- 前端 agent：A0 → 00 → 01 → 02 §6 → 04 →（按 PR 范围）07/08/09/10

---

## 1. 一句话目标

把首页从 stub 升级为以「学习计划日历画廊 + 实时学情概览 + AI 今日推荐」三层为骨架的完整 V2 形态，全程后端先行、AI 落地、审计与可观测齐备，可在单机部署稳定运行，并支持后续平滑切换多用户 SaaS。

---

## 2. 范围（详见 [00-Decisions §11](./00-Decisions.md#11-phase-home-范围明确)）

**在范围内**：
- 首页 `/` 三 Section（A/B/C）
- `/profile/learning`（详细学情钻取页，新建）
- `/profile/records`（学习记录子页，新建）
- 后端：plans / recommendations / progress 真实化 / planning 重写 / profile 扩展 / LLM 模块 / cron / audit / observability
- 数据：drop DailyPlanV2/WeeklyPlanV2，建 PlanV2 / PlanEventV2 / PlanAdjustmentV2 / RecommendationV2 / RecommendationFeedbackV2 / IdempotencyKeyV2 / LlmCallV2 / AuditLogV2

**不在范围内**：
- 申论批改 module（推 [Phase/Practice](../Practice/README.md) 或单独 Essay Phase）
- 移动 native app（apps/mobile / apps/tablet 原生层）
- BindEmail/Phone/CompleteProfile（推 [Phase/Profile](../Profile/README.md)）
- Onboarding / DiagnosisResult 完整改造（推 [Phase/Onboarding](../Onboarding/README.md)）
- LLM fine-tune
- 推荐策略阈值用户 UI

---

## 3. 关键决策速查

完整决策见 [00-Decisions](./00-Decisions.md)。最高频引用：

| 决策 | 拍板 |
|---|---|
| D1 一级导航 | **5 tab**（首页 / 练习 / 复盘 / 笔记 / 我的），桌面 + 移动均不升 6 |
| D-Root-Route | `"/"` 双态：未登录看 marketing，已登录直接进入 Home Dashboard |
| H-Plan-1 | 学习计划 = 日历画廊（Today/Week/Month）+ 多 target |
| H-Plan-7 | 详细学情进 `/profile/learning`；首页 Section B 仅 6 数值卡 + sparkline + top3 弱项 |
| Cal-1 / Cal-7 | 严格小时；15 分钟吸附；拖拽支持（含跨日） |
| Cal-4 | RRULE 子集（DAILY/WEEKLY/MONTHLY） |
| AI-1 / AI-3 | AI 制定 3 处入口；锁定到考试日整段 |
| AI-7 / AI-8 | plan_generate / adjust 走 SSE；所有 LLM 端点必带 Idempotency-Key |
| ADJ-2 / ADJ-6 | banner 不打断；每日最多 1 次；同类被拒 24h 不再提 |
| Rec-1 / Rec-2 / Rec-9 | 全数据源；2-3 卡；accept→session 写 linked_recommendation_id |
| Infra-Deploy-Stage | Stage 1 单机 → Stage 2 多用户；切换只动配置不动业务代码 |
| NF-A11y | 日历键盘可达；axe-core 0 violation |
| NF-Audit | 全部 plan/event/adjustment/recommendation 变更入 AuditLogV2 |

---

## 4. 边界规则速查

详见 [01-Boundary-Rules](./01-Boundary-Rules.md)。

```
P1 学习计划 = 目标 + 路径建议
P2 实绩层独立于计划层（unlinked session 也贡献进度）
P3 PlanEventV2.status 只表达事件本身
P4 用户加练自动落入日历视图（实绩块）
P5 AI 推荐基于实绩 + 目标 + 实时状态（不读 event status）
P6 任何「改计划」行为需审计 + 提案制
```

---

## 5. 总览估算

| 维度 | 估算 |
|---|---|
| 总行数（新增 + 删除） | ~24,000 |
| Backend / Frontend | 11,250 / 12,700 |
| PR 总数 | 84（B 40 + F 44） |
| Backend 阶段 | 6-8 周 |
| Frontend 阶段 | 5-6 周 |
| 全程 | 11-14 周 |

---

## 6. 依赖图

```
WU-B1 ────────────────┐
                      ├─→ WU-B2 ─┬─→ WU-B5 ──┐
                      │          │           │
                      │          └─→ WU-B7 ──┤
                      ├─→ WU-B3 ─────────────┤
                      ├─→ WU-B4 ─────────────┤─→ WU-B8 ─→ WU-B9 ─┐
                      ├─→ WU-B6 ─────────────┘                     ├─→ WU-F1
M0.5 Legacy Frontend Typecheck Blocker ────────────────────────────┘

WU-F1 ─→ WU-F2 ──┐                                                 legacy frontend starts only when both M0.5 and M6 are satisfied
       └─→ WU-F3 ┼─→ WU-F4 ─┐
                 └─→ WU-F5 ─┤
                 └─→ WU-F6 ─┴─→ WU-F7 ─→ WU-F8
```

WU 详细：
- 后端：[03-Backend-WU](./03-Backend-WU.md)
- 前端：[04-Frontend-WU](./04-Frontend-WU.md)
- 当前执行主线：`M0.5 / SIK-31` 已移除 legacy frontend full typecheck blocker，`M4 → M5 → M6` 后端链也已完成收口；`SIK-37 / M6` 锁定了 backend Home 契约、OpenAPI 与 records canonical route。
- 前端轨已于 2026-05-22 在 `main` 上显式重启，`M7 / SIK-38`、`M8 / SIK-39`、`M9 / SIK-40` 与 `M10 / SIK-41` 已落地主干；`M11-M12` 已于 2026-05-23 完成收口。
- 当前代码现实与旧 WU 假设存在漂移：`"/"` 仍是 marketing + authed redirect；`TabBar` / `RailMini` 仍是 4 tab 且 `/me` 仍是已知 bug；`apps/web/src/views/Dashboard.tsx`、`Plan.tsx`、`study/StudyToday.tsx` 已不存在，因此后续前端实现必须以 `A0-Codebase-Reality-Check.md` 的 restart baseline 为准。

---

## 7. 阶段里程碑

```
M0   week 0          docs-only 收敛；A0 修订同步进 README + 00-10，并通过 review
M0.5 week 0-1        独立任务解决旧 Home 前端 full typecheck blocker（2026-05-22 已完成）；legacy F1-F8 仍需显式重启计划后才启动
M1   week 1          WU-B1 完工：DB schema 全部就位
M2   week 2-3        WU-B2 + WU-B3 + WU-B6：核心 CRUD 端点
M3   week 4-5        WU-B4 + WU-B5：进度 + planning 真实化（后端 deliverables 已于 2026-05-21 落地主干）
M4   week 5-6        WU-B7：LLM 模块（用户配 API key 后联调）
M5   week 6-7        WU-B8：Cron + 实时 hook + audit/observability
M6   week 7-8        WU-B9：e2e + OpenAPI 锁定
─────────────────────────────────────────────
M7   week 8-9        WU-F1：API client 切换 V2（2026-05-22 restart；当前 tranche）
M8   week 9          WU-F2 + WU-F3：stores + calendar-engine（2026-05-22 restart；当前 tranche）
M9   week 9-11       WU-F4：Section A（2026-05-22 已在 `main` 上落地）
M10  week 11-12      WU-F5 + WU-F6：Section B/C + `/profile/learning`（2026-05-22 已在 `main` 上落地）
M11  week 12-13      WU-F7：整合 + 路由收口（2026-05-23 完成）
M12  week 13-14      WU-F8：e2e + a11y + 浏览器矩阵验收（2026-05-23 完成）
```

---

## 8. 完工门槛

详见各 WU 文档与 [10-Testing §6](./10-Testing.md#6-完工-gate)。

### 8.1 后端 M6
- [ ] pytest 全绿（含 invariant / e2e / audit / observability / scheduler）
- [ ] alembic upgrade head 干净
- [ ] OpenAPI drift 测试 0 diff
- [ ] LLM mock provider 跑通所有 prompt
- [ ] 真 provider 手动跑通 plan_generate / recommend_today

### 8.2 legacy 前端 M12（暂停中的参考 gate）
- [ ] vitest 全绿（含 e2e + a11y）
- [ ] tsc strict 0 errors
- [ ] 9 lint:* 全过
- [ ] bundle 预算未超
- [ ] 桌面 + 移动 viewport e2e 全过
- [ ] axe-core 0 violation
- [ ] 暗色模式 smoke

---

## 9. 风险与回退

完整风险表见 [08-NonFunctional §11](./08-NonFunctional.md#11-风险表汇总)。

回退策略：**项目未上线，不需回退方案**（用户拍板）。出现重大缺陷时：
- 后端：重置 alembic 到上一标记点 + 重置代码
- 前端：revert 到 last-known-good 的 git tag

---

## 10. 变更流程

修改本 Phase 任一决策：
1. 在对应子文档（00-10）写 `~~删除线~~` + 新决策行 + 拍板日期
2. 同步更新引用方
3. 已开始实现时，PR description 标 `BREAKING DECISION CHANGE: D-X`
4. 索引（本文）的「3. 关键决策速查」如涉及高频决策也要更新

新增子文档时：
1. 加到本文 §0 表格
2. 在被引用方加引用矩阵条目
3. AGENTS-H6 Define First：先有 plan 文档，才能有实现 PR

---

## 11. 后续工作（不在本 Phase）

- 移动 native app 适配（apps/mobile / apps/tablet） → 待立 Phase
- 申论批改 module 路由暴露 → [Phase/Practice](../Practice/README.md) 或 Essay Phase
- LLM fine-tune（基于 RecommendationFeedbackV2） → 远期
- BindEmail/Phone/CompleteProfile → [Phase/Profile](../Profile/README.md)
- Onboarding / DiagnosisResult 完整改造 → [Phase/Onboarding](../Onboarding/README.md)
- 推荐策略阈值用户可调 UI → 待用户反馈再起
- 视觉回归测试（Playwright + Chromatic） → 跨 Phase 基础设施
- Stage 2 多用户切换：cache → Redis / cron → worker / observability → collector / failover provider → 部署专项

---

## 12. 关联文档

- [../README.md](../README.md) — Phase 总入口（其他 Phase 导航）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md) — IA 决策 SSOT（D 系列原始来源）
- [../../Migration-Status.md](../../Migration-Status.md) — 整体迁移现状
- [../../Migration-Plan.md](../../Migration-Plan.md) — 整体迁移计划
- [../../../03-tech/Architecture.md](../../../03-tech/Architecture.md) — 技术架构
- [../../../04-design/Design-System.md](../../../04-design/Design-System.md) — 设计系统硬约束
- [../../../../../AGENTS.md](../../../../../AGENTS.md) — 顶层硬规则（H1-H10）
