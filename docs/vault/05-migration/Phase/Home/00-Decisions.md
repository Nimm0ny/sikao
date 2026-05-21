# Phase-Home · 00 · Decisions

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

本文是 Phase-Home 范围内**全部决策的 SSOT**。任何后续 PR 与此文档冲突时以本文档为准。

---

## 0. 决策序列编号约定

| 前缀 | 域 |
|---|---|
| `D-` | 信息架构（Frontend-IA-V2 D 系列） |
| `H-Plan-` | 首页架构层级 |
| `Cal-` | 日历视图 |
| `Cust-` | 用户自定义计划 |
| `AI-` | AI 制定 |
| `ADJ-` | AI 调整提案 |
| `Rec-` | 今日推荐 |
| `Infra-` | 基础设施（cron / LLM / DB / 部署） |
| `NF-` | 非功能（性能 / 安全 / 可观测） |

---

## 1. IA 层（D 系列）

| # | 决策 | 拍板 | 依据 |
|---|---|---|---|
| D-Layer | Gate ④ 优先于 Main App ③ | 是 | 现有 OnboardingGate 行为保持 |
| D1 | 一级导航 = 5 tab（首页 / 练习 / 复盘 / 笔记 / 我的） | **5 tab，桌面 + 移动均不升 6** | 用户 2026-05-21 拍板 |
| D-Root-Route | `"/"` 双态：未登录看 marketing，已登录直接进入 Home Dashboard | **采用双态，不引入 `/home`** | 用户 2026-05-21 拍板 + A0 §8 |
| D7 | 答题/结果脱壳 | 是 | 全屏，隐藏 RailMini/TabBar |
| D12 | envelope 3 组件（GenericSection/SkeletonCard/EmptyCard） | 是 | 仅 stub 期占位用 |
| D14 | 空状态统一组件 | 是 | 全站共用一个 EmptyState |
| D15 | 脱壳路由 4 条 | 是 | session / result / onboarding / diagnosis |

### D1 修订说明（关键，影响下游）

原 H-Plan-6 决策"学情升 tab"作废。**学情、记录的归宿调整为**：

| 内容 | 路由 | 入口 |
|---|---|---|
| 详细学情（progress 全量数据 + 弱项雷达 + 诊断） | `/profile/learning` | 首页 Section B 的"查看详情" |
| 学习记录（每次 session 历史 + 筛选） | `/profile/records` | 首页 Section B 的"查看记录" + 我的 tab 的"学习记录"项 |

`/profile` 子页层级（在"我的"tab 内）：
- `/profile`（overview）
- `/profile/learning`（详细学情，本 plan 范围）
- `/profile/records`（学习记录，本 plan 范围）
- `/profile/settings`（账号绑定 / 通知开关 / AI 调整开关 / 推荐策略偏好等）

### D-Root-Route 修订说明（关键，影响路由壳）

- `"/"` 是 Home Phase 的**canonical 登录态首页路由**。
- 未登录用户访问 `"/"`：继续渲染 marketing/public landing。
- 已登录用户访问 `"/"`：直接渲染 Home Dashboard，不再跳 `/app`，也不新建 `/home` 过渡路由。
- 现有 `/app -> /dashboard` 语义属于 legacy；Home Phase 在 F7 路由收敛后移除这条旧首页语义。

---

## 2. 首页架构（H-Plan 系列）

| # | 决策 | 拍板 |
|---|---|---|
| H-Plan-1 | 学习计划视图 | 日历画廊（Today/Week/Month）+ F1+F3 融合（月历 + 锁考试日 + 多 target） |
| H-Plan-2 | 自定义计划 | IA 必画 + 完全实现 |
| H-Plan-3 | AI 制定/调整/推荐 | 完全实现（不走前端伪 AI） |
| H-Plan-4 | 进度数据层 | D-Full（summary + timeseries + weakness + plan slice + diagnosis） |
| H-Plan-5 | 计划/推荐/实绩边界 | P1-P6 六条规则（详见 `01-Boundary-Rules.md`） |
| H-Plan-6 | ~~详细学情/记录归宿~~ | **已作废**，详细学情进 `/profile/learning`，记录进 `/profile/records`（见 D1 修订） |
| H-Plan-7 | 首页 Section B 渲染深度 | **新决策**：首页只展现 6 张数值卡 + 1 个趋势 sparkline + 1 个弱项 top3 mini list；雷达 / 诊断 / 全量切片均在 `/profile/learning` |

