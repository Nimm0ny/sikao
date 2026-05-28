# Phase · Notes（笔记 tab）

> **Status**: ACCEPTED · 详细规格完成
> **IA 位置**：Main App Layer · Tab 4
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-25

> **2026-05-28 runtime truth update**：当前全局壳已收口为 `4-tab + RailMe trigger/popover`。sidebar 自 `SIK-121 W5` 起冻结，后续只允许补 `Me` 内容。本文中的 `/notes*` 与 `/q/:id*` 记法仅保留为历史 Phase 设计与跨 Phase 决策追溯；当前运行时 route authority 以 `apps/web/src/router/index.tsx` 为准，其中 Note shell 入口是 `/note`，QuestionHub 入口是 `/question-hub`。

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
| Phase-Home 完工 | ⏳ | 依赖 LLM 模块 / audit / cron / AppShell 4-tab + RailMe trigger/popover |
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
| Notes ← Home | LLM 模块 / audit / cron / AppShell 4-tab + RailMe trigger/popover |
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
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md) — IA 历史决策档案（§2.4 Tab 4，非当前 router authority）

---

## 10. 视觉原型参考

| view | 路由 | 原型文件 |
|---|---|---|
| Notes 主视图（v2 / v2.1） | `/notes` | [`.tmp_review/out/Tab4-Notes/Note v2.1.html`](../../../../../.tmp_review/out/Tab4-Notes/Note%20v2.1.html) |
| NoteEditor（全屏脱壳，3 列：大纲 / 编辑器 / 元数据） | `/notes/:id` | [`.tmp_review/out/Tab4-Notes/NoteEditor v1.html`](../../../../../.tmp_review/out/Tab4-Notes/NoteEditor%20v1.html) |
| NoteTagsManagement | `/notes/tags` | [`.tmp_review/out/Tab4-Notes/NoteTagsManagement v1.html`](../../../../../.tmp_review/out/Tab4-Notes/NoteTagsManagement%20v1.html) |

原型对齐 N-D1（3 segment 结构）、N-D5（编辑器 toolbar），与本 Phase 03-Frontend-WU 落地 React 时直接消费。记账见 SIK-85。

---

## 11. Notes Phase 里程碑图

| Milestone | Focus |
|---|---|
| `M0` | Notes docs-only intake，SSOT 对齐与依赖闸门锁定 |
| `M1` | `WU-N1` Notes CRUD（含 NoteV2 schema 扩展 + body_extractor + content_hash） |
| `M2` | `WU-N2 + WU-N4 + WU-N7` Tags / Image Upload / Export 三个轻量模块打捆 |
| `M3` | `WU-N3` Meilisearch 集成（索引同步 + 搜索端点 + 启动初始化） |
| `M4` | `WU-N5 + WU-N6` LLM 驱动：周回顾生成 + AI 摘要拆复盘卡 |
| `M5` | `WU-N8` Community Notes P1（可见性切换 + 公开列表，只读） |
| `M6` | Backend e2e + OpenAPI 锁定 + audit / 孤儿图片 cron |
| `M7` | `WU-FN1 + WU-FN4` 路由 + Tab + TipTap 全屏脱壳编辑器 |
| `M8` | `WU-FN2 + WU-FN3` 笔记主视图 + 筛选系统 |
| `M9` | `WU-FN5 + WU-FN6` 标签 UI + Meilisearch 搜索 UI |
| `M10` | `WU-FN7 + WU-FN8 + WU-FN9 + WU-FN10` AI 摘要 / 周回顾 / 社区 / 跨 Tab wiring |
| `M11` | 前端 e2e + a11y + Chrome MCP 验收 |

后续任何 Notes issue 开工都必须引用这个 milestone map，而不是退回旧的 WU-only 拆法。

---

## 12. Define-First 清单

以下边界在进入实现前必须先有定义性文档 / schema / contract，不能边写边猜：

| Surface | Define-First artifact |
|---|---|
| `NoteV2` 字段扩展 | [01-Data-Model.md](./01-Data-Model.md) 的 `body_json / body_text / word_count / content_hash / type / visibility / linked_question_id / deleted_at / counters` |
| 5 张新表 | [01-Data-Model.md](./01-Data-Model.md) 的 `NoteTagV2 / NoteImageV2 / NoteReactionV2 / NoteCommentV2 / NoteBookmarkV2` |
| Pydantic schema | [01-Data-Model.md](./01-Data-Model.md) §7 请求 / 响应 shape |
| TipTap `body_json` 形态 | [04-Editor-Integration.md](./04-Editor-Integration.md) |
| Meilisearch index shape | [01-Data-Model.md](./01-Data-Model.md) §6 + [00-Decisions.md](./00-Decisions.md) §5 |
| AI 摘要 / 周回顾 prompt + parser | [05-AI-Summary.md](./05-AI-Summary.md) |
| WU 拆分与依赖 | [02-Backend-WU.md](./02-Backend-WU.md) + [03-Frontend-WU.md](./03-Frontend-WU.md) |

---

## 13. Historical Multica Child Matrix

