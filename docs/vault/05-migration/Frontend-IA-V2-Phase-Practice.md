# Sikao 练习中心 V2 改造落地 Plan

> **Status**: ACCEPTED
> **Scope**: 一级导航练习 tab `/practice`（Section A 历史记录 + B 专项练习 + C 套卷练习）+ 答题闭环 + 自定义刷题 + AI 出题 + 申论批改
> **原则**: 完整落地（不走最小化路线）/ 后端先行 / 前端 UI 最后做 / 每 PR 受 AGENTS H9 约束（≤15 文件 / ≤400 行）
> **依赖**: Phase-Home 完成（共享 NoteV2 / PracticeSessionV2 / QuestionV2 schema 基础）
> **Last Updated**: 2026-05-21

---

## 0. 已拍板决策清单

### 0.1 题源与出题（Q1/Q3/D-Q7/D-Q13）

| # | 决策 | 拍板内容 |
|---|---|---|
| Q-Source | 题源种类 | **真题 + AI 出题**（取消"模拟题"独立模式） |
| Q1 | 出题方式 | 规则引擎（自定义刷题）+ AI 智能出题（按题型&难度） |
| Q3 | AI 题入库策略 | **AI 题与真题同表 QuestionV2**，用 `source` 字段区分（real_exam / ai_generated / ai_modified） |
| D-Q1 | AI 出题方式 | **AI-Gen-B**：LLM 改编真题（不凭空生成，避免答案错） |
| D-Q13 | AI 出题池子优先 + 退化 | **三段式**：① 池子里筛用户没做过的 → ② 不够则池子里筛已做过的 → ③ 仍不够则调 LLM 实时生成 |
| D-Q14 | 真题数据导入 | 按 V2 重构现状制作 import 脚本（数据格式由用户后续提供） |

### 0.2 自定义刷题（D-Q10 修订后）

| 字段 | 选项 |
|---|---|
| 出题模式 | 真题 / AI 出题 |
| 出题年份 | 不限 / 近 3 年 / 近 5 年 / 近 10 年 |
| 出题难度 | 双滑块（0%~100% 历史正确率区间） |
| 每组题数量 | 5 / 10 / 15 / 20 / 30 |
| 答题节奏 | 逐题模式 / **整组模式（默认）** |
| 排除已做 | bool（默认 true） |
| 仅刷错题 | bool（默认 false） |

⚠️ 完全删除「背题模式」选项；用「答题节奏」概念替代。

### 0.3 答题节奏（D-Q15）

| 节奏 | 行为 |
|---|---|
| 逐题模式 | 答一题立即看答案+解析，可加笔记/收藏/标记 |
| 整组模式（默认） | **严格闭卷**——全部答完前不能看解析；标记"不确定"也不解锁解析；已答题也不能回看解析 |

### 0.4 AI 出题与质量控制（D-Q8/D-Q9）

| # | 决策 | 拍板 |
|---|---|---|
| D-Q8 | 等待方式 | **A 同步等待**（10-15s 转圈，简单可靠） |
| D-Q9 | 质量控制 | **D 双层**：① 生成时 LLM 自审（"这题答案对吗"）② 上线后用户反馈打分（点赞/举报/低分自动下线） |

### 0.5 申论批改（Q4/D-Q4/D-Q16）

| # | 决策 | 拍板 |
|---|---|---|
| Q4 | 批改形式 | AI 批改 + 范文对比（D 人工批改后期再考虑） |
| D-Q4 | 范文来源 | 官方人工补充（高优先）+ AI 生成（点赞/收藏达阈值后入库共享） |
| D-Q16 | 批改时机 | **B 异步后台批改**（提交即返回结果页，批改完成后 banner 通知） |

### 0.6 收藏 / 标记 / 笔记（Q5/D-Q5/D-Q12/D-Q17）

| # | 决策 | 拍板 |
|---|---|---|
| Q5-Fav | 收藏单题 | 是（QuestionFavoriteV2 表） |
| Q5-Note | 加笔记 | 是，**与 Tab 4 笔记打通**（NoteV2.linked_question_id） |
| Q5-Flag | 标记不确定 | 是，分基础+拓展 |
| D-Q12-基础 | 本次 session 内标记 | PracticeSessionAnswerV2.flagged 字段 |
| D-Q12-拓展 | 持久化标记 + 自动复盘 | QuestionFlagV2 表，标记的题进 ReviewItemV2 复盘队列 |
| D-Q17 | 题级笔记可见性 | **仅自己可见** + Tab 4 列表点击题级笔记可一键跳到对应题 |

### 0.7 历史成绩聚合（Q2/Q6/D-Q3/D-Q11）

| # | 决策 | 拍板 |
|---|---|---|
| Q2 | 分类层级 | **二级分类**（一级模块 + 二级子模块） |
| Q6 | 统计粒度 | **全部**：模块级 / 子模块级 / 题型+难度交叉 / 与平台平均对比 / 时间维度 |
| D-Q3 | 聚合策略 | **三层**：① snapshot（页面加载用）② 实时聚合（详情页用）③ 百分位（跨用户对比，周更新） |
| D-Q11 | 调度策略 | 02:00 全量 cron / session.submit 增量 / 周一 03:00 重算百分位 |

### 0.8 每日一练边界（Q7/D-Q6）

| 维度 | 今日推荐（首页 Section C） | 每日一练（练习 tab） |
|---|---|---|
| 触发方 | 系统主动推 | 用户主动点 |
| 内容 | 复盘 / 继续 / 休息 / 新题（多种） | 一定是做新题 |
| 长度 | 单卡，不固定 | 5-10 题混合 |
| 出题逻辑 | LLM 决策 + 全数据源 | 跨模块按用户弱项加权 |
| 重复性 | 每次进首页可能不同 | 每天一份，做完即结束 |

### 0.9 view 结构（最终）

```
/practice                          练习中心（一屏 view）
  ├─ 顶部 segment: 行测 | 申论
  ├─ 顶部快捷区: 每日一练 / 继续上次 / 自定义刷题
  ├─ Section A · 历史练习记录（二级分类成绩 + 趋势 + 百分位）
  ├─ Section B · 专项练习入口（二级分类树）
  └─ Section C · 套卷练习入口（filter: 年份/地区/考试类型/难度 + 已完成状态）

非 tab 路由（脱壳）：
/practice/sessions/:id             答题
/practice/sessions/:id/result      结果
/practice/sessions/:id/grading     申论批改详情（异步完成后）
/practice/ai-questions/generating  AI 出题等待页
```

---

## 1. 总览

### 1.1 工作流

```
Backend (WU-B10 → WU-B26)        →    Frontend (WU-F9 → WU-F18)
  数据 → 真题导入 → 端点 → AI 模块扩展 → cron → 测试      Queries → Stores → Sections → 答题 → 整合 → 测试
```

### 1.2 估算

| 维度 | 估算 |
|---|---|
| 总行数（新增 + 删除） | ~22,000 行 |
| Backend / Frontend | 11,500 / 10,500 |
| PR 总数 | ~55 个 |
| Backend 阶段 | 7–9 周 |
| Frontend 阶段 | 5–6 周 |
| 全程 | 12–15 周 |

### 1.3 与 Phase-Home 的关系

| 共享 schema | Tab 1 中负责 | Tab 2 扩展 |
|---|---|---|
| QuestionV2 | 已存在 | 加 `source / year / region / exam_type / historical_accuracy / category_path / quality_score / report_count` |
| PracticeSessionV2 | Tab 1 加 `linked_plan_event_id` | Tab 2 加 `practice_mode / source_mode / config_snapshot` |
| PracticeSessionAnswerV2 | 已存在 | Tab 2 加 `flagged / viewed_solution` |
| NoteV2 | Tab 1 已建 CRUD | **Tab 2 必须先扩展 `linked_question_id` 字段** |
| ReviewItemV2 | Tab 1 已建 | Tab 2 扩展 reason 枚举（加 `flagged_persistent`） |

