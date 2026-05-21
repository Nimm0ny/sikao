# Sikao 首页 V2 改造落地 Plan

> **Status**: ACCEPTED
> **Scope**: 仅一级导航首页 view（Section A 学习计划 + B 学习进度 + C 今日推荐）
> **原则**: 完整落地（不走最小化路线）/ 后端先行 / 前端 UI 最后做 / 每 PR 受 AGENTS H9 约束（≤15 文件 / ≤400 行）
> **Last Updated**: 2026-05-21

---

## 0. 已拍板决策清单

### 0.1 IA 层（Frontend-IA-V2.md 的 D 系列）

| # | 决策 | 拍板内容 |
|---|---|---|
| D-Layer | 登录后 Gate 优先于 Main App | 是 |
| D1 | 一级导航 | 因 H-Plan-6 升 6 tab（Web 端先做） |
| D7 | 答题/结果脱壳 | 是 |
| D12 | envelope 3 组件标准化 | 是（仅用于 stub 期占位） |
| D14 | 空状态统一组件 | 是 |
| D15 | 脱壳路由 4 条 | 是 |

### 0.2 首页架构（H-Plan 系列）

| # | 决策 | 拍板内容 |
|---|---|---|
| H-Plan-1 | 学习计划视图 | 日历画廊（Today/Week/Month）+ F1+F3 融合（月历 + 锁考试日 + 多 target） |
| H-Plan-2 | 自定义计划 | IA 必画 + 完全实现 |
| H-Plan-3 | AI 制定/调整/推荐 | IA 必画 + 完全实现（不走前端伪 AI） |
| H-Plan-4 | 进度数据层 | D-Full（summary + timeseries + weakness + plan slice + diagnosis） |
| H-Plan-5 | 计划/推荐/实绩边界 | 6 条规则（P1-P6，详见第 2 节） |
| H-Plan-6 | 详细学情/记录归宿 | 学情升 tab，记录走 profile 子页（Web 6 tab，移动端后期适配） |

### 0.3 日历子决策（Cal 系列）

| # | 决策 | 拍板内容 |
|---|---|---|
| Cal-1 | 时间粒度 | 严格小时 |
| Cal-2 | Today 视图朝向 | 纵向 |
| Cal-3 | 跨多日事件 | 支持 |
| Cal-4 | 重复事件 | 支持 RRULE（RFC 5545） |
| Cal-5 | 事件 → session 绑定 | 是 |
| Cal-6 | 倒数考试日显示 | Month 视图右上角 |
| Cal-7 | 拖拽调整 | 支持 |
| Cal-8 | 多目标支持 | 是（事件加 target_id） |

### 0.4 自定义计划子决策（Cust 系列）

| # | 决策 | 拍板内容 |
|---|---|---|
| Cust-1 | 创建方式 | 拖拽空白格 + "+" 按钮 双支持 |
| Cust-2 | 编辑方式 | 拖拽 + 拉伸 + 点击编辑面板 |
| Cust-3 | 重复事件编辑 scope | 仅此次 / 后续所有 / 整个序列 3 选 1 |
| Cust-4 | 时间冲突 | 警告但允许 |
| Cust-5 | 批量重置 | 清空本周/全部/重新让 AI 生成 全部要 |
| Cust-6 | AI/用户事件混合 | 通过 source 字段区分，UI 加小标记 |

### 0.5 AI 制定子决策（AI 系列）

| # | 决策 | 拍板内容 |
|---|---|---|
| AI-1 | 触发位置 | onboarding + 首页常驻按钮 + 计划为空状态引导 三处 |
| AI-2 | 用户输入参数 | 完整表单（考试日/每日时长/起点/重点科目/风格） |
| AI-3 | 生成范围 | 锁定到考试日（整段） |
| AI-4 | 生成后可改性 | 与手动事件一样可改 |
| AI-5 | AI 服务失败兜底 | 重试 1 次 + 报错引导手动 |
| AI-6 | 局部重生成 | 圈选某段 → regenerate range |

### 0.6 AI 调整子决策（ADJ 系列）

| # | 决策 | 拍板内容 |
|---|---|---|
| ADJ-1 | 触发时机 | 凌晨 cron + 登录检查 + 跳过事件实时 |
| ADJ-2 | 通知形式 | Banner（不打断当前操作） |
| ADJ-3 | 调整范围 | 仅未来事件 |
| ADJ-4 | 用户可关 | 是（profile_v2.info.ai_adjust_enabled） |
| ADJ-5 | 调整原因可见 | 是（透明性） |

### 0.7 今日推荐子决策（Rec 系列）

| # | 决策 | 拍板内容 |
|---|---|---|
| Rec-1 | 数据源 | 全数据源（records + review.items + WeaknessSnapshot + 计划进度 + 实时 session） |
| Rec-2 | 输出形式 | 2-3 卡候选 |
| Rec-3 | 推荐卡内容 | 标题 + 原因 + 估时 + 动作类型（复盘/继续/休息）+ CTA |
| Rec-4 | 接受效果 | 用户选（默认进 session，次要"加入计划"） |
| Rec-5 | 拒绝交互 | 收集反馈（用于后续 fine-tune） |
| Rec-6 | 无数据时 | "做完第一次练习后开启"等待状态 |
| Rec-7 | 推荐刷新 | 自动 + 用户主动"换一批" |

