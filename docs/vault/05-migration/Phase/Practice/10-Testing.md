# Phase-Practice · 10 · Testing

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> 继承 [Phase-Home 10-Testing](../Home/10-Testing.md)

---

## 1. 测试金字塔

继承 Phase-Home：

```
            ┌─────────────────┐
            │   E2E (~ 5%)    │  关键链路 / 跨模块
            └─────────────────┘
          ┌─────────────────────┐
          │ Integration (~25%)  │  模块边界 / contract
          └─────────────────────┘
        ┌─────────────────────────┐
        │   Invariant (~10%)      │  P1-P6 + PR1-PR8 边界
        └─────────────────────────┘
      ┌─────────────────────────────┐
      │       Unit (~60%)            │
      └─────────────────────────────┘
```

---

## 2. 后端测试目录

```
services/api/tests/
├── modules/
│   ├── ai_questions/
│   │   ├── test_pool_query.py
│   │   ├── test_llm_orchestrator.py
│   │   ├── test_persist.py
│   │   ├── test_feedback.py
│   │   ├── test_quota.py
│   │   └── test_routes.py
│   ├── content/
│   │   └── test_categories_papers.py
│   ├── daily_practice/
│   │   ├── test_weakness_weighter.py
│   │   ├── test_routes.py
│   │   └── test_history.py
│   ├── essay_grading/
│   │   ├── test_async_flow.py
│   │   ├── test_report_persist.py
│   │   ├── test_reference_query.py
│   │   ├── test_reference_feedback.py
│   │   └── test_routes.py
│   ├── favorites/
│   │   └── test_routes.py
│   ├── llm/                                  # 在 Phase-Home 已建
│   │   ├── test_question_generator.py        # B22.1
│   │   ├── test_essay_grader.py              # B22.2
│   │   ├── test_reference_answer_generator.py # B22.3
│   │   └── prompts/
│   │       ├── test_question_generate_schema.py
│   │       ├── test_essay_grade_schema.py
│   │       └── test_reference_answer_schema.py
│   ├── practice_stats/
│   │   ├── test_snapshot_writer.py
│   │   ├── test_realtime_aggregator.py
│   │   ├── test_trend.py
│   │   ├── test_cross.py
│   │   └── test_percentile.py
│   ├── question_flags/
│   │   ├── test_routes.py
│   │   └── test_review_sync.py
│   └── session/
│       ├── test_mode_category.py
│       ├── test_mode_custom.py
│       ├── test_mode_daily_redo.py
│       ├── test_mode_ai_generated.py
│       ├── test_answer_ops.py
│       └── test_submit_timing_hook.py        # B25.5 与 timing 集成
│   ├── timing/                                # B25
│   │   ├── test_event_recorder.py             # 6 条事件 invariant + 配对算法
│   │   ├── test_baseline_computer.py          # MIN_SAMPLES + 脏数据剔除 + 百分位精度
│   │   ├── test_analyzer.py                   # overall / by_category / by_difficulty / pacing_pattern
│   │   ├── test_routes.py                     # 4 个端点 happy + 限流 + 错误矩阵
│   │   └── test_endpoint_separation.py        # heartbeat 不被 timing 端点接受
│   ├── session_lifecycle/                     # B26
│   │   ├── test_state_machine.py              # 完整 truth table（所有 §2.3 规则 + 终态自循环 + 跨状态非法）
│   │   ├── test_pause_resume.py
│   │   ├── test_heartbeat.py                  # 含 Wakes-Paused / No-Draft-Wake / No-Terminal
│   │   ├── test_active_session_query.py
│   │   ├── test_lifecycle_query.py            # 从 audit log 还原 transitions 链
│   │   ├── test_discard.py
│   │   └── test_admin_force.py
│   ├── mock_exam/                             # B27
│   │   ├── test_create_and_start.py           # Schema-Coupling / Time-Limit-Range / AutoSubmit-Immutable
│   │   ├── test_countdown.py                  # 端点权威 + 5min 校准
│   │   ├── test_enforcer.py                   # pause / notes / delayed_review 三处禁止
│   │   ├── test_auto_submitter.py             # force_submit + Submit-Includes-Unanswered
│   │   ├── test_history.py
│   │   └── test_comparison.py                 # paper_baseline Stage 1 空对象
│   ├── practice_preferences/                  # B28
│   │   ├── test_defaults.py                   # Default-Idempotent
│   │   ├── test_get_put.py                    # User-Scope / Schema-Version-Strict / Field-Range / KeyBinding-Unique
│   │   ├── test_patch_reset.py                # PATCH-Atomic / Reset-Audit / Lazy-Upgrade / No-Audit-High-Frequency
│   │   ├── test_cache.py                      # Cache-Invalidate-On-Write
│   │   └── test_keybinding_unique.py          # KeyBindings root_validator
│   ├── question_metadata/                     # B29 schema-only
│   │   ├── test_phase1_empty.py               # 表为空 / 端点不暴露 / service 隐藏
│   │   ├── test_field_default_backfill.py     # alembic upgrade 后默认值正确
│   │   └── test_lint_tag_format.py            # knowledge_tags 蛇形
│   └── question_reports/                      # B30
│       ├── test_user_crud.py                  # Active-Unique / Description-Length / Owner-Read + 限流 20/day
│       ├── test_admin.py                      # Resolved-Requires-Admin / Terminal-Immutable / Fix-Only-When-Fixed / Dup-Only-When-Duplicate / Audit-Required / Real-Exam-No-AutoDeactivate
│       └── test_apply_fix_dual_audit.py       # PR-Report-Fix-Audit-Question-Mutation
├── invariant/
│   ├── test_question_source_immutable.py     # PR2
│   ├── test_strict_closed_book.py            # Pace-Closed-Book
│   ├── test_ai_generation_complete_or_fail.py # PR-AI-G
│   ├── test_inactive_question_excluded.py    # PR4
│   ├── test_stat_independent_of_source.py    # Stat-Source-Independence
│   ├── test_note_visibility.py               # Note-Visibility
│   ├── test_flag_basic_vs_persistent.py      # Flag-Basic-vs-Persistent
│   ├── test_timing_invariant.py              # §3.7 7 条 Timing-* 集合
│   ├── test_session_lifecycle_invariant.py   # §3.8 12 条 Session-LC-* 集合
│   ├── test_mock_exam_invariant.py           # §3.9 12 条 MockExam-* 集合
│   ├── test_pref_invariant.py                # 10 条 Pref-* 集合
│   ├── test_qmeta_phase1_invariant.py        # 9 条 QMeta-* 集合
│   └── test_question_report_invariant.py     # §3.10 13 条 PR-Report-* 集合
├── e2e/practice/
│   ├── test_content_endpoints.py
│   ├── test_session_modes.py
│   ├── test_session_pace_invariant.py
│   ├── test_favorites_flags_stats.py
│   ├── test_ai_questions_flow.py
│   ├── test_daily_practice.py
│   ├── test_essay_grading_async.py
│   ├── test_essay_reference.py
│   ├── test_timing_buffer_to_report.py        # B25 e2e：buffer flush → report
│   ├── test_lifecycle_full_flow.py            # B26 e2e：DRAFT → IN_PROGRESS → PAUSED（cron）→ 心跳 resume → SUBMITTED
│   ├── test_mock_exam_force_submit.py         # B27 e2e：倒计时归零（cron 兜底 60s 内）
│   ├── test_preferences_schema_mismatch.py    # B28 e2e：schema 升级 → 422 → refetch
│   └── test_question_report_admin_loop.py     # B30 e2e：用户提报 → admin acknowledge → resolved_fixed + question 字段更新
├── cron/
│   ├── test_question_accuracy_cron.py
│   ├── test_ai_cleanup_cron.py
│   ├── test_reference_quality_cron.py
│   ├── test_daily_practice_cron.py
│   ├── test_timing_baseline_cron.py           # B25.3
│   ├── test_session_cleanup_cron.py           # B26.4（含 MockExam-Heartbeat-Bypass）
│   ├── test_daily_session_expire_cron.py      # B26.4
│   ├── test_mock_exam_auto_submit_cron.py     # B27.3
│   └── test_ai_cleanup_with_reports.py        # B23.1 + B30.2 联合（AI 题 vs 真题不同处理）
├── scripts/
│   └── test_import_real_exams.py
└── fixtures/
    ├── llm/
    │   ├── mock_question_generate.json
    │   ├── mock_question_audit_pass.json
    │   ├── mock_question_audit_fail.json
    │   ├── mock_essay_grade.json
    │   └── mock_reference_answer.json
    └── questions/
        └── sample_real_exams.json    # B21 import 测试用
```

