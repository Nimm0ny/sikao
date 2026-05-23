# 11 · Implementation Plan（V5 落地节奏 + Multica issue 拆分）

> **Status**: ACTIVE
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-23
> **作用**：把 V5 Phase 1–8 落地节奏与 Multica 子 issue 一一对应；与远端业务 Phase（Home / Practice / Review / Notes）并行节奏的边界声明 SSOT。

---

## 1. 总览

V5 是水平视觉基础设施 Phase，与远端按 Home → Practice → Review → Notes 顺序推进的业务 Phase **方向正交**。落地策略：

- **Phase 1 / 2 / 3 / 5（基础设施 4 件套）立刻并行启动**——文件落点全是新目录或纯增量，与远端 0 冲突
- **Phase 4 / 6 / 7（页面骨架 + 整页 token 切换 + 视觉回归）严格尾随远端业务 Phase 节奏**——按 Home → Practice → Review → Notes 顺序追切，0 抢路
- **Phase 8（文档同步 + spec 关闭）排到最后**——Design-System.md 与 Migration-Status.md 等远端业务 Phase 收尾后再合
- **sunset 硬日期 2026-06-06**——任何 Phase 1–5 延期都需在 [README §2](./README.md) 进度表 + 本文 §3 时间盒显式更新，禁止隐式延期
- **feature 分支策略**：开 `spec/frontend-style-guide-v5` 分支，14 天双轨期内不 merge 到 `main`，等远端业务 Phase 阶段性收尾后再分批 rebase + 切 Phase 6

### 1.1 与远端业务 Phase 的冲突域

| Phase | V5 文件落点 | 远端 Home/Practice/Review/Notes 冲突？ | 启动决策 |
|---|---|---|---|
| Phase 1 tokens.css 三层 | `packages/design-system/src/tokens.css` 纯 append §1–§7；§8 V4 alias 也是 append | 0 — 远端业务 view 仍用 V4 名渲染无感 | ✅ 立刻 |
| Phase 2 6 新 lint | `apps/web/scripts/lint-*.mjs` 全新文件 + `apps/web/package.json` 6 行 script 增量 | 极低 — 唯一接触点是 package.json，但 script 是 append | ✅ 立刻 |
| Phase 3 35 组件骨架 | 全新目录 `apps/web/src/components/{system,overlay,atom,form,list,nav,layout,business}/` | 0 — 不动 V4 现有 components/ | ✅ 立刻（最大块） |
| Phase 5 SVG 资产 | `packages/design-system/src/icons/*.svg` 全新；`apps/web/public/icons.svg` sprite 增量 | 极低 — sprite 业务功能不碰；远端 Home/Practice 也不会动 sprite | ✅ 可与 Phase 3 部分并行 |
| Phase 4 6 页骨架 | `apps/web/src/views/{Home,Practice,Note,Me,QuestionHub,Review}/` | **撞** — 远端 SIK-29-M11/M12 改 Home runtime；Practice/Review/Notes 各自父 issue 也会改 view | ⏸️ 尾随业务 Phase |
| Phase 6 整页切换 | `apps/web/src/{styles,views,components,layouts}/**` | **撞** — surface 整页替换 token | ⏸️ 严格尾随，Home → Practice → Review → Notes 顺序追 |
| Phase 7 视觉回归 | `apps/web/e2e/visual/` + 36 截图基线 | 撞 — 截图依赖页面定型 | ⏸️ Phase 4+6 完才做 |
| Phase 8 文档同步 | `docs/vault/04-design/Design-System.md` + `docs/vault/05-migration/Migration-Status.md` | 0（前者 V4-design 自有目录，后者排到最后） | ⏸️ 尾随业务 Phase 收尾 |

### 1.2 与正在进行的 SIK-25（Phase-Practice P5 后端收口）冲突？

零冲突。SIK-25 改 `services/api/**`、DB migration、`docs/vault/05-migration/Phase/Practice/**`；V5 不动这些目录。共有的接触面只有未来 Phase 8 的 Migration-Status.md，到时排队即可。


---

## 2. 8 Phase 路线图