### 0.8 基础设施决策

| # | 决策 | 拍板内容 |
|---|---|---|
| D-Cron-1 | Cron runner | APScheduler（嵌入 FastAPI lifespan） |
| D-LLM-1 | LLM Provider | DeepSeek 官方 + 阿里百炼平台双支持（OpenAI 兼容接口）。详见第 3 节。API key 与模型 ID 由用户在本机部署时配置 |
| D-LLM-2 | prompt 版本管理 | git 内文件，禁止 inline string |
| D-Plan-must-do | `/today/must-do` 端点 | 去除（用 source 字段区分即可） |
| D-DailyPlan-drop | DailyPlanV2/WeeklyPlanV2 | drop table |
| D-Profile-Bind | BindEmail/Phone/Complete | 留给"我的"tab plan，不在本 plan 范围 |
| D-Rec-Policy | 复盘/继续/休息阈值表 | 见第 2.2 节 |
| D-Link-Session | session 绑定时机 | A：用户从计划事件 CTA 进入时显式绑定 |

---

## 1. 总览

### 1.1 工作流

```
Backend (WU-B1 → WU-B9)        →    Frontend (WU-F1 → WU-F8)
  数据 → 路由 → 服务 → LLM → Cron → 测试      Types → Stores → Engine → Sections → 整合 → 测试
```

### 1.2 估算

| 维度 | 估算 |
|---|---|
| 总行数（新增 + 删除） | ~16,000 行 |
| Backend / Frontend | 7,500 / 8,500 |
| PR 总数 | ~40 个 |
| Backend 阶段 | 5–7 周 |
| Frontend 阶段 | 4–5 周 |
| 全程 | 9–12 周 |

### 1.3 依赖图

```
WU-B1 ────────────────┐
                      ├─→ WU-B2 ─┬─→ WU-B5 ──┐
                      │          │           │
                      │          └─→ WU-B7 ──┤
                      ├─→ WU-B3 ─────────────┤
                      ├─→ WU-B4 ─────────────┤─→ WU-B8 ─→ WU-B9 ─→ WU-F1
                      ├─→ WU-B6 ─────────────┘
                                                                  │
                                                                  ↓
WU-F1 ─→ WU-F2 ──┐
       └─→ WU-F3 ┼─→ WU-F4 ─┐
                 └─→ WU-F5 ─┤
                 └─→ WU-F6 ─┴─→ WU-F7 ─→ WU-F8
```

---

## 2. 边界规则与策略表

### 2.1 6 条核心规则（P1-P6）

| # | 规则 | 含义 |
|---|---|---|
| **P1** | 学习计划 = 目标 + 路径建议 | 目标层（提分）才是计划本质；路径层（日历事件）是建议 |
| **P2** | 实绩层独立于计划层 | 所有 PracticeSessionV2 都贡献进度，无论是否绑定计划事件 |
| **P3** | PlanEventV2.status 只表达事件本身 | done/skipped 不代表计划成功/失败 |
| **P4** | 用户额外练习自动落入日历视图 | 但不创建 PlanEventV2，作为"实绩块"显示在日历上，视觉上区分 |
| **P5** | AI 推荐基于实绩 + 目标 + 实时状态 | 输入：实绩、目标差距、当前疲劳度、近期错误密度 |
| **P6** | 任何"改计划"的行为都需审计 + 提案制 | 用户/AI 提案 → 落到 PlanV2.change_log；AI 自动调整不直接落地 |

### 2.2 推荐策略阈值表（D-Rec-Policy）

存放路径：`services/api/src/sikao_api/modules/llm_v2/application/recommender_policy.py`

| 信号 | 阈值 | 推荐动作 |
|---|---|---|
| 当前正确率 | < 60% | **复盘**（不继续堆量） |
| 当前正确率 | 60–80% | 复盘 OR 巩固同题型 |
| 当前正确率 | > 80% | 继续推进（换新题型 / 升级难度） |
| 累积错题数 | > 30 题未复盘 | **复盘**优先于继续 |
| 连续答题时长 | > 60 分钟 | 提示休息（不强制） |
| 连续答题时长 | > 90 分钟 | **复盘**或休息（不再推新题） |
| 距考试日 | < 30 天 | 模考权重 ↑ |
| 距考试日 | < 7 天 | 几乎只推复盘 + 模考 |

阈值表作为 LLM prompt 的一部分（让 AI 理解策略），同时保留用户可调（profile_v2.info 加策略偏好字段，未来扩展）。

---

## 3. LLM 模块详细设计（D-LLM-1）

### 3.1 接入策略

DeepSeek 官方和阿里百炼平台**都提供 OpenAI 兼容接口**，因此使用统一 OpenAI 兼容 client（基于 `openai` Python SDK），通过配置切换 provider。

