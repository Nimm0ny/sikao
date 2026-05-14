# sikao 迁移执行文档｜Agent Brief

> 本文档用于交给代码迁移 agent 执行 `new_web` → `sikao` 的迁移工作。  
> 执行原则：**先迁移现有功能，再逐步补充新功能；不完整模块必须明确标记；`new_web` 的设计原型不迁入 `sikao` 新项目路径。**

---

## 0. 任务目标

将现有 `new_web` 项目的可运行功能迁移到新项目 `sikao`。

本次迁移的目标不是一次性重做所有功能，也不是补全新设计，而是建立一个清晰、可维护、可继续扩展的新项目架构，并把 `new_web` 中已经存在的核心功能迁移进去。

迁移完成后，`sikao` 应满足：

1. 有清晰的前后端分层。
2. 有清晰的模块边界。
3. 现有功能优先迁移，不完整的模块允许存在，但必须标记。
4. 业务逻辑不得继续散落在页面中。
5. 后端数据能力独立于前端页面。
6. web、mobile、tablet 端不复制业务逻辑，只做端侧展示和交互适配。
7. 文档采用类 Obsidian 的多文档仓库结构管理。
8. `new_web` 的设计原型、旧原型页面、静态设计稿、非运行必需的 prototype 内容，不迁入 `sikao` 新项目路径。

---

## 1. 迁移硬性约束

### 1.1 必须遵守

- 必须以 `sikao` 为新项目根目录。
- 必须优先迁移 `new_web` 的现有运行功能。
- 允许模块暂时不完整，但必须在文档和代码中标记。
- 必须保留可追踪的迁移记录。
- 必须将业务能力从页面中抽离到模块或 package。
- 必须区分：业务逻辑、接口请求、页面展示、端侧适配。
- 必须为每个迁移模块提供最小 README 或迁移说明。
- 必须保证每个阶段结束后项目尽可能可启动、可检查、可继续开发。

### 1.2 严禁事项

- 严禁把 `new_web` 的旧目录结构原样复制成 `sikao` 的长期结构。
- 严禁把页面组件当成业务模块。
- 严禁让 web、mobile、tablet 三端各自复制一套答题业务逻辑。
- 严禁把后端数据处理逻辑写进前端页面。
- 严禁为了“看起来完整”编造不存在的功能。
- 严禁静默跳过无法迁移的模块。
- 严禁把 `new_web` 中的设计原型、prototype、mockup、旧设计稿目录迁入 `sikao` 新项目路径。
- 严禁迁移与当前运行功能无关的临时文件、历史测试文件、废弃页面、调试脚本。

### 1.3 关于 new_web 设计原型

`new_web` 的设计原型仅允许作为理解旧功能的参考，不作为迁移目标。

不得在 `sikao` 中创建以下目录用于存放旧原型：

```txt
sikao/prototype/
sikao/prototypes/
sikao/design-prototype/
sikao/apps/web/prototype/
sikao/apps/web/design/
sikao/docs/prototype-from-new-web/
```

如确实需要记录旧原型中体现出的业务信息，只能转写成产品文档，放入：

```txt
sikao/docs/vault/01-product/
```

但不得复制原型源文件、导出图、静态 HTML 原型、临时截图或设计稿。

---

## 2. 推荐目标目录结构

在 `sikao` 中采用如下结构。若现有技术栈不完全匹配，可适当调整，但必须保留分层思想。

```txt
sikao/
  apps/
    web/                  # Web 端入口
    mobile/               # 手机端入口，后续可补
    tablet/               # 平板端入口，后续可补
    admin/                # 后台管理端，后续可补

  packages/
    ui/                   # 通用 UI 组件
    design-system/         # 设计系统、主题、字号、间距、颜色
    api-client/            # API 请求封装
    domain/                # 前端领域模型与业务封装
    answer-engine/         # 答题核心逻辑
    editor/                # 申论编辑器、富文本能力
    shared-utils/          # 通用工具
    config/                # 通用配置

  services/
    api/                   # 后端 API 服务
    worker/                # 异步任务，后续可补
    storage/               # 文件/附件/导入导出服务，后续可补

  database/
    migrations/            # 数据库迁移
    seeds/                 # 初始化数据
    schema/                # 数据模型定义

  docs/
    vault/                 # 类 Obsidian 文档仓库
    assets/                # 文档使用的必要资源，不放旧原型
    templates/             # 文档模板

  scripts/
    migration/             # 迁移脚本
    import/                # 数据导入脚本

  tests/
    e2e/
    fixtures/
```