---

## 3. Invariant 测试（关键）

### 3.1 题源边界

#### test_question_source_immutable.py（PR2）

```python
async def test_update_source_raises():
    q = await create_question(source='real_exam')
    with pytest.raises(IntegrityError):
        q.source = 'ai_generated'
        await db.commit()

async def test_alembic_doesnt_allow_drop_trigger():
    # 验证 trigger 在 migration 中正确创建
    ...
```

#### test_inactive_question_excluded.py（PR4）

```python
async def test_inactive_ai_question_not_in_pool_query():
    inactive = await create_question(source='ai_generated', is_active=False)
    result = await pool_query.query_not_done(config=...)
    assert inactive.id not in [q.id for q in result]

async def test_inactive_question_still_visible_in_user_history():
    """用户已答过的下线题，复盘时仍可见"""
    ...
```

### 3.2 答题节奏闭卷（Pace-Closed-Book）

#### test_strict_closed_book.py

```python
async def test_full_set_blocks_view_solution_before_submit():
    session = await create_session(practice_mode='full_set')
    response = await client.post(f"/sessions/{session.id}/answers/{answer_id}/view-solution")
    assert response.status_code == 403
    assert response.json()['code'] == 'STRICT_CLOSED_BOOK'

async def test_per_question_allows_view_solution():
    session = await create_session(practice_mode='per_question')
    response = await client.post(f"/sessions/{session.id}/answers/{answer_id}/view-solution")
    assert response.status_code == 200

async def test_full_set_after_submit_unlocks():
    session = await create_session(practice_mode='full_set')
    await submit_session(session.id)
    response = await client.post(f"/sessions/{session.id}/answers/{answer_id}/view-solution")
    assert response.status_code == 200
```