| Phase | 范围 | wave 区间 | 预估 commit 数 | 时间盒 |
|---|---|---|---|---|
| **Phase 1** | tokens.css 三层 + 多端断点 + V4 alias 双轨期启动 | 0–4 | 7 sub-task | 1–2 天 |
| **Phase 2** | 6 新 lint 闸门 + 接入 `pnpm lint` | 0–4（与 Phase 1 部分并行） | 6 sub-task | 1 天 |
| **Phase 3** | 35 组件骨架（system → atom → form → overlay → layout → business） | 5–14 | 35+ sub-task | 4–5 天（最大块） |
| **Phase 4** | 6 桌面页骨架（Home / Practice / Note / Me / Hub / Review） | 16–17 | 6 sub-task | 2 天 |
| **Phase 5** | SVG 资产收敛（答题 14 + Rail 3 + 状态 8 + cat / nav 10） | 14–20 | 6 sub-task | 1 天 |
| **Phase 6** | V4→V5 整页 surface 切换 + sunset | 21–24 | 7+1 sub-task | 受 sunset 硬时间约束，21.3 不早于 2026-06-06 |
| **Phase 7** | V5 baseline report + playwright 36 截图回归 | 25–26 | 1 + 6 sub-task | 1 天 |
| **Phase 8** | 文档同步（Design-System.md）+ fail-fast 账本 + spec 关闭 | 27–28 | 3 sub-task | 0.5 天 |

### 2.1 双轨期 14 天节奏

```
2026-05-23  ━┓  V5-M0 docs-only intake + multica 父 / 子 issue 全量落档
              │  feature 分支 spec/frontend-style-guide-v5 创建（待 user 拍板）
              │
2026-05-23  ━┳━ V5-M1 Phase 1 tokens.css 三层落地（wave 0-4，7 sub-task）
              │  V5-M2 Phase 2 6 lint 闸门（wave 0-4，6 sub-task，与 M1 部分并行）
              │
2026-05-25  ━┳━ V5-M3 Phase 3 35 组件骨架（wave 5-14）
              │  - V5-M3a system / overlay base / atom（11 组件）
              │  - V5-M3b form / overlay 容器 / nav（18 组件）
              │  - V5-M3c layout / business（6 组件 + ExamLayout 钩子）
              │
2026-05-28  ━┳━ V5-M4 Phase 5 SVG 资产收敛（wave 14-20，可与 M3c 并行）
              │
2026-05-30  ━┳━ Phase 4 / Phase 6 启动等待门：远端业务 Phase 节奏对齐
              │  - V5-M5 Phase 4-6 Home 切换（等远端 Home M11/M12 收尾后追）
              │  - V5-M6 Phase 4-6 Practice 切换（等远端 Practice 前端 Phase 启动后追）
              │  - V5-M7 Phase 4-6 Review 切换（等远端 Review Phase 启动后追）
              │  - V5-M8 Phase 4-6 Notes 切换（等远端 Notes Phase 启动后追）
              │  - V5-M9 Phase 4-6 Me / QuestionHub 切换 + Marketing 后置
              │
2026-06-06  ━┻━ sunset 闸门 — Phase 6 task 21.3 删除 V4 alias（条件：21.1a–g 全完）
              │
2026-06-06+ ━━━ V5-M10 Phase 7 视觉回归基线（playwright 36 截图）
              │  V5-M11 Phase 8 文档同步 + spec 关闭
```

### 2.2 关键并行机会

- Phase 1 task 1.1 + Phase 2 task 3/4/5/6/7 可同 wave 0 启动（lint 脚本不依赖 token 落地，只在 fixture 里写 V5 token 名即可跑过）
- Phase 5 SVG 收敛可以从 Phase 3 后期就开 batch（19.1 依赖 task 6 lint-icon-style，6 在 wave 0）
- Phase 3 35 组件骨架建议派 3–4 个 Runner subagent batch 并行（system→atom 一组、form→overlay 一组、layout→business 一组）

### 2.3 sunset 顺延规则

如 Phase 1–5 延期、或某 surface 整页切换 evidence 不全，**任何 sunset 顺延都需在以下三处显式更新**：

1. [README.md §2](./README.md) 进度表
2. `.kiro/specs/frontend-style-guide-v5/tasks.md` 任务 21.3 描述
3. [02-Token-System.md §7.6](./02-Token-System.md) Deprecate 时间线

禁止隐式延期。


---

## 3. Multica Issue 拆分矩阵

