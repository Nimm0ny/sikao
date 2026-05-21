# Phase-Practice · 07 · AI Question Engine

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Module**: `modules/ai_questions/`（新建，详见 [03-Backend-WU §10](./03-Backend-WU.md#10-wu-b18-ai_questions-模块新建)）
> **决策来源**：`00-Decisions.md` AI-G-* 系列 + D-Q13

---

## 1. 模块定位

### 1.1 职责边界

| 模块 | 包含 | 不包含 |
|---|---|---|
| **ai_questions**（本模块） | 三段退化算法 / 池子查询 / 调 LLM 编排 / 入库 / 用户反馈聚合 / 限流 / 幂等 | LLM 本身的 prompt 与生成逻辑（在 `modules/llm/`）/ session 创建（在 `modules/session/`）|
| `modules/llm/application/question_generator.py` | LLM 调用封装、self-audit、parser | 业务编排 |
| `modules/session/application/ai_picker.py` | 调本模块 generate API + 把结果传给 session.create | 出题逻辑 |

### 1.2 文件结构

```
modules/ai_questions/
  __init__.py
  application/
    service.py                  # 主入口 + 三段退化算法
    pool_query.py               # 池子查询（第一二步）
    llm_orchestrator.py         # LLM 调用编排（第三步）
    persist.py                  # 入库 + content_hash 去重
    feedback.py                 # 用户反馈聚合
    quota.py                    # 用户日配额检查
  domain/
    types.py                    # AiGenerateConfig / AiGenerateResult
    errors.py
  interface/
    routes.py
    schemas.py
```

---

## 2. 核心算法：三段退化（D-Q13）

### 2.1 输入

```python
@dataclass
class AiGenerateConfig:
    user_id: int
    type: PracticeType                    # xingce | essay
    category_l1: str | None
    category_l2: str | None
    year_range: YearRange                 # all | recent_3 | recent_5 | recent_10
    difficulty_range: tuple[float, float] # 历史正确率区间
    count: int                            # 5 / 10 / 15 / 20 / 30
    exclude_already_done: bool = True
    only_wrong: bool = False
```

### 2.2 主算法（伪代码）

```python
async def generate_questions(config: AiGenerateConfig) -> AiGenerateResult:
    """
    返回 count 道题，要么完整，要么 raise（PR3）
    """
    # 0. 配额检查（每用户每日上限 30 次实时生成）
    await quota.check_and_reserve(config.user_id, "question_generation")

    request_record = await create_request_record(config)

    try:
        # === 第一步：池子里筛"用户没做过"的 ===
        not_done = await pool_query.query_not_done(
            config=config,
            limit=config.count,
        )
        if len(not_done) >= config.count:
            await complete_request_record(request_record, status="partial_pool", pool_ids=not_done)
            return AiGenerateResult(question_ids=not_done, status="partial_pool")

        # === 第二步：池子里筛"用户已做过"的（补够） ===
        already_done = await pool_query.query_already_done(
            config=config,
            limit=config.count - len(not_done),
            exclude_ids=[q.id for q in not_done],
        )
        pool_total = not_done + already_done
        if len(pool_total) >= config.count:
            pool_ids = [q.id for q in pool_total]
            await complete_request_record(request_record, status="partial_pool", pool_ids=pool_ids)
            return AiGenerateResult(question_ids=pool_ids, status="partial_pool")

        # === 第三步：实时生成补足 ===
        needed = config.count - len(pool_total)
        new_questions = await llm_orchestrator.generate_with_audit(
            config=config,
            count=needed,
        )

        # 入库 + 去重
        saved_ids = await persist.save_with_dedupe(new_questions)
        all_ids = [q.id for q in pool_total] + saved_ids

        await complete_request_record(
            request_record,
            status="llm_generated",
            pool_ids=[q.id for q in pool_total],
            llm_ids=saved_ids,
        )
        return AiGenerateResult(question_ids=all_ids, status="llm_generated")

    except LlmServiceError as e:
        await fail_request_record(request_record, error=e)
        await quota.release(config.user_id, "question_generation")  # LLM 失败不扣配额
        raise
```

---

## 3. 三段退化逻辑细节

### 3.1 第一步：用户没做过的题

```python
async def query_not_done(config: AiGenerateConfig, limit: int) -> list[Question]:
    # 1. 用户已答题 ID 集合
    done_ids = await db.execute(
        select(PracticeSessionAnswerV2.question_id)
        .join(PracticeSessionV2)
        .where(PracticeSessionV2.user_id == config.user_id)
        .where(PracticeSessionV2.status == 'submitted')
    ).scalars().all()

    # 2. 池子查询
    query = (
        select(QuestionV2)
        .where(QuestionV2.source.in_(['ai_generated', 'ai_modified']))  # 仅 AI 题池
        .where(QuestionV2.is_active == True)
        .where(QuestionV2.id.notin_(done_ids))
    )
    query = apply_filters(query, config)
    query = query.order_by(func.random()).limit(limit)

    return (await db.execute(query)).scalars().all()
```

`apply_filters` 处理 category_l1/l2 / year_range / difficulty_range / exclude_already_done / only_wrong 等。

### 3.2 第二步：用户已做过的题

仅去掉 `notin_(done_ids)` 条件，加上 `id.notin_(first_step_ids)`（避免重复）。

### 3.3 第三步：LLM 实时生成

```python
async def generate_with_audit(config: AiGenerateConfig, count: int) -> list[GeneratedQuestion]:
    # 1. 选改编源（从真题池抽 count*2 道）
    sources = await pick_source_questions(
        category_l1=config.category_l1,
        category_l2=config.category_l2,
        year_range=config.year_range,
        limit=count * 2,
    )
    if not sources:
        # 没有改编源（罕见情况：分类下完全没真题）
        raise LlmServiceError(code='NO_SOURCE_QUESTIONS')

    # 2. 调 LLM 一次生成 count 道
    candidates = await llm.generate_questions(
        sources=sources,
        target_difficulty=config.difficulty_range,
        count=count,
        user_id=config.user_id,
    )

    # 3. 自审（每道独立调一次，并行）
    audited = []
    audit_tasks = [llm.self_audit_question(q) for q in candidates]
    audit_results = await asyncio.gather(*audit_tasks)
    for q, result in zip(candidates, audit_results):
        if result.passed:
            q.ai_self_audit_passed = True
            audited.append(q)
        else:
            log_audit_fail(q, result)

    # 4. 不够时重试 1 次（生成多余的题，多余的也保留）
    if len(audited) < count:
        retry_count = max(count - len(audited), 5)  # 至少多生成 5 个 buffer
        retry_audited = await retry_generate_with_audit(config, retry_count)
        audited.extend(retry_audited)

    if len(audited) < count:
        raise LlmServiceError(code='AI_AUDIT_FAILED')

    return audited[:count]
```

---

## 4. content_hash 去重（防重复）

### 4.1 hash 计算

```python
def compute_question_hash(stem: str, options: dict, correct_answer: str) -> str:
    """
    内容 hash：题干 + 选项排序后内容 + 答案
    用 BLAKE2b（短 + 快）
    """
    normalized_options = "|".join(f"{k}:{v.strip()}" for k, v in sorted(options.items()))
    payload = f"{stem.strip()}|{normalized_options}|{correct_answer}"
    return hashlib.blake2b(payload.encode(), digest_size=16).hexdigest()
```

### 4.2 入库时去重

```python
async def save_with_dedupe(questions: list[GeneratedQuestion]) -> list[int]:
    saved_ids = []
    for q in questions:
        content_hash = compute_question_hash(q.stem, q.options, q.correct_answer)
        existing = await db.execute(
            select(QuestionV2).where(QuestionV2.content_hash == content_hash)
        ).scalar_one_or_none()
        if existing:
            saved_ids.append(existing.id)  # 命中已有题
            continue

        new_question = QuestionV2(
            source='ai_generated',
            ai_source_question_id=q.source.id,
            stem=q.stem,
            options=q.options,
            correct_answer=q.correct_answer,
            explanation=q.explanation,
            category_l1=q.source.category_l1,  # 继承源真题
            category_l2=q.source.category_l2,
            year=q.source.year,
            region=q.source.region,
            exam_type=q.source.exam_type,
            historical_accuracy=q.estimated_difficulty,
            answer_count=0,
            quality_score=5.0,
            report_count=0,
            is_active=True,
            ai_self_audit_passed=True,
            ai_generated_at=now_utc(),
            content_hash=content_hash,  # 新增字段（B10 加）
        )
        db.add(new_question)
        await db.flush()
        saved_ids.append(new_question.id)

    await db.commit()
    return saved_ids
```

⚠️ ~~`content_hash` 字段需要在 [02-Data-Model §2.1](./02-Data-Model.md#21-questionv2最重要的扩展) 加上（之前漏了，B10.2 PR 时补）~~。**已补**：见 02-Data-Model §2.1 字段定义 + §4 索引策略。

---

## 5. 用户反馈聚合（quality_score）

### 5.1 反馈触发

用户在答完 AI 题后可以点：
- 点赞（quality_score += 1）
- 举报（report_count += 1）

```python
async def submit_feedback(question_id: int, action: FeedbackAction, user_id: int, note: str | None):
    question = await get_question(question_id)
    if question.source not in ('ai_generated', 'ai_modified'):
        raise ValueError("仅 AI 题可反馈")

    # 写入 audit
    await audit_log.write(
        actor=user_id,
        action=f"ai_question.feedback.{action}",
        target_type="QuestionV2",
        target_id=question_id,
        before={"quality_score": question.quality_score, "report_count": question.report_count},
        ...
    )

    # 更新 question 字段
    if action == "like":
        question.quality_score = recompute_quality_score(question, delta=1)
    elif action == "report":
        question.report_count += 1

    await db.commit()
```

### 5.2 quality_score 计算公式

```python
def recompute_quality_score(question: QuestionV2, delta: int) -> float:
    """
    quality_score 范围 0.0-5.0
    - 起始 5.0
    - 每个点赞 +0.05（线性，避免单一用户拉高）
    - 每个举报 -0.5（举报权重远高于点赞）
    - 同时考虑答题人次：低答题量的题置信度低（保留 4.0+）
    """
    base = 5.0
    likes_bonus = min(question.likes_count * 0.05, 1.0)
    reports_penalty = question.report_count * 0.5

    if question.answer_count < 5:
        # 早期数据少，保护
        return min(base + likes_bonus - reports_penalty, 5.0)

    return max(min(base + likes_bonus - reports_penalty, 5.0), 0.0)
```

### 5.3 自动下线（cron `cleanup_low_quality_ai_questions` 每日 04:30）

```python
async def cleanup_low_quality_ai_questions():
    threshold_score = 2.5
    threshold_reports = 5

    questions = await db.execute(
        select(QuestionV2)
        .where(QuestionV2.source.in_(['ai_generated', 'ai_modified']))
        .where(QuestionV2.is_active == True)
        .where(or_(
            QuestionV2.quality_score < threshold_score,
            QuestionV2.report_count >= threshold_reports,
        ))
    ).scalars().all()

    for q in questions:
        q.is_active = False
        await audit_log.write(
            actor='system',
            action="ai_question.auto_offline",
            target_type="QuestionV2",
            target_id=q.id,
            before={"is_active": True, "quality_score": q.quality_score, "report_count": q.report_count},
            after={"is_active": False},
            reason=f"quality_score={q.quality_score}, report_count={q.report_count}",
        )

    await db.commit()
```

---

## 6. 配额管理（quota.py）

### 6.1 检查与预留

```python
async def check_and_reserve(user_id: int, purpose: str):
    """
    使用 Redis-like store 计数（Stage 1 用 DB AiGeneratedQuestionRequestV2）
    """
    today_start = today_at_00_utc()
    used_count = await db.execute(
        select(func.count(AiGeneratedQuestionRequestV2.id))
        .where(AiGeneratedQuestionRequestV2.user_id == user_id)
        .where(AiGeneratedQuestionRequestV2.status == 'llm_generated')
        .where(AiGeneratedQuestionRequestV2.started_at >= today_start)
    ).scalar()

    daily_limit = QuotaLimits.PER_USER_PER_DAY[purpose]
    if used_count >= daily_limit:
        raise ServiceError(code='AI_QUOTA_EXCEEDED', http=429)
```

### 6.2 配额释放

```python
async def release(user_id: int, purpose: str):
    """LLM 失败时调用，避免占用配额"""
    # 找到最近一次 status=llm_generated 的请求，标记 status=failed（不计配额）
    ...
```

---

## 7. 幂等性（AI-G-9）

`POST /api/v2/practice/ai-questions/generate` 必带 `Idempotency-Key`。

```python
async def handle_generate_request(request: AiGenerateRequest, idempotency_key: str):
    # 命中幂等缓存（继承 Phase-Home WU-B1.4 的 IdempotencyKeyV2）
    cached = await idempotency_repo.get(
        key=idempotency_key,
        user_id=request.user_id,
        path="/api/v2/practice/ai-questions/generate",
    )
    if cached:
        # 不消耗用户配额，直接返回上次结果
        return cached.response

    # 走完整流程
    result = await generate_questions(request.config)

    await idempotency_repo.save(
        key=idempotency_key,
        user_id=request.user_id,
        path="/api/v2/practice/ai-questions/generate",
        request_hash=sha256(request.json()),
        response=result,
        ttl_seconds=3600,
    )
    return result
```

---

## 8. AiGeneratedQuestionRequestV2 审计

每次 generate 调用都写入完整记录（详见 [02-Data-Model §3.6](./02-Data-Model.md#36-aigeneratedquestionrequestv2)）：

```
{
  user_id: 123,
  request_params: {...},
  status: "llm_generated",
  pool_question_ids: [101, 102, 103],
  llm_generated_question_ids: [10001, 10002],
  llm_self_audit_passed_count: 2,
  llm_call_id: 5678,            # 关联 LlmCallV2
  started_at: "2026-05-21T03:00:00Z",
  completed_at: "2026-05-21T03:00:18Z",
  duration_ms: 18234,
}
```

用途：
- 审计：追踪每次 AI 出题的完整路径
- 限流：每日配额计数
- debug：失败案例分析
- 成本反查：通过 llm_call_id join 到 LlmCallV2 看具体成本

---

## 9. 性能预算

| 路径 | p50 | p95 | p99 |
|---|---|---|---|
| 第一步（池子有货） | 80ms | 200ms | 400ms |
| 第一+二步（部分退化） | 150ms | 400ms | 800ms |
| 完整三段（含 LLM） | 12s | 25s | 45s |
| 自审单题 | 1.5s | 4s | 8s |

数据库索引：
- `(category_l1, category_l2, source, is_active)`
- `(historical_accuracy, year, region)`
- `content_hash UNIQUE`

---

## 10. 错误处理矩阵

| 错误场景 | 后端响应 | 前端行为 |
|---|---|---|
| 没有改编源（罕见） | 503 NO_SOURCE_QUESTIONS | 提示"题库准备中，切换到真题模式" |
| LLM 调用 timeout | 503 LLM_SERVICE_UNAVAILABLE | 重试 1 次 → 仍失败 → 切真题 |
| LLM 输出无法解析 | 502 LLM_PARSE_FAILED | 同上 |
| LLM 自审全部失败 | 503 AI_AUDIT_FAILED | 同上 |
| 配额耗尽 | 429 AI_QUOTA_EXCEEDED | 提示"今日 AI 出题次数已用完" |
| 全局成本超限 | 503 LLM_GLOBAL_BUDGET_EXCEEDED | 提示"AI 服务今日额度已满" |

PR3：所有失败都返回 503/429，不阻塞用户切真题路径。

---

## 11. 测试策略

### 11.1 invariant 测试

- 三段退化总是返回 count 题（要么完整，要么明确报错）
- 池子查询不会返回 is_active=false 的题
- 已下线 AI 题不会出现在新出题中
- content_hash 命中时不重复入库
- 配额耗尽时第三步直接拒绝

### 11.2 contract 测试

- mock LLM 返回 count 道题 → 完整流程
- mock LLM 返回 < count 道题 → 退化失败
- mock LLM 自审 50% 通过 → 重试 1 次后凑齐
- mock LLM 自审全失败 → AI_AUDIT_FAILED
- 池子有 5 题，请求 10 题 → 调 LLM 5 题
- 池子 0 题，请求 10 题 → 调 LLM 10 题

### 11.3 性能测试

- 第一步（池子充足）p95 < 400ms
- 完整三段（mock LLM 0.5s/调用）p95 < 30s

详见 [10-Testing](./10-Testing.md)。

---

## 12. 关联文档

- [02-Data-Model §2.1 / §3.6](./02-Data-Model.md) - QuestionV2 / AiGeneratedQuestionRequestV2
- [03-Backend-WU §10](./03-Backend-WU.md#10-wu-b18-ai_questions-模块新建) - WU-B18 PR 拆分
- [05-LLM-Module §2.1-§2.2](./05-LLM-Module.md#21-question_generatorai-出题) - LLM 调用层
- [06-LLM-Prompts §2-§3](./06-LLM-Prompts.md#2-question_generatepyai-出题) - prompts
- [01-Boundary-Rules §1 / §7](./01-Boundary-Rules.md#1-题源边界pr1-pr4) - PR1-PR4 / PR-AI-G
- [00-Decisions §4](./00-Decisions.md#4-ai-出题ai-g-系列) - AI-G-* 决策