| Provider | base_url | API key env | 默认 model |
|---|---|---|---|
| DeepSeek 官方 | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` | `deepseek-v3.1`（百炼侧别名）或 `qwen-plus` 备选 |

> 参考：DeepSeek 官方 API 文档 `https://api-docs.deepseek.com/`，阿里云百炼 `https://help.aliyun.com/zh/model-studio/`。

### 3.2 模块结构

```
services/api/src/sikao_api/modules/llm_v2/
  __init__.py
  application/
    __init__.py
    service.py                    # LLM service 入口（dispatch 到 generator/adjustor/recommender）
    provider.py                   # Provider 抽象基类 + 注册中心
    plan_generator.py             # AI 制定 / 局部重生成
    plan_adjustor.py              # AI 每日调整提案
    recommender.py                # 今日推荐
    recommender_policy.py         # D-Rec-Policy 阈值表
    parsers/
      plan_output_parser.py       # 解析 LLM 输出 → PlanEventV2 batch
      adjustment_parser.py        # 解析 → PlanAdjustmentV2.changes
      recommendation_parser.py    # 解析 → RecommendationV2 batch
    prompts/                      # 全部 prompt 模板存为文件（D-LLM-2）
      plan_generate.py
      plan_regenerate_range.py
      plan_adjust.py
      recommend_today.py
      _shared.py                  # 公用 system prompt 片段
  infrastructure/
    __init__.py
    openai_compatible_provider.py # 统一 OpenAI 兼容 client
    deepseek_provider.py          # DeepSeek 官方 thin wrapper
    dashscope_provider.py         # 阿里百炼 thin wrapper
    mock_provider.py              # 测试用
```

### 3.3 配置层

`services/api/src/sikao_api/core/config.py` 追加：

```python
class LlmSettings(BaseSettings):
    # provider 选择：deepseek | dashscope | mock
    llm_provider: Literal["deepseek", "dashscope", "mock"] = "mock"

    # DeepSeek 官方
    deepseek_api_key: SecretStr | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"

    # 阿里百炼
    dashscope_api_key: SecretStr | None = None
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    dashscope_model: str = "deepseek-v3.1"

    # 通用
    llm_timeout_seconds: int = 30
    llm_max_retries: int = 1
    llm_temperature: float = 0.7
```

API key 用户本机部署时通过 `.env` 注入。代码层不读取 secret，仅通过 SecretStr 暴露。

### 3.4 Provider 抽象

```python
class LlmProvider(Protocol):
    async def chat_complete(
        self,
        *,
        system: str,
        messages: list[ChatMessage],
        response_format: dict | None = None,
        temperature: float | None = None,
    ) -> LlmResponse: ...
```

DeepSeek 和阿里百炼的 thin wrapper 都继承 `OpenAICompatibleProvider`，仅以默认 base_url + model 参数化。Mock provider 用于测试，按 prompt 关键字返回固定 fixture。

### 3.5 Prompt 文件规范（D-LLM-2）

每个 prompt 文件导出三个常量：

```python
# prompts/plan_generate.py
PROMPT_VERSION = "v1"

SYSTEM_PROMPT = """
你是公考备考助手，根据用户的目标考试日期、每日学习时长、起点水平、重点科目和风格，
生成一份分配到日历的备考计划...
"""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["title", "category", "start_at", "end_at"],
            }
        }
    }
}
```

LLM 调用时强制 JSON mode（DeepSeek 和百炼都支持），output 经 parser 校验后返回。

### 3.6 重试与失败兜底（AI-5）

```python
async def _with_retry(call_fn, *, max_retries: int):
    for attempt in range(max_retries + 1):
        try:
            return await call_fn()
        except (TimeoutError, ProviderError) as e:
            if attempt == max_retries:
                raise LlmServiceError("LLM 服务暂时不可用，请稍后重试") from e
            await asyncio.sleep(0.5 * (attempt + 1))
```

业务层捕获 `LlmServiceError` → 返回 503 + 引导用户手动操作（前端 Section A 的"AI 制定"按钮失败时弹"切到手动模式"对话）。

### 3.7 调用约束

- LLM 模块**不暴露 HTTP 端点**（避免 prompt injection）
- 仅供 `modules/plans/`、`modules/recommendations/` 内部调用
- 所有调用走 `application/service.py` 的 facade 函数
- prompt 与 parser 必须有单测（用 mock provider）

---


## 4. 工作单元详细规格

### WU-B1 · 数据建模

**目标**：建立首页所有功能依赖的 V2 数据表。

**核心交付物**：
- 新表：`PlanV2`、`PlanEventV2`、`PlanAdjustmentV2`、`RecommendationV2`、`RecommendationFeedbackV2`
- 扩展：`ProfileGoalV2.exam_targets[]`、`ProfileInfoV2.ai_adjust_enabled / dashboard_preferences`
- 扩展：`PracticeSessionV2.linked_plan_event_id`（nullable，因 D-Link-Session）
- 废弃：`DailyPlanV2`、`WeeklyPlanV2`（drop table）

**关键 schema**：

