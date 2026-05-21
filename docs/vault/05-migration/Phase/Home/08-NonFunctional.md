# Phase-Home · 08 · Non-Functional Requirements

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **决策来源**：`00-Decisions.md` NF-* / Infra-Deploy-* 系列

---

## 1. 性能预算

### 1.1 前端 Web Vitals（NF-Perf-LCP / NF-Perf-INP）

| 指标 | 首页（已登录） | `/profile/learning` | 会话页 |
|---|---|---|---|
| LCP | ≤ 2.5s | ≤ 3.0s | ≤ 2.5s |
| FCP | ≤ 1.5s | ≤ 1.8s | ≤ 1.5s |
| INP | ≤ 200ms | ≤ 250ms | ≤ 100ms |
| CLS | ≤ 0.05 | ≤ 0.05 | ≤ 0.02 |
| TTFB | ≤ 600ms | ≤ 600ms | ≤ 600ms |

测量条件：
- Stage 1：本机 + Chromium DevTools "Slow 4G" + 4× CPU throttling
- Stage 2：CI 跑 Lighthouse + 上传 trends（详见 `09-Observability-Audit.md` §6）

阈值不达标 → CI 警告，不阻塞 merge；连续 3 PR 不达标 → 记 tech debt 任务。

### 1.2 Bundle 预算（NF-Bundle）

| 路由 | 初始 chunk gzip | 关键依赖 |
|---|---|---|
| `/`（Dashboard） | ≤ 250KB | React + react-router + tanstack-query + ui |
| `/profile/learning` | ≤ 180KB | + recharts（懒加载） |
| `/practice/sessions/:id` | ≤ 300KB | + answer-engine + editor |

calendar-engine 包：单独 chunk，首页路由懒加载（Section A 渲染时再加载）；预算 ≤ 80KB gzip（含 rrule.js）。

dnd-kit / recharts 强制懒加载（用 `lazy(() => import(...))`）。

构建后用 `vite-bundle-visualizer` 在 CI 输出报告，超出预算 fail（CI 必须）。

### 1.3 后端 latency 预算

| 端点 | p50 | p95 | p99 |
|---|---|---|---|
| GET /events?range=7d | 50ms | 150ms | 300ms |
| GET /events?range=90d（含 expand） | 100ms | 300ms | 600ms |
| GET /dashboard/today | 80ms | 200ms | 400ms |
| GET /dashboard/progress | 100ms | 300ms | 600ms |
| POST /events | 80ms | 200ms | 400ms |
| POST /plans/auto-generate（SSE 完整） | 8s | 25s | 45s |
| POST /recommendations/refresh | 3s | 10s | 20s |

**注**：LLM 端点上限大；超时见 `05-LLM-Module.md` §3 配置。

---

## 2. 安全与授权

### 2.1 鉴权

- 所有 `/api/v2/*` 端点强制 `Depends(get_current_user)`，未授权 401
- session token 过期触发 silent refresh（已存在）
- LLM 端点不接受未授权请求（即使 mock）

### 2.2 资源所属（详见 `03-Backend-WU.md` §1.2）

每个 mutation / read-by-id 必须 `assert_owner`，越权返回 404（不暴露存在性）。

### 2.3 输入校验

| 层 | 校验内容 |
|---|---|
| Pydantic schema | 类型 / 长度 / 范围 / enum |
| domain 层 | 业务规则（end > start / RRULE subset / 单 active plan / exam_date >= tomorrow） |
| sanitizer | 用户文本经 sanitize_user_input（详见 `05-LLM-Module.md` §6） |

### 2.4 密钥与机密

- `.env` 文件 git ignored
- LLM API key 走 SecretStr，不落日志
- audit_log 写入时把 LlmCallV2.request_payload 中的 api key 字段过滤掉（虽然 SDK 不会塞，仍做防御性 redact）

### 2.5 CSRF / CORS

- API 走 cookie session（已有）+ SameSite=Lax
- CORS 严格白名单（`apps/web` 域名）；Stage 2 多用户时严格 origin 检查
- SSE 端点同源检查

### 2.6 SQL 注入 / XSS

- 全 ORM 参数化查询
- 前端 `dangerouslySetInnerHTML` 在新代码中**禁用**；ESLint 规则强制
- 用户输入展示走 React 默认 escape

---

## 3. 限流（NF-RateLimit）

### 3.1 限流维度

| 类别 | 限制 | storage |
|---|---|---|
| LLM 端点（auto-generate / regenerate-range / refresh） | 10 req/min/user | Stage1 内存 / Stage2 Redis |
| events 范围查询 | 60 req/min/user | 同上 |
| events 写端点 | 120 req/min/user | 同上 |
| 其他 GET | 300 req/min/user | 同上 |

### 3.2 全局限流（防 DoS）

| 类别 | 限制 |
|---|---|
| 全局 LLM | 30 req/min（Stage 1 单机） |
| 全局所有端点 | 1000 req/min |