参照 SIK-44（Notes Phase）/ SIK-45（Review Phase）的"父 issue + Mx 子 issue"模式。Phase-Style-Guide-V5 也是**单层父 / 子结构**：父 issue 1 个 + 子 issue 12 个（M0–M11）。

> **命名约定**：父 issue 标题 `Style-Guide-V5 Phase 全量落地（M0-M11）`；子 issue 标题 `<父 SIK-id>-M<n> <概述>`，与 SIK-44 / SIK-45 一致。

### 3.1 子 issue 矩阵

| Identifier | Milestone | Title | Depends on | Status | 对应 spec task |
|---|---|---|---|---|---|
| SIK-71 | — | Style-Guide-V5 Phase 全量落地（M0-M11） | 无（spec 三件套已 ACCEPTED） | in_progress | — |
| SIK-72 | M0 | V5 docs-only intake + 父子 issue 落档 | 无 | done | 本文 + Phase 文档 8 篇 + spec 三件套 |
| SIK-73 | M1 | Phase 1 tokens.css 三层 + 多端断点 + V4 alias | M0 | backlog | tasks 1.1 / 1.2 / 1.4 / 1.5 / 1.6 / 1.7 + 检查点 2 |
| SIK-74 | M2 | Phase 2 6 lint 闸门 + 接入 pnpm lint | M0（不依赖 M1 落地，只依赖 V5 token 名规约） | backlog | tasks 3 / 4 / 5 / 6 / 7 / 8 + 检查点 9 |
| SIK-75 | M3 | Phase 3 35 组件骨架（含 ExamLayout 钩子） | M1, M2 | backlog | tasks 10.1–15.5 + 检查点 16 |
| SIK-76 | M4 | Phase 5 SVG 资产收敛（answering 14 + Rail 3 + 状态 8 + cat/nav 10） | M2（lint-icon-style）, M3 部分（Icon 组件 sprite 入口） | backlog | tasks 19.1 / 19.2 / 19.3 / 19.4 / 19.5 / 19.6a / 19.6b + 检查点 20 |
| SIK-77 | M5 | Phase 4-6 Home surface 整页切换 | M3, 远端 SIK-29-M11 / M12 收尾 | backlog | tasks 17.1 + 21.1a + 21.1b |
| SIK-78 | M6 | Phase 4-6 Practice surface 整页切换 | M5, 远端 Phase-Practice 前端 Phase 启动 | backlog | tasks 17.2 + 21.1c |
| SIK-79 | M7 | Phase 4-6 Review surface 整页切换 | M6, 远端 SIK-45 (Review Phase) M9-M11 落地 | backlog | tasks 17.6 + 21.1f（Review 部分） |
| SIK-80 | M8 | Phase 4-6 Notes surface 整页切换 | M7, 远端 SIK-44 (Notes Phase) M7-M11 落地 | backlog | tasks 17.3 + 21.1d |
| SIK-81 | M9 | Phase 4-6 Me / QuestionHub / 全局 styles + components 残余 + Marketing 后置 | M8 | backlog | tasks 17.4 + 17.5 + 21.1e + 21.1f（Hub 部分） + 21.1g |
| SIK-82 | M10 | Phase 6 sunset + Phase 7 视觉回归 baseline + 36 截图 | M9, 日期 ≥ 2026-06-06 | backlog | tasks 21.2 + 21.3 + 23.1 + 23.2 + 检查点 22 / 24 |
| SIK-83 | M11 | Phase 8 文档同步（Design-System.md + fail-fast 账本 + Migration-Status）+ V5 spec 关闭 | M10 | backlog | tasks 25.1 + 25.2 + 25.3 + 检查点 26 |

### 3.2 与远端业务 Phase 父 issue 的依赖矩阵

