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
| WU-B14 | content 模块扩展（categories + papers filter） | 800 | 3 | B10 |
| WU-B15 | session 模块扩展（多 mode + 答题中操作） | 1,400 | 5 | B10 / B11 / B12 |
| WU-B16 | favorites + question_flags 模块（新建） | 650 | 3 | B12 |
| WU-B17 | practice_stats 模块（新建） | 1,500 | 5 | B11 / B12 |
| WU-B18 | ai_questions 模块（新建） | 1,200 | 4 | B10 / B12 / B22 |
| WU-B19 | daily_practice 模块（新建） | 800 | 3 | B12 / B17 |
| WU-B20 | essay_grading 模块扩展 | 1,300 | 4 | B13 / B22 |
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
| **合计** | | **20,500** | **78** | |

> 新合计较初版 README 的 17k/70 PR 上调，原因：4 个 MUST 模块（B25-B28）完整落地 + B29 schema 预留 + B30 真题纠错入口。
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
app.include_router(practice_stats_router,    prefix="/api/v2")
app.include_router(ai_questions_router,      prefix="/api/v2")
app.include_router(daily_practice_router,    prefix="/api/v2")
app.include_router(essay_grading_router,     prefix="/api/v2")
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
| essay-grading | /practice/essay |
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

**估算**：800 行 / 3 PR
**依赖**：B10
**验收**：filter 组合 query 测试通过；分类树正确聚合；已完成状态准确。

---

## 7. WU-B15 · session 模块扩展（多 mode + 答题中操作）

### 7.1 端点变更

```
POST /api/v2/practice/sessions
  body 新增字段：
    mode: paper | category | custom | ai_generated | daily | wrong_redo
    practice_mode: per_question | full_set
    config: {
      category?, year_range?, difficulty_range?, count?,
      exclude_already_done?, only_wrong?
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

#### B15.4 mode=ai_generated 支持

文件：
- `modules/session/application/ai_picker.py`：调 ai_questions 模块的 generator service
- 测试：含 LLM mock provider

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

**估算**：650 行 / 3 PR
**依赖**：B12
**验收**：flag CRUD 闭环；resolve 流程；review 联动正确。

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
  → 触发批改（异步）。立即返回，结果通过 polling 拉取

GET /api/v2/practice/essay/submissions/:id/grading-status
  → 查询批改状态（pending_grading | graded | failed）

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
```

### 12.2 PR 拆分

#### B20.1 异步批改触发 + grading-status

文件：
- `modules/essay_grading/__init__.py`
- `modules/essay_grading/application/service.py`：trigger / status query
- `modules/essay_grading/application/background_grader.py`：后台任务包装（FastAPI BackgroundTasks）
- `modules/essay_grading/interface/routes.py` / `schemas.py`
- 测试：异步流程 e2e（含 polling）

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

**估算**：1,300 行 / 4 PR
**依赖**：B13 / B22
**验收**：异步批改完整流程通过；范文 CRUD + feedback 正确；AI 自审失败的范文 status=archived。

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

本 §15 描述的是 B23 范围内（基础能力闭环）的 cron。**B25/B26/B27 各自带的 cron 在自己 WU 内实现**（详见 §19.2 / §20.2 / §21.2），不计入 B23 范围。完整 8 个新 cron 汇总：

| 任务 | 时机 | 文件 | 所属 WU |
|---|---|---|---|
| `recompute_question_accuracy` | 每日 04:00 | `cron/question_accuracy_cron.py` | B23.1 |
| `cleanup_low_quality_ai_questions` | 每日 04:30 | `cron/ai_cleanup_cron.py` | B23.1（B30.2 加 hook 同步 question_report.report_count） |
| `compute_reference_quality` | 每日 05:00 | `cron/reference_quality_cron.py` | B23.2 |
| `generate_daily_practice` | 每日 04:00 | `cron/daily_practice_cron.py` | B23.3 |
| `recompute_user_stats` 增量 hook | session.submit 后 | `modules/session/application/hooks.py` | B23.4 |
| `recompute_question_timing_baseline` | 每周一 03:00 | `cron/timing_baseline_cron.py` | B25.3 |
| `cleanup_stale_sessions` | 每 5 分钟 | `cron/session_cleanup_cron.py` | B26.4 |
| `expire_daily_sessions` | 每日 23:55 | `cron/daily_session_expire_cron.py` | B26.4 |
| `mock_exam_auto_submit_cron` | 每分钟 | `cron/mock_exam_auto_submit_cron.py` | B27.3 |

