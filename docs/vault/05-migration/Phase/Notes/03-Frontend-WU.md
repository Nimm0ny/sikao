# Phase-Notes · 03 · Frontend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) · [01-Data-Model](./01-Data-Model.md) · [02-Backend-WU](./02-Backend-WU.md)
> **Convention**: 每个 WU 对应一组 PR；PR 按 AGENTS-H9 ≤15 文件 / ≤400 行；前端视觉 PR 必须经 browser smoke

---

## 0. WU 总览

| # | WU | 描述 | 复杂度 | 依赖 |
|---|---|---|---|---|
| WU-FN1 | Route Registration + Tab Navigation | 路由注册 + TabBar/RailMini 新增笔记 tab | S | — |
| WU-FN2 | Notes Tab Main View (`/notes`) | 3 segment + NoteCard grid + 收藏夹 + 空态 | M | WU-FN1 |
| WU-FN3 | Filter System | 筛选器面板 + URL query sync + 标签多选 | M | WU-FN2 |
| WU-FN4 | TipTap Editor (`/notes/:id`) | 全屏脱壳编辑器 + 自动保存 + 图片上传 | L | WU-FN1 |
| WU-FN5 | Tag System UI | 标签输入 + 标签云 + 标签管理页 | M | WU-FN2, WU-FN4 |
| WU-FN6 | Search Integration | Meilisearch 即时搜索 + faceted 结果 | M | WU-FN2 |
| WU-FN7 | AI Summary Cards | AI 总结 → 生成复盘卡交互 | M | WU-FN4 |
| WU-FN8 | Weekly Review Banner + Editor Pre-fill | 周一 banner + LLM 生成 + 编辑器预填 | M | WU-FN4 |
| WU-FN9 | Community Notes P1 | 社区 segment + 可见性切换 + 公开笔记 feed | M | WU-FN2, WU-FN4 |
| WU-FN10 | Cross-Tab Navigation Wiring | 跨 Tab 导航 + domain hooks | M | WU-FN2, WU-FN4 |

---

## 1. 全局规范

### 1.1 包路径


```
apps/web/src/                        ← 应用层（路由 / 视图 / 全屏组件）
apps/web/src/components/notes/       ← Notes Tab 组件目录
apps/web/src/views/                  ← 页面级视图（NotesHome / NoteEditor）
packages/api-client/                  ← V2 queries + axios + types
packages/domain/src/notes/            ← Notes domain stores + hooks
packages/ui/                          ← 共享 UI（EmptyState / ErrorCard / Skeleton）
packages/design-system/               ← tokens.css SSOT
packages/shared-utils/                ← cn / logger / hooks / motion
```

### 1.2 状态机式组件约定

每个数据驱动组件必须实现 4 状态：

| 状态 | 触发 | 视觉 |
|---|---|---|
| `loading` | query.isPending | 骨架屏（Skeleton component） |
| `empty` | query.data 为空 | EmptyState 组件 |
| `error` | query.isError | ErrorCard（含重试按钮） |
| `ready` | query.isSuccess && data | 真实渲染 |

### 1.3 响应式布局约定

| 断点 | 布局 | 说明 |
|---|---|---|
| N1 (mobile, <768px) | 单列 NoteCard grid | TabBar 底部导航 |
| N2 (tablet+desktop, ≥768px) | 双列 NoteCard grid | RailMini 侧边导航 |

### 1.4 暗色 / 主题

所有新组件**禁止写死颜色**；只用 tokens（`var(--color-*)` / tailwind token-driven class）。

---


## 2. WU-FN1 · Route Registration + Tab Navigation

**描述**：将 `/notes` 加入 TabBar（mobile）和 RailMini（tablet portrait）作为第 5 个 tab；注册 `/notes/:id` 脱壳路由；Lazy import NotesHome + NoteEditor 视图。

### 2.1 组件树

