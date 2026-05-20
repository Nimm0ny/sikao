---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-21
---

# Multica Workflow

> Multica 是任务账本，不替代工程门禁。

## Rules

1. Issue intake
   Trigger: 任务来自 Multica issue。
   Must: 读取 issue、comments、runs，再提取 requirement / acceptance / non-goals / blockers。

2. Status
   Must: 开始实现后标 `in_progress`；等待 review 标 `in_review`；验证完整通过才标 `done`；有阻塞标 `blocked`。
   Must not: 没有 PASS 证据就标 `done`。

3. Evidence Block
   Must: 完成前回写证据，包含验证、review、已知缺口和回滚说明。
   Must not: CLI 回写失败时伪造已回写。

4. Local docs
   Must: 小任务写 issue comment；只有跨模块 / 契约 / DB / 安全 / 视觉体系 / 多 session 任务才新建 `docs/plan/*.md`。
   Must not: 为了记录进度新建本地文档。

5. Token safety
   Must not: 读取、打印、保存、提交 Multica token。

## Automated Gate

```bash
node scripts/gates/gate-runner.mjs multica-intake --issue <issue-id>
```

该 gate 执行三读：

```bash
multica issue get <issue-id> --output json
multica issue comment list <issue-id>
multica issue runs <issue-id> --output json
```

## Status Commands

```bash
multica issue status <issue-id> in_progress
multica issue status <issue-id> in_review
multica issue status <issue-id> blocked
multica issue status <issue-id> done
```

若 CLI 参数变动，先跑：

```bash
multica issue status --help
```

## Evidence Block

```text
Mode:
Multica issue:
Branch:
Commits:
Changed files:
Requirement source:
Plan doc:
Implementation summary:
Tests run:
Lint:
Typecheck:
Build:
Browser smoke:
Subagent review:
Security review:
Known gaps:
Rollback notes:
Next owner:
```

## Links

- `docs/engineering/gate-automation.md`
- `docs/engineering/agent-hard-rules.md`
