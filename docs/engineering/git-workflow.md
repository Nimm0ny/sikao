---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-21
---

# Git Workflow

> 本页只保留 git 护栏。历史说明不再放在执行路径里。

## Rules

1. Local only
   Must: 本地改 -> 本地 commit -> push -> VPS pull。
   Must not: 在 VPS / server 上改源码、commit、cherry-pick。

2. Branches
   Must: 会话分支用 `codex/<slug>`；短命分支合回 `main` 后删除。
   Must not: 让 `codex/*` 独立存在超过一个会话，或绕过 `main` 直接推远端。

3. Commit batch
   Must: 原子提交，一次一事；prefix 用 `fix/feat/refactor/docs/test/chore`。
   Limits: `<=15` 文件、`<=400` 净增、`<=100` changed lines。
   Must: `>100` 行单 commit 先拆。
   Must not: 混合 plan / schema / 实现 / 测试。

4. Session end
   Must: 结束前确认工作树、未推 commit、短命分支状态。
   Commands: `git status --short`; `git log origin/main..main --oneline`; `git branch -vv`.

5. Remote divergence
   Must: 发现 `main` 与 `origin/main` 分叉先停手，先看远端 diff 再决定。
   Commands: `git fetch origin`; `git log --stat main..origin/main`; `git log --stat origin/main..main`.

6. Force push
   Must: 只允许 `git push --force-with-lease`，且先打 safety tag。
   Must not: 用 `git push --force` 或 `--no-verify` 跳门禁。

## Automated Gate

```bash
node scripts/gates/gate-runner.mjs git
```

该 gate 检查 small batch：文件数、净增行数、changed lines。它不替代人工拆 commit；超过阈值必须先拆。

## Hygiene Scan

```bash
git ls-files -v
git branch -vv
git worktree list
git fetch origin
git log origin/main..main --oneline
git log main..origin/main --oneline
```

Red flags:

- `S` / `h` index 标记：说明有 skip-worktree / assume-unchanged。
- 未使用的 `codex/*` worktree 或分支。
- 本地领先远端但 session 要结束。
- 远端领先本地且未做分叉分析。

## Links

- `docs/engineering/gate-automation.md`
- `docs/engineering/agent-hard-rules.md`
