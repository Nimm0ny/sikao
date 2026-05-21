# Phase-Practice · 08 · Non-Functional Requirements

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **决策来源**：`00-Decisions.md` Infra-* / NF-* 系列；继承 [Phase-Home 08-NonFunctional](../Home/08-NonFunctional.md)

---

## 1. 性能预算

### 1.1 前端 Web Vitals

| 指标 | `/practice` | `/practice/sessions/:id` | `/practice/sessions/:id/grading` | `/practice/ai-questions/generating` |
|---|---|---|---|---|
| LCP | ≤ 2.5s | ≤ 2.5s | ≤ 3.0s | ≤ 1.5s |
| FCP | ≤ 1.5s | ≤ 1.5s | ≤ 1.8s | ≤ 1.0s |
| INP | ≤ 200ms | ≤ 100ms | ≤ 200ms | ≤ 100ms |
| CLS | ≤ 0.05 | ≤ 0.02 | ≤ 0.05 | ≤ 0.02 |

测量条件继承 Phase-Home。等待页 INP 严格控制（动画不能卡）。

### 1.2 Bundle 预算（NF-Bundle）

| 路由 | 初始 chunk gzip | 关键依赖 |
|---|---|---|
| `/practice` | ≤ 280KB | + recharts（懒加载） |
| `/practice/sessions/:id` | ≤ 320KB | + answer-engine + editor |
| `/practice/sessions/:id/grading` | ≤ 280KB | recharts 懒加载 |
| `/practice/ai-questions/generating` | ≤ 80KB | 极简动画页 |
| `/practice/questions/:id` | ≤ 200KB | 题目详情 + 笔记 |

CI 跑 `vite-bundle-visualizer` 输出报告。

### 1.3 后端 latency 预算

| 端点 | p50 | p95 | p99 |
|---|---|---|---|
| GET /practice/center | 60ms | 150ms | 300ms |
| GET /practice/{xingce|essay}/categories | 100ms | 250ms | 500ms |
| GET /practice/{xingce|essay}/papers?... | 80ms | 200ms | 400ms |
| GET /practice/stats?type= | 50ms | 150ms | 300ms |
| GET /practice/stats/realtime | 200ms | 600ms | 1.2s |
| GET /practice/stats/percentile | 30ms | 80ms | 150ms |
| GET /practice/stats/cross | 250ms | 700ms | 1.5s |
| GET /practice/favorites?... | 50ms | 150ms | 300ms |
| GET /practice/flags?... | 50ms | 150ms | 300ms |
| POST /practice/sessions（含 mode dispatch） | 100ms | 300ms | 600ms |
| POST /practice/sessions（mode=ai_generated 含 LLM） | **12s** | **25s** | **45s** |
| POST /practice/sessions/:id/answers/:aid/flag | 50ms | 120ms | 250ms |
| POST /practice/sessions/:id/answers/:aid/view-solution | 30ms | 80ms | 150ms |
| POST /practice/ai-questions/generate | 同 mode=ai_generated 路径 | | |
| GET /practice/daily?type= | 60ms | 200ms | 500ms |
| POST /practice/daily/:id/start | 80ms | 200ms | 400ms |
| POST /practice/essay/submissions/:id/grade（异步触发立即返回） | 80ms | 200ms | 400ms |
| GET /practice/essay/submissions/:id/grading-status | 30ms | 80ms | 150ms |
| 后台批改任务（不在 HTTP latency 内） | 30s | 60s | 90s |
| GET /practice/essay/questions/:id/reference-answers | 60ms | 150ms | 300ms |

### 1.4 数据库 query 性能

关键 query 必须用 EXPLAIN 验证：

- `query_not_done` / `query_already_done`（pool query）：用 `(category_l1, category_l2, source, is_active)` 索引
- `practice_stats_snapshot` 读取：UNIQUE 主索引
- favorites / flags 列表查询：`(user_id, created_at)` 索引

慢查询监控：> 500ms 自动写 slow_query_log。

---

## 2. 安全与限流

### 2.1 鉴权

继承 Phase-Home：
- 所有端点 `Depends(get_current_user)`
- 资源所属校验（assert_owner）
- 越权响应 404（不泄漏存在性）

Tab 2 特殊鉴权：
- 题级笔记：仅创建者读 / 写 / 删
- AI 题反馈：仅自己反馈，不能代他人反馈
- 范文反馈：同上

### 2.2 限流（NF-RateLimit）

