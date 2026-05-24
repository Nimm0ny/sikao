# Sikao 复盘 Phase 落地 Plan（索引）

> **Status**: ACCEPTED
> **Scope**: 一级导航 Tab 3 = 复盘（默认今日 + 智能三卡 + 周回顾条）+ `/review/all` 全部错题 + `/review/insights` 数据洞察 + `/q/:id` 题目中枢页（独立路由，跨 tab 共用）
> **原则**：完整落地（不走最小化路线）/ 后端先行 / 前端 UI 最后做 / 每 PR 受 AGENTS H9 约束（≤15 文件 / ≤400 行）
> **Last Updated**: 2026-05-21
> **Phase 父目录**：[../README.md](../README.md)

> ⚠️ **开工前必读**：[A0-Codebase-Reality-Check.md](./A0-Codebase-Reality-Check.md)
>
> 本 Phase 的 00-11 文档基于 [Frontend-IA-V2.md](../../Frontend-IA-V2.md) 决策稿编写，描述的是**目标态**。**A0** 记录代码现实与目标的 delta（ReviewItemV2 stub 用 `source_kind` 不是 `reason` / ReviewAttemptV2 已存在 / wrong-book 路由整族迁移 / legacy 11 个组件去留 等）。子文档与 A0 §11 冲突时**以 A0 为准**。

---

## 0. 如何阅读本 Phase

本文是入口索引，不含详细规格。每个 agent / PR 应只读自己所需的子文档。

子文档目录：`docs/vault/05-migration/Phase/Review/`（本目录）

| 子文档 | 何时读 |
|---|---|
| [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) | **任何 PR 开工前必读**（代码现实 vs 目标 delta） |
| [00-Decisions](./00-Decisions.md) | 任何 PR 开工前；决策冲突时以本文档为准（路径冲突时以 A0 为准） |
| [01-Boundary-Rules](./01-Boundary-Rules.md) | 写 review / SRS / 错因分析 / 跨 tab 联动逻辑前 |
| [02-Data-Model](./02-Data-Model.md) | WU-R1~R3 / WU-FR1 类型生成 |
| [03-Backend-WU](./03-Backend-WU.md) | 后端 14 个 PR 的总盘 |
| [04-Frontend-WU](./04-Frontend-WU.md) | 前端 14 个 PR 的总盘 |
| [05-SRS-Engine](./05-SRS-Engine.md) | WU-R3 + 任何写 SRS 状态机的代码 |
| [06-AI-Cause-Analysis](./06-AI-Cause-Analysis.md) | WU-R5 + LLM prompt 调用方 |
| [07-Smart-Review-Aggregation](./07-Smart-Review-Aggregation.md) | WU-FR5 智能三卡前端聚合 |
| [08-Question-Hub-Page](./08-Question-Hub-Page.md) | WU-FR8 `/q/:id` 中枢页 |
| [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) | 任何动 Practice / Notes / Home 接口的 PR |
| [10-NonFunctional](./10-NonFunctional.md) | 性能 / 限流 / 部署 |
| [11-Testing](./11-Testing.md) | invariant + e2e + 跨 Phase 集成测试 |
| [12-Debt-Management](./12-Debt-Management.md) | WU-R14 / WU-FR14 + 任何写 daily_limit / 打散 / ramp-up / is_hard 的代码 |
| [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) | WU-R13 / WU-FR9 修订 + LLM cause-analysis prompt 改造 |
| [14-Confidence-Rating](./14-Confidence-Rating.md) | WU-FR13 + 任何写 confidence × recall × SRS 路径的代码 |

阅读建议：
- 所有 agent：A0 → 00 → 01
- 后端 agent：A0 → 00 → 01 → 02 → 03 → 05/06/09/10/11/12/13/14（按 PR 范围）
- 前端 agent：A0 → 00 → 01 → 02 §6 → 04 → 07/08/09/11/12/13/14（按 PR 范围）

---

## 1. 一句话目标

把复盘 tab 从「错题时间倒序列表 + 占位智能复盘」升级为「默认今日 SRS 队列 + 智能三卡 + 周回顾 + 错因分析 + 题目中枢页」的完整复盘中枢，打透 P1（优先级排序）/ P2（防记忆假效应）/ P3（错因归纳）/ P4（节奏）四大核心痛点，与练习 / 笔记 / 首页双向联动。

---

