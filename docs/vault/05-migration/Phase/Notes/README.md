# Phase · Notes（笔记 tab）

> **Status**: ACCEPTED · 详细规格完成
> **IA 位置**：Main App Layer · Tab 4
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围总述

笔记 tab 是用户主动整理与沉淀的知识库，承担"学 → 记 → 复 → 分享"闭环中"记"的核心角色。

**P1 范围（本 Phase）**：
- TipTap WYSIWYG 编辑器（全屏脱壳）
- 笔记 CRUD + 3 segment（全部 / 我的笔记 / 收藏夹）+ 筛选器
- 自由标签 + 预置分类系统
- Meilisearch 全文搜索
- AI 摘要拆复盘卡（手动触发）
- 周回顾笔记生成（Gamma 方案：结构化模板 + 可编辑）
- 社区笔记 P1（公开/私有 + 只读浏览）
- 收藏夹 segment（QuestionCard 列表）
- 跨 Tab 联动（Practice / Review / Q-Hub 完整 wiring）
- 图片上传 + 笔记导出（Markdown / HTML）

**不在范围**（推后续迭代）：
- 社区笔记 P2/P3（互动 + 精选）
- 协作编辑 / 版本历史
- TipTap P2 扩展（Table / Math / CodeBlock）
- 知识图谱 / AI 自动标签

---

## 1. 启动前置

| 前置 | 状态 | 说明 |
|---|---|---|
| Phase-Home 完工 | ⏳ | 依赖 LLM 模块 / audit / cron / AppShell 5-tab |
| Phase-Practice NoteV2 schema 升级 | ✅ | linked_question_id + visibility 已就位 |
| Phase-Review Cross-Tab 定义 | ✅ | Cross-2~4 / ReviewItemV2(note_card) 接口就绪 |
| TipTap 选型 | ✅ | N-Ed-1 拍板 TipTap Headless WYSIWYG |
| Meilisearch 选型 | ✅ | N-Search-1 拍板直接上 Meilisearch |

---

## 2. 关键决策速查

| ID | 决策 | 拍板 |
|---|---|---|
| N-D1 | Segment 划分 | 3 segment + 筛选器（不再区分自由/题级/错题） |
| N-D2 | 收藏夹形态 | 题目卡片列表（复用 Q-Hub QuestionCard） |
| N-D3 | AI 摘要触发 | 手动（避免烧配额） |
| N-D4 | 社区笔记 | 分 3 期（P1 只读 → P2 互动 → P3 精选） |
| N-D5 | 编辑器 | TipTap Headless WYSIWYG |
| N-D6 | 首页联动 | 不主动推笔记 + Weekly Review Gamma |
| N-D7 | 搜索 | Meilisearch（裸 binary，不走 PG FTS） |
| N-D8 | 标签 | 自由标签 + 预置分类混合 |
| N-D9 | 归档生命周期 | 双轴：status(active/archived) + deleted_at 独立 |

详见 [00-Decisions.md](./00-Decisions.md) §2。

---

## 3. 文档索引

| 编号 | 文件 | 内容 | 行数 |
|---|---|---|---|
| 00 | [00-Decisions.md](./00-Decisions.md) | 全部决策 SSOT（9 条 N-D + N-Ed/Search/Tag/Community/Weekly/AI/Cross） | ~540 |
| 01 | [01-Data-Model.md](./01-Data-Model.md) | NoteV2 扩展 + 5 张新表 + Meilisearch shape + Pydantic + 迁移 | ~500 |
| 02 | [02-Backend-WU.md](./02-Backend-WU.md) | 8 后端 WU（16 API 端点，~2200 行预估） | ~910 |
| 03 | [03-Frontend-WU.md](./03-Frontend-WU.md) | 10 前端 WU（路由/编辑器/筛选/搜索/AI/社区/跨Tab） | ~700 |
| 04 | [04-Editor-Integration.md](./04-Editor-Integration.md) | TipTap P1 配置 + body_json 转换 + 图片上传 + 性能 + 移动端 | ~390 |
| 05 | [05-AI-Summary.md](./05-AI-Summary.md) | AI 摘要拆卡 + 周回顾 prompt + 缓存 + 限流 + MD→JSON | ~375 |
| 06 | [06-Testing.md](./06-Testing.md) | 70 后端用例 + 7 前端组件 + 6 E2E + 7 不变量 + CI | ~354 |

**合计**：~3,770 行规格文档。

---

## 4. 数据模型概览

