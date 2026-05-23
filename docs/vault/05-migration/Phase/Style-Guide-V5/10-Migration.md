# 10 · V4 → V5 Migration（双轨期 + 整页 surface 切换 + sunset）

> **Status**: LOCKED
> **Phase 父目录**：[../README.md](../README.md)
> **来源**：`requirements.md` REQ-12 + `design.md` §C.6 mapping + tasks.md Phase 6
> **过渡期硬时间**：**2026-05-23 → 2026-06-06**（2 周，R1/Q6 决策）
> **Last Updated**: 2026-05-23

---

## 1. 迁移原则（4 条铁律）

| 原则 | 内容 |
|---|---|
| **整页 surface 切换** | V4 → V5 必须**按 surface 整页切换**，不允许局部混用（REQ-12.4）；每个 surface 一个原子 commit |
| **双轨期 V4 alias** | 双轨期内 V4 token 必须在 `tokens.css` 内带 `@deprecated 2026-05-23 — 失效 2026-06-06` 注释 + 通过 `var(--v5-name)` 间接引用，保证 V4 现存页面继续渲染无视觉差 |
| **过渡期满 verifier 兜底** | 2026-06-06 起 Verifier 跑 `lint-v4-token-residual.mjs`：0 引用 → 删除 V4 token，关闭 spec；仍有引用 → blocked，禁止删除 V4 token 直至迁移完成 |
| **迁移前后对照 evidence** | V5 文档必须含"迁移前/迁移后对照"章节，至少给出 Home / Practice / Note / Me 4 个页面的截图证据 + token diff 表（REQ-12.5） |

---

## 2. V4 → V5 完整 Token Mapping

详见 [02-Token-System.md §7](./02-Token-System.md)。本文不重复完整表格，只列**处置类型分布**：

| 处置 | 数量 | 含义 |
|---|---|---|
| **keep** | ~6 | V4 名称与值都不变（如 `--ease-out` / `--dur-fast` / `--z-rail` 等） |
| **rename** | ~30 | 改名但语义不变（如 `--paper-1` → `--color-bg-surface`） |
| **split** | ~7 | 一拆多（如 `--row-h` → `--row-h-sm/md/lg`；`--r-card` → `--radius-16` + `--card-radius`） |
| **deprecate** | 0 | V5 没有"完全废弃且无替代"的 V4 token——所有 V4 都有去向 |

**铁律 INV-1.6**：所有 V4 现存 token 必须在 V5 有对应去向，不允许"未提及就消失"（CP.8 兜底）。

---

## 3. 双轨期流程（Phase 6 实施）

### 3.1 时间线

```
2026-05-23  ━┓  V5 token 落地 + V4 alias 启动（任务 1.7）
              │  V4 token 标 @deprecated，通过 var(--v5-name) 间接引用
              │
              ▼  双轨期 14 天（V4 与 V5 共存，新代码必须 V5）
              │
2026-06-06  ━┛  Sunset：Verifier 跑 lint-v4-token-residual
                ├─ 0 引用 → 删除 V4 alias，关闭 V5 spec（任务 21.3）
                └─ 仍有引用 → 列出残留位置，blocked
```

### 3.2 双轨期内规则

- **新代码**：必须用 V5 token，**禁止**引用任何 V4 token
- **既有代码**：双轨期内继续渲染无视觉差（V4 alias 间接引用 V5）
- **整页 surface 切换**：按 surface 整页迁移，不允许"半边 V4 半边 V5"
- **lint 阶段表现**：
  - `lint-hardcode` / `lint-radius-token` / `lint-shadow-token` 等强制闸门：error
  - `lint-v4-token-residual`：双轨期内 warn（提示有 V4 残留），sunset 起切 error

### 3.3 整页 surface 切换顺序（tasks.md 21.1a–g）

按 7 个 sub-commit 拆分（每个 ≤ 15 文件、≤ 400 行净增）：

| Sub-task | Surface | 时机 |
|---|---|---|
| 21.1a | `apps/web/src/styles/**` 全局样式替换 | Phase 6 第 1 commit |
| 21.1b | `apps/web/src/views/Home/**` 整页切换 | Phase 6 第 2 commit |
| 21.1c | `apps/web/src/views/Practice/**` | 第 3 commit |
| 21.1d | `apps/web/src/views/Note/**` | 第 4 commit（含 Modal → Drawer 改造，R2/Q1） |
| 21.1e | `apps/web/src/views/Me/**` | 第 5 commit |
| 21.1f | `apps/web/src/views/{QuestionHub,Review}/**` | 第 6 commit |
| 21.1g | `apps/web/src/components/**` 与 `apps/web/src/layouts/**` 残余替换 | 第 7 commit |

