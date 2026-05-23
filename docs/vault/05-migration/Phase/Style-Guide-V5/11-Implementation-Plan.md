# 11 · Implementation Plan（V5 落地节奏 + Multica issue 拆分）

> **Status**: ACTIVE
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-24
> **作用**：把 V5 Phase 1–8 落地节奏与 Multica 子 issue 一一对应；与远端业务 Phase（Home / Practice / Review / Notes）并行节奏的边界声明 SSOT。

---

## 0. V5-M0.5 Big-Bang Rebuild（2026-05-24 决策）

### 0.1 决策内容

lhr 在 2026-05-24 拍板：放弃 V4 → V5 整页 surface 切换路径，改为 big-bang 重建。

- `apps/web/src/{views,components,layouts,lib,utils,router,styles,test-utils,types,assets,__tests__}` 整段删除
- `packages/ui/**` 整包从 monorepo 移除
- `packages/design-system/src/tokens.css` §8 V4 alias 区块同步删除
- 前端业务层在 V5 规范下从零实现

### 0.2 主线收敛

原 13 milestone（M0 / M1..M11）砍到 8 个：

| Milestone | 状态 | 说明 |
|---|---|---|
| M0 | done（SIK-72） | docs intake |
| M1 | done（SIK-73） | tokens.css 三层 |
| **M0.5（NEW）** | **NEW** | big-bang rebuild + lint 聚合 |
| M2 | in_progress（SIK-74） | 6 lint 闸门 |
| M3 | backlog（SIK-75） | 35 组件骨架 |
| M4 | backlog（SIK-76） | SVG 资产收敛 |
| M9（重命名） | backlog（SIK-81） | V5 兜底实施 + 视觉回归 baseline（合并原 M9 + M10 视觉回归） |
| M11 | backlog（SIK-83） | 文档同步 + spec 关闭 |

### 0.3 砍掉的 milestone

| 原 issue | 状态 | 处置 |
|---|---|---|
| SIK-77 (M5 Home surface 切换) | backlog → cancelled | big-bang 后无 V4 surface；Home 实现归 SIK-29 family / 新 V5 框架 |
| SIK-78 (M6 Practice surface 切换) | backlog → cancelled | Practice 前端归 SIK-26/27/28 |
| SIK-79 (M7 Review surface 切换) | backlog → cancelled | Review 前端归 SIK-66-70 |
| SIK-80 (M8 Notes surface 切换) | backlog → cancelled | Notes 前端归 SIK-53-57 |
| SIK-82 (M10 sunset + 视觉回归) | backlog → cancelled / 重命名 | sunset 部分 ARCHIVED；视觉回归 baseline 合并到新 M9 |
| SIK-84 (僵尸重复 issue) | backlog → cancelled | 与 SIK-85 description 完全相同；2026-05-23 误建 |

### 0.4 V5 spec 影响

- `requirements.md` REQ-12 整段 ARCHIVED；R1/Q6 双轨期 ARCHIVED
- `design.md` §C.6 V4→V5 mapping ARCHIVED
- `tasks.md` Phase 6（21.x）+ wave 21–24 ARCHIVED；task 1.7 ARCHIVED；task 8 降级可选；task 23.1 V4 扫描章节 ARCHIVED
- `02-Token-System.md` §7（V4 mapping）+ §7.6（sunset 时间线）ARCHIVED
- `00-Decisions.md` 加 §0 V5-M0.5 章节
- `10-Migration.md` 整篇 ARCHIVED

### 0.5 Multica 账本

新建 **SIK-86 V5-M0.5 big-bang rebuild**（child of SIK-71）；cancel SIK-77/78/79/80/82/84；SIK-71 description 更新 milestone map。SIK-29 M11/M12（SIK-42/43）由新 V5 框架重新承接（不在 V5 SIK-71 范围内，归 SIK-29 family 内务）。

---

## 1. 总览（2026-05-24 V5-M0.5 调整后）

V5 是水平视觉基础设施 Phase。**big-bang rebuild 决策后，主线大幅收敛**：

- **Phase 1 / 2 / 3 / 5（基础设施 4 件套）**：M0 / M1 done，M2 / M3 / M4 进行中或 backlog——这些不变
- **V5-M0.5 big-bang rebuild**：在 M2（lint）进行中插入，一次性删 V4 业务层 + lint 聚合
- **Phase 4 + 6 + 7（页面骨架 + 整页 token 切换 + 视觉回归）**：原计划 ARCHIVED，由各业务 Phase 直接消费 V5 规范从零实现
- **Phase 7 视觉回归 baseline**：保留，合并到新 V5-M9
- **Phase 8 文档同步 + spec 关闭**：保留

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