```
NoteV2 (扩展)
├── type: free | question_level | ai_cause_analysis | weekly_review | community_bookmark
├── visibility: private | public
├── body_json (TipTap JSON AST) + body_text (纯文本) + content_hash
├── linked_question_id (FK)
├── reaction_count / comment_count / bookmark_count (冗余计数)
└── deleted_at (soft delete)

新表：
├── NoteTagV2 (多对多标签)
├── NoteImageV2 (图片元数据)
├── NoteReactionV2 (P2 点赞)
├── NoteCommentV2 (P2 评论，树状 3 层)
└── NoteBookmarkV2 (P2 收藏)
```

详见 [01-Data-Model.md](./01-Data-Model.md)。

---

## 5. 后端端点总览（16 个）

```
Notes CRUD:     POST/GET/PUT/DELETE /api/v2/notes, GET /notes/{id}
Tags:           GET /notes/tags, POST/DELETE /notes/{id}/tags, PATCH rename, POST merge
Search:         GET /notes/search
Images:         POST /notes/images
Weekly Review:  POST /notes/weekly-review/generate (SSE)
AI Summary:     POST /notes/{id}/ai-summary, POST /notes/{id}/ai-summary/confirm
Export:         GET /notes/{id}/export?format=markdown|html
Community P1:   PATCH /notes/{id}/visibility, GET /notes/community
```

详见 [02-Backend-WU.md](./02-Backend-WU.md) §12。

---

## 6. 前端实施顺序

| Phase | WU | 说明 |
|---|---|---|
| 1 | WU-FN1 | 路由 + Tab 基础设施 |
| 2 | WU-FN4 | TipTap 编辑器（核心） |
| 3 | WU-FN2 | 主视图列表 |
| 4 | WU-FN3 + FN5 + FN6 | 筛选 + 标签 + 搜索（可并行） |
| 5 | WU-FN7 + FN8 | AI 摘要 + 周回顾（可并行） |
| 6 | WU-FN9 + FN10 | 社区 + 跨 Tab wiring（可并行） |

详见 [03-Frontend-WU.md](./03-Frontend-WU.md) §13。

---

## 7. 跨 Phase 依赖

| 依赖方向 | 说明 |
|---|---|
| Notes ← Home | LLM 模块 / audit / cron / AppShell 5-tab |
| Notes ← Practice | NoteV2 schema（linked_question_id + visibility 已加） |
| Notes ← Review | ReviewItemV2(source_kind=note_card) 写入接口 |
| Notes → Review | AI 摘要确认 → 写入 ReviewItemV2 |
| Notes → Home | 周回顾 banner 提醒（不推笔记到首页 Rec） |
| Notes ↔ Q-Hub | /q/:id?ctx=note 双向跳转 |

---

## 8. 技术栈新增

| 技术 | 用途 | 引入方 |
|---|---|---|
| TipTap (@tiptap/react + extensions) | WYSIWYG 编辑器 | N-Ed-1 |
| Meilisearch (binary) | 全文搜索 | N-Search-1 |
| tiptap-markdown | Markdown 互操作 | N-Ed-2 |
| markdown-it-py | 后端 MD→JSON | 05-AI-Summary §8 |

---

## 9. 关联文档

- [../Home/README.md](../Home/README.md) — Phase-Home（LLM / audit / cron 基础设施）
- [../Practice/README.md](../Practice/README.md) — Phase-Practice（NoteV2 schema 升级）
- [../Review/README.md](../Review/README.md) — Phase-Review（Cross-Tab Wiring）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md) — IA 决策 SSOT（§2.4 Tab 4）

---

## 10. 视觉原型参考

| view | 路由 | 原型文件 |
|---|---|---|
| Notes 主视图（v2 / v2.1） | `/notes` | [`.tmp_review/out/Tab4-Notes/Note v2.1.html`](../../../../.tmp_review/out/Tab4-Notes/Note%20v2.1.html) |
| NoteEditor（全屏脱壳，3 列：大纲 / 编辑器 / 元数据） | `/notes/:id` | [`.tmp_review/out/Tab4-Notes/NoteEditor v1.html`](../../../../.tmp_review/out/Tab4-Notes/NoteEditor%20v1.html) |
| NoteTagsManagement | `/notes/tags` | [`.tmp_review/out/Tab4-Notes/NoteTagsManagement v1.html`](../../../../.tmp_review/out/Tab4-Notes/NoteTagsManagement%20v1.html) |

原型对齐 N-D1（3 segment 结构）、N-D5（编辑器 toolbar），与本 Phase 03-Frontend-WU 落地 React 时直接消费。记账见 SIK-85。
