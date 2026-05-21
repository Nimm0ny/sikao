# Phase-Practice · 00 · Decisions

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

本文是 Phase-Practice 范围内**全部决策的 SSOT**。任何后续 PR 与此文档冲突时以本文档为准（除非被 [A0-Codebase-Reality-Check.md](./A0-Codebase-Reality-Check.md) §11 修订）。

---

## 0. 决策序列编号约定

| 前缀 | 域 |
|---|---|
| `Q-` | Tab 2 IA 大问题（题源 / 自定义 / 智能等） |
| `D-Q` | Tab 2 IA 二级深问题（讨论时编号 D-Q1 ~ D-Q17） |
| `Cust-` | 自定义刷题字段 |
| `AI-G-` | AI 出题（generation） |
| `Pace-` | 答题节奏 |
| `Essay-` | 申论批改与范文 |
| `Stat-` | 历史成绩聚合 |
| `Daily-` | 每日一练 |
| `Note-` | 题级笔记联动 |
| `Fav-` / `Flag-` | 收藏 / 标记 |
| `Infra-` | 基础设施（cron / LLM / 限流 / 审计） |
| `NF-` | 非功能（性能 / 安全 / 可观测） |

---

## 1. Tab 2 IA 大问题（Q 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Q-Source | 题源种类 | **真题 + AI 出题**（取消独立"模拟题"概念，AI 题与真题同表用 source 区分） |
| Q1 | 出题方式 | 规则引擎（自定义刷题）+ AI 智能出题（按题型&难度） |
| Q2 | 分类层级 | **二级分类**（一级模块 + 二级子模块） |
| Q3 | AI 题入库策略 | **AI 题与真题同表 QuestionV2**（用 `source` 字段区分） |
| Q4 | 申论批改形式 | AI 批改 + 范文对比（人工批改远期） |
| Q5-Fav | 收藏单题 | 是 |
| Q5-Note | 加笔记 | 是，与 Tab 4 笔记打通（NoteV2.linked_question_id） |
| Q5-Flag | 标记不确定 | 是，分基础（本次 session 内）+ 拓展（持久化进复盘队列） |
| Q6 | 统计粒度 | **全部**：模块级 / 子模块级 / 题型+难度交叉 / 与平台平均对比 / 时间维度 |
| Q7 | 每日一练 | 要做，与首页推荐边界清晰（见 Daily-1） |

---

## 2. IA 深问题（D-Q 系列）

| # | 决策 | 拍板 |
|---|---|---|
| D-Q1 | AI 出题方式 | **改编**（LLM 基于真题改编，不凭空生成，避免答案错） |
| D-Q2.1 | AI 题 per-user vs 全局 | 全局共享（同表入库，所有用户可做） |
| D-Q2.2 | 审核机制 | 用户反馈打分（点赞 / 举报 / 自动下线）|
| D-Q2.3 | 防重复 | 是（同题改编结果用 content_hash 去重） |
| D-Q3 | snapshot vs 实时聚合 | **三层都要**：snapshot（页面加载用）+ 实时聚合（详情页用）+ 百分位（跨用户对比，周更新） |
| D-Q4 | 范文来源 | 官方人工补充优先 + AI 生成 fallback（点赞/收藏达阈值后入库共享） |
| D-Q5 | 题级笔记 | 与 Tab 4 笔记打通（NoteV2.linked_question_id） |
| D-Q6 | 每日一练 vs 今日推荐边界 | 见 Daily-1 |
| D-Q7 | 题源类型 | **真题 / AI 出题** 两种（不要"模拟题"独立模式） |
| D-Q8 | AI 出题等待方式 | **同步等待**（10-15s 转圈，简单可靠；30s 超时） |
| D-Q9 | 模拟题质量分机制 | **D 双层**：① 生成时 LLM 自审 ② 上线后用户反馈打分 |
| D-Q10 | 取消"背题模式" | 完全删除；改"答题节奏"= 逐题 / 整组 |
| D-Q11 | snapshot 更新调度 | **02:00 全量 cron + session.submit 增量 + 周一 03:00 重算百分位** |
| D-Q12 | "标记不确定"语义 | 基础（本次 session 内 PracticeSessionAnswerV2.flagged）+ 拓展（持久化 QuestionFlagV2 + 自动入复盘队列） |
| D-Q13 | AI 出题"池子优先 + 退化"逻辑 | **三段式**：① 池子里筛用户没做过的 → ② 不够则池子里筛已做过的 → ③ 仍不够则调 LLM 实时生成 |
| D-Q14 | 真题数据导入 | 按 V2 重构现状制作 import 脚本；用户后续提供数据格式 |
| D-Q15 | 整组模式中途看解析 | **严格闭卷**（前后端双校验） |
| D-Q16 | 申论批改时机 | **B 异步后台批改**（提交立即返回 result 页 pending → cron 写 EssayReportV2 → banner 通知） |
| D-Q17 | 题级笔记可见性 | **仅自己可见** + Tab 4 笔记列表点击题级笔记可一键跳到对应题 |

