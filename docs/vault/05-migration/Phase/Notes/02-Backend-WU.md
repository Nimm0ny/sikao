# Phase-Notes · 02 · Backend Work Units

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) · [01-Data-Model](./01-Data-Model.md)
> **Convention**: 每个 WU 对应一组 PR；PR 按 AGENTS-H9 ≤15 文件 / ≤400 行；每个 PR 必须含测试
> **数据引用**：请求/响应 shape 详见 [01-Data-Model §7](./01-Data-Model.md#7-pydantic-schema)

---

## 0. WU 总览

| # | WU | 描述 | 估算行数 | 依赖 |
|---|---|---|---|---|
| WU-N1 | Notes CRUD | POST/GET/PUT/DELETE /api/v2/notes | ~380 | Phase-Home B1 完工 |
| WU-N2 | Tags CRUD | 标签管理（列表/增删/重命名/合并） | ~250 | WU-N1 |
| WU-N3 | Meilisearch 集成 | 索引同步 + 搜索端点 | ~320 | WU-N1 |
| WU-N4 | Image Upload | 图片上传（本地文件系统） | ~200 | WU-N1 |
| WU-N5 | Weekly Review 生成 | LLM 周回顾笔记生成 | ~350 | WU-N1, Phase-Home B7 |
| WU-N6 | AI Summary → Review Cards | AI 摘要拆复盘卡 | ~300 | WU-N1, Phase-Home B7, Phase-Review R2 |
| WU-N7 | Note Export | Markdown/HTML 导出 | ~120 | WU-N1 |
| WU-N8 | Community Notes P1 | 可见性切换 + 公开列表 | ~280 | WU-N1, WU-N3 |
| **合计** | | | **~2,200** | |

---


## 1. 全局规范

### 1.1 路由分组

所有 V2 路由在 `services/api/src/sikao_api/main.py` 注册前缀 `/api/v2`。本 Phase 新增模块挂载点：

```python
# main.py（增量）
app.include_router(notes_router, prefix="/api/v2")
```

### 1.2 鉴权与授权

所有端点 `Depends(get_current_user)` 注入；返回 401 / 403 走全局错误处理。

**资源所属校验**：每个 mutation / read-by-id 端点必须在 service 层调 `assert_owner(user_id, resource)`，违反返回 `404 Not Found`（不是 403，避免泄漏存在性）。

### 1.3 错误码枚举

复用 `services/api/src/sikao_api/core/errors.py` 已有约定，本 Phase 新增：

| code | http | 用途 |
|---|---|---|
| `NOTE_NOT_FOUND` | 404 | 笔记不存在或越权 |
| `TAG_LIMIT_EXCEEDED` | 422 | 每笔记 ≤10 标签 |
| `IMAGE_LIMIT_EXCEEDED` | 422 | 每笔记 ≤20 图片 |
| `IMAGE_TOO_LARGE` | 422 | 单图 >5MB |
| `IMAGE_INVALID_TYPE` | 422 | 不支持的 MIME 类型 |
| `CONTENT_TOO_SHORT` | 422 | 公开笔记 body_text <50 字 |
| `WEEKLY_REVIEW_RATE_LIMITED` | 429 | 周回顾 >2次/周/用户 |
| `LLM_QUOTA_EXCEEDED` | 429 | 日 LLM 配额耗尽 |
| `SEARCH_UNAVAILABLE` | 503 | Meilisearch 不可达 |

### 1.4 模块布局

```
services/api/src/sikao_api/modules/notes/
  __init__.py
  domain/
    __init__.py
    entities.py              # Pydantic domain models
    body_extractor.py        # body_json → body_text 纯文本提取
    tiptap_converter.py      # body_json → Markdown / HTML
    content_hash.py          # BLAKE2b(body_json) 计算
  application/
    __init__.py
    note_service.py          # Notes CRUD
    tag_service.py           # Tags CRUD
    search_service.py        # Meilisearch 集成
    image_service.py         # 图片上传
    weekly_review_service.py # 周回顾生成
    ai_summary_service.py    # AI 摘要拆卡
    export_service.py        # 导出
    community_service.py     # 社区笔记 P1
  infrastructure/
    __init__.py
    repos.py                 # SQLAlchemy 仓储
    meilisearch_client.py    # Meilisearch 连接封装
  interface/
    __init__.py
    routes_notes.py          # Notes CRUD 路由
    routes_tags.py           # Tags 路由
    routes_search.py         # 搜索路由
    routes_images.py         # 图片上传路由
    routes_weekly.py         # 周回顾路由
    routes_ai_summary.py     # AI 摘要路由
    routes_export.py         # 导出路由
    routes_community.py      # 社区笔记路由
```

### 1.5 OpenAPI Tag 约定

| tag | 端点前缀 |
|---|---|
| notes | /notes, /notes/:id |
| notes-tags | /notes/tags |
| notes-search | /notes/search |
| notes-images | /notes/images |
| notes-weekly | /notes/weekly-review |
| notes-ai | /notes/:id/ai-summary |
| notes-export | /notes/:id/export |
| notes-community | /notes/community |

---


## 2. WU-N1 · Notes CRUD

**描述**：笔记的创建、列表、详情、更新、软删除。核心 CRUD 模块，所有其他 WU 的基础。

### 2.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| create_note | POST | `/api/v2/notes` | 创建笔记 |
| list_notes | GET | `/api/v2/notes` | 列表（分页+筛选+排序） |
| get_note | GET | `/api/v2/notes/{note_id}` | 单条详情 |
| update_note | PUT | `/api/v2/notes/{note_id}` | 部分更新 |
| delete_note | DELETE | `/api/v2/notes/{note_id}` | 软删除 |

### 2.2 请求/响应

- **创建请求**：`NoteCreateV2`（见 01-Data-Model §7.2）
- **更新请求**：`NoteUpdateV2`（见 01-Data-Model §7.2）
- **详情响应**：`NoteResponseV2`（见 01-Data-Model §7.1）
- **列表响应**：`PaginatedResponse[NoteListItemV2]`（见 01-Data-Model §7.1）

### 2.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N1-1 | `body_json` 写入时同步提取 `body_text`（调 `body_extractor.extract_text(body_json)`） |
| BR-N1-2 | `word_count` 写入时自动计算（中文按字符计，英文按空格分词） |
| BR-N1-3 | `content_hash` 写入时自动计算（BLAKE2b of JSON-serialized body_json） |
| BR-N1-4 | `type` 推导：若 `linked_question_id` 非空且 type 未显式传入，默认 `question_level` |
| BR-N1-5 | 创建时 `tags` 字段非空则同步写入 NoteTagV2（≤10 校验） |
| BR-N1-6 | 更新时 `body_json` 变化需重算 body_text / word_count / content_hash |
| BR-N1-7 | 软删除：设 `deleted_at=now()`；列表默认过滤 `deleted_at IS NULL` |
| BR-N1-8 | `linked_question_id` 校验：若非空，必须 EXISTS questions_v2 中，否则 422 |

### 2.4 列表筛选参数

```
GET /api/v2/notes?
  page=1&size=20                           # 分页（默认 page=1, size=20, max size=50）
  &type=free|question_level|...            # 按类型筛选（多选逗号分隔）
  &visibility=private|public               # 按可见性
  &linked_question_id=62                   # 按关联题目
  &tags=数量关系,公式                       # 按标签（AND 逻辑）
  &has_linked_question=true|false          # 有/无关联题目
  &sort=updated_at|created_at|title        # 排序字段（默认 updated_at）
  &order=desc|asc                          # 排序方向（默认 desc）
```

### 2.5 错误场景

| 场景 | HTTP | code |
|---|---|---|
| title 为空或 >255 字符 | 422 | VALIDATION_FAILED |
| body_json 非合法 TipTap AST | 422 | VALIDATION_FAILED |
| linked_question_id 不存在 | 422 | VALIDATION_FAILED |
| tags 数量 >10 | 422 | TAG_LIMIT_EXCEEDED |
| note_id 不存在或非当前用户 | 404 | NOTE_NOT_FOUND |
| 已软删笔记再删 | 404 | NOTE_NOT_FOUND |

### 2.6 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/domain/entities.py` | NoteCreate / NoteUpdate / NoteResponse schema |
| `modules/notes/domain/body_extractor.py` | TipTap JSON AST → 纯文本提取 |
| `modules/notes/domain/content_hash.py` | BLAKE2b 计算 |
| `modules/notes/application/note_service.py` | CRUD 业务逻辑 |
| `modules/notes/infrastructure/repos.py` | NoteRepo（list/get/create/update/soft_delete） |
| `modules/notes/interface/routes_notes.py` | 5 个端点路由 |
| `db/schemas_v2.py` | 增量 schema 定义 |
| `tests/modules/notes/test_note_crud.py` | 覆盖全部场景 |

**预计行数**：~380

**依赖**：Phase-Home WU-B1 完工（models_v2.py NoteV2 已有基础字段）

**测试要求**：
- CRUD 全路径覆盖（创建→列表可见→详情→更新→删除→列表不可见）
- body_text 提取正确性（含 heading / paragraph / image alt）
- 筛选 + 排序 + 分页组合
- 用户隔离（A 用户看不到 B 用户笔记）
- soft delete 后 GET 返回 404

---


## 3. WU-N2 · Tags CRUD

**描述**：用户标签管理——列表（含使用计数）、为笔记添加/移除标签、重命名标签、合并标签。

### 3.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| list_tags | GET | `/api/v2/notes/tags` | 当前用户所有标签 + 使用计数 |
| add_tag | POST | `/api/v2/notes/{note_id}/tags` | 为笔记添加标签 |
| remove_tag | DELETE | `/api/v2/notes/{note_id}/tags/{tag_name}` | 移除笔记标签 |
| rename_tag | PATCH | `/api/v2/notes/tags/rename` | 重命名标签（影响所有关联笔记） |
| merge_tags | POST | `/api/v2/notes/tags/merge` | 合并标签（source → target） |

### 3.2 请求/响应

- **列表响应**：`list[TagWithCountV2]`（见 01-Data-Model §7.3）
- **添加请求**：`{ "tag_name": "string" }`
- **重命名请求**：`TagRenameV2`（见 01-Data-Model §7.3）
- **合并请求**：`{ "source_tags": ["tag1", "tag2"], "target_tag": "string" }`

### 3.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N2-1 | `tag_name` 标准化：strip + lowercase（N-Tag-2 决策） |
| BR-N2-2 | 每笔记最多 10 标签（N-Tag-4）；add_tag 超限返回 422 |
| BR-N2-3 | `is_system=true` 标签不可被用户删除/重命名/合并（来源类标签） |
| BR-N2-4 | 重命名：UPDATE note_tags_v2 SET tag_name=new WHERE user_id=current AND tag_name=old |
| BR-N2-5 | 合并：将 source_tags 所有行 UPDATE tag_name=target_tag；如 (note_id, target_tag) 已存在则 DELETE source 行（防重复） |
| BR-N2-6 | list_tags 按 usage_count DESC 排序（标签云用） |
| BR-N2-7 | add_tag 时若 (note_id, tag_name) 已存在，幂等返回 200（不报错） |

### 3.4 错误场景

| 场景 | HTTP | code |
|---|---|---|
| 添加标签超 10 个限制 | 422 | TAG_LIMIT_EXCEEDED |
| 操作 is_system=true 标签 | 403 | FORBIDDEN |
| tag_name 为空或 >64 字符 | 422 | VALIDATION_FAILED |
| 重命名 new_name 已存在（同用户） | 409 | CONFLICT |
| note_id 不存在或非当前用户 | 404 | NOTE_NOT_FOUND |

### 3.5 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/application/tag_service.py` | 标签 CRUD 业务逻辑 |
| `modules/notes/infrastructure/repos.py` | TagRepo 增量（list/add/remove/rename/merge） |
| `modules/notes/interface/routes_tags.py` | 5 个端点路由 |
| `db/schemas_v2.py` | TagRenameV2 / TagMergeV2 增量 |
| `tests/modules/notes/test_tag_crud.py` | 覆盖全部场景 |

**预计行数**：~250

**依赖**：WU-N1（NoteV2 + NoteTagV2 表就位）

**测试要求**：
- 标签 CRUD 全路径
- 重命名传播正确性（所有关联笔记标签名均更新）
- 合并去重逻辑（合并后无重复 tag per note）
- is_system 标签保护
- 标签计数准确性

---


## 4. WU-N3 · Meilisearch 集成

**描述**：笔记写入时同步推送 Meilisearch 索引；提供 faceted 搜索端点；首次部署索引初始化。

### 4.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| search_notes | GET | `/api/v2/notes/search` | 全文搜索 + facets |

### 4.2 请求/响应

**搜索请求**：
```
GET /api/v2/notes/search?
  q=排列组合                              # 搜索关键词（必填）
  &filters=type:free,visibility:private   # 筛选条件
  &facets=type,tags                       # 请求 facet 维度
  &sort=updated_at:desc                   # 排序
  &page=1&size=20                         # 分页
```

**搜索响应**：
```json
{
  "hits": [NoteListItemV2...],
  "total_hits": 42,
  "facet_distribution": {
    "type": {"free": 20, "question_level": 15, "weekly_review": 7},
    "tags": {"数量关系": 12, "公式": 8, "易错点": 5}
  },
  "processing_time_ms": 12
}
```

### 4.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N3-1 | 索引同步触发点：note create / update / soft-delete（N-Search-6） |
| BR-N3-2 | create/update → addDocuments；soft-delete → deleteDocument |
| BR-N3-3 | 索引文档 shape 见 01-Data-Model §6（含 user_id / title / body_text / tags / type / visibility） |
| BR-N3-4 | 搜索端点自动注入 `filter: user_id = {current_user.id}`（用户隔离，N-Search-9） |
| BR-N3-5 | Meilisearch 不可达时：搜索端点返回 503 SEARCH_UNAVAILABLE；写入端点静默失败 + 写 audit_log（不阻塞笔记保存） |
| BR-N3-6 | 首次部署：startup 事件检查 index 是否存在，不存在则 createIndex + updateSettings（N-Search §5.1） |
| BR-N3-7 | 索引配置：searchableAttributes / filterableAttributes / sortableAttributes / faceting 见 00-Decisions §5.1 |

### 4.4 索引初始化

```python
async def init_meilisearch_index():
    """应用启动时调用，幂等创建/更新 notes 索引配置"""
    index = client.index("notes")
    await index.update_settings({
        "searchableAttributes": ["title", "body_text", "tags"],
        "filterableAttributes": ["user_id", "type", "has_linked_question", "visibility", "tags", "created_at"],
        "sortableAttributes": ["created_at", "updated_at"],
        "faceting": {"maxValuesPerFacet": 100},
        "typoTolerance": {"enabled": True, "minWordSizeForTypos": {"oneTypo": 3, "twoTypos": 6}}
    })
```

### 4.5 错误场景

| 场景 | HTTP | code |
|---|---|---|
| q 参数为空 | 422 | VALIDATION_FAILED |
| Meilisearch 不可达 | 503 | SEARCH_UNAVAILABLE |
| 无效 filter 语法 | 422 | VALIDATION_FAILED |

### 4.6 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/infrastructure/meilisearch_client.py` | Meilisearch 连接 + index 管理封装 |
| `modules/notes/application/search_service.py` | 索引同步 + 搜索逻辑 |
| `modules/notes/application/note_service.py` | 增量：create/update/delete 后调 search_service.sync |
| `modules/notes/interface/routes_search.py` | 搜索端点路由 |
| `db/schemas_v2.py` | NoteSearchResponseV2 增量 |
| `core/config.py` | MEILI_URL / MEILI_MASTER_KEY 配置 |
| `tests/modules/notes/test_search.py` | 覆盖：索引同步 / 搜索 / facets / 用户隔离 / 降级 |

**预计行数**：~320

**依赖**：WU-N1（笔记 CRUD 就位后才有数据可索引）

**测试要求**：
- 创建笔记 → Meilisearch 可搜到
- 更新笔记 → 搜索结果同步更新
- 删除笔记 → 搜索结果移除
- facet_distribution 正确返回
- 用户隔离（A 搜不到 B 的笔记）
- Meilisearch 宕机 → 笔记保存不受影响 + 搜索返回 503

---


## 5. WU-N4 · Image Upload

**描述**：笔记图片上传至本地文件系统，返回 URL 供 TipTap 编辑器插入；含验证与孤儿清理。

### 5.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| upload_image | POST | `/api/v2/notes/images` | 上传图片（multipart/form-data） |

### 5.2 请求/响应

**请求**：
```
POST /api/v2/notes/images
Content-Type: multipart/form-data

file: <binary>
note_id: <int|null>   # 可选，关联笔记 ID（新建笔记时为空，保存时再关联）
```

**响应**：
```json
{
  "id": 1,
  "url": "/uploads/notes/42/a1b2c3d4.png",
  "file_name": "formula.png",
  "file_size": 234567,
  "mime_type": "image/png",
  "width": 800,
  "height": 600
}
```

### 5.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N4-1 | 存储路径：`/uploads/notes/{user_id}/{uuid}.{ext}`（N-Ed-5 Stage 1） |
| BR-N4-2 | 单张图片 ≤ 5MB（01-Data-Model §3.3） |
| BR-N4-3 | 允许 MIME 类型：image/png, image/jpeg, image/gif, image/webp |
| BR-N4-4 | 每条笔记最多 20 张图（01-Data-Model §3.3） |
| BR-N4-5 | `note_id` 为空时：创建 NoteImageV2 记录（note_id=NULL 或临时值），等笔记保存时关联 |
| BR-N4-6 | 孤儿清理：cron 每日 04:00 清理 created_at > 24h 且 note_id IS NULL 的图片记录 + 物理文件 |
| BR-N4-7 | UUID 文件名防止路径遍历攻击 |
| BR-N4-8 | 可选：读取图片元数据填充 width / height（Pillow） |

### 5.4 错误场景

| 场景 | HTTP | code |
|---|---|---|
| 文件大小 >5MB | 422 | IMAGE_TOO_LARGE |
| MIME 类型不在白名单 | 422 | IMAGE_INVALID_TYPE |
| 笔记已有 20 张图（note_id 非空时校验） | 422 | IMAGE_LIMIT_EXCEEDED |
| note_id 不存在或非当前用户 | 404 | NOTE_NOT_FOUND |

### 5.5 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/application/image_service.py` | 上传逻辑 + 校验 + 文件写入 |
| `modules/notes/interface/routes_images.py` | 上传端点路由 |
| `core/config.py` | UPLOAD_DIR 配置项 |
| `scheduler/jobs/orphan_image_cleanup.py` | 孤儿图片定时清理 |
| `tests/modules/notes/test_image_upload.py` | 覆盖全部场景 |

**预计行数**：~200

**依赖**：WU-N1（NoteImageV2 表 + NoteV2 关联）

**测试要求**：
- 上传成功 → 文件存在于磁盘 + DB 记录正确
- 5MB 限制校验
- MIME 类型校验（伪造 content-type 但实际不是图片）
- 20 张图上限
- 孤儿清理 cron 正确删除过期无关联图片

---


## 6. WU-N5 · Weekly Review 生成

**描述**：根据用户本周学习数据（ReviewItemV2 + PracticeSessionAnswerV2 + NoteV2），调用 LLM 生成周回顾笔记（TipTap JSON AST），SSE 流式返回，自动附加系统标签。

### 6.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| generate_weekly_review | POST | `/api/v2/notes/weekly-review/generate` | 生成周回顾笔记（SSE 流式） |

### 6.2 请求/响应

**请求**：
```json
{
  "week": "2026-W21",          // 可选，默认当前周
  "idempotency_key": "uuid"   // 必填
}
```

**响应**（SSE stream）：
```
event: chunk
data: {"text": "# 📊 第21周学习回顾..."}

event: chunk
data: {"text": "\n## 💪 本周成果\n..."}

event: done
data: {"note_id": 123, "title": "第21周学习回顾", "tags": ["周回顾", "第21周"]}
```

### 6.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N5-1 | 数据采集范围：本周一 00:00 ~ 当前时刻（UTC+8） |
| BR-N5-2 | 数据源：ReviewItemV2（本周入队/毕业/再做）+ PracticeSessionAnswerV2（本周答题）+ NoteV2（本周新增） |
| BR-N5-3 | LLM prompt：`cause_analysis_weekly`（继承 Phase-Home LLM 模块，N-Weekly-4） |
| BR-N5-4 | LLM 输出 Markdown → 调 `tiptap_converter.md_to_json()` 转 TipTap JSON AST |
| BR-N5-5 | 自动标签：`#周回顾` + `#第{N}周`（is_system=true，N-Weekly-6） |
| BR-N5-6 | 保存为 NoteV2(type=weekly_review, title="第{N}周学习回顾") |
| BR-N5-7 | 限流：每用户每周最多 2 次（N-Weekly-7），超限返回 429 |
| BR-N5-8 | 幂等：Idempotency-Key = `weekly_review_{user_id}_{year}_{week}_{attempt}`（N-Weekly-8） |
| BR-N5-9 | 无数据时：仍生成空模板（"本周暂无学习记录"），不报错 |

### 6.4 错误场景

| 场景 | HTTP | code |
|---|---|---|
| 缺少 idempotency_key | 422 | VALIDATION_FAILED |
| 本周已生成 2 次 | 429 | WEEKLY_REVIEW_RATE_LIMITED |
| LLM 服务不可达 | 503 | LLM_SERVICE_UNAVAILABLE |
| LLM 输出解析失败 | 502 | LLM_PARSE_FAILED |
| 幂等键命中缓存 | 200 | IDEMPOTENT_REPLAY（返回已有结果） |

### 6.5 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/application/weekly_review_service.py` | 数据采集 + LLM 调用 + 结果持久化 |
| `modules/notes/domain/tiptap_converter.py` | Markdown → TipTap JSON AST 转换 |
| `modules/notes/interface/routes_weekly.py` | SSE 流式端点 |
| `modules/llm/prompts/cause_analysis_weekly.py` | prompt 模板（若未在 Phase-Home 建立） |
| `tests/modules/notes/test_weekly_review.py` | 覆盖全部场景 |

**预计行数**：~350

**依赖**：
- WU-N1（NoteV2 CRUD 基础）
- Phase-Home WU-B7（LLM 框架 + SSE 支持）
- Phase-Review WU-R7（ReviewItemV2 周数据可查）

**测试要求**：
- 有数据 → 生成内容包含实际统计
- 无数据 → 生成空模板不报错
- 限流：第 3 次生成返回 429
- 幂等：相同 key 返回已有结果
- 自动标签正确附加
- NoteV2 记录 type=weekly_review 正确

---


## 7. WU-N6 · AI Summary → Review Cards

**描述**：从笔记中提取要点，调用 LLM 生成 1~3 张复盘卡片预览；用户确认后批量写入 ReviewItemV2(source_kind=note_card)。含缓存（content_hash）与共享日限额。

### 7.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| generate_summary | POST | `/api/v2/notes/{note_id}/ai-summary` | 生成 AI 摘要卡片预览 |
| confirm_summary | POST | `/api/v2/notes/{note_id}/ai-summary/confirm` | 确认并写入复盘队列 |

### 7.2 请求/响应

**生成请求**：无 body（从 note_id 读取内容）

**生成响应**：
```json
{
  "cards": [
    {"index": 0, "text": "排列组合中，捆绑法适用于相邻约束", "editable": true},
    {"index": 1, "text": "插空法适用于不相邻约束", "editable": true},
    {"index": 2, "text": "区分方法：看约束是相邻还是不相邻", "editable": true}
  ],
  "cached": false,
  "note_content_hash": "abc123..."
}
```

**确认请求**：
```json
{
  "cards": [
    {"index": 0, "text": "排列组合中，捆绑法适用于相邻约束"},
    {"index": 1, "text": "插空法适用于不相邻约束"}
  ]
}
```

**确认响应**：
```json
{
  "review_item_ids": [101, 102],
  "message": "已加入复盘队列"
}
```

### 7.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N6-1 | 输入：NoteV2.body_text（≤2000 字截断）+ linked_question 题面（如有，N-AI-2） |
| BR-N6-2 | LLM prompt：`note_summary_cards`（N-AI-2/3） |
| BR-N6-3 | 输出：1~3 张卡片，每张 ≤50 字（N-AI-3） |
| BR-N6-4 | 缓存键：(note_id, content_hash)；笔记未修改时复用上次结果（N-AI-7） |
| BR-N6-5 | 限流：共享 daily_llm_quota（20 次/天/用户，与 AI 错因/AI 出题同池，N-AI-6） |
| BR-N6-6 | confirm 写入：ReviewItemV2(source_kind=note_card, metadata_json={note_id, card_text})（N-AI-5） |
| BR-N6-7 | confirm 幂等：同一 note_id + content_hash 不重复写入（检查已有 review_items） |
| BR-N6-8 | 失败兜底：LLM 不可用时返回 503，不影响笔记正常使用（N-AI-8） |

### 7.4 错误场景

| 场景 | HTTP | code |
|---|---|---|
| note_id 不存在或非当前用户 | 404 | NOTE_NOT_FOUND |
| 笔记 body_text 为空 | 422 | VALIDATION_FAILED |
| 日 LLM 配额耗尽 | 429 | LLM_QUOTA_EXCEEDED |
| LLM 服务不可达 | 503 | LLM_SERVICE_UNAVAILABLE |
| LLM 输出解析失败 | 502 | LLM_PARSE_FAILED |
| confirm 时 cards 为空 | 422 | VALIDATION_FAILED |

### 7.5 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/application/ai_summary_service.py` | 缓存检查 → LLM 调用 → 结果解析 → 确认写入 |
| `modules/notes/interface/routes_ai_summary.py` | 2 个端点路由 |
| `modules/llm/prompts/note_summary_cards.py` | prompt 模板 |
| `modules/llm/parsers/note_summary_parser.py` | JSON 输出解析 |
| `db/schemas_v2.py` | AiSummaryResponseV2 / AiSummaryConfirmV2 增量 |
| `tests/modules/notes/test_ai_summary.py` | 覆盖全部场景 |

**预计行数**：~300

**依赖**：
- WU-N1（NoteV2 CRUD + content_hash）
- Phase-Home WU-B7（LLM 框架）
- Phase-Review WU-R2（ReviewItemV2 写入）

**测试要求**：
- 缓存命中 → 不调 LLM，返回缓存
- content_hash 变化 → 重新调 LLM
- confirm → ReviewItemV2 正确写入（source_kind=note_card）
- 日限额耗尽 → 429
- LLM 超时 → 503 + 审计日志
- confirm 幂等：重复确认不重复写入

---


## 8. WU-N7 · Note Export

**描述**：将笔记 body_json（TipTap AST）转换为 Markdown 或 HTML 格式导出，包含标题 + 标签作为 frontmatter/header。

### 8.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| export_note | GET | `/api/v2/notes/{note_id}/export` | 导出笔记（Markdown 或 HTML） |

### 8.2 请求/响应

**请求**：
```
GET /api/v2/notes/{note_id}/export?format=markdown|html
```

**Markdown 响应**（Content-Type: text/markdown）：
```markdown
---
title: 排列组合·捆绑法 vs 插空法
tags: [数量关系, 解题技巧, 公式]
created_at: 2026-05-21T10:00:00+08:00
---

## 排列组合公式

捆绑法适用于...
```

**HTML 响应**（Content-Type: text/html）：
```html
<!DOCTYPE html>
<html>
<head><title>排列组合·捆绑法 vs 插空法</title></head>
<body>
<header>
  <h1>排列组合·捆绑法 vs 插空法</h1>
  <p>标签：数量关系, 解题技巧, 公式</p>
</header>
<h2>排列组合公式</h2>
<p>捆绑法适用于...</p>
</body>
</html>
```

### 8.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N7-1 | format 参数必填，仅支持 `markdown` 或 `html` |
| BR-N7-2 | Markdown 导出：YAML frontmatter（title + tags + created_at）+ body 转 Markdown |
| BR-N7-3 | HTML 导出：完整 HTML 文档，header 含标题 + 标签 |
| BR-N7-4 | 图片引用保持相对路径（`/uploads/notes/...`） |
| BR-N7-5 | 响应 header 含 `Content-Disposition: attachment; filename="{title}.md"` |
| BR-N7-6 | body_json 为空时 fallback 到 body（纯文本字段，兼容旧数据） |

### 8.4 错误场景

| 场景 | HTTP | code |
|---|---|---|
| format 参数非法 | 422 | VALIDATION_FAILED |
| note_id 不存在或非当前用户 | 404 | NOTE_NOT_FOUND |

### 8.5 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/domain/tiptap_converter.py` | 增量：json_to_markdown / json_to_html |
| `modules/notes/application/export_service.py` | 导出逻辑（含 frontmatter 组装） |
| `modules/notes/interface/routes_export.py` | 导出端点路由 |
| `tests/modules/notes/test_export.py` | 覆盖 Markdown / HTML / 兼容旧数据 |

**预计行数**：~120

**依赖**：WU-N1（NoteV2 数据 + tiptap_converter 基础）

**测试要求**：
- Markdown 导出：frontmatter 正确 + body 转换完整
- HTML 导出：结构正确 + 标签呈现
- 图片节点正确转换（Markdown `![alt](url)` / HTML `<img>`)
- body_json 为空 → fallback 到 body 纯文本
- Content-Disposition header 正确