### 3.3 AI 出题完整或失败（PR-AI-G）

#### test_ai_generation_complete_or_fail.py

```python
async def test_pool_full_returns_count():
    config = make_config(count=10)
    await populate_pool_with(15)
    result = await generate_questions(config)
    assert len(result.question_ids) == 10

async def test_pool_partial_falls_back_to_llm(mock_llm):
    config = make_config(count=10)
    await populate_pool_with(3)
    mock_llm.question_generation.return_value = [...]   # 7 道
    result = await generate_questions(config)
    assert len(result.question_ids) == 10

async def test_audit_all_fail_raises(mock_llm):
    """LLM 自审全失败 → AI_AUDIT_FAILED"""
    mock_llm.question_audit.return_value = AuditResult(passed=False, ...)
    with pytest.raises(LlmServiceError, match='AI_AUDIT_FAILED'):
        await generate_questions(make_config(count=10))

async def test_quota_exhausted_raises():
    """配额用完 → AI_QUOTA_EXCEEDED，且不调 LLM"""
    await consume_quota(user_id, 'question_generation', 30)
    with pytest.raises(ServiceError, match='AI_QUOTA_EXCEEDED'):
        await generate_questions(make_config(count=10))
```

### 3.4 进度独立于 source / event status

#### test_stat_independent_of_source.py

