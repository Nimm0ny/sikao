# Sikao 练习中心 Phase 落地 Plan（索引）

> **Status**: ACCEPTED
> **Scope**: 一级导航 Tab 2 = 练习（Section A 历史记录 + B 专项练习 + C 套卷练习）+ 答题闭环 + 自定义刷题 + AI 出题 + 申论批改
> **原则**：完整落地（不走最小化路线）/ 后端先行 / 前端 UI 最后做 / 每 PR 受 AGENTS H9 约束（≤15 文件 / ≤400 行）
> **Last Updated**: 2026-05-26
> **Phase 父目录**：[../README.md](../README.md)

> ⚠️ **开工前必读**：[A0-Codebase-Reality-Check.md](./A0-Codebase-Reality-Check.md)
>
> 本 Phase 的 00-10 文档基于 IA 决策稿编写，描述的是**目标态**。**A0** 记录代码现实与目标的 delta（题库 schema / session 现状 / `modules/llm` 已存在 / 申论 V2 模型已建表但路由没暴露 等）。子文档与 A0 §11 冲突时**以 A0 为准**。
>
> **2026-05-21 口径重定基线**：Practice 当前只消费 Phase-Home 的后端关键输出（`B1 / B7 / B8 / B9 / M6`）与相应契约锁定；旧 Home 前端 `F1-F8` 不再视为本 Phase 的前置。

>
> **2026-05-26 issue-ledger closeout**：`SIK-19` 现在只承担 Practice backend epic 收口；`SIK-26~SIK-28` 保留为历史前端映射，不再作为新前端执行的 active parent。
---

## 0. 如何阅读本 Phase

本文是入口索引，不含详细规格。每个 agent / PR 应只读自己所需的子文档。

子文档目录：`docs/vault/05-migration/Phase/Practice/`（本目录）

| 子文档 | 何时读 |
|---|---|
| [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) | **任何 PR 开工前必读**（题库现状 / session 现状 / 申论 V2 现状 / 与 Phase-Home delta） |
| [00-Decisions](./00-Decisions.md) | 任何 PR 开工前；决策冲突时以本文档为准（路径冲突时以 A0 为准） |
| [01-Boundary-Rules](./01-Boundary-Rules.md) | 写题源 / 答题节奏 / 异步批改 / 题级笔记任何业务逻辑前 |
| [02-Data-Model](./02-Data-Model.md) | WU-B10 / B11 / B12 / B13 类型生成 |
| [03-Backend-WU](./03-Backend-WU.md) | 后端 WU-B10~B30 总盘 |
| [04-Frontend-WU](./04-Frontend-WU.md) | 前端 WU-F9~F22 总盘 |
| [05-LLM-Module](./05-LLM-Module.md) | WU-B22（在 Phase-Home `modules/llm/` 上扩展 3 个能力） |
| [06-LLM-Prompts](./06-LLM-Prompts.md) | WU-B22 + 任何调 prompt 的代码 |
| [07-AI-Question-Engine](./07-AI-Question-Engine.md) | WU-B18 / WU-B22.1 / WU-F14 / WU-F15 |
| [08-NonFunctional](./08-NonFunctional.md) | 性能 / 安全 / 限流 / AI 出题成本控制 |
| [09-Observability-Audit](./09-Observability-Audit.md) | 任何写入 audit / metrics / log 的 PR |
| [10-Testing](./10-Testing.md) | WU-B24 / WU-F18 + 每 PR 测试约束 |

阅读建议：
- 所有 agent：先读 [A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) → [00-Decisions](./00-Decisions.md)
- 后端 agent：A0 → 00 → 01 → 02 → 03 →（按 PR 范围）05/06/07/08/09/10
- 前端 agent：A0 → 00 → 01 → 02 §6 → 04 →（按 PR 范围）07/08/09/10

---

## 1. 一句话目标

把练习 tab 从「stub catalog + 单一 session 闭环」升级为以「二级分类历史成绩 + 专项/套卷双入口 + 自定义刷题 + AI 出题（池子优先 + 实时生成）+ 申论 AI 批改 + 题级笔记/收藏/标记联动」为骨架的完整 V2 形态，全程后端先行、AI 落地、审计与可观测齐备。

---

## 2. 范围（详见 [00-Decisions §11](./00-Decisions.md#11-phase-practice-范围明确)）

