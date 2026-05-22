# Phase-Practice · Reality Recalibration Plan (RR-Plan)

> **Status**: ACCEPTED (Define-First doc, v2 post-review)
> **Scope**: 修正 Practice Phase 文档体系（18 个 .md）与代码现实之间已发现的 drift；不引入新业务决策、不改运行时代码、不改 DB schema、不改 API 契约。
> **Master**: lhr (拍板) / Kiro Web Master agent (编排)
> **Runner**: `general-task-execution` subagent per RR
> **Reviewer**: `semantic_reviewer` per RR (≥50 行新增触发 H5)
> **Last Updated**: 2026-05-22
> **Revision**: v4 — fixed reviewer v3 NEW issues: (1) `last_heartbeat_at` writer fabrication (`timing.heartbeat` → `session_lifecycle.heartbeat`), (2) `last_activity_at` cross-module writer conflict moved to §2.4 lhr decision queue (23 → 22 fields), (3) 02 §2.2 grouping cleanup added to RR-6 scope

---

## 0. 为什么开这个 Plan

`docs/practice-closeloop/*` 在路（PR #3 / #4 / #5）处理的是 Tab 2 的**新模块**（B25-B30：timing / session_lifecycle / mock_exam / preferences / qmeta / question_report）的决策 / schema / 边界对齐。但 main 上的 18 份 Practice 文档与 `services/api/src/sikao_api/modules/*` + `apps/web/src/router/index.tsx` 之间**还有 P0/P1 级别的事实级 drift**，与 closeloop plan 正交。两条线必须并行。

本 RR-Plan 是这条 drift-fix 线的 SSOT，覆盖 9 个独立 PR (RR-1 ~ RR-9) + 1 个 blocker 记录 (RR-10)，每个 PR 严格满足 AGENTS H9 (`<=15 文件 / <=400 行净增`)。

### 0.1 v1 → v2 → v3 → v4 修订说明（review 链路）

**v1 → v2** (reviewer round 1，5 HIGH + 4 MEDIUM + 4 LOW)：

| 错误项 | v1 内容 | v2 修正 |
|---|---|---|
| modules 数量 | "30 modules" | **26 modules**（grep 实测） |
| answer_session 端点数 | "26 endpoints" | **25 endpoints** (`grep -cE "@router\."` 实测) |
| RR-2 target | "A0 §2.4 错称 prompts/ 不存在" | **A0 §2.4 是正确的**；真 drift 在 **05-LLM-Module §1** 的"已建" markers |
| RR-3/4/5 Define-First 标签 | "yes (契约)" | **改为 reality-only**；决策类项目在 §2.4 单列 |
| RR-1 ↔ RR-3 §2.3 essay 行所有权 | 模糊 | **RR-1 owns §2.3 整表**；RR-3 仅 §2.3.1 |

**v2 → v3** (reviewer round 2，2 HIGH + 1 MEDIUM + 1 LOW NEW issues)：

| 错误项 | v2 内容 | v3 修正 |
|---|---|---|
| 字段名 typo | `force_submit_reason` | **`force_submitted_reason`**（schema 实测，12 处用 forced 后缀） |
| RR-6 vs 11 §6.3 substantive conflict | 仅加 backref + supersede 子句 | **RR-6 范围扩到 11 §6.3 改写**（Path A）：thin helpers invoked by lifecycle，writer 仍是 lifecycle |
| RR-6 Before 引用错章节 | "11 §1.2 + 11 §2.3" | **"11 §1.2 (state machine only) + 12 §2.3 (transition rules)"**；§2.3 是 QuestionTimingBaselineV2 与 pause 无关 |
| §6 字段闭合表 inclusion criterion 不清 | 18 fields，含 `last_recomputed_at` 但漏 `total_active_seconds` 不对称 | **23 fields**（加 `total_active_seconds / paused_count / expires_at / allow_review_during / started_at`）+ §6 header 加 inclusion criterion |
| §1.3 A0 §12 引用 | 未标 closeloop adds | **明确标 "closeloop PR#4 adds §12"** |
| RR-1 build_practice_center_envelope rename scope | Section 仅 §2.3 但 acceptance "全部" 隐含 §4 | **Section 改 "§2.3 + §4 (rename only)"** |

**v3 → v4** (reviewer round 3，1 HIGH + 1 MEDIUM + 1 LOW NEW issues)：

| 错误项 | v3 内容 | v4 修正 |
|---|---|---|
| `last_heartbeat_at` writer fabrication (HIGH) | `timing.heartbeat`（不存在的 module.action） | **`session_lifecycle.heartbeat`**（12 §1.3 文件结构有 `heartbeat.py`，12:321 实际写 last_heartbeat_at） |
| `last_activity_at` 写入冲突 (MEDIUM) | 标 `session_lifecycle (任何 state-changing event)` 但 11 §3:221 实有 `timing.event_recorder` 写入 | **从 §6 表格移除该行**，移到 §2.4 lhr 决策清单（双 writer 现状需 lhr 拍板）。23 → 22 fields. |
| 02 §2.2 grouping 与 §6 in-file 矛盾 (LOW) | §2.2 line 47 把 `paused_total_seconds` 归 timing 字段，§6 (after Path A) 归 session_lifecycle | **RR-6 scope 加 02 §2.2 grouping cleanup**: 把 `paused_total_seconds` 从 timing 组移到 session_lifecycle 组（line 47 / 222）；`last_activity_at` 加注释 "see §2.4" |

---

## 1. 范围与原则

