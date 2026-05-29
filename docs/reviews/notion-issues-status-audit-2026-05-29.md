---
type: review
status: complete
owner: subagent
created: 2026-05-29
target: Notion SIKAO / Issues DB 全量 Status vs git/code state audit
plan: docs/plan/notion-workflow-fix-2026-05-29.md (post-hotfix follow-up)
---

# Notion Issues Status Audit · 2026-05-29

## TL;DR

- 枚举到 page 数：**134**（129 条带 Identifier 的 issue + 5 条 non-issue `[Template]`）。
- Identifier 覆盖：**SIK-10 ~ SIK-138，区间内零缺号**（129/129）。SIK-1 ~ SIK-9 在 Issues DB 中不存在（最早 issue 是 SIK-10）。
- Status 分布（含模板）：Done=67 / In Progress=8 / Backlog=23 / Todo=0 / Cancelled=36。
  - 去掉 5 个模板（1 Done + 4 Backlog）后，真实 issue：Done=66 / In Progress=8 / Backlog=19 / Cancelled=36。
- **核心结论：Issues DB 的 `Status` 字段（SSOT）整体与 git/code 状态自洽，没有发现 High 级 drift。**
  - 没有 `drift-Done-without-evidence`（High）。
  - 没有 `drift-Cancelled-but-shipped`（High）—— 所有带 main commit 的编号都是 Done/In Progress，无一是 Cancelled。
  - 没有 `drift-Backlog-but-coding`（Medium）—— 所有 Backlog issue 在 git/branch 中零痕迹。
- drift 总数：**4**（High=0 / Medium=3 / Low=1）。另有 **4 处父 issue body Child Matrix stale**（§Rules·9 预期内，body 手写表非 SSOT）。

---

## 枚举方法 + 覆盖率

### 枚举过程

1. **主路径**：从 `seed.json` 读 95 个 page_id，逐条 `mcp_notion_notion_fetch` 取 properties，增量写入 `issues-snapshot.json`（JSONL，断点续作）。
2. **Sub-issues traverse**：对 5 个父 epic（SIK-29 / SIK-44 / SIK-45 / SIK-19 / SIK-71）+ SIK-13 的 `Sub-issues` 数组逐一 fetch（不按 index 推 Identifier，全部 fetch 看 `properties.Identifier`，遵 §Rules·9 + 4-Action A2）。补齐 SIK-30/33-41、46-52、53-57、58-70、72-83、87-88、113-117 等。
3. **补全 search 轮**（`data_source_url` filter）：
   - 轮 1 关键词：`SIK-13 Phase 1 后端骨架` → 命中 SIK-13 family；`SIK-115 child` → 命中 SIK-115。
   - 轮 2：`MVP 公考 AI 架构 数据模型` → 命中 SIK-10（无 Identifier 前缀的早期 page）。
   - 轮 3：`SIK-13 后端全重构` → 命中 parent SIK-13。
   - 轮 4-7：`申论 行测 批改 / Todo In Progress 探测 决策 / Foundation Auth Onboarding / 价值闭环 PRD worktree / SIK-1~9 项目初始化` 等 —— **连续 3+ 轮未发现新 page_id，判定枚举收敛**。
4. **收敛验证**：snapshot 唯一 Identifier = 129，区间 [SIK-10, SIK-138] 零缺号；SIK-1~9 多轮 search 均无命中，确认不存在。

### 覆盖率与缺口

- **完全覆盖**：SIK-10 ~ SIK-138 全部 129 条 + 5 个 Template page。
- **无法建立 git 关联的缺口**（非枚举缺口，是验证缺口）：
  - Work Log relation 未逐条拉取（§步骤 3d 标记可选，重则跳过）—— 登记为 known-gap，见 §Reviewer 自检。
  - `git-sik-refs.txt` 仅 35 个 unique 编号（curated 提取），大量后端 issue 的 commit message 未带 `SIK-NNN`，导致后端 Done issue 多落 `unverifiable`（非 drift）。

---

## drift 列表

