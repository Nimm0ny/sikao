# Phase-Practice · A0 · Codebase Reality Check

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-22
> **目的**：把当前代码库与 Tab 2 目标态的 delta 摊开，避免下游 WU 文档撞到代码现实。
> **必读对象**：所有 Practice Phase 的 PR agent。开工前必读，比 00-Decisions 更前置。

---

## 0. 为什么有这份文档

子文档（00~10）基于 [Frontend-IA-V2.md](../../Frontend-IA-V2.md) + Tab 2 IA 讨论编写，描述的是**目标态**。本文记录**当前态**与目标态的 delta，让 PR 拆分能正确估算工作量。

下游文档若与本文冲突，**以本文为准**；本文 §11 给出受影响章节的精确修订指引。

---

## 1. 与 Phase-Home 共享 schema 的现状

Phase-Home 已建立、或将在后端关键里程碑中建立的基础（Tab 2 直接复用，不重复建）：

| 表 / 模块 | Phase-Home 对应后端状态 | Tab 2 在此基础上做什么 |
|---|---|---|
| QuestionV2 | 已有；字段未含 `source / year / region / category_l1/l2 / historical_accuracy / quality_score` 等 | **WU-B10**：字段扩展 |
| PracticeSessionV2 | Phase-Home 已加 `linked_plan_event_id / linked_recommendation_id` | **WU-B11**：再加 `practice_mode / source_mode / config_snapshot` |
| PracticeSessionAnswerV2 | 已有基础字段 | **WU-B11**：加 `flagged / viewed_solution / view_solution_at` |
| NoteV2 | Phase-Home Tab 4 范围未启动；当前仅有 stub schema | **WU-B11**：加 `linked_question_id / visibility`（替 Tab 4 提前升级） |
| ReviewItemV2 | Phase-Home 未深度使用 | **WU-B11**：扩展 reason 枚举（加 `flagged_persistent`） |
| `modules/llm/` | 当前已有 BYOM / OpenAI-compatible 基础设施；Phase-Home WU-B7 目标态再补齐 plan_generator / plan_adjustor / recommender | **WU-B22**：在同一模块内追加 question_generator / essay_grader / reference_answer_generator |
| AuditLogV2 / IdempotencyKeyV2 / LlmCallV2 | Phase-Home WU-B1 已建表；`core/audit.py` 已就位 | 直接复用，不再建 |
| scheduler 基座 | 当前仓库只有 profile deletion 的 lifespan scheduler；Phase-Home WU-B8 需另行落地 Home 的 cron / realtime hook 框架 | **WU-B23**：扩展 `core/scheduler.py` 单任务 lifespan 模式到多任务（DeletionSweepScheduler 风格），注册 §12.1~§12.6 各模块 cron 函数（约 8 个 cron job，详见 §12.0 统一登记口径） |

⚠️ **强约束**：Tab 2 的依赖按能力拆分，不再笼统写成“等 Phase-Home 完工”。`WU-B10 / B11` 依赖 `WU-B1`，`WU-B22` 依赖 `WU-B7`，`WU-B23` 依赖 `WU-B8`，`WU-F9` 依赖 `WU-B9`。旧 Home 前端 `F1-F8` 不构成本 Phase 前置。

---

## 2. 后端模块现状（`services/api/src/sikao_api/modules/`）

### 2.1 db/models 是单文件

```
services/api/src/sikao_api/db/models_v2.py     ← 全部 V2 模型集中此文件
```

不存在 `db/models/` 目录。下游 02-Data-Model.md 中所有"`db/models/practice_stats_v2.py`"等路径均为**逻辑命名**，**实际实现 = 在 `db/models_v2.py` 中追加新 class**。

### 2.2 现有 V2 模型（grep models_v2.py）

```
QuestionV2 / QuestionOptionV2 / QuestionAssetV2
PracticeSessionV2 / PracticeSessionAnswerV2
EssayDraftV2 / EssaySubmissionV2 / EssayReportV2     ← 已建表，路由没暴露
ReviewItemV2 / ReviewAttemptV2
NoteV2 / NoteLinkV2
PaperV2 / PaperRevisionV2 / PaperSectionV2 / PaperBlockV2 / MaterialGroupV2 / MaterialGroupAssetV2
ProfileInfoV2 / ProfileGoalV2
```

新增模型（PracticeStatsSnapshotV2 / QuestionFavoriteV2 / QuestionFlagV2 / EssayReferenceAnswerV2 / EssayReferenceFeedbackV2 / AiGeneratedQuestionRequestV2 / DailyPracticeV2）追加到本文件末尾，按 02-Data-Model.md 字段定义。

### 2.3 现有 modules/ 现状

