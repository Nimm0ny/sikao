---
type: product
status: draft
owner: lhr
last-reviewed: 2026-05-14
target_version: MVP-V1
intended_runner: claude-code
source: chatgpt-pm
review-status: not-aligned-with-codebase
known-drift:
  - "申论 session: PR-4 方案违反 PR13 master 拍板 (models.py:895 / essay routes:206 — BE 无 session 实体, draft 走 (user_id, question_id) upsert)"
  - "行测路由: 文档写 /practice/session/:sessionId + /practice/report/:sessionId, 实际 router/index.tsx:226 是 /practice/sessions/:sessionId + /practice/result/:sessionId; BE 路径 /sessions/{id}/submit 非 /finish|/report|/attempts"
  - "Study plan: 文档 /api/v2/study/today 实为 /api/v2/study-plan/today; task_kind 只有 practice|review_wrong|essay_writing (无 wrongbook_review|progress_review|quota_purchase); 状态机 pending→completed|skipped (无 in_progress); 无 result_payload"
  - "PR-7 资金流 (membership/credit/orders/billing): 违反 AGENTS.md:267 §自动执行 vs 需要确认 硬约束, 必须拆独立 approved plan"
  - "lint:hardcode / lint:italic / lint:radius-token / lint:practice-svg-only / lint:ui-copy-ssot 在 apps/web/package.json 尚未实现; 是独立工具链债, 不能让业务 PR 顺手补"
  - "执行 prompt (L1828) 未对齐 SOP: 缺开工模式声明 (CLAUDE.md §3) / Multica intake (§5.1) / Define-First commit (§5) / Evidence Block (§7.1) / subagent review (§7)"
---

> **本文档非 SSOT，禁止直接作为实施依据**
>
> 本文档由产品视角写成 PRD（来源 ChatGPT），路由 / 接口 / DB schema 多处与 sikao monorepo 实际状态漂移。已知 6 类漂移见 frontmatter `known-drift` 字段，详细证据 + 处置建议见下方「Master Review Caveat (2026-05-14)」章节。
>
> **Worktree agent 实施前必读**：
>
> 1. 先跑 **PR-0 盘点**（生成 `docs/audit/ai-mvp-current-inventory.md`），对齐 6 类漂移
> 2. 由 master 拍板冻结契约（特别是申论 session 方案 — 会推翻 PR13 已落地代码）
> 3. PR-7 资金流不在本批次范围，必须独立 approved plan + lhr 显式批准
> 4. lint:\* 巡检脚本是工具链债，单独立 plan，不混进本 MVP PR
> 5. 实施 agent 必须按 sikao 现有 SOP 工作（CLAUDE.md §3 模式声明 + Multica intake + Evidence Block + subagent review），**不**按文档 §9 的执行 prompt
>
> 满足以上 5 点后，方可 promote 到 `docs/plan/ai-gongkao-mvp-value-loop.md` 作为可执行 plan（届时本文档 status 改 `archived` + `shipped: YYYY-MM-DD`）。

---

## Master Review Caveat (2026-05-14)

> 本节由 master review 写入。下方 §0 起是文档原文，包含与代码现状不一致的接口 / 路由 / schema。**任何与本节冲突的内容，以本节为准。**

### Drift #1: 申论 session 方案 撞 PR13 master 拍板 [HIGHEST RISK]

- **文档原文**：§5 PR-4 (L848) 新增 `essay_sessions` + `essay_submissions` 表, 路由 `/shenlun/session/:sessionId`, BE 接口 `/api/v2/essay/sessions/*`
- **代码现状**：
  - `services/api/src/sikao_api/db/models.py:886-898` — `EssayDraftRecord` 注释明文："URL deviation from plan §8 (master 拍板): Plan 写 endpoint `/api/v2/essay/sessions/{session_id}/draft`, 但 BE 现状没 session 实体. upsert 仍按 `(user_id, question_id)` 唯一约束 — 跟 plan §3 schema 字符级对齐. session_id 是 FE 路由 namespace, 不需 BE 实体对应."
  - `services/api/src/sikao_api/modules/essay/interface/routes.py:193-220` — 实际接口 `POST /api/v2/essay/drafts`（upsert by user_id + question_id）+ `GET /api/v2/essay/drafts/{question_id}`
  - `apps/web/src/router/index.tsx:281-284` — 实际路由 `/practice/essay/session/:sessionId` (PR13 device-aware shell)
- **处置**：PR-4 实施前必须重新评估申论 session 方案。两条路：
  - **路径 A（推荐）**：废 PR-4 中"新增 essay_sessions / essay_submissions"，复用现有 `EssayDraftRecord` (user_id + question_id upsert) + `EssayGradingRecord` (insert-only submit) 双表
  - **路径 B**：推翻 PR13 拍板（高风险，需 lhr 显式批准 + 数据迁移方案）
- **决策记录**：选哪条路径必须写进 PR-0 audit + Multica issue + Evidence Block

### Drift #2: 行测路由 / 接口命名

- **文档原文**：§5 PR-3 (L664+) 路由 `/practice/session/:sessionId` + `/practice/report/:sessionId`, BE 接口 `/api/v2/practice/sessions/{id}/finish` / `/report` / `/attempts`
- **代码现状**：
  - `apps/web/src/router/index.tsx:226-227` — `/practice/sessions/:sessionId` (复数) + `/practice/result/:sessionId`
  - `services/api/src/sikao_api/modules/answer_session/interface/routes.py:26,68` — `prefix=/api/v2/practice` + `POST /sessions/{id}/submit`（非 `/finish` / `/report` / `/attempts`）
- **处置**：PR-3 实施时按代码现状写文档 / 路由 / 接口，文档内的命名作废。如果业务确需 `/finish` `/report` `/attempts` 之类新 endpoint，PR-0 audit 阶段在 inventory 中列清"新增 vs 改造已有"再拍板。

### Drift #3: Study Plan 路由 / task_kind / 状态机

- **文档原文**：§5 PR-2 (L592+) 路由 `/api/v2/study/today` + `/tasks/generate` + `/tasks/{id}/start`; task_kind 新增 `wrongbook_review` / `progress_review` / `quota_purchase`; 状态机引入 `in_progress`; 加 `result_payload`
- **代码现状**：
  - `services/api/src/sikao_api/modules/study_record/interface/routes.py:44` — prefix `/api/v2/study-plan`（带横杠，非 `/api/v2/study`）
  - L4-7 — 4 个 endpoint：`GET /today` / `PATCH /tasks/{id}` / `GET /history` / `GET /{plan_id}`
  - L11 注释明写状态机 `pending → completed/skipped`（无 `in_progress`）
  - `services/api/src/sikao_api/db/schemas.py:1239 / 1249 / 1259` — task_kind 只有 `practice` / `review_wrong` / `essay_writing`
- **处置**：PR-2 实施时优先复用现有 4 endpoint + 现有 task_kind。新需求（错题复盘 / 进步看板 / 额度购买）走以下三选一，方案阶段拍板：
  - 扩 task_kind enum + alembic migration（推荐，与 study-plan 体系一致）
  - 新建专用 endpoint 不挂 study-plan tree（如 `/api/v2/today/quota-purchase`）
  - 砍掉对应任务类型（如 quota_purchase 改 banner 不进 task）

### Drift #4: PR-7 资金流违反硬约束 [BLOCKED]

- **文档原文**：§5 PR-7 (L1305+) 新增 `user_memberships` + `user_credit_accounts` + `credit_ledger` + `product_plans` + `orders` 5 张表 + billing API
- **硬约束**：`AGENTS.md:261-275` 明文「账户/资金流相关」在"必须先和我对齐"清单；"永远不自己决定：删项目、生产部署、资金操作"
- **处置**：**PR-7 不允许本 worktree 实施**。拆为独立 plan `docs/plan/billing-credit-system.md`，由 lhr 显式批准 + 完整方案（含支付通道选型 / 退款 / 风控 / 财税合规）后单独排期。本 MVP worktree 只做 PR-0 ~ PR-6 + PR-8。

