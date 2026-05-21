# Phase-Review · 13 · Cause Taxonomy

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[06-AI-Cause-Analysis](./06-AI-Cause-Analysis.md) · [00-Decisions](./00-Decisions.md) §16（Taxonomy-1 ~ Taxonomy-9）

---

## 1. 为什么需要错因词典

原 06-AI-Cause-Analysis 把 `dimensions[].name` 留给 LLM 自由生成，会导致 3 个硬翻车：

1. **聚类不可用**：同一根因 LLM 不同时期输出不同字面（"概念混淆" / "概念不清" / "概念错误" / "知识点混淆"），Insights-3 错因聚类条形图直接退化为词频统计
2. **趋势不可用**：用户两个月前被诊断 "审题不清"、本月被诊断 "题意理解偏差"，无法回答"我的审题问题改善了没"
3. **反馈不可用**：👍/👎 反馈聚合不到 tag 维度，无法迭代 prompt（不知道哪个错因 LLM 经常误判）

错因词典（Cause Taxonomy）= **强 enum + 可演进的稳定 vocabulary**。

---

## 2. 词典 v1（15 个 tag，3 大类）

### 2.1 知识层（Knowledge Layer，5 tag）

| slug | name | severity_default | description |
|---|---|---|---|
| `concept_confusion` | 概念混淆 | high | 把两个相近概念搞混（如复议 vs 诉讼、行政机关 vs 复议机关） |
| `knowledge_gap` | 知识点遗漏 | high | 该考点完全没学过或彻底忘了 |
| `formula_misremember` | 公式记错 | medium | 数量关系/资料分析公式错误（如增长率 vs 增幅） |
| `boundary_neglect` | 边界条件忽略 | medium | 边界值/特殊情况未考虑（如 0、负数、空集） |
| `definition_imprecise` | 定义不精确 | medium | 对法条/概念定义记忆模糊导致选项排查失败 |

### 2.2 思维层（Reasoning Layer，6 tag）

| slug | name | severity_default | description |
|---|---|---|---|
| `comprehension_unclear` | 审题不清 | high | 没看清题干关键词或限定（如"不正确的是"看成"正确的是"） |
| `trap_option` | 陷阱中招 | high | 命题人故意设置的陷阱选项（如绝对化表述 + 部分正确） |
| `elimination_mistake` | 排除法失误 | medium | 排除法应用错误（错排了正确选项） |
| `inference_skip` | 推理跳步 | medium | 多步推理中跳过中间步骤导致结论错误 |
| `logic_inversion` | 逻辑倒置 | medium | 充分必要 / 因果关系倒置 |
| `assumption_implicit` | 隐含假设 | low | 用了题干未给出的假设条件 |

### 2.3 状态层（State Layer，4 tag）

| slug | name | severity_default | description |
|---|---|---|---|
| `careless_calc` | 计算粗心 | low | 单纯算错（数字抄错、加减失误） |
| `time_pressure` | 时间不够 | low | 因为时间紧没想完整就选了 |
| `guess_failed` | 蒙猜失误 | low | 完全靠蒙且没蒙对 |
| `unfamiliar_type` | 题型不熟 | medium | 该题型见的太少，不知道标准解法 |

### 2.4 兜底

| slug | name | severity_default | description |
|---|---|---|---|
| `other` | 其他 | low | LLM 输出不在词典内时强制归类（详见 §5） |

总计 **16 个 slug**（15 业务 tag + 1 兜底 tag）。词典版本号 `taxonomy_version_v1`。

---

## 3. cause_tag_v2 表 schema

