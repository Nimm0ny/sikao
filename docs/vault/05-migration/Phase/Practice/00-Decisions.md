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
| `Timing-` | 答题计时（11-Timing-Engine.md） |
| `Session-LC-` | session 生命周期（12-Session-Lifecycle.md） |
| `MockExam-` | 模考模式（13-Mock-Exam.md） |
| `Pref-` | 用户偏好（14-Practice-Preferences.md） |
| `QMeta-` | 题目元数据（15-Question-Metadata.md，Phase 1 仅 schema） |
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
| D-Q16 | 申论批改时机 | **B 异步后台批改**（submit hook 触发 background task 写 EssayReportV2 → 前端轮询 grading-status；详见 §19 CLP-1） |
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
- 模考创建与详情：`/practice/mock-exam/start`（创建配置）/ `/practice/mock-exam/history`（历次模考列表）

后端：
- QuestionV2 字段扩展（B10）
- session 系列字段扩展（B11）
- 7 张新表（B12 + B13）
- content / session / favorites / question_flags / practice_stats / ai_questions / daily_practice / essay_grading 模块（B14-B20）
- 真题 import 脚本（B21）
- LLM 模块扩展 3 能力（B22）
- cron 扩展（B23）
- e2e + OpenAPI（B24）
- **timing 模块**（B25）：QuestionTimingBaselineV2 + 时间事件上报 / 分析端点 / 基线 cron
- **session_lifecycle 模块**（B26）：状态机 + pause / resume / heartbeat / discard / active query / 超时 cron
- **mock_exam 模块**（B27）：创建 / 倒计时 / 自动提交 / 历史对比 / cron 兜底
- **practice_preferences 模块**（B28）：UserPracticePreferencesV2 + GET/PUT/PATCH/RESET 端点 + LRU 缓存
- **question_metadata schema 预留**（B29）：QuestionV2 5 字段扩展 + KnowledgePointV2 / QuestionKnowledgePointV2 两表（建表，留空）
- **question_report 模块**（B30）：真题纠错入口 + admin 处理流（属 SHOULD 级补强）

### 11.2 不在范围内

- 错题专项页 → [Phase/Review](../Review/README.md)
- 笔记主 view + 双向链接 / 全文搜索 / 标签 / 树状组织 → [Phase/Notes](../Notes/README.md)（本 Phase 升级 NoteV2 schema **+ 落地题级笔记最小 CRUD，见 §19 CLP-5**）
- BindEmail/Phone/CompleteProfile → [Phase/Profile](../Profile/README.md)
- Onboarding / DiagnosisResult → [Phase/Onboarding](../Onboarding/README.md)
- 申论人工批改 → 远期
- 题库管理后台 → 远期
- AI 出题"自动评分"（基于答题反推 LLM 改编质量） → 远期
- 收藏夹分组 → 远期
- 移动端 5 tab 适配（Phase-Home D1 修订作废了 H-Plan-6 升 tab 方案；由 Phase-Home WU-F7 处理路由迁移）
- **题目元数据 Phase 2 完整能力**（端点 / cron / LLM 标注 / 数据填充）→ Phase 2（独立 Phase 实施，与 Phase-Review 错因聚类升级配套）
- **跨用户模考排行榜**（"和你同水平的人这套卷正确率 30%"）→ Stage 2 多用户阶段
- **答题质量分析**（蒙猜识别 / 答题置信度自评 / 答案变化轨迹聚合）→ 远期（timing 字段 answer_change_count / time_spent_ms 已就绪，作输入）
- **数据导出 / 学习成就 / 通知中心**：均推远期
- **session 异常恢复克隆**（recovered_from_session_id 字段已建，但启用流程 Phase 2 实施）

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


---

## 14. 答题计时（Timing 系列）

详见 [11-Timing-Engine.md](./11-Timing-Engine.md)。

