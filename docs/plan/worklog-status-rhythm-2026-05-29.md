---
type: plan
status: landed
owner: lhr
created: 2026-05-29
notion-issue-url: (hotfix-style；如需建 issue 走 §2.4 Decision 模板留档)
---

> **落地状态（2026-05-29）**：schema（Work Log +Status Change/From/To/Commits/Event 公式；Issues +Prev Status/Status History）已建；129 条 issue 已 backfill；5 条 UI automation 已配齐并冒烟通过（Backlog→Todo→In Progress→Done→Cancelled 全链路 PASS）；日历 view「推进节奏 Status Rhythm」+ 月历 view 已配 To Status 彩色 chip；规范已写入 `docs/engineering/notion-workflow.md` §Rules · 11 + §Work Log Status Rhythm 速查。已知点：① 新建 issue 产生「🆕 新增」自反行（Event 公式标注区分）；② Notion trigger 不支持静态附加条件（选项 2 不可行），改用 Event 公式 + To Status chip 表达；③ view filter 不支持属性-vs-属性比较。

# Work Log 项目推进节奏视图设计（Status 转变 → 日历）

## 背景

2026-05-29 全量 audit 后，lhr 想在 Notion SIKAO / Work Log 上看「项目整体推进节奏」：
每条 issue 的 Status 转变（Backlog → In Progress → Done 等）按时间在日历上铺开。
附带：issue 转 Done 时把对应 commit message 也归集到 Work Log，便于回顾。

lhr 决策（2026-05-29）：
1. 目标 = 看「推进节奏」（status 转变事件流），**同意为此加字段**（覆盖 AGENTS.md §donts「不擅自加 Work Log 字段」，本次明确批准）。
2. 采用**精版**：每个目标 Status 各配一条 automation，日历上能看出「变成了什么」。
3. 设计交给 agent。
4. commit message 想在 issue→Done 时回写 + 在 Work Log 展示。

## 模式 + 范围

- 模式：Master 设计 + Runner 执行（schema 用 MCP，automation 用 UI）。
- 触及稳定边界：Work Log DB schema（select 词表 + 新属性）→ Define-First 先定义。
- 不动产品代码 / Issues DB schema / 鉴权。
- 账户：教育版 = 免费 Plus plan，database automation 在付费档可用（含 Plus），已查官方确认。

## Notion 能力边界（设计前必须钉死的事实）

> 来源：Notion 官方 Database automations 文档（2026-05 查），内容已改写。

1. **能**：`Property edited` 触发器支持 select 属性 `is set to <值>`，可精准锁定某个 Status。
2. **能**：`Add page to <DB>` 动作可建行并设属性；`Define variables` 可取 `Trigger page` 的属性（如 Identifier / Title）写进新行。
3. **不能**：automation 没有「add comment」动作 —— automation 写不了 comment。
4. **不能**：database view 无法展示 comment（comment 不是 property）。所以「Work Log 显示 commit comment」这条死路，改用 `Commits` 富文本属性。
5. **不能**：automation 不能被另一个 automation 触发（本需求不涉及链式，无碍）。
6. **不能可靠捕获 From-Status**：`is set to X` 只知道新值，不知旧值。所以 Work Log 行只记「→ X」，不记「从 Y」。这是诚实限制。
7. **不能回溯历史**：Notion 不存「字段何时被改」，过去的转变时间点已丢。本方案**只能从启用之日起向前记**；历史用 audit snapshot 当 2026-05-29 基线存档。
8. **MCP 配不了 automation**：automation 是 UI-only，我只能给点击步骤；schema 改动我可用 MCP 执行。

## Work Log schema 设计（Define-First）

当前 Work Log DB 字段（来自 anchors.json + fetch）：
`Title` / `Type`(select: Daily/Review/Decision/Blocker/Deploy/Meeting/Evidence) /
`Date`(date) / `Issues`(relation→Issues) / `Summary`(text) / 反向 relation 等。

### 新增 1 个 select 选项

`Type` 词表加第 8 项：**`Status Change`**。
- 语义：一条 issue 的 status 转变事件（automation 自动建）。
- 与现有 `Daily`（每日工作）/ `Evidence`（交付证据）解耦，日历/看板可按 Type 过滤出纯节奏流。

