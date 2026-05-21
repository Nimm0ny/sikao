# Phase-Practice · 09 · Observability & Audit

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **决策来源**：`00-Decisions.md` NF-Audit / NF-Observability；继承 [Phase-Home 09-Observability-Audit](../Home/09-Observability-Audit.md)

---

## 1. 三层关注点（继承 Phase-Home）

```
审计 Audit       → AuditLogV2 + change_log + LlmCallV2 + AiGeneratedQuestionRequestV2
日志 Logs        → 结构化 JSON + request_id 贯穿
指标 Metrics     → OpenTelemetry → Stage 1 file → Stage 2 collector
```

---

## 2. 审计层（NF-Audit）

### 2.1 AuditLogV2 写入触发点（Tab 2 增量）

继承 Phase-Home 的 `core/audit.py`。Tab 2 必须落 audit 的事件：

| 事件 | actor | target_type | 备注 |
|---|---|---|---|
| 收藏题目 | user | QuestionFavoriteV2 | action=favorite.create |
| 取消收藏 | user | QuestionFavoriteV2 | action=favorite.delete |
| 创建持久标记 | user | QuestionFlagV2 | action=flag.create |
| 解决标记 | user | QuestionFlagV2 | action=flag.resolve |
| 创建题级笔记 | user | NoteV2 | action=note.create_question_linked |
| AI 出题成功 | system | AiGeneratedQuestionRequestV2 | action=ai_question.generate.success |
| AI 出题失败 | system | AiGeneratedQuestionRequestV2 | action=ai_question.generate.failure |
| AI 题用户反馈 | user | QuestionV2 | action=ai_question.feedback.{like|report} |
| AI 题自动下线 | system | QuestionV2 | action=ai_question.auto_offline |
| 申论提交触发批改 | user | EssaySubmissionV2 | action=essay.submit |
| 申论批改完成 | system | EssayReportV2 | action=essay.grade.success |
| 申论批改失败 | system | EssaySubmissionV2 | action=essay.grade.failure |
| 范文生成 | system | EssayReferenceAnswerV2 | action=reference.generate |
| 范文反馈 | user | EssayReferenceAnswerV2 | action=reference.feedback.{like|favorite|report} |
| 范文 status 变更 | system | EssayReferenceAnswerV2 | action=reference.status_change |
| 每日一练生成 | system | DailyPracticeV2 | action=daily.generate |
| 每日一练开始 | user | DailyPracticeV2 | action=daily.start |
| session 整组模式严格闭卷违规尝试 | user | PracticeSessionV2 | action=session.closed_book_violation（403 拒绝时记） |

### 2.2 audit 字段约定（继承 Phase-Home）

```python
{
  id: int,
  actor: int | "system",     # 用户 ID 或 system
  action: str,                # 命名空间.事件
  target_type: str,
  target_id: int,
  before: dict | None,        # mutation 前状态
  after: dict | None,         # mutation 后状态
  reason: str | None,         # 业务原因
  request_id: str,            # 关联 request
  created_at: datetime,
}
```

### 2.3 不需要落 audit 的事件

- session 内的 answer 写入（PracticeSessionAnswerV2 本身就是审计源）
- snapshot cron 写入（高频 + 数据派生）
- LLM 调用本身（已有 LlmCallV2）

### 2.4 audit 查询接口

继承 Phase-Home 已有 admin 端点。Tab 2 不新增 admin 路由，但保证写入正确。

---

## 3. LlmCallV2 写入（继承 Phase-Home）

每次 LLM 调用必须写 LlmCallV2。Tab 2 新增 purpose 枚举值（详见 [02-Data-Model §6.1](../Home/02-Data-Model.md)）：

```
purpose:
  - plan_generation       (Phase-Home)
  - plan_adjustment       (Phase-Home)
  - recommendation_today  (Phase-Home)
  - question_generation   (Tab 2 新增)
  - question_audit        (Tab 2 新增)
  - essay_grading         (Tab 2 新增)
  - reference_generation  (Tab 2 新增)
```

