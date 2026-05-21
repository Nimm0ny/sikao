# Phase-Practice · 15 · Question Metadata（Schema 预留 + Phase 2 蓝图）

> **Status**: PARTIAL（本 Phase 仅落 schema，端点 / cron 推 Phase 2）
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Module**: `modules/question_metadata/`（Phase 2 新建）
> **决策来源**：`00-Decisions.md` QMeta-* 系列

---

## 1. 文档定位

### 1.1 为什么本 Phase 只落 schema

题目深度元数据（知识点 / 能力维度 / 区分度 / 热度）是练习模块的"长尾"价值能力：

- **价值高**：错因聚类、知识图谱、AI 出题精准度、跨题关联推荐都依赖这层数据
- **冷启动慢**：新建知识点表需要数据初始化（人工标注 / LLM 辅助标注）
- **耦合 Review**：Phase-Review `06-AI-Cause-Analysis.md` 错因分析的"按知识点聚类"是这层数据的核心消费者

策略：
- **Phase 1（本 Phase）**：QuestionV2 加预留字段 + 新建 KnowledgePointV2 + QuestionKnowledgePointV2 两张表（**仅建表 + 字段，不实现端点 / cron / 数据填充**）
- **Phase 2（Phase-Review 之后）**：完整模块 `modules/question_metadata/` 落地，含端点 / 标注流程 / cron

⚠️ 这是少见的"schema 提前落地，逻辑分两期"的设计。理由：避免 Phase 2 开始时再做一次 alembic migration（涉及 question_v2 数百万行 UPDATE 风险）。

### 1.2 与其他模块的关系

| 模块 | 当前 Phase 1 关系 | Phase 2 关系 |
|---|---|---|
| `ai_questions` | category_l1/l2 输入 LLM | 加 knowledge_points 输入提升精准度 |
| `practice_stats` | 仅按 category 聚合 | 加按 knowledge_point 聚合 |
| `daily_practice` | 弱项加权用 category | 改用 knowledge_point 更细粒度 |
| Phase-Review `cause-analysis` | 用 category | 改用 knowledge_point 聚类 |
| Phase-Review `insights` | 用 category 错题趋势 | 加 knowledge_point 维度图 |

---

## 2. Phase 1 落地范围

### 2.1 QuestionV2 字段扩展（schema 预留）