```python
class CauseTagV2(Base):
    """错因 tag 词典。运营/超管可调，但 slug 一旦发布不可改名。"""
    __tablename__ = "cause_tag_v2"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_cause_tag_v2_slug"),
        Index("ix_cause_tag_v2_category_order", "category", "display_order"),
        Index("ix_cause_tag_v2_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), comment="不可变标识，LLM enum 用")
    name: Mapped[str] = mapped_column(String(64), comment="展示名，可改")
    category: Mapped[str] = mapped_column(
        String(32), comment="knowledge | reasoning | state | other"
    )
    severity_default: Mapped[str] = mapped_column(
        String(16), comment="high | medium | low"
    )
    description: Mapped[str] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)
    taxonomy_version: Mapped[str] = mapped_column(String(32), default="v1")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

### 3.1 演进规则

| 操作 | 允许？ | 说明 |
|---|---|---|
| 新增 tag | ✅ | 词典版本号 +1（v1 → v2）；旧版本数据保留旧 slug |
| 改 `name`/`description`/`display_order` | ✅ | 不影响数据；UI 立即生效 |
| 改 `severity_default` | ✅ | 仅影响新生成；历史 result_json 中 severity 不追溯 |
| 改 `slug` | ❌ | 永远禁止；如需改用"deprecate + 新增"双 tag 共存 |
| 删除 tag | ❌ | 仅 `is_active=false` 软删；LLM 不再选；历史数据仍可查 |

### 3.2 Seed 数据

WU-R13 在 alembic 迁移中 seed 16 行（15 业务 + other）。seed 文件位置：

```
services/api/alembic/versions/0033_review_seed_cause_tags.py
```

seed 内容由 `services/api/src/sikao_api/modules/review/data/cause_tag_seed_v1.py` 提供，便于 review 修改：

```python
CAUSE_TAG_SEED_V1 = [
    {"slug": "concept_confusion", "name": "概念混淆", "category": "knowledge", "severity_default": "high", "description": "...", "display_order": 1},
    # ... 共 16 项
]
```

---

## 4. LLM Prompt 强制 enum

### 4.1 prompt 模板修订

`cause_analysis_single` prompt 顶部追加（与既有结构合并）：

```
## 错因分类（必须从中选择）

你输出的 dimensions[].name 字段必须严格使用以下 slug 之一，禁止自创：

知识层：
  - concept_confusion (概念混淆)
  - knowledge_gap (知识点遗漏)
  - formula_misremember (公式记错)
  - boundary_neglect (边界条件忽略)
  - definition_imprecise (定义不精确)

思维层：
  - comprehension_unclear (审题不清)
  - trap_option (陷阱中招)
  - elimination_mistake (排除法失误)
  - inference_skip (推理跳步)
  - logic_inversion (逻辑倒置)
  - assumption_implicit (隐含假设)

状态层：
  - careless_calc (计算粗心)
  - time_pressure (时间不够)
  - guess_failed (蒙猜失误)
  - unfamiliar_type (题型不熟)

如果错因不在以上任一类别中，输出 slug="other" 并在 suggestion 中详细说明。

## 输出要求（已修订）

{
  "summary": "200字以内",
  "dimensions": [
    {
      "slug": "concept_confusion",  ← 必须是上述 slug
      "name_display": "概念混淆",   ← 同 slug 对应的 name（前端兼容用）
      "severity": "high|medium|low",
      "suggestion": "..."
    }
  ],
  "suggested_actions": [...],
  "related_questions": []
}
```

### 4.2 Parser 校验

```python
# services/api/src/sikao_api/modules/llm/parsers/cause_analysis_parser.py

VALID_SLUGS = set(load_active_cause_tag_slugs())  # 启动时从 DB 加载，5min cache

def parse_cause_dimensions(raw: list[dict]) -> list[CauseDimension]:
    parsed = []
    for d in raw[:5]:  # AI-Cause-4 max 5
        slug = d.get("slug", "").strip().lower()
        if slug not in VALID_SLUGS:
            # 不在词典内 → 强制 other + 原 LLM 输出存 metadata
            parsed.append(CauseDimension(
                slug="other",
                name_display="其他",
                severity="low",
                suggestion=f"[LLM 自创错因，已归为其他] {d.get('name', d.get('slug', ''))}：{d.get('suggestion', '')}",
                _llm_original=d,  # 调试 + 后续词典扩展依据
            ))
            metrics.increment("cause_taxonomy.other_fallback")
            continue
        # 校验 severity
        sev = d.get("severity", "medium").lower().strip()
        if sev not in ("high", "medium", "low"):
            sev = "medium"
        parsed.append(CauseDimension(slug=slug, name_display=d.get("name_display", ""), severity=sev, suggestion=d.get("suggestion", "")))
    return parsed