---

## 3. 迁移策略

本项目采用 **迁移优先，补充功能后置** 的策略。

### 3.1 迁移优先

优先将 `new_web` 已存在的功能迁移到 `sikao`，包括：

- 登录/用户相关功能。
- 题库相关功能。
- 行测答题相关功能。
- 申论作答相关功能。
- 答题提交、评分、解析相关功能。
- 错题、收藏、学习记录等已存在功能。
- 后台或管理功能中已经可运行的部分。
- 文档或内容管理中已经可运行的部分。

### 3.2 功能补充后置

以下内容不是第一轮迁移重点：

- 新 UI 设计重做。
- 新原型落地。
- 新业务流程扩展。
- AI 批改增强。
- 智能组卷增强。
- 复杂学习分析。
- 文档关系图谱。
- 多人协作。
- 复杂权限系统。

这些内容可以预留模块位置，但不要在第一轮迁移中强行补全。

### 3.3 不完整模块处理原则

如果某个模块无法完整迁移，不能删除、不能假装完成，必须标记为以下状态之一：

```txt
not_started      尚未迁移
partial          已部分迁移
blocked          被依赖、数据、接口、权限或未知逻辑阻塞
needs_review     已迁移但需要人工确认
complete         已迁移并完成基本验证
legacy_skipped   明确跳过旧功能
```

每个不完整模块必须说明：

```txt
- 旧项目位置
- 新项目位置
- 已迁移内容
- 未迁移内容
- 阻塞原因
- 后续建议
```

---

## 4. 全局迁移状态文件

必须创建并持续维护：

```txt
sikao/docs/vault/05-migration/Migration-Status.md
```

建议格式：

```md
# Migration Status

## Summary

| Area | Status | Notes |
|---|---|---|
| Auth | partial | 登录入口已迁移，权限细节待确认 |
| Question Bank | not_started | 等待旧题库结构盘点 |
| Answer Engine | partial | 已抽离基础 session，计时逻辑待迁移 |

## Module Details

### Auth

- Status: partial
- Legacy path: `new_web/...`
- New path: `sikao/services/api/src/modules/auth`, `sikao/packages/domain/auth`
- Migrated:
  - 登录页面
  - token 存储逻辑
- Missing:
  - 角色权限
  - 设备会话管理
- Blockers:
  - 旧项目权限逻辑分散，需要继续追踪
- Next:
  - 统一 auth guard
  - 增加接口测试
```

---

## 5. 模块迁移优先级

### P0：第一优先级

这些模块优先迁移，目标是让 `sikao` 有基本可运行主链路。

```txt
1. 项目骨架
2. 文档仓库结构
3. 用户登录 / Auth
4. 用户基础信息 / User
5. 题库基础模型 / Question Bank
6. 试卷或练习集合 / Paper or Practice Set
7. 答题会话 / Answer Session
8. 行测答题 / Xingce Practice
9. 提交与基础评分 / Submit and Scoring
10. 解析查看 / Review and Explanation
```

### P1：第二优先级

```txt
1. 申论作答 / Shenlun Practice
2. 申论编辑器 / Essay Editor
3. 错题本 / Wrong Book
4. 收藏 / Favorite
5. 学习记录 / Study Record
6. 后台题库管理中已存在的功能
```

### P2：第三优先级

```txt
1. mobile 端入口
2. tablet 端入口
3. 数据统计
4. 文档仓库功能
5. 导入导出
6. AI 批改或辅助能力
7. 高级权限
```

---

## 6. 前端迁移规则

### 6.1 前端架构原则

前端不得按页面堆业务。推荐按以下方式组织：

```txt
apps/web                 页面入口、路由、布局
apps/mobile              手机端展示入口
apps/tablet              平板端展示入口
packages/domain          业务模型、业务 hooks、前端业务服务
packages/answer-engine   答题核心逻辑
packages/api-client      API 请求封装
packages/ui              通用组件
packages/editor          申论编辑器能力
```