### 新增 3 个属性（Work Log）

| 属性 | 类型 | 谁写 | 用途 |
|---|---|---|---|
| `From Status` | select（5 值：Backlog/Todo/In Progress/Done/Cancelled） | automation（取自 Issues.`Prev Status` 影子字段） | 这条转变「从什么来」，配合 To Status 拼完整 `X → Y` |
| `To Status` | select（同 5 值） | automation | 这条转变「变成了什么」，日历上色 + 看板分列 |
| `Commits` | text（rich text） | agent（仅 →Done 时） | issue 转 Done 时归集的 commit message / hash；解决 #4 |
| `Event` | formula | 公式自动算（执行期追加） | `if(format(From)==format(To), "🆕 新增", From+" → "+To)`；区分「创建即 Backlog」自反行与真实转变。注：formula 输出在卡片上是纯文本不是 chip，节奏色靠 `To Status` 这个 select chip 表达 |

> `From Status` 由「影子字段」方案补上（见下「Issues DB 影子字段」段）：Notion automation 原生抓不到旧值（边界 6），用 Issues DB 上一个落后一步的 `Prev Status` 字段冻结旧值再追平。lhr 2026-05-29 批准纳入。

### 不动的部分

- `Issues` relation 复用（automation 用 `Define variables` 把 Trigger page 自身设进去）。
- `Date` 复用作日历轴。automation 建行时若能取「触发时刻」最好；取不到就退到 Work Log 自带 `Created time`（见 §automation 步骤备注）。
- 现有 `Type=Evidence` 流程（§Rules·4）不变，不与 Status Change 流冲突。

### SSOT 同步清单（schema 改完必须同步，否则 drift）

1. `.notion/anchors.json` → `databases.work_log.type_options` 加 `Status Change`；新增 `status_change_fields` 说明段。
2. 项目页「🎯 SIKAO」body §SSOT 约定的 Work Log 字段说明（如有 Work Log 字段表）。
3. `docs/engineering/notion-workflow.md` Anchors 段 Work Log Type 词表（现写「7 项」要改「8 项」）。
4. `scripts/sync-multica-to-notion-api.mjs` 若含 Work Log Type 白名单需同步（待 Runner 核查该文件是否存在/相关）。

## Issues DB 影子字段（解决 From-Status + Status History）

为补上 Notion automation 抓不到旧值的边界，在 **Issues DB** 加 2 个属性：

| 属性 | 类型 | 用途 |
|---|---|---|
| `Prev Status` | select（5 值，同 Status） | 影子字段，始终比 `Status` 慢一拍。automation 写 Work Log 前读它拿旧值，写完追平。view 里隐藏 |
| `Status History` | text（rich text） | per-issue 审计轨迹，自动累积成 `Backlog → In Progress → Done` 链 |

### 影子字段工作原理（落后一步法）

automation 的 action 顺序保证旧值被先冻结、最后才追平：

```
Trigger:  Status is set to "Done"
Action 1: Define variables
            fromStatus = ∑ Trigger page.Prev Status   ← 此刻还是旧值，先冻进变量
            issueRef   = ∑ Trigger page
            issueTitle = ∑ Trigger page.Title
Action 2: Add page to Work Log
            From Status = @fromStatus                  ← 旧值
            To Status   = "Done"
            Title       = "[" + @fromStatus + " → Done] " + @issueTitle
            Issues      = @issueRef
            Type        = "Status Change"
Action 3: Edit Trigger page（改的是 Issues 自己这条）
            Prev Status    = "Done"                     ← 追平，为下次准备
            Status History = @prevHistory + " → Done"   ← 追加链（prevHistory = ∑ Trigger page.Status History）
```

要点：
- Action 3 改 `Prev Status` / `Status History`，**不改 `Status`**，所以不会重新触发本 automation（监听的是 Status），无环。
- Action 1 先冻旧值，对「Trigger page 实时解析」和「触发快照解析」两种 Notion 行为都鲁棒。
- `Status History` 追加需先用 Define 取 `prevHistory = ∑ Trigger page.Status History`，再拼接。

