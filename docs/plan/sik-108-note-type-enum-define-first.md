---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-31
issue: SIK-108
relates: SIK-44 (Notes Phase) / SIK-47 (Notes CRUD contract) / SIK-107 (queries)
hard-rule: AGENT-H6 Define-First
---

# SIK-108 · NoteV2.type 4 值枚举 Define-First（H6）

> Note 主视图按 `Note v2.1` 原型用 4 种纸色编码 4 种笔记来源。但后端
> `NoteV2.type` 当前实际只用 `free` / `question_level` 两值。本文件先定义
> 稳定边界（枚举值 + 语义 + 迁移 + API 契约），再允许实现（H6）。

## 1. 现状（已核实）

- `services/api/src/sikao_api/db/models_v2.py` `NoteV2.type`：
  `String(32), default="free", server_default="free"`，无 DB enum 约束，取值由
  application 层管控（与 `QuestionV2.source` 同惯例）。
- `docs/plan/sik-47-notes-crud-contract.md` migration backfill 规则：
  `type = 'question_level' when linked_question_id IS NOT NULL else 'free'`。
- 即现网实际只产出两值：`free` / `question_level`。
- 原型 `SOURCE_TO_COLOR`：knowledge→jade / question→blue / free→amber /
  review→rose（4 值）。

## 2. 冲突

原型 4 来源 ≠ 后端 2 值。`knowledge`（知识点）/ `review`（错题反思）后端无
对应枚举，4 纸色无法一一映射 type。

## 3. 决策（lhr 2026-05-31）

把"笔记来源/用途"提升为一等领域枚举，**后端 type 扩为 4 值**。这不是为视觉
造数据 —— 这 4 类是产品里真实存在的笔记来源：

| type | 语义 | 数据来源 |
|---|---|---|
| `free` | 自由手记 | 用户主动新建（无关联） |
| `question` | 题级笔记 | Tab2 答题页对某题做的笔记（`linked_question_id` 非空） |
| `knowledge` | 知识点笔记 | 知识树节点 / 专题学习产出 |
| `review` | 错题反思 | Tab3 复盘 / 错题本「存为笔记」流入（SIK-105 SaveAsNote） |

### 3.1 命名裁决：`question` vs `question_level`

- 现网 backfill 用 `question_level`。原型用 `question`。
- **采用 `question`**（短名，与 free/knowledge/review 同形）。
- 兼容：迁移时把存量 `question_level` 归一为 `question`（见 §5）。

## 4. 边界定义（稳定契约）

### 4.1 允许值（application 层 enum）

```python
# services/api/src/sikao_api/modules/notes_v2/domain/note_type.py (新建)
from enum import StrEnum

class NoteType(StrEnum):
    FREE = "free"
    QUESTION = "question"
    KNOWLEDGE = "knowledge"
    REVIEW = "review"
```

- DB 仍 `String(32)`，不加 DB enum（与 QuestionV2.source 惯例一致，便于演进）。
- application 层在 create/update 时校验 ∈ NoteType，非法值 fail-fast 抛
  `ValidationError(code="note_type_invalid")`（H7）。

### 4.2 type 与 linked_question_id 的不变量

- `type=question` ⟺ `linked_question_id IS NOT NULL`（双向约束，service 层守卫）。
- `type ∈ {free, knowledge, review}` ⟹ `linked_question_id` 可空。
- 校验失败 fail-fast，不静默修正。

### 4.3 API 契约影响（SIK-47 D4 shape 增量）

- Create request `type` 字段允许值扩为 4（原 free/question_level）。
- List item / Detail response `type` 字段值域扩为 4。
- OpenAPI schema 的 `type` enum 同步（SIK-107 types.generated 重生成）。
- 默认值仍 `free`。

## 5. 迁移契约

新建 alembic revision（在当前 head 之后）：

1. 数据归一：`UPDATE notes_v2 SET type='question' WHERE type='question_level'`。
2. 不加 DB CHECK enum（保持 application 层管控惯例）。
3. downgrade：`UPDATE notes_v2 SET type='question_level' WHERE type='question'`
   （可逆）。

> knowledge / review 无存量数据回填（这两类由未来写入路径产生），迁移只做
> question_level → question 归一。

## 6. 非目标

- 不实现 knowledge / review 的写入路径（分属知识树 / SIK-105 SaveAsNote）。
- 不加 DB enum 约束。
- 不动 visibility / status 等其它字段。

## 7. 验证契约（实现时）

- targeted pytest：4 值 create/update 校验 + type↔linked_question_id 不变量 +
  非法值 fail-fast。
- `alembic upgrade head` + `downgrade -1` round-trip。
- targeted ruff + mypy。
- `main.py` route smoke。
- 独立 subagent review（动 schema + 迁移，H5）。

## 8. 实现顺序（与前端解耦）

- 后端枚举 + 迁移可独立于前端先行（SIK-44 后端线）。
- 前端 SIK-108 视觉/筛选不阻塞：枚举未就绪时 knowledge/review 数据为空，4 纸色
  + 5 来源 chip 视觉先行（见视觉契约 §4.4）。

## 9. 参考

- `docs/plan/sik-108-note-home-visual-contract.md` §4.4 / §5 C2
- `docs/plan/sik-47-notes-crud-contract.md`
- `services/api/src/sikao_api/db/models_v2.py` `NoteV2`