详见 [03-Backend-WU §1.4](./03-Backend-WU.md#14-限流)。

| 端点 | 限流 |
|---|---|
| `POST /ai-questions/generate` | **5 req/min + 30 req/day** 每用户（成本控制） |
| `POST /essay/submissions/:id/grade` | **5 req/day** 每用户 |
| `POST /essay/reference-answers/generate` | **10 req/day** 每用户 |
| `POST /sessions` 创建 | 30 req/min 每用户 |
| `POST /sessions/:id/answers/:aid/flag` | 60 req/min |
| `POST /favorites` / `POST /flags` | 60 req/min |
| `GET /stats/*` | 120 req/min |
| 范文 `like / favorite / report` | 60 req/min |

限流命中：
- 返回 429 + `Retry-After` header
- 写入 audit_log
- 前端展示 toast 提示具体剩余时间

### 2.3 输入清洗（Infra-PII）

继承 Phase-Home `sanitizer.py`：
- 申论答案、笔记内容：清除可能的 prompt injection 标记（"[SYSTEM]"、"\\n\\n[ASSISTANT]" 等）
- 用户反馈 note：长度限制 + HTML 转义
- 题目反馈 reason：枚举校验（不接受自由文本）

### 2.4 PR2 source 字段保护

详见 [02-Data-Model §5.1](./02-Data-Model.md#51-pr2-source-immutable-trigger)。任何尝试 UPDATE source 的请求被 trigger 拦截。

---

## 3. AI 成本控制（关键）

### 3.1 单次 LLM 调用预估成本

基于 DeepSeek 价格（输入 $0.14/1M tokens / 输出 $0.28/1M tokens）：

| purpose | 输入 tokens | 输出 tokens | 单次成本 |
|---|---|---|---|
| question_generation | ~3000 | ~2500 | $0.001 |
| question_audit | ~800 | ~150 | $0.0001 |
| essay_grading | ~5000 | ~1500 | $0.001 |
| reference_generation | ~3000 | ~1500 | $0.0008 |

每用户每日满额配额成本估算：
- AI 出题：30 次 × $0.001 = $0.03
- 申论批改：5 次 × $0.001 = $0.005
- 范文生成：10 次 × $0.0008 = $0.008
- 自审：约 30 题/次 × 30 次 × $0.0001 = $0.09
- **单用户峰值约 $0.14/天**

按 100 活跃用户峰值：~$14/天。

### 3.2 全局成本预算

详见 [05-LLM-Module §4.2](./05-LLM-Module.md#42-全局成本上限)。Stage 1 阈值 $50/天。

### 3.3 缓存策略减少调用

- question_audit 缓存 24h（content_hash 命中）
- reference_generation 缓存 7d（question_id 命中）
- 详见 [05-LLM-Module §6](./05-LLM-Module.md#6-缓存策略)

### 3.4 池子优先减少新生成

详见 [07-AI-Question-Engine §3](./07-AI-Question-Engine.md#3-三段退化逻辑细节)。理论上随 AI 题积累，第三步触发率会降低。

---

## 4. 数据完整性

### 4.1 重要约束

- QuestionV2.source immutable（DB trigger）
- QuestionFlagV2 active flag UNIQUE per (user_id, question_id)
- QuestionFavoriteV2 UNIQUE (user_id, question_id)
- DailyPracticeV2 UNIQUE (user_id, date, type)
- EssayReferenceFeedbackV2 UNIQUE (reference_id, user_id, action)

### 4.2 软删除策略

- NoteV2.deleted_at（题级笔记软删，30 天后物理清理）
- 不软删：QuestionFavoriteV2 / QuestionFlagV2（直接 hard delete）
- QuestionFlagV2 有 resolved_at 而非 deleted_at（已解决保留历史）

### 4.3 数据回填一致性

cron `recompute_question_accuracy` 每日重算 historical_accuracy / answer_count，确保不偏差。

---

## 5. 可用性与降级

### 5.1 LLM 服务故障降级

| 故障 | 降级方案 |
|---|---|
| LLM provider 全失败 | AI 出题路径走 503，引导切真题；申论批改进入 failed 状态可重试 |
| LLM 限流 | 同上，加上提示具体重试时间 |
| LLM 全局预算耗尽 | 全部 LLM 端点 503，前端显示"今日 AI 服务额度已满" |
| LLM 调用慢（>30s timeout） | 前端等待页超时引导切真题 |

### 5.2 数据库故障降级

继承 Phase-Home 整体降级（read replica fallback / write retry）。

### 5.3 缓存故障降级

进程内 LRU + DB 二级缓存全部失败时，直接走 LLM（slower but works）。

---

## 6. 部署形态

继承 Phase-Home Infra-Deploy-Stage 决策：
- Stage 1 单机：APScheduler + 进程内缓存
- Stage 2 多用户：Celery + Redis + OTel collector

Tab 2 不引入新的部署形态决策。

---

## 7. 浏览器兼容

继承 Phase-Home：
- Chrome ≥ 110, Edge ≥ 110, Firefox ≥ 110, Safari ≥ 16
- iOS Safari ≥ 16, Android Chrome ≥ 110

Tab 2 特殊点：
- 双滑块组件兼容性（`@radix-ui/react-slider` 全支持）
- 申论 textarea 大段输入性能（避免 onChange 重渲染）

---

## 8. a11y（继承 + 本 Phase 强调）

axe-core 0 violation 是硬约束。Tab 2 重点：

- 双滑块：keyboard 可达
- AI 等待页：aria-live="polite"
- 申论批改 polling：成功 polite，失败 assertive
- 答题节奏切换：明确 aria-pressed 状态
- 解析锁定状态：清晰 ARIA label "解析将在提交后解锁"
- 题型 chip / 难度 badge：colorblind-safe + 文字标签

---

## 9. 国际化（i18n）

继承 Phase-Home：当前仅中文，但所有文案走 i18n key（`packages/lib/ui-copy/`）。

Tab 2 新增 ui-copy 命名空间：
- `practice.center.*`
- `practice.session.*`
- `practice.stats.*`
- `practice.ai_questions.*`
- `practice.essay.*`
- `practice.daily.*`

每个文案对应中文 + 英文 key（虽然当前只渲染中文）。

---

## 10. 黑暗模式

继承 Phase-Home：所有组件适配亮 / 暗双主题。

Tab 2 重点：
- 答题界面适配（重要：长时间使用，暗色减少眼疲劳）
- 题目卡片选项的颜色对比度（WCAG AAA）
- 申论编辑器 textarea 暗色

---

## 11. 风险表汇总

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| AI 出题 LLM 自审误判（漏放劣质题） | 中 | 中 | 用户反馈层兜底；人工抽查每周 sample 10 道 |
| AI 出题同步等待 > 15s 用户流失 | 高 | 中 | 进度提示分阶段（aria-live）；超时 30s 报错引导 |
| 申论批改异步通知错过 | 中 | 中 | 提供 polling endpoint；用户回 result 页主动刷新 |
| 范文生成质量低污染共享库 | 中 | 中 | status=draft 默认不展示；自审 + 用户反馈双层 |
| 真题 import 失败 / 数据脏 | 中 | 高（无题可练） | dry-run + 字段校验 + content_hash 去重 |
| 池子 + LLM 都失败用户卡住 | 低 | 高 | 必须返回明确错误 + 一键切真题 |
| 大量用户同时 AI 出题 LLM 限流 | 中 | 中 | 用户级限流 + 全局预算监控 |
| stats snapshot 与实时聚合不一致 | 低 | 低 | 02:00 cron 兜底重算；实时聚合优先 |
| 整组模式被前端绕过严格闭卷 | 低 | 高（作弊嫌疑） | 后端 view-solution 端点强校验 + 监控 |
| 题级笔记导致 Tab 4 列表过长 | 低 | 低 | Tab 4 默认按"独立笔记"过滤 |
| LLM 全局成本失控 | 中 | 高 | cost_tracker 监控 + 阈值熔断 |
| AI 题积累过快导致存储成本 | 低 | 低 | cleanup cron 自动下线 + 6 月归档老数据 |
| 申论 OCR 手写需求（远期） | - | - | 不在本 Phase 范围 |
| 移动端 4-tab 适配 | - | - | 不在本 Phase 范围 |

---

## 12. 关联文档

- [Phase-Home 08-NonFunctional](../Home/08-NonFunctional.md) - 通用 NF 要求
- [03-Backend-WU §1.3 - §1.5](./03-Backend-WU.md) - 错误码 / 限流 / 幂等
- [05-LLM-Module §4](./05-LLM-Module.md#4-配额与限流quotas) - LLM 配额
- [09-Observability-Audit](./09-Observability-Audit.md) - metrics / audit
