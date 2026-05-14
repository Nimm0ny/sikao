"""学习计划 prompt builder — Slice 3a.

输出严格 JSON 含 `tasks` (list of 3-5 task), 每 task 走 outer discriminated
union (task_kind / payload / display_order). schema 见 schemas.StudyPlanLLMOutput.

Sanity Stage 1 (结构层) 由 Pydantic ValidationError 自动覆盖, 这里只负责
prompt + 输出格式说明; Stage 2 (业务层) / Stage 3 (跨 task dedup) 在
services/study_plans.py 跑.

调性: with_tone (_shared.SYSTEM_TONE_PREFIX) — 不打鸡血, 公考备考同伴语气.

prompt builder 是纯函数, 不直接拿 ORM (跟 essay_grading.py / qa.py 一致).
service 层组好 context dataclass 后传入.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from sikao_api.modules.llm.application.llm.prompts._shared import with_tone
from sikao_api.modules.llm.application.llm.provider import LLMMessage


@dataclass(frozen=True)
class WrongQuestionContext:
    """单 wrong question 给 LLM 看的最小信息. service 层从
    WrongQuestionMastery + Question joinedload 后构造."""

    question_id: int
    paper_code: str
    subject: str | None  # 可能为 None (老数据未补 subject 字段)
    canonical_subtype: str | None
    stem_preview: str  # 题干前 60 字, strip HTML, 不含材料
    last_wrong_time: datetime
    mastery_level: str  # 'not_mastered' | 'reviewing' (sanity P1-new-3 已 filter)


@dataclass(frozen=True)
class DailyAnswerStat:
    """单天答题量 + 正确数. _query_daily_stats 返回的 tuple 包装版."""

    plan_date: date
    total: int
    correct: int


@dataclass(frozen=True)
class SubjectAccuracy:
    """按科目的正确率. get_knowledge_points 投影."""

    subject: str
    answered_count: int
    accuracy: float  # 0.0 - 1.0


@dataclass(frozen=True)
class StudyPlanContext:
    """LLM 生成 plan 的全部输入. service 层 build, prompt 直接序列化进 user message.

    today_date: Asia/Shanghai 当天 (D3 拍板).
    available_paper_codes: list_public_papers 投影成的 paper_code 列表 — LLM
      task.payload.paperCode 必须在此列表内 (sanity Stage 2 校验).
    """

    today_date: date
    total_answered: int
    overall_accuracy: float  # 0.0 - 1.0
    recent_7day_stats: list[DailyAnswerStat]  # 升序 today-6 → today
    subject_accuracy: list[SubjectAccuracy]
    recent_wrong_questions: list[WrongQuestionContext]  # mastery_level != 'mastered'
    available_paper_codes: list[str]


_STUDY_PLAN_SYSTEM_BODY = """\
你的任务是给用户安排今天的学习计划. 用户进 app 后第一眼看到这份计划, 直接
按你给的 task 顺序做.

调性: 像图书馆隔壁桌的同学顺手帮用户列今天要做的事, 不打鸡血, 不堆口号.

## 输出 schema (top-level JSON 必须含 `tasks` 字段, 3-5 个 task)

不要附加任何说明文字 / markdown fence / 注释. 直接输出 JSON.

```
{
  "tasks": [
    {
      "taskKind": "practice" | "review_wrong" | "essay_writing",
      "payload": <按 taskKind 形态变, 见下>,
      "displayOrder": 0
    },
    ...
  ]
}
```

## taskKind 三类 + payload 形态

仅以下 3 类, **禁止**输出 `study_concept` / `free_writing` / 其他.

如果你想让用户"学知识点" / "看概念" / "读讲义" / "复习公式" 之类的非做题任务,
**不要**生成此类 task — 把对应学习需求**转译**为:
- 想学某概念 → 生成 `practice` task 选包含此概念的题, 通过做题学
- 想复习已错知识点 → 生成 `review_wrong` task 选用户该模块的未掌握错题
PoC 阶段系统没有"知识点学习"实体, 凡产出此类 task 全部会被系统拒绝整 plan 降级.

### taskKind="practice" (做题)
```
{
  "paperCode": "<必须在用户当前可见 paper 列表内>",
  "questionIds": [int, ...] | null,   // null=整卷; list=限定题
  "title": "<≤30 字符, 简短陈述>",
  "subtitle": "<≤60 字符, 给结构信息或宽容提示, 可省略>"
}
```

### taskKind="review_wrong" (复习错题)
```
{
  "questionIds": [int, ...],          // 必非空, 选自用户最近错题列表
  "title": "<≤30 字符>",
  "subtitle": "<≤60 字符 或 null>"
}
```
questionIds 必须从下面"最近未掌握错题"段选, 不要瞎编 id.