```python
async def test_ai_question_contributes_equally():
    """答 AI 题 vs 真题，进度数据贡献相同"""
    real_session = await answer_questions(source='real_exam', accuracy=0.8)
    ai_session = await answer_questions(source='ai_generated', accuracy=0.8)
    snapshot = await get_user_stats(user_id, type='xingce')
    assert snapshot.accuracy == 0.8  # 不区分 source

async def test_unlinked_session_contributes_to_stats():
    """unlinked session（不绑定 plan event）也贡献进度"""
    session = await create_session(linked_plan_event_id=None)
    await answer_correctly(session)
    snapshot = await get_user_stats(user_id)
    assert snapshot.total_questions > 0
```

### 3.5 题级笔记可见性

#### test_note_visibility.py

```python
async def test_user_a_cannot_read_user_b_question_note():
    note = await create_note(user_id=user_a.id, linked_question_id=q.id)
    response = await client.get(f"/notes/{note.id}", as_user=user_b)
    assert response.status_code == 404  # 越权伪装为 not found
```

### 3.6 标记基础 vs 持久

#### test_flag_basic_vs_persistent.py

```python
async def test_session_flag_doesnt_create_persistent_flag_until_submit():
    session = await create_session()
    answer = await flag_answer(session.id, answer_id, flagged=True)
    assert answer.flagged is True

    persistent = await db.execute(
        select(QuestionFlagV2).where(QuestionFlagV2.user_id == user_id)
    ).scalars().all()
    assert len(persistent) == 0  # session 进行中不写持久层

async def test_submit_creates_persistent_flag_for_flagged_answers():
    session = await create_session()
    await flag_answer(session.id, answer_id, flagged=True)
    await submit_session(session.id)

    persistent = await db.execute(
        select(QuestionFlagV2).where(QuestionFlagV2.user_id == user_id)
    ).scalars().all()
    assert len(persistent) == 1
    assert persistent[0].reason == FlagReason.UNCERTAIN

    # 同时入复盘队列
    review = await db.execute(
        select(ReviewItemV2).where(ReviewItemV2.user_id == user_id)
    ).scalars().all()
    assert len(review) >= 1
    assert any(r.reason == 'flagged_persistent' for r in review)
```

### 3.7 timing invariant（B25 / 11 §7）

#### test_timing_invariant.py

7 条 Timing-* invariant 各一个测试 case + heartbeat-out-of-scope：

```python
# Timing-Monotonic
async def test_event_order_violation_returns_422(): ...

# Timing-Bounded-Per-Visit
async def test_single_visit_clamped_to_60s(): ...

# Timing-Sum-Lte-Wall
async def test_total_active_seconds_lte_wall_clock(): ...

# Timing-Active-Plus-Pause-Lte-Wall
async def test_active_plus_pause_within_5s_tolerance(): ...

# Timing-Overtime-Has-Baseline
async def test_overtime_requires_min_samples_baseline(): ...

# Timing-No-Stale-Event
async def test_stale_event_rejected_422(): ...

# Timing-Status-Writable
async def test_terminal_session_rejects_timing_events(): ...

# Timing-Heartbeat-Out-Of-Scope（00 Timing-4 修订）
async def test_timing_endpoint_rejects_heartbeat_event_type(): ...
```

### 3.8 session_lifecycle invariant（B26 / 12 §10）

#### test_session_lifecycle_invariant.py

12 条 Session-LC-* invariant 各一个测试 case：

```python
# Session-LC-Status-Closed（用 evaluate_transition truth table 单测覆盖）
async def test_evaluate_transition_truth_table(): ...

# Session-LC-Terminal-Immutable
async def test_terminal_session_status_change_blocked_by_trigger(): ...

# Session-LC-Terminal-Writes-Forbidden
async def test_terminal_session_rejects_mutation_endpoints(): ...

# Session-LC-Resume-Adds-Pause-Time
async def test_resume_accumulates_paused_total_seconds(): ...

# Session-LC-Pause-Single-Active（DB CHECK paused_at_status_consistency）
async def test_paused_at_consistent_with_status(): ...

# Session-LC-Heartbeat-No-Terminal
async def test_heartbeat_to_terminal_does_not_write(): ...

# Session-LC-Heartbeat-Wakes-Paused（决策 LC-3a）
async def test_heartbeat_to_paused_implicitly_resumes(): ...

# Session-LC-Heartbeat-No-Draft-Wake（决策 LC-2）
async def test_heartbeat_to_draft_does_not_transition(): ...

# Session-LC-Force-Submit-Audit
async def test_force_submit_writes_audit_with_reason(): ...

# Session-LC-Daily-Expire-Type
async def test_expired_only_for_daily_source_mode(): ...

# Session-LC-Draft-No-Answers
async def test_draft_session_has_no_answer_writes(): ...

# Session-LC-Recovery-Chain
async def test_recovered_from_must_point_to_abandoned(): ...
```