| # | 决策 | 拍板 |
|---|---|---|
| Timing-1 | 是否引入逐题计时 | **是**（公考时间敏感性是核心；缺这块练习产品不完整） |
| Timing-2 | 计时粒度 | 毫秒级（time_spent_ms），存累计耗时（不含切走切回间隔） |
| Timing-3 | 上报方式 | 前端事件 batch 上报（buffer ≥ 50 或每 15s flush）；不实时上报每次操作 |
| Timing-4 | 事件类型 | question_enter / question_leave / answer_change / heartbeat 四类（heartbeat 为减少端点数共用 timing 上报通道，session_pause/resume 走 lifecycle 端点） |
| Timing-5 | 单区间最大值 | 单次 enter→leave 区间 ≤ 60s（超出截断为 60s，防恶意刷时间） |
| Timing-6 | 超时判定基线 | 用 QuestionTimingBaselineV2.p95_ms × 1.2；样本不足 30 不参与判定 |
| Timing-7 | 基线计算频率 | 每周一 03:00 cron 重算（最近 90 天数据） |
| Timing-8 | answer_change_count 含义 | 首次作答不计；改一次 +1（用于答题质量分析的 Phase 2 输入） |
| Timing-9 | is_overtime 计算时机 | 仅 session.submit 时计算并写入；session 进行中始终 false |
| Timing-10 | 暴露给前端的实时数据 | 不实时计算 vs_baseline_ratio；用户看到的"超时警告"由前端用 baseline 客户端比对 |
| Timing-11 | 时间分析维度 | overall / by_category_l1 / by_difficulty + overtime_questions + pacing_pattern（前/中/后段速率对比） |
| Timing-12 | 与 paused_total_seconds 的关系 | 暂停时间累加在 session 字段；timing.total_active_seconds = wall_clock - paused_total（约束）|
| Timing-13 | 客户端时钟漂移 | 端点上报支持 client_clock_skew_ms（可选）；服务端不强校验，超 60s 异常事件拒绝 |

---

## 15. session 生命周期（Session-LC 系列）

详见 [12-Session-Lifecycle.md](./12-Session-Lifecycle.md)。

| # | 决策 | 拍板 |
|---|---|---|
| Session-LC-1 | 状态枚举 | DRAFT / IN_PROGRESS / PAUSED / SUBMITTED / ABANDONED / EXPIRED 六态 |
| Session-LC-2 | DRAFT 用途 | 自定义对话框配置完成 / AI 出题等待页生成完成后的过渡态；首次答题 / start 端点转 IN_PROGRESS（heartbeat **不**触发转换） |
| Session-LC-3 | 心跳间隔 | 30s（前端定时；用户切走 tab 暂停心跳） |
| Session-LC-4 | 心跳超时阈值 | 30min 未心跳 → IN_PROGRESS 转 PAUSED（mock_exam 例外） |
| Session-LC-5 | 无活动放弃阈值 | PAUSED 24h 无任何活动 → ABANDONED |
| Session-LC-6 | DRAFT 放弃阈值 | DRAFT 2h 无活动 → ABANDONED |
| Session-LC-7 | Daily session 超时 | 当日 23:59 cron 检查 status != submitted → EXPIRED |
| Session-LC-8 | 终态不可变 | SUBMITTED / ABANDONED / EXPIRED 不可改 status / completed_at / abandoned_at（DB trigger 拦截 UPDATE） |
| Session-LC-9 | 多端策略 | last-writer-wins（不强独占）；客户端心跳响应中检测状态变化即 refetch |
| Session-LC-10 | 心跳到达终态 session | 仅返回当前状态，不写 last_heartbeat_at |
| Session-LC-11 | force_submit 入口 | mock_exam 倒计时归零（cron 兜底每分钟）/ admin 端点 / 系统恢复（罕见） |
| Session-LC-12 | DRAFT 不接受 timing 事件 | 仅 question_enter 隐式转 IN_PROGRESS（其他事件拒绝） |
| Session-LC-13 | 用户主动废弃 | discard 端点直接转 ABANDONED（reason='user_discard'）|
| Session-LC-14 | active session 数量限制 | 不强限制（同用户可多个 IN_PROGRESS / PAUSED 共存）；daily UNIQUE 约束自然限单 |
| Session-LC-15 | recovered_from_session_id 字段 | 本 Phase 不启用恢复克隆，留扩展位（Phase 2 异常恢复） |

