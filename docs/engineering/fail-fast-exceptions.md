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



### essay-grading-trigger-hook

- **文件**：`services/api/src/sikao_api/modules/session/application/hooks.py`（B23.4 落地后；session.submit hook 内的 essay grade trigger 调用点）
- **授权日期**：2026-05-22（lhr 通过 Phase-Practice CLP-1 决策授权；详见 [`docs/vault/05-migration/Phase/Practice/00-Decisions.md` §19 CLP-1](../vault/05-migration/Phase/Practice/00-Decisions.md#19-闭环修订决策clp-系列)）
- **Why** (业务理由)：申论批改是**异步可重试**的辅助流程；session.submit 主流程是用户感知到的"提交答卷"动作。让 grade trigger 失败回滚整个 session.submit 会让用户看到"提交失败"但实际答卷已写入 EssaySubmissionV2 → 用户体感为数据丢失。把异步触发的副作用与主流程的 atomicity 解耦更稳。POST /api/v2/practice/essay/submissions/:id/grade 端点保留作为显式重试入口，user 可主动触发；也可由 admin 触发；cron 路径无（CLP-1 明确批改不走 cron）。
- **触发条件**：`essay_grading.submit_hook.on_session_submit_essay(submission_id)` 在调用 LLM background task 调度前 raise（如 BackgroundTasks.add_task throw / DB 写入 audit 失败 / module 内部 ValidationError）。
- **降级行为**：catch 后写 `audit_log.write(action='session.essay_grade_trigger_failed', ...)` + metric `essay_grading.trigger_failed_total{reason}`；不重抛；session.submit 主流程继续完成（status 转 SUBMITTED，EssaySubmissionV2.status=pending_grading 仍保留）。用户在 result 页 polling /grading-status，看到 status=pending_grading 时若 30s 后仍 pending，提示用户重试（前端调 POST /grade 显式触发）。
- **失效条件**：
  1. 引入异步任务队列（如 Celery / RQ）替换 FastAPI BackgroundTasks 时——任务排队成功率应接近 100%，hook 抛错应改为 fail-fast（让 session.submit retry 直至排队成功）。
  2. metric `essay_grading.trigger_failed_total` ≥ 1% 提交量时——触发深度调查根因（可能是 LLM 模块、audit 写入、或 hook 逻辑 bug），并考虑改 fail-fast。
  3. 批改流程改为同步（需 LLM 流式渲染 / 用户主动等待）时——降级失去意义，删除例外。
- **关联 commit**：`docs/practice-closed-loop-patches` branch 第 4 commit（CLP 决策落档）；实施 commit 待 B23.4 PR 创建后补登。