```
modules/
├── auth/                     ← 已废弃（V2 用 identity）
├── identity/                 ← V2 主用，已实
├── content/                  ← V2 现状：catalog 端点真但全是 stub 数据
│   ├── application/service.py     （build_practice_center_envelope 真，4 个 catalog 全 build_empty_catalog）
│   └── interface/routes.py
├── session/                  ← V2 主用，已实
│   ├── application/service.py     （402 行，真实现：state machine + paper_code/question_ids 双 mode）
│   └── interface/routes.py        （5 端点：POST /sessions, GET /sessions/:id, POST /answers, /submit, /result）
├── llm/                      ← 当前代码现实：已有 BYOM/OpenAI-compatible 基础设施；尚未补齐 Home plan/adjust/recommend 能力
├── essay/                    ← 旧版本，已废弃，V2 走 EssayDraft/Submission/Report 三表但**无路由模块**
├── grading/                  ← 旧版本，已废弃
├── notes/ + notes_v2/        ← Phase-Home 暂时不动；Tab 4 单独立 Phase
├── review/                   ← V2 stub
├── favorite/                 ← 旧版本，已废弃
├── question_bank/            ← 旧版本，已废弃
├── ...
```

### 2.4 modules/llm 与 Tab 2 的关系（重要）

Tab 2 的 LLM 扩展（question_generator / essay_grader / reference_answer_generator）**继续在 Phase-Home 的 `modules/llm/` 内追加**，不新建 `modules/llm_v2/`。

**05-LLM-Module.md 与 06-LLM-Prompts.md 中所有"`modules/llm_v2/`"路径都应解读为"`modules/llm/`"。**

当前仓库 reality：
```
modules/llm/
  application/
    usage.py
    user_configs.py
    llm/
      byom_config.py
      json_parser.py
      openai_compatible.py
      pricing.py
      provider.py
      ssrf_guard.py
      usage_estimator.py
      usage_recorder.py
      prompts/
        _shared.py
        essay_grading.py
        qa.py
```

Phase-Home WU-B7 目标态补齐（当前 repo 尚未落地）：
```
modules/llm/
  application/
    plan_generator.py
    plan_adjustor.py
    recommender.py
    recommender_policy.py
    question_generator.py         ← Tab 2 新增（WU-B22.1）
    essay_grader.py               ← Tab 2 新增（WU-B22.2）
    reference_answer_generator.py ← Tab 2 新增（WU-B22.3）
    parsers/
      plan_output_parser.py
      adjustment_parser.py
      recommendation_parser.py
      question_parser.py          ← Tab 2 新增
      grading_parser.py           ← Tab 2 新增
      reference_parser.py         ← Tab 2 新增
    prompts/
      plan_generate.py
      plan_regenerate_range.py
      plan_adjust.py
      recommend_today.py
      question_generate.py        ← Tab 2 新增
      question_self_audit.py      ← Tab 2 新增
      essay_grade.py              ← Tab 2 新增
      reference_answer.py         ← Tab 2 新增
```

### 2.5 申论 V2 现状（关键）

V2 数据层已就绪但路由层缺失：

| 表 | 状态 |
|---|---|
| EssayDraftV2 | 已建表，未在路由中使用 |
| EssaySubmissionV2 | 已建表，仅 session.submit 时写入 |
| EssayReportV2 | 已建表，从未被写入（无批改流程） |

Tab 2 的 essay_grading 模块（WU-B20）是首次真正使用这三张表的入口，需要：
- 扩展 EssaySubmissionV2.status 枚举（加 `pending_grading | graded | failed`）
- 写 EssayReportV2 写入器（从 LLM essay_grader 输出解析）
- 新建 EssayReferenceAnswerV2 / EssayReferenceFeedbackV2（WU-B13）

---

## 3. 题库现状

### 3.1 当前 QuestionV2 字段

```python
class QuestionV2(Base):
    id: int (PK)
    paper_id, paper_revision_id, section_id, block_id  # FK 套卷结构
    question_key: str  # 唯一 key
    type: enum            # single_choice / multi_choice / essay 等
    stem: str
    options: JSON
    correct_answer: str
    explanation: str
    metadata: JSON       # 当前用作非结构化扩展
```

**缺失字段**（Tab 2 必须补，详见 WU-B10）：
- `source` (real_exam | ai_generated | ai_modified)
- `year` (int)
- `region` (str)
- `exam_type` (enum)
- `category_l1` / `category_l2` (str)
- `historical_accuracy` (float)
- `answer_count` (int)
- `quality_score` / `report_count` / `is_active` (AI 题用)
- `ai_source_question_id` / `ai_self_audit_passed` / `ai_generated_at`

### 3.2 当前题库数据量

```
sqlite> SELECT COUNT(*) FROM question_v2;
0
```

数据库为空（V2 重构后未灌真题数据）。Tab 2 WU-B21 提供 import 脚本，用户在 M3 时本地执行实际导入。

### 3.3 分类树是否存在？

**不存在**。当前没有任何"二级分类"数据。Tab 2 的方案：
- 在 QuestionV2 上加 `category_l1 / category_l2` 字符串字段（不建独立 taxonomy 表，避免过度设计）
- WU-B14（content 模块）的 categories 端点动态从 QuestionV2 字段聚合
- WU-B21 import 脚本的字段映射要把外部数据的分类信息归一化到 (category_l1, category_l2) 二元组

---

## 4. content 模块现状