---

## 16. 模考模式（MockExam 系列）

详见 [13-Mock-Exam.md](./13-Mock-Exam.md)。

| # | 决策 | 拍板 |
|---|---|---|
| MockExam-1 | 实现方式 | session 正交维度（exam_mode 字段），不新建独立表 |
| MockExam-2 | 模考必要前提 | exam_mode=true ⟹ practice_mode=full_set ∧ source_mode=paper ∧ time_limit_minutes 非空（DB CHECK） |
| MockExam-3 | 时间表示 | 绝对时间 auto_submit_at（immutable）；不存"剩余时间"（避免跨设备 / 刷新偏差） |
| MockExam-4 | 倒计时启动时机 | DRAFT → IN_PROGRESS 时计算 auto_submit_at = now + time_limit_minutes |
| MockExam-5 | 自动提交双轨 | 前端归零立即调 submit + cron 每分钟兜底（最多延迟 60s） |
| MockExam-6 | 心跳超时不进 PAUSED | exam_mode=true 的 session 不被 cleanup_stale_sessions 转 PAUSED；时间继续走 |
| MockExam-7 | 默认禁暂停 | allow_pause=false 默认；用户创建时不可改（admin 强制例外） |
| MockExam-8 | 模考期间禁笔记 | 创建题级 NoteV2 端点 422 拒绝（前端隐藏入口 + 后端兜底） |
| MockExam-9 | 严格闭卷 | 提交前所有看答案 / 看解析端点拒绝（继承 Pace-Closed-Book） |
| MockExam-10 | 延迟解锁解析 | delayed_review_until 可选字段；提交后 < 该时间仍 403 DELAYED_REVIEW_LOCKED |
| MockExam-11 | 时间限制范围 | time_limit_minutes ∈ [10, 360]（DB CHECK） |
| MockExam-12 | 申论模考时间 | 默认 180min（行测默认 120min）；用户可覆盖在范围内 |
| MockExam-13 | 模考结果保存 | 与普通整组练习共表（PracticeSessionV2 + Answer），按 exam_mode 过滤区分 |
| MockExam-14 | 模考排行榜 | Stage 1 仅"自己同套卷历次"内部排名；跨用户排行榜推 Stage 2 |
| MockExam-15 | 历史套卷模考保留 | 不归档（用户可能想多次模拟同套卷）；用 delayed_review_until 隔时长 |

---

## 17. 用户偏好（Pref 系列）

详见 [14-Practice-Preferences.md](./14-Practice-Preferences.md)。

| # | 决策 | 拍板 |
|---|---|---|
| Pref-1 | 实现方式 | **新建独立表 UserPracticePreferencesV2**（不复用 ProfileInfoV2.dashboard_preferences） |
| Pref-2 | 存储格式 | 单 JSON payload + schema_version；按 v1 schema 严格校验（Pydantic）|
| Pref-3 | schema 演进 | bump schema_version；旧版本 lazy upgrade（读时升 payload，不立即写库） |
| Pref-4 | schema_version mismatch | PUT 时强制服务端最新版本；不一致 → 422 + 返回最新 payload 让客户端 refetch |
| Pref-5 | payload 子树 | ui / pacing / auto_save / keyboard / reminders / custom_practice 六个 |
| Pref-6 | 默认值返回 | 用户从未保存时 GET 返回 isDefault=true + 完整 defaults（前端不区分"未保存"和"默认"）|
| Pref-7 | KeyBindings 唯一性 | 所有 action 绑定 key 必须唯一（防冲突，root validator）|
| Pref-8 | 自动保存频率 | interval_seconds 范围 [10, 300] |
| Pref-9 | localStorage 同步 | 前端即时缓存；TanStack Query staleTime 5min；refetchOnWindowFocus |
| Pref-10 | useSessionConfigStore 整合 | custom_practice 子树替代 ProfileInfoV2.dashboard_preferences 异步同步目标 |
| Pref-11 | 后端缓存 | LRU（key=user_id, TTL=60s）；写入立即失效该用户缓存 |
| Pref-12 | audit 写入策略 | 高频字段（font_size / autosave）不写 audit；关键字段（schema_version / theme）写 |
| Pref-13 | 多设备冲突 | last-writer-wins（v1 范围）；Stage 2 引入 ETag 乐观锁 |
| Pref-14 | 移动端 keyboard | 后端不区分平台；前端在移动端隐藏 keyboard 配置 UI |

