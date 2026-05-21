# Phase-Home · 09 · Observability & Audit

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **决策来源**：`00-Decisions.md` NF-Audit / NF-Observability

---

## 1. 三层关注点划分

```
┌─────────────────────────────────────────────┐
│  审计 Audit                                  │  合规 / 反查 / 训练数据
│  - AuditLogV2（详见 02-Data-Model §2.9）     │
│  - PlanV2.change_log / PlanEventV2.change_log│
│  - LlmCallV2（详见 02-Data-Model §2.8）      │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  日志 Logs                                   │  调试 / 故障复盘
│  - 结构化 JSON                                │
│  - request_id 贯穿                            │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  指标 Metrics                                │  容量 / SLO
│  - OpenTelemetry → Stage 1 file exporter     │
│  - Stage 2: OTel collector + Prometheus      │
└─────────────────────────────────────────────┘
```

---

## 2. 审计层（NF-Audit）

### 2.1 AuditLogV2 写入触发点

写入策略：**所有 plan / event / adjustment / recommendation / 配置变更必须落 audit_log**。代码层用统一 helper：

```python
# core/audit.py
async def write_audit(
    *,
    user_id: int,
    actor: Actor,                 # Actor.user(uid) / Actor.ai("plan_adjustor") / Actor.cron("daily_progress")
    action: str,                  # "event.create" / "plan.archive" / ...
    target_type: str,
    target_id: int | None,
    before: dict | None = None,
    after: dict | None = None,
    metadata: dict | None = None,
) -> None:
    log = AuditLogV2(
        user_id=user_id,
        actor_type=actor.type,
        actor_id=actor.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        before=redact_secrets(before) if before else None,
        after=redact_secrets(after) if after else None,
        diff=compute_diff(before, after) if before and after else None,
        metadata=metadata or {},
        request_id=current_request_id(),
        ip=current_request_ip(),
    )
    await session.add(log)
```

### 2.2 写入触发点清单

| 模块 | 事件 | actor |
|---|---|---|
| plans | plan.create / plan.update / plan.archive / plan.activate / plan.pause / plan.soft_delete | user |
| plans | plan.auto_generate.completed | ai |
| plans | event.create / event.update / event.delete / event.restore / event.bulk_delete | user |
| plans | event.scope_split / event.scope_detach | user |
| plans | event.status_auto_transition | cron |
| plans | adjustment.proposed | ai |
| plans | adjustment.accepted / adjustment.rejected / adjustment.expired | user / cron |
| recommendations | recommendation.generated | ai |
| recommendations | recommendation.accepted_session / accepted_plan / rejected | user |
| profile | profile.goals.update / profile.info.update | user |
| auth | session.login / session.refresh / session.logout | user |
| llm | llm.call.failed.parse / llm.call.failed.provider / llm.call.quota_blocked | system |
| system | rate_limit.hit | system |

### 2.3 change_log（双写）

每个 PlanV2 / PlanEventV2 行内 `change_log` JSON 数组追加，与 audit_log 同 reason / actor / before / after，便于 UI 时间线展示而无需 join audit 表。

```python
# 推荐用 helper 同时写双方
async def update_event_with_audit(event, patch, *, actor):
    before = event.dict()
    apply_patch(event, patch)
    after = event.dict()
    await write_audit(action="event.update", before=before, after=after, ..., actor=actor)
    event.change_log.append({
        "at": utc_now().isoformat(),
        "actor": actor.dict(),
        "type": "update",
        "before": minimal_diff_view(before, after, "before"),
        "after": minimal_diff_view(before, after, "after"),
        "reason": patch.reason or None,
    })
```

### 2.4 redact_secrets

任何 before/after JSON 中以下字段必须脱敏：
- `password / api_key / secret / token / phone / email_full / id_card`
- LLM payload 中的 system prompt 不脱敏（已是公开模板）；user_input 已 sanitize

### 2.5 audit_log 查询接口（Stage 2 admin）

`GET /admin/audit/search?user_id=&action=&target_type=&from=&to=`

Stage 1 仅 DBA 直接查表；Stage 2 实现 admin UI。

---

## 3. LLM 调用审计（详见 `05-LLM-Module.md` §8 + `02-Data-Model.md` §2.8）

### 3.1 写入策略

每次 chat_complete / chat_complete_stream **必写** LlmCallV2，无论成功或失败：
- 成功：parse_status=ok, parsed_output 落表
- JSON 解析失败：parse_status=invalid_json, response_payload 截断 32KB 落表
- schema 违反：parse_status=schema_violation, parsed_output 为 partial
- provider 错误：parse_status=empty, error_class / error_message 落表
- 重试场景：每次重试都写一行（retry_count 自增）

### 3.2 关联

- LlmCallV2.id 反向写到 PlanAdjustmentV2.llm_call_id / RecommendationV2.llm_call_id
- 用户投诉"AI 推荐给我做了奇怪的事"时通过 recommendation_id → llm_call_id 一路追溯

