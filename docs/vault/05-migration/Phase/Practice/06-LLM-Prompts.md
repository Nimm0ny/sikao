# Phase-Practice · 06 · LLM Prompts

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **目的**：Tab 2 新增的 LLM prompt 模板的 SSOT。所有 inline prompt string 一律 lint 拒绝。
> **路径修订**：所有"`modules/llm_v2/`"应解读为"`modules/llm/`"。

---

## 0. Prompt 文件规范（继承 Phase-Home）

每个 prompt 文件存放在 `services/api/src/sikao_api/modules/llm/application/prompts/`，必须导出三个常量 + 一个或多个渲染函数：

```python
PROMPT_VERSION = "v1"                 # 版本号，写入 LlmCallV2.prompt_version

SYSTEM_PROMPT = """..."""              # 系统提示

OUTPUT_SCHEMA = {                       # JSON Schema (draft-07)
    "type": "object",
    "required": [...],
    "properties": {...},
    "additionalProperties": false,
}

def render_user_prompt(*, ...) -> str: ...
def render_messages(*, ...) -> list[ChatMessage]: ...
```

修改 prompt 必须 bump `PROMPT_VERSION`。版本号写入 LlmCallV2，便于 A/B 与回溯。

---

## 1. 公用片段扩展（_shared.py）

Phase-Home 的 _shared.py 已有 SAFETY_FOOTER / POLICY_HEADER_REVIEW_THRESHOLDS / CONTEXT_DESCRIPTION_USER。本 Phase 追加：

```python
# _shared.py 增量

CONTEXT_QUESTION_FORMAT = """
公考题目格式约定：
- 单选题：4 个选项（A/B/C/D），1 个正确答案
- 多选题：4 个选项，2-4 个正确答案（用户全选对才算对）
- 题干（stem）：明确的问题陈述，无歧义
- 选项（options）：长度均衡，避免明显的"长答案优势"
- 解析（explanation）：先点明正确答案，再说明每个选项对错的理由

申论题目格式：
- 题干（stem）：题目要求 + 字数限制
- 材料（materials）：1000-3000 字背景材料
- 字数限制（word_limit）：通常 200-1500 字
"""

POLICY_QUALITY_BARS = """
公考题目质量底线（必须遵守）：
1. 答案唯一且无争议（多选题除外）
2. 解析必须能反推出正确答案
3. 选项之间不能有明显逻辑关联（如 A 含 B）
4. 题干不依赖于外部上下文（自包含）
5. 不涉及政治敏感话题、歧视性内容
6. 涉及法律 / 政策时引用最新版本（截至 2024 年）
"""

ADAPTATION_RULES = """
改编（非凭空生成）规则：
- 必须基于真题（"源真题"）改编，不是凭空创作
- 改编强度 = 难度调整：
  - 升级：增加干扰项 / 数据复杂度 / 推理步骤
  - 降级：简化背景 / 减少干扰 / 直白表述
- 保留原题考点（题型 / 知识点 / 能力维度）
- 改变：题干用词 / 数据 / 选项内容；不改变：核心考查能力
"""
```

---

## 2. question_generate.py（AI 出题）

### 2.1 SYSTEM_PROMPT

```
你是 Sikao 公考备考的"题目生成器"。任务：基于多道真题（"源真题"），生成 N 道改编题，用于学生练习。

【上下文】
{CONTEXT_DESCRIPTION_USER}

{CONTEXT_QUESTION_FORMAT}

{POLICY_QUALITY_BARS}

{ADAPTATION_RULES}

【目标难度】
target_difficulty 是历史正确率区间，N% 用户答对为该题难度（值越低 = 题越难）。
- 低难度（>0.8）：知识点直白 / 选项区分明显
- 中难度（0.6-0.8）：需要推理 / 干扰项有迷惑性
- 高难度（<0.6）：复杂推理 / 多步骤 / 干扰项强

【硬约束】
1. 生成 count 道改编题，每道关联一道源真题（输出 source_question_id）
2. 每道题必须 self-contained
3. 多选题正确答案数 2-4
4. 解析必须 ≥ 50 字，能完整推导出答案
5. 不得简单复制源真题（题干、选项、答案任何一项 90% 以上文本相似 = 失败）

{SAFETY_FOOTER}
```