```
apps/web/src/router/index.tsx           ← 路由注册
apps/web/src/layouts/TabBar.tsx          ← 新增笔记 tab 条目
apps/web/src/layouts/RailMini.tsx        ← 新增笔记 tab 条目
apps/web/src/views/NotesHome.tsx         ← lazy(() => import(...))
apps/web/src/views/NoteEditor.tsx        ← lazy(() => import(...))
```

### 2.2 路由配置

```typescript
// router/index.tsx 新增
{ path: '/notes', element: <NotesHome />, shell: true },
{ path: '/notes/tags', element: <NoteTagsManagement />, shell: true },
{ path: '/notes/:id', element: <NoteEditor />, shell: false },  // 脱壳
```

### 2.3 详细说明

| 项目 | 说明 |
|---|---|
| Tab 位置 | 第 5 个 tab（首页 / 练习 / 复盘 / 笔记 / 我的）— 遵守 D1 决策 |
| 脱壳路由 | `/notes/:id` 隐藏 TabBar/RailMini（D15 决策） |
| Lazy import | `React.lazy` + `<Suspense fallback={<PageSkeleton />}>` |

| 复杂度 | **S** |
|---|---|
| **依赖** | 无（可独立启动） |
| **预计行数** | ~120 |
| **验收标准** | TabBar/RailMini 显示笔记图标 + 文字；点击跳转 `/notes`；`/notes/:id` 全屏无壳；lazy 加载无白屏 |

---


## 3. WU-FN2 · Notes Tab Main View (`/notes`)

**描述**：3 segment tabs（全部 / 我的笔记 / 收藏夹）；NoteCard grid 列表；收藏夹 QuestionCard 列表（复用 Q-Hub 组件）；各 segment 空态。

### 3.1 组件树

```
apps/web/src/views/NotesHome.tsx
apps/web/src/components/notes/
  NotesSegmentTabs.tsx              ← 3 segment: 全部 / 我的笔记 / 收藏夹
  NoteCardGrid.tsx                  ← 笔记卡片网格容器
  NoteCard.tsx                      ← 单张笔记卡片（标题 + 预览 + tags + 更新时间）
  FavoritesSegment.tsx              ← 收藏夹：QuestionCard 列表
  QuestionCard.tsx                  ← 复用 Q-Hub QuestionCard 组件
  states/
    NotesLoadingSkeleton.tsx
    NotesEmptyAll.tsx               ← "还没有笔记" + CTA 创建
    NotesEmptyFavorites.tsx         ← "还没有收藏题目"
    NotesErrorState.tsx
```

### 3.2 Segment 路由映射

```
/notes                  → 默认 segment "全部"
/notes?tab=my           → "我的笔记"（展开筛选器面板）
/notes?tab=favorites    → "收藏夹"
/notes?tab=community    → "社区"（WU-FN9 实现）
```

### 3.3 NoteCard 展示

```
┌─────────────────────────────────────┐
│ 排列组合·捆绑法 vs 插空法            │  ← title
│ 捆绑法适用于相邻约束，插空法...      │  ← body_preview (前 100 字)
│ #数量关系 #解题技巧                  │  ← tags (最多显示 3 个)
│ 📎 #62 利润问题        2h前 · 328字  │  ← linked_question + meta
└─────────────────────────────────────┘
```

### 3.4 响应式布局

| 断点 | NoteCard Grid |
|---|---|
| N1 (mobile) | 单列，卡片全宽 |
| N2 (desktop) | 双列，`grid-template-columns: repeat(2, 1fr)` |

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN1 |
| **预计行数** | ~380 |
| **验收标准** | 3 segment 切换正确更新 URL query；NoteCard 渲染标题/预览/标签/时间；收藏夹显示 QuestionCard；每 segment 有独立空态；N1/N2 响应式布局正确 |

---


## 4. WU-FN3 · Filter System