⚠️ **B23 估算保持 900 行 / 4 PR 不变**（仅含 B23.1-B23.4 的基础 cron）。新模块 cron（baseline/cleanup/expire/auto_submit）在各自 WU 估算内已计入。

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
- 测试

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

## 19. WU-B25 · timing 模块（新建）

**目标**：实装答题计时核心能力（事件批量上报 / 题目耗时基线 / 分析端点 / cron 重算），覆盖 [11-Timing-Engine](./11-Timing-Engine.md) 全部规格。

### 19.1 端点（详见 11 §3-§4）

```
POST /api/v2/practice/sessions/:id/timing/events
GET  /api/v2/practice/stats/timing?type=&period=&category=
GET  /api/v2/practice/questions/:id/timing-baseline
GET  /api/v2/practice/sessions/:id/timing-report
```

### 19.2 PR 拆分

#### B25.1 模块骨架 + QuestionTimingBaselineV2 表 + alembic

文件：
- `db/models_v2.py`：QuestionTimingBaselineV2 定义（02 §3.8）
- `db/models_v2.py`：PracticeSessionV2 / PracticeSessionAnswerV2 timing 字段（02 §2.2-§2.3）
- `migrations/versions/xxx_session_timing.py`（新 migration，按 02 §7 顺序排在 session_lifecycle 之后）
- `modules/timing/__init__.py` + `domain/types.py` + `domain/errors.py`：TimingEvent / TimingAnalysis / 错误类型
- `tests/db/test_question_timing_baseline.py`

行数 ~280。

#### B25.2 event_recorder 端点 + invariant 校验

文件：
- `modules/timing/application/event_recorder.py`：核心逻辑（11 §3.4 伪码）
  - 三类事件 dispatch：question_enter / question_leave / answer_change（不含 heartbeat / pause / resume，详见 00 §14 Timing-4 修订）
  - 升序校验（Timing-Monotonic）
  - status writable 校验（Timing-Status-Writable）
  - stale 校验（Timing-No-Stale-Event）
  - 单区间截断（Timing-Bounded-Per-Visit ≤ 60s）
- `modules/timing/interface/routes.py`：`POST /sessions/:id/timing/events`
- `modules/timing/interface/schemas.py`：TimingEventBatchV2 / EventBatchResponseV2
- `tests/modules/timing/test_event_recorder.py`：6 条 invariant 各一个测试 + 配对算法 + 截断逻辑

行数 ~340。

#### B25.3 baseline_computer + 周一 cron

文件：
- `modules/timing/application/baseline_computer.py`：百分位计算 + 90 天窗口 + 脏数据过滤（11 §5.2 伪码）
- `cron/timing_baseline_cron.py`：周一 03:00 调度（详见 §15.1 修订）
- `tests/modules/timing/test_baseline_computer.py`：MIN_SAMPLES 阈值 / 脏数据剔除 / 百分位精度

行数 ~280。

#### B25.4 analyzer 服务 + stats/timing 端点

文件：
- `modules/timing/application/analyzer.py`：
  - overall / by_category_l1 / by_difficulty 聚合
  - overtime_questions top-5
  - pacing_pattern 分类（前/中/后段）
- `modules/timing/interface/routes.py` 追加：`GET /practice/stats/timing` + `GET /questions/:id/timing-baseline` + `GET /sessions/:id/timing-report`
- `tests/modules/timing/test_analyzer.py`

行数 ~320。

#### B25.5 与 session.submit 集成 hook + is_overtime 计算

文件：
- `modules/session/application/hooks.py` 增量：`compute_session_timing_summary(session_id)`
  - flush 最后一批事件
  - 算 total_active_seconds（截断异常长区间）
  - 按 baseline.p95 × 1.2 写 each answer.is_overtime
  - 写 metric `timing.session.active_seconds_histogram`
- 在 `modules/session/application/submit.py` 的 hook 调用列表中追加该函数
- `tests/modules/session/test_submit_timing_hook.py`：含 Timing-Sum-Lte-Wall / Active-Plus-Pause-Lte-Wall / Overtime-Has-Baseline 三条 invariant

行数 ~280。