### 2.2 OUTPUT_SCHEMA

```python
OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["questions"],
    "properties": {
        "questions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 30,
            "items": {
                "type": "object",
                "required": ["source_question_id", "type", "stem", "options", "correct_answer", "explanation"],
                "properties": {
                    "source_question_id": {"type": "integer", "description": "改编源真题的 QuestionV2.id"},
                    "type": {"enum": ["single_choice", "multi_choice"]},
                    "stem": {"type": "string", "minLength": 10},
                    "options": {
                        "type": "object",
                        "required": ["A", "B", "C", "D"],
                        "additionalProperties": false,
                        "properties": {
                            "A": {"type": "string", "minLength": 1},
                            "B": {"type": "string", "minLength": 1},
                            "C": {"type": "string", "minLength": 1},
                            "D": {"type": "string", "minLength": 1},
                        },
                    },
                    "correct_answer": {"type": "string", "pattern": "^[ABCD]+$", "description": "single_choice 1 字符；multi_choice 2-4 字符"},
                    "explanation": {"type": "string", "minLength": 50},
                    "estimated_difficulty": {"type": "number", "minimum": 0.0, "maximum": 1.0, "description": "改编后预估难度（用于反馈）"},
                },
            },
        },
    },
    "additionalProperties": false,
}
```

### 2.3 render_messages

```python
def render_messages(
    *,
    sources: list[SourceQuestion],
    target_difficulty: tuple[float, float],
    count: int,
) -> list[ChatMessage]:
    user_prompt = f"""
请基于以下 {len(sources)} 道源真题，改编生成 {count} 道新题：

{format_sources(sources)}

【目标难度】历史正确率区间 [{target_difficulty[0]:.2f}, {target_difficulty[1]:.2f}]

【输出要求】
- 严格 JSON 格式
- {count} 道题
- 每道关联到一个源真题（source_question_id）
- 解析详细
"""
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_prompt),
    ]
```

---

## 3. question_self_audit.py（题目自审）

### 3.1 SYSTEM_PROMPT

```
你是公考题目质量审核员。任务：审核一道改编题，判断是否达到上线标准。

【上下文】
{CONTEXT_QUESTION_FORMAT}

{POLICY_QUALITY_BARS}

【审核维度】
1. 答案正确性（最关键）：题干 + 选项 + 答案 + 解析自洽，能反推出答案
2. 题干无歧义：不依赖外部上下文，关键概念清晰
3. 选项均衡：长度差不超过 1.5 倍；无明显逻辑包含关系
4. 难度合理：与 estimated_difficulty 不偏离 0.2 以上
5. 安全合规：不涉及政治敏感 / 歧视 / 不当内容

【输出】
- passed: bool（true 表示可上线）
- confidence: 0.0-1.0（置信度）
- reason: 简明解释（< 200 字）
- issues: 具体问题列表（passed=false 时填，含每个问题的简短描述）

【严格度】
宁可错杀（passed=false），不要放行。任何一个维度有显著问题 → passed=false。

{SAFETY_FOOTER}
```

### 3.2 OUTPUT_SCHEMA

```python
OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["passed", "confidence", "reason"],
    "properties": {
        "passed": {"type": "boolean"},
        "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "reason": {"type": "string", "minLength": 10, "maxLength": 200},
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["dimension", "description"],
                "properties": {
                    "dimension": {"enum": ["answer_correctness", "stem_clarity", "options_balance", "difficulty", "safety"]},
                    "description": {"type": "string"},
                },
            },
        },
    },
    "additionalProperties": false,
}
```

### 3.3 render_messages

