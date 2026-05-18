---
type: migration
status: active
owner: lhr
last-reviewed: 2026-05-13
---

# Migration Plan

> 迁移 SSOT 已收敛到 `docs/vault/05-migration/`：本文件定义路线，`Migration-Status.md` 记录当前状态，`Legacy-Feature-Inventory.md` 记录旧功能盘点，`Data-Migration.md` 记录数据迁移。

## 原则

1. 先迁移，再补功能。
2. 能迁的先迁，不能迁的标记。
3. 不完整不可怕，不标记才不可接受。
4. 业务逻辑沉到 domain / answer-engine / 后端服务。
5. 页面只做展示和交互。
6. 多端共享业务，不复制业务。
7. 数据模型独立于页面。
8. 文档跟迁移同步更新。
9. 旧设计原型不进入 sikao。
10. 不要把 new_web 的混乱结构复制到 sikao。

## 阶段

### R0：骨架与文档（已完成）

- 仓库分层与 monorepo 工程化（npm workspaces）
- 8 个前端 package 骨架
- 15 个后端 module 骨架
- docs/vault 全套起稿
- Migration-Status / Legacy-Feature-Inventory 起稿

### R1：P0 主链路（下一步）

按 brief §5 P0 顺序：

1. **Auth** — services/api/modules/auth + packages/domain/auth + apps/web/views/auth/*
2. **User** — me_v2 / user_goals → modules/user + domain/user + views/Profile
3. **Question Bank** — papers_v2 + domain/models 中的 Paper/Question/* → modules/question-bank
4. **Paper / Practice Set** — 与 question-bank 紧挨
5. **Answer Session** — practice_v2 + practice_session_last → modules/answer-session + packages/domain/answer-session + packages/answer-engine/session
6. **Xingce** — features/practice + views/PracticeSession + components/practice → packages/domain/xingce + apps/web/views
7. **Submit / Scoring** — grading 抽出 → packages/answer-engine/scoring + modules/grading
8. **Review / Explanation** — Result.tsx + 解析 → apps/web/views + components/result

### R2：P1 模块

Shenlun、Editor、Wrong Book、Favorite、Study Record、Admin 已有功能。

### R3：数据迁移（用户补完数据后）

- alembic 23 个 migration 迁入
- fenbi 题库导入脚本迁入
- seeds 迁入

### R4：多端

mobile / tablet 上线。

### R5：后置增强（第一轮迁移不做）

AI 批改、智能组卷、复杂学习分析、多人协作、文档关系图谱等远期增强项。**第一轮迁移不做**，纳入 sikao 业务投产后单独规划。

## 跨阶段：每模块结束必做

1. 更新模块 README（Responsibility / Legacy Source / New Location / Status / Migrated / Missing / Dependencies / Notes）
2. 同步更新 [[Migration-Status]] 表格 + 详情段
3. 若涉及数据：同步 [[Data-Migration]]

## 验收

按 brief §13：

- 结构清晰，apps/packages/services/database/docs 分层
- 旧原型未迁入新路径
- 文档完整（Migration-Status / Legacy-Feature-Inventory / Architecture / 模块 README）
- P0 主链路至少 partial
- 项目可安装依赖、可启动（或明确记录阻塞）
- 无明显无用旧文件复制

## 关联

- [[Migration-Status]] / [[Legacy-Feature-Inventory]] / [[Data-Migration]]
- [[ADR-0001-Monorepo]]
