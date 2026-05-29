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
- `databases.work_log` — Work Log DB（Type 词表 7 项：`Daily / Review / Decision / Blocker / Deploy / Meeting / Evidence`）

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
   Must: 开始实现后 `Status=In Progress`；验证完整通过才 `Status=Done`；任务被阻塞时回退到 `Status=Backlog` 并在 Work Log 建 Type=Blocker 记录说明阻塞原因。
   Must not: 没有 PASS 证据就标 `Done`。
   Note: Status 词表 5 项锁定（`Backlog/Todo/In Progress/Done/Cancelled`）。`Backlog` 涵盖「未排期」与「已阻塞」两种语义，按 Work Log 上的 `Blocker` 条目区分。`In Review` 已于 2026-05-27 删除；如需恢复见项目页 §SSOT 约定 §3。

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

7. Body vs Comment 分工（结构化内容写 body）
   Trigger: 任何要写入 Notion issue 的内容。
   Must: 含 block-level markdown 的内容（`#` 标题、列表 `-/1.`、`>` 引用、` ``` ` 代码块、表格）一律写到 page body（`update_page` 的 `insert_content` / `update_content`）。
   Must not: 把上述内容塞进 comment / discussion；Notion comment 只渲染 inline rich text（`**bold**` / `*italic*` / `` `code` `` / 链接 / mention / 行内公式 / `<br>`）和 mention，block-level markdown 会原样显示成纯文本，破坏阅读体验。
   Allowed in comment: inline rich text、mention、行内公式、单段短消息。
   If conflict: 内容超过 1 段或需要结构化展示时，改写到 body 末尾的合适 section（如 `## Decision`、`## Discussion Archive`、`## Evidence Block`）。

8. Discussion Archive（comment 镜像到 body）
   Trigger: issue 已有历史 comment 且想要 markdown 渲染版本。
   Must: 在 issue page body 末尾追加 `## Discussion Archive` section，按时间序列出每条 comment（含 `### YYYY-MM-DD HH:MM author` 子标题、原 comment URL、内容 markdown 化）。
   Must not: 删除原 comment（保留 audit）；伪造作者 / 时间。
   Note: 原 comment 可在 Notion UI 自行 Resolve 折叠；archive 完成后新增内容直接走规则 7（写 body）。

9. Status SSOT
   Trigger: 任何按 issue 推进任务、读父 issue Child Matrix / Milestone Map 之类 body 表格。
   Must: 以 Issues DB 的 `Status` 字段为唯一真值。Body 内 Child Matrix / Milestone Map 等手写表可能 stale，必须 fetch 子 issue 验证 Status 字段后再决定推进。
   Must not: 凭父 issue body 表里的 status 列直接开工；不自动同步父 issue 表（保留人工编辑空间）。
   Note: 历史父 issue（SIK-29 / SIK-44 / SIK-45 / SIK-71 等）body 内的 Child Matrix 表多数停在 multica 时代，仅作脉络参考。

## Issue Authoring（新建 issue 必读）

新建 issue 时按以下规则操作。Notion DB 自带 5 份 `[Template] xxx` page 作为 body 骨架（见 §2.1~§2.5），文档与模板一一对应；任何漂移都以本节为准，模板 body 视为同步副本。

### 2.0 字段约定