| V5 子 issue | 阻塞前置（远端） | 备注 |
|---|---|---|
| SIK-72 / SIK-73 / SIK-74 / SIK-75 / SIK-76（M0–M4） | 无远端阻塞 | 基础设施层，与远端业务 Phase 完全正交 |
| SIK-77（M5） | 远端 SIK-29 (Home Phase 父 issue) M11 / M12 收尾 | 远端 Home runtime 定型后再切 token |
| SIK-78（M6） | 远端 Practice 前端 Phase 启动后 | 远端 Practice 后端 SIK-25 in_progress；前端 Phase 父 issue 暂未创建，后续等远端拍板 |
| SIK-79（M7） | 远端 SIK-45 (Review Phase) SIK-67 / SIK-68 / SIK-69 落地 | Review 前端在 SIK-66–SIK-70 链路 |
| SIK-80（M8） | 远端 SIK-44 (Notes Phase) SIK-53 / SIK-54 / SIK-55 / SIK-56 落地 | Notes 前端 SIK-53–SIK-57 链路 |
| SIK-81（M9） | M5+M6+M7+M8 全部完成 | 残余 components / styles / Marketing 收尾 |
| SIK-82（M10） | M9 完成 + 日期 ≥ 2026-06-06 | sunset 硬时间，早一天都 blocked |
| SIK-83（M11） | M10 完成 | 关闭 V5 spec |

### 3.3 issue description 模板

每个子 issue 落 description 时遵循 SIK-44 / SIK-45 的 Markdown 结构：

```
# <Identifier>-<Milestone> <Title>

## Summary

<一句话总结本 milestone 要做的事>

## Scope

- 列出本 milestone 包含的 spec task（task 编号 + 一句话说明）
- 列出落点路径

## Depends on

- 父 issue 中的 milestone 编号（如 M1）
- 远端业务 Phase 阻塞前置（如有）

## Acceptance

- 列出验收 PASS 证据：lint / test / browser smoke / 人工 review

## Non-goals

- 明确不做的事（如 M3 不做 Phase 4 页面骨架）

## Review / Validation Gate

- 按 AGENT-H5 / H8 两条 gate 描述
- 必须独立 subagent review
- 必须有 PASS 证据，无证据不得标 done

## Source Docs

- docs/vault/05-migration/Phase/Style-Guide-V5/...
- .kiro/specs/frontend-style-guide-v5/...
```


---

## 4. Wave 0 准入清单（V5-M1 + V5-M2 启动条件）

按 [`.kiro/specs/frontend-style-guide-v5/tasks.md` Wave 0](../../../../../.kiro/specs/frontend-style-guide-v5/tasks.md) = `["1.1", "3", "4", "5", "6", "7"]`，启动 V5-M1 / V5-M2 前必须满足：

- [ ] feature 分支 `spec/frontend-style-guide-v5` 已创建（user 拍板分支策略）
- [ ] Multica 父 issue + M0–M11 子 issue 全量落档（本文 §3 定义）
- [ ] V5-M0 子 issue 标 done
- [ ] Browser MCP capability 已 preflight（虽然 wave 0 不用 browser，但 Phase 7 用，提前确认）
- [ ] AGENT-H3 capability preflight 已声明：subagent 可派、shell 可用、`pnpm lint` 在 apps/web 可跑
- [ ] 当前 working tree 已 stash 与远端业务 Phase 无关的临时改动（仅保留 V5 spec + Phase 文档）

### 4.1 Wave 0 6 个原子 commit

| commit | spec task | 文件落点 | 行数预估（净增） |
|---|---|---|---|
| 1 | task 1.1 Primitive layer | `packages/design-system/src/tokens.css` 顶部 append §1 区块 | ~120 行 |
| 2 | task 3 lint-shadow-token | `apps/web/scripts/lint-shadow-token.mjs` + `package.json` 1 行 script | ~80 行 |
| 3 | task 4 lint-zindex-token | `apps/web/scripts/lint-zindex-token.mjs` + `package.json` 1 行 script | ~70 行 |
| 4 | task 5 lint-spacing-token | `apps/web/scripts/lint-spacing-token.mjs` + `package.json` 1 行 script | ~100 行 |
| 5 | task 6 lint-icon-style | `apps/web/scripts/lint-icon-style.mjs` + `package.json` 1 行 script | ~120 行 |
| 6 | task 7 lint-touch-target | `apps/web/scripts/lint-touch-target.mjs` + `package.json` 1 行 script | ~100 行 |

每个 commit ≤15 文件、≤400 行净增（H9 Commit Batch）。每个 lint 同时按 spec task `*` 落 fixture 测试到 `apps/web/scripts/__tests__/`，但 `*` 任务标可选，不卡 wave 0 准入。

### 4.2 Wave 0 完成准入 V5-M1 / V5-M2 done