### Drift #5: lint:\* 巡检脚本未实现 [TOOLCHAIN-DEBT]

- **文档原文**：§8 Acceptance (L1801) 注释"未定义则补充" — 列了 `lint:hardcode` / `lint:italic` / `lint:radius-token` / `lint:practice-svg-only`
- **代码现状**：`apps/web/package.json:6-15` 实际 scripts 只有 `dev / build / preview / typecheck / lint / test / test:watch / test:coverage`，全部 `lint:*` 子命令缺失
- **CLAUDE.md §4 状态**：多处把这些列为硬巡检（设计 token / italic 政策 / 圆角 SSOT / SVG-only 政策），实施侧未补齐
- **处置**：本 MVP worktree **禁止顺手补 `lint:*` 脚本**（业务 PR 掺工具链 noise，违反 §4 Small Batch ≤15 文件 / ≤400 行净增）。单独立 plan `docs/plan/lint-hardcode-tooling.md`，由专门 worktree 补齐巡检 + 修历史命中 + CI 接入。本 MVP worktree 验证阶段只跑现有 `lint` + `typecheck` + `test` + `build`。

### Drift #6: 执行 Prompt 绕过 sikao SOP

- **文档原文**：§9 (L1828-1857) "Claude Code 推荐执行 Prompt" — 让 Claude Code 直接按文档推 PR-0 ~ PR-8
- **现有 SOP（不可绕过）**：
  - CLAUDE.md §3 Agent 运行模式（开工前声明 Master / Runner / Reviewer / Verifier）
  - CLAUDE.md §5.1 Multica Requirement Intake Gate（从 Multica issue 拉需求，不从聊天 / PRD 拉）
  - CLAUDE.md §5 Define-First（跨服务 API / DB schema / 状态机契约先 commit 定义、lhr review、再 commit 实现）
  - CLAUDE.md §7 subagent 检视（≥100 行代码新增必走 review subagent）
  - CLAUDE.md §7.1 Multica Completion Gate（每个 PR 完成回写 Evidence Block 18 字段）
- **处置**：worktree agent 必须按 sikao SOP 工作。文档 §9 的执行 prompt 仅作"内容理解"参考，不作执行流程依据。每个 PR 走 Multica issue + 模式声明 + Define-First commit + Evidence Block。

---

# AI公考提分闭环落地需求文档（给 Claude Code）

> 本文档用于把 `sikao` monorepo 从"多端练习 Demo / 高质量界面雏形"推进到"AI行测申论提分 MVP"。  
> 核心目标不是继续堆页面，而是打通一个真实用户每天可使用、可复盘、可付费的闭环。

---

## 0. 给 Claude Code 的执行原则

### 0.1 先读这些仓库文档

Claude Code 开始改代码前，必须先读取并理解以下文件，避免重复造轮子或破坏已有规范：

```text
docs/vault/00-index/Home.md            ← 文档仓库入口
docs/vault/03-tech/Architecture.md     ← 系统架构与服务边界
docs/vault/05-migration/Migration-Status.md ← 当前仓库状态全景
docs/vault/05-migration/Migration-Plan.md   ← 迁移路线
docs/vault/04-design/Design-System.md  ← 设计规范（token / 圆角 / italic 等硬规则）
docs/engineering/quick-commands.md     ← 常用命令速查
CLAUDE.md                              ← agent 行为总规范（硬约束优先）
AGENTS.md                              ← CLAUDE.md 镜像
```

**⚠️ 注意**：本文档基于 `sikao` monorepo 路径编写。前端根目录为 `apps/web/`，后端为 `services/api/`，e2e 测试为 `tests/e2e/`。**禁止按 `web_new` 或 `frontend/` 路径操作。**

### 0.2 本文档按照 MultiCA 落地格式组织

本文档采用 `MultiCA` 执行结构：

```text
M - Mission：本阶段产品使命
U - User Loop：用户价值闭环
L - Landing Scope：落地范围与不做范围
T - Tasks：原子 PR / Sprint 拆分
I - Interfaces：数据结构、接口、页面路由、AI输出格式
C - Constraints：技术、设计、合规、成本约束
A - Acceptance：验收标准、测试命令、上线检查
```

Claude Code 执行时必须遵循：

1. **先闭环，后美化。** 当前视觉规范已基本确定，优先补真实业务链路。
2. **先真实数据，后高级能力。** 禁止继续依赖 mockSession 作为主流程。
3. **每个 PR 只解决一个闭环节点。** 不允许一个 PR 同时改 UI、DB、AI、支付、测试过多范围。
4. **保留现有设计系统。** 不新增随意色值、圆角、阴影、字体 token；优先复用 Frontend Style Guide v1（`packages/design-system/src/tokens.css` 单源）。
5. **AI 输出必须结构化。** 不允许只把大段自然语言直接塞进前端报告。
6. **MVP 不做"公考全平台"。** 当前只做"AI行测申论练习提分系统"。
7. **OCR 真接入暂缓。** 申论手写/OCR 先保留 stub 和体验入口，不作为本阶段 P0。
8. **所有新增功能必须有可回归测试。** 后端接口、前端页面、核心 hook、AI JSON schema 至少覆盖主路径。

---

# 1. Mission：本阶段产品使命

## 1.1 产品定位

本阶段产品定位为：

```text
AI公考提分教练：专注行测错因诊断 + 申论AI批改 + 每日提分任务。
```

不要把 V1 做成"大而全公考平台"，也不要做成普通刷题 App。V1 的产品价值必须聚焦在：

```text
用户知道自己哪里弱；
用户知道今天该练什么；
用户练完知道为什么错、怎么改；
用户能看到自己是否进步；
用户愿意为深度批改和个性化提分付费。
```

## 1.2 V1 成功定义

一个新用户在 15 分钟内必须可以完成：

```text
注册 / 登录
  ↓
用户建档：考试类型、目标分、备考阶段、每日可学习时间
  ↓
系统生成今日提分任务
  ↓
完成一组行测练习
  ↓
看到行测正确率、用时、错因、下一步推荐
  ↓
完成一题申论作答
  ↓
提交 AI 批改
  ↓
看到申论得分、采分点命中、遗漏点、修改建议
  ↓
进入进步看板
```

## 1.3 本阶段北极星指标

V1 的北极星指标不是访问量，也不是题库量，而是：

```text
首次完整提分闭环完成率
```

定义：用户完成 `建档 -> 今日任务 -> 行测练习报告 -> 申论AI批改报告 -> 下一步推荐` 的比例。

辅助指标：

```text
首次建档完成率
首次行测练习完成率
首次申论批改完成率
申论二次修改率
用户接受下一步推荐训练率
D1 留存
D7 留存
申论批改付费转化率
单次 AI 批改成本
AI 批改满意度
```

---

# 2. User Loop：必须打通的核心价值闭环

## 2.1 主闭环

```text
用户建档
  ↓
初始能力诊断
  ↓
今日提分任务
  ↓
行测练习 / 申论作答
  ↓
AI错因分析 / AI申论批改
  ↓
下一步推荐训练
  ↓
进步看板
  ↓
免费额度耗尽后引导购买批改次数 / 会员
```

## 2.2 首页主入口决策

V1 首页不要做成"题库列表"，也不要做成"功能宫格"。

首页主入口必须是：

```text
今日提分任务
```

首页第一屏展示：

```text
今日目标：完成 X 分钟提分训练
任务 1：行测专项练习
任务 2：申论小题作答
任务 3：错题复盘
任务 4：查看本周进步
```

每个任务必须显示：

```text
任务名称
推荐原因
预计用时
完成状态
进入按钮
完成后的反馈入口
```

示例：

```text
任务：资料分析 10 题
推荐原因：你最近"比重变化"正确率低于目标 15%，且平均用时偏长。
预计用时：12 分钟
目标：正确率 ≥ 80%，平均每题 ≤ 90 秒
按钮：开始训练
```

---

# 3. Landing Scope：落地范围与不做范围

## 3.1 P0 必须落地范围