字段（继承）：
- user_id（如有）
- provider / model_id / prompt_version
- input_tokens / output_tokens / cost_usd
- duration_ms
- error_code / error_message
- response_hash（不存原文）

---

## 4. 日志（Logs）

### 4.1 结构化 JSON 格式

所有 logger 输出 JSON：

```json
{
  "ts": "2026-05-21T03:00:18.123Z",
  "level": "info",
  "request_id": "abc-123",
  "user_id": 456,
  "module": "ai_questions",
  "event": "generate.complete",
  "duration_ms": 18234,
  "status": "llm_generated",
  "pool_count": 3,
  "llm_count": 7,
  "trace_id": "..." 
}
```

### 4.2 关键 event 约定

Tab 2 新增 event 名命名空间：

```
ai_questions.generate.start
ai_questions.generate.pool_hit_full / pool_hit_partial / pool_miss
ai_questions.generate.llm_request_start / llm_request_complete
ai_questions.audit.passed / failed
ai_questions.feedback.like / report
ai_questions.auto_offline

essay.submit
essay.grade.start / complete / failure
essay.reference.generate / persist / quality_change

practice.stats.snapshot.write / recompute
practice.flag.create / resolve
practice.favorite.create / delete

daily.generate / start / complete / expire
```

### 4.3 日志级别

- DEBUG：详细参数（仅 dev 环境开启）
- INFO：正常流程关键事件
- WARN：非致命异常（如自审失败重试）
- ERROR：致命错误（LLM 调用失败、DB 异常等）

---

## 5. 指标（Metrics）

### 5.1 Counter（继承 + 新增）

```
# AI 出题
ai_questions.generate.requests_total{user_id, status}
ai_questions.generate.pool_hits_total{type}             # full | partial | none
ai_questions.audit.passed_total
ai_questions.audit.failed_total{dimension}              # answer_correctness | stem_clarity | ...
ai_questions.feedback_total{action}                      # like | report
ai_questions.auto_offline_total

# 申论
essay.submission_total
essay.grading.success_total
essay.grading.failure_total{code}
essay.reference.generated_total
essay.reference.feedback_total{action}

# 收藏 / 标记
favorites.created_total
favorites.deleted_total
flags.created_total{reason}
flags.resolved_total

# stats
practice_stats.snapshot.recomputed_total
practice_stats.realtime.served_total
practice_stats.percentile.recomputed_total

# daily
daily.generated_total{strategy}
daily.started_total
daily.completed_total
daily.expired_total

# 闭卷违规
session.closed_book_violations_total{reason}             # ui_bypass | direct_api_call

# 配额 / 限流
quota.exceeded_total{purpose, user_id}
ratelimit.hit_total{endpoint}
```

### 5.2 Histogram

```
ai_questions.generate.duration_seconds{path}             # pool_only | with_llm
ai_questions.audit.duration_seconds
essay.grading.duration_seconds                           # 后台批改总耗时
essay.reference.generation.duration_seconds

http.endpoint.duration_seconds{endpoint, status_code}    # 继承 Phase-Home

practice_stats.realtime.query_duration_seconds
practice_stats.snapshot.recompute_duration_seconds
```

### 5.3 Gauge

```
ai_questions.pool_size{category_l1, source}              # 当前池子大小（cron 更新）
ai_questions.active_count{source}                        # is_active=true 的题数
essay.reference.public_count
essay.submission.pending_count                           # 待批改队列大小

llm.daily_cost_usd{purpose}                              # 日成本
llm.daily_calls_total{purpose}
```

### 5.4 SLO（服务水平目标）

| SLO | 目标 |
|---|---|
| AI 出题 P95 (含 LLM 路径) | < 30s |
| 申论批改成功率 | > 95% |
| AI 题自审通过率 | > 60% |
| stats realtime P95 | < 600ms |
| pool_hit_full 比例 | 随时间应增长（用户多了池子大） |

SLO 失败 → alert（Stage 2 集成）。

---

## 6. Tracing（继承 Phase-Home）

