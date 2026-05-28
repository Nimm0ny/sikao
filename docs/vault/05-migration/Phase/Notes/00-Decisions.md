# Phase-Notes · 00 · Decisions

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[Phase/README.md](../README.md) · [Frontend-IA-V2.md §2.4](../../Frontend-IA-V2.md)
> **SSOT 声明**：本文是 Phase-Notes 全部决策的唯一来源。下游文档（01~06）引用本文条目编号；冲突时以本文为准。

> **2026-05-28 runtime truth update**：本文中保留的 `/notes*` 与 `/q/:id*` 记法主要用于历史设计与跨 Phase 决策追溯；当前运行时 route authority 以 `apps/web/src/router/index.tsx` 为准，其中 Note shell 入口是 `/note`，QuestionHub 入口是 `/question-hub`。

---

## 0. 决策序列编号约定

| 前缀 | 域 |
|---|---|
| `N-D` | 一级 IA / 结构决策 |
| `N-Ed` | 编辑器相关 |
| `N-Search` | 搜索相关 |
| `N-Tag` | 标签 / 分类系统 |
| `N-Community` | 社区笔记 / 公开分享 |
| `N-Weekly` | 周回顾笔记生成 |
| `N-AI` | AI 摘要拆复盘卡 |
| `N-Cross` | 跨 Tab 联动（继承 + 扩展） |

---

## 1. 跨 Phase 继承决策（IA-V2 + Practice + Review 原始来源）

本 Phase 继承并遵守以下决策，不再展开：

| 决策 | 原始拍板 | 对 Notes 的硬约束 |
|---|---|---|
| D1 | 5 tab 方案 A | 笔记 = Tab 4，路由 `/notes` |
| D10 | ~~markdown 文本框 + 预览~~ → TipTap WYSIWYG | 编辑器升级（N-Ed-1） |
| D15 | `/notes/:id` 脱壳全屏 | 编辑器全屏，隐藏 TabBar/RailMini |
| D-Fav-Location | 收藏夹归笔记 tab | 收藏夹作为 segment |
| D-Question-Hub | `/q/:id` 独立中枢页 | 笔记 tab 题级笔记点击 → `/q/:id?ctx=note` |
| Note-1~7 | 题级笔记创建/可见性/跳转/过滤 | 练习 Phase 已升级 NoteV2 schema |
| Cross-2 | 题级笔记有"加入复盘"按钮 | source_kind=manual_add |
| Cross-3 | AI 摘要拆卡 → ReviewItemV2(note_card) | 本 Phase 实施 |
| Cross-4 | 复盘→笔记：错因"保存为笔记" / 周回顾"生成笔记" | NoteV2(type=ai_cause_analysis / weekly_review) |
| D-Q17 | 题级笔记仅自己可见 | visibility=private 时遵守 |

---


## 2. N-D 系列 — 一级 IA / 结构决策

| # | 问题 | 拍板 | 理由 |
|---|---|---|---|
| **N-D1** | Segment 划分 | **3 segment**：全部 / 我的笔记 / 收藏夹 | 原 6 segment（全部/自由/题级/知识点/收藏夹/错题笔记）过于冗余；自由/题级/错题通过筛选器区分 |
| **N-D2** | 收藏夹展示形态 | **A — 题目卡片列表**（QuestionCard 复用 Q-Hub 组件） | 收藏的核心是题目不是笔记；题目卡片信息密度高、操作明确 |
| **N-D3** | AI 摘要拆复盘卡触发 | **手动**：用户点"AI 总结"→ 拆出要点 → 确认后入复盘 | 避免烧 LLM 配额；用户控制感强 |
| **N-D4** | 社区笔记 | **分 3 期上线**：P1 公开/私有 + 只读浏览；P2 点赞+评论+收藏；P3 精选+激励+举报 | 渐进式，P1 快速 ship |
| **N-D5** | 编辑器选型 | **TipTap**（Headless WYSIWYG） | 完全重构项目，直接上最优方案 |
| **N-D6** | 首页联动深度 | **B — 首页不主动推笔记** + Weekly Review 生成笔记走 Gamma 方案 | 笔记是用户主动行为；周回顾通过 banner 提醒而非推荐卡 |
| **N-D7** | 全文搜索方案 | **Meilisearch**（直接上，不走 PG 过渡） | 中文分词内置、typo 容忍、faceted 搜索内置、<50ms 延迟 |
| **N-D8** | 标签/分类系统 | **D — 自由标签 + 预置分类混合** | 灵活性 + 结构化兼得 |
| **N-D9** | 笔记归档生命周期 | **双轴**：status(active/archived) + deleted_at 独立维度 | archived=用户主动归档可恢复；deleted=30天后物理清理；两者不互斥 |

