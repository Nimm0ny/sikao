---
type: review
status: complete
owner: subagent-reviewer (Kiro / Claude Opus 4.7)
created: 2026-05-29
target: docs/engineering/notion-workflow.md §Rules · 10 + §Standard 4-Action D Note + §Notion fetch escape 速查
plan: docs/plan/notion-workflow-fix-2026-05-29.md (Wave 2 hotfix)
---

# notion-workflow Silent-Miss Fix · Wave 2 Review

## 检查范围

仅本次 doc-only hotfix 新增/修改的三处锚点，不重审第一批 7 步（F1.1 / F1.2 / F2.1 / F2.2 / F3.1 / F4.1 / F5.1）。

- `docs/engineering/notion-workflow.md`
  - §Rules · 10「update_content 反馈环（fetch-before / verify-after）」（约 L72~82）
  - §Standard 4-Action 末尾紧贴 D2 后的一行 `> 注：…`（约 L413）
  - §Notion fetch escape / auto-linkify 速查 section（约 L465~487）
- 对照底稿（不在 review 范围）：`docs/plan/notion-workflow-fix-2026-05-29.md`、`AGENTS.md`、`.notion/anchors.json`

未跑命令、未改文件。

## 发现项

### F1 (Medium) §Standard 4-Action D Note 位置精准度

- 证据行号：notion-workflow.md L385~L413（D 步骤）+ L413（Note）
- 现象 / 原因：D1 实际调用 `command="insert_content"`（append `## Evidence Block`），D2 调用 `mcp_notion_notion_create_pages`（建 Work Log）。**整个 D 步骤本身没有 `command="update_content"` 调用**，但 Note 写"用 `command="update_content"` 改 issue body 时"，措辞上像在描述 D 步骤里某个动作。新会话 agent 单读 D 段时容易疑惑"D 哪一步会用 update_content"。
- 实质：这条 Note 是对"未来在已写 body 上做精细修改时"的横向提醒，而不是 D 步骤内部要求。
- 建议处理：把 Note 改成"以及后续任何用 `command="update_content"` 修改 issue body / Discussion Archive 的场景，强制走 §Rules · 10 反馈环"，或者把 D 后面这行 Note 移到 §Standard 4-Action 段尾、独立成一段（与 D 列同级），避免被读成 D 内动作。

### F2 (Medium) 速查表"实测 vs 推断"未标注

- 证据行号：notion-workflow.md L470~L477（速查表 6 行）
- 现象 / 原因：本次 plan F5.1 第一轮实测验证过的只有 `.md`（visual / non-visual / foundation / decision 四个 template body 里 `notion-workflow.md` → `[notion-workflow.md](http://notion-workflow.md)` 的 auto-linkify）。表中其他模式（`.com / .io / .dev`、`> 引用块 escape`、`<...>` 占位符 escape、`[...]` 标题方括号 escape）均为基于 fetch 输出形式的推断，未做 silent-miss 反向验证。当前表把"实测一种 + 推断五种"平铺并列，未来若某模式（如 `.local` / `.test` / 中文域名）与推断不一致，agent 仍会按速查表构造 `old_str` 并继续 silent miss。
- 建议处理：表头加一列"来源（实测 / 推断）"，或在表上方加一行 "以下 `.md` 模式于 2026-05-29 实测；其他模式基于 fetch 渲染输出推断，遇到未列模式仍以 §Rules · 10 verify-after 为准"。后者一行成本最低，建议优先。

### F3 (Medium) Fail-Fast 强度欠一致

- 证据行号：notion-workflow.md L72~L82（§Rules · 10）
- 现象 / 原因：规则 10 说了 `Must`（fetch-before + verify-after）和 `Must not`（凭本地 plan 拼 `old_str` / 只看 200），但没说 **verify-after 发现 0 替换 / 目标行未变更时怎么处理**——是抛错停手、是重试、还是降级标 known gap？AGENTS.md §0.2 H7 与 §4.1 都要求 fail-fast 默认抛错、禁 silent catch / fallback；规则 10 当前措辞不够硬，agent 完全可能 silent retry。
- 建议处理：在规则 10 末尾追加一行 `If conflict: verify-after 发现目标行未变更时 fail-fast 上报 silent miss，不得静默重试或继续后续 update；如确需重试，重新 fetch-before 构造 old_str 后再调用，并在 Evidence Block / Work Log Type=Blocker 记录前一次 silent miss。`