---

## 18. 题目元数据（QMeta 系列，Phase 1 仅 schema）

详见 [15-Question-Metadata.md](./15-Question-Metadata.md)。

| # | 决策 | 拍板 |
|---|---|---|
| QMeta-1 | Phase 1 落地范围 | **仅 schema**（QuestionV2 5 字段 + KnowledgePointV2 + QuestionKnowledgePointV2 两表） |
| QMeta-2 | Phase 2 推后 | 端点 / cron / LLM 标注 / 数据填充全部 Phase 2（Phase-Review 之后） |
| QMeta-3 | 双轨设计 | knowledge_tags（字符串数组，灵活）+ KnowledgePointV2 关联（结构化）双轨；Phase 2 决策迁移路径 |
| QMeta-4 | ability_dimensions 枚举 | comprehension / reasoning / calculation / memory / application 五值（DB CHECK） |
| QMeta-5 | complexity_level 范围 | 1-5（NULL 允许；表示未标注） |
| QMeta-6 | discrimination_index | 0.0-1.0（NULL 允许；样本不足或未计算）；Phase 2 cron 写入 |
| QMeta-7 | heat_score 默认 | 0.0；Phase 2 cron 每日重算 |
| QMeta-8 | knowledge_tags 格式 | 元素必须 `^[a-z][a-z0-9_]*$`（snake_case）；便于 Phase 2 迁移到 knowledge_point.code 无歧义 |
| QMeta-9 | Phase 1 表必须留空 | KnowledgePointV2 / QuestionKnowledgePointV2 在 Phase 1 完工时必须为空表（除测试 fixture）|
| QMeta-10 | Phase 1 service 隐藏 | service 层不导出对这两个表的 CRUD；防止误用 |
| QMeta-11 | OpenAPI 标注 | Phase 2 端点在 OpenAPI 中以 `x-phase: 2` 标记（spec 定义但不实现） |
| QMeta-12 | 知识点树初始化 | Phase 2 由 admin 录入（200-500 节点）+ LLM 辅助归类历史题目 |
| QMeta-13 | LLM 标注成本预估 | 10k 题成本约 $30-50（DeepSeek 价格）；Phase 2 单独审批 |
| QMeta-14 | 与 Phase-Review 的协同 | Phase-Review 错因聚类 Phase 1 仍用 category；Phase 2 升级到 knowledge_point 维度 |



---

## 19. 闭环修订决策（CLP 系列）

> **添加日期**：2026-05-22
> **背景**：在对 18 篇 Phase 文档做整体闭环检查时发现 4 个会卡住实施的硬缺口 + 4 个跨文档含糊点，需把"目标态"补齐成端到端可执行。
> **覆盖范围**：API 入口契约 / 模块边界 / schema 补全。本节是上述缺口的 SSOT；与 §1-§18 既有决策不冲突，仅"补全"。

### CLP-1 申论批改触发入口固化（隐式 hook + 显式 /grade 仅作重试）

**决策**：

