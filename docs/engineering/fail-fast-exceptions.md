---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Fail-Fast 例外注册表

> CLAUDE.md §4 「Fail-Fast 唯一例外: 我明确要求加容错/重试/降级」的落档机制。
> 口头授权不算。代码 `catch` / `?? defaultValue` / `|| defaultValue` / `try { } catch { return null }` 等降级写法**必须**在本文件登记 + 代码 marker 注释指向 anchor。
>
> 触发新例外的流程见 CLAUDE.md §4。
>
> **来源**：从 `web_new` 仓库 2026-05-11 状态迁移；下方两个例外的 marker 注释已在 sikao 对应文件就位（marker anchor 链接到本文）。

---

## 注册格式 (template)

```markdown
### <slug>

- **文件**: `path/to/file.ts:Lstart-Lend`
- **授权日期**: YYYY-MM-DD
- **Why** (业务理由): 一段文字
- **触发条件** (什么进 catch / 什么命中 fallback): ...
- **降级行为** (silent / log / self-heal / 其他): ...
- **失效条件** (什么时候要重新评估): ...
- **关联 commit / PR**: <sha or PR #>
```

代码 marker 注释格式:

```ts
// FAIL-FAST EXCEPTION (lhr authorized YYYY-MM-DD): <one-line why>
// Registered: docs/engineering/fail-fast-exceptions.md#<slug>
```

---

## 已登记例外

### notes-search-startup-init-degrade

- **文件**: `services/api/src/sikao_api/main.py`
- **授权日期**: 2026-05-26
- **Why**: `SIK-49` 要求 Notes search startup 做 index 初始化，但 Meilisearch 暂时不可达时不能把整个 API boot 一起拉死；搜索端点自身仍会在运行时返回 `503 SEARCH_UNAVAILABLE`。
- **触发条件**: `notes_search_client.init_index()` 因网络错误 / task timeout / backend 5xx 抛出 `NotesSearchUnavailable`。
- **降级行为**: `logger.exception("notes.search.init_failed")` 后继续启动 FastAPI，不阻塞 API boot。
- **失效条件**: 若后续把 Notes search 升级为强依赖基础设施，或 lhr 明确要求“搜索初始化失败即拒绝启动”，则删除此例外并恢复 fail-fast。
- **关联 commit / PR**: `SIK-49`

### notes-search-write-sync-degrade

- **文件**: `services/api/src/sikao_api/modules/notes_v2/interface/routes.py`
- **授权日期**: 2026-05-26
- **Why**: `SIK-49` acceptance 明确要求 “Meilisearch 不可达时：笔记保存仍成功 + audit_log 记录”；因此 create / update / delete 的 after-commit 搜索同步失败不能反向打断已完成的 DB 写入。
- **触发条件**: Notes write after-commit sync 抛出 `NotesSearchUnavailable`，或失败后的 isolated audit write/commit 再次抛错。
- **降级行为**: `logger.warning(...)` + isolated `audit_log_v2` 记录 `notes.search.{action}_failed`；若 audit 自己也失败，则 `logger.exception(...)` 吞掉二次错误，HTTP 仍返回原写入成功结果。
- **失效条件**: 若后续引入可靠 outbox / queue，把搜索同步完全移出 request path，或产品改成“搜索同步失败即写入失败”，则删除此例外并恢复 fail-fast。
- **关联 commit / PR**: `SIK-49`

### exam-tracking-self-heal

- **文件**: `packages/domain/src/study-record/exam-tracking.ts:23-35`
- **授权日期**: 2026-05-08
- **Why**: localStorage `sikao.exam.tracking` 是 client-only 用户偏好（关注哪些考试），非业务正确性数据。corruption（用户手动篡改 / 容量满 / 浏览器扩展冲突）在公考备考用户场景（公司电脑 / 网吧）概率不低。让 corruption 直接 throw 会让整个 ExamCalendar / ExamCountdownCard 视图崩 — 不符合"图书馆隔壁桌"调性。
- **触发条件**: `JSON.parse(localStorage.getItem('sikao.exam.tracking'))` 抛错（非 array / 非 JSON / 写入了非法字符）。
- **降级行为**: self-heal — `removeItem` 清掉 corrupted entry + `logger.warn` 上报 ops 可见 + 返回空 `Set`。下次 read 拿到 `null`（不再 corrupted），走正常路径。
- **失效条件**:
  1. 加 server-side tracking sync (跨设备)，本地不再权威 — 改为从 server fetch + cache。
  2. localStorage corruption 在 ops 日志里频次显著（>1% 用户/月） — 触发深度调查根因（哪个浏览器扩展 / 什么操作导致），可能加防御写入逻辑（schema validation on write）。
  3. logger.warn 被 sentry / pino 等真实 transport 接管后 — 验证 corruption 上报有效。
