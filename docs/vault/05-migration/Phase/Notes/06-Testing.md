# Phase-Notes · 06 · Testing

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[02-Backend-WU](./02-Backend-WU.md) · [03-Frontend-WU](./03-Frontend-WU.md)
> **Convention**: 每个 WU 对应的 PR 必须含测试；CI 绿灯方可合并

---

## 1. 测试策略总览

```
            ╱╲
           ╱E2E╲         ← Playwright（~5%）关键用户链路
          ╱──────╲
         ╱Integr. ╲      ← API + DB + Meilisearch + Mock LLM（~20%）
        ╱──────────╲
       ╱  Unit Tests ╲   ← 纯函数 / domain / hooks（~75%）
      ╱──────────────╲
     ╱ Static Analysis╲  ← mypy / tsc strict / lint（门禁）
    ╱──────────────────╲
```

| 层级 | 覆盖率目标 |
|---|---|
| 后端核心模块 | ≥ 80% |
| 前端组件 + hooks | ≥ 70% |

---


## 2. 后端单元测试矩阵

文件位置：`services/api/tests/modules/notes/`

### 2.1 Notes CRUD（12 cases）

| # | 场景 | 断言 |
|---|---|---|
| U1 | create_note happy path | body_text / word_count / content_hash 自动计算 |
| U2 | create_note with tags | NoteTagV2 同步写入 ≤10 |
| U3 | create_note tags >10 | TAG_LIMIT_EXCEEDED |
| U4 | create_note linked_question_id 不存在 | VALIDATION_FAILED |
| U5 | list_notes 分页 | page/size 参数正确切割 |
| U6 | list_notes 多筛选组合 | type + tags + visibility 交集 |
| U7 | list_notes 用户隔离 | user_A 看不到 user_B 笔记 |
| U8 | get_note happy | 完整 NoteResponseV2 |
| U9 | get_note 越权 | NOTE_NOT_FOUND (404) |
| U10 | update_note body_json 变化 | body_text / word_count / content_hash 重算 |
| U11 | delete_note soft | deleted_at 设置 + 列表不可见 |
| U12 | delete_note 已删除 | NOTE_NOT_FOUND |

### 2.2 Tags CRUD（10 cases）

| # | 场景 | 断言 |
|---|---|---|
| T1 | list_tags | usage_count DESC 排序 |
| T2 | add_tag happy | NoteTagV2 行创建 |
| T3 | add_tag 幂等 | (note_id, tag_name) 已存在 → 200 |
| T4 | add_tag 超 10 | TAG_LIMIT_EXCEEDED |
| T5 | remove_tag happy | NoteTagV2 行删除 |
| T6 | rename_tag 传播 | 所有关联笔记标签名更新 |
| T7 | rename_tag new_name 已存在 | CONFLICT (409) |
| T8 | merge_tags 去重 | source→target + 重复行删除 |
| T9 | is_system 标签不可删除 | FORBIDDEN (403) |
| T10 | tag_name 标准化 | " ABC " → "abc" |

### 2.3 body_extractor（8 cases）

| # | 场景 | 断言 |
|---|---|---|
| BE1 | paragraph 节点 | 提取纯文本 |
| BE2 | heading (h1/h2/h3) | 提取标题文本 |
| BE3 | nested list (bullet+ordered) | 每项提取 + 换行分隔 |
| BE4 | blockquote | 引用内容提取 |
| BE5 | image alt text | alt 文本提取 |
| BE6 | 空 body_json (null) | 返回空字符串 |
| BE7 | inline marks (bold/italic) | 纯文本无格式标记 |
| BE8 | 超长 body (>10000 字) | 完整提取不截断 |


### 2.4 content_hash（4 cases）

| # | 场景 | 断言 |
|---|---|---|
| CH1 | 相同 body_json 多次计算 | hash 值相同（确定性） |
| CH2 | body_json 变一个字符 | hash 值不同 |
| CH3 | 空 body_json | 返回固定空哈希 |
| CH4 | JSON key 排序无关 | canonical JSON hash 一致 |

### 2.5 Meilisearch sync（6 cases）

| # | 场景 | 断言 |
|---|---|---|
| MS1 | create 触发 addDocuments | mock 收到正确 document |
| MS2 | update 触发 updateDocuments | document 字段已更新 |
| MS3 | delete 触发 deleteDocument | mock 收到 delete 调用 |
| MS4 | Meilisearch 不可达时 create | 笔记保存成功 + audit_log |
| MS5 | search 正常 | hits/total_hits/facets 结构正确 |
| MS6 | search 用户隔离 | filter 自动注入 user_id |

### 2.6 Image upload（6 cases）