---


## 9. WU-N8 · Community Notes P1

**描述**：社区笔记第一期——可见性切换（private↔public）+ 公开笔记列表（只读浏览）+ 按题目筛选。

### 9.1 端点全集

| 端点 | 方法 | 路由 | 说明 |
|---|---|---|---|
| toggle_visibility | PATCH | `/api/v2/notes/{note_id}/visibility` | 切换可见性 |
| community_feed | GET | `/api/v2/notes/community` | 公开笔记列表 |

### 9.2 请求/响应

**切换可见性请求**：
```json
{
  "visibility": "public"   // "private" | "public"
}
```

**切换可见性响应**：
```json
{
  "id": 42,
  "visibility": "public",
  "updated_at": "2026-05-21T10:00:00+08:00"
}
```

**社区列表请求**：
```
GET /api/v2/notes/community?
  sort=latest|hottest|featured            # 排序模式（默认 latest）
  &linked_question_id=62                  # 按关联题目筛选（可选）
  &tags=数量关系                           # 按标签筛选（可选）
  &page=1&size=20                         # 分页
```

**社区列表响应**：
```json
{
  "items": [
    {
      "id": 42,
      "title": "排列组合·捆绑法 vs 插空法",
      "body_preview": "捆绑法适用于相邻约束...",
      "word_count": 328,
      "author_name": "用户昵称",
      "tags": ["数量关系", "解题技巧"],
      "linked_question_id": 62,
      "reaction_count": 15,
      "comment_count": 3,
      "is_featured": false,
      "created_at": "2026-05-21T10:00:00+08:00"
    }
  ],
  "total": 156,
  "page": 1,
  "size": 20
}
```

