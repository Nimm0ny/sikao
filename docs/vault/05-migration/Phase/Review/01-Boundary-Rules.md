# Phase-Review · 01 · Boundary Rules

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md)

---

## 概述

11 条硬边界规则。所有 PR agent 在写逻辑前必须检查是否违反。违反即打回。

---

## PR-R1 · 入队多源

ReviewItemV2 的 `source_kind` 枚举为 5 项：

```python
class ReviewSourceKind(str, Enum):
    WRONG_ANSWER = "wrong_answer"            # session.commit 答错（Practice 写入）
    FLAGGED_PERSISTENT = "flagged_persistent" # session.commit 持久标记（Practice 写入）
    RE_FAILED = "re_failed"                  # graduated 后再做答错（Review 写入）
    MANUAL_ADD = "manual_add"                # 用户手动加入（Review 写入）
    NOTE_CARD = "note_card"                  # 笔记 AI 摘要拆出的卡片（Notes 写入，预留）
```

**规则**：
- 同一 user_id + question_id 可以有多条 ReviewItemV2（不同 source_kind / 不同时间段的历史行）
- `re_failed` 必须是**新行**，不覆盖原已 graduated 的行
- `manual_add` 创建前检查：是否已有该题的 active（pending/in_progress）行？有则返回 409 不重复创建
- `note_card` 行的 question_id 可以为 NULL（纯知识卡），此时 metadata_json.source_note_id 必填

---

## PR-R2 · source_kind 不可变

一旦 ReviewItemV2 行创建，`source_kind` 字段**不可被任何操作修改**。

- 变更来源语义 = 新建一行，不是 UPDATE
- 迁移脚本 / admin 操作也不得 UPDATE source_kind

---

## PR-R3 · 已下线 AI 题可重做不可重出

如果 QuestionV2.is_active = false（已下线）：
- 复盘重做：**允许**（用户已做错过，有复盘需求）
- 出题池选题：**禁止**（Practice 出题时排除 is_active=false）
- 题目中枢页：顶部显示 Banner "该题已被题库标记为下线，仅供复盘使用"

---

## PR-R4 · 复盘 session 强制 per_question

当 PracticeSessionV2.source_mode = 'wrong_redo' 时：
- 后端 `session.create()` 强制设 `practice_mode = 'per_question'`，忽略客户端传入的 practice_mode
- 前端 review session 入口不展示"整组模式"选项
- 答完一题立即展示答案 + 解析（不等全部答完）

**不受 Practice Pace-7 整组闭卷校验影响**。判断条件：`if session.source_mode == 'wrong_redo': skip_closed_book_validation()`

---

## PR-R5 · graduated 后再错重新入队

当用户在任意 session（不限于 review session）答错一道已 graduated 的 ReviewItemV2 对应题目：
- 创建新行 ReviewItemV2(source_kind=re_failed, question_id=同题, status=pending, correct_streak=0)
- 原 graduated 行**保持不变**（graduated_at 保留，审计可追溯"这道题曾经毕业过"）
- 新行的 metadata_json.original_review_item_id = 原行 ID（关联溯源）

触发条件检查：
```python
# session.commit 路径
for answer in answers:
    if answer.is_correct:
        continue
    existing_graduated = get_graduated_review_item(user_id, answer.question_id)
    if existing_graduated:
        create_review_item(source_kind='re_failed', ...)
```

**注意**：这个 hook 在 Phase-Review WU-R4 实施（不在 Practice 侧），因为需要知道"已有 graduated 行"。

---

## PR-R6 · AI 错因失败不阻塞列表

AI 错因分析相关端点返回 5xx 时：
- 复盘列表 / 详情 / 重做**不受影响**（错因是独立区块）
- 前端展示：错因区块替换为"AI 分析暂时不可用，请稍后再试" + retry 按钮
- 不触发全局 error boundary
- 审计日志记录失败（llm_call_id + error_type + error_message）

---

## PR-R7 · source_note_id 必填约束（note_card 行）

ReviewItemV2 行满足以下规则：

**非 note_card 行**（source_kind IN wrong_answer / flagged_persistent / re_failed / manual_add）：
- `question_id` 必填（NOT NULL）
- `metadata_json.source_note_id` 必须为 NULL

**note_card 行**（source_kind = note_card）：
- `metadata_json.source_note_id` 必填（NOT NULL）
- `question_id` 可选（NULL = 纯知识卡；非 NULL = 题关联卡）

等效 CHECK（仅 PostgreSQL 生产环境加，SQLite 依赖 application-layer）：
```sql
CHECK (
    CASE
        WHEN source_kind != 'note_card' THEN
            question_id IS NOT NULL AND metadata_json->>'source_note_id' IS NULL
        ELSE  -- note_card
            metadata_json->>'source_note_id' IS NOT NULL
            -- question_id 可 NULL 也可非 NULL
    END
)
```

