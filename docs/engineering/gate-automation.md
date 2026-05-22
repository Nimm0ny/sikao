---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-22
---

# Gate Automation

> 目标：把 Multica / review / validation / git 门禁从“读说明书”收敛为“规则 + 可执行护栏”。

## Rules

1. `gate:preflight`
   Trigger: 每个任务开工前。
   Must: 检查 `AGENTS.md` / `CLAUDE.md` 同步、`git` / `node` 可用；有 `--issue` 时还必须检查 `multica` 可用。
   Command: `npm run gate:preflight -- --issue <issue-id>`，或无 issue 直接运行。
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
   Command: `npm run gate:validation` 继续用于整仓 full gate；文档 / gate 脚本小改可跑 `node scripts/gates/gate-runner.mjs validation --profile docs`；仅当任务是 backend-only 主线且满足 scoped validation 条件时，才可跑 `npm run gate:validation:backend`。
5. `gate:git`
   Trigger: commit / push 前。
   Must: 检查 small batch：`<=15` 文件、`<=400` 净增、`<=100` changed lines；超过即失败并要求拆 commit。
   Command: `node scripts/gates/gate-runner.mjs git`。

## Profiles

| Profile | Commands |
|---|---|
| `docs` | `node --test scripts/gates/*.test.mjs` |
| `backend-first` | `(cwd=<repo>/services/api) python -m ruff check src tests`; `(cwd=<repo>/services/api) python -m mypy src`; `(cwd=<repo>/services/api) python -m pytest`; `(cwd=<repo>) node --test scripts/gates/*.test.mjs` |
| `full` | `npm run typecheck`; `npm run lint`; `npm test`; gate runner unit tests |

PowerShell 如果拦截 `npm.ps1`，用 `npm.cmd` 执行同一 npm 命令。

## Backend-First Usage

- 适用场景：用于 backend-only 主线任务，且任务本身满足 `AGENTS.md` / `CLAUDE.md` 中 scoped validation 条件。
- 不是常规替代：`backend-first` 不是根级 full gate 的默认入口；任何前端 runtime / 视觉 / mixed-scope 任务都不能拿它替代 `npm run gate:validation`。
- 根入口：`npm run gate:validation:backend`
- 直接入口：在 repo root 下运行 `node scripts/gates/gate-runner.mjs validation --profile backend-first`；若 shell cwd 不在 repo root，改用脚本绝对路径或先切回 repo root。
- 记录义务：使用该 profile 时，最终说明仍必须记录 full validation blocker，并明确结果属于 backend-first scoped validation。
- 实现语义：脚本会基于 `gate-runner.mjs` 所在位置解析仓库绝对根，再定位 `services/api`；但 `node scripts/gates/...` 这种相对脚本路径仍要求当前 shell 能解析到该文件。

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