- **默认路径（用户感知不到）**：`session.submit` 内的 hook（[03-Backend-WU §15.2 B23.4](./03-Backend-WU.md#152-pr-拆分)）在 session.type=essay 且未触发过批改时**隐式调** `trigger_essay_grading_async(submission_id)`。
- `POST /api/v2/practice/essay/submissions/:id/grade` 端点**不参与**默认路径，仅用于：
  1. 上次批改 status=failed 的失败重试
  2. admin 强制重新批改
  3. EssayReportV2 已写入但 reference 范文缺失时的补生成
- 同一 submission_id 的并发 grade 调用走 IdempotencyKeyV2（继承 Phase-Home AI-8）+ EssaySubmissionV2.status 状态机：仅当 status ∈ {pending_grading, failed} 才允许触发，graded 直接 200 返回现有结果。
- session.submit 内的 hook **不抛错**：批改触发失败仅写 audit + metric，不影响 session.submit 主流程（fail-fast 例外登记于 [`essay-grading-trigger-hook`](../../../engineering/fail-fast-exceptions.md#essay-grading-trigger-hook)，AGENTS-H7 合规）。

**影响章节**：
- [01-Boundary-Rules §4 PR8](./01-Boundary-Rules.md) 修订为"立即创建 EssaySubmissionV2(status=pending_grading) → submit hook 触发后台 grade → 写 EssayReportV2 → 更新 status=graded/failed"。
- [03-Backend-WU §12.1](./03-Backend-WU.md#12-wu-b20-essay_grading-模块扩展) 端点说明加注"用户路径不调用此端点；UI 提交后跳 result 页 polling /grading-status 即可"。
- [A0-Codebase-Reality-Check §5.2](./A0-Codebase-Reality-Check.md#52-sessionsubmit-当前不写-essayreport) 描述与本决策一致。

### CLP-2 AI 出题等待页与 session.create 的流程契约

**决策**：

AI 出题不再让 `session.create(mode=ai_generated)` 内部调 LLM。固化两步流程：

```
[前端等待页] POST /api/v2/practice/ai-questions/generate
              ↓ (10-30s 同步等待，典型 10-15s；30s 超时上限沿用 D-Q8。返回 question_ids + request_id)
[前端等待页] POST /api/v2/practice/sessions
              body: { mode: 'ai_generated',
                      config: { questionIds: [...], requestId: ... } }
              ↓ (毫秒级返回 session_id)
[前端]       navigate(/practice/sessions/:id)
```

- `session.create(mode=ai_generated)` 的 ai_picker（[03-Backend-WU §7.2 B15.4](./03-Backend-WU.md#72-pr-拆分)）**不**调 ai_questions 模块的 generator service；改为：
  - 校验 `config.questionIds` 全部存在于 `AiGeneratedQuestionRequestV2[id=requestId].pool_question_ids ∪ llm_generated_question_ids`，否则 422 INVALID_QUESTION_REFERENCE
  - 校验所有 question_id 满足 `source ∈ (ai_generated, ai_modified) ∧ is_active=true`
  - 创建 session 并把 `requestId` 写入 `config_snapshot.ai_request_id` 用于审计反查
- 等待页失败时（503 / 429 / 超时）**不**调 session.create；直接展示重试 / 切真题选项（继承 [00-Decisions §4 AI-G-7](#4-ai-出题ai-g-系列)）。
- `useGenerateAiQuestions` 与 `useCreateSession` 在前端是两次独立 mutation；**前者**走 IdempotencyKeyV2（继承 AI-G-9），**后者**不走（session.create 本身天然幂等：同一 requestId + question_ids 重复调用返回不同 session_id 由用户负责，前端在等待页跳转后立即 unmount）。

**影响章节**：
- [03-Backend-WU §7.2 B15.4](./03-Backend-WU.md#72-pr-拆分) 修订 ai_picker 描述。
- [04-Frontend-WU §7.2 F14.4](./04-Frontend-WU.md#72-pr-拆分) 与 [§8.2 F15.1](./04-Frontend-WU.md#82-pr-拆分) 流程契约对齐：等待页内主流程 = generate → createSession → navigate。

### CLP-3 mock-exam 端点 = session.create 包装糖

**决策**：

`POST /api/v2/practice/mock-exams`（[13-Mock-Exam §3.1](./13-Mock-Exam.md#3-端点)）实现层 = `session.create` 的语法糖，**不**新建独立 service：

```python
async def create_mock_exam(*, paper_code, time_limit_minutes, delayed_review_minutes, user_id):
    # 1. 校验套卷 mock 资格（题数 >= 阈值 / 套卷 status 等）
    paper = await assert_paper_mock_eligible(paper_code)
    # 2. 解析最终 time_limit；先 fallback 再校验最终值（m4 修订）
    final_time_limit = time_limit_minutes or paper.recommended_time_minutes
    if not (10 <= final_time_limit <= 360):
        raise ServiceError(code='INVALID_TIME_LIMIT', http=422)
    # 3. 委托 session.create
    session = await session_service.create(
        user_id=user_id,
        source_mode=SessionSourceMode.PAPER,
        practice_mode=PracticeMode.FULL_SET,
        paper_code=paper_code,
        exam_mode=True,
        time_limit_minutes=final_time_limit,
        delayed_review_until=now + timedelta(minutes=delayed_review_minutes) if delayed_review_minutes else None,
        as_draft=True,        # 模考一律 DRAFT，等用户点"开始"才转 IN_PROGRESS
    )
    # 4. DB CHECK 兜底（exam_mode 三联约束 + time_limit_range）
    return session
```

- mock-exam 端点的额外职责：套卷资格校验（PAPER_NOT_MOCK_ELIGIBLE）、时间范围校验（INVALID_TIME_LIMIT）、写 audit `mock_exam.created`。
- `session.create` 仍然可以直接被调用创建普通 session（exam_mode=false），两条路径共享同一 service。
- DB CHECK 约束（[02-Data-Model §5.4](./02-Data-Model.md#54-mock_exam-db-check-约束)）保证任何路径都无法绕过 exam_mode 三联约束。

**影响章节**：
- [13-Mock-Exam §3.1](./13-Mock-Exam.md#3-端点) 注明"内部 = session.create wrapper"。
- [03-Backend-WU §1.1](./03-Backend-WU.md#11-路由分组) 路由注册顺序：mock-exam router 在 session router 之后注册。

### CLP-4 DRAFT 触发链显式化（as_draft 参数）

**决策**：

`session.create` 接受可选参数 `as_draft: bool = False`（[12-Session-Lifecycle §6.1](./12-Session-Lifecycle.md#6-草稿draft)）。各调用方约定：

| 调用方 | as_draft | 进入 IN_PROGRESS 的触发 |
|---|---|---|
| 自定义刷题对话框（mode=custom） | **false** | 直接进 IN_PROGRESS（前端不需要 DRAFT） |
| Section A/B/C 列表入口（mode=paper / category） | **false** | 同上 |
| AI 出题等待页（mode=ai_generated）| **false** | 同上（按 CLP-2，等待页只跳一次） |
| 每日一练（mode=daily） | **false** | 同上 |
| 错题重做（mode=wrong_redo） | **false** | 同上 |
| **mock-exam 端点** | **true（强制）** | 用户点 `POST /sessions/:id/start`（[12-Session-Lifecycle §4.1](./12-Session-Lifecycle.md#41-用户主动操作)）启动倒计时 |

DRAFT 状态的实际生产用途**仅限模考**。其他路径不应使用 DRAFT；如出现 DRAFT 不消费视为 bug（cron 在 2h 后清理为 ABANDONED 兜底）。

**影响章节**：
- [12-Session-Lifecycle §6.1](./12-Session-Lifecycle.md#6-草稿draft) 与 [§9.1](./12-Session-Lifecycle.md#9-与其他模块的集成) 明确 as_draft 默认值与各 mode 的取值约定。
- [03-Backend-WU §7](./03-Backend-WU.md#7-wu-b15-session-模块扩展多-mode--答题中操作) WU-B15 的 session.create body schema 加 `as_draft?: bool = false` 字段。

### CLP-5 题级笔记后端 CRUD 进入本 Phase 范围

**决策**：

新增 **WU-B16.4 题级笔记最小 CRUD**（[03-Backend-WU §8](./03-Backend-WU.md#8-wu-b16-favorites--question_flags-模块) 增 PR）：

```
POST   /api/v2/practice/notes
  body: { question_id: int, body: string, title?: string }
  → 201 NoteV2 envelope
  约束：linked_question_id 必须非空（与 Tab 4 主 view 模块的"独立笔记"区分）

GET    /api/v2/practice/questions/:question_id/notes
  → 200 { notes: NoteV2[] }
  仅返回 user_id == current 的笔记

PATCH  /api/v2/practice/notes/:id
  body: { body?, title? }

DELETE /api/v2/practice/notes/:id
  → 204
  软删除（写 deleted_at）
```

- 仅在 `modules/notes_v2/` 内追加题级 CRUD（A0 §2.3 修订：原"Phase-Home 暂时不动"改为"题级 CRUD 由本 Phase B16.4 提前落地，主 view 留 Phase/Notes"）。
- 不实现：标签 / 双向链接 / 全文搜索 / 树状组织 / 跨用户分享（这些 → Phase/Notes）。
- 约束：mock 模式下 POST 返回 422 MOCK_NOTES_FORBIDDEN（[13-Mock-Exam §3.4](./13-Mock-Exam.md#34-模考期间禁止的操作)）。

**影响章节**：
- [A0-Codebase-Reality-Check §2.3](./A0-Codebase-Reality-Check.md#23-现有-modules-现状) 修订。
- [03-Backend-WU §0 总览](./03-Backend-WU.md#0-wu-总览) WU-B16 行数从 650 调整到 850（增 200）。
- [03-Backend-WU §17 引用矩阵](./03-Backend-WU.md#17-引用矩阵) B16 行加 Note-* / D-Q5。
- [04-Frontend-WU §2.1](./04-Frontend-WU.md#21-文件清单) F9 文件清单加 `notesQueries.ts`（最小集，仅 question-linked CRUD）。

### CLP-6 申论草稿 EssayDraft CRUD 进入本 Phase 范围

**决策**：

新增 **WU-B20.5 essay_draft CRUD**（[03-Backend-WU §12](./03-Backend-WU.md#12-wu-b20-essay_grading-模块扩展) 增 PR）：

```
PUT  /api/v2/practice/essay/sessions/:session_id/draft
  body: { content: string, client_modified_at?: ISO }
  → 200 { saved_at, version }
  策略：last-writer-wins（v1 不引入 ETag）
  幂等：同 content 重复 PUT 仅更新 updated_at（不计入 audit）

GET  /api/v2/practice/essay/sessions/:session_id/draft
  → 200 { content, saved_at, version } | 404 ESSAY_DRAFT_NOT_FOUND

DELETE /api/v2/practice/essay/sessions/:session_id/draft
  → 204
  仅 admin 调用；用户不需要显式删除（提交后服务端自动归档）
```

- 写入路径：用户在申论答题界面 30s 间隔自动 PUT；session.submit 时把最终 draft.content 复制到 EssaySubmissionV2.essay_text 并归档 draft（status=submitted）。
- A0 §2.5 中"EssayDraftV2 已建表，未在路由中使用"问题随本 PR 闭合。
- 限流：每用户每 session 4 req/min（30s 间隔留余量）。
- 不走 IdempotencyKeyV2（因为按内容覆盖，自然幂等）。

**影响章节**：
- [A0-Codebase-Reality-Check §2.5](./A0-Codebase-Reality-Check.md#25-申论-v2-现状关键) EssayDraftV2 行从"未使用"改为"WU-B20.5 启用"。
- [03-Backend-WU §0 总览](./03-Backend-WU.md#0-wu-总览) WU-B20 行数从 1,300 调整到 1,500（增 200）。
- [04-Frontend-WU §2.1](./04-Frontend-WU.md#21-文件清单) F9 文件清单加 `essayDraftsQueries.ts`。
- [04-Frontend-WU §9.2 F16.1](./04-Frontend-WU.md#92-pr-拆分) EssayInput 自动保存的端点指向 `PUT /essay/sessions/:id/draft`。

### CLP-7 题目详情聚合端点进入本 Phase 范围

**决策**：

新增 **WU-B14.4 题目详情聚合端点**（[03-Backend-WU §6](./03-Backend-WU.md#6-wu-b14-content-模块扩展) 增 PR）：

```
GET  /api/v2/practice/questions/:question_id
  → 200 {
       question: QuestionEnvelopeV2,
       user_notes: NoteV2[],            // 该用户在该题上的笔记
       user_history: AnswerHistoryItem[],  // 该用户答此题的历史（最近 5 次）
       favorite: { is_favorited, favorited_at, note? } | null,
       persistent_flag: { reason, created_at } | null,
       reference_answers?: EssayReferenceAnswerEnvelopeV2[],  // 仅 type=essay 时
     }
  → 410 QUESTION_INACTIVE  // is_active=false 不让看
  → 404 NOT_FOUND          // 题不存在 / 越权（同样 404，不泄漏存在性）
```

- 用途：
  1. Tab 4 笔记列表点击题级笔记 → 跳 `/practice/questions/:id`（[00-Decisions §9 Note-4](#9-题级笔记联动note-系列)）
  2. 复盘 / 收藏夹 / 标记列表里"查看题目"的统一入口
- 不进 session、不增加 answer_count；仅是只读聚合。
- AGENTS-H7 Fail-Fast：聚合内任一子查询失败即整体 500（不静默吞错）。

**影响章节**：
- [00-Decisions §11.1](#111-在范围内) 路由列表已含 `/practice/questions/:id`，本 CLP 把它的后端契约补齐。
- [03-Backend-WU §0 总览](./03-Backend-WU.md#0-wu-总览) WU-B14 行数从 800 调整到 1,000（增 200）。
- [04-Frontend-WU §2.1](./04-Frontend-WU.md#21-文件清单) F9 已含 `questionDetailQueries.ts`，对应消费此端点。

### CLP-8 QuestionReportV2 schema 补全（[02-Data-Model §3.12](./02-Data-Model.md)）

**决策**：

[03-Backend-WU §0 总览](./03-Backend-WU.md#0-wu-总览) WU-B30 与 [§17 引用矩阵](./03-Backend-WU.md#17-引用矩阵) 引用了 `02-Data-Model §3.12 QuestionReportV2`，但该章节缺失。

本 CLP 同步补齐 02-Data-Model §3.12（详见该文件本次提交内容），字段集与 [03-Backend-WU §1.3](./03-Backend-WU.md#13-错误码) `REPORT_DUPLICATE_PENDING` 等错误码对齐。

**影响章节**：
- [02-Data-Model §3.12](./02-Data-Model.md) 新增。
- [02-Data-Model §4](./02-Data-Model.md#4-索引策略汇总) 索引表加 `QuestionReportV2 (status, created_at)` 与 `UNIQUE WHERE status='pending'`。

### CLP-9 mode=wrong_redo 入口边界明示

**决策**：

- 数据层（[03-Backend-WU §7.2 B15.3](./03-Backend-WU.md#72-pr-拆分) wrong_redo_picker / [02-Data-Model §2.5](./02-Data-Model.md#25-reviewitemv2扩展-reason-枚举) ReviewReason 枚举扩展）在本 Phase 完工时**已就绪**。
- 用户**入口** UI（错题专项页 / "去重做"按钮）**不在本 Phase 范围**，由 [Phase/Review](../Review/README.md) 接入。
- 在本 Phase 完工时，`session.create(mode=wrong_redo)` 端点对外开放且 contract test 全绿；但 **没有前端入口能触达此 mode**——这是预期行为，不视为 bug。

**影响章节**：
- [README §11 后续工作](./README.md#11-后续工作不在本-phase) 加注"`mode=wrong_redo` 数据层 Phase 1 就绪，UI 入口由 Phase/Review 接入"。

### CLP-10 决策变更日志（仅本批）

| 日期 | 决策 | 替换 / 增量 |
|---|---|---|
| 2026-05-22 | CLP-1 ~ CLP-9 | 闭环检查后批量补齐；不撤销既有决策 |
| 2026-05-22 | A0 §2.3 / §2.5 | "题级笔记 / 申论草稿不动" → 本 Phase B16.4 / B20.5 提前落地 |
| 2026-05-22 | WU-B14 / B16 / B20 行数估算 | +200 / +200 / +200（共 +600 行；不影响 12-15 周整体里程碑） |