---

## 3. N-D1 · Segment 与筛选器详细设计

### 3.1 三个顶层 Segment

```
/notes                 → 默认 segment "全部"
/notes?tab=my          → "我的笔记"
/notes?tab=favorites   → "收藏夹"
```

| Segment | 数据源 | 说明 |
|---|---|---|
| **全部** | NoteV2 WHERE user_id=current | 用户自己所有笔记默认列表（无筛选器，快速浏览） |
| **我的笔记** | 同"全部"+ 筛选器面板展开 | "全部"的筛选工作态：同一列表，展开筛选器面板时 URL 切到 `?tab=my` |
| **收藏夹** | QuestionFavoriteV2 WHERE user_id=current | 题目卡片列表（A 方案） |

> 设计说明："全部"与"我的笔记"本质是同一个列表的两种 UI 模式——前者为无筛选快速浏览态，后者为展开筛选器的工作态。路由区分便于保存/分享筛选状态。

> 未来 N-D4 社区笔记上线后新增第 4 个 segment "社区"：`/notes?tab=community`

### 3.2 "我的笔记" 筛选器

| 维度 | 选项 | 数据依据 |
|---|---|---|
| 关联状态 | 有关联题目 / 无关联题目 / 全部 | linked_question_id IS NULL / IS NOT NULL |
| 题目状态 | 含错题 / 含标记题 / 全部 | JOIN ReviewItemV2 / QuestionFlagV2 |
| 来源 | 手动创建 / AI 错因分析 / 周回顾 / 社区收藏 | NoteV2.type 枚举 |
| 标签 | 自由标签 + 预置分类（多选） | NoteTagV2 |
| 排序 | 最近修改 / 最近创建 / 标题字母序 | ORDER BY |
| 归档状态 | 显示已归档 / 仅活跃 / 全部 | NoteV2.status（默认"仅活跃"，N-D9） |

### 3.3 收藏夹 Segment 设计

```
收藏夹 segment (QuestionCard 列表)
├─ QuestionCard (复用 Q-Hub 卡片组件)
│   ├─ 题面前 30 字 + 分类 tag (行测/申论 + 子模块)
│   ├─ 状态徽标：✓已做对 / ✗做错过 / 📝有笔记 / 🔄在复盘中
│   └─ 操作区：去练习 | 加入复盘 | 写笔记 | 取消收藏
├─ 筛选：按分类 / 按收藏时间 / 按题目状态
└─ 排序：收藏时间 / 题目难度
```

---


## 4. N-Ed 系列 — 编辑器决策

| # | 决策 | 拍板 |
|---|---|---|
| **N-Ed-1** | 编辑器框架 | TipTap（Headless WYSIWYG，React Composable API） |
| **N-Ed-2** | P1 扩展清单 | StarterKit + Image + Highlight + Placeholder + CharacterCount + tiptap-markdown |
| **N-Ed-3** | P2 扩展清单 | Table + Mathematics (KaTeX) + CodeBlockLowlight |
| **N-Ed-4** | 数据存储格式 | JSON AST（TipTap native format）；导出时转 Markdown/HTML |
| **N-Ed-5** | 图片存储 | Stage 1: 本地文件系统（`/uploads/notes/`）；Stage 2: 对象存储（S3/OSS） |
| **N-Ed-6** | 自动保存 | debounce 3s 自动保存（PUT /api/v2/notes/:id）+ 离开页 dirty 提示 |
| **N-Ed-7** | 版本历史 | 不做（Stage 1 不需要；Stage 2 可用 NoteVersionV2 表） |