> This table mirrors the Notes Phase execution ledger shape.
> **Historical only**：该表保留旧 Multica 账本映射，便于追溯历史 issue。自 2026-05-28 起，执行账本与 Evidence Block 回写以 `docs/engineering/notion-workflow.md` 为准，不再按本表驱动状态流转。

| Identifier | Milestone | Focus | Depends on | Status | Gate |
|---|---|---|---|---|---|
| `SIK-46` | `M0` | Notes docs-only intake 与 SSOT 锁定 | none | `done` | docs-only scoped validation + independent subagent review |
| `SIK-47` | `M1` | `WU-N1` Notes CRUD + NoteV2 schema 扩展 | `SIK-46`, Phase-Home `WU-B1` | `done` | backend schema + CRUD gate |
| `SIK-48` | `M2` | `WU-N2 + WU-N4 + WU-N7` Tags / Image Upload / Export | `SIK-47` | `done` | tags / upload / export gate |
| `SIK-49` | `M3` | `WU-N3` Meilisearch 集成 | `SIK-47` | `done` | search index + user isolation gate |
| `SIK-50` | `M4` | `WU-N5 + WU-N6` Weekly Review + AI Summary | `SIK-47`, Phase-Home `WU-B7 / WU-B8`, Phase-Review `WU-R2 / WU-R7` | `done` | LLM + quota + parser gate |
| `SIK-51` | `M5` | `WU-N8` Community Notes P1 | `SIK-47`, `SIK-49` | `done` | visibility + community feed gate |
| `SIK-52` | `M6` | Backend e2e + OpenAPI 锁定 + audit + cron 注册 | `SIK-48`, `SIK-49`, `SIK-50`, `SIK-51` | `backlog` | final backend gate |
| `SIK-53` | `M7` | `WU-FN1 + WU-FN4` Route + TipTap 全屏脱壳编辑器 | `SIK-52`, `FE-SSOT-v2` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-54` | `M8` | `WU-FN2 + WU-FN3` Notes 主视图 + 筛选系统 | `SIK-53` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-55` | `M9` | `WU-FN5 + WU-FN6` 标签 UI + Meilisearch 搜索 UI | `SIK-54` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-56` | `M10` | `WU-FN7 + WU-FN8 + WU-FN9 + WU-FN10` AI / Weekly / Community / Cross-Tab UI | `SIK-55` | `backlog` | frontend gate locked; must not enter `in_progress` |
| `SIK-57` | `M11` | Notes 前端 e2e + a11y + Chrome MCP 验收 | `SIK-56` | `backlog` | frontend gate locked; must not enter `in_progress` |

### 13.1 Frontend Visual SSOT Gate

- Gate key: `FE-SSOT-v2`
- Unlock condition:
  - `docs/vault/04-design/Design-System.md` v2 完稿并 ACCEPTED
  - `packages/design-system/src/tokens.css` 锁定为唯一 token SSOT
  - Notes 视图所需的 lint / visual / interaction 约束都已写清并可执行
- Before unlock:
  - `SIK-53` through `SIK-57` 保持 `backlog`
  - 任何 Notes 前端 issue 不得进入 `in_progress`
  - 允许 docs-only 对齐、原型比对、需求澄清；不允许前端实现 ledger movement

### 13.2 Cross-Phase Blocked Conditions

| Blocked item | Condition | Owner |
|---|---|---|
| `SIK-47` | Phase-Home `WU-B1` 未稳定，或 NoteV2 基础字段 contract 漂移 | Home |
| `SIK-49` | `SIK-47` 未完工，无法稳定消费 `body_text / content_hash` | Notes |
| `SIK-50` | Phase-Home `WU-B7 / WU-B8` 未稳定，或 Phase-Review `WU-R2 / WU-R7` 未稳定 | Home / Review |
| `SIK-51` | `SIK-49` 未完工，community feed 无法依赖搜索索引 | Notes |
| `SIK-52` | `SIK-48~51` 任一 contract 未稳定 | Notes |
| `SIK-53` through `SIK-57` | `FE-SSOT-v2` 仍锁定 | Design System / Frontend governance |
| any implementation Notes child issue | `SIK-46` SSOT intake 未关闭 | Notes |

---

## 14. Completion Gate

### 14.1 M0 Docs-only

- markdown 链接 / 引用矩阵自查通过
- Notes README / 子文档 / Multica 账本语义一致
- 独立 subagent review 通过并落档

### 14.2 Backend M6

- pytest 全绿（含 Notes CRUD / tags / search / images / weekly / AI / community / audit / cron）
- alembic upgrade head 干净
- OpenAPI drift 0 diff
- Mock LLM provider 跑通 weekly review + ai summary
- 真 provider 手动联调至少覆盖 `weekly-review` 或 `ai-summary`

### 14.3 Frontend M11

- vitest / e2e / a11y 全绿
- typecheck strict 0 errors
- Chrome MCP 主链路验收通过
- `SIK-53` through `SIK-57` 全部 done 后才允许关闭 Notes 前端阶段