**描述**：筛选器面板组件；5 个筛选维度（关联状态 / 题目状态 / 来源 / 标签 / 排序）；URL query 双向同步；标签多选 autocomplete。

### 4.1 组件树

```
apps/web/src/components/notes/
  FilterPanel.tsx                   ← 筛选器面板容器（展开/收起）
  filters/
    FilterLinkedStatus.tsx          ← 关联状态：有关联 / 无关联 / 全部
    FilterQuestionStatus.tsx        ← 题目状态：含错题 / 含标记题 / 全部
    FilterSource.tsx                ← 来源：手动创建 / AI错因 / 周回顾 / 社区收藏
    FilterTags.tsx                  ← 标签多选 + autocomplete 下拉
    FilterSort.tsx                  ← 排序：最近修改 / 最近创建 / 标题字母序
  hooks/
    useNoteFilters.ts              ← URL query ↔ filter state 双向同步
```

### 4.2 URL Query 参数设计

```
/notes?tab=my&linked=has&q_status=wrong&source=manual&tags=数量关系,公式&sort=updated
```

| 参数 | 值 | 默认 |
|---|---|---|
| `tab` | `all` / `my` / `favorites` / `community` | `all` |
| `linked` | `has` / `none` / `all` | `all` |
| `q_status` | `wrong` / `flagged` / `all` | `all` |
| `source` | `manual` / `ai_cause` / `weekly` / `community_bookmark` | 不限 |
| `tags` | 逗号分隔标签名 | 空 |
| `sort` | `updated` / `created` / `title` | `updated` |

### 4.3 标签多选 Autocomplete

- 输入时下拉推荐（已有标签 + 系统标签，按使用频次排序）
- 已选标签显示为 chip，可单独删除
- AND 逻辑：多选时取交集

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN2 |
| **预计行数** | ~350 |
| **验收标准** | 筛选器面板展开/收起正常；每个维度筛选结果正确；URL query 与筛选器状态双向同步（刷新页面恢复筛选）；标签 autocomplete 下拉展示频次排序；选中/取消标签更新列表 |

---


## 5. WU-FN4 · TipTap Editor (`/notes/:id`)

**描述**：全屏脱壳编辑器；TipTap 配置 P1 扩展集；工具栏；自动保存（debounce 3s）+ dirty state；标题输入 + 底栏（关联题目 + 字数 + 标签）；图片上传（拖拽 + 粘贴 + 工具栏按钮）。

### 5.1 组件树

```
apps/web/src/views/NoteEditor.tsx          ← 全屏脱壳容器
apps/web/src/components/notes/editor/
  EditorTopBar.tsx                          ← ← 返回列表 | 保存状态 | ··· 更多
  EditorToolbar.tsx                         ← B I H1 H2 • — "" img 🏷️
  TipTapContent.tsx                         ← TipTap <EditorContent /> 封装
  EditorBottomBar.tsx                       ← 关联题目 + 字数统计 + 标签
  TitleInput.tsx                            ← 标题输入框（无边框 input）
  ImageUploader.tsx                         ← 图片上传逻辑（drag/drop + paste + button）
  hooks/
    useNoteAutoSave.ts                      ← debounce 3s PUT + dirty state tracking
    useNoteEditor.ts                        ← TipTap useEditor 配置封装
    useImageUpload.ts                       ← 图片上传 + 插入 handler
```

### 5.2 TipTap P1 扩展配置

```typescript
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';

const editor = useEditor({
  extensions: [
    StarterKit,
    Image.configure({ inline: false, allowBase64: false }),
    Highlight,
    Placeholder.configure({ placeholder: '开始写笔记...' }),
    CharacterCount,
    Markdown,  // Markdown 导入/导出兼容
  ],
});
```

### 5.3 编辑器 UI 布局（遵守 N-Ed §4.2）

