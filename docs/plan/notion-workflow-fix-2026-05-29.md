---
type: plan
status: ready-to-execute
owner: lhr
created: 2026-05-29
notion-issue-url: (新建一个 SIK-139 或直接当 hotfix 跑，本次先直接 hotfix)
---

# Notion 工作流落地后 dry-run 修复方案

## 背景

2026-05-28 完成 multica → Notion 切换：

- `docs/engineering/notion-workflow.md` 已加 §Rules · 7+8 + §Issue Authoring（§2.0~§2.7）
- `AGENTS.md` / `CLAUDE.md` 已同步切到 Notion 链路
- Notion DB 已建 5 份 `[Template] xxx` page

2026-05-29 dry-run「开始下一个 Home Phase 任务」时测出 5 个真实盲点（详见本会话 history）。本 plan 给出可直接执行的修复清单。

## 模式 + 适用范围

- 模式：Runner（直接修文档 + 5 次 Notion update_page 调用）
- H5 review gate：本次总改动 ~30 行文档 + 5 次 Notion 端 page 内容修改，不触发独立 subagent review 阈值；自检 + scoped validation 即可
- 不动产品代码 / DB schema / API 契约

## 修复清单总览

| # | 修复 | 文件 / 位置 | 工作量 |
|---|------|------------|--------|
| F1 | 加「Status 字段为准」规则 + Child Matrix stale 警告 | `notion-workflow.md` §Rules + §Standard 4-Action | ~10 行 |
| F2 | anchors.json 加 templates 段 + §2.7 引用 | `.notion/anchors.json` + `notion-workflow.md` §2.7 | ~15 行 |
| F3 | §Standard 4-Action 加 search/sub-issues 边角说明 + Work Log 空集说明 | `notion-workflow.md` §Standard 4-Action | ~10 行 |
| F4 | §2.0 Identifier 取号给具体命令 | `notion-workflow.md` §2.0 | ~3 行 |
| F5 | Notion 端 5 个 template body 章节号同步 + 改 multica-issue 为 notion-issue-url | Notion `[Template] xxx` 5 个 page | 5 次 `update_page` 调用 |


## F1 加「Status 字段为准」规则 + Child Matrix stale 警告

**为什么**：dry-run 发现 SIK-29 父 issue 的 Child Matrix 表写 SIK-42/43 = `todo`，但实际 `Status=Cancelled`。父 issue body 是手写表，Issues DB 字段是真值。

### F1.1 修改 `docs/engineering/notion-workflow.md` §Rules

在现有规则 8（Discussion Archive）之后追加规则 9：

```markdown
9. Status SSOT
   Trigger: 任何按 issue 推进任务、读父 issue Child Matrix / Milestone Map 之类 body 表格。
   Must: 以 Issues DB 的 `Status` 字段为唯一真值。Body 内 Child Matrix / Milestone Map 等手写表可能 stale，必须 fetch 子 issue 验证 Status 字段后再决定推进。
   Must not: 凭父 issue body 表里的 status 列直接开工；不自动同步父 issue 表（保留人工编辑空间）。
   Note: 历史父 issue（SIK-29 / SIK-44 / SIK-45 / SIK-71 等）body 内的 Child Matrix 表多数停在 multica 时代，仅作脉络参考。
```

### F1.2 修改 §Standard 4-Action 的 B 步骤

把：

```text
B. Intake（等价 multica issue get + comment list + runs）
   mcp_notion_notion_fetch({id: <page_id>, include_discussions: true})
   并按 Issues relation filter Work Log DB。
```

改为：

```text
B. Intake（等价 multica issue get + comment list + runs）
   B1. mcp_notion_notion_fetch({id: <page_id>, include_discussions: true})
       拿 issue body / discussions / properties。
   B2. 若是父 issue（含 Child Matrix / Sub-issues 列表）：逐个 fetch 子 issue 拿真实 Status，
       不要按父 issue body 内手写表的 status 推进（见 §Rules · 9）。
   B3. 按 Issues relation filter Work Log DB 拿历史 run 记录；
       2026-05-28 之前迁移的 issue 通常没 Work Log 关联，是正常情况，不视为 intake 失败。
```