## 2. 范围（详见 [00-Decisions §11](./00-Decisions.md#11-phase-review-范围明确)）

### 2.1 在范围内

- 复盘默认视图 `/review`：周回顾条 + SRS 今日队列 + 智能三卡
- 全部错题 `/review/all`：4 segment（错题 / 标记 / 手动 / 智能）+ 筛选 + 排序 + 多选批量
- 数据洞察 `/review/insights`：3 张图（错题趋势 / 错因聚类 / 再做正确率）
- 已掌握 `/review/graduated` + 归档区 `/review/archived`
- 题目中枢页 `/q/:id`：跨 tab 共用，复盘 / 练习 / 笔记 / 收藏夹 / 首页弱项卡 deep link 终点
- 错题重做 `/q/:id/redo`：脱壳，复用 PracticeSessionV2(source_mode=wrong_redo)
- AI 错因分析（按需触发）：单题 + 多题聚合
- SRS 排队引擎：简化版三档 + graduated；schema 预留 SM-2 字段
- 周回顾系统：实时聚合 + 一键生成笔记
- 跨 tab 联动：写入 / 读取 / 反向流契约（Practice / Notes / Home）

后端：
- ReviewItemV2 完整化（source_kind 枚举扩展 + SRS state 字段 + audit）
- ReviewAttemptV2 扩展（事件日志能力）
- 1 张新表 AiCauseAnalysisV2
- review / cause-analysis / weekly-review / insights 模块
- LLM 模块扩展 cause_analysis prompt（在 Phase-Home `modules/llm/` 内追加）
- cron：每周一 02:00 周回顾数据快照预生成
- audit + observability + e2e + OpenAPI