```
┌─────────────────────────────────────────────────────┐
│ ← 返回列表                    保存状态 · ··· 更多    │  ← EditorTopBar
├─────────────────────────────────────────────────────┤
│ [TitleInput]                                         │
├─────────────────────────────────────────────────────┤
│ B I H1 H2 • — "" img ─── ─── 🏷️标签              │  ← EditorToolbar
├─────────────────────────────────────────────────────┤
│                                                     │
│  [TipTapContent 编辑区域]                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 📎 关联题目: #62 利润问题     字数: 328              │  ← EditorBottomBar
│ 🏷️ #数量关系 #公式 #易错点                          │
└─────────────────────────────────────────────────────┘
```

### 5.4 自动保存逻辑

```
编辑内容变化
  └─ debounce 3s
     └─ PUT /api/v2/notes/:id (body_json + title + word_count)
        ├─ 成功 → EditorTopBar 显示 "已保存 ✓"
        └─ 失败 → EditorTopBar 显示 "保存失败" + retry button

离开页面时：
  └─ dirty state = true → 弹确认 "有未保存的修改，确认离开？"
```

### 5.5 图片上传

| 触发方式 | 说明 |
|---|---|
| 拖拽 | 拖拽图片到编辑区 → 上传 → 插入 image node |
| 粘贴 | Ctrl+V 粘贴图片 → 上传 → 插入 |
| 工具栏按钮 | 点击 img 按钮 → 选择文件 → 上传 → 插入 |

上传流程：`POST /api/v2/notes/:id/images` → 返回 `file_path` → 插入 TipTap Image node

| 复杂度 | **L** |
|---|---|
| **依赖** | WU-FN1 |
| **预计行数** | ~600 |
| **验收标准** | 全屏脱壳无 TabBar/RailMini；TipTap 所有 P1 扩展可用（bold/italic/heading/list/blockquote/image/highlight）；自动保存 3s debounce 正常触发；dirty state 离开提示；图片拖拽/粘贴/按钮三种方式均可上传；标题 + 底栏信息正确展示；字数统计实时更新 |

---


## 6. WU-FN5 · Tag System UI

**描述**：标签输入组件（预置 chip list + free text input with autocomplete）；标签云侧栏（频次排序，大小字）；标签管理页 `/notes/tags`（列表 + 重命名 + 合并 + 删除）。

### 6.1 组件树

```
apps/web/src/components/notes/tags/
  TagInput.tsx                     ← 编辑器底部标签区（预置 chip toggle + 自由输入）
  TagAutocomplete.tsx              ← 输入时下拉推荐（频次排序）
  TagChip.tsx                      ← 单个标签 chip（可删除）
  TagCloudSidebar.tsx              ← 笔记列表侧栏标签云（高频大字 / 低频小字）
apps/web/src/views/NoteTagsManagement.tsx  ← /notes/tags 标签管理页
apps/web/src/components/notes/tags/
  TagList.tsx                      ← 全部标签列表 + 使用次数
  TagRenameDialog.tsx              ← 重命名对话框
  TagMergeDialog.tsx               ← 合并对话框（选择目标标签）
  TagDeleteConfirm.tsx             ← 删除确认
  hooks/
    useTagAutocomplete.ts          ← GET /api/v2/notes/tags?q=... debounce
    useTagCloud.ts                 ← GET /api/v2/notes/tags (全量 + 频次)
```

### 6.2 标签输入交互

```
编辑器底栏 标签区：
├─ 预置系统标签 chip 列表（点选 toggle on/off）
│   [#行测] [#数量关系] [#言语理解] [#解题技巧] [#易错点] ...
├─ 自由输入框："添加标签..."
│   └─ 输入时弹 autocomplete 下拉
│   └─ 回车创建 / 选中已有标签
└─ 已选标签 chips（可点 × 删除）
    [#数量关系 ×] [#公式 ×] [#易错点 ×]
```

### 6.3 标签云（侧栏）