### 3.3 cost dashboard（admin）

```
GET /admin/llm/usage?from=&to=&group_by=user|purpose|day
```

返回：
- `cost_cny_total / call_count / parse_failure_rate / avg_latency_ms / p95_latency_ms`
- 按 group_by 维度切片

Stage 1 单机：自己一个用户，dashboard 主要看 cost。Stage 2 多用户：监控异常用户 + 每日总成本。

---

## 4. 结构化日志

### 4.1 格式

```json
{
  "ts": "2026-05-21T14:35:22.123Z",
  "level": "INFO",
  "logger": "modules.plans.event_service",
  "msg": "event.update",
  "request_id": "req_abc123",
  "user_id": 42,
  "event_id": 7891,
  "duration_ms": 23,
  "extra": {...}
}
```

### 4.2 实现

```python
# core/logging.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.JSONRenderer(),
    ],
)

# 中间件注入 request_id / user_id
@app.middleware("http")
async def context_middleware(request, call_next):
    request_id = request.headers.get("x-request-id") or f"req_{uuid7()}"
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        user_id=getattr(request.state, "user_id", None),
        path=request.url.path,
    )
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response
```

### 4.3 等级约定

| 级别 | 用途 |
|---|---|
| DEBUG | 详细执行步骤（仅 dev） |
| INFO | 业务事件成功（含 LLM call 完成） |
| WARNING | 业务异常但可恢复（重试 / 限流命中） |
| ERROR | 业务失败（5xx / parse 失败 / quota 超） |
| CRITICAL | 系统级故障（cron 全失败 / DB 连不上） |

### 4.4 输出

- Stage 1：`logs/api.jsonl`（rotated 100MB × 10 file），人工 grep
- Stage 2：stdout JSON → process supervisor / reverse proxy / log collector（保持 no-docker 约束）

### 4.5 前端日志

前端用 `packages/shared-utils/src/logger.ts`（已存在）；新模块禁用 console.log（AGENTS-H4.4 已禁）。

前端关键事件 → 上报 `/api/v2/system/client-log`：
- 未捕获错误（window.onerror / unhandledrejection）
- React error boundary 触发
- 关键性能指标（web-vitals）

---

## 5. OpenTelemetry 指标（NF-Observability）

### 5.1 Stage 1 file exporter

```python
# core/otel.py
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

# Stage 1: ConsoleMetricExporter → file
# Stage 2: OTLPMetricExporter → collector
```

Stage 1 用 `ConsoleMetricExporter` 写 `logs/metrics.jsonl`，本地 grep 或导入 Grafana Loki（可选）。

### 5.2 后端关键指标

```python
meter = metrics.get_meter("sikao_api")

# Counter
http_requests_total = meter.create_counter("http_requests_total", description="...")
llm_calls_total = meter.create_counter("llm_calls_total")
llm_calls_failed_total = meter.create_counter("llm_calls_failed_total")
events_created_total = meter.create_counter("events_created_total")
adjustments_proposed_total = meter.create_counter("adjustments_proposed_total")
recommendations_accepted_total = meter.create_counter("recommendations_accepted_total")
rate_limit_hits_total = meter.create_counter("rate_limit_hits_total")

# Histogram
http_request_duration_ms = meter.create_histogram("http_request_duration_ms", unit="ms")
llm_latency_ms = meter.create_histogram("llm_latency_ms", unit="ms", attributes={"purpose"})
llm_input_tokens = meter.create_histogram("llm_input_tokens")
llm_output_tokens = meter.create_histogram("llm_output_tokens")
llm_cost_cny = meter.create_histogram("llm_cost_cny")
db_query_duration_ms = meter.create_histogram("db_query_duration_ms")

# Gauge / observable
active_sessions = meter.create_observable_gauge("active_sessions", callbacks=[...])
pending_adjustments = meter.create_observable_gauge("pending_adjustments", callbacks=[...])
cron_jobs_dlq_count = meter.create_observable_gauge("cron_jobs_dlq_count", callbacks=[...])
```

### 5.3 前端 web-vitals

```ts
// apps/web/src/main.tsx
import { onLCP, onINP, onCLS, onFCP, onTTFB } from "web-vitals";

function reportMetric(name: string, value: number, attrs: Record<string, unknown>) {
  // 上报到 /api/v2/system/client-metrics
  postClientMetric({ name, value, attrs });
}

onLCP(({ value }) => reportMetric("web_vitals.lcp", value, { route: location.pathname }));
onINP(({ value }) => reportMetric("web_vitals.inp", value, { route: location.pathname }));
onCLS(({ value }) => reportMetric("web_vitals.cls", value, { route: location.pathname }));
```

### 5.4 SLO（Stage 2 启用告警）

| SLO | 目标 |
|---|---|
| API 5xx 率 | ≤ 1% |
| API p95 延迟（非 LLM） | ≤ 300ms |
| LLM 端点 p95 | ≤ 25s |
| LLM parse_failure_rate | ≤ 5% |
| Cron 任务成功率 | ≥ 99% |
| 首页 LCP（p75） | ≤ 2.5s |

