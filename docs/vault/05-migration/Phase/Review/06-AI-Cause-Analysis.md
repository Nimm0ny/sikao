# Phase-Review · 06 · AI Cause Analysis

> **Status**: ACCEPTED (REWRITTEN)
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §5（AI-Cause-1 ~ AI-Cause-13）· [02-Data-Model](./02-Data-Model.md) §3.3 · [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) · [14-Confidence-Rating](./14-Confidence-Rating.md) §3.4

---

## 1. 概述

AI 错因分析提供 **5 种调用模式**：

| 模式 | scope | 触发 | 配额桶 | prompt 变体 |
|---|---|---|---|---|
| 单题分析 | `single` | 用户主动 | `daily_quota=20` | `cause_analysis_single` |
| 多题聚合 | `group` | 用户主动 | `daily_quota=20` 共享 | `cause_analysis_group` |
| 强制分析（confidence mismatch） | `single` | 系统自动（[14] §3.4） | 不计配额 | `cause_analysis_forced` |
| 难题深度分析 | `single` | 系统自动（[12] §5.2） | `daily_deep_quota=5` | `cause_analysis_deep` |
| 演进对比分析 | `single` (含 evolution_context) | 用户重新分析时自动注入 | 沿用 daily 桶 | `cause_analysis_single`（context 段加） |

复用 Phase-Home `modules/llm/` 基础设施（AI-Cause-1）。

---

## 2. LLM Prompt 模板

### 2.1 cause_analysis_single（基础版 + evolution context）

文件位置：`services/api/src/sikao_api/modules/llm/prompts/cause_analysis_single.py`

```
你是公考辅导专家。分析以下错题，找出学生反复做错的根因。

## 题目信息
- 题型：{question_type}
- 科目分类：{category_l1} > {category_l2} > {category_l3}
- 题面：{question_body}
- 选项：{options_text}
- 正确答案：{correct_answer}
- 官方解析：{explanation}

## 学生答题记录
- 错误次数：{error_count}
- 历次答题（最近 10 次，倒序）：
{answer_history_block}
- 历次信心评级（如有）：{confidence_history}
- 平均答题用时：{avg_duration_s}s（用户均值的 {duration_ratio}×）

## 错因分类（必须从以下 slug 中选择）

知识层（knowledge）:
  - concept_confusion: 概念混淆
  - knowledge_gap: 知识点遗漏
  - formula_misremember: 公式记错
  - boundary_neglect: 边界条件忽略
  - definition_imprecise: 定义不精确

思维层（reasoning）:
  - comprehension_unclear: 审题不清
  - trap_option: 陷阱中招
  - elimination_mistake: 排除法失误
  - inference_skip: 推理跳步
  - logic_inversion: 逻辑倒置
  - assumption_implicit: 隐含假设

状态层（state）:
  - careless_calc: 计算粗心
  - time_pressure: 时间不够
  - guess_failed: 蒙猜失误
  - unfamiliar_type: 题型不熟

不在以上任一类别 → 输出 slug="other" 并在 suggestion 中详述。

{evolution_context_block}

## 输出格式（严格 JSON，不输出其他内容）

{
  "summary": "200字以内的错因总结",
  "dimensions": [
    {
      "slug": "concept_confusion",
      "name_display": "概念混淆",
      "severity": "high|medium|low",
      "suggestion": "具体建议（≤80字）"
    }
  ],
  "suggested_actions": ["建议动作1", "建议动作2"],
  "related_questions": [],
  "evolution_context": {
    "comparison_judgment": {
      "improved_dimensions": ["slug1"],
      "persisted_dimensions": ["slug2"],
      "newly_emerged_dimensions": ["slug3"],
      "actions_likely_completed": [true, false],
      "overall_trend": "improved|partial_improvement|stagnant|regressed"
    }
  }
}

约束：
- summary ≤ 200 字
- dimensions ≤ 5 项
- suggested_actions ≤ 3 项
- severity ∈ {high, medium, low}
- slug 必须在上述 16 个 enum 内（含 other）
- related_questions 留空（系统补充）
- 如果不是 evolution 场景（首次分析），输出 evolution_context: null
```