| # | SIK | Title | Status | 代码证据 | drift 类型 | 优先级 | 建议动作 |
|---|---|---|---|---|---|---|---|
| 1 | SIK-103 | [Tab3·M-Today] ReviewToday + Smart Cards | In Progress | git main=0 / all-branch=0 / 无 `*/sik-103-*` branch；body 注明被 SIK-128 1920 cap 决策阻塞，全 Tab3 子 issue 未启动 | drift-stale-in-progress | Medium | 回退到 Backlog（与同级 SIK-104/105/106 一致），或确认确有进行中工作再保留；当前 In Progress 无任何 git 痕迹 |
| 2 | SIK-44 | Notes Phase 后端落地（M0-M6） | Backlog | 全部后端子 issue SIK-46~52 = Done；前端子 SIK-53~57 = Cancelled（已迁 SIK-120）。epic 后端已 100% 收口，parent 仍 Backlog | drift-stale-parent-status | Medium | parent 应置 Done（后端 epic 已完成）或 In Progress；Backlog 对一个 7 个后端子全 done 的 epic 误导 |
| 3 | SIK-45 | Review Phase 后端落地（M0-M7） | Backlog | 后端子 SIK-58~65 = Done（多条 main commit：SIK-60/61/62/63/64/65）；前端子 SIK-66~70 = Cancelled（已迁 SIK-119）。parent 仍 Backlog | drift-stale-parent-status | Medium | 同 SIK-44，parent 应置 Done/In Progress |
| 4 | SIK-12 | SIKAO 产品闭环与 UI 基座优化方案 | Done | git main=0 commit；commit 仅在未合并的 `codex/sik-12-pr0-*` branch（all-branch=3）。其 apps/web 产物已被 SIK-86 V5-M0.5 big-bang（删 544 文件）整体抹除 | unverifiable / 历史 done | Low | 无需改 Status（工作当时确已完成，后被 big-bang 取代）；仅记录"代码已不在 main"作为历史脉络 |

> 说明：SIK-112/118/119/120（4 个 Tab 总线）虽 In Progress 且 parent 自身 main commit=0，但属 Master 编排父 issue（§2.2），状态反映"编排意图"而非自身 git 痕迹：SIK-112 的子 issue（SIK-90/91/92/93/121/122/125/126/127）已大量合入 main，In Progress 自洽；SIK-118/120 子全 Backlog、SIK-119 子 SIK-102 done 其余 Backlog —— 父 In Progress 已在 body comment 显式说明"子全 backlog、被 SIK-128 阻塞"，属 `unverifiable`（编排父，非硬 drift）。SIK-121/138/128 In Progress 均有 main commit + plan + review 文档 + 活跃 branch，属正常进行中，不计 drift。

## 父 issue body 表 stale（§Rules·9 Reflex）

> Issues DB `Status` 字段是唯一真值；下表是父 issue body 内手写 Child Matrix / Main-line Convergence 表与子 issue 真实 `Status` 字段的逐行比对。这些 stale 多停在 multica 时代，§Rules·9 已明确"body 表非 SSOT、保留人工编辑空间"，因此**列为脉络记录，不要求逐条修 body**。

| 父 issue | 表行 | body 写的 status | 子 issue 真实 Status | 子 issue Identifier |
|---|---|---|---|---|
| SIK-29 | Child Matrix M11 | `todo` | **Cancelled** | SIK-42 |
| SIK-29 | Child Matrix M12 | `todo` | **Cancelled** | SIK-43 |
| SIK-44 | Child Matrix M0~M6（SIK-46~52 全写 `backlog`） | `backlog` | **Done**（7/7 后端子全 done） | SIK-46/47/48/49/50/51/52 |
| SIK-45 | Child Matrix M0~M7（SIK-58~65 部分截断，可见 `done`） | 截断未全列 | Done（SIK-58~65 全 done） | SIK-58~65 |
| SIK-71 | Child Matrix（SIK-73/74/75/76/77/79/80/81/82/83 全写 `backlog`） | `backlog` | **混合**：SIK-72/73/74/75/76/83=Done，SIK-77/78/79/80/81/82=Cancelled | SIK-72~88 |
| SIK-71 | Main-line Convergence 表（SIK-77~80 surface migration 写 `cancelled`，SIK-82 写 `cancelled`，SIK-81 写 `backlog`） | 部分对 | SIK-81 实际=Cancelled（body 写 backlog） | SIK-81 |

要点：
- **SIK-29 那条（SIK-42/43 body=todo 实际 Cancelled）已被 `plan notion-workflow-fix-2026-05-29.md` 明确列为本批范围外的已知遗留，本次复核确认仍 stale**（符合预期，不在本审计修复范围）。
- **SIK-44 / SIK-71 的 Child Matrix stale 是新发现**：两个 epic 的 body 表整体停在创建初期的 `backlog`，但子 issue 字段已大量推进到 Done/Cancelled。属 §Rules·9 预期内的 body-vs-field 漂移，**只需后续按 §Rules·9 以字段为真值开工即可，body 表是否回写由 lhr 决定**。

## non-issue（无 Identifier 的 page）

