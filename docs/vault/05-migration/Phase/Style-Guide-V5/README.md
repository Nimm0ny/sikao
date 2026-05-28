# Phase · Style-Guide-V5（前端样式规范 V5）

> **Status**: SPEC LOCKED — 规范文档已落地；V5-M0.5 big-bang rebuild **进行中**
> **IA 位置**：跨 tab / 跨端视觉基础设施（不属于单一 IA layer，所有 Main App / Marketing / Onboarding 都消费它）
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-24

---

> **2026-05-24 UPDATE — V5-M0.5 Big-Bang Rebuild**
>
> lhr 拍板放弃 V4 → V5 整页 surface 切换路径，改为 big-bang 重建。`apps/web` 业务层 + `packages/ui` 整包 + tokens.css §8 V4 alias 全部删除；前端业务层从 V5 规范从零实现。
>
> 影响：REQ-12 / R1/Q6 / design §C.6 / tasks Phase 6 / 02-Token-System §7 / 10-Migration.md 整篇 — **全部 ARCHIVED**。
>
> 主线收敛：原 13 milestone → 8 个有效（M0 / M0.5 / M1 / M2 / M3 / M4 / M9 / M11）+ 6 个 cancelled（SIK-77/78/79/80/82/84）。
>
> 详见 [11-Implementation-Plan.md §0](./11-Implementation-Plan.md)。

---

## 0. 范围预览

V5 是 sikao 前端样式规范的换代。和其他按 IA tab 拆分的业务 Phase 不同，本 Phase 是**水平切片**——只产出视觉基础设施，不绑业务功能、不动 API / DB schema。

### 纳入范围

- token 三层架构（primitive / semantic / component）+ light/dark 双值 + 多端断点 + Rail 折叠规则
- 35 个组件契约（D.3.1–D.3.35，prop API 草案 + 全状态机）
- 6 个桌面页骨架（Home / Practice / Note / Me / Question Hub / Review）+ Mobile Shell + Exam 容器钩子
- SVG 图标规范（风格 / 尺寸 / 答题系统 14 个固化命名）
- 14 个 lint 闸门（含 6 个新增）+ 10 条 Correctness Properties
- V4 → V5 迁移路径（双轨期 2026-05-23 → 2026-06-06）

### 不纳入范围

- 业务流程改造、产品功能新增
- API 契约 / 数据模型
- 考试模式具体 layout / resize / 计时器（V5 只定 token 钩子，由独立 Exam spec 承接）
- apps/web 之外的 platform 实现细节（mobile / tablet / admin 接同一 token 与组件契约即可）

---

## 1. 文档结构

| 文档 | 内容 | 行数预算 |
|---|---|---|
| [README.md](./README.md) | 入口索引 + 范围 + 进度 + 风险（本文） | < 200 |
| [00-Decisions.md](./00-Decisions.md) | 12 项 Resolved Decisions SSOT（R1×6 + R2×6）+ Q4 fail-fast 草案 | < 250 |
| [01-Boundary-Rules.md](./01-Boundary-Rules.md) | 7 条不变量 + V5 与其他 Phase 接力点 + AGENTS.md 硬规则映射 | < 200 |
| [02-Token-System.md](./02-Token-System.md) | 三层结构 + 7 条 scale + 7 档断点 + 5 类 max-width + Rail 折叠状态机 + V4→V5 mapping 全表 | < 400 |
| [03-Components.md](./03-Components.md) | 5 类卡片 + 9 状态机 + 35 组件契约（D.3.1–D.3.35）+ SVG 规范 + 答题系统 14 图标 | < 400 |
| [04-Pages.md](./04-Pages.md) | 6 桌面页容器树（D.4.1–D.4.6）+ Mobile Shell 7 场景（D.5.1–D.5.7）+ Exam 钩子 | < 350 |
| [09-Correctness-Properties.md](./09-Correctness-Properties.md) | 10 条 CP + 14 lint traceability 矩阵 + V5 baseline 报告模板 + 视觉回归矩阵 | < 250 |
| [10-Migration.md](./10-Migration.md) | V4→V5 token mapping 完整表 + 双轨期规则 + 整页 surface 切换流程 + sunset 检查清单 | < 250 |