## F2 anchors.json 加 templates 段 + §2.7 引用

**为什么**：§2.7 写 `template_id: "<对应 §2.1~§2.5 的 [Template] page id>"` 但没列实际 id，agent 用模板必须再 search 一次。template id 应锁到 anchors.json，与 collection / database id 同源。

### F2.1 修改 `.notion/anchors.json`

在 `databases.issues` 段尾追加 `templates` 子段（在 `wave_options` 之后、闭合 `}` 之前）：

```json
"templates": {
  "_note": "Issue page templates. 详见 docs/engineering/notion-workflow.md §2.1~§2.5。新建 issue 时把对应 template_id 传给 mcp_notion_notion_create_pages。",
  "tab_visual": {
    "page_id": "36ebc174-f6c8-81e9-83aa-f223618d7d64",
    "doc_section": "§2.1",
    "use_when": "视觉类 milestone（含新建 view、改 view 布局、改卡片密度、改 Calendar/列表骨架）；触发 H11"
  },
  "tab_non_visual": {
    "page_id": "36ebc174-f6c8-81d4-9e64-ccc473f5baa7",
    "doc_section": "§2.2",
    "use_when": "API / Stores / Maint / Schema 等非视觉 milestone；不触发 H11"
  },
  "foundation_cross_tab": {
    "page_id": "36ebc174-f6c8-81d7-ab93-c1360db09a88",
    "doc_section": "§2.3",
    "use_when": "跨 Tab 基础设施 issue（layout / token / nav / cap / 1920 viewport contract 等）"
  },
  "decision": {
    "page_id": "36ebc174-f6c8-8176-a961-c809b2c0f388",
    "doc_section": "§2.4",
    "use_when": "重大决策（路线选择 / 词表锁定 / SSOT 变更）独立成 issue 留档"
  },
  "audit_review": {
    "page_id": "36ebc174-f6c8-81d2-8bab-c49bb6053ed8",
    "doc_section": "§2.5",
    "use_when": "Audit / Review / Post-mortem"
  }
}
```

### F2.2 修改 `notion-workflow.md` §2.7

把现有调用模板里的 `template_id` 注释行改成：

```text
template_id: "<anchors.json databases.issues.templates.<key>.page_id>",   // 可选；用模板时不写 content；key 见 §2.1~§2.5 对应的 templates 子段
```

并在调用模板上方加一段引导：

```markdown
新建 issue 前先读 `.notion/anchors.json` 拿到对应模板 page id（5 个 template 的 key + page_id 已锁定到 `databases.issues.templates` 段），不要再 search 重建。
```


## F3 §Standard 4-Action 加 search 边角说明

**为什么**：dry-run 第一次用 `query: "SIK-29 Home Phase"` 没命中主 page（被 mention 高亮淹没）；改用 Title 关键词才找到。Sub-issues 数组顺序也不可靠（按 index 第 12 个推断 SIK-42 实际是 SIK-33）。

### F3.1 修改 `notion-workflow.md` §Standard 4-Action 的 A 步骤

把：

```text
A. 找 issue（SIK-xxx → page_id）
   mcp_notion_notion_search({query: "SIK-128", page_size: 5})
   或读 anchors.json 拿 Issues data_source_url，按 Identifier filter。
```

