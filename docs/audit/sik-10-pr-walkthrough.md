---
type: audit
status: final
owner: codex
created: 2026-05-15
issue: SIK-10
branch: codex/mvp-ai-gongkao
baseline: b5a52fa
closure-commits:
  - ef3939b
  - 91c3524
---

# SIK-10 PR Walkthrough

本文档面向仓库协作者，解释 `SIK-10` 这条 MVP 闭环线从 `PR-0` 到 `PR-8` 的实现方式、闭环逻辑，以及最终以什么标准视为“完成”。

## 范围边界

- 本 worktree 范围：`PR-0` / `PR-1` / `PR-2` / `PR-3` / `PR-4` / `PR-5` / `PR-6` / `PR-8`
- carve-out：
  - `PR-7` 资金流：不在本 issue 内
  - `lint:*` 独立工具链债：不在本 issue 内

## 总体策略

- 需求入口：Multica issue `SIK-10`
- 契约冻结：先做 `PR-0` 盘点，冻结 drift 决策
- 申论 session 路径：采用 Path A，复用 `EssayDraftRecord` + `EssayGradingRecord`
- 首页入口：收敛到 `/study/today`
- 闭环标准：
  - 用户先完成建档
  - 从今日任务进入行测 / 申论真实流程
  - 结果页能沉淀错因 / 报告
  - 今日任务状态能在真实完成后回写
  - 进步看板读到真实累计数据
  - 关键用户动作有埋点

## PR-0：盘点与契约冻结

### 实现方式

- 新增盘点文档：`docs/audit/ai-mvp-current-inventory.md`
- 明确 6 类 drift 的处理原则
- 申论 session 决策定为 Path A

### 闭环逻辑

- `PR-0` 不改业务行为
- 它的价值是给后续 PR 提供唯一口径，避免一边实现一边漂移

## PR-1：用户建档与初始诊断

### 实现方式

- 复用现有模型：
  - `UserGoal`
  - `UserExam`
  - `ExamEvent`
- 前端：
  - `/study/onboarding`
  - `/study/diagnosis-result`
- 后端：
  - `GET /api/v2/me/onboarding-status`
  - 目标分 / 用户考试相关现有接口
- 强化修复提交 `91c3524` 把 onboarding gate 提升到 `AppShell` 边界

### 闭环逻辑

- 未完成建档时，不允许真正进入登录态业务主面
- 完成目标分和考试信息后，用户才能进入 `/study/today`
- `diagnosis-result` 作为建档后的承接页，不再是可绕过主门禁的孤立页面

## PR-2：今日提分任务首页

### 实现方式

- 复用现有 study-plan 树：
  - `GET /api/v2/study-plan/today`
  - `PATCH /api/v2/study-plan/tasks/{id}`
  - `POST /api/v2/practice/study-plan/start`
- 前端页：`/study/today`
- 任务类型维持当前契约：
  - `practice`
  - `review_wrong`
  - `essay_writing`

### 闭环逻辑

- 从今日任务出发，不再直接“标完成再跳转”
- 任务必须进入真实业务流：
  - `practice` / `review_wrong` → practice session
  - `essay_writing` → essay exam
- `skipped` 与 `completed` 分开落库

## PR-3：行测练习记录与错因诊断

### 实现方式

- 后端扩展：
  - `practice_session_answers.elapsed_seconds`
  - `wrong_reason_code`
  - `wrong_reason_source`
- 暴露接口：
  - `PATCH /api/v2/practice/sessions/{session_id}/answers/{answer_id}/diagnosis`
- 结果页增强：
  - 错题卡可见错因
  - 缺失错因时按稳定规则回填默认值
  - 用户可以手动修正错因，落回后端
- review-fix 提交 `91c3524` 进一步把：
  - runtime schema
  - `openapi.json`
  - `api.generated.ts`
  三者重新对齐

### 闭环逻辑