```python
def render_messages(*, question: GeneratedQuestion) -> list[ChatMessage]:
    user_prompt = f"""
请审核以下题目：

【题型】{question.type}
【题干】{question.stem}

【选项】
A. {question.options['A']}
B. {question.options['B']}
C. {question.options['C']}
D. {question.options['D']}

【正确答案】{question.correct_answer}
【解析】{question.explanation}
【预估难度】{question.estimated_difficulty}

【源真题】
{format_source(question.source)}

【输出 JSON】
"""
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_prompt),
    ]
```

---

## 4. essay_grade.py（申论批改）

### 4.1 SYSTEM_PROMPT

```
你是 Sikao 公考申论阅卷老师。任务：客观、详细地批改一份申论答案，输出结构化报告。

【上下文】
{CONTEXT_DESCRIPTION_USER}

{CONTEXT_QUESTION_FORMAT}

【批改维度】
1. 立意（满分 25 分）：
   - 是否准确把握题目要求
   - 中心论点是否清晰
   - 是否结合材料

2. 论据（满分 25 分）：
   - 论据是否充分支撑论点
   - 是否引用材料中的具体内容
   - 是否有适当的拓展思考

3. 结构（满分 20 分）：
   - 段落布局是否合理
   - 逻辑层次是否清晰
   - 起承转合是否自然

4. 语言（满分 20 分）：
   - 表述是否准确流畅
   - 用词是否得体（公文风格 / 学术风格）
   - 标点和书写规范

5. 字数（满分 10 分）：
   - 达标（在 word_limit ± 10%）：10 分
   - 略不足（90% 内）：6-9 分
   - 严重不足（<90%）：0-5 分
   - 严重超出（>110%）：0-5 分

【批改风格】
- 客观、具体、可操作
- 亮点（highlights）必须引用原文（带引号）
- 问题（issues）必须指出具体段落 / 句子
- 改进建议（improvement_suggestions）必须可执行

{SAFETY_FOOTER}
```

### 4.2 OUTPUT_SCHEMA

```python
OUTPUT_SCHEMA = {
    "type": "object",
    "required": [
        "total_score", "dimensions", "highlights", "issues",
        "overall_comment", "improvement_suggestions",
    ],
    "properties": {
        "total_score": {"type": "number", "minimum": 0, "maximum": 100},
        "dimensions": {
            "type": "array",
            "minItems": 5,
            "maxItems": 5,
            "items": {
                "type": "object",
                "required": ["name", "score", "max_score", "comment"],
                "properties": {
                    "name": {"enum": ["立意", "论据", "结构", "语言", "字数"]},
                    "score": {"type": "number"},
                    "max_score": {"type": "number"},
                    "comment": {"type": "string", "minLength": 30},
                },
            },
        },
        "highlights": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["original_text", "praise"],
                "properties": {
                    "original_text": {"type": "string"},
                    "praise": {"type": "string"},
                },
            },
        },
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["original_text", "problem", "suggestion"],
                "properties": {
                    "original_text": {"type": "string"},
                    "problem": {"type": "string"},
                    "suggestion": {"type": "string"},
                },
            },
        },
        "overall_comment": {"type": "string", "minLength": 100},
        "improvement_suggestions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {"type": "string", "minLength": 20},
        },
    },
    "additionalProperties": false,
}
```

### 4.3 render_messages

```python
def render_messages(
    *,
    stem: str,
    materials: str,
    answer: str,
    word_limit: int,
) -> list[ChatMessage]:
    user_prompt = f"""
请批改以下申论答案：

【题目】
{stem}

【背景材料】
{materials}

【字数要求】{word_limit} 字（允许 ±10%）

【用户答案】
{answer}

【字数统计】当前 {count_chinese_chars(answer)} 字

【输出】严格按 JSON Schema 输出。total_score = sum(dimensions.score)。
"""
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_prompt),
    ]
```

---

## 5. reference_answer.py（范文生成）

### 5.1 SYSTEM_PROMPT