### 4.1 TipTap 技术栈

```
核心依赖：
@tiptap/react               — React 绑定 + <Tiptap> Composable API
@tiptap/starter-kit         — 基础 marks/nodes (bold, italic, heading, list, blockquote, code, hr)
@tiptap/extension-image     — 图片上传 + 拖拽
@tiptap/extension-highlight — 文本高亮（标记重点）
@tiptap/extension-placeholder — 空态占位提示
@tiptap/extension-character-count — 字数统计（社区发布门槛校验）
tiptap-markdown             — Markdown 导入/导出（兼容老数据 + 导出功能）

P2 追加：
@tiptap/extension-table     — 表格（知识对比/公式整理）
@tiptap/extension-mathematics — LaTeX 公式（数量关系/资料分析）
@tiptap/extension-code-block-lowlight — 代码块（逻辑推理伪代码）
```

### 4.2 编辑器 UI 布局

```
┌─────────────────────────────────────────────────────┐
│ ← 返回列表                    保存状态 · ··· 更多    │  ← 顶栏
├─────────────────────────────────────────────────────┤
│ [标题输入]                                           │
├─────────────────────────────────────────────────────┤
│ B I H1 H2 • — "" img ─── ─── 🏷️标签              │  ← 工具栏
├─────────────────────────────────────────────────────┤
│                                                     │
│  [TipTap 编辑区域]                                   │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 📎 关联题目: #62 利润问题     字数: 328              │  ← 底栏
│ 🏷️ #数量关系 #公式 #易错点                          │
└─────────────────────────────────────────────────────┘
```

---


## 5. N-Search 系列 — 搜索决策

| # | 决策 | 拍板 |
|---|---|---|
| **N-Search-1** | 搜索引擎 | Meilisearch（直接上，不走 PG FTS 过渡） |
| **N-Search-2** | 部署形态 | 裸 binary 部署（遵守 AGENTS H10 禁 Docker 规则） |
| **N-Search-3** | 索引内容 | NoteV2.title + NoteV2.body_text（TipTap JSON → 提取纯文本） + NoteTagV2.tag_name |
| **N-Search-4** | 中文分词 | Meilisearch 内置 ICU tokenizer（中文零配置） |
| **N-Search-5** | Facets | 标签 / 笔记类型(type) / 关联状态(has_question) / 创建时间(year_month) |
| **N-Search-6** | 同步策略 | 写入 NoteV2 后同步推送 Meilisearch（API handler 内异步 task） |
| **N-Search-7** | 搜索延迟目标 | < 50ms（Meilisearch 默认满足） |
| **N-Search-8** | typo 容忍 | 开启（Meilisearch 默认，最大 2 字符编辑距离） |
| **N-Search-9** | 多用户隔离 | 用 `user_id` filter 隔离（不建独立 tenant index）；Stage 2 多用户时 filter 性能足够（Meilisearch 内部 bitmap） |

### 5.1 Meilisearch 索引配置

```json
{
  "index": "notes",
  "primaryKey": "id",
  "searchableAttributes": ["title", "body_text", "tags"],
  "filterableAttributes": ["user_id", "type", "has_linked_question", "visibility", "tags", "created_at"],
  "sortableAttributes": ["created_at", "updated_at"],
  "faceting": {
    "maxValuesPerFacet": 100
  },
  "typoTolerance": {
    "enabled": true,
    "minWordSizeForTypos": { "oneTypo": 3, "twoTypos": 6 }
  }
}
```

### 5.2 社区笔记索引（P2）

```json
{
  "index": "community_notes",
  "primaryKey": "id",
  "searchableAttributes": ["title", "body_text", "author_name", "tags"],
  "filterableAttributes": ["linked_question_id", "tags", "reaction_count", "is_featured"],
  "sortableAttributes": ["created_at", "reaction_count"]
}
```

### 5.3 部署方式（Stage 1 单机）

```bash
# 下载 Meilisearch binary
curl -L https://install.meilisearch.com | sh

# 启动（systemd service）
[Unit]
Description=Meilisearch
After=network.target

[Service]
ExecStart=/opt/meilisearch/meilisearch --db-path /var/lib/meilisearch/data --env production --master-key ${MEILI_MASTER_KEY}
Restart=always

[Install]
WantedBy=multi-user.target
```

