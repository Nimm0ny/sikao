---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-21
---

# Agent Hard Rules

> 这是 `AGENTS.md` / `CLAUDE.md` 顶层硬规则的速查版。详细解释仍以根级规范和对应工程文档为准。

## Hard Rules

1. `AGENT-H1 Conflict Handling`
   Trigger: 用户当前要求、现场上下文、工具能力与任何硬规则冲突。
   Must: 先显式指出冲突，再停止执行冲突动作。
   If conflict: 硬规则优先；除非 lhr 明确批准例外。

2. `AGENT-H2 Mode First`
   Trigger: 每个任务开工前。
   Must: 先声明 `Master / Runner / Reviewer / Verifier` 之一，再开始实施。
   If conflict: 未声明模式，不得实现。

3. `AGENT-H3 Capability Preflight`
   Trigger: 每个任务开工前，尤其是 browser / subagent / MCP / Multica / shell 相关任务。
   Must: 先确认能力边界，不得假装工具可用。
   If conflict: 工具不可用时 fail-fast；不得静默降级。

4. `AGENT-H4 Master Does Not Execute`
   Trigger: 当前模式是 `Master Mode`。
   Must: 以编排、决策、验收为主；不亲自写大段代码，不亲自 commit / push / lint / test。
   If conflict: 切 `Runner/Verifier` 或派 subagent；只有极小规范文件动作可例外。

5. `AGENT-H5 Review Gate`
   Trigger: `>100` 行代码改动、`>50` 行文档新增、任何鉴权/DB migration/安全敏感/API-DB-schema-状态机契约改动、任何前端视觉 phase。
   Must: 先做独立 `subagent review`；`>400` 行再加 master diff review；前端视觉还要独立规范审查官和 Browser MCP 验收。
   If conflict: review gate 未满足，不得宣告完成，不得标 `done`。

6. `AGENT-H6 Define First`
   Trigger: 跨服务 API、数据库 schema、DTO、状态机、工具 schema 等稳定边界变更。
   Must: 先定义边界，再实现；必要时先落 `docs/plan/*.md` 或定义性提交。
   If conflict: 边界没定义清楚，停止实现。

7. `AGENT-H7 Fail Fast`
   Trigger: 任何错误处理、fallback、默认值、容错设计。
   Must: 默认立刻抛错；禁止 silent catch / fallback / `?? defaultValue` 滥用。
   If conflict: 只有走完例外登记流程，才能加降级逻辑。

8. `AGENT-H8 Validation Before Done`
   Trigger: 任何交付前。
   Must: `typecheck + lint + tests` 必须过；UI 改动还要浏览器自验；没有 PASS 证据不得说完成。
   If conflict: 只能修复或标 `blocked/in_progress`，不能硬收口。

9. `AGENT-H9 Commit Batch`
   Trigger: 任何 commit / push 前。
   Must: 原子提交，一次一事；`>100` 行单 commit 必须拆；`<=15` 文件、`<=400` 行净增 per commit；禁止混合 plan/schema/实现/测试的大杂烩提交。
   If conflict: 先指出不合规，再拆 commit；不得带病提交。

10. `AGENT-H10 Environment Constraints`
    Trigger: 前端 dev、后端部署、VPS/server、数据库、投产流程。
    Must: 前端端口只用 `18080`；全场景禁 docker；永远本地 commit/push/pull，不在 VPS 上改源码或 commit。
    If conflict: 停止执行，并明确报约束冲突。

## Supporting Docs

- `AGENTS.md` / `CLAUDE.md` — 根级执行入口
- `docs/engineering/master-role.md` — Master 角色细则
- `docs/engineering/gate-automation.md` — Multica / review / validation / git 自动化门禁
- `docs/engineering/multica-workflow.md` — Multica intake / Evidence Block / Completion Gate
- `docs/engineering/git-workflow.md` — git / push / VPS 约束
- `docs/engineering/fail-fast-exceptions.md` — Fail-Fast 例外登记
- `docs/vault/04-design/Design-System.md` — 设计硬约束与前端审查清单