- 行测结果不再只有正确率和解析
- 用户完成练习后能看到“错在哪里”
- 错因不是一次性 UI 文案，而是持久化数据，可进入后续 wrong-book / progress 分析

## PR-4：申论真实 session 接入

### 实现方式

- 采用 Path A，不创建 `essay_sessions`
- 主链改为：
  - `/essay/exam/:paperCode`
  - `GET /api/v2/essay/drafts/{question_id}`
  - `POST /api/v2/essay/drafts`
- `essay-client` 负责：
  - 读后端 typed draft
  - autosave 到后端
- review-fix 提交 `91c3524` 继续强化：
  - draft 读取失败时仍然 best-effort 保存 typed draft
  - 后端在 typed-only autosave 时保留已有手写 metadata
  - 旧 `/practice/essay/session/:sessionId` live mock surface 退场，改为 redirect 到真实单题申论流

### 闭环逻辑

- 用户在申论页面输入的 typed draft 不再只是浏览器本地数据
- 刷新或重新进入后可以恢复 typed draft
- 用户不会再进入一条 mock-backed 的“假申论主流程”

## PR-5：申论 AI 批改报告

### 实现方式

- 继续复用已有 grading record 和 report flow
- 主链：
  - `POST /api/v2/essay/grade`
  - `GET /api/v2/essay/grades/{record_id}`
  - `/essay/exam/results?...`
  - `/essay/grades/:recordId`
- review-fix 提交 `91c3524` 修正 task completion 语义：
  - 不在 submit 瞬间完成 study task
  - 只有当整卷结果页确认相关 grading record 真正 `completed` 时，才回写今日任务完成

### 闭环逻辑

- “申论任务完成”不再等价于“交卷请求成功发出”
- 而是等价于“报告已经可读、可被用户消费”

## PR-6：进步看板

### 实现方式

- 后端：
  - `GET /api/v2/progress/weekly`
  - `GET /api/v2/progress/accuracy-trend`
- 前端页：`/progress`
- review-fix 后，essay task 的完成时机已经与报告完成对齐

### 闭环逻辑

- 看板现在读到的不是半截数据
- practice task 与 essay task 都会进入真实完成计数

## PR-7：资金流

### 实现方式

- 无实现
- 明确 carve-out

### 闭环逻辑

- 不作为 `SIK-10` 完成条件

## PR-8：埋点 / 合规 / smoke

### 实现方式

- 新增前端埋点 helper：`apps/web/src/lib/analytics.ts`
- 实际接入的关键流：
  - onboarding
  - study task started / skipped
  - practice session completed
  - essay exam submitted
  - essay grading viewed
  - progress viewed
- review-fix `91c3524` 继续补了防复发：
  - `scripts/generate-api-types.sh`
  - `npm run generate:types`
  - contract tests，锁住 `wrongReasonCode` / `wrongReasonSource`

### 闭环逻辑

- 不是只有 ingest endpoint
- 而是用户主链关键动作都真正有事件落点
- 契约不会再只改 runtime、不改静态 spec / generated types

## 最终收口提交

- `ef3939b feat: close the AI gongkao MVP loop`
  - 首次把 canonical MVP 主链打通
- `91c3524 fix: harden SIK-10 review findings`
  - 针对 review findings 做结构性修补，重点是：
    - shell-level onboarding gate
    - essay task 完成语义
    - draft 保存抗读失败
    - 移除 live mock essay session surface
    - contract drift 防复发

## 当前不在本提交范围内的本地文件

以下内容没有纳入 `SIK-10` 推送分支说明文档范畴：

- `apps/web/src/router/index.tsx` 里的 `/prototype` 实验
- `apps/web/src/views/PrototypeBoard.tsx`
- `apps/web/src/views/__tests__/PrototypeBoard.test.tsx`
- `WORKTREE_KICKOFF.md`
- `output/`

这些仍然是本地 worktree artifact，不属于本 issue 的闭环定义。