⚠️ **关键**：NoteV2.linked_question_id 字段升级在 Tab 2 必须做。即使 Tab 4 笔记 plan 还没写，本字段也要在 Tab 2 schema migration 里加。

---


## 2. 边界规则与策略表

### 2.1 题源边界规则（PR1-PR4）

| # | 规则 | 含义 |
|---|---|---|
| **PR1** | 真题 / AI 题等价对待 | 同一张 QuestionV2 表，所有下游（错题/收藏/笔记/复盘/统计）天然兼容 |
| **PR2** | source 字段是 immutable 真相 | 一旦写入 real_exam / ai_generated / ai_modified 不可变更 |
| **PR3** | AI 题生成失败 ≠ 用户失败 | 失败时返回 503 + 引导切换到"真题"模式，不阻塞用户练习 |
| **PR4** | 已下线（quality_score < 阈值）的 AI 题不出现在新出题中 | 但已答题的用户能复盘（保留答题历史）|

### 2.2 历史成绩聚合策略（Stat-Schedule）

| 时机 | 更新内容 | 用途 |
|---|---|---|
| 每日 02:00 cron | 重算所有用户 PracticeStatsSnapshot | 兜底 + 修正增量误差 |
| session.submit 后 | 增量更新本用户本模块 snapshot | 实时数据 |
| 每周一 03:00 cron | 全量重算 percentile_rank | 跨用户百分位（你超过 X% 用户）|
| 每日 04:00 cron | 重算 QuestionV2.historical_accuracy | 题难度反馈用 |

### 2.3 AI 出题三段退化逻辑（D-Q13）

```
用户配置：mode=ai, year=recent_3, difficulty=[0.6, 0.8], count=10

第一步：池子里筛"用户没做过"的题
  SELECT * FROM QuestionV2
  WHERE source IN ('ai_generated', 'ai_modified')
    AND year ∈ recent_3
    AND historical_accuracy BETWEEN 0.6 AND 0.8
    AND quality_score >= MIN_QUALITY
    AND id NOT IN (用户已答题 ids)
  LIMIT 10
  ↓
  得到 N 题（0 ≤ N ≤ 10）

第二步（N < 10）：池子里筛"用户已做过"的题
  同上 query 但去掉 NOT IN 条件 → 取 (10-N) 题

第三步（仍不够）：调 LLM 实时生成 (10-N-M) 题
  - 调 plan_generator 的 question_generator 子模块
  - 生成 → LLM 自审 → 入库（source=ai_generated）→ 加入本次 session
  - 同步等待返回（D-Q8）

最终：始终返回 10 题（或者明确返回错误）
```

### 2.4 答题节奏边界（D-Q15 严格闭卷）

| 行为 | 逐题模式 | 整组模式 |
|---|---|---|
| 答完一题立即看答案 | ✅ | ❌ |
| 答完后看解析 | ✅ | ❌ |
| 标记不确定后看解析 | ✅ | ❌ |
| 已答题回看自己的答案 | ✅ | ✅ |
| 已答题回看正确答案 | ✅ | ❌ |
| 中途加笔记 | ✅ | ✅（但笔记内容不显示答案） |
| 中途收藏 | ✅ | ✅ |
| 中途暂停 | ✅ | ✅ |
| 全部答完后看解析 | N/A | ✅（解锁） |

### 2.5 申论批改异步流程（D-Q16）

```
用户提交申论答案
  ↓
立即创建 EssaySubmissionV2 记录（status=pending_grading）
  ↓
立即返回 result 页（无评分，显示"AI 批改中..."）
  ↓
后台任务：调 LLM essay_grader → 写入 EssayReportV2
  ↓
完成时间：约 30-60s
  ↓
完成后：
  - 推送到首页 banner（如用户在首页）
  - 用户回到 result 页时自动刷新数据
  - 用户在 history 列表能看到完整批改
```

⚠️ result 页设计需考虑两种状态：批改中（pending）/ 批改完成（graded）。

### 2.6 题级笔记联动规则（D-Q17）

| 行为 | 规则 |
|---|---|
| 答题界面"加笔记" | 创建 NoteV2(linked_question_id=current_question, user_id) |
| 一题对应多条笔记 | 允许（同一用户对同一题可多条笔记） |
| 题级笔记可见性 | **仅创建者** |
| Tab 4 笔记列表 | 默认显示全部，可切换 filter（独立笔记 / 题级笔记） |
| 题级笔记列表项点击 | 跳转 `/practice/questions/:id`（题目详情页，不进入 session）|
| 答题界面"该题相关笔记" | 列出当前用户对此题的所有 NoteV2，可编辑/删除 |

---

## 3. 数据模型变更

### 3.1 现有表扩展

#### QuestionV2（最重要的扩展）

```python
class QuestionV2(Base):
    # 现有字段保留
    id, content, options, correct_answer, explanation, ...

    # 新增字段
    source: enum (real_exam | ai_generated | ai_modified)
    year: int | None  # 真题年份；AI 题对应改编源真题年份
    region: str | None  # "guangdong" "national" "hubei" 等
    exam_type: enum (national | provincial | institution | xuandiao | other)
    category_l1: str  # 一级分类 key（如 "yanyu"）
    category_l2: str  # 二级分类 key（如 "luoji_tiankong"）
    historical_accuracy: float  # 该题在所有用户中的正确率（cron 更新）
    answer_count: int  # 累计答题人次（cron 更新）
    quality_score: float  # 用户反馈打分均值（仅 AI 题有效）
    report_count: int  # 举报次数（仅 AI 题有效）
    is_active: bool  # 是否在出题池中（quality 过低或被举报多则 false）

    # AI 题专属
    ai_source_question_id: int | None  # 改编自哪道真题（FK self）
    ai_self_audit_passed: bool | None  # LLM 自审是否通过
    ai_generated_at: datetime | None
```

#### PracticeSessionV2

```python
# Tab 1 已加：linked_plan_event_id, source(plan|adhoc...)
# Tab 2 新增：
practice_mode: enum (per_question | full_set)  # 答题节奏
source_mode: enum (paper | category | custom | ai_generated | daily | wrong_redo)
config_snapshot: JSON  # 自定义配置快照
```

#### PracticeSessionAnswerV2

```python
# 现有字段保留
# Tab 2 新增：
flagged: bool  # D-Q12 基础：本次 session 内标记不确定
viewed_solution: bool  # 是否查看过解析（逐题模式用）
view_solution_at: datetime | None
```

#### NoteV2（来自 Tab 1，Tab 2 扩展）

```python
# Tab 1 已建：title, body, user_id, created_at, updated_at
# Tab 2 新增：
linked_question_id: int | None  # FK QuestionV2
visibility: enum (private)  # 当前仅 private（D-Q17）；预留扩展

# 索引：(user_id, linked_question_id)  -- 查询某用户对某题的笔记
```

#### ReviewItemV2（来自 Tab 1，Tab 2 扩展）

```python
# Tab 1 已建：基础结构
# Tab 2 扩展：
reason: enum (wrong_answer | flagged_persistent | low_confidence | manual_add)
# 新增 flagged_persistent 来源（D-Q12 拓展）
```

### 3.2 新增表

#### PracticeStatsSnapshotV2

```python
class PracticeStatsSnapshotV2(Base):
    id: int (PK)
    user_id: int (FK)
    scope: enum (overall | category_l1 | category_l2)
    category_key: str | None  # category_l1 时是 "yanyu"，category_l2 时是 "yanyu/luoji_tiankong"
    type: enum (xingce | essay)

    # 统计指标
    total_questions: int
    correct_count: int
    accuracy: float
    total_sessions: int
    total_minutes: int
    average_score: float | None  # 申论用

    # 趋势
    recent_trend: JSON  # [{date, accuracy, count}, ...] 近 5-10 次
    last_practiced_at: datetime | None

    # 跨用户对比（仅 scope=category_l1/l2 + 周更新）
    percentile_rank: float | None  # 0.0-1.0
    percentile_updated_at: datetime | None

    updated_at: datetime
    UNIQUE (user_id, scope, category_key, type)
```

