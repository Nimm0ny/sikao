---
type: plan
status: active
owner: lhr
created: 2026-05-27
supersedes: docs/plan/frontend-tab-runtime-2026-05-24.md §4 (Tab2 only)
issue: SIK-118
---

# Frontend Tab2 Runtime Rewire — v2 Plan (Post-Audit)

> Tab2 Practice 子 issue 重建版。原 plan §4 (frontend-tab-runtime-2026-05-24.md) 假定零基础重建，与 main 现实严重脱实。本 v2 plan 基于 audit (docs/reviews/sik-118-tab2-audit-2026-05-27.md) 现实重切。

## Audit 触发背景

V5-M0.5 big-bang (commit d37cc997c, 2026-05-23) 只删 apps/web/src/，**未动 packages/**。SIK-26/27/28 (P6/P7/P8) 已落地的 12 个 query family + 4 个 domain store + 大部分 view 骨架在 main 全部存活。

原 plan §4 + SIK-94~101 description 按零基础写，导致：
- M-Api (SIK-94) 8 个 query 全已存在 → 真实剩余仅维护 + drift check
- M-Stores (SIK-95) 6 个 store 中 2 个等价物已有，其余按需评估
- M-Center/Entry/Session/Mock (SIK-96-99) view 骨架已存在 → 真实剩余是接线 + 4 状态 + a11y
- M-Stats (SIK-100) 部分新建 + 部分重写
- M-Lifecycle (SIK-101) 大部分全新增量

lhr 2026-05-27 拍板按方案 D 重建 8 个子 issue。

## 8 子 issue 编排 (v2)

| 模块 | 新 SIK | 取代旧 SIK | 性质 |
|---|---|---|---|
| M-Maint | SIK-129 | SIK-94 | 维护 + drift check (non-visual) |
| M-Stores 增量 | SIK-130 | SIK-95 | 评估 + 增量 (non-visual) |
| M-Center | SIK-131 | SIK-96 | 接线 + 拆 sections (visual) |
| M-Session | SIK-132 | SIK-98 | 接线 + 4 状态 + a11y (visual) |
| M-Entry | SIK-133 | SIK-97 | 接线 + 拆细 + 双滑块 a11y (visual) |
| M-Mock | SIK-134 | SIK-99 | 接线 + 倒计时 (visual) |
| M-Stats | SIK-135 | SIK-100 | 部分新建 + 部分重写 (visual) |
| M-Lifecycle | SIK-136 | SIK-101 | 收尾 + e2e (visual) |

注：SIK 编号顺序与逻辑顺序不完全对应（multica 按创建时间编号）。

## Sequencing

M-Maint → M-Stores 增量 → M-Center → M-Entry → M-Session → M-Mock → M-Stats → M-Lifecycle

理由：
- M-Maint 先：query 层 drift check 通过后，所有后续接线才有可信契约
- M-Stores 增量 次：store 决策影响 view 接线方式（filter store 拆分 yes/no）
- M-Center 第三：PracticeCenter 是入口容器，Entry/Session/Mock 都从它跳
- M-Entry 第四：三种入口先稳，session 从 entry 拉起
- M-Session 第五：核心答题闭环
- M-Mock 第六：复用 Session 的 ExamLayout + answer-engine
- M-Stats 第七：依赖 M-Session 产出 timing 数据
- M-Lifecycle 第八：终版整合 + e2e，依赖前 7 个全 done

## 与 SIK-26/27/28 的关系

SIK-26 (P6 前端契约层 F9/F10) / SIK-27 (P7 前端练习中心 F11-F14/F22) / SIK-28 (P8 前端答题运行时 F15-F21) 截至 2026-05-27 全部 done。

- 不动其 status / Evidence Block / commit 链
- v2 子 issue 在 SIK-26~28 落地代码基础上做接线 + 4 状态 + a11y + Visual Contract
- 旧 SIK-94~101 已 cancel，redirect comment 全部指向新 SIK-129~136

## 与原 plan §4 的关系

原 plan §4 (frontend-tab-runtime-2026-05-24.md) 的 Tab2 编排部分被本 v2 plan supersede。原 plan 其他章节（§3 Home / §5 Review / §6 Note / §7 跨线协调 / §9 风险登记 / §10 完成判定）仍可作历史参考；其中 §8 `Multica` 账本布局已于 2026-05-28 降级为历史账本说明。

## 验证链路（与原 plan §7.4 一致）

- npm run typecheck -w @sikao/web
- npm run lint -w @sikao/web
- npx vitest run
- npm run test:visual -w @sikao/web (仅在改了 view 骨架时跑)

M-Lifecycle (SIK-136) 收尾时额外跑：

- npx playwright test
- npm run test:a11y -w @sikao/web

## Source

- audit: docs/reviews/sik-118-tab2-audit-2026-05-27.md
- 原 plan: docs/plan/frontend-tab-runtime-2026-05-24.md §4
- Phase-Practice 04-Frontend-WU.md (WU-F9~F22)
- 关键 commit：d37cc997c (big-bang) / b31ff14cd (SIK-26 stores) / 3449789d5 (SIK-26 queries)
- 父 issue: SIK-118
