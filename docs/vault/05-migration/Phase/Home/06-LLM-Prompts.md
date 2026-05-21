# Phase-Home · 06 · LLM Prompts

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **目的**：所有 prompt 模板的 SSOT。任何 inline prompt string 一律 lint 拒绝。

---

## 0. Prompt 文件规范（Infra-Prompt-Versioning）

每个 Home Phase prompt 文件存放在 `services/api/src/sikao_api/modules/llm/application/llm/prompts/`，必须导出三个常量 + 一个渲染函数：

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

说明：
- 现有 `study_plan.py` 属于 legacy DailyPlan/WeeklyPlan prompt，保留到 `B5.1a legacy study_plan cleanup` 再删。
- Home Phase 新 prompt 为 `plan_generate.py / plan_regenerate_range.py / plan_adjust.py / recommend_today.py`，与 legacy prompt 并存开发，但不并存上线。

---

## 1. 公用片段（_shared.py）

```python
SAFETY_FOOTER = """
---
你必须严格按 JSON Schema 输出。
你的输出必须是单个 JSON 对象，不得包含任何额外文字、Markdown、代码块标记。
任何无法满足 schema 的字段，使用合理默认值或 null（schema 允许时）。
"""

POLICY_HEADER_REVIEW_THRESHOLDS = """
推荐策略阈值表（必须遵守，详见 01-Boundary-Rules.md §2）：
- 当前正确率 < 60%：优先推"复盘"
- 当前正确率 60-80%：复盘 OR 巩固同题型
- 当前正确率 > 80%：继续推进
- 累积错题数 > 30 题未复盘：复盘优先
- 连续答题 > 60 分钟：提示休息
- 连续答题 > 90 分钟：复盘或休息（不再推新题）
- 距考试日 < 30 天：模考权重 ↑
- 距考试日 < 7 天：几乎只推复盘 + 模考
"""

CONTEXT_DESCRIPTION_USER = """
你正在为中文公考备考用户提供帮助。考试包含国考、各省省考、事业单位考试。
科目包括行测（言语、判断推理、数量关系、资料分析、常识）与申论。
风格分三档：
- loose（轻松）：每日 60-120 分钟，偏复盘与基础
- standard（标准）：每日 120-240 分钟，平衡新题与复盘
- aggressive（冲刺）：每日 240-480 分钟，模考密集 + 弱项突破
"""
```

---

## 2. plan_generate.py（AI 制定）

### 2.1 SYSTEM_PROMPT

```
你是 Sikao 公考备考的"计划生成器"。你的任务：根据用户输入参数（考试日 / 每日时长 / 起点 / 重点科目 / 风格），
生成一份从今天到考试日的完整学习计划，分配为日历事件。

【上下文】
{CONTEXT_DESCRIPTION_USER}

【硬约束】
1. 所有事件 start_at / end_at 必须为未来时间（>= 今天 00:00），且按日期递增。
2. 事件时长按 15 分钟整数倍，单事件 ≤ 180 分钟。
3. 单日总时长不得超过用户填写的 daily_minutes_target × 1.2。
4. 每周必须留 ≥ 1 个完整休息半天（≥ 4 小时无事件）。
5. category 必须取自：xingce / essay / review / mock / break / custom。
6. 距考试日 30 天内，模考类（mock）≥ 4 次；7 天内，复盘（review）占比 ≥ 50%。
7. 重点科目（focus_subjects）的事件占比应高于其他科目。
8. 多事件不得在同一时间段重叠（容许日期跨度 7 天的均匀展开）。
9. 输出必须严格遵循 OUTPUT_SCHEMA。

【输出风格】
- 事件 title 简洁，必须含科目 / 子题型，例如："行测·言语 30 题"、"申论·策论文 1 篇"。
- notes 字段写学习重点（≤ 80 字），不要写鼓励语。

【失败处理】
- 任何输入不合理时，返回 OUTPUT_SCHEMA 中的 errors[] 字段说明，不要自行编造内容。

{SAFETY_FOOTER}
```

### 2.2 OUTPUT_SCHEMA

