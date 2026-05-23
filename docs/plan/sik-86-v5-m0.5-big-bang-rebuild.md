---
type: plan
issue: SIK-86
parent: SIK-71 (Style-Guide-V5 Phase 全量落地)
status: in_progress
owner: lhr
created: 2026-05-24
---

# SIK-86 · V5-M0.5 Big-Bang Rebuild

## Summary

放弃 V4 → V5 整页 surface 切换路径，一次性删 `apps/web` 业务层 + `packages/ui`
整包 + `tokens.css §8` V4 alias 区块；前端业务层在 V5 规范下从零实现。

## Decision Source

- **lhr 拍板 2026-05-24**：会话中明确"旧前端不需要修了 / 我现在就是想要重做
  前后端的 / 直接切旧前端怎样"+"一刀切，全删干净 / 现在一并清理"。
- 触发：V5-M2 / SIK-74 task 3 `lint-shadow-token` 实现后跑全仓 lint，发现
  256+ V4 时代硬编码违规（marketing 3 / index.css focus-ring 3 / mvp 1 +
  lint-radius 43 + lint-hardcode 206）。修代码续命与重做的成本比让用户选了
  big-bang。

## Scope

### 删除（A）

- `apps/web/src/{views,components,layouts,lib,utils,router,styles,test-utils,types,assets,__tests__}/**`（544 文件）
- `packages/ui/**`（167 文件）
- `packages/design-system/src/tokens.css §8` V1/V4 alias region（260 行）
- `apps/web/{package.json,tsconfig.app.json,vite.config.ts,vitest.config.ts}` 中 `@sikao/ui` 配置项

### 改写（B）

- `apps/web/src/{main.tsx,index.css,setupTests.ts}`：V5 token-only 最小骨架
- `apps/web/src/router/{index.tsx,BootCard.tsx}`：占位 router + 启动卡
- `packages/shared-utils/src/ToastHost.tsx`：从 `@sikao/ui` shim 改为 V5 token 内联实现
- `packages/editor/src/{ExamShell,TopBar,pieces/*,panels/*,modals/*}` 中 V4 token 引用 → V5 token

### 冻结（C）

- `packages/editor`：13 文件 import `@sikao/ui/icons` + `@sikao/ui/ui/Tooltip`，
  big-bang 后全部断链。重命名 `typecheck` script → `typecheck:frozen` 让
  workspace `--if-present` 跳过；解冻由独立 Exam spec 在 V5-M3 / V5-M4 时承接。

### 保留（D）

- `packages/{answer-engine,api-client,calendar-engine,config,design-system,domain,shared-utils}` 全部
- `tests/fixtures/{essayExamMock.ts,server.ts,handlers.ts,renderWithProviders.tsx,index.ts}`（idle，等 editor 解冻或 V5-M3 重写）
- `apps/web/{eslint.config.js,index.html,postcss.config.js,public,scripts/,tailwind.config.js,tsconfig*.json}`

## Spec / Phase doc 影响

| 文档 | 改动 |
|---|---|
| `requirements.md` | REQ-12 整段 ARCHIVED；R1/Q6 双轨期决策 ARCHIVED |
| `design.md` | §C.6 V4 → V5 token mapping 整段 ARCHIVED |
| `tasks.md` | Phase 6（21.1a-g + 21.2 + 21.3 + 21.3a）整段 ARCHIVED；task 1.7 ARCHIVED；task 8 降级可选；task 23.1 V4 扫描章节 ARCHIVED；wave dependency graph 移除 wave 21-24 |
| `Phase/Style-Guide-V5/00-Decisions.md` | 加 §0 V5-M0.5 决策章节；R1/Q6 划线 |
| `Phase/Style-Guide-V5/02-Token-System.md` | §7 V4 mapping + §7.6 sunset 整段 ARCHIVED |
| `Phase/Style-Guide-V5/10-Migration.md` | 整篇 ARCHIVED（frontmatter `status: archived`） |
| `Phase/Style-Guide-V5/11-Implementation-Plan.md` | 加 §0 V5-M0.5 章节；§1-§3 重写（13 → 8 milestone） |
| `Phase/Style-Guide-V5/README.md` | §1 / §2 / §3 全面更新 |
| `Phase/Style-Guide-V5/01-Boundary-Rules.md` | §3 接力时序重写；§4.2 sunset ARCHIVED |
| `Migration-Status.md` | 前端代码迁移 complete → scrapped；@sikao/ui partial → removed |