#### QuestionFavoriteV2

```python
class QuestionFavoriteV2(Base):
    id: int (PK)
    user_id: int (FK)
    question_id: int (FK)
    created_at: datetime
    note: str | None  # 收藏时附带的简短备注
    UNIQUE (user_id, question_id)
```

#### QuestionFlagV2（D-Q12 持久化标记）

```python
class QuestionFlagV2(Base):
    id: int (PK)
    user_id: int (FK)
    question_id: int (FK)
    reason: enum (uncertain | revisit_later | needs_review)
    source_session_id: int | None  # 来自哪次 session 的标记
    created_at: datetime
    resolved_at: datetime | None  # 用户后续标记为"已解决"
    UNIQUE (user_id, question_id)  # 同一用户对同一题只能有一条 active flag
```

#### EssayReferenceAnswerV2

```python
class EssayReferenceAnswerV2(Base):
    id: int (PK)
    question_id: int (FK)
    content: text  # 范文内容
    source: enum (official | ai_generated | user_contributed)
    created_by_user_id: int | None  # source=user_contributed 时
    created_by_admin: bool  # source=official 时

    # 质量信号
    likes_count: int
    favorites_count: int
    report_count: int
    quality_score: float  # 综合评分（cron 更新）

    # 状态
    status: enum (draft | public | archived)
    published_at: datetime | None

    # AI 元数据
    ai_self_audit_passed: bool | None  # 仅 source=ai_generated
    ai_generated_at: datetime | None

    created_at: datetime
    updated_at: datetime
```

#### EssayReferenceFeedbackV2

```python
class EssayReferenceFeedbackV2(Base):
    id: int (PK)
    reference_id: int (FK EssayReferenceAnswerV2)
    user_id: int (FK)
    action: enum (like | unlike | favorite | unfavorite | report)
    note: str | None  # report 时的原因
    created_at: datetime
    # 唯一性：一个用户对同一范文一种 action 只一条
    UNIQUE (reference_id, user_id, action)
```

#### AiGeneratedQuestionRequestV2

```python
class AiGeneratedQuestionRequestV2(Base):
    id: int (PK)
    user_id: int (FK)
    request_params: JSON  # {category, year_range, difficulty_range, count, ...}
    status: enum (pending | partial_pool | full_pool | llm_generated | failed)
    pool_question_ids: JSON  # 池子里取的题
    llm_generated_question_ids: JSON  # LLM 实时生成的题
    llm_self_audit_passed_count: int  # 自审通过的题数
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None
    duration_ms: int | None
```

用途：审计 AI 出题质量、追踪失败、限流（如每用户每日最多 N 次实时生成）。

#### DailyPracticeV2

```python
class DailyPracticeV2(Base):
    id: int (PK)
    user_id: int (FK)
    date: date  # 该用户该日的每日一练
    type: enum (xingce | essay)
    question_ids: JSON  # 5-10 题
    generation_strategy: enum (weakness_weighted | random_balanced)  # 出题策略

    # 状态
    status: enum (pending | started | completed | expired)
    started_at: datetime | None
    completed_session_id: int | None  # FK PracticeSessionV2
    expired_at: datetime  # 当日 23:59 过期

    created_at: datetime
    UNIQUE (user_id, date, type)
```

### 3.3 总计变更

| 类型 | 数量 | 说明 |
|---|---|---|
| 现有表扩展 | 5 | QuestionV2 / PracticeSessionV2 / PracticeSessionAnswerV2 / NoteV2 / ReviewItemV2 |
| 新增表 | 6 | PracticeStatsSnapshotV2 / QuestionFavoriteV2 / QuestionFlagV2 / EssayReferenceAnswerV2 / EssayReferenceFeedbackV2 / AiGeneratedQuestionRequestV2 / DailyPracticeV2 |
| Alembic migration 数 | 7 | 每个新表/扩展一个 migration |

---


## 4. AI 模块扩展（基于 Phase-Home llm_v2）

Tab 2 在 Phase-Home 已建的 `modules/llm_v2/` 上追加 3 个能力：

### 4.1 question_generator（AI 出题）

```
modules/llm_v2/application/
  question_generator.py        # 主入口
  parsers/question_parser.py   # 解析 LLM 输出 → QuestionV2 batch
  prompts/
    question_generate.py       # 改编 prompt（输入：源真题 + 难度目标 + 题型）
    question_self_audit.py     # 自审 prompt（"这题答案对吗"）
```

**核心算法（D-Q13 退化逻辑）**：

```python
async def generate_questions(
    user_id: int,
    config: AiGenerateConfig,  # category, year_range, difficulty_range, count
) -> list[Question]:
    # 第一步：池子里筛用户没做过的
    not_done = await query_pool(
        config, exclude_done_by=user_id, limit=config.count
    )
    if len(not_done) >= config.count:
        return not_done[:config.count]

    # 第二步：池子里筛已做过的
    done = await query_pool(
        config, only_done_by=user_id, limit=config.count - len(not_done)
    )
    pool_total = not_done + done
    if len(pool_total) >= config.count:
        return pool_total

    # 第三步：实时生成补足
    needed = config.count - len(pool_total)
    new_questions = await llm_generate_with_audit(config, count=needed)
    # 入库（QuestionV2.source = ai_generated, ai_self_audit_passed = True）
    saved = await persist_questions(new_questions)
    return pool_total + saved
```

**LLM 自审流程**：

```
LLM 调用 1 (生成):
  输入: 源真题 + 改编要求
  输出: 改编题 (题干/选项/答案/解析)

LLM 调用 2 (自审):
  输入: 改编题 + "请判断这题答案是否正确，是否符合公考规范"
  输出: { passed: bool, reason: str, confidence: float }

passed=true → 入库 + 用于本次 session
passed=false → 丢弃（写入 AiGeneratedQuestionRequestV2.failed_count，重试或报错）
```

### 4.2 essay_grader（申论批改）

```
modules/llm_v2/application/
  essay_grader.py              # 主入口
  parsers/grading_parser.py    # 解析 LLM 输出 → EssayReportV2 (Tab 1 已有此表)
  prompts/
    essay_grade.py             # 批改 prompt
```

**核心 prompt 结构**：

```
SYSTEM_PROMPT = """
你是公考申论阅卷专家。请按以下维度评分：
- 立意（满分 X 分）
- 论据（满分 X 分）
- 结构（满分 X 分）
- 语言（满分 X 分）
- 字数（达标/不达标）

输出格式：
{
  total_score: float,
  dimensions: [
    { name, score, max_score, comment },
    ...
  ],
  highlights: [str, str, ...],   // 答案中的亮点（带原文引用）
  issues: [str, str, ...],       // 答案中的问题（带原文引用）
  overall_comment: str,
  improvement_suggestions: [str, str, ...]
}
"""
```

**异步流程（D-Q16）**：

```
session.submit (essay)
  ↓
立即写入 EssaySubmissionV2 (status=pending_grading)
  ↓
返回 OperationAckV2 (含 submission_id)
  ↓
后台任务（FastAPI BackgroundTasks 或 APScheduler one-shot）
  调 essay_grader → 写入 EssayReportV2
  ↓
完成后：
  - 推送通知（前端轮询 or SSE）
  - EssaySubmissionV2.status → graded
```

### 4.3 reference_answer_generator（范文生成）

```
modules/llm_v2/application/
  reference_answer_generator.py  # 主入口
  parsers/reference_parser.py
  prompts/
    reference_answer.py          # 范文生成 prompt
```

**触发时机**：
1. 用户提交申论后，如果该题没有 `EssayReferenceAnswerV2`，**异步生成一份**（source=ai_generated, status=draft）
2. AI 自审通过的进 status=public，否则 status=archived
3. 用户后续点赞/收藏达阈值时，由 cron 提升其优先级

**用户共享逻辑**：