- N2 (desktop) 时笔记列表右侧显示标签云
- 标签大小按使用频次映射（min 12px → max 24px）
- 点击标签 → 触发筛选（等价于 FilterTags 选中该标签）

### 6.4 标签管理页 `/notes/tags`

| 功能 | 说明 |
|---|---|
| 列表 | 所有标签 + 使用次数 + 是否系统标签 |
| 重命名 | 影响所有关联笔记（批量更新 NoteTagV2.tag_name） |
| 合并 | 选择目标标签 → 源标签所有关联迁移到目标 → 删除源 |
| 删除 | 系统标签不可删除；自由标签确认后批量移除 |

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN2, WU-FN4 |
| **预计行数** | ~400 |
| **验收标准** | 预置标签 chip toggle 正确；自由输入 autocomplete 按频次排序；回车创建新标签；每笔记 ≤10 标签限制 UI 提示；标签云点击触发筛选；管理页重命名/合并/删除操作成功 + toast 反馈；系统标签不可删除 |

---


## 7. WU-FN6 · Search Integration

**描述**：搜索栏组件（顶部搜索框）；Meilisearch 即时搜索（debounce 300ms）；Faceted 结果展示；搜索结果高亮。

### 7.1 组件树

```
apps/web/src/components/notes/search/
  SearchBar.tsx                    ← 顶部搜索输入框 + 清除按钮
  SearchResults.tsx                ← 搜索结果列表容器
  SearchResultCard.tsx             ← 单条结果卡片（高亮匹配文本）
  SearchFacets.tsx                 ← Faceted 筛选侧栏（标签 / 类型 / 关联状态）
  SearchEmpty.tsx                  ← 无结果空态
  hooks/
    useNoteSearch.ts               ← Meilisearch client + debounce 300ms
    useSearchHighlight.ts          ← 匹配文本高亮处理
```

### 7.2 搜索交互流程

```
用户输入搜索词
  └─ debounce 300ms
     └─ POST Meilisearch /indexes/notes/search
        { q: "捆绑法", filter: "user_id = 1", facets: ["tags", "type"] }
        └─ 返回结果
           ├─ SearchResultCard 列表（title + body 片段高亮）
           ├─ SearchFacets 侧栏（标签/类型 可进一步筛选）
           └─ 无结果 → SearchEmpty
```

### 7.3 搜索结果高亮

- Meilisearch 返回 `_formatted` 字段（含 `<em>` 高亮标记）
- 前端用 `dangerouslySetInnerHTML` + XSS sanitize 渲染高亮
- 高亮样式：`background: var(--color-highlight-search)`

### 7.4 Facets 展示

| Facet 维度 | 展示形式 |
|---|---|
| 标签 | chip 列表 + 命中数量 badge |
| 笔记类型 | radio group（自由/题级/AI错因/周回顾） |
| 关联状态 | toggle（有关联/无关联） |
| 创建时间 | year_month 下拉 |

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN2 |
| **预计行数** | ~350 |
| **验收标准** | 输入搜索词 300ms 后触发搜索；结果高亮匹配文本；facets 显示命中分布；点击 facet 细化结果；搜索延迟 < 50ms（Meilisearch 目标）；无结果展示友好空态；清除搜索恢复列表 |

---


## 8. WU-FN7 · AI Summary Cards（笔记详情页底部）

**描述**：CTA 按钮 "AI 总结 → 生成复盘卡"；Loading state（≤15s spinner）；预览面板（checkable/editable cards）；确认 → POST review items → toast。

### 8.1 组件树

```
apps/web/src/components/notes/ai/
  AiSummaryCTA.tsx                 ← 底部 CTA 按钮 "🤖 AI 总结 → 生成复盘卡"
  AiSummaryLoading.tsx             ← Loading spinner (≤15s)
  AiSummaryPreview.tsx             ← 预览面板容器
  AiSummaryCard.tsx                ← 单张复盘卡片（checkbox + 可编辑文本）
  hooks/
    useAiSummary.ts                ← POST /api/v2/notes/:id/ai-summary + 缓存
    useReviewItemCreate.ts         ← batch POST /api/v2/review/items
```

