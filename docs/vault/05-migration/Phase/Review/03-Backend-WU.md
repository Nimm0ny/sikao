# Phase-Review · 03 · Backend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[A0-Codebase-Reality-Check](./A0-Codebase-Reality-Check.md) · [02-Data-Model](./02-Data-Model.md)

---

## 概述

12 个后端 Work Unit（WU-R1 ~ WU-R12），按依赖顺序排列。每 WU 对应 1 个 PR（AGENTS H9: ≤15 文件 / ≤400 行）。

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

## WU-R7 · Weekly Cron

**描述**：APScheduler job，每周一 02:00（用户本地时区）预计算上周数据快照写入 metadata_json。

| 端点 | 无（cron job） |
|---|---|
| **预计行数** | ~130 |
| **依赖** | WU-R2, Phase-Home WU-B8（APScheduler 框架） |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `services/api/src/sikao_api/cron/weekly_review_snapshot.py` | job 函数：聚合 + 写入 metadata |
| `services/api/src/sikao_api/cron/__init__.py` | 注册新 job |
| `tests/api/cron/test_weekly_review_snapshot.py` | 覆盖：有数据 / 无数据 / 重复执行幂等 |

**测试要求**：
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

## WU-R11 · OpenAPI Spec Update + Drift Test

**描述**：更新 OpenAPI spec 文件，确保与实际路由一致；追加 drift 检测测试。

| 端点 | 无 |
|---|---|
| **预计行数** | ~100 |
| **依赖** | WU-R2 ~ WU-R10 全部完成 |
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

**描述**：端到端集成测试，覆盖 7 条 PR-R 边界规则 + SRS 状态机 + 跨 tab 联动。

| 端点 | 无（纯测试） |
|---|---|
| **预计行数** | ~400 |
| **依赖** | WU-R1 ~ WU-R11 全部完成 |
| **文件改动** | |

| 文件 | 变更 |
|---|---|
| `tests/api/e2e/test_review_invariants.py` | 7 条 PR-R 边界 invariant |
| `tests/api/e2e/test_srs_state_machine.py` | SRS 状态机全路径 |
| `tests/api/e2e/test_cross_tab_review.py` | 练习答错→复盘可见 / 复盘加入计划→首页 / re_failed 新行 |

**测试要求**：
- 7 条 PR-R invariant 全覆盖（见 [01-Boundary-Rules](./01-Boundary-Rules.md)）
- SRS 12 场景全覆盖（见 [05-SRS-Engine](./05-SRS-Engine.md)）
- 跨 tab：练习 session.commit → ReviewItemV2 自动创建 → list 可见
- 跨 tab：graduated 后 Practice session 答错 → re_failed 新行
- `pytest -q` 全绿（AGENTS H8）

---

## 依赖图

```
WU-R1 ────────────────┐
                      ├─→ WU-R2 ─┬─→ WU-R5 ──┐
                      │          │           │
                      │          └─→ WU-R6 ──┤
                      ├─→ WU-R3 ─────────────┤─→ WU-R10 ─→ WU-R11 ─→ WU-R12
                      ├─→ WU-R4 ─────────────┤
                      ├─→ WU-R7 ─────────────┤
                      ├─→ WU-R8 ─────────────┤
                      └─→ WU-R9 ─────────────┘
```

---

## 引用矩阵

| 本文被引用 |
|---|
| [README.md](./README.md) §6 依赖图 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR1 依赖后端完工 |
| [11-Testing](./11-Testing.md) 后端测试清单 |
