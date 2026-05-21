# Phase-Review · 01 · Boundary Rules

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md)

---

## 概述

7 条硬边界规则。所有 PR agent 在写逻辑前必须检查是否违反。违反即打回。

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

## PR-R7 · question_id 与 source_note_id 互斥

ReviewItemV2 行满足：
```sql
CHECK (
    (question_id IS NOT NULL AND metadata_json->>'source_note_id' IS NULL)
    OR
    (question_id IS NULL AND metadata_json->>'source_note_id' IS NOT NULL)
)
```

- source_kind IN (wrong_answer, flagged_persistent, re_failed, manual_add) → question_id 必填
- source_kind = note_card → question_id 可 NULL（纯知识卡）或非 NULL（题关联卡），但 metadata_json.source_note_id 必填

> 实际落地用 application-layer 校验（SQLite 不支持 JSONB CHECK），不依赖 DB CHECK。PostgreSQL 环境可额外加 DB CHECK 作为双保险。

---

## 引用矩阵

| 规则 | 决策来源 | 涉及子文档 |
|---|---|---|
| PR-R1 | R-1 | 02-Data-Model / 03-Backend-WU WU-R1/R2 |
| PR-R2 | R-1 | 02-Data-Model / 03-Backend-WU WU-R2 |
| PR-R3 | D-R3 | 03-Backend-WU WU-R2 / 08-Question-Hub-Page |
| PR-R4 | D-R2 | 03-Backend-WU WU-R4 / 04-Frontend-WU WU-FR4 |
| PR-R5 | SRS-6 | 03-Backend-WU WU-R4 / 05-SRS-Engine |
| PR-R6 | AI-Cause-8 | 06-AI-Cause-Analysis / 04-Frontend-WU WU-FR9 |
| PR-R7 | R-1 note_card | 02-Data-Model / 03-Backend-WU WU-R1 |