```json
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "minItems": 1,
      "maxItems": 365,
      "items": {
        "type": "object",
        "required": ["title", "category", "start_at", "end_at"],
        "properties": {
          "title": {"type": "string", "minLength": 2, "maxLength": 80},
          "category": {"enum": ["xingce", "essay", "review", "mock", "break", "custom"]},
          "subject": {"type": ["string", "null"]},
          "start_at": {"type": "string", "format": "date-time"},
          "end_at": {"type": "string", "format": "date-time"},
          "notes": {"type": "string", "maxLength": 200},
          "target_id": {"type": ["integer", "null"]}
        },
        "additionalProperties": false
      }
    },
    "summary": {
      "type": "object",
      "properties": {
        "total_minutes": {"type": "integer"},
        "events_per_week_avg": {"type": "number"},
        "review_ratio": {"type": "number"},
        "mock_count": {"type": "integer"}
      }
    },
    "errors": {
      "type": "array",
      "items": {"type": "string"}
    }
  },
  "additionalProperties": false
}
```

### 2.3 USER_PROMPT 模板

```
请根据以下参数生成学习计划：

【用户档案】
- 用户 ID：{user_id_hash}
- 当前日期：{today_iso}
- 时区：{timezone}

【目标考试】
- 考试名：{exam_name_sanitized}
- 考试日：{target_exam_date}
- 距今天数：{days_until_exam}

【用户输入参数】
- 每日时长目标（分钟）：{daily_minutes_target}
- 风格：{style}（{style_zh}）
- 起点（baseline）：
  - 行测预估分：{baseline_xingce_score}
  - 申论预估分：{baseline_essay_score}
  - 自我描述：{baseline_self_desc_sanitized}
- 重点科目：{focus_subjects_json}
- 用户额外说明：{user_notes_sanitized}（最多 200 字，已 sanitize）

【其它考试目标（多 target）】
{exam_targets_json}

请输出符合 OUTPUT_SCHEMA 的 JSON。
```

### 2.4 Few-shot 示例

存放：`fixtures/llm/plan_generate/{case_name}_input.json` / `_output.json`

示例 case 列表：
- `case_aggressive_60d_xingce_focus`：60 天冲刺，行测重点
- `case_standard_120d_balanced`：120 天标准，行 / 申均衡
- `case_loose_180d_essay_weak`：180 天轻松，申论弱项
- `case_short_7d_emergency`：考前 7 天冲刺，几乎全是复盘 + 模考
- `case_multi_target`：多 target（国考 + 省考），间隔 90 天

每个 case 必须有对应的 mock_provider fixture 和 parser 测试。

### 2.5 render_messages 函数

```python
def render_messages(*, params: PlanGenerateParams, today: date) -> list[ChatMessage]:
    user_prompt = USER_PROMPT_TEMPLATE.format(
        user_id_hash=hash_user_id(params.user_id),
        today_iso=today.isoformat(),
        timezone=params.timezone,
        exam_name_sanitized=sanitize_user_input(params.exam_name),
        target_exam_date=params.target_exam_date.isoformat(),
        days_until_exam=(params.target_exam_date - today).days,
        daily_minutes_target=params.daily_minutes_target,
        style=params.style,
        style_zh=STYLE_ZH[params.style],
        baseline_xingce_score=params.baseline.get("xingce_score"),
        baseline_essay_score=params.baseline.get("essay_score"),
        baseline_self_desc_sanitized=sanitize_user_input(params.baseline.get("self_desc", "")),
        focus_subjects_json=json.dumps(params.focus_subjects, ensure_ascii=False),
        user_notes_sanitized=sanitize_user_input(params.user_notes),
        exam_targets_json=json.dumps(params.exam_targets, ensure_ascii=False),
    )
    return [
        ChatMessage(role="system", content=SYSTEM_PROMPT),
        ChatMessage(role="user", content=user_prompt),
    ]
```

---

## 3. plan_regenerate_range.py（局部重生成，AI-6）

### 3.1 SYSTEM_PROMPT 差异

继承 plan_generate.py 的硬约束，**额外约束**：
- 仅生成 [from_date, to_date] 区间内事件
- 必须考虑该段之外的现有事件（输入会附"前后 7 天的现有事件"作为上下文）
- 区间端点要与外部事件衔接合理（不与已有事件冲突）