```
modules/content/application/service.py:
  build_practice_center_envelope()  → 真实现（返回 PracticeCenterResponseV2 envelope）

modules/content/interface/routes.py:
  GET /practice/center                   → service.build_practice_center_envelope（真）
  GET /practice/xingce/categories        → build_empty_catalog（stub）
  GET /practice/xingce/papers            → build_empty_catalog（stub）
  GET /practice/essay/categories         → build_empty_catalog（stub）
  GET /practice/essay/papers             → build_empty_catalog（stub）
```

WU-B14 把后 4 个 stub 端点改成真实现。

---

## 5. session 模块现状（已较完整，但需扩展）

### 5.1 session.create 当前支持

```python
POST /api/v2/practice/sessions
body: { paper_code: str } | { question_ids: int[] }
```

仅两种 mode。Tab 2 必须扩展（WU-B15）至 6 种：
- paper（保留，本意）
- question_ids（保留，重命名为 review_redo？要决策）
- **category** (新增)
- **custom** (新增)
- **ai_generated** (新增)
- **daily** (新增)

### 5.2 session.submit 当前不写 EssayReport

申论 session 提交后只写 `EssaySubmissionV2`，不触发批改。Tab 2 WU-B20 加 hook：
```python
async def submit_session(session_id: int, ...):
    # 现有逻辑
    if session.type == 'essay':
        await trigger_essay_grading_async(submission_id=...)  # 新增
```

### 5.3 答题中操作端点全部缺失

当前 session 模块没有：
- `POST /sessions/:id/answers/:answer_id/flag`
- `POST /sessions/:id/answers/:answer_id/view-solution`
- `POST /sessions/:id/persistent-flag`

WU-B15.5 全部新增。

---

## 6. AI 出题相关基础设施现状

### 6.1 LLM 框架（以 Phase-Home WU-B7 后端完成为准）

```
modules/llm/application/service.py     ← facade 入口
modules/llm/application/cache.py       ← 进程内 LRU + DB 二级缓存
modules/llm/application/cost_tracker.py ← token 计数
modules/llm/application/sanitizer.py   ← 用户输入清洗
modules/llm/domain/types.py            ← ChatMessage / LlmResponse
modules/llm/infrastructure/openai_compatible_provider.py
```

Tab 2 question_generator 直接调 facade，不重复建 provider。

### 6.2 Idempotency / Audit / Observability

Phase-Home 已建：
- `IDEMPOTENT_PATHS` 中间件
- `AuditLogV2.write()` helper
- LlmCallV2 自动写入