### 9.3 业务规则

| 规则 | 描述 |
|---|---|
| BR-N8-1 | 公开发布门槛：body_text ≥ 50 字（N-Community-4），否则 422 |
| BR-N8-2 | 切换为 private → 从社区列表消失（立即生效） |
| BR-N8-3 | 社区列表排序（N-Community §7.4）：latest=created_at DESC / hottest=reaction_count DESC, created_at DESC / featured=is_featured=true, reaction_count DESC |
| BR-N8-4 | 社区列表过滤条件：`visibility='public' AND deleted_at IS NULL`（使用 partial index） |
| BR-N8-5 | `linked_question_id` 筛选：用于题目中枢页"同学笔记"区域 |
| BR-N8-6 | 作者信息：从 users_v2 JOIN 取 nickname（仅展示昵称，不泄漏其他信息） |
| BR-N8-7 | P1 只读：不含点赞/评论/收藏互动（P2 实施） |

### 9.4 错误场景

| 场景 | HTTP | code |
|---|---|---|
| visibility 值非法 | 422 | VALIDATION_FAILED |
| 设为 public 但 body_text <50 字 | 422 | CONTENT_TOO_SHORT |
| note_id 不存在或非当前用户 | 404 | NOTE_NOT_FOUND |
| sort 值非法 | 422 | VALIDATION_FAILED |