本阶段 P0 只做 6 个核心模块：

```text
1. 用户建档与初始诊断
2. 今日提分任务首页
3. 行测练习 + 错因诊断 + 下一步推荐
4. 申论真实作答 + AI批改报告 + 二次修改
5. 进步看板 / 周报雏形
6. 免费额度 / 批改次数 / 会员状态雏形
```

## 3.2 P1 上线前增强

```text
1. AI prompt 版本管理
2. AI 调用日志与成本统计
3. 申论批改异常反馈
4. 基础题库 / 采分点后台维护
5. 四端 Playwright smoke 测试
6. 关键埋点统计
7. AI 生成内容标识与免责声明
```

## 3.3 暂缓范围

以下功能本阶段不要做，避免产品继续发散：

```text
完整选岗系统
招考公告爬取
万人模考大赛
课程系统
直播课
社区论坛
面试系统
机构分销后台
OCR 真识别能力
复杂知识图谱
独立 Windows / Mac 客户端高级功能
```

OCR 入口可以保留为 stub（现有 `apps/web/src/views/ShenlunSession/OcrPanel.tsx` 已是 stub），但不得阻塞申论键盘作答和 AI 批改闭环。

---

# 4. 当前项目已知状态与缺口

## 4.1 已有能力

根据仓库当前进度（`docs/vault/05-migration/Migration-Status.md` 为准），项目已经具备以下基础：

```text
apps/web/src/views/ShenlunSession/ShenlunSession.tsx    ← 设备感知 shell dispatcher
apps/web/src/views/ShenlunSession/TypedEditor.tsx       ← 键盘输入
apps/web/src/views/ShenlunSession/HandwriteEditor.tsx   ← 手写输入（stub）
apps/web/src/views/ShenlunSession/TopBar.tsx
apps/web/src/views/ShenlunSession/MaterialPane.tsx
apps/web/src/views/ShenlunSession/OutlineAside.tsx
apps/web/src/views/ShenlunSession/OcrPanel.tsx          ← stub
apps/web/src/views/ShenlunSession/mockSession.ts        ← 待替换
apps/web/src/views/ShenlunSession/tabletLandscapeShell.tsx
apps/web/src/views/ShenlunSession/tabletPortraitShell.tsx
packages/design-system/src/tokens.css                  ← Design Token SSOT
较完整的 lint / tsc / vitest / pytest / mypy 验证体系
```

## 4.2 当前最大缺口

现在最大缺口不是 UI，而是：

```text
mockSession 尚未替换为真实后端 session（mockSession.ts 注释已标 "gets replaced by BE wiring in P5"）
申论作答没有稳定接入真实题目 -> 提交 -> AI批改报告闭环
行测练习缺少错因诊断和下一步推荐
首页缺少"今日提分任务"这个产品主入口
缺少用户进步看板
缺少 AI 批改额度 / 付费边界
缺少 prompt 版本、AI 成本、批改异常反馈机制
```

## 4.3 题库数据来源（重要前提）

行测 / 申论题目数据**不在仓库内**，位于 `D:/py_pj/backend_data/`（gitignored）：

```text
D:/py_pj/backend_data/xingce/papers/    ← 行测 764 套 mirror
D:/py_pj/backend_data/shenlun/          ← 申论 745 套 mirror（路径以实际为准）
```

**三层导入流程**（CLAUDE.md §12）：

```text
mirror（backend_data/） → adapter（scripts/import/） → DB
```

相关脚本：

```text
scripts/import/fenbi_to_standard.py          ← 行测 adapter
scripts/import/fenbi_shenlun_to_standard.py  ← 申论 adapter
scripts/import/import_fenbi_batch.py         ← 批量导入行测
scripts/import/import_shenlun_batch.py       ← 批量导入申论
```

**执行顺序**：开始实现 PR-3 / PR-4 前，必须先确认 DB 里有行测 / 申论题目（`alembic upgrade head` → 跑导入脚本 → 验证题目条数）。如果 DB 为空，行测 / 申论主流程无法 end-to-end 测试。

---

# 5. Tasks：原子 PR / Sprint 拆分

以下任务必须按顺序推进。除非出现严重技术阻塞，不建议跳序。

---

## PR-0：代码现状盘点与契约冻结

### 目标

在正式改业务前，先建立本次 MVP 的 source-of-truth，避免继续混乱。

### 工作内容

1. 新增本文档到仓库：

```text
docs/plan/ai-gongkao-mvp-value-loop.md
```

2. 盘点现有相关文件和接口，生成一份短文档：

```text
docs/audit/ai-mvp-current-inventory.md
```

内容包括：

```text
现有行测相关页面 / hooks / API（路径基于 apps/web/src/ 和 services/api/src/）
现有申论相关页面 / hooks / API
现有 study plan / practice center 相关页面
现有用户、题目、练习记录、错题相关模型（services/api/src/sikao_api/db/models.py 全表清单）
现有支付 / quota / membership 相关模型，如无则标记缺失
题库导入脚本现状（scripts/import/）
DB 题目条数（行测 / 申论各自，alembic current 版本）
```

**特别盘点（冲突消解需要的信息）**：

```text
study_plan_tasks 现有 task_kind 枚举值（确认是否已含 wrongbook_review 等）
study_plan_tasks 是否已有 reason / estimated_minutes 列
practice_session_answers 是否已有 elapsed_seconds / wrong_reason_code 列
essay_grading_records 是否已有 prompt_version / total_score / level 列
user_goals 和 user_exams 现有字段全列（确认 user_exam_profiles 不重叠）
llm_token_usage 字段（确认已覆盖 ai_call_logs 需求）
essay/interface/routes.py 现有路由完整路径（确认复用 vs 新增）
```

3. 明确 mockSession 替换范围：

```text
apps/web/src/views/ShenlunSession/mockSession.ts       ← 主要替换目标
apps/web/src/views/ShenlunSession/ShenlunSession.tsx   ← 使用 mockSession 的组件
apps/web/src/router/index.tsx                          ← 路由中 session 入参
services/api/src/sikao_api/                            ← essay question / draft / grading 相关 route 和 service
```

### 验收标准

```text
有 docs/audit/ai-mvp-current-inventory.md
列出所有相关文件路径（使用 sikao monorepo 实际路径）
列出所有已有 API
列出所有缺失 API
列出 DB 题目条数和 alembic 版本
没有业务行为变更
lint / tsc / backend static checks 通过
```

---

## PR-1：用户建档与初始诊断

### 目标

用户首次进入系统时，不直接进题库，而是完成建档，并得到一个初始诊断和 7 天方向。

### 用户故事

```text
作为备考用户，
我希望系统先了解我的考试类型、目标分、备考阶段和学习时间，
这样它可以告诉我接下来应该优先练什么。
```

### 前端页面

新增：

```text
apps/web/src/views/study/Onboarding.tsx
apps/web/src/views/study/DiagnosisResult.tsx
```

路由：

```text
/study/onboarding
/study/diagnosis-result
```

页面字段：

```text
考试类型：国考 / 省考（V1 只开放这两种）
备考阶段：零基础 / 刷题中 / 冲刺期
目标行测分
目标申论分
每日可学习时间：30分钟 / 1小时 / 2小时 / 自定义
当前痛点：行测速度慢 / 申论不会写 / 错题反复错 / 没人批改 / 不知道怎么安排
考试日期：可选
```

### 后端数据模型

**复用说明**：`user_goals`（目标分）和 `user_exams`（考试场次）已存在，**不修改**。`user_exam_profiles` 是新概念（用户的学习上下文），与上述两表互补，通过 `linked_exam_id` 可选关联 `user_exams`。

新增（`services/api/src/sikao_api/db/` 下）：

```text
user_exam_profiles
user_diagnosis_snapshots
```

`user_exam_profiles` 字段建议：

```text
id: int
user_id: int, unique or indexed
exam_type: enum('national', 'provincial')   ← 禁止在 SQL enum 中使用中文字面值
preparation_stage: enum('beginner', 'practicing', 'sprint')
daily_minutes: int
pain_points: json
linked_exam_id: int nullable → user_exams.id (SET NULL)  ← 可选关联已有考试场次
created_at: datetime
updated_at: datetime
```