### 3.3 实现

`slowapi` + `RateLimitMiddleware`，命中限流：
- 写 audit_log（NF-Audit）
- 返回 429 + `Retry-After` header
- 前端 react-query mutation 错误处理 → toast "操作过于频繁，请稍后再试"

### 3.4 burst 设计

LLM 端点用 token bucket：突发 3 个，匀速 10/min；其他端点用 fixed window。

---

## 4. 幂等性（AI-8 + 通用）

### 4.1 幂等端点清单

| 端点 | 幂等键来源 |
|---|---|
| POST /plans/auto-generate | client `Idempotency-Key` header（UUIDv4） |
| POST /plans/events/regenerate-range | 同 |
| POST /recommendations/refresh | 同 |
| POST /plans/events（单创建） | 可选；前端默认带 |
| POST /plans/events/bulk-delete | 可选 |

### 4.2 实现

- 中间件 `IdempotencyMiddleware`（详见 `03-Backend-WU.md` §1.5）
- key + user_id + endpoint + sha256(body) → 命中缓存返回原响应
- 24h TTL（IdempotencyKeyV2 表）
- 命中时 response 加 `Idempotent-Replay: true` header

### 4.3 前端约定

```ts
// packages/api-client/src/idempotency.ts
export function createIdempotentRequest<T>(
  fn: (idemKey: string) => Promise<T>,
): { invoke: () => Promise<T>; key: string } {
  const key = crypto.randomUUID();
  return { invoke: () => fn(key), key };
}
```

react-query mutation 把 key 缓存在 closure，重试时复用同一 key。

---

## 5. 部署形态（Infra-Deploy-* / Infra-Cron）

### 5.1 Stage 1 单机

| 组件 | 形态 |
|---|---|
| API | uvicorn 单进程 + 4 worker |
| DB | PostgreSQL 14（生产）/ SQLite（开发） |
| Cache | 进程内 cachetools |
| Cron | APScheduler embedded（lifespan 启动） |
| 静态资源 | nginx 反代 apps/web 构建产物 |
| LLM | DeepSeek 官方（默认） |

部署：`scripts/deploy/deploy_stage1.sh`（git pull + alembic + restart uvicorn）

约束（AGENTS-H10）：
- 全场景禁 docker
- 永远本地 commit/push，不在 VPS 改源码

### 5.2 Stage 2 多用户

| 组件 | 切换 |
|---|---|
| API | gunicorn + 多 worker + nginx LB |
| DB | PostgreSQL 主从 |
| Cache | Redis |
| Cron | 独立 services/worker（APScheduler + SQLAlchemyJobStore + 单 worker 锁） |
| LLM | DeepSeek + 百炼 failover |
| Observability | OTel collector + Prometheus + Grafana |

切换原则：**业务代码不动，仅改 config + provider 实现**。所有跨 stage 接口走 ABC：

```python
# core/cache_provider.py
class CacheProvider(Protocol):
    async def get(self, key: str) -> Any | None: ...
    async def set(self, key: str, value: Any, ttl: int) -> None: ...
    async def delete(self, key: str) -> None: ...

# stage 1
class InProcessCacheProvider: ...

# stage 2
class RedisCacheProvider: ...
```

### 5.3 Cron 多 worker 互斥（Stage 2）

- APScheduler `SQLAlchemyJobStore` 自带 row lock；启动时检查 active worker 数 > 1 时报警
- 关键任务（plan_adjustor / snapshot writer）加业务级锁：写入前 `SELECT FOR UPDATE NOWAIT` user 行
- 失败的任务进 `cron_dlq` 表，每日告警

---

## 6. 离线 / 缓存（NF-Offline）

### 6.1 策略

| 操作 | 离线行为 |
|---|---|
| 读首页（events / progress / today / recommendations） | 走 react-query persistQueryClient（IndexedDB） |
| 写事件（CRUD） | **禁离线**（在线 fail 立即提示） |
| 答题 session | 已有方案（不在 Phase-Home 范围） |
| AI 生成 / 调整 | **禁离线** |

### 6.2 实现

```ts
// apps/web/src/main.tsx
import { persistQueryClient } from "@tanstack/react-query-persist-client";
persistQueryClient({
  queryClient,
  persister: createIDBPersister(),
  maxAge: 1000 * 60 * 60 * 24,  // 24h
  buster: BUILD_VERSION,         // 版本变更自动失效
});
```

OfflineBanner（已存在 layouts/OfflineBanner.tsx）：
- 离线时顶部 banner 显示"离线模式 / 数据可能过期"
- 写操作按钮 disabled

### 6.3 缓存策略

| 数据 | TTL（react-query staleTime） |
|---|---|
| events 当周 | 5 min |
| events 当月 | 10 min |
| dashboard/today | 1 min |
| dashboard/progress | 5 min |
| recommendations/today | 2 min |
| profile | 30 min |