Tab 2 新增 IDEMPOTENT_PATHS：
- `POST /api/v2/practice/ai-questions/generate`
- `POST /api/v2/practice/essay/submissions/:id/grade`
- `POST /api/v2/practice/essay/reference-answers/generate`
- `POST /api/v2/practice/reports`（24h TTL，与 [00-Decisions §19 Report-4](./00-Decisions.md#19-题目纠错report-系列) 24h partial UNIQUE 窗口对齐；详见 §12.6）

---

## 7. 前端现状

### 7.1 一级导航

引用 [Phase-Home A0 §1](../Home/A0-Codebase-Reality-Check.md#1-一级导航现状关键修订)：当前 4 tab 实际，目标 5 tab。Tab 2 范围内不再重复路由 rename 工作（由 Phase-Home WU-F7 处理）。

### 7.2 练习相关 view 现状（apps/web/src/views/）

```
PracticeCenter.tsx                     ← 主入口（旧）
CategoryTree.tsx                       ← 旧，按 V2 stub catalog 渲染
Papers.tsx / EssayPapers.tsx           ← 旧
PracticeStart.tsx / PracticeSession.tsx / Result.tsx  ← 答题闭环（V2 已对接但功能浅）
CustomPracticeStart.tsx                ← 旧自定义入口（V2 没对接）
EssaySpecialty.tsx / EssayPaperDetail.tsx / EssayExamSikao.tsx / EssayExamResults.tsx / EssayHistory.tsx / EssaySpecialtyExamSikao.tsx
                                       ← 旧申论流，全部待替换
ConversationsHistory.tsx               ← 旧 LLM 历史，废弃（D-Profile-Bind 也不接管）
ExamCalendar.tsx                       ← 旧考试日历，已废弃（H-Plan-1 由 PlanV2 取代）
```

WU-F17 的删除清单覆盖以上 11 个 view + `ShenlunSession/` 目录重构（保留设备适配 shell）。

### 7.3 packages/api-client/src/queries 现状

当前仓库中已存在、并由 Phase-Home 后端契约锁定继续沿用的 Home queries 命名：
```
plansQueries.ts
recommendationsQueries.ts
progressQueries.ts (V2)
dashboardQueries.ts
```

Tab 2 新增（WU-F9）：
```
contentQueries.ts            ← 重写
sessionQueries.ts            ← 扩展
practiceStatsQueries.ts      ← 新建
aiQuestionsQueries.ts        ← 新建
essayGradingQueries.ts       ← 新建
favoritesQueries.ts          ← 新建
flagsQueries.ts              ← 新建
dailyPracticeQueries.ts      ← 新建
```

---

## 8. AppShell 与脱壳路由

D7 / D15 已在 Phase-Home 范围实现脱壳壳：
```
/practice/sessions/:id             ★ 脱壳
/practice/sessions/:id/result      ★ 脱壳
/notes/:id                         ★ 脱壳
/review/items/:id/redo             ★ 脱壳
```

Tab 2 新增 2 条脱壳路由：
```
/practice/sessions/:id/grading                ★ 脱壳（申论批改详情，异步完成后）
/practice/ai-questions/generating             ★ 脱壳（AI 出题等待页）
```

`apps/web/src/router/index.tsx` 与 `AppShell.tsx` 在 WU-F17 时统一更新。

---

## 9. 测试体系现状

当前仓库已具备、或在 Phase-Home 后端验收中继续沿用：
- pytest + invariant tests（含 P1-P6 invariant）
- vitest + RTL + MSW
- a11y（axe-core）
- OpenAPI drift 测试

Tab 2 在此基础上新增（WU-B24 + WU-F18）：
- 题源边界 invariant（PR1-PR8）
- 答题节奏严格闭卷 invariant（前后端各一组）
- AI 出题三段退化 contract test
- 申论批改异步流程 e2e
- 题级笔记跨 tab 联动 e2e

---

## 10. AGENTS-H6 Define First 清单

每个 PR 开工前必查：
- 决策依据：[00-Decisions.md](./00-Decisions.md) 对应条目
- 边界规则：[01-Boundary-Rules.md](./01-Boundary-Rules.md) 对应条目
- 数据模型：[02-Data-Model.md](./02-Data-Model.md) 对应字段
- 测试规范：[10-Testing.md](./10-Testing.md) 对应模块

WU 描述与本文 §11 冲突时，以本文为准；WU 描述与 [00-Decisions](./00-Decisions.md) 冲突时，以 00-Decisions 为准（除非 00-Decisions 自身被 A0 §11 修订）。

---

## 11. 子文档修订清单（受 A0 影响）

| 子文档 | 章节 | 原写法 | 修订为 |
|---|---|---|---|
| 02-Data-Model | 全文 | `db/models/<table>.py` | 实际是在 `db/models_v2.py` 追加 class |
| 03-Backend-WU | WU-B22 | "新建 `modules/llm_v2/`" | "在 Phase-Home 已建的 `modules/llm/` 上追加文件" |
| 03-Backend-WU | WU-B22 | 文件路径 `modules/llm_v2/application/...` | 全替换为 `modules/llm/application/...` |
| 05-LLM-Module | 全文 | `modules/llm_v2/...` | `modules/llm/...` |
| 06-LLM-Prompts | 全文 | `modules/llm_v2/application/prompts/...` | `modules/llm/application/prompts/...` |
| 03-Backend-WU | WU-B10 ~ B23 | 提到 IdempotencyKeyV2 / AuditLogV2 / LlmCallV2 时附带"新建" | 删除"新建"字样：Phase-Home WU-B1 已建 |
| 03-Backend-WU | WU-B23 cron | "在 Phase-Home APScheduler 上扩展 4 个 cron" | 保留语义但路径调整：扩展 `services/api/src/sikao_api/core/scheduler.py` 单任务 lifespan 模式到多任务（参照 DeletionSweepScheduler 风格），各模块 `*_cron.py` pure async function 由 B23 注册（不新建 `cron/` 目录） |
| 04-Frontend-WU | F17.2-F17.4 | "删除老 view + 路由清理" | Phase-Home WU-F7.4 已清理大部分；Tab 2 仅清理练习相关 11 个 view |
| README §6 (本 Phase) | "Tab 2 WU-B22 依赖 Phase-Home WU-B7" | 保留 | 强约束改为按 `B1 / B7 / B8 / B9` 的后端里程碑逐项解锁，不等待 legacy Home 前端轨 |
| 04-Frontend-WU §3.2 F10.2 (useSessionConfigStore + profile.info 同步) | line 209 | `profile.info.dashboard_preferences.practice_custom_config 异步同步（继承 Phase-Home D5）` | 改写读写源到 `UserPracticePreferencesV2.payload.custom_practice` 子树（[00-Decisions §17 Pref-10](./00-Decisions.md#17-用户偏好pref-系列)；PR 11 service 层落地双写过渡，旧字段读路径在过渡期内保留兼容；旧字段最终 cleanup 超本 Phase 范围） |

任何 PR 提交时，PR description 写"已读 A0 §X.Y"作为 acknowledge。



---

## 12. B25-B30 新模块 codebase delta

> 本节专门覆盖 [00-Decisions §11.1](./00-Decisions.md#111-在范围内) 列出的 6 个新模块（B25 timing / B26 session_lifecycle / B27 mock_exam / B28 practice_preferences / B29 question_metadata / B30 question_report）在当前 codebase 的现状。**任何 B25-B30 的 PR 开工前必读本节** — 与上游 commit `ae48590` 的 BREAKING 声明一致。
>
> 6 个模块在当前 codebase **全部不存在**（grep 验证 `services/api/src/sikao_api/modules/`），由 Phase-Practice 范围内 WU-B25 ~ WU-B30 各模块独立交付。每模块路径与前置依赖一一标注，避免 PR 之间隐式依赖。

### 12.0 cron 任务统一登记口径（重要）

当前 codebase 没有独立 `services/api/src/sikao_api/cron/` 目录。唯一的调度器是 `core/scheduler.py`（Phase-Profile PR-P6 引入的 `DeletionSweepScheduler`，FastAPI lifespan-managed asyncio task，参考其 `_run_once_safely` 失败吞错风格 — 仅 `_logger.exception` + return 0，不向 loop raise）。

B25-B30 各模块内 `*_cron.py` 仅提供 cron 函数（pure async function + advisory lock），**注册到调度器的动作由 [03-Backend-WU §15 WU-B23](./03-Backend-WU.md#15-wu-b23-cron-扩展) 统一负责**：扩展 `core/scheduler.py` 单任务 lifespan 模式到多任务（参照 DeletionSweepScheduler 风格起多个 lifespan-managed task，每模块一个），不新建 `cron/` 目录。

各模块 `*_cron.py` 必须满足：
- 函数签名 `async def run_<job_name>(db: AsyncSession) -> None`
- 进入立即 `pg_try_advisory_lock(<job_id_hash>)`，失败立即 return（与 [00-Decisions §19 Report-21](./00-Decisions.md#19-题目纠错report-系列) 一致）
- 内部所有 commit / rollback 自管，调度器不持有事务
- 失败 try/except 后仅 `_logger.exception("<job_name>.error")` 不向调度器 raise（继承 `core/scheduler.py::_run_once_safely` 现有失败吞错范式；audit 写入 `cron.<job_name>.failure` 是 §12 新增需求，由各模块 `*_cron.py` 自行在 except 块写入，不依赖调度器层）

### 12.1 modules/timing/（WU-B25）

**当前状态**：模块目录不存在（grep `services/api/src/sikao_api/modules/timing` → 无）。计时数据当前仅有 `db/models_v2.py:344 PracticeSessionAnswerV2.duration_seconds`（秒级，nullable Integer），**没有逐题事件级计时、没有毫秒精度、没有基线表、没有时间分析端点**。02-Data-Model §2.3 定义 WU-B11 把 duration_seconds 升级到毫秒级 `time_spent_ms` + 8 字段扩展（含 `enter_count / answer_change_count / is_overtime` 等）。本模块（WU-B25）在 WU-B11 字段扩展之上构建，不直接负责 duration_seconds → time_spent_ms 的迁移。

**新建路径**：

```
services/api/src/sikao_api/modules/timing/
  application/
    service.py              # 事件 batch 处理（≥50 或 15s flush）/ 区间截断（≤60s）/ 客户端时钟漂移校验
    analyzer.py             # overall / by_category_l1 / by_difficulty 聚合 + overtime_questions + pacing_pattern
    baseline_cron.py        # 周一 03:00 重算 QuestionTimingBaselineV2.p50/p90/p95（最近 90 天数据窗，样本 ≥ 30 才入；与 D-Q11 stat 03:00 同时刻并发跑，不同表无锁竞争）
  domain/
    types.py                # TimingEvent dataclass（4 类：question_enter / question_leave / answer_change / heartbeat）
  interface/
    schemas.py              # Pydantic POST batch body / GET analysis response
    routes.py               # POST /sessions/:id/timing-events, GET /sessions/:id/timing-analysis
```

**数据模型 delta**：
- `db/models_v2.py PracticeSessionAnswerV2`（line 322-345）字段扩展：duration_seconds（line 344，秒级）由 WU-B11 升级为毫秒级 + 新增 enter_count / answer_change_count / is_overtime（详见 [02-Data-Model §2.3](./02-Data-Model.md#23-practicesessionanswerv2扩展)，由 PR 3 落地）
- `db/models_v2.py` 末尾追加 `class QuestionTimingBaselineV2(Base)`（详见 [02-Data-Model §3.8](./02-Data-Model.md#38-questiontimingbaselinev2)）

**前置依赖**：WU-B11（PracticeSessionAnswerV2 字段扩展，含 duration_seconds → time_spent_ms 迁移）+ Phase-Home audit/observability infra（已就位）+ §12.0 cron 框架统一口径。

**与既有 modules/session/ 的边界**：timing 端点不直接修改 session.status；session.submit 时由 session 模块同步调 timing.analyzer 结算 is_overtime（见 [00-Decisions §14 Timing-9](./00-Decisions.md#14-答题计时timing-系列)）。

### 12.2 modules/session_lifecycle/（WU-B26）

**当前状态**：模块目录不存在。`db/models_v2.py:285 PracticeSessionV2` 已有 `status: Mapped[str] = mapped_column(String(32), default="draft")`（line 297），**但无 enum 约束、无六态语义、无 paused / heartbeat / auto_submit 字段、无终态不可改 trigger**。`modules/session/application/service.py` 的 state transition 仅覆盖 `draft → active → submitted` 三态裸串。

**新建路径**：

```
services/api/src/sikao_api/modules/session_lifecycle/
  application/
    service.py              # state_transition validator（六态全连接矩阵）+ pause / resume / discard / heartbeat 业务逻辑
    cleanup_cron.py         # 每分钟扫：IN_PROGRESS 30min 未心跳 → PAUSED（mock_exam 例外）/ PAUSED 24h → ABANDONED / DRAFT 2h → ABANDONED
    daily_expire_cron.py    # 当日 23:59 扫 daily session status != submitted → EXPIRED（Session-LC-7）
  domain/
    state_machine.py        # SessionStatus enum + 允许 transition 矩阵（DRAFT / IN_PROGRESS / PAUSED / SUBMITTED / ABANDONED / EXPIRED 六态 + 终态集合）
    types.py
  interface/
    schemas.py
    routes.py               # POST /sessions/:id/{pause,resume,heartbeat,discard,start}, GET /sessions/active
```

**数据模型 delta**：
- `db/models_v2.py PracticeSessionV2.status`（line 297）：String(32) default "draft" → 保留类型不变，加 DB CHECK 约束 `status IN ('draft', 'in_progress', 'paused', 'submitted', 'abandoned', 'expired')`（详见 [02-Data-Model §2.2](./02-Data-Model.md#22-practicesessionv2扩展) + §5 trigger）
- 新增字段（同 §2.2）：`paused_total_seconds / last_heartbeat_at / auto_submit_at / abandoned_at / completed_at / discard_reason / recovered_from_session_id`
- 新增 trigger（[02 §5](./02-Data-Model.md#5-trigger--数据完整性)）：终态不可改 UPDATE 拦截（status ∈ {submitted, abandoned, expired} 拒 UPDATE）

**前置依赖**：WU-B11 + §12.0 cron + Phase-Home audit/observability。

**与既有 modules/session/ 的协调**：
- modules/session/ 保留答题业务（answer / submit / view-solution / paper-mode-validation）
- modules/session_lifecycle/ 接管 status transition 与 heartbeat
- session.submit 端点内部调 session_lifecycle.transition_to(SUBMITTED)（service 层依赖注入，避免循环 import）
- 现有 `modules/session/application/service.py` 内 status 字面量写入位置（line 48 create='draft' / line 60-61 linked_event 联动 / line 134 submit / line 151 linked_event done / line 311 / line 337 start/resume）由 PR 11 重构为调 session_lifecycle service，不直接写 status 字段（grep 命令：`grep -nE "status\s*=|values\(status=" modules/session/application/service.py` 找全所有写入点）

### 12.3 modules/mock_exam/（WU-B27）

**当前状态**：模块目录不存在。`PracticeSessionV2` 无 `exam_mode` 字段；倒计时与自动提交逻辑都缺。

**新建路径**：

```
services/api/src/sikao_api/modules/mock_exam/
  application/
    service.py              # 创建（DB CHECK 验证 exam_mode⟹full_set ∧ paper ∧ time_limit_minutes 非空）+ 历史查询 + 内部排名
    countdown.py            # 倒计时计算（绝对时间 auto_submit_at，不存"剩余时间"）+ auto_submit 触发器
    auto_submit_cron.py     # 每分钟兜底（前端归零失败时；最多延迟 60s；调 session_lifecycle.transition_to(SUBMITTED) + reason='mock_exam_timeout'）
  domain/
    types.py                # MockExamConfig dataclass
  interface/
    schemas.py
    routes.py               # POST /mock-exam/start, GET /mock-exam/history, GET /mock-exam/sessions/:id
```

**数据模型 delta**：
- `db/models_v2.py PracticeSessionV2`：新增 `exam_mode bool / time_limit_minutes int / auto_submit_at datetime / allow_pause bool / delayed_review_until datetime` 五字段（详见 [02-Data-Model §2.2](./02-Data-Model.md#22-practicesessionv2扩展)）
- DB CHECK：`exam_mode = true ⟹ practice_mode='full_set' AND source_mode='paper' AND time_limit_minutes IS NOT NULL`（详见 [02 §5](./02-Data-Model.md#5-trigger--数据完整性) + [00-Decisions §16 MockExam-2](./00-Decisions.md#16-模考模式mockexam-系列)）

**前置依赖**：WU-B11 + WU-B26 session_lifecycle（force_submit 触发器）+ §12.0 cron + Phase-Home audit。

**与 timing 模块的协同**：mock_exam 不读写 timing 表；模考期间 timing 上报照常（详见 [00-Decisions §14 Timing-12](./00-Decisions.md#14-答题计时timing-系列)）；模考超时由 mock_exam.auto_submit_cron 触发，与 timing.is_overtime 独立计算（不影响题级超时判定）。

### 12.4 modules/practice_preferences/（WU-B28）

**当前状态**：模块目录不存在（grep `practice_preferences` → 无）。`db/models_v2.py ProfileInfoV2.dashboard_preferences` 已有 JSON 字段（用于 Home 首页配置），但 [00-Decisions §17 Pref-1](./00-Decisions.md#17-用户偏好pref-系列) 决策**新建独立表 UserPracticePreferencesV2**，不复用 ProfileInfoV2。`useSessionConfigStore` (前端 localStorage) 当前直接持久化到 ProfileInfoV2.dashboard_preferences 子键，由 [00-Decisions §17 Pref-10](./00-Decisions.md#17-用户偏好pref-系列) 修订为以 UserPracticePreferencesV2.payload.custom_practice 子树为权威来源。

**新建路径**：

```
services/api/src/sikao_api/modules/practice_preferences/
  application/
    service.py              # GET / PUT / PATCH / RESET + LRU 缓存 (key=user_id, TTL=60s)
    defaults.py             # 默认 payload 字面量 + schema_version=1（六子树：ui / pacing / auto_save / keyboard / reminders / custom_practice）
    validators.py           # Pydantic root validator: keybinding 唯一性 + interval_seconds [10,300] + payload schema 严格校验
    upgrader.py             # schema_version mismatch 时 lazy upgrade（读时升 payload，不立即写库；详见 [00-Decisions §17 Pref-3](./00-Decisions.md#17-用户偏好pref-系列)）
  domain/
    types.py                # UserPracticePreferencesPayloadV1（六子树 typed）
  interface/
    schemas.py
    routes.py               # GET /me/preferences, PUT /me/preferences, PATCH /me/preferences, POST /me/preferences/reset
```

**数据模型 delta**：
- `db/models_v2.py` 末尾追加 `class UserPracticePreferencesV2(Base)`（user_id PK + payload JSON + schema_version int + updated_at；详见 [02-Data-Model §3.9](./02-Data-Model.md#39-userpracticepreferencesv2)）
- ProfileInfoV2.dashboard_preferences **不删**；旧字段 cleanup 策略详见下方「ProfileInfoV2.dashboard_preferences 收敛策略」段（PR 11 双写过渡 + 旧字段 cleanup 超本 Phase 范围）

**前置依赖**：Phase-Home identity 模块（已就位）+ Phase-Home audit。本模块自带 LRU（用 `functools.lru_cache(maxsize=1024)` 加 TTL wrapper，TTL=60s 详见 [00-Decisions §17 Pref-11](./00-Decisions.md#17-用户偏好pref-系列)），不依赖外部 cache infra。

**无 cron**：本模块不引入 cron 任务（[00-Decisions §17](./00-Decisions.md#17-用户偏好pref-系列) 没有定时刷新需求；schema_version lazy upgrade 在 GET 路径触发）。

**ProfileInfoV2.dashboard_preferences 收敛策略**：dashboard_preferences 字段**不删**；Pref-10 修订为：custom_practice 子键由 service 层 mirror 写到 UserPracticePreferencesV2（PR 11 落地双写策略；旧字段读路径在过渡期内保留兼容；旧字段最终 cleanup 超本 Phase 范围，待后续 phase 规划）。同步修订见 §11 修订表新增的 `04-Frontend-WU §3.2 F10.2` 行。

### 12.5 question_metadata schema 预留（WU-B29，schema-only）

**当前状态**：模块目录**不会建**（[00-Decisions §18 QMeta-10](./00-Decisions.md#18-题目元数据qmeta-系列phase-1-仅-schema) 决策：service 层不导出 CRUD，防止 Phase 1 误用）。Phase 1 仅落 schema：

- `db/models_v2.py QuestionV2`：新增 5 字段 `complexity_level / discrimination_index / heat_score / ability_dimensions / knowledge_tags`（NULL 允许；详见 [02-Data-Model §2.1](./02-Data-Model.md#21-questionv2最重要的扩展) + [00-Decisions §18 QMeta-4 ~ QMeta-8](./00-Decisions.md#18-题目元数据qmeta-系列phase-1-仅-schema)）
- `db/models_v2.py` 末尾追加 `class KnowledgePointV2(Base)` + `class QuestionKnowledgePointV2(Base)`（详见 [02-Data-Model §3.10](./02-Data-Model.md#310-knowledgepointv2phase-1-schema-only) / §3.11；Phase 1 完工时**必须为空表**，QMeta-9）
- OpenAPI 预留 `x-phase: 2` 标注的端点定义（不实现，不暴露到 swagger UI 默认 tab；详见 [00-Decisions §18 QMeta-11](./00-Decisions.md#18-题目元数据qmeta-系列phase-1-仅-schema)）

**前置依赖**：WU-B10（QuestionV2 字段扩展）。

**与 Phase-Review 的关系**：Phase-Review 错因聚类 Phase 1 仍用 QuestionV2.category_l1/l2；Phase 2 升级到 knowledge_point 维度（[00-Decisions §18 QMeta-14](./00-Decisions.md#18-题目元数据qmeta-系列phase-1-仅-schema)），独立 Phase 实施。本 Phase 不在 modules/review/ 内引入任何 knowledge_point 引用。

### 12.6 modules/question_report/（WU-B30）

**当前状态**：模块目录不存在（grep `services/api/src/sikao_api/modules/question_report` → 无）。`db/models_v2.py QuestionV2`（line 236-260）当前字段集**不含** `quality_score / report_count / is_active`（详见本文 §3.1 缺失字段清单）；这三字段全部由 WU-B10 字段扩展落地（02-Data-Model §2.1 定义目标态注释，目标注释「仅 AI 题有效」由 PR 1 §13 supersede 表第 3 行修订为字段语义扩展到真题，真题衰减系数 -= 0.05 / AI 题 -= 0.10，详见 [00-Decisions §19 Report-7](./00-Decisions.md#19-题目纠错report-系列)）。本模块在 WU-B10 字段扩展之上构建。

**新建路径**：

```
services/api/src/sikao_api/modules/question_report/
  application/
    service.py              # 创建（限速 + sanitizer + 24h partial UNIQUE + Idempotency-Key）/ 状态 transition / admin 查询
    auto_offline_cron.py    # 每小时 :15 扫真题 distinct user >= 5 → is_active=false + disable_reason 标 cron 自动下线类型（仅真题；AI 题走 quality_score=0 ⟹ AI-G-6 路径；详见 [00-Decisions §19 Report-6](./00-Decisions.md#19-题目纠错report-系列)）
    sla_check_cron.py       # 每日 04:15 标 is_stale=true（pending > 7d）+ 写 audit report.sla_breach
    regenerate_worker.py    # AI 题 outcome=fixed 触发 LLM 改写新题（service 层 enqueue 触发，非定时 cron 调度，故不带 _cron 后缀；5min 超时 → status=failed + audit + 不自动重试 + admin 手动 retry，详见 [00-Decisions §19 Report-15](./00-Decisions.md#19-题目纠错report-系列)）
    archive_cron.py         # 每月 1 号 02:45 resolved >90d 移到 question_report_archived_v2
    quality_recalc_cron.py  # 周一 03:30（与 D-Q11 03:00 错峰 30min）重算 outcome=fixed 题的 quality_score（详见 Report-7 公式）
  domain/
    state_machine.py        # status enum {pending, under_review, resolved} + outcome enum {fixed, rejected, duplicate} + transition 矩阵
    types.py
  interface/
    schemas.py              # Pydantic body 含 description（10-500 char + sanitizer）/ proposed_correction（≤500 char）
    routes.py               # POST /reports（限速 10/day + 24h partial UNIQUE 409）, GET /me/reports, GET /admin/reports（admin 鉴权）, PATCH /admin/reports/:id/transition, POST /admin/questions/:id/offline（manual 下线，对应 [00-Decisions §19 Report-13](./00-Decisions.md#19-题目纠错report-系列) `question.admin_offline` audit action）
```

**数据模型 delta**：
- `db/models_v2.py QuestionV2`：
  - 新增 `quality_score / report_count / is_active` 三字段（由 WU-B10 落地，详见本文 §3.1 缺失字段清单 + [02-Data-Model §2.1](./02-Data-Model.md#21-questionv2最重要的扩展)；注释直接按 PR 1 §13 supersede 后的扩展语义写，不存在「已有 → 修注释」步骤）
  - 新增 `disable_reason` 字段（取值集合详见 PR 3 02 §2.1，本节不预定字面量；至少需覆盖 [Report-6](./00-Decisions.md#19-题目纠错report-系列) cron 自动下线 / [Report-13](./00-Decisions.md#19-题目纠错report-系列) admin 手动下线 / [Report-15](./00-Decisions.md#19-题目纠错report-系列) regenerate 替换 三条路径）
- `db/models_v2.py` 末尾追加 `class QuestionReportV2(Base)` + `class QuestionReportArchivedV2(Base)`（详见 PR 3 02-Data-Model 中 QuestionReportV2 章节，节号由 PR 3 落地后回填）
- 新增 trigger（PR 3 02 §5）：`status=resolved` 终态不可改 UPDATE 拦截 + 申诉 lifetime ≤ 3 行级校验（详见 [00-Decisions §19 Report-10](./00-Decisions.md#19-题目纠错report-系列)：rejected 后可再报但同 user/question 累计 ≤ 3 次）
- 新增 partial UNIQUE：`UNIQUE (user_id, question_id) WHERE status IN ('pending', 'under_review')`

**前置依赖**：WU-B10 + Phase-Home audit/sanitizer/idempotency infra + WU-B22 question_generator（用于 Report-15 regenerate 任务）+ §12.0 cron。

**新增 IDEMPOTENT_PATHS**：见 [§6.2](#62-idempotency--audit--observability) 已同步追加 `POST /api/v2/practice/reports`（24h TTL，与 Report-4 partial UNIQUE 窗口对齐）。

**前端配套**：[04-Frontend-WU §19 WU-F23](./04-Frontend-WU.md#19-wu-f23-question-report-ui)（PR 17 提供）。后端先行（B30 完工后才解锁 F23）。

### 12.7 modules/admin/ 现状与 B30 admin 端点

`modules/admin/` 已存在（详见 [§2.3 现有 modules 现状](#23-现有-modules-现状)），承载 Phase-Home 与 Phase-Profile 引入的 admin 路由。B30 的 admin 端点（`PATCH /admin/reports/:id/transition` / `POST /admin/questions/:id/offline` / `GET /admin/reports/archived`）由 WU-B30.4 PR 子任务挂到 modules/admin/ 路由命名空间下，service 层调 modules/question_report/application/service.py — **不在 modules/question_report/ 内重复实现 admin 鉴权中间件**（继承现有 admin 鉴权链）。