### 2.2 evolution_context_block（动态注入）

仅当用户已有过该题分析时注入：

```
## 历史诊断（请评估改善情况）

上次分析时间：{previous_analyzed_at}
上次诊断维度：
{previous_dimensions_block}

上次建议动作：
{previous_actions_block}

上次用户信心评级：{previous_confidence}（本次：{current_confidence}）

请在本次分析的 evolution_context.comparison_judgment 中：
1. 评估上述维度本次是否改善（improved 不再出现 / persisted 仍是主因 / newly_emerged 新出现）
2. 评估上次建议的"完成可能性"（基于本次答题质量推测）
3. 给出 overall_trend
4. 避免重复给出"上次说过的相同建议"——若 action 标 false（未做），suggestion 中说明"先完成上次的：X"
```

### 2.3 cause_analysis_group

```
你是公考辅导专家。分析以下一组错题的共性错误模式。

## 题目组摘要（共 {question_count} 道）
{questions_summary_block}

每题格式：题型 | 分类 l1>l2 | 错误次数 | 最近错误选项 | 最近 confidence

## 错因分类（同 single；必须从 16 个 slug 中选择）
{taxonomy_block}

## 输出格式（严格 JSON）

{
  "summary": "200字以内的组级共性错因总结",
  "dimensions": [
    { "slug": "...", "name_display": "...", "severity": "...", "suggestion": "针对这组题的整体建议" }
  ],
  "suggested_actions": ["组级建议动作1", "建议动作2"],
  "related_questions": []
}

约束：
- 重点关注共性模式，而非逐题分析
- summary ≤ 200 字
- dimensions ≤ 5 项；slug 必须 enum
- suggested_actions ≤ 3 项
```

### 2.4 cause_analysis_forced（confidence mismatch 触发）

文件位置：`services/api/src/sikao_api/modules/llm/prompts/cause_analysis_forced.py`

```
你是公考辅导专家。学生在以下题目上**自评"完全确定"但答错了**，这是严重的知识漏洞信号。

## 题目信息
{question_block_full}

## 关键警示信号
- 学生上次答题信心：certain（完全确定）
- 实际结果：错误
- 历史 mismatch 次数：{mismatch_count}（≥ 2 次将自动标记为难题）

## 任务要求

请深入诊断这种"自信错答"的根因，并：
1. 重点分析"为什么学生以为自己懂了"——是哪个概念被误学成了另一个？
2. dimensions 中至少包含 1 个 severity=high 的维度（自信错答必然有重大漏洞）
3. suggested_actions 中第一项**必须**是"立即重新学习 X 知识点"或"重新阅读 Y 章节"
4. 输出格式与 cause_analysis_single 相同
5. summary 末尾追加一句"⚠️ 你对这道题原以为掌握了，建议优先复习"

## 错因分类（同 16 slug）
{taxonomy_block}
```

### 2.5 cause_analysis_deep（hard 题深度分析）

文件位置：`services/api/src/sikao_api/modules/llm/prompts/cause_analysis_deep.py`

```
你是公考辅导专家。这道题已被系统标记为难题（学生反复做错 ≥ 3 次），需要深度分析。

## 题目信息
{question_block_full}

## 历史轨迹
- 总错误次数：{total_wrong_count}
- re_fail_count（毕业后又错）：{re_fail_count}
- 历次 confidence 分布：{confidence_distribution}
- 历次错因 dimensions 频次：{historical_dimensions_freq}

## 任务要求

不像普通分析仅给出 dimensions 和 actions，本次需要：

1. **根因追溯**：summary 必须明确指出"反复做错的最深层原因"（≤300 字，本场景 summary 上限放宽到 300）
2. **知识图谱定位**：related_questions 中给出 5-10 道**前置基础题**（学生应该先掌握这些）
3. **学习路径**：suggested_actions 给出 3 步可执行计划（先学 X → 再练 Y → 最后做 Z）
4. dimensions 必须包含至少 2 个维度（说明问题不是单一原因）

## 错因分类（同 16 slug）
{taxonomy_block}

## 输出格式（同 single 但 summary 长度上限 300 字，related_questions 至少 5 项）
```

