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
| `Report-` | 题目纠错（16-Question-Report.md） |
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
| AI-G-5 | 用户反馈 | 答完后可点赞 / 举报，进入 quality_score 聚合（点赞 / 举报语义保留；具体加减值与归零阈值自 2026-05-22 起以 §19 Report-7 为准；详见 §13） |
| AI-G-6 | 自动下线 | quality_score < 阈值 / report_count > 阈值 → is_active=false（不再出现在新出题）。自 2026-05-22 起仅适用 AI 题，阈值具体化 = quality_score == 0.0；真题走 §19 Report-6 distinct user ≥ 5 路径；详见 §13 |
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
- 笔记主 view + 双向链接 → [Phase/Notes](../Notes/README.md)（本 Phase 仅升级 NoteV2 schema）
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

### 2026-05-22 — §19 Report 系列引入

**新增**：§19 题目纠错（Report 系列），21 条决策，引入 QuestionReportV2 表 + 真题 / AI 题差异化处理路径。

**Supersede 关系**（落地路径在右列括号注明）：

| 受影响决策 / 文档 | 修订要点 | 落地路径 |
|---|---|---|
| AI-G-5（用户反馈进入 quality_score 聚合） | quality_score 公式由 §19 Report-7 全权拍板（衰减系数、归零阈值、admin fixed 重算公式）；AI-G-5「点赞 / 举报」语义保留，但具体加减值以 Report-7 为准 | PR 3（02 §3.12 schema）/ PR 11（03 §24 service）|
| AI-G-6（quality_score < 阈值 → is_active=false） | 阈值具体化 = `quality_score == 0.0`；AI 题专用，真题不走该路径（真题走 Report-6 distinct user ≥ 5） | PR 3（02 §2.1 注释）/ PR 11 |
| 02-Data-Model L120-121「quality_score / report_count: 仅 AI 题有效」 | 字段语义扩展到真题：真题也写 quality_score（衰减系数 -= 0.05，与 AI 题 -= 0.10 区分）+ report_count（distinct user 计数） | PR 3 修注释 + 引入 `real_exam_report_count` 视图 / 物化列（PR 3 拍板字段名） |
| 08-NonFunctional §2.3「题目反馈不接受自由文本」 | Report-3 引入 `description` / `proposed_correction` 自由文本字段（≤500 char + sanitizer + 长度限）；§2.3 同时收紧为「仅 like / unlike / favorite 等动作类反馈不接受自由文本；report 反馈例外，走 sanitizer 路径」 | PR 4（01 §17 边界规则）+ PR 11 引用 sanitizer.py |
| 09-Observability-Audit §2.1 L36 / §4.2 L133 / §5.1 L166（既有 `ai_question.auto_offline` 系列） | 与 §19 Report-13 / Report-14 合并为统一 `question.auto_offline` action（actor 列 `system` → `cron`）+ `practice.question.auto_offline_total{source}` metric；metadata.source ∈ {quality_score, report_count_threshold} 区分触发原因（manual 触发拆到独立 action `question.admin_offline`，actor=admin） | PR 3 同步改 09 §2.1 行表（替换 `ai_question.auto_offline` 行为 `question.auto_offline` 且 actor 列由 system 改为 cron；新增 `question.admin_offline` 行 actor=admin / target_type=QuestionV2 / metadata 含 admin_user_id 与 reason）+ §4.2 event 列表 + §5.1 metric 列表（替换 `ai_questions.auto_offline_total`，不增 metric `practice.question.admin_offline_total`） |

**Pending Define-First**（§19 引用但 schema 待 PR 3 落地的字段 / enum / trigger）：