| 字段 | 类型 | 新建必填 | 取值 / 说明 |
|---|---|---|---|
| `Title` | title | ✅ | `[<Tab 前缀> · <模块码>] <短标题>` 或 `<Phase / Decision 主题>`；前缀格式见 §2.1~§2.5 各模板 |
| `Identifier` | text | ✅ | `SIK-<NNN>`，**手填**，连续递增。取号步骤：mcp_notion_notion_search({data_source_url, query: "SIK-1", page_size: 25}) 扫近期编号 → fetch 各候选 page properties.Identifier → 取 max + 1。新号必须 +1 单调递增，不要复用已 cancelled 的编号 |
| `Tab` | select | ✅ | `Foundation / Tab1 Home / Tab2 Practice / Tab3 Review / Tab4 Note / Other / Template`（Template 仅给模板 page 用） |
| `Status` | select | ✅ | 新建默认 `Backlog`；准备进入排期 → `Todo`；不要直接开 `In Progress` |
| `Priority` | select | ✅ | `High / Medium / Low / None`（不写默认 `None`） |
| `Wave` | select | 视任务而定 | 多 wave 任务必填 `Wave 0~4`；单 wave 任务可空 |
| `Parent` | relation | 视任务而定 | 子 issue 必填，指向父 issue（同 Issues DB） |
| `Phase` | relation | 视任务而定 | 关联 Phases DB，跨 Phase 任务才连 |
| `Sub-issues` | relation | 不直接写 | Parent 反向自动同步，不要手写 |
| `Work Logs` | relation | 不直接写 | Work Log 条目反向自动同步，不要手写 |
| `Multica ID` | text | ❌ | 历史同步字段，新建留空；不要再填 |
| `date:Created:start` | date | ❌ | 留空让 Notion UI 自动填；通过 API 创建可手填 ISO `YYYY-MM-DD` |
| `date:Updated:start` | date | ❌ | 同上 |
| `date:Last Synced:start` | date | ❌ | Multica 同步字段，新 issue 不再使用，留空 |

> 不要再在 body 顶部写 `> **Multica**: ...` 三行 + `---` 的 meta 段。那是历史同步格式，SIK-138 起已废弃。

### 2.1 Tab 子 issue · visual

视觉类 milestone（含新建 view、改 view 布局、改卡片密度、改 Calendar/列表骨架）。**触发硬规则 H11，必须先落 visual-contract.md。**

- Notion 模板：`[Template] Tab 子 issue (visual)`
- 标题前缀：`[Tab# · M-XXX] <短标题>`（如 `[Tab2 · M-Center] PracticeCenter + Section A 历史记录`）
- Tab：`Tab1 Home / Tab2 Practice / Tab3 Review / Tab4 Note` 之一
- Wave：默认 `Wave 0`（落契约），实施进入 Wave 1
- Body 骨架：