```python
class PlanV2(Base):
    id: int (PK)
    user_id: int (FK)
    name: str  # "国考备考 2024"
    target_exam_id: str  # 国考/省考/事业单位
    target_exam_date: date
    daily_minutes_target: int
    style: enum (loose / standard / aggressive)
    baseline: dict
    focus_subjects: list[str]
    status: enum (active / paused / archived)
    source: enum (user_manual / ai_generated)
    change_log: JSON  # P6 审计
    created_at, updated_at, archived_at

class PlanEventV2(Base):
    id: int (PK)
    plan_id: int (FK)
    user_id: int (FK)
    title: str
    category: enum (xingce / essay / review / mock / break / custom)
    start_at: datetime (UTC)
    end_at: datetime (UTC)
    timezone: str  # "Asia/Shanghai"
    recurring_rule: str | None  # RRULE
    recurring_parent_id: int | None
    recurring_exception_dates: JSON
    status: enum (planned / in_progress / done / skipped)
    source: enum (user_manual / ai_generated / ai_adjusted)
    linked_session_id: int | None  # FK PracticeSessionV2
    target_id: int | None  # FK ProfileGoalV2.exam_targets[]
    notes: str
    change_log: JSON

class PlanAdjustmentV2(Base):
    id: int (PK)
    plan_id, user_id (FK)
    proposed_at: datetime
    reason: str  # "近 3 天行测正确率下降 8%"
    changes: JSON  # [{event_id, action: edit|add|delete, before, after}]
    status: enum (pending / accepted / rejected / expired)
    decided_at: datetime | None
    expires_at: datetime
    source: enum (cron_daily / login_check / event_skipped)

class RecommendationV2(Base):
    id: int (PK)
    user_id (FK)
    title, reason, estimated_minutes, cta
    action_type: enum (review / continue / rest)  # 因 Rec-3
    payload: JSON  # session params 或 review item ids
    generated_at: datetime
    expires_at: datetime
    served_count: int
    status: enum (pending / accepted_session / accepted_plan / rejected / expired)
    accepted_at, rejected_at: datetime | None
    source_signals: JSON

class RecommendationFeedbackV2(Base):
    id: int (PK)
    recommendation_id (FK)
    reason: str  # "已经做过 / 不感兴趣 / 估时太长 / 其他"
    note: str | None
    created_at
```

**PR 拆分**（5 个）：
- B1.1 PlanV2 + PlanEventV2 模型 + Alembic
- B1.2 PlanAdjustmentV2 模型 + Alembic
- B1.3 RecommendationV2 + Feedback 模型 + Alembic
- B1.4 Profile 扩展 + PracticeSessionV2.linked_plan_event_id + Alembic
- B1.5 Drop DailyPlanV2/WeeklyPlanV2 + Alembic

**估算**：800 行 / 5 PR
**依赖**：无
**验收**：`alembic upgrade head` + `alembic downgrade -1` 来回不报错；新表 model 测试通过

---

### WU-B2 · plans 模块（事件 CRUD + recurring + conflict）

**目标**：日历画廊的核心后端。

**核心交付物**：
- 新模块 `modules/plans/`
- 端点：

```
GET    /api/v2/plans                          GET    /api/v2/plans/events?from=&to=&include_practice_blocks=
POST   /api/v2/plans                          POST   /api/v2/plans/events
GET    /api/v2/plans/:id                      PATCH  /api/v2/plans/events/:id?scope=this|future|all
PUT    /api/v2/plans/:id                      DELETE /api/v2/plans/events/:id?scope=this|future|all
DELETE /api/v2/plans/:id                      POST   /api/v2/plans/events/bulk-delete
POST   /api/v2/plans/:id/archive              POST   /api/v2/plans/events/conflicts
POST   /api/v2/plans/:id/activate
GET    /api/v2/plans/adjustments/pending
POST   /api/v2/plans/adjustments/:id/accept
POST   /api/v2/plans/adjustments/:id/reject
GET    /api/v2/plans/adjustments/:id
```

- recurring expander（基于 `python-dateutil.rrule`）
- conflict detector
- 重复事件 `scope=this|future|all` 编辑/删除语义
- `include_practice_blocks=true` 时，events 端点同时返回该范围内**未关联到任何计划事件**的 PracticeSessionV2 作为"实绩块"（因 P4）

**PR 拆分**（6 个）：
- B2.1 plans 主表 CRUD（list/create/get/update/archive/activate）
- B2.2 events 基础 CRUD（list/create/get/single-event update/delete）
- B2.3 events 高级（bulk-delete + conflicts 端点 + practice_blocks 联合返回）
- B2.4 recurring expander + exception handler
- B2.5 重复事件 scope 编辑/删除
- B2.6 plan adjustments 路由

**估算**：2,400 行 / 6 PR
**依赖**：B1.1 + B1.2 + B1.4
**验收**：所有端点 contract test 通过；recurring expander 单测覆盖 RFC 5545 主要规则；practice_blocks 与 events 联合返回测试通过

---

### WU-B3 · recommendations 模块

**目标**：今日推荐的端点层（不含 LLM 调用，调用层在 B7）。

**核心交付物**：
- 新模块 `modules/recommendations/`
- 端点：