```

### 4.3 Cache 失效

`VALID_SLUGS` 缓存条件：
- 启动时从 DB 加载（is_active=true 的 slug）
- TTL 5 分钟
- 后台运营修改 cause_tag_v2 时显式 invalidate（POST /admin/cause-tag/invalidate-cache，仅超管可用）

---

## 5. 兜底 "other" 行为

LLM 输出 slug 不在词典内时（含拼写错误、自创、为空）：

| 行为 | 实施 |
|---|---|
| 强制归 `other` | parser 自动转换 |
| severity 强制 `low` | 避免污染 high/medium 统计 |
| 原 LLM 输出存 `_llm_original` 字段 | 写入 result_json.dimensions[].metadata._llm_original，供后续词典扩展 review |
| metrics 计数 | `cause_taxonomy.other_fallback` counter |
| 周报告 | 每周一审计：上周 other_fallback 触发 ≥ N 次的"自创 tag"列表 → 评估是否需要进词典 |

如果某月 `other_fallback` 触发率 > 10%，触发词典扩展评估（运营 + 设计师评估是否新增 tag 进 v2 词典）。

---

## 6. 用户人工修改错因 tag

### 6.1 业务诉求

LLM 不是完美的——用户可能不同意诊断（"我不是审题不清，我就是不会"）。提供修改入口避免错误诊断污染长期数据。

### 6.2 端点

```
PATCH /api/v2/review/cause-analysis/{analysis_id}/dimensions/{dimension_index}
Body: {
  "slug": "knowledge_gap",            # 必须在词典内
  "user_severity": "high",            # 可选，覆盖 LLM 评级
  "user_note": "我就是这考点没学过"   # 可选
}
```

### 6.3 写入逻辑

```python
def override_cause_dimension(analysis_id: int, dim_idx: int, override: DimensionOverride):
    analysis = get(AiCauseAnalysisV2, analysis_id)
    require_owner(analysis, current_user)

    if override.slug not in VALID_SLUGS:
        raise InvalidCauseTagError(override.slug)

    dim = analysis.result_json["dimensions"][dim_idx]

    # 不破坏 LLM 原始输出，叠加用户层
    dim["user_override"] = {
        "slug_original": dim["slug"],
        "slug_overridden": override.slug,
        "severity_overridden": override.user_severity,
        "user_note": override.user_note,
        "overridden_at": utcnow().isoformat(),
    }

    # 保留 LLM 原 slug 在 _llm_original 字段供审计
    dim["_llm_original_slug"] = dim["slug"]
    dim["slug"] = override.slug
    dim["severity"] = override.user_severity or dim["severity"]

    # 写 audit 事件
    record_attempt(
        analysis.review_item_id,
        ReviewAttemptOutcome.CAUSE_TAG_OVERRIDDEN,
        {"analysis_id": analysis_id, "dim_idx": dim_idx, "from": dim["_llm_original_slug"], "to": override.slug}
    )

    bump_version(analysis)
    return analysis
```

### 6.4 聚类计算优先用户标记

Insights-3 错因聚类条形图、用户长期错因分布统计：

```python
def get_effective_slug(dim: dict) -> str:
    """用户覆盖优先于 LLM 原始诊断"""
    if "user_override" in dim:
        return dim["user_override"]["slug_overridden"]
    return dim["slug"]
```

### 6.5 反馈机制双轨

- 👍/👎（既有）：feedback to LLM quality（不改 dim）
- 👎 + 修改（新增）：用户给出"我认为是 X"——这种修改+反馈组合权重更高，触发 prompt 优化优先级（每周 review 修改频率最高的 LLM-original → user-overridden 对，调整 prompt context）

---

## 7. 错因进化跟踪（Evolution Context）

### 7.1 业务诉求

用户对同一题做了多次错因分析（重做后再分析）。每次分析独立产出，无关联。
- 用户感知：每次都是"全新诊断"，无法判断"诊断有改善还是恶化"
- LLM 感知：缺少"上次诊断 + 上次建议"上下文，可能反复输出相同建议（用户感觉 LLM 不长记性）

引入 `evolution_context`：每次新分析包含上一次的诊断和建议执行情况。

### 7.2 数据 shape

`AiCauseAnalysisV2.result_json` 增加：

```json
{
  "summary": "...",
  "dimensions": [...],
  "suggested_actions": [...],
  "related_questions": [...],

  "evolution_context": {
    "previous_analysis_id": 42,
    "previous_analyzed_at": "2026-04-15T10:00:00Z",
    "previous_dimensions": [
      { "slug": "concept_confusion", "severity": "high" },
      { "slug": "comprehension_unclear", "severity": "medium" }
    ],
    "previous_suggested_actions": ["整理期限对比表", "重做 5 道同类题"],

    "comparison_judgment": {
      "improved_dimensions": ["comprehension_unclear"],
      "persisted_dimensions": ["concept_confusion"],
      "newly_emerged_dimensions": ["formula_misremember"],
      "actions_likely_completed": [true, false],
      "overall_trend": "partial_improvement"
    }
  }
}
```

### 7.3 LLM prompt 注入

`cause_analysis_single` prompt 在用户已有过此题分析时追加：

```
## 历史诊断（请评估改善情况）