**在范围内**：
- 练习中心 `/practice` 一屏 view（Section A/B/C）+ 顶部快捷区
- 答题路由 `/practice/sessions/:id` + 结果路由 `/practice/sessions/:id/result`
- AI 出题等待页 `/practice/ai-questions/generating`
- 申论批改详情 `/practice/sessions/:id/grading`
- 后端：题库 schema 扩展 / content 端点真实化 / session 多 mode + 答题中操作 / favorites + question_flags 模块 / practice_stats 模块 / ai_questions 模块 / daily_practice 模块 / essay_grading 模块扩展 / LLM 模块扩展 / 真题数据导入 / cron 扩展 / timing / session_lifecycle / mock_exam / practice_preferences / question_report / audit / observability
- 数据：QuestionV2 / PracticeSessionV2 / PracticeSessionAnswerV2 / NoteV2 / ReviewItemV2 五表扩展；新建 PracticeStatsSnapshotV2 / QuestionFavoriteV2 / QuestionFlagV2 / EssayReferenceAnswerV2 / EssayReferenceFeedbackV2 / AiGeneratedQuestionRequestV2 / DailyPracticeV2 / QuestionTimingBaselineV2 / UserPracticePreferencesV2 / KnowledgePointV2 / QuestionKnowledgePointV2 / QuestionReportV2

**不在范围内**：
- 错题专项页（独立 [Phase/Review](../Review/README.md)）
- 笔记主 view（独立 [Phase/Notes](../Notes/README.md)；本 Phase 仅扩展 NoteV2.linked_question_id 让题级笔记能创建）
- BindEmail/Phone/CompleteProfile（推 [Phase/Profile](../Profile/README.md)）
- Onboarding / DiagnosisResult（推 [Phase/Onboarding](../Onboarding/README.md)）
- 申论人工批改入口（D-Q4 选项 D，远期）
- 题库管理后台（admin tab，未来）
- 移动端适配

---

## 3. 关键决策速查

完整决策见 [00-Decisions](./00-Decisions.md)。最高频引用：

| 决策 | 拍板 |
|---|---|
| Q-Source | 题源 = **真题 + AI 出题**（取消独立"模拟题"概念） |
| Q3 / D-Q1 | AI 题与真题同表 QuestionV2，`source` 字段区分；LLM 改编而非凭空生成 |
| D-Q13 | AI 出题三段退化：① 池子用户没做过的 → ② 池子用户已做的 → ③ LLM 实时生成 |
| D-Q8 | AI 出题同步等待（10-15s 转圈） |
| D-Q9 | LLM 自审 + 用户反馈双层质量控制 |
| D-Q10 / D-Q15 | 取消"背题模式"；改"答题节奏"= 逐题 / 整组（默认整组，**严格闭卷**） |
| D-Q12 | 标记不确定 = 基础（本次 session 内）+ 拓展（持久化进复盘队列） |
| D-Q4 / D-Q16 | 申论 AI 批改 + 范文对比；批改异步（提交即返结果页 pending） |
| D-Q5 / D-Q17 | 题级笔记走 NoteV2.linked_question_id；仅自己可见；Tab 4 可一键跳题 |
| Q2 / D-Q3 / D-Q11 | 二级分类；snapshot + 实时聚合 + 百分位三层；02:00 cron + session.submit 增量 |
| Q7 / D-Q6 | 每日一练 = 用户主动点（一定做新题），与首页推荐边界清晰 |

---

## 4. 边界规则速查

详见 [01-Boundary-Rules](./01-Boundary-Rules.md)。

```
PR1 真题 / AI 题等价对待（同表 + source 字段）
PR2 source 字段 immutable
PR3 AI 题生成失败 ≠ 用户失败（503 + 引导切真题）
PR4 已下线（quality_score < 阈值 / 举报多）的 AI 题不出现在新出题中，但已答题用户能复盘
PR5 进度数据完全独立于 PlanEventV2.status（继承 Phase-Home P2/P3）
PR6 整组模式严格闭卷（前后端双校验）
PR7 题级笔记可见性仅创建者
PR8 申论批改异步（submit 立即返回 result pending → cron 写 EssayReportV2 → 通知）
```

---

## 5. 总览估算

| 维度 | 估算 |
|---|---|
| 总行数（新增 + 删除） | ~37,100 |
| Backend / Frontend | 20,500 / 16,600 |
| PR 总数 | ~132（B 78 + F 54，详见 03 / 04） |
| Backend 阶段 | 旧 7-9 周口径失效，待按 B25-B30 重估 |
| Frontend 阶段 | 旧 5-6 周口径失效，待按 F19-F22 重估 |
| 全程 | 以 03 / 04 最新 WU 拆分为准（旧 12-15 周口径失效） |