---


## 6. N-Tag 系列 — 标签 / 分类系统

| # | 决策 | 拍板 |
|---|---|---|
| **N-Tag-1** | 标签模式 | 自由标签 + 预置分类混合（D 方案） |
| **N-Tag-2** | 数据表 | NoteTagV2（id, user_id, note_id, tag_name, is_system, created_at） |
| **N-Tag-3** | 预置系统标签 | 见下方枚举 |
| **N-Tag-4** | 标签上限 | 每条笔记最多 10 个标签 |
| **N-Tag-5** | 自动补全 | 输入时下拉推荐（已有标签 + 系统标签，按使用频次排序） |
| **N-Tag-6** | 标签云 | 笔记列表侧栏展示标签云（高频大字 / 低频小字） |
| **N-Tag-7** | 标签重命名/合并 | 支持（用户可将自由标签重命名，影响所有关联笔记） |

### 6.1 预置系统标签（is_system=true）

```
行测类：
  #行测, #数量关系, #言语理解, #判断推理, #资料分析, #常识判断

申论类：
  #申论, #概括归纳, #综合分析, #提出对策, #应用文写作, #大作文

知识类：
  #知识点, #解题技巧, #易错点, #公式, #模板

来源类（自动附加，不可删除）：
  #周回顾, #AI错因分析, #题级笔记
```

### 6.2 标签 UI 交互

- 编辑器底部标签区：预置分类 chip 列表（点选 toggle）+ 自由输入框（回车创建）
- 筛选器：标签多选（AND 逻辑）
- 标签管理页：`/notes/tags`（查看所有标签 + 使用次数 + 重命名/删除/合并）

---


## 7. N-Community 系列 — 社区笔记 / 公开分享

| # | 决策 | 拍板 |
|---|---|---|
| **N-Community-1** | 可见性模型 | **二档**：private（默认） / public |
| **N-Community-2** | 互动系统 | 点赞 + 评论（支持回复/树状）+ 收藏他人笔记 |
| **N-Community-3** | 实施分期 | P1 公开切换+只读浏览 → P2 点赞+评论+收藏 → P3 精选+激励+举报 |
| **N-Community-4** | 发布门槛 | body ≥ 50 字（防灌水） |
| **N-Community-5** | 举报机制 | 用户举报 → 3 次累计自动下线 + 人工复核 |
| **N-Community-6** | 精选机制 | 点赞 ≥ N（待定阈值）且无举报 → 自动标"精选" |
| **N-Community-7** | 作者激励 | 笔记被收藏/点赞达阈值 → 通知"你的笔记获得 X 赞" |
| **N-Community-8** | 评论深度 | 支持回复（树状，最大 3 层嵌套） |

### 7.1 可见性字段

```typescript
// NoteV2.visibility
type NoteVisibility = 'private' | 'public';
// private: 默认，仅自己可见
// public:  所有用户可见，出现在社区列表 + 题目中枢页"同学笔记"
```

### 7.2 互动数据表

```
NoteReactionV2:
  id, user_id, note_id, type='like', created_at
  UNIQUE(user_id, note_id, type)

NoteCommentV2:
  id, user_id, note_id, parent_comment_id (nullable), path (materialized path, e.g. "1.5.12"),
  depth (int, max=3), body, created_at, updated_at, deleted_at
  树状结构：parent_comment_id 引用同表（最大 3 层嵌套）
  查询优化：用 path 物化路径字段做 LIKE 'x.%' 前缀查询，避免递归 CTE

NoteBookmarkV2:
  id, user_id, note_id, created_at
  UNIQUE(user_id, note_id)
```

### 7.3 社区浏览入口

| 入口 | 位置 | 内容 |
|---|---|---|
| Tab 4 第 4 个 segment "社区" | `/notes?tab=community` | 最新/最热公开笔记 feed |
| 题目中枢页 `/q/:id` | CommunityNotesSection（已有组件） | 该题下的公开笔记 |
| 练习结果页 | 答错后底部推荐 | "同学们的笔记" 1~2 条（P2） |