### 8.2 交互流程（遵守 N-AI §10.1）

```
笔记详情页底部
  └─ CTA "🤖 AI 总结 → 生成复盘卡"
     └─ 调 LLM (AiSummaryLoading spinner, ≤15s timeout)
        ├─ 成功 → AiSummaryPreview 弹出
        │   ├─ AiSummaryCard 1: "排列组合中，捆绑法适用于相邻约束" [✓] [编辑]
        │   ├─ AiSummaryCard 2: "插空法适用于不相邻约束" [✓] [编辑]
        │   └─ AiSummaryCard 3: "区分方法：看约束是相邻还是不相邻" [ ] [编辑]
        │   └─ [确认加入复盘] / [取消]
        │      └─ 确认 → batch POST → toast "已加入复盘队列 ✓"
        ├─ 超时 → toast "AI 摘要暂不可用，请稍后重试"
        └─ 缓存命中（content_hash 未变）→ 直接展示上次结果
```

### 8.3 卡片编辑

- 每张卡片默认勾选，用户可取消勾选
- 点击"编辑"按钮 → 文本变为 input → 用户修改 → 失焦保存
- 每张卡片文本 ≤50 字限制（CharacterCount 提示）

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN4 |
| **预计行数** | ~320 |
| **验收标准** | CTA 按钮在笔记详情页底部可见；点击触发 LLM 调用 + spinner；≤15s 返回 1~3 张卡片；卡片可勾选/取消/编辑；确认后成功写入 ReviewItemV2 + toast；缓存命中时跳过 LLM 调用；失败展示兜底 toast 不影响笔记使用 |

---


## 9. WU-FN8 · Weekly Review Banner + Editor Pre-fill

**描述**：周一 banner 组件（检查是否已生成）；"查看" → 触发 LLM → open editor with pre-filled template；"稍后" / "不再提醒" handlers。

### 9.1 组件树

```
apps/web/src/components/notes/weekly/
  WeeklyReviewBanner.tsx           ← 周一首次打开时顶部 banner
  WeeklyReviewGenerate.tsx         ← "生成本周回顾笔记" 按钮 + loading
  hooks/
    useWeeklyReviewBanner.ts       ← 检查上周是否已生成 + banner 状态管理
    useWeeklyReviewGenerate.ts     ← 调 LLM 生成 + 创建 NoteV2 + 打开编辑器
```

### 9.2 Banner 触发逻辑（遵守 N-Weekly §8.2）

```
周一首次打开 app / /notes 页面
  └─ useWeeklyReviewBanner 检查：
     ├─ profile_v2.info.weekly_review_banner === false → 不显示
     ├─ 上周已生成 weekly_review note → 不显示
     └─ 未生成 → 显示 Banner
        ├─ "查看" → useWeeklyReviewGenerate:
        │   └─ 调 LLM(cause_analysis_weekly) → 生成 NoteV2(type=weekly_review)
        │   └─ 自动附加标签 #周回顾 #第{N}周
        │   └─ 打开 /notes/:newId（编辑器预填模板内容）
        ├─ "稍后" → 关闭 banner（当日不再提醒，sessionStorage）
        └─ "不再提醒" → PUT profile_v2.info.weekly_review_banner=false
```

### 9.3 编辑器预填模板

生成后的 NoteV2.body_json 内容为结构化 TipTap JSON AST，对应 N-Weekly §8.1 的 Markdown 模板。用户可在 TipTap 编辑器中自由修改补充。

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN4 |
| **预计行数** | ~280 |
| **验收标准** | 周一首次打开显示 banner；已生成/已关闭/profile 设置为 false 时不显示；"查看" 触发 LLM + 生成笔记 + 跳转编辑器；编辑器预填模板可编辑；"稍后" 关闭当日不再弹；"不再提醒" 永久关闭 |