> 实际落地用 application-layer 校验（SQLite 不支持 JSONB CHECK），不依赖 DB CHECK。PostgreSQL 环境可额外加 DB CHECK 作为双保险。

---

## PR-R8 · Cause Tag Enum + Override Audit

LLM 错因分析输出的 `dimensions[].slug` 必须严格在 `cause_tag_v2` 词典 enum 内（参见 [13-Cause-Taxonomy](./13-Cause-Taxonomy.md)）。

**Parser 强制规则**：
- 启动时加载 `is_active=true` 的 slug 集合（VALID_SLUGS），TTL 5min
- LLM 输出 slug 不在 VALID_SLUGS（含拼写错 / 空 / deprecated）→ 强制归 `other` + severity=`low`
- 原 LLM 输出存 `_llm_original` 字段，metric `cause_taxonomy.other_fallback` +1
- 大小写归一化为小写后比对

**用户 override 规则**（PATCH `/cause-analysis/:analysis_id/dimensions/:dimension_index`）：
- override.slug 必须在 VALID_SLUGS 内；不在则 422 InvalidCauseTagError
- 写入时不删 LLM 原 slug：`dim._llm_original_slug` 保留 + `dim.user_override` 块
- 必须 require_owner（A 用户不能改 B 用户的分析）
- 必须写 ReviewAttemptV2 行 `outcome=CAUSE_TAG_OVERRIDDEN`（含 from→to slug）
- 必须 bump `analysis.version`（PR-R10 适用）

**演进规则**：
- slug 一旦发布永远禁止 rename；删除 = `is_active=false` 软删
- 新增 slug → `taxonomy_version` +1；name / description / display_order 可改不限
- 聚类 / Insights-3 一律使用 `effective_slug = COALESCE(user_override.slug_overridden, dim.slug)`

**Cache invalidate**：`POST /admin/cause-tag/invalidate-cache` 仅 super_user 可调；普通用户 403。

---

## PR-R9 · Debt Management Invariants

复盘债务核算与流量调度规则（参见 [12-Debt-Management](./12-Debt-Management.md)）。

**daily_limit 不可绕过**：
- `profile.review_daily_limit ∈ [10, 100]`，越界 422
- 用户主动"加做明日 K 道"：推送 K 道但 `next_review_at` 不前移（保留节奏）
- 即使 daily_limit 已满，severity 重新计算时仍按真实 overdue 计

**打散不修改 SRS 主字段**：
- redistribute 只动 `next_review_at` + `metadata.debt_status` / `debt_redistributed_to` / `original_overdue_at`
- `correct_streak` / `algorithm_version` / `version` 字段必须保持不变（PR-R10 适用）
- 触发条件：`severity=heavy` 自动触发 OR 用户主动（severity ≥ moderate 才允许，severity=none/light 调用 422）

**ramp-up 与打散互斥**：
- 用户处于 ramp-up（`last_attempt ≥ 7d`）期间，cron 跳过打散（不动 next_review_at）
- ramp-up day_5 完成时触发**一次**打散，剩余 overdue 进入正常节奏
- ramp-up 期间 ConfidenceRatingPrompt 隐藏 certain 选项（与 PR-R11 协同）

**HARD 题（is_hard=true）规则**：
- 答对 multiplier cap at ×1.0（recall+certain 也不翻倍）；unsure ×0.5 惩罚保留为 `min(1.0, multiplier)`
- list / detail 端点对 is_hard 透明（status 字段不变；前端通过 metadata 渲染 HardQuestionBadge）
- 自动 deep-analysis 走独立桶 `daily_deep_quota=5`（不计入 `daily_llm_quota=20`）
- 用户 fresh start 清 is_hard + streak=0；`re_fail_count` 保留作审计（不清零）

**cron 幂等**：`debt_severity_evaluator` / `hard_question_detector` / `rampup_phase_advancer` 重复执行不重算 / 不重复 audit；单用户失败不阻塞其他用户。

---

## PR-R10 · SRS Optimistic Lock Invariant

任何修改 ReviewItemV2 的 SRS 状态字段（`correct_streak` / `next_review_at` / `status` / `metadata.algorithm_version` / `debt_status` / `is_hard`）必须遵守乐观锁（参见 [00-Decisions](./00-Decisions.md) §4 SRS-2 / SRS-8 / SRS-9）。

**事务 + CAS**：
1. 进事务前 SELECT version → expected_version
2. 业务计算（advance_on_correct / regress / redistribute / mark_hard / clear_hard / cause-override）
3. `UPDATE ... SET version = version + 1 WHERE id = :id AND version = :expected_version`
4. 受影响行数 = 0 → 抛 `OptimisticLockError`（不静默忽略）

**适用范围**：
- session.commit 触发的 SRS 状态推进
- 用户主动操作（mark_resolved / archive / restore / fresh_start / cause-override）
- cron job（debt redistribute / rampup advance / hard detect）
- 算法版本切换（simple_v1 ↔ sm2_v1 迁移路径）

