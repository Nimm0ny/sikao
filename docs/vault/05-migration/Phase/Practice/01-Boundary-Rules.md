# Phase-Practice · 01 · Boundary Rules

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

本文是 Tab 2 的题源 / 答题 / 实绩 / 题级笔记 / 申论批改 之间的边界规则 SSOT。所有后端服务、LLM prompt、前端 UI 必须遵守。

继承自 Phase-Home 的 P1-P6 在本文末尾再次列出。

---

## 1. 题源边界（PR1-PR4）

### PR1 真题 / AI 题等价对待

- 同一张 `QuestionV2` 表，所有下游（错题 / 收藏 / 笔记 / 复盘 / 统计）天然兼容。
- 用户答题、收藏、加笔记、做错题复盘时**完全感知不到题源差异**。
- UI 层可以选择性显示"AI 题"标签（小 chip），但不影响数据流。

**禁忌**：不得在任何 service 层 / query 层做 `if source == 'real_exam'` 的分支处理（除了「出题选取」算法本身）。

### PR2 source 字段是 immutable

- 一旦 QuestionV2 写入 `source ∈ {real_exam, ai_generated, ai_modified}`，**永远不可变更**。
- DB 层用 `ImmutableMixin` 或 trigger 拦截 UPDATE source 操作（建议 trigger）。
- 用户反馈无论多负面，最多 `is_active=false` 下线，不会改 source。

### PR3 AI 题生成失败 ≠ 用户失败

- LLM 实时生成失败时返回 503 + `LLM_SERVICE_UNAVAILABLE`，前端必须引导用户切换到"真题"模式重试，**不阻塞用户练习**。
- 失败原因写入 `AiGeneratedQuestionRequestV2.error_message`（审计用）。
- 失败后用户可立即重试（每用户每日限流 N 次仍生效，不放宽）。

### PR4 已下线 AI 题不再出现在新出题中

- `is_active=false` 的题：
  - 不再出现在 AI 出题池（B18 算法 query 时过滤）
  - 不再出现在自定义刷题筛选结果中（B15.2）
  - 但**保留在用户答题历史**（PracticeSessionAnswerV2 的 question_id 不变）
  - 用户复盘错题时仍可看到（review tab）
  - 用户收藏的题不会消失（QuestionFavoriteV2.question_id 仍指向）

下线条件（cron `cleanup_low_quality_ai_questions` 每日 04:30 计算）：
- `quality_score < MIN_QUALITY`（默认 2.5/5.0）
- 或 `report_count > MAX_REPORTS`（默认 5）
- 或 `ai_self_audit_passed = false`（生成时未通过自审，永远不上线）

---

## 2. 答题节奏边界（Pace 系列）

### Pace-Closed-Book 整组模式严格闭卷（D-Q15）

| 行为 | 逐题模式 | 整组模式 |
|---|---|---|
| 答完一题立即看答案 | ✅ | ❌ |
| 答完后看解析 | ✅ | ❌ |
| 标记不确定后看解析 | ✅ | ❌ |
| 已答题回看自己的答案 | ✅ | ✅ |
| 已答题回看正确答案 | ✅ | ❌ |
| 中途加笔记 | ✅ | ✅（笔记界面不显示答案） |
| 中途收藏 | ✅ | ✅ |
| 中途暂停 | ✅ | ✅ |
| 全部答完后看解析 | N/A | ✅（解锁） |

**前端校验**：
- UI 层在 `session.practice_mode = full_set` 时不渲染"看解析"按钮
- 笔记界面渲染时检查 mode：full_set 时不显示题目正确答案与解析
- DevTools 绕过前端 UI 仍受后端校验保护

**后端校验**（关键）：
- `POST /sessions/:id/answers/:answer_id/view-solution` 端点严格校验：
  ```python
  if session.practice_mode == 'full_set' and session.status != 'submitted':
      raise ForbiddenError(code='STRICT_CLOSED_BOOK', http=403)
  ```
- 整组模式 session 在 status=submitted 之前，**任何泄漏正确答案的端点**都拒绝（含解析、范文等）
- session.create 时 config_snapshot 写入 practice_mode，后续不可改

### Pace-Linkage 答题节奏与 session.create

