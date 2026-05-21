# Phase-Practice · 14 · Practice Preferences

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`
> **Module**: `modules/practice_preferences/`（新建，详见 [03-Backend-WU §22](./03-Backend-WU.md#22-wu-b28-practice_preferences-模块新建)）
> **决策来源**：`00-Decisions.md` Pref-* 系列

---

## 1. 模块定位

### 1.1 为什么需要独立 preferences 表

V2 现有 `ProfileInfoV2.dashboard_preferences` JSON 字段已承载部分首页偏好（继承 Phase-Home D5）。但练习偏好不应混在一起：

- 字段量大（字号 / 主题 / 自动保存 / 快捷键 / 默认节奏 / 提醒 / etc.）
- 跨设备同步要求强（用户改了快捷键，期望所有端立即生效）
- 校验规则复杂（每个字段有取值范围）
- 默认值可能随产品迭代变化（独立表便于版本管理 + 灰度）

决策：**新建 `UserPracticePreferencesV2` 独立表**，不复用 `ProfileInfoV2.dashboard_preferences`。

### 1.2 职责边界

| 模块 | 包含 | 不包含 |
|---|---|---|
| **practice_preferences**（本模块） | 练习相关用户偏好的存储 / 默认值 / 校验 / 端点 / 跨设备同步 | 首页 dashboard 偏好（继续走 ProfileInfoV2.dashboard_preferences）/ 个人资料偏好（在 profile 模块）|

### 1.3 文件结构

```
services/api/src/sikao_api/modules/practice_preferences/
  __init__.py
  application/
    service.py                  # 主入口
    defaults.py                 # 默认值定义 + 版本号
    validators.py               # 字段范围校验
    upgrader.py                 # 历史版本升级（schema 演进）
  domain/
    types.py                    # PreferencesV1 / PreferencesV2 ...
    errors.py
  interface/
    routes.py
    schemas.py
```

---

## 2. 数据模型

详见 [02-Data-Model §3.9](./02-Data-Model.md#39-userpracticepreferencesv2)。

### 2.1 UserPracticePreferencesV2

```python
class UserPracticePreferencesV2(Base):
    __tablename__ = "user_practice_preferences_v2"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("user_v2.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # 主体内容（schema 见 §3）
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

    # 版本号（schema 演进用）
    schema_version: Mapped[int] = mapped_column(SmallInteger, default=1)

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())
```

为什么用单 `payload` JSON 而非展开成多列：
- 字段会随产品演进频繁加（典型偏好类数据）
- 不参与跨表 join / 索引检索
- 校验在 application 层用 Pydantic 完成
- 便于跨 schema_version 的 upgrade pipeline

---

## 3. payload Schema（v1）

### 3.1 完整字段定义

```python
class PracticePreferencesPayloadV1(CamelModel):
    """练习偏好 v1 schema。任何变更都必须 bump schema_version。"""

    # ===== 答题界面 =====
    ui: UiPreferences

    # ===== 答题节奏与默认值 =====
    pacing: PacingPreferences

    # ===== 自动保存与心跳 =====
    auto_save: AutoSavePreferences

    # ===== 快捷键 =====
    keyboard: KeyboardPreferences

    # ===== 提醒 =====
    reminders: ReminderPreferences

    # ===== 自定义刷题默认值（继承自 useSessionConfigStore） =====
    custom_practice: CustomPracticeDefaults


class UiPreferences(CamelModel):
    font_size: Literal["sm", "base", "lg", "xl"] = "base"
    # 答题区文字大小

    line_height: Literal["compact", "comfortable", "spacious"] = "comfortable"

    theme_preference: Literal["system", "light", "dark"] = "system"

    show_question_index: bool = True
    # 顶部"第 X 题 / 共 Y 题"

    show_timing_indicator: bool = True
    # 顶部本题已用时

    show_overtime_warning: bool = True
    # 超过 baseline p95 时变红

    answer_panel_position: Literal["right", "bottom"] = "right"
    # 答题区在题面右侧（桌面）/ 底部（移动）。auto = 由设备决定


class PacingPreferences(CamelModel):
    default_practice_mode: Literal["per_question", "full_set"] = "full_set"
    # 默认答题节奏（自定义 / 每日一练用）

    auto_advance_after_answer: bool = False
    # 逐题模式答完自动跳下一题

    auto_advance_delay_seconds: int = 1
    # 自动跳下一题前的延迟（让用户瞄一眼解析）

    confirm_before_submit: bool = True
    # 提交前弹窗确认

    confirm_when_unanswered_count_gte: int = 1
    # 有 N 题未答时强制确认（>=1 即只要有未答都确认）