| # | 场景 | 断言 |
|---|---|---|
| IM1 | upload happy path | 文件写入磁盘 + DB 记录 |
| IM2 | 文件 >5MB | IMAGE_TOO_LARGE (422) |
| IM3 | MIME 不在白名单 | IMAGE_INVALID_TYPE (422) |
| IM4 | 笔记已有 20 张图 | IMAGE_LIMIT_EXCEEDED (422) |
| IM5 | note_id 为空 | NoteImageV2 note_id=NULL |
| IM6 | 孤儿清理 cron | >24h + NULL → 记录+文件删除 |

### 2.7 Weekly review（6 cases）

| # | 场景 | 断言 |
|---|---|---|
| WR1 | 有数据生成 | type=weekly_review + 含统计 |
| WR2 | 无数据生成 | 空模板不报错 |
| WR3 | 自动标签 | #周回顾 + #第{N}周 附加 |
| WR4 | 限流第 3 次 | WEEKLY_REVIEW_RATE_LIMITED (429) |
| WR5 | 幂等 key 命中 | 返回已有结果 + 不调 LLM |
| WR6 | LLM 不可达 | LLM_SERVICE_UNAVAILABLE (503) |


### 2.8 AI summary（8 cases）

| # | 场景 | 断言 |
|---|---|---|
| AI1 | generate happy path | 1~3 卡片 + cached=false |
| AI2 | 缓存命中 (hash 未变) | cached=true + 不调 LLM |
| AI3 | content_hash 变化 | 重新调 LLM |
| AI4 | 日配额耗尽 | LLM_QUOTA_EXCEEDED (429) |
| AI5 | LLM 超时 | LLM_SERVICE_UNAVAILABLE (503) |
| AI6 | confirm happy | ReviewItemV2 source_kind=note_card |
| AI7 | confirm 幂等 | 同 hash 不重复写入 |
| AI8 | body_text 为空 | VALIDATION_FAILED (422) |

### 2.9 Export（4 cases）

| # | 场景 | 断言 |
|---|---|---|
| EX1 | Markdown 导出 | YAML frontmatter + body Markdown |
| EX2 | HTML 导出 | 完整 HTML + 标签呈现 |
| EX3 | body_json 为空 | fallback 到 body 纯文本 |
| EX4 | Content-Disposition | filename 含 title + 扩展名 |

### 2.10 Community（6 cases）

| # | 场景 | 断言 |
|---|---|---|
| CM1 | toggle → public | visibility 更新 + Meilisearch 同步 |
| CM2 | toggle public 但 <50 字 | CONTENT_TOO_SHORT (422) |
| CM3 | toggle → private | 社区列表立即不可见 |
| CM4 | feed 三种排序 | latest/hottest/featured 正确 |
| CM5 | feed 按题目筛选 | linked_question_id 过滤 |
| CM6 | 软删笔记 | 社区列表不出现 |

---


## 3. 后端集成测试

文件位置：`services/api/tests/integration/notes/`

### 3.1 Full CRUD Flow（SQLite test）

完整链路：创建 → 列表可见 → 详情 → 更新(body_text/hash 重算) → 软删 → 列表不可见 → GET 404。
环境：SQLite in-memory + `pytest-asyncio` + httpx AsyncClient。

### 3.2 Meilisearch Integration（requires running instance or mock）

- 索引初始化：startup → createIndex + updateSettings 幂等
- 创建 → search 找到；更新 → search 返回新值；软删 → search 不再返回
- facets 分布：type / tags facet 数量正确
- 环境：CI `docker-compose` 启动 Meilisearch

### 3.3 LLM Integration（Mock Provider）

- weekly_review：MockProvider → Markdown → TipTap JSON
- ai_summary：MockProvider → JSON → 1~3 cards
- 超时/非法输出 → 503/502 + audit_log
- CI 强制 `LLM_PROVIDER=mock`

### 3.4 Cross-module: Note → Review Item

AI 摘要确认 → ReviewItemV2 写入 `source_kind=note_card` + `metadata_json` 含 note_id。

---


## 4. 前端组件测试

文件位置：`apps/web/src/components/notes/__tests__/`

工具：vitest + @testing-library/react + MSW

### 4.1 NotesHome Segments

- renders 3 segment tabs (全部 / 我的笔记 / 收藏夹)
- switches segment → URL query 更新
- loading → skeleton; empty → EmptyState; error → ErrorCard

### 4.2 NoteCard

- renders title / body_preview / tags / updated_at
- body_preview 截断 100 字
- tags 最多显示 3 个 + overflow
- linked_question badge 条件渲染

### 4.3 FilterPanel

- filter state ↔ URL query 双向同步
- 刷新页面恢复筛选状态
- API params 随 filter 变化更新
- clear 按钮重置全部

### 4.4 TagInput

- autocomplete 下拉 (debounce 300ms)
- Enter 添加 tag chip
- × 删除 chip
- ≤10 标签限制 UI 提示
- autocomplete 按使用频次排序