```
你是 Sikao 公考申论范文撰写专家。任务：基于题干和材料，写一份高质量范文。

【上下文】
{CONTEXT_DESCRIPTION_USER}

{CONTEXT_QUESTION_FORMAT}

【写作要求】
1. 严格切题，紧扣材料
2. 立意鲜明，论点清晰
3. 论据充实，有材料引用
4. 结构合理（总-分-总 / 并列 / 递进）
5. 语言流畅、规范、得体
6. 字数控制在 word_limit ± 10%

【范文风格】
- 高分范文标准（80+ 分水准）
- 不追求文学性，追求实用性 + 高分点覆盖
- 适当用排比 / 引用 / 总结句

【输出】
- content: 范文全文
- structure_outline: 结构大纲（简短列表）
- key_points: 关键得分点（用于学生参考）

{SAFETY_FOOTER}
```

### 5.2 OUTPUT_SCHEMA

```python
OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["content", "structure_outline", "key_points"],
    "properties": {
        "content": {"type": "string", "minLength": 100},
        "structure_outline": {
            "type": "array",
            "minItems": 3,
            "items": {"type": "string"},
        },
        "key_points": {
            "type": "array",
            "minItems": 3,
            "maxItems": 8,
            "items": {"type": "string"},
        },
        "estimated_score": {"type": "number", "minimum": 60, "maximum": 100},
    },
    "additionalProperties": false,
}
```

### 5.3 render_messages

```python
def render_messages(
    *,
    stem: str,
    materials: str,
    word_limit: int,
) -> list[ChatMessage]:
    user_prompt = f"""
请为以下申论题撰写范文：

【题目】
{stem}

【背景材料】
{materials}

【字数要求】{word_limit} 字（允许 ±10%）

【输出】严格按 JSON Schema。content 为完整范文（中文），structure_outline 为段落大纲。
"""
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_prompt),
    ]
```

---

## 6. Prompt 版本管理

每个 prompt 文件首行 `PROMPT_VERSION = "v1"`：
- 修改 SYSTEM_PROMPT / OUTPUT_SCHEMA / render_messages 任一 → 必须 bump 版本号
- 版本号自动写入 LlmCallV2.prompt_version
- A/B 测试时通过环境变量 `LLM_PROMPT_VERSION_OVERRIDE` 控制（远期）

历史版本归档：
```
modules/llm/application/prompts/
  question_generate.py            # 当前版本（v1）
  question_generate_v0.py         # 已废弃版本（保留 7 天后清理）
  ...
```

---

## 7. lint 规则（NF-Audit）

`apps/web/scripts/lint-no-inline-prompt.mjs`（如不存在则新建）：
- 扫描 `services/api/src/sikao_api/modules/**/*.py`
- 匹配可能是 prompt 的 inline string（多行字符串 + > 200 字符 + 含中文）
- 在非 `prompts/` 目录中出现 → fail

CI 必跑此 lint。

---

## 8. 测试约束

每个 prompt 文件必须有：
- `tests/modules/llm/prompts/test_<prompt_name>.py`
- 测试 OUTPUT_SCHEMA 的 JSON Schema 验证（用 jsonschema 库）
- 测试 render_messages 输出格式（含 system / user 角色顺序）
- mock provider fixture 与 OUTPUT_SCHEMA 完全匹配（防止 fixture drift）

---

## 9. 与 LLM 模块的整合

详见 [05-LLM-Module §2](./05-LLM-Module.md#2-tab-2-新增能力概述)。

每个 prompt 文件由对应的 application module（question_generator / essay_grader / reference_answer_generator）调用：

```python
# question_generator.py
from .prompts import question_generate, question_self_audit

async def generate_questions(...):
    # 用 question_generate.SYSTEM_PROMPT + render_messages
    ...
    # 自审用 question_self_audit
    ...
```

---

## 10. 变更日志

| 版本 | prompt | 变更 |
|---|---|---|
| v1 | question_generate / question_self_audit / essay_grade / reference_answer | 初始版本 |

未来变更在此记录。