---

## 3. 输入 Schema（按 scope 区分）

### 3.1 单题输入

```python
@dataclass
class CauseAnalysisSingleInput:
    """单题分析（含 forced / deep / evolution 通用输入）"""
    user_id: int
    question_id: int

    # 题目信息
    question_type: str
    category_l1: str
    category_l2: str
    category_l3: str | None
    question_body: str            # ≤2000 chars
    options_text: str
    correct_answer: str
    explanation: str              # ≤1000 chars

    # 学生记录
    error_count: int
    answer_history: list[AnswerHistoryEntry]   # 最近 10 次（倒序），含 confidence
    confidence_history: list[str]              # 仅 confidence list（["likely", "certain", ...]）
    avg_duration_s: float
    user_avg_duration_s: float                  # 用户全局均值（用于 duration_ratio）
    duration_ratio: float                        # avg_duration / user_avg

    # 缓存键关键字段
    last_answer_hash: str

    # Mode-specific
    mode: Literal["single", "forced", "deep"] = "single"
    mismatch_count: int | None = None             # mode=forced 时填
    re_fail_count: int | None = None              # mode=deep 时填
    total_wrong_count: int | None = None          # mode=deep 时填
    historical_dimensions_freq: dict[str, int] | None = None  # mode=deep 时填

    # Evolution context（mode=single 时如有历史则填）
    previous_analysis: AiCauseAnalysisV2 | None = None


@dataclass
class AnswerHistoryEntry:
    user_answer: str
    is_correct: bool
    confidence: str | None
    answered_at: datetime
    session_id: int | None
```

### 3.2 多题输入

```python
@dataclass
class CauseAnalysisGroupInput:
    user_id: int
    question_ids: list[int]                # 2 ≤ len ≤ 20
    questions_summary: list[GroupQuestionSummary]
    question_ids_signature: str            # sorted_ids SHA-256 前 64 字符


@dataclass
class GroupQuestionSummary:
    question_id: int
    question_type: str
    category_l1: str
    category_l2: str
    error_count: int
    last_wrong_option: str
    last_confidence: str | None
```

---

## 4. 输出 Schema（含 evolution_context）

### 4.1 主响应

```python
class CauseAnalysisResult(BaseModel):
    summary: str
    dimensions: list[CauseDimension]
    suggested_actions: list[str]
    related_questions: list[int]
    evolution_context: EvolutionContext | None = None

    @validator("summary")
    def summary_max_length(cls, v):
        # mode=deep 上限 300，否则 200
        # 实际由 service 层在 mode=deep 时不裁切
        if len(v) > 300:
            return v[:300]
        return v

    @validator("dimensions")
    def dimensions_max(cls, v):
        return v[:5]

    @validator("suggested_actions")
    def actions_max(cls, v):
        return v[:3]


class CauseDimension(BaseModel):
    slug: str                                # 必须在词典内（parser 兜底）
    name_display: str                        # 展示名（slug 对应的 name）
    severity: Literal["high", "medium", "low"]
    suggestion: str

    # 用户人工覆盖时填（[13] §6.3）
    user_override: DimensionOverride | None = None

    # LLM 自创 slug 兜底时存原始数据
    _llm_original: dict | None = None


class DimensionOverride(BaseModel):
    slug_original: str
    slug_overridden: str
    severity_overridden: str | None
    user_note: str | None
    overridden_at: datetime


class EvolutionContext(BaseModel):
    previous_analysis_id: int | None
    previous_analyzed_at: datetime | None
    previous_dimensions: list[dict]           # [{slug, severity}, ...]
    previous_suggested_actions: list[str]
    previous_confidence: str | None
    comparison_judgment: ComparisonJudgment


class ComparisonJudgment(BaseModel):
    improved_dimensions: list[str]
    persisted_dimensions: list[str]
    newly_emerged_dimensions: list[str]
    actions_likely_completed: list[bool]
    overall_trend: Literal["improved", "partial_improvement", "stagnant", "regressed"]
```

