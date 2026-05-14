---
type: engineering
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# ADR-0002 — Answer Engine 独立包

## Status

Accepted（2026-05-13）

## Context

new_web 中答题相关逻辑分布在多处：

- 评分散落在 `views/PracticeSession.tsx`、`views/Result.tsx`、`views/EssayExamSikao.tsx`
- 字数计算 / 田字格 / 划线在 `features/essay-exam/lib/`
- 计时在 hooks 与 view
- 题型识别在 `lib/isGraphicReasoning.ts`

brief §9.4 / §9.5 / §9.6 明确要求"答题会话必须抽离为独立核心模块"。

## Decision

新建 **`@sikao/answer-engine`** 包，作为答题流的**纯逻辑核心**：

- 会话状态机（7 状态）
- 行测 / 申论评分
- 计时器（含暂停）
- 字数 + 字符计算
- 田字格布局
- 划线范围合并
- 题型识别（图形推理等）

**不依赖 React**（纯函数 + 类），可被前端 hooks（`@sikao/domain`）和后端服务（`services/api/modules/grading`）复用。

## Alternatives considered

- 放进 `@sikao/domain`：耦合 React，无法被后端复用
- 放进 `services/api/modules/grading`：前端需重复一份算法
- 放进 `apps/web/src/lib`：违反 brief §6.2，逻辑散落

## Consequences

- 前端 hooks 只调本包函数，不持有计算
- 后端 grading 可选 import 同一份算法保持一致（或起码用同一份测试 case）
- 测试更容易（纯函数）
- 缺点：新包 + 新边界，需要额外契约维护

## 关联

- [[Answer-Session]] / [[Xingce]] / [[Shenlun]] / [[Grading]]
