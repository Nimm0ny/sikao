# Phase-Review · 06 · AI Cause Analysis

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §5（AI-Cause-1 ~ AI-Cause-10）· [02-Data-Model](./02-Data-Model.md) §3.3

---

## 1. 概述

AI 错因分析模块提供两种模式：
- **单题分析**（scope=single）：针对单道错题，分析用户为何反复做错
- **多题聚合**（scope=group）：针对 2~20 道题的共性错误模式

100% 按需触发（D-R6），无自动订阅。复用 Phase-Home `modules/llm/` 基础设施（AI-Cause-1）。

---

## 2. LLM Prompt 模板

### 2.1 cause_analysis_single

文件位置：`services/api/src/sikao_api/modules/llm/prompts/cause_analysis_single.py`

```python
CAUSE_ANALYSIS_SINGLE_PROMPT = """
你是一位公务员考试辅导专家。请分析以下错题，找出学生反复做错的根本原因。

## 题目信息
- 题型：{question_type}
- 科目分类：{category_l1} > {category_l2}
- 题面：{question_body}
- 选项：{options_text}
- 正确答案：{correct_answer}
- 官方解析：{explanation}

## 学生答题记录
- 错误次数：{error_count}
- 最近一次选择：{last_user_answer}
- 历次选择记录：{answer_history}

## 输出要求
请严格以 JSON 格式输出，不要输出任何其他内容：
{{
  "summary": "200字以内的错因总结",
  "dimensions": [
    {{
      "name": "错因维度名称（如'概念混淆'/'计算粗心'/'审题不清'）",
      "severity": "high|medium|low",
      "suggestion": "具体建议"
    }}
  ],
  "suggested_actions": ["建议动作1", "建议动作2"],
  "related_questions": []
}}

约束：
- summary 不超过 200 字
- dimensions 最多 5 项
- suggested_actions 最多 3 项
- severity 只能是 high / medium / low
- related_questions 留空（后续由系统补充）
"""
```

### 2.2 cause_analysis_group

文件位置：`services/api/src/sikao_api/modules/llm/prompts/cause_analysis_group.py`

```python
CAUSE_ANALYSIS_GROUP_PROMPT = """
你是一位公务员考试辅导专家。请分析以下一组错题的共性错误模式。

## 题目组摘要（共 {question_count} 道）
{questions_summary}

每道题格式：
- 题型 | 分类 | 错误次数 | 最近错误选项

## 输出要求
请严格以 JSON 格式输出，不要输出任何其他内容：
{{
  "summary": "200字以内的组级错因总结，重点分析共性",
  "dimensions": [
    {{
      "name": "共性错因维度",
      "severity": "high|medium|low",
      "suggestion": "针对这组题的整体建议"
    }}
  ],
  "suggested_actions": ["组级建议动作1", "建议动作2"],
  "related_questions": []
}}

约束：
- 重点关注共性模式，而非逐题分析
- summary 不超过 200 字
- dimensions 最多 5 项
- suggested_actions 最多 3 项
"""
```

---

## 3. 输入 Schema

### 3.1 单题输入（发送到 LLM 前的结构化数据）

```python
@dataclass
class CauseAnalysisSingleInput:
    """单题分析输入，由 service 组装"""
    question_id: int
    question_type: str              # QuestionV2.question_type
    category_l1: str                # QuestionV2.category_l1
    category_l2: str                # QuestionV2.category_l2
    question_body: str              # QuestionV2.body (≤2000 chars truncated)
    options_text: str               # 格式化选项文本
    correct_answer: str             # QuestionV2.correct_answer
    explanation: str                # QuestionV2.explanation (≤1000 chars)
    error_count: int                # 该用户在此题的错误次数
    last_user_answer: str           # 最近一次错误答案
    answer_history: list[str]       # 历次答案列表（最近 10 次）
    last_answer_hash: str           # SHA-256(last_user_answer) — 缓存键组成
```

### 3.2 多题输入

```python
@dataclass
class CauseAnalysisGroupInput:
    """多题聚合分析输入"""
    question_ids: list[int]         # 2 ≤ len ≤ 20
    questions_summary: list[dict]   # 每题摘要
    # 每题摘要结构: {"id": int, "type": str, "category": str, "error_count": int, "last_wrong": str}
    question_ids_signature: str     # sorted(question_ids) 的 SHA-256 前 64 字符
```

