---
type: audit
status: final
owner: codex
created: 2026-05-15
issue: SIK-10
branch: codex/mvp-ai-gongkao
---

# SIK-10 Acceptance Checklist

本文档是一份给人工验收者直接执行的清单。目标不是解释实现细节，而是验证：`SIK-10` 的 MVP 主链是否真实可用。

## A. 先核对账本状态

1. 运行：

```bash
multica issue get SIK-10 --output json
```

预期：

- `status` 是 `done`

2. 运行：

```bash
multica issue comment list SIK-10 --output json --since 2026-05-15T00:00:00Z
```

预期：

- 能看到两条关键收口 comment
  - `ef3939b feat: close the AI gongkao MVP loop`
  - `91c3524 fix: harden SIK-10 review findings`

## B. 核对本地分支位置

运行：

```bash
git -C /mnt/d/py_pj/sikao-worktrees/mvp-ai-gongkao log --oneline --decorate -n 4
```

预期：

- `HEAD` 是 `91c3524 fix: harden SIK-10 review findings`
- 下一条是 `ef3939b feat: close the AI gongkao MVP loop`

## C. 自动化验证

在仓库根运行：

```bash
cd /mnt/d/py_pj/sikao-worktrees/mvp-ai-gongkao
npm run generate:types
npm run -w @sikao/web typecheck -- --noEmit
npm run -w @sikao/web lint
npm run -w @sikao/web build
npm run -w @sikao/web test -- --run src/router/OnboardingGate.test.tsx src/views/__tests__/Dashboard.test.tsx src/views/__tests__/EssayExamSikao.test.tsx src/views/__tests__/EssayExamResults.test.tsx src/views/__tests__/PracticeSession.test.tsx src/views/__tests__/Result.test.tsx src/components/result/WrongReviewCard.test.tsx src/views/ShenlunSession/ShenlunSession.test.tsx
```

预期：

- 所有前端命令通过
- 关键 view tests 通过

在 `services/api` 目录运行：

```bash
cd /mnt/d/py_pj/sikao-worktrees/mvp-ai-gongkao/services/api
../../scripts/dev-python.sh -m pytest --capture=no -q tests/test_essay_draft.py tests/test_exam_api.py tests/test_contract.py tests/test_cross_paper_retry.py tests/test_study_plan_service.py tests/test_study_plan_routes.py tests/test_study_plan_start_route.py tests/test_essay_grading_routes.py tests/test_essay_grading_service.py tests/test_user_exams_crud.py tests/test_exam_events.py
```

预期：

- `188 passed, 1 xfailed`

## D. 建档门禁验收

使用新账号或清空登录态后验收。

1. 打开 `/app`
2. 打开 `/dashboard`
3. 打开 `/study/today`
4. 打开 `/progress`

预期：

- 在未建档时，以上路径都不能真正进入业务页
- 会被导向 `/study/onboarding`
- 不应出现“业务页面先闪一下再跳”

继续操作：

1. 在 `/study/onboarding` 第一步填写目标分
2. 第二步填写考试
3. 提交

预期：

- 跳转到 `/study/diagnosis-result`
- 再进入 `/study/today` 时不再被 gate 拦住

## E. 今日任务 → 行测闭环验收

1. 进入 `/study/today`
2. 选择一个 `practice` 或 `review_wrong` 任务
3. 完成作答并提交
4. 进入结果页 `/practice/result/:sessionId`

预期：

- 今日任务由 `pending` 变为 `completed`
- 结果页能看到错题解析
- 错题卡有“错因诊断”区域
- 如果没有历史错因，会先出现系统建议的默认错因
- 手动切换错因后，刷新页面仍保留新值

## F. 今日任务 → 申论闭环验收

1. 进入 `/study/today`
2. 点击一个 `essay_writing` 任务
3. 在 `/essay/exam/:paperCode` 输入 typed draft
4. 等 autosave
5. 刷新页面或重新进入
6. 提交
7. 进入 `/essay/exam/results?...&studyTaskId=...`

预期：

- typed draft 能恢复
- 读旧 draft 失败时，新的 typed draft 也不会丢
- submit 成功后，今日任务不应立即完成
- 只有结果页中相关 grading record 都 `completed` 后，任务才应回写为 `completed`

## G. 申论 legacy surface 退场验收

1. 打开旧链接：

```text
/practice/essay/session/123
```

预期：

- 不再出现 mock-backed 的申论壳
- 会跳到真实单题申论路径 `/essay/specialty/123`
  - 或其真实错误态

## H. 契约一致性验收

运行：

```bash
cd /mnt/d/py_pj/sikao-worktrees/mvp-ai-gongkao
rg -n "wrongReasonCode|wrongReasonSource" services/api/spec/openapi.json packages/api-client/src/types/api.generated.ts
```

预期：

- `openapi.json` 中存在这两个字段
- `api.generated.ts` 中也存在这两个字段

这一步的意义是确认：

- runtime schema
- checked-in OpenAPI spec
- checked-in generated TS contract

三者已经同步，而不是只改了一层。

## I. 非本 issue 内容确认

最后确认本 worktree 里是否还存在不属于 `SIK-10` 的本地内容：

```bash
git -C /mnt/d/py_pj/sikao-worktrees/mvp-ai-gongkao status --short
```

如果仍看到这些条目，不要把它们算作本次 MVP 验收失败：

- `apps/web/src/router/index.tsx` 里的 `/prototype` 实验
- `apps/web/src/views/PrototypeBoard.tsx`
- `apps/web/src/views/__tests__/PrototypeBoard.test.tsx`
- `WORKTREE_KICKOFF.md`
- `output/`

它们是本地 worktree artifact，不在 `SIK-10` 的验收范围。