- `QuestionReportV2` 表本体（PK / FK / 索引）→ PR 3 02 §3.12
- `report_type` enum 7 值 / `status` enum / `outcome` enum → PR 3 02 §3.12.1
- 终态不可改 trigger（status=resolved 拦 UPDATE）→ PR 3 02 §5
- 同 (user_id, question_id) × active partial UNIQUE → PR 3 02 §3.12.3
- 申诉 lifetime ≤ 3 trigger → PR 3 02 §5
- `is_stale` boolean、`QuestionV2.disable_reason` 字段 → PR 3 02 §2.1 + §3.12
- `LlmCallV2.purpose` 新增 `question_regeneration` → PR 11 03 §24 + PR 3 09 §3
- `PracticeSessionV2.question_snapshot_jsonb` → PR 3 02 §2.2

§19 在本 PR 内为 ACCEPTED 决策（决策本身闭环、命名对齐既有 SSOT、supersede 明确），但其引用的 schema 字段在 PR 3 合入前禁止任何下游 PR 实现 B30。下游 PR（11 / 17 / 21）不依赖 schema 字段名的部分（端点路径、状态机语义、metric 名）可平行推进。

### 变更格式约定

未来变更：
- 在对应章节用 `~~删除线~~` 保留旧决策
- 紧跟新决策行 + `（变更日期：YYYY-MM-DD）`
- 跨文档影响在 [README §10](./README.md#10-变更流程) 注明
- 跨文档 supersede 在本 §13 登记并附落地路径


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

## 19. 题目纠错（Report 系列）

> **Status**: ACCEPTED（决策层）+ Pending Define-First（schema 层；落地见 §13 supersede 表）
> **详细设计**: [16-Question-Report.md](./16-Question-Report.md)（PR 5 提供）
> **Supersede**: AI-G-5 / AI-G-6 / 02-Data-Model L120-121 / 08-NonFunctional §2.3（详见 §13）

**背景**：真题导入难免有 OCR 错字 / 答案录错 / 解析过期 / 分类标错；AI 改编题更可能出现题干歧义或答案漂移。Stage 1 单机 + 单运营人，必须有用户报错入口 + admin 处理流 + 自动下线兜底，否则错题污染会侵蚀整个题库可信度。

**真题 / AI 题差异化总览**（Report-6 / Report-7 / Report-15 三条决策的共同前提）：

| 维度 | 真题 | AI 题 |
|---|---|---|
| 自动下线触发 | distinct user 报错 ≥ 5（Report-6） | quality_score 归零 ⟹ AI-G-6（继承）|
| quality_score 衰减系数 | 每条 active report -= 0.05 | 每条 active report -= 0.10 |
| quality_score 归零条件 | distinct user ≥ 3 → 直接置 0.0（Report-7） | 同左 |
| quality_score=0 与 is_active 联动 | **不联动**（quality_score 仅作排序权重，下线唯一入口仍是 Report-6 的 ≥ 5）| **联动**（quality_score=0 ⟹ is_active=false，AI-G-6） |
| admin outcome=fixed 处理 | 走人工修订 PR（content 改正） | 标 is_active=false + 触发 regenerate（Report-15）|

| # | 决策 | 拍板 |
|---|---|---|
| Report-1 | 报错对象 | QuestionV2（真题 / AI 题同等可报）；衰减 / 下线路径按上表分流（Report-6 / 7 / 15） |
| Report-2 | 报错类型枚举 | `wrong_answer / wrong_explanation / typo / wrong_category / outdated / duplicate / other` 七类（DB CHECK）；`other` 仅 admin 内部分类用，前端 UI 不暴露（前端只展示前六个 + "其它问题（备注 description）"映射回 other） |
| Report-3 | 必填项与文本字段 | `report_type`（必）+ `description`（10-500 char，trim 后 NOT NULL）+ `proposed_correction`（可选 ≤500 char）；两个文本字段走 Phase-Home `core/sanitizer.py`（去 prompt injection 标记 + HTML 转义 + 长度截断）。Supersede 08-NonFunctional §2.3「题目反馈不接受自由文本」收紧条款（详见 §13） |
| Report-4 | 用户限速 | 每用户每日 ≤10 次（端点限流，详见 [08-NonFunctional §2.2](./08-NonFunctional.md#22-限流nf-ratelimit) 在 PR 4/11 同步增行 `POST /practice/reports`）；同一 (user_id, question_id) 24h 内只允许 1 次 active 状态 report（DB partial UNIQUE：`status IN ('pending', 'under_review')`） |
| Report-5 | 状态机 | `pending → under_review → resolved` 三态；transition 必须由 admin 端点触发（用户端无 status 字段写入）；`resolved` 必带 `outcome ∈ {fixed, rejected, duplicate}`；终态（status=resolved）不可改（DB trigger 拦 UPDATE，参考 PR2 source immutable trigger 风格） |
| Report-6 | 自动下线阈值（仅真题） | 同一题不同用户的 distinct active report ≥ 5 → cron 每小时第 15 分钟（错峰整点）检查，触发 `QuestionV2.is_active=false` + 写 `QuestionV2.disable_reason='auto_disabled_by_reports'`；AI 题不走此路径 |
| Report-7 | quality_score 联动公式 | 每条新增 active report：真题 quality_score = max(0, current - 0.05)，AI 题 quality_score = max(0, current - 0.10)；distinct user report ≥ 3 → 直接置 0.0（强制覆盖累计衰减）；admin outcome=fixed 的 cron 周一 03:30（与 D-Q11 03:00 错峰 30min）按 `quality_score = 5.0 - decay × n_active_reports` 重算（decay 真题 0.05 / AI 题 0.10，clip [0, 5]）；真题 quality_score=0 不触发 is_active 联动（仅作排序权重）|
| Report-8 | admin 处理 SLA | pending 状态 ≤ 7 天必须 transition；超期 cron（每日 04:15，错峰 04:00 余量）标 `is_stale=true` + 写 audit `report.sla_breach`（用于运营周报）；is_stale 不阻塞用户继续报错该题（仅 admin dashboard 上排序优先） |
| Report-9 | 用户通知 | 状态 → resolved 时通过 AuditLogV2 + 用户侧 `GET /practice/me/reports` 拉取（Stage 1 单机不引入邮件 / 短信 / SSE 推送）；前端 badge 显示 unread_resolved_count（实现：客户端 LocalStorage 存 `report.last_seen_resolved_id`，详见 PR 17 04 §19 WU-F23.1，服务端不存已读状态） |
| Report-10 | 误判申诉 | `outcome=rejected` 后用户可对同一题再报；同一 (user_id, question_id) 累计 ≤ 3 次 lifetime（DB trigger 行级校验，service 层禁止绕过）；超出 422 RESUBMIT_LIMIT_EXCEEDED；`outcome=fixed` / `outcome=duplicate` 后用户不可再报（视为已处理） |
| Report-11 | 重复举报合并 | 同一题不同用户的 active report 不合并表行（保留每条 description / proposed_correction 用于 admin 决策）；admin 视图按 `question_id` 聚合展示（`GROUP BY question_id ORDER BY count(*) DESC`） |
| Report-12 | 隐私 | 报错全表仅 admin 可见；普通用户仅能 `GET /practice/me/reports` 拉自己的（不暴露其他用户的 description）；report 不出现在 QuestionV2 公开字段里 |
| Report-13 | audit 写入 | 三事件均写 AuditLogV2，命名严格沿用 09 §2.1 既有 `<module>.<verb>` 现在式无前缀格式：`report.create`（actor_type=user）/ `report.transition`（actor_type=admin，metadata 含 `from_status`、`to_status`、`outcome`）/ `question.auto_offline`（actor_type=cron，metadata 含 `source ∈ {quality_score, report_count_threshold}` 区分触发原因，仅 cron 触发；不含 manual）；与既有 `ai_question.auto_offline` 合并为统一 `question.auto_offline` action（详见 §13 supersede）；admin 端点手动 manual 下线走另一独立 audit action `question.admin_offline`（不与本节合并，actor_type=admin 详见 Report-19；不出 metric 详见 Report-14） |
| Report-14 | metrics | Prometheus，命名严格沿用 09 §5.1 既有点分格式：`practice.report.submitted_total{report_type}` / `practice.report.resolved_total{outcome}` / `practice.question.auto_offline_total{source}` / `practice.report.pending_age_seconds`（histogram，bucket [1h, 6h, 1d, 3d, 7d, 14d]）；`source` label 取值集合枚举固定 ∈ {quality_score, report_count_threshold}（防 cardinality 失控；manual admin 下线不进此 metric，admin 行为只走 audit `question.admin_offline`，避免低频高基数 admin_user_id 污染 metric label 空间） |
| Report-15 | AI 题 outcome=fixed 处理 | AI 题 `outcome=fixed` 不修改原题（生成结果不可变）；改为 admin 标记后 service 同步执行：① QuestionV2.is_active=false ② enqueue `regenerate_replacement_question` 异步任务（async LLM job）；任务策略：5 分钟超时 → status=failed + 写 audit `report.regenerate.failure` + 不自动重试，由 admin dashboard 手动 retry 按钮触发（违反 H7 Fail-Fast 的零容忍）；任务成功 → 新 QuestionV2 行 source=ai_modified + ai_source_question_id 指向旧题 + 写 audit `report.regenerate.success` |
| Report-16 | 与练习 session 的关系 | session 进行中允许 report；report 不影响当前 session 的 answer / score / time_spent_ms 计算；session.submit 时把题目当时状态快照到 `PracticeSessionV2.question_snapshot_jsonb`（详见 PR 3 02 §2.2 字段定义），result 页展示按快照渲染（即便事后题已 auto_offline 或 content 修改，老 session 仍按提交时刻展示） |
| Report-17 | 数据保留 | active 状态 report 永远保留；resolved 状态保留 90 天后由 cron 每月 1 号 02:45（错峰 02:00 D-Q11 全量 / Profile 硬删）移到 `question_report_archived_v2` 表（详见 PR 3 02 §3.12.4 表定义）；archived 表仅 admin 可查（GET /admin/reports/archived），用户端不暴露 |
| Report-18 | 幂等性 | `POST /practice/reports` 必带 `Idempotency-Key`（继承 AI-G-9 + Phase-Home 08 §4.1 IdempotencyKeyV2 路径）；Idempotency-Key TTL 不超过 24h（与 Report-4 partial UNIQUE 窗口对齐，避免 24h 后申诉路径被旧 key 短路）；24h partial UNIQUE 在网络抖动重复点击时返回 409 + 已有的 report_id（前端按已有结果展示，不报错给用户） |
| Report-19 | actor_type 约定 | `report.create` actor_type=user / actor_id=user_id；`report.transition` actor_type=admin / actor_id=admin_user_id；`question.auto_offline` actor_type=cron / actor_id=null + metadata.cron_job_id（与 Report-13 一致；唯一触发入口是 cron，详见 Report-6 / Report-21）；`question.admin_offline` actor_type=admin / actor_id=admin_user_id + metadata 含 reason（admin 端点手动下线，与 cron auto_offline 分流）；`report.regenerate.{success,failure}` actor_type=system / actor_id=null（继承 09 §2.1 actor_type 取值约定 `user / ai / system / cron`） |
| Report-20 | rate-limit storage | Stage 1 用 DB count（`SELECT count(*) FROM question_report_v2 WHERE user_id=? AND created_at > now() - interval '24 hours'`）实现，避免内存计数跨进程重启丢失；DB 索引 `(user_id, created_at DESC)` 保证 O(log n) + 限值扫描；Stage 2 迁移到 Redis sliding window（保留 DB 索引作 fallback）|
| Report-21 | cron 业务级互斥锁 | Report-6（每小时 :15）/ Report-8（每日 04:15）/ Report-15 regenerate（按队列消费）/ Report-17（每月 1 号 02:45）的 cron 全部加 PostgreSQL advisory lock（继承 Phase-Home 08 §5.3 既有模式 `pg_try_advisory_lock(<job_id_hash>)`），Stage 1 单 worker 暂时无并发但保持代码 ready，Stage 2 多 worker 直接生效 |
