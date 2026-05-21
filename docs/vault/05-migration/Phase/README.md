# IA-V2 Phase 落地文档

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Scope**: 把 [Frontend-IA-V2.md](../Frontend-IA-V2.md) 的 IA 决策按一级导航 / 层（layer）分组，每组对应一个 Phase 子目录。
> **Convention**: 每个 Phase 子目录至少含一份 `README.md`（索引/分阶段实施文档）；落地内容多时拆 00~99 子文档。

---

## 0. 为什么要分 Phase

[Frontend-IA-V2.md](../Frontend-IA-V2.md) 把信息架构分成 4 个 Layer + 5 个 Main App Tab：

```
④ Gate Layer ─────────────── Onboarding / Diagnosis（脱壳路由）
③ Main App Layer
   ├─ Tab 1  首页（Dashboard）
   ├─ Tab 2  练习（Practice）
   ├─ Tab 3  复盘（Review）
   ├─ Tab 4  笔记（Notes）
   └─ Tab 5  我的（Profile）
② Auth Layer ─────────────── 登录 / 注册 / 找回 / OAuth
① Marketing Layer ────────── 公开页（首页营销 / 关于 / 价格 / 法律）
```

每个 Layer / Tab 的迁移内容差异巨大（数据模型、UI、依赖、节奏都不同）。本目录按这 8 组（4 layer + 1 拆 5 tab，共 8 个 Phase）分别落地。

---

## 1. 目录索引

| Phase | 路径 | Status | 索引文档 | 备注 |
|---|---|---|---|---|
| **Home**（首页 tab） | [Home/](./Home/) | ACCEPTED · 详细规格完成 | [Home/README.md](./Home/README.md) | 12 子文档 / ~6,500 行 / 80 PR；含 [A0 现实校验](./Home/A0-Codebase-Reality-Check.md) |
| Practice（练习 tab） | [Practice/](./Practice/) | TBD（占位） | [Practice/README.md](./Practice/README.md) | 等 Home 完工后启动 |
| Review（复盘 tab） | [Review/](./Review/) | TBD（占位） | [Review/README.md](./Review/README.md) | |
| Notes（笔记 tab） | [Notes/](./Notes/) | TBD（占位） | [Notes/README.md](./Notes/README.md) | |
| Profile（我的 tab） | [Profile/](./Profile/) | TBD（占位） | [Profile/README.md](./Profile/README.md) | 含 BindEmail/Phone/CompleteProfile |
| Onboarding（Gate 层） | [Onboarding/](./Onboarding/) | TBD（占位） | [Onboarding/README.md](./Onboarding/README.md) | 含 DiagnosisResult |
| Auth（鉴权层） | [Auth/](./Auth/) | TBD（占位） | [Auth/README.md](./Auth/README.md) | |
| Marketing（公开层） | [Marketing/](./Marketing/) | TBD（占位） | [Marketing/README.md](./Marketing/README.md) | |

---

## 2. Phase 启动顺序建议

依据：
- 用户登录后第一次看到的就是 Tab 1 首页 → 优先级最高
- 5 tab 中 Tab 2 / Tab 3 复用 Home 的事件模型 / session / review 数据 → 紧随其后
- Auth 与 Onboarding 涉及全局拦截，作为基础设施单独一轮
- Marketing 不阻塞核心体验，最后做

```
M1 ── Home（当前阶段，11-14 周）
   ├─ Practice（依赖 Home 完成 events / session 模型）
   └─ Review  （依赖 Home 的 weakness / review item 数据层）
M2 ── Notes / Profile（与 Practice/Review 并行）
M3 ── Onboarding / Auth（基础设施迭代）
M4 ── Marketing（外部页改造）
```

---

## 3. 通用规范（所有 Phase 必守）

### 3.1 子目录约定

```
Phase/<Name>/
├── README.md                      入口索引（必须）
├── 00-Decisions.md                决策 SSOT（建议）
├── 01-Boundary-Rules.md           业务边界（建议，跨模块时必须）
├── 02-Data-Model.md               schema + 状态机（建议）
├── 03-Backend-WU.md               后端工作单元
├── 04-Frontend-WU.md              前端工作单元
├── ...                            领域专题（如 Home/05-LLM-Module.md, Home/07-Calendar-Engine.md）
├── 08-NonFunctional.md            性能 / 安全 / 限流（跨 Phase 共享时可放到 ../shared）
├── 09-Observability-Audit.md      审计 / 可观测
└── 10-Testing.md                  测试矩阵
```

不是每个 Phase 都需要全套 00-10。简单 Phase（如 Marketing）可能只有 README.md。

### 3.2 跨 Phase 共享内容

如果某条决策 / 模型 / 规则跨多个 Phase 共用：
- 短共享 → 在最早消费它的 Phase 里写，其他 Phase 通过引用矩阵指向
- 长共享 → 抽到 `Phase/_shared/` 子目录（按需创建）

当前 Phase-Home 的某些内容已具有跨 Phase 价值，以下条目未来抽出时优先：
- `Home/02-Data-Model.md` AuditLogV2 / IdempotencyKeyV2 / LlmCallV2（基础设施表）
- `Home/05-LLM-Module.md` LLM provider 抽象（其他 Phase 需要 LLM 时复用）
- `Home/08-NonFunctional.md` 限流 / 幂等 / 部署 Stage1↔Stage2 / a11y / 浏览器矩阵
- `Home/09-Observability-Audit.md` audit 写入 helper / OTel / structlog

抽出时机：第二个 Phase 启动时再决定（避免过早抽象）。

### 3.3 决策变更规则

修改任意 Phase 中已 ACCEPTED 的决策：
1. 在对应文档行画 `~~删除线~~` + 新决策 + 拍板日期
2. 同步引用矩阵中的下游
3. 已实现时 PR 标 `BREAKING DECISION CHANGE: <id>`
4. 跨 Phase 决策（如基础设施类）必须在 [Frontend-IA-V2.md](../Frontend-IA-V2.md) 同步

### 3.4 与 AGENTS.md 的关系

所有 Phase 都受 [AGENTS.md](../../../../AGENTS.md) H1-H10 硬规则约束。规则冲突时以 AGENTS 为准；Phase 文档仅在 AGENTS 留白处补全细节。

---

## 4. 关联文档

- [../Frontend-IA-V2.md](../Frontend-IA-V2.md) — IA 决策 SSOT（4 layer + 5 tab + D 系列原始来源）
- [../Migration-Plan.md](../Migration-Plan.md) — 整体迁移计划
- [../Migration-Status.md](../Migration-Status.md) — 整体迁移现状
- [../Legacy-Feature-Inventory.md](../Legacy-Feature-Inventory.md) — 旧功能盘点
- [../Data-Migration.md](../Data-Migration.md) — 数据迁移策略
- [../../../../AGENTS.md](../../../../AGENTS.md) — 顶层硬规则