> 估算说明：本数字与 `03-Backend-WU §0` / `04-Frontend-WU §0` 最新总览表一致。较旧口径继续上调，原因是把 `B25-B30` 与 `F19-F22` 也纳入当前 Phase 主体，而不是留在“声明了但没有详细 WU”状态。

---

## 6. 依赖图

### 6.1 与 Phase-Home 的强依赖

```
Phase-Home WU-B1 (DB schema 基础)        ──→ Tab 2 WU-B10 / B11（QuestionV2 / Session 字段扩展）
Phase-Home WU-B7 (modules/llm 框架)      ──→ Tab 2 WU-B22（在同一模块上扩展 3 能力）
Phase-Home WU-B8 (cron 框架)             ──→ Tab 2 WU-B23（注册 4 新 cron + 1 hook）
Phase-Home WU-B9 (OpenAPI 锁定)          ──→ Tab 2 WU-F9（前端 types 重生成）
```

### 6.2 Tab 2 内部依赖图（详）

```
                                ┌───── B22 (LLM 模块扩展)
                                │      （依赖 Phase-Home WU-B7）
                                │
B10 (QuestionV2) ───┬─→ B14 (content)
                    │
                    ├─→ B15 (session 多 mode + 答题中操作)
                    │   依赖：B10 / B11 / B12
                    │
                    ├─→ B17 (practice_stats)
                    │   依赖：B11 / B12
                    │
                    ├─→ B18 (ai_questions)        ◄── B22
                    │   依赖：B10 / B12 / B22
                    │
                    ├─→ B21 (真题 import)
                    │   依赖：B10
                    │
                    ├─→ B29 (question_metadata 仅 schema)
                    │   依赖：B10
                    │
                    └─→ B30 (question_report)
                        依赖：B10 + B23.1 (cron hook)

B11 (Session/Note/Review 扩展) ──┬─→ B15 / B16 / B17
                                 │
                                 ├─→ B25 (timing 模块)
                                 │   依赖：B11
                                 │
                                 ├─→ B26 (session_lifecycle 模块)
                                 │   依赖：B11
                                 │
                                 └─→ B27 (mock_exam 模块)
                                     依赖：B11 / B26（state_machine + start hook）

B12 (新表 5 个) ──┬─→ B15 / B16 / B17 / B18 / B19
                  │
B13 (申论范文 2 表)─┴─→ B20 (essay_grading)  ◄── B22
                       依赖：B13 / B22

B17 ─→ B19 (daily_practice)

B28 (practice_preferences 模块)
  依赖：Phase-Home 用户体系（独立模块，无 Tab 2 内部强依赖）
  下游：B27 mock_exam create / B19 daily_practice 读偏好作为默认值

B14 ~ B22 全部完成 ─→ B23 (cron 扩展，仅基础 4 cron + 1 hook)
                     依赖：B17 / B18 / B19 / B20

B25 / B26 / B27 / B30 各自的 cron 在自己 WU 内实现
（baseline / cleanup / expire / auto_submit / ai_cleanup hook）

B23 ─→ B24 (E2E + OpenAPI 锁定)
       依赖：B10-B23

B25 / B26 / B27 / B28 / B29 / B30 完工 ─→ B24 同步含其 e2e

B24 ─→ F9 (api-client + queries)
       │
F9 ─→ F10 (stores) ─┐
                     │
                     ├─→ F11 (Section A 历史)
                     ├─→ F12 (Section B 专项)
                     ├─→ F13 (Section C 套卷)
                     ├─→ F14 (自定义刷题)
                     ├─→ F15 (AI 等待 + 答题扩展)
                     ├─→ F16 (申论批改)
                     ├─→ F19 (timing 上报与展示)
                     │   依赖：B25
                     ├─→ F20 (session-lifecycle 与 active session)
                     │   依赖：B26
                     ├─→ F21 (mock-exam 模考 UI)
                     │   依赖：B27
                     └─→ F22 (practice-preferences UI)
                         依赖：B28
                            │
                            ↓
                          F17 (整合 + 老 view 删除)
                            │
                            ↓
                          F18 (E2E + a11y，含 F19-F22 模块场景)
```

