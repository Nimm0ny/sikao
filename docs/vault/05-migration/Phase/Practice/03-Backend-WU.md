# Phase-Practice · 03 · Backend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: 每个 WU 对应一组 PR；PR 按 AGENTS-H9 ≤15 文件 / ≤400 行；每个 PR 必须含测试
> **重要**：所有"`modules/llm_v2/`"都应解读为"`modules/llm/`"（详见 [A0 §2.4](./A0-Codebase-Reality-Check.md#24-moduleslllm-与-tab-2-的关系重要)）

---

## 0. WU 总览

| # | WU | 估算 | PR 数 | 依赖 |
|---|---|---|---|---|
| WU-B10 | QuestionV2 schema 扩展 | 450 | 3 | Phase-Home WU-B1 |
| WU-B11 | session 系列字段扩展（含 NoteV2 提前升级） | 300 | 4 | Phase-Home WU-B1 |
| WU-B12 | 新表数据模型（5 个表） | 750 | 5 | B11 |
| WU-B13 | 申论范文表（2 个表 + trigger） | 350 | 2 | B12 |
| WU-B14 | content 模块扩展（categories + papers filter + question detail aggregation） | 1,000 | 4 | B10 / B11 / B12 / B16 |
| WU-B15 | session 模块扩展（多 mode + 答题中操作 + as_draft） | 1,400 | 5 | B10 / B11 / B12 |
| WU-B16 | favorites + question_flags + question-linked notes CRUD（新建 / 扩展） | 850 | 4 | B12 |
| WU-B17 | practice_stats 模块（新建） | 1,500 | 5 | B11 / B12 |
| WU-B18 | ai_questions 模块（新建） | 1,200 | 4 | B10 / B12 / B22 |
| WU-B19 | daily_practice 模块（新建） | 800 | 3 | B12 / B17 |
| WU-B20 | essay_grading 模块扩展（含 essay_draft CRUD） | 1,500 | 5 | B13 / B22 |
| WU-B21 | 真题数据导入脚本 | 500 | 2 | B10 |
| WU-B22 | LLM 模块扩展（在 modules/llm/ 上追加 3 能力） | 2,000 | 6 | Phase-Home WU-B7 |
| WU-B23 | cron 扩展（4 新 cron + 1 增量 hook） | 900 | 4 | B17 / B18 / B19 / B20 |
| WU-B24 | E2E + OpenAPI 验收 | 1,800 | 5 | B10-B23 |
| WU-B25 | timing 模块（新建，含 baseline 表 + cron） | 1,500 | 5 | B11 |
| WU-B26 | session_lifecycle 模块（新建，含状态机 + cleanup cron） | 1,300 | 4 | B11 |
| WU-B27 | mock_exam 模块（新建，含倒计时 + auto_submit cron） | 1,200 | 4 | B11 / B26 |
| WU-B28 | practice_preferences 模块（新建） | 800 | 3 | Phase-Home 用户体系 |
| WU-B29 | question_metadata schema 预留（仅 schema） | 400 | 2 | B10 |
| WU-B30 | question_report 模块（新建） | 600 | 2 | B10 |
| **合计** | | **21,100** | **81** | |

> 较初版 README 的 17k/70 PR 上调，原因：4 个 MUST 模块（B25-B28）完整落地 + B29 schema 预留 + B30 真题纠错入口 + 闭环修订（CLP）补齐 4 个硬缺口（B14.4 题目详情聚合 / B16.4 题级笔记 CRUD / B20.5 essay_draft CRUD）。
>
> 前端总量见 [04-Frontend-WU](./04-Frontend-WU.md)。

---

## 1. 全局规范

### 1.1 路由分组

所有 V2 路由在 `services/api/src/sikao_api/main.py` 注册前缀 `/api/v2`。本 Phase 新增模块挂载点：

```python
# main.py（增量）
app.include_router(favorites_router,         prefix="/api/v2")
app.include_router(question_flags_router,    prefix="/api/v2")
app.include_router(question_notes_router,    prefix="/api/v2")  # B16.4 题级笔记最小 CRUD
app.include_router(question_detail_router,   prefix="/api/v2")  # B14.4 GET /questions/:id 聚合
app.include_router(practice_stats_router,    prefix="/api/v2")
app.include_router(ai_questions_router,      prefix="/api/v2")
app.include_router(daily_practice_router,    prefix="/api/v2")
app.include_router(essay_grading_router,     prefix="/api/v2")
app.include_router(essay_drafts_router,      prefix="/api/v2")  # B20.5 申论草稿 CRUD
# Phase-Practice 4 个 MUST 模块新增：
app.include_router(timing_router,                prefix="/api/v2")
app.include_router(session_lifecycle_router,     prefix="/api/v2")
app.include_router(mock_exam_router,             prefix="/api/v2")
app.include_router(practice_preferences_router,  prefix="/api/v2")
# question_report 真题纠错：
app.include_router(question_reports_router,      prefix="/api/v2")
# question_metadata Phase 1 不挂 router（仅建表）；Phase 2 才挂载
# 已存在的 content / session / 其他不变（仅扩展原模块）
```

### 1.2 鉴权与授权

所有端点 `Depends(get_current_user)` 注入。**资源所属校验**：每个 mutation / read-by-id 端点必须在 service 层调 `assert_owner(user_id, resource)`，违反返回 `404 Not Found`（不是 403，避免泄漏存在性）。

### 1.3 错误码

继承 Phase-Home 已有 + Tab 2 新增：

| code | http | 用途 |
|---|---|---|
| `STRICT_CLOSED_BOOK` | 403 | 整组模式下尝试看解析（Pace-Closed-Book） |
| `IMMUTABLE_FIELD` | 422 | 修改 immutable 字段（如 source / practice_mode） |
| `AI_AUDIT_FAILED` | 503 | LLM 自审未通过 + 重试仍失败 |
| `AI_QUOTA_EXCEEDED` | 429 | AI 出题用户日配额耗尽 |
| `ESSAY_GRADING_PENDING` | 200 | 申论批改进行中（不是错误，是状态） |
| `ESSAY_GRADING_FAILED` | 200 | 批改失败（前端展示重试按钮） |
| `QUESTION_INACTIVE` | 410 | 题已下线（is_active=false） |
| **闭环修订（CLP）新增** | | |
| `INVALID_QUESTION_REFERENCE` | 422 | session.create(mode=ai_generated) 校验 question_ids 不全在 AiGeneratedQuestionRequestV2 内（CLP-2） |
| `NOTE_NOT_QUESTION_LINKED` | 422 | 题级笔记 CRUD 端点收到 linked_question_id 为空（B16.4） |
| `ESSAY_DRAFT_NOT_FOUND` | 404 | GET essay/sessions/:id/draft 但该 session 尚未保存过草稿（B20.5） |
| **timing 模块新增** | | |
| `EVENT_ORDER_VIOLATION` | 422 | timing events 内 ts 非升序 |
| `STALE_EVENT` | 422 | timing event ts 早于 last_modified - 60s |
| `PAYLOAD_TOO_LARGE` | 400 | events.length > 200 |
| `BASELINE_INSUFFICIENT` | 404 | 题目 baseline sample_size < MIN_SAMPLES |
| **session_lifecycle 模块新增** | | |
| `INVALID_TRANSITION` | 409 | 状态转换非法（如 SUBMITTED → IN_PROGRESS） |
| `IMMUTABLE_TERMINAL_STATE` | 422 | 修改终态 session 字段 |
| `SESSION_NOT_WRITABLE` | 409 | 终态 session 调 mutation 端点（含 timing 写入）|
| `SESSION_NOT_OWNED` | 404 | 越权访问其他用户 session |
| **mock_exam 模块新增** | | |
| `NOT_MOCK_EXAM` | 404 | 对非模考 session 调用 countdown 端点 |
| `PAPER_NOT_MOCK_ELIGIBLE` | 422 | 套卷不支持作为模考（题数 < 阈值等） |
| `MOCK_PAUSE_FORBIDDEN` | 422 | 模考期间尝试 pause |
| `MOCK_NOTES_FORBIDDEN` | 422 | 模考期间尝试创建题级笔记 |
| `DELAYED_REVIEW_LOCKED` | 403 | delayed_review_until 未到，看解析被拒 |
| `INVALID_TIME_LIMIT` | 422 | time_limit_minutes 超出 [10, 360] |
| **practice_preferences 模块新增** | | |
| `SCHEMA_VERSION_MISMATCH` | 422 | 客户端 schemaVersion 与服务端不一致 |
| `INVALID_PREFERENCE_FIELD` | 422 | 字段校验失败（含 field / message 详情） |
| `INVALID_PATCH_PATH` | 422 | PATCH 端点 path 不合法 |
| **question_report 模块新增** | | |
| `REPORT_DUPLICATE_PENDING` | 409 | 同用户对同题已有 pending 报告 |

### 1.4 限流

详见 [08-NonFunctional §2](./08-NonFunctional.md#2-安全与限流)。本 Phase 关键限流：

- `POST /ai-questions/generate`：每用户 5 req/min + 每用户 30 req/day（成本控制）
- `POST /essay/submissions/:id/grade`：每用户 5 req/day（成本最高）
- `POST /essay/reference-answers/generate`：每用户 10 req/day
- 收藏 / 标记 / 反馈类：每用户 60 req/min
- 列表读取类：每用户 120 req/min
- **B14.4 题目详情聚合**：`GET /practice/questions/:id` 每用户 60 req/min
- **B16.4 题级笔记 CRUD**：POST/PATCH/DELETE 每用户 30 req/min；GET /questions/:id/notes 60 req/min
- **B20.5 essay_draft CRUD**：`PUT /essay/sessions/:id/draft` 每用户每 session 4 req/min（30s 间隔有余量）
- **timing**：`POST /sessions/:id/timing/events` 每用户每 session 20 req/min
- **session_lifecycle**：`POST /sessions/:id/heartbeat` 每用户每 session 5 req/min；pause/resume 30 req/min；discard 10 req/min；GET /sessions/active 60 req/min
- **mock_exam**：`POST /practice/mock-exams` 每用户 20 req/day；`GET /sessions/:id/countdown` 每用户每 session 30 req/min
- **practice_preferences**：GET 120 / PUT 30 / PATCH 60 / RESET 5 req/min
- **question_report**：`POST /questions/:id/report` 每用户 20 req/day（防滥用）

### 1.5 幂等中间件（继承 Phase-Home AI-8）

`IDEMPOTENT_PATHS` 追加：

```
POST /api/v2/practice/ai-questions/generate
POST /api/v2/practice/essay/submissions/:id/grade
POST /api/v2/practice/essay/reference-answers/generate
POST /api/v2/practice/mock-exams                      # 创建模考
```

逻辑同 Phase-Home WU-B1.4 的 IdempotencyKeyV2 表。

注意：以下端点**不**走幂等中间件（理由各有）：
- timing 事件批量上报：每次 batch 内容不同，幂等性由"事件按 ts 顺序累积"保证
- heartbeat：天然幂等（同一 ts 多次到达只更新 last_heartbeat_at）
- preferences PUT/PATCH：last-writer-wins，无需幂等
- pause/resume/discard：状态机转换天然 idempotent（重复调用要么成功要么 INVALID_TRANSITION）
- **essay_draft PUT**（B20.5）：last-writer-wins 按 content 覆盖，自然幂等
- **题级笔记 CRUD**（B16.4）：客户端不会高频重试；MVP 阶段不强制
- **session.create**（含 ai_generated mode，CLP-2）：前端在等待页跳转后立即 unmount，不会重复触发；同一 requestId 重复 create 返回不同 session_id 视为正常，由前端负责导航

### 1.6 OpenAPI Tag 约定

| tag | 端点前缀 |
|---|---|
| content | /practice/center, /practice/{xingce|essay}/{categories|papers} |
| sessions | /practice/sessions |
| favorites | /practice/favorites, /practice/questions/:id/favorite |
| flags | /practice/flags, /practice/questions/:id/flag |
| stats | /practice/stats |
| ai-questions | /practice/ai-questions |
| daily | /practice/daily |
| essay-grading | /practice/essay/submissions, /practice/essay/reference-answers |
| **essay-drafts** (CLP-6) | /practice/essay/sessions/:id/draft |
| **question-detail** (CLP-7) | /practice/questions/:id |
| **question-notes** (CLP-5) | /practice/notes, /practice/questions/:id/notes |
| **timing** | /practice/sessions/:id/timing, /practice/stats/timing, /practice/questions/:id/timing-baseline |
| **session-lifecycle** | /practice/sessions/:id/{pause|resume|heartbeat|discard|start|lifecycle}, /practice/sessions/active |
| **mock-exam** | /practice/mock-exams, /practice/sessions/:id/countdown |
| **practice-preferences** | /profile/practice-preferences |
| **question-reports** | /practice/questions/:id/report, /admin/question-reports |

---

## 2. WU-B10 · QuestionV2 schema 扩展

**目标**：把题库表升级为支持真题 + AI 题双源，含分类 / 年份 / 地区 / 历史正确率。

**核心交付物**：详见 [02-Data-Model §2.1](./02-Data-Model.md#21-questionv2最重要的扩展)。

### B10.1 模型字段扩展第一批（source / 分类 / 年份 / 地区）

文件：
- `db/models_v2.py` 追加字段 `source / year / region / exam_type / category_l1 / category_l2`
- `db/schemas_v2.py` 扩展 `QuestionEnvelopeV2`
- `migrations/versions/xxx_question_v2_field_part1.py`
- `tests/db/test_question_v2_part1.py`

行数：~150。

### B10.2 模型字段扩展第二批（AI 题 + 质量信号）

文件：
- `db/models_v2.py` 追加 `historical_accuracy / answer_count / quality_score / report_count / is_active / ai_*`
- `migrations/versions/xxx_question_v2_field_part2.py`
- `tests/db/test_question_v2_part2.py`

行数：~150。

### B10.3 索引 + 数据回填 + immutable trigger

文件：
- `migrations/versions/xxx_question_v2_indexes.py`：3 复合索引 + source immutable trigger
- 数据回填：现有题 source=real_exam / is_active=true / historical_accuracy=0.5
- `tests/db/test_question_v2_immutable.py`：尝试 UPDATE source 必须失败

行数：~150。

**估算**：450 行 / 3 PR
**验收**：现有题数据完整保留；alembic 往返通过；UPDATE source = TypeError；典型 query 性能可接受（< 50ms p95 in test fixture）。

---

## 3. WU-B11 · session 系列字段扩展

**目标**：PracticeSessionV2 / PracticeSessionAnswerV2 / NoteV2 / ReviewItemV2 字段扩展。

### B11.1 PracticeSessionV2 字段扩展

文件：
- `db/models_v2.py`：加 `practice_mode / source_mode / config_snapshot`
- `migrations/versions/xxx_session_practice_mode.py`：默认值 `practice_mode=full_set, source_mode=paper, config_snapshot={}`
- `tests/db/test_session_v2_practice_mode.py`

### B11.2 PracticeSessionAnswerV2 字段扩展

文件：
- `db/models_v2.py`：加 `flagged / viewed_solution / view_solution_at`
- `migrations/versions/xxx_answer_flag_solution.py`
- `tests/db/test_answer_v2_flag_solution.py`

### B11.3 NoteV2 字段扩展（**Tab 4 schema 提前升级**）

文件：
- `db/models_v2.py`：加 `linked_question_id / visibility`
- `migrations/versions/xxx_note_v2_question_link.py`
- `tests/db/test_note_v2_question_link.py`

⚠️ 这是 Tab 4 schema 的提前升级。NoteV2 主 view 由 [Phase/Notes](../Notes/README.md) 处理。

### B11.4 ReviewItemV2 reason 枚举扩展

文件：
- `db/models_v2.py`：reason 枚举加 `flagged_persistent`
- `migrations/versions/xxx_review_reason_flagged.py`
- `tests/db/test_review_v2_reason.py`

**估算**：300 行 / 4 PR
**依赖**：Phase-Home WU-B1 完成
**验收**：所有旧 session/answer/note 数据完整；新字段默认值合理；alembic 往返通过。

---

## 4. WU-B12 · 新表数据模型

详见 [02-Data-Model §3.1-§3.7](./02-Data-Model.md#31-practicestatssnapshotv2)。

### B12.1 PracticeStatsSnapshotV2

文件：模型 + schema + alembic + model 单测。行数 ~150。

### B12.2 QuestionFavoriteV2

行数 ~120。

### B12.3 QuestionFlagV2

行数 ~150（含 partial unique index）。

### B12.4 AiGeneratedQuestionRequestV2

行数 ~170（含 LlmCallV2 关联）。

### B12.5 DailyPracticeV2

行数 ~160。

**估算**：750 行 / 5 PR
**依赖**：B11
**验收**：每个表 model 单测通过；alembic 往返通过；UNIQUE 约束有测试覆盖。

---

## 5. WU-B13 · 申论范文表

### B13.1 EssayReferenceAnswerV2

文件：模型 + schema + alembic。行数 ~180。

### B13.2 EssayReferenceFeedbackV2 + trigger

文件：
- `db/models_v2.py`：EssayReferenceFeedbackV2 模型
- `migrations/versions/xxx_essay_ref_feedback.py`：表 + trigger
  - PostgreSQL：`sync_reference_feedback_counts` 函数 + insert/delete trigger
  - SQLite（开发态）：trigger 用 SQL，逻辑等价
- `tests/db/test_essay_ref_feedback_trigger.py`：feedback CRUD 后 reference 计数同步正确

行数 ~170。

**估算**：350 行 / 2 PR
**依赖**：B12
**验收**：feedback insert/delete 后 likes_count / favorites_count / report_count 正确同步。

---

## 6. WU-B14 · content 模块扩展

**目标**：把 V2 现有的 stub catalog 端点改为真实现，含 filter。

### 6.1 端点变更

```
GET /api/v2/practice/xingce/categories?level=1|2
  → 返回二级分类树（动态从 QuestionV2.category_l1/l2 聚合）

GET /api/v2/practice/xingce/papers?year=&region=&exam_type=&difficulty=
  → 返回套卷列表（含已完成状态）

GET /api/v2/practice/essay/categories?level=1|2
GET /api/v2/practice/essay/papers?year=&region=&exam_type=
```

### 6.2 PR 拆分

#### B14.1 xingce categories + papers

文件：
- `modules/content/application/service.py`：`build_xingce_categories_envelope` / `build_xingce_papers_envelope`
- `modules/content/interface/routes.py`：覆盖现有 stub
- `tests/modules/content/test_xingce_endpoints.py`

行数 ~300。

#### B14.2 essay categories + papers

行数 ~250。

#### B14.3 已完成状态 join + 排序优化

文件：
- `modules/content/application/completion_query.py`：用 PracticeSessionV2.last_completed_at 计算 paper 完成状态
- 加 `is_completed / best_score / last_attempt_at` 字段到 paper 卡片 envelope
- 加排序参数 `?sort=year_desc|difficulty|recent`

行数 ~250。

#### B14.4 题目详情聚合端点（CLP-7）

文件：
- `modules/content/application/question_detail.py`：聚合查询
  - 题面（QuestionV2 + options + assets）
  - 该用户题级笔记列表（NoteV2 where user_id AND linked_question_id）
  - 该用户答题历史（最近 5 次 PracticeSessionAnswerV2 join PracticeSessionV2 where status=submitted）
  - 收藏状态（QuestionFavoriteV2 单条 / null）
  - 持久标记状态（QuestionFlagV2 active / null）
  - 范文列表（仅 type=essay 时；按 source + quality_score 排序，limit=5）
- `modules/content/interface/routes.py`：`GET /api/v2/practice/questions/:question_id`
- AGENTS-H7：聚合内任一子查询失败即整体 500，不静默吞错
- 返回 410 QUESTION_INACTIVE / 404 NOT_FOUND（越权伪装为 404）
- `tests/modules/content/test_question_detail.py`：聚合正确性 + 越权 / 下线题 / 范文存在性各路径

行数 ~200。

**估算**：1,000 行 / 4 PR
**依赖**：B10 / B11 / B12 / B16
**验收**：filter 组合 query 测试通过；分类树正确聚合；已完成状态准确；题目详情聚合正确（含 e2e 跨 tab 联动 from Tab 4）。

---

## 7. WU-B15 · session 模块扩展（多 mode + 答题中操作）

### 7.1 端点变更

```
POST /api/v2/practice/sessions
  body 新增字段：
    mode: paper | category | custom | ai_generated | daily | wrong_redo
    practice_mode: per_question | full_set
    as_draft?: bool = false        # CLP-4：默认 false 直接 IN_PROGRESS；
                                    #         mock-exam 端点强制 true 等用户点 start
    config: {
      category?, year_range?, difficulty_range?, count?,
      exclude_already_done?, only_wrong?,
      questionIds?: int[],         # mode=ai_generated 必填
      requestId?: int              # mode=ai_generated 必填（关联 AiGeneratedQuestionRequestV2）
    }
    linked_plan_event_id?: int
    linked_recommendation_id?: int

POST /api/v2/practice/sessions/:id/answers/:answer_id/flag
  body: { flagged: bool }

POST /api/v2/practice/sessions/:id/answers/:answer_id/view-solution
  → 严格校验 practice_mode=full_set 时 403 STRICT_CLOSED_BOOK

POST /api/v2/practice/sessions/:id/persistent-flag
  body: { question_id, reason }
```

### 7.2 PR 拆分

#### B15.1 mode=category 支持

文件：
- `modules/session/application/mode_dispatcher.py`：mode 选取算法 dispatch
- `modules/session/application/category_picker.py`：按 category_l1/l2 选题
- `tests/modules/session/test_mode_category.py`

行数 ~280。

#### B15.2 mode=custom 支持（自定义刷题）

文件：
- `modules/session/application/custom_picker.py`：按 year_range / difficulty / count / exclude_done / only_wrong 选题
- `modules/session/application/custom_picker_test.py`

行数 ~300。

#### B15.3 mode=daily / wrong_redo 支持

文件：
- `modules/session/application/daily_picker.py`：从 DailyPracticeV2.question_ids 直接取
- `modules/session/application/wrong_redo_picker.py`：从 ReviewItemV2 队列取
- `tests/modules/session/test_mode_daily_redo.py`

行数 ~250。

#### B15.4 mode=ai_generated 支持（CLP-2 修订：不调 LLM，仅消费已生成 question_ids）

文件：
- `modules/session/application/ai_picker.py`：
  - 接收 `config.questionIds` 与 `config.requestId`
  - 校验所有 question_id 存在且 `source ∈ (ai_generated, ai_modified) ∧ is_active=true`
  - 校验 question_ids 全部出现在 `AiGeneratedQuestionRequestV2[id=requestId].pool_question_ids ∪ llm_generated_question_ids`，否则 422 INVALID_QUESTION_REFERENCE
  - 把 requestId 写入 `session.config_snapshot.ai_request_id` 用于审计反查
  - **不**直接调 ai_questions 模块的 generator service（generator 已在前端等待页阶段消费完成）
- 测试：含 LLM mock provider（仅用于校验 ai_picker 不调 LLM 路径，AI 生成由 B18 端点单测）

⚠️ CLP-2 流程：前端等待页 `POST /ai-questions/generate` → 拿到 question_ids → 再 `POST /sessions { mode: 'ai_generated', config: { questionIds, requestId } }`。session.create 与 ai-questions/generate 是两次独立 mutation。

行数 ~250。

#### B15.5 答题中操作端点

文件：
- `modules/session/interface/routes.py`：3 个新端点
  - `POST /sessions/:id/answers/:answer_id/flag`
  - `POST /sessions/:id/answers/:answer_id/view-solution`（严格闭卷校验）
  - `POST /sessions/:id/persistent-flag`
- `modules/session/application/answer_ops.py`
- `tests/modules/session/test_answer_ops.py`

⚠️ 关键：view-solution 端点必须严格校验：
```python
if session.practice_mode == 'full_set' and session.status != 'submitted':
    raise ServiceError(code='STRICT_CLOSED_BOOK', http=403)
```

行数 ~320。

**估算**：1,400 行 / 5 PR
**依赖**：B10 / B11 / B12 / B22
**验收**：6 种 mode 都有 e2e 测试；整组模式严格闭卷 invariant test 0 失败；session.submit 时 flagged answers 同步入 QuestionFlagV2 + ReviewItemV2。

---

## 8. WU-B16 · favorites + question_flags 模块

### 8.1 端点

```
POST   /api/v2/practice/questions/:id/favorite
DELETE /api/v2/practice/questions/:id/favorite
GET    /api/v2/practice/favorites?type=&category=
GET    /api/v2/practice/favorites/count

POST   /api/v2/practice/questions/:id/flag
  body: { reason }
DELETE /api/v2/practice/questions/:id/flag
PATCH  /api/v2/practice/questions/:id/flag/resolve
GET    /api/v2/practice/flags?reason=

# B16.4 题级笔记最小 CRUD（CLP-5）
POST   /api/v2/practice/notes
  body: { question_id: int, body: str, title?: str }
GET    /api/v2/practice/questions/:question_id/notes
PATCH  /api/v2/practice/notes/:id
  body: { body?: str, title?: str }
DELETE /api/v2/practice/notes/:id
```

### 8.2 PR 拆分

#### B16.1 favorites 模块

文件：
- `modules/favorites/__init__.py`
- `modules/favorites/application/service.py`
- `modules/favorites/interface/routes.py`
- `modules/favorites/interface/schemas.py`
- `tests/modules/favorites/test_routes.py`

行数 ~250。

#### B16.2 question_flags 模块

文件：
- `modules/question_flags/__init__.py`
- `modules/question_flags/application/service.py`
- `modules/question_flags/interface/routes.py`
- `modules/question_flags/interface/schemas.py`
- `tests/modules/question_flags/test_routes.py`

行数 ~250。

#### B16.3 flag → ReviewItemV2 联动

文件：
- `modules/question_flags/application/review_sync.py`：flag 创建时同步 ReviewItemV2(reason=flagged_persistent)
- `tests/modules/question_flags/test_review_sync.py`：标记后立即在 review tab 看到该题

行数 ~150。

#### B16.4 题级笔记最小 CRUD（CLP-5）

文件：
- `modules/notes_v2/application/question_linked_service.py`：题级笔记 CRUD service
  - 强制 `linked_question_id` 非空（否则 422 NOTE_NOT_QUESTION_LINKED）
  - 越权访问其他用户笔记 → 404（不泄漏存在性）
  - 模考期间 POST 拒绝（先校验 `session.exam_mode=true and session.status=IN_PROGRESS` → 422 MOCK_NOTES_FORBIDDEN）；这里先简化为"不依赖 session_id 上下文，只在前端隐藏入口 + 对所有非 admin POST 不做特殊校验"，由 13-Mock-Exam 后端兜底端点（POST /api/v2/practice/sessions/:id/notes 路径）处理，详见 13 文档 §3.4
- `modules/notes_v2/interface/question_routes.py`：4 个端点
- `modules/notes_v2/interface/schemas.py`：QuestionNoteCreate / QuestionNoteUpdate / QuestionNoteEnvelope
- `tests/modules/notes_v2/test_question_linked.py`：CRUD + 越权 + 越权伪装 404 + visibility=private 强制

⚠️ 范围限制（A0 §2.3 修订）：仅落地 question-linked 笔记 CRUD；独立笔记 / 双向链接 / 全文搜索 / 标签 / 树状组织继续推到 [Phase/Notes](../Notes/README.md)。

行数 ~200。

**估算**：850 行 / 4 PR
**依赖**：B11.3（NoteV2 schema 升级）/ B12
**验收**：flag CRUD 闭环；resolve 流程；review 联动正确；题级笔记 CRUD + 越权 404 invariant 通过。

---

## 9. WU-B17 · practice_stats 模块

### 9.1 端点

```
GET /api/v2/practice/stats?type=xingce
GET /api/v2/practice/stats/realtime?category=&type=
GET /api/v2/practice/stats/trend?category=&period=7d|30d|90d
GET /api/v2/practice/stats/percentile?category=
GET /api/v2/practice/stats/cross?category=&difficulty=
```

### 9.2 PR 拆分

#### B17.1 stats 主端点（snapshot 路径）

文件：
- `modules/practice_stats/__init__.py`
- `modules/practice_stats/application/service.py`：从 PracticeStatsSnapshotV2 读 + 组装 envelope
- `modules/practice_stats/interface/routes.py` / `schemas.py`
- `tests/modules/practice_stats/test_main_endpoint.py`

行数 ~280。

#### B17.2 stats/realtime（实时聚合）

文件：
- `modules/practice_stats/application/realtime_aggregator.py`：按需直接 query PracticeSessionV2 + Answer
- 测试：snapshot 与 realtime 数据误差 < 5%

行数 ~280。

#### B17.3 stats/trend + stats/cross

文件：
- `modules/practice_stats/application/trend.py`：时间维度聚合
- `modules/practice_stats/application/cross.py`：题型 × 难度交叉矩阵
- 测试

行数 ~300。

#### B17.4 stats/percentile

文件：
- `modules/practice_stats/application/percentile.py`：从 snapshot.percentile_rank 读
- 测试

行数 ~150。

#### B17.5 snapshot 写入器（02:00 cron + 增量 hook）

文件：
- `modules/practice_stats/application/snapshot_writer.py`：
  - `recompute_user_stats(user_id)`：全量重算单用户
  - `incremental_update(user_id, session_id)`：session.submit 后增量更新
- `cron/practice_stats_cron.py`：02:00 全量 cron
- `tests/modules/practice_stats/test_snapshot_writer.py`

行数 ~490。

**估算**：1,500 行 / 5 PR
**依赖**：B11 / B12
**验收**：snapshot 与 realtime 数据一致（误差 < 5%）；cron 调度正确。

---

## 10. WU-B18 · ai_questions 模块（新建）

### 10.1 端点

```
POST /api/v2/practice/ai-questions/generate
  body: { config: AiGenerateConfig }
  Headers: Idempotency-Key
  → 同步等待（10-30s），返回 { request_id, question_ids, status, pool_count, llm_generated_count }

GET /api/v2/practice/ai-questions/requests/:id
  → 查询请求详情（审计 / 失败重试）

POST /api/v2/practice/ai-questions/:question_id/feedback
  body: { action: like|report, note? }
  → 用户反馈，更新 quality_score / report_count
```

### 10.2 PR 拆分

#### B18.1 模块骨架 + 池子查询（第一二步）

文件：
- `modules/ai_questions/__init__.py`
- `modules/ai_questions/application/service.py`
- `modules/ai_questions/application/pool_query.py`：
  - `query_pool_not_done(user_id, config, limit)`
  - `query_pool_done(user_id, config, limit)`
- `modules/ai_questions/interface/routes.py` / `schemas.py`
- `tests/modules/ai_questions/test_pool_query.py`

行数 ~340。

#### B18.2 LLM 实时生成（第三步）+ 自审

文件：
- `modules/ai_questions/application/llm_orchestrator.py`：
  - 调 `modules/llm/application/question_generator.py`（B22.1 提供）
  - 处理 audit pass/fail
  - 失败重试 1 次
- `tests/modules/ai_questions/test_llm_orchestrator.py`

行数 ~280。

#### B18.3 入库 + AiGeneratedQuestionRequestV2 审计

文件：
- `modules/ai_questions/application/persist.py`：
  - 把 LLM 输出（已 self-audit）写入 QuestionV2 (source=ai_generated)
  - 写入 AiGeneratedQuestionRequestV2 完整记录
  - content_hash 去重（命中已存在题用现有 ID）
- 测试

行数 ~280。

#### B18.4 反馈端点 + quality_score 聚合

文件：
- `modules/ai_questions/application/feedback.py`：
  - `like` / `report` 操作 → 更新 QuestionV2.quality_score / report_count
  - 写入 AuditLogV2
- 路由 + 测试

行数 ~300。

**估算**：1,200 行 / 4 PR
**依赖**：B10 / B12.4 / B22
**验收**：池子有题时不调 LLM；池子不够时正确退化；自审失败时退化报错；幂等 key 命中返回上次结果。

---

## 11. WU-B19 · daily_practice 模块（新建）

### 11.1 端点

```
GET /api/v2/practice/daily?type=xingce|essay
  → 当日的每日一练（如不存在则即时生成）

POST /api/v2/practice/daily/:id/start
  → 开始 → 创建 session（mode=daily）

GET /api/v2/practice/daily/history?period=7d|30d
  → 每日一练历史
```

### 11.2 PR 拆分

#### B19.1 daily 端点 + 弱项加权出题算法

文件：
- `modules/daily_practice/__init__.py`
- `modules/daily_practice/application/service.py`
- `modules/daily_practice/application/weakness_weighter.py`：从 PracticeStatsSnapshot 计算权重
- `modules/daily_practice/interface/routes.py` / `schemas.py`
- 测试

行数 ~320。

#### B19.2 daily.start 联动 session

文件：
- `modules/daily_practice/application/start.py`：调 session.create(mode=daily, question_ids=...)
- 测试

行数 ~200。

#### B19.3 daily history 端点

文件：
- `modules/daily_practice/application/history.py`
- 路由 + 测试

行数 ~280。

**估算**：800 行 / 3 PR
**依赖**：B12.5 / B17
**验收**：弱项分布合理；同一日多次访问返回同一份；过期逻辑正确。

---

## 12. WU-B20 · essay_grading 模块扩展

### 12.1 端点

```
POST /api/v2/practice/essay/submissions/:id/grade
  Headers: Idempotency-Key
  → 触发批改（异步）。
  ⚠️ CLP-1：默认用户路径**不调用此端点**；session.submit hook 自动隐式触发。
     此端点仅用于：(a) 上次批改 status=failed 重试 (b) admin 重新批改 (c) reference 缺失补生成。
  立即返回，结果通过 polling 拉取。

GET /api/v2/practice/essay/submissions/:id/grading-status
  → 查询批改状态（pending_grading | graded | failed）
  ⚠️ 用户提交申论后跳 result 页直接 polling 此端点；不调 grade。

GET /api/v2/practice/essay/submissions/:id/result
  → 完整批改结果（status=graded 时）

GET /api/v2/practice/essay/questions/:id/reference-answers
  → 列出该题的范文（按 source + quality_score 排序）

POST /api/v2/practice/essay/reference-answers/:id/like
DELETE /api/v2/practice/essay/reference-answers/:id/like
POST /api/v2/practice/essay/reference-answers/:id/favorite
DELETE /api/v2/practice/essay/reference-answers/:id/favorite
POST /api/v2/practice/essay/reference-answers/:id/report

POST /api/v2/practice/essay/reference-answers/generate
  body: { question_id }
  Headers: Idempotency-Key
  → 触发 AI 生成范文（异步）

# B20.5 申论草稿 CRUD（CLP-6）
PUT  /api/v2/practice/essay/sessions/:session_id/draft
  body: { content: str, client_modified_at?: ISO }
  → 200 { saved_at, version }
  策略：last-writer-wins，无 ETag（v1）；自然幂等（content 覆盖）；不走 IdempotencyKeyV2

GET  /api/v2/practice/essay/sessions/:session_id/draft
  → 200 { content, saved_at, version } | 404 ESSAY_DRAFT_NOT_FOUND

DELETE /api/v2/practice/essay/sessions/:session_id/draft
  → 仅 admin（运维）；用户提交后服务端自动归档（见 B20.5 service 描述）
```

### 12.2 PR 拆分

#### B20.1 异步批改触发 + grading-status

文件：
- `modules/essay_grading/__init__.py`
- `modules/essay_grading/application/service.py`：trigger / status query
- `modules/essay_grading/application/background_grader.py`：后台任务包装（FastAPI BackgroundTasks）
- `modules/essay_grading/application/submit_hook.py`（CLP-1）：暴露 `on_session_submit_essay(submission_id)`：
  - 仅当 status ∈ {pending_grading, failed} 才调 background_grader（避免重复）
  - 不抛错（catch + audit + metric）
  - 由 `modules/session/application/hooks.py:on_session_submit` 调用（B23.4 增量 hook）
- `modules/essay_grading/interface/routes.py` / `schemas.py`
- 测试：异步流程 e2e（含 polling）+ submit hook 隐式触发 invariant

行数 ~340。

#### B20.2 批改结果写入

文件：
- `modules/essay_grading/application/grader_runner.py`：调 `modules/llm/application/essay_grader.py`（B22.2）
- `modules/essay_grading/application/report_persist.py`：解析 LLM 输出 → EssayReportV2
- 测试（mock LLM）

行数 ~320。

#### B20.3 范文 list + feedback 端点

文件：
- `modules/essay_grading/application/reference_query.py`：按 source + quality_score 排序
- `modules/essay_grading/application/reference_feedback.py`：like/favorite/report 操作（依赖 trigger 同步计数）
- 路由
- 测试

行数 ~340。

#### B20.4 AI 范文生成端点

文件：
- `modules/essay_grading/application/reference_generator_runner.py`：调 `modules/llm/application/reference_answer_generator.py`（B22.3）
- 用户提交后自动触发（hook 在 session.submit 内）
- 路由
- 测试

行数 ~300。

#### B20.5 essay_draft CRUD（CLP-6）

文件：
- `modules/essay_grading/application/draft_service.py`：
  - `upsert_draft(session_id, user_id, content)`：last-writer-wins（自然幂等）；写入 EssayDraftV2 同时更新 PracticeSessionV2.last_activity_at
  - `get_draft(session_id, user_id)`：返回 content + saved_at + version；404 ESSAY_DRAFT_NOT_FOUND
  - `archive_draft_on_submit(session_id)`：session.submit 时把 draft.content 复制到 EssaySubmissionV2.essay_text，draft.status='submitted'
- `modules/essay_grading/interface/draft_routes.py`：3 个端点（PUT / GET / DELETE）
- `modules/essay_grading/interface/draft_schemas.py`
- `modules/session/application/hooks.py`：在 on_session_submit 内调 `archive_draft_on_submit`（仅 essay session）
- `tests/modules/essay_grading/test_draft.py`：upsert 幂等 / 越权 404 / submit 归档 / 限流

⚠️ A0 §2.5 修订：EssayDraftV2 由本 PR 启用（之前"已建表，未在路由中使用"）。

行数 ~200。

**估算**：1,500 行 / 5 PR
**依赖**：B13 / B22
**验收**：异步批改完整流程通过；范文 CRUD + feedback 正确；AI 自审失败的范文 status=archived；草稿 30s 间隔自动 PUT 不丢失数据；submit 时草稿正确归档。

---

## 13. WU-B21 · 真题数据导入脚本

**目标**：把用户本机已有的真题数据导入 V2 schema。

### 13.1 脚本设计

文件：
- `services/api/scripts/import_real_exams.py`：CLI 入口
- `services/api/scripts/importers/parser.py`：解析 JSON / CSV
- `services/api/scripts/importers/mapper.py`：字段映射 + content_hash 计算
- `services/api/scripts/importers/dedupe.py`：去重逻辑（按 content_hash）
- `tests/scripts/test_import_real_exams.py`：用 sample data 测试

### 13.2 PR 拆分

#### B21.1 import 脚本骨架 + 字段映射 + dry-run

行数 ~280（CLI 框架 + parser + dry-run 模式 + sample fixture）。

#### B21.2 实际导入 + 去重 + 增量

行数 ~220（mapper + dedupe + commit + 增量逻辑）。

**估算**：500 行 / 2 PR
**依赖**：B10
**验收**：dry-run 输出准确；CI 用 sample data 跑通；正式导入由用户在本机执行（生产数据）。

---

## 14. WU-B22 · LLM 模块扩展（在 modules/llm/ 上追加）

⚠️ 路径修订：所有"`modules/llm_v2/`"应解读为"`modules/llm/`"（A0 §2.4）。

详见 [05-LLM-Module](./05-LLM-Module.md) + [06-LLM-Prompts](./06-LLM-Prompts.md)。

### 14.1 PR 拆分

#### B22.1 question_generator + 自审 + prompts + parser

文件：
- `modules/llm/application/question_generator.py`
- `modules/llm/application/parsers/question_parser.py`
- `modules/llm/application/prompts/question_generate.py`
- `modules/llm/application/prompts/question_self_audit.py`
- `tests/modules/llm/test_question_generator.py`（mock provider）

行数 ~500。

#### B22.2 essay_grader + prompts + parser

文件：
- `modules/llm/application/essay_grader.py`
- `modules/llm/application/parsers/grading_parser.py`
- `modules/llm/application/prompts/essay_grade.py`
- 测试

行数 ~450。

#### B22.3 reference_answer_generator + prompts + parser

文件：
- `modules/llm/application/reference_answer_generator.py`
- `modules/llm/application/parsers/reference_parser.py`
- `modules/llm/application/prompts/reference_answer.py`
- 测试

行数 ~400。

#### B22.4 mock provider 扩展（覆盖新 prompt）

文件：
- `modules/llm/infrastructure/mock_provider.py`：扩展 fixture 表，按 prompt 关键字返回固定结果
- 测试

行数 ~250。

#### B22.5 facade service 扩展

文件：
- `modules/llm/application/service.py`：注册 3 个新 entry point
- 配额 / 限流 hook

行数 ~200。

#### B22.6 LLM 模块完整单测套件

文件：
- 集成测试（用 mock provider 跑全链路）

行数 ~200。

**估算**：2,000 行 / 6 PR
**依赖**：Phase-Home WU-B7
**验收**：每个能力 mock provider 跑通；真 provider 至少手动跑通一次；CI 不依赖真 LLM。

---

## 15. WU-B23 · cron 扩展

**目标**：在 Phase-Home 的 APScheduler 上追加 4 个新 cron + 1 个增量 hook。

### 15.1 Cron 任务

| 任务 | 时机 | 文件 |
|---|---|---|
| `recompute_question_accuracy` | 每日 04:00 | `cron/question_accuracy_cron.py` |
| `cleanup_low_quality_ai_questions` | 每日 04:30 | `cron/ai_cleanup_cron.py` |
| `compute_reference_quality` | 每日 05:00 | `cron/reference_quality_cron.py` |
| `generate_daily_practice` | 每日 04:00 | `cron/daily_practice_cron.py` |
| `recompute_user_stats` 增量 hook | session.submit 后 | `modules/session/application/hooks.py` |

### 15.2 PR 拆分

#### B23.1 question_accuracy + ai_cleanup cron

行数 ~300。

#### B23.2 reference_quality cron

行数 ~150。

#### B23.3 generate_daily_practice cron + 后台批量

文件：
- `cron/daily_practice_cron.py`：调 daily_practice 的弱项加权算法 batch 生成
- 失败的用户记 audit_log 但不阻塞其他用户
- 测试：mock 100 用户跑通

行数 ~280。

#### B23.4 user_stats 增量 hook（session.submit）

文件：
- `modules/session/application/hooks.py` 加入 `on_session_submit`：
  - 调 `practice_stats.snapshot_writer.incremental_update`
  - 调 `recommender` 实时刷新（继承 Phase-Home P5）
  - **CLP-1**：若 session.type=essay，调 `essay_grading.submit_hook.on_session_submit_essay(submission_id)` 隐式触发批改（不抛错；失败仅 audit + metric）
  - **CLP-6**：若 session.type=essay，调 `essay_grading.draft_service.archive_draft_on_submit(session_id)` 把草稿内容复制为最终 EssaySubmissionV2.essay_text
- 测试：含 essay submit 的全链路（draft → archive → grading async）

行数 ~170。

**估算**：900 行 / 4 PR
**依赖**：B17 / B18 / B19 / B20
**验收**：所有 cron 在 dev 环境按时跑；可手动触发；增量 hook 不阻塞 session.submit 主流程。

---

## 16. WU-B24 · E2E + OpenAPI 验收

**目标**：Tab 2 后端完工签收。

### 16.1 PR 拆分

#### B24.1 content + session 扩展 e2e

文件：
- `tests/e2e/practice/test_content_endpoints.py`
- `tests/e2e/practice/test_session_modes.py`：6 mode 各一个 happy path
- `tests/e2e/practice/test_session_pace_invariant.py`：整组模式严格闭卷 invariant

行数 ~400。

#### B24.2 favorites + flags + practice_stats e2e

行数 ~350。

#### B24.3 ai_questions + daily_practice e2e

文件：
- `tests/e2e/practice/test_ai_questions.py`：三段退化各路径 + 幂等
- `tests/e2e/practice/test_daily_practice.py`：弱项加权 + 重复访问

行数 ~400。

#### B24.4 essay_grading + reference_answers e2e

文件：
- `tests/e2e/practice/test_essay_grading_async.py`：异步流程完整 + polling
- `tests/e2e/practice/test_essay_reference.py`：CRUD + feedback + trigger 计数

行数 ~400。

#### B24.5 OpenAPI 重生成 + drift 测试

文件：
- 重生成 `services/api/spec/openapi.json`（含本 Phase 新增 ~30 端点）
- `tests/spec/test_openapi_drift.py` 更新 baseline

行数 ~250。

**估算**：1,800 行 / 5 PR
**依赖**：B10-B23 全部完成
**验收**：CI 全绿；openapi.json 与 spec 一致；invariant test 0 失败。

---

## 17. 引用矩阵

| WU | 决策依据 | 边界规则 | 数据模型 | 测试 |
|---|---|---|---|---|
| B10 | Q-Source / Q3 / D-Q1 | PR1 / PR2 | §2.1 | §3 invariant + §5 trigger |
| B11 | D-Q12 基础 / D-Q15 / D-Q5 / D-Q17 | Pace-Closed-Book / Note-Visibility | §2.2-§2.5 | §3 immutable test |
| B12 | Q5-Fav / Q5-Flag / D-Q3 / D-Q13 / Q7 | Flag-Basic-vs-Persistent / Stat-* / Daily-* | §3.1-§3.7 | §3 unique test |
| B13 | Essay-3 / D-Q4 / Essay-5 | Essay-Reference | §3.4-§3.5 | §3 trigger test |
| B14 | Q2 / Stat-1 | - | §2.1 join | §6 e2e |
| B15 | D-Q15 / D-Q12 / Cust-* / AI-G-3 | Pace-Closed-Book / Flag-* / PR-AI-G | §2.2-§2.3 / §6.1 | §6 e2e + invariant |
| B16 | Q5-Fav / Q5-Flag / D-Q12 拓展 | Flag-Basic-vs-Persistent / Flag-Resolve | §3.2-§3.3 | §6 e2e |
| B17 | Q6 / D-Q3 / D-Q11 | Stat-* | §3.1 / §6.2 | §6 e2e |
| B18 | D-Q13 / AI-G-* | PR3 / PR4 / PR-AI-G | §3.6 | §10 invariant test |
| B19 | Q7 / D-Q6 / Daily-* | - | §3.7 | §6 e2e |
| B20 | Q4 / D-Q4 / D-Q16 / Essay-* | PR8 / Essay-Reference | §2.5 / §3.4-§3.5 | §6 e2e + async |
| B21 | D-Q14 | - | §2.1 | §6 sample data |
| B22 | D-Q1 / D-Q9 / Essay-1 / Essay-3 | PR3 / Essay-Reference | - | §10 mock provider |
| B23 | Stat-Schedule / Essay-5 / Daily-4 | - | - | §10 cron test |
| B24 | 全部 | 全部 invariant | 全部 | §6-§10 |
| **B25** | **Timing-* (00 §14)** | **§12 Timing-* (10 条)** | **§2.2-§2.3 / §3.8 / §6.6 / §6.7** | **§3.7 timing invariant** |
| **B26** | **Session-LC-* (00 §15)** | **§13 Session-LC-* (12 条)** | **§2.2 / §6.8** | **§3.8 lifecycle invariant** |
| **B27** | **MockExam-* (00 §16)** | **§14 MockExam-* (12 条)** | **§2.2 / §5.3-§5.4 / §6.9** | **§3.9 mock-exam invariant** |
| **B28** | **Pref-* (00 §17)** | **§15 Pref-* (10 条)** | **§3.9 / §6.10** | **§6 preferences contract** |
| **B29** | **QMeta-* (00 §18)** | **§16 QMeta-* (9 条)** | **§2.1 / §3.10 / §3.11 / §5.7** | **§3 schema-only invariant** |
| **B30** | **真题纠错（隐含）** | **PR-Report (待补 §17)** | **§3.12（新表 QuestionReportV2）** | **§6 e2e + admin** |
| **CLP-1 ~ CLP-9** | **00 §19** | **§4 PR8 修订 / Note-* / Essay-* / AI-G-*** | **§3.12 新增 / §2.5 NoteV2 / EssayDraftV2 启用** | **§4 e2e essay async + 题级笔记跨 tab + AI 出题流程** |

---

## 18. 与 Phase-Home WU 的依赖图（详）

```
Phase-Home:
  WU-B1 (DB schema 基础)  ─────────→ Tab 2 WU-B10 / B11 (扩展 Question/Session/Note/Review)
  WU-B7 (modules/llm/ 框架) ─────────→ Tab 2 WU-B22 (在同一模块内追加 3 能力)
  WU-B8 (cron 框架)         ─────────→ Tab 2 WU-B23 (注册 4 新 cron + 1 hook)
  WU-B9 (OpenAPI 锁定)      ─────────→ Tab 2 WU-F9 (前端 types 重生成)

Tab 2 内部:
  WU-B10 ─→ B14 / B15 / B17 / B18 / B21
  WU-B11 ─→ B15 / B16 / B17 / B20
  WU-B12 ─→ B15 / B16 / B17 / B18 / B19
  WU-B13 ─→ B20
  WU-B22 ─→ B18 (LLM question_generator) / B20 (LLM essay_grader / reference_answer_generator)
  WU-B14 ~ B22 ─→ WU-B23 (cron 扩展)
  WU-B23 ─→ WU-B24 (e2e + OpenAPI)
```

⚠️ **强约束**：B22 必须在 Phase-Home WU-B7 完工后启动；B18 和 B20 依赖 B22 才能跑真实流程。