---

## 4. 输出 Schema（校验规则）

```python
from pydantic import BaseModel, validator

class CauseAnalysisResult(BaseModel):
    """LLM 输出结构校验"""
    summary: str
    dimensions: list[CauseDimension]
    suggested_actions: list[str]
    related_questions: list[int] = []

    @validator("summary")
    def summary_max_length(cls, v):
        if len(v) > 200:
            return v[:200]  # 截断而非报错
        return v

    @validator("dimensions")
    def dimensions_max_count(cls, v):
        return v[:5]

    @validator("suggested_actions")
    def actions_max_count(cls, v):
        return v[:3]

class CauseDimension(BaseModel):
    name: str
    severity: Literal["high", "medium", "low"]
    suggestion: str

    @validator("severity", pre=True)
    def normalize_severity(cls, v):
        v = v.lower().strip()
        if v not in ("high", "medium", "low"):
            return "medium"  # 降级默认
        return v
```

---

## 5. 缓存策略（AI-Cause-7）

### 5.1 缓存键计算

```python
def compute_cache_key(user_id: int, question_id: int, last_answer_hash: str) -> str:
    """
    单题缓存键 = SHA-256(f"{user_id}:{question_id}:{last_answer_hash}")
    
    失效条件：last_answer_hash 变化（用户重做后答案不同）
    """
    raw = f"{user_id}:{question_id}:{last_answer_hash}"
    return hashlib.sha256(raw.encode()).hexdigest()


def compute_group_cache_key(user_id: int, question_ids: list[int]) -> str:
    """
    多题缓存键 = SHA-256(f"{user_id}:{sorted_ids_str}")
    
    注意：多题聚合不含 last_answer_hash（题组变化时由 question_ids 变化触发）
    """
    sorted_ids = sorted(question_ids)
    raw = f"{user_id}:{','.join(map(str, sorted_ids))}"
    return hashlib.sha256(raw.encode()).hexdigest()
```

### 5.2 TTL 策略

| 维度 | 值 |
|---|---|
| 默认 TTL | 30 天（`expires_at = created_at + timedelta(days=30)`） |
| 失效条件 | `input_hash` 与缓存行不匹配（last_answer_hash 变化） |
| 清理 | APScheduler 每日 03:00 清理 `expires_at < now` 的行 |

### 5.3 缓存命中判定流程

```
1. 计算 input_hash
2. 查询 AiCauseAnalysisV2 WHERE user_id AND question_id AND input_hash
3. 若存在且 expires_at > now → 返回缓存（cached=True）
4. 若不存在或已过期 → 调 LLM → 写入新行
```

---

## 6. 限流（AI-Cause-5）

| 维度 | 配置 |
|---|---|
| 日限额 | 20 次 / 用户 / 天 |
| 共享桶 | 与 AI 出题共享 `daily_llm_quota`（总上限 50/天） |
| 重试命中缓存 | **不消耗**配额（缓存命中不计入 daily count） |
| 超限响应 | HTTP 429 + `{"error": "daily_quota_exceeded", "reset_at": "..."}` |

```python
async def check_daily_quota(user_id: int) -> bool:
    """检查今日 LLM 配额（cause_analysis 子桶）"""
    today_start = get_today_start(user_tz)
    count = await db.scalar(
        select(func.count())
        .where(LlmCallV2.user_id == user_id)
        .where(LlmCallV2.call_type.in_(["cause_analysis_single", "cause_analysis_group"]))
        .where(LlmCallV2.created_at >= today_start)
    )
    return count < DAILY_CAUSE_ANALYSIS_LIMIT  # 20
```

---

## 7. 幂等（AI-Cause-6）

复用 Phase-Home `IdempotencyKeyV2` 表：

```
Header: X-Idempotency-Key: {client_generated_uuid}

流程：
1. 收到请求 → 查 IdempotencyKeyV2(key=header_value, user_id=current_user)
2. 若已存在且 status=completed → 返回存储的 response（不重复调 LLM）
3. 若已存在且 status=processing → 返回 409 Conflict（正在处理中）
4. 若不存在 → 插入 status=processing → 调 LLM → 更新 status=completed + response
```