### 6.2 页面职责

页面只负责：

```txt
- 布局
- 路由参数读取
- 调用 domain hooks
- 展示组件
- 基础交互
```

页面不得负责：

```txt
- 答题评分规则
- 答题状态计算
- 错题判定
- 知识点掌握度计算
- 申论批改规则
- 数据聚合
- API 返回结构转换的复杂逻辑
```

这些逻辑应迁移到：

```txt
packages/domain/
packages/answer-engine/
services/api/
```

### 6.3 多端规则

web、mobile、tablet 可以有不同布局，但应共享业务逻辑。

错误示例：

```txt
apps/web/src/features/answer/score.ts
apps/mobile/src/features/answer/score.ts
apps/tablet/src/features/answer/score.ts
```

正确示例：

```txt
packages/answer-engine/src/scoring.ts
apps/web/src/pages/answer/index.tsx
apps/mobile/src/screens/AnswerScreen.tsx
apps/tablet/src/screens/SplitAnswerScreen.tsx
```

---

## 7. 后端迁移规则

### 7.1 后端模块划分

后端建议按领域模块迁移：

```txt
services/api/src/modules/
  auth/
  user/
  question-bank/
  paper/
  answer-session/
  grading/
  wrong-book/
  favorite/
  study-record/
  document/
  analytics/
  admin/
```

### 7.2 单模块内部结构

每个后端模块建议采用：

```txt
module-name/
  domain/                 # 领域模型、业务实体、业务规则
  application/            # 用例服务
  infrastructure/         # 数据库、外部服务、repository
  interface/              # controller、dto、route
  README.md
```

如当前技术栈不支持该结构，也必须保留对应职责边界。

### 7.3 后端职责

后端负责：

```txt
- 数据持久化
- 权限校验
- 业务规则执行
- 答题提交确认
- 评分结果生成
- 错题/收藏/学习记录落库
- 文件和文档数据管理
```

前端不得直接绕过后端访问数据库。

---

## 8. 数据迁移规则

### 8.1 数据优先级

优先迁移以下数据结构：

```txt
1. 用户
2. 题目
3. 题目选项
4. 答案与解析
5. 知识点
6. 试卷 / 套题
7. 答题记录
8. 错题记录
9. 收藏记录
10. 申论材料与作答记录
```

### 8.2 数据迁移要求

必须创建：

```txt
sikao/docs/vault/05-migration/Data-Migration.md
```

记录：

```txt
- 旧数据来源
- 新数据表或 schema
- 字段映射
- 不兼容字段
- 丢弃字段
- 待确认字段
- 迁移脚本位置
```

### 8.3 字段映射模板

```md
# Data Migration

## questions

| Legacy Field | New Field | Required | Notes |
|---|---|---:|---|
| id | id | yes | 保留或重新生成需说明 |
| title | stem | yes | 题干 |
| options | question_options | no | 拆分到选项表 |
| answer | correct_answer | yes | 需确认多选格式 |
| analysis | explanation | no | 解析 |
```

---

## 9. 核心领域模块说明

### 9.1 Auth / User

目标：迁移登录、用户信息、会话状态。

建议路径：

```txt
services/api/src/modules/auth/
services/api/src/modules/user/
packages/domain/src/auth/
packages/domain/src/user/
apps/web/src/routes/login 或等价路径
```

迁移要求：

```txt
- 保留旧登录功能。
- 统一 token/session 处理。
- 记录旧权限逻辑。
- 权限未完整迁移时标记为 partial。
```

---

### 9.2 Question Bank

目标：迁移题库基础能力。

建议路径：

```txt
services/api/src/modules/question-bank/
packages/domain/src/question-bank/
```

应覆盖：

```txt
- 题目
- 题型
- 选项
- 答案
- 解析
- 材料
- 知识点
- 标签
- 来源
```

不完整处理：

```txt
- 如果旧题库字段不清晰，先迁移可确认字段。
- 不确定字段标记为 needs_review。
- 不得擅自删除旧题目关键内容。
```

---

### 9.3 Paper / Practice Set

目标：迁移试卷、练习集合、专项练习相关功能。

建议路径：

