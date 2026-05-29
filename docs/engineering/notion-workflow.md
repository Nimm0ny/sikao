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
- `databases.work_log` — Work Log DB（Type 词表 8 项：`Daily / Review / Decision / Blocker / Deploy / Meeting / Evidence / Status Change`）

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
   Note: issue 转 `Status=Done` 会触发 automation 自动建一条 Work Log `Type=Status Change` 行（To Status=Done）。agent 在交付时应额外回填该行的 `Commits` 字段（本次合并的 commit message + hash），方法见 `docs/plan/worklog-status-rhythm-2026-05-29.md` §#4：按 Issues relation + To Status=Done + 当日 Date filter 找到该行，`update_page` 填 `Commits`。人手在 UI 改 Done 无 commit 上下文，可跳过。

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

10. update_content 反馈环（fetch-before / verify-after）
    Trigger: 任何 `mcp_notion_notion_update_page` `command="update_content"` 调用。
    Must: 调用前先 `mcp_notion_notion_fetch` 拿到目标 page 的 rendered markdown，按 fetch 输出形式（含 Notion auto-linkify、`\>` `\#` `\[` 等 escape）构造 `old_str`；调用后立即再 `fetch` 一次校验目标行已变更。
    Must not: 凭本地 plan doc 里的"原始 markdown"直接拼 `old_str`；只看 `update_page` 返回 `{page_id}` 200 就当成功（即使 0 替换 API 也返回 200）。
    If conflict: verify-after 发现目标行未变更时 fail-fast 上报 silent miss，不得静默重试或继续后续 update；如确需重试，必须重新 fetch-before 构造 old_str 后再调用，并在 Evidence Block / Work Log Type=Blocker 记录前一次 silent miss（与 H7 Fail-Fast / §4.1 一致）。
    Note: 已知 Notion auto-linkify 模式（fetch 输出会渲染成 `[text](http://text)`）：
      - `xxx.md` / `xxx.html`（如 `notion-workflow.md` → `[notion-workflow.md](http://notion-workflow.md)`）
      - `xxx.com` / `xxx.io` / `xxx.dev` 等域名样裸文本
      - 其它顶级域 + 子域命名
      `>` 引用块、`<>` 占位符、`[]` 标题方括号会被 escape 成 `\>` / `\<...\>` / `\[...\]`，构造 `old_str` 时按 fetch 输出抄。
    Note: 完整 escape 表见 §Notion fetch escape 速查（在 §Discussion Archive 模板之后）。
    Note: 适用范围 — 仅 `update_content` / `replace_content`（涉及 markdown 字符串匹配的 command）；`insert_content` / `update_properties` / `apply_template` 不受此规则约束（前者是 append/prepend 不存在 old_str，后两者走结构化字段或模板引用，无 escape 风险）。

11. Status Rhythm automation（Work Log 自动节奏）
    Trigger: 任何改 Issues DB `Status` 字段的操作（agent MCP `update_properties` 或人手 UI 改）。
    Must: 知道改 `Status` 会**自动**触发 Issues DB 上 5 条 automation 之一，在 Work Log 建一条 `Type=Status Change` 行（记 `From Status`/`To Status`/`Date=now()`/`Issues` relation），并把触发 issue 的 `Prev Status` 追平 + 往 `Status History` 追加一节点。agent 无需手动建 Status Change 行。
    Must not: 手动在 Work Log 建 `Type=Status Change` 行（automation 已负责，手建会重复）；不要手改 issue 的 `Prev Status` / `Status History`（automation 维护的影子字段，手改会与下次 automation desync）。
    Note: issue→`Done` 时除自动行外，agent 还要回填该 Status Change 行的 `Commits` 字段（见 §Rules · 4 + §Standard 4-Action D3）。
    Note: 新建 issue 时设了 `Status`（默认 `Backlog`）也会触发一次 automation，产生一条 `From=To` 的「🆕 新增」自反行——这是预期行为，Work Log `Event` 公式列会把它标成「🆕 新增」与真实转变区分。完整设计见 `docs/plan/worklog-status-rhythm-2026-05-29.md`。
    If conflict: 不要为了"补历史"手动造 Status Change 行；automation 只对启用日（2026-05-29）之后的转变生效，历史转变时间已丢，以 audit snapshot 为基线。

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
| `Prev Status` | select | ❌ 不直接写 | 影子字段，由 Status Rhythm automation 维护（见 §Rules · 11）。新建 issue 时可设为与 `Status` 同值（backfill 一致性）；之后不要手改 |
| `Status History` | text | ❌ 不直接写 | 推进轨迹链（`Backlog → In Progress → Done`），automation 自动累积。新建可初始化为当前 `Status` 单节点；之后不要手改 |
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
   > 改 Status 会自动触发 Status Rhythm automation（见 §Rules · 11）：Work Log 自动建 Type=Status Change 行 + 追平 Prev Status + 追加 Status History。agent 不用手建该行。新建 issue 时建议把 Prev Status / Status History 设成与 Status 同值（见 §2.0），保持影子字段一致。

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
   D3. 回填 Commits（仅 issue→Done 时）：
       Status 改 Done 后，automation 已自动建了一条 Work Log Type=Status Change / To Status=Done 行。
       按 Issues relation + To Status=Done + 当日 Date filter 找到该行，
       mcp_notion_notion_update_page 填它的 `Commits` 字段（本次合并的 commit message + hash，取自 git log）。
       人手在 UI 改 Done 无 commit 上下文，可跳过（见 §Rules · 4）。

