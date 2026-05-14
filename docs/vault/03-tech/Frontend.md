---
type: architecture
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Frontend

详见 [[Architecture]]。本页聚焦前端工程细节。

## 工具链

- Vite 8（oxc minify，es2020 target，cssCodeSplit）
- TypeScript strict
- ESLint 9 + typescript-eslint + jsx-a11y + react-hooks + react-refresh
- Tailwind 4
- Vitest 4 + Testing Library
- MSW 2（API mock）

## 路径别名（vite + tsconfig）

```
@/*              → apps/web/src/*
@sikao/ui        → packages/ui/src
@sikao/design-system
@sikao/api-client
@sikao/domain
@sikao/answer-engine
@sikao/editor
@sikao/shared-utils
@sikao/config
```

## 包职责（per brief §6）

| 包 | 职责 |
|----|------|
| `apps/web`            | 页面入口、路由、布局、apps 私有业务 fragment |
| `@sikao/ui`           | 通用 UI（Button/Card/Drawer/Skeleton/Icons） |
| `@sikao/design-system`| Token（颜色/字号/间距/圆角/阴影/motion） |
| `@sikao/api-client`   | axios 实例 + React Query hooks + OpenAPI 类型 |
| `@sikao/domain`       | 业务模型、业务 hooks、Zustand store、派生逻辑 |
| `@sikao/answer-engine`| 答题纯算法（评分/计时/状态机/字数/网格/划线） |
| `@sikao/editor`       | 申论编辑器组件 |
| `@sikao/shared-utils` | classname/logger/toast/motion/手势 hooks |
| `@sikao/config`       | endpoint / env / feature flags |

## 页面职责（per brief §6.2）

页面**只**负责：

```
布局 / 路由参数读取 / 调用 domain hooks / 展示组件 / 基础交互
```

页面**不**负责：

```
评分规则、状态计算、错题判定、知识点掌握度、申论批改、API 返回结构转换的复杂逻辑
```

这些下沉到 `@sikao/domain`、`@sikao/answer-engine`、或 `services/api`。

## 多端规则（per brief §6.3）

web / mobile / tablet 共享 `@sikao/domain` 与 `@sikao/answer-engine`；端侧只做布局适配。**禁止**复制业务逻辑。

## 端口

dev: **18080**（硬约束）。

## Lint 巡检（迁移自 new_web）

- `lint:hardcode`（圆角 / 字号 / 任意值 tailwind utility 巡检）
- `lint:radius-token`
- `lint:italic`（CJK 禁 italic）
- `lint:practice-svg-only`
- `lint:icon-button`
- `lint:no-emoji-as-icon`
- `lint:ui-copy-ssot`

迁移到 sikao 时这些 mjs 脚本需要重新指向 monorepo 路径。
