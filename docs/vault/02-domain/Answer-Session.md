---
type: domain
status: draft
owner: lhr
last-reviewed: 2026-05-13
---

# Answer Session

## 范畴

答题会话核心模块。brief §9.4 明确要求**抽离为独立核心模块**。

## 状态机

```
created → in_progress → submitted → reviewing
            ↘ paused ↗
            ↘ expired
            ↘ cancelled
```

## 应覆盖能力

- 创建答题会话
- 恢复答题会话（跨设备）
- 保存答案（per-answer debounce）
- 保存答题进度
- 计时（含暂停）
- 提交
- 查看提交结果
- 查看解析

## 后端实现

- `services/api/src/sikao_api/modules/answer-session/`
- Endpoint：`POST /api/v2/practice/start` / `submit` / `complete` / `retry` / `save-answer`；`GET /history` / `stats/*`
- Model：`PracticeSession` / `PracticeSessionAnswer` / `ReleaseAudit`

## 前端

- 状态机与 store：`packages/domain/src/answer-session/`
- 纯算法（计时、scoring、状态迁移函数）：`packages/answer-engine/src/session/`
- 页面：`apps/web/src/views/PracticeSession.tsx`、`ShenlunSession/ShenlunSession.tsx`

## 关联

- [[Xingce]] / [[Shenlun]] / [[Grading]] / [[Wrong-Book]]
- [[ADR-0002-Answer-Engine]]

## 状态

`not_started`