---

## 3. 日历子决策（Cal 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Cal-1 | 时间粒度 | 严格小时（拖拽 15 分钟吸附） |
| Cal-2 | Today 视图朝向 | 纵向 |
| Cal-3 | 跨多日事件 | 支持（Week/Month 视图按"起始日 + 跨日条带"展开，详见 `07-Calendar-Engine.md` §3.4） |
| Cal-4 | 重复事件 | 支持 RRULE（RFC 5545 子集，详见 `07-Calendar-Engine.md` §3.2） |
| Cal-5 | 事件 → session 绑定 | 是 |
| Cal-6 | 倒数考试日显示 | Month 视图右上角 + Today/Week 视图顶部 chip |
| Cal-7 | 拖拽调整 | 支持（含跨日拖拽） |
| Cal-8 | 多目标支持 | 是（事件加 target_id；视图按 target 颜色编码） |
| Cal-9 | DST 处理 | **新决策**：用户使用 `Asia/Shanghai`（无 DST），但事件 timezone 字段必填且按 IANA tz 处理；引擎层不做 DST 跨越特殊处理（中国用户场景），但保留扩展点 |
| Cal-10 | 全天事件 | **新决策**：不支持独立"全天事件"概念；想做全天就建一个 `00:00 - 23:59` 的事件（视觉上特殊渲染） |
| Cal-11 | 事件重叠视觉布局 | **新决策**：同时段并列布局（n 路），算法见 `07-Calendar-Engine.md` §3.5 |
| Cal-12 | 月历"每天最多显示" | **新决策**：每日最多显示 3 个事件块 + "+N more" 按钮，点开弹日详情 |

---

## 4. 自定义计划子决策（Cust 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Cust-1 | 创建方式 | 拖拽空白格 + "+" 按钮 双支持 |
| Cust-2 | 编辑方式 | 拖拽 + 拉伸 + 点击编辑面板 |
| Cust-3 | 重复事件编辑 scope | 仅此次 / 后续所有 / 整个序列 3 选 1（编辑 + 删除均适用） |
| Cust-4 | 时间冲突 | 警告但允许 |
| Cust-5 | 批量重置 | 清空本周 / 全部 / 重新让 AI 生成 三个动作 |
| Cust-6 | AI/用户事件混合 | 通过 `source` 字段区分，UI 加 chip 标记 |
| Cust-7 | "局部重生成"圈选 UI | **新决策**：在 Week 视图按住 shift 拖框选连续日期段（≥1 天 ≤14 天），右键菜单出"AI 重新生成此段" |
| Cust-8 | 软删除 | **新决策**：事件删除走软删（写 `deleted_at`），列表查询默认过滤；用户可在"我的 → 学习记录 → 已删除事件"恢复；30 天后 cron 物理清除 |

---

## 5. AI 制定子决策（AI 系列）

| # | 决策 | 拍板 |
|---|---|---|
| AI-1 | 触发位置 | onboarding + 首页常驻按钮 + 计划为空状态引导 三处 |
| AI-2 | 用户输入参数 | 完整表单（考试日 / 每日时长 / 起点 / 重点科目 / 风格） |
| AI-3 | 生成范围 | 锁定到考试日（整段） |
| AI-4 | 生成后可改性 | 与手动事件一样可改 |
| AI-5 | AI 服务失败兜底 | 重试 1 次 + 报错引导手动 |
| AI-6 | 局部重生成 | 圈选某段 → regenerate range（UI 见 Cust-7） |
| AI-7 | 流式输出 | **新决策**：plan_generate 与 plan_adjust 走 SSE 流式（事件级 yield）；recommend_today 走非流式（payload 小） |
| AI-8 | 幂等 | **新决策**：所有 LLM 调用必须带 `Idempotency-Key`（前端 UUID）；后端缓存 (key + user_id) → 24h；防止用户连点烧 token |

---

## 6. AI 调整子决策（ADJ 系列）

| # | 决策 | 拍板 |
|---|---|---|
| ADJ-1 | 触发时机 | 凌晨 cron + 登录检查 + 跳过事件实时 |
| ADJ-2 | 通知形式 | Banner（不打断当前操作） |
| ADJ-3 | 调整范围 | 仅未来事件 |
| ADJ-4 | 用户可关 | 是（profile_v2.info.ai_adjust_enabled） |
| ADJ-5 | 调整原因可见 | 是 |
| ADJ-6 | 限流 | **新决策**：每日最多 1 次 banner；当日已被用户 reject 的方案，24h 内不再生成同类提案 |