上次分析时间：2026-04-15
上次诊断维度：
  - concept_confusion (high)
  - comprehension_unclear (medium)

上次建议动作：
  1. 整理期限对比表
  2. 重做 5 道同类题

请在本次分析中：
1. 在 evolution_context.comparison_judgment 中评估上述维度本次是否改善
2. 如果某维度仍然是当前主因 → 标 persisted；不再出现 → 标 improved
3. 如果出现上次没有的新维度 → 标 newly_emerged
4. 评估上次建议动作的"完成可能性"（actions_likely_completed[i] = true/false），仅基于本次答案判断
5. overall_trend ∈ {improved, partial_improvement, stagnant, regressed}

请避免重复给出"上次说过的相同建议"——如果某 action 标 false（未做），在 suggestion 里说明"建议先完成上次的：X"。
```

### 7.4 evolution 链查询

```python
def get_evolution_chain(question_id: int, user_id: int, max_depth: int = 5) -> list[AiCauseAnalysisV2]:
    """获取该题该用户的错因分析链（按时间倒序）"""
    return db.query(AiCauseAnalysisV2).filter(
        AiCauseAnalysisV2.user_id == user_id,
        AiCauseAnalysisV2.question_id == question_id,
        AiCauseAnalysisV2.scope == "single",
    ).order_by(AiCauseAnalysisV2.created_at.desc()).limit(max_depth).all()
```

新分析创建时：
1. 查 evolution chain 取最近 1 条
2. 注入到 prompt
3. 持久化时把 chain 信息写入 result_json.evolution_context.previous_*

### 7.5 UI 表现

Q-Hub CauseCard 区块顶部新增"演进时间线"组件：

```
┌─────────────────────────────────────────────────────┐
│  错因演进                                            │
│  ──○────○────●───  ← 3 次分析时间点                  │
│  4/15  4/28  今日                                    │
│                                                     │
│  ✅ 改善：审题不清 (上次 medium → 本次未出现)        │
│  ⚠️ 持续：概念混淆 (high → high)                    │
│  🆕 新出现：公式记错 (medium)                        │
│                                                     │
│  上次建议执行情况：                                  │
│  ✅ 整理期限对比表 (已完成)                          │
│  ❌ 重做 5 道同类题 (未完成)                         │
│                                                     │
│  整体趋势：部分改善                                  │
└─────────────────────────────────────────────────────┘
```

---

## 8. 反馈聚合按 tag 维度

### 8.1 反馈表 schema 修订

`RecommendationFeedbackV2` 在 `cause_analysis_single` / `cause_analysis_group` 类型下，metadata_json 增加：

```json
{
  "rating": "up | down",
  "comment": "...",
  "dimensions_disagreed": ["concept_confusion"],     // 用户特别不同意的 slug
  "actions_unhelpful": [0, 2]                         // 用户认为没用的建议序号
}
```

### 8.2 周报告

cron 每周一 03:00 跑：

```sql
-- 反馈差评 top tags
SELECT
  jsonb_array_elements_text(metadata_json->'dimensions_disagreed') as slug,
  COUNT(*) as down_count
FROM recommendation_feedback_v2
WHERE type IN ('cause_analysis_single', 'cause_analysis_group')
  AND rating = 'down'
  AND created_at >= now() - interval '7 days'
GROUP BY slug
ORDER BY down_count DESC
LIMIT 5;
```

输出周报告（写入 `audit_log_v2`，运营人工 review）：
```
本周差评 top tags（用户表示"我不是这个错因"）:
  1. comprehension_unclear: 12 次
  2. concept_confusion: 8 次
  ...