### 4.2 持久化到 AiCauseAnalysisV2.result_json

```json
{
  "mode": "single | forced | deep | group",
  "summary": "...",
  "dimensions": [
    {
      "slug": "concept_confusion",
      "name_display": "概念混淆",
      "severity": "high",
      "suggestion": "...",
      "user_override": null,
      "_llm_original": null
    }
  ],
  "suggested_actions": [...],
  "related_questions": [...],
  "evolution_context": {
    "previous_analysis_id": 42,
    "previous_analyzed_at": "...",
    "previous_dimensions": [...],
    "previous_suggested_actions": [...],
    "previous_confidence": "likely",
    "comparison_judgment": {
      "improved_dimensions": [...],
      "persisted_dimensions": [...],
      "newly_emerged_dimensions": [...],
      "actions_likely_completed": [...],
      "overall_trend": "partial_improvement"
    }
  },
  "_meta": {
    "prompt_template_version": "v2.1",
    "llm_model": "...",
    "tokens_used": { "prompt": 1234, "completion": 456 }
  }
}
```

---

## 5. 缓存策略（更新版）

### 5.1 缓存键（已更新）

```python
def compute_single_cache_key(
    user_id: int,
    question_id: int,
    last_answer_hash: str,
    previous_analysis_id: int | None,
    mode: str,
) -> str:
    """
    单题缓存键 = SHA-256(user_id : question_id : last_answer_hash : previous_id : mode)

    包含 previous_analysis_id 的原因：上次分析变化即缓存失效（即使 last_answer 没变）。
    包含 mode 的原因：forced / deep 与 single 不共用缓存。
    """
    raw = f"{user_id}:{question_id}:{last_answer_hash}:{previous_analysis_id or 0}:{mode}"
    return hashlib.sha256(raw.encode()).hexdigest()


def compute_group_cache_key(user_id: int, question_ids: list[int]) -> str:
    sorted_ids = sorted(question_ids)
    raw = f"{user_id}:{','.join(map(str, sorted_ids))}:group"
    return hashlib.sha256(raw.encode()).hexdigest()
```

### 5.2 TTL & 失效

| 维度 | 值 |
|---|---|
| 默认 TTL | 30 天 |
| 失效条件 | last_answer_hash 变化 / previous_analysis_id 变化 / mode 变化 |
| 用户覆盖后失效 | 否（user_override 不改 input_hash；可继续命中缓存） |
| 清理 cron | 每日 03:00 清理 expires_at < now 的行 |

### 5.3 缓存命中流程

```
1. 计算 input_hash（含 previous_id + mode）
2. 查 AiCauseAnalysisV2 WHERE user_id AND question_id AND input_hash
3. 命中且 expires_at > now → 返回缓存（cached=True）
4. 未命中 → call LLM → 写入新行 → expires_at = now + 30d
```

---

## 6. 限流（修订）

| 维度 | 配置 |
|---|---|
| 普通分析（single + group） | 20 次 / 用户 / 天 |
| Deep 分析 | 5 次 / 用户 / 天（独立桶） |
| Forced 分析（mismatch 触发） | **不计配额**（系统强制，不能因配额耗尽而跳过） |
| 重试命中缓存 | 不消耗任何桶 |
| 共享父桶 | 与 AI 出题共享 `daily_llm_quota=50` |

