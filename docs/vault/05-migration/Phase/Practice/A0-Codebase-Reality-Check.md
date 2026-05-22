# Phase-Practice · A0 · Codebase Reality Check

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
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
| scheduler 基座 | 当前仓库只有 profile deletion 的 lifespan scheduler；Phase-Home WU-B8 需另行落地 Home 的 cron / realtime hook 框架 | **WU-B23**：在 Home 最终落地的 scheduler 基座上追加 4 个新 cron 任务 |

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
├── notes/ + notes_v2/        ← B16.4 题级笔记最小 CRUD（CLP-5 落地）；主 view 仍由 [Phase/Notes](../Notes/README.md) 完成
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
| EssayDraftV2 | 已建表，**WU-B20.5 启用**（CLP-6：30s 自动保存草稿端点） |
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
| 03-Backend-WU | WU-B23 cron | "在 Phase-Home APScheduler 上扩展 4 个 cron" | 保留语义但路径调整：`services/api/src/sikao_api/cron/` 已存在，新文件追加即可 |
| 04-Frontend-WU | F17.2-F17.4 | "删除老 view + 路由清理" | Phase-Home WU-F7.4 已清理大部分；Tab 2 仅清理练习相关 11 个 view |
| README §6 (本 Phase) | "Tab 2 WU-B22 依赖 Phase-Home WU-B7" | 保留 | 强约束改为按 `B1 / B7 / B8 / B9` 的后端里程碑逐项解锁，不等待 legacy Home 前端轨 |

任何 PR 提交时，PR description 写"已读 A0 §X.Y"作为 acknowledge。
