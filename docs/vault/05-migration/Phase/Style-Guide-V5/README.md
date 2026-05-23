# Phase · Style-Guide-V5（前端样式规范 V5）

> **Status**: SPEC LOCKED — 规范文档已落地，等 Phase 1 实施
> **IA 位置**：跨 tab / 跨端视觉基础设施（不属于单一 IA layer，所有 Main App / Marketing / Onboarding 都消费它）
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-23

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

## 2. 当前进度（2026-05-23）

| 阶段 | 状态 | 产出 |
|---|---|---|
| Spec — requirements.md | ✅ DONE | 12 REQ + 12 Resolved Decisions |
| Spec — design.md | ✅ DONE | 三层 token / 35 组件 / 6 页 / 10 CP / V4→V5 mapping |
| Spec — tasks.md | ✅ DONE | 8 Phase / 71 task / 29 wave 依赖图 |
| Phase 文档落地 | ✅ DONE | 本目录 8 文档 |
| Phase 1 — tokens.css 落地 | ⏸️ NOT STARTED | 等 lhr 派工 |
| Phase 2 — 6 lint 闸门 | ⏸️ | — |
| Phase 3 — 35 组件骨架 | ⏸️ | — |
| Phase 4 — 6 桌面页骨架 | ⏸️ | — |
| Phase 5 — SVG 资产收敛 | ⏸️ | — |
| Phase 6 — V4→V5 迁移 | ⏸️ | sunset 硬时间 2026-06-06 |
| Phase 7 — 视觉回归基线 | ⏸️ | — |
| Phase 8 — 文档 + spec 关闭 | ⏸️ | — |

---

## 3. 与其他业务 Phase 的接力

V5 是水平基础设施，所有业务 Phase 都消费它。详见 [01-Boundary-Rules.md §3](./01-Boundary-Rules.md)。

| 业务 Phase | V5 对接动作 | 时机 |
|---|---|---|
| Home | 整页切 V5 token；接 D.4.1 骨架 | Phase 6 整页 surface 切换 |
| Practice | ScopeToggle 改用 D.3.3 Tabs `variant="segmented"`，禁独立 SegmentedControl | Phase 6 |
| Notes | Note 详情由 V4 Modal 改 D.3.21 Drawer（R2/Q1） | Phase 6 |
| Profile | 危险操作 Panel 改 `variant="danger"`；注销走 D.3.22 ConfirmDialog | Phase 6 |
| Review / Question Hub | compact-card 用 `--card-radius-sm` (12px) 提升信息密度 | Phase 6 |
| Onboarding / Auth | 双轨期内 V4 alias 不报错；2026-06-06 后任意 V4 token 残留 fail | sunset 兜底 |
| Marketing | landing 页切 V5；不受 `--max-w-workspace=1440` 限制（marketing 用更宽布局） | Phase 6 后置 |

考试模式（Exam）由独立 Phase 承接（未来），**不复用 SaaS Shell**（R2/Q3）。本 Phase 仅在任务 15.5 落 ExamLayout 容器钩子（含 ExamTopBar slot + PanelGroup + ResizeHandle + Sheet 槽位 + 3 个 exam token），不实现 resize 拖拽 / 计时器逻辑。

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