**Fail-Fast**（AGENT H7）：
- `OptimisticLockError` 必须抛错；调用方决定 retry 或回滚整个 batch
- 禁止 silent catch + 重试无限次；retry 限 3 次仍失败则向上抛
- 跨 cron job 同时改一行 → 一个成功一个抛；后者必须重新计算（不能用旧快照）

**审计要求**：所有 SRS 状态变更必须配套 ReviewAttemptV2 行（含 outcome 枚举），从 audit 链路可还原版本号路径。

**例外**：纯 read-only 派生字段（`last_confidence` / `re_fail_count` 显示用复制）不强制 CAS；但写入它们的 hook 路径仍需在事务内一并 bump version。

---

## PR-R11 · Confidence Rating Semantics

4 档信心评级（`guess` / `unsure` / `likely` / `certain`）改写 SRS 路径语义（参见 [14-Confidence-Rating](./14-Confidence-Rating.md)）。

**guess 答对不递增 streak**：
- streak 不变；`next_review_at` 按当前 streak 原地复算
- 不享受 recall 加成（multiplier 强制 ×1.0）
- ReviewAttemptV2 行 outcome=CORRECT 但 `notes_json.advance_skipped_due_to_guess=true`

**unsure 阻毕业**：
- streak 仍 +1
- 间隔倍数：unsure + 无 recall = ×0.5；unsure + recall = ×1.0（recall 抵消半懵惩罚但不翻倍）
- 即使 streak 达到 `GRADUATION_THRESHOLD`（4），仍强制再做一次：streak 卡在 `GRADUATION_THRESHOLD - 1`，`metadata.unsure_blocked_graduation=true`，下次 likely+ 才允许进 probationary

**certain + recall + 临门一脚 → early probationary**：
- 条件：streak ≥ `GRADUATION_THRESHOLD - 1` + `confidence=certain` + `used_recall=True`
- 走 [05-SRS-Engine](./05-SRS-Engine.md) §5 Branch 4 进 probationary（不直接 graduated）
- `metadata.early_graduated=true`；ReviewAttemptV2 outcome=PROBATION_ENTERED

**certain + 答错 = mismatch（强制路径）**：
- 标记 `metadata.confidence_mismatch_count += 1`
- 调度 forced cause-analysis（不计 `daily_llm_quota`，使用 `cause_analysis_forced` prompt 变体）
- forced 路径 LLM 失败时不阻塞（参见 PR-R6）；前端读 `metadata.forced_cause_analysis_pending` 自动 trigger
- `confidence_mismatch_count ≥ 2` → 自动晋升 `is_hard=true`（与 PR-R9 联动）

**跳过（confidence=null）**：
- 按 likely 等价处理（保守默认）
- `metadata.confidence_skipped_count += 1`；累计 > 5 在最近 30 题内 → 下次强制弹出不可跳

**ramp-up 期间限制**：
- ConfidenceRatingPrompt 不展示 certain 选项（避免回归首日错估自我）
- 已有 `confidence_mismatch_count ≥ 1` / `is_hard=true` 的题：confidence 强制弹出不可跳

---

## 引用矩阵

| 规则 | 决策来源 | 涉及子文档 |
|---|---|---|
| PR-R1 | R-1 | 02-Data-Model / 03-Backend-WU WU-R1/R2 |
| PR-R2 | R-1 | 02-Data-Model / 03-Backend-WU WU-R2 |
| PR-R3 | D-R3 | 03-Backend-WU WU-R2 / 08-Question-Hub-Page |
| PR-R4 | D-R2 | 03-Backend-WU WU-R4 / 04-Frontend-WU WU-FR8 |
| PR-R5 | SRS-6 | 03-Backend-WU WU-R4 / 05-SRS-Engine |
| PR-R6 | AI-Cause-8 | 06-AI-Cause-Analysis / 04-Frontend-WU WU-FR9 |
| PR-R7 | R-1 note_card | 02-Data-Model / 03-Backend-WU WU-R1 |
| PR-R8 | Taxonomy-3 / -4 / -5 | 13-Cause-Taxonomy / 03-Backend-WU WU-R13 / 04-Frontend-WU WU-FR9 |
| PR-R9 | Debt-1 ~ Debt-8 | 12-Debt-Management / 03-Backend-WU WU-R14 / 04-Frontend-WU WU-FR14 |
| PR-R10 | SRS-2 / SRS-8 / SRS-9 | 02-Data-Model §3 version / 03-Backend-WU WU-R3 / R4 / 05-SRS-Engine |
| PR-R11 | Confidence-1 ~ Confidence-7 | 14-Confidence-Rating / 03-Backend-WU WU-R3 修订 / 04-Frontend-WU WU-FR13 |
