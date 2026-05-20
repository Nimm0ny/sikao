---
type: engineering
status: draft
owner: xiaodeng
last-reviewed: 2026-05-20
source: multica
multica-issue: SIK-17
---

# SIK-17 Infra Migrations Tests Alignment

## Goal

修复 Phase 1 backend skeleton 的 infra 对齐问题：CORS 预检、Alembic metadata 视图、runtime schema 初始化策略，以及对应测试覆盖。

## Current Evidence

- `main.py` 的 `CORSMiddleware.allow_methods` 只有 `GET/POST/PATCH/DELETE/OPTIONS`，没有新的 `PUT`。
- `create_app()` 在 SQLite 下默认执行 `db.create_all()`；`DatabaseManager.create_all()` 同时导入 `models` 和 `models_v2` 后直接 `Base.metadata.create_all(self.engine)`。
- `database/migrations/alembic/env.py` 的 `target_metadata` 只来自 `sikao_api.db.models.Base.metadata`；runtime 侧则额外显式导入 `models_v2` 再 `create_all()`。
- 当前 phase1 测试已覆盖部分 happy path，但缺少专门的 CORS preflight、runtime/alembic metadata 对齐、以及本轮 infra 关注点的集中测试。

## Define-First Boundary

- CORS
  - Phase 1 v2 notes/profile 的 `PUT` preflight 必须通过
- Runtime schema policy
  - `create_all()` 是否继续保留，只允许作为 SQLite/test convenience，不得与 Alembic 视图漂移
- Alembic metadata
  - `target_metadata` 必须覆盖 runtime 真实看到的 ORM 集合

## Ownership

本 issue 独占以下文件的 infra 修改权：

- `services/api/src/sikao_api/main.py`
- `services/api/src/sikao_api/db/session.py`
- `database/migrations/alembic/env.py`

测试优先新增独立文件：

- `services/api/tests/test_phase1_backend_infra_v2.py`

仅在必要时最小修改：

- `services/api/tests/test_phase1_backend_migrations.py`

## Implementation Outline

1. 对齐 CORS `allow_methods`，覆盖 v2 `PUT` 写接口。
2. 明确 runtime `create_all()` 只服务于 SQLite/test 的边界。
3. 让 Alembic `target_metadata` 与 runtime 导入集合一致，消除 autogenerate 漂移源。
4. 补 preflight、metadata 对齐和 startup 策略测试。

## Tests

- notes/profile `PUT` 的 OPTIONS preflight 允许 `PUT`
- runtime `create_all()` 能看到与 Alembic 相同的 v2 表集合
- migration upgrade head 后新旧表仍共存
- auth / records / session 的已有业务测试不因 infra 修复回退

## Overlap And Coordination

- `SIK-15` 独占 `1003_session_and_grading_v2_tables.py`；本 issue 不改其中表结构语义。
- `SIK-16` 独占 dashboard/review/record 的业务聚合；本 issue 不改其业务逻辑。
- 若 infra 测试需要引用 records mixed 或 auth 401，只写成回归断言，不回头修改业务实现文件。

## Acceptance Mapping

- notes/profile 的 PUT preflight 成功
- Alembic 与运行时 schema 视图一致
- Phase 1 测试覆盖本轮 infra 风险
