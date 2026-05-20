---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-21
---

# Gate Automation

> 目标：把 Multica / review / validation / git 门禁从“读说明书”收敛为“规则 + 可执行护栏”。

## Rules

1. `gate:preflight`
   Trigger: 每个任务开工前。
   Must: 检查 `AGENTS.md` / `CLAUDE.md` 同步、`git` / `node` 可用；有 `--issue` 时还必须检查 `multica` 可用。
   Command: `npm run gate:preflight -- --issue <issue-id>` 或无 issue 运行。

2. `gate:multica`
   Trigger: 任务来自 Multica issue。
   Must: 自动执行 intake 三读：`issue get` / `comment list` / `runs`。
   Command: `node scripts/gates/gate-runner.mjs multica-intake --issue <issue-id>`。

3. `gate:review`
   Trigger: 交付前。
   Must: 根据 diff 统计判断是否需要独立 review；命中阈值且未传 `--reviewed` 时失败；UI 路径改动未传 `--browser-smoke` 时失败。
   Command: `node scripts/gates/gate-runner.mjs review --reviewed`。

4. `gate:validation`
   Trigger: 交付前。
   Must: 运行明确 profile，不允许口头声称已验证。
   Command: `npm run gate:validation`；文档 / gate 脚本小改可跑 `node scripts/gates/gate-runner.mjs validation --profile docs`。

5. `gate:git`
   Trigger: commit / push 前。
   Must: 检查 small batch：`<=15` 文件、`<=400` 净增、`<=100` changed lines；超过即失败并要求拆 commit。
   Command: `node scripts/gates/gate-runner.mjs git`。

## Profiles

| Profile | Commands |
|---|---|
| `docs` | `node --test scripts/gates/*.test.mjs` |
| `full` | `npm run typecheck`; `npm run lint`; `npm test`; gate runner unit tests |

PowerShell 如果拦截 `npm.ps1`，用 `npm.cmd` 执行同一 npm 命令。

## Guardrails

- 脚本只负责机械门禁；不能替代 subagent review、人工拍板或 Evidence Block。
- 脚本默认 fail-fast；缺工具、缺 issue id、未知参数、命令失败都直接退出非 0。
- `--dry-run` 只用于检查将执行的命令；输出 `DRY-RUN (not evidence)`，不能作为 PASS 证据。
- Multica 状态流转仍由 agent 显式执行；脚本不自动标 `done`。

## Links

- `scripts/gates/gate-runner.mjs`
- `docs/engineering/agent-hard-rules.md`
- `docs/engineering/multica-workflow.md`
- `docs/engineering/git-workflow.md`