### 一次性 backfill（启用前必做，Runner MCP 执行）

加完 `Prev Status` 后，把现有 129 条 issue 的 `Prev Status` 全设成各自当前 `Status`；
`Status History` 初始化为当前 `Status`（单节点，如 `Done`）。
否则启用后第一次转变的 `From Status` 会是空、History 断头。
backfill 后 fetch 抽样复核。

### 残余风险（诚实）

- **秒级连续两次转变**可能 desync（第二次 Prev 还没追平又变）。本工作流几乎不会秒级连切，可接受。
- 第一次转变前依赖 backfill 准确（已用复核兜底）。
- `Trigger page.Prev Status` 实时 vs 快照解析仍需 UI 实测一次（但 action 顺序对两种都安全）。

## Automation 设计（精版 · 5 条，UI 手配）

在 **Issues DB** 上配（automation 挂在被监听的 DB，不是 Work Log）。
每个目标 Status 一条，共 5 条。模板如下（以 → Done 为例）：

```
Automation 名：Log Status → Done
Trigger:  Property edited → Status → is set to → "Done"
Action 1: Define variables
            var "issueRef"  = ∑ Trigger page             (整页引用，用于 relation)
            var "issueTitle"= ∑ Trigger page.Title        (拼 Title)
            var "fromStatus"= ∑ Trigger page.Prev Status  (冻结旧值 → From Status)
            var "prevHist"  = ∑ Trigger page.Status History (拼 History 链)
Action 2: Add page to → Work Log
            Title     = "[" + @fromStatus + " → Done] " + @issueTitle
            Type      = "Status Change"
            From Status= @fromStatus
            To Status = "Done"
            Issues    = @issueRef                          (relation 指回触发 issue)
            Date      = @now / @today                      (UI 实测：见备注)
Action 3: Edit Trigger page（改 Issues 自己这条，不改 Status，无环）
            Prev Status    = "Done"                        (追平，为下次转变准备)
            Status History = @prevHist + " → Done"         (累积链)
```

5 条分别把 `is set to` 与 `To Status` / Title 前缀 / Action 3 的 `Prev Status` 替换为：
`Backlog` / `Todo` / `In Progress` / `Done` / `Cancelled`。
每条的 `From Status` 都取 `@fromStatus`（自动是上一状态，无需手写）。

### 备注（UI 实测项，配的时候盯）

- **Date 取触发时刻**：Notion automation 的 date 字段能否填 `now`/`today` 变量需 UI 实测。
  - 若可填 → `Date = now`，日历轴精确到当天。
  - 若不可填 → 留空 `Date`，日历视图改用 Work Log 自带 **Created time** 当轴（automation 建行的时刻 = 转变时刻，误差秒级，可接受）。
- **Todo 那条**：当前 Issues DB 里 Todo=0 条，但仍配上，未来用得上。
- **automation 不会回溯**：配好后只对「之后发生的」转变生效。
- **agent 改 Status 也会触发**：MCP `update_properties` 改 Status 同样会触发 automation（automation 监听的是 DB 变化，不分人/agent），所以 agent 链路自动覆盖，无需 §Rules 再手动建 Status Change 行。

### #4 commit message 落地（独立于 automation）

automation 建出来的 Status Change 行，`Commits` 字段初始为空。
issue 转 Done 时，**agent 在 §Rules·4 Evidence 回写那一步**额外做：
1. 找到本次 →Done 自动生成的 Work Log Status Change 行（按 Issues relation + To Status=Done + 当日 Date filter）。
2. `update_page` 把该行 `Commits` 字段填本次合并的 commit message + hash（取自 git log）。

> 放弃原「写进 issue comment 再被 Work Log 显示」方案：view 显示不了 comment（边界 4）。
> 改用 Work Log 行的 `Commits` 富文本属性，日历/表格 view 原生可见。

## 日历 view 设计

在 Work Log DB 上新建（或改现有）一个 Calendar view：

