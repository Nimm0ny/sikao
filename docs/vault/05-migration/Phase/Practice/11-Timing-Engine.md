# Phase-Practice · 11 · Timing Engine

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Module**: `modules/timing/`（新建，详见 [03-Backend-WU §19](./03-Backend-WU.md#19-wu-b25-timing-模块新建)）
> **决策来源**：`00-Decisions.md` Timing-* 系列

---

## 1. 模块定位

### 1.1 为什么需要单独的 timing 模块

公考是严格限时考试（行测 120 分钟 130+ 题，平均每题 < 60s）。"时间管理"是核心备考能力，与"正确率"同等重要。当前 V2 schema 仅记录 session 级别的 `started_at / completed_at`，缺乏：

- 逐题作答耗时（决定"提速训练"能否落地）
- 答题节奏（哪类题花时间多）
- 超时识别（与历史基线比较）
- 答案修改轨迹（蒙猜识别 / 答题质量分析的输入）
- session 实际作答时长（去除暂停时间，区别于 wall-clock 时间）

### 1.2 职责边界

| 模块 | 包含 | 不包含 |
|---|---|---|
| **timing**（本模块） | 时间事件接收（question_enter / leave / answer_change 三类）/ 时间分析端点 / 基线计算 cron / answer 与 session 上 timing 字段写入 | heartbeat（在 session_lifecycle）/ session_pause/resume（在 session_lifecycle）/ 时间在 UI 上的展示（前端职责）/ 模考全局倒计时（在 mock_exam 模块）/ session 暂停状态机（在 session_lifecycle 模块） |
| `session` | 答题闭环（创建 / 作答 / 提交） | 时间事件批量上报 |
| `practice_stats` | 综合实绩 snapshot（含 total_minutes 但不含逐题耗时分析） | timing-specific 分析端点 |

### 1.3 文件结构

```
services/api/src/sikao_api/modules/timing/
  __init__.py
  application/
    service.py                  # 主入口
    event_recorder.py           # 处理 batch 时间事件上报
    baseline_computer.py        # 题目耗时基线计算（cron 用）
    analyzer.py                 # 用户耗时分析聚合
  domain/
    types.py                    # TimingEvent / TimingAnalysis
    errors.py
  interface/
    routes.py
    schemas.py
```

---

## 2. 数据模型

### 2.1 PracticeSessionAnswerV2 字段扩展

详见 [02-Data-Model §2.3](./02-Data-Model.md#23-practicesessionanswerv2扩展)。本模块涉及字段：

```python
class PracticeSessionAnswerV2(Base):
    # ... 现有字段
    # ===== timing 相关字段（本模块写入） =====
    time_spent_ms: Mapped[int] = mapped_column(default=0)
    # 累计作答耗时（不含切走切回的间隔）
    # 计算方式：sum(active_intervals_within_this_question)

    first_seen_at: Mapped[datetime | None]
    # 首次进入该题的时刻（用户切到这题）

    first_answered_at: Mapped[datetime | None]
    # 首次作答的时刻（首次写入 selected_answer 非空）

    last_modified_at: Mapped[datetime | None]
    # 最后一次修改答案的时刻

    answer_change_count: Mapped[int] = mapped_column(default=0)
    # 答案修改次数（首次作答不计；改一次 +1）

    visit_count: Mapped[int] = mapped_column(default=0)
    # 进入该题的次数（用户切走再切回算多次）

    is_overtime: Mapped[bool] = mapped_column(default=False)
    # 是否超时（time_spent_ms > QuestionTimingBaselineV2.p95_ms × 1.2）
    # 在 session.submit 时根据基线计算并写入；session 进行中始终 false
```

### 2.2 PracticeSessionV2 字段扩展

```python
class PracticeSessionV2(Base):
    # ===== timing 相关字段 =====
    total_active_seconds: Mapped[int] = mapped_column(default=0)
    # 实际作答时长（不含暂停 / 心跳超时间隔）

    paused_total_seconds: Mapped[int] = mapped_column(default=0)
    # 累计暂停时长

    first_question_at: Mapped[datetime | None]
    # 首次进入第一题的时刻

    last_activity_at: Mapped[datetime | None]
    # 最近一次有效活动（answer / heartbeat / nav）的时刻
```

### 2.3 QuestionTimingBaselineV2（新表）

题目耗时基线，用于"超时"判定与时间分析。

```python
class QuestionTimingBaselineV2(Base):
    __tablename__ = "question_timing_baseline_v2"

    question_id: Mapped[int] = mapped_column(
        ForeignKey("question_v2.id"), primary_key=True
    )

    p50_ms: Mapped[int]
    p90_ms: Mapped[int]
    p95_ms: Mapped[int]
    mean_ms: Mapped[int]

    sample_size: Mapped[int]
    # 用于计算基线的答题样本数（< MIN_SAMPLES 时不参与"超时"判定）

    last_recomputed_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        Index("ix_timing_baseline_recomputed", "last_recomputed_at"),
    )
```

**MIN_SAMPLES 阈值**：默认 30（answer 数 < 30 时基线置信度太低，UI 不显示"超时"标记）。

---

## 3. 时间事件上报协议

### 3.1 事件类型

前端在用户答题过程中累积时间事件（buffer 在内存），按 batch 上报。事件定义：

```typescript
type TimingEvent =
  | { type: "question_enter"; answer_id: number; ts: ISOString }
  | { type: "question_leave"; answer_id: number; ts: ISOString }
  | { type: "answer_change"; answer_id: number; ts: ISOString; from: string|null; to: string|null };
```

⚠️ **heartbeat 与 session_pause/resume 不在 timing 端点处理**（00-Decisions Timing-4 修订后）：
- heartbeat：走 `POST /api/v2/practice/sessions/:id/heartbeat`（lifecycle 模块端点，详见 [12-Session-Lifecycle §4.1 / §5.2](./12-Session-Lifecycle.md#41-用户主动操作)）
- session_pause / session_resume：走 lifecycle 模块对应端点

timing 端点仅接受 question_enter / question_leave / answer_change 三类事件。

### 3.2 上报端点

```
POST /api/v2/practice/sessions/:id/timing/events
body: {
  events: TimingEvent[]   // 按 ts 升序，单 batch ≤ 200 事件
  client_clock_skew_ms?: number  // 客户端与服务端时差（可选）
}

→ 200 { accepted: int, rejected: int, last_ack_event_idx: int }
→ 400 PAYLOAD_TOO_LARGE （events.length > 200）
→ 422 EVENT_ORDER_VIOLATION （ts 非升序）
→ 422 STALE_EVENT （ts 早于该 answer.last_modified_at - 60s）
→ 403 SESSION_NOT_OWNED
```

### 3.3 上报频率（前端契约）

| 触发条件 | 行为 |
|---|---|
| 内存 buffer ≥ 50 事件 | 立即 flush |
| 距上次 flush > 15s | 定时 flush |
| 用户切换到下一题 | 立即 flush（保证 question_leave 写入） |
| 用户点提交 | submit 前先 flush |
| session 暂停 | 先 flush 再调 pause 端点（pause 不在 timing batch 里） |
| 网络失败 | 内存重试 3 次（指数退避）；3 次后写 IndexedDB，下次连上时补传 |

### 3.4 服务端处理

```python
async def record_events(
    session_id: int,
    user_id: int,
    events: list[TimingEvent],
) -> EventBatchResult:
    # 1. 校验 session 所有权 + status
    session = await get_session(session_id, user_id)
    if session.status not in (SessionStatus.IN_PROGRESS, SessionStatus.PAUSED):
        raise ServiceError(code='SESSION_NOT_WRITABLE', http=409)

    # 2. 事件升序校验
    for i in range(1, len(events)):
        if events[i].ts < events[i-1].ts:
            raise ServiceError(code='EVENT_ORDER_VIOLATION', http=422)

    # 3. 按 answer_id 分组聚合
    answer_updates: dict[int, AnswerTimingDelta] = {}
    for evt in events:
        if evt.type == "question_enter":
            answer_updates[evt.answer_id].interval_starts.append(evt.ts)
            answer_updates[evt.answer_id].visit_inc += 1
            if not answer.first_seen_at:
                answer_updates[evt.answer_id].first_seen_at = evt.ts
        elif evt.type == "question_leave":
            answer_updates[evt.answer_id].interval_ends.append(evt.ts)
        elif evt.type == "answer_change":
            answer_updates[evt.answer_id].change_inc += 1
            answer_updates[evt.answer_id].last_modified_at = evt.ts
            if not answer.first_answered_at and evt.to is not None:
                answer_updates[evt.answer_id].first_answered_at = evt.ts

    # 4. 配对 enter/leave 计算 active 区间
    for answer_id, delta in answer_updates.items():
        active_ms = compute_active_intervals(delta.interval_starts, delta.interval_ends)
        delta.time_spent_ms_inc = active_ms

    # 5. UPDATE 各 answer
    await apply_answer_deltas(answer_updates)

    # 6. 同时更新 PracticeSessionV2.last_activity_at = max(events.ts)
    await update_session_last_activity(session_id, max_ts=events[-1].ts)
```

**关键点**：
- 事件可以是"该 answer 多次进入"的累积；每次 batch 增量更新
- 配对 question_enter / question_leave 用栈式算法，未配对的 enter 视为"切走但未关闭"，等下次 batch 补齐
- 超过 60s 的"未关闭"区间在 session.submit 时强制按 60s 截断（防恶意刷时间）

---

## 4. 时间分析端点

### 4.1 用户级时间分析

```
GET /api/v2/practice/stats/timing?type=xingce&period=7d|30d|90d&category=
→ {
    overall: {
      total_minutes: int,
      avg_seconds_per_question: float,
      vs_baseline_ratio: float,    // 1.0 = 持平基线，>1 = 慢，<1 = 快
    },
    by_category_l1: [
      { category, avg_seconds, vs_baseline_ratio, sample_count }
    ],
    by_difficulty: [
      { difficulty_bucket, avg_seconds, vs_baseline_ratio }
    ],
    overtime_questions: {
      count: int,
      top_5_question_ids: int[]   // 最近 period 内超时最多的题
    },
    // 答题习惯画像
    pacing_pattern: "steady" | "fast_start_slow_end" | "slow_start_fast_end" | "irregular"
  }
```

`pacing_pattern` 计算逻辑：
- 把 session 分前 1/3、中 1/3、后 1/3
- 比较三段的 avg_seconds_per_question
- 偏差 < 10% → steady；前段快后段慢 → fast_start_slow_end；反之 slow_start_fast_end；否则 irregular

### 4.2 单题基线查询

```
GET /api/v2/practice/questions/:id/timing-baseline
→ 200 { p50_ms, p90_ms, p95_ms, mean_ms, sample_size }
→ 404 BASELINE_INSUFFICIENT （sample_size < MIN_SAMPLES）
```

### 4.3 session 时间报告（结果页用）

```
GET /api/v2/practice/sessions/:id/timing-report
→ {
    total_active_seconds: int,
    total_wall_seconds: int,         // = (completed_at - started_at).seconds
    paused_total_seconds: int,
    questions: [
      {
        answer_id, question_id,
        time_spent_ms,
        baseline_p50_ms,
        baseline_p95_ms,
        is_overtime,
        answer_change_count,
        visit_count
      }
    ],
    summary: {
      overtime_count: int,
      fastest_answer_id: int,
      slowest_answer_id: int,
      most_changed_answer_id: int    // answer_change_count 最高
    }
  }
```

---

## 5. Cron：基线计算

### 5.1 调度

`recompute_question_timing_baseline` 每周一 03:00 UTC。

### 5.2 算法

```python
async def recompute_question_timing_baseline():
    # 仅取最近 90 天的有效数据（防止旧题基线被远古噪声拖偏）
    cutoff = datetime.utcnow() - timedelta(days=90)

    # 一次扫所有有 answer 数据变化的 question
    candidate_question_ids = await db.execute(
        select(distinct(PracticeSessionAnswerV2.question_id))
        .join(PracticeSessionV2)
        .where(PracticeSessionV2.completed_at >= cutoff)
        .where(PracticeSessionV2.status == SessionStatus.SUBMITTED)
    ).scalars().all()

    for question_id in candidate_question_ids:
        samples = await db.execute(
            select(PracticeSessionAnswerV2.time_spent_ms)
            .join(PracticeSessionV2)
            .where(PracticeSessionAnswerV2.question_id == question_id)
            .where(PracticeSessionV2.status == SessionStatus.SUBMITTED)
            .where(PracticeSessionV2.completed_at >= cutoff)
            .where(PracticeSessionAnswerV2.time_spent_ms > 0)  # 排除未作答
            .where(PracticeSessionAnswerV2.time_spent_ms < 600_000)  # 排除 > 10 分钟的脏数据
        ).scalars().all()

        if len(samples) < MIN_SAMPLES:
            continue  # 跳过样本不足的题

        await upsert_baseline(
            question_id=question_id,
            p50_ms=percentile(samples, 50),
            p90_ms=percentile(samples, 90),
            p95_ms=percentile(samples, 95),
            mean_ms=mean(samples),
            sample_size=len(samples),
        )

    # audit
    await audit_log.write(
        actor='system',
        action='timing.baseline_recomputed',
        target_type='QuestionTimingBaselineV2',
        target_id=None,
        reason=f'updated {len(candidate_question_ids)} baselines',
    )
```

### 5.3 cron 失败兜底

- cron 失败不影响 session 运行（基线只用于"超时"标记，缺失时退化为不显示）
- 失败写 audit + alert，但不阻塞其他 cron

---

## 6. 与其他模块的集成点

### 6.1 session.create

session 创建时 `last_activity_at = now`，`first_question_at = null`（用户首次进入第一题时由前端 timing 上报触发更新）。

### 6.2 session.submit

submit 时同步触发：

1. 强制 flush 用户最后一批 timing events（端点接收方法同 §3.2）
2. 计算每题 `is_overtime`：
   ```python
   for answer in answers:
       baseline = await get_baseline(answer.question_id)
       if baseline and baseline.sample_size >= MIN_SAMPLES:
           answer.is_overtime = answer.time_spent_ms > baseline.p95_ms * 1.2
   ```
3. 写 `total_active_seconds = sum(answers.time_spent_ms) / 1000`
4. 截断异常长区间（> 60s/区间 → 截 60s，防恶意刷时间）

### 6.3 session_lifecycle.pause / resume

由 session_lifecycle 模块负责状态机转换；timing 模块提供：

- `record_pause_start(session_id, ts)`：写 session.paused_at
- `record_pause_end(session_id, ts)`：累加 paused_total_seconds += (ts - paused_at)

### 6.4 mock_exam

模考模式下：
- 全局倒计时（mock_exam 模块负责）
- 倒计时归零时 mock_exam 调 session_lifecycle.force_submit
- 强制 submit 时 timing 模块照常计算 is_overtime（基线判定逻辑相同）

### 6.5 practice_stats

`practice_stats` 写 snapshot 时读取本模块的 `total_active_seconds`：

```python
total_minutes = sum(submitted_sessions.total_active_seconds) / 60
```

---

## 7. Invariant（关键）

详见 [01-Boundary-Rules §12](./01-Boundary-Rules.md#12-时间维度边界timing-) 与 [10-Testing §3.7](./10-Testing.md#37-timing-invariant)。

| Invariant | 描述 |
|---|---|
| **Timing-Monotonic** | events 内 ts 必须单调递增；违反 → 422 |
| **Timing-Bounded-Per-Visit** | 单次 enter→leave 区间 ≤ 60s（超出截断为 60s） |
| **Timing-Sum-Lte-Wall** | session.total_active_seconds ≤ wall_clock_seconds（不可能比墙钟还长） |
| **Timing-Active-Plus-Pause-Lte-Wall** | total_active_seconds + paused_total_seconds ≤ wall_clock_seconds + 5s 容差 |
| **Timing-Overtime-Has-Baseline** | is_overtime=true 必有 sample_size >= MIN_SAMPLES 的 baseline |
| **Timing-No-Stale-Event** | 不接受 ts < (last_modified_at - 60s) 的事件（防回放） |
| **Timing-Status-Writable** | 仅 session.status ∈ {in_progress, paused} 时可写时间事件 |
| **Timing-Heartbeat-Out-Of-Scope** | timing 端点不接受 heartbeat / session_pause / session_resume 事件类型；这些走 lifecycle 端点（00-Decisions Timing-4 修订后） |

---

## 8. 性能预算

| 端点 | p50 | p95 | p99 |
|---|---|---|---|
| POST /sessions/:id/timing/events (200 events) | 80ms | 200ms | 400ms |
| GET /practice/stats/timing | 150ms | 400ms | 800ms |
| GET /questions/:id/timing-baseline | 20ms | 50ms | 100ms |
| GET /sessions/:id/timing-report | 100ms | 250ms | 500ms |

cron `recompute_question_timing_baseline`：
- 题目数 1k → 完成 < 5min
- 题目数 10k → 完成 < 30min（必要时 batch 化）

---

## 9. 限流

| 端点 | 限流 |
|---|---|
| `POST /sessions/:id/timing/events` | 每用户每 session **20 req/min**（防客户端刷批） |
| `GET /practice/stats/timing` | 每用户 60 req/min |
| `GET /sessions/:id/timing-report` | 每用户 60 req/min |

---

## 10. 审计与可观测

### 10.1 audit 触发

- `timing.baseline_recomputed`（cron 完成）
- `timing.events_rejected`（事件批量被整体拒绝时；单个事件 reject 不写 audit）
- `timing.session_clamped_intervals`（session.submit 时检测到异常长区间被截断）

### 10.2 metrics

```
timing.events.received_total{source}
timing.events.rejected_total{reason}
timing.events.batch_size_histogram
timing.session.active_seconds_histogram
timing.session.overtime_questions_count_histogram
timing.baseline.recompute_duration_seconds
timing.baseline.questions_updated_total
timing.baseline.questions_skipped_total{reason}
```

---

## 11. 错误处理矩阵

| 场景 | 响应 | 前端行为 |
|---|---|---|
| events.length > 200 | 400 PAYLOAD_TOO_LARGE | 拆 batch 重传 |
| ts 非升序 | 422 EVENT_ORDER_VIOLATION | 客户端排序后重传；连续失败上报错误 |
| 事件过期（ts < last_modified_at - 60s） | 422 STALE_EVENT | 跳过该 batch 不重传 |
| session 已 submitted | 409 SESSION_NOT_WRITABLE | 静默丢弃 buffer |
| 网络错误 | retry 3 次后写 IndexedDB | 下次连上时补传 |
| baseline 不足 | 404 BASELINE_INSUFFICIENT | UI 不显示"超时"标记 |

---

## 12. 关联文档

- [00-Decisions §14](./00-Decisions.md#14-答题计时timing-系列) - Timing-* 决策
- [01-Boundary-Rules §12](./01-Boundary-Rules.md#12-时间维度边界timing-) - Timing-* invariant
- [02-Data-Model §2.3 / §3.8](./02-Data-Model.md#23-practicesessionanswerv2扩展) - schema
- [03-Backend-WU §19](./03-Backend-WU.md#19-wu-b25-timing-模块新建) - WU-B25 PR 拆分
- [04-Frontend-WU §12](./04-Frontend-WU.md#12-wu-f19-timing-上报与展示) - 前端集成
- [12-Session-Lifecycle](./12-Session-Lifecycle.md) - pause/resume 协同
- [13-Mock-Exam](./13-Mock-Exam.md) - 模考超时 force_submit 协同
