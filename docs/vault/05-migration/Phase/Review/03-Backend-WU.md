# Phase-Review · 03 · Backend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) · [02-Data-Model](./02-Data-Model.md)

---

## 概述

14 个后端 Work Unit（WU-R1 ~ WU-R14），按依赖顺序排列。每 WU 对应 1 个 PR（AGENTS H9: ≤15 文件 / ≤400 行）。

---

## WU-R1 · Schema Migration

**描述**：ReviewItemV2 新增列 + AiCauseAnalysisV2 建表 + 索引补充。

| 端点 | 无（纯 schema） |
|---|---|
| **预计行数** | ~180（迁移脚本 + model 改动） |
| **依赖** | Phase-Home WU-B1 完工（AuditLogV2 / IdempotencyKeyV2 / LlmCallV2 表已就位） |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/db/models_v2.py` | ReviewItemV2 追加 correct_streak / next_review_at；注释 metadata_json shape |
| `services/api/src/sikao_api/db/models_v2.py` | 新增 AiCauseAnalysisV2 class |
| `services/api/src/sikao_api/db/enums_v2.py` | 新增 ReviewSourceKind / ReviewItemStatus / ReviewAttemptOutcome / CauseAnalysisScope 枚举 |
| `services/api/alembic/versions/0030_review_extend_review_items_v2.py` | 迁移：add_column + create_table + create_index |
| `tests/api/test_migrations.py` | 追加 smoketest（upgrade + downgrade 往返） |

**测试要求**：
- `alembic upgrade head` + `alembic downgrade -1` 往返成功
- 新索引在空表 + 有数据表均可用

---

## WU-R2 · Review CRUD Module

**描述**：完整化 `modules/review/` 的 list / detail / create(manual_add) / graduate / archive / restore 端点。重写既有 4 个 stub 端点。

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| list_review_items | GET | `/api/v2/review/items` | 筛选(source_kind/status/题型/时间窗) + 排序(created_at/next_review_at/correct_streak) + 分页 |
| get_review_item | GET | `/api/v2/review/items/{item_id}` | 详情 + SRS 状态 + 操作列表 + 历史 |
| create_review_item | POST | `/api/v2/review/items` | source_kind=manual_add；409 若已有 active 行 |
| graduate_item | PATCH | `/api/v2/review/items/{item_id}/graduate` | 手动毕业 |
| archive_item | PATCH | `/api/v2/review/items/{item_id}/archive` | 软删归档 |
| restore_item | PATCH | `/api/v2/review/items/{item_id}/restore` | 恢复（从 archived → pending, streak=0） |
| batch_action | POST | `/api/v2/review/items/batch` | 批量 archive/restore/graduate |

| 预计行数 | ~380 |
|---|---|
| **依赖** | WU-R1 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/interface/routes.py` | 重写 4 stub + 新增 3 端点 |
| `services/api/src/sikao_api/modules/review/application/service.py` | CRUD 业务逻辑 |
| `services/api/src/sikao_api/modules/review/application/validators.py` | PR-R7 互斥校验 + PR-R1 manual_add 去重 |
| `services/api/src/sikao_api/db/schemas_v2.py` | ReviewItemResponseV2 / ReviewItemCreateV2 / ReviewItemBatchActionV2 |
| `tests/api/modules/review/test_crud.py` | 覆盖：list 筛选 / create 409 / graduate / archive / restore / batch |

**测试要求**：
- list：无数据 → 空；有数据 → 筛选 / 排序 / 分页正确
- create：manual_add 成功 / 重复 409 / PR-R7 校验失败 422
- graduate/archive/restore：状态机转换正确 + ReviewAttemptV2 事件记录
- 用户隔离：A 用户看不到 B 用户数据

---

## WU-R3 · SRS Engine Service

**描述**：实现间隔重复核心计算逻辑（SRS-1 ~ SRS-7 决策落地）。