```python
async def check_quota(user_id: int, mode: str) -> bool:
    today_start = get_today_start(user_tz)

    if mode == "forced":
        return True  # 不限

    if mode == "deep":
        deep_count = await db.scalar(
            select(func.count())
            .where(LlmCallV2.user_id == user_id)
            .where(LlmCallV2.call_type == "cause_analysis_deep")
            .where(LlmCallV2.created_at >= today_start)
        )
        return deep_count < DAILY_DEEP_QUOTA  # 5

    # single + group 共享桶
    normal_count = await db.scalar(
        select(func.count())
        .where(LlmCallV2.user_id == user_id)
        .where(LlmCallV2.call_type.in_(["cause_analysis_single", "cause_analysis_group"]))
        .where(LlmCallV2.created_at >= today_start)
    )
    return normal_count < DAILY_NORMAL_QUOTA  # 20
```

---

## 7. 错误处理（沿用 PR-R6）

| 错误 | HTTP | 前端 | 审计 |
|---|---|---|---|
| LLM timeout (>30s) | 503 | "AI 分析暂时不可用" + retry | llm_call_id + error_type=timeout |
| LLM JSON 解析失败 | 503 | 同上 | error_type=parse_error + raw_response 前 500 字 |
| 配额耗尽（normal） | 429 | "今日 N/20 已用完" | — |
| 配额耗尽（deep） | 429 | "今日深度分析次数已用完" | — |
| Idempotency 冲突（处理中） | 409 | "正在分析中" | — |
| dim slug 全部为 other（>3 个） | 200 + warning | "AI 输出可能不准，请人工修改" | metric: cause_taxonomy.degraded_response |
| Forced 分析 LLM 完全失败 | 仅记 audit，不 throw | 列表正常；Q-Hub 红条仍显示 mismatch 警示 | error_type=forced_failed |

PR-R6 核心：错因分析失败**不阻塞**列表/详情/重做。Forced 路径即使 LLM 失败，前端仍能从 ReviewItemV2.metadata.confidence_mismatch_count 渲染警示条。

---

## 8. 完整调用流程

```
客户端                              API                                    LLM
  │                                  │                                      │
  ├─ POST /cause-analysis ──────────▶│                                      │
  │  Header: Idempotency-Key         ├── check idempotency                   │
  │  Body: { mode: single }          ├── check quota（按 mode 判断桶）      │
  │                                  ├── load question + history              │
  │                                  ├── load previous_analysis (if any)     │
  │                                  ├── compute input_hash (含 prev_id)     │
  │                                  ├── query cache                          │
  │                                  │                                      │
  │                            [hit & not expired]                          │
  │◀── 200 {cached: true} ──────────┤                                      │
  │                                  │                                      │
  │                            [miss]                                       │
  │                                  ├── select prompt by mode                │
  │                                  ├── render prompt + evolution_block      │
  │                                  ├── call LLM ─────────────────────────▶│
  │                                  │                                      ├── generate
  │                                  │◀──────── response ──────────────────┤
  │                                  ├── parse JSON                            │
  │                                  ├── validate dimensions[].slug ∈ enum     │
  │                                  │   非 enum → 强制 other (with metric)    │
  │                                  ├── save AiCauseAnalysisV2                │
  │                                  ├── save LlmCallV2 (audit)                │
  │                                  ├── update IdempotencyKeyV2                │
  │                                  ├── clear forced_cause_analysis_pending   │
  │                                  │   (if mode=forced)                       │
  │◀── 200 {cached: false, ...} ────┤                                      │
```

---

## 9. 系统触发（forced & deep）路径

### 9.1 Forced 路径

```python
# review session.commit 路径（[14] §3.4）
def on_session_commit_check_forced_cause(item: ReviewItemV2) -> None:
    if item.metadata_json.get("forced_cause_analysis_pending"):
        # 不阻塞 commit；前端在 result 页读到 pending=true 后自动 trigger
        return
    # 由前端 query 自动调用 POST /cause-analysis with mode=forced
```

前端 result 页 useEffect 触发：