```
GET  /api/v2/recommendations/today
POST /api/v2/recommendations/refresh
POST /api/v2/recommendations/:id/accept       body: {action: "session"|"plan", target_date?}
POST /api/v2/recommendations/:id/reject       body: {reason?, note?}
GET  /api/v2/recommendations/history
```

- 接受时的两种行为分支（直接进 session / 加入指定日计划）
- 服务于 LLM 的 source_signals 收集器（聚合 records + review.items + WeaknessSnapshot + PlanEventV2 进度 + 实时 session）

**PR 拆分**（3 个）：
- B3.1 路由 + 基础 CRUD
- B3.2 accept 双分支（session 创建 + plan event 创建）
- B3.3 reject 反馈记录 + history 查询

**估算**：900 行 / 3 PR
**依赖**：B1.3、B2.2
**验收**：accept→session/plan 两条路径都有 e2e 测试

---

### WU-B4 · progress 真实现 + snapshot 写入

**目标**：从 stub 升级到 D-Full 完整数据层。

**关键约束**：进度数据**完全独立于 PlanEventV2.status**（因 P2/P3）。仅基于 `PracticeSessionV2 + ProgressSnapshotV2 + WeaknessSnapshotV2 + EssaySubmissionV2 + EssayReportV2`。

**核心交付物**：
- 路由升级：

```
GET /api/v2/dashboard/progress              聚合 summary（含 plan slice）
GET /api/v2/dashboard/progress/timeseries?from=&to=&granularity=day|week
GET /api/v2/dashboard/progress/weakness     多维强弱
GET /api/v2/dashboard/progress?plan_id=     按 plan 切片
GET /api/v2/dashboard/progress/diagnosis    诊断报告
```

- ProgressSnapshotV2 写入器（每日 cron 调用，本 WU 只写器；cron 调度在 B8）
- WeaknessSnapshotV2 写入器（每周 cron + session.submit hook 实时增量）
- plan slice 实现（join PlanEventV2 by date range，但 status 字段不参与）

**PR 拆分**（4 个）：
- B4.1 summary + diagnosis 真实现
- B4.2 timeseries（含 day/week 粒度）
- B4.3 weakness 真实现
- B4.4 snapshot 写入器（progress + weakness）+ session.submit hook

**估算**：1,400 行 / 4 PR
**依赖**：B2.2（plan slice 要 PlanEventV2）
**验收**：每个端点都返回非占位真数据；snapshot writer 跑完后查询结果一致

---

### WU-B5 · planning 重写（dashboard 入口）

**目标**：planning 模块从 stub 改写为基于 PlanEventV2 的真实现。

**端点变更**：

```
GET /api/v2/dashboard/today                  PlanEventV2 today 范围
GET /api/v2/dashboard/today/continue         PracticeSessionV2 in_progress
GET /api/v2/dashboard/today/review           review.items 高优先
GET /api/v2/dashboard/weekly-plan            PlanEventV2 week 范围 + summary
GET /api/v2/dashboard/weekly-plan/goal       PlanV2 字段
GET /api/v2/dashboard/weekly-plan/today-completion
PUT /api/v2/dashboard/weekly-plan/adjust     调整 plan goal
GET /api/v2/dashboard/full-plan              ← 新增（H-Plan-1 完整计划视图）
```

**端点废弃**：
- `GET /api/v2/dashboard/today/must-do`（D-Plan-must-do 决策为去除）

**PR 拆分**（3 个）：
- B5.1 today + today/continue + today/review 重写 + must-do 移除
- B5.2 weekly-plan 4 个端点重写 + adjust 落到 PlanV2 字段
- B5.3 full-plan 新增（含倒数考试日逻辑 + 多 target 聚合）

**估算**：1,100 行 / 3 PR
**依赖**：B2.2、B4.1
**验收**：response shape 不变（envelope 兼容），data 真实

---


### WU-B6 · profile 扩展

**目标**：配合 IA 决策的 profile 字段扩展。

**核心交付物**：
- `/api/v2/profile/goals` 接受 `exam_targets[]`（多目标，因 H-Plan-1 + Cal-8）
- `/api/v2/profile/info` 接受 `ai_adjust_enabled` + `dashboard_preferences`
- BindEmail/BindPhone/CompleteProfile 收编 → **本 plan 不做**，留给"我的"tab plan（D-Profile-Bind）

**PR 拆分**（2 个）：
- B6.1 goals 扩展（exam_targets）
- B6.2 info 扩展（ai_adjust_enabled / dashboard_preferences）

**估算**：250 行 / 2 PR
**依赖**：B1.4
**验收**：旧字段向后兼容；新字段 PUT/GET 往返

---

### WU-B7 · LLM 模块

详见第 3 节。

**核心交付物**：
- 新模块 `modules/llm_v2/`，**不暴露 HTTP**
- Provider 抽象：DeepSeek + 阿里百炼（OpenAI 兼容） + mock
- `plan_generator`：制定 + 局部重生成
- `plan_adjustor`：每日提案生成
- `recommender`：今日推荐生成 + recommender_policy.py 阈值表
- prompts/parsers 分离
- mock provider + retry 逻辑