### 3.9 mock_exam invariant（B27 / 13 §8）

#### test_mock_exam_invariant.py

12 条 MockExam-* invariant 各一个测试 case：

```python
# MockExam-Schema-Coupling（4 条 DB CHECK）
async def test_schema_coupling_check_constraints(): ...

# MockExam-AutoSubmit-Immutable
async def test_auto_submit_at_immutable_after_set(): ...

# MockExam-No-Pause-By-Default
async def test_pause_blocked_when_allow_pause_false(): ...

# MockExam-No-Heartbeat-Pause
async def test_exam_mode_session_not_paused_by_cleanup_cron(): ...

# MockExam-Force-Submit-On-Timeout
async def test_force_submit_within_60s_after_auto_submit_at(): ...

# MockExam-Closed-Book-Strict
async def test_view_solution_blocked_before_submit(): ...

# MockExam-Delayed-Review
async def test_delayed_review_blocks_explanation_after_submit(): ...

# MockExam-Notes-Forbidden
async def test_question_note_creation_blocked_during_mock(): ...

# MockExam-Force-Submit-Audit
async def test_force_submit_audit_with_reason_mock_exam_timeout(): ...

# MockExam-Time-Limit-Range
async def test_time_limit_minutes_range_10_to_360(): ...

# MockExam-Paper-Eligibility
async def test_paper_under_min_questions_rejected(): ...

# MockExam-Submit-Includes-Unanswered
async def test_force_submit_keeps_unanswered_as_null(): ...
```

### 3.10 question_report invariant（B30 / 01 §17）

#### test_question_report_invariant.py

13 条 PR-Report-* invariant 各一个测试 case：

```python
# PR-Report-Active-Unique
async def test_active_report_unique_per_user_question_category(): ...

# PR-Report-Description-Length
async def test_description_length_10_to_1000(): ...

# PR-Report-Owner-Read
async def test_user_only_reads_own_reports(): ...

# PR-Report-Resolved-Requires-Admin
async def test_resolved_requires_handled_by_admin_id_at_response(): ...

# PR-Report-Terminal-Immutable
async def test_resolved_status_cannot_change(): ...

# PR-Report-Fix-Only-When-Fixed
async def test_applied_fix_iff_resolved_fixed(): ...

# PR-Report-Dup-Only-When-Duplicate
async def test_duplicate_of_iff_resolved_duplicate(): ...

# PR-Report-AutoDeactivate
async def test_ai_question_auto_deactivate_at_5_reports(): ...

# PR-Report-Real-Exam-No-AutoDeactivate
async def test_real_exam_never_deactivated_by_reports(): ...

# PR-Report-Audit-Required
async def test_status_change_writes_audit(): ...

# PR-Report-Fix-Audit-Question-Mutation
async def test_apply_fix_writes_two_audits(): ...

# PR-Report-Rate-Limit-Per-User
async def test_rate_limit_20_per_day_per_user(): ...

# PR-Report-Rate-Limit-Per-Question（仅 metric，不强拒绝）
async def test_high_pending_count_writes_metric_not_429(): ...
```

### 3.11 practice_preferences invariant（B28 / 14 §8）

详见 14 §8 Pref-* 共 10 条；测试集中在 `tests/modules/practice_preferences/test_*.py`，不单独建 invariant 文件（与 module test 重合度高，统一 module 内）。Gate 时按 Pref-* 全过 + KeyBindings root_validator 11 binding 完整 truth table。

### 3.12 question_metadata Phase 1 invariant（B29 / 15 §6）

