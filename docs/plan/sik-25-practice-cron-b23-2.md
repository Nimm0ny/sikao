---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-24
source: multica
multica-issue: SIK-25
---

# SIK-25 Practice Cron B23.2 Slice

## Goal

收口 `B23.2`：把 `compute_reference_quality` 接到当前 scheduler 基座，按范文反馈信号重算 `quality_score`，并驱动 `draft/public/archived` 状态收敛。

## Define-First Boundary

### Scheduler Surface

- 复用现有 `services/api/src/sikao_api/core/home_scheduler.py`
- 新增 recurring job
  - `practice.reference_quality.recompute`
  - `05:00`
  - timezone=`Asia/Shanghai`
- 复用 `HomeRuntimeOrchestrator` sync wrapper
- 失败处理沿用现有 scheduler 约定
  - 不静默吞错
  - APScheduler listener 记录失败

### Cron Module Surface

- 新增 `services/api/src/sikao_api/cron/reference_quality_cron.py`
  - `recompute_reference_quality(session: Session, *, publish_like_threshold: int = 3, publish_favorite_threshold: int = 2, archive_quality_threshold: float = 2.5, archive_report_threshold: int = 5) -> ReferenceQualityCronResult`
- 返回值至少包含
  - `updated_count`
  - `published_count`
  - `archived_count`

### Quality Score Formula

- 仅重算 `EssayReferenceAnswerV2`
- 完全依赖表上已由 trigger 同步好的三组计数
  - `likes_count`
  - `favorites_count`
  - `report_count`
- 评分公式：
  - `base = 5.0`
  - `likes_bonus = min(likes_count * 0.05, 1.0)`
  - `favorites_bonus = min(favorites_count * 0.15, 1.5)`
  - `reports_penalty = report_count * 0.5`
  - `quality_score = clamp(base + likes_bonus + favorites_bonus - reports_penalty, 0.0, 5.0)`
- 该公式比 AI 题质量公式多给 `favorite` 更高权重，因为范文的“我要保留回看”比“点赞”更强

### Status Transition Semantics

- `official`
  - 只重算 `quality_score`
  - 不被本 cron 自动改状态
- `user_contributed` / `ai_generated`
  - 若 `ai_self_audit_passed = false`，强制 `archived`
  - 若 `quality_score < 2.5`，强制 `archived`
  - 若 `report_count >= 5`，强制 `archived`
  - 若当前 `status = draft` 且满足以下任一条件，则转 `public`
    - `likes_count >= 3`
    - `favorites_count >= 2`
  - 若当前 `status = public` 且不命中归档条件，则保持 `public`
  - 若当前 `status = archived`，本 cron 不自动恢复为 `public`
- `published_at`
  - `draft -> public` 时若为空则写当前时间
  - 归档时不清空，保留首次公开时间

### Audit Semantics

- 只有状态真的变化时才写 `reference.status_change`
- `before` 至少含
  - `status`
  - `quality_score`
  - `report_count`
- `after` 至少含
  - `status`
  - `quality_score`
- `metadata.reason`
  - `quality_published`
  - `quality_score<2.5`
  - `report_count>=5`
  - `ai_self_audit_failed`

### Query Surface Compatibility

- `GET /api/v2/practice/essay/questions/{question_id}/reference-answers`
  - 仍只返回 `status=public`
  - 排序保持不变：`official > user_contributed > ai_generated`，同 source 内 `quality_score DESC, id ASC`
- 本 slice 不改 route contract，不改 OpenAPI

### Testing Surface

- Pure unit / scheduler
  - 扩展 `services/api/tests/test_home_scheduler_practice_jobs.py`
- PostgreSQL cron integration
  - `services/api/tests/test_postgres_reference_quality_cron_v2.py`
- 至少覆盖
  - `draft -> public` promoted by likes/favorites threshold
  - `public -> archived` by low quality
  - `public -> archived` by report threshold
  - `official` 只改分不改状态
  - audit payload / published_at 写入

## Out Of Scope For This Slice

- `B23.3 generate_daily_practice`
- `B23.4 session.submit` 增量 hook
- `B30 question_report` 聚合接入
- `B24` final OpenAPI / e2e closeout