```python
async def list_reference_answers(question_id: int) -> list[Reference]:
    """
    优先级：
    1. source=official (人工补充)
    2. source=ai_generated, status=public, 按 quality_score 降序
    3. source=user_contributed, status=public, 按 likes_count 降序
    """
    return await query(
        question_id=question_id,
        status='public',
        order_by=[
            ('source', custom_order=['official', 'user_contributed', 'ai_generated']),
            ('quality_score', desc=True),
        ],
        limit=5,
    )
```

### 4.4 cron 扩展

| Cron | 时机 | 任务 |
|---|---|---|
| `recompute_question_accuracy` | 每日 04:00 | 重算所有 QuestionV2.historical_accuracy + answer_count |
| `cleanup_low_quality_ai_questions` | 每日 04:30 | 把 quality_score < 阈值或 report_count > 阈值的 AI 题 is_active=false |
| `compute_reference_quality` | 每日 05:00 | 重算所有 EssayReferenceAnswerV2.quality_score（基于 likes/favorites/reports） |
| `generate_daily_practice` | 每日 04:00 | 为所有 active 用户生成当日 DailyPracticeV2（弱项加权策略） |
| `recompute_user_stats` | 每日 02:00 | 重算所有 PracticeStatsSnapshotV2（已在 Phase-Home WU-B8 列出） |
| `recompute_percentile` | 每周一 03:00 | 全量重算 percentile_rank |

---

## 5. 后端工作单元

### WU-B10 · QuestionV2 schema 扩展

**目标**：把题库表升级为支持真题 + AI 题双源，含分类 / 年份 / 地区 / 历史正确率。

**核心交付物**：
- 字段扩展：`source / year / region / exam_type / category_l1 / category_l2 / historical_accuracy / answer_count / quality_score / report_count / is_active / ai_source_question_id / ai_self_audit_passed / ai_generated_at`
- Alembic migration（含数据回填默认值：现有题 source=real_exam, is_active=true）
- 索引：`(category_l1, category_l2)`, `(source, is_active)`, `(year, region, exam_type)`

**PR 拆分**（3 个）：
- B10.1 模型字段扩展（source / 分类 / 年份 / 地区）
- B10.2 模型字段扩展（AI 题专属 + 质量信号）
- B10.3 索引 + Alembic + 数据回填

**估算**：450 行 / 3 PR
**依赖**：无（QuestionV2 已存在）
**验收**：现有题数据完整保留；新字段有合理默认值；典型 query 性能可接受

---

### WU-B11 · session 系列字段扩展

**目标**：PracticeSessionV2 / PracticeSessionAnswerV2 / NoteV2 / ReviewItemV2 字段扩展。

**核心交付物**：
- PracticeSessionV2: `practice_mode / source_mode / config_snapshot`
- PracticeSessionAnswerV2: `flagged / viewed_solution / view_solution_at`
- NoteV2: `linked_question_id / visibility`（Tab 4 schema 提前升级）
- ReviewItemV2: 扩展 reason 枚举

**PR 拆分**（4 个）：
- B11.1 PracticeSessionV2 字段扩展 + Alembic
- B11.2 PracticeSessionAnswerV2 字段扩展 + Alembic
- B11.3 NoteV2 字段扩展 + Alembic（Tab 4 schema 前置）
- B11.4 ReviewItemV2 reason 枚举扩展 + Alembic

**估算**：300 行 / 4 PR
**依赖**：Phase-Home WU-B1 完成
**验收**：旧 session/answer/note 数据完整；新字段默认值合理

---

### WU-B12 · 新表数据模型（5 个表）

**目标**：建 5 个全新表。

**核心交付物**：
- PracticeStatsSnapshotV2 + Alembic
- QuestionFavoriteV2 + Alembic
- QuestionFlagV2 + Alembic
- AiGeneratedQuestionRequestV2 + Alembic
- DailyPracticeV2 + Alembic

**PR 拆分**（5 个，1 表 1 PR）：
- B12.1 PracticeStatsSnapshotV2
- B12.2 QuestionFavoriteV2
- B12.3 QuestionFlagV2
- B12.4 AiGeneratedQuestionRequestV2
- B12.5 DailyPracticeV2

**估算**：750 行 / 5 PR
**依赖**：B11
**验收**：每个表 model 单测通过

---

### WU-B13 · 申论范文表（2 个表）

**目标**：建 EssayReferenceAnswerV2 + EssayReferenceFeedbackV2。

**PR 拆分**（2 个）：
- B13.1 EssayReferenceAnswerV2 + Alembic
- B13.2 EssayReferenceFeedbackV2 + Alembic + 触发器（feedback 写入时同步更新 reference 的 likes/favorites count）

**估算**：350 行 / 2 PR
**依赖**：B12
**验收**：feedback CRUD 后 likes/favorites_count 正确同步

---

### WU-B14 · content 模块扩展（categories + papers filter）

**目标**：把 V2 现有的 stub catalog 端点改为真实现，含 filter。

**端点变更**：

```
GET /api/v2/practice/xingce/categories?level=1|2
  → 返回二级分类树（动态从 QuestionV2.category_l1/l2 聚合）

GET /api/v2/practice/xingce/papers?year=&region=&exam_type=&difficulty=
  → 返回套卷列表（含已完成状态）

GET /api/v2/practice/essay/categories?level=1|2
GET /api/v2/practice/essay/papers?year=&region=&exam_type=
```

**核心交付物**：
- 4 个端点真实现
- filter 参数解析 + DB query
- 已完成状态 join（用 PracticeSessionV2 last_completed_at）

**PR 拆分**（3 个）：
- B14.1 xingce/categories + xingce/papers
- B14.2 essay/categories + essay/papers
- B14.3 已完成状态 join + 排序优化

**估算**：800 行 / 3 PR
**依赖**：B10
**验收**：filter 组合 query 测试通过；分类树正确聚合

---

### WU-B15 · session 模块扩展（多 mode + 答题中操作）

**目标**：session.create 支持新 mode + 答题中的 flag/favorite/note 端点。

**端点变更**：

```
POST /api/v2/practice/sessions
  body 新增字段：
    mode: paper | category | custom | ai_generated | daily | wrong_redo
    practice_mode: per_question | full_set
    config: {
      category?, year_range?, difficulty_range?, count?,
      exclude_already_done?, only_wrong?
    }
    linked_plan_event_id?: int  # Phase-Home 已支持

POST /api/v2/practice/sessions/:id/answers/:answer_id/flag
  body: { flagged: bool }

POST /api/v2/practice/sessions/:id/answers/:answer_id/view-solution
  → 仅逐题模式允许，整组模式拒绝

POST /api/v2/practice/sessions/:id/persistent-flag
  body: { question_id, reason }  # 持久化标记（写入 QuestionFlagV2 + ReviewItemV2）
```

**核心交付物**：
- mode dispatch 逻辑（不同 mode 对应不同 question 选取算法）
- 答题节奏校验（整组模式拒绝中途 view solution）
- session.submit 时如有 flagged 题，同步入 QuestionFlagV2

**PR 拆分**（5 个）：
- B15.1 session.create mode=category 支持
- B15.2 session.create mode=custom 支持（自定义刷题）
- B15.3 session.create mode=daily / wrong_redo 支持
- B15.4 session.create mode=ai_generated 支持（调 question_generator）
- B15.5 答题中 flag / view-solution / persistent-flag 端点

**估算**：1,400 行 / 5 PR
**依赖**：B10, B11, B12
**验收**：6 种 mode 都有 e2e 测试；整组模式严格闭卷验证

---

### WU-B16 · favorites + question_flags 模块（新建）

**目标**：题目收藏 + 持久化标记的独立 CRUD 模块。

**端点**：

```
POST   /api/v2/practice/questions/:id/favorite
DELETE /api/v2/practice/questions/:id/favorite
GET    /api/v2/practice/favorites?type=xingce|essay&category=
GET    /api/v2/practice/favorites/count

POST   /api/v2/practice/questions/:id/flag
  body: { reason }
DELETE /api/v2/practice/questions/:id/flag
PATCH  /api/v2/practice/questions/:id/flag/resolve
GET    /api/v2/practice/flags?reason=
```