- **关联 commit**: web_new Phase A2（commit hash 在 web_new 仓库；sikao 迁移后 commit 待 git init 后补登）

### auth-logout-graceful-clear

- **文件**: `apps/web/src/views/Profile.tsx:handleLogout` (line 181-)
- **授权日期**: 2026-05-11 (master autonomy, 历史债务补登 — 原降级由 commit 8089989 引入未登记)
- **Why**: 用户已表达离开意图 (点击退出登录). backend 5xx / 网络断 / token 已过期等场景下, 本地 token 应清, 强制 sign-out 给用户更连贯的体验. 若不 clearSession 用户卡在 Profile 看到 backend 错误, 体验差且违背"用户离开"意图.
- **触发条件**: `/auth/logout` 返回 5xx / 网络断 / axios 任意 throw.
- **降级行为**: `logger.warn('auth.logout.backend_failed', ...)` 上报 ops 可见 + `clearSession()` 清本地 zustand store + localStorage + `navigate('/login')` 跳登录页. 失败也算 user 已 sign-out, 本地 SSR/local storage token 清光.
- **失效条件**:
  1. ship server-side session revoke + 强制 retry (e.g. 长 session token, 必须真实 invalidate on logout, 用于安全敏感场景如 admin / 支付). 那时 backend 失败需要 retry / 提示 user 而非 silent clear.
  2. 引入跨设备 session 同步 — backend 状态权威, logout 必须等 server 确认才能视为已退出.
- **关联 commit**: web_new Wave 1 Round 2（commit hash 在 web_new 仓库；sikao 迁移后 commit 待 git init 后补登）

### mobile-bottom-nav-glassmorphism-fallback

- **文件**: `apps/web/src/components/layout/BottomTabBar/BottomTabBar.module.css` (entire `.nav` rule + `@supports not (backdrop-filter)` + `@media (prefers-reduced-transparency: reduce)` blocks)
- **授权日期**: 2026-05-24
- **负责人**: lhr
- **复审日期**: 2026-08-23 (V5 上线 ~3 个月后)
- **默认行为**: `background: rgba(255, 255, 255, .55); backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%);` 实现"视觉融入"调性，跟手机原生 bottom nav (iOS / Android) 视觉一致。
- **Why** (业务理由): 移动端底部导航默认玻璃拟态实现"视觉融入"调性 — 跟手机原生 bottom nav (iOS / Android) 视觉一致。但旧 WebView (Android < 8 / iOS < 12) 不支持 `backdrop-filter`; 部分用户启用 `prefers-reduced-transparency: reduce` 系统级偏好。两种情况下透明背景会让文字与下层内容重叠不可读 — 直接退化到不透明 `--color-bg-elevated` 是唯一正确选择。
- **触发条件** (降级触发):
  - `@supports not (backdrop-filter: blur(1px))` (旧 WebView)
  - `@media (prefers-reduced-transparency: reduce)` (用户系统偏好)
  - 运行时检测 `CSS.supports('backdrop-filter', 'blur(1px)') === false` (TS 层兜底, BottomTabBar 当前不挂)
- **降级行为** (降级目标): `background: var(--color-bg-elevated); backdrop-filter: none;` (CSS-only fallback, 无 React state, 无 silent catch)。保持可读性优先。
- **失效条件**:
  - **2026-08-23 复审**: 是否还需要兼容 Android < 8 / iOS < 12; 用户使用 reduced-transparency 比例如何 (上线 ~3 个月后)
  - 玻璃拟态语言被替换为其他视觉 (圆角 / shadow / 半透明) 时, 整段 fallback 跟随移除
- **不允许的处理方式**:
  - silent catch (`try { ... } catch { /* swallow */ }`)
  - `?? defaultValue` 把 backdrop-filter 写成可选 string
  - 业务组件内手写 fallback 不走 token
- **三处对齐**:
  - design §E.1 (`.kiro/specs/frontend-style-guide-v5/design.md` line 1494)
  - requirements §7.3 (`.kiro/specs/frontend-style-guide-v5/requirements.md` line 232)
  - 本登记
- **关联 commit / PR**: V5-M3 wave 13 BottomTabBar 落地 (commit `1fa88f871` per SIK-75 evidence).