```txt
services/api/src/modules/paper/
packages/domain/src/paper/
```

应覆盖：

```txt
- 套卷
- 章节练习
- 专项练习
- 题目排序
- 分区或模块
```

---

### 9.4 Answer Session

目标：迁移答题主链路。

建议路径：

```txt
services/api/src/modules/answer-session/
packages/domain/src/answer-session/
packages/answer-engine/
```

必须抽离为独立核心模块。

应覆盖：

```txt
- 创建答题会话
- 恢复答题会话
- 保存答案
- 保存答题进度
- 计时
- 提交
- 查看提交结果
- 查看解析
```

答题会话建议状态：

```txt
created
in_progress
paused
submitted
reviewing
expired
cancelled
```

不完整处理：

```txt
- 如果旧项目没有完整 session 模型，先建立新模型。
- 旧功能能迁多少迁多少。
- 自动保存、跨设备恢复可标记为 P1/P2。
```

---

### 9.5 Xingce

目标：迁移行测答题功能。

建议路径：

```txt
packages/domain/src/xingce/
apps/web/src/features/xingce/
```

应覆盖：

```txt
- 题目展示
- 单选/多选/判断等题型
- 作答
- 提交
- 正误判断
- 解析
- 练习结果
```

行测评分逻辑不应写在页面中，应放在：

```txt
packages/answer-engine/src/scoring/
```

或后端：

```txt
services/api/src/modules/grading/
```

---

### 9.6 Shenlun

目标：迁移申论作答功能。

建议路径：

```txt
packages/domain/src/shenlun/
packages/editor/
apps/web/src/features/shenlun/
```

应覆盖：

```txt
- 材料阅读
- 题目展示
- 作答编辑
- 草稿保存
- 提交
- 批改结果展示，如旧项目已有
```

不完整处理：

```txt
- 如果旧申论批改逻辑不完整，标记为 partial。
- 如果只有作答没有批改，批改模块标记为 not_started 或 partial。
- 申论编辑器必须尽量独立，不要散落在页面中。
```

---

### 9.7 Wrong Book / Favorite

目标：迁移错题与收藏。

建议路径：

```txt
services/api/src/modules/wrong-book/
services/api/src/modules/favorite/
packages/domain/src/wrong-book/
packages/domain/src/favorite/
```

应覆盖：

```txt
- 自动加入错题
- 手动移除错题，如旧项目支持
- 收藏题目
- 取消收藏
- 错题列表
- 收藏列表
```

---

### 9.8 Study Record

目标：迁移学习记录。

建议路径：

```txt
services/api/src/modules/study-record/
packages/domain/src/study-record/
```

应覆盖：

```txt
- 做题记录
- 正确率
- 学习时长
- 练习历史
```

复杂统计可以后置。

---

### 9.9 Document Vault

目标：建立文档仓库结构。产品内置文档功能如旧项目已有则迁移；如没有，仅建立项目文档规范。

项目文档必须创建：

```txt
sikao/docs/vault/00-index/Home.md
sikao/docs/vault/01-product/Product-Overview.md
sikao/docs/vault/02-domain/Question-Bank.md
sikao/docs/vault/02-domain/Answer-Session.md
sikao/docs/vault/03-tech/Architecture.md
sikao/docs/vault/05-migration/Migration-Plan.md
sikao/docs/vault/05-migration/Migration-Status.md
sikao/docs/vault/05-migration/Legacy-Feature-Inventory.md
sikao/docs/vault/05-migration/Data-Migration.md
```

---

## 10. 文档规范

### 10.1 docs/vault 结构

```txt
docs/vault/
  00-index/
    Home.md
    Roadmap.md
    Glossary.md
  01-product/
    Product-Overview.md
    Feature-Map.md
    User-Flows.md
  02-domain/
    Question-Bank.md
    Xingce.md
    Shenlun.md
    Answer-Session.md
    Grading.md
    Study-Record.md
  03-tech/
    Architecture.md
    Frontend.md
    Backend.md
    Database.md
    API-Standard.md
    Auth.md
  04-design/
    Design-System.md
    Web-Layout.md
    Mobile-Layout.md
    Tablet-Layout.md
  05-migration/
    Migration-Plan.md
    Migration-Status.md
    Legacy-Feature-Inventory.md
    Data-Migration.md
  06-decisions/
    ADR-0001-Monorepo.md
    ADR-0002-Answer-Engine.md
    ADR-0003-Document-Vault.md
  08-archive/
```