→ 触发 prompt context 优化：在 prompt 中增加 disambiguation 指引
```

---

## 9. 测试矩阵

| # | 场景 | 输入 | 期望 |
|---|---|---|---|
| TX1 | LLM 输出合法 slug | "concept_confusion" | 直接通过 |
| TX2 | LLM 输出非法 slug | "我自创的错因" | 强制归 other + _llm_original 保留 |
| TX3 | LLM 输出空 slug | "" | other + low severity |
| TX4 | LLM 输出大写 slug | "CONCEPT_CONFUSION" | 标准化为小写后匹配通过 |
| TX5 | LLM 输出已 deprecate 的 slug | is_active=false 的 slug | other + 警告 log |
| TX6 | 用户覆盖到合法 slug | PATCH override.slug=knowledge_gap | dim.slug 改 + user_override 写入 |
| TX7 | 用户覆盖到非法 slug | PATCH override.slug=invalid | 422 InvalidCauseTagError |
| TX8 | 用户覆盖后聚类用新 slug | get_effective_slug(dim) | 返回 user_override.slug_overridden |
| TX9 | 同题第二次分析含 evolution | 已有 1 次分析记录 | result_json.evolution_context.previous_analysis_id 不为 null |
| TX10 | 第一次分析无 evolution | 无历史 | evolution_context 字段不存在或 previous_analysis_id=null |
| TX11 | evolution chain 超过 max_depth | 已有 7 次分析 | prompt 仅注入最近 1 次（不爆 context） |
| TX12 | LLM 评估 actions_likely_completed | 上次 actions=2 项 | comparison_judgment.actions_likely_completed.length === 2 |
| TX13 | 词典 cache 失效 | POST invalidate-cache | 下次校验从 DB 重读 |
| TX14 | seed 完整性 | alembic upgrade | cause_tag_v2 16 行（15 业务 + other） |
| TX15 | 反馈差评 dimensions_disagreed | rating=down, dimensions_disagreed=[X] | 写入 metadata_json |

---

## 10. 性能考虑

| 维度 | 措施 |
|---|---|
| `VALID_SLUGS` 校验 | 进程内 set，O(1)；5min cache 失效 |
| `cause_tag_v2` 查询 | 16 行小表，is_active 索引；启动加载到内存 |
| `evolution_context` prompt 长度 | 仅注入最近 1 次（不递归注入历史链）；prompt 增量约 200 tokens |
| 用户覆盖写入 | 不改 result_json 主结构（只在 dimension 内部加 user_override），不重算缓存 |
| 聚类查询 `get_effective_slug` | 在 DB 端用 jsonb 表达式：`COALESCE(dim->'user_override'->>'slug_overridden', dim->>'slug')` |

---

## 11. 与既有设计的边界

### 11.1 与 06-AI-Cause-Analysis

- 06 文档由本文修订其 §2 prompt 模板 + §4 输出 Schema + §3.1 input 字段 (last_answer_hash 不变)
- 缓存策略 §5 不变，但 `input_hash` 计算时**包含 evolution_context.previous_analysis_id**——确保上次分析变化即缓存失效
- AI-Cause-3 决策更新：dimensions[].name 改为 dimensions[].slug + dimensions[].name_display

### 11.2 与 02-Data-Model

- 新增 `cause_tag_v2` 表（详见 §3）
- `AiCauseAnalysisV2.result_json` shape 修订（详见 §7.2）
- `ReviewAttemptV2.outcome` 新增 `CAUSE_TAG_OVERRIDDEN`

### 11.3 与 03-Backend-WU

- 新增 WU-R13 Cause Taxonomy（建表 + seed + parser + override endpoint + admin invalidate-cache）
- WU-R5 cause-analysis service 在 §6 注入 evolution_context
- WU-R6 LLM prompt 模板按本文 §4.1 修订

### 11.4 与 04-Frontend-WU

- WU-FR9 CauseAnalysis UI 增加：dimension override 按钮 + evolution timeline 组件
- 新增组件：`CauseTagOverrideModal.tsx` / `EvolutionTimeline.tsx`

### 11.5 与 11-Testing

- 15 个 TX 测试矩阵全部覆盖
- prompt enum 校验 + parser fallback + override endpoint + evolution chain

---

## 12. 引用矩阵

| 本文被引用 |
|---|
| [00-Decisions](./00-Decisions.md) §16 Taxonomy 系列 |
| [01-Boundary-Rules](./01-Boundary-Rules.md) PR-R8 |
| [02-Data-Model](./02-Data-Model.md) §3.4 cause_tag_v2 + result_json 修订 |
| [03-Backend-WU](./03-Backend-WU.md) WU-R13 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR9 修订 |
| [06-AI-Cause-Analysis](./06-AI-Cause-Analysis.md) §2/§4 修订 |
| [08-Question-Hub-Page](./08-Question-Hub-Page.md) §4 CauseCard 增 EvolutionTimeline |
| [10-NonFunctional](./10-NonFunctional.md) cause_tag 索引 |
| [11-Testing](./11-Testing.md) Cause Taxonomy 测试矩阵 |