cache invalidate 触发：mutation 成功后 + 跨 query invalidation rules。

---

## 7. 可访问性（NF-A11y）

详见 `04-Frontend-WU.md` §1.6。本节补充测试与硬约束。

### 7.1 自动化测试

每个 PR 跑 `axe-core` 扫描，违规 = 0 才能 merge：

```ts
// tests/a11y/dashboard-a11y.spec.ts
import { axe } from "vitest-axe";

it("Dashboard has no a11y violations", async () => {
  const { container } = render(<Dashboard />);
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
});
```

### 7.2 必须满足项

- 所有 interactive 元素 `tabIndex` 正确
- 拖拽必须有键盘等价（详见 `04-Frontend-WU.md` WU-F4.7）
- 颜色对比度 WCAG AA：用 token 设计时已保证；新组件不得写死 hex 色
- prefers-reduced-motion 时关 transitions / drag ghost

### 7.3 屏幕阅读器

- 日历每个 EventBlock：`aria-label="{title}, {start_time_zh} 至 {end_time_zh}, 状态 {status_zh}"`
- 推荐卡：`aria-label="{action_type_zh} 推荐：{title}"`
- AI 生成 dialog 进度：`aria-live="polite"` 区域更新进度文字

---

## 8. 浏览器 / 设备兼容

### 8.1 目标矩阵

| 浏览器 | 版本 |
|---|---|
| Chrome / Edge | 最近 2 个 stable |
| Safari（macOS） | 16+ |
| Safari（iOS） | 16+ |
| Firefox | 最近 2 个 stable |
| 微信内置（中国用户必测） | iOS Safari 16+ / Chromium 110+ |
| 钉钉 / 飞书内置 | Chromium 110+ |

### 8.2 不支持

- IE 11（已停用）
- Chrome / Safari < 16（< 2024）

### 8.3 viewport

- mobile：320-768px
- tablet：768-1024px
- desktop：1024+

5 tab 在 mobile/tablet 显示 TabBar，desktop 显示 RailMini。日历 Today 视图 mobile 优先；Week/Month 视图在 mobile 时简化为列表（详见 `04-Frontend-WU.md` WU-F4 各 view PR）。

---

## 9. i18n（NF-i18n）

仅中文。**不引入 i18n 抽象**：
- UI 文案走现有 `lib/ui-copy/` SSOT
- 不使用 `t("key")` 之类的 wrapper
- 日期格式用 `formatLocal(iso, "Asia/Shanghai", "yyyy年MM月dd日 HH:mm")`
- 数字格式用 `Intl.NumberFormat("zh-CN")`

未来扩展国际化：保留 `lib/ui-copy/` 文件结构，使其能轻易替换为 i18n 包。

---

## 10. 主题（NF-Theme）

详见 `04-Frontend-WU.md` §1.5。

### 10.1 暗色模式

- token-driven，不写死颜色
- `useThemeStore`（已存在）控制 `:root[data-theme="dark"]`
- 新 PR 必须在 light + dark 两个主题下 browser smoke 各一次

### 10.2 token 不补就不写死

新颜色 / 圆角 / 间距需求出现时：先 PR 加 token（packages/design-system/src/tokens.css）→ 再用。直接写死的 PR 一律退回。

---

## 11. 风险表（汇总）

| 风险 | 缓解 |
|---|---|
| LLM 长尾延迟（>20s） | timeout 60s + retry 1 + 失败兜底 + SSE 流式 |
| LLM 输出 JSON 不合法 | parse_with_fallback + retry + audit |
| Calendar 拖拽性能（大量事件） | view range ≤ 90d + Month "+N more" + 5 路 cap |
| 时区错误 | 全 UTC 存储 + IANA 校验 + DST 单测覆盖（虽然中国无 DST） |
| RRULE 边界 case | 18+ 单测 + parser fail-fast |
| AI 调整频繁吵用户 | ADJ-6 限流 + 用户可关 + dismiss 24h |
| DeepSeek/百炼 限流或停服 | provider failover（Stage 2）+ 引导手动模式（Stage 1） |
| Cron 任务漏跑 | failure 写 dlq + 每日告警 |
| 多用户切换破坏性变更 | 所有跨 stage 接口走 ABC，业务代码不动 |
| 用户输入注入 prompt | sanitize_user_input + lint 静态扫描 |
| 越权访问 | assert_owner + 404 不暴露存在性 + audit_log 反查 |
| 单点故障（单机部署） | 业务承诺 SLA 99% 单机；Stage 2 切高可用 |

---

## 12. 引用矩阵

| 本文档被引用 |
|---|
| `03-Backend-WU.md` §1.4 限流中间件 / §1.5 幂等中间件 |
| `04-Frontend-WU.md` §1.5 主题 / §1.6 a11y |
| `05-LLM-Module.md` §13 Stage 1→2 切换 |
| `09-Observability-Audit.md` 性能指标对接 |
| `10-Testing.md` a11y / perf 测试 |