---

## 3. 自定义刷题（Cust 系列）

截图功能完整实现，所有字段如下。

| 字段 | 选项 | 默认 |
|---|---|---|
| Cust-Mode | 真题 / AI 出题 | 真题 |
| Cust-Year | 不限 / 近 3 年 / 近 5 年 / 近 10 年 | 近 3 年 |
| Cust-Difficulty | 双滑块（0%~100% 历史正确率区间） | [0.0, 1.0]（不限） |
| Cust-Count | 5 / 10 / 15 / 20 / 30 | 10 |
| Cust-Pace | 逐题 / 整组 | **整组** |
| Cust-ExcludeDone | bool | true |
| Cust-OnlyWrong | bool | false |
| Cust-CategoryFilter | 一级 / 二级分类多选（可选） | 不限 |

⚠️ 完全删除「背题模式」选项，用「答题节奏」概念替代（D-Q10）。

---

## 4. AI 出题（AI-G 系列）

| # | 决策 | 拍板 |
|---|---|---|
| AI-G-1 | 出题方式 | LLM 改编真题（不凭空生成） |
| AI-G-2 | 等待方式 | 同步等待（D-Q8） |
| AI-G-3 | 退化逻辑 | 三段式（D-Q13），详见 [07-AI-Question-Engine §3](./07-AI-Question-Engine.md#3-三段退化逻辑) |
| AI-G-4 | 自审 | 生成时 LLM 自审一次（"答案对吗 / 符合公考规范吗"） |
| AI-G-5 | 用户反馈 | 答完后可点赞 / 举报，进入 quality_score 聚合 |
| AI-G-6 | 自动下线 | quality_score < 阈值 / report_count > 阈值 → is_active=false（不再出现在新出题） |
| AI-G-7 | 失败兜底 | 自审失败重试 1 次 → 仍失败返回 503 → 前端引导切真题 |
| AI-G-8 | 限流 | 每用户每日 N 次 LLM 实时生成（详见 [08-NonFunctional §2](./08-NonFunctional.md#2-安全与限流)） |
| AI-G-9 | 幂等 | `POST /api/v2/practice/ai-questions/generate` 必带 `Idempotency-Key`（复用 Phase-Home IdempotencyKeyV2） |
| AI-G-10 | 防重复 | 改编后 content_hash 去重；命中已存在题用现有 ID（不重复入库） |

---

## 5. 答题节奏（Pace 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Pace-1 | 节奏选项 | 逐题 / 整组（**默认整组**，D-Q10） |
| Pace-2 | 整组模式严格闭卷 | 全部答完前不能看解析；标记不确定也不解锁；已答题不能回看正确答案（D-Q15） |
| Pace-3 | 已答题回看自己的答案 | 两种节奏都允许 |
| Pace-4 | 中途加笔记 | 两种节奏都允许（但整组模式下笔记界面不显示答案） |
| Pace-5 | 中途收藏 | 两种节奏都允许 |
| Pace-6 | 中途暂停 | 两种节奏都允许 |
| Pace-7 | 后端校验 | `view-solution` 端点严格校验 `session.practice_mode`：`full_set` 时 403 拒绝 |
| Pace-8 | 前端校验 | UI 层在 full_set 模式不显示"看解析"按钮（双重保险） |

---

## 6. 申论批改与范文（Essay 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Essay-1 | 批改形式 | AI 批改 + 范文对比（D-Q4） |
| Essay-2 | 批改时机 | 异步（D-Q16）|
| Essay-3 | 范文来源 | 官方人工 > AI 生成 > 用户贡献 |
| Essay-4 | AI 范文触发 | 用户提交申论后，如该题没有 EssayReferenceAnswerV2 则自动异步生成 |
| Essay-5 | 范文 quality 升级 | 用户点赞 / 收藏达阈值 → 由 cron 提升 status=public |
| Essay-6 | 范文用户反馈 | 点赞 / 收藏 / 举报 三种 action |
| Essay-7 | 范文展示优先级 | source=official > source=user_contributed > source=ai_generated（按 quality_score 内排序） |
| Essay-8 | 批改完成通知 | 完成后写入 EssayReportV2；前端通过 GET /grading-status 端点轮询（不上 SSE） |
| Essay-9 | 批改失败 | EssaySubmissionV2.status=failed；前端展示"批改失败"+ 重试按钮 |
| Essay-10 | 限流 | 每用户每日 N 次申论 grade 调用（成本高） |

---

## 7. 历史成绩聚合（Stat 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Stat-1 | 分类层级 | 二级分类（Q2） |
| Stat-2 | 聚合策略 | 三层（D-Q3） |
| Stat-3 | 调度 | 02:00 cron + session.submit 增量 + 周一 03:00 百分位（D-Q11） |
| Stat-4 | 百分位计算 | 全用户 + 同一 category 内的相对位置（不分用户群） |
| Stat-5 | 数据源 | **完全独立于 PlanEventV2.status**，仅基于 PracticeSessionV2 + PracticeSessionAnswerV2 + EssaySubmissionV2 + EssayReportV2 |
| Stat-6 | 时间维度 | 7d / 30d / 90d（前端通过 query 参数选择） |
| Stat-7 | 趋势数据点 | 近 5-10 次 session 的 (date, accuracy, count) 三元组 |
| Stat-8 | 题型 × 难度交叉 | 矩阵端点 `GET /stats/cross?category=&difficulty=` |
| Stat-9 | 与平台平均对比 | snapshot 内附 `percentile_rank` 字段（百分位），前端展示"超过 X% 用户" |

---

## 8. 每日一练（Daily 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Daily-1 | 与今日推荐边界 | 今日推荐 = 系统主动推（多动作类型）；每日一练 = 用户主动点（一定做新题） |
| Daily-2 | 长度 | 5-10 题混合 |
| Daily-3 | 出题策略 | 跨模块按用户弱项加权（弱项题型分配更多） |
| Daily-4 | 触发时机 | 用户进入 `/practice/daily` 时；如当日已生成则返回；否则即时生成 |
| Daily-5 | 一日一份 | UNIQUE (user_id, date, type)；同一日多次访问返回同一份 |
| Daily-6 | 过期 | 当日 23:59 自动 expired；过期后不可再开始（但已开始的可继续） |
| Daily-7 | 完成状态 | pending / started / completed / expired |
| Daily-8 | 历史查询 | `GET /practice/daily/history?period=7d|30d` |

---

## 9. 题级笔记联动（Note 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Note-1 | 创建方式 | 答题界面"加笔记"按钮 → 创建 NoteV2(linked_question_id=current, user_id) |
| Note-2 | 一题多笔记 | 允许（同一用户同一题可有多条笔记） |
| Note-3 | 可见性 | 仅创建者（D-Q17） |
| Note-4 | 联动跳转 | Tab 4 笔记列表点击题级笔记 → 跳到 `/practice/questions/:id`（题目详情页，不进 session）|
| Note-5 | 答题界面"该题相关笔记" | 列出当前用户对此题的所有 NoteV2，可编辑 / 删除 |
| Note-6 | Tab 4 列表过滤 | 默认显示全部，可切换 filter（独立笔记 / 题级笔记） |
| Note-7 | NoteV2 schema 升级时机 | **本 Phase WU-B11.3** 提前升级（Tab 4 主 Phase 还未启动） |

---

## 10. 收藏 / 标记（Fav / Flag 系列）

| # | 决策 | 拍板 |
|---|---|---|
| Fav-1 | 数据表 | QuestionFavoriteV2（user_id + question_id 唯一） |
| Fav-2 | 备注 | 收藏时可附带简短 `note` 字符串 |
| Fav-3 | 列表筛选 | 按 type / category / 时间范围 |
| Flag-Basic | 本次 session 内标记 | PracticeSessionAnswerV2.flagged 字段 |
| Flag-Persistent | 持久化标记 | QuestionFlagV2 表（D-Q12 拓展） |
| Flag-Reason | 持久标记 reason | uncertain / revisit_later / needs_review |
| Flag-AutoReview | 自动入复盘 | persistent flag → ReviewItemV2 (reason=flagged_persistent) |
| Flag-Resolve | 解决标记 | `PATCH /flags/:id/resolve` 设 resolved_at |
| Flag-Unique | 同一用户同一题 | 只能有一条 active flag（已 resolved 的不算） |

---

## 11. Phase-Practice 范围明确

### 11.1 在范围内

- 练习中心 `/practice` 一屏 view（Section A/B/C）
- 顶部快捷区（每日一练 / 继续上次 / 自定义刷题）
- 答题路由 `/practice/sessions/:id`（含 行测 + 申论双 shell）
- 结果路由 `/practice/sessions/:id/result`
- 申论批改详情 `/practice/sessions/:id/grading`
- AI 出题等待页 `/practice/ai-questions/generating`
- 题目详情页 `/practice/questions/:id`（用于 Tab 4 笔记跳转）

后端：
- QuestionV2 字段扩展（B10）
- session 系列字段扩展（B11）
- 7 张新表（B12 + B13）
- content / session / favorites / question_flags / practice_stats / ai_questions / daily_practice / essay_grading 模块（B14-B20）
- 真题 import 脚本（B21）
- LLM 模块扩展 3 能力（B22）
- cron 扩展（B23）
- e2e + OpenAPI（B24）

### 11.2 不在范围内

- 错题专项页 → [Phase/Review](../Review/README.md)
- 笔记主 view + 双向链接 → [Phase/Notes](../Notes/README.md)（本 Phase 仅升级 NoteV2 schema）
- BindEmail/Phone/CompleteProfile → [Phase/Profile](../Profile/README.md)
- Onboarding / DiagnosisResult → [Phase/Onboarding](../Onboarding/README.md)
- 申论人工批改 → 远期
- 题库管理后台 → 远期
- AI 出题"自动评分"（基于答题反推 LLM 改编质量） → 远期
- 收藏夹分组 → 远期
- 移动端 5 tab 适配（Phase-Home D1 修订作废了 H-Plan-6 升 tab 方案；由 Phase-Home WU-F7 处理路由迁移）

---

## 12. 跨 Phase 决策对照

| Phase-Home 决策 | 对 Practice 的影响 |
|---|---|
| D1（5 tab） | 练习是第 2 tab，不升 6；学情走 `/profile/learning`，记录走 `/profile/records` |
| H-Plan-1（日历画廊） | 用户从首页计划事件 CTA 进入 session 时携带 `linked_plan_event_id` |
| Cal-5（事件 → session 绑定） | session.create 接受 `linked_plan_event_id` 参数 |
| P1-P6 边界规则 | Phase-Practice 全部继承（详见 [01-Boundary-Rules](./01-Boundary-Rules.md)） |
| Infra-LLM | Practice LLM 扩展直接复用 Phase-Home 的 modules/llm/（不新建 llm_v2） |
| NF-Audit | Practice 全部变更（fav/flag/ai_question 等）走 AuditLogV2 |
| NF-RateLimit | Practice 端点限流策略继承（详见 08-NonFunctional） |
| Stage 1 单机 → Stage 2 多用户 | Practice 数据层支持平滑迁移，不做 user-scoping 之外的特殊处理 |

---

## 13. 决策变更日志

未发生变更。如有变更：
- 在对应章节用 `~~删除线~~` 保留旧决策
- 紧跟新决策行 + `（变更日期：YYYY-MM-DD）`
- 跨文档影响在 [README §10](./README.md#10-变更流程) 注明