### 9.5 文件改动

| 文件 | 变更 |
|---|---|
| `modules/notes/application/community_service.py` | 可见性切换 + 社区列表逻辑 |
| `modules/notes/infrastructure/repos.py` | 增量：community_feed 查询（含 partial index 利用） |
| `modules/notes/interface/routes_community.py` | 2 个端点路由 |
| `db/schemas_v2.py` | CommunityNoteListItemV2 / VisibilityUpdateV2 增量 |
| `tests/modules/notes/test_community.py` | 覆盖全部场景 |

**预计行数**：~280

**依赖**：
- WU-N1（NoteV2 CRUD + visibility 字段）
- WU-N3（Meilisearch 社区索引同步——公开笔记索引更新）

**测试要求**：
- 切换为 public → 社区列表可见
- 切换为 private → 社区列表不可见
- 50 字门槛校验
- 三种排序模式正确
- linked_question_id 筛选正确
- 用户 A 公开 → 用户 B 在社区列表可见
- 软删笔记不在社区列表

---


## 10. 依赖图

```
                          Phase-Home B1 (models_v2)
                          Phase-Home B7 (LLM 框架)
                          Phase-Review R2 (ReviewItemV2 CRUD)
                                │
                                ▼
WU-N1 (Notes CRUD) ────────────┬──────────────────────────────────────────┐
        │                      │                                          │
        ├─→ WU-N2 (Tags)      ├─→ WU-N4 (Images)                        │
        │                      │                                          │
        ├─→ WU-N3 (Search) ───┼─→ WU-N8 (Community P1)                  │
        │                      │                                          │
        ├─→ WU-N5 (Weekly Review) ──── requires Phase-Home B7            │
        │                      │                                          │
        ├─→ WU-N6 (AI Summary) ──── requires Phase-Home B7 + Review R2  │
        │                      │                                          │
        └─→ WU-N7 (Export)     │                                          │
                               │                                          │
                               └──────────────────────────────────────────┘
```