> 注：以及后续任何用 `command="update_content"` / `replace_content` 修改 issue body / Discussion Archive / 其它 page 的场景，强制走 §Rules · 10 反馈环（fetch-before 构造 old_str + 调用后再 fetch 校验），不要只看 200 返回。本注与 D 步骤无关，是横向适用提醒。
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

## Notion fetch escape / auto-linkify 速查

`mcp_notion_notion_fetch` 返回的 markdown 不是原始 markdown，是 Notion 渲染层处理过的结果。`update_content` 的 `old_str` 必须按 fetch 输出形式构造，否则 silent miss（API 返回 200 但 0 替换，见 §Rules · 10）。

> 数据来源：以下 `.md` auto-linkify 模式于 2026-05-29 在 4 个 `[Template] xxx` page 实测验证；其余模式（`.com / .io / .dev`、`>` / `<>` / `[]` escape 等）基于 fetch 渲染输出推断，**遇到未列模式仍以 §Rules · 10 verify-after 为准**，不要把本表当封闭白名单。

| 类别 | 原始 / 你想写的 | fetch 实际返回 | 来源 |
|---|---|---|---|
| 自动链接化（域名样裸文本） | `notion-workflow.md` | `[notion-workflow.md](http://notion-workflow.md)` | 实测 |
| 同上 | `example.com` / `mysite.io` | `[example.com](http://example.com)` | 推断 |
| 引用块（行首 `>`） | `> 详见 …` | `\> 详见 …`（fetch 输出层 escape） | 推断 |
| 占位符 | `<短标题>` / `<who>` | `\<短标题\>` / `\<who\>` | 推断 |
| 标题方括号 | `[Tab# · M-XXX]` | `\[Tab# · M-XXX\]` | 推断 |
| 标题井号 | `# 一级标题` | `\# 一级标题`（仅在 fetch 出现，原文写 `#` 即可） | 推断 |

**操作守则**：
1. 写 `update_content` 调用前先跑一次 `mcp_notion_notion_fetch`，把 `old_str` 复制自 `<content>` 块。
2. 不要凭本地 plan doc 里的"原始 markdown"直接拼 `old_str`。
3. `new_str` 用原始 markdown 即可（Notion 入库时会重新渲染）；只有 `old_str` 受 fetch 形式约束。
4. 调用后立即再 fetch 校验目标行已变更；不要只看 `update_page` 返回 `{page_id}` 200 当成功。
5. 一次 update 多条 `content_updates` 时，**任一条 silent miss API 仍返回 200**——必须逐条 verify。
6. 推荐 verify 范式（任选其一）：
   - **范式 A（一次 fetch 全检）**：调用后跑一次 `mcp_notion_notion_fetch`，对每条 `content_updates.new_str` 在 `<content>` 里做子串包含检查；匹配前对 `.md` / 域名样裸文本 / `>` `<>` `[]` 等做 auto-linkify / escape 反向预处理（参考上表）。调用次数最少。
   - **范式 B（拆单条 + 单次 fetch）**：把多条 `content_updates` 拆成 N 次单条 `update_content` 调用，每次后单独 `fetch` 校验。简单、不需要预处理，但调用次数翻倍。
   - 两种范式都满足 §Rules · 10 verify-after 要求；选哪种看上下文（批量小用 A，迁移类大批量用 B）。

## Work Log Status Rhythm（推进节奏自动化速查）

2026-05-29 上线。目的：在 Work Log 日历上一眼看到项目推进节奏（每条 issue 的 Status 转变事件流）。完整设计 `docs/plan/worklog-status-rhythm-2026-05-29.md`。

**自动机制（agent 只需知道、不用手动维护）**：
- Issues DB 上 5 条 UI automation（每个目标 Status 一条），监听 `Status is set to <X>`。
- 触发后：① 在 Work Log 建 `Type=Status Change` 行（`From Status` 取自 issue `Prev Status` 影子字段、`To Status=X`、`Date=now()`、`Issues` relation 指回）；② 把 issue 的 `Prev Status` 追平到 X；③ 往 issue `Status History` 追加 ` → X`。
- 不改 `Status` 本身，无自触发循环。

**字段分工**：

| DB | 字段 | 谁维护 | agent 动作 |
|---|---|---|---|
| Issues | `Prev Status` (select) | automation | 新建时设为与 Status 同值；之后**不手改** |
| Issues | `Status History` (text) | automation | 新建时设为当前 Status 单节点；之后**不手改** |
| Work Log | `From Status` / `To Status` (select) | automation | 不手填 |
| Work Log | `Date` (datetime) | automation `now()` | 不手填 |
| Work Log | `Event` (formula) | 公式自动算 | 只读；`From==To` 显示「🆕 新增」，否则「From → To」 |
| Work Log | `Commits` (text) | **agent** | issue→Done 时回填 commit message + hash（§Standard 4-Action D3） |

**已知限制**：
- 无历史回溯（automation 只对 2026-05-29 后的转变生效，旧转变时间已丢，基线见 `docs/reviews/notion-issues-status-audit-2026-05-29.md`）。
- 新建 issue（默认 Backlog）会产生一条 `From=To` 的「🆕 新增」自反行，属预期，`Event` 公式标注区分。
- 秒级连续两次 flip 可能让 `Prev Status` 影子字段 desync（本工作流几乎不发生，可接受）。

## Links

- `docs/engineering/gate-automation.md`
- `docs/engineering/agent-hard-rules.md`
- `.notion/anchors.json`
- `docs/plan/worklog-status-rhythm-2026-05-29.md` — Work Log 推进节奏自动化设计（schema + 5 automation + 日历 view）