---


## 10. WU-FN9 · Community Notes P1

**描述**：`/notes?tab=community` segment（公开笔记 feed）；排序 tabs（最新 / 最热 / 精选）；编辑器内可见性切换（private ↔ public，body ≥ 50 chars 校验）；CommunityNotesSection 集成 `/q/:id`。

### 10.1 组件树

```
apps/web/src/components/notes/community/
  CommunitySegment.tsx             ← /notes?tab=community 主容器
  CommunitySortTabs.tsx            ← 排序：最新 / 最热 / 精选
  CommunityNoteCard.tsx            ← 公开笔记卡片（含作者名 + reaction_count）
  CommunityEmptyState.tsx          ← "暂无公开笔记"
apps/web/src/components/notes/editor/
  VisibilityToggle.tsx             ← private ↔ public 切换组件
apps/web/src/components/q-hub/
  CommunityNotesSection.tsx        ← /q/:id 页面"同学笔记"区块（已有组件壳，本 WU 填充）
  hooks/
    useCommunityNotes.ts           ← GET community notes by question_id
```

### 10.2 社区 Feed 排序（遵守 N-Community §7.4）

| 模式 | 排序规则 |
|---|---|
| 最新 | created_at DESC |
| 最热 | reaction_count DESC, created_at DESC |
| 精选 | is_featured=true, reaction_count DESC |

### 10.3 可见性切换

```
编辑器 EditorTopBar ··· 更多菜单
  └─ "设为公开" / "设为私有" toggle
     ├─ private → public:
     │   └─ 校验 body_text.length ≥ 50
     │      ├─ 通过 → PUT visibility=public + toast "已公开"
     │      └─ 不通过 → toast "笔记内容不少于 50 字才能公开"
     └─ public → private:
         └─ 确认弹窗 "公开笔记设为私有后，其他用户将无法查看"
            └─ 确认 → PUT visibility=private + toast "已设为私有"
```

### 10.4 CommunityNotesSection（/q/:id 集成）

- 在题目中枢页 `/q/:id` 底部展示该题下公开笔记（最多 5 条）
- 点击跳转 `/notes/:noteId`（只读模式，非当前用户笔记不可编辑）

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN2, WU-FN4 |
| **预计行数** | ~380 |
| **验收标准** | community segment 展示公开笔记 feed；3 种排序切换正确；可见性 toggle 生效 + 50 字校验；private→public 确认弹窗；CommunityNotesSection 在 /q/:id 展示该题公开笔记；非当前用户笔记只读 |

---


## 11. WU-FN10 · Cross-Tab Navigation Wiring

**描述**：跨 Tab 导航路径完整 wiring；domain hooks 暴露给其他模块使用。

### 11.1 组件树

```
packages/domain/src/notes/
  useQuestionNotes.ts              ← 题目关联笔记列表
  useNoteCount.ts                  ← 用户笔记总数
  useWeeklyReviewExists.ts         ← 检查某周是否已生成周回顾
  useCommunityNotes.ts             ← 题目下公开笔记
  useNoteTags.ts                   ← 笔记标签列表
  index.ts                         ← barrel export
apps/web/src/components/notes/
  NoteCaptureModal.tsx             ← 练习"加笔记" inline 编辑器弹窗（已有，完善）
apps/web/src/components/review/
  SaveAsNoteButton.tsx             ← 复盘"保存为笔记" → create NoteV2 + toast
```

### 11.2 跨 Tab 导航路径（遵守 N-Cross §9.1）