每个 sub-commit 必跑 `pnpm --filter @sikao/web lint`（lint-v4-token-residual 在该 surface 范围内 0 命中）+ 本地 dev (port 18080) 视觉无退化 + axe 全绿。


---

## 4. Sunset 检查清单（任务 21.3，硬约束 ≥ 2026-06-06）

任务 21.3 删除 V4 alias 的执行时机硬约束 **≥ 2026-06-06**。早于该日期 sub-task 进入 `blocked` 状态，禁止提前执行。

### 4.1 准入条件

只有**全部满足**以下条件，才能进入 sunset 删除：

- [ ] 21.1a–g 全部 sub-commit 已 merge
- [ ] `pnpm --filter @sikao/web lint`（lint-v4-token-residual 模式 = warn）跑通，0 V4 token 命中
- [ ] 21.2 迁移前后 evidence 已落档（Home / Practice / Note / Me 4 页截图 + token diff 表）
- [ ] V5 baseline report（任务 23.1）已生成
- [ ] 当前日期 ≥ 2026-06-06

### 4.2 sunset 操作

1. 删除 `packages/design-system/src/tokens.css` §8 V4 alias 区块
2. 同步删除 `apps/web/src/styles/tokens.css` 中 V4 双份镜像（如还存在）
3. 切换 `lint-v4-token-residual.mjs` 默认从 `warn` → `error`
4. 跑全量验证：`pnpm --filter @sikao/web lint && test && test:visual && test:a11y`
5. 全绿 → commit `feat: V5 sunset, drop V4 token aliases`；全量 `apps/web` 视觉无退化（人工 review 4 页对比 21.2 evidence 截图）

### 4.3 回滚

`git revert <sha>` 即恢复 V4 alias 与残余引用——这是 H7 fail-fast 兜底，确保过渡期未结束前不会误删。回滚后必须：

- 在 README §2 进度表更新 sunset 顺延日期（禁止隐式延期）
- 在 tasks.md 任务 21.3 sub-task 状态切回 `blocked`
- 重新走 21.1x sub-commit + 21.2 evidence + 准入条件全部 check

---

## 5. 风险与边界

### 5.1 sunset 顺延规则

如果 Phase 1–5 实施延期、或某 surface 整页切换 evidence 不全，**任何 sunset 顺延都需要在以下三处显式更新**：

1. README.md §2 进度表
2. tasks.md 任务 21.3 描述
3. 02-Token-System.md §7.6 Deprecate 时间线

禁止隐式延期。

### 5.2 跨 Phase 影响

V4 → V5 切换会触达所有业务 Phase（Home / Practice / Notes / Profile / Review / Onboarding / Auth / Marketing）。每个业务 Phase 在 V5 落地前的对接动作详见 [01-Boundary-Rules.md §3](./01-Boundary-Rules.md)。

### 5.3 Marketing 例外

Marketing landing 页面（`apps/web/src/views/marketing/**`）：

- 同样按 surface 整页切 V5 token
- **不受 `--max-w-workspace=1440` 限制**（marketing 用更宽 hero / 全宽 banner）
- Footer / 法律页 3 个属于普通页面，按标准流程切

切换时机：Phase 6 后置（21.1a–g 均不直接覆盖 marketing），由 Marketing Phase 单独提 PR 切。

### 5.4 双轨期内 fail-fast 边界

V4 alias 是**唯一**允许的双轨临时状态——这不是 fail-fast 例外，因为 V4 alias 通过 `var(--v5-name)` 间接引用 V5，没有降级行为。**真正的 fail-fast 例外仍然只有玻璃拟态降级一条**（详见 [00-Decisions.md §3](./00-Decisions.md)）。

---

## 6. 关联文档

- [`requirements.md` REQ-12`](../../../../../.kiro/specs/frontend-style-guide-v5/requirements.md) — 迁移要求原文
- [`design.md` §C.6`](../../../../../.kiro/specs/frontend-style-guide-v5/design.md) — 完整 V4 → V5 mapping 表
- [`tasks.md` Phase 6`](../../../../../.kiro/specs/frontend-style-guide-v5/tasks.md) — 21.1a–g / 21.2 / 21.3 任务拆分
- [00-Decisions.md §1 R1/Q6](./00-Decisions.md) — 2 周过渡期决策
- [02-Token-System.md §7](./02-Token-System.md) — V4 → V5 mapping 全表（colors / surfaces / texts / shadows / radii / fonts / heights / motion / z-index）
- [09-Correctness-Properties.md CP.8](./09-Correctness-Properties.md) — V4 token 残留收敛校验
- [01-Boundary-Rules.md §3.2](./01-Boundary-Rules.md) — 各业务 Phase 接力时机
