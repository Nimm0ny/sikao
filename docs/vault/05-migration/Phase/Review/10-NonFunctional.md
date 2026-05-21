# Phase-Review · 10 · Non-Functional Requirements

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §3（D-R12 / D-R13）· [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) §5

---

## 1. 性能目标

| 指标 | 目标 | 测量方式 |
|---|---|---|
| 列表加载（GET /review/items, 50 条） | < 200ms p95 | pytest benchmark + 500 items 数据 |
| 详情加载（GET /review/items/:id） | < 100ms p95 | pytest benchmark |
| SRS compute_next_review | < 5ms | unit test + timeit |
| AI 错因分析端到端 | < 8s p95 | LLM provider latency + parsing |
| 三卡 S-front 聚合（500 items + 200 answers） | < 50ms | vitest + performance.now() |
| 首屏渲染（/review 默认视图） | < 1.5s FCP | Lighthouse CI |
| 列表渲染（500 items 虚拟滚动） | < 1s interactive | vitest performance smoke |

---

## 2. 限流

| 端点 / 资源 | 限制 | 窗口 | 超限响应 |
|---|---|---|---|
| AI 错因分析（单题 + 聚合） | 20 次 / 用户 | 每自然日（用户时区） | 429 + reset_at |
| Review CRUD 总计 | 100 次 / 用户 | 每分钟 | 429 + Retry-After header |
| Review 批量操作 | 10 次 / 用户 | 每分钟 | 429 |
| 周回顾笔记生成 | 3 次 / 用户 | 每自然日 | 429 |

### 2.1 实现方式

```python
# 复用 Phase-Home rate_limiter 中间件（基于内存 sliding window）
# AGENTS H10: 不引 Redis；单机进程内 dict + TTL

from sikao_api.core.rate_limiter import per_user_limiter

@router.post("/items/{item_id}/cause-analysis")
@per_user_limiter(limit=20, window="1d", key_prefix="cause_analysis")
async def cause_analysis_single(...):
    ...
```

---

## 3. 数据库索引

### 3.1 review_items_v2

| 索引名 | 列 | 用途 | 类型 |
|---|---|---|---|
| `ix_review_items_v2_user_created` | (user_id, created_at) | 按创建时间排序列表 | B-tree |
| `ix_review_items_v2_user_status` | (user_id, status) | 按状态筛选 | B-tree |
| `ix_review_items_v2_user_next_review` | (user_id, next_review_at) | SRS today queue | B-tree |
| `ix_review_items_v2_user_source_kind` | (user_id, source_kind) | 按来源筛选 | B-tree |
| `ix_review_items_v2_question` | (question_id) | 跨 tab 查询 | B-tree |

### 3.2 review_attempts_v2

| 索引名 | 列 | 用途 | 类型 |
|---|---|---|---|
| `ix_review_attempts_v2_item_attempted` | (review_item_id, attempted_at) | 单题历史时间线 | B-tree |

### 3.3 ai_cause_analysis_v2

| 索引名 | 列 | 用途 | 类型 |
|---|---|---|---|
| `ix_ai_cause_v2_user_question_hash` | (user_id, question_id, input_hash) | 单题缓存命中 | B-tree |
| `ix_ai_cause_v2_user_signature` | (user_id, question_ids_signature) | 多题缓存命中 | B-tree |
| `ix_ai_cause_v2_expires` | (expires_at) | 过期清理 cron | B-tree |

---

## 4. 前端 Bundle 预算

| Chunk | 预算（gzipped） | 包含内容 |
|---|---|---|
| review-main | < 40KB | ReviewToday + ReviewAll + domain hooks |
| review-insights | < 30KB | 3 张 recharts 图（lazy load） |
| review-qhub | < 35KB | QuestionHub + 操作组件 |
| 总计 review 相关 | < 80KB | 三个 chunk 合计 |

### 4.1 代码分割策略

```typescript
// apps/web/src/router/index.tsx
const ReviewToday = lazy(() => import('../views/ReviewToday'));
const ReviewAll = lazy(() => import('../views/ReviewAll'));
const ReviewInsights = lazy(() => import('../views/ReviewInsights'));
const QuestionHub = lazy(() => import('../views/QuestionHub'));
const QuestionRedo = lazy(() => import('../views/QuestionRedo'));
```

---

## 5. 缓存策略

### 5.1 HTTP 缓存