详见 15 §6 QMeta-* 共 9 条；测试集中在 `tests/modules/question_metadata/test_phase1_empty.py`、`test_field_default_backfill.py`、`test_lint_tag_format.py`，不单独建 invariant 文件。Gate 时按 QMeta-* 全过 + 两表 alembic 后空 + service 层 import 失败（lint 检查捕获）。

---

## 4. E2E 测试（关键场景）

### 4.1 完整 AI 出题闭环

```python
async def test_e2e_ai_question_full_flow(mock_llm):
    """
    用户登录 → 自定义对话框配置 AI 出题 → 等待 → 进 session → 答题 → 提交 → 看结果
    """
    user = await create_user_with_history()  # 有真题答题历史

    # 1. 配置 + 触发
    response = await client.post("/api/v2/practice/ai-questions/generate", json={
        "config": {
            "type": "xingce",
            "category_l1": "yanyu",
            "year_range": "recent_3",
            "difficulty_range": [0.6, 0.8],
            "count": 10,
        }
    }, headers={"Idempotency-Key": "test-key-1"})
    assert response.status_code == 200
    data = response.json()
    assert len(data['questionIds']) == 10
    assert data['status'] in ('partial_pool', 'llm_generated')

    # 2. 创建 session
    session_response = await client.post("/api/v2/practice/sessions", json={
        "mode": "ai_generated",
        "config": {"questionIds": data['questionIds']},
        "practiceMode": "full_set",
    })
    session_id = session_response.json()['id']

    # 3. 答题（前 5 题正确，后 5 题错）
    ...

    # 4. 提交
    await client.post(f"/api/v2/practice/sessions/{session_id}/submit")

    # 5. 看结果
    result = await client.get(f"/api/v2/practice/sessions/{session_id}/result")
    assert result.json()['accuracy'] == 0.5

    # 6. 验证 audit
    audits = await get_audits(target_id=session_id)
    assert any(a['action'] == 'session.submit' for a in audits)
```

### 4.2 申论批改异步流程

```python
async def test_e2e_essay_grading_async(mock_llm):
    submission_id = await submit_essay(...)

    # 立即查询：pending
    status = await client.get(f"/api/v2/practice/essay/submissions/{submission_id}/grading-status")
    assert status.json()['status'] == 'pending_grading'

    # 等待后台任务（mock 立即返回）
    await wait_for_background_task()

    # 查询：graded
    status = await client.get(f"/api/v2/practice/essay/submissions/{submission_id}/grading-status")
    assert status.json()['status'] == 'graded'

    # 拉取结果
    result = await client.get(f"/api/v2/practice/essay/submissions/{submission_id}/result")
    assert result.json()['report']['totalScore'] > 0
```

### 4.3 题级笔记跨 tab 联动

```python
async def test_e2e_question_note_cross_tab():
    # Tab 2 答题时加笔记
    note_id = await create_question_note(question_id=q.id, body="...")

    # Tab 4 列表能看到
    notes_list = await client.get("/api/v2/notes?filter=question_linked")
    assert any(n['id'] == note_id for n in notes_list.json())

    # 点击跳转到题详情
    response = await client.get(f"/api/v2/practice/questions/{q.id}")
    assert response.status_code == 200
    detail = response.json()
    assert any(n['id'] == note_id for n in detail['userNotes'])
```

---

## 5. 前端测试

### 5.1 工具

继承 Phase-Home：vitest + RTL + MSW + axe-core。

### 5.2 关键 e2e 场景