### 7.4 社区笔记列表排序

| 模式 | 排序规则 |
|---|---|
| 最新 | created_at DESC |
| 最热 | reaction_count DESC, created_at DESC |
| 精选 | is_featured=true, reaction_count DESC |

### 7.5 实施分期详细

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **P1** | visibility 字段 + 公开/私有切换 UI + 社区列表只读浏览 + 按题目筛选 | NoteV2 schema + Meilisearch community_notes index |
| **P2** | NoteReactionV2 + NoteCommentV2（树状）+ NoteBookmarkV2 + 实时计数 | P1 |
| **P3** | 精选算法 + 作者通知 + 举报系统 + 质量分 | P2 + 通知基础设施 |

---


## 8. N-Weekly 系列 — 周回顾笔记生成

| # | 决策 | 拍板 |
|---|---|---|
| **N-Weekly-1** | 生成方案 | **Gamma — 结构化模板 + 可编辑**（AI 生成脚手架，用户可用 TipTap 修改补充） |
| **N-Weekly-2** | 触发时机 | 手动（复盘 tab 周回顾条"生成本周回顾笔记"按钮）+ 自动提醒（周一首次打开 app → banner） |
| **N-Weekly-3** | 数据来源 | ReviewItemV2（本周范围）+ PracticeSessionAnswerV2（本周）+ NoteV2（本周新增） |
| **N-Weekly-4** | LLM prompt | cause_analysis_weekly（继承 Phase-Home LLM 模块） |
| **N-Weekly-5** | 输出格式 | 结构化 Markdown 模板 → 转 TipTap JSON AST 存入 NoteV2 |
| **N-Weekly-6** | 自动标签 | 生成后自动附加 `#周回顾` + `#第{N}周` 标签 |
| **N-Weekly-7** | 限流 | 每用户每周最多生成 2 次（防反复重生成烧 token） |
| **N-Weekly-8** | 幂等 | Idempotency-Key = `weekly_review_{user_id}_{year}_{week_number}_{attempt}` |

#### 8.1 生成模板结构（Gamma 方案）

> 模板中的 emoji heading 由 LLM 输出，最终文案以 `lib/ui-copy/weekly-review.ts` 为 SSOT；下方仅为 prompt 示例。

```markdown
# 📊 第 {week_number} 周学习回顾 ({date_range})

## 💪 本周成果
- 复盘 {review_count} 道题，再做正确率 {redo_accuracy}% ({accuracy_delta})
- 新增 {note_count} 条笔记，其中 {question_note_count} 条题级笔记
- {top_improvement_module} 模块正确率从 {old_rate}% → {new_rate}%

## ⚠️ 薄弱环节
{weakness_list}
<!-- AI 生成 1~3 条，每条含模块名 + 错误次数 + 建议 -->

## 🎯 下周建议
{suggestions_list}
<!-- AI 基于 SRS 队列 + 弱项生成 2~3 条具体可执行建议 -->

## 📝 本周知识沉淀
{notes_summary}
<!-- 列出本周新增笔记标题 + 链接 -->

---
*由 AI 自动生成，你可以自由编辑补充。*
```

### 8.2 触发流程

```
周一首次打开 app
  └─ 检查上周是否已生成 weekly_review
     ├─ 已生成 → 不提醒
     └─ 未生成 → Banner "上周回顾已就绪，要查看吗？"
        ├─ 用户点"查看" → 调 LLM 生成 → 打开 TipTap 编辑器（预填模板）
        ├─ 用户点"稍后" → 关闭 banner（当日不再提醒）
        └─ 用户点"不再提醒" → profile_v2.info.weekly_review_banner=false

手动触发（复盘 tab 周回顾条）
  └─ 点击"生成本周回顾笔记"
     └─ 调 LLM → 生成 → 打开编辑器
```

### 8.3 保存后状态

- NoteV2(type=weekly_review, title="第{N}周学习回顾", body=TipTap JSON)
- 自动标签：`#周回顾`, `#第{N}周`
- 首页无主动推送（遵守 N-D6 决策 B）
- 复盘 tab 周回顾条显示"已生成 ✓"状态

