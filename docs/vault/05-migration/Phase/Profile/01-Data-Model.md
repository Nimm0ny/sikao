# Phase-Profile · 01 · Data Model

> **Status**: DRAFT
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Convention**: Python type hints; SQLAlchemy 2.0 declarative; Alembic migration

---

## 1. 变更总览

Phase-Profile MVP 对数据模型的变更量极小：仅在现有表上新增 2 个字段 + 1 张新表（cron 清理 job）。

```
UserV2（已存在）
  + deleted_at (nullable DateTime)        ← 注销软删
  + deletion_reason (nullable String)     ← 注销原因

AccountDeletionJobV2（新表）
  id / user_id / requested_at / hard_delete_at / status / reason

ProfileInfoV2（已存在，无新增字段）
  · ai_adjust_enabled                     ← Settings GET/PUT 读写
  · dashboard_preferences                 ← Preferences GET/PUT 读写
```

---

## 2. UserV2 扩展

```python
# 追加到 UserV2 class body

deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
deletion_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
```

### 2.1 语义

| 字段 | 说明 |
|---|---|
| `deleted_at` | 非空 = 用户已发起注销；认证层应拒绝登录 |
| `deletion_reason` | 用户选择的注销原因（枚举值，见 §2.2） |

### 2.2 注销原因枚举

```python
class DeletionReason(str, Enum):
    NOT_USEFUL = "not_useful"          # 没什么用
    FOUND_ALTERNATIVE = "alternative"  # 用了别的产品
    PRIVACY_CONCERN = "privacy"        # 隐私顾虑
    TOO_EXPENSIVE = "too_expensive"    # 太贵了
    OTHER = "other"                    # 其他
```

### 2.3 索引

```python
# UserV2.__table_args__ 追加
Index("ix_users_v2_pending_deletion", "deleted_at",
      postgresql_where=text("deleted_at IS NOT NULL")),
```

用于 cron job 查找待硬删用户。

---

## 3. AccountDeletionJobV2（新表）

```python
class AccountDeletionJobV2(Base):
    __tablename__ = "account_deletion_jobs_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users_v2.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    requested_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
    hard_delete_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # hard_delete_at = requested_at + 7 days
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    # status ∈ {pending, completed, failed}
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_deletion_jobs_pending", "hard_delete_at",
              postgresql_where=text("status = 'pending'")),
    )
```

### 3.1 业务规则

| 规则 | 说明 |
|---|---|
| 宽限期 | 7 天（`hard_delete_at = requested_at + timedelta(days=7)`） |
| 不可恢复 | 宽限期内用户**不可自行恢复**（D-P8）；无撤销操作 |
| 登录阻断 | `deleted_at IS NOT NULL` → 认证层返回 403 + "账号已注销" |
| 硬删执行 | cron job 每日凌晨 02:00 扫 `hard_delete_at <= now() AND status = 'pending'`，执行级联删除 |
| 审计保留 | 硬删时脱敏后归档到 `AuditLogV2`（保留 `user_public_id` + 行为日志，删除 PII） |

### 3.2 硬删级联范围

```
DELETE CASCADE 覆盖（FK ondelete=CASCADE 自动）：
├── PasswordCredentialV2
├── EmailContactV2
├── PhoneContactV2
├── AuthSessionV2
├── ProfileInfoV2
├── ProfileGoalV2
├── PlanV2 → PlanEventV2
├── PlanAdjustmentV2
├── RecommendationV2 → RecommendationFeedbackV2
├── PracticeSessionV2
├── ReviewItemV2 / ReviewAttemptV2
├── NoteV2 / NoteLinkV2
└── AccountDeletionJobV2（自身也删）

保留（脱敏归档）：
├── AuditLogV2（actor 改为 "deleted_user:<public_id>"）
└── LlmCallV2（user_id 改为 null，保留调用统计）
```

---

## 4. Schema 新增（Pydantic）

### 4.1 Settings

```python
class ProfileSettingsResponseV2(CamelModel):
    ai_adjust_enabled: bool
    llm_enabled: bool  # 等同于 ai_adjust_enabled，语义别名，方便前端理解

class ProfileSettingsUpdateRequestV2(CamelModel):
    ai_adjust_enabled: bool
```

### 4.2 Preferences

```python
class ProfilePreferencesResponseV2(CamelModel):
    dashboard_preferences: dict[str, Any]
    # 结构见 Phase-Home 02-Data-Model §2.5

class ProfilePreferencesUpdateRequestV2(CamelModel):
    dashboard_preferences: dict[str, Any]
```

### 4.3 Account Deletion

```python
class AccountDeletionRequestV2(CamelModel):
    reason: DeletionReason = DeletionReason.OTHER
    confirmation: str = Field(min_length=1)
    # confirmation = 用户输入的确认文字（如"确认注销"），前端强制输入

class AccountDeletionResponseV2(CamelModel):
    message: str
    hard_delete_at: UtcDatetime
```

### 4.4 Bind Phone（Stub）

```python
class BindPhoneRequestV2(CamelModel):
    phone: str = Field(pattern=r"^1[3-9]\d{9}$")  # 中国大陆手机号
    verification_code: str = Field(min_length=4, max_length=6)

class BindPhoneResponseV2(CamelModel):
    phone_bound: bool
    masked_phone: str  # "138****1234"
```

---

## 5. 字段结构参考（dashboard_preferences）

已在 `ProfileInfoV2.dashboard_preferences` 落地（Phase-Home 02-Data-Model §2.5）：

```json
{
  "section_a_visible": true,
  "section_b_visible": true,
  "section_c_visible": true,
  "section_order": ["a", "b", "c"],
  "calendar_default_view": "today"
}
```

Phase-Profile MVP 仅做透传读写（GET/PUT），不做跨设备同步（Sync-3 待定）。

---

## 6. Migration 计划

| # | Migration | 内容 |
|---|---|---|
| M1 | `add_user_deletion_fields` | `users_v2` + `deleted_at` + `deletion_reason` + index |
| M2 | `create_account_deletion_jobs` | 新建 `account_deletion_jobs_v2` 表 |

两个 migration 可合并为一个 PR。不涉及现有表结构破坏性变更。

---

## 7. 关联文档

- [00-Decisions.md](./00-Decisions.md)（Del-1~4 注销决策）
- [../Home/02-Data-Model.md](../Home/02-Data-Model.md) §2.5（ProfileGoalV2 / ProfileInfoV2 已有字段）
- [02-Backend-WU.md](./02-Backend-WU.md)（endpoint 实现计划）