| 端点 | Cache-Control | 理由 |
|---|---|---|
| GET /review/items | `private, no-cache` | 数据频繁变化（SRS 推进） |
| GET /review/items/:id | `private, max-age=30` | 短缓存，30s 内再访无需重请求 |
| GET /review/insights/* | `private, max-age=300` | 数据变化慢（5 分钟缓存） |
| GET /review/weekly-summary | `private, max-age=3600` | 周粒度（1 小时缓存） |
| POST /cause-analysis | 不缓存 | 变更操作 |

### 5.2 前端 SWR 策略（TanStack Query）

| Query | staleTime | gcTime | refetchOnFocus |
|---|---|---|---|
| reviewItems | 30s | 5min | true |
| reviewItem (detail) | 1min | 10min | true |
| recentAnswers | 5min | 15min | false |
| insightsTrends | 5min | 30min | false |
| weeklySummary | 10min | 60min | false |
| causeAnalysis (cached) | 30min | 60min | false |

---

## 6. 单机部署约束（AGENTS H10）

| 约束 | 对 Review Phase 的影响 |
|---|---|
| **禁止 Docker** | 全部组件跑在 API 进程内 |
| **禁止 Redis** | 限流用进程内 dict + TTL；SRS 计算同步调用 |
| **禁止独立 Worker** | cron 用 APScheduler in-process；LLM 调用同步 await |
| **单数据库** | PostgreSQL（生产）/ SQLite（开发测试） |
| **无消息队列** | 跨 tab 写入全部同事务，无 async event bus |

### 6.1 性能影响评估

| 场景 | 风险 | 缓解 |
|---|---|---|
| LLM 调用阻塞 API 线程 | 中 | async await + 30s timeout + 并发限制 3 |
| cron 在 API 进程内 | 低 | 每周一次执行，聚合查询 < 2s |
| 限流内存占用 | 低 | sliding window per user，TTL 自动清理 |
| 500 items 列表查询 | 低 | 索引覆盖 + 分页（默认 page_size=20） |

---

## 7. 可观测性

### 7.1 结构化日志事件

| 事件名 | 触发 | 关键字段 |
|---|---|---|
| `review.item.created` | 任何 source_kind 创建行 | user_id, source_kind, question_id |
| `review.item.graduated` | SRS 毕业 | user_id, item_id, streak, days_since_created |
| `review.item.archived` | 归档 | user_id, item_id, reason |
| `review.item.restored` | 恢复 | user_id, item_id |
| `review.srs.advanced` | streak +1 | user_id, item_id, new_streak, next_review_at |
| `review.srs.regressed` | streak -1 | user_id, item_id, new_streak, next_review_at |
| `review.cause_analysis.requested` | 错因分析请求 | user_id, scope, question_id, cached |
| `review.cause_analysis.completed` | 分析完成 | user_id, scope, duration_ms, llm_call_id |
| `review.cause_analysis.failed` | 分析失败 | user_id, scope, error_type, duration_ms |
| `review.weekly.generated` | 周回顾笔记生成 | user_id, week, note_id |

### 7.2 关键 Metrics

| 指标 | 类型 | 告警阈值 |
|---|---|---|
| `review_items_total` | counter (by source_kind) | — |
| `review_graduations_total` | counter | — |
| `review_srs_advances_total` | counter | — |
| `review_cause_analysis_requests` | counter (by scope, cached) | — |
| `review_cause_analysis_duration_ms` | histogram | p95 > 10s 告警 |
| `review_cause_analysis_errors` | counter (by error_type) | > 5/min 告警 |
| `review_daily_quota_exhausted` | counter | > 10 users/day 预警 |
| `review_list_latency_ms` | histogram | p95 > 300ms 告警 |

---

## 8. 安全

| 维度 | 措施 |
|---|---|
| **CSRF** | 所有 mutation（POST/PATCH/DELETE）要求 CSRF token（沿用 Phase-Home 中间件） |
| **用户隔离** | 所有查询 WHERE user_id = current_user（不可能跨用户泄漏） |
| **数据越权** | PATCH /items/:id 校验 item.user_id == current_user；否则 403 |
| **LLM 输入清洁** | 发送给 LLM 的 prompt 不含用户 PII；仅包含题面 + 答案 + 解析 |
| **LLM 输出清洁** | 解析 LLM 返回的 JSON 后做 schema 校验；不直接 innerHTML 渲染 |
| **SQL 注入** | 全部用 SQLAlchemy ORM / parameterized queries（无 raw SQL） |
| **XSS** | 前端渲染 LLM 结果时用 React 默认转义；不用 dangerouslySetInnerHTML |
| **Rate limiting** | 见 §2，防止恶意刷 LLM 配额 |

---

## 9. 数据保留

| 数据 | 保留策略 |
|---|---|
| ReviewItemV2 | 永久保留（含 archived 行） |
| ReviewAttemptV2 | 永久保留（审计日志） |
| AiCauseAnalysisV2 | expires_at 后保留 90 天再物理删除（审计窗口） |
| LlmCallV2 (cause_analysis) | 永久保留（成本审计） |
| IdempotencyKeyV2 | 7 天 TTL 后自动清理（Phase-Home cron） |

---

## 10. 浏览器兼容性

| 浏览器 | 最低版本 | 备注 |
|---|---|---|
| Chrome | 90+ | 主要用户群 |
| Safari | 15+ | iOS 用户 |
| Firefox | 90+ | — |
| Edge | 90+ | Chromium 内核 |
| 微信内置浏览器 | — | 需测试 viewport + scroll |

---

## 11. 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| LLM 供应商宕机 | 中 | 错因分析不可用 | PR-R6 降级策略；不阻塞核心功能 |
| 用户复盘条目超 1000 | 低 | 列表查询变慢 | 分页 + 索引 + 前端虚拟滚动 |
| SRS 算法不适合公考场景 | 中 | 用户感知不到效果 | schema 预留 SM-2 升级路径 |
| 三卡聚合数据不足 | 高（新用户） | 空状态 | items < 5 时隐藏三卡 + 引导文案 |
| cron 与 API 争抢 CPU | 低 | 周一 02:00 响应变慢 | 聚合查询优化 + cron 执行窗口短 |
| 限流误伤正常用户 | 低 | 正常用户 < 20 次/天 | 阈值 20 远高于平均使用量（预期 3-5 次/天） |

---

## 引用矩阵

| 本文被引用 |
|---|
| [README.md](./README.md) §10 风险与回退 |
| [03-Backend-WU](./03-Backend-WU.md) 性能约束 |
| [04-Frontend-WU](./04-Frontend-WU.md) bundle 预算 |
| [11-Testing](./11-Testing.md) 性能 smoke 测试 |