---


## 9. N-Cross 系列 — 跨 Tab 联动（扩展）

继承 Review 09-Cross-Tab-Wiring 全部定义，本 Phase 扩展以下内容：

| # | 写入方 | 写入目标 | 触发条件 | 自动/手动 |
|---|---|---|---|---|
| **N-Cross-1** | Notes AI 摘要 | ReviewItemV2(source_kind=note_card) | 用户点"AI 总结" → 确认 | 手动 |
| **N-Cross-2** | Notes 收藏夹 | ReviewItemV2(source_kind=manual_add) | 收藏夹内"加入复盘"按钮 | 手动 |
| **N-Cross-3** | Notes 题级笔记 | ReviewItemV2(source_kind=manual_add, metadata.note_id) | 题级笔记"加入复盘"按钮 | 手动 |
| **N-Cross-4** | Notes 社区收藏 | NoteBookmarkV2 | 用户收藏他人笔记 | 手动 |
| **N-Cross-5** | Review 周回顾 | NoteV2(type=weekly_review) | 复盘 tab "生成回顾笔记" | 手动 |
| **N-Cross-6** | Review 错因 | NoteV2(type=ai_cause_analysis) | 复盘 "保存为笔记" | 手动 |
| **N-Cross-7** | Practice 答题 | NoteV2(type=question_level, linked_question_id) | 答题界面"加笔记" | 手动 |

### 9.1 跨 Tab 导航路径

| 起点 | 动作 | 终点 |
|---|---|---|
| Notes 列表 → 题级笔记 | 点击 | `/q/:id?ctx=note&note_id=N` |
| Notes 收藏夹 → 题目 | 点击"去练习" | `/q/:id?ctx=favorite` |
| `/q/:id` → 笔记 | 点击"该题相关笔记" | `/notes/:noteId`（脱壳编辑器） |
| Review 错因 → "保存为笔记" | 点击 | 创建 NoteV2 → toast 确认 + "查看" link |
| Review 周回顾 → "生成笔记" | 点击 | 创建 NoteV2 → 打开 TipTap 编辑器 |
| Practice 答题 → "加笔记" | 点击 | inline 编辑器 / 弹窗（不脱壳，不离开答题） |

### 9.2 前端 Store Selectors（Notes domain 暴露）

```typescript
// packages/domain/src/notes/ 暴露给其他 domain
export function useQuestionNotes(questionId: number): NoteV2[];
export function useNoteCount(): number;
export function useWeeklyReviewExists(year: number, week: number): boolean;
export function useCommunityNotes(questionId: number, opts?: { limit?: number }): CommunityNote[];
export function useNoteTags(noteId: number): NoteTagV2[];
```

---


## 10. AI 摘要拆复盘卡决策（N-D3 详细）

| # | 决策 | 拍板 |
|---|---|---|
| **N-AI-1** | 触发方式 | 用户手动点"AI 总结 → 生成复盘卡" |
| **N-AI-2** | LLM 输入 | 笔记 body（纯文本，≤2000 字截断）+ 关联题目题面（如有） |
| **N-AI-3** | LLM 输出 | 1~3 张复盘要点卡片，每张 ≤50 字 |
| **N-AI-4** | 用户确认 | 展示预览，用户可勾选/编辑/删除 → 确认后批量写入 |
| **N-AI-5** | 写入目标 | ReviewItemV2(source_kind=note_card, metadata_json.note_id=N, metadata_json.card_text=...) |
| **N-AI-6** | 限流 | 共享 daily_llm_quota（与 AI 错因 / AI 出题同池，每用户每日 20 次总量） |
| **N-AI-7** | 缓存 | 键=(note_id, content_hash)；笔记未修改时复用上次结果 |
| **N-AI-8** | 失败兜底 | toast "AI 摘要暂不可用" + 不影响笔记正常使用 |

### 10.1 交互流程