- 由调用方在 `POST /api/v2/practice/sessions` 时通过 `practice_mode` 参数显式指定
- 不指定时默认 `full_set`（与 Cust-Pace 默认一致）
- 一旦 session 创建，practice_mode 不可变

### Pace-Audit 节奏切换审计

- 用户从自定义对话框切换节奏时（创建 session 前）属于本地配置变更，无需审计
- 已创建 session 不存在节奏切换（不可变）
- 任何尝试通过 PATCH 修改 session.practice_mode 的请求 → `IMMUTABLE_FIELD` 422 拒绝

---

## 3. 实绩与题源（继承 Phase-Home P2/P3）

### Stat-Source-Independence 进度数据完全独立于 source

- ProgressSnapshot / WeaknessSnapshot 写入器**绝不区分** source 是 real_exam 还是 ai_generated。
- 用户答 AI 题正确率 80% 与答真题正确率 80% 在 stats 中完全等价。
- **理由**：避免给用户造成"AI 题不算数"或"真题不算数"的认知割裂。

### Stat-Plan-Independence 进度数据完全独立于 PlanEventV2.status（继承 Phase-Home P2/P3）

- 重申：Practice stats 模块写入器只读 PracticeSessionV2 + Answer + Essay 三类表，**永远不读** PlanEventV2.status。

---

## 4. 申论批改异步流程（PR8）

### PR8 申论批改异步契约（D-Q16）

```
用户提交申论答案
  ↓
立即创建 EssaySubmissionV2 记录（status=pending_grading）
  ↓
立即返回 result 页（无评分，显示"AI 批改中..."）
  ↓
后台任务：调 LLM essay_grader → 写入 EssayReportV2
  ↓
完成时间：约 30-60s
  ↓
完成后：
  - EssaySubmissionV2.status → graded
  - 用户回到 result 页时通过 GET /grading-status 拉到完整数据
  - 前端展示批改详情
```

**前端契约**：
- result 页设计两种状态：`pending_grading`（loading 占位 + 轮询）/ `graded`（完整批改详情）
- 轮询间隔：3s / 5s / 10s 指数退避，30s 后停止轮询提示用户"批改时间较长，刷新页面查看"
- 失败时（status=failed）展示重试按钮