总计预估 ~2,300 行，分成 8 个独立可读文档。

> **关于编号约定**：Phase 父目录 `Phase/README.md §3.1` 把业务 Phase 的子文档建议为 00-Decisions / 01-Boundary-Rules / 02-Data-Model / 03-Backend-WU / 04-Frontend-WU / 09-Observability-Audit / 10-Testing。V5 是**水平视觉基础设施 Phase**，没有后端 / 数据模型 / 测试矩阵这种业务维度，按以下豁免对应：02/03/04 改为 Token-System / Components / Pages 三个领域专题（对应业务 Phase 的"领域专题"位 05–07），09 改为 Correctness-Properties（对应可观测位），10 改为 Migration（对应测试位）。05–08 编号刻意留空，以与业务 Phase 的"领域专题 + NonFunctional"位区分。

### 文档与 spec 三件套的关系

```
.kiro/specs/frontend-style-guide-v5/        ← Spec SSOT（事实来源，给 agent / spec 引擎用）
├── requirements.md                          ← 12 REQ + 12 决策（EARS）
├── design.md                                ← 三层 token + 35 组件 + 6 页 + 10 CP（设计契约）
└── tasks.md                                 ← 8 Phase / 71 task / 29 wave 实施依赖图

docs/vault/05-migration/Phase/Style-Guide-V5/  ← Phase 落地文档（给人类读 / 跨 tab 联调用）
└── 本目录                                    ← 上面 spec 内容的人话版 + 与其他 Phase 的接力
```

两边规范条款**保持镜像**——任意决策变更必须同步两边，禁止单边修改导致 drift。

---

## 2. 当前进度（2026-05-24）

| 阶段 | 状态 | 产出 |
|---|---|---|
| Spec — requirements.md | ✅ DONE（REQ-12 ARCHIVED 2026-05-24） | 12 REQ + 12 Resolved Decisions（R1/Q6 ARCHIVED） |
| Spec — design.md | ✅ DONE（§C.6 ARCHIVED 2026-05-24） | 三层 token / 35 组件 / 6 页 / 10 CP |
| Spec — tasks.md | ✅ DONE（Phase 6 + task 1.7 ARCHIVED 2026-05-24） | 8 Phase / 71 task / 24 wave 实施依赖图（wave 21-24 ARCHIVED） |
| Phase 文档落地 | ✅ DONE | 本目录 8 文档（10-Migration.md 整篇 ARCHIVED） |
| **V5-M0.5 big-bang rebuild** | 🔧 **IN PROGRESS** | 9 commit 序列：spec docs / tokens.css §8 删 / packages/ui 删 / apps/web 业务层删 / main.tsx 骨架 / lint 聚合 / fixtures / plan doc / multica 账本 |
| Phase 1 — tokens.css 落地 | ✅ DONE | 7 commit（§1 primitive / §2-3 semantic / §4 component / §5-7 breakpoint+mobile+rail / §8 V4 alias 已删） |
| Phase 2 — 6 lint 闸门 | ⏳ IN PROGRESS（task 3 lint-shadow 已实现待提） | task 8 降级可选 |
| Phase 3 — 35 组件骨架 | ⏸️ NOT STARTED | — |
| Phase 4 — 6 桌面页骨架 | ⏸️ NOT STARTED | — |
| Phase 5 — SVG 资产收敛 | ⏸️ | — |
| ~~Phase 6 — V4→V5 迁移~~ | **ARCHIVED 2026-05-24** | — |
| Phase 7 — 视觉回归基线 | ⏸️ NOT STARTED | 合并到新 V5-M9 |
| Phase 8 — 文档 + spec 关闭 | ⏸️ | — |