**估算**：1,500 行 / 5 PR
**依赖**：B11（PracticeSessionV2 / Answer 字段已扩展前提）；不依赖 B22
**验收**：
- 7 条 timing invariant test 0 失败
- baseline cron 在 dev 环境跑通 + 增量数据后再跑一次结果稳定
- session.submit 后 total_active_seconds + paused_total_seconds ≤ wall + 5s 容差
- timing 端点不接受 heartbeat / pause / resume 事件类型（端点路由分离测试）

---

## 20. WU-B26 · session_lifecycle 模块（新建）

**目标**：完整 session 状态机 + heartbeat + pause/resume/discard + active query + 超时回收 cron，覆盖 [12-Session-Lifecycle](./12-Session-Lifecycle.md) 全部规格。

### 20.1 端点（详见 12 §4）

```
POST /api/v2/practice/sessions/:id/start
POST /api/v2/practice/sessions/:id/pause
POST /api/v2/practice/sessions/:id/resume
POST /api/v2/practice/sessions/:id/heartbeat
POST /api/v2/practice/sessions/:id/discard
GET  /api/v2/practice/sessions/active
GET  /api/v2/practice/sessions/:id/lifecycle

POST /api/v2/admin/practice/sessions/:id/force-abandon
POST /api/v2/admin/practice/sessions/:id/force-submit
```

### 20.2 PR 拆分

#### B26.1 模块骨架 + lifecycle 字段 alembic + state_machine 纯函数

文件：
- `db/models_v2.py`：PracticeSessionV2 lifecycle 字段（status 枚举 6 态 / paused_at / paused_count / last_heartbeat_at / expires_at / abandoned_at / abandoned_reason / force_submitted / force_submitted_reason / recovered_from_session_id）
- `migrations/versions/xxx_session_lifecycle.py`：字段 + 3 条 CHECK + 终态 trigger + (user_id, status, last_activity_at) 索引（02 §5.5 / §5.6）
- `modules/session_lifecycle/__init__.py` + `domain/types.py`：SessionStatus / TransitionAttempt / TransitionResult
- `modules/session_lifecycle/application/state_machine.py`：纯函数 `evaluate_transition`（12 §2.4 接口）
- `tests/modules/session_lifecycle/test_state_machine.py`：完整 truth table（每条 §2.3 规则一个 case + 终态自循环 + 跨状态非法 + DRAFT/PAUSED 心跳分支）

行数 ~360。

#### B26.2 pause / resume / start / discard 端点 + audit

文件：
- `modules/session_lifecycle/application/pause_resume.py`：
  - `pause(session, actor='user')`
  - `resume(session, actor='user', trigger='user_resume'|'new_heartbeat'|'answer_during_paused')`
  - resume 必须累加 `paused_total_seconds += (now - paused_at)`（Session-LC-Resume-Adds-Pause-Time invariant）
- `modules/session_lifecycle/application/discard.py`
- `modules/session_lifecycle/application/start_endpoint.py`：DRAFT → IN_PROGRESS 显式转换（mock_exam 在此 hook 计算 auto_submit_at）
- `modules/session_lifecycle/interface/routes.py` + `schemas.py`
- `tests/modules/session_lifecycle/test_pause_resume.py` + `test_discard.py`：含 Session-LC-Pause-Single-Active / Resume-Adds-Pause-Time / Terminal-Writes-Forbidden / Force-Submit-Audit invariant

行数 ~360。

#### B26.3 heartbeat 端点 + 多端策略 + active query

文件：
- `modules/session_lifecycle/application/heartbeat.py`：
  - 终态 → 仅返回状态不写库（Heartbeat-No-Terminal）
  - **PAUSED → IN_PROGRESS 隐式 resume**（Heartbeat-Wakes-Paused，决策 LC-3a）
  - **DRAFT 不被心跳唤醒**（Heartbeat-No-Draft-Wake，决策 LC-2）
  - 写 last_heartbeat_at + config_snapshot.last_seen_question_id
- `modules/session_lifecycle/application/active_session_query.py`：GET /sessions/active
- `modules/session_lifecycle/application/lifecycle_query.py`：GET /sessions/:id/lifecycle（从 audit log 读取 transitions 链）
- `tests/modules/session_lifecycle/test_heartbeat.py`：含 3 条 heartbeat invariant + 终态 session 的心跳响应

行数 ~340。