---

## 7. 今日推荐子决策（Rec 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Rec-1 | 数据源 | 全数据源（records + review.items + WeaknessSnapshot + 计划进度 + 实时 session） |
| Rec-2 | 输出形式 | 2-3 卡候选 |
| Rec-3 | 推荐卡内容 | 标题 + 原因 + 估时 + 动作类型（复盘/继续/休息）+ CTA |
| Rec-4 | 接受效果 | 用户选（默认进 session，次要"加入计划"） |
| Rec-5 | 拒绝交互 | 收集反馈（用于后续 fine-tune） |
| Rec-6 | 无数据时 | "做完第一次练习后开启"等待状态 |
| Rec-7 | 推荐刷新 | 自动 + 用户主动"换一批" |
| Rec-8 | 去重 | **新决策**：同一 review item 在 7 天内不重复推荐；同一类型动作（如"复盘逻辑判断"）24h 内不重复推荐 |
| Rec-9 | accept→session 时的 link | **新决策**：D-Link-Session 扩展 = 推荐进 session 时也写 `linked_recommendation_id`，便于追踪 accept 转化率 |

---

## 8. 基础设施决策（Infra 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Infra-Cron | Cron runner | APScheduler 嵌 FastAPI lifespan；单机部署用 MemoryJobStore；多用户阶段切 SQLAlchemyJobStore + 单 worker 锁（详见 `08-NonFunctional.md` §5） |
| Infra-LLM | LLM Provider | DeepSeek 官方 + 阿里百炼平台双支持（OpenAI 兼容接口）；详见 `05-LLM-Module.md` |
| Infra-Prompt-Versioning | prompt 版本管理 | git 内文件，禁止 inline string；Prompt 文件必含 `PROMPT_VERSION` 常量；版本记入 audit 表 |
| Infra-Plan-must-do | `/today/must-do` 端点 | **去除**（用 source 字段区分即可） |
| Infra-DailyPlan-drop | DailyPlanV2/WeeklyPlanV2 | drop table（无真实数据，零迁移） |
| Infra-Profile-Bind | BindEmail/Phone/Complete | 留给 `/profile/settings` plan，不在本 plan 范围 |
| Infra-Records-API | 学习记录 canonical API | **`GET /api/v2/profile/records` 为唯一 canonical 端点；`/api/v2/dashboard/records` 仅临时 shim，保留到 `B9.5` 收口前移除** |
| Infra-Rec-Policy | 复盘/继续/休息阈值表 | 详见 `01-Boundary-Rules.md` §2 |
| Infra-Link-Session | session 绑定时机 | 用户从计划事件 CTA 进入 → `linked_plan_event_id`；从推荐 CTA 进入 → `linked_recommendation_id`（Rec-9） |
| Infra-SoftDelete | 软删除 | events 与 plans 全部走软删；session 与 recommendation 不软删（hard delete + audit） |
| Infra-PII | 用户输入敏感词 | 用户输入会拼进 prompt 的字段（计划备注 / 推荐拒绝原因）必须经 `sanitize_user_input()` 过滤注入 token（详见 `05-LLM-Module.md` §6） |

---

## 9. 部署决策

| # | 决策 | 拍板 |
|---|---|---|
| Infra-Deploy-Stage | 部署阶段 | **Stage 1 单机自部署**（当前 + 半年内）；**Stage 2 多用户 SaaS**（半年后） |
| Infra-Deploy-DB | 数据库 | Stage 1: SQLite（开发）+ PostgreSQL（生产单机）；Stage 2: PostgreSQL + 读写分离 |
| Infra-Deploy-Worker | 后台任务 | Stage 1: 单进程 APScheduler；Stage 2: 切独立 services/worker |
| Infra-Deploy-Cache | 缓存 | Stage 1: 进程内 LRU + DB；Stage 2: Redis |
| Infra-No-Docker | 容器 | 全场景禁 docker（沿用 AGENTS-H10） |

> 设计原则：本 plan 全部代码在 Stage 1 单机模式下可跑；切 Stage 2 时**只动配置不动业务代码**（cache / job store / lock 实现走 provider 抽象）。