### 1.1 In Scope

- 修订 Practice Phase 子文档，使其与以下事实一致：
  - `services/api/src/sikao_api/modules/` 实际 26 个模块目录
  - `services/api/src/sikao_api/modules/llm/` 实际子结构（含 `application/llm/prompts/{_shared, essay_grading, qa}.py`）
  - `services/api/src/sikao_api/modules/answer_session/interface/routes.py` (475 行 / **25 端点**)
  - `services/api/src/sikao_api/modules/essay/interface/routes.py` (7 端点 / 未挂载)
  - `services/api/src/sikao_api/modules/content/application/service.py` (5 个真函数, 已超前)
  - `services/api/src/sikao_api/main.py` 实际 13 个 `include_router`
  - `services/api/src/sikao_api/core/scheduler.py` 现状（lifespan-based, not APScheduler, no `cron/` dir — 后者由 closeloop PR#4 修）
  - `apps/web/src/router/index.tsx` 实际路由表
- 补全 11-15 五个新模块在 10-Testing 的 invariant + e2e 矩阵
- 登记 Tab 4 NoteV2 升级风险点
- 新建跨模块字段所有权矩阵 (`02-Data-Model §6`)

### 1.2 Out of Scope（永远不在本 Plan 内）

- 任何运行时代码修改
- 任何 DB schema / migration / 模型字段修改
- 任何**新增业务决策**（决策类改动一律走 closeloop plan 或独立 decision PR）
- 任何前端视觉改动
- `apps/web/package.json` 的 scripts 修改 → RR-10 仅记录 blocker，本会话不实施
- B17 ownership / B20 essay 路由策略的拍板 → 见 §2.4

### 1.3 与 closeloop plan (`docs/practice-closeloop/*`) 的关系

- **base 都是 main**，互不依赖
- **接触清单** (per closeloop PR description) — RR-* 不得触及以下章节：

| Closeloop PR | 触及章节 | RR-* 必须避让 |
|---|---|---|
| #3 | `00-Decisions.md` §0 / §13 / §19 | RR-9 §17 不动 00；RR-* 全程不动 00 |
| #4 | `A0-Codebase-Reality-Check.md` §0 / §1 / §6.2 / §11 / §12 (closeloop PR#4 *adds* §12) | RR-1/2/3 仅动 §2.3 / §2.4 / §2.5 / §2.3.1（新增）；不动 §11/§12 |
| #5 | `02-Data-Model.md` §0 / §1 / §2.1 / §3.12 / §3.13 / §4 / §5.8 / §5.9 / §7 / §8 / §10 | RR-6 新增 §6 (字段所有权)；RR-7 仅动 §2.4 NoteV2 末尾子节 |

- **rebase 策略**：
  - 如果 closeloop 先合并 → RR-* rebase 后必须 grep 验证 v2 §0.1 表中所列章节边界仍然成立；如有重叠，RR-* 让位（master 修订该 RR 范围或弃 PR）
  - 如果 RR-* 先合并 → closeloop 后续 PR 在 rebase 时不需要做特殊处理

### 1.4 硬规则约束

- 所有 PR base = `main`
- 分支前缀：`docs/practice-recalibration/RR-N-<slug>`
- commit message: 英文，`docs(practice):` 前缀
- 单 PR ≤ 15 文件，≤ 400 行净增（H9）
- 文档 > 50 行新增 → 必须 `semantic_reviewer` 独立 review (H5)
- 每个 PR 只改文档；不动 .py / .ts / .tsx / package.json
- **Validation 范围**（per AGENTS §0.5 §3 例外口径）:
  - 改动不触及产品运行时代码、API 契约、DB schema、鉴权、安全逻辑 ✅
  - 已通过本次改动相关测试: **vacuously true（无运行时代码 → 无测试适用）**
  - 已通过 `semantic_reviewer` 独立 review ✅
  - 完整 `npm run typecheck` 失败命令: `cd /projects/sandbox/sikao && npm run typecheck` — fails: no `node` / `npm` binary in sandbox
  - 最终交付：**scoped validation pass; full validation blocked (no node/npm in sandbox env)**
- 每个 PR description 写 Reality Verification 表（grep 命令 + 输出）
- **Grep mismatch escalation**: 任一 RR 的 Runner 在执行 grep verification 时若实测输出与本 plan 的 "Expected output" 不符 → **halt + 不修改文件 + 立刻把 mismatch 报回 master**，由 master 决定修订 plan 还是修订 acceptance

---

## 2. PR 总览

### 2.1 RR-* 表

| PR | 标题 | 改动文件 | 估算行数 | 类型 | 依赖 |
|---|---|---|---|---|---|
| RR-1 | A0 §2.3 modules list (26) | `A0-Codebase-Reality-Check.md` | ~80 | reality-only | — |
| RR-2 | 05-LLM-Module §1 false 已建 markers | `05-LLM-Module.md` | ~120 | reality-only | — |
| RR-3 | A0 §2.3.1 (new) + §2.5 answer_session/essay V2 reality | `A0-Codebase-Reality-Check.md` | ~100 | reality-only | RR-1 |
| RR-4 | README §2 + 04-Frontend-WU §1.3 router path correction | `README.md` + `04-Frontend-WU.md` | ~150 | reality-only | — |
| RR-5 | 03-Backend-WU §1.1 anti-collision + B14/B17 estimate | `03-Backend-WU.md` | ~80 | reality-only | RR-3, RR-4 |
| RR-6 | 02-Data-Model §6 field ownership matrix + 11/12 backref | `02-Data-Model.md` + `11-Timing-Engine.md` + `12-Session-Lifecycle.md` | ~150 | **Define-First (schema 写入边界)** | — |
| RR-7 | 02-Data-Model §2.4 NoteV2 Tab-4 risk register | `02-Data-Model.md` | ~50 | reality-only | — |
| RR-8 | 10-Testing §3.7-§3.11 + §4.4-§4.8 add modules 11-15 test matrix | `10-Testing.md` | ~250 | reality-only | — |
| RR-9 | doc hygiene single sweep | 多文件 (≤8) | ~120 | reality-only | — |