WU 详细：
- 后端：[03-Backend-WU](./03-Backend-WU.md)
- 前端：[04-Frontend-WU](./04-Frontend-WU.md)
- 后端依赖详细矩阵：[03-Backend-WU §26](./03-Backend-WU.md#26-与-phase-home-wu-的依赖图详)

---

## 6.3 Multica Ledger Map

> **2026-05-26 closeout note**
> - `SIK-19` 的 active closeout scope 只看 backend child：`SIK-20~SIK-25`，当前均已 `done`。
> - `SIK-26~SIK-28` 继续保留在表内，供历史追溯；它们不再阻塞 `SIK-19` 收口。
> - `M11-M19` 仍是 Practice phase 的前端规格里程碑，但自 2026-05-25 起已不再挂在 `SIK-19` 这个 backend epic 下执行。

当前仓内 SSOT 与 Multica 子 issue 映射如下：先看 `SIK-19` 的 active closeout scope，再看仅供追溯的 historical frontend mapping。

### 6.3.1 Active closeout scope (`SIK-19`)

| Multica | Tranche | Scope | Status |
|---|---|---|---|
| `SIK-20` | `P0 / M0` | docs-only intake + gate / dependency / child map 锁定 | `done` |
| `SIK-21` | `P1 / M1-M3` | `B10 / B11 / B12 / B13 / B21 / B29` | `done` |
| `SIK-22` | `P2 / M4` | `B14 / B16 / B17` | `done` |
| `SIK-23` | `P3 / M5` | `B15 / B25 / B26 / B27` | `done` |
| `SIK-24` | `P4 / M6-M7` | `B22 / B18 / B19` | `done` |
| `SIK-25` | `P5 / M8-M10` | `B20 / B23 / B24 / B28 / B30` | `done` |

### 6.3.2 Historical frontend mapping

| Multica | Tranche | Scope | Status |
|---|---|---|---|
| `SIK-26` | `P6 / M11-M12` | `F9 / F10` | `done` |
| `SIK-27` | `P7 / M13-M15` | `F11 / F12 / F13 / F14 / F22` | `done` |
| `SIK-28` | `P8 / M16-M19` | `F15 / F16 / F17 / F18 / F19 / F20 / F21` | `done` |

`SIK-20` 的作用不是新增实现，而是把这份映射、Home 依赖门槛、以及 `B25-B30 / F19-F22` 的 latest-doc 口径固定到 repo SSOT，防止后续执行回退到旧的 `B10-B24 / F9-F18` 拆法。

`SIK-19` 自身的 closeout hook：在 `SIK-20~SIK-25` 完整证据链齐备后，父 issue 仍需单独回写 final Evidence Block，显式引用 `SIK-118` 已接管前端 active ledger，然后才能从 `in_progress` 切到 `done`。

---

## 7. 阶段里程碑

⚠️ **latest-doc 说明**：下面的 `M0-M19` 仍保留为顶层主脊柱，但已经不再穷尽当前 Phase 的全部 WU。

- Backend：`B25-B30` 必须在 `M10 / WU-B24` 最终 gate 前完成并进入同一套 e2e / OpenAPI / invariant 收口。
- Frontend：`F19-F22` 与 `F11-F16` 平行展开，由 `F17` 整合，并在 `M19 / WU-F18` 最终验收中一并覆盖。
- 详细拆分以 `03-Backend-WU §19-§24` 与 `04-Frontend-WU §12-§15` 为准。

```
M0   week 0          启动；本 plan review 通过，后续按 Phase-Home 后端门槛逐段解锁
M1   week 1          WU-B10：QuestionV2 字段扩展完工
M2   week 2-3        WU-B11 + WU-B12 + WU-B13：所有新表/字段就位
M3   week 3          WU-B21：真题数据 import 脚本就绪（用户本机执行实际导入）
M4   week 4          WU-B14 + WU-B16 + WU-B17：基础 CRUD（content/favorites/flags/stats）就位
M5   week 5-6        WU-B15：session 多 mode + 答题中操作端点
M6   week 6-7        WU-B22：LLM 模块扩展（question/essay/reference）
M7   week 7-8        WU-B18 + WU-B19：ai_questions + daily_practice
M8   week 8-9        WU-B20：essay_grading 异步流程
M9   week 9          WU-B23：cron 扩展
M10  week 9-10       WU-B24：e2e + OpenAPI 锁定
─────────────────────────────────────────────
M11  week 10-11      WU-F9：API client 全套
M12  week 11         WU-F10：domain stores
M13  week 11-12      WU-F11：Section A 历史记录
M14  week 12         WU-F12 + WU-F13：Section B + Section C
M15  week 12-13      WU-F14：自定义刷题对话框
M16  week 13         WU-F15：AI 出题等待 + 答题 view 扩展
M17  week 13-14      WU-F16：申论 view + 异步批改
M18  week 14         WU-F17：整合 + 老 view 删除
M19  week 14-15      WU-F18：e2e 验收
```

### 7.1 与 Phase-Home 的并行可能性

| 时机 | 可并行项 |
|---|---|
| Phase-Home WU-B1 完成 | Tab 2 WU-B10 可启动 |
| Phase-Home WU-B7 完成 | Tab 2 WU-B22 可启动（同一 modules/llm/ 内扩展） |
| Phase-Home WU-B8 完成 | Tab 2 WU-B23 可启动（追加 4 个 cron + 1 hook） |
| Phase-Home WU-B9 完成 | Tab 2 WU-F9 启动 |

旧 Home 前端 `F1-F8` 仅属于 Home 自身的 legacy runtime 轨，不作为本 Phase 后端或规划推进的前置。

**保守串行估算**：旧 `12-15 周` 口径已失效；需按 `B25-B30 / F19-F22` 纳入后的最新 WU 重新估算。
**理想并行估算**：待在 `03-Backend-WU` / `04-Frontend-WU` 最新拆分基础上重算，不再沿用旧值。

### 7.2 真题数据导入时机

- **预备**：用户在 M3 之前提供真题数据格式样本（JSON/CSV/SQL dump）
- **WU-B21 完工**（M3）：脚本就绪
- **正式导入**：用户在本机运行（生产环境数据）
- **数据量预估**：用户已说"全量真题数据"，可能数千到数万道

---

## 8. 完工门槛

详见各 WU 文档与 [10-Testing §6](./10-Testing.md#6-完工-gate)。

### 8.1 后端 M10
- [ ] B25-B30 相关 invariant / cron / module e2e 已纳入同一套 backend gate，而不是停留在详细 WU 文档层
- [ ] pytest 全绿（含 invariant / e2e / audit / observability）
- [ ] alembic upgrade head 干净（含本 Phase 7+ 个新 migration）
- [ ] OpenAPI drift 测试 0 diff
- [ ] LLM mock provider 跑通所有新 prompt（question/essay/reference）
- [ ] 真 LLM provider 手动跑通 AI 出题 / 申论批改 / 范文生成 各一次
- [ ] 真题 import 脚本 dry-run + 小批量正式导入测试通过

### 8.2 前端 M19

> 这是 Practice phase 的前端总体验收门槛，继续作为规格保留；但在 2026-05-25 的前端解耦之后，它不再阻塞 `SIK-19` backend epic 的 closeout。
- [ ] F19-F22 模块场景（timing / lifecycle / mock-exam / preferences）已进入最终前端验收，而不是只停留在新增 WU 草案
- [ ] vitest 全绿（含 e2e + a11y）
- [ ] tsc strict 0 errors
- [ ] 9 lint:* 全过
- [ ] bundle 预算未超
- [ ] 桌面 + 移动 viewport e2e
- [ ] axe-core 0 violation
- [ ] 整组模式严格闭卷验证（前后端双校验）

---

## 9. 风险与回退

完整风险表见 [08-NonFunctional §11](./08-NonFunctional.md#11-风险表汇总)。

回退策略：**项目未上线，不需回退方案**。出现重大缺陷时：
- 后端：重置 alembic 到上一标记点 + 重置代码
- 前端：revert 到 last-known-good 的 git tag

---

## 10. 变更流程

修改本 Phase 任一决策：
1. 在对应子文档（00-10）写 `~~删除线~~` + 新决策行 + 拍板日期
2. 同步更新引用方
3. 已开始实现时，PR description 标 `BREAKING DECISION CHANGE: D-X`
4. 索引（本文）的「3. 关键决策速查」如涉及高频决策也要更新

新增子文档时：
1. 加到本文 §0 表格
2. 在被引用方加引用矩阵条目
3. AGENTS-H6 Define First：先有 plan 文档，才能有实现 PR

---

## 11. 后续工作（不在本 Phase）

- 错题专项页 → [Phase/Review](../Review/README.md)
- 笔记主 view + 双向链接 → [Phase/Notes](../Notes/README.md)
- 申论人工批改入口（D-Q4 选项 D） → 远期
- 题库管理后台 → 远期 admin Phase
- 收藏夹分组（QuestionFavoriteV2 加 folder_id） → 远期
- 题目元数据 Phase 2 完整能力（端点 / cron / LLM 标注 / 数据填充） → 后续独立 Phase
- AI 出题"自动评分"（基于用户答题反推 LLM 改编质量） → 远期
- 跨用户笔记共享（D-Q17 visibility 枚举预留） → 远期
- 跨用户模考排行榜 / 同水平对比 → 远期
- 离线题库下载（移动端） → 远期

---

## 12. 关联文档

- [../README.md](../README.md) — Phase 总入口（其他 Phase 导航）
- [../Home/README.md](../Home/README.md) — 首页 Phase（前置依赖）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md) — IA 决策 SSOT
- [../../Migration-Status.md](../../Migration-Status.md) — 整体迁移现状
- [../../../03-tech/Architecture.md](../../../03-tech/Architecture.md) — 技术架构
- [../../../04-design/Design-System.md](../../../04-design/Design-System.md) — 设计系统硬约束
- [../../../../../AGENTS.md](../../../../../AGENTS.md) — 顶层硬规则（H1-H10）

---

## 13. 视觉原型参考

落地 Section A/B/C + 答题闭环 + AI 等待 + 申论批改 + 模考三件套 + 时间分析（V5 token + shell SSOT，记账见 SIK-85）：

| view | 路由 | 原型文件 |
|---|---|---|
| Practice 中心（Section A/B/C） | `/practice` | [`.tmp_review/out/Tab2-Practice/Practice v1.html`](../../../../.tmp_review/out/Tab2-Practice/Practice%20v1.html) |
| 行测答题（V5 对齐 v2） | `/practice/sessions/:id` | [`.tmp_review/out/Tab2-Practice/Exam Xingce v2.html`](../../../../.tmp_review/out/Tab2-Practice/Exam%20Xingce%20v2.html) |
| 申论答题（V5 双栏材料/作答） | `/practice/sessions/:id`（申论 scope） | [`.tmp_review/out/Tab2-Practice/Exam Shenlun v2.html`](../../../../.tmp_review/out/Tab2-Practice/Exam%20Shenlun%20v2.html) |
| SessionResult（脱壳 hero ring + 逐题概览 + 下一步） | `/practice/sessions/:id/result` | [`.tmp_review/out/Tab2-Practice/Session Result v1.html`](../../../../.tmp_review/out/Tab2-Practice/Session%20Result%20v1.html) |
| EssayGradingResult（hero + 4 维分项 + 原文+批注） | `/practice/sessions/:id/grading` | [`.tmp_review/out/Tab2-Practice/Essay Grading Result v1.html`](../../../../.tmp_review/out/Tab2-Practice/Essay%20Grading%20Result%20v1.html) |
| AiQuestionsGenerating | `/practice/ai-questions/generating` | [`.tmp_review/out/Tab2-Practice/Ai Questions Generating v1.html`](../../../../.tmp_review/out/Tab2-Practice/Ai%20Questions%20Generating%20v1.html) |
| MockExamStartView | `/practice/mock-exam/start` | [`.tmp_review/out/Tab2-Practice/Mock Exam Start v1.html`](../../../../.tmp_review/out/Tab2-Practice/Mock%20Exam%20Start%20v1.html) |
| MockExamHistoryView | `/practice/mock-exam/history` | [`.tmp_review/out/Tab2-Practice/Mock Exam History v1.html`](../../../../.tmp_review/out/Tab2-Practice/Mock%20Exam%20History%20v1.html) |
| MockExamComparisonView | `/practice/mock-exam/:id/comparison` | [`.tmp_review/out/Tab2-Practice/Mock Exam Comparison v1.html`](../../../../.tmp_review/out/Tab2-Practice/Mock%20Exam%20Comparison%20v1.html) |
| PracticeStatsTimingView | `/practice/stats/timing` | [`.tmp_review/out/Tab2-Practice/Practice Stats Timing v1.html`](../../../../.tmp_review/out/Tab2-Practice/Practice%20Stats%20Timing%20v1.html) |

PracticePreferences（6 子树偏好）实施位置在 `/profile/practice-preferences`，原型见 Phase/Profile §8。Exam Xingce v1 / Shenlun v1 是 V4 时期版本，保留作对照，新实施以 v2 为准。