---

## 10. 非功能需求决策（NF 系列，新增）

| # | 决策 | 拍板 |
|---|---|---|
| NF-Perf-LCP | 首页 LCP 预算 | ≤ 2.5s（首次加载，4G 等效） |
| NF-Perf-INP | 首页 INP | ≤ 200ms |
| NF-Bundle | 首页路由初始 bundle | ≤ 250KB gzip（不含 calendar-engine 与 dnd-kit，按需懒加载） |
| NF-A11y | 可访问性 | 日历键盘可操作（方向键移动焦点、回车编辑、Delete 删除）；contrast 满足 WCAG AA；详见 `04-Frontend-WU.md` §A11y |
| NF-i18n | 国际化 | 仅中文，不引入 i18n 抽象层；UI 文案走现有 `lib/ui-copy/` SSOT |
| NF-Theme | 主题 | tokens.css SSOT；新组件默认支持暗色（用 token 不写死颜色） |
| NF-Audit | 审计 | LLM 输入输出 + plan/event 变更 + adjustment 决策 全量入 audit 表（详见 `09-Observability-Audit.md`） |
| NF-Observability | 可观测 | 后端 OTel（Stage 1 落本地 file exporter，Stage 2 接 collector）；前端 web-vitals + analytics events |
| NF-RateLimit | 限流 | LLM 端点：每用户 10 req/min；events bulk 端点：每用户 60 req/min；详见 `08-NonFunctional.md` §3 |
| NF-Offline | 离线 | events CRUD 不支持离线（必须在线）；首页只读视图支持离线缓存（react-query persistQueryClient）；详见 `08-NonFunctional.md` §6 |

---

## 11. Phase-Home 范围明确

### 11.1 在范围内

- 首页 `/` 三个 Section（A 学习计划 / B 学习进度精简版 / C 今日推荐）
- `/profile/learning`（详细学情钻取页，新建）
- `/profile/records`（学习记录子页，新建）
- AppShell 5 tab 不变（核对桌面 RailMini + 移动 TabBar 与 5 tab 一致）
- OnboardingGate 接 AiPlanGenerateDialog
- 后端：plans / recommendations / progress 真实化 / planning 重写 / profile 扩展 / LLM 模块 / cron
- 数据：drop DailyPlanV2/WeeklyPlanV2，建 PlanV2/PlanEventV2/PlanAdjustmentV2/RecommendationV2/RecommendationFeedbackV2

### 11.2 不在范围内（明确推出）

- 申论批改 module（V2 EssaySubmission/EssayReport 模型已建，路由暂不暴露）
- 移动端原生 app（apps/mobile / apps/tablet）的特殊适配（响应式 web 已涵盖）
- BindEmail / BindPhone / CompleteProfile 相关
- Onboarding 完整 view 改造（仅接 AI 制定 dialog）
- DiagnosisResult view 改造
- LLM fine-tune
- 用户可调推荐策略阈值 UI（数据模型预留字段，但 UI 推后）

---

## 12. 决策变更流程

修改任何决策必须：
1. 在本文档对应行写 `~~删除线~~` + 新决策行 + 拍板日期
2. 同步更新所有引用该决策的子文档
3. 若已开始实现，必须在 PR description 标注"BREAKING DECISION CHANGE: D-X"
4. 若决策回退（accepted → rejected），必须保留历史记录便于审计

---

## 13. 引用矩阵

| 决策 | 被以下文档使用 |
|---|---|
| D1 / D-Root-Route / H-Plan-* | `04-Frontend-WU.md`（路由 / AppShell / Section 划分） |
| Cal-* | `07-Calendar-Engine.md` / `04-Frontend-WU.md` WU-F4 |
| Cust-* | `04-Frontend-WU.md` WU-F4 / `02-Data-Model.md` PlanEventV2 |
| AI-* / ADJ-* / Rec-* | `05-LLM-Module.md` / `06-LLM-Prompts.md` / `03-Backend-WU.md` WU-B3/B7 |
| Infra-Cron / Infra-Deploy-* / Infra-Records-API | `03-Backend-WU.md` / `08-NonFunctional.md` / `10-Testing.md` |
| NF-* | `08-NonFunctional.md` 全文 |
| Infra-PII / Infra-Prompt-Versioning | `05-LLM-Module.md` §6 / `09-Observability-Audit.md` |