**不放 `target_xingce_score` / `target_shenlun_score`**：目标分已由 `user_goals.target_score` 承载，不在本表冗余。`exam_date` 通过 `linked_exam_id → user_exams.exam_date` 查，不在本表冗余。

`user_diagnosis_snapshots` 字段建议：

```text
id
user_id
profile_id
diagnosis_type: enum('initial', 'weekly', 'manual')
weak_modules: json
summary: text
recommended_focus: json
created_at
```

### 接口

```text
POST /api/v2/study/profile
GET  /api/v2/study/profile
POST /api/v2/study/initial-diagnosis
GET  /api/v2/study/diagnosis/latest
```

### 初始诊断规则 v1

V1 不需要复杂算法，先基于用户自填 + 少量默认规则生成：

```text
零基础：默认推荐资料分析基础、判断推理基础、申论归纳概括
刷题中：根据痛点推荐专项
冲刺期：推荐限时训练、错题复盘、申论批改
```

返回示例：

```json
{
  "summary": "你当前最大问题是行测速度不稳定、申论要点提取不完整。",
  "weak_modules": [
    {"module": "资料分析", "reason": "用户选择行测速度慢", "priority": 1},
    {"module": "判断推理", "reason": "冲刺期需稳定得分", "priority": 2},
    {"module": "申论归纳概括", "reason": "申论不会写 / 没人批改", "priority": 3}
  ],
  "seven_day_focus": [
    "每天完成资料分析10题限时训练",
    "隔天完成1道申论小题并批改",
    "每天复盘5道错题"
  ]
}
```

### 验收标准

```text
新用户首次进入系统时被引导到 /study/onboarding
用户 3 分钟内可完成建档
提交后生成 diagnosis snapshot
诊断结果页展示 3 个弱项和 7 天建议
完成建档后跳转 /study/today
刷新后不重复强制建档
```

---

## PR-2：今日提分任务首页

### 目标

把产品主入口从"功能入口"变成"今日任务"。

### 用户故事

```text
作为备考用户，
我每天打开系统就想知道今天该练什么，
而不是自己在题库、申论、错题之间来回找。
```

### 前端页面

新增：

```text
apps/web/src/views/study/TodayTasks.tsx
```

路由：

```text
/study/today
```

该页面应成为登录后默认首页。

页面结构：

```text
顶部：今日目标、预计总用时、连续学习天数
任务列表：3-5 个任务
底部：今日完成后可查看提分报告
侧边 / 次级区域：薄弱项摘要、剩余额度、最近进步
```

### 任务类型

```text
xingce_practice：行测专项练习
essay_practice：申论作答与批改
wrongbook_review：错题复盘
progress_review：查看进步
quota_purchase：额度不足时引导购买
```

### 后端数据模型

**不新建 `daily_study_tasks` 表**。`study_plan_tasks`（已有完整实现）与本 PR 需求高度重合，直接复用并做 alembic migration 扩展。

**alembic migration（给 `study_plan_tasks` 加列）**：

```sql
ALTER TABLE study_plan_tasks ADD COLUMN reason TEXT;            -- 推荐原因（新增）
ALTER TABLE study_plan_tasks ADD COLUMN estimated_minutes INT;  -- 预计用时（新增）
```

**扩展 `task_kind` 枚举**（现有值：`practice` / `review_wrong` / `essay_writing`，新增）：

```text
wrongbook_review   ← 错题复盘（映射到已有 review_wrong，或新增）
progress_review    ← 查看进步
quota_purchase     ← 额度不足引导
```

**`source` 字段**：`study_plan_tasks` 通过 `study_plans.generation_status` 隐含来源，如需显式记录来源，给 `study_plan_tasks` 加 `source VARCHAR(32)`：

```text
source: enum('diagnosis', 'weakness', 'manual', 'system_default')
```

实施前先读 `services/api/src/sikao_api/modules/` 中 study_plan 相关路由，确认已有接口能否直接复用，优先改造已有接口而非新建。

### 接口

优先改造已有 study_plan 路由，确认不存在时才新增：

```text
GET  /api/v2/study/today          ← 返回今日 study_plan + tasks（改造或新增）
POST /api/v2/study/tasks/generate ← 触发生成今日计划（改造已有 generate 接口）
POST /api/v2/study/tasks/{task_id}/start
POST /api/v2/study/tasks/{task_id}/complete
POST /api/v2/study/tasks/{task_id}/skip
```

### 今日任务生成规则 v1

任务生成优先级：

```text
1. 用户诊断弱项
2. 最近 7 天错因最多模块
3. 申论最近一次批改薄弱项
4. 用户每日可学习时间
5. 系统默认兜底
```

默认生成：

```text
30分钟用户：行测10题 + 错题5题
60分钟用户：行测20题 + 申论小题1题 + 错题5题
120分钟用户：行测30题 + 申论小题1题 + 错题10题 + 看板复盘
```

### 验收标准

```text
完成建档用户进入 /study/today 能看到至少 3 个任务
每个任务有推荐原因和预计用时
点击行测任务进入行测练习
点击申论任务进入申论作答
任务完成后状态变为 completed
任务完成结果写入 result_payload
首页可展示今日完成进度
```

---

## PR-3：行测练习记录 + 错因诊断闭环

### 目标

让行测从"刷题"升级成"提分诊断"。

**前置条件**：DB 中必须已有行测题目（通过 `scripts/import/import_fenbi_batch.py` 导入），否则无法 end-to-end 验证。

### 用户故事

```text
作为行测备考用户，
我不只想知道答案对错，
还想知道我为什么错，以及下一组应该练什么。
```

### 前端页面

新增或改造：

```text
apps/web/src/views/PracticeSession.tsx        ← 已存在，需扩展 attempt 记录
apps/web/src/views/result/                    ← 报告页（已有目录，确认是否需新增文件）
apps/web/src/views/wrong-book/WrongBook.tsx   ← 已存在，需扩展错因筛选
```

新增路由（确认 apps/web/src/router/index.tsx 中添加）：

```text
/practice/session/:sessionId   ← 已有或改造
/practice/report/:sessionId    ← 新增
/wrongbook/weakness            ← 新增
```

### 行测模块

V1 支持五大模块：

```text
言语理解
数量关系
判断推理
资料分析
常识判断
```

### 错因标签体系

#### 资料分析

```text
formula_unknown：公式不会
condition_missed：读题漏条件
estimation_error：估算方法错误
calculation_slow：计算太慢
option_compare_error：选项比较失误
time_allocation_bad：时间分配不合理
```

#### 判断推理

```text
pattern_missed：图形规律识别错误
definition_keyword_missed：定义关键词遗漏
strengthen_weaken_direction_error：削弱加强方向判断错
analogy_relation_confused：类比关系混淆
logic_chain_unclear：逻辑链条没拆清
```

#### 言语理解

```text
main_idea_bias：主旨概括偏差
transition_ignored：转折词忽略
option_concept_swap：选项偷换概念
context_judgment_error：语境判断错误
idiom_collocation_unknown：成语搭配不熟
```

#### 数量关系

```text
model_unknown：题型模型不会
calculation_error：计算错误
equation_setup_error：列式错误
shortcut_missing：缺少速算方法
time_overrun：用时过长
```

#### 常识判断

```text
knowledge_gap：知识盲区
policy_fact_unknown：政策事实不熟
history_culture_unknown：历史文化不熟
science_common_sense_unknown：科技常识不熟
```

### 后端数据模型

**已存在的表，不重建**：

```text
questions              ← 已有，包含题型 / tag，module 信息通过 JOIN 查，不冗余存
practice_sessions      ← 已有
practice_session_answers ← 已有，但缺少 elapsed / wrong_reason 字段，做 migration 扩展
```

**alembic migration（给 `practice_session_answers` 加列）**：