### 4.5 TipTap Editor

- mounts with all P1 extensions (StarterKit/Image/Highlight/Placeholder)
- toolbar buttons 渲染 + 功能 (B/I/H1/H2/list/quote/img)
- auto-save 3s debounce 正常触发
- dirty state 离开提示
- image paste → upload → insert node

### 4.6 AI Summary Preview

- 渲染 1~3 checkable cards
- toggle card selection (check/uncheck)
- inline edit card text
- confirm → POST selected cards → toast

### 4.7 Weekly Banner

- 周一 + 未生成 → 显示 banner
- 已生成 / profile flag=false → 不显示
- "稍后" → sessionStorage 关闭
- "不再提醒" → PUT profile flag

---


## 5. E2E 测试场景（Playwright）

文件位置：`tests/e2e/notes/`

工具：Playwright（Chromium headless）

### 5.1 创建笔记完整流程

`/notes` → "新建" → 输入标题 + 正文 → auto-save 3s → 返回列表 → 卡片可见

### 5.2 搜索笔记

创建笔记(title:"排列组合捆绑法") → 搜索框输入 "捆绑法" → 300ms → 结果含该笔记 + 高亮

### 5.3 标签管理

创建笔记 + 添加标签 "数量关系" → 列表按标签筛选 → 仅该笔记可见 → /notes/tags 重命名 → 列表标签已更新

### 5.4 AI 摘要

创建笔记(≥50字) → "AI 总结" → loading → 1~3 卡片 → 勾选 2 张 → 确认 → toast → /review 可见

### 5.5 社区笔记

创建笔记(≥50字) → "设为公开" → community tab 可见 → "设为私有" + 确认 → community tab 消失

### 5.6 跨 Tab 导航

Notes 列表 → 点击题级 NoteCard → /q/:id?ctx=note&note_id=N → back → /notes 列表

---


## 6. 数据不变量（Invariants）

文件位置：`services/api/tests/invariants/test_notes_invariants.py`

每次 PR 必跑。

| # | 不变量 | 验证方式 |
|---|---|---|
| INV-1 | body_json 非空 → body_text 有值 | 创建后断言 `len(body_text) > 0` |
| INV-2 | word_count == compute(body_text) | 计算比对 |
| INV-3 | body_json 变 → content_hash 变 | 更新后断言 hash 不同 |
| INV-4 | 标签 ≤ 10/note | 第 11 个 → 422 |
| INV-5 | 图片 ≤ 20/note | 第 21 张 → 422 |
| INV-6 | 评论深度 ≤ 3 | depth=4 → 422 (P2 预留) |
| INV-7 | 公开笔记 body_text ≥ 50 字 | <50 toggle public → CONTENT_TOO_SHORT |

---


## 7. 性能测试

文件位置：`services/api/tests/perf/notes/`

不进 CI 必经；回归 >30% 产生警告。

| # | 场景 | 目标 |
|---|---|---|
| P1 | List endpoint (1000 notes, page=1) | < 200ms |
| P2 | Search endpoint (Meilisearch, 1000 docs) | < 50ms |
| P3 | TipTap editor mount (前端) | < 500ms |
| P4 | Auto-save PUT (无 UI 阻塞) | 主线程无 >50ms 长任务 |

---

## 8. CI 集成

### 8.1 Backend: pytest + coverage gate

- `ruff check` + `mypy` (notes module)
- `alembic upgrade head`
- `pytest tests/modules/notes/ + tests/integration/notes/ + tests/invariants/`
- `coverage --fail-under=80`
- Meilisearch: CI services block `getmeili/meilisearch:v1.7`, port 7700

### 8.2 Frontend: vitest + coverage gate

- `vitest --run` (notes components + domain hooks)
- `coverage --fail-under=70`

### 8.3 E2E: Playwright（nightly, not blocking PR）

- Schedule: `cron: "0 2 * * *"` + `workflow_dispatch`
- `playwright test tests/e2e/notes/ --reporter=html`
- Artifact: `playwright-report`

---


## 9. 引用矩阵

| 本文档引用 | 说明 |
|---|---|
| [02-Backend-WU](./02-Backend-WU.md) | 各 WU 测试要求 + 错误场景 |
| [03-Frontend-WU](./03-Frontend-WU.md) | 各 WU 验收标准 + 组件树 |
| [Phase-Home/10-Testing](../Home/10-Testing.md) | 格式参考 + CI 约定 |
| [Phase-Review/11-Testing](../Review/11-Testing.md) | 格式参考 + invariant 模式 |

| 本文档被引用 |
|---|
| [README.md](./README.md) §完工门槛 |
| [02-Backend-WU](./02-Backend-WU.md) §引用矩阵 |
| [03-Frontend-WU](./03-Frontend-WU.md) §引用矩阵 |