#### B26.4 cleanup_stale_sessions cron + daily_expire cron + admin 端点 + session 集成 hook

文件：
- `cron/session_cleanup_cron.py`：
  - Stage 1: IN_PROGRESS 心跳超时 30min → PAUSED（**SQL where 加 `exam_mode = false`**，Session-LC-MockExam-Heartbeat-Bypass invariant）
  - Stage 2: PAUSED 24h → ABANDONED
  - Stage 3: DRAFT 2h → ABANDONED
- `cron/daily_session_expire_cron.py`：每日 23:55，仅 source_mode=daily 转 EXPIRED（Session-LC-Daily-Expire-Type invariant）
- `modules/session_lifecycle/interface/admin_routes.py`：force-abandon / force-submit
- `modules/session/application/commit_answer.py` 与 `submit.py` 增量 hook：调 state_machine 校验 + DRAFT/PAUSED → IN_PROGRESS 隐式转换
- `tests/cron/test_session_cleanup.py` + `test_daily_expire.py`：含 Cleanup-Idempotent invariant + MockExam-Heartbeat-Bypass

行数 ~240。

**估算**：1,300 行 / 4 PR
**依赖**：B11（PracticeSessionV2 表已建）+ Phase-Home audit / cron 框架
**验收**：
- 12 条 Session-LC-* invariant test 0 失败
- evaluate_transition truth table 100% 覆盖
- mock_exam session 不被心跳超时转 PAUSED（B27 集成测试时验证）
- terminal 状态 trigger 拦截 UPDATE 测试通过
- multi-device last-writer-wins 场景测试

---

## 21. WU-B27 · mock_exam 模块（新建）

**目标**：在 session_lifecycle 之上叠加模考维度（exam_mode + 倒计时 + 自动提交 + 强制约束），覆盖 [13-Mock-Exam](./13-Mock-Exam.md) 全部规格。

### 21.1 端点（详见 13 §3）

```
POST /api/v2/practice/mock-exams
GET  /api/v2/practice/sessions/:id/countdown
GET  /api/v2/practice/mock-exams/history?period=&paper_code=
GET  /api/v2/practice/mock-exams/:session_id/comparison
```

### 21.2 PR 拆分

#### B27.1 mock_exam 字段 alembic + DB CHECK + auto_submit_at trigger

文件：
- `db/models_v2.py`：PracticeSessionV2 mock_exam 字段（exam_mode / time_limit_minutes / auto_submit_at / allow_review_during / allow_pause / delayed_review_until）
- `migrations/versions/xxx_session_mock_exam.py`：4 条 CHECK（02 §5.4：requires_time_limit / requires_full_set / requires_paper_source / time_limit_range）+ auto_submit_at trigger（02 §5.3）+ (exam_mode, status, auto_submit_at) 部分索引
- `tests/db/test_session_mock_exam_constraints.py`：4 条 CHECK 各一个负面测试 + auto_submit_at immutable 测试

行数 ~280。

#### B27.2 模块骨架 + create + start hook + countdown

文件：
- `modules/mock_exam/__init__.py` + `domain/types.py` + `domain/errors.py`
- `modules/mock_exam/application/service.py`：`create_mock_exam(paper_code, time_limit_minutes, delayed_review_minutes, idempotency_key)`
  - 校验 paper 题数 ≥ MOCK_MIN_QUESTIONS（PAPER_NOT_MOCK_ELIGIBLE）
  - time_limit_minutes 默认值（行测 120 / 申论 180，按 paper.type 判断）
  - 调 session.create(as_draft=true, exam_mode=true, ...)
- `modules/mock_exam/application/countdown.py`：GET /sessions/:id/countdown（13 §3.3）
- `modules/session_lifecycle/application/start_endpoint.py` 增量 hook：DRAFT → IN_PROGRESS 时若 exam_mode=true 计算 auto_submit_at = now + time_limit_minutes
- `modules/mock_exam/interface/routes.py` + `schemas.py`：含 MockExamCreateRequestV2 / MockExamCountdownResponseV2
- `tests/modules/mock_exam/test_create_and_start.py`：含 MockExam-Schema-Coupling / Time-Limit-Range / AutoSubmit-Immutable invariant

行数 ~320。

#### B27.3 enforcer + auto_submitter + cron