---

## 8. 错误处理

| 错误类型 | HTTP 码 | 前端行为 | 审计记录 |
|---|---|---|---|
| LLM 超时（>30s） | 503 | "AI 分析暂时不可用，请稍后再试" + retry 按钮 | llm_call_id + error_type=timeout |
| LLM 返回非法 JSON | 503 | 同上 | error_type=parse_error + raw_response 前 500 字符 |
| 日配额耗尽 | 429 | "今日分析次数已用完（{used}/{limit}），明天再试" | — |
| 幂等键冲突（处理中） | 409 | "正在分析中，请稍候" | — |
| 题目不存在 | 404 | 通用 404 | — |
| 用户无权限 | 403 | 通用 403 | — |

**PR-R6 核心原则**：错因分析失败**不阻塞**复盘列表 / 详情 / 重做。前端错因区块独立渲染，catch error 后本区块降级，不触发全局 error boundary。

---

## 9. 反馈循环（AI-Cause-9）

```python
# 端点：POST /api/v2/review/cause-analysis/{analysis_id}/feedback
# Body: { "rating": "up" | "down", "comment": str | None }

# 写入 RecommendationFeedbackV2:
#   type = "cause_analysis_single" | "cause_analysis_group"
#   entity_id = AiCauseAnalysisV2.id
#   rating = "up" | "down"
#   comment = 用户可选文字反馈
```

用途：
- 统计 LLM 输出质量
- 远期：低评分的 prompt 模板自动标记待优化
- 不影响缓存（差评不触发重新分析）

---

## 10. "保存为笔记" 流（AI-Cause-10）

```
用户点击"保存为笔记"按钮
  → POST /api/v2/notes
  → Body:
    {
      "type": "ai_cause_analysis",
      "title": "错因分析：{question_title_preview}",
      "body": result.summary,
      "linked_question_id": question_id,
      "metadata_json": {
        "source_analysis_id": AiCauseAnalysisV2.id,
        "dimensions": result.dimensions
      }
    }
  → 返回 NoteV2
  → 前端跳转到笔记详情或 toast 提示
```

---

## 11. 成本估算

| 维度 | 单题 | 多题聚合 |
|---|---|---|
| 输入 tokens（估算） | ~800-1200 | ~2000-4000 |
| 输出 tokens（估算） | ~300-500 | ~400-600 |
| 单次成本（GPT-4o-mini 价位） | ~¥0.01-0.02 | ~¥0.03-0.05 |
| 日限额 20 次/用户 最大成本 | ~¥0.4/用户/天 | — |
| 缓存命中率预期 | >60%（同题重复查看） | ~40% |

---

## 12. 完整调用流程

```
客户端                        API                              LLM
  │                            │                                │
  ├─ POST /cause-analysis ────▶│                                │
  │  (+ Idempotency-Key)       │                                │
  │                            ├── check idempotency            │
  │                            ├── check daily quota            │
  │                            ├── compute input_hash           │
  │                            ├── query cache (AiCauseAnalysis)│
  │                            │                                │
  │                      [cache hit]                            │
  │◀── 200 {cached: true} ────┤                                │
  │                            │                                │
  │                      [cache miss]                           │
  │                            ├── build prompt context         │
  │                            ├── call LLM ───────────────────▶│
  │                            │                                ├── generate
  │                            │◀──────────── response ─────────┤
  │                            ├── parse + validate JSON        │
  │                            ├── save AiCauseAnalysisV2       │
  │                            ├── save LlmCallV2 (audit)       │
  │                            ├── update IdempotencyKeyV2      │
  │◀── 200 {cached: false} ───┤                                │
  │                            │                                │
```

---

## 引用矩阵

| 本文被引用 |
|---|
| [03-Backend-WU](./03-Backend-WU.md) WU-R5 / WU-R6 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR9 |
| [10-NonFunctional](./10-NonFunctional.md) 限流 / 成本 |
| [11-Testing](./11-Testing.md) cause-analysis 测试 |