**后端契约**（CLP-1 修订）：
- 默认用户路径：`POST /sessions/:id/submit` → session.submit hook 内**隐式调** `essay_grading.submit_hook.on_session_submit_essay(submission_id)` 启动 background task → background task 写 EssayReportV2 → status 转 graded（详见 [03-Backend-WU §15.2 B23.4](./03-Backend-WU.md#152-pr-拆分)）
- `POST /api/v2/practice/essay/submissions/:id/grade` 端点**不参与默认路径**，仅用于：(a) 上次批改 status=failed 的失败重试 (b) admin 重新批改 (c) reference 缺失时单独补生成
- 同一 submission 重复触发：第二次起返回当前 status（不重复批改），除非 status=failed 才允许重试
- 批改后台任务通过 LlmCallV2 完整记录（含成本、token 数）
- **顺序约束**：B23.4 hook 内必须先 `archive_draft_on_submit` 再 `on_session_submit_essay`，否则 grade 启动时 EssaySubmissionV2.essay_text 为空（详见 03-Backend-WU §15.2 invariant 注）

### Essay-Reference 范文展示与反馈

- 用户提交后如该题没有 `EssayReferenceAnswerV2`，**自动异步生成一份**（source=ai_generated, status=draft）
- AI 自审通过后 status=public（可见）；自审不通过 status=archived（不可见，但记录）
- 用户对范文可点赞 / 收藏 / 举报，写入 `EssayReferenceFeedbackV2`
- cron `compute_reference_quality` 每日 05:00 重算 quality_score（综合 likes / favorites / reports）
- 高质量 AI 范文（点赞 ≥ 阈值，且 report_count < 阈值）持续保留
- 低质量自动 archived

---

## 5. 题级笔记联动（Note 系列）

### Note-Visibility 题级笔记可见性

- 仅创建者（D-Q17）。
- 数据库层：所有读 NoteV2 时必须 join `WHERE user_id = current_user`，违反 = 越权 bug。
- 答题界面读"该题相关笔记"：仅当前用户的。

### Note-Cross-Tab 跨 tab 联动规则

| 场景 | 行为 |
|---|---|
| 答题界面"加笔记" | 创建 NoteV2(linked_question_id=current_question, user_id, visibility=private) |
| 一题对应多条笔记 | 允许（同一用户对同一题可多条笔记） |
| Tab 4 笔记列表 | 默认显示全部，可切换 filter（独立笔记 / 题级笔记） |
| Tab 4 列表点击题级笔记 | 跳转 `/practice/questions/:id`（题目详情页），不进入 session |
| 题目详情页 | 显示题面 + 该用户对此题的所有笔记 + 编辑 / 删除按钮 |
| 答题界面"该题相关笔记" | 列出当前用户对此题的所有 NoteV2，可编辑 / 删除（编辑后立即生效在两端） |
| 删除题级笔记 | 软删除（NoteV2.deleted_at），Tab 4 默认 filter 掉，30 天后物理清理 |

### Note-Question-Page `/practice/questions/:id` 详情页

- 不在 Tab 2 主 view 内，是独立路由（脱壳），跳转后保留返回 Tab 4 / 答题页的能力
- 包含：题面 + 该用户笔记 + 该用户答题历史 + 收藏/标记按钮 + "去做这题"按钮（=单题 session）

---

## 6. 收藏 / 标记边界（Fav / Flag 系列）

### Fav-User-Scope 收藏只对自己生效

- QuestionFavoriteV2 用 `(user_id, question_id) UNIQUE` 约束
- 不同用户对同一题的收藏互不影响

### Flag-Basic-vs-Persistent 两层标记的关系

```
答题中标记不确定（前端按钮）
  ↓
立即写入 PracticeSessionAnswerV2.flagged = true（基础层，本次 session 内）
  ↓
session.submit 时检查所有 flagged answers
  ↓
对每个 flagged answer 同步写入 QuestionFlagV2(user_id, question_id, reason='uncertain')（持久层）
  ↓
同步写入 ReviewItemV2(user_id, question_id, reason='flagged_persistent')（自动入复盘队列）
```

**关键点**：
- 基础层与持久层**不同步**——session 进行中只写基础层，submit 时才落到持久层
- 用户在 session 中切换 flagged 状态（标记 / 取消标记）只动基础层
- session 中途意外退出（如关闭浏览器），未 submit 的 flagged 不进持久层（属正常行为）

### Flag-Resolve 解决标记

- 用户在题目详情页 / Tab 3 复盘队列点"已掌握"按钮 → `PATCH /flags/:id/resolve` 设 `resolved_at`
- ReviewItemV2 同步标记 reviewed_at
- 已 resolved 的 flag 不再出现在 review 队列，但保留历史记录

### Flag-Unique 同一题同一用户

- QuestionFlagV2 UNIQUE (user_id, question_id) WHERE resolved_at IS NULL
- 用户重复标记同一题：service 层升级（更新 reason 或刷新 created_at），不创建新行
- 用户 resolve 后再次标记：创建新行（旧的 resolved_at 不变）

---

## 7. AI 出题三段退化的契约（PR-AI-G）

详见 [07-AI-Question-Engine](./07-AI-Question-Engine.md)。本节列约束。

| 约束 | 描述 |
|---|---|
| 端到端契约 | 用户拿到 N 题（即 config.count），要么完整 N 题，要么明确报错；不允许返回 < N 的部分结果 |
| 池子优先 | 第一二步从 QuestionV2 表取，不调 LLM（成本控制） |
| LLM 调用边界 | 仅在第三步触发，且必须经过 self-audit；audit 失败不入池 |
| 入库时机 | 实时生成的题在 self-audit 通过后**立即入库 + 用于本次 session**（同一事务） |
| 限流隔离 | 用户限流（每日 N 次实时生成）只针对第三步；池子查询不受限流 |
| 配额降级 | 用户达到限流时，第二步如果有题就用第二步结果，否则报错（不降级到无配额生成） |
| 幂等保护 | `Idempotency-Key` 命中时返回上次的 question_ids，不重复消耗用户配额 |

---

## 8. 继承自 Phase-Home 的 P1-P6

完整定义见 [Phase/Home/01-Boundary-Rules.md](../Home/01-Boundary-Rules.md)。Practice 必须遵守：

| # | 规则 | Practice 中的体现 |
|---|---|---|
| **P1** | 学习计划 = 目标 + 路径建议 | session.linked_plan_event_id 表示路径绑定，但 stats 不依赖此字段 |
| **P2** | 实绩层独立于计划层 | 所有 PracticeSessionV2 都贡献进度，无论是否绑定计划事件 |
| **P3** | PlanEventV2.status 只表达事件本身 | Practice stats 不读 PlanEventV2.status |
| **P4** | 用户额外练习自动落入日历视图 | unlinked session 在首页日历显示为"实绩块"（首页 Section A 处理） |
| **P5** | AI 推荐基于实绩 + 目标 + 实时状态 | session.submit 后实时通知首页推荐器（hook） |
| **P6** | 任何"改计划"行为需审计 | session-related 操作不算"改计划"，但 plan-linked session 的 done/skipped 通过 plan event status 同步反映 |

---

## 9. 推荐策略阈值表

继承自 Phase-Home [01-Boundary-Rules §2](../Home/01-Boundary-Rules.md#2-推荐策略阈值表-infra-rec-policy)。Practice 不重复定义。

---

## 10. 边界规则速查（One-pager）

```
PR1  真题 / AI 题等价对待（同表 + source 字段）
PR2  source 字段 immutable
PR3  AI 题生成失败 ≠ 用户失败（503 + 引导切真题）
PR4  已下线 AI 题不出现在新出题中，但已答题用户能复盘
Pace-Closed-Book 整组模式严格闭卷（前后端双校验）
Stat-Source-Independence 进度数据不区分 source
Stat-Plan-Independence 进度数据不读 PlanEventV2.status
PR8  申论批改异步（submit 立即返回 pending → cron 写 Report → 用户轮询拿到）
Note-Visibility 题级笔记仅创建者可见
Flag-Basic-vs-Persistent 答题中只动基础层；submit 时才落持久层 + 入复盘
PR-AI-G  AI 出题三段退化端到端契约：要么 N 题完整，要么明确报错

==== 新增模块（B25-B30）====

Timing-Monotonic              事件 ts 单调递增（22 拒绝乱序）
Timing-Bounded-Per-Visit      单次 enter→leave ≤60s（超出截断）
Timing-Sum-Lte-Wall           total_active_seconds ≤ wall clock
Timing-Active+Pause-Lte-Wall  active+paused ≤ wall clock + 5s 容差
Timing-Overtime-Has-Baseline  is_overtime=true 必有 sample_size>=30 baseline
Timing-No-Stale-Event         拒绝早于 last_modified - 60s 的事件
Timing-Status-Writable        仅 status∈{in_progress, paused} 可写

Session-LC-Status-Closed      所有转换走 evaluate_transition 函数
Session-LC-Terminal-Immutable submitted/abandoned/expired 不可改
Session-LC-Resume-Adds-Pause  resume 必须累加 (now-paused_at) 到 paused_total
Session-LC-Pause-Single-Active paused_at 非空 ⟺ status=paused
Session-LC-Heartbeat-No-Term  心跳到达终态仅返回状态不写库
Session-LC-Force-Submit-Audit force_submitted=true 必有 audit + reason
Session-LC-Daily-Expire-Type  EXPIRED 仅 source_mode=daily
Session-LC-Draft-No-Answers   DRAFT 不应有 selected_answer 非空
Session-LC-Recovery-Chain     recovered_from 必须指向 abandoned 行

MockExam-Schema-Coupling      exam_mode=true ⟹ time_limit ∧ full_set ∧ paper
MockExam-AutoSubmit-Immutable auto_submit_at 一旦写入不可改
MockExam-No-Pause-By-Default  默认 allow_pause=false
MockExam-No-Heartbeat-Pause   exam_mode session 不被心跳超时转 PAUSED
MockExam-Force-Submit-Timeout 倒计时归零必 force_submit（前端立即/cron 兜底）
MockExam-Closed-Book-Strict   提交前所有看答案端点拒绝
MockExam-Delayed-Review       delayed_review_until 内提交后看解析仍 403
MockExam-Notes-Forbidden      模考期间题级笔记端点 422 拒绝
MockExam-Force-Submit-Audit   force_submitted=true 必有 audit
MockExam-Time-Limit-Range     [10, 360] minutes

Pref-Schema-Version-Strict    PUT 必须 schema_version 等于服务端最新
Pref-User-Scope               读写仅限当前 user_id
Pref-Field-Range              所有字段 Pydantic + custom validator 校验
Pref-KeyBinding-Unique        bindings 内 value 唯一
Pref-Default-Idempotent       多次 GET 返回的默认值必须一致
Pref-Reset-Audit              reset 必写 audit
Pref-Lazy-Upgrade             旧 schema 读时升级返回但不立即写 DB

QMeta-Phase1-Empty            Phase 1 KnowledgePoint/QKP 表为空
QMeta-Phase1-No-Endpoint      Phase 1 不暴露 endpoint
QMeta-Phase1-Service-Hidden   service 层不导出 CRUD
QMeta-Field-Default-Backfill  alembic upgrade 后必有默认值
QMeta-Lint-Tag-Format         knowledge_tags 元素 snake_case
QMeta-AbilityDim-Enum         元素 ∈ {comprehension/reasoning/calculation/memory/application}
QMeta-Complexity-Range        [1,5] ∪ {NULL}
QMeta-Heat-NonNegative        heat_score >= 0.0
```

---

## 11. Invariant 测试要求

详见 [10-Testing §3](./10-Testing.md#3-invariant-测试)。

每条上述边界规则都必须有对应的 invariant test。CI 上所有 invariant 测试必须 0 失败。

---

## 12. 时间维度边界（Timing-*）

详见 [11-Timing-Engine §7](./11-Timing-Engine.md#7-invariant关键)。

| 规则 | 描述 | 实施位置 |
|---|---|---|
| **Timing-Monotonic** | 事件 batch 内 ts 必须单调递增 | timing.event_recorder（端点入口校验） |
| **Timing-Bounded-Per-Visit** | 单次 question_enter → question_leave 区间 ≤ 60s；超出强制截断为 60s | timing.event_recorder + session.submit |
| **Timing-Sum-Lte-Wall** | session.total_active_seconds ≤ (completed_at - started_at).seconds | session.submit invariant |
| **Timing-Active-Plus-Pause-Lte-Wall** | total_active_seconds + paused_total_seconds ≤ wall_clock + 5s 容差 | session.submit invariant |
| **Timing-Overtime-Has-Baseline** | answer.is_overtime=true ⟹ baseline.sample_size >= MIN_SAMPLES | session.submit 计算时 |
| **Timing-No-Stale-Event** | 拒绝 event.ts < (answer.last_modified_at - 60s) 的事件 | timing.event_recorder（防回放攻击） |
| **Timing-Status-Writable** | timing 端点仅接受 session.status ∈ {in_progress, paused}；其他 → 409 SESSION_NOT_WRITABLE | timing.event_recorder |
| **Timing-Heartbeat-Channel** | heartbeat 事件由 timing 端点接收，但 session_pause/resume 必须走 lifecycle 端点（不走 timing 上报） | 端点路由分离 |
| **Timing-Baseline-Sample-Cutoff** | 计算 baseline 仅取最近 90 天 + time_spent_ms ∈ (0, 600_000) 的样本 | cron baseline_computer |
| **Timing-Stat-Excludes-Daily** | 时间分析端点 (stats/timing) 计算时排除 source_mode=daily 的 session（避免 5-10 题样本污染按 category 维度） | timing.analyzer 选项可调 |

---

## 13. session 生命周期边界（Session-LC-*）

详见 [12-Session-Lifecycle §10](./12-Session-Lifecycle.md#10-invariant)。

| 规则 | 描述 | 实施位置 |
|---|---|---|
| **Session-LC-Status-Closed** | 任何 status 转换必须经过 `evaluate_transition`；DB CHECK 限制枚举 | state_machine.py（纯函数） |
| **Session-LC-Terminal-Immutable** | SUBMITTED / ABANDONED / EXPIRED 不可再变（status / completed_at / abandoned_at） | DB trigger（详见 02-Data-Model §5.6） |
| **Session-LC-Terminal-Writes-Forbidden** | 终态 session 拒绝任何 mutation 端点（answer / pause / resume / discard）→ 422 IMMUTABLE_TERMINAL_STATE | session module + lifecycle module |
| **Session-LC-Resume-Adds-Pause-Time** | resume 时必须把 (now - paused_at) 累加到 paused_total_seconds，paused_at 清空 | pause_resume.py |
| **Session-LC-Pause-Single-Active** | paused_at 非空 ⟺ status=PAUSED；status=IN_PROGRESS 时 paused_at 必为 null | DB CHECK paused_at_status_consistency |
| **Session-LC-Heartbeat-No-Terminal** | 心跳到达终态 session：仅返回当前状态，不写 last_heartbeat_at | heartbeat.py |
| **Session-LC-Force-Submit-Audit** | force_submitted=true 必有 audit log + force_submitted_reason 非空 | DB CHECK force_submit_reason_required |
| **Session-LC-Daily-Expire-Type** | EXPIRED 状态仅可能出现在 source_mode=daily 的 session 上 | expire_daily_sessions cron + invariant test |
| **Session-LC-Draft-No-Answers** | DRAFT 状态的 session 不应有 PracticeSessionAnswerV2.selected_answer 非空 | session.commit_answer 写入前校验 |
| **Session-LC-Recovery-Chain** | recovered_from_session_id 指向的 session 必须 status=ABANDONED | application 层校验 |
| **Session-LC-MockExam-Heartbeat-Bypass** | exam_mode=true 时心跳超时不进 PAUSED（cleanup_stale_sessions 排除 exam_mode=true） | cleanup.py SQL 加 `AND exam_mode = false` |
| **Session-LC-Cleanup-Idempotent** | cron 多次运行同一 session 不应重复转换 status（按 status 过滤候选时已天然幂等） | cron 实现 |

---

## 14. 模考边界（MockExam-*）

详见 [13-Mock-Exam §8](./13-Mock-Exam.md#8-invariant)。

| 规则 | 描述 | 实施位置 |
|---|---|---|
| **MockExam-Schema-Coupling** | exam_mode=true ⟹ time_limit_minutes IS NOT NULL ∧ practice_mode='full_set' ∧ source_mode='paper' | DB CHECK（02-Data-Model §5.4） |
| **MockExam-AutoSubmit-Immutable** | auto_submit_at 一旦写入不可改 | DB trigger（02-Data-Model §5.3） |
| **MockExam-No-Pause-By-Default** | exam_mode=true ∧ allow_pause=false 时 pause 端点 422 拒绝 | session_lifecycle.pause |
| **MockExam-No-Heartbeat-Pause** | exam_mode=true 的 session 不会因心跳超时进 PAUSED | cleanup_stale_sessions cron 排除 |
| **MockExam-Force-Submit-On-Timeout** | now >= auto_submit_at ∧ status ∈ {in_progress, paused} → 必须 force_submit；最大延迟 60s（cron 周期） | mock_exam_auto_submit_cron + 前端立即触发 |
| **MockExam-Closed-Book-Strict** | 提交前所有看答案 / 看解析端点拒绝（继承 Pace-Closed-Book） | session.view-solution 端点 |
| **MockExam-Delayed-Review** | delayed_review_until 非空 ∧ now < delayed_review_until ∧ status=submitted → 看解析端点 403 DELAYED_REVIEW_LOCKED | session.view-solution 端点 |
| **MockExam-Notes-Forbidden** | exam_mode=true 时创建题级 NoteV2 端点 422 MOCK_NOTES_FORBIDDEN | notes.create_question_linked |
| **MockExam-Force-Submit-Audit** | force_submitted=true ∧ exam_mode=true → 必有 audit log + reason='mock_exam_timeout' | force_submit 函数 |
| **MockExam-Time-Limit-Range** | time_limit_minutes ∈ [10, 360] | DB CHECK |
| **MockExam-Paper-Eligibility** | 套卷题数 < N（默认 30）→ 不可作为 mock_exam（POST /mock-exams 422 PAPER_NOT_MOCK_ELIGIBLE） | mock_exam.service.create |
| **MockExam-Submit-Includes-Unanswered** | force_submit 时未答的题保留 selected_answer=null + is_correct=false（不视作"未提交" answer） | submit hook |

---

## 15. 用户偏好边界（Pref-*）

详见 [14-Practice-Preferences §8](./14-Practice-Preferences.md#8-invariant)。

| 规则 | 描述 | 实施位置 |
|---|---|---|
| **Pref-Schema-Version-Strict** | PUT 时客户端 schemaVersion 必须 = 服务端 CURRENT_VERSION，否则 422 SCHEMA_VERSION_MISMATCH | preferences.service.put |
| **Pref-User-Scope** | 所有读写仅限当前 user_id；其他用户 preferences 永远不可访问（404，不是 403） | service 层 assert_owner |
| **Pref-Field-Range** | 所有字段 Pydantic + custom validator 校验范围；任一字段失败整个 PUT 失败（不部分接受） | validators.py |
| **Pref-KeyBinding-Unique** | KeyBindings 内所有 value 必须唯一（防冲突） | KeyBindings root_validator |
| **Pref-Default-Idempotent** | 反复请求 GET（用户从未保存）返回的 defaults 必须完全一致 | defaults.py（纯函数） |
| **Pref-Reset-Audit** | 调用 reset 端点必写 audit（reason='user_reset', sections=[...]） | preferences.service.reset |
| **Pref-Lazy-Upgrade** | 旧 schema_version 读取时返回升级后的 payload，但 DB 不变（用户下次 PUT 才落库） | upgrader.py + service.get |
| **Pref-Cache-Invalidate-On-Write** | 任何 PUT/PATCH/RESET 必须立即失效该用户的进程内 LRU 缓存 | service.invalidate_cache |
| **Pref-PATCH-Atomic** | PATCH 端点：read → merge → 全量校验 → 写。任一字段校验失败整个 PATCH 失败回滚 | service.patch |
| **Pref-No-Audit-High-Frequency** | 高频字段（font_size / autosave / line_height）变更不写 audit；仅关键字段（schema_version / theme / keyboard）写 | AUDIT_TRACKED_PATHS 白名单 |

---

## 16. 题目元数据边界（QMeta-*）

详见 [15-Question-Metadata §6](./15-Question-Metadata.md#6-schema-预留的-invariantphase-1-范围)。

| 规则 | 描述 | 实施位置 |
|---|---|---|
| **QMeta-Phase1-Empty** | Phase 1 完工时 KnowledgePointV2 / QuestionKnowledgePointV2 必须为空（除测试 fixture 外） | invariant test + DB 初始检查 |
| **QMeta-Phase1-No-Endpoint** | Phase 1 不暴露任何 KnowledgePoint / QuestionKnowledgePoint 端点；OpenAPI 中以 `x-phase: 2` 标记 | OpenAPI spec + lint test |
| **QMeta-Phase1-Service-Hidden** | service 层不导出对这两个表的 CRUD 函数；任何调用走 admin 工具（Phase 2 才启用） | service 模块导出列表 |
| **QMeta-Field-Default-Backfill** | alembic upgrade 后所有现有 QuestionV2 行的新字段必须有默认值（不 NULL 除可空字段外） | migration data backfill 步骤 |
| **QMeta-Lint-Tag-Format** | knowledge_tags 列表元素必须满足 `^[a-z][a-z0-9_]*$`（蛇形）| Pydantic field validator |
| **QMeta-AbilityDim-Enum** | ability_dimensions 元素 ∈ {comprehension, reasoning, calculation, memory, application} | DB CHECK + Pydantic enum |
| **QMeta-Complexity-Range** | complexity_level ∈ [1, 5] ∪ {NULL} | DB CHECK |
| **QMeta-Heat-NonNegative** | heat_score >= 0.0 | DB CHECK |
| **QMeta-Phase2-Migration-Path** | knowledge_tags → KnowledgePointV2.code 的映射在 Phase 2 实施时必须保持元素一一对应（无歧义） | Phase 2 文档（蓝图） |