**核心交付物**：
- 新模块 `modules/favorites/`
- 新模块 `modules/question_flags/`
- flag 创建时同步写入 ReviewItemV2（reason=flagged_persistent）

**PR 拆分**（3 个）：
- B16.1 favorites 模块
- B16.2 question_flags 模块
- B16.3 flag → ReviewItemV2 联动

**估算**：650 行 / 3 PR
**依赖**：B12
**验收**：flag 后立即在 review tab 看到该题

---

### WU-B17 · practice_stats 模块（新建）

**目标**：历史成绩聚合的所有端点。

**端点**：

```
GET /api/v2/practice/stats?type=xingce
  → snapshot 数据（页面加载用）

GET /api/v2/practice/stats/realtime?category=&type=
  → 实时聚合（详情页用）

GET /api/v2/practice/stats/trend?category=&period=7d|30d|90d
  → 时间维度趋势

GET /api/v2/practice/stats/percentile?category=
  → 百分位（周更新 snapshot 的快照查询）

GET /api/v2/practice/stats/cross?category=&difficulty=
  → 题型 × 难度交叉矩阵
```

**核心交付物**：
- 新模块 `modules/practice_stats/`
- snapshot 写入器（每日 cron + session.submit 增量）
- 实时聚合 query 实现
- 百分位 query 实现（基于 weekly snapshot）

**PR 拆分**（5 个）：
- B17.1 stats endpoint（snapshot 路径）
- B17.2 stats/realtime endpoint（实时聚合）
- B17.3 stats/trend + stats/cross endpoint
- B17.4 stats/percentile endpoint
- B17.5 snapshot 写入器（02:00 cron + 增量 hook）

**估算**：1,500 行 / 5 PR
**依赖**：B11, B12
**验收**：snapshot 与实时聚合数据一致（误差 < 5%）

---


### WU-B18 · ai_questions 模块（新建）

**目标**：AI 出题端点 + 池子查询 + LLM 调用编排。

**端点**：

```
POST /api/v2/practice/ai-questions/generate
  body: { config: AiGenerateConfig }
  → 同步等待（10-15s），返回 { request_id, question_ids }

GET /api/v2/practice/ai-questions/requests/:id
  → 查询请求详情（用于失败重试 / 审计）

POST /api/v2/practice/ai-questions/:question_id/feedback
  body: { action: like | report, note? }
  → 用户反馈，更新 quality_score
```

**核心交付物**：
- 新模块 `modules/ai_questions/`
- 三段退化算法（D-Q13）
- 调 LLM question_generator（含自审）
- AiGeneratedQuestionRequestV2 审计写入
- 反馈聚合 → quality_score 更新

**PR 拆分**（4 个）：
- B18.1 模块骨架 + 池子查询（第一二步）
- B18.2 LLM 实时生成（第三步）+ 自审
- B18.3 入库 + AiGeneratedQuestionRequestV2 审计
- B18.4 反馈端点 + quality_score 聚合

**估算**：1,200 行 / 4 PR
**依赖**：B10（QuestionV2.source 等字段）+ B12.4（AiGeneratedQuestionRequestV2）+ B23（LLM question_generator）
**验收**：池子有题时不调 LLM；池子不够时正确退化；自审失败时退化报错

---

### WU-B19 · daily_practice 模块（新建）

**目标**：每日一练。

**端点**：

```
GET /api/v2/practice/daily?type=xingce|essay
  → 当日的每日一练（如不存在则即时生成）

POST /api/v2/practice/daily/:id/start
  → 开始 → 创建 session（mode=daily）

GET /api/v2/practice/daily/history?period=7d|30d
  → 每日一练历史（含完成状态）
```

**出题策略**：

```python
async def generate_daily_practice(user_id, date, type):
    # 用户弱项加权：从 PracticeStatsSnapshot 取该用户每个 category_l1 的正确率
    weakness_weights = compute_weakness_weights(user_id, type)

    # 跨模块抽题
    question_ids = []
    for category_l1, weight in weakness_weights:
        count_for_this = round(7 * weight)  # 7 题分布
        ids = await pool_query(
            category_l1=category_l1,
            exclude_done_recently=user_id,  # 排除最近 7 天做过的
            limit=count_for_this,
        )
        question_ids.extend(ids)

    return DailyPracticeV2.create(user_id, date, type, question_ids)
```

**核心交付物**：
- 新模块 `modules/daily_practice/`
- 弱项加权出题算法
- 与 session 模块联动（daily.start → session.create(mode=daily, question_ids=...)）

**PR 拆分**（3 个）：
- B19.1 daily 端点 + 出题算法
- B19.2 daily.start 联动 session
- B19.3 daily history 端点

**估算**：800 行 / 3 PR
**依赖**：B12.5 (DailyPracticeV2) + B17（PracticeStatsSnapshot）
**验收**：每日一练弱项分布合理；同一日多次访问返回同一份

---

### WU-B20 · essay_grading 模块扩展

**目标**：申论批改 + 范文管理 + 异步流程。

**端点**：

```
POST /api/v2/practice/essay/submissions/:id/grade
  → 触发批改（异步）。立即返回，结果通过 SSE 或轮询拉取
GET  /api/v2/practice/essay/submissions/:id/grading-status
  → 查询批改状态（pending | graded | failed）

GET  /api/v2/practice/essay/questions/:id/reference-answers
  → 列出该题的范文（按优先级排序）

POST /api/v2/practice/essay/reference-answers/:id/like
DELETE /api/v2/practice/essay/reference-answers/:id/like
POST /api/v2/practice/essay/reference-answers/:id/favorite
DELETE /api/v2/practice/essay/reference-answers/:id/favorite
POST /api/v2/practice/essay/reference-answers/:id/report
  body: { note? }

POST /api/v2/practice/essay/reference-answers/generate
  body: { question_id }
  → 触发 AI 生成范文（异步，含自审）
```

**核心交付物**：
- session.submit (essay) 触发后台批改任务
- 批改结果写 EssayReportV2
- 范文 CRUD + feedback
- 范文质量分聚合（cron）

**PR 拆分**（4 个）：
- B20.1 异步批改流程（trigger + status endpoint）
- B20.2 批改结果写入 + 通知机制（SSE 或 polling endpoint）
- B20.3 范文 list + feedback 端点
- B20.4 AI 范文生成端点（调 reference_answer_generator）

**估算**：1,300 行 / 4 PR
**依赖**：B13（范文表）+ B23（LLM essay_grader, reference_answer_generator）
**验收**：异步批改完整流程通过；范文 CRUD + feedback 正确

---

### WU-B21 · 真题数据导入脚本（D-Q14）

**目标**：把用户本机已有的真题数据导入 V2 schema。

**核心交付物**：
- `services/api/scripts/import_real_exams.py`：CLI 脚本
- 支持的数据格式：JSON / CSV（用户后续提供具体格式后定制）
- 字段映射 + 数据清洗 + 去重
- dry-run 模式（先看结果再 commit）
- 增量导入支持（已导入的题不重复）

**核心步骤**：

```python
def import_real_exams(source_path: Path, dry_run: bool = False):
    raw = parse_source(source_path)
    for item in raw:
        validated = QuestionV2Schema.parse(item, source='real_exam')
        if exists_by_hash(validated.content_hash):
            log("skip duplicate")
            continue
        if dry_run:
            log(f"would import: {validated.id}")
        else:
            db.add(validated)
    db.commit() if not dry_run else None
```

**PR 拆分**（2 个）：
- B21.1 import 脚本骨架 + 字段映射 + dry-run
- B21.2 实际导入 + 去重 + 增量

**估算**：500 行 / 2 PR
**依赖**：B10
**验收**：dry-run 输出准确；正式导入数据进 QuestionV2 表，source=real_exam 全部正确

⚠️ 实际数据导入由用户在本机执行（CI 中只跑 dry-run with sample data）。

---

### WU-B22 · LLM 模块扩展（question_generator + essay_grader + reference_answer_generator）