```markdown
# [Tab# · M-XXX] <短标题>
> 父：<父 issue mention> · Tab# 总线
> （可选）取代旧 SIK-XXX，本 issue 做 <增量类型>。

## Summary
<3 行内说清这个 milestone 做什么>

## 现状
- <文件 EXIST/NOT EXIST 速查>

## Visual Contract（H11 强制段）
- Contract 文件：`docs/plan/sik-tabN-XXX-visual-contract.md`（Runner Wave 0 落契约）
- 原型 HTML：`.tmp_review/out/TabN-Yyy/**`
- 复用规则：若有同名旧 contract（cancelled 时代），优先复用并改写 frontmatter `notion-issue-url`

## Scope
### 落地路径
- `apps/web/src/views/...`
### 接线对象
- `xxxQueries.useXxx`

## Acceptance
- [ ] 实现按 contract 完成；Acceptance Hooks 全 PASS
- [ ] vitest-axe 0 violation
- [ ] Chrome MCP diff 1920 双 Rail 态
- [ ] 独立 subagent review → `docs/reviews/sik-tab-XXX-w*.md`
- [ ] Evidence Block 走 Work Log Type=Evidence 条目

## Wave Plan
- Wave 0: visual-contract.md
- Wave 1: <主体>
- Wave N: <收尾>

## Depends on
- <前置 issue mention>

## Source Docs
- audit: docs/reviews/...
- 04-Frontend-WU.md WU-FXX
- 原型: .tmp_review/out/TabN-Yyy/
```

### 2.2 Tab 子 issue · non-visual

API / Stores / Maint / Schema 等非视觉 milestone。**不触发 H11。**

- Notion 模板：`[Template] Tab 子 issue (non-visual)`
- 标题前缀：`[Tab# · M-XXX] <短标题>`（如 `[Tab2 · M-Api] queries 扩展 + types 重生成`）
- Body 骨架：

```markdown
# [Tab# · M-XXX] <短标题>
> 父：<父 issue mention>
> non-visual，不触发 H11。

## Summary
<3 行内说清做什么>

## 现状
<现有文件清单 + 状态>

## Scope
### 1. <第一步>
### 2. <第二步>

## Acceptance
- [ ] typecheck PASS
- [ ] lint PASS
- [ ] <非视觉判定>
- [ ] 独立 subagent review → `docs/reviews/sik-tab-XXX-w*.md`
- [ ] Evidence Block 走 Work Log Type=Evidence 条目

## Wave Plan
- Wave 1: <实施>
- Wave 2: <验证>

## Source Docs
- audit: docs/reviews/...
- 04-Frontend-WU.md WU-FXX
```

### 2.3 Foundation cross-tab

跨 Tab 基础设施 issue（layout / token / nav / cap / 1920 viewport contract 等）。

- Notion 模板：`[Template] Foundation cross-tab`
- 标题前缀：`[Foundation · XXX] <短标题>`（如 `[Foundation · Layout] Workspace 1920 cap`）
- Tab：`Foundation`
- Priority：默认 `High`（基础设施改动一般高优先）
- Body 骨架：

```markdown
# [Foundation · XXX] <短标题>
> Cross-Tab 基础设施 issue。源自 <触发背景>。
> Audit / Post-mortem 已落档：
> - `docs/reviews/...-audit.md`
> - `docs/reviews/...-postmortem.md`

## Summary
<问题描述 + 事故分类>

## 影响半径
| view | 影响点 | 严重度 |
|---|---|---|
| ... | ... | High/Medium/Low |

## Root Cause
<5-Whys 节选>

## 提议解决方案
<路线 A/B/C，选项含 pros/cons + 拍板>

## Acceptance
- [ ] <硬规则锁定项 1>
- [ ] <硬规则锁定项 2>
- [ ] 跨 Tab 验证 / 截图归档

## Non-goals
- ...

## Review / Validation Gate
- H4 / H5 / H10 / H11 适用范围

## Source Docs
- ...

## Related Issues
- ...
```

### 2.4 Decision

重大决策（路线选择 / 词表锁定 / SSOT 变更）独立成 issue 留档。

- Notion 模板：`[Template] Decision`
- 标题：`Decision: <主题>（YYYY-MM-DD）`
- Tab：`Other`
- Priority：默认 `High`
- Status：拍板后直接 `Done`
- Body 骨架：

```markdown
# Decision: <主题>（YYYY-MM-DD）
> 拍板人：<who>
> 触发：<why>

## 选项
- **A** — <描述>
  - pros: <...>
  - cons: <...>
- **B** — <描述>
  - pros: <...>
  - cons: <...>

## 拍板
**选项 X**，理由：<3 行内>

## 落地清单
- [ ] <动作 1>
- [ ] <动作 2>

## SSOT 同步
- 改 <文件 1>
- 改 <文件 2>

## Related Issues
- <受影响的 issue mention>

## Work Log
拍板后需同步在 Work Log 建一条 Type=Decision 的 entry，并在本 page 底部加 mention。
```

### 2.5 Audit / Review

Audit / Review / Post-mortem。

- Notion 模板：`[Template] Audit / Review`
- 标题：`Audit: <主题>（YYYY-MM-DD）` 或 `Review: <主题>（YYYY-MM-DD）`
- Tab：`Other`
- Body 骨架：

```markdown
# Audit: <主题>（YYYY-MM-DD）
> 触发：<触发人 + 触发动作>
> Reviewer mode: independent / fallback
> 取证范围：
> - <数据来源 1>
> - <数据来源 2>
> 不取证范围：
> - <未跑的验证>

## TL;DR
<一段表格速览>

## 关键发现
### F1 (priority) <名称>
- 现象：
- 影响：
- 解决方案：
- 优先级：High / Medium / Low

## 处理优先级汇总
| 优先级 | 编号 | 问题 | 建议动作 |
|---|---|---|---|
| High | F1 | ... | ... |

## Source Docs
- <取证产出路径>
```

### 2.6 通用约定

- 标题里的方括号 `[...]` **直接写**，不要 escape 成 `\[...\]`（Notion fetch 输出会 escape，仅 protocol 层；UI 不要写转义）
- 子标题 (`##` / `###`) 用半角空格，禁中文全角冒号当分隔符
- 父子关系**只用 `Parent` 字段**（reverse 自动填 `Sub-issues`）；不要在 body 里手写 `## Sub-issues` 列表，重复且容易漂移
- Phase 关系**只用 `Phase` 字段**；不要在 body 写 `> Phase: xxx` 行
- 跨 issue 引用用 Notion mention（输入 `@SIK-128` Notion 自动补全），fallback 才用 `[SIK-128](page url)`
- block-level markdown 写 body（H7 已强制，见 §Rules · 7）
- 创建后的标准动作：见 §Rules · 3（status 流转） / §Rules · 4（Evidence Block） / §Standard 4-Action

### 2.7 用 MCP 创建（参考调用）

新建 issue 前先读 `.notion/anchors.json` 拿到对应模板 page id（5 个 template 的 key + page_id 已锁定到 `databases.issues.templates` 段），不要再 search 重建。

```text
mcp_notion_notion_create_pages({
  parent: { data_source_id: "<issues.data_source_id from anchors.json>" },
  pages: [{
    template_id: "<anchors.json databases.issues.templates.<key>.page_id>",   // 可选；用模板时不写 content；key 见 §2.1~§2.5 对应的 templates 子段
    properties: {
      Title: "[Tab2 · M-Api] queries 扩展 + types 重生成",
      Identifier: "SIK-139",
      Tab: "Tab2 Practice",
      Status: "Backlog",
      Priority: "High",
      Wave: "Wave 1"
    }
  }]
})
```

不用模板时把 §2.1~§2.5 对应骨架贴到 `content` 字段（Notion 接收 markdown），properties 同上。

## Standard 4-Action（替代 multica CLI 三读 + status）

```text
A. 找 issue（SIK-xxx → page_id）
   A1. 主路径：mcp_notion_notion_search({
         data_source_url: "<anchors.issues.data_source_url>",
         query: "<issue Title 关键词>",
         page_size: 5
       })
       注意：纯 SIK-NNN query 容易被 mention 引用淹没，优先用 Title 关键词。
   A2. 父 issue 已知时取 Sub-issues 字段拿候选 URL 列表，但 Sub-issues 顺序不可靠，
       不要按 index 推断 Identifier，必须 fetch 每个 URL 看 properties.Identifier 才能确认。
   A3. fallback：read anchors.json 拿 Issues data_source_url，按 Identifier 关键字 filter。

B. Intake（等价 multica issue get + comment list + runs）
   B1. mcp_notion_notion_fetch({id: <page_id>, include_discussions: true})
       拿 issue body / discussions / properties。
   B2. 若是父 issue（含 Child Matrix / Sub-issues 列表）：逐个 fetch 子 issue 拿真实 Status，
       不要按父 issue body 内手写表的 status 推进（见 §Rules · 9）。
   B3. 按 Issues relation filter Work Log DB 拿历史 run 记录；
       2026-05-28 之前迁移的 issue 通常没 Work Log 关联，是正常情况，不视为 intake 失败。

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

## Discussion Archive 模板

历史 / 新增 comment 镜像到 body 时统一格式（规则 8）：

```text
## Discussion Archive

### 2026-05-27 23:24 lhr

> [原 comment](https://www.notion.so/<page>?d=<discussion>)

**[2026-05-27 audit] Cross-Tab 阻塞 — 推荐路线 + deadline**

本 issue 当前阻塞 Tab1/2/3/4 全部 wave 验收。

- 推荐路线 B
- Deadline 2026-05-28 24:00 (Beijing)
```

约定：
- 子标题用 `### YYYY-MM-DD HH:MM author`（北京时区）
- 引用块第一行放原 comment 链接，方便回到 Notion 看 thread
- 原内容把 `<br>` 还原为换行；inline `**bold**` / 链接保留
- 镜像后**不删原 comment**（保留 Notion 端 audit，UI 可 Resolve 折叠）

## Links

- `docs/engineering/gate-automation.md`
- `docs/engineering/agent-hard-rules.md`
- `.notion/anchors.json`