## Multica 主线收敛

| 原 milestone | 新状态 | 处置 |
|---|---|---|
| SIK-72 (M0) | done | 不变 |
| SIK-73 (M1) | done | 不变（task 1.7 ARCHIVED） |
| **SIK-86 (M0.5 NEW)** | in_progress | 本 plan |
| SIK-74 (M2 lint) | in_progress | 不变 |
| SIK-75 (M3 35 组件) | backlog | 依赖改为 M0.5 + M1 + M2 |
| SIK-76 (M4 SVG) | backlog | 不变 |
| SIK-77 (M5 Home 切换) | **cancelled** | big-bang 后无 V4 surface 可切；Home 实施归 SIK-29 family |
| SIK-78 (M6 Practice 切换) | **cancelled** | Practice 前端归 SIK-26/27/28 |
| SIK-79 (M7 Review 切换) | **cancelled** | Review 前端归 SIK-66-70 |
| SIK-80 (M8 Notes 切换) | **cancelled** | Notes 前端归 SIK-53-57 |
| SIK-81 (M9 兜底+回归) | backlog | 重命名为 "V5 兜底实施 + 视觉回归 baseline 合并" |
| SIK-82 (M10 sunset) | **cancelled** | sunset 部分 ARCHIVED；视觉回归 baseline 合并到 SIK-81 |
| SIK-83 (M11 文档同步) | backlog | 依赖改为 M9 |
| SIK-84 (僵尸 IA-V2 重复) | **cancelled** | 与 SIK-85 description 完全相同；2026-05-23 误建 |

SIK-29 M11/M12（SIK-42/43，"Home 路由收口" + "MSW/e2e/a11y/Chrome MCP 验收"）
原 deliverable 在 commit 4 被删除；处置：cancel + 由新 V5 框架（V5-M3 + V5-M9）
重新承接，归 SIK-29 family 内务。

## Commit 序列

| # | commit | files | net |
|---|---|---|---|
| ① | docs(style-guide-v5): scrap V4-V5 migration | 10 | +329 -149 |
| ② | feat(design-system)!: drop V1/V4 alias from tokens.css | 7 | +42 -306 |
| ③ | feat(ui)!: remove @sikao/ui package | 180 | -9262 |
| ④ | feat(web)!: scrap V4 frontend | 544 | -75182 |
| ⑤ | feat(web): minimal main.tsx + skeleton | 6 | +243 -543 |
| ⑥ | feat(web): integrate lint-shadow + aggregate pnpm lint | 2 | +128 -1 |
| ⑦ | test(packages): freeze @sikao/editor + slim vitest | 4 | +52 -28 |
| ⑧ | docs(plan): SIK-86 plan doc | 1 | this file |
| ⑨ | chore(multica): account ledger sync | 0 (CLI only) | — |

H9 例外：commit ③+④ 是 lhr 明确批准的 big-bang 一次性删除，commit message
中显式标记并记录授权（"一刀切，全删干净" 2026-05-24）。

## Verification

- `npm run typecheck` (root, --workspaces --if-present) — PASS
- `npm test` (root) — PASS（apps/web `passWithNoTests`，packages 无 test script 自然跳过）
- `npm run lint -w @sikao/web` — PASS（聚合 9 lint 全绿）
- `npm run build -w @sikao/web` — PASS（5 chunks / 18kB CSS / 274kB vendor / 818ms）
- 与 SIK-25 (Practice P5 后端) 并行：零文件接触面，每个 commit 前 `git fetch origin` 兜底

## Rollback

每个 commit 独立可 `git revert`。9 commit 全 revert 即恢复 V4 业务层 + V4
alias + @sikao/ui，但 spec / Phase 文档需要手动 revert ARCHIVED 标记。
sunset 硬时间 (2026-06-06) 已作废，不影响回滚窗口。

## Next Owner

lhr：审视 V5-M3（SIK-75 Phase 3 35 组件骨架）启动时机。

## Cross-References

- AGENTS.md §0.2 H9 Commit Batch + §0.5.5 Git Gate（big-bang H9 例外条件）
- `.kiro/specs/frontend-style-guide-v5/{requirements,design,tasks}.md`
- `docs/vault/05-migration/Phase/Style-Guide-V5/11-Implementation-Plan.md` §0
- `docs/vault/05-migration/Migration-Status.md` 前端代码迁移段