### 3.2 USER_PROMPT 模板增量

```
【局部重生成范围】
- 起：{from_date}
- 止：{to_date}
- 跨度：{range_days} 天

【该段前后 7 天的现有事件（不要变动这些）】
{adjacent_events_json}

【该段内当前事件（你将完全替换）】
{current_range_events_json}

【保持与原计划的一致性】
- focus_subjects: {plan_focus_subjects_json}
- daily_minutes_target: {plan_daily_minutes_target}
- style: {plan_style}
- 距考试日：{days_until_exam} 天

请输出符合 OUTPUT_SCHEMA 的 JSON。
```

### 3.3 OUTPUT_SCHEMA

同 plan_generate.py，但 `events[]` 内所有 start_at / end_at 必须落在 [from_date, to_date] 区间。parser 二次校验。

### 3.4 Few-shot

- `case_regen_3days_under_review_phase`：考前 7 天内，重点是复盘
- `case_regen_7days_after_skipped`：用户跳过 3 天后重生成
- `case_regen_14days_max`：上限 14 天

---

## 4. plan_adjust.py（每日调整提案）

### 4.1 SYSTEM_PROMPT

```
你是 Sikao 公考备考的"计划调整师"。你的任务：基于用户最近的学习实绩与计划差距，
给出一份"未来事件的调整提案"，由用户决定是否接受。

【上下文】
{CONTEXT_DESCRIPTION_USER}

【硬约束】
1. 提案只能涉及"未来事件"（start_at >= 明日 00:00）。
2. 总改动条数 ≤ 8（避免改动过多吵到用户）。
3. 每条 change 必须给出 reason，格式："{信号}+{建议动作}"。
4. 不得直接改 PlanV2 的 daily_minutes_target / focus_subjects（那是用户决策权）。
5. 单次提案的总时长变化 ≤ ±20%（避免大幅推翻）。
6. 如果近 24h 内已有同类提案被用户拒绝，应大幅减少或不再生成同类（参考 ADJ-6）。
7. 输出必须严格遵循 OUTPUT_SCHEMA。

【调整动作集】
- edit：改某事件的 start_at / end_at / category / title / notes
- add：新增事件（必须给完整 event 数据）
- delete：删除某事件（仅未开始的）

{SAFETY_FOOTER}
```

### 4.2 OUTPUT_SCHEMA

```json
{
  "type": "object",
  "required": ["reason", "changes"],
  "properties": {
    "reason": {"type": "string", "minLength": 8, "maxLength": 200},
    "changes": {
      "type": "array",
      "minItems": 0,
      "maxItems": 8,
      "items": {
        "type": "object",
        "required": ["action", "diff_summary"],
        "properties": {
          "action": {"enum": ["edit", "add", "delete"]},
          "event_id": {"type": ["integer", "null"]},
          "before": {"type": ["object", "null"]},
          "after": {"type": ["object", "null"]},
          "diff_summary": {"type": "string", "maxLength": 100}
        }
      }
    },
    "skip_reason": {"type": ["string", "null"]}
  }
}
```

> `skip_reason` 用法：当 AI 判断当前情况不需要调整时（user 状态稳定 / 已被拒绝同类提案），返回 `changes=[], skip_reason="近 7 天进度稳定，无需调整"`，业务层不写 PlanAdjustmentV2。

### 4.3 USER_PROMPT 模板

```
请基于以下数据，给出未来 14 天内的调整提案（或决定不调整）。

【当前日期】{today_iso}
【时区】{timezone}

【用户当前 plan】
{plan_summary_json}

【近 7 天实绩】
- 累计学习分钟：{minutes_practiced_7d}
- 计划分钟：{minutes_target_7d}
- 完成率：{minutes_completion_ratio}%
- 答题数：{items_answered_7d}
- 整体正确率：{accuracy_7d}%
- 各科目正确率：{accuracy_by_subject_json}
- 跳过事件次数：{skipped_events_7d}
- 跳过最多的 category：{most_skipped_category}

【近 30 天趋势】
- 整体正确率趋势：{accuracy_trend_30d}（rising/stable/declining）
- 弱项（top3）：{weakness_top3_json}

【未来 14 天计划事件】
{future_events_json}

【近 24 小时被用户拒绝的提案】
{recent_rejected_proposals_json}（避免再次提同类）

【目标差距】
- 距考试日：{days_until_exam} 天
- 目标正确率（按 plan）：{target_accuracy_by_subject_json}

请输出符合 OUTPUT_SCHEMA 的 JSON。
```