---

## 11. 跨 Phase 依赖明细

| 本 Phase WU | 外部依赖 | 说明 |
|---|---|---|
| WU-N1 | Phase-Home B1 | NoteV2 表已有基础字段；本 WU 执行 Alembic 新增字段迁移 |
| WU-N3 | - | Meilisearch 独立部署（N-Search §5.3） |
| WU-N5 | Phase-Home B7 | LLM 框架 + SSE + cause_analysis_weekly prompt |
| WU-N5 | Phase-Review R7 | ReviewItemV2 + PracticeSessionAnswerV2 周数据 |
| WU-N6 | Phase-Home B7 | LLM 框架 + note_summary_cards prompt |
| WU-N6 | Phase-Review R2 | ReviewItemV2 写入（source_kind=note_card） |
| WU-N8 | WU-N3 | 社区笔记公开后需同步 Meilisearch community_notes 索引 |

---

## 12. 端点总览（16 个）

```
# Notes CRUD (WU-N1)
POST   /api/v2/notes                                    创建笔记
GET    /api/v2/notes                                    列表（分页+筛选+排序）
GET    /api/v2/notes/{note_id}                          详情
PUT    /api/v2/notes/{note_id}                          部分更新
DELETE /api/v2/notes/{note_id}                          软删除

# Tags (WU-N2)
GET    /api/v2/notes/tags                               用户标签列表 + 使用计数
POST   /api/v2/notes/{note_id}/tags                     为笔记添加标签
DELETE /api/v2/notes/{note_id}/tags/{tag_name}          移除笔记标签
PATCH  /api/v2/notes/tags/rename                        重命名标签
POST   /api/v2/notes/tags/merge                         合并标签

# Search (WU-N3)
GET    /api/v2/notes/search                             全文搜索 + facets

# Images (WU-N4)
POST   /api/v2/notes/images                             上传图片

# Weekly Review (WU-N5)
POST   /api/v2/notes/weekly-review/generate             生成周回顾笔记（SSE）

# AI Summary (WU-N6)
POST   /api/v2/notes/{note_id}/ai-summary               生成 AI 摘要卡片预览
POST   /api/v2/notes/{note_id}/ai-summary/confirm       确认写入复盘队列

# Export (WU-N7)
GET    /api/v2/notes/{note_id}/export                   导出（Markdown/HTML）

# Community P1 (WU-N8)
PATCH  /api/v2/notes/{note_id}/visibility               切换可见性
GET    /api/v2/notes/community                          公开笔记列表
```

---

## 13. 引用矩阵

| 本文档被引用 |
|---|
| [README.md](./README.md) §6 依赖图 |
| [03-Frontend-WU](./03-Frontend-WU.md) 端点列表 + TypeScript 类型生成 |
| [04-Editor-Integration](./04-Editor-Integration.md) 图片上传 + body_json 格式 |
| [05-AI-Summary](./05-AI-Summary.md) WU-N5 / WU-N6 详细流程 |
| [06-Testing](./06-Testing.md) 后端测试清单 |