改为：

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
```


## F4 §2.0 Identifier 取号给具体命令

**为什么**：§2.0 字段表写「当前最大编号见 Issues DB 视图」，但 agent 不能看 UI。需要给可执行命令。

### F4.1 修改 §2.0 字段表里 `Identifier` 那行

把：

```markdown
| `Identifier` | text | ✅ | `SIK-<NNN>`，**手填**，连续递增（当前最大编号见 Issues DB 视图，新号 = max + 1） |
```

改为：

```markdown
| `Identifier` | text | ✅ | `SIK-<NNN>`，**手填**，连续递增。取号步骤：mcp_notion_notion_search({data_source_url, query: "SIK-1", page_size: 25}) 扫近期编号 → fetch 各候选 page properties.Identifier → 取 max + 1。新号必须 +1 单调递增，不要复用已 cancelled 的编号 |
```

## F5 修 Notion 端 5 个 Template body

**为什么**：Notion 端 5 份 `[Template] xxx` body 内引用 `notion-workflow.md §2.X` 的章节号在我新写文档前就已经存在，章节号偏移 1（visual 写的 §2.2，实际文档现在是 §2.1）。Visual template 还残留 `frontmatter multica-issue: SIK-XXX` 字段。

### F5 章节号 mapping 表（新会话照此修）

| Template | page_id | 当前 body 写的 § | 应改为 § |
|---|---|---|---|
| Tab 子 issue (visual) | `36ebc174-f6c8-81e9-83aa-f223618d7d64` | §2.2 | §2.1 |
| Tab 子 issue (non-visual) | `36ebc174-f6c8-81d4-9e64-ccc473f5baa7` | §2.3 | §2.2 |
| Foundation cross-tab | `36ebc174-f6c8-81d7-ab93-c1360db09a88` | §2.4 | §2.3 |
| Decision | `36ebc174-f6c8-8176-a961-c809b2c0f388` | §2.6 | §2.4 |
| Audit / Review | `36ebc174-f6c8-81d2-8bab-c49bb6053ed8` | §2.5 | §2.5（无需改）|


### F5.1 visual template `update_content` 调用

```text
mcp_notion_notion_update_page({
  page_id: "36ebc174-f6c8-81e9-83aa-f223618d7d64",
  command: "update_content",
  content_updates: [
    {
      old_str: "> 详见 docs/engineering/notion-workflow.md §2.2",
      new_str: "> 详见 docs/engineering/notion-workflow.md §2.1"
    },
    {
      old_str: "**复用规则**：若有同名旧 contract（cancelled 时代），优先复用并改写 frontmatter `multica-issue: SIK-XXX`",
      new_str: "**复用规则**：若有同名旧 contract（cancelled 时代），优先复用并改写 frontmatter `notion-issue-url`"
    }
  ]
})
```

### F5.2 non-visual template

```text
mcp_notion_notion_update_page({
  page_id: "36ebc174-f6c8-81d4-9e64-ccc473f5baa7",
  command: "update_content",
  content_updates: [
    {
      old_str: "> 详见 docs/engineering/notion-workflow.md §2.3",
      new_str: "> 详见 docs/engineering/notion-workflow.md §2.2"
    }
  ]
})
```

### F5.3 Foundation cross-tab template

```text
mcp_notion_notion_update_page({
  page_id: "36ebc174-f6c8-81d7-ab93-c1360db09a88",
  command: "update_content",
  content_updates: [
    {
      old_str: "> 详见 docs/engineering/notion-workflow.md §2.4",
      new_str: "> 详见 docs/engineering/notion-workflow.md §2.3"
    }
  ]
})
```

### F5.4 Decision template

```text
mcp_notion_notion_update_page({
  page_id: "36ebc174-f6c8-8176-a961-c809b2c0f388",
  command: "update_content",
  content_updates: [
    {
      old_str: "> 详见 docs/engineering/notion-workflow.md §2.6",
      new_str: "> 详见 docs/engineering/notion-workflow.md §2.4"
    }
  ]
})
```

### F5.5 Audit / Review template

无需修改（章节号 §2.5 已对齐）。

> **fetch 注意**：mcp_notion_notion_fetch 返回的 markdown 含 backslash escape（`\>` `\#` `\[` 等），但 update_content 的 old_str 接受的是 **原始** markdown（无 escape）。new_str 同理。本 plan 提供的字符串已是正确的原始形式，可直接用。