```sql
ALTER TABLE practice_session_answers
  ADD COLUMN elapsed_seconds      INT,           -- 用户作答用时（秒）
  ADD COLUMN wrong_reason_code    VARCHAR(64),   -- 错因 code（见错因标签体系）
  ADD COLUMN wrong_reason_source  VARCHAR(16);   -- system_rule / ai / manual
```

**不加 `module` / `sub_module` 列**：题目的模块信息已在 `questions` 表（通过 tag 或 type 字段），报告层 JOIN 查即可，不在 answers 冗余。

**新增的表**：

```text
user_weakness_snapshots   ← 新建（用户薄弱项快照，供今日任务生成使用）
```

`user_weakness_snapshots` 字段建议：

```text
id
user_id
snapshot_date: date
weak_modules: json   -- [{"module": "资料分析", "wrong_count": 5, "accuracy": 0.4}]
top_wrong_reasons: json
created_at
```

`wrong_reason_tags` 不建表：错因 code 是静态枚举（见上方标签体系），在应用层用常量维护即可，不需要 DB 表。

### 接口

```text
POST /api/v2/practice/sessions
GET  /api/v2/practice/sessions/{session_id}
POST /api/v2/practice/sessions/{session_id}/attempts
POST /api/v2/practice/sessions/{session_id}/finish
GET  /api/v2/practice/sessions/{session_id}/report
GET  /api/v2/wrongbook/weakness
GET  /api/v2/wrongbook/questions
POST /api/v2/practice/recommend-next
```

### 行测报告返回格式

```json
{
  "session_id": 123,
  "total_questions": 10,
  "correct_count": 7,
  "accuracy": 0.7,
  "average_elapsed_seconds": 86,
  "module_breakdown": [
    {
      "module": "资料分析",
      "accuracy": 0.6,
      "average_elapsed_seconds": 102,
      "weak_sub_modules": ["比重变化", "增长率"]
    }
  ],
  "wrong_reason_breakdown": [
    {"code": "estimation_error", "label": "估算方法错误", "count": 2},
    {"code": "condition_missed", "label": "读题漏条件", "count": 1}
  ],
  "next_recommendation": {
    "title": "继续练资料分析：比重变化 10 题",
    "reason": "本组比重变化正确率较低，且用时超过建议值。",
    "payload": {
      "module": "资料分析",
      "sub_module": "比重变化",
      "count": 10
    }
  }
}
```

### 错因判定 v1

V1 可采用规则优先，不必一开始全靠 AI：

```text
答错 + 用时明显超时 -> time_allocation_bad / calculation_slow
答错 + 子知识点固定 -> 使用默认错因候选
答错 + 题型为资料分析且计算型 -> estimation_error / calculation_error 候选
用户可手动修正错因
后期再用 AI 对用户答案和解析进行错因细分
```

### 验收标准

```text
用户能从今日任务进入一组行测练习（题目来自真实 DB，非 mock）
每道题记录答案、对错、用时
完成后生成练习报告
报告展示正确率、平均用时、模块表现、错因分布、下一步推荐
错题自动进入错题本
用户能按错因筛选错题
点击下一步推荐能生成下一组练习
```

---

## PR-4：申论真实 Session 接入，替换 mockSession

### 目标

把当前申论双模式作答容器接入真实后端题目和 session，解决目前最大业务缺口。

**前置条件**：DB 中必须已有申论题目（通过 `scripts/import/import_shenlun_batch.py` 导入）。

### 用户故事

```text
作为申论备考用户，
我希望从真实题目进入作答页，
系统能保存草稿，刷新不丢，并最终提交批改。
```

### 必须处理的现状

当前申论页面已有双模式输入与 shell 架构，但：

```text
apps/web/src/views/ShenlunSession/mockSession.ts
  ← 注释说明"gets replaced by BE wiring in P5"，意即当前 TopBar/MaterialPane 靠它渲染
  ← mockSession 中 question id 为字符串 ("q1", "q2")
草稿保存逻辑尚未接入真实整数 question_id / session_id
```

本 PR 目标：

```text
所有申论主流程都必须使用真实整数 question_id / session_id
mockSession.ts 只能留在 vitest / Storybook / demo，不允许作为用户主流程
```

### 后端数据模型

如已有 essay questions 表，优先复用（先查 `services/api/src/sikao_api/db/` 实际 models）。建议确保存在：

```text
essay_questions
essay_sessions
essay_draft_records（已有则复用）
essay_submissions
```

`essay_sessions` 字段建议：

```text
id
user_id
question_id
source_task_id nullable
mode: enum('typed', 'handwritten')
status: enum('created', 'in_progress', 'submitted', 'graded', 'cancelled')
started_at
submitted_at nullable
grading_record_id nullable
created_at
updated_at
```

`essay_submissions` 字段建议：

```text
id
user_id
session_id
question_id
answer_text
answer_metadata: json nullable
word_count
elapsed_seconds
submission_type: enum('first', 'revision')
parent_submission_id nullable
created_at
```

### 接口

```text
POST /api/v2/essay/sessions
GET  /api/v2/essay/sessions/{session_id}
GET  /api/v2/essay/questions/{question_id}
GET  /api/v2/essay/drafts/{question_id}       # 已有则保持兼容
POST /api/v2/essay/drafts                     # 已有则保持兼容
POST /api/v2/essay/sessions/{session_id}/submit
```

### 前端改造

重点文件：

```text
apps/web/src/views/ShenlunSession/ShenlunSession.tsx
apps/web/src/views/ShenlunSession/TopBar.tsx
apps/web/src/views/ShenlunSession/MaterialPane.tsx
apps/web/src/views/ShenlunSession/mockSession.ts        ← 从主流程移除
apps/web/src/router/index.tsx
```

改造要求：

```text
路由使用 /shenlun/session/:sessionId（确认与 router/index.tsx 对齐）
进入页面后 GET /api/v2/essay/sessions/{sessionId}
从 session 拿真实 question_id（整数）
草稿保存（autosave）必须使用真实整数 question_id
提交按钮 POST /api/v2/essay/sessions/{sessionId}/submit
提交成功后跳转 /shenlun/report/:gradingRecordId 或 /shenlun/report/:submissionId
```

### 验收标准

```text
用户从今日任务进入申论作答时创建真实 essay_session
ShenlunSession 不再依赖 mockSession.ts 字符串 id 作为主流程
用户输入 2 秒后自动保存草稿
刷新页面后草稿恢复
typed 模式可提交
handwritten 模式可保留 metadata，但 OCR 真识别不作为本 PR 要求
提交后 session 状态变为 submitted
提交后进入批改处理中 / 报告页
```

---

## PR-5：申论 AI 批改报告

### 目标

把申论从"能作答"变成"能提分"，这是 V1 最重要的商业化功能。

### 用户故事

```text
作为申论备考用户，
我希望 AI 不只是给我一个分数，
而是按采分点告诉我哪里得分、哪里漏了、具体怎么改。
```

### AI 批改原则

1. 不只给总分。
2. 必须按采分点拆解。
3. 必须指出遗漏点。
4. 必须给可直接替换的修改句。
5. 必须支持二次修改对比。
6. 必须显著标注 AI 生成，仅供学习参考。

### 支持题型

V1 支持：

```text
归纳概括
综合分析
提出对策
贯彻执行
大作文
```

### 后端数据模型

**已存在的表**：

```text
essay_grading_records  ← 已有，status 三态（pending/completed/failed）已实现
llm_token_usage        ← 已有，已记录 input_tokens / output_tokens（即 ai_call_logs 的等价物）
```

**不新建 `ai_prompt_versions` 表，不新建 `ai_call_logs` 表**：版本用整数列区分，token 用量已由 `llm_token_usage` 承载。

**alembic migration（给 `essay_grading_records` 加列）**：

```sql
ALTER TABLE essay_grading_records
  ADD COLUMN prompt_version  SMALLINT NOT NULL DEFAULT 1,
  -- 1 = 旧维度评分 schema（overallScore/dimensions/strengths/weaknesses）
  -- 2 = 新采分点 schema（point_results/missed_points/rewrite_suggestions）
  ADD COLUMN total_score     NUMERIC(5,2),   -- 题目满分
  ADD COLUMN level           VARCHAR(16);    -- 中等 / 良好 / 优秀 等
```