文件：
- `modules/mock_exam/application/enforcer.py`：
  - `assert_can_pause(session)` → MOCK_PAUSE_FORBIDDEN
  - `assert_can_create_question_note(session)` → MOCK_NOTES_FORBIDDEN
  - `assert_can_view_solution(session, now)` → DELAYED_REVIEW_LOCKED
- 这些 assertion 由 session_lifecycle.pause / notes.create_question_linked / session.view-solution 三个端点显式调用
- `modules/mock_exam/application/auto_submitter.py`：force_submit_mock_exam(session_id, reason)（13 §5.3 伪码）
- `cron/mock_exam_auto_submit_cron.py`：每分钟扫描 `exam_mode=true ∧ status ∈ (in_progress, paused) ∧ auto_submit_at <= NOW()` → 调 auto_submitter
- `tests/modules/mock_exam/test_enforcer.py` + `test_auto_submitter.py`：含 Force-Submit-On-Timeout / No-Pause-By-Default / No-Heartbeat-Pause / Notes-Forbidden / Delayed-Review / Closed-Book-Strict / Force-Submit-Audit invariant
- `tests/cron/test_mock_exam_auto_submit.py`：cron 兜底场景（前端崩溃时 60s 内必 force_submit）

行数 ~360。

#### B27.4 history + comparison + 与 timing/essay 集成

文件：
- `modules/mock_exam/application/history.py`：含 best_session_id / improvement_trend（最近 5 vs 之前 5）
- `modules/mock_exam/application/comparison.py`：self_history（同 paper_code 最多 5 条）+ paper_baseline（Stage 1 返回空对象，Stage 2 启用）
- `modules/mock_exam/interface/routes.py` 追加：history / comparison 端点
- `tests/modules/mock_exam/test_history.py` + `test_comparison.py`：含 Submit-Includes-Unanswered invariant（force_submit 时未答的 selected_answer=null + is_correct=false）

行数 ~240。

**估算**：1,200 行 / 4 PR
**依赖**：B11 / B26（state_machine + transition_to）
**验收**：
- 12 条 MockExam-* invariant test 0 失败
- 前端归零后 ≤1s 触发 submit；cron 兜底 ≤ 60s 必 force_submit
- 心跳超时不进 PAUSED（与 B26 cleanup cron 联调）
- 申论模考默认 180min；行测默认 120min（`scripts/seed_paper.py` 中 paper.recommended_time_limit 字段提供，B14 增量）

---

## 22. WU-B28 · practice_preferences 模块（新建）

**目标**：用户练习偏好独立表 + GET/PUT/PATCH/RESET 端点 + lazy upgrade，覆盖 [14-Practice-Preferences](./14-Practice-Preferences.md) 全部规格。

### 22.1 端点（详见 14 §4）

```
GET    /api/v2/profile/practice-preferences
PUT    /api/v2/profile/practice-preferences
PATCH  /api/v2/profile/practice-preferences
POST   /api/v2/profile/practice-preferences/reset
```

### 22.2 PR 拆分

#### B28.1 模型 + alembic + defaults + Pydantic schema v1

文件：
- `db/models_v2.py`：UserPracticePreferencesV2（02 §3.9）
- `migrations/versions/xxx_user_pref.py`
- `db/schemas_v2.py`：PracticePreferencesPayloadV1 + 6 个子结构（UiPreferences / PacingPreferences / AutoSavePreferences / KeyboardPreferences / ReminderPreferences / CustomPracticeDefaults）+ KeyBindings 类（14 §3.1）
- `modules/practice_preferences/__init__.py` + `domain/types.py`
- `modules/practice_preferences/application/defaults.py`：纯函数 `build_default_preferences()`（Pref-Default-Idempotent invariant）
- `tests/db/test_user_pref.py` + `tests/modules/practice_preferences/test_defaults.py`

行数 ~300。

#### B28.2 validators + service.get/put + LRU 缓存

文件：
- `modules/practice_preferences/application/validators.py`：Pydantic field validator（interval_seconds 范围 / time_format / KeyBindings 唯一 root_validator）
- `modules/practice_preferences/application/service.py`：
  - `get_preferences(user_id)`：DB 命中 → upgrader → return；未命中 → return defaults + isDefault=true
  - `put_preferences(user_id, schema_version, payload)`：schema 校验 + 全字段校验 + 写入 + 缓存失效
  - `_lru_cache`（cachetools，TTL=60s，key=user_id）+ invalidate_cache(user_id)