### 2.3 ~~sunset 顺延规则~~ — ARCHIVED 2026-05-24

> **作废**：big-bang 后无 sunset 时间约束。原 21.3 sub-task ARCHIVED；02-Token-System.md §7.6 ARCHIVED。


---

## 3. Multica Issue 拆分矩阵（2026-05-24 V5-M0.5 调整后）

> **2026-05-24 调整**：原 12 子 issue（M0..M11）→ 调整为 8 个有效 + 6 个 cancelled + 1 个 NEW。详见 §0.3。

### 3.1 子 issue 矩阵

| Identifier | Milestone | Title | Depends on | Status |
|---|---|---|---|---|
| SIK-71 | — | Style-Guide-V5 Phase 全量落地（M0-M11，big-bang 调整后） | 无 | in_progress |
| SIK-72 | M0 | V5 docs-only intake + 父子 issue 落档 | 无 | done |
| SIK-73 | M1 | Phase 1 tokens.css 三层 + 多端断点 + ~~V4 alias~~ | M0 | done |
| **SIK-86 (NEW)** | **M0.5** | **V5-M0.5 big-bang rebuild + lint 聚合** | M1 (SIK-73) | in_progress |
| SIK-74 | M2 | Phase 2 6 lint 闸门 + 接入 pnpm lint | M0.5 | in_progress |
| SIK-75 | M3 | Phase 3 35 组件骨架（含 ExamLayout 钩子） | M0.5, M1, M2 | backlog |
| SIK-76 | M4 | Phase 5 SVG 资产收敛 | M2, M3 部分 | backlog |
| ~~SIK-77~~ | ~~M5~~ | ~~Phase 4-6 Home surface 整页切换~~ | — | **cancelled 2026-05-24** |
| ~~SIK-78~~ | ~~M6~~ | ~~Phase 4-6 Practice surface 整页切换~~ | — | **cancelled 2026-05-24** |
| ~~SIK-79~~ | ~~M7~~ | ~~Phase 4-6 Review surface 整页切换~~ | — | **cancelled 2026-05-24** |
| ~~SIK-80~~ | ~~M8~~ | ~~Phase 4-6 Notes surface 整页切换~~ | — | **cancelled 2026-05-24** |
| SIK-81 | M9 | V5 兜底实施 + 视觉回归 baseline 合并 | M3, M4, 各业务 Phase 前端基本到位 | backlog |
| ~~SIK-82~~ | ~~M10~~ | ~~Phase 6 sunset + 视觉回归 baseline + 36 截图~~ | — | **cancelled 2026-05-24**（baseline 合并到 SIK-81） |
| SIK-83 | M11 | Phase 8 文档同步 + V5 spec 关闭 | M9（新） | backlog |
| ~~SIK-84~~ | ~~—~~ | ~~Frontend-IA-V2 view 原型补全（与 SIK-85 重复）~~ | — | **cancelled 2026-05-24**（僵尸） |
| SIK-85 | — | Frontend-IA-V2 view 原型补全（→ 98%） | 无 | done（2026-05-23） |

### 3.2 与远端业务 Phase 父 issue 的依赖矩阵（2026-05-24 V5-M0.5 调整后）

> **简化**：big-bang 重建后，V5 不再尾随各业务 Phase 节奏。M0.5 + M2 / M3 / M4 / M9 / M11 全部独立推进；各业务 Phase（Home / Practice / Notes / Review）在 V5 spec + 组件骨架到位后**自主决定**何时实施前端，不需要 V5 子 issue 包装。

| V5 子 issue | 阻塞前置 | 备注 |
|---|---|---|
| SIK-72..73（M0/M1） | 无 | done |
| SIK-86（M0.5） | M1 (SIK-73 done) | big-bang 一次性删 + 骨架重建 + lint 聚合 |
| SIK-74（M2） | M0.5 完成 | 6 lint 闸门 |
| SIK-75（M3） | M0.5, M1, M2 | 35 组件骨架 |
| SIK-76（M4） | M2, M3 部分 | SVG 资产收敛 |
| SIK-81（M9） | M3, M4，**各业务 Phase 前端基本到位** | 兜底实施 + 视觉回归 baseline |
| SIK-83（M11） | M9 | 文档同步 + spec 关闭 |

V5-M5..M8 surface 切换（SIK-77/78/79/80）已 cancel；各业务 Phase 直接消费 V5 规范实现 = 包揽原"surface 切换"内容。SIK-29 M11/M12（SIK-42/43）由新 V5 框架重新承接，归 SIK-29 family 内务。

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