新增字段（详见 [02-Data-Model §2.1](./02-Data-Model.md#21-questionv2最重要的扩展)）：

```python
class QuestionV2(Base):
    # ===== Phase 1 落地的元数据预留字段 =====
    ability_dimensions: Mapped[list[str]] = mapped_column(
        JSON, default=list
    )
    # 能力维度数组：理解 / 推理 / 计算 / 记忆 / 应用
    # 默认 [] = 未标注；Phase 2 由人工 + LLM 协作标注

    discrimination_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 区分度（0.0-1.0）：高分用户对、低分用户错的程度
    # null = 样本不足或未计算
    # Phase 2 由 cron 计算

    heat_score: Mapped[float] = mapped_column(Float, default=0.0)
    # 热度分（最近 30 天答题次数 / 该 type 平均次数）
    # Phase 2 由 cron 每日计算

    complexity_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # 复杂度等级（1-5）：1 简单识记，5 综合复杂推理
    # null = 未标注；Phase 2 标注

    knowledge_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    # 知识点标签（字符串列表，独立于 KnowledgePointV2 表）
    # 这是"快速标签"层，与 KnowledgePointV2 的"结构化知识点"双轨：
    # - knowledge_tags = 字符串自由组合，初期 LLM 自动产出，无需引用约束
    # - knowledge_points (via QuestionKnowledgePointV2) = 结构化树，编辑严格
    # Phase 2 决策：tags → 结构化点 的迁移路径
```

### 2.2 KnowledgePointV2 表（建表，无数据）

```python
class KnowledgePointV2(Base):
    __tablename__ = "knowledge_point_v2"

    id: Mapped[int] = mapped_column(primary_key=True)

    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # 唯一编码（如 "yanyu.fragment_filling"）

    label: Mapped[str] = mapped_column(String(128))
    # 显示名（如 "片段填充"）

    category_l1: Mapped[str] = mapped_column(String(32), index=True)
    # 一级模块（与 QuestionV2.category_l1 对齐）

    category_l2: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # 二级模块

    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("knowledge_point_v2.id"), nullable=True
    )
    # 知识点树父节点；null = 顶层

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 知识点描述（用于 LLM prompt 与 UI 解释）

    weight_in_exam: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 在公考中的考查权重（0.0-1.0）；用于推荐时优先弱项中的高权重点

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())
```

⚠️ Phase 1 仅建表 + alembic migration，**不写入任何数据**。Phase 2 通过 admin 工具批量录入或 LLM 辅助生成。

### 2.3 QuestionKnowledgePointV2 关联表（建表，无数据）

```python
class QuestionKnowledgePointV2(Base):
    __tablename__ = "question_knowledge_point_v2"

    id: Mapped[int] = mapped_column(primary_key=True)

    question_id: Mapped[int] = mapped_column(
        ForeignKey("question_v2.id", ondelete="CASCADE"),
        index=True,
    )

    knowledge_point_id: Mapped[int] = mapped_column(
        ForeignKey("knowledge_point_v2.id"),
        index=True,
    )

    weight: Mapped[float] = mapped_column(Float, default=1.0)
    # 该知识点在该题中的权重（一题可关联多知识点）
    # 权重之和不强制 = 1.0（允许并列重要的多个点）

    annotated_by: Mapped[str] = mapped_column(String(32))
    # 'human' | 'llm_auto' | 'llm_assisted'

    annotated_at: Mapped[datetime] = mapped_column(default=func.now())

    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    # LLM 标注的置信度（仅 annotated_by 含 llm 时填）

    __table_args__ = (
        UniqueConstraint("question_id", "knowledge_point_id"),
    )
```

---

## 3. Phase 1 不实现的部分（明确标注）

以下能力**明确不在本 Phase 范围**，仅作蓝图：

### 3.1 端点（推 Phase 2）

```
GET /api/v2/knowledge-points
GET /api/v2/knowledge-points/:id
GET /api/v2/knowledge-points/:id/questions

GET /api/v2/questions/:id/metadata
GET /api/v2/questions/:id/related?type=knowledge_point|same_pattern|same_category
GET /api/v2/practice/stats/knowledge-points
GET /api/v2/practice/insights/discrimination

POST /admin/knowledge-points
PATCH /admin/knowledge-points/:id
POST /admin/questions/:id/knowledge-points
DELETE /admin/questions/:id/knowledge-points/:kp_id

POST /admin/questions/:id/auto-annotate    # LLM 辅助标注
POST /admin/llm/annotate-batch              # 批量
```

### 3.2 Cron（推 Phase 2）

```
recompute_question_discrimination     每周一 02:00
recompute_question_heat               每日 04:00
auto_annotate_unlabeled_questions     每周日 03:00（LLM 辅助）
```

### 3.3 LLM 能力（推 Phase 2）

新增 prompt：
- `question_knowledge_point_extractor.py`：给一道题，返回最匹配的 1-3 个 knowledge_point_id + confidence
- `question_complexity_estimator.py`：估计 complexity_level
- `question_ability_dimensions_classifier.py`：分类 ability_dimensions

### 3.4 数据填充（推 Phase 2）

KnowledgePointV2 数据来源（按优先级）：
1. 公考备考资料人工梳理（专家 + admin 工具录入）
2. 既有题目 stem + explanation 喂 LLM 自动归类（confidence > 0.8 自动接受）
3. 用户反馈纠错

QuestionKnowledgePointV2 关联建立：
1. 用 LLM 批量自动标注（annotated_by='llm_auto'）
2. 高置信度直接生效；低置信度入审核队列
3. admin 工具二次确认（annotated_by='human'）

---

## 4. Phase 1 必须做的（schema 预留细节）

### 4.1 alembic migration 顺序

详见 [03-Backend-WU §23](./03-Backend-WU.md#23-wu-b29-question_metadata-schema-预留)：

```
revision: 20260521_xx_question_meta_phase1
upgrade:
  - QuestionV2 加 ability_dimensions / discrimination_index / heat_score / complexity_level / knowledge_tags 字段
  - 创建 KnowledgePointV2 表
  - 创建 QuestionKnowledgePointV2 表
  - 数据回填：现有题 ability_dimensions=[] / discrimination_index=NULL / heat_score=0.0 / complexity_level=NULL / knowledge_tags=[]
  - KnowledgePointV2 / QuestionKnowledgePointV2 留空
downgrade:
  - 反向操作
```

### 4.2 Pydantic schema 暴露

`schemas_v2.py` 加：

```python
class QuestionMetadataPreviewV2(CamelModel):
    """Phase 1 暴露给前端的最小元数据。"""
    ability_dimensions: list[str]
    complexity_level: int | None
    knowledge_tags: list[str]                  # 字符串数组
    heat_score: float
    # discrimination_index 不暴露（admin only）
    # KnowledgePointV2 关联在 Phase 2 暴露
```

`QuestionEnvelopeV2` 加可选字段 `metadata_preview: QuestionMetadataPreviewV2 | None`。Phase 1 该字段始终为 None（除非显式预填）。

### 4.3 lint 规则（保护 schema）

Phase 1 生效：
- `QuestionV2.ability_dimensions / knowledge_tags` 字段在 service 层不被随意写入（只允许 admin 端点 / Phase 2 cron 写）
- `KnowledgePointV2 / QuestionKnowledgePointV2` 表在 Phase 1 内**只读**（CRUD 端点不暴露）

防误用机制：
- service 层不导出这些表的 CRUD 函数
- Phase 1 的 `models_v2.py` 中给这些 model 加 marker：
  ```python
  class KnowledgePointV2(Base):
      __phase__ = "phase_2"   # 提示后续维护者
      ...
  ```

---

## 5. 与 Phase-Review 的协同

### 5.1 当前 Phase-Review 设计基于 category

Phase-Review `06-AI-Cause-Analysis.md` 当前用 `category_l1/l2` 做错因聚类。这在 Phase 1 阶段是足够的（大颗粒）。

### 5.2 Phase 2 升级路径

待 question_metadata 完整模块上线后：
- Phase-Review 错因聚类升级为 knowledge_point 维度
- 新错因维度：`knowledge_gap`（按 knowledge_point 反向归因）
- 该升级走 Phase-Review 自己的子文档 v2 修订，不在本文范围

---

## 6. Schema 预留的 Invariant（Phase 1 范围）

详见 [01-Boundary-Rules §16](./01-Boundary-Rules.md#16-题目元数据边界qmeta-)。

| Invariant | 描述 |
|---|---|
| **QMeta-Phase1-Empty** | Phase 1 完工时 KnowledgePointV2 / QuestionKnowledgePointV2 必须为空（除测试 fixture 外） |
| **QMeta-Phase1-No-Endpoint** | Phase 1 不暴露任何 KnowledgePoint / QuestionKnowledgePoint 端点（仅在 OpenAPI 中以 `x-phase: 2` 标记） |
| **QMeta-Phase1-Service-Hidden** | service 层不导出对这两个表的 CRUD 函数；任何调用走 admin 工具 |
| **QMeta-Field-Default-Backfill** | alembic upgrade 后，所有现有 QuestionV2 行的新字段必须有默认值（不 NULL 除可空字段外） |
| **QMeta-Lint-Tag-Format** | knowledge_tags 列表元素必须满足 `^[a-z][a-z0-9_]*$`（蛇形）以便 Phase 2 迁移到 knowledge_point.code 时无歧义 |
| **QMeta-AbilityDim-Enum** | ability_dimensions 元素必须 ∈ {"comprehension", "reasoning", "calculation", "memory", "application"}（DB CHECK 约束 array element） |
| **QMeta-Complexity-Range** | complexity_level ∈ [1, 5] ∪ {NULL} |
| **QMeta-Heat-NonNegative** | heat_score >= 0.0 |

---

## 7. Phase 2 蓝图（仅参考，不在本 Phase 实施）

完整设计将在 Phase 2 启动时单独写 `Phase/QuestionMetadata/` 子目录。蓝图概要：

### 7.1 模块结构（Phase 2）

```
modules/question_metadata/
  application/
    knowledge_point_query.py         # 知识点树查询
    discrimination_computer.py       # 区分度计算（cron 用）
    heat_computer.py                 # 热度计算
    annotator.py                     # LLM 辅助标注
    related_question_finder.py       # 关联题查找
  domain/
  interface/
    routes.py
    admin_routes.py
```

### 7.2 数据填充流程（Phase 2）

```
admin 录入 KnowledgePointV2 树（约 200-500 个节点）
  ↓
对每道现有题（10k-100k）跑 LLM 自动标注
  ↓
高置信度（> 0.8）自动入 QuestionKnowledgePointV2
  ↓
低置信度入审核队列
  ↓
admin 工具二次确认 / 拒绝
  ↓
全量上线
```

### 7.3 性能与成本预估（Phase 2）

- LLM 自动标注 10k 道题成本：约 $30-50（DeepSeek 价格）
- cron `recompute_question_discrimination` 每周一次：5-15 min
- cron `recompute_question_heat` 每日：3-10 min

---

## 8. 关联文档

- [00-Decisions §18](./00-Decisions.md#18-题目元数据qmeta-系列phase-1-仅-schema) - QMeta-* 决策
- [01-Boundary-Rules §16](./01-Boundary-Rules.md#16-题目元数据边界qmeta-) - QMeta-* invariant
- [02-Data-Model §2.1 / §3.10 / §3.11](./02-Data-Model.md) - schema
- [03-Backend-WU §23](./03-Backend-WU.md#23-wu-b29-question_metadata-schema-预留) - WU-B29 schema-only PR 拆分
- [Phase-Review 06-AI-Cause-Analysis](../Review/06-AI-Cause-Analysis.md) - Phase 2 主要消费者