| 端点 | 无（内部 service，不直接暴露端点） |
|---|---|
| **预计行数** | ~200 |
| **依赖** | WU-R1 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/application/srs_engine.py` | compute_next_review / advance_on_correct / regress_on_incorrect / check_graduation |
| `services/api/src/sikao_api/modules/review/application/srs_constants.py` | INTERVALS / GRADUATION_THRESHOLD / RECALL_BONUS_MULTIPLIER |
| `tests/api/modules/review/test_srs_engine.py` | 12 场景覆盖（见 05-SRS-Engine §8 测试矩阵） |

**测试要求**：
- 12 场景全覆盖（见 [05-SRS-Engine](./05-SRS-Engine.md) 测试矩阵）
- 时区边界测试（跨午夜 / UTC+8）
- 费曼加成 interval * 2
- SM-2 预留字段不被修改（algorithm_version = simple_v1）

---

## WU-R4 · Cross-Phase Hook（re_failed 检测）

**描述**：在 session.commit 路径检测"已 graduated 题目再做答错"，自动创建 re_failed 新行。

| 端点 | 无（hook，不直接暴露端点） |
|---|---|
| **预计行数** | ~120 |
| **依赖** | WU-R1, WU-R3 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/application/hooks.py` | on_session_commit_check_re_failed() |
| `services/api/src/sikao_api/modules/practice/application/session_service.py` | 在 commit 路径调用 review hook（1 行 import + 1 行 call） |
| `tests/api/modules/review/test_re_failed_hook.py` | 场景：graduated 后答错 → 新行 / 未 graduated 答错 → 无操作 / 多题 graduated 批量 |

**测试要求**：
- graduated 题答错 → 新行 source_kind=re_failed, original_review_item_id 正确
- 未 graduated 题答错 → 无额外行
- 同一题多次 graduated + re_failed 循环（不报错，每次新行）
- 与 Practice wrong_answer hook 不冲突（两个 hook 独立）

---

## WU-R5 · Cause Analysis Module

**描述**：单题 + 多题聚合 AI 错因分析端点，含 LLM 调用、幂等、缓存检查。

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| cause_analysis_single | POST | `/api/v2/review/items/{item_id}/cause-analysis` | 单题错因 |
| cause_analysis_group | POST | `/api/v2/review/cause-analysis/group` | 多题聚合错因 |

| 预计行数 | ~350 |
|---|---|
| **依赖** | WU-R2, WU-R6（prompt 模板） |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/interface/routes.py` | 追加 2 端点 |
| `services/api/src/sikao_api/modules/review/application/cause_analysis_service.py` | 业务逻辑：缓存检查 → LLM 调用 → 结果解析 → 持久化 |
| `services/api/src/sikao_api/modules/review/application/cause_analysis_cache.py` | input_hash 计算 / 缓存命中判定 / TTL 管理 |
| `services/api/src/sikao_api/db/schemas_v2.py` | CauseAnalysisRequestV2 / CauseAnalysisGroupRequestV2 / CauseAnalysisResponseV2 |
| `tests/api/modules/review/test_cause_analysis.py` | 覆盖：缓存命中 / 缓存失效 / LLM 成功 / LLM 超时 / 限流 / 幂等 |

**测试要求**：
- 缓存命中 → 不调 LLM，返回缓存
- input_hash 变化（last_answer_hash 改变）→ 重新调 LLM
- LLM 超时 → 503 + 审计日志
- 日限额耗尽 → 429
- 幂等键重复 → 返回同一结果

---

## WU-R6 · LLM Prompt Addition

**描述**：在 Phase-Home `modules/llm/` 追加 cause_analysis_single / cause_analysis_group prompt 模板。

| 端点 | 无（模块内部） |
|---|---|
| **预计行数** | ~150 |
| **依赖** | Phase-Home WU-B7 完工（LLM 框架就位） |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/llm/prompts/cause_analysis_single.py` | prompt 模板 + 变量插槽 |
| `services/api/src/sikao_api/modules/llm/prompts/cause_analysis_group.py` | prompt 模板 + 变量插槽 |
| `services/api/src/sikao_api/modules/llm/parsers/cause_analysis_parser.py` | JSON 输出解析 + 校验 |
| `tests/api/modules/llm/test_cause_analysis_prompts.py` | prompt 渲染 + parser 解析 |

**测试要求**：
- prompt 模板渲染无异常（所有 placeholder 填充）
- parser 解析合法 JSON → 结构正确
- parser 解析非法 JSON → 优雅降级 + 错误标记

---

## WU-R7 · Weekly Cron + Weekly Summary Endpoint

**描述**：APScheduler job，每周一 02:00（用户本地时区）预计算上周数据快照写入 metadata_json；同时实现 `GET /review/weekly-summary` HTTP 端点供前端消费。

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| weekly_summary | GET | `/api/v2/review/weekly-summary?week=YYYY-WW` | 返回周回顾摘要（优先读 cron 预生成快照，fallback 实时聚合） |