- `modules/practice_preferences/interface/routes.py` + `schemas.py`：GET / PUT
- `tests/modules/practice_preferences/test_get_put.py`：含 Pref-User-Scope / Schema-Version-Strict / Field-Range / KeyBinding-Unique invariant

行数 ~300。

#### B28.3 patch + reset + upgrader + audit

文件：
- `modules/practice_preferences/application/patch.py`：read → merge → 全量校验 → 写入（Pref-PATCH-Atomic invariant）
- `modules/practice_preferences/application/reset.py`：sections 可选 → 部分重置；调 audit
- `modules/practice_preferences/application/upgrader.py`：
  - 初始版本 v1，无升级路径
  - 但建立 `upgrade(payload, from_version, to_version)` 框架，预留 v2 时使用
  - lazy upgrade：read 时升级 payload 不写库
- `modules/practice_preferences/interface/routes.py` 追加 PATCH / RESET
- AUDIT_TRACKED_PATHS 白名单：仅 schema_version / theme_preference / keyboard.bindings.* 写 audit（Pref-No-Audit-High-Frequency invariant）
- `tests/modules/practice_preferences/test_patch_reset.py`：含 PATCH-Atomic / Reset-Audit / Lazy-Upgrade / No-Audit-High-Frequency invariant
- `tests/modules/practice_preferences/test_cache.py`：Cache-Invalidate-On-Write

行数 ~200。

**估算**：800 行 / 3 PR
**依赖**：Phase-Home 用户体系 / 限流 / audit 框架
**验收**：
- 10 条 Pref-* invariant test 0 失败
- LRU 缓存命中率（dev fixture，10 用户每用户 GET 5 次）≥ 70%
- KeyBindings 唯一性 root_validator 在 11 个绑定的 happy path + 多种冲突 case 全覆盖
- schema upgrader 框架对 v1 + 模拟 v2 升级路径有单测（即使本 Phase 不实施 v2，框架可工作）

---

## 23. WU-B29 · question_metadata schema 预留（仅 schema）

**目标**：把题目元数据预留字段 + 知识点两张表落地，但**不**实现端点 / cron / LLM 标注（Phase 2 落地），覆盖 [15-Question-Metadata](./15-Question-Metadata.md) Phase 1 范围。

### 23.1 PR 拆分

#### B29.1 QuestionV2 元数据字段 + CHECK 约束 + Pydantic preview

文件：
- `db/models_v2.py`：QuestionV2 加 5 字段（ability_dimensions / discrimination_index / heat_score / complexity_level / knowledge_tags）
- `migrations/versions/xxx_question_meta_p1_fields.py`：字段 + 3 条 CHECK（02 §5.7）+ heat_score 索引
- `db/schemas_v2.py`：QuestionMetadataPreviewV2（15 §4.2）+ 在 QuestionEnvelopeV2 加 `metadata_preview: QuestionMetadataPreviewV2 | None`（Phase 1 始终 None）
- 数据回填：现有题 ability_dimensions=[] / discrimination_index=NULL / heat_score=0.0 / complexity_level=NULL / knowledge_tags=[]
- `tests/db/test_question_meta_phase1_fields.py`：3 条 CHECK 的 invariant test（QMeta-AbilityDim-Enum / Complexity-Range / Heat-NonNegative）+ knowledge_tags 蛇形 lint

行数 ~220。

#### B29.2 KnowledgePointV2 + QuestionKnowledgePointV2 表 + service-layer hidden

文件：
- `db/models_v2.py`：两张表 + `__phase__ = "phase_2"` marker
- `migrations/versions/xxx_question_meta_p1_tables.py`：含 UNIQUE 约束
- `modules/question_metadata/__init__.py`：**仅注释 + marker，不导出任何 service**（QMeta-Phase1-Service-Hidden invariant）
- `services/api/spec/openapi.json`：Phase 2 端点占位标 `x-phase: 2`（QMeta-Phase1-No-Endpoint invariant）
- `tests/modules/question_metadata/test_phase1_empty.py`：含 QMeta-Phase1-Empty / No-Endpoint / Service-Hidden / Field-Default-Backfill invariant
- `tests/spec/test_phase_marker.py`：x-phase=2 marker 不被前端 codegen 拉取

行数 ~180。