class AutoSavePreferences(CamelModel):
    enabled: bool = True
    # 申论 / 长答题区自动保存草稿

    interval_seconds: int = 30
    # 自动保存间隔。范围 [10, 300]

    save_to_local_storage: bool = True
    # 本地浏览器 IndexedDB 备份（断网恢复）


class KeyboardPreferences(CamelModel):
    enabled: bool = True
    # 是否启用快捷键

    bindings: KeyBindings


class KeyBindings(CamelModel):
    select_a: str = "a"
    select_b: str = "b"
    select_c: str = "c"
    select_d: str = "d"
    next_question: str = "ArrowRight"
    prev_question: str = "ArrowLeft"
    flag_uncertain: str = "f"
    favorite: str = "s"
    note: str = "n"
    submit: str = "Ctrl+Enter"
    # 所有值必须符合 KeyboardEvent.key / 组合键 "Ctrl+X" / "Shift+X" / "Alt+X" 格式


class ReminderPreferences(CamelModel):
    daily_practice_reminder_enabled: bool = False
    daily_practice_reminder_time: str = "20:00"   # HH:MM 24-hour
    weekly_summary_reminder_enabled: bool = False

    overtime_threshold_seconds: int = 0
    # 单题用时超过 N 秒时提示用户（0 = 不提示）

    long_session_break_reminder_minutes: int = 0
    # 连续答题 N 分钟提醒休息（0 = 不提示）


class CustomPracticeDefaults(CamelModel):
    last_used_source_mode: Literal["real_exam", "ai_generated"] = "real_exam"
    last_used_year_range: Literal["all", "recent_3", "recent_5", "recent_10"] = "recent_3"
    last_used_difficulty_range: tuple[float, float] = (0.0, 1.0)
    last_used_count: Literal[5, 10, 15, 20, 30] = 10
    last_used_practice_mode: Literal["per_question", "full_set"] = "full_set"
    last_used_exclude_done: bool = True
    last_used_only_wrong: bool = False
```

### 3.2 默认值

`defaults.py` 提供单一函数：

```python
def build_default_preferences() -> PracticePreferencesPayloadV1:
    return PracticePreferencesPayloadV1(
        ui=UiPreferences(),
        pacing=PacingPreferences(),
        auto_save=AutoSavePreferences(),
        keyboard=KeyboardPreferences(bindings=KeyBindings()),
        reminders=ReminderPreferences(),
        custom_practice=CustomPracticeDefaults(),
    )
```

新用户首次访问 `GET /profile/practice-preferences` 时，如不存在则返回默认值（不立即写入 DB；用户首次 PUT 时才写）。

### 3.3 校验规则

`validators.py` 用 Pydantic + 自定义 validator：

```python
@validator("interval_seconds")
def validate_save_interval(cls, v: int) -> int:
    if not 10 <= v <= 300:
        raise ValueError("interval_seconds must be between 10 and 300")
    return v

@validator("daily_practice_reminder_time")
def validate_time_format(cls, v: str) -> str:
    if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", v):
        raise ValueError("Invalid HH:MM format")
    return v

@root_validator
def validate_keybindings_no_duplicates(cls, values):
    bindings = values.get("bindings")
    if bindings:
        unique_keys = set(bindings.dict().values())
        if len(unique_keys) != len(bindings.dict()):
            raise ValueError("KeyBindings must be unique across all actions")
    return values
```

非法字段返回 422 + 详细原因（哪个字段、哪个限制）。

---

## 4. 端点

### 4.1 读取

```
GET /api/v2/profile/practice-preferences
→ 200 {
    schemaVersion: 1,
    payload: PracticePreferencesPayloadV1,
    isDefault: bool,           // true 表示该用户从未保存过，返回的是 defaults
    updatedAt: ISO | null
  }

→ 401 Unauthorized
```

注意：即使 DB 无记录也返回 200 + isDefault=true，前端无需区分"未保存"和"使用默认值"。

### 4.2 全量更新

```
PUT /api/v2/profile/practice-preferences
body: { schemaVersion: 1, payload: {...} }

→ 200 { schemaVersion, payload, updatedAt }
→ 422 INVALID_PREFERENCE_FIELD { field, message }
→ 422 SCHEMA_VERSION_MISMATCH（客户端 schemaVersion 与服务端不一致）
→ 401 Unauthorized
```

⚠️ schema_version mismatch 的处理：客户端 cached 旧版本 schema，服务端已升到 v2 → 返回 422 + 完整最新 payload，前端清缓存重新拉取后再次提交。

### 4.3 局部更新（partial）

```
PATCH /api/v2/profile/practice-preferences
body: {
  schemaVersion: 1,
  patches: [
    { path: "ui.fontSize", value: "lg" },
    { path: "keyboard.bindings.flagUncertain", value: "g" }
  ]
}