| 预计行数 | ~180 |
|---|---|
| **依赖** | WU-R2, Phase-Home WU-B8（APScheduler 框架） |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/interface/routes.py` | 追加 weekly_summary 端点 |
| `services/api/src/sikao_api/modules/review/application/weekly_service.py` | 周回顾聚合逻辑 + cron 预生成 |
| `services/api/src/sikao_api/cron/weekly_review_snapshot.py` | job 函数：聚合 + 写入 metadata |
| `services/api/src/sikao_api/cron/__init__.py` | 注册新 job |
| `services/api/src/sikao_api/db/schemas_v2.py` | WeeklySummaryResponseV2 |
| `tests/api/modules/review/test_weekly_summary.py` | 覆盖：有数据 / 无数据 / cron 预生成 / fallback 实时聚合 |
| `tests/api/cron/test_weekly_review_snapshot.py` | 覆盖：有数据 / 无数据 / 重复执行幂等 |

**测试要求**：
- GET weekly-summary 有 cron 快照 → 返回快照数据
- GET weekly-summary 无快照（首次 / cron 未跑）→ fallback 实时聚合
- 有上周数据 → 正确聚合写入
- 无数据 → 不报错，写空快照
- 重复执行 → 幂等（覆盖旧值）

---

## WU-R8 · Insights Endpoints

**描述**：`/review/insights/` 下 3 个端点（趋势 / 错因聚类 / 再做正确率），90 天窗口。

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| insights_trends | GET | `/api/v2/review/insights/trends` | 90d 每日入队/毕业/净累积 |
| insights_causes | GET | `/api/v2/review/insights/causes` | 错因维度频次条形图 |
| insights_redo_accuracy | GET | `/api/v2/review/insights/redo-accuracy` | 按周聚合再做正确率 |

| 预计行数 | ~250 |
|---|---|
| **依赖** | WU-R2, WU-R5 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/interface/routes.py` | 追加 3 端点 |
| `services/api/src/sikao_api/modules/review/application/insights_service.py` | 聚合查询逻辑 |
| `services/api/src/sikao_api/db/schemas_v2.py` | InsightsTrendsResponseV2 等 |
| `tests/api/modules/review/test_insights.py` | 覆盖：有数据 / 无数据 / 边界日期 |

**测试要求**：
- 90d 窗口正确（不超出）
- 无数据 → 空数组（不报错）
- 错因聚类依赖 AiCauseAnalysisV2 有数据时才有内容
- 再做正确率：分母为 0 时 accuracy_pct = 0

---

## WU-R9 · Audit + Observability

**描述**：结构化日志事件 + metrics 埋点（SRS advances / graduations / cause-analysis calls）。

| 端点 | 无（中间件 / decorator） |
|---|---|
| **预计行数** | ~120 |
| **依赖** | WU-R2, WU-R3, WU-R5 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/application/audit.py` | 审计事件定义 + emit 函数 |
| `services/api/src/sikao_api/modules/review/application/metrics.py` | Prometheus-style counters（进程内） |
| `services/api/src/sikao_api/modules/review/application/service.py` | 在关键路径追加 audit.emit() 调用 |
| `tests/api/modules/review/test_audit.py` | 覆盖：关键操作产生正确审计事件 |

**测试要求**：
- graduate 操作 → 产生 graduated 审计事件
- cause-analysis 调用 → 记录 llm_call_id + 耗时
- archive/restore → 产生对应审计事件

---

## WU-R10 · RecommendationV2 Integration

**描述**：扩展 RecommendationV2 支持 type=review_session，实现"加入计划"accept 流。

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| create_review_recommendation | POST | `/api/v2/review/items/{item_id}/add-to-plan` | 创建 Recommendation |
| （accept 走 Home 既有端点） | PATCH | `/api/v2/recommendations/{id}/accept` | 接受 → 建 session |

| 预计行数 | ~150 |
|---|---|
| **依赖** | WU-R2, Phase-Home RecommendationV2 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/interface/routes.py` | 追加 add-to-plan 端点 |
| `services/api/src/sikao_api/modules/review/application/recommendation_bridge.py` | 桥接 RecommendationV2 创建 |
| `services/api/src/sikao_api/modules/home/application/recommendation_service.py` | accept handler 扩展（type=review_session → 建 PracticeSessionV2） |
| `tests/api/modules/review/test_recommendation_bridge.py` | 覆盖：创建 / accept / 重复创建幂等 |