**PR 拆分**（6 个）：
- B7.1 LLM service 框架 + provider 抽象 + 配置
- B7.2 OpenAI 兼容 client + DeepSeek/百炼 wrapper + mock provider
- B7.3 plan_generator + prompts/parsers
- B7.4 plan_adjustor + prompts/parsers
- B7.5 recommender + recommender_policy.py + prompts/parsers
- B7.6 LLM 模块单测（用 mock provider）

**估算**：2,000 行 / 6 PR
**依赖**：B1.1（plan event schema）+ B1.3（recommendation schema）
**验收**：mock provider 跑通所有 prompt；真 provider 至少手动跑通 plan_generate / recommend_today 各一次（CI 不依赖真 LLM）

---

### WU-B8 · Cron 系统

**目标**：把所有定时/事件触发的 AI 行为接起来。

**核心交付物**：
- Cron runner（**APScheduler**，嵌入 FastAPI lifespan，因 D-Cron-1）
- Cron 任务：
  - 每日 00:30：ProgressSnapshot 写入
  - 每周一 01:00：WeaknessSnapshot 全量重算
  - 每日 06:00：所有 active plan 跑 plan_adjustor，生成 PlanAdjustmentV2
- 实时触发：
  - 用户 login 时调一次 adjustment 检查
  - 事件 status=skipped 时实时调 plan_adjustor
  - **session.submit 后实时调 recommender**（因 P5，让推荐基于实时实绩）

**PR 拆分**（4 个）：
- B8.1 APScheduler 集成 + ProgressSnapshot cron
- B8.2 WeaknessSnapshot cron + session.submit hook
- B8.3 plan_adjustor cron + login hook + skipped event hook
- B8.4 session.submit 后 recommender 实时刷新 hook

**估算**：1,000 行 / 4 PR
**依赖**：B7（LLM）+ B4（snapshot writer）
**验收**：本地启动后 cron 按时跑；可手动触发（开发模式）

---

### WU-B9 · 端到端测试 + OpenAPI 验收

**目标**：Backend 完工签收。

**核心交付物**：
- modules 端到端测试（plans / recommendations / progress / planning / profile）
- LLM 集成测试（mock provider）
- 重生成 `services/api/spec/openapi.json`
- OpenAPI drift 测试（防 schema 漂移）

**PR 拆分**（5 个）：
- B9.1 plans + events e2e
- B9.2 recommendations e2e
- B9.3 progress e2e（含 timeseries / weakness / slice）
- B9.4 planning + profile e2e
- B9.5 OpenAPI 重生成 + drift 测试

**估算**：1,400 行 / 5 PR
**依赖**：B2~B8 全部完成
**验收**：CI 全绿；openapi.json 与 spec 一致

---

### WU-F1 · API client + queries

**目标**：删老 query，建 V2 query 全集。

**核心交付物**：
- 重生成 `packages/api-client/src/types/api.generated.ts`（基于 B9.5 的 openapi.json）
- 删除：`onboardingQueries / studyPlanQueries / wrongBookQueries / notebookQueries / examEventsQueries / xingceSpecialtyQueries / essaySpecialtyQueries / progressQueries(老)`
- 新增：`plansQueries / recommendationsQueries / progressQueries(V2) / dashboardQueries`

**plansQueries 导出**（不完整列举）：

```ts
usePlansList / usePlan / useCreatePlan / useUpdatePlan / useArchivePlan
useEvents(range, filters, includePracticeBlocks) / useEvent / useCreateEvent / useUpdateEvent / useDeleteEvent
useDetectConflicts / useBulkDeleteEvents
useAutoGeneratePlan / useAutoRegenerateRange
useAdjustmentsPending / useAcceptAdjustment / useRejectAdjustment
```

**PR 拆分**（4 个）：
- F1.1 重生成 types + 删 8 个老 query 文件 + 删对应测试
- F1.2 plansQueries（events 部分，含 practice_blocks 联合）
- F1.3 plansQueries（plan + adjustments 部分）+ recommendationsQueries
- F1.4 progressQueries(V2) + dashboardQueries

**估算**：1,300 行 / 4 PR
**依赖**：B9 完成
**验收**：MSW handler 调通所有 V2 端点；strict typecheck 通过

---

### WU-F2 · domain stores

**目标**：状态层为 Section A/B/C 提供心智单元。

**核心交付物**：
- `packages/domain/src/plan/usePlanStore`：当前选中 plan、当前视图（today/week/month）、当前日期范围、本地未提交拖拽态
- `packages/domain/src/dashboard/useDashboardPreferenceStore`：自定义偏好（同步到 profile.info.dashboard_preferences）

**PR 拆分**（2 个）：
- F2.1 usePlanStore
- F2.2 useDashboardPreferenceStore + profile.info 同步

**估算**：500 行 / 2 PR
**依赖**：F1
**验收**：store 单测通过；preferences 跨设备同步往返

---

### WU-F3 · calendar-engine 包

**目标**：纯逻辑日历核心，无 UI。