**`feedback_json` 保留原列名，但 version=2 时写入新 schema**，通过 `prompt_version` 区分：

```text
prompt_version=1（历史记录）：
  feedback_json = {overallScore, dimensions[...], strengths, weaknesses, suggestions, sampleAnswer}

prompt_version=2（本 PR 起）：
  feedback_json = {point_results[...], missed_points[...], invalid_expressions[...],
                   structure_issues, language_issues, rewrite_suggestions[...],
                   reference_answer, next_training_advice, disclaimer}
```

**新增的表**（仅此一张）：

```text
essay_grading_point_results  ← 可选：将 point_results 展开存行，方便聚合分析采分点命中率
```

如 MVP 阶段不需聚合分析，可以先不建此表，直接从 `feedback_json.point_results` 读。V1 先跳过，需要时再加 migration。

### Prompt 改造说明（与现有代码的衔接）

现有 prompt 文件：`services/api/src/sikao_api/modules/llm/application/llm/prompts/essay_grading.py`

当前输出是 5 维度加权评分（`overallScore / dimensions / strengths / weaknesses`）。本 PR 需要替换为采分点输出。

**改造方式**：在同文件新增 `build_v2_prompt()` 函数，原 `build_prompt()` 保留（version=1 记录兼容）。`EssayGradingService` 根据配置选择调用哪个版本，新提交统一走 v2，`prompt_version=2` 写入 `essay_grading_records`。

**v2 prompt 核心逻辑**：AI 自己从题目 + 参考答案中识别采分点，不需要题库预存采分点：

```text
系统提示：
1. 阅读题目和参考答案，自动识别 4-8 个采分点（每点 2-4 分）
2. 逐点判断用户答案的命中情况（hit / partial / missed）
3. 对 partial / missed 的采分点给出改写建议
4. 指出无效表达（空话 / 口语化）
5. 给出下一步训练建议
严格输出 JSON，不附加任何说明文字
```

**v1 历史记录**：前端检测到 `prompt_version=1` 时，走旧报告组件（维度评分视图）；`prompt_version=2` 走新报告组件（采分点视图）。两套组件并存，不破坏已有记录展示。

### 批改报告 JSON Schema（version=2）

AI 服务必须输出结构化 JSON。前端报告只能消费此 JSON，不允许直接解析任意大段文本。

```json
{
  "score": 16,
  "total_score": 25,
  "level": "中等",
  "summary": "要点有一定覆盖，但材料提炼不完整，表达偏泛。",
  "point_results": [
    {
      "point_id": "p1",
      "point_text": "推进基层治理数字化",
      "max_score": 4,
      "awarded_score": 2,
      "status": "partial",
      "user_text": "要加强信息化建设",
      "comment": "表述过泛，未体现基层治理和数字平台。",
      "rewrite": "依托数字化平台提升基层治理效率，实现群众诉求快速收集、分类流转和闭环处理。"
    }
  ],
  "missed_points": [
    {
      "point_text": "建立诉求闭环处理机制",
      "reason": "答案中没有体现诉求收集、分类流转、反馈闭环。"
    }
  ],
  "invalid_expressions": [
    {
      "text": "要多方面共同努力",
      "reason": "表达空泛，没有对应材料要点。"
    }
  ],
  "structure_issues": [
    "答案层次不够清晰，建议按问题表现、原因、对策分段。"
  ],
  "language_issues": [
    "部分表达口语化，政策表达不够规范。"
  ],
  "rewrite_suggestions": [
    {
      "before": "要加强信息化建设。",
      "after": "依托数字化平台提升基层治理效率，实现群众诉求快速收集、分类流转和闭环处理。"
    }
  ],
  "reference_answer": "参考答案文本。",
  "next_training_advice": {
    "title": "继续练归纳概括：材料关键词提取",
    "reason": "本次主要失分来自采分点遗漏。",
    "task_payload": {
      "type": "essay_practice",
      "essay_type": "归纳概括"
    }
  },
  "disclaimer": "本批改结果由AI生成，仅供学习参考，不代表官方评分。"
}
```

### 接口

**现有接口**（已实现，确认路径后直接复用或改造）：

```text
POST /api/v2/essay/grade                    ← 已有：创建 grading_record + 异步批改
GET  /api/v2/essay/grades/{record_id}       ← 已有：轮询批改结果
GET  /api/v2/essay/grades                   ← 已有：历史批改列表
```

**新增接口**：

```text
POST /api/v2/essay/grades/{record_id}/ask       ← AI 追问
POST /api/v2/essay/grades/{record_id}/revision  ← 提交二次修改
GET  /api/v2/essay/grades/{record_id}/revision-compare  ← 前后对比
```

**不新增** `/api/v2/essay/submissions/{submission_id}/grade`（文档原稿），改用已有的 `/api/v2/essay/grade`，避免重复。

### 前端报告页

新增：

```text
apps/web/src/views/ShenlunSession/GradingReport.tsx   ← 或独立目录 views/shenlun/
```

路由：

```text
/shenlun/report/:gradingRecordId
```

报告结构：

```text
顶部：分数、等级、题型、AI标识
模块1：总评
模块2：采分点命中情况
模块3：遗漏要点
模块4：无效表达与结构问题
模块5：可直接修改的句子
模块6：参考答案
模块7：二次修改入口
模块8：下一步推荐训练
```

### 二次修改

用户点击"按建议修改"后，进入原作答页或报告内编辑区。

二次修改必须记录：

```text
parent_submission_id
revision_submission_id
修改前得分
修改后得分
新增命中采分点
仍然遗漏采分点
```

### 验收标准

```text
申论提交后能生成 pending 状态记录
AI 批改完成后能展示结构化报告
报告包括分数、采分点、遗漏点、修改建议、参考答案、下一步推荐
用户可以基于报告进行二次修改
二次修改后能看到前后对比
报告显著显示"AI生成，仅供学习参考，不代表官方评分"
AI 调用 token 用量写入 llm_token_usage（已有，通过 token_usage_id 关联）
prompt version 可追溯
```

---

## PR-6：进步看板与周报雏形

### 目标

让用户看到自己在进步，提高留存。

### 用户故事

```text
作为备考用户，
我希望知道自己这几天有没有变强，
哪些模块提升了，哪些问题还在反复出现。
```

### 前端页面

新增：

```text
apps/web/src/views/dashboard/Progress.tsx
apps/web/src/views/dashboard/WeeklyReport.tsx
```

路由：

```text
/progress
/progress/week
```

### 看板指标

V1 展示：

```text
行测总正确率趋势
五大模块正确率
平均用时变化
高频错因 Top 5
错题复盘完成数
申论分数趋势
申论采分点命中率趋势
申论常见问题
连续学习天数
本周完成任务数
```

### 接口

```text
GET /api/v2/progress/dashboard
GET /api/v2/progress/week
GET /api/v2/progress/module-breakdown
GET /api/v2/progress/essay-trend
```

### 周报返回示例

```json
{
  "week_start": "2026-05-11",
  "week_end": "2026-05-17",
  "summary": "本周你完成了126道行测题、3次申论批改。资料分析正确率提升明显，但判断推理图形规律仍需加强。",
  "xingce": {
    "total_questions": 126,
    "accuracy_before": 0.62,
    "accuracy_after": 0.74,
    "best_improvement": "资料分析",
    "weakest_module": "判断推理"
  },
  "essay": {
    "graded_count": 3,
    "score_trend": [14, 16, 18],
    "main_issue": "采分点遗漏"
  },
  "next_week_advice": [
    "每天完成资料分析10题限时训练",
    "隔天完成1道归纳概括题",
    "重点复盘图形规律错题"
  ]
}
```

### 验收标准

```text
完成行测练习后数据进入看板
完成申论批改后数据进入看板
/progress 展示趋势和薄弱项
/progress/week 展示本周总结和下周建议
今日任务首页可以展示简版进步摘要
```