## 执行顺序建议

按本顺序新会话推进，每步完成后 dry-run 一次验证：

1. **F2.1** 改 `.notion/anchors.json` 加 templates 段（5 个 page_id 已提供，直接抄）
2. **F1.1** 加 §Rules · 9 Status SSOT
3. **F1.2** 改 §Standard 4-Action B 步骤
4. **F3.1** 改 §Standard 4-Action A 步骤
5. **F4.1** 改 §2.0 Identifier 行
6. **F2.2** 改 §2.7 调用模板
7. **F5.1~F5.4** 4 次 `mcp_notion_notion_update_page` 调用同步 Notion 端 template

每步独立可回滚（文档改动 git 可 diff，Notion update_page 可再 update_content 回滚）。

## Validation Gate

本批改动**只改文档 + Notion page 内容**，不触发以下：

- typecheck / lint：不适用（无代码改动）
- vitest：不适用
- browser smoke：不适用
- visual contract：不触发 H11

需要做的：

- [ ] `docs/engineering/notion-workflow.md` getDiagnostics 无问题
- [ ] `.notion/anchors.json` JSON 合法（用 `python -c "import json; json.load(open('.notion/anchors.json',encoding='utf-8'))"` 校验）
- [ ] AGENTS.md ≡ CLAUDE.md（H1 镜像同步：本批不动这两份，所以默认仍一致）
- [ ] dry-run 重跑：以 SIK-29 父 issue 为入口，验证 §Rules · 9 + §Standard 4-Action 新版 B 步骤能识别 SIK-42/43 = Cancelled，避免误推

## Evidence Block 模板（执行完回写到对应 Notion issue）

```text
Mode: Runner
Notion issue URL: <hotfix issue 或 commit message>
Identifier: <SIK-NNN 或 N/A>
Branch: hotfix/notion-workflow-fix-2026-05-29
Commits: <见 git log>
Changed files:
  - .notion/anchors.json (+15 行)
  - docs/engineering/notion-workflow.md (+25 行)
Requirement source: docs/plan/notion-workflow-fix-2026-05-29.md
Plan doc: 同上
Implementation summary:
  - F1: §Rules 加规则 9 Status SSOT；§Standard 4-Action B 步骤拆 B1/B2/B3
  - F2: anchors.json 加 templates 段（5 个 template page_id）；§2.7 引用 anchors
  - F3: §Standard 4-Action A 步骤说明 mention 噪声 + sub-issues 顺序不可靠 + Work Log 历史空集
  - F4: §2.0 Identifier 行给具体取号命令
  - F5: 4 次 mcp_notion_notion_update_page 同步 Notion 端 template 章节号
Tests run: N/A（无代码改动）
Lint: N/A
Typecheck: N/A
Build: N/A
Browser smoke: N/A
Subagent review: not triggered（改动 <50 行文档，不触发 H5）
Security review: N/A
Known gaps: <若 dry-run 又测出新盲点，记录在此>
Rollback notes:
  - 文档：git revert 即可
  - Notion template：再跑一次 update_content 把 old_str/new_str 反过来即可
Next owner: lhr
```

## 已知不在本批范围

- 现有 SIK-29 父 issue 的 Child Matrix 表（SIK-42/43 写 todo 但实际 cancelled）：本批只补规则不改父 issue body，避免动账本。后续若决定回写，单独开 hotfix。
- Notion DB 自带的 `[Template] xxx` 5 份 page，properties 里的 `Tab=Template` 标签：保留现状，让 search 时易于过滤；不混进 Tab1~Tab4 业务面。
- 历史 issue body 顶部的 `> **Multica**: ...` meta 段：保留（约 100 条），未来若真要清理另开任务。