### 2.2 Define-First 项目说明

仅 **RR-6** 是真正的 Define-First (per AGENT-H6)：定义跨模块字段写入方边界 (schema-level 契约)。

RR-3 / RR-4 / RR-5 **被 reviewer 正确指出不是 Define-First**——它们只记录现实、不引入决策。

### 2.3 串行执行顺序

```
RR-1 → RR-2 → RR-3 → RR-4 → RR-5 → RR-6 → RR-7 → RR-8 → RR-9 → RR-10 (blocker note)
```

并行策略：本 master 串行派 subagent，避免 PR 冲突。如果某 PR review 不通过 → 该 RR 暂停 → 不向后推进，待 master 修订。

### 2.4 待 lhr 决策清单（不在本 Plan 范围）

以下决策**必须由 lhr 显式拍板**，**RR-* 仅记录现状**不替代决策。任何 B17/B20 实施 PR 启动前，master 必须先发起独立 decision PR / Multica issue。

| Decision | Background | Options | Trigger |
|---|---|---|---|
| **B17 ownership** | `answer_session` 已占用 `/api/v2/practice/stats/{heatmap, trend, summary}` 三端点 | A) 合并到 answer_session<br>B) 拆 practice_stats 新模块共享 prefix<br>C) 搬迁 stats 端点到 practice_stats | 任何 B17 实施 PR 启动前 |
| **B20 essay 路由策略** | `modules/essay/interface/routes.py` 已含 7 端点但 `main.py` 未 `include_router` | A) 直接挂载 + 在其上扩展<br>B) 重写 essay routes for B20<br>C) 新建 `modules/essay_grading/` | 任何 B20 实施 PR 启动前 |
| **B14 估算二次确认** | content 已实现 5 真函数 | 工作量从 ~800 行 / 3 PR 下调到 ~250 行 / 1 PR | 任何 B14 实施 PR 启动前 |
| **`last_activity_at` writer ownership (v4 added)** | 11 §3:221 (`timing.event_recorder` writes `last_activity_at = max(events.ts)`) + 12 §2.3:122 + 12:498 (`session_lifecycle` writes on transition) — 双 writer 现状 | A) `timing.event_recorder` 唯一 writer，改 11/12 移除 lifecycle 写入<br>B) `session_lifecycle (任何 transition)` 唯一 writer，改 11 §3 移除 timing 写入<br>C) 双 writer 显式合法化（max 幂等），§6 表加 dual-writer 行 | 任何 11 / 12 实施 PR 启动前 |

---

## 3. 每个 RR 的精确定义

### RR-1 · A0 §2.3 完整 modules 列表 (26 modules)

**Branch**: `docs/practice-recalibration/RR-1-modules-list`
**File**: `docs/vault/05-migration/Phase/Practice/A0-Codebase-Reality-Check.md`
**Section**: §2.3 Modules 现状（**整张表 owned by RR-1**, 含 essay 行）+ §4 (build_practice_center_envelope → build_practice_center_overview rename only, 3 occurrences at lines 68/206/209)

**Before** (main 当前)：仅列 ~12 模块，含糊；`build_practice_center_envelope` 函数名错 3 处（A0 §2.3 line 68 + §4 lines 206/209；实际是 `build_practice_center_overview`）；essay 行写"无路由模块"（错）。

**After**：26 行表格，每行 4 列：
- `path` (e.g. `essay/`)
- `status` (`active` / `deprecated` / `migrating` / `placeholder`)
- `phase relation` (`primary` / `peripheral` / `out-of-scope`)
- `notes`（含真实函数名、与 main.py 注册关系；essay 行 notes 写 "routes.py exists with 7 endpoints, **NOT mounted in main.py**; full endpoint list in §2.3.1"）

**Grep verification**（runner 必须执行并粘进 PR description）：

```bash
ls -d /projects/sandbox/sikao/services/api/src/sikao_api/modules/*/ | wc -l
# Expected: 26

ls -d /projects/sandbox/sikao/services/api/src/sikao_api/modules/*/ | xargs -n1 basename
# Expected: 26 names

grep -nE "include_router" /projects/sandbox/sikao/services/api/src/sikao_api/main.py
# Expected: 13 lines (113-124, 112)

grep -nE "^def build_" /projects/sandbox/sikao/services/api/src/sikao_api/modules/content/application/service.py
# Expected: 5 lines (build_practice_center_overview, xingce_categories, xingce_papers, essay_categories, essay_papers)
```