OpenTelemetry trace_id 贯穿：
- 用户请求进入 → trace_id 生成
- 调 LLM → 子 span
- 调 DB → 子 span
- 后台批改任务 → 单独 trace（用 user_request_id 关联）

关键 span 名：

```
http.POST.api.v2.practice.ai-questions.generate
  ├── ai_questions.pool_query.not_done
  ├── ai_questions.pool_query.already_done
  ├── llm.question_generation
  ├── llm.question_audit (× count)
  └── ai_questions.persist.save_with_dedupe

http.POST.api.v2.practice.essay.submissions.id.grade
  └── essay.background_grading_trigger

(background)
essay.grade.run
  ├── llm.essay_grading
  └── essay.report_persist
```

---

## 7. dashboards（Stage 2）

预设 Grafana / Datadog dashboard：

### 7.1 AI 出题面板

- 出题请求总量（按 status 分桶）
- 池子命中率趋势
- 自审通过率趋势
- LLM 调用耗时分布
- 用户配额耗尽事件

### 7.2 申论批改面板

- 提交总量
- 批改成功率
- 批改耗时分布
- 范文生成数量
- 反馈互动率

### 7.3 成本面板

- 日 LLM 成本（按 purpose）
- 用户成本 top 10
- prompt version 成本对比

### 7.4 池子健康面板

- AI 题池总量趋势
- 自动下线题数
- 用户反馈分布（点赞 vs 举报）

---

## 8. 告警阈值（Stage 2）

| 告警 | 触发条件 | 严重度 |
|---|---|---|
| AI 出题失败率 > 20%（5min 窗口） | high |
| 申论批改失败率 > 10%（1h 窗口） | high |
| LLM 全局日成本 > $40 | warning |
| LLM 全局日成本 > $50（预算） | critical（自动熔断） |
| 池子无符合条件题（任一 category） > 1h | warning |
| pool_hit_full 比例 < 30% 持续 7 天 | info（提示扩充 AI 池） |
| 闭卷违规尝试 > 100 次/h | warning（疑似攻击） |
| stats realtime P95 > 1s 持续 10min | warning |
| audit_log 写入失败 | critical |

---

## 9. 调试工具

### 9.1 admin / dev 端点（不暴露生产）

继承 Phase-Home。Tab 2 新增：

```
GET  /admin/practice/pool-status                 # 当前池子统计
GET  /admin/practice/ai-requests/recent          # 最近 100 次 AI 出题请求
GET  /admin/practice/audit-failures/recent       # 最近 100 次自审失败
POST /admin/practice/ai-question/:id/audit       # 手动审核某 AI 题
POST /admin/practice/ai-question/:id/offline     # 手动下线某 AI 题
GET  /admin/practice/cost-trend                  # 成本趋势
```

⚠️ 这些端点 `Depends(is_admin)`，仅 admin 用户可访问。

### 9.2 本地调试

dev 模式下：
- LLM 调用日志展示完整 prompt + response
- AI 出题路径打印每一步耗时与命中情况
- audit 同步打印到 stdout

生产环境：
- LLM 完整 payload 不写日志（response_hash 替代）
- 错误堆栈只写到 file，不发邮件

---

## 10. 隐私与合规

继承 Phase-Home：
- 用户答题内容、笔记、申论答案为敏感数据
- audit_log 不存原文，仅存 metadata
- LlmCallV2 不存 prompt 完整内容，存 response_hash
- 用户可通过 `/profile/data-export` 导出自己数据（D-Profile-Bind 范围 / Tab 5）
- 用户可申请删除：删除时 cascade 收藏 / 标记 / 笔记 / session（保留 7 天后物理清理）

---

## 11. 关联文档

- [Phase-Home 09-Observability-Audit](../Home/09-Observability-Audit.md) - 通用观测体系
- [02-Data-Model §3.6](./02-Data-Model.md#36-aigeneratedquestionrequestv2) - AI 请求审计表
- [03-Backend-WU §17 / §10 / §12](./03-Backend-WU.md) - cron / ai_questions / essay 模块
- [05-LLM-Module §9](./05-LLM-Module.md#9-审计与可观测) - LLM 审计要求