**估算**：400 行 / 2 PR
**依赖**：B10
**验收**：
- 9 条 QMeta-* invariant test 0 失败
- 两张新表 alembic upgrade 后必为空
- service 层尝试 import KnowledgePointService 失败（被 lint 检查捕获）
- OpenAPI 不暴露任何 /knowledge-points 端点

---

## 24. WU-B30 · question_report 模块（新建）

**目标**：题目内容纠错（用户提交 + admin 闭环处理 + 与 AI 题自动下线挂钩），覆盖 [02-Data-Model §3.12](./02-Data-Model.md#312-questionreportv2) + [01-Boundary-Rules §17](./01-Boundary-Rules.md#17-题目纠错边界pr-report-)。

### 24.1 端点（详见 01 §17.2）

```
POST   /api/v2/practice/questions/:qid/reports
GET    /api/v2/practice/questions/:qid/reports
PATCH  /api/v2/practice/reports/:rid
DELETE /api/v2/practice/reports/:rid

GET    /api/v2/admin/practice/reports?status=&category=&question_id=
PATCH  /api/v2/admin/practice/reports/:rid
POST   /api/v2/admin/practice/reports/:rid/apply-fix
```

### 24.2 PR 拆分

#### B30.1 模型 + alembic + 用户端点 CRUD

文件：
- `db/models_v2.py`：QuestionReportV2 + 5 个枚举（QuestionReportCategory / QuestionReportStatus）
- `migrations/versions/xxx_question_report.py`：表 + 4 条 CHECK（02 §5.8：description_length / resolved_requires_admin / fix_only_when_fixed / dup_only_when_duplicate）+ 终态不可变 trigger（02 §5.9）+ 活跃 report 部分唯一索引
- `db/schemas_v2.py`：QuestionReportCreateRequestV2 / QuestionReportEnvelopeV2 / QuestionReportListResponseV2
- `modules/question_reports/__init__.py` + `domain/types.py` + `domain/errors.py`
- `modules/question_reports/application/service.py`：
  - `create_report(user, qid, category, description, source_session_id?, selected_answer_at_report?)`：先查活跃 report 命中 409 REPORT_DUPLICATE_PENDING（PR-Report-Active-Unique）
  - `list_user_reports(user, qid?)` / `update_pending(rid, description)` / `soft_delete_pending(rid)`
- `modules/question_reports/interface/routes.py`：用户 4 个端点
- `tests/modules/question_reports/test_user_crud.py`：含 PR-Report-Active-Unique / Description-Length / Owner-Read invariant + 限流（每用户每日 ≤ 20 reports）

行数 ~300。

#### B30.2 admin 端点 + apply_fix + 与 AI 题下线 hook

文件：
- `modules/question_reports/application/admin_service.py`：
  - `list_reports(filter, paging)`
  - `update_status(rid, new_status, admin_response)`：状态机 enforce（pending → acknowledged → resolved_*；允许直接转 resolved_*）
  - `apply_fix(rid, applied_fix)`：事务内同时更新 QuestionV2 字段 + report.status=resolved_fixed + 同写两条 audit（PR-Report-Fix-Audit-Question-Mutation invariant）
  - `mark_duplicate(rid, duplicate_of_report_id)`：校验 duplicate_of 存在性
- `modules/question_reports/interface/admin_routes.py`：admin 3 个端点（assert_admin guard）
- `cron/ai_cleanup_cron.py`（B23.1 已建）增量 hook `compute_ai_question_quality`：
  - 从 QuestionReportV2 聚合 status ∈ (pending, acknowledged) 的活跃报告数 → QuestionV2.report_count
  - **仅对 source ∈ (ai_generated, ai_modified)** 应用 PR4 阈值（report_count ≥ 5 → is_active=false）
  - source=real_exam 仅累积 metric 不下线（PR-Report-Real-Exam-No-AutoDeactivate invariant）
- `tests/modules/question_reports/test_admin.py`：含 PR-Report-Resolved-Requires-Admin / Terminal-Immutable / Fix-Only-When-Fixed / Dup-Only-When-Duplicate / Audit-Required / Real-Exam-No-AutoDeactivate / AutoDeactivate (AI 题阈值触发)
- `tests/cron/test_ai_cleanup_with_reports.py`：与 B23.1 联合测试

行数 ~300。

**估算**：600 行 / 2 PR
**依赖**：B10（QuestionV2 表）+ B23.1 cron（compute_ai_question_quality 已建，B30.2 加 hook 即可）
**验收**：
- 10 条 PR-Report-* invariant test 0 失败
- admin 在事务中 resolve_fixed + 应用 question 修改时双 audit 写入
- AI 题 report_count 阈值触发 is_active=false（与 B23.1 cron 联合 e2e）
- 真题 report 不触发下线（仅 admin 后台展示风险标记）
- 限流（每用户 20 req/day）端到端测试

---

## 25. 引用矩阵

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
| **B30** | **真题纠错（00-Decisions §11.1 范围内）** | **§17 PR-Report-* (13 条)** | **§3.12 / §5.8-§5.9** | **§3.10 question-report invariant + §6 e2e + admin** |

---

## 26. 与 Phase-Home WU 的依赖图（详）

```
Phase-Home:
  WU-B1 (DB schema 基础)  ─────────→ Tab 2 WU-B10 / B11 (扩展 Question/Session/Note/Review)
  WU-B7 (modules/llm/ 框架) ─────────→ Tab 2 WU-B22 (在同一模块内追加 3 能力)
  WU-B8 (cron 框架)         ─────────→ Tab 2 WU-B23 (注册 8 新 cron + 1 hook)
  WU-B9 (OpenAPI 锁定)      ─────────→ Tab 2 WU-F9 (前端 types 重生成)
  Phase-Home 用户体系       ─────────→ Tab 2 WU-B28 (UserPracticePreferencesV2 ondelete=CASCADE)

Tab 2 内部（核心闭环）:
  WU-B10 ─→ B14 / B15 / B17 / B18 / B21 / B29 / B30
  WU-B11 ─→ B15 / B16 / B17 / B20 / B25 / B26 / B27
  WU-B12 ─→ B15 / B16 / B17 / B18 / B19
  WU-B13 ─→ B20
  WU-B22 ─→ B18 (LLM question_generator) / B20 (LLM essay_grader / reference_answer_generator)

Tab 2 内部（B25-B30 新模块依赖）:
  WU-B25 (timing) ───────────────→ session.submit hook（compute_session_timing_summary）
                                ↑
  WU-B26 (session_lifecycle) ────┤
   ├── 提供 evaluate_transition / transition_to → B15 commit_answer / submit
   ├── pause / resume 端点 ────────────────────────→ 客户端
   ├── cleanup_stale_sessions cron ─→ 排除 exam_mode=true（依赖 B27 字段）
   └── heartbeat（受 B27 影响：mock_exam 不被超时转 PAUSED）

  WU-B27 (mock_exam) ────────────→ 依赖 B26 state_machine + B11 字段
   ├── start hook 写入 auto_submit_at（B26 提供 start 端点）
   ├── enforcer 在 B15 view-solution / B26 pause / B11 notes 三处被调用
   └── auto_submitter cron → B26 force_submit_mock_exam

  WU-B28 (preferences) ──────────→ 独立模块，无强依赖
   └── B27 mock_exam create / B19 daily_practice 读偏好作为默认值

  WU-B29 (question_metadata) ────→ 仅 schema，依赖 B10
   └── Phase 2 才被消费

  WU-B30 (question_report) ──────→ 依赖 B10 + B23.1
   └── compute_ai_question_quality cron 增量 hook → 同步 QuestionV2.report_count

集成点:
  WU-B14 ~ B22 ─→ WU-B23 (cron 扩展)
  WU-B23 增量 hook ←─ WU-B25 baseline cron / WU-B26 cleanup+expire cron / WU-B27 auto_submit cron / WU-B30 ai_cleanup hook
  WU-B23 ─→ WU-B24 (e2e + OpenAPI)
  WU-B24 ─→ B25-B30 各自的模块 e2e（B25/B26/B27 各 1 个 e2e；B28 contract test；B29 schema-only invariant；B30 admin e2e）
```

⚠️ **强约束**：
- B22 必须在 Phase-Home WU-B7 完工后启动；B18 和 B20 依赖 B22 才能跑真实流程
- **B27 必须在 B26 之后**（mock_exam start hook 使用 lifecycle state_machine）
- **B25 / B26 / B27 / B28 之间互不阻塞**（除 B27 ⟸ B26）；可与 B14-B22 并行
- **B30.2 需要 B23.1 已建** compute_ai_question_quality cron 框架后再加 hook