### 4.4 Few-shot

- `case_skipped_2_review_events`：用户连续跳过 2 个复盘事件，建议把复盘移到周末上午
- `case_accuracy_dropping`：判断推理近 7 天正确率下降 8%，建议增加复盘 + 减少新题
- `case_no_change_needed`：用户进度平稳，输出 skip_reason
- `case_rejected_same_yesterday`：昨日已拒绝同类提案，今日大幅减少改动

---

## 5. recommend_today.py（今日推荐）

### 5.1 SYSTEM_PROMPT

```
你是 Sikao 公考备考的"今日推荐器"。你的任务：基于用户实时状态与历史实绩，给出 2-3 张"立刻可执行"的推荐卡。

【上下文】
{CONTEXT_DESCRIPTION_USER}

【推荐策略阈值表 - 必须严格遵守】
{POLICY_HEADER_REVIEW_THRESHOLDS}

【硬约束】
1. 输出 2-3 张推荐卡（最多 3，最少 2）。
2. action_type 必须取自：review（复盘）/ continue（继续）/ rest（休息）。
3. 每条 reason 必须基于实际信号（不要编造），引用具体数字（如"今日正确率 50%"）。
4. estimated_minutes 必须 ≥ 5，≤ 60。
5. payload 字段必须填，使前端能直接进 session 或加入计划。
6. 如最近 7 天无任何 session（新用户），输出空 recommendations[] + reason。
7. 推荐去重：同一类型动作（如"复盘逻辑判断"）24h 内不重复推荐。
8. 输出必须严格遵循 OUTPUT_SCHEMA。

{SAFETY_FOOTER}
```

### 5.2 OUTPUT_SCHEMA

```json
{
  "type": "object",
  "required": ["recommendations"],
  "properties": {
    "recommendations": {
      "type": "array",
      "minItems": 0,
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": ["title", "reason", "estimated_minutes", "action_type", "cta", "payload"],
        "properties": {
          "title": {"type": "string", "minLength": 4, "maxLength": 80},
          "reason": {"type": "string", "minLength": 10, "maxLength": 200},
          "estimated_minutes": {"type": "integer", "minimum": 5, "maximum": 60},
          "action_type": {"enum": ["review", "continue", "rest"]},
          "cta": {"type": "string", "maxLength": 12},
          "payload": {
            "type": "object",
            "properties": {
              "session_template": {
                "type": ["object", "null"],
                "properties": {
                  "category": {"enum": ["xingce", "essay", "review", "mock"]},
                  "subject": {"type": ["string", "null"]},
                  "subtype": {"type": ["string", "null"]},
                  "count": {"type": "integer", "minimum": 1, "maximum": 50}
                }
              },
              "review_item_ids": {"type": ["array", "null"], "items": {"type": "integer"}},
              "rest_minutes": {"type": ["integer", "null"], "minimum": 5, "maximum": 60}
            }
          }
        }
      }
    },
    "no_data_reason": {"type": ["string", "null"]}
  }
}
```

### 5.3 USER_PROMPT 模板

```
请基于以下信号生成 2-3 张今日推荐卡。

【当前日期与时间】{now_iso}
【时区】{timezone}
【当日时段】{day_period}（morning / afternoon / evening / night）

【用户实时状态】
- 当前是否有未提交 session：{has_in_progress_session}
- 若有：已答题数 {ip_items_count}，已用时 {ip_minutes} 分钟，最近 10 题正确率 {ip_recent10_accuracy}%
- 当日累计学习分钟：{minutes_today}
- 当日累计答题数：{items_today}
- 当日整体正确率：{accuracy_today}%

【近 7 天聚合】
- 总答题数：{items_7d}
- 整体正确率：{accuracy_7d}%
- 弱项 top3：{weakness_top3_json}
- 各科目正确率：{accuracy_by_subject_json}

【错题积压】
- 累计未复盘错题：{review_pending_count}
- 距上次复盘：{days_since_last_review} 天

【目标差距】
- 距考试日：{days_until_exam} 天
- 当前活跃 plan：{active_plan_summary_json}
- 目标科目正确率：{target_accuracy_by_subject_json}

【近 24 小时已推送过的推荐】
{recent_recommendations_json}（避免重复）

【近 7 天 review item 推送记录】
{recent_review_items_json}（同 item 7 天内不重复）

【新用户判定】
- 历史 session 数：{total_sessions}
- 若 total_sessions == 0：返回 recommendations=[] + no_data_reason

请输出符合 OUTPUT_SCHEMA 的 JSON。
```

