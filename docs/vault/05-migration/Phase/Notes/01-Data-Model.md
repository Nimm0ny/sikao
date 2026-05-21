# Phase-Notes · 01 · Data Model

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) · [Phase/Practice/02-Data-Model §2.4](../Practice/02-Data-Model.md#24-notev2扩展tab-4-schema-提前升级)
> **Convention**: Python type hints; SQLAlchemy 2.0 declarative；Alembic migration 字段顺序与本文件一致
> **重要**：所有 ORM class 追加到 `services/api/src/sikao_api/db/models_v2.py`（单文件约定，详见 Home A0 §2.1）

---

## 1. ER 总览

```
NoteV2 (扩展) ──────────────────────────────────────────────────────────────┐
│  + type (free|question_level|ai_cause_analysis|weekly_review|community_bookmark)
│  + visibility (private|public)
│  + body_json (JSONB, TipTap AST)
│  + body_text (纯文本提取, 供搜索)
│  + linked_question_id (FK questions_v2, nullable)
│  + word_count
│  + is_featured (P3 精选)
│  + reaction_count (冗余计数)
│  + comment_count (冗余计数)
│  + bookmark_count (冗余计数)
│  + deleted_at (soft delete)
│                                                                            │
│  1                                                                         │
│  │                                                                         │
│  ├──▶ NoteTagV2 (0..N)                                                    │
│  │     user_id, note_id, tag_name, is_system                              │
│  │                                                                         │
│  ├──▶ NoteImageV2 (0..N)                                                  │
│  │     note_id, file_path, file_size, mime_type                           │
│  │                                                                         │
│  ├──▶ NoteReactionV2 (0..N) ─── P2                                       │
│  │     user_id, note_id, type='like'                                      │
│  │                                                                         │
│  ├──▶ NoteCommentV2 (0..N) ─── P2                                        │
│  │     user_id, note_id, parent_comment_id, path, depth, body             │
│  │                                                                         │
│  └──▶ NoteBookmarkV2 (0..N) ─── P2                                       │
│        user_id, note_id                                                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

NoteLinkV2 (既有，保留兼容)
  note_id, link_kind, link_target_id
  → Phase-Notes 不再新增 link_kind，统一用 NoteV2.linked_question_id 替代
  → 远期清理：迁移 link_kind=question → linked_question_id 后 drop 表

QuestionFavoriteV2 (Practice 已建)
  → Notes tab 收藏夹 segment 直接消费
```

---

## 2. 枚举定义

### 2.1 NoteType

```python
class NoteType(StrEnum):
    """NoteV2.type — 笔记类型（00-Decisions §12 最终版）"""
    FREE = "free"                           # 用户自由创建（无关联题目）
    QUESTION_LEVEL = "question_level"       # 题级笔记（linked_question_id 非空）
    AI_CAUSE_ANALYSIS = "ai_cause_analysis" # AI 错因分析保存（from Review Cross-4）
    WEEKLY_REVIEW = "weekly_review"         # 周回顾笔记（N-Weekly）
    COMMUNITY_BOOKMARK = "community_bookmark"  # 收藏他人公开笔记的本地副本（P2）
```

### 2.2 NoteVisibility

```python
class NoteVisibility(StrEnum):
    """NoteV2.visibility — 可见性（N-Community-1 二档）"""
    PRIVATE = "private"   # 默认，仅自己可见
    PUBLIC = "public"     # 所有用户可见
```

### 2.3 NoteStatus（保持兼容 + 扩展）

```python
class NoteStatus(StrEnum):
    """NoteV2.status — 生命周期状态（补充决策 N-D9）
    
    与 deleted_at 软删除的边界：
    - status=archived: 用户主动归档，可恢复，不触发 30 天清理
    - deleted_at 非空: 用户删除，30 天后物理清理
    - 两者独立维度：归档的笔记不会被自动删除
    """
    ACTIVE = "active"       # 正常（默认）
    ARCHIVED = "archived"   # 用户归档（不删除，列表默认不展示，可通过"显示已归档"toggle 查看）
```

---

## 3. SQLAlchemy 模型

### 3.1 NoteV2（扩展既有表）

```python
class NoteV2(Base):
    __tablename__ = "notes_v2"
    __table_args__ = (
        Index("ix_notes_v2_user_updated", "user_id", "updated_at"),
        Index("ix_notes_v2_user_type", "user_id", "type"),
        Index("ix_notes_v2_user_visibility", "user_id", "visibility"),
        Index("ix_notes_v2_linked_question", "linked_question_id"),
        Index("ix_notes_v2_community_feed", "visibility", "created_at",
              postgresql_where="visibility='public' AND deleted_at IS NULL"),
    )

    # ─── 既有字段（保留）───
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # ⚠️ 已废弃字段（deprecated）：新笔记不再写入 body，仅保留兼容旧数据读取。
    # 新笔记写入 body_json（TipTap AST）+ body_text（提取的纯文本）。
    # 远期迁移：当所有旧笔记均已通过编辑器打开并保存（触发 body_json 填充）后，
    # 可考虑 ALTER COLUMN body SET DEFAULT '' + 停止读取。
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # ─── Phase-Practice 已加（linked_question_id + visibility）───
    linked_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions_v2.id", ondelete="SET NULL"), nullable=True, index=True
    )
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="private")

    # ─── Phase-Notes 新增字段 ★ ───
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    body_json: Mapped[dict | None] = mapped_column(JSONB_COMPAT, nullable=True)
    # TipTap JSON AST；body 字段保留为纯文本兜底（兼容旧数据 + Meilisearch 索引源）
    body_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 从 body_json 提取的纯文本，写入时同步生成，供 Meilisearch 索引

    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # BLAKE2b(body_json 序列化)，用于 AI 摘要缓存键

    # 社区笔记冗余计数（P1 预建列，P2 实际填充）
    reaction_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bookmark_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 软删除
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ─── 关系 ───
    tags: Mapped[list["NoteTagV2"]] = relationship(back_populates="note", cascade="all, delete-orphan")
    images: Mapped[list["NoteImageV2"]] = relationship(back_populates="note", cascade="all, delete-orphan")
```

**body_json 结构（TipTap ProseMirror JSON）**：

```json
{
  "type": "doc",
  "content": [
    {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "排列组合公式"}]},
    {"type": "paragraph", "content": [{"type": "text", "text": "捆绑法适用于..."}]},
    {"type": "image", "attrs": {"src": "/uploads/notes/abc123.png", "alt": "公式图"}}
  ]
}
```

**Alembic 数据回填**：
```python
# 现有 body (纯文本) 迁移：body_text = body, body_json = null（保持兼容）
# type 回填：linked_question_id 非空 → "question_level"，否则 → "free"
# word_count 回填：len(body)（中文按字符计）
```

---

### 3.2 NoteTagV2（新建）

```python
class NoteTagV2(Base):
    __tablename__ = "note_tags_v2"
    __table_args__ = (
        UniqueConstraint("note_id", "tag_name", name="uq_note_tag_per_note"),
        Index("ix_note_tags_v2_user_tag", "user_id", "tag_name"),
        Index("ix_note_tags_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False)
    tag_name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # ─── 关系 ───
    note: Mapped["NoteV2"] = relationship(back_populates="tags")
```

**业务规则**：
- 每条笔记最多 10 个标签（N-Tag-4，写入层校验）
- `is_system=true` 的标签不可被用户删除（仅系统附加/移除）
- `tag_name` 存储标准化：去除首尾空格 + 统一为小写（自定义标签不含 `#` 前缀，UI 加前缀）

---

### 3.3 NoteImageV2（新建）

```python
class NoteImageV2(Base):
    __tablename__ = "note_images_v2"
    __table_args__ = (
        Index("ix_note_images_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    mime_type: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    # ─── 关系 ───
    note: Mapped["NoteV2"] = relationship(back_populates="images")
```

**上传约束**（写入层）：
- 单张图片 ≤ 5MB
- 支持格式：image/png, image/jpeg, image/gif, image/webp
- 每条笔记最多 20 张图
- Stage 1 存储路径：`/uploads/notes/{user_id}/{uuid}.{ext}`

---

### 3.4 NoteReactionV2（新建，P2）

```python
class NoteReactionV2(Base):
    """社区笔记点赞（P2 实施）"""
    __tablename__ = "note_reactions_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "note_id", "type", name="uq_note_reaction"),
        Index("ix_note_reactions_v2_note", "note_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="like")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
```

---

### 3.5 NoteCommentV2（新建，P2）

```python
class NoteCommentV2(Base):
    """社区笔记评论（P2 实施，树状最大 3 层）"""
    __tablename__ = "note_comments_v2"
    __table_args__ = (
        Index("ix_note_comments_v2_note_created", "note_id", "created_at"),
        Index("ix_note_comments_v2_path", "note_id", "path"),
        CheckConstraint("depth BETWEEN 1 AND 3", name="ck_comment_depth"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False)
    parent_comment_id: Mapped[int | None] = mapped_column(
        ForeignKey("note_comments_v2.id", ondelete="CASCADE"), nullable=True
    )
    path: Mapped[str] = mapped_column(String(128), nullable=False)
    # 物化路径，格式 "root_id.parent_id.self_id"，查询用 LIKE 'prefix%'
    depth: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # 1=顶层, 2=回复, 3=回复的回复（最大值）

    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

---

### 3.6 NoteBookmarkV2（新建，P2）

```python
class NoteBookmarkV2(Base):
    """收藏他人公开笔记（P2 实施）"""
    __tablename__ = "note_bookmarks_v2"
    __table_args__ = (
        UniqueConstraint("user_id", "note_id", name="uq_note_bookmark"),
        Index("ix_note_bookmarks_v2_user", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users_v2.id", ondelete="CASCADE"), nullable=False)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes_v2.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
```

---

## 4. 索引策略

| 表 | 索引 | 用途 |
|---|---|---|
| notes_v2 | (user_id, updated_at) | 默认列表按最近修改排序 |
| notes_v2 | (user_id, type) | 按类型筛选 |
| notes_v2 | (user_id, visibility) | 区分私有/公开 |
| notes_v2 | (linked_question_id) | 题目中枢页查询关联笔记 |
| notes_v2 | partial (visibility, created_at) WHERE public AND not deleted | 社区 feed |
| note_tags_v2 | UNIQUE(note_id, tag_name) | 防重复标签 |
| note_tags_v2 | (user_id, tag_name) | 标签自动补全 + 标签云 |
| note_images_v2 | (note_id) | 笔记图片列表 |
| note_reactions_v2 | UNIQUE(user_id, note_id, type) | 防重复点赞 |
| note_comments_v2 | (note_id, created_at) | 评论列表 |
| note_comments_v2 | (note_id, path) | 树状子评论查询 |
| note_bookmarks_v2 | UNIQUE(user_id, note_id) | 防重复收藏 |

---

## 5. 软删除策略

| 表 | 软删除？ | 物理清理 |
|---|---|---|
| notes_v2 | ✅ deleted_at | 30 天后 cron 物理 delete（保 audit_log_v2） |
| note_tags_v2 | ❌ | 随笔记 CASCADE |
| note_images_v2 | ❌ | 随笔记 CASCADE；物理文件同步清理 |
| note_comments_v2 | ✅ deleted_at | 不物理清（保留 path 完整性） |
| note_reactions_v2 | ❌ | 物理 delete（取消点赞） |
| note_bookmarks_v2 | ❌ | 物理 delete（取消收藏） |

---

## 6. Meilisearch 文档结构

写入 NoteV2 后同步推送到 Meilisearch 的文档 shape：

```json
{
  "id": 42,
  "user_id": 1,
  "title": "排列组合·捆绑法 vs 插空法",
  "body_text": "捆绑法适用于相邻约束...",
  "type": "question_level",
  "visibility": "private",
  "has_linked_question": true,
  "linked_question_id": 62,
  "tags": ["数量关系", "解题技巧", "公式"],
  "word_count": 328,
  "created_at": 1716278400,
  "updated_at": 1716364800
}
```

纯文本提取规则（body_json → body_text）：
- 递归遍历 TipTap JSON AST
- 拼接所有 `type=text` 节点的 `.text` 字段
- 图片/代码块用 alt text / 代码内容替代
- heading 后加换行

`has_linked_question` 派生规则（sync 时计算）：
- `has_linked_question = (linked_question_id IS NOT NULL)` — 布尔字段在 Meilisearch 文档中由同步 handler 计算，NoteV2 表中无对应列

---

## 7. Pydantic Schema

### 7.1 笔记响应

```python
class NoteResponseV2(CamelModel):
    id: int
    title: str
    type: str
    visibility: str
    body_json: dict | None
    body_text: str
    word_count: int
    linked_question_id: int | None
    linked_question_brief: QuestionBriefV2 | None  # 嵌套简版
    tags: list[str]
    reaction_count: int
    comment_count: int
    bookmark_count: int
    is_featured: bool
    is_bookmarked: bool         # 当前用户是否已收藏
    is_reacted: bool            # 当前用户是否已点赞
    author_name: str | None     # 社区笔记展示作者昵称
    created_at: datetime
    updated_at: datetime

class NoteListItemV2(CamelModel):
    """列表用精简版"""
    id: int
    title: str
    type: str
    body_preview: str           # body_text 前 100 字
    word_count: int
    linked_question_id: int | None
    tags: list[str]
    reaction_count: int
    comment_count: int
    updated_at: datetime
```

### 7.2 创建/更新请求

```python
class NoteCreateV2(CamelModel):
    title: str                  # 1-255 字符
    body_json: dict             # TipTap JSON AST
    type: str = "free"
    visibility: str = "private"
    linked_question_id: int | None = None
    tags: list[str] = []        # 最多 10 个

class NoteUpdateV2(CamelModel):
    title: str | None = None
    body_json: dict | None = None
    visibility: str | None = None
    linked_question_id: int | None = None
    tags: list[str] | None = None
```

### 7.3 标签相关

```python
class TagWithCountV2(CamelModel):
    tag_name: str
    is_system: bool
    usage_count: int

class TagRenameV2(CamelModel):
    old_name: str
    new_name: str
```

### 7.4 评论相关（P2）

```python
class NoteCommentCreateV2(CamelModel):
    body: str                   # 1-1000 字符
    parent_comment_id: int | None = None

class NoteCommentResponseV2(CamelModel):
    id: int
    user_id: int
    author_name: str
    body: str
    depth: int
    parent_comment_id: int | None
    children: list["NoteCommentResponseV2"]  # 递归嵌套（最大 3 层）
    created_at: datetime
    is_deleted: bool            # deleted_at != null 时 body 显示"已删除"
```

---

## 8. Alembic 迁移顺序

```
序号          | 描述
──────────────┼──────────────────────────────────────────
0040_notes_extend_v2.py        | NoteV2 新增列 (type, body_json, body_text, word_count, content_hash,
                               |   reaction_count, comment_count, bookmark_count, is_featured, deleted_at)
                               | + 数据回填 (type from linked_question_id, body_text from body)
0041_notes_create_note_tags.py | 创建 note_tags_v2 表
0042_notes_create_note_images.py | 创建 note_images_v2 表
0043_notes_create_reactions.py | 创建 note_reactions_v2 表 (P2 预建)
0044_notes_create_comments.py  | 创建 note_comments_v2 表 (P2 预建)
0045_notes_create_bookmarks.py | 创建 note_bookmarks_v2 表 (P2 预建)
0046_notes_add_indexes.py      | 补充组合索引 + partial 索引
```

每个 migration 必须支持 `alembic upgrade head` + `alembic downgrade -1`。

---

## 9. 数据约束总览

| 类型 | 约束 |
|---|---|
| CheckConstraint | comment depth BETWEEN 1 AND 3 |
| 业务校验（写入层） | 每笔记 ≤ 10 标签；每笔记 ≤ 20 图片；单图 ≤ 5MB；公开笔记 body_text ≥ 50 字（N-Community-4） |
| FK on_delete | notes→users CASCADE；tags/images/reactions/comments/bookmarks→notes CASCADE；notes→questions SET NULL |
| 默认值 | type="free", visibility="private", status="active", counts=0 |
| 时区 | DB 列存 UTC datetime；API 层 ISO with offset |

---

## 10. 引用矩阵

| 本文档被引用 |
|---|
| [02-Backend-WU](./02-Backend-WU.md) 全部 CRUD / 搜索 / 标签 API |
| [03-Frontend-WU](./03-Frontend-WU.md) TypeScript 类型生成 |
| [04-Editor-Integration](./04-Editor-Integration.md) body_json 结构 |
| [05-AI-Summary](./05-AI-Summary.md) content_hash 缓存键 |
| [06-Testing](./06-Testing.md) 数据约束 invariant |