```typescript
useEffect(() => {
  if (item.metadata.forcedCauseAnalysisPending) {
    triggerCauseAnalysis(item.id, { mode: "forced" }).then(() => {
      clearForcedPending(item.id);
    });
  }
}, [item.id]);
```

### 9.2 Deep 路径

```python
# Hard 题被标记后由 cron 触发（每日 04:00）
def dispatch_deep_analysis_for_hard_items(user_id: int) -> None:
    hard_items = db.query(ReviewItemV2).filter(
        ReviewItemV2.user_id == user_id,
        ReviewItemV2.metadata_json["is_hard"].astext == "true",
        ReviewItemV2.metadata_json["last_deep_analysis_at"].is_(None),  # 未做过 deep
    ).limit(DAILY_DEEP_QUOTA).all()

    for item in hard_items:
        # 异步调用，不阻塞 cron
        await trigger_cause_analysis(item, mode="deep")
```

deep 分析每个 hard 题只做 1 次（除非用户在 Q-Hub 主动重新 deep）。

---

## 10. 用户人工覆盖（详见 [13] §6）

### 10.1 端点

```
PATCH /api/v2/review/cause-analysis/{analysis_id}/dimensions/{dimension_index}
Body: {
  "slug": "knowledge_gap",         // 必须 enum
  "user_severity": "high",          // 可选
  "user_note": "..."                // 可选
}

Response: 200 + 完整 CauseAnalysisResponseV2（含 user_override）
```

### 10.2 端点规则

- 仅 analysis.user_id == current_user 可调用
- 不重置缓存（继续命中）
- 写 audit `CAUSE_TAG_OVERRIDDEN` 事件
- 不消耗 LLM 配额

---

## 11. 反馈机制（修订）

### 11.1 端点

```
POST /api/v2/review/cause-analysis/{analysis_id}/feedback
Body: {
  "rating": "up" | "down",
  "comment": str | null,
  "dimensions_disagreed": ["slug1", "slug2"],   // 用户特别不同意的 slug（仅 down 时填）
  "actions_unhelpful": [0, 2]                    // 没用的 action 序号
}
```

### 11.2 周报告（详见 [13] §8.2）

cron 每周一 03:00 聚合：
- top down dimensions（slug 维度排序）
- top unhelpful actions（按文案聚类）
- 输出到 audit_log_v2，运营人工 review，决定是否调 prompt

---

## 12. "保存为笔记" 流（沿用 AI-Cause-10）

```
用户 Q-Hub 点 [保存为笔记]
  → POST /api/v2/notes
  → Body: {
      type: "ai_cause_analysis",
      title: "错因分析：{question_title_preview}",
      body: result.summary + "\n\n" + render_dimensions_markdown(result.dimensions),
      linked_question_id: question_id,
      metadata_json: {
        source_analysis_id: analysis_id,
        dimensions: result.dimensions,
        evolution_trend: result.evolution_context?.comparison_judgment?.overall_trend
      }
    }
  → 返回 NoteV2
  → 前端 toast + 跳转选项
```

---

## 13. 成本估算（修订）

| 维度 | single | group | forced | deep |
|---|---|---|---|---|
| 输入 tokens | ~1000-1500（含 evolution + taxonomy block） | ~2500-4500 | ~1200-1800 | ~1800-2500 |
| 输出 tokens | ~400-600 | ~500-800 | ~500-700 | ~700-1000 |
| 单次成本（GPT-4o-mini） | ~¥0.015-0.025 | ~¥0.04-0.06 | ~¥0.02-0.03 | ~¥0.04-0.06 |
| 缓存命中率预期 | >65%（含 prev_id 后） | ~40% | 低（mismatch 不重复） | 极低（每题 1 次） |
| 单用户日成本上限 | 20 × 0.025 = ¥0.5 | — | 5-10 mismatch × 0.03 = ¥0.3 | 5 × 0.06 = ¥0.3 |

---

## 14. 测试矩阵（含新模式）