### taskKind="essay_writing" (写申论)
```
{
  "paperCode": "<可见 paper 列表中含 essay 题的 paper>",
  "questionId": <int>,                // 单题
  "title": "<≤30 字符>",
  "subtitle": "<≤60 字符 或 null>"
}
```

## 文案约束

- title / subtitle 都用陈述句, 不用感叹号
- 不说 "加油" / "你能行" / "继续保持" 等情绪词
- 不空泛, 引用具体数字: "做 5 道资料分析" 比 "做点题" 好
- subtitle 给结构 / 宽容提示, 不重复 title

## displayOrder

0 起始, 严格递增, 不跳号 (0, 1, 2, ...). 出现重复或乱序由系统重排.

## 选题原则

- 把高频错的科目放前面 (用户最近错率高的科目优先复习)
- 一份 plan 不要全堆同一科目 (除非用户只有一个科目数据)
- review_wrong 优先选 last_wrong_time 最近的, 不要选已 mastered 的
- 如果用户最近 7 天答题量很低 (≤5 题/天), 可以建议轻量任务 (3 题练手)
- 如果用户答题量足够 (>20 题/天), 可以塞重型任务 (整卷)
"""


STUDY_PLAN_SYSTEM_MESSAGE = with_tone(_STUDY_PLAN_SYSTEM_BODY)


def _format_recent_stats(stats: list[DailyAnswerStat]) -> str:
    """7 天答题量列表 → markdown 表格. 没数据 → '(无最近答题)'."""
    if not stats:
        return "(无最近答题)"
    lines = ["| 日期 | 答题数 | 答对数 |", "|---|---|---|"]
    for s in stats:
        lines.append(f"| {s.plan_date.isoformat()} | {s.total} | {s.correct} |")
    return "\n".join(lines)


def _format_subject_accuracy(items: list[SubjectAccuracy]) -> str:
    if not items:
        return "(无科目分布数据)"
    lines = ["| 科目 | 答题数 | 正确率 |", "|---|---|---|"]
    for item in items:
        pct = round(item.accuracy * 100, 1)
        lines.append(f"| {item.subject} | {item.answered_count} | {pct}% |")
    return "\n".join(lines)


def _format_wrong_questions(items: list[WrongQuestionContext]) -> str:
    """最近未掌握错题 markdown list, 给 LLM 选 review_wrong questionIds 用."""
    if not items:
        return "(暂无未掌握错题)"
    lines = []
    for w in items:
        subject_str = w.subject or "未标注"
        subtype_str = w.canonical_subtype or ""
        meta_parts = [subject_str]
        if subtype_str:
            meta_parts.append(subtype_str)
        meta = " / ".join(meta_parts)
        lines.append(
            f"- 题号 {w.question_id} (paperCode={w.paper_code}, {meta}, "
            f"mastery={w.mastery_level}): {w.stem_preview}"
        )
    return "\n".join(lines)


def _format_paper_codes(codes: list[str]) -> str:
    if not codes:
        return "(无可见 paper)"
    return ", ".join(codes)


def build_study_plan_messages(*, ctx: StudyPlanContext) -> list[LLMMessage]:
    """组 system + user messages. system 调性 + schema 固定 (跨用户共享 cache),
    user 是用户私有数据 (答题历史 / 错题). DeepSeek prompt cache 跨用户命中
    system 头.
    """
    user_parts: list[str] = []

    user_parts.append(f"## 今天日期 (Asia/Shanghai)\n{ctx.today_date.isoformat()}")

    user_parts.append(
        f"## 累计答题数据\n"
        f"- 总答题数: {ctx.total_answered}\n"
        f"- 总正确率: {round(ctx.overall_accuracy * 100, 1)}%"
    )

    user_parts.append(
        "## 最近 7 天每日答题量\n" + _format_recent_stats(ctx.recent_7day_stats)
    )

    user_parts.append(
        "## 各科目正确率\n" + _format_subject_accuracy(ctx.subject_accuracy)
    )

    user_parts.append(
        "## 最近未掌握错题 (review_wrong 任务必须从这选)\n"
        + _format_wrong_questions(ctx.recent_wrong_questions)
    )

    user_parts.append(
        "## 当前可见 paper 列表 (practice/essay_writing 任务的 paperCode 必选自此)\n"
        + _format_paper_codes(ctx.available_paper_codes)
    )

    user_parts.append(
        "请按 system message 中描述的 JSON schema 输出 tasks. 3-5 个 task, "
        "displayOrder 从 0 开始递增. 不要附加任何说明文字."
    )

    return [
        LLMMessage(role="system", content=STUDY_PLAN_SYSTEM_MESSAGE),
        LLMMessage(role="user", content="\n\n".join(user_parts)),
    ]


__all__ = [
    "DailyAnswerStat",
    "STUDY_PLAN_SYSTEM_MESSAGE",
    "StudyPlanContext",
    "SubjectAccuracy",
    "WrongQuestionContext",
    "build_study_plan_messages",
]
