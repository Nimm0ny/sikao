---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-14
---

# Multica 工作流详述

> 本文件承载 `CLAUDE.md §5.1 Multica 需求开发流程` 和 `§7.1 Multica Completion Gate` 的详细步骤、命令清单、Evidence Block 完整示例。
> CLAUDE.md 保留 Preflight 三命令 + 状态流转命令名 + Evidence Block 字段清单 + 一句话规则。
>
> **必读触发条件**：
> - 任务来自 Multica issue 时，开工前必读本文件 §Requirement Intake Gate
> - 完工时必读本文件 §Evidence Block 示例
> - daemon / auth 故障排查时必读本文件 §Preflight 故障处理

## Multica Preflight 详细流程

任务来自 Multica，或 lhr 明确要求使用 Multica CLI 时，agent 必须先执行：

```bash
multica auth status
multica daemon status --output json
multica version
```

验收：

- auth 必须有效
- daemon 必须 running
- 至少检测到一个可用 agent CLI
- 当前 workspace 必须被 daemon watch
- 当前 issue 必须存在且可读取

### Auth 未登录处理

```bash
multica login
```

要求：

- 只允许浏览器 OAuth 或交互式 token 输入
- 不得读取、保存、打印、提交 token
- 不得把 token 写进 shell history、日志、文档、commit message、issue comment
- 登录失败必须 fail-fast，不得继续开发

### Daemon 故障处理

```bash
multica daemon start
multica daemon status --output json
```

daemon 仍失败时：

```bash
multica daemon logs -n 100
```

然后报告 blocker。

## Requirement Intake Gate

任务来自 Multica issue 时，需求来源必须是 Multica issue，而不是聊天记忆。

开工顺序：

```bash
multica issue get <issue-id> --output json
multica issue comment list <issue-id>
multica issue runs <issue-id> --output json
```

agent 必须提取：

- 原始需求
- 验收标准
- 非目标
- 风险点
- 相关评论
- 相关执行历史
- 当前状态
- 是否已有 blocker
- 是否已有 plan doc
- 是否需要新建 plan doc

状态流转：

```bash
multica issue status <issue-id> in_progress
```

若当前 CLI 使用 `--set` 形式，则以 `multica issue status --help` 为准：

```bash
multica issue status <issue-id> --set in_progress
```

只有在需要跨模块方案、API / DB / schema / 状态机契约、架构变更、复杂前端重构时，才新建 `docs/plan/<issue-id>-<slug>.md`。

plan frontmatter 必须包含：

```yaml
---
type: engineering
status: draft
owner: xiaodeng
last-reviewed: YYYY-MM-DD
source: multica
multica-issue: <issue-id>
---
```

小任务不新建 plan doc，直接在 Multica issue comment 中记录需求提取结果和验收标准。没有完成 Requirement Intake，不得进入方案制定。

## 本地文档最小化规则

### 不得新建本地 plan doc（直接 Multica issue comment）

- 单文件 bugfix
- ≤100 行小重构
- 不改 API / DB / schema 的前端展示调整
- 文案调整
- 测试补充
- lint / typecheck 修复
- 小型样式修复
- 已有方案下的原子 PR

### 必须新建本地 plan doc

- DB migration
- API 契约变更
- 状态机变更
- 鉴权 / 安全 / 支付 / 隐私相关
- AI 调用链路 / prompt / scoring schema 变更
- 跨前后端联调
- 视觉体系变更
- >400 行净增
- 多 agent / 多 session 执行

## Completion Gate — Evidence Block

任务完成前必须回写 Evidence Block。

### Evidence Block 字段清单

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

### 回写命令

```bash
multica issue comment add <issue-id> --content "<Evidence Block>"
```

### 状态流转规则

```bash
# 开始实现
multica issue status <issue-id> in_progress

# 实现完成但等待 review / 人工确认
multica issue status <issue-id> in_review

# 验证完整通过后
multica issue status <issue-id> done

# 有阻塞
multica issue status <issue-id> blocked
```

若当前 CLI 使用 `--set` 形式，则以 `multica issue status --help` 为准。

### 规则

- 没有 PASS 证据，不得把 issue 标为 `done`
- 有 blocker，必须回写 blocker，不得静默失败
- 发现需求不清，必须回写 clarification needed，并将状态置为 `blocked`
- 验证未完成，只能标记为 `in_progress` / `blocked` / `in_review`，不能标记 `done`
- 若 Multica CLI 回写失败，必须在本地终端保留 Evidence Block，并报告 CLI 回写失败原因，不得伪造已回写

## 关联

- [[Master-Role]] — master 模式与 Multica issue 的关系
- [[Quick-Commands]] — Multica CLI 命令速查