### F4 (Low) "逐条 verify" 缺执行范式

- 证据行号：notion-workflow.md L483~L487（操作守则第 4、5 条）
- 现象 / 原因：第 5 条要求"一次 update 多条 `content_updates` 时...必须逐条 verify"，但没有给具体执行范式。新会话 agent 实际怎么做：
  - (a) 一次 fetch 整个 page，然后客户端在 fetch 结果里对每条 `new_str` 做子串匹配？
  - (b) 拆成 N 次单条 update_content 调用，每次后 fetch verify？
  - (c) 还是依赖 update_page 返回值（事实上无法区分 silent miss）？
- 当前文本对"逐条"语义不闭合，agent 实现差异会让规则可执行性打折。
- 建议处理：第 5 条后面加一行可执行范式，例如 `推荐范式：一次 fetch 拿 rendered markdown，对每条 content_updates.new_str 做子串包含检查（new_str 是 Notion 入库后会渲染的形式，匹配前可对 .md / 域名样裸文本做 auto-linkify 反向预处理）；或者拆成单条 update_content + 单次 fetch verify，简单但调用次数翻倍。`

### F5 (Low) 适用 command 边界未显式说明

- 证据行号：notion-workflow.md L72~L74（§Rules · 10 Trigger）
- 现象 / 原因：规则 10 标题与 Trigger 已限定 `command="update_content"`，但未显式说明 `insert_content` / `replace_content` / `update_properties` / `apply_template` 是否在范围内。`insert_content` 是 append/prepend 不存在 old_str，自然不受影响；`update_properties` 走结构化字段无 escape 风险；但 `replace_content` 也涉及 markdown 字符串。新 agent 不一定能秒判断。加一行边界说明可以避免"过度 fetch-before"或"漏覆盖 replace_content"两种偏差。
- 建议处理：在规则 10 Note 末尾加一行 `适用范围：仅 update_content / replace_content（涉及 markdown 字符串匹配的 command）；insert_content / update_properties / apply_template 不受此规则约束。`

## 建议处理汇总

| 优先级 | 编号 | 问题 | 建议动作 |
|---|---|---|---|
| Medium | F1 | §Standard 4-Action D Note 位置/措辞误导，D 内无 update_content 调用 | 改写为"后续用 update_content 改 body 时"或移出 D 段独立成段 |
| Medium | F2 | 速查表"实测一种 + 推断五种"未区分 | 表上方加一行"`.md` 实测；其他模式基于 fetch 推断，未列模式以 verify-after 为准" |
| Medium | F3 | 规则 10 未说 verify 失败的处理路径，弱于 H7 Fail-Fast | 追加 `If conflict: verify-after 0 替换时 fail-fast 上报 silent miss，禁止 silent retry` |
| Low | F4 | "逐条 verify" 缺执行范式 | 加一行推荐范式（一次 fetch + 客户端 substring 检查；或拆单条调用） |
| Low | F5 | 适用 command 边界未显式 | 规则 10 末尾加一行限定 update_content / replace_content |

## 风险等级

- 整体：**Low**
- 理由：
  - 本次 hotfix 三处锚点的核心断言全部准确：silent-miss 行为描述（API 返回 200 即使 0 替换）与实测一致；fetch-before / verify-after 闭环逻辑闭合；`.md` auto-linkify 模式已实测验证。
  - 与现有 §Rules · 1~9 / §Standard 4-Action / §Discussion Archive 模板均无冲突或重复；规则 10 是新增维度（API 副作用语义），不与已有规则在同一面 SSOT。
  - 与 AGENTS.md §1.1（一律中文）兼容（"auto-linkify" 仅作技术词括注，未污染主体行文）。
  - F1~F5 均为清晰度 / 严密性微调，**即使本批不再追加修改，agent 按当前文本操作也不会做错动作**——最多在 fail-fast 强度（F3）和 verify 范式（F4）上有发挥空间。
  - 不阻塞本批 hotfix 收口；建议作为后续微调批次（F3 优先合并到下一次 doc 改动）。

## Reviewer Mode 自检

- 是否独立读了目标文件：是（`docs/engineering/notion-workflow.md` 全文 + 对照底稿 `docs/plan/notion-workflow-fix-2026-05-29.md`）
- 是否调用了破坏性工具：否（仅 `read_file`）
- 是否在 review 范围外动了文件：否
