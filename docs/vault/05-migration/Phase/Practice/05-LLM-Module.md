# Phase-Practice · 05 · LLM Module

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Prompt 模板**：见 `06-LLM-Prompts.md`
> **路径修订**：所有"`modules/llm_v2/`"应解读为"`modules/llm/`"（详见 [A0 §2.4](./A0-Codebase-Reality-Check.md#24-moduleslllm-与-tab-2-的关系重要)）。Phase-Home 已经在 `modules/llm/` 内建立完整框架，Tab 2 在此基础上**追加文件**，不重新设计。

---

## 1. 与 Phase-Home LLM 框架的关系

Phase-Home WU-B7 完工后，`modules/llm/` 已含：

```
modules/llm/
  application/
    service.py                    # facade 入口
    provider_registry.py          # provider 注册
    plan_generator.py             # 已建（首页 AI 制定计划）
    plan_adjustor.py              # 已建（首页 AI 调整提案）
    recommender.py                # 已建（首页 AI 推荐）
    recommender_policy.py         # 已建（阈值表）
    cache.py                      # 已建（LRU + DB 二级缓存）
    cost_tracker.py               # 已建（token 计数 + 成本聚合）
    sanitizer.py                  # 已建（输入清洗）
    parsers/
      base.py                     # 已建（ParserBase + 校验）
      plan_output_parser.py       # 已建
      adjustment_parser.py        # 已建
      recommendation_parser.py    # 已建
    prompts/
      plan_generate.py            # 已建
      plan_regenerate_range.py    # 已建
      plan_adjust.py              # 已建
      recommend_today.py          # 已建
      _shared.py                  # 已建（公用 SAFETY_FOOTER / POLICY_HEADER 等）
  domain/
    types.py                      # ChatMessage / LlmResponse / LlmRequest
    errors.py                     # LlmServiceError / LlmParseError 等
    quotas.py                     # 配额策略
  infrastructure/
    openai_compatible_provider.py # 统一基类
    deepseek_provider.py
    dashscope_provider.py
    mock_provider.py
```

**Tab 2 追加 3 个能力**：
- `question_generator.py` + 自审（B22.1）
- `essay_grader.py`（B22.2）
- `reference_answer_generator.py`（B22.3）

**完全复用**（无需扩展）：
- 配置层（LlmSettings）
- Provider 抽象与具体实现
- 重试与失败兜底（_with_retry）
- cost_tracker / sanitizer / cache
- _shared.py 中公用片段（SAFETY_FOOTER 等）
- LlmCallV2 审计写入

---

## 2. Tab 2 新增能力概述

### 2.1 question_generator（AI 出题）

**职责**：基于真题改编生成 AI 题。

**输入**：
- `category_l1` / `category_l2`：题型范围
- `year_range_filter`：源真题年份范围（用于选改编源）
- `target_difficulty_range`：目标难度区间（影响改编强度）
- `count`：需要生成的题数

**输出**：`list[GeneratedQuestion]`（已自审通过的）

**调用流程**：

```python
async def generate_questions(
    *,
    category_l1: str,
    category_l2: str | None,
    year_range_filter: tuple[int, int] | None,
    target_difficulty_range: tuple[float, float],
    count: int,
    user_id: int,  # 用于审计
) -> list[GeneratedQuestion]:
    # 1. 选改编源（从真题池随机抽 N 道，N >= count）
    source_questions = await pick_source_questions(
        category_l1, category_l2, year_range_filter, count * 2
    )

    # 2. 调 LLM 改编（一次调用生成 count 道）
    llm_response = await llm_service.chat_complete(
        system=question_generate.SYSTEM_PROMPT,
        messages=question_generate.render_messages(
            sources=source_questions,
            target_difficulty=target_difficulty_range,
            count=count,
        ),
        response_format={"type": "json_schema", "schema": question_generate.OUTPUT_SCHEMA},
        purpose="question_generation",  # cost_tracker 标签
    )

    # 3. parser 解析
    candidate_questions = question_parser.parse(llm_response.content)

    # 4. 自审（每道题独立调一次 LLM）
    audited = []
    for q in candidate_questions:
        audit_result = await self_audit_question(q)
        if audit_result.passed:
            audited.append(q)
        # 失败的直接丢弃，记 metric

    # 5. 如自审后 < count，重试 1 次（生成更多源 + 再调）
    if len(audited) < count:
        audited.extend(await retry_generate(count - len(audited)))

    if len(audited) < count:
        raise LlmServiceError(code='AI_AUDIT_FAILED')

    return audited[:count]
```

### 2.2 self_audit_question

**输入**：`candidate_question: GeneratedQuestion`

**输出**：`AuditResult { passed: bool, reason: str, confidence: float }`

```python
async def self_audit_question(question: GeneratedQuestion) -> AuditResult:
    audit_response = await llm_service.chat_complete(
        system=question_self_audit.SYSTEM_PROMPT,
        messages=question_self_audit.render_messages(question=question),
        response_format={"type": "json_schema", "schema": question_self_audit.OUTPUT_SCHEMA},
        purpose="question_audit",
        cache_ttl=86400,  # 同一题改编结果 24h 缓存
    )
    return audit_parser.parse(audit_response.content)
```

### 2.3 essay_grader（申论批改）

**职责**：批改用户申论答案并生成结构化报告。

**输入**：
- `question_stem`：题干
- `materials`：背景材料
- `user_answer`：用户答案
- `word_limit`：字数要求

**输出**：`GradingReport`（含 dimensions / highlights / issues / suggestions）

```python
async def grade_essay(
    *,
    question_stem: str,
    materials: str,
    user_answer: str,
    word_limit: int,
    user_id: int,
) -> GradingReport:
    response = await llm_service.chat_complete(
        system=essay_grade.SYSTEM_PROMPT,
        messages=essay_grade.render_messages(
            stem=question_stem,
            materials=materials,
            answer=user_answer,
            word_limit=word_limit,
        ),
        response_format={"type": "json_schema", "schema": essay_grade.OUTPUT_SCHEMA},
        purpose="essay_grading",
        timeout_seconds=60,  # 申论批改给更长 timeout
    )
    return grading_parser.parse(response.content)
```

### 2.4 reference_answer_generator（范文生成）

**职责**：为申论题生成范文。

**输入**：
- `question_stem`：题干
- `materials`：背景材料
- `word_limit`：字数

**输出**：`ReferenceAnswer { content, ai_self_audit_passed, audit_reason }`

```python
async def generate_reference_answer(
    *,
    question_stem: str,
    materials: str,
    word_limit: int,
) -> ReferenceAnswer:
    # 1. 生成范文
    response = await llm_service.chat_complete(
        system=reference_answer.SYSTEM_PROMPT,
        messages=reference_answer.render_messages(
            stem=question_stem,
            materials=materials,
            word_limit=word_limit,
        ),
        response_format={"type": "json_schema", "schema": reference_answer.OUTPUT_SCHEMA},
        purpose="reference_generation",
    )
    candidate = reference_parser.parse(response.content)

    # 2. 自审（独立调一次 LLM）
    audit = await self_audit_reference(candidate)

    return ReferenceAnswer(
        content=candidate.content,
        ai_self_audit_passed=audit.passed,
        audit_reason=audit.reason,
    )
```

---

## 3. 配置层增量

`services/api/src/sikao_api/core/config.py` 已有 `LlmSettings`（Phase-Home WU-B7）。Tab 2 不修改配置类，但**默认 timeout / retry 在 essay 路径上调**：

```python
# modules/llm/application/service.py 内的 facade 提供 purpose 参数

async def chat_complete(
    *,
    purpose: Literal[
        "plan_generation", "plan_adjustment", "recommendation_today",
        "question_generation", "question_audit", "essay_grading", "reference_generation",
    ],
    timeout_seconds: int | None = None,
    cache_ttl: int = 0,
    ...
) -> LlmResponse:
    effective_timeout = timeout_seconds or PURPOSE_TIMEOUTS[purpose]
    # PURPOSE_TIMEOUTS:
    # plan_generation: 30
    # plan_adjustment: 25
    # recommendation_today: 15
    # question_generation: 25
    # question_audit: 10
    # essay_grading: 60
    # reference_generation: 45
    ...
```

---

## 4. 配额与限流（Quotas）

### 4.1 用户级限流（每日）

| purpose | 默认配额 | 备注 |
|---|---|---|
| question_generation | 30 / 用户 / 日 | 每次包含 N 题（N=count） |
| question_audit | 不计入用户配额 | 派生自 generation，由系统消耗 |
| essay_grading | 5 / 用户 / 日 | 申论批改成本最高 |
| reference_generation | 10 / 用户 / 日 | 通常用户不主动触发 |

### 4.2 全局成本上限

cost_tracker 监控 daily token 用量，超阈值（默认 USD 50/day）触发：
- 邮件通知 admin
- 暂停所有 LLM 端点（503）
- 用户看到友好错误"今日服务额度已满，请明天再试"

### 4.3 quotas.py 扩展

```python
# modules/llm/domain/quotas.py 增量
class QuotaLimits:
    PER_USER_PER_DAY = {
        "plan_generation": 5,
        "plan_adjustment": 3,
        "recommendation_today": 50,
        "question_generation": 30,
        "essay_grading": 5,
        "reference_generation": 10,
    }
    GLOBAL_DAILY_USD_BUDGET = 50.0
```

---

## 5. 错误处理

继承 Phase-Home 错误体系。新增 Tab 2 特有错误：

| 错误 | 触发条件 | http | 用户提示 |
|---|---|---|---|
| `AI_AUDIT_FAILED` | 自审重试后仍失败 | 503 | "AI 出题质量未达标，请稍后重试或切换到真题模式" |
| `AI_QUOTA_EXCEEDED` | 用户日配额耗尽 | 429 | "今日 AI 出题次数已用完（30 次），明天再试或切换真题" |
| `ESSAY_GRADING_PENDING` | 批改进行中 | 200 | （前端显示 banner，不是错误） |
| `ESSAY_GRADING_FAILED` | 批改任务失败 | 200 | "AI 批改失败，请重试" + 重试按钮 |
| `LLM_GLOBAL_BUDGET_EXCEEDED` | 全局成本超限 | 503 | "AI 服务今日额度已满，请明日再试" |

---

## 6. 缓存策略

### 6.1 question_audit 缓存（关键）

同一题（按 content_hash）的自审结果可缓存 24h：
- 减少重复 LLM 调用
- 命中缓存时 cost_tracker 不计入新成本

```python
audit_cache_key = f"q_audit:{content_hash}"
cache_ttl = 86400  # 24h
```

### 6.2 reference_generation 缓存

同一申论题（question_id）的范文生成结果缓存 7 天：
- 命中时直接返回已缓存范文（不再重复调 LLM）
- 但用户每次访问看的是 EssayReferenceAnswerV2 中的最新数据，不直接用缓存

实际用途：避免高并发下同一题被多用户同时触发生成。

### 6.3 plan_generation / essay_grading 不缓存

输入差异化太大，缓存命中率低。

---

## 7. Mock Provider 扩展（B22.4）

`infrastructure/mock_provider.py` 按 prompt 关键字返回固定 fixture：

```python
MOCK_RESPONSES = {
    # Phase-Home 已有：
    "plan_generate": "...",
    "plan_adjust": "...",
    "recommend_today": "...",

    # Tab 2 新增：
    "question_generate": load_fixture("mock_question_generate.json"),
    "question_self_audit": load_fixture("mock_question_audit.json"),
    "essay_grade": load_fixture("mock_essay_grade.json"),
    "reference_answer": load_fixture("mock_reference_answer.json"),
}
```

Mock provider 在 CI 中默认启用（`LLM_PROVIDER=mock`），保证测试不依赖真 LLM。

Mock fixtures 文件：
- `tests/fixtures/llm/mock_question_generate.json`
- `tests/fixtures/llm/mock_question_audit.json`（含 passed=true 与 passed=false 两组）
- `tests/fixtures/llm/mock_essay_grade.json`
- `tests/fixtures/llm/mock_reference_answer.json`

---

## 8. 调用约束

继承 Phase-Home：
- LLM 模块**不暴露 HTTP 端点**（避免 prompt injection）
- 仅供其他业务模块（plans / recommendations / ai_questions / essay_grading）内部调用
- 所有调用走 `application/service.py` 的 facade 函数
- prompt 与 parser 必须有单测

---

## 9. 审计与可观测

### 9.1 LlmCallV2（继承 Phase-Home）

每次 LLM 调用自动写入 LlmCallV2：
- user_id
- purpose（question_generation / essay_grading / ...）
- prompt_version（来自 prompt 文件常量）
- model_used
- input_tokens / output_tokens
- duration_ms
- error_code（如失败）
- 响应内容 hash（不存原文，节省存储）

### 9.2 Tab 2 新增 metrics

```
llm.question_generation.success_total
llm.question_generation.failure_total{code}
llm.question_audit.passed_total
llm.question_audit.failed_total{reason}
llm.essay_grading.success_total
llm.essay_grading.failure_total{code}
llm.essay_grading.duration_seconds   (histogram)
llm.reference_generation.success_total
llm.reference_generation.cache_hit_total

quota.question_generation.exceeded_total{user_id}
quota.essay_grading.exceeded_total{user_id}
```

详见 [09-Observability-Audit](./09-Observability-Audit.md)。

---

## 10. 与上游模块的集成点

### 10.1 ai_questions 模块（B18）

调用：
```python
from modules.llm.application.question_generator import generate_questions

async def handle_ai_questions_request(...):
    # ai_questions 模块的核心
    new_questions = await generate_questions(
        category_l1=...,
        target_difficulty_range=...,
        count=...,
        user_id=...,
    )
    # 入库 + 用于本次 session
```

### 10.2 essay_grading 模块（B20）

调用：
```python
from modules.llm.application.essay_grader import grade_essay
from modules.llm.application.reference_answer_generator import generate_reference_answer

# 触发批改
async def grade_submission_async(submission_id: int):
    submission = await get_submission(submission_id)
    report = await grade_essay(
        question_stem=submission.question.stem,
        materials=submission.question.materials,
        user_answer=submission.answer,
        word_limit=submission.question.word_limit,
        user_id=submission.user_id,
    )
    await persist_report(submission_id, report)

# 范文生成
async def ensure_reference_answer(question_id: int):
    if await has_reference_answer(question_id):
        return
    ref = await generate_reference_answer(
        question_stem=q.stem,
        materials=q.materials,
        word_limit=q.word_limit,
    )
    await save_reference(question_id, ref, source='ai_generated')
```

---

## 11. 完工 Gate

WU-B22 完工标准：
- [ ] 3 个新 application module 实现 + 单测
- [ ] 4 个新 prompt 文件实现 + 版本号写入
- [ ] 3 个新 parser 实现 + 严格 JSON Schema 校验
- [ ] mock provider 扩展覆盖所有新 prompt
- [ ] 单测覆盖率 ≥ 85%
- [ ] 用真 provider（DeepSeek 或百炼）手动跑通：question_generation 1 次 / essay_grading 1 次 / reference_generation 1 次
- [ ] LlmCallV2 写入正确（每次调用一行）
- [ ] cost_tracker 计数正确
- [ ] 配额限流测试通过

---

## 12. 关联文档

- [06-LLM-Prompts](./06-LLM-Prompts.md) - 3 个新 prompt 模板的完整内容
- [03-Backend-WU §14](./03-Backend-WU.md#14-wu-b22-llm-模块扩展在-modulesllm-上追加) - WU-B22 PR 拆分
- [08-NonFunctional §3](./08-NonFunctional.md#3-性能预算) - LLM 端点 latency / cost 预算
- [09-Observability-Audit](./09-Observability-Audit.md) - LLM 审计与 metrics
- [Phase-Home 05-LLM-Module](../Home/05-LLM-Module.md) - LLM 模块基础（Tab 2 在此基础上追加）
- [Phase-Home 06-LLM-Prompts](../Home/06-LLM-Prompts.md) - Phase-Home 已有 prompt
