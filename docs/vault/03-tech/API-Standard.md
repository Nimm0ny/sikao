---
type: architecture
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# API Standard

per brief §11。

## 成功响应

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {"requestId": "xxx"}
}
```

## 失败响应

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "QUESTION_NOT_FOUND",
    "message": "题目不存在",
    "details": {}
  },
  "meta": {"requestId": "xxx"}
}
```

## 命名与前缀

- 全部前缀 `/api/v2/`（与 new_web 兼容）
- RESTful 资源命名：复数（`/questions`、`/papers`、`/wrong-book`）
- Action 端点用动词后缀（`/answer-sessions/:id/submit`、`/papers/:id/start`）

## 命名风格

- URL：kebab-case
- JSON body：camelCase（per new_web 的 CamelModel 基类 + Pydantic alias）
- DB / Python：snake_case

## 推荐路由（per brief §11.3）

```
GET    /api/v2/questions
GET    /api/v2/questions/:id
POST   /api/v2/questions
PUT    /api/v2/questions/:id

GET    /api/v2/papers
GET    /api/v2/papers/:id
POST   /api/v2/papers/:id/start

POST   /api/v2/answer-sessions
GET    /api/v2/answer-sessions/:id
PATCH  /api/v2/answer-sessions/:id
POST   /api/v2/answer-sessions/:id/submit

GET    /api/v2/wrong-book
POST   /api/v2/wrong-book
DELETE /api/v2/wrong-book/:id

GET    /api/v2/favorites
POST   /api/v2/favorites
DELETE /api/v2/favorites/:id
```

new_web 现实现的 `/api/v2/practice/*`、`/api/v2/practice/sessions/*` 命名与上述略不同；本轮**保留旧命名以确保兼容**，重命名留 ADR 决策。