---

## PR-7：免费额度、批改次数、会员状态

### 目标

建立商业化边界，让申论 AI 批改和深度提分能力可收费。

### 用户故事

```text
作为用户，
我可以免费体验一次 AI 批改，
当我觉得有价值时，可以购买批改次数或会员继续使用。
```

### 免费 / 付费边界

#### 免费功能

```text
首次完整建档诊断
每日行测练习 10-20 题
每周 1 次申论普通批改
基础错题本
基础练习报告
```

#### 付费功能

```text
申论深度批改
申论二次修改对比
AI追问
个性化组卷
专项提分计划
周报/月报
高频考点训练包
更多批改次数
```

### 数据模型

新增：

```text
user_memberships
user_credit_accounts
credit_ledger
product_plans
orders
```

`user_credit_accounts` 字段建议：

```text
id
user_id
essay_grading_credits
ai_ask_credits
practice_recommendation_credits
updated_at
```

`credit_ledger` 字段建议：

```text
id
user_id
credit_type: enum('essay_grading', 'ai_ask', 'recommendation')
change_amount: int
balance_after: int
reason: enum('free_grant', 'purchase', 'consume', 'refund', 'admin_adjust')
related_entity_type nullable
related_entity_id nullable
created_at
```

### 接口

```text
GET  /api/v2/billing/quota
POST /api/v2/billing/consume
GET  /api/v2/billing/plans
POST /api/v2/billing/orders
GET  /api/v2/billing/orders/{order_id}
```

### 额度消耗规则 v1

```text
申论普通批改：消耗 1 次 essay_grading_credit
申论深度批改：消耗 2 次 essay_grading_credit
AI追问：消耗 1 次 ai_ask_credit
二次修改对比：会员免费或消耗 1 次 essay_grading_credit
```

### 前端入口

```text
apps/web/src/views/study/TodayTasks.tsx   ← 显示剩余批改次数
/shenlun/report/:gradingRecordId          ← 引导继续批改 / 购买次数
/billing                                  ← 显示会员和次数包
```

### 验收标准

```text
新用户自动获得免费批改额度
提交申论批改前检查额度
额度不足时不调用 AI，提示购买或领取免费额度
成功批改后扣减额度并写 ledger
用户可在页面看到剩余额度
管理员可追溯某次额度变化
```

---

## PR-8：埋点、合规、四端 smoke 验收

### 目标

上线前保证产品可观测、合规可控、四端主流程可用。

### 埋点事件

建议新增事件：

```text
onboarding_started
onboarding_completed
today_task_viewed
today_task_started
today_task_completed
xingce_session_started
xingce_session_finished
xingce_report_viewed
essay_session_started
essay_draft_saved
essay_submitted
essay_report_generated
essay_report_viewed
essay_revision_submitted
quota_empty_prompt_viewed
purchase_clicked
progress_viewed
```

### 合规提示

AI 相关页面必须显示：

```text
本内容由 AI 生成，仅供学习参考，不代表官方评分或考试机构意见。
```

禁止文案：

```text
官方评分
保证提分
保证上岸
真实预测录取
绝对准确
```

### 四端验收场景

#### PC / Web

```text
建档
今日任务
行测练习
申论长文本作答
批改报告查看
进步看板
```

#### 手机

```text
今日任务
行测刷题
错题复盘
查看申论报告
AI追问
查看剩余额度
```

#### 平板横屏

```text
材料区 + 作答区分栏（apps/web/src/views/ShenlunSession/tabletLandscapeShell.tsx）
键盘输入
手写模式入口
草稿保存状态
提交批改
```

#### 平板竖屏

```text
材料阅读可用（apps/web/src/views/ShenlunSession/tabletPortraitShell.tsx）
大纲 / 工具栏不遮挡主内容
作答区可滚动
提交按钮可触达
```

### Playwright smoke

新增：

```text
tests/e2e/ai-mvp-value-loop.spec.ts
```

覆盖：

```text
用户建档 -> 今日任务 -> 行测练习 -> 报告 -> 申论作答 -> 提交 -> 报告
移动端 viewport
平板横屏 viewport
平板竖屏 viewport
```

### 验收标准

```text
核心事件能被记录
AI页面都有免责声明
PC / 手机 / 平板横屏 / 平板竖屏主流程 smoke 通过
没有 mockSession 泄漏到真实用户主路径
AI 调用失败时 session 进入 failed 状态（非 silent degradation，见 §7.2 Fail-Fast 说明）
额度不足时不触发 AI 成本
```

---

# 6. Interfaces：统一接口与数据契约

## 6.1 页面路由总表

```text
/study/onboarding                  用户建档
/study/diagnosis-result             初始诊断结果
/study/today                        今日提分任务首页（登录后默认首页）
/practice/session/:sessionId        行测练习
/practice/report/:sessionId         行测练习报告
/wrongbook/weakness                 错题与薄弱项中心
/shenlun/session/:sessionId         申论作答
/shenlun/report/:gradingRecordId    申论AI批改报告
/progress                           进步看板
/progress/week                      周报
/billing                            会员 / 批改次数
```

## 6.2 今日任务统一结构

```ts
export type DailyTaskType =
  | 'xingce_practice'
  | 'essay_practice'
  | 'wrongbook_review'
  | 'progress_review'
  | 'quota_purchase';

export type DailyTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export interface DailyStudyTask {
  id: number;
  taskDate: string;
  taskType: DailyTaskType;
  title: string;
  reason: string;
  estimatedMinutes: number;
  status: DailyTaskStatus;
  targetPayload: Record<string, unknown>;
  resultPayload?: Record<string, unknown> | null;
}
```

## 6.3 AI 批改报告前端类型

```ts
export interface EssayGradingReport {
  score: number;
  totalScore: number;
  level: string;
  summary: string;
  pointResults: EssayPointResult[];
  missedPoints: EssayMissedPoint[];
  invalidExpressions: EssayInvalidExpression[];
  structureIssues: string[];
  languageIssues: string[];
  rewriteSuggestions: EssayRewriteSuggestion[];
  referenceAnswer?: string;
  nextTrainingAdvice: NextTrainingAdvice;
  disclaimer: string;
}

export interface EssayPointResult {
  pointId: string;
  pointText: string;
  maxScore: number;
  awardedScore: number;
  status: 'hit' | 'partial' | 'missed';
  userText?: string;
  comment: string;
  rewrite?: string;
}

export interface NextTrainingAdvice {
  title: string;
  reason: string;
  taskPayload: Record<string, unknown>;
}
```

## 6.4 行测报告前端类型

```ts
export interface XingcePracticeReport {
  sessionId: number;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  averageElapsedSeconds: number;
  moduleBreakdown: XingceModuleBreakdown[];
  wrongReasonBreakdown: WrongReasonBreakdown[];
  nextRecommendation: NextTrainingAdvice;
}

export interface XingceModuleBreakdown {
  module: string;
  accuracy: number;
  averageElapsedSeconds: number;
  weakSubModules: string[];
}

export interface WrongReasonBreakdown {
  code: string;
  label: string;
  count: number;
}
```

---

# 7. Constraints：约束与禁止项

## 7.1 产品约束

```text
首页必须服务"今天练什么"，不是功能导航。
行测必须输出错因和下一步推荐，不只是答案解析。
申论必须输出采分点报告，不只是 AI 点评。
进步看板必须回答"有没有进步"。
商业化必须围绕申论批改和深度提分，不要先卖大课。
```

## 7.2 技术约束

```text
不要重复创建 essay_draft_records，已有则复用。
不要破坏 /api/v2/essay/drafts 兼容性。
不要在用户主流程使用 mockSession 字符串 id。
新增 API 必须进入 OpenAPI，并重新生成前端类型。
AI 输出必须有 schema 校验，校验失败时记录错误并将 grading_record 置为 failed 状态。
所有 mutating API 必须保留 CSRF / auth 约束。
```

### Fail-Fast 合规说明（CLAUDE.md §4 铁律）