→ 200 { schemaVersion, payload, updatedAt }
→ 422 INVALID_PATCH_PATH
→ 422 INVALID_PREFERENCE_FIELD
```

PATCH 内部实现 = 读 → merge → 全量校验 → 写。原子性保证。

### 4.4 重置默认

```
POST /api/v2/profile/practice-preferences/reset
body: { sections?: ("ui" | "pacing" | "auto_save" | "keyboard" | "reminders" | "custom_practice")[] }
# 不传 sections = 全部重置

→ 200 { schemaVersion, payload, updatedAt }
```

---

## 5. 跨设备同步

### 5.1 读策略（前端契约）

前端在以下时机拉取偏好：
- 首次进入 `/practice` 路由
- 用户登录后立即拉取
- 用户从其他设备返回（`visibilitychange` 重新可见时校验时间戳）

```ts
// 简化逻辑
useQuery({
  queryKey: ["practice-preferences"],
  queryFn: fetchPreferences,
  staleTime: 5 * 60 * 1000,    // 5min
  refetchOnWindowFocus: true,
});
```

### 5.2 写策略

| 操作 | 触发 |
|---|---|
| 用户在偏好设置页面调整 | 立即 PUT（全量） |
| 用户答题中调整字号 / 节奏（隐式） | debounce 5s 后 PATCH |
| 自定义刷题确认时记下用过的配置 | 提交 session 时 PATCH custom_practice 子树 |

### 5.3 冲突处理

last-writer-wins 简单策略：
- 客户端 PUT/PATCH 后立即更新本地缓存
- 不做 ETag / If-Match 乐观锁（v1 范围）
- 偏好类数据冲突影响小，最坏情况是其中一端的 1-2 个字段被覆盖

Stage 2 多设备并发场景：
- 引入 ETag / If-Match
- 冲突时返回 409 + 最新版本，让客户端 merge

---

## 6. Schema 演进

### 6.1 升级流程

当 payload schema 需要升级（如 v1 → v2 加新字段）：

1. 写新版本 schema 类 `PracticePreferencesPayloadV2`
2. 写 upgrader 函数：
   ```python
   def upgrade_v1_to_v2(v1: dict) -> dict:
       v2 = {**v1}
       # 新字段加默认值
       v2["new_field"] = build_default_for_new_field()
       return v2
   ```
3. 读端点：`GET` 检测 `schema_version < CURRENT_VERSION` → 调 upgrader → **不立即写 DB**（lazy upgrade，等用户下次 PUT 才落库）
4. 写端点：`PUT` 拒绝旧版本 schema_version（强制客户端先拉新版本）

### 6.2 删字段处理

不真删，标记 `deprecated`（Pydantic Optional + comment）：
- 旧字段在 schema 中保留至少 2 个版本
- 前端逐步停止使用 → 数据自然 stale → 下个版本删除

---

## 7. 与其他模块的集成

### 7.1 与 useSessionConfigStore（前端）的关系

前端现有 `useSessionConfigStore`（参见 [04-Frontend-WU §3.2](./04-Frontend-WU.md#10-wu-f10-domain-stores)）持久化到 localStorage + 异步同步 dashboard_preferences。

调整：
- localStorage 仍是即时缓存（保证刷新页面快）
- 异步同步目标改为 **本模块 PATCH `custom_practice` 子树**（不再写 dashboard_preferences）
- 跨设备一致性由本模块保障

### 7.2 与 mock_exam 的关系

模考创建端点的默认值（time_limit / delayed_review_minutes）来自本模块（如有用户偏好则用偏好；无则用套卷推荐）。

### 7.3 与 timing 的关系

`reminders.overtime_threshold_seconds` 影响前端答题中提示，但**不**影响 timing 模块的 `is_overtime` 判定（baseline 是客观计算，不被用户偏好影响）。

### 7.4 与 keyboard 快捷键的关系

后端只存储绑定；前端在答题界面注册全局 keydown listener，按用户偏好生效。

---

## 8. Invariant

详见 [01-Boundary-Rules §15](./01-Boundary-Rules.md#15-用户偏好边界pref-)。

| Invariant | 描述 |
|---|---|
| **Pref-Schema-Version-Strict** | PUT 时客户端 schemaVersion 必须 = 服务端 CURRENT_VERSION，否则 422 |
| **Pref-User-Scope** | 所有读写仅限当前 user_id；其他用户 preferences 永远不可访问 |
| **Pref-Field-Range** | 所有字段必须通过 Pydantic + custom validator 校验范围；任一字段失败整个 PUT 失败 |
| **Pref-KeyBinding-Unique** | KeyBindings 内所有 value 必须唯一（防冲突） |
| **Pref-Default-Idempotent** | 反复请求 GET 返回的 defaults 必须完全一致（除 server_now 等动态字段外） |
| **Pref-Reset-Audit** | 调用 reset 端点必写 audit |
| **Pref-Lazy-Upgrade** | 旧 schema_version 读取时返回升级后的 payload，但 DB 不变（用户下次 PUT 才落库） |

---

## 9. 性能预算

| 端点 | p50 | p95 | p99 |
|---|---|---|---|
| GET /profile/practice-preferences | 30ms | 80ms | 150ms |
| PUT /profile/practice-preferences | 80ms | 200ms | 400ms |
| PATCH /profile/practice-preferences | 80ms | 200ms | 400ms |
| POST /profile/practice-preferences/reset | 80ms | 200ms | 400ms |

---

## 10. 限流

| 端点 | 限流 |
|---|---|
| `GET /profile/practice-preferences` | 每用户 120 req/min |
| `PUT /profile/practice-preferences` | 每用户 30 req/min |
| `PATCH /profile/practice-preferences` | 每用户 60 req/min（debounce 后频次较低） |
| `POST /profile/practice-preferences/reset` | 每用户 5 req/min |

---

## 11. 缓存策略

### 11.1 后端缓存

- 进程内 LRU（`functools.lru_cache` 或 cachetools）
- key = user_id
- TTL = 60s
- PUT/PATCH/RESET 后立即失效该用户缓存

理由：偏好读频次高（每次进 `/practice` 都读），但写频率低（用户调整时才写）。LRU 命中率高 + 失效成本低。

### 11.2 前端缓存

- TanStack Query staleTime = 5min
- localStorage 持久化（即时读取，避免首屏白）
- PUT/PATCH 后 invalidateQueries

---

## 12. 审计与可观测

### 12.1 audit 触发

| 事件 | actor | 备注 |
|---|---|---|
| `practice_preferences.created` | user | 首次 PUT |
| `practice_preferences.updated` | user | PUT / PATCH（before / after diff） |
| `practice_preferences.reset` | user | 重置（reason: 'user_reset', sections: [...]） |
| `practice_preferences.schema_upgraded` | system | lazy upgrade 触发的隐式升级 |

⚠️ 偏好类数据 audit 频次高，写入策略：仅写关键字段变化（如 schema_version / theme），高频次的 font_size / autosave 不写。具体白名单 `AUDIT_TRACKED_PATHS`。

### 12.2 metrics

```
practice_preferences.read_total{is_default}
practice_preferences.write_total{op}              # put / patch / reset
practice_preferences.validation_failure_total{field}
practice_preferences.schema_upgrade_total{from_version, to_version}
practice_preferences.cache_hit_total
practice_preferences.cache_miss_total
```

---

## 13. 错误处理矩阵

| 场景 | 响应 | 前端行为 |
|---|---|---|
| field 校验失败 | 422 INVALID_PREFERENCE_FIELD { field, message } | 表单内联报错 + 不更新本地缓存 |
| schemaVersion mismatch | 422 SCHEMA_VERSION_MISMATCH + payload | 提示用户刷新 + 自动 refetch |
| KeyBindings 冲突 | 422 + 冲突 key 信息 | 表单红色高亮冲突项 |
| 网络失败 | 客户端重试 3 次 | 失败提示 toast |
| reset 部分失败 | 整体回滚 | toast + 不变更 |

---

## 14. 移动端适配

部分偏好仅桌面有意义（如 keyboard.bindings）。移动端策略：
- 后端不区分平台：keyboard 字段仍存（用户在桌面调整后切换到手机仍保留）
- 前端在移动端路由的偏好设置页面隐藏 keyboard 区块
- 但 `answer_panel_position`：默认遵循 device-aware 逻辑（桌面 right / 移动 bottom），用户可强制覆盖

---

## 15. 关联文档

- [00-Decisions §17](./00-Decisions.md#17-用户偏好pref-系列) - Pref-* 决策
- [01-Boundary-Rules §15](./01-Boundary-Rules.md#15-用户偏好边界pref-) - Pref-* invariant
- [02-Data-Model §3.9](./02-Data-Model.md#39-userpracticepreferencesv2) - schema
- [03-Backend-WU §22](./03-Backend-WU.md#22-wu-b28-practice_preferences-模块新建) - WU-B28 PR 拆分
- [04-Frontend-WU §18](./04-Frontend-WU.md#18-wu-f22-practice-preferences-ui) - 前端集成
- [11-Timing-Engine §1](./11-Timing-Engine.md) - reminders 相关
- [13-Mock-Exam §3.1](./13-Mock-Exam.md) - 模考默认值来源