```
View 名：推进节奏（Status Rhythm）
类型：Calendar
日期轴：Date（若 automation 填了 now）/ 否则 Created time
Filter：Type is "Status Change"          （滤掉 Daily/Evidence 噪音）
卡片显示属性：From Status → To Status（上色）、Issues（关联 issue）、Commits（→Done 行才有）
分组上色（可选）：按 To Status 给颜色
  - Done = green / In Progress = blue / Backlog = gray / Cancelled = red / Todo = default
```

可再配一个 Board view（按 `To Status` 分列）做「本月各状态吞吐」横向对比，可选。

## 执行顺序（Runner）

1. **schema 改**（MCP，我可执行）
   - Work Log：`Type` 加 `Status Change` 选项；加 `From Status` select（5 值）+ `To Status` select（5 值）+ `Commits` rich text
   - Issues：加 `Prev Status` select（5 值）+ `Status History` rich text
   - 改完 fetch 复核（§Rules·10 verify-after）
2. **backfill**（MCP，我可执行）
   - 现有 129 条 issue：`Prev Status` = 当前 `Status`；`Status History` = 当前 `Status`（单节点）
   - 抽样 fetch 复核
3. **SSOT 同步**（文档，Runner）
   - anchors.json：work_log type_options 加项 + 新字段说明；issues 段记 Prev Status / Status History
   - notion-workflow.md Anchors 段「7 项」→「8 项」
   - 项目页 SSOT 字段表（如有）
   - 核查 scripts/sync-*.mjs 是否需同步
4. **automation 配**（UI，lhr 操作，我给逐步点击 + 盯 Date/Prev Status 变量实测）
   - 5 条 Status automation，每条 3 actions（Define / Add to Work Log / Edit Trigger page 追平）
5. **日历 view 配**（UI 或 MCP create_view）
   - `mcp_notion_notion_create_view` 建 Work Log Calendar view + filter Type=Status Change
6. **§Rules 增补**（文档，Runner）
   - notion-workflow.md §Rules·4 旁加：issue→Done 时回填对应 Status Change 行的 Commits 字段
7. **冒烟验证**
   - 拿 1 条测试 issue 手动 flip Status，确认 Work Log 自动建行 + From/To 正确 + Issues Status History 追加 + 日历显示 + Commits 可填

## 验证 Gate

- schema 改动后 fetch Work Log + Issues data_source 复核：Work Log 8 项 Type + From/To Status + Commits；Issues 多 Prev Status + Status History
- backfill 后抽样 fetch 5 条确认 Prev Status == Status
- anchors.json JSON 合法（python json.load）
- notion-workflow.md getDiagnostics 0 问题
- automation 冒烟：1 次真实 flip 看到 Work Log 自动建行 + From Status 非空 + Status History 追加一节点
- AGENTS.md ≡ CLAUDE.md（本批若改 §donts 相关需同步；预计不动这两份）

## 已知限制（写给未来的自己）

- From-Status 靠 `Prev Status` 影子字段，秒级连续两次转变可能 desync（可接受）。
- 无历史回溯（启用前的转变时间已丢）；Date 精度取决于 now 变量是否可用。
- 5 条 automation 是手配，每条 3 actions；schema 改名/加 status 值时要同步维护影子字段 + automation。
- Commits 字段靠 agent 自觉回填，人手在 UI 改 Status→Done 不会自动带 commit（人手改本就没有 commit 上下文）。
- `Status History` 在 issue 被多次反复 flip 时会变长，可接受（审计轨迹本就该全）。

## Evidence Block 模板（执行完回写）

```text
Mode: Master(设计) + Runner(执行)
Plan doc: docs/plan/worklog-status-rhythm-2026-05-29.md
Changed: Work Log schema(+1 Type, +From/To Status, +Commits) / Issues schema(+Prev Status, +Status History) / backfill 129 issues / anchors.json / notion-workflow.md / 5 automations(UI, 3 actions each) / 1 calendar view
Schema verify: fetch Work Log + Issues data_source PASS
Automation smoke: 1 flip → Work Log 自动建行 PASS
Known gaps: 无 From-Status / 无历史 / Date 精度依赖 now 变量
Next owner: lhr
```