### 10.2 文档链接规则

使用 Obsidian 风格双链：

```md
[[Question-Bank]]
[[Answer-Session]]
[[Shenlun]]
[[ADR-0002-Answer-Engine]]
```

### 10.3 标签规则

允许使用以下标签前缀：

```txt
#domain/xxx
#frontend/xxx
#backend/xxx
#product/xxx
#migration/xxx
#status/draft
#status/active
#status/deprecated
#adr
```

不要随意创造大量临时标签。

### 10.4 模块 README 模板

每个核心模块应有 README：

```md
# Module Name

## Responsibility

本模块负责什么。

## Non-goals

本模块不负责什么。

## Legacy Source

- `new_web/...`

## New Location

- `sikao/...`

## Status

partial / complete / blocked / needs_review

## Migrated

- ...

## Missing

- ...

## Dependencies

- ...

## Notes

- ...
```

---

## 11. API 规范

如果新项目已有 API 规范，遵循现有规范；如果没有，采用以下基础格式。

### 11.1 成功响应

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "requestId": "xxx"
  }
}
```

### 11.2 失败响应

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "QUESTION_NOT_FOUND",
    "message": "题目不存在",
    "details": {}
  },
  "meta": {
    "requestId": "xxx"
  }
}
```

### 11.3 API 路由建议

```txt
GET    /api/questions
GET    /api/questions/:id
POST   /api/questions
PUT    /api/questions/:id

GET    /api/papers
GET    /api/papers/:id
POST   /api/papers/:id/start

POST   /api/answer-sessions
GET    /api/answer-sessions/:id
PATCH  /api/answer-sessions/:id
POST   /api/answer-sessions/:id/submit

GET    /api/wrong-book
POST   /api/wrong-book
DELETE /api/wrong-book/:id

GET    /api/favorites
POST   /api/favorites
DELETE /api/favorites/:id
```

---

## 12. 迁移执行流程

Agent 应按以下流程执行。

### Step 1：扫描旧项目

扫描 `new_web`，输出功能清单。

必须创建：

```txt
sikao/docs/vault/05-migration/Legacy-Feature-Inventory.md
```

记录：

```txt
- 页面
- 路由
- API 请求
- 数据模型
- 状态管理
- 组件
- 业务逻辑
- 可迁移程度
- 是否包含旧原型或非运行功能
```

### Step 2：初始化 sikao 结构

创建目标目录结构，优先保证项目可启动。

最低要求：

```txt
sikao/apps/web
sikao/packages/domain
sikao/packages/answer-engine
sikao/packages/api-client
sikao/packages/ui
sikao/services/api
sikao/database
sikao/docs/vault
```

### Step 3：建立文档仓库

创建基础文档：

```txt
docs/vault/00-index/Home.md
docs/vault/03-tech/Architecture.md
docs/vault/05-migration/Migration-Plan.md
docs/vault/05-migration/Migration-Status.md
docs/vault/05-migration/Legacy-Feature-Inventory.md
docs/vault/05-migration/Data-Migration.md
```

### Step 4：迁移 P0 主链路

按顺序迁移：

```txt
Auth → User → Question Bank → Paper → Answer Session → Xingce → Submit/Scoring → Review
```

每迁移一个模块，更新：

```txt
- 模块 README
- Migration-Status.md
- Data-Migration.md，如涉及数据
```

### Step 5：迁移 P1 模块

按顺序迁移：

```txt
Shenlun → Editor → Wrong Book → Favorite → Study Record → Admin Existing Features
```

### Step 6：建立多端入口，但不强行补全

可以创建：

```txt
apps/mobile
apps/tablet
```

但如果旧项目没有对应移动端或平板端功能，只创建基础入口和文档标记，不要编造页面。

状态标记：

```txt
mobile: not_started 或 partial
tablet: not_started 或 partial
```

### Step 7：验证

至少执行：

```txt
- 安装依赖
- 类型检查
- lint，如项目支持
- 单元测试，如项目支持
- web 启动检查
- api 启动检查
```