**AI 调用失败的正确处理方式**：

```python
# ✅ 正确：抛出异常，让 grading_record 进入 failed 状态，前端展示错误 UI
async def grade_essay(submission_id: int) -> GradingRecord:
    response = await ai_client.call(prompt)
    if not response.ok:
        raise GradingError(f"AI call failed: {response.status}")
    result = validate_schema(response.json())   # 校验失败也抛出
    record.status = "completed"
    return record

# ❌ 禁止：silent fallback，隐藏错误
async def grade_essay(submission_id: int):
    try:
        response = await ai_client.call(prompt)
        ...
    except Exception:
        return None   # 违反 Fail-Fast
```

前端 "AI 调用失败时的错误状态" 指：
- `grading_record.status = "failed"` → 前端轮询到 failed → 渲染错误提示 + 重试按钮
- **不是** silent degradation（不展示错误、假装成功、返回降级内容）

如需加重试逻辑，必须按 `docs/engineering/fail-fast-exceptions.md` 登记，不得私自加。

## 7.3 前端约束

```text
优先复用现有 UI primitives（packages/ui/src/）。
Design Token 只改 packages/design-system/src/tokens.css（单源 SSOT），禁止在组件内 hardcode 色值 / radius。
禁止新增裸 hex/rgb、随意 radius（禁止 rounded-[Npx] 任意值）、随意 shadow。
移动端不要简单压缩 PC 页面，必须按任务流重排。
平板申论作答不得被工具栏和大纲遮挡。
```

### 前端端口约束（硬约束，CLAUDE.md §11）

```text
前端唯一端口：http://127.0.0.1:18080
dev server：npm run dev（已在 apps/web/package.json 中写死 --port 18080 --strictPort）
5173 完全禁用，任何场景不得起 5173
```

### 禁止 Docker（硬约束，CLAUDE.md §11）

```text
sikao 全场景禁 docker。
PG：native 进程，127.0.0.1:5432
BE：cd services/api && uvicorn sikao_api.main:app --reload --port 8000
FE dev：npm run dev（根目录）或 cd apps/web && npm run dev
禁止：docker compose up / docker build / Dockerfile
```

## 7.4 AI 与合规约束

```text
AI批改必须标注"仅供学习参考，不代表官方评分"。
不要生成虚假考试政策、岗位要求、分数线。
申论参考答案必须标注为参考，不得暗示唯一标准答案。
用户答案、学习数据、手机号等个人信息必须按最小必要原则处理。
后台保留 prompt version、AI output、用户反馈，方便追溯。
```

---

# 8. Acceptance：整体验收标准

## 8.1 MVP 主路径验收

一个真实用户必须可以完成：

```text
1. 登录
2. 建档
3. 查看初始诊断
4. 进入今日任务
5. 完成行测练习（题目来自真实 DB）
6. 查看行测报告
7. 完成申论作答（题目来自真实 DB）
8. 自动保存草稿
9. 提交申论
10. 查看 AI 批改报告
11. 根据建议二次修改
12. 查看进步看板
13. 看到剩余批改次数
```

## 8.2 不允许通过的情况

出现以下任何情况，不能视为完成：

```text
用户主流程仍依赖 mockSession 字符串 id（"q1", "q2"）
申论只能保存，不能提交批改
批改报告只有总分，没有采分点
行测报告只有正确率，没有错因
首页仍然只是功能导航
用户练完后没有下一步推荐
看板没有真实练习数据
AI 调用失败时静默降级（必须进入 failed 状态 + 前端展示错误提示）
额度不足仍然调用 AI
移动端主流程不可用
DB 中无真实行测 / 申论题目
```

## 8.3 验证命令（sikao monorepo 实际路径）

Claude Code 每个 PR 结束必须执行以下验证。命令已按 `apps/web/package.json` 和 `services/api/pyproject.toml` 实际 scripts 对齐：

```bash
# 前端验证（apps/web/package.json 实际 scripts）
cd apps/web
npm run lint          # eslint
npm run typecheck     # tsc -b --noEmit
npm run test          # vitest run
npm run build         # tsc -b && vite build

# 注意：以下 lint 脚本目前 package.json 中尚未定义，
# 实施时需先确认是否已添加，未添加则在 PR 中一并补充：
# npm run lint:hardcode
# npm run lint:italic
# npm run lint:radius-token
# npm run lint:practice-svg-only

# 后端验证（services/api/）
cd services/api
ruff check .
mypy .
pytest
alembic -c ../../database/migrations/alembic.ini upgrade head

# 题库数据验证（PR-3 / PR-4 前置）
# 确认 DB 有题目（在 services/api 中）：
python -c "from sikao_api.db import get_session; ..."
# 或直接查询 DB 条数（以实际 model 名为准）

# 启动验证（不用 docker）
# BE：cd services/api && uvicorn sikao_api.main:app --reload --port 8000 --host 127.0.0.1
# FE：npm run dev（根目录，等价于 cd apps/web && npm run dev，端口 18080）
```

如脚本名称与仓库实际不同，以 `package.json` / `pyproject.toml` 为准，但必须在 PR 说明里写清楚实际执行命令和结果。

---

# 9. Claude Code 推荐执行 Prompt

把下面这段作为给 Claude Code 的首条执行指令：

```text
你是 sikao monorepo 项目的资深全栈工程师和产品落地负责人。
仓库路径：前端 apps/web/，后端 services/api/，e2e 测试 tests/e2e/。

请读取 docs/plan/ai-gongkao-mvp-value-loop.md，并按其中 MultiCA 结构推进。
当前阶段目标不是继续美化 UI，而是打通 AI 行测申论提分闭环：
用户建档 -> 今日任务 -> 行测练习/错因诊断 -> 申论作答/AI批改 -> 下一步推荐 -> 进步看板 -> 额度/付费边界。

执行要求：
1. 先完成 PR-0 盘点，不要直接大改。
2. 每次只实现一个 PR slice。
3. 不允许让 mockSession 字符串 id 继续存在于真实用户主流程。
4. 申论 AI 批改必须输出结构化 JSON，不要只返回自然语言。
5. 行测必须沉淀 attempt、错因、下一步推荐。
6. 首页必须收敛为 /study/today 今日提分任务。
7. 遵守 CLAUDE.md §4 Frontend Style Guide v1（packages/design-system/src/tokens.css 单源，不新增 hardcode token）。
8. 每个 PR 必须给出变更文件（使用 sikao 实际路径）、接口、测试结果、未完成事项。
9. 遇到未知现有结构时，先 grep / read（路径在 apps/web/src/ 和 services/api/src/），不要猜。
10. 不要实现暂缓范围：选岗、课程、社区、完整模考、OCR真识别、面试。
11. 前端端口硬约束：18080（npm run dev 已写死），禁止起 5173。
12. 全场景禁 docker（CLAUDE.md §11）：PG / BE / FE 全走 native 进程。
13. AI 调用失败必须抛出异常 -> grading_record 进入 failed 状态，禁止 silent fallback。
14. PR-3 / PR-4 开始前必须确认 DB 有真实题目（scripts/import/ 三层流程）。

请先执行 PR-0：生成 docs/audit/ai-mvp-current-inventory.md，基于仓库实际代码（apps/web/src/ + services/api/src/）列出后续 PR 的精确文件改造清单，并确认 DB 题目条数和 alembic 当前版本。
```

---

# 10. 最终上线判断

V1 可以上线的标准不是"四端页面都有"，而是下面这句话成立：

```text
用户每天打开系统，能知道今天该练什么；练完以后知道哪里错、怎么改、下一步练什么；连续几天后能看到自己在进步；申论深度批改值得付费。
```

如果这句话不成立，继续加页面、动画、端能力、课程、选岗都没有意义。

本阶段产品优先级最终排序：

```text
1. 申论真实作答 + AI采分点批改
2. 行测错因诊断 + 下一步推荐
3. 今日提分任务首页
4. 进步看板
5. 批改次数 / 会员额度
6. 四端主流程验收
```