**目标**：在 Phase-Home 的 llm_v2 模块上追加 3 个能力。

**核心交付物**：
- `application/question_generator.py`
- `application/essay_grader.py`
- `application/reference_answer_generator.py`
- 对应 prompts/ 文件
- 对应 parsers/ 文件

**PR 拆分**（4 个）：
- B22.1 question_generator + 自审 + prompts + parser
- B22.2 essay_grader + prompts + parser
- B22.3 reference_answer_generator + prompts + parser
- B22.4 mock provider 扩展 + 单测

**估算**：1,800 行 / 4 PR
**依赖**：Phase-Home WU-B7
**验收**：每个能力 mock provider 跑通；真 provider 至少手动跑通一次

---

### WU-B23 · cron 扩展

**目标**：在 Phase-Home 的 APScheduler 上追加 4 个新 cron + 1 个增量 hook。

**核心交付物**：
- `recompute_question_accuracy`（每日 04:00）
- `cleanup_low_quality_ai_questions`（每日 04:30）
- `compute_reference_quality`（每日 05:00）
- `generate_daily_practice`（每日 04:00 → 后台批量生成所有 active 用户的当日每日一练）
- `recompute_user_stats` 增量 hook（session.submit 后）
- `recompute_percentile`（每周一 03:00，扩展）

**PR 拆分**（4 个）：
- B23.1 question_accuracy + ai_cleanup cron
- B23.2 reference_quality cron
- B23.3 generate_daily_practice cron + 后台批量
- B23.4 user_stats 增量 hook（session.submit）

**估算**：900 行 / 4 PR
**依赖**：B17, B18, B19, B20
**验收**：本地 dev 启动后所有 cron 按时跑；可手动触发

---

### WU-B24 · OpenAPI 锁定 + 端到端测试

**目标**：Tab 2 后端完工签收。

**核心交付物**：
- e2e 测试（每个新模块）
- LLM 集成测试（mock provider，所有 prompt）
- 重生成 `services/api/spec/openapi.json`
- OpenAPI drift 测试

**PR 拆分**（5 个）：
- B24.1 content + session 扩展 e2e
- B24.2 favorites + flags + practice_stats e2e
- B24.3 ai_questions + daily_practice e2e
- B24.4 essay_grading + reference_answers e2e
- B24.5 OpenAPI 重生成 + drift 测试

**估算**：1,800 行 / 5 PR
**依赖**：B10~B23 全部完成
**验收**：CI 全绿；openapi.json 与 spec 一致

---

## 6. 前端工作单元

### WU-F9 · API client + queries 扩展

**目标**：在 Phase-Home 的 query 文件基础上扩展 + 新增。

**新增 / 扩展 query 文件**：

```
packages/api-client/src/queries/
  contentQueries.ts           ← 重写（categories filter + papers filter）
  sessionQueries.ts           ← 扩展（mode + flag + view-solution + persistent-flag）
  practiceStatsQueries.ts     ← 新建
  aiQuestionsQueries.ts       ← 新建
  essayGradingQueries.ts      ← 新建
  favoritesQueries.ts         ← 新建
  flagsQueries.ts             ← 新建
  dailyPracticeQueries.ts     ← 新建
```

**PR 拆分**（5 个）：
- F9.1 重生成 types（基于 B24.5 OpenAPI）+ contentQueries 重写
- F9.2 sessionQueries 扩展 + practiceStatsQueries
- F9.3 aiQuestionsQueries（含同步等待 hook）+ dailyPracticeQueries
- F9.4 essayGradingQueries（含异步轮询）+ favoritesQueries + flagsQueries
- F9.5 MSW handlers 全套补齐

**估算**：1,800 行 / 5 PR
**依赖**：B24 完成
**验收**：MSW 跑通所有新端点；strict typecheck 通过

---

### WU-F10 · domain stores

**目标**：练习中心状态管理。

**核心交付物**：
- `packages/domain/src/practice/usePracticeStore`：当前 segment（行测/申论）/ 当前 filter / 当前 sort
- `packages/domain/src/practice/useSessionConfigStore`：自定义刷题配置（持久化到 localStorage + profile.info）
- `packages/domain/src/practice/useAnswerSessionStore`（扩展 Tab 1 的）：含 flag/favorite/note 操作

**PR 拆分**（3 个）：
- F10.1 usePracticeStore
- F10.2 useSessionConfigStore + profile.info 同步
- F10.3 useAnswerSessionStore 扩展

**估算**：700 行 / 3 PR
**依赖**：F9
**验收**：store 单测通过

---

### WU-F11 · PracticeCenter 主 view（Section A 历史记录）

**目标**：练习中心一屏 view 的 Section A。

**核心交付物**：
- `apps/web/src/views/PracticeCenter.tsx` 主容器（Section A + B + C 整合）
- `apps/web/src/components/practice/segment/PracticeSegmentTabs.tsx`（行测/申论切换）
- `apps/web/src/components/practice/quick-actions/QuickActionsBar.tsx`（每日一练 / 继续上次 / 自定义刷题）
- `apps/web/src/components/practice/stats/StatsSection.tsx`（Section A 主组件）
- `apps/web/src/components/practice/stats/CategoryStatsCard.tsx`（一级模块成绩卡）
- `apps/web/src/components/practice/stats/SubcategoryList.tsx`（二级模块列表）
- `apps/web/src/components/practice/stats/PercentileBadge.tsx`（百分位徽章）
- `apps/web/src/components/practice/stats/TrendMiniChart.tsx`（趋势缩略图）

**PR 拆分**（4 个）：
- F11.1 PracticeCenter 主容器 + segment + quick actions
- F11.2 StatsSection + CategoryStatsCard
- F11.3 SubcategoryList + 钻取详情
- F11.4 PercentileBadge + TrendMiniChart

**估算**：1,400 行 / 4 PR
**依赖**：F9, F10
**验收**：行测/申论 segment 切换时数据正确；二级分类钻取正常

---

### WU-F12 · Section B 专项练习入口

**目标**：二级分类树 + 进入 session。

**核心交付物**：
- `apps/web/src/components/practice/specialty/SpecialtySection.tsx`
- `apps/web/src/components/practice/specialty/CategoryAccordion.tsx`（一级展开 + 二级列表）
- `apps/web/src/components/practice/specialty/CategoryItem.tsx`（含进度 79/1427 + 去练习按钮）
- 进入 session 流：调 `useCreateSession({ mode: 'category', category: 'yanyu/luoji_tiankong' })`

**PR 拆分**（2 个）：
- F12.1 SpecialtySection + CategoryAccordion + CategoryItem
- F12.2 进入 session 流 + 配置参数（数量、难度选择 mini dialog）

**估算**：600 行 / 2 PR
**依赖**：F9
**验收**：二级展开折叠正常；点击"去练习"正确进 session

---

### WU-F13 · Section C 套卷练习入口

**目标**：套卷列表 + filter（如截图样式：推荐/国考/省考/省份/市考/选调）。

**核心交付物**：
- `apps/web/src/components/practice/papers/PapersSection.tsx`
- `apps/web/src/components/practice/papers/PaperFilterBar.tsx`（多维 filter chip）
- `apps/web/src/components/practice/papers/PaperList.tsx`
- `apps/web/src/components/practice/papers/PaperCard.tsx`（标题 + 难度 + 已完成状态徽章）

**PR 拆分**（3 个）：
- F13.1 PapersSection + PaperFilterBar
- F13.2 PaperList + PaperCard
- F13.3 已完成状态显示 + 排序

**估算**：900 行 / 3 PR
**依赖**：F9
**验收**：filter 多维组合正确；已完成状态准确

---

### WU-F14 · 自定义刷题对话框（CustomPracticeDialog）

**目标**：截图功能完整实现。