**Acceptance**:
- §2.3 表格恰好 **26 行**（不是 30；reviewer v1 抓出错误）
- 每行 4 列填齐
- 每行 status 有 grep 证据（main.py 注册过 = active；未注册 + 代码存在 = migrating；deprecated 标志由 master 拍板）
- `build_practice_center_envelope` 全部改成 `build_practice_center_overview` (函数名校准——issue #17 收口在此 PR；改 3 处：A0 §2.3 line 68 + §4 lines 206/209)
- essay 行明确指向 §2.3.1 anchor（§2.3.1 由 RR-3 创建，但 RR-1 提前留 forward-ref 注释 "(§2.3.1 added by RR-3)"）

**No-touch**: 不动 §2.4 / §2.5 / §11 / §12 / §2.3.1（这些由其他 RR 或 closeloop 处理）

**Grep mismatch handling**: 若实测 modules 数量 ≠ 26 → halt + 报 master，不要修改文件。

---

### RR-2 · 05-LLM-Module §1 false "已建" markers 校准

**Branch**: `docs/practice-recalibration/RR-2-llm-already-built-drift`
**File**: `docs/vault/05-migration/Phase/Practice/05-LLM-Module.md`
**Section**: §1 现状概览

**Before**: 05 §1 列出多个文件标 "已建" 但实际不存在：
- `cost_tracker.py` 已建 → **不存在**
- `sanitizer.py` 已建 → **不存在**
- `parsers/base.py` / `plan_output_parser.py` / `adjustment_parser.py` / `recommendation_parser.py` 全标已建 → **`parsers/` 目录都不存在**
- `prompts/plan_generate.py` / `plan_regenerate_range.py` / `plan_adjust.py` / `recommend_today.py` 全标已建 → **不存在**
- `prompts/_shared.py` 已建 → **存在** ✅（唯一对的）
- `domain/types.py` / `errors.py` / `quotas.py` 已建 → **未 verify, runner 必须 grep**
- `infrastructure/openai_compatible_provider.py` / `deepseek_provider.py` / `dashscope_provider.py` / `mock_provider.py` 已建 → **未 verify, runner 必须 grep**

**After**：
- §1 改用三栏表："文件路径 / 状态 (`exists` / `not_exists` / `placeholder_only`) / 备注"
- 每行附 `ls` 或 `grep` 证据
- §2 "Tab 2 追加 3 个能力" 措辞从"在已有 prompts/ 目录扩展"改成"扩展 prompts/ 目录（已含 _shared/essay_grading/qa）添加 4 个新 prompt"——保留对的部分

**A0 §2.4 不动**（reviewer 已确认 §2.4 描述正确）。

**Grep verification**:

```bash
find /projects/sandbox/sikao/services/api/src/sikao_api/modules/llm -name "*.py" | sort
# Verifies all file existences

ls /projects/sandbox/sikao/services/api/src/sikao_api/modules/llm/application/llm/parsers/ 2>&1
# Expected: ls: ... No such file or directory

ls /projects/sandbox/sikao/services/api/src/sikao_api/modules/llm/domain/
ls /projects/sandbox/sikao/services/api/src/sikao_api/modules/llm/infrastructure/
# Verifies whether listed domain/infrastructure files exist
```

**Acceptance**:
- §1 三栏表覆盖 05 §1 v1 列出的所有文件
- 每行 status 准确（grep 实测）
- §2 wording 调整最小化：仅修正"扩展 vs 新建"误导，不重写整节

---

### RR-3 · A0 §2.3.1 (new) + §2.5 answer_session / essay V2 校准

**Branch**: `docs/practice-recalibration/RR-3-answer-session-essay-reality`
**File**: `A0-Codebase-Reality-Check.md`
**Section**: 新增 §2.3.1 (插入在 §2.3 表与 §2.4 之间) + 改写 §2.5

**Before**:
- §2.3 modules 表中 essay 行写"无路由模块"——RR-1 已修
- §2.5 写 "V2 数据层已就绪但路由层缺失"——错误

**After**:
- 新增 §2.3.1 「`answer_session` & `essay` 模块端点详表」：
  - `answer_session` 子表：25 端点 (path / method / line number)，prefix `/api/v2/practice`，**已在 main.py L121 注册**
  - `essay` 子表：7 端点 (path / method / line number)，prefix `/api/v2/essay`，**main.py 中无 include_router 调用** (grep verified)
  - 每端点附 line number 引用
- §2.5 改写："`modules/essay/interface/routes.py` 含 7 端点但 `main.py` 未 include — V2 路由处于 **代码完成但未挂载** 状态。WU-B20 需 lhr 显式决策（见 RR-Plan §2.4）：是直接挂载、重写、还是新建独立 essay_grading 模块。"

**Define-First 边界**：本 PR **不拍板** B17/B20 选项（它们在 RR-Plan §2.4 待 lhr 决策清单）。本 PR **不引入新决策**——仅记录现状。

**Grep verification**:

```bash
grep -cE "@router\." /projects/sandbox/sikao/services/api/src/sikao_api/modules/answer_session/interface/routes.py
# Expected: 25

grep -nE "@router\." /projects/sandbox/sikao/services/api/src/sikao_api/modules/answer_session/interface/routes.py
# Expected: 25 lines, full path/method on each

grep -nE "@router\." /projects/sandbox/sikao/services/api/src/sikao_api/modules/essay/interface/routes.py
# Expected: 7 lines

grep -nE "include_router" /projects/sandbox/sikao/services/api/src/sikao_api/main.py
# Expected: 13 lines, no essay router

grep "essay" /projects/sandbox/sikao/services/api/src/sikao_api/main.py
# Expected: empty (no essay imported in main.py)
```

**Acceptance**:
- §2.3.1 列出 **25 个 answer_session 端点**（不是 26；reviewer v1 抓出错误）
- §2.3.1 列出 **7 个 essay 端点**
- §2.5 改写后明确 essay 是 "代码完成但未挂载" 而非 "无路由模块"
- §2.5 末尾 cross-ref 到 RR-Plan §2.4 (B20 待决策)
- **不修订 RR-1 owned 的 §2.3 modules 表 essay 行**

---

### RR-4 · README §2 + 04-Frontend-WU §1.3 路由路径校准

**Branch**: `docs/practice-recalibration/RR-4-router-paths`
**Files**: `README.md` (§2) + `04-Frontend-WU.md` (§1.3)

**Before**:
- README §2 写 `/practice` 单一入口 + `/practice/sessions/:id/result` 等
- 04 §1.3 路由表用同上错误路径

**After**:
- README §2 加 "实际 IA 现状" disclaimer：当前是 `/practice/center` + 4-sub-paths (`xingce|essay × categories|papers`)，是过渡态；本 Phase 不重做 IA
- README §2 全部 `/practice/sessions/:id/result` → `/practice/result/:sessionId` (与 router/index.tsx:255 对齐)
- README §2 中 `/practice/sessions/:id/grading` → 标 **TBD (待 closeloop 后续 PR 拍板)**，因为 grading 路由名归属于申论批改 view，应与 closeloop 范围对齐
- 04 §1.3 整张路由表逐行 grep 校验，与 `apps/web/src/router/index.tsx` 对齐
- 04 §1.3 加 "现存路由清单"小节，列出实际 13 个 view route

**Grep verification**:

```bash
grep -nE "path:\s*'/(practice|essay)" /projects/sandbox/sikao/apps/web/src/router/index.tsx
# Lists all current practice/essay routes with line numbers
```

**Acceptance**:
- README §2 中所有 user-facing 路径与 router/index.tsx 实际路径 1:1 对齐 或 标 TBD
- 实际路由必须用 router 文件 line number 引用
- 04 §1.3 表格新增/修订项必须 grep verifiable

---

### RR-5 · 03-Backend-WU §1.1 路由分组防撞 + B14/B17 估算

**Branch**: `docs/practice-recalibration/RR-5-route-grouping`
**File**: `03-Backend-WU.md`
**Sections**: §1.1 (路由分组) + B14 (content) + B17 (practice_stats)

**Before**:
- §1.1 路由分组未考虑 answer_session 已占用 `/api/v2/practice/{history,stats/*}` 等
- B14 估算 ~800 行 / 3 PR
- B17 设计的 4 端点未参考 answer_session 现有端点

**After**:
- §1.1 加表："路由 prefix 占用现状"：列出每个 prefix (`/api/v2/practice`, `/api/v2/essay`, `/api/v2/practice/sessions`) 的当前持有模块 + 已存在端点
- B14 工作量改：~250 行 / 1 PR（基于 content/application/service.py 已含 5 真函数实测；附 grep 引用）
- B17 设计**仅列三选项 (A/B/C)** 与对应工作量评估，**明确标 "Pending lhr decision (RR-Plan §2.4 B17 ownership)"**——本 PR 不拍板

**Define-First 边界**：本 PR 不拍板任何选项；只记录现状 + 列出可行方案。

**Grep verification**:

```bash
grep -nE "^def build_" /projects/sandbox/sikao/services/api/src/sikao_api/modules/content/application/service.py
# Expected: 5 lines

grep -nE "/stats|/history" /projects/sandbox/sikao/services/api/src/sikao_api/modules/answer_session/interface/routes.py
# Lists answer_session's stats/history endpoints
```

**Acceptance**:
- §1.1 路由 prefix 占用表完整 (≥3 prefix)
- B14 估算下调 + grep 引用
- B17 三选项 + 工作量 + "Pending lhr decision" 标记

---

### RR-6 · 02-Data-Model §6 字段所有权矩阵 + 11 §6.3 改写 + 11/12 backref

**Branch**: `docs/practice-recalibration/RR-6-field-ownership`
**Files**:
- `docs/vault/05-migration/Phase/Practice/02-Data-Model.md` (新增 §6)
- `docs/vault/05-migration/Phase/Practice/11-Timing-Engine.md` (§6.3 **rewrite** + §6.5 backref)
- `docs/vault/05-migration/Phase/Practice/12-Session-Lifecycle.md` (§3 + §2.4 加 backref to 02 §6)

**Before**:
- 02-Data-Model 无统一权威表
- 11 §6.3 (current verbatim) 写: "由 session_lifecycle 模块负责状态机转换；timing 模块提供 `record_pause_start(session_id, ts)`：写 session.paused_at / `record_pause_end(session_id, ts)`：累加 paused_total_seconds" — **timing 模块被定义为 paused_at / paused_total_seconds 的 writer**
- 12 §2.3 (transition rules table, lines 124-126) 写: `IN_PROGRESS → PAUSED | user_pause | paused_at = now` / `PAUSED → IN_PROGRESS | user_resume | paused_total_seconds += (now - paused_at)` — **lifecycle 模块定义 WHEN/WHAT to write，但未声明 writer**
- 结果：11 §6.3 与 12 §2.3 之间存在 writer ownership 矛盾，需 RR-6 (Define-First) 决议

**After (Path A — 二选一已选 Path A)**:

1. **02-Data-Model 新增 §6 Field Ownership Matrix** — closed list **22 fields** (v4: removed `last_activity_at` to §2.4 due to dual-writer conflict; net 18 base + 5 v3-added - 1 v4-removed = 22)

§6 顶部 Header 加 **Inclusion Criterion**（v3 fix per reviewer）："本表覆盖：(a) 任何由两个或以上模块写入或读取的字段、(b) 关键 lifecycle / mock_exam / timing 字段；不覆盖：纯 session.create immutable config 中**仅 session 自己读且无 cross-module 关注**的字段。"

| 字段 | 表 | 唯一写入方 (module.action) | 主要读取方 | trigger 端点 |
|---|---|---|---|---|
| `status` | PracticeSessionV2 | session_lifecycle.transition | timing / mock_exam / stats | 各 lifecycle 端点 |
| `started_at` | PracticeSessionV2 | session_lifecycle (DRAFT→IN_PROGRESS) | result / stats | first_answer / first_heartbeat |
| `paused_at` | PracticeSessionV2 | **session_lifecycle.pause** | timing.summary | POST /sessions/:id/pause |
| `paused_total_seconds` | PracticeSessionV2 | **session_lifecycle.resume** | result / stats | POST /sessions/:id/resume |
| `paused_count` | PracticeSessionV2 | session_lifecycle.pause | history | POST /sessions/:id/pause |
| `last_heartbeat_at` | PracticeSessionV2 | **session_lifecycle.heartbeat** | session_lifecycle.is_alive / cleanup cron | POST /sessions/:id/heartbeat |
| `last_activity_at` | PracticeSessionV2 | ⚠️ **PENDING — see §2.4 lhr decision queue (dual writer 现状)** | active query / cleanup | (no SSOT writer until decided) |
| `first_question_at` | PracticeSessionV2 | session_lifecycle (DRAFT→IN_PROGRESS) | result | 首次 answer / heartbeat |
| `total_active_seconds` | PracticeSessionV2 | timing.event_recorder | practice_stats / result | timing.record_question_event |
| `abandoned_at` | PracticeSessionV2 | session_lifecycle.abandon | history | POST /sessions/:id/discard or cron |
| `abandoned_reason` | PracticeSessionV2 | session_lifecycle.abandon | history | 同上 |
| `force_submitted` | PracticeSessionV2 | session_lifecycle.submit (force=true) | result | POST /sessions/:id/submit (force) |
| `force_submitted_reason` | PracticeSessionV2 | session_lifecycle.submit (force=true) | result | 同上 |
| `recovered_from_session_id` | PracticeSessionV2 | session_lifecycle.create (from old) | history | POST /sessions (recover) |
| `exam_mode` | PracticeSessionV2 | session.create (immutable) | mock_exam / stats | POST /sessions |
| `time_limit_minutes` | PracticeSessionV2 | session.create (immutable) | mock_exam.tick | POST /sessions |
| `auto_submit_at` | PracticeSessionV2 | session.create (immutable) | mock_exam.tick | POST /sessions |
| `allow_pause` | PracticeSessionV2 | session.create (immutable) | session_lifecycle.pause | POST /sessions |
| `allow_review_during` | PracticeSessionV2 | session.create (immutable) | UI / answer | POST /sessions |
| `delayed_review_until` | PracticeSessionV2 | session.create | result | POST /sessions |
| `expires_at` | PracticeSessionV2 | session.create (mock_exam / daily) | cron expire scan | POST /sessions |
| `completed_at` | PracticeSessionV2 | session_lifecycle.submit | result / history | POST /sessions/:id/submit |
| `last_recomputed_at` | QuestionTimingBaselineV2 | timing.cron (recompute_baseline) | timing.summary | cron only |

§6 末尾加 supersede 标注："本表是字段写入归属 SSOT。如有任何 11 / 12 / 13 文档定义与本表冲突，**以本表为准**；冲突章节必须在同 PR 内修订 (RR-6 已修订 11 §6.3 — 见下)。"

2. **11-Timing §6.3 rewrite (Path A)** — 由 "timing 模块提供 helpers + 写入 session.paused_at" 改写为：

```
### 6.3 session_lifecycle.pause / resume

**Writer ownership**: paused_at / paused_total_seconds / paused_count 由 session_lifecycle 模块独占写入（见 02-Data-Model §6 Field Ownership Matrix）。

timing 模块在 pause/resume 流程中**仅提供纯计算 helper**（被 session_lifecycle.pause/resume 的 service 函数调用）：

- `compute_pause_offset(now: datetime, paused_at: datetime) -> int`：返回 `(now - paused_at).total_seconds()` 作为 paused_total_seconds 增量；不写库
- `validate_pause_request(session: PracticeSessionV2) -> bool`：基于 timing 基线判断是否允许 pause（如已超时则拒绝）；不写库

实际写入由 session_lifecycle 在 transition 内执行，所有数据库写入操作集中于 session_lifecycle 服务边界。
```

3. **11-Timing §6.5 backref + 12-Session-Lifecycle §3 + §2.4 backref** — 各加 1 行注释 "字段写入归属见 02-Data-Model §6 (SSOT)"，**不改字段定义本身**（12 §2.3 transition table 不动，writer 归属由 02 §6 + 11 §6.3 改写共同 SSOT-ize）

**Acceptance**:
- 02 §6 完整 22 个字段 (v4: 23 - last_activity_at moved to §2.4)
- 02 §6 header 含 inclusion criterion (v3)
- 02 §6 字段名全部与 schema actual 一致 (v3 fix `force_submitted_reason`)
- 02 §6 `last_heartbeat_at` writer = `session_lifecycle.heartbeat` (v4 fix fabrication)
- 02 §6 `last_activity_at` row 标 PENDING + cross-ref §2.4
- **02 §2.2 grouping cleanup (v4 added)**: 把 `paused_total_seconds` 从 line 47 / 222 的 timing 字段组移到 session_lifecycle 字段组；`last_activity_at` 在 line 47 / 222 加行内注释 "writer ownership pending — see §2.4"；`paused_at / paused_count / last_heartbeat_at` 已在 session_lifecycle 组 (无需移动)
- 11 §6.3 改写后**不再声称 timing 写 paused_at**；改为 thin helpers + writer is lifecycle
- 11 §6.5 / 12 §3 / 12 §2.4 各加 backref 1 行
- Reviewer cross-check：02 §6 / 11 §6.3 / 12 §2.3 三处对 paused_at 的描述一致
- Reviewer cross-check (v4 added)：02 §6 22 字段全部与 11/12/13 现有 writer 描述无矛盾（last_activity_at 例外，标 PENDING）

**Grep verification (v4)**:

```bash
# 字段名实测：22 个字段全部应能 grep 到为真实 schema 列 (v4: removed last_activity_at)
for f in status started_at paused_at paused_total_seconds paused_count last_heartbeat_at first_question_at total_active_seconds abandoned_at abandoned_reason force_submitted force_submitted_reason recovered_from_session_id exam_mode time_limit_minutes auto_submit_at allow_pause allow_review_during delayed_review_until expires_at completed_at last_recomputed_at; do
  hits=$(grep -c "^[[:space:]]*${f}:" /projects/sandbox/sikao/docs/vault/05-migration/Phase/Practice/02-Data-Model.md)
  echo "$f: $hits"
done
# Expected: 每行 hits >= 1; total 22 fields (last_activity_at intentionally excluded — pending §2.4)

# 11 §6.3 改写后不应再含 "写 session.paused_at" 措辞
grep -A4 "^### 6.3" /projects/sandbox/sikao/docs/vault/05-migration/Phase/Practice/11-Timing-Engine.md
# Expected after RR-6: writer ownership 在 session_lifecycle，timing 仅 thin helpers

# 02 §2.2 grouping 校验 (v4 added)
sed -n '38,55p' /projects/sandbox/sikao/docs/vault/05-migration/Phase/Practice/02-Data-Model.md
sed -n '208,230p' /projects/sandbox/sikao/docs/vault/05-migration/Phase/Practice/02-Data-Model.md
# Expected after RR-6: paused_total_seconds in session_lifecycle group; last_activity_at annotated "see §2.4"
```

---

### RR-7 · 02-Data-Model §2.4 NoteV2 Tab-4 风险登记

**Branch**: `docs/practice-recalibration/RR-7-notev2-risk`
**File**: `02-Data-Model.md`
**Section**: §2.4 NoteV2 扩展节末尾

**After**: §2.4 末尾加 「Tab 4 主 Phase 兼容性风险」 子节 (≤ 50 行)：
- NoteLinkV2 双向链接表是否需在 Tab 4 时改 schema
- visibility 枚举未来是否扩 `team / public`
- linked_question_id 反向索引在 Tab 4 大量笔记时的性能预算
- 每条标注 "假设条件" + "撞墙时回退方案"

**Acceptance**: ≤ 50 行；不改字段定义；只是 forward-looking 风险登记

---

### RR-8 · 10-Testing §3.7-§3.11 + §4.4-§4.8 模块 11-15 测试矩阵

**Branch**: `docs/practice-recalibration/RR-8-testing-matrix`
**File**: `10-Testing.md`
**Sections**: §3 invariant 测试 + §4 e2e 场景

**Sub-section budget (per L1 review)**：

| Subsection | 行数预算 |
|---|---|
| §3.7 timing invariants (≥3 条) | ≤30 |
| §3.8 lifecycle invariants (≥3 条) | ≤30 |
| §3.9 mock_exam invariants (≥3 条) | ≤30 |
| §3.10 preferences invariants (≥2 条) | ≤25 |
| §3.11 qmeta invariants (≥2 条) | ≤25 |
| §4.4 timing e2e | ≤25 |
| §4.5 lifecycle e2e | ≤25 |
| §4.6 mock_exam e2e | ≤25 |
| §4.7 preferences e2e | ≤25 |
| §4.8 qmeta e2e | ≤25 |
| **Total** | **≤265** |

每条 invariant：触发条件 / 预期不变量 / 失败现象。每个 e2e：≥5 步流程描述。

**Acceptance**: 总行数 ≤ 280 (含小标题)；每子节满足上面预算；每条 invariant ≥ 3 行

---

### RR-9 · 文档卫生合并 PR

**Branch**: `docs/practice-recalibration/RR-9-doc-hygiene`
**Files**: 多文件 (README + 03 + 04 + 09 + 11 + 14 + 15) — 不超过 8 个文件

**Cherry list** (8 项，注意 #15/#17 已被其他 PR 处理)：

| Item | File:Section | Action |
|---|---|---|
| #15 A0 §11 cron/ 路径 | A0 §11 | **跳过** — 由 closeloop PR#4 处理 |
| #16 README Last Updated | README 顶部 | 改成 2026-05-22 |
| #17 build_practice_center_envelope | A0 §2.3 | **跳过** — 已在 RR-1 acceptance 中完成 |
| #18 PR 总数 78 vs 97 | 03 §0 / README §5 | 二选一 (取 97 即 B58+F39，因为已是细化值) + 注释解释 |
| #19 D7 / D15 引用 | 04 §13 | 加章节定位 (e.g., "see 00-Decisions §11 D-Q15") |
| #20 BASELINE_INSUFFICIENT 状态码 | 11 §11 / 03 §1.3 | 加注释解释为何 404 不 200 (一句话) |
| #21 KeyBindings 跨平台 | 14 §3.1 | 加 "macOS Cmd 键映射约定" 一行 |
| #22 LLM 成本时间戳 | 15 §3.4 | 加 "2026-05 价格基准" 注释 |

**Acceptance**: 实际改 6 项 (#15/#17 跳过)；每项 ≤ 5 行；总行数 ≤ 60；文件数 ≤ 7

---

### RR-10 · BLOCKED — `lint:*` scripts wiring

**Status**: BLOCKED, 不在本会话执行

**原因**:
1. 改动目标是 `apps/web/package.json` scripts (chore)
2. 涉及 build 工具链 → AGENT-H8 要求 `typecheck + lint + tests` PASS
3. 本环境无 `node` / `npm` → 无法 validation
4. 按 §0.5 §3 例外口径，工具链改动不在文档例外列表

**记录在 RR-Plan 仅为可见性**。下一会话切到有 node/npm 的环境后，开 PR `chore(web): wire 8 lint:* scripts to package.json`，独立 PR。

---

## 4. 共同 PR description 模板

```
## Scope
RR-N · <title> (本 RR 改动范围、不改什么)

## Changes
- file:section before → after summary

## Reality verification
| Claim | Verified by |
|---|---|
| ... | grep / wc / ls 命令 + 输出 |

## Review evidence
Independent semantic_reviewer review: <verdict, rounds, issues fixed>

## Scoped validation
- Docs-only change. No runtime code, API contract, DB schema, auth, or security logic touched.
- Tests vacuously pass (no runtime code → no tests apply per AGENTS §0.5 §3).
- Full validation blocked: no node/npm in this environment (env-level constraint, not PR-introduced regression).
- Markdown lint passed (manual visual check).

## Dependencies / blocks
- Depends on: <RR-N or none>
- Blocks: <RR-N or none>
- Co-existing closeloop PRs: <PR# or none>

## Grep mismatch handling
If grep output disagrees with RR-Plan's expected output, this PR halts; master must revise plan first.

Part of `docs/vault/05-migration/Phase/Practice/RR-Plan.md` (10 RR PRs total).
```

---

## 5. 验收 Gate

### 5.1 RR-Plan 自身（本文件）

- [x] v1 → v2 修订 (post-review)
- [ ] semantic_reviewer v2 通过（H5）
- [ ] 行数 ≤ 500 (实际 ~470 v2)
- [x] 每个 RR 有 grep verification + acceptance + escalation
- [x] 与 closeloop plan 关系明确 + 接触清单 enumerate

### 5.2 每个 RR-N

- [ ] commit message 英文 + `docs(practice):` 前缀
- [ ] 文件数 ≤ 15，行数 ≤ 400
- [ ] 不动 .py / .ts / .tsx / package.json
- [ ] PR description 完整模板 (含 Grep mismatch handling)
- [ ] semantic_reviewer 通过（如行数 > 50）
- [ ] PR opened to `main`
- [ ] Grep verification 实测输出粘进 PR description

### 5.3 全部完成

- [ ] 9 个 PR 创建 + 推到 main
- [ ] RR-10 在 RR-Plan 内有 blocker 记录
- [ ] master 最终 summary 报告给 lhr，含三个 lhr 决策清单 (§2.4)

---

## 6. Rollback / 失败处理

- 任一 RR review 不通过 → runner 修订；3 轮内不能通过 → master 重写该 RR 范围 → 必要时拆 RR
- 任一 PR 在 GitHub 上 conflict → master 派 runner rebase；若 closeloop PR 已合且覆盖 RR 范围 → master 修订 RR-Plan 缩减该 RR
- **任一 RR Runner 跑 grep 与 plan 期望不符 → halt + 不改文件 + 报 master，由 master 决定修订 plan 还是修订 acceptance**
- **任一已合并 RR 事后发现含错误事实声明 → 不得 amend / force-push merged commits；必须开新 PR `docs(practice): RR-N-fix <description>` 修正**
- 全 plan 取消条件：lhr 显式 stop

---

## 7. 关联文档

- [`README.md`](./README.md) — Phase 入口
- [`A0-Codebase-Reality-Check.md`](./A0-Codebase-Reality-Check.md) — 现实校准 SSOT (RR-1/3 主战场)
- [`02-Data-Model.md`](./02-Data-Model.md) — schema (RR-6/7 主战场)
- [`03-Backend-WU.md`](./03-Backend-WU.md) — 后端 WU (RR-5 主战场)
- [`04-Frontend-WU.md`](./04-Frontend-WU.md) — 前端 WU (RR-4 主战场)
- [`05-LLM-Module.md`](./05-LLM-Module.md) — LLM 模块 (RR-2 主战场)
- [`10-Testing.md`](./10-Testing.md) — 测试矩阵 (RR-8 主战场)
- [`11-Timing-Engine.md`](./11-Timing-Engine.md) — RR-6 联动
- [`12-Session-Lifecycle.md`](./12-Session-Lifecycle.md) — RR-6 联动
- `docs/practice-closeloop/*` (PR #3 / #4 / #5 in flight) — 与本 plan 正交，接触清单见 §1.3
- `../../../../AGENTS.md` — 顶层硬规则 H1-H10
