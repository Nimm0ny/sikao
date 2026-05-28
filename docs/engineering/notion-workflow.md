---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-28
---

# Notion Workflow

> Notion 是项目台账 SSOT；不替代工程门禁。Multica 已废弃，但历史 SIK-xxx 编号在 `Identifier` 字段保留，agent 按 SIK-xxx 查找。

## Anchors

仓内 `.notion/anchors.json`（gitignored，类似 `.multica/`）登记：

- `workspace.project_page_id` — SIKAO 项目页
- `databases.issues` — Issues DB（`identifier_field=Identifier`，5 项 Status 词表）
- `databases.phases` — Phases DB
- `databases.work_log` — Work Log DB（7 项 Type，含 `Evidence`）

agent 启动时读 `.notion/anchors.json`；文件丢失必须 fail-fast，不得静默 search 重建。

## Rules

1. Capability check
   Trigger: 任务来自 Notion issue 或需要回写 Evidence Block。
   Must: 跑 `mcp_notion_notion_search({query: "SIKAO", page_size: 1})` 自验。
   If conflict: Notion MCP 不可用时 fail-fast，停止任务并报告。

2. Issue intake
   Trigger: 任务来自 Notion issue。
   Must: 读 issue page、discussions、关联 Work Log，再提取 requirement / acceptance / non-goals / blockers。
   Must not: 凭记忆操作 page id / collection id；先读 anchors.json 或 search by Identifier。

3. Status 流转
   Must: 开始实现后 `Status=In Progress`；验证完整通过才 `Status=Done`；阻塞 `Status=Backlog` 并在 Work Log 建 Type=Blocker 记录。
   Must not: 没有 PASS 证据就标 `Done`。
   Note: Status 词表 5 项锁定（`Backlog/Todo/In Progress/Done/Cancelled`）。`In Review` 已于 2026-05-27 删除；如需恢复见项目页 §SSOT 约定 §3。

4. Evidence Block
   Trigger: 任务交付前。
   Must: 在 issue page body 末尾 `## Evidence Block` section 写完整证据；同时在 Work Log 建一条 Type=`Evidence` 关联本 issue 的记录。
   Must not: CLI / MCP 回写失败时伪造已回写。

5. Local plan docs
   Must: 小任务写 issue page comment / discussion；只有跨模块 / 契约 / DB / 安全 / 视觉体系 / 多 session 任务才新建 `docs/plan/*.md`，frontmatter 用 `notion-issue-url`。
   Must not: 为了记录进度新建本地文档。

6. Token safety
   Must not: 读取、打印、保存、提交 Notion / Multica token。
   Note: Notion MCP 走用户 OAuth，agent 端无需 token；`.multica/config.json` 中的 multica token 仅作历史保留，不再调用。

## Standard 4-Action（替代 multica CLI 三读 + status）

```text
A. 找 issue（SIK-xxx → page_id）
   mcp_notion_notion_search({query: "SIK-128", page_size: 5})
   或读 anchors.json 拿 Issues data_source_url，按 Identifier filter。

B. Intake（等价 multica issue get + comment list + runs）
   mcp_notion_notion_fetch({id: <page_id>, include_discussions: true})
   并按 Issues relation filter Work Log DB。

C. Status 流转（等价 multica issue status）
   mcp_notion_notion_update_page({
     page_id: <page_id>,
     command: "update_properties",
     properties: { Status: "In Progress" }
   })

D. Evidence 回写
   D1. issue page body 末尾追加 ## Evidence Block：
       mcp_notion_notion_update_page({
         page_id, command: "insert_content",
         position: {type: "end"},
         content: "## Evidence Block\n..."
       })
   D2. Work Log 建关联记录：
       mcp_notion_notion_create_pages({
         parent: {data_source_id: "<work_log.data_source_id>"},
         pages: [{
           properties: {
             Title: "<SIK-xxx> Evidence",
             Type: "Evidence",
             "date:Date:start": "2026-05-28",
             "date:Date:is_datetime": 0,
             Issues: <issue page url>,
             Summary: "<one-line>"
           }
         }]
       })
```

## Evidence Block 字段

```text
Mode:
Notion issue URL:
Identifier:
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
- `.notion/anchors.json`