**测试要求**：
- 创建 recommendation → type=review_session, linked_review_id 正确
- accept → PracticeSessionV2(source_mode=wrong_redo) 正确建立
- 重复创建 → 幂等返回现有 recommendation

---

## WU-R13 · Cause Taxonomy（词典 + parser + override + cache）

**描述**：建 cause_tag_v2 词典表 + seed 16 行 + LLM prompt enum 注入 + parser 兜底 + 用户 override 端点 + admin invalidate-cache 端点。落地 [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) §3 / §4 / §5 / §6 / §9。

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| override_cause_dimension | PATCH | `/api/v2/review/cause-analysis/{analysis_id}/dimensions/{dimension_index}` | 用户覆盖 LLM 单维度 slug / severity / note |
| invalidate_cause_tag_cache | POST | `/admin/cause-tag/invalidate-cache` | 超管：强制刷新 VALID_SLUGS 进程内 set |
| list_cause_tags | GET | `/api/v2/review/cause-tags` | 给前端 override modal 拉当前 active 词典 |

| 预计行数 | ~310 |
|---|---|
| **依赖** | WU-R5（cause-analysis service）, WU-R6（LLM prompt 模板）|
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/db/models_v2.py` | 新增 CauseTagV2 class（slug uniq + (category, display_order) 复合索引 + is_active 索引） |
| `services/api/src/sikao_api/db/enums_v2.py` | 新增 TaxonomyCategory(knowledge/reasoning/state/other) / CauseTagSeverity(high/medium/low)；ReviewAttemptOutcome 追加 CAUSE_TAG_OVERRIDDEN |
| `services/api/alembic/versions/0033_review_seed_cause_tags.py` | 建表 + seed 16 行（15 业务 + other）；taxonomy_version='v1' |
| `services/api/src/sikao_api/modules/review/data/cause_tag_seed_v1.py` | seed 数据源（slug / name / category / severity_default / description / display_order） |
| `services/api/src/sikao_api/modules/llm/parsers/cause_analysis_parser.py` | VALID_SLUGS 启动加载 + 5min TTL；非 enum 强制归 other + `_llm_original` 保留；severity 校验（high/medium/low）；大小写归一化 |
| `services/api/src/sikao_api/modules/review/application/cause_override_service.py` | override_cause_dimension：require_owner + slug 校验 + user_override 写入 + 不删 LLM 原 slug + audit emit + bump version |
| `services/api/src/sikao_api/modules/review/application/effective_slug.py` | get_effective_slug helper：user_override 优先；DB 端 jsonb COALESCE 表达式（供聚类 SQL 复用） |
| `services/api/src/sikao_api/modules/review/interface/routes.py` | 追加 PATCH override + POST admin invalidate-cache + GET list_cause_tags |
| `services/api/src/sikao_api/db/schemas_v2.py` | DimensionOverrideRequestV2 / CauseTagListResponseV2 |
| `tests/api/modules/review/test_cause_taxonomy.py` | 覆盖 [13 §9](./13-Cause-Taxonomy.md#9-测试矩阵) TX1-TX15 |

**测试要求**：
- alembic upgrade head 后 cause_tag_v2 表 16 行（is_active=true 全部）
- LLM 输出非 enum slug → 强制归 other + `_llm_original` 保留 + `cause_taxonomy.other_fallback` metric +1
- LLM 输出大写 slug → 归一化为小写后命中（TX4）
- LLM 输出 deprecated（is_active=false）slug → 归 other + warning log（TX5）
- 用户 override 写入 user_override 块；dim.slug 改为 overridden；dim._llm_original_slug 保留；ReviewAttemptV2 行 outcome=CAUSE_TAG_OVERRIDDEN
- 用户覆盖到非法 slug → 422 InvalidCauseTagError
- 聚类 SQL：用户 override 后 Insights-3 条形图按 effective_slug 计数（TX8）
- POST invalidate-cache 仅 super_user 可用（403 for normal user）；调用后下次校验从 DB 重读
- 同题第二次分析 result_json.evolution_context.previous_analysis_id 不为 null（TX9）；第一次分析 evolution_context.previous_analysis_id=null（TX10）
- evolution chain 超过 max_depth=5 时 prompt 仅注入最近 1 次（TX11）

---

## WU-R14 · Debt Management（打散 + ramp-up + 难题专项）

**描述**：复盘债务核算 + heavy 自动打散 + 7d 断档 ramp-up + is_hard 标记。在 session.commit hook 中维护 re_fail_count 与 confidence_mismatch_count（自动晋升 is_hard）。落地 [12-Debt-Management](./12-Debt-Management.md) §3 / §4 / §5 / §8。

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| get_debt_snapshot | GET | `/api/v2/review/debt/snapshot` | severity + overdue_count + oldest_overdue_days + ramp-up status |
| trigger_redistribute | POST | `/api/v2/review/debt/redistribute` | 用户主动打散；severity ≥ moderate 才允许 |
| skip_rampup | POST | `/api/v2/review/debt/skip-rampup` | 用户跳过保护；写 audit + 立即触发打散 |
| get_redistribute_plan | GET | `/api/v2/review/debt/plan` | 已打散的未来 N 日分布预览（modal 数据源） |

| 预计行数 | ~390 |
|---|---|
| **依赖** | WU-R3（SRS 主字段）, WU-R4（cross-phase hook） |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/modules/review/application/debt_service.py` | compute_debt / classify_severity / 主入口聚合 + GET snapshot 实现 |
| `services/api/src/sikao_api/modules/review/application/debt_redistribution.py` | redistribute_debt 算法（spread_days = ceil(overdue/daily_limit), cap 14；按 next_review_at 升序均分；写 original_overdue_at；不动 streak） |
| `services/api/src/sikao_api/modules/review/application/debt_rampup.py` | should_trigger_rampup（last_attempt ≥ 7d）+ 5 阶段节奏表（10/15/20/25/limit）+ phase advance + day_5 后触发一次打散 |
| `services/api/src/sikao_api/modules/review/application/debt_hard_question.py` | mark_is_hard（re_fail≥3 OR total_wrong≥5+acc<30% OR mismatch≥2 OR avg_time>2x）+ clear_is_hard（4 连对或用户 fresh start，re_fail_count 保留作审计） |
| `services/api/src/sikao_api/modules/review/application/hooks.py` | 扩展 WU-R4 hook：graduated 后再失败时 re_fail_count += 1；confidence_mismatch_count 累积达 2 时晋升 is_hard |
| `services/api/src/sikao_api/db/enums_v2.py` | 新增 DebtSeverity / DebtStatus / RampupPhase；ReviewAttemptOutcome 追加 DEBT_REDISTRIBUTED / DEBT_DEFERRED / RAMPUP_STARTED / RAMPUP_PHASE_CHANGED / RAMPUP_COMPLETED / HARD_MARKED / HARD_CLEARED / CONFIDENCE_MISMATCH |
| `services/api/src/sikao_api/cron/debt_severity_evaluator.py` | 每日 03:00（用户本地时区）：severity=heavy 自动 redistribute；critical 触发 ramp-up |
| `services/api/src/sikao_api/cron/hard_question_detector.py` | 每日 03:30：扫描条件并写 is_hard + 写 HARD_MARKED audit |
| `services/api/src/sikao_api/cron/rampup_phase_advancer.py` | 每日 00:30：phase day_1 → day_2 → ... → day_5 推进 + 完成后触发一次打散 |
| `services/api/src/sikao_api/cron/__init__.py` | 注册 3 个 job；幂等性约束（重跑不重算） |
| `services/api/src/sikao_api/modules/review/interface/routes.py` | 追加 4 端点（POST /redistribute 校验 severity ≥ moderate） |
| `services/api/src/sikao_api/db/schemas_v2.py` | ReviewDebtSnapshotV2 / RedistributePlanV2 / SkipRampupResponseV2 |
| `services/api/src/sikao_api/modules/user/profile_service.py` | profile_v2.info 4 字段（review_daily_limit ∈ [10,100] / review_debt_redistribute_enabled / review_rampup_enabled / review_hard_question_auto_deep_analysis） |
| `tests/api/modules/review/test_debt_redistribution.py` | D1-D4, D9, D14, D15 |
| `tests/api/modules/review/test_debt_rampup.py` | D5-D8, D13 |
| `tests/api/modules/review/test_debt_hard_question.py` | D10-D12 |