| 起点 | 动作 | 终点 |
|---|---|---|
| Notes 列表 → 题级笔记 | 点击 NoteCard | `/q/:id?ctx=note&note_id=N` |
| Notes 收藏夹 → 题目 | 点击 QuestionCard "去练习" | `/q/:id?ctx=favorite` |
| Practice 答题 → "加笔记" | 点击按钮 | NoteCaptureModal（inline，不离开答题） |
| Review 错因 → "保存为笔记" | 点击 SaveAsNoteButton | create NoteV2(type=ai_cause_analysis) → toast + "查看" link |
| `/q/:id` → 笔记 | 点击"该题相关笔记" | `/notes/:noteId`（脱壳编辑器） |

### 11.3 Domain Hooks API（遵守 N-Cross §9.2）

```typescript
// packages/domain/src/notes/ 暴露给其他 domain
export function useQuestionNotes(questionId: number): NoteV2[];
export function useNoteCount(): number;
export function useWeeklyReviewExists(year: number, week: number): boolean;
export function useCommunityNotes(questionId: number, opts?: { limit?: number }): CommunityNote[];
export function useNoteTags(noteId: number): NoteTagV2[];
```

### 11.4 NoteCaptureModal 完善

- 已有组件壳，本 WU 接入 TipTap 精简版（仅 StarterKit，无图片上传）
- 创建 NoteV2(type=question_level, linked_question_id=当前题目)
- 保存后 toast + invalidate useQuestionNotes

### 11.5 SaveAsNoteButton

- 复盘页错因分析结果区显示
- 点击 → POST create NoteV2(type=ai_cause_analysis, body_json=错因内容)
- 成功 → toast "已保存为笔记" + "查看" link → `/notes/:newId`

| 复杂度 | **M** |
|---|---|
| **依赖** | WU-FN2, WU-FN4 |
| **预计行数** | ~350 |
| **验收标准** | 题级笔记点击正确跳转 /q/:id?ctx=note；收藏夹点击跳 /q/:id?ctx=favorite；NoteCaptureModal 创建笔记成功；SaveAsNoteButton 创建笔记 + toast + link；所有 domain hooks 可从外部 import 使用；hook 返回数据与后端 API 一致 |

---


## 12. 依赖图

```
WU-FN1 (Route) ──┬──→ WU-FN2 (Main View) ──┬──→ WU-FN3 (Filter)
                 │                           ├──→ WU-FN6 (Search)
                 │                           ├──→ WU-FN5 (Tags) ←── WU-FN4
                 │                           ├──→ WU-FN9 (Community) ←── WU-FN4
                 │                           └──→ WU-FN10 (Cross-Tab) ←── WU-FN4
                 │
                 └──→ WU-FN4 (TipTap Editor) ──┬──→ WU-FN5 (Tags)
                                               ├──→ WU-FN7 (AI Summary)
                                               ├──→ WU-FN8 (Weekly Banner)
                                               ├──→ WU-FN9 (Community)
                                               └──→ WU-FN10 (Cross-Tab)
```

---

## 13. 实施顺序建议

| 阶段 | WU | 说明 |
|---|---|---|
| **Phase 1** | WU-FN1 | 路由 + Tab 基础设施 |
| **Phase 2** | WU-FN4 | TipTap 编辑器（核心，不依赖列表） |
| **Phase 3** | WU-FN2 | 主视图列表 |
| **Phase 4** | WU-FN3, WU-FN5, WU-FN6 | 筛选 + 标签 + 搜索（可并行） |
| **Phase 5** | WU-FN7, WU-FN8 | AI 摘要 + 周回顾（可并行） |
| **Phase 6** | WU-FN9, WU-FN10 | 社区 + 跨 Tab wiring（可并行） |

---

## 14. 引用矩阵

| 本文档被引用 |
|---|
| [README.md](./README.md) §前端工作单元 |
| [00-Decisions](./00-Decisions.md) §14 引用矩阵 |
| [01-Data-Model](./01-Data-Model.md) §10 引用矩阵 |
| [04-Editor-Integration](./04-Editor-Integration.md) TipTap 实现细节 |
| [06-Testing](./06-Testing.md) 前端测试清单 |