```
笔记详情页底部
  └─ CTA "🤖 AI 总结 → 生成复盘卡"
     └─ 调 LLM (loading spinner, ≤15s)
        └─ 成功 → 弹出预览面板
           ├─ 卡片 1: "排列组合中，捆绑法适用于相邻约束" [✓] [编辑]
           ├─ 卡片 2: "插空法适用于不相邻约束" [✓] [编辑]
           └─ 卡片 3: "区分方法：看约束是相邻还是不相邻" [ ] [编辑]
           └─ [确认加入复盘] / [取消]
              └─ 确认 → 批量 POST /api/v2/review/items (source_kind=note_card)
                 └─ toast "已加入复盘队列 ✓"
```

---

## 11. Phase-Notes 范围明确

### 11.1 在范围内（完整清单）

- 笔记 Tab `/notes` 三 segment 主视图（全部 / 我的笔记 / 收藏夹）
- 筛选器系统（关联状态 / 题目状态 / 来源 / 标签）
- TipTap 编辑器 `/notes/:id`（脱壳全屏，P1 扩展集）
- 自由标签 + 预置分类系统（NoteTagV2 CRUD + 标签云 + 自动补全）
- Meilisearch 全文搜索集成（索引 + 同步 + faceted）
- AI 摘要拆复盘卡（手动触发 + 确认 + 写入 ReviewItemV2）
- 周回顾笔记生成（Gamma 方案 + banner 提醒 + TipTap 编辑）
- 社区笔记 P1（visibility 字段 + 公开切换 + 只读浏览）
- 收藏夹 segment（QuestionCard 列表 + 操作区）
- 跨 Tab 联动（Notes ↔ Practice / Review / Q-Hub 完整 wiring）
- NoteV2 schema 最终化（type 枚举扩展 + visibility + body JSON AST）
- 路由注册 + TabBar/RailMini 新增笔记 tab 条目（5 tab 落地）
- 图片上传（本地文件系统 Stage 1）
- 笔记导出（Markdown / HTML）
- OpenAPI + e2e 测试

### 11.2 不在范围内（明确推出）

- 社区笔记 P2/P3（点赞/评论/收藏/精选/举报）→ Phase-Notes-Community
- 协作编辑 / 多人实时（Yjs / Liveblocks）→ Stage 2 多用户
- 版本历史 / 变更追踪 → Stage 2
- TipTap P2 扩展（Table / Math / CodeBlock）→ 迭代
- 笔记模板库（预置空白模板 / 错题模板 / 知识点模板）→ 迭代
- 知识图谱可视化 → 远期
- 笔记 AI 自动标签推荐 → 远期
- 对象存储图片迁移 → Stage 2
- 笔记打印 / PDF 导出（区别于 Markdown 导出）→ 迭代

---

## 12. NoteV2 type 枚举（最终版）

```typescript
type NoteType =
  | 'free'                // 用户自由创建（无关联题目）
  | 'question_level'      // 题级笔记（linked_question_id 非空）
  | 'ai_cause_analysis'   // AI 错因分析保存（from Review Cross-4）
  | 'weekly_review'       // 周回顾笔记（from Review Weekly-4 / N-Weekly）
  | 'community_bookmark'; // 收藏他人公开笔记的本地副本（P2）
```

---

## 13. 决策变更流程

1. 在本文对应条目行用 `~~删除线~~` 标注旧值 + 新行写新值 + 日期
2. PR description 标 `BREAKING DECISION CHANGE: {条目编号}`
3. 同步更新 README §3 关键决策速查
4. reviewer 必须检查下游 01~06 是否一致

---

## 14. 引用矩阵

| 决策 | 被以下文档使用 |
|---|---|
| N-D1~8 | README.md §3 关键决策速查 |
| N-Ed-* | 04-Editor-Integration.md |
| N-Search-* | 02-Backend-WU.md（Meilisearch 集成） |
| N-Tag-* | 01-Data-Model.md（NoteTagV2） / 03-Frontend-WU.md（标签 UI） |
| N-Community-* | 01-Data-Model.md（Reaction/Comment/Bookmark 表） / 03-Frontend-WU.md |
| N-Weekly-* | 05-AI-Summary.md |
| N-Cross-* | Phase/Review/09-Cross-Tab-Wiring.md |
| N-AI-* | 05-AI-Summary.md / Phase/Review/06-AI-Cause-Analysis.md |
