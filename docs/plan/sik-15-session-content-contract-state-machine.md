---
type: engineering
status: draft
owner: xiaodeng
last-reviewed: 2026-05-20
source: multica
multica-issue: SIK-15
---

# SIK-15 Session/Content Contract And State Machine

## Goal

修复 `/api/v2/practice/sessions*` 的 Phase 1 skeleton 漏洞，让 create/save/submit/result 的契约、落库结构和终态约束一致。

## Current Evidence

- `PracticeSessionCreateRequestV2` 定义了 `paper_code` 和 `question_ids`，但 `SessionServiceV2.create_session()` 只写 `track`、`entry_kind`、`payload_json`，没有落到 `paper_id` / `revision_id` / answer 层或其他持久字段。
- `entry_kind` 在 `db/schemas_v2.py` 允许 `max_length=64`，但 `db/models_v2.py` 和 `1003_session_and_grading_v2_tables.py` 都是 `String(32)`。
- `save_answers()` 不检查 session 状态；`submit()` 只把状态改成 `submitted`，提交后仍可再次写答案。
- `practice_session_answers_v2` 只有 `(session_id, display_order)` 索引，没有 `(session_id, question_key)` 唯一约束。

## Define-First Boundary

- `PracticeSessionCreateRequestV2`
  - `paperCode` / `questionIds` 的接受与持久化语义
  - skeleton 阶段允许哪些字段只进入 `payload_json`，哪些必须映射到结构化列
- `PracticeSessionV2.status`
  - `draft -> in_progress -> submitted`
  - `submitted` 为终态，提交后禁止写答案
- `PracticeSessionAnswerV2`
  - 同一 `session_id + question_key` 唯一
  - `question_key` 是否继续允许 null；若允许，唯一约束要避开 null 污染路径

## Ownership

本 issue 独占以下文件的业务修改权：

- `services/api/src/sikao_api/modules/session/interface/routes.py`
- `services/api/src/sikao_api/modules/session/application/service.py`
- `services/api/src/sikao_api/db/schemas_v2.py`
- `services/api/src/sikao_api/db/models_v2.py`
- `database/migrations/alembic/versions/1003_session_and_grading_v2_tables.py`

测试优先新增独立文件，避免改共享 skeleton 测试：

- `services/api/tests/test_phase1_backend_session_v2.py`

## Implementation Outline

1. 对齐 request schema、ORM、migration 的字段长度和唯一约束。
2. 明确 skeleton 阶段 `paperCode` / `questionIds` 的持久化落点。
3. 在 service 层加 submitted 终态守卫，提交后写答案直接报错。
4. 补 create/save/submit/result 的回归测试与冲突测试。

## Tests

- create session 时 `paperCode` / `questionIds` 的持久化断言
- entry_kind 长度契约与 DB 一致
- submit 后再次写答案返回明确错误
- 同 session 重复 `questionKey` 不会插入第二条记录
- migration 升级后唯一约束存在

## Overlap And Coordination

- `SIK-17` 不改 `1003_session_and_grading_v2_tables.py` 的业务语义；其只处理 Alembic env、runtime schema、CORS 与 infra tests。
- `SIK-16` 不改 session v2 ORM / migration；它只碰 dashboard/progress/review/record。
- 若为了结构化落库需要读取 `papers_v2` / `paper_revisions_v2`，只改 session service，不扩散到 content router。

## Acceptance Mapping

- create / save answers / submit / result 契约与落库结构一致
- submitted 后再次写答案返回明确错误
- 同 session 同 question_key 不能重复插入
- 新增/修正测试覆盖以上行为