**测试要求**：
- D1-D15 全覆盖（见 [12 §10](./12-Debt-Management.md#10-测试矩阵)）
- 打散：correct_streak / algorithm_version / version 字段不被修改（PR-R9 invariant）
- ramp-up 期间打散互斥（cron 检查 ramp_up_protected 标志，不动 next_review_at）
- HARD 题答对：multiplier cap at ×1.0（recall+certain 也不翻倍）；unsure ×0.5 惩罚保留（`min(1.0, multiplier)`）
- 4 个端点：unauthenticated 401；severity=none 调 redistribute 返回 422；幂等键重复返回同一结果
- 3 个 cron job 重复执行幂等（重跑不重算 / 不重复 audit）
- profile.review_daily_limit ∈ [10, 100]；越界 422
- 每个 cron job 必须 user-by-user 处理；单用户失败不阻塞其他用户

---

## WU-R11 · OpenAPI Spec Update + Drift Test

**描述**：更新 OpenAPI spec 文件，确保与实际路由一致；追加 drift 检测测试。

| 端点 | 无 |
|---|---|
| **预计行数** | ~120 |
| **依赖** | WU-R2 ~ WU-R10 + WU-R13 + WU-R14 全部完成 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/openapi.json` | 更新全部 review 端点 schema |
| `tests/api/test_openapi_drift.py` | 追加 review 模块端点覆盖 |

**测试要求**：
- `pytest tests/api/test_openapi_drift.py` 全绿
- 新增端点均有 request/response schema 定义
- 无 untyped any 字段

---

## WU-R12 · E2E pytest

**描述**：端到端集成测试，覆盖 11 条 PR-R 边界规则 + SRS 状态机 + Debt / Confidence / Taxonomy / 跨 tab 联动。

| 端点 | 无（纯测试） |
|---|---|
| **预计行数** | ~480 |
| **依赖** | WU-R1 ~ WU-R11 + WU-R13 + WU-R14 全部完成 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `tests/api/e2e/test_review_invariants.py` | 11 条 PR-R 边界 invariant |
| `tests/api/e2e/test_srs_state_machine.py` | SRS 4 档间隔 + probationary + 乐观锁 全路径 |
| `tests/api/e2e/test_debt_invariants.py` | Debt-1~8 决策不变量 + 打散 / ramp-up 互斥 |
| `tests/api/e2e/test_taxonomy_invariants.py` | Taxonomy-1~9 决策不变量 + parser fallback / override |
| `tests/api/e2e/test_confidence_invariants.py` | Confidence-1~7 决策不变量 + mismatch 强制路径 |
| `tests/api/e2e/test_cross_tab_review.py` | 练习答错→复盘可见 / 复盘加入计划→首页 / re_failed 新行 |

**测试要求**：
- 11 条 PR-R invariant 全覆盖（见 [01-Boundary-Rules](./01-Boundary-Rules.md)）
- SRS 12 场景 + 4 档间隔 + probationary + 乐观锁 CAS 全覆盖（见 [05-SRS-Engine](./05-SRS-Engine.md)）
- Debt：D1-D15 全覆盖（见 [12-Debt-Management](./12-Debt-Management.md) §10）
- Taxonomy：TX1-TX15 全覆盖（见 [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) §9）
- Confidence：C1-C15 全覆盖（见 [14-Confidence-Rating](./14-Confidence-Rating.md) §10）
- 跨 tab：练习 session.commit → ReviewItemV2 自动创建 → list 可见
- 跨 tab：graduated 后 Practice session 答错 → re_failed 新行
- `pytest -q` 全绿（AGENTS H8）

---

## 依赖图

```
WU-R1 ────────────────┐
                      ├─→ WU-R2 ─→ WU-R6 ─→ WU-R5 ─→ WU-R13 ─┐
                      ├─→ WU-R3 ──┐                            │
                      ├─→ WU-R4 ──┴─→ WU-R14 ──────────────────┤─→ WU-R10 ─→ WU-R11 ─→ WU-R12
                      ├─→ WU-R7 ──────────────────────────────┤
                      ├─→ WU-R8 ──────────────────────────────┤
                      └─→ WU-R9 ──────────────────────────────┘
```

---

## 引用矩阵

| 本文被引用 |
|---|
| [README.md](./README.md) §6 依赖图 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR1 依赖后端完工 |
| [11-Testing](./11-Testing.md) 后端测试清单 |
| [12-Debt-Management](./12-Debt-Management.md) WU-R14 实施总盘 |
| [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) WU-R13 实施总盘 |
| [14-Confidence-Rating](./14-Confidence-Rating.md) WU-R3/R4 修订（confidence 参数贯穿）|