---

## 3. 与其他业务 Phase 的接力（2026-05-24 V5-M0.5 调整后）

V5 是水平基础设施。**big-bang 重建后，V5 spec 与组件骨架到位即"接力完成"**——各业务 Phase 直接消费 V5 规范从零实现，不再走 V5 子 issue（M5..M8 surface 切换）的中间步骤。

| 业务 Phase | 对接动作 | 时机 |
|---|---|---|
| Home（SIK-29 family） | M11/M12（SIK-42/43）原 deliverable 被 big-bang 删除；在 V5 框架下重新承接（5 tab + /me + /profile/records + 验收） | 等 V5 Phase 3+4 到位 |
| Practice 前端（SIK-26/27/28） | 直接按 V5 04-Pages.md D.4.2 实现 | 等 V5 Phase 3+4 到位 + Practice 后端 SIK-25 收尾 |
| Notes 前端（SIK-44 M7-M11，SIK-53-57） | 直接按 V5 D.4.3 实现（Drawer 详情，R2/Q1） | 等 V5 Phase 3+4 到位 + Notes 后端 SIK-44 M0-M6 收尾 |
| Review 前端（SIK-45 M8-M12，SIK-66-70） | 直接按 V5 D.4.5 实现 | 等 V5 Phase 3+4 到位 + Review 后端 SIK-45 M0-M7 收尾 |
| Profile / Me | 在 V5-M9（SIK-81）兜底实施 | 等 V5 Phase 3 到位 |
| Marketing | 后置；不走 RootLayout shared workspace 语义 | V5-M9 内 |

考试模式（Exam）由独立 Phase 承接（未来），**不复用 SaaS Shell**（R2/Q3）。本 Phase 仅在任务 15.5 落 ExamLayout 容器钩子，不实现 resize 拖拽 / 计时器逻辑。

---

## 4. 风险与待对齐

详见 [01-Boundary-Rules.md §4](./01-Boundary-Rules.md)。

1. **Spec 三件套尚未进 git** — 等 lhr 拍板分支策略（开 PR 还是直推 main 例外）+ commit 拆分（按文件原子拆 vs 走 H9 例外）。
2. **V4→V5 sunset 硬约束 ≥ 2026-06-06** — 任何 Phase 1–5 延期都需要在本 README §2 进度表 + tasks.md 显式更新 sunset 日，禁止隐式延期。
3. **Phase 7 playwright 36 截图基线初次跑通** — 需要本地 dev (port 18080) 稳定；CI 接入是否做仍待对齐，MVP 内只要本地 baseline 录入 git 即可。
4. **Browser MCP 验收能力** — H5 要求前端视觉 phase 必须有独立规范审查官 + Browser MCP 验收。如果某次执行环境无 Browser MCP，必须 fail-fast 报告，**不得静默降级到 axe 单跑**。

---

## 5. 关联文档

- [`.kiro/specs/frontend-style-guide-v5/requirements.md`](../../../../../.kiro/specs/frontend-style-guide-v5/requirements.md) — Spec 需求 SSOT
- [`.kiro/specs/frontend-style-guide-v5/design.md`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md) — Spec 设计 SSOT
- [`.kiro/specs/frontend-style-guide-v5/tasks.md`](../../../../../.kiro/specs/frontend-style-guide-v5/tasks.md) — 实施清单
- [`packages/design-system/src/tokens.css`](../../../../../packages/design-system/src/tokens.css) — Token 实施 SSOT（Phase 1 落地处）
- [`docs/vault/04-design/Design-System.md`](../../../04-design/Design-System.md) — 设计规范镜像（Phase 8 同步）
- [`docs/engineering/fail-fast-exceptions.md`](../../../../engineering/fail-fast-exceptions.md) — 玻璃拟态例外登记（任务 14.3）
- [`AGENTS.md`](../../../../../AGENTS.md) §4.3 前端 / 设计 SSOT — 顶层硬规则