**核心交付物**：新建 `packages/calendar-engine/`：
- 时区处理（基于 `date-fns-tz`）
- RRULE 展开（基于 `rrule.js`）+ 单次例外处理
- 冲突检测
- 拖拽坐标计算（像素 ↔ 时间 + 15 分钟吸附）
- view range 计算（today/week/month）

**PR 拆分**（5 个）：
- F3.1 包基础（package.json / tsconfig / types / index）
- F3.2 时区工具
- F3.3 RRULE expand + exception
- F3.4 冲突检测
- F3.5 拖拽坐标 + 吸附 + view range

**估算**：1,400 行 / 5 PR
**依赖**：无（与 F1 并行）
**验收**：每个模块覆盖 ≥80% 单测；RRULE 验证 RFC 5545 主要规则

---

### WU-F4 · 首页 Section A · 学习计划

**目标**：日历画廊 + AI 制定 + AI 调整 banner + 用户 CRUD + 实绩块渲染。

**核心交付物**：
- PlanSection 主容器 + segment（Today/Week/Month）
- 三套日历视图（TodayCalendarView / WeekCalendarView / MonthCalendarView）
- 实绩块渲染（与计划事件视觉区分，因 P4）
- EventCard / EventEditDrawer / EventCreateDrawer
- 拖拽集成（dnd-kit）+ 拉伸 handler
- AI 制定对话框（AiPlanGenerateDialog + 输入表单）
- AI 调整 banner（AiPlanAdjustBanner + 详情 dialog）
- 重复事件 scope 选择对话
- 冲突警告 + 批量重置菜单 + 倒数考试日

**PR 拆分**（10 个）：
- F4.1 PlanSection 主容器 + segment tabs
- F4.2 TodayCalendarView（24h grid + now line + 事件块/实绩块渲染）
- F4.3 WeekCalendarView
- F4.4 MonthCalendarView + 倒数考试日
- F4.5 EventCard + EventEditDrawer
- F4.6 EventCreateDrawer + 拖拽空白创建
- F4.7 拖拽 handler + resize handler（dnd-kit 集成）
- F4.8 AiPlanGenerateDialog + 输入表单（**也用于 OnboardingGate**）
- F4.9 AiPlanAdjustBanner + 详情 dialog + accept/reject
- F4.10 ConflictWarning + BulkResetMenu + RecurringScopeDialog

**估算**：3,500 行 / 10 PR
**依赖**：F1 + F2 + F3
**验收**：所有交互在桌面 web 跑通；MSW e2e 跑通

⚠️ **特别说明**：F4.8 的 `AiPlanGenerateDialog` 必须设计为可在 OnboardingGate 复用的独立组件（AI-1 决策的"三处入口"之一）。

---

### WU-F5 · 首页 Section B · 学习进度

**目标**：精简数值卡 + sparkline，钻取到 `/progress` tab。

**核心交付物**：
- ProgressSection 容器
- KeyMetricCard（4-6 个数值）
- TrendSparkline（取 timeseries 子集）
- "查看详情"钻取按钮（→ `/progress`）

**PR 拆分**（2 个）：
- F5.1 ProgressSection + KeyMetricCard
- F5.2 TrendSparkline + 钻取

**估算**：600 行 / 2 PR
**依赖**：F1
**验收**：summary + timeseries 数据正确渲染

---

### WU-F6 · 首页 Section C · 今日推荐

**目标**：2-3 张 AI 推荐卡 + accept/reject 闭环。

**核心交付物**：
- RecommendationSection 容器（含刷新按钮）
- RecommendationCard（标题 + 原因 + 估时 + 动作类型徽章 复盘/继续/休息 + CTA）
- AcceptOptionMenu（默认进 session，次要"加入计划"日期选择）
- RejectFeedbackDialog
- EmptyRecommendation（新用户兜底）

**PR 拆分**（4 个）：
- F6.1 RecommendationSection + RecommendationCard
- F6.2 AcceptOptionMenu + 进 session 流（含 D-Link-Session 显式 link）
- F6.3 AcceptOptionMenu 加入计划分支
- F6.4 RejectFeedbackDialog + EmptyRecommendation

**估算**：950 行 / 4 PR
**依赖**：F1
**验收**：accept→session、accept→plan、reject 三条路径 e2e 通过

---

### WU-F7 · 首页整合 + 6 tab + 老 view 删除

**目标**：拼起 Section A/B/C，调整 AppShell 到 6 tab，删除被取代的老 view。

**核心交付物**：
- 重写 `apps/web/src/views/Dashboard.tsx`（编排 A/B/C）
- AppShell 6 tab 调整（桌面 RailMini 优先；TabBar 暂保 5 tab，留 6 tab placeholder）
- OnboardingGate 调整（首次进入触发 AiPlanGenerateDialog）
- 删除：`Plan.tsx / studyToday.tsx / Onboarding.tsx / DiagnosisResult.tsx`（最后两个待 onboarding 改造完同步删）+ 对应测试

**PR 拆分**（4 个）：
- F7.1 Dashboard.tsx 重写
- F7.2 AppShell 6 tab + RailMini 调整
- F7.3 OnboardingGate 接 AiPlanGenerateDialog
- F7.4 删除老 view + 路由清理 + 老测试清理