详见 [04-Frontend-WU §11](./04-Frontend-WU.md#11-wu-f18-e2e-msw-a11y-test)。

#### 5.2.1 整组模式严格闭卷（前端校验）

```ts
test('full_set mode hides solution panel', () => {
  render(<PracticeSession sessionId={1} />, {
    msw: { sessionMode: 'full_set', status: 'in_progress' },
  });
  expect(screen.queryByTestId('solution-panel')).not.toBeInTheDocument();
  expect(screen.queryByText('查看解析')).not.toBeInTheDocument();
});

test('per_question mode shows solution after answering', async () => {
  render(<PracticeSession sessionId={1} />, {
    msw: { sessionMode: 'per_question' },
  });
  await answerQuestion('A');
  expect(screen.getByTestId('solution-panel')).toBeInTheDocument();
});
```

#### 5.2.2 AI 出题等待页

```ts
test('shows progressive labels during waiting', async () => {
  render(<AiQuestionsGenerating config={...} />);
  expect(screen.getByText('分析弱项...')).toBeInTheDocument();
  await advanceTime(5000);
  expect(screen.getByText('改编题目...')).toBeInTheDocument();
});

test('falls back to real exam on 503', async () => {
  msw.use(http.post('/api/v2/practice/ai-questions/generate', () =>
    HttpResponse.json({ code: 'AI_AUDIT_FAILED' }, { status: 503 })
  ));
  render(<AiQuestionsGenerating config={...} />);
  await waitFor(() => expect(screen.getByText('切换到真题')).toBeInTheDocument());
});
```

#### 5.2.3 双滑块 a11y

```ts
test('difficulty range slider keyboard accessible', async () => {
  render(<DifficultyRangeSlider value={[0, 1]} onChange={vi.fn()} />);
  const lowerThumb = screen.getByLabelText('最低难度');
  lowerThumb.focus();
  await userEvent.keyboard('{ArrowRight}');
  // 验证值改变
});

test('axe-core passes', async () => {
  const { container } = render(<CustomPracticeDialog />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 6. 完工 Gate

### 6.1 后端完工（M10）

WU-B24 PR 全部合并后：

- [ ] `pytest -q` 全绿（含 invariant + e2e + cron）
- [ ] `alembic upgrade head` + `alembic downgrade -1` 来回干净
- [ ] OpenAPI drift 测试 0 diff
- [ ] LLM mock provider 跑通所有新 prompt（4 个）
- [ ] 真 LLM provider 手动跑通 question_generation / essay_grading / reference_generation
- [ ] cron 在 dev 环境按时跑（4 个新 cron + 1 增量 hook）
- [ ] 真题 import 脚本 dry-run + 小批量正式导入测试通过
- [ ] AuditLogV2 写入正确（每个变更事件都有记录）
- [ ] 配额 / 限流测试通过
- [ ] 整组模式严格闭卷 invariant 0 失败
- [ ] **B25-B30 invariant 全过**：
  - [ ] 7 条 Timing-* invariant 0 失败（§3.7）
  - [ ] 12 条 Session-LC-* invariant 0 失败（§3.8）
  - [ ] 12 条 MockExam-* invariant 0 失败（§3.9）
  - [ ] 13 条 PR-Report-* invariant 0 失败（§3.10）
  - [ ] 10 条 Pref-* invariant 0 失败（§3.11，集中在 module test 内）
  - [ ] 9 条 QMeta-Phase1-* invariant 0 失败（§3.12，集中在 module test 内）
- [ ] **B25-B30 cron 在 dev 环境按时跑**：
  - [ ] recompute_question_timing_baseline（周一 03:00）
  - [ ] cleanup_stale_sessions（每 5min）+ MockExam-Heartbeat-Bypass 联合测试
  - [ ] expire_daily_sessions（每日 23:55）
  - [ ] mock_exam_auto_submit_cron（每分钟，最大延迟 60s 兜底）
  - [ ] B23.1 ai_cleanup_cron 中 question_report 同步 hook 正确
- [ ] **B25-B30 模块 e2e**（详见 §2 e2e/practice/test_*.py）：
  - [ ] timing_buffer_to_report（buffer flush → report 完整链路）
  - [ ] lifecycle_full_flow（DRAFT → IN_PROGRESS → PAUSED（cron）→ 心跳 resume → SUBMITTED）
  - [ ] mock_exam_force_submit（倒计时归零 cron 兜底 60s 内）
  - [ ] preferences_schema_mismatch（422 → refetch 自恢复）
  - [ ] question_report_admin_loop（用户提报 → admin acknowledge → resolved_fixed + question 字段更新双 audit）

### 6.2 前端完工（M19）

WU-F18 PR 全部合并后：

- [ ] vitest --run 全绿（含 e2e + invariant + a11y）
- [ ] tsc --strict 0 errors
- [ ] 9 lint:* 全过（含 lint-no-inline-prompt 如已加）
- [ ] bundle 预算未超（CI 检查）
- [ ] 桌面 + 移动 viewport e2e 全过
- [ ] axe-core 0 violation
- [ ] 暗色模式 smoke
- [ ] 整组模式严格闭卷验证（前端 UI 不显示 + 后端 403 拒绝双重）
- [ ] 题级笔记跨 tab 联动 e2e 通过
- [ ] AI 出题三种路径 e2e 全覆盖（成功 / 失败 / 限流）
- [ ] 申论异步批改 polling e2e 通过
- [ ] **F19-F22 模块 e2e**（详见 04-Frontend-WU §15 F18 增量 + 各模块 unit）：
  - [ ] F19 timing buffer flush + IndexedDB 兜底（断网重连）
  - [ ] F19 timing 端点不接受 heartbeat 类型（前端 lint 保证）
  - [ ] F20 心跳唤醒 PAUSED + DRAFT 不被唤醒（决策 LC-3a / LC-2 客户端对齐）
  - [ ] F21 倒计时 drift 修正（客户端时钟 ±60s）+ 前端归零自动 submit
  - [ ] F22 schema_version mismatch 自动恢复 + KeyBinding 客户端唯一性校验

### 6.3 联调完工（合并 M10 + M19 之后）

- [ ] 真 LLM provider 跑通：用户从首页计划事件 CTA 进入 session（linked）→ 答题 → 进度 / 推荐随之更新（继承 Phase-Home）
- [ ] 用户加练 unlinked session → 进度更新 + 实绩块在首页日历显示
- [ ] 标记的题进 Tab 3 复盘队列（即使 Tab 3 还没启动，数据层正确）
- [ ] 题级笔记从 Tab 2 创建 → Tab 4 立即可见（即使 Tab 4 还没启动，数据层正确）

---

## 7. CI 配置增量

`.github/workflows/practice-ci.yml`（如已有 main CI 则集成进去）：

```yaml
jobs:
  backend:
    steps:
      - run: alembic upgrade head
      - run: alembic downgrade -1 && alembic upgrade head
      - run: pytest tests/modules/ -m "ai_questions or daily_practice or essay_grading or practice_stats or favorites or question_flags or session or content"
      - run: pytest tests/invariant/ -v
      - run: pytest tests/e2e/practice/ -v
      - run: pytest tests/cron/ -v
      - run: pytest tests/spec/test_openapi_drift.py
      - run: pytest tests/scripts/test_import_real_exams.py

  frontend:
    steps:
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test --run
      - run: pnpm test:a11y
      - run: pnpm build
      - run: pnpm bundle-size-check
```

---

## 8. 测试数据 fixtures

### 8.1 题库 fixture

`tests/fixtures/questions/sample_real_exams.json`：
- 50 道真题样本
- 覆盖 5 个一级分类 × 至少 2 个二级分类
- 5 个不同年份（2020-2024）
- 5 个不同地区

用途：
- B21 import 脚本测试
- pool_query 测试
- 各 e2e 测试

### 8.2 LLM mock fixtures

`tests/fixtures/llm/`：
- 见 [05-LLM-Module §7](./05-LLM-Module.md#7-mock-provider-扩展b224)

---

## 9. 关联文档

- [Phase-Home 10-Testing](../Home/10-Testing.md) - 通用测试规范
- [01-Boundary-Rules §11](./01-Boundary-Rules.md#11-invariant-测试要求) - 每条边界规则的 invariant 测试要求
- [03-Backend-WU §16 / §19-§24](./03-Backend-WU.md) - WU-B24（基础 e2e）+ B25-B30 各模块 PR 拆分
- [04-Frontend-WU §11 / §12-§15](./04-Frontend-WU.md) - WU-F18 + F19-F22 各模块前端 WU