前端：
- domain `@sikao/domain/review/` 新建（替换 legacy `@sikao/domain/wrong-book/`）
- queries `reviewQueries / causeAnalysisQueries / weeklyReviewQueries`
- views：ReviewToday / ReviewAll / ReviewInsights / QuestionHub / QuestionRedo
- 11 个 legacy wrong-book 组件去留（部分复用，部分重写，部分删）
- 路由 redirect：/wrong-book/* / /practice/questions/:id 整族 → /review/* / /q/:id

### 2.2 不在范围内

- **题型分布饼图**（与错因聚类信息重复，砍）
- **365 天 GitHub 风格热力图**（观赏性 > 决策性，砍）
- **通知中心独立 view**（与首页 today list 职责重叠，能力下沉到默认视图顶部条 + Home，砍）
- **AI 错因自动订阅模式**（按需触发即可，避免烧 LLM 配额，砍）
- **WeeklyReviewSummaryV2 单独成表**（用 NoteV2(type=weekly_review) + 实时聚合替代，砍）
- **题目相似题推荐**（黑盒 AI 功能用户不用，砍）
- 错题导出 PDF / 打印 → 远期
- 跨用户错题对比 / 错题分享 → 远期
- 错题级 LLM 长对话讲题 → 远期（独立 ask Phase）
- 申论错题 / 错段复盘 → 申论无错题语义；EssayReportV2 + 范文对比已在 Phase-Practice
- 题库管理后台 → admin Phase
- 笔记主 view + 收藏夹 view → [Phase/Notes](../Notes/README.md)（本 Phase 仅读 NoteV2 / QuestionFavoriteV2）
- 富文本笔记编辑器 → Phase/Notes
- SM-2 / FSRS 完整算法 → 本 Phase 用简化版 + schema 预留，远期升级

---

## 3. 关键决策速查

完整决策见 [00-Decisions](./00-Decisions.md)。最高频引用：

| 决策 | 拍板 |
|---|---|
| **D-Review-Default-View** | 默认 = 今日 + 智能三卡 + 周回顾条（不展示"全部错题"，避免 P7 压垮） |
| **D-Question-Hub** | `/q/:id` 独立路由，跨 tab 共用 |
| **D-Fav-Location** | 收藏夹归 Notes tab，不进 SRS 队列；本 Phase 仅在题目中枢页提供"加入复盘"按钮 |
| **R-1** | 入队来源 = 多源（wrong_answer / flagged_persistent / re_failed / manual_add / note_card 五种 source_kind） |
| **R-2** | 队列 = 后端 ReviewItemV2；智能复盘 = 前端 S-front 聚合（与 IA-V2 D8 一致） |
| **R-3** | `/review/all` segment：错题 / 标记 / 手动 / 智能，不混杂 |
| **R-5** | 毕业语义：连续答对 N=2 次自动 graduated + 手动 mark_resolved 出口 |
| **R-6** | 删除 = 软删 archived（不物理删，保留审计） |
| **D-R1** | 重做复用 PracticeSessionV2(source_mode=wrong_redo)，不新建 review_session 表 |
| **D-R2** | 复盘 session 强制 practice_mode=per_question（与整组闭卷脱钩） |
| **D-R6** | AI 错因 100% 按需触发（详情页按钮 + 多题聚合按钮，无订阅模式） |
| **D-R8** | "加入计划"走 RecommendationV2 流（与 Home Rec-9 一致） |
| **D-R12** | SRS 状态机更新走 session.commit 同事务（实时） |
| **SRS-1** | 算法 = 简化版（correct_streak + 三档 1d/3d/7d → graduated）；schema 预留 SM-2 字段 |
| **SRS-3** | 答错回退一档（不回 new） |
| **SRS-6** | graduated 后再错重新入队（source_kind=re_failed，不覆盖原行） |
| **AI-Cause-3** | 错因输出结构：`{ summary, dimensions[{name, severity, suggestion}], suggested_actions, related_questions }` |
| **AI-Cause-7** | 缓存键 = (user_id, question_id, last_answer_hash)；快照变化即失效 |

---

## 4. 边界规则速查

详见 [01-Boundary-Rules](./01-Boundary-Rules.md)。

```
PR-R1   入队多源（5 种 source_kind），同题可有多条历史行
PR-R2   source_kind 不可变（一旦写入 immutable）
PR-R3   已下线 AI 题（QuestionV2.is_active=false）允许重做不允许重出
PR-R4   复盘 session 强制 per_question pace（前后端双校验，与 Practice Pace-Closed-Book 解耦）
PR-R5   graduated 后再错重新入队（新行 source_kind=re_failed），不覆盖原行
PR-R6   AI 错因失败不阻塞列表（503 + 文案兜底）
PR-R7   ReviewItemV2.question_id 与 metadata_json.source_note_id 互斥（CHECK 约束）
PR-R8   Cause Tag Enum + Override Audit（slug 必须在 cause_tag_v2 内 + parser 兜底 + override 写 audit）
PR-R9   Debt Management Invariants（daily_limit 不可绕过 / 打散不动 streak / ramp-up 与打散互斥 / hard cap multiplier）
PR-R10  SRS Optimistic Lock（任何 SRS 状态变更走 version CAS + Fail-Fast）
PR-R11  Confidence Rating Semantics（guess 不进毕业 / unsure 阻毕业 / certain+错 forced cause / ramp-up 隐藏 certain）
```

---

## 5. 总览估算

| 维度 | 估算 |
|---|---|
| 总行数（新增 + 删除） | ~14,000 |
| Backend / Frontend | 6,200 / 7,800 |
| PR 总数 | 28（R 14 + FR 14） |
| Backend 阶段 | 4-5 周 |
| Frontend 阶段 | 5-6 周 |
| 全程 | 9-11 周 |

---

## 6. 依赖图

```
WU-R1 ────────────────┐
                      ├─→ WU-R2 ─→ WU-R6 ─→ WU-R5 ─→ WU-R13 ─┐
                      ├─→ WU-R3 ──┐                            │
                      ├─→ WU-R4 ──┴─→ WU-R14 ──────────────────┤─→ WU-R10 ─→ WU-R11 ─→ WU-R12 ─→ WU-FR1
                      ├─→ WU-R7 ──────────────────────────────┤
                      ├─→ WU-R8 ──────────────────────────────┤
                      └─→ WU-R9 ──────────────────────────────┘

WU-FR1 ─→ WU-FR2 ─┬─→ WU-FR3 ─→ WU-FR4 ─→ WU-FR5 ──────────┐
                  │           └─→ WU-FR14 ───────────────────┤
                  ├─→ WU-FR6 / FR7 / FR8 / FR9 ──────────────┤─→ WU-FR10 ─→ WU-FR11 ─→ WU-FR12
                  │                  └→ WU-FR13 ─────────────┤
                  └────────────────────────────────────────────┘
```

WU 详细：
- 后端：[03-Backend-WU](./03-Backend-WU.md)
- 前端：[04-Frontend-WU](./04-Frontend-WU.md)

---

## 7. 阶段里程碑

```
M0   week 0          启动；本 plan 与子文档全部 review 通过
M1   week 1          WU-R1 完工：ReviewItemV2 完整化 + AiCauseAnalysisV2 建表
M2   week 2          WU-R2 + WU-R3：review CRUD + SRS engine（4 档间隔 + probationary + 乐观锁 version）
M3   week 2-3        WU-R4：跨 tab hook（Practice session.commit 写入 wrong_answer / re_failed）
M4   week 3          WU-R5 + WU-R6：cause-analysis 模块 + LLM prompt（含 evolution_context 注入位）
M5   week 3-4        WU-R7 + WU-R8 + WU-R9：weekly cron + insights 端点 + audit
M5b  week 4          WU-R13：Cause Taxonomy（cause_tag_v2 表 + seed + parser + override + admin invalidate）
M5c  week 4-5        WU-R14：Debt Management（snapshot / redistribute / ramp-up / hard 三 cron + re_fail_count hook）
M6   week 5          WU-R10 + WU-R11 + WU-R12：scheduler + e2e（11 PR-R + Debt + Taxonomy + Confidence invariant）+ OpenAPI
─────────────────────────────────────────────
M7   week 5-6        WU-FR1：API client + types
M8   week 6          WU-FR2 + WU-FR3：domain stores + queries
M9   week 6-7        WU-FR4：默认视图（周回顾条 + SRS 队列 + 三卡）
M10  week 7-8        WU-FR5 + WU-FR6 + WU-FR7：智能三卡聚合 + 全部错题视图 + 数据洞察
M11  week 8-9        WU-FR8：题目中枢页 `/q/:id`（跨 tab）
M12  week 9          WU-FR9 + WU-FR10：错因 UI（含 dimension override + EvolutionTimeline）+ 加入计划 CTA
M12b week 9-10       WU-FR13：Confidence Rating UI（4 档 prompt + badge + mismatch banner + session 状态机）
M12c week 10         WU-FR14：Debt Management UI（DebtBar 5 模式 + RampupBanner + HardQuestionBadge + Profile slider）
M13  week 10-11      WU-FR11：legacy wrong-book 路由 redirect + 组件去留清理
M14  week 11         WU-FR12：e2e（含 review-confidence + review-debt）+ a11y + 浏览器矩阵验收
```

---


### 7.3 Multica Child Matrix

> This table is the Review Phase execution ledger mirror.
> The parent Multica issue `SIK-45` and this table must stay semantically aligned.
> If they drift, update both in the same task before any child issue proceeds.

| Identifier | Milestone | Focus | Depends on | Status | Gate |
|---|---|---|---|---|---|
| `SIK-58` | `M0` | Review docs-only intake and SSOT lock | none | `done` | docs-only scoped validation + independent subagent review |
| `SIK-59` | `M1` | `WU-R1` Schema Migration | `SIK-58`, Phase-Home `WU-B1` | `done` | backend schema gate |
| `SIK-60` | `M2` | `WU-R2 + WU-R3 + WU-R4 + WU-R6` Review CRUD + SRS + cross-phase hook + prompts | `SIK-59`, Phase-Practice `session.commit hook`, Phase-Home `WU-B7` | `done` | backend runtime + prompt gate |
| `SIK-61` | `M3` | `WU-R5 + WU-R13` Cause Analysis + Taxonomy | `SIK-60` | `done` | LLM + taxonomy gate |
| `SIK-62` | `M4` | `WU-R7 + WU-R8 + WU-R9` Weekly + Insights + Audit | `SIK-60`, Phase-Home `WU-B8` | `backlog` | scheduler + observability gate |
| `SIK-63` | `M5` | `WU-R14` Debt Management | `SIK-60`, Phase-Home `WU-B8` | `backlog` | debt invariant gate |
| `SIK-64` | `M6` | `WU-R10` RecommendationV2 Integration | `SIK-60`, Phase-Home `RecommendationV2` | `backlog` | recommendation bridge gate |
| `SIK-65` | `M7` | `WU-R11 + WU-R12` OpenAPI lock + backend e2e | `SIK-59` through `SIK-64` | `backlog` | final backend gate |
| `SIK-66` | `M8` | `WU-FR1 + WU-FR2` API client + domain stores | `SIK-65`, `FE-SSOT-v2` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-67` | `M9` | `WU-FR3 + WU-FR4 + WU-FR5 + WU-FR6` ReviewToday + Smart + All + Insights | `SIK-66` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-68` | `M10` | `WU-FR7 + WU-FR8 + WU-FR9 + WU-FR10` QuestionHub + Redo + Cause + Weekly UI | `SIK-67` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-69` | `M11` | `WU-FR13 + WU-FR14` Confidence + Debt UI | `SIK-68` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-70` | `M12` | `WU-FR11 + WU-FR12` Route migration + e2e + a11y | `SIK-69` | `backlog` | frontend gate locked; must not enter `in_progress` |

### 7.4 Frontend Visual SSOT Gate

- Gate key: `FE-SSOT-v2`
- Unlock condition:
  - `docs/vault/04-design/Design-System.md` v2 is complete and ACCEPTED
  - `packages/design-system/src/tokens.css` is locked as the only token SSOT
  - Review-specific lint / visual / interaction constraints are written and executable
- Before unlock:
  - `SIK-66` through `SIK-70` stay in `backlog`
  - no Review frontend issue may enter `in_progress`
  - docs-only discussion, prototype comparison, and requirement clarification are allowed; implementation ledger movement is not

### 7.5 Cross-Phase Blocked Conditions

| Blocked item | Condition | Owner |
|---|---|---|
| `SIK-59` | Phase-Home `WU-B1` not complete | Home |
| `SIK-60` | Phase-Practice `session.commit hook` not ready, or Phase-Home `WU-B7` not complete | Practice / Home |
| `SIK-62` / `SIK-63` | Phase-Home `WU-B8` scheduler substrate not complete | Home |
| `SIK-64` | `RecommendationV2` contract not stable | Home |
| `SIK-66` through `SIK-70` | `FE-SSOT-v2` still locked | Design System / Frontend governance |
| any implementation Review child issue | `SIK-58` SSOT intake not closed | Review |

## 8. 完工门槛

详见各 WU 文档与 [11-Testing §6](./11-Testing.md#6-完工-gate)。

### 8.1 后端 M6
- [ ] pytest 全绿（含 11 PR-R invariant / Debt / Taxonomy / Confidence / e2e / audit / observability / scheduler）
- [ ] alembic upgrade head 干净（往返通过；含 0033 cause_tag seed 16 行）
- [ ] OpenAPI drift 测试 0 diff（含 Cause Override / Debt 4 端点 / cause-tags list）
- [ ] LLM mock provider 跑通 cause_analysis_single / cause_analysis_group / cause_analysis_forced / cause_analysis_deep
- [ ] 真 provider 手动跑通 cause-analysis 端到端 + parser fallback 触发 metric
- [ ] 3 个新 cron job（debt_severity_evaluator / hard_question_detector / rampup_phase_advancer）幂等通过

### 8.2 前端 M14
- [ ] vitest 全绿（含 e2e + a11y + review-confidence + review-debt）
- [ ] tsc strict 0 errors
- [ ] 9 lint:* 全过
- [ ] bundle 预算未超
- [ ] 桌面 + 移动 viewport e2e 全过
- [ ] axe-core 0 violation（含 DebtBar 5 模式 / ConfidencePrompt / HardQuestionBadge）
- [ ] 暗色模式 smoke
- [ ] /wrong-book/* / /review/items/* / /practice/questions/* 老路径 redirect 全部测试覆盖

---

## 9. 启动前置（关键依赖）

| 依赖项 | 状态 | 必须吃完 |
|---|---|---|
| [Phase/Home](../Home/README.md) 完工 | ACCEPTED · 详细规格完成 | 必须 M0 之前完工（ReviewItemV2 audit / RecommendationV2 / WeaknessSnapshotV2 / LLM 模块基础设施） |
| [Phase/Practice](../Practice/README.md) 完工 | ACCEPTED · 详细规格完成 | 必须 M0 之前完工（QuestionV2 source/category 字段 / PracticeSessionV2 source_mode / QuestionFlagV2 / Flag-AutoReview hook） |
| [Phase/Notes](../Notes/README.md) NoteV2 schema | ACCEPTED · 详细规格完成 | Phase-Practice 已提前升级 NoteV2.linked_question_id；本 Phase 仅消费，不再升 schema |
| 4→5 tab 升级 | Phase-Home WU-F7 范围 | 必须 M7 之前完工（否则 `/review` 路由不能成 tab） |

> **本 Phase 的 schema 改动只动 review_items_v2 / review_attempts_v2 / 新建 ai_cause_analysis_v2**，不再动 question_v2 / practice_session_v2 / note_v2（Phase-Practice 已扩展完毕）。

---

## 10. 风险与回退

完整风险表见 [10-NonFunctional §11](./10-NonFunctional.md)。

回退策略：**项目未上线，不需回退方案**。出现重大缺陷时：
- 后端：重置 alembic 到 Phase-Practice last 标记点 + 重置代码
- 前端：revert 到 last-known-good 的 git tag（保留 IA-V2 决策不回退）

---

## 11. 变更流程

修改本 Phase 任一决策：
1. 在对应子文档（00-11）写 `~~删除线~~` + 新决策行 + 拍板日期
2. 同步更新引用方
3. 已开始实现时，PR description 标 `BREAKING DECISION CHANGE: D-X`
4. 索引（本文）「3. 关键决策速查」如涉及高频决策也要更新

新增子文档时：
1. 加到本文 §0 表格
2. 在被引用方加引用矩阵条目
3. AGENTS-H6 Define First：先有 plan 文档，才能有实现 PR

---

## 12. 后续工作（不在本 Phase）

- 错题导出 PDF / 打印
- 跨用户错题对比（"和你同水平的人这题正确率 30%"）
- 错题级 LLM 长对话讲题（独立 ask Phase 远期）
- 申论错段复盘
- SM-2 / FSRS 完整算法（schema 已预留字段）
- 错题"分享给好友" / 错题排行榜
- 复盘 dashboard 升级（更多图表）
- 错题级评论 / 协同复盘（Stage 2 多用户）

---

## 13. 关联文档

- [../README.md](../README.md) — Phase 总入口
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md) — IA 决策 SSOT（D 系列原始来源）
- [../Home/README.md](../Home/README.md) — Phase-Home（依赖项）
- [../Practice/README.md](../Practice/README.md) — Phase-Practice（依赖项 + 入队写入侧）
- [../Notes/README.md](../Notes/README.md) — Phase-Notes（收藏夹归属 + AI 摘要 → 复盘卡）
- [../../../03-tech/Architecture.md](../../../03-tech/Architecture.md) — 技术架构
- [../../../04-design/Design-System.md](../../../04-design/Design-System.md) — 设计系统硬约束
- [../../../../../AGENTS.md](../../../../../AGENTS.md) — 顶层硬规则（H1-H10）

---

## 14. 视觉原型参考

落地 `/review` + 4 子路由 + 题目中枢页（V5 token + shell SSOT，记账见 SIK-85）：

| view | 路由 | 原型文件 |
|---|---|---|
| ReviewToday（默认 = 今日 + 智能三卡 + 周回顾条） | `/review` | [`.tmp_review/out/Tab3-Review/Review Today v1.html`](../../../../.tmp_review/out/Tab3-Review/Review%20Today%20v1.html) |
| ReviewAll（4 segment + 题目 table + 分页 + 批量栏） | `/review/all` | [`.tmp_review/out/Tab3-Review/Review All v1.html`](../../../../.tmp_review/out/Tab3-Review/Review%20All%20v1.html) |
| ReviewInsights（错题趋势 + 错因聚类气泡 + 再做正确率提升 + AI 洞察） | `/review/insights` | [`.tmp_review/out/Tab3-Review/Review Insights v1.html`](../../../../.tmp_review/out/Tab3-Review/Review%20Insights%20v1.html) |
| ReviewGraduated（毕业卡片墙 + 邮戳） | `/review/graduated` | [`.tmp_review/out/Tab3-Review/Review Graduated v1.html`](../../../../.tmp_review/out/Tab3-Review/Review%20Graduated%20v1.html) |
| ReviewArchived（归档 table + 归档原因 + 恢复 actions） | `/review/archived` | [`.tmp_review/out/Tab3-Review/Review Archived v1.html`](../../../../.tmp_review/out/Tab3-Review/Review%20Archived%20v1.html) |
| 题目中枢页（跨 tab 共用） | `/q/:id` | [`.tmp_review/out/_cross/Question Hub v2.html`](../../../../.tmp_review/out/_cross/Question%20Hub%20v2.html) |

历史 V4 一屏混合视图（`Review.html` / `Review v1.html` / `Review Redo v1.html`）保留作版本对照，新实施以上面 v1 子路由原型为准（D-Review-Default-View）。