如某项无法执行，必须记录原因。

---

## 13. 验收标准

第一轮迁移的验收标准：

### 13.1 项目结构

- `sikao` 新项目结构存在。
- `apps`、`packages`、`services`、`database`、`docs` 分层清晰。
- 旧原型没有迁入新路径。

### 13.2 文档

- 存在 `Migration-Status.md`。
- 存在 `Legacy-Feature-Inventory.md`。
- 存在 `Architecture.md`。
- 存在核心模块 README。
- 不完整模块均有状态标记。

### 13.3 功能

至少完成或部分完成：

```txt
Auth
User
Question Bank
Answer Session
Xingce Practice
Submit/Scoring
Review
```

如果无法完整迁移，必须标记为 `partial`、`blocked` 或 `needs_review`。

### 13.4 工程

- 项目可以安装依赖。
- 项目可以启动，或明确记录启动阻塞原因。
- 不存在明显无用的大量旧文件复制。
- 不存在把旧项目原型目录搬进新项目的问题。

---

## 14. Agent 输出要求

迁移完成后，agent 必须输出一份迁移总结，包含：

```md
# Migration Summary

## Completed

- ...

## Partial

- ...

## Blocked

- ...

## Skipped

- ...

## Not Migrated

- ...

## Prototype Handling

确认 `new_web` 设计原型未迁入 `sikao` 新项目路径。

## Validation

| Check | Result | Notes |
|---|---|---|
| install | pass/fail/not_run | ... |
| lint | pass/fail/not_run | ... |
| typecheck | pass/fail/not_run | ... |
| web start | pass/fail/not_run | ... |
| api start | pass/fail/not_run | ... |

## Next Steps

- ...
```

---

## 15. 推荐首轮迁移清单

首轮迁移不追求全量完成，优先建立主链路。

```txt
[ ] 初始化 sikao 目录结构
[ ] 创建 docs/vault 文档结构
[ ] 创建 Migration-Status.md
[ ] 扫描 new_web 功能并创建 Legacy-Feature-Inventory.md
[ ] 迁移 Auth
[ ] 迁移 User
[ ] 迁移 Question Bank
[ ] 迁移 Paper / Practice Set
[ ] 迁移 Answer Session
[ ] 迁移 Xingce 答题
[ ] 迁移 Submit / Scoring
[ ] 迁移 Review / Explanation
[ ] 标记 Shenlun 状态
[ ] 标记 Wrong Book 状态
[ ] 标记 Favorite 状态
[ ] 标记 Study Record 状态
[ ] 确认 new_web 设计原型未迁入 sikao
[ ] 执行基础验证
[ ] 输出 Migration Summary
```

---

## 16. 最重要的执行原则

迁移过程中优先保证以下原则：

```txt
1. 先迁移，再补功能。
2. 能迁的先迁，不能迁的标记。
3. 不完整不可怕，不标记才不可接受。
4. 业务逻辑要沉到 domain、answer-engine 或后端服务。
5. 页面只做展示和交互。
6. 多端共享业务，不复制业务。
7. 数据模型独立于页面。
8. 文档必须跟迁移同步更新。
9. 旧设计原型不进入 sikao 新路径。
10. 不要把 new_web 的混乱结构复制到 sikao。
```

---

## 17. 可直接给代码 Agent 的执行指令

请按本文档执行 `new_web` → `sikao` 迁移。

你的任务是：

1. 扫描 `new_web` 的现有功能。
2. 创建或整理 `sikao` 新项目结构。
3. 优先迁移现有功能，不主动补充新功能。
4. 对无法完整迁移的模块标记状态。
5. 建立 `docs/vault` 文档仓库。
6. 迁移 P0 主链路：Auth、User、Question Bank、Paper、Answer Session、Xingce、Submit/Scoring、Review。
7. 对 P1/P2 模块创建位置和迁移状态，但不要编造功能。
8. 不要将 `new_web` 的设计原型、prototype、旧设计稿迁入 `sikao` 新项目路径。
9. 每完成一个模块，更新模块 README 和 `Migration-Status.md`。
10. 最后输出 `Migration Summary`，列出完成、部分完成、阻塞、跳过、未迁移、验证结果和下一步建议。