**核心交付物**：
- `apps/web/src/components/practice/custom/CustomPracticeDialog.tsx` 主容器
- `apps/web/src/components/practice/custom/SourceModeRadio.tsx`（真题 / AI 出题）
- `apps/web/src/components/practice/custom/YearRangeRadio.tsx`（不限/近3年/近5年/近10年）
- `apps/web/src/components/practice/custom/DifficultyRangeSlider.tsx`（双滑块）
- `apps/web/src/components/practice/custom/QuestionCountStepper.tsx`（5/10/15/20/30）
- `apps/web/src/components/practice/custom/PaceRadio.tsx`（逐题/整组）
- `apps/web/src/components/practice/custom/AdvancedToggle.tsx`（仅刷错题/排除已做）
- 提交按钮 → 调 `useCreateSession({ mode: 'custom', config: {...} })` 或 `useGenerateAiQuestions(...)`

**PR 拆分**（4 个）：
- F14.1 主容器 + SourceModeRadio + YearRangeRadio
- F14.2 DifficultyRangeSlider + QuestionCountStepper
- F14.3 PaceRadio + AdvancedToggle
- F14.4 提交流程（含 AI 出题分支跳转 generating page）

**估算**：1,200 行 / 4 PR
**依赖**：F9, F10
**验收**：所有配置组合都能正确发出 session.create 或 ai-questions.generate

---

### WU-F15 · AI 出题等待页 + 答题 view 扩展

**目标**：
1. AI 出题等待页（同步等待 10-15s 的转圈页）
2. 答题 view 扩展：收藏/标记/笔记/答题节奏切换

**核心交付物**：
- `apps/web/src/views/AiQuestionsGenerating.tsx`：等待页（旋转动画 + 进度提示 + 失败 fallback "切换到真题"）
- `apps/web/src/components/practice/session/SessionToolbar.tsx`：答题界面工具栏（收藏/标记/笔记按钮）
- `apps/web/src/components/practice/session/QuestionFavoriteButton.tsx`
- `apps/web/src/components/practice/session/QuestionFlagButton.tsx`（基础：本次内）
- `apps/web/src/components/practice/session/QuestionNoteSheet.tsx`（题级笔记编辑器）
- `apps/web/src/components/practice/session/PaceIndicator.tsx`（当前节奏指示）
- `apps/web/src/components/practice/session/SolutionPanel.tsx`（解析展示，受答题节奏控制）

**PR 拆分**（5 个）：
- F15.1 AiQuestionsGenerating view + 失败 fallback
- F15.2 SessionToolbar + QuestionFavoriteButton
- F15.3 QuestionFlagButton + 基础标记 UI
- F15.4 QuestionNoteSheet（与 Tab 4 NoteV2 联动）
- F15.5 SolutionPanel + 答题节奏闭卷逻辑

**估算**：1,400 行 / 5 PR
**依赖**：F9, F10
**验收**：整组模式严格闭卷；逐题模式答完立即看解析；笔记保存后 Tab 4 可见

---

### WU-F16 · 申论答题 view + 异步批改流程

**目标**：申论 UI shell + 异步批改 + 范文展示。

**核心交付物**：
- `apps/web/src/components/practice/session/essay/EssayShell.tsx`：申论答题主壳（材料左 / 输入右）
- `apps/web/src/components/practice/session/essay/MaterialReader.tsx`：材料阅读面板
- `apps/web/src/components/practice/session/essay/EssayInput.tsx`：大文本输入 + 字数统计
- `apps/web/src/components/practice/session/essay/EssaySubmitDialog.tsx`：提交确认 + 异步批改触发
- `apps/web/src/views/EssayGradingResult.tsx`：批改结果详情页（含范文）
- `apps/web/src/components/practice/essay/GradingStatusBanner.tsx`：批改状态 banner（pending/graded）
- `apps/web/src/components/practice/essay/GradingDimensions.tsx`：评分维度展示
- `apps/web/src/components/practice/essay/ReferenceAnswerList.tsx`：范文列表
- `apps/web/src/components/practice/essay/ReferenceAnswerCard.tsx`：单条范文（含点赞/收藏/举报）

**PR 拆分**（5 个）：
- F16.1 EssayShell + MaterialReader + EssayInput
- F16.2 EssaySubmitDialog + 异步触发
- F16.3 GradingStatusBanner + 轮询逻辑
- F16.4 GradingDimensions + 批改详情展示
- F16.5 ReferenceAnswerList + 点赞/收藏/举报闭环

**估算**：1,800 行 / 5 PR
**依赖**：F9
**验收**：申论提交 → 立即看到 result 页（pending）→ 批改完成自动刷新；范文交互闭环

---

### WU-F17 · PracticeCenter 整合 + 老 view 删除

**目标**：拼整 PracticeCenter，删除 V2 重构期遗留的老 view。

**核心交付物**：
- `apps/web/src/views/PracticeCenter.tsx` 最终整合
- AppShell 中"练习"tab 路由确认
- 删除：`CustomPracticeStart.tsx`、`EssaySpecialty.tsx`、`EssayPapers.tsx`、`Papers.tsx`、`CategoryTree.tsx`、`EssayPaperDetail.tsx`、`EssayExamSikao.tsx`、`EssayExamResults.tsx`、`EssayHistory.tsx`、`EssaySpecialtyExamSikao.tsx`、`ConversationsHistory.tsx`、`ExamCalendar.tsx` 及对应测试
- `views/ShenlunSession/*` 重构对接 EssayShell（保留设备适配 shell，逻辑迁移到 EssayShell）

**PR 拆分**（4 个）：
- F17.1 PracticeCenter 整合
- F17.2 删除老 view 第一批（独立 view + 测试）
- F17.3 删除老 view 第二批（申论旧 view + 路由清理）
- F17.4 ShenlunSession 重构对接 EssayShell

**估算**：1,200 行（净，含删除）/ 4 PR
**依赖**：F11~F16 完成
**验收**：练习 tab 完整可用；老路由 redirect 到 `/practice`；ShenlunSession 设备适配保留

---

### WU-F18 · E2E 测试

**目标**：练习 tab 完工签收。

**核心交付物**：
- `views/__tests__/PracticeCenter.test.tsx`
- 完整 MSW handlers
- 关键场景 e2e：
  - 段切换（行测 ↔ 申论）→ 数据切换
  - Section A 二级分类钻取 → 详情数据
  - Section B 专项练习 → 进 session → 答题 → 结果
  - Section C 套卷练习 + filter → 进 session
  - 自定义刷题（真题 + AI 出题两路）
  - AI 出题等待 → 成功/失败两路
  - 答题中收藏 + 标记 + 加笔记（笔记 Tab 4 可见）
  - 整组模式严格闭卷验证
  - 申论提交 → 异步批改 banner → 批改完成 → 范文展示 + 点赞
  - 每日一练 → 进 session → 完成

**PR 拆分**（4 个）：
- F18.1 PracticeCenter 整体测试 + segment + Section A
- F18.2 Section B + Section C + 自定义刷题 e2e
- F18.3 AI 出题 + 答题节奏 + 答题中操作 e2e
- F18.4 申论批改 + 范文 + 每日一练 e2e

**估算**：1,500 行 / 4 PR
**依赖**：F17
**验收**：CI 全绿；vitest --run 全部通过

---


## 7. 落地顺序与里程碑

### 7.1 后端阶段（B10 → B24）

```
M0   Phase-Home WU-B1 完成（QuestionV2 模型基础已就位）
M1   WU-B10：QuestionV2 字段扩展完工
M2   WU-B11 + WU-B12 + WU-B13：所有新表/字段就位
M3   WU-B21：真题数据 import 脚本就绪（用户本机执行实际导入）
M4   WU-B14 + WU-B16 + WU-B17：基础 CRUD（content/favorites/flags/stats）端点就位
M5   WU-B15：session 模块多 mode + 答题中操作端点
M6   WU-B22：LLM 模块扩展（question_generator/essay_grader/reference_answer_generator）
M7   WU-B18 + WU-B19：ai_questions + daily_practice
M8   WU-B20：essay_grading 异步流程
M9   WU-B23：cron 扩展
M10  WU-B24：e2e + OpenAPI 锁定
```

### 7.2 前端阶段（F9 → F18）