- `pnpm --filter @sikao/web lint` 全 PASS（含 6 新 lint，V4 残留 warn 模式）
- `node packages/design-system/scripts/check-theme-keys.mjs` PASS（task 1.3 可选）
- 本地 dev server (port 18080) 启动后 V4 现存页面无视觉退化（H10 + AGENT-H8）
- 独立 subagent review 通过（AGENT-H5 review gate）
- Evidence Block 回写到 V5-M1 / V5-M2 issue

---

## 5. 风险与待 lhr 对齐

### 5.1 lhr 拍板记录（2026-05-23）

| Q | 决策 | 备注 |
|---|---|---|
| Q1 分支策略 | **直推 main** | 违反 git_safety 默认，但 lhr 明确指示。每次 push 前必须 `git fetch && git rebase origin/main` 对齐远端 SIK-25（Phase-Practice P5 后端）；冲突域已评估为 0（纯增量 + 新文件）。 |
| Q2 派 Runner subagent 并行 | **同意** | 仅在 Phase 3（M3 / SIK-75）35 组件骨架时拆 3 batch（system+atom / form+overlay / layout+business）；wave 0 + Phase 1 + Phase 2 量小先主 agent 跑。 |
| Q3 Multica project_id | **null（沿用 SIK-44 / SIK-45 父子模式）** | 父 SIK-71 与 12 子 issue 全部 project_id=null，与 Notes / Review Phase 父子模式一致。 |
| Q4 M5–M8 启动条件 | **远端业务 Phase 前端父 / 关键子 issue done** | M5=SIK-29 父 done；M6=远端 Practice 前端 Phase 父 issue 创建 + 至少 1 个前端 milestone done；M7=SIK-69 done；M8=SIK-56 done。 |

### 5.2 待对齐（已全部拍板，留作历史记录）

原 §5.1 所列 4 项已于 2026-05-23 由 lhr 拍板，详见上表。

### 5.3 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| Phase 1–5 实施延期，挤压 Phase 6 双轨期 | 中 | 启动 subagent 并行 Phase 3 batch；wave 0 立刻开 |
| 远端业务 Phase 节奏推迟，导致 M5–M8 长期 blocked | 中 | M5–M9 默认 backlog；本文 §3.2 矩阵实时更新依赖状态 |
| Phase 7 playwright 36 截图首次跑通需要 dev server 稳定 | 低 | port 18080 + dev:e2e 脚本提前在 Phase 3 检查点验证 |
| V4 alias 删除后某些页面意外残留 V4 token | 中 | task 8（lint-v4-token-residual）从 Phase 2 就接入 warn 模式；21.1a–g 每个 sub-commit 都跑该 lint |
| Browser MCP 在某次 Runner 执行时不可用 | 中 | preflight 必须 fail-fast；不允许降级到 axe 单跑（H3 + H5） |
| 玻璃拟态 fallback 例外条目漏登 | 低 | task 14.3 强制把 `docs/engineering/fail-fast-exceptions.md` 追加做成产出物；task 25.2 终末核对兜底 |
| 与远端业务 Phase 同时改 `apps/web/public/icons.svg` sprite | 低 | M4 SVG 资产 commit 前 `git pull --rebase`；冲突仅在 sprite 文件 |
| 与远端业务 Phase 同时改 `Migration-Status.md` | 中 | V5 仅在 M11 修改该文件，M0–M10 全程不动 |

---

## 6. 关联文档

- [README.md](./README.md) — Phase 入口与进度表
- [00-Decisions.md](./00-Decisions.md) — 12 项决策 SSOT
- [01-Boundary-Rules.md](./01-Boundary-Rules.md) — 不变量与跨 Phase 接力
- [02-Token-System.md](./02-Token-System.md) — 三层 token 与多端断点
- [03-Components.md](./03-Components.md) — 35 组件契约
- [04-Pages.md](./04-Pages.md) — 6 桌面页 + Mobile Shell
- [09-Correctness-Properties.md](./09-Correctness-Properties.md) — 10 CP + 14 lint
- [10-Migration.md](./10-Migration.md) — V4→V5 双轨期
- [`.kiro/specs/frontend-style-guide-v5/tasks.md`](../../../../../.kiro/specs/frontend-style-guide-v5/tasks.md) — 71 task 实施清单
- [`AGENTS.md` §0.2 / §4.3](../../../../../AGENTS.md) — 硬规则与前端 SSOT