### 5.5 告警（Stage 2）

| 告警 | 触发 | 通道 |
|---|---|---|
| LLM provider 失败率 > 20%（5min） | provider 故障 | webhook → 飞书机器人 |
| LLM 单用户日成本 > 10 CNY | 防爆 / 异常 | 日终邮件 |
| Cron DLQ > 0 | 任务失败堆积 | 飞书 |
| API 5xx > 5%（5min） | 严重故障 | 飞书 + 邮件 |
| Disk usage > 80% | 容量 | 邮件 |

Stage 1 单机不接告警；用户自己看 dashboard。

---

## 6. 前端可观测

### 6.1 错误上报

```ts
// packages/shared-utils/src/error-reporter.ts
export function reportError(error: Error, context: Record<string, unknown> = {}) {
  postClientLog({
    level: "ERROR",
    message: error.message,
    stack: error.stack,
    context,
    ts: new Date().toISOString(),
  });
}

window.addEventListener("error", (e) => reportError(e.error, { source: "window" }));
window.addEventListener("unhandledrejection", (e) => reportError(e.reason, { source: "promise" }));
```

### 6.2 Section Error Boundary

```tsx
class SectionErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { boundary: this.props.name, componentStack: info.componentStack });
  }
  ...
}
```

### 6.3 业务事件埋点

```ts
// 已存在 lib/analytics.ts，扩展事件清单：
trackEvent("plan.ai_generate.start", { params: ... });
trackEvent("plan.ai_generate.success", { events_count, cost_cny });
trackEvent("plan.ai_generate.fail", { reason });
trackEvent("event.drag.complete", { delta_minutes, snap });
trackEvent("recommendation.accept", { action, recommendation_id });
trackEvent("recommendation.reject", { reason });
trackEvent("section.error", { section_name });
```

事件命名约定：`<noun>.<verb>` 或 `<noun>.<verb>.<status>`。

---

## 7. Dashboard（Stage 2）

### 7.1 关键 dashboard

| Dashboard | 看什么 |
|---|---|
| API Health | 5xx 率 / p95 / RPS |
| LLM Cost | 按 user / purpose / day 切 cost / 调用数 / 失败率 |
| Plan / Event | 创建数 / 删除数 / AI 制定使用率 / 调整接受率 |
| Recommendation | 生成数 / accept rate by action_type / reject reason 分布 |
| Cron Health | 成功率 / DLQ / 漏跑 |
| Web Vitals | LCP / INP / CLS p75 by route |

### 7.2 实现

Stage 2 用 Grafana + Prometheus；Stage 1 不投入。

---

## 8. 隐私与数据保留

### 8.1 用户数据保留

| 数据 | 保留期 | 动作 |
|---|---|---|
| AuditLogV2 | 永久 | 不主动删 |
| LlmCallV2 | 90 天 | cron 物理删 |
| logs/api.jsonl | 30 天 | rotated 自动清 |
| client_log（上报错误） | 90 天 | cron 物理删 |
| PracticeSessionV2 | 永久 | 不主动删 |
| 已软删 PlanEventV2 | 30 天 → 物理删 | cron（B8.3） |

### 8.2 用户导出 / 删除（Stage 2）

预留端点（不在本 plan 实现）：
- `GET /api/v2/profile/export` 全量数据导出
- `DELETE /api/v2/profile/account` 注销 + 异步清数据

---

## 9. 部署形态对应

| 维度 | Stage 1 | Stage 2 |
|---|---|---|
| audit_log | DB 直查 | + admin UI |
| logs | jsonl 文件 grep | + log collector |
| metrics | file exporter | OTel collector + Prometheus + Grafana |
| 告警 | 无 | 飞书 + 邮件 |
| 前端 client_log | 写 DB | + 收敛上报频率 + 采样 |

切换原则同 `08-NonFunctional.md` §5：业务代码不动，仅切 exporter / collector。

---

## 10. 测试

| 测试 | 覆盖 |
|---|---|
| `tests/audit/test_event_audit.py` | 创建/编辑/删除事件都写 audit + change_log，且 actor 一致 |
| `tests/audit/test_ai_audit.py` | AI 调用三类（generate/adjust/recommend）都写 LlmCallV2 |
| `tests/audit/test_redact.py` | secrets 字段在 audit before/after 中被替换 |
| `tests/observability/test_request_id.py` | 跨中间件 request_id 一致 |
| `tests/observability/test_metrics_emitted.py` | 端点调用后对应 counter 自增 |

---

## 11. 引用矩阵

| 本文档被引用 |
|---|
| `02-Data-Model.md` AuditLogV2 / LlmCallV2 / change_log |
| `03-Backend-WU.md` audit 写入点（每个 service） |
| `05-LLM-Module.md` cost_tracker / quotas 落表 |
| `08-NonFunctional.md` §部署形态 |
| `10-Testing.md` audit / observability 测试 |