**估算**：800 行（净，含删除）/ 4 PR
**依赖**：F4 + F5 + F6
**验收**：首页登录后 3 个 section 渲染；老路由 redirect 到 `/`

---

### WU-F8 · E2E 测试 + MSW

**目标**：首页完工签收。

**核心交付物**：
- `views/__tests__/Dashboard.test.tsx`（重写）
- 完整 MSW handlers（plans/events/recommendations/progress/dashboard）
- 关键场景 e2e：
  - 新用户首次进入 → onboarding → AI 制定计划 → 看到日历有事件
  - 老用户进入 → 看到今日 segment 有事件、Section B 有数据、Section C 有推荐
  - 拖拽事件改时间 → patch 成功
  - 接受推荐 → 进 session（带 link）
  - 接受 AI 调整 banner → 计划改变
  - 用户加练（unlinked session）→ 实绩块出现在日历

**PR 拆分**（3 个）：
- F8.1 Dashboard.test.tsx 重写 + MSW handlers
- F8.2 拖拽 / AI 制定 / AI 调整 e2e
- F8.3 推荐 accept/reject e2e + 实绩块场景

**估算**：900 行 / 3 PR
**依赖**：F7
**验收**：CI 全绿；vitest --run 全部通过

---

## 5. 落地顺序与里程碑

### 5.1 后端阶段（B1 → B9）

```
M0 (week 0)        启动，确认 plan
M1 (week 1)        WU-B1 完工：DB schema 全部就位
M2 (week 2-3)      WU-B2 + WU-B3 + WU-B6：核心 CRUD 端点
M3 (week 4)        WU-B4 + WU-B5：进度 + planning 真实现
M4 (week 5-6)      WU-B7：LLM 模块（用户本机配置 API key 后联调）
M5 (week 6)        WU-B8：Cron + 实时 hook
M6 (week 7)        WU-B9：e2e + OpenAPI 锁定
```

### 5.2 前端阶段（F1 → F8）

```
M7 (week 8)        WU-F1：API client 切换 V2
M8 (week 8)        WU-F2 + WU-F3：stores + calendar-engine（并行）
M9 (week 9-10)     WU-F4：Section A（最重）
M10 (week 11)      WU-F5 + WU-F6：Section B/C（并行）
M11 (week 11)      WU-F7：整合 + 6 tab
M12 (week 12)      WU-F8：e2e 验收
```

### 5.3 LLM API key 配置时机

用户在 M4（week 5）开始时本地填入：

```env
# .env (用户本机)
LLM_PROVIDER=deepseek  # 或 dashscope
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-v4-flash
# 或
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_MODEL=deepseek-v3.1
```

CI 用 `LLM_PROVIDER=mock`，不依赖外部服务。

---

## 6. 验收门槛

### 6.1 后端完工门槛（M6）
- [ ] `pytest -q` 全绿
- [ ] `alembic upgrade head` 干净执行
- [ ] OpenAPI 与 `services/api/spec/openapi.json` 一致
- [ ] LLM mock provider 跑通所有 prompt
- [ ] cron 在 dev 环境按时触发并写入数据
- [ ] 真 LLM provider 至少手动跑通 plan_generate / recommend_today 各一次

### 6.2 前端完工门槛（M12）
- [ ] `vitest --run` 全绿
- [ ] `tsc --strict` 无错
- [ ] 9 个 lint:* 脚本全过
- [ ] MSW e2e 覆盖：日历 CRUD / AI 制定 / AI 调整 / 推荐 accept/reject / 实绩块
- [ ] 首页登录态访问无 console error
- [ ] 桌面 web 6 tab 切换流畅

---

## 7. 风险与回退

| 风险 | 缓解 |
|---|---|
| LLM 长尾延迟（>10s） | timeout 30s + retry 1 + 失败兜底报错 + 引导手动 |
| LLM 输出 JSON 不合法 | parser 严格校验 + 失败 fallback retry |
| Calendar 拖拽性能问题（大量事件） | view range 限制 + 虚拟滚动（F3.5 后续优化） |
| 时区错误（用户跨时区） | 全部 datetime UTC 存储 + 渲染层 timezone 转换 |
| RRULE 边界 case | F3.3 单测覆盖 daily/weekly/monthly 主要规则；EXDATE 单独测 |
| AI 调整频繁吵用户 | ADJ-1 限流：每日最多 1 次 banner，用户可关 |
| DeepSeek/百炼 限流或停服 | 配置层支持 fallback 切换 provider；仅需改一行 env |

---

## 8. 后续工作（不在本 plan）

- 移动端 4-5 tab 适配（H-Plan-6 暂时只做 web 端）
- 申论批改 module（V2 EssaySubmissionV2/EssayReportV2 模型已建，路由没暴露）
- LLM fine-tune：基于 RecommendationFeedbackV2 训练个性化推荐模型
- BindEmail/BindPhone/CompleteProfile 收编 → "我的"tab plan
- Onboarding/DiagnosisResult 完整 view 改造
- 用户可调推荐策略阈值（profile_v2.info 加 recommender_preferences 字段）