| # | 场景 | 期望 |
|---|---|---|
| AC1 | 首次 single 分析 | mode=single, evolution_context=null, dim.slug ∈ enum |
| AC2 | 第二次 single 含 evolution | evolution_context.previous_analysis_id 不为 null |
| AC3 | LLM 输出非 enum slug | parser 强制 other + _llm_original 保留 + metric ++ |
| AC4 | LLM 输出 ≥ 3 个 other | 200 + warning 头 + metric: cause_taxonomy.degraded_response |
| AC5 | confidence=certain + 错触发 forced | mode=forced, 不计配额, summary 含 ⚠️ |
| AC6 | mismatch_count=1 + 第二次 mismatch | is_hard=true 后 cron 自动 deep |
| AC7 | hard 题 deep 分析 | mode=deep, related_questions ≥ 5, summary ≤ 300 |
| AC8 | hard 题已 deep 过不重复 | last_deep_analysis_at 不为 null → cron skip |
| AC9 | group 缓存命中 | 同 sorted_ids → cached=True |
| AC10 | single 缓存因 prev_id 失效 | 第一次 prev_id=null, 第二次 prev_id=42, hash 不同 |
| AC11 | LLM timeout | 503 + audit error_type=timeout |
| AC12 | normal 配额耗尽 | 429 |
| AC13 | deep 配额耗尽不影响 normal | normal 仍可用 |
| AC14 | forced 不受配额限制 | 即使 normal=20/20, forced 仍能调 |
| AC15 | 用户覆盖 dim slug | analysis.dim.user_override 写入 + audit CAUSE_TAG_OVERRIDDEN |
| AC16 | 反馈 down + dimensions_disagreed | metadata 写入 + 周报告聚合 |
| AC17 | 保存为笔记包含 evolution_trend | NoteV2.metadata.evolution_trend 不为 null |

---

## 15. 与既有设计的边界

### 15.1 与 13-Cause-Taxonomy

- prompt 模板的 taxonomy_block 由 [13] §4 定义
- parser 校验逻辑见 [13] §4.2
- 用户覆盖端点见 [13] §6 + 本文 §10
- 反馈聚合见 [13] §8

### 15.2 与 14-Confidence-Rating

- forced 触发路径见 [14] §3.4
- forced prompt 模板见本文 §2.4
- mismatch_count 维护见 [05-SRS-Engine](./05-SRS-Engine.md) §6

### 15.3 与 12-Debt-Management

- hard 题自动 deep 触发见 [12] §5.2
- deep 配额独立桶 5/天见 §6
- hard 题"出狱"清除 last_deep_analysis_at（保留 deep 历史，但允许重新 deep）

### 15.4 与 02-Data-Model

- AiCauseAnalysisV2.result_json shape 见 §4.2
- mode 字段写入 result_json._meta.mode

### 15.5 与 03-Backend-WU

- WU-R5 Cause Analysis Module 复杂度调整：~350 → ~520 行（增 forced + deep + evolution）
- WU-R6 LLM Prompts 增加 forced + deep 两个文件
- WU-R7 cron 增加 `dispatch_deep_analysis_for_hard_items`（每日 04:00）

---

## 16. 引用矩阵

| 本文被引用 |
|---|
| [00-Decisions](./00-Decisions.md) §5 AI-Cause 系列 |
| [01-Boundary-Rules](./01-Boundary-Rules.md) PR-R6 / PR-R8 |
| [02-Data-Model](./02-Data-Model.md) §3.3 AiCauseAnalysisV2 |
| [03-Backend-WU](./03-Backend-WU.md) WU-R5 / WU-R6 / WU-R7 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR9 |
| [10-NonFunctional](./10-NonFunctional.md) 限流 / 成本 |
| [11-Testing](./11-Testing.md) AC 测试矩阵 |
| [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) 词典 + 用户覆盖 + 反馈聚合 |
| [14-Confidence-Rating](./14-Confidence-Rating.md) forced 触发 |