### 5.4 Few-shot

- `case_low_accuracy_high_pending_review`：正确率 50% + 累积错题 38 → 推 3 张：复盘 / 休息 / 换题型
- `case_high_accuracy_continue`：正确率 85% → 推 2 张：继续推进 / 加大难度
- `case_long_session_fatigue`：连续答题 95 分钟 → 推 2 张：休息 / 复盘
- `case_exam_imminent_5days`：距考试 5 天 → 推 3 张：模考 / 复盘 / 模考
- `case_new_user_no_data`：total_sessions=0 → 输出 no_data_reason

---

## 6. Parser 共同约束

每个 parser（plan_output_parser / adjustment_parser / recommendation_parser）：

```python
class ParserBase:
    schema: ClassVar[dict]
    purpose: ClassVar[str]

    @classmethod
    def parse(cls, raw: str, *, request_context: dict) -> ParsedOutput:
        # 1. parse_with_fallback (05-LLM-Module §10.2)
        data = parse_with_fallback(raw, cls.schema, cls.purpose)
        # 2. business validation（每个 parser override）
        cls.validate_business(data, request_context)
        return ParsedOutput(data=data, parse_status=ParseStatus.OK)

    @classmethod
    def validate_business(cls, data: dict, ctx: dict) -> None:
        raise NotImplementedError
```

### 6.1 plan_output_parser business validation

- 所有 events.start_at >= today
- 所有 events.end_at > start_at
- 所有时长是 15 分钟整数倍
- 跨度不超出 (today, target_exam_date)
- 检查重叠（warning，不抛错）

### 6.2 adjustment_parser business validation

- 所有 changes.event_id 必须存在或为 null（add 时）
- 总改动 ≤ 8
- 仅未来事件
- 与 24h 内已拒绝提案的相似度（diff hash）≥ 0.8 时丢弃整个提案 + 写 audit warning

### 6.3 recommendation_parser business validation

- 阈值表 cross-check：
  - 若 source_signals.accuracy_recent_50 < 60 但所有 recommendations.action_type 都是 continue → 整体丢弃，重 generate 1 次
- 去重 cross-check：
  - 24h 内已推送的同 (action_type, subject, subtype) → 丢弃
- payload 字段完整性：review item ids 必须存在于该用户 review.items

---

## 7. 测试矩阵

每个 prompt 必须有：

| 测试 | 数量 |
|---|---|
| Happy fixture（合规输出） | ≥ 1 |
| Invalid JSON fixture | 1 |
| Schema violation fixture | 1 |
| Business rule violation fixture | ≥ 2 |
| Edge case（边界数据） | ≥ 2 |
| Few-shot case | ≥ 5（按 §2.4 / §3.4 / §4.4 / §5.4 列） |

---

## 8. 版本演进流程

修改 prompt：
1. 新建 `plan_generate_v2.py`（不动 v1）
2. 配置加 `llm_active_version_plan_generate: "v2"`
3. 灰度放量（Stage 2）
4. 观察 `LlmCallV2 WHERE prompt_version='plan_generate@v2'` 的 parse_failure_rate 与 cost
5. 7 天后 v2 稳定 → 删除 v1 文件 + 配置 default

---

## 9. 引用矩阵

| 本文档被引用 |
|---|
| `05-LLM-Module.md` §11 facade 调 render_messages |
| `09-Observability-Audit.md` LlmCallV2.prompt_version |
| `10-Testing.md` §LLM 测试矩阵复用本文 §7 |
