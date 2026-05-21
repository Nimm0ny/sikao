# Phase · Notes（笔记 tab）

> **Status**: TBD（占位）
> **IA 位置**：Main App Layer · Tab 4
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

笔记 tab 是用户主动整理与沉淀的知识库。落地内容初步覆盖：

- 笔记 CRUD（富文本 + Markdown，含图片 / 公式）
- 标签 / 文件夹 / 全文搜索
- 与题目 / 错题 / 课程 / AI 推荐的关联（双向链接）
- AI 笔记摘要 / 自动卡片生成（输入笔记，输出复盘卡）
- 笔记导出（Markdown / PDF）

---

## 1. 启动前置

- ✅ [Phase/Home](../Home/README.md) 完工：依赖基础设施（audit / LLM / observability）
- ⏳ 富文本编辑器选型（TipTap / Lexical / Slate，待定）
- ⏳ 全文搜索方案（PostgreSQL FTS / 文件系统索引 / Meilisearch，按 Stage 选）

---

## 2. 关联 IA 决策

- D-Layer / D7 / D15 沿用
- 笔记不进推荐流的输入信号（避免污染 LLM context）

---

## 3. 预期文档结构

```
Phase/Notes/
├── README.md
├── 00-Decisions.md          编辑器 / 搜索 / 导出格式决策
├── 01-Data-Model.md         NoteV2 / NoteTagV2 / NoteLinkV2
├── 02-Backend-WU.md         CRUD / 搜索 / 关联 / 导出
├── 03-Frontend-WU.md        Notes tab 视图 + 编辑器 + 双向链接 UI
├── 04-Editor-Integration.md 编辑器接入与扩展
├── 05-AI-Summary.md         AI 摘要 / 卡片生成
└── 06-Testing.md
```

---

## 4. 待解的设计问题

- 富文本数据格式（HTML vs JSON AST vs Markdown，影响搜索与版本）
- 协作 / 分享（Stage 2 多用户）
- 图片存储（本地 / 对象存储，Stage 1 单机）

---

## 5. 关联文档

- [../Home/README.md](../Home/README.md)
- [../Review/README.md](../Review/README.md)
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)