```
M11  WU-F9：API client 全套
M12  WU-F10：domain stores
M13  WU-F11：Section A 历史记录
M14  WU-F12 + WU-F13：Section B + Section C
M15  WU-F14：自定义刷题对话框
M16  WU-F15：AI 出题等待 + 答题 view 扩展
M17  WU-F16：申论 view + 异步批改
M18  WU-F17：整合 + 老 view 删除
M19  WU-F18：e2e 验收
```

### 7.3 与 Phase-Home 的并行可能性

| 时机 | 可并行项 |
|---|---|
| Phase-Home WU-B1 完成后 | Tab 2 可启动 WU-B10 |
| Phase-Home WU-B7（LLM 模块）完成后 | Tab 2 WU-B22 可启动（在 LLM 上扩展） |
| Phase-Home WU-B9（OpenAPI 锁定）完成后 | Tab 2 前端 WU-F9 启动 |

**保守串行估算**：Phase-Home 9-12 周 + Phase-Practice 12-15 周 = 21-27 周
**理想并行估算**：约 18-22 周（部分 WU 并行）

### 7.4 真题数据导入时机

- **预备**：用户在 M3 之前提供真题数据格式样本（JSON/CSV/SQL dump）
- **WU-B21 完工**（M3）：脚本就绪
- **正式导入**：用户在本机运行（生产环境数据）
- **数据量预估**：用户已说"全量真题数据"，可能数千到数万道。导入时间取决于规模和数据库类型

---

## 8. 验收门槛

### 8.1 后端完工门槛（M10）

- [ ] `pytest -q` 全绿
- [ ] `alembic upgrade head` 干净执行（含 7 个新 migration）
- [ ] OpenAPI 与 `services/api/spec/openapi.json` 一致
- [ ] LLM mock provider 跑通所有新 prompt（question_generator / essay_grader / reference_answer_generator）
- [ ] 6 个新 cron 在 dev 环境按时触发并写入数据
- [ ] 真 LLM provider 至少手动跑通：AI 出题 1 次 / 申论批改 1 次 / 范文生成 1 次
- [ ] 真题 import 脚本 dry-run 通过

### 8.2 前端完工门槛（M19）

- [ ] `vitest --run` 全绿
- [ ] `tsc --strict` 无错
- [ ] 所有 lint:* 脚本全过
- [ ] MSW e2e 覆盖：
  - segment 切换 + 数据正确
  - Section A 二级分类钻取
  - Section B 专项练习闭环
  - Section C 套卷 filter + 已完成状态
  - 自定义刷题（真题路径 + AI 出题路径）
  - 答题中收藏/标记/笔记（笔记 Tab 4 可见）
  - 整组模式严格闭卷
  - 申论提交 → 批改 banner → 完成 → 范文展示 + 反馈
  - 每日一练
- [ ] 桌面 web 体验流畅；不出 console error
- [ ] 老 view 全部删除，路由 redirect 正确

### 8.3 联调门槛（横跨 B + F）

- [ ] 题级笔记跨 tab 联动：练习 tab 加笔记 → Tab 4 可见 → Tab 4 点击跳回题
- [ ] 标记 → 复盘联动：练习中持久标记 → Tab 3 复盘队列出现该题
- [ ] 收藏 → profile 联动：收藏后 profile 可看到收藏数（profile_v2 扩展）
- [ ] 申论批改完成 → 首页 banner 通知（如用户在首页）
- [ ] AI 出题 + 学习计划联动：从计划事件 CTA 进入 AI 出题，session linked_plan_event_id 正确

---

## 9. 风险与回退

| 风险 | 缓解 |
|---|---|
| AI 出题 LLM 自审误判（漏放劣质题入库） | 用户反馈层兜底：举报 3 次自动 is_active=false；人工抽查每周 sample 10 道 |
| AI 出题同步等待 > 15s 用户流失 | 进度提示文案分阶段（"分析弱项..." → "改编题目..." → "审核质量..."）；超时 30s 报错引导切真题 |
| 申论批改异步通知错过 | 提供 GET grading-status 端点轮询兜底；用户回 result 页时主动刷新 |
| 范文生成质量低，污染共享库 | status=draft 默认不展示；自审通过 + 后续达点赞阈值才升 status=public |
| 真题数据导入失败 / 数据脏 | dry-run 模式 + 字段校验 + content_hash 去重 |
| 池子 + LLM 都失败时用户卡住 | 必须返回明确错误 + 一键切换"真题"模式 fallback |
| 大量用户同时 AI 出题 LLM 限流 | LLM 调用层加用户级限流（每用户每日 N 次）；超限引导 24h 后再试或切真题 |
| stats snapshot 与实时聚合数据不一致 | 02:00 cron 兜底重算；前端实时聚合优先 |
| 整组模式被前端绕过严格闭卷 | 后端 view-solution 端点强校验（mode=full_set 时 403 拒绝） |
| 题级笔记导致 Tab 4 列表过长 | Tab 4 默认按"独立笔记"过滤，用户主动切换才看题级笔记 |

---

## 10. 后续工作（不在本 plan）

- 移动端适配（一屏 view 改 tab 内 segment 滚动）
- 错题专项页（V2 review 模块独立 plan）
- 笔记双向链接（NoteV2 与 NoteV2 之间）
- 申论人工批改入口（D-Q4 选项 D，未来扩展）
- AI 出题"出题质量自动评分"（基于用户答题正确率反推 LLM 改编质量）
- 真题题库管理后台（admin 端，新建 Tab）
- 收藏夹分组（QuestionFavoriteV2 加 folder_id）
- 题目纠错入口（用户标记题目本身有问题，不是答案不确定）
- 跨用户笔记共享（D-Q17 visibility 枚举预留扩展）
- 套卷模考模式（带计时器 + 严格仿真考场）
- 离线题库下载（移动端）

---

## 11. 与其他 Phase 的依赖与影响汇总

| Phase | 影响关系 |
|---|---|
| Phase-Home（首页） | 必须先完成 WU-B1（QuestionV2/PracticeSessionV2/NoteV2 基础）、WU-B7（LLM 模块）、WU-B9（OpenAPI）才能启动 Tab 2 |
| Tab 3 复盘（未规划） | Tab 2 持久化标记进 ReviewItemV2；Tab 3 plan 中"错题来源"必须含 wrong_answer + flagged_persistent + low_confidence + manual_add |
| Tab 4 笔记（未规划） | Tab 2 必须先扩展 NoteV2.linked_question_id；Tab 4 plan 必须支持题级笔记的 list / filter / 跳转 |
| Tab 5 我的（未规划） | profile_v2.info 加 dashboard_preferences、ai_adjust_enabled 已在 Phase-Home；Tab 5 时再加偏好设置入口 |

---

## 12. 完成本 plan 后的产品形态

完成 Tab 2 改造后，用户能做到：

1. 进入练习 tab，**一屏看到** 行测/申论的二级分类历史成绩 + 趋势 + 百分位
2. 选某个二级模块进入**专项练习**（系统按弱项自动选题，或用户自定义）
3. 选某套真题进入**套卷练习**（含 filter 按年份/地区/考试类型）
4. 用**自定义刷题**对话框精确控制出题模式 / 年份 / 难度 / 数量 / 答题节奏
5. 用 **AI 出题** 让系统改编出符合自己难度需求的新题（池子优先，不够实时生成）
6. 答题过程中收藏题 / 标记不确定 / 加题级笔记（与 Tab 4 笔记打通）
7. 申论答题：阅读材料 + 大文本输入 + 字数统计 → 提交后**异步 AI 批改** → 看到分维度评分 + 范文对比
8. 范文可点赞 / 收藏 / 举报，反馈影响后续推荐
9. 每天点开**每日一练**做 5-10 题混合，碎片时间高效利用
10. 标记的题自动进 Tab 3 复盘队列
11. 所有练习数据贡献到首页学习计划进度（Phase-Home P2 实绩独立规则）
12. AI 失败时优雅降级（一键切换真题，不阻塞学习）

---
