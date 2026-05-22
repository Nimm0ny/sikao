# Phase-Practice · 13 · Mock Exam

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Module**: `modules/mock_exam/`（新建，详见 [03-Backend-WU §21](./03-Backend-WU.md#21-wu-b27-mock_exam-模块新建)）
> **决策来源**：`00-Decisions.md` MockExam-* 系列

---

## 1. 模块定位

### 1.1 为什么需要独立的 mock_exam 模块

公考的"考场体验"是核心备考训练之一：
- 全程 120 分钟（行测）/ 180 分钟（申论）严格倒计时
- 不能随意暂停（区别于普通练习）
- 时间归零自动交卷
- 交卷前不能看任何答案 / 解析（继承整组闭卷，但更严格）

当前 V2 schema 仅有"逐题 / 整组"答题节奏，无"模考"这一维度。`13-Mock-Exam` 把模考作为 session 的一个**正交维度**实现：
- 题目来源仍是套卷（`source_mode=paper`）
- 节奏强制为整组（`practice_mode=full_set`）
- 在此之上叠加"严格倒计时 + 自动交卷 + 强限制"

### 1.2 模考 vs 套卷整组练习的差别

| 维度 | 套卷整组练习 | 模考模式 |
|---|---|---|
| 倒计时 | 无 | 全局倒计时强制（默认套卷标准时间） |
| 暂停 | 允许 | **禁止**（只有断网保护性暂停，且不延时） |
| 时间归零 | N/A | 强制提交 + 已答的算成绩 + 未答算 0 分 |
| 看解析 | 提交后解锁 | 提交后解锁，但增加"延迟解锁"选项（如 "1h 后解锁"用于多次模拟）|
| heartbeat 超时 | 30min → paused | 不进 paused（保持 in_progress 让倒计时继续走） |
| 答题中操作 | 收藏 / 标记 / 笔记 全部允许 | **禁止笔记**；收藏 / 标记允许（不影响考场感）|
| 跨题切换 | 无限制 | 允许，但不能"返回上一题修改"作为模式开关（默认允许，可选锁定）|
| 中途退出 | 进 paused | 提交一次性废弃（abandoned）；时间继续走 |

### 1.3 职责边界

| 模块 | 包含 | 不包含 |
|---|---|---|
| **mock_exam**（本模块） | 模考创建 / 倒计时计算 / 自动提交触发 / 模考特殊校验（禁笔记 / 禁暂停 / 严格闭卷）/ 模考历史与排行榜（单用户内） | session 状态机本身（在 session_lifecycle）/ 时间事件（在 timing）/ 答题闭环（在 session）/ 解析展示策略（在 session）|

### 1.4 文件结构

```
services/api/src/sikao_api/modules/mock_exam/
  __init__.py
  application/
    service.py                  # 主入口
    countdown.py                # 倒计时计算（不基于轮询，用 expires_at 反推）
    auto_submitter.py           # 倒计时归零自动提交逻辑
    enforcer.py                 # 模考期间各种禁止操作的校验
    history.py                  # 模考历史与对比
  domain/
    types.py                    # MockExamConfig / MockExamResult
    errors.py
  interface/
    routes.py
    schemas.py

services/api/src/sikao_api/cron/
  mock_exam_auto_submit_cron.py  # 每分钟扫描到期模考
```

---

## 2. 数据模型

### 2.1 PracticeSessionV2 字段扩展

详见 [02-Data-Model §2.2](./02-Data-Model.md#22-practicesessionv2扩展)。

```python
class PracticeSessionV2(Base):
    # ===== mock_exam 字段 =====
    exam_mode: Mapped[bool] = mapped_column(default=False)
    # true 表示该 session 是模考

    time_limit_minutes: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # 时间限制（分钟）。null 表示不限时（普通整组练习）
    # 模考必须非空；普通 session 必须为 null（DB CHECK 约束）

    auto_submit_at: Mapped[datetime | None]
    # 自动提交时刻 = first_question_at + time_limit_minutes
    # 模考开始（DRAFT → IN_PROGRESS）时计算

    allow_review_during: Mapped[bool] = mapped_column(default=False)
    # 是否允许中途回看自己的答案。模考默认 false（更严格）
    # 注意：不影响"看解析"——任何 session 在 status != submitted 时都不能看解析

    allow_pause: Mapped[bool] = mapped_column(default=True)
    # 是否允许暂停。模考默认 false
    # 普通 session 默认 true

    delayed_review_until: Mapped[datetime | None]
    # 延迟解锁解析的时刻（可选模式）
    # 设置后，即使提交 status=submitted，submitted_at < delayed_review_until 时
    # 仍然不能看解析。用于"多次模拟同一套卷"场景
    # null = 提交后立即可看
```

### 2.2 DB 约束

```sql
-- exam_mode=true 必须有 time_limit_minutes
CONSTRAINT mock_exam_requires_time_limit CHECK (
  (exam_mode = false) OR (time_limit_minutes IS NOT NULL)
)

-- 模考必须 practice_mode = full_set
CONSTRAINT mock_exam_requires_full_set CHECK (
  (exam_mode = false) OR (practice_mode = 'full_set')
)

-- 模考必须 source_mode = paper
CONSTRAINT mock_exam_requires_paper_source CHECK (
  (exam_mode = false) OR (source_mode = 'paper')
)
```

### 2.3 不新建独立的 MockExam 表

模考的所有数据落在 `PracticeSessionV2` 与既有 `PracticeSessionAnswerV2`，不新建独立表。理由：
- 模考结果与普通套卷整组结果数据结构完全一致
- 实绩统计 / 错题入复盘 / 答题历史复用同一套机制
- 历史对比仅按 `exam_mode=true` 过滤即可

---

## 3. 端点

### 3.1 创建模考

```
POST /api/v2/practice/mock-exams
body: {
  paper_code: string,          // 必须是已有套卷
  time_limit_minutes?: int,    // 可选，不传则用套卷推荐时间
  delayed_review_minutes?: int // 可选，提交后再延迟 N 分钟解锁解析
}
Headers: Idempotency-Key

→ 201 {
    session_id: int,
    paper_code,
    time_limit_minutes,
    auto_submit_at: null,        // 尚未开始
    expires_at: null,            // session 创建态 expires_at = null
    status: "draft"
  }

→ 422 PAPER_NOT_FOUND
→ 422 PAPER_NOT_MOCK_ELIGIBLE     // 该套卷不支持模考（如题量太少）
→ 422 INVALID_TIME_LIMIT          // time_limit_minutes 超出 [10, 360]（含 fallback 后校验）
→ 429 RATE_LIMITED
```

⚠️ 创建后 status=DRAFT。用户必须显式调 `POST /sessions/:id/start`（session_lifecycle 模块）才进入 IN_PROGRESS，倒计时此刻才启动（设置 auto_submit_at）。

**实现层（CLP-3）**：`POST /api/v2/practice/mock-exams` = `session.create` 的语法糖。
内部委托 `session_service.create(source_mode=PAPER, practice_mode=FULL_SET, exam_mode=true, time_limit_minutes=..., as_draft=true)`。
mock-exam 端点的额外职责：
1. 套卷资格校验（题数 < 阈值时 422 PAPER_NOT_MOCK_ELIGIBLE）
2. time_limit_minutes 范围校验（[10, 360]，否则 422 INVALID_TIME_LIMIT）
3. 写 audit `mock_exam.created`

DB CHECK 约束（[02-Data-Model §5.4](./02-Data-Model.md#54-mock_exam-db-check-约束)）保证两条路径都无法绕过 exam_mode 三联约束（time_limit_minutes 非空 ∧ practice_mode='full_set' ∧ source_mode='paper'）。

### 3.2 模考开始

```
POST /api/v2/practice/sessions/:id/start  (session_lifecycle 模块端点)
对模考：转 DRAFT → IN_PROGRESS 时自动计算 auto_submit_at = now + time_limit_minutes
```

**关键**：倒计时基于 `auto_submit_at` 字段（绝对时间），不基于"剩余分钟数"。这样客户端跨设备 / 刷新 / 切走切回都能拿到一致的剩余时间。

### 3.3 查询倒计时

倒计时由前端计算（`auto_submit_at - now()`），但提供权威端点用于校准：

```
GET /api/v2/practice/sessions/:id/countdown
→ 200 {
    server_now: ISO,
    auto_submit_at: ISO,
    remaining_seconds: int,           // 服务端计算的剩余秒数（权威）
    status: SessionStatus,
    elapsed_seconds: int              // 已用秒数
  }
→ 404 NOT_MOCK_EXAM (exam_mode=false 时返回 404 而非数据)
```

前端策略：
- 进入 session 立即调一次拿 `server_now` 与本地时钟对齐
- 之后用 setInterval 本地更新
- 每 5 分钟调一次校准（防客户端时钟篡改 / 漂移）
- 倒计时归零前 5 分钟开始更频繁校准（每 30s）
- 归零时立即调 submit 端点（**不依赖 cron** —— cron 是兜底）

### 3.4 模考期间禁止的操作

```
POST /api/v2/practice/sessions/:id/pause     → 422 MOCK_PAUSE_FORBIDDEN（exam_mode=true 且 allow_pause=false 时）
POST /api/v2/practice/notes                  → 422 MOCK_NOTES_FORBIDDEN
                                              （CLP-5/S2：B16.4 service 内校验：
                                              ① body 显式传 session_id 时直接判 exam_mode；
                                              ② 不传时 service 兜底 query "该用户在 question_id 所属套卷上是否有 IN_PROGRESS mock-exam session"
                                              防 curl 绕过 UI）
POST /api/v2/practice/sessions/:id/answers/:aid/view-solution
                                              → 403 STRICT_CLOSED_BOOK（继承）
                                              → 403 DELAYED_REVIEW_LOCKED（提交后但 < delayed_review_until）
```

⚠️ 注：本 Phase 不新建 `POST /sessions/:id/notes` 端点；mock 期间笔记禁止由 B16.4（`POST /practice/notes`）service 层兜底实现，详见 [03-Backend-WU §8.2 B16.4](./03-Backend-WU.md#82-pr-拆分)。

### 3.5 模考历史

```
GET /api/v2/practice/mock-exams/history?period=30d|90d|all&paper_code=
→ 200 {
    sessions: [
      {
        session_id, paper_code, exam_mode: true,
        completed_at, time_limit_minutes,
        actual_active_seconds,         // timing.total_active_seconds
        accuracy, total_score,
        is_force_submitted,
        rank_in_self?: int             // 自己同套卷历次中的排名
      }
    ],
    aggregate: {
      total_count: int,
      best_accuracy: float,
      best_session_id: int,
      avg_accuracy: float,
      improvement_trend: float        // 最近 5 次 vs 之前 5 次的正确率差值
    }
  }
```

### 3.6 模考详情对比

```
GET /api/v2/practice/mock-exams/:session_id/comparison
→ 200 {
    self: {...current session metrics...},
    self_history: [{...up to 5 prior sessions of same paper...}],
    paper_baseline: {
      avg_accuracy: float,
      avg_active_seconds: int,
      sample_size: int
    }
  }
```

注意：`paper_baseline` 仅 Stage 2 多用户阶段有意义；单机阶段返回空对象（不影响前端渲染）。

---

## 4. 倒计时实现

### 4.1 服务端权威：auto_submit_at

```python
async def start_mock_exam(session_id: int, user_id: int):
    session = await get_session(session_id, user_id)
    if not session.exam_mode:
        raise ServiceError(code='NOT_MOCK_EXAM', http=422)
    if session.status != SessionStatus.DRAFT:
        raise ServiceError(code='INVALID_TRANSITION', http=409)

    now = datetime.utcnow()
    session.auto_submit_at = now + timedelta(minutes=session.time_limit_minutes)
    session.first_question_at = now

    await session_lifecycle.transition(
        session, to=SessionStatus.IN_PROGRESS, trigger='mock_exam_start'
    )

    await audit_log.write(
        actor=user_id,
        action='mock_exam.started',
        target_type='PracticeSessionV2',
        target_id=session_id,
        reason=f'time_limit={session.time_limit_minutes}min',
    )
```

⚠️ `auto_submit_at` 一旦写入就**immutable**（CHECK 不允许 UPDATE 改动），防止用户通过 admin / 内部调用延长时间。

### 4.2 客户端倒计时

```ts
// 简化伪码
const { auto_submit_at, server_now } = await fetchCountdown(sessionId);
const driftMs = Date.now() - new Date(server_now).valueOf();

setInterval(() => {
  const remaining = new Date(auto_submit_at).valueOf() - (Date.now() - driftMs);
  if (remaining <= 0) {
    triggerAutoSubmit();
  } else {
    updateUI(remaining);
  }
}, 1000);
```

### 4.3 自动提交：双轨保障

**主路径**（前端触发）：
- 倒计时归零前 1s，前端禁用所有作答 input
- 归零瞬间，前端调 `POST /sessions/:id/submit`
- submit 端点检测 `exam_mode=true && now >= auto_submit_at` → 强制按当前 answers 提交

**兜底路径**（cron 触发）：
- `mock_exam_auto_submit_cron` 每分钟扫描：
  ```sql
  SELECT id FROM practice_session_v2
  WHERE exam_mode = true
    AND status IN ('in_progress', 'paused')
    AND auto_submit_at <= NOW();
  ```
- 命中 session 调 `force_submit(reason='mock_exam_timeout')`
- force_submitted=true，写 audit

理由：客户端可能崩溃 / 网络中断 / 用户关浏览器，cron 兜底保证模考一定有终态。

---

## 5. 与 session_lifecycle 的交互

### 5.1 模考的状态约束

| from | to | 模考特殊规则 |
|---|---|---|
| DRAFT | IN_PROGRESS | 触发 auto_submit_at 计算（仅 mock_exam） |
| IN_PROGRESS | PAUSED | 仅 allow_pause=true 时允许；模考默认 allow_pause=false 拒绝 |
| IN_PROGRESS / PAUSED | SUBMITTED | normal user_submit 或 force_submit (mock_exam_timeout) |
| 任何活动状态 | ABANDONED | 用户主动 discard 仍允许；时间到了**不**触发 ABANDONED 而是 force_submit |

### 5.2 心跳超时不进 PAUSED

普通 session：心跳 30min 超时 → PAUSED。
**模考例外**：心跳超时**不**改 status，倒计时继续走，到点 force_submit。

理由：模考时间是绝对的；用户离开了相当于在考场放弃部分题。

实现：cron `cleanup_stale_sessions` 在筛选 IN_PROGRESS 候选时排除 `exam_mode=true`：

```sql
SELECT ... FROM practice_session_v2
WHERE status = 'in_progress'
  AND last_heartbeat_at < NOW() - INTERVAL '30 minutes'
  AND exam_mode = false   -- 模考不进 PAUSED
LIMIT 500;
```

### 5.3 force_submit 流程

```python
async def force_submit_mock_exam(session_id: int, reason: str):
    session = await get_session(session_id)

    # 1. 状态机转换
    await session_lifecycle.transition(
        session, to=SessionStatus.SUBMITTED,
        trigger='force_submit', actor='system',
        extra={
            'force_submitted': True,
            'force_submitted_reason': reason,  # 'mock_exam_timeout'
        },
    )

    # 2. 答题数据落库（未答的题保持 selected_answer=null，is_correct=false）
    await session.commit_pending_writes()

    # 3. 触发常规 submit hook（写 stats / 入复盘 / 触发批改 等）
    await on_session_submit(session_id)

    # 4. 写 audit
    await audit_log.write(
        actor='system',
        action='mock_exam.force_submitted',
        target_type='PracticeSessionV2',
        target_id=session_id,
        reason=reason,
    )
```

---

## 6. 与 timing 的交互

### 6.1 模考的时间计算

普通整组练习：
- `total_active_seconds` = 各 answer 累加 active 时长

模考：
- 仍计算 `total_active_seconds`（用于"实际作答时长"展示）
- 但模考的"考场时间" = `time_limit_minutes * 60`（固定）
- "用了多少时间" = `auto_submit_at - first_question_at` 已过的秒数

### 6.2 模考无 paused_total_seconds

由于模考默认 allow_pause=false，paused_total_seconds 通常为 0。
若用户请求 admin force-pause（罕见运维场景），按普通逻辑累加。

### 6.3 超时标记 is_overtime

模考期间继续按 timing baseline 计算 is_overtime。
但 UI 上模考结果页用"耗时分布图"代替"超时题列表"（因为模考节奏与基线统计不同）。

---

## 7. 与 essay_grading 的交互

### 7.1 申论模考时间

申论套卷的 time_limit_minutes 默认 180（与行测 120 区别）。
申论模考流程：
- 启动 → 倒计时 180 分钟
- 用户写答案 → 时间到 force_submit → 触发异步批改（与普通申论流程一致）

### 7.2 申论模考的 reference answer

申论模考结束后，是否立即展示范文？
- 决策：**与 delayed_review_until 同样规则**
- 默认提交后立即可看
- 用户可以创建模考时设置 delayed_review_minutes=60，让自己 1 小时内不能看范文（专心估分）

---

## 8. Invariant

详见 [01-Boundary-Rules §14](./01-Boundary-Rules.md#14-模考边界mockexam-) 与 [10-Testing §3.9](./10-Testing.md#39-mock-exam-invariant)。

| Invariant | 描述 |
|---|---|
| **MockExam-Schema-Coupling** | exam_mode=true ⟹ time_limit_minutes IS NOT NULL ∧ practice_mode=full_set ∧ source_mode=paper（DB CHECK 约束） |
| **MockExam-AutoSubmit-Immutable** | auto_submit_at 一旦写入不可改（DB trigger 拒绝 UPDATE） |
| **MockExam-No-Pause-By-Default** | exam_mode=true ∧ allow_pause=false 时 pause 端点 422 拒绝 |
| **MockExam-No-Heartbeat-Pause** | exam_mode=true 的 session 不会因心跳超时进 PAUSED |
| **MockExam-Force-Submit-On-Timeout** | now >= auto_submit_at ∧ status ∈ {in_progress, paused} → 必须 force_submit（前端立即触发或 cron 兜底；最大延迟 60s） |
| **MockExam-Closed-Book-Strict** | 提交前所有看答案 / 看解析端点拒绝（继承 Pace-Closed-Book） |
| **MockExam-Delayed-Review** | delayed_review_until 非空 ∧ now < delayed_review_until ∧ status=submitted → 看解析端点 403 DELAYED_REVIEW_LOCKED |
| **MockExam-Notes-Forbidden** | exam_mode=true 时创建题级 NoteV2 端点 422 MOCK_NOTES_FORBIDDEN |
| **MockExam-Force-Submit-Audit** | force_submitted=true ∧ exam_mode=true → 必有 audit log + reason='mock_exam_timeout' |
| **MockExam-Time-Limit-Range** | time_limit_minutes ∈ [10, 360]（防异常值） |

---

## 9. 性能预算

| 端点 | p50 | p95 | p99 |
|---|---|---|---|
| POST /practice/mock-exams | 100ms | 250ms | 500ms |
| GET /sessions/:id/countdown | 20ms | 50ms | 100ms |
| GET /practice/mock-exams/history | 80ms | 200ms | 400ms |
| GET /practice/mock-exams/:id/comparison | 150ms | 400ms | 800ms |

cron `mock_exam_auto_submit_cron`：
- 每分钟扫描 → 候选量小（仅 expires 在过去 1 分钟内的）→ 完成 < 5s

---

## 10. 限流

| 端点 | 限流 |
|---|---|
| `POST /practice/mock-exams` | 每用户 **20 req/day**（防滥刷模考） |
| `GET /sessions/:id/countdown` | 每用户每 session **30 req/min** |
| `GET /practice/mock-exams/history` | 每用户 60 req/min |
| `GET /practice/mock-exams/:id/comparison` | 每用户 60 req/min |

---

## 11. 审计与可观测

### 11.1 audit 触发

| 事件 | actor | 备注 |
|---|---|---|
| `mock_exam.created` | user | 创建模考 session |
| `mock_exam.started` | user | DRAFT → IN_PROGRESS（auto_submit_at 写入） |
| `mock_exam.force_submitted` | system | 倒计时归零自动提交 |
| `mock_exam.pause_attempt_blocked` | user | 用户尝试 pause 被拒（allow_pause=false） |
| `mock_exam.notes_attempt_blocked` | user | 用户尝试创建题级笔记被拒 |
| `mock_exam.delayed_review_blocked` | user | 用户尝试在 delayed_review_until 前看解析被拒 |

### 11.2 metrics

```
mock_exam.created_total{paper_code}
mock_exam.started_total
mock_exam.force_submitted_total{reason}
mock_exam.user_submitted_total
mock_exam.duration_seconds_histogram     // 实际用时
mock_exam.unfinished_questions_count_histogram
mock_exam.completion_rate                // 完成 / 创建
mock_exam.countdown_query_total
mock_exam.cron.auto_submitted_total
```

---

## 12. 错误处理矩阵

| 场景 | 响应 | 前端行为 |
|---|---|---|
| 套卷不支持模考（题数 < 阈值） | 422 PAPER_NOT_MOCK_ELIGIBLE | 提示用户选其他套卷 |
| time_limit 超出范围 | 422 INVALID_TIME_LIMIT | 表单校验提示 |
| 模考期间 pause | 422 MOCK_PAUSE_FORBIDDEN | toast "模考模式不支持暂停" |
| 模考期间加笔记 | 422 MOCK_NOTES_FORBIDDEN | UI 隐藏入口；后端兜底 |
| 倒计时归零仍试图作答 | 409 SESSION_NOT_WRITABLE | 强制 refetch 状态 → 跳 result 页 |
| 客户端时钟严重偏差 | 校准端点返回正确 server_now | 前端用 drift 修正 |

---

## 13. 用户体验关键点（前端契约）

### 13.1 倒计时显示

- 顶部 sticky 倒计时条（HH:MM:SS）
- 剩余 < 10min 时变橙色 + 闪烁提示
- 剩余 < 1min 时变红色 + tick 声音（可关闭）
- 剩余 = 0 时自动 submit（不弹确认）

### 13.2 模考开始前

- 显式确认对话框："模考一旦开始无法暂停 / 加笔记 / 看答案，确定开始吗？"
- 用户确认后才调 `/sessions/:id/start`

### 13.3 模考结束后

- 立即跳 result 页（force_submitted 时也跳，但顶部 banner "时间到，已自动提交"）
- result 页有特殊 segment："模考表现"（含 actual_active / unfinished count / 比较）

---

## 14. 关联文档

- [00-Decisions §16](./00-Decisions.md#16-模考模式mockexam-系列) - MockExam-* 决策
- [01-Boundary-Rules §14](./01-Boundary-Rules.md#14-模考边界mockexam-) - MockExam-* invariant
- [02-Data-Model §2.2](./02-Data-Model.md#22-practicesessionv2扩展) - schema
- [03-Backend-WU §21](./03-Backend-WU.md#21-wu-b27-mock_exam-模块新建) - WU-B27 PR 拆分
- [04-Frontend-WU §17](./04-Frontend-WU.md#17-wu-f21-mock-exam-模考-ui) - 前端集成
- [11-Timing-Engine §6](./11-Timing-Engine.md) - timing 协同
- [12-Session-Lifecycle §5.2 / §9](./12-Session-Lifecycle.md) - session_lifecycle 协同