| Title | Tab | 用途 |
|---|---|---|
| [Template] Tab 子 issue (visual) | Template | 视觉 milestone issue 模板（§2.1） |
| [Template] Tab 子 issue (non-visual) | Template | 非视觉 milestone issue 模板（§2.2） |
| [Template] Foundation cross-tab | Template | 跨 Tab 基础设施 issue 模板（§2.3） |
| [Template] Decision | Template | 重大决策留档模板（§2.4） |
| [Template] Audit / Review | Template | Audit/Review/Post-mortem 模板（§2.5） |

5 个 `[Template]` page 的 `Tab=Template`、`Identifier=""`，与 plan 文档"保留现状便于 search 过滤"一致，不参与 Status drift 判定。注意：模板自身 Status 字段是占位值（Decision 模板=Done，其余=Backlog），属模板默认值噪音，无意义。

## 代码侧交叉核查信号汇总（节选）

git/code 交叉核查方法：a) `git-sik-refs.txt` grep（大小写归一）；b) `git log --oneline main` 计 main commit；c) `docs/plan/sik-NNN*` + `docs/reviews/sik-NNN*` file_search；d) `git branch -a` 活跃 branch。

| SIK | Status | main commits | plan/review docs | 活跃 branch | verdict |
|---|---|---|---|---|---|
| SIK-121 | In Progress | 15 | sik-rail-v5-visual-contract + 6 review | feat/sik-121-w2/finalize, fix/sik-121-w2.5 | consistent（进行中，强证据） |
| SIK-138 | In Progress | 15 | sik-138 plan + contract + w1/w7 review | feat/sik-138-w7 | consistent |
| SIK-128 | In Progress | 3 | sik-128 contract + w1/w2 review | feat/sik-128-workspace-dashboard-cap | consistent |
| SIK-90/91/92/93 | Done | 13/8/3/8 | sik-fu-* contract + sik-9X-w-all review | — | consistent |
| SIK-122/125/126/127 | Done | 各 1 | sik-12X-w1 review | — | consistent |
| SIK-63/64/65 | Done | 8/3/2 | sik-63/64/65 plan+review | codex/sik-63/65 (已合 main) | consistent |
| SIK-60/61/62/59 | Done | 2/2/1/1 | sik-59~62 plan+review | — | consistent |
| SIK-47~52 | Done | 2/0/3/4/2/2 | sik-47~52 plan+review | — | consistent（部分仅 docs 闭环） |
| SIK-103 | In Progress | 0 | 无 sik-103 plan/review | 无 | **drift-stale-in-progress** |
| SIK-104/105/106/107~111/129~136 | Backlog | 0 | 无 | 无 | consistent（未启动） |
| SIK-12 | Done | 0（仅未合并 branch） | — | codex/sik-12-pr0-* | unverifiable（big-bang 取代） |

## 已知不在本次范围

- **SIK-29 父 issue Child Matrix（SIK-42/43 写 todo 实际 Cancelled）**：与 `docs/plan/notion-workflow-fix-2026-05-29.md` §已知不在本批范围一致。本次复核确认仍 stale，不修。
- **`[Template]` 5 份 page 的 Status 占位值**：保留现状，便于 search 过滤，不混进业务面。
- **历史 issue body 顶部 `> **Multica**: ...` meta 段**（约 100+ 条）：保留，本次不清理。其中部分 meta 的 `status` 文字（如 SIK-123 body meta 写 `todo`）与 Status 字段（Cancelled）不一致 —— 这是迁移期 mirror 快照，**Status 字段为准**，不算 drift（§Rules·9）。
- **Work Log relation 逐条核查**：本批跳过（重），登记为 known-gap。

## Reviewer Mode 自检

- 是否独立读了 Notion + git：**是**（134 page 全 fetch properties；git main/all-branch/branch/refs 四类信号交叉）。
- 是否调用了破坏性工具：**否**（无 update_page / 无 create_pages / 无 commit / 无 push；全程只读）。
- 是否在 review 范围外动了文件：**否**（仅写 `.tmp_review/notion-audit/issues-snapshot.json` 中间产物 + 本报告，符合 brief 唯一允许写的两个文件）。
- 能力 Preflight：git ✓ / Notion MCP（search+fetch）✓ / shell PowerShell ✓ / file 工具 ✓ / subagent spawn：本会话自身即 subagent，未再 spawn。
- MCP fail-fast：全程无 502，无重试登记。
- Known-gap：(1) Work Log relation 未逐条核查；(2) 后端 Done issue 因 commit message 未带 SIK-NNN 多落 unverifiable（非 drift，git-sik-refs.txt 仅 35 unique 编号）。
