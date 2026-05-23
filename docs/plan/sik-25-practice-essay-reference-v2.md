---
type: engineering
status: draft
owner: codex
last-reviewed: 2026-05-23
source: multica
multica-issue: SIK-25
---

# SIK-25 Practice Essay Reference Slice

## Goal

收口 `B20.3 + B20.4`：把 v2 essay reference list / feedback / generate 接到当前 app，并把 auto-generate hook 补到 essay grading worker 后面。

## Define-First Boundary

### Route Surface

- `GET /api/v2/practice/essay/questions/{question_id}/reference-answers`
  - 认证态读取
  - 只返回 `status=public` 的范文
  - 排序规则：`source=official > user_contributed > ai_generated`，同 source 内 `quality_score DESC, id ASC`
- `POST /api/v2/practice/essay/reference-answers/{reference_id}/like`
- `DELETE /api/v2/practice/essay/reference-answers/{reference_id}/like`
- `POST /api/v2/practice/essay/reference-answers/{reference_id}/favorite`
- `DELETE /api/v2/practice/essay/reference-answers/{reference_id}/favorite`
- `POST /api/v2/practice/essay/reference-answers/{reference_id}/report`
  - report 仅新增，不做 DELETE
- `POST /api/v2/practice/essay/reference-answers/generate`
  - 需要认证 + CSRF + `Idempotency-Key`
  - 立即返回 `OperationAckV2`
  - 后台 best-effort 生成 AI 范文

### Feedback Semantics

- feedback action 只使用 `like | favorite | report`
- `POST like/favorite`
  - 已存在同 action row 时 idempotent 成功，不再重复插入
- `DELETE like/favorite`
  - row 不存在时返回 404（沿用当前 question favorite 语义）
- `POST report`
  - 同一用户对同一 reference 仅一条 `report` row；重复 POST 视为 idempotent 成功
- `likes_count / favorites_count / report_count`
  - 完全依赖现有 DB trigger 同步，不在 service 侧手工增减

### Auto Generate Hook

- essay grading worker 在 `EssayReportV2` 成功写入后，若该题还没有任何 `status in {public, draft, archived}` 的 `ai_generated` reference，则 best-effort 触发一次 AI 范文生成
- 生成失败不回滚 essay grading 成功结果；只记录日志

### Generation Semantics

- generation 使用 `HomeLlmService.generate_reference_answer()`
- question 材料来源：`QuestionV2.content_json.materialTexts`
- 字数目标：优先 `wordLimitMax`，缺失时 fallback `1000`
- 持久化：
  - `source="ai_generated"`
  - `ai_generated_at=now`
  - `ai_self_audit_passed = trace.result.ai_self_audit_passed`
  - `status="public"` 当且仅当 `ai_self_audit_passed=True`
  - `status="archived"` 当 `ai_self_audit_passed=False`
  - `published_at` 仅 `public` 时写入

### Audit / Rate Limit

- feedback 写 audit：
  - `reference.feedback.like`
  - `reference.feedback.favorite`
  - `reference.feedback.report`
- generate 写 audit：
  - `reference.generate.manual`
  - `reference.generate.auto`
- route rate limit：
  - like/favorite/report：`60 req/min/user`
  - generate：`10 req/day/user`

## Out Of Scope For This Slice

- `compute_reference_quality` cron
- official / user_contributed reference authoring
- question report / ai_cleanup hook
- B24 final OpenAPI / e2e closeout
