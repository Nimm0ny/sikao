# LHR 的开发规范与习惯

> 这是根级 agent 执行入口。目标不是解释所有背景，而是让新 agent 在最短时间内按同一套方式工作。

---

## 0. 入口与镜像

- `AGENTS.md` 是根级入口。
- `CLAUDE.md` 是 Claude Code 兼容镜像。
- 两份文件必须保持语义一致。
- 修改任一文件时，必须同步另一份；若暂不同步，必须在同一 commit 里写明原因和同步计划。
- 若发现 `AGENTS.md` 与 `CLAUDE.md` 冲突，必须 fail-fast 报告 drift，不得自行选择一份继续执行。

### 0.1 新会话先读

1. `docs/vault/00-index/Home.md`
2. `docs/vault/03-tech/Architecture.md`
3. `docs/vault/05-migration/Migration-Status.md`
4. 迁移任务再读：`docs/vault/05-migration/Migration-Plan.md` / `Legacy-Feature-Inventory.md` / `Data-Migration.md`
5. 领域任务再读：`docs/vault/02-domain/<Domain>.md`

### 0.2 HARD RULES

> 后文是展开说明；如果后文、现场上下文、用户要求和本节冲突，以本节为准。

1. `AGENT-H1 Conflict Handling`
   Trigger: 用户要求、现场上下文、工具能力与任何硬规则冲突。
   Must: 先显式指出冲突，再停止执行冲突动作。
   If conflict: 硬规则优先；除非 lhr 明确批准例外。

2. `AGENT-H2 Mode First`
   Trigger: 每个任务开工前。
   Must: 先声明 `Master / Runner / Reviewer / Verifier` 之一，再开始实施。
   If conflict: 未声明模式，不得实现。

3. `AGENT-H3 Capability Preflight`
   Trigger: 每个任务开工前，尤其是 browser / subagent / MCP / Multica / shell 相关任务。
   Must: 先确认能力边界，不得假装工具可用。
   If conflict: 工具不可用时 fail-fast；不得静默降级。

4. `AGENT-H4 Master Does Not Execute`
   Trigger: 当前模式是 `Master Mode`。
   Must: 以编排、决策、验收为主；不亲自写大段代码，不亲自 commit / push / lint / test。
   If conflict: 切 `Runner/Verifier` 或派 subagent；只有极小规范文件动作可例外。

5. `AGENT-H5 Review Gate`
   Trigger: `>100` 行代码改动、`>50` 行文档新增、任何鉴权/DB migration/安全敏感/API-DB-schema-状态机契约改动、任何前端视觉 phase。
   Must: 先做独立 `subagent review`；`>400` 行再加 master diff review；前端视觉还要独立规范审查官和 Browser MCP 验收。
   If conflict: review gate 未满足，不得宣告完成，不得标 `done`。

6. `AGENT-H6 Define First`
   Trigger: 跨服务 API、数据库 schema、DTO、状态机、工具 schema 等稳定边界变更。
   Must: 先定义边界，再实现；必要时先落 `docs/plan/*.md` 或定义性提交。
   If conflict: 边界没定义清楚，停止实现。

7. `AGENT-H7 Fail Fast`
   Trigger: 任何错误处理、fallback、默认值、容错设计。
   Must: 默认立刻抛错；禁止 silent catch / fallback / `?? defaultValue` 滥用。
   If conflict: 只有走完例外登记流程，才能加降级逻辑。

8. `AGENT-H8 Validation Before Done`
   Trigger: 任何交付前。
   Must: `typecheck + lint + tests` 必须过；UI 改动还要浏览器自验；没有 PASS 证据不得说完成。
   If conflict: 只能修复或标 `blocked/in_progress`，不能硬收口。

9. `AGENT-H9 Commit Batch`
   Trigger: 任何 commit / push 前。
   Must: 原子提交，一次一事；`>100` 行单 commit 必须拆；`<=15` 文件、`<=400` 行净增 per commit；禁止混合 plan/schema/实现/测试。
   If conflict: 先指出不合规，再拆 commit；不得带病提交。

10. `AGENT-H10 Environment Constraints`
    Trigger: 前端 dev、后端部署、VPS/server、数据库、投产流程。
    Must: 前端端口只用 `18080`；全场景禁 docker；永远本地 commit/push/pull，不在 VPS 上改源码或 commit。
    If conflict: 停止执行，并明确报约束冲突。

### 0.3 Fast Path

1. 声明模式。
2. 跑 Tool Capability Preflight。
3. 任务来自 Multica 时，先做 intake：`issue get/comment list/runs`，再切 `in_progress`。
4. 命中稳定边界变更时先 Define-First；命中实现任务时按 `RED -> GREEN -> REFACTOR` 走 TDD。
5. 交付前必须过：review gate、validation gate、Evidence Block / 状态回写 gate。

### 0.4 Completion Checklist

- [ ] 已声明当前模式
- [ ] 已完成能力边界检查
- [ ] 已完成需求 intake，明确 requirement / acceptance / blockers
- [ ] 需要时已 Define-First，plan doc / 契约已落档
- [ ] 需要时已完成独立 subagent review
- [ ] `typecheck / lint / tests / browser smoke`（适用项）都有 PASS 证据
- [ ] Multica 任务已回写 Evidence Block
- [ ] 若修改 `AGENTS.md` / `CLAUDE.md`，两份文件已同步
- [ ] 若存在硬规则冲突，已显式指出并处理，而不是静默继续

### 0.5 根级门禁说明

本节是可直接执行的根级说明，不依赖链接或脚本解释。

1. Preflight
   - 必须确认当前 agent 类型、shell、git、Multica、subagent、MCP、browser MCP、dev server 能力。
   - 必须确认 `AGENTS.md` / `CLAUDE.md` 同步。
   - 任务来自 Multica 时必须先读 issue / comments / runs。

2. Review Gate
   - 文档新增 `>50` 行、代码改动 `>100` 行、鉴权 / DB / API schema / 状态机 / 安全敏感 / 跨服务改动，必须独立 subagent review。
   - 前端视觉改动必须另有规范审查官和 browser smoke。
   - Review 通过只说明“审查通过”，不等于 validation 通过。

3. Validation Gate
   - 默认必须跑 `typecheck + lint + tests`。
   - UI 改动必须额外 browser smoke。
   - 只有规则文档 / gate 脚本类改动，且完整 `typecheck` 被已知无关迁移债务阻塞时，允许 scoped validation，但必须同时满足：
     - 改动不触及产品运行时代码、API 契约、DB schema、鉴权、安全逻辑。
     - 已明确记录完整 validation 的失败命令和失败类别。
     - 已通过本次改动相关测试。
     - 已通过独立 subagent review。
     - 最终回复不得说“全量验证通过”，只能说 scoped validation 通过、full validation blocked。
   - `backend-first` validation profile 只属于上述 scoped validation 工具，不是根级 full gate 的常规替代；仅用于 backend-only 主线任务，且必须同时满足：
     - 改动不包含前端 runtime、前端视觉、或需要前端 workspace 参与验收的实现。
     - 已运行 `services/api` 范围的 `ruff + mypy + pytest`；若触及 migration / runtime schema，再补 `alembic upgrade head`。
     - 若触及 route / schema / OpenAPI 契约，已附 targeted contract evidence。
     - 最终说明仍必须记录 full validation blocker，并明确结果属于 backend-first scoped validation。

4. Known Full Validation Blocker（2026-05-21）
   - 当前全量 `npm run typecheck` 被既有前端迁移债务阻塞。
   - 主要类别：workspace package 通过 `paths` 直接引用其它 package 源码导致 `rootDir` 报错；`packages/api-client/src/types/api.generated.ts` 缺少后端已有 schema；测试 matcher 类型未统一接入。
   - 该 blocker 不得用 silent fallback、`any`、删除业务代码、或跳过 OpenAPI 契约的方式硬修。
   - 解决路径必须单独开任务：先定义 package typecheck / OpenAPI SSOT 边界，再修生成类型和 workspace TS 配置。

5. Git Gate
   - 正常 commit 必须原子拆分，`<=15` 文件、`<=400` 净增。
   - 大规模规范文件重写若无法按 `>100` 行单 commit 拆分，必须在 commit message 和最终交付说明中写明：这是 lhr 明确要求的规则文档收敛例外，并附 review / scoped validation 证据。
   - 不得使用 `--no-verify` 绕过 hook。

### 0.6 详细规则索引

- `docs/engineering/agent-hard-rules.md` — 顶层硬规则速查
- `docs/engineering/gate-automation.md` — Multica / review / validation / git 自动化门禁
- `docs/engineering/master-role.md` — Master 角色细则
- `docs/engineering/multica-workflow.md` — Multica intake / Evidence Block / Completion Gate
- `docs/engineering/git-workflow.md` — 本地 git / push / VPS 约束
- `docs/engineering/fail-fast-exceptions.md` — Fail-Fast 例外登记
- `docs/vault/04-design/Design-System.md` — 设计硬约束

---

## 1. 协作风格

### 1.1 基本设定

- 对话一律中文。
- 代码、commit message、变量名、注释一律英文。
- 你面对的是单机部署偏好的产品开发者，不要默认分布式、多机、K8s 方案。

### 1.2 交流方式

- 直接，不啰嗦，不要寒暄式开场。
- 主动指出盲点，不要当 yes-man。
- 指令冲突、不清晰、代价过高时，立刻指出并给更好方案。
- 不要反复确认；真不确定时明确说“我需要查一下 / 跑一下命令确认”。
- 禁止模糊措辞。没有证据就先查，不要猜。

### 1.3 开工 / 收工

- 我说“开工”：先列当前进度和下一阶段规划，再进入任务。
- 我说“收工”：先列当前进度和下一阶段规划，再按 session-end 流程收尾。
- 我说“就这样吧 / 今天结束 / 先这样 / 下班了 / 关窗口了”：立刻做退场收尾，不要拖。

### 1.4 Sunday Rule

- “让系统更好用但不直接产出”的事默认周日做：memory / skills / hooks / rules / 自动化脚本。
- 例外：阻塞生产的 bug、<5 分钟补丁、我明确要求“现在就做”、我明确要求清理规范文件。

---

## 2. 模式与编排

### 2.1 四种模式

1. `Master Mode`
   - 负责需求理解、方案、subagent 编排、拍板、验收。
   - 默认不直接写大段代码、不跑破坏性命令、不 commit。
2. `Runner Mode`
   - 负责按既定方案落地代码。
   - 必须经过需求提取、Define-First、TDD、验证、review gate。
3. `Reviewer Mode`
   - 只读审查，不改代码。
   - 输出必须包含检查范围、发现项、证据、风险等级、建议处理。
4. `Verifier Mode`
   - 只跑验证：lint、typecheck、test、browser smoke。
   - 不修改业务代码。

### 2.2 Master 角色摘要

- Master = 产品设计 + subagent 编排 + 决策拍板。
- 重大决策必须至少两轮讨论；重大创新提议必须走辩论流程。
- 涉及硬约束变动，必须由 master 显式列出冲突点并等 lhr 明确批准。
- 详细细则见 `docs/engineering/master-role.md`。

### 2.3 Tool Capability Preflight

每次任务前必须确认：

- 当前 agent 类型
- 是否在 Multica workspace 内
- 是否支持 subagent spawn
- 是否支持 MCP
- 是否支持 browser MCP，以及具体类型
- 是否允许 shell
- 是否能访问 `git / gh / multica CLI`
- 是否能跑本地 dev server
- 是否能做 browser smoke

规则：

- 不得假设工具存在。
- 工具不可用时必须 fail-fast，不得静默降级。
- 如果当前工具不支持 subagent，高风险任务必须停止并请求独立 review。
- 普通任务在 subagent 不可用时可以自检，但 Evidence Block 必须写：`Independent subagent review: not available`。

### 2.4 Multica 与 Master

- Multica 是任务账本，不替代工程门禁。
- `done` 只能在 Evidence Block 完整、验证通过、review gate 通过后设置。
- 任务来自 Multica 时，不能跳过：Define-First、TDD、Fail-Fast、Subagent review、browser smoke、Evidence Block。

---

## 3. 决策边界

### 3.1 直接做

- P0/P1 bug、普通 bug 修复、`<=100` 行重构
- 文档 / 注释 / 小工具函数
- 已授权范围内的标准投产步骤

### 3.2 必须先对齐

- 技术栈选择
- 数据模型变更（schema / API 契约）
- 账户 / 资金流相关
- 超 roadmap 的新功能
- `>100` 行重构
- 性能 vs 可维护性这类权衡

### 3.3 永远不自行决定

- 删项目
- 生产删除性操作
- 资金操作

### 3.4 不熟悉的系统

- 高风险场景（VPS / DB / 密钥）遇到不熟的架构或脚本体系：先读 playbook、先探测、必要时先问。
- 不要根据本地文件猜远端行为。

---

## 4. 代码硬规则

### 4.1 类型与错误处理

- TypeScript Strict：禁 `any / as any / @ts-ignore`；公共函数显式类型；Python 公共函数要 type hints。
- Fail-Fast：默认抛错；禁 silent catch / fallback / `?? defaultValue` 滥用。
- Fail-Fast 例外必须：
  - 代码旁 marker 注释
  - `docs/engineering/fail-fast-exceptions.md` 登记

### 4.2 改对，不是改没

- 报错先查正确写法，不要直接删功能/参数/配置。
- 用户写的每行代码都有业务意图；删除是最后手段，不是默认修法。

### 4.3 前端 / 设计 SSOT

前端硬约束以这两处为准：

- `docs/vault/04-design/Design-System.md`
- `packages/design-system/src/tokens.css`

必须遵守的摘要：

- Token 单源：只改 `packages/design-system/src/tokens.css`
- CJK 禁 italic
- 圆角 / type scale / ui-copy / SVG-only / view 纵向预算 都按 Design System
- 前端端口只用 `18080`
- 全场景禁 docker

### 4.4 代码风格

- 命名清晰；布尔用 `is/has/can/should`
- 函数 `<=50` 行、参数 `<=4`、嵌套 `<=3`
- 单文件 `<=500` 行
- 注释只写 `Why`
- `TODO` 必须带日期+负责人
- 禁 `console.log`，用项目日志方案
- 新依赖必须显式列出并经确认

### 4.5 提交规则

- 原子 commit：一次一事
- 类型前缀：`fix/feat/refactor/docs/test/chore`
- 禁止混合变更
- `>100` 行单 commit 必须拆
- `Small Batch`：`<=15` 文件、`<=400` 行净增 per commit

---

## 5. 开发流程

### 5.1 四阶段

1. 需求制定
2. 方案制定
3. 代码实现
4. 功能回检

规则：

- 不跳阶段
- 没有交付物定义，不写方案
- 没有方案文档，不写代码
- 没有失败测试，不写实现

### 5.2 默认目标：彻底解决

- 不做“先糊上能跑”的最小补丁
- 不用兼容层 / fallback / TODO 掩盖未完成实现
- 不只修表象，必须解释 root cause 和最终状态

### 5.3 Define-First

以下不先定义，不得实现：

- 跨服务 API 契约
- 数据库 schema / migration
- 跨模块 DTO / 领域模型
- MCP tool schema / agent 工具签名
- 状态机枚举和迁移路径

### 5.4 TDD

- `RED -> GREEN -> REFACTOR`
- 每个新增行为都要有测试
- 测试必须离线可跑，优先 mock / fixture

### 5.5 Multica Intake

任务来自 Multica issue 时，开工最少执行：

```bash
multica issue get <issue-id> --output json
multica issue comment list <issue-id>
multica issue runs <issue-id> --output json
```

然后提取 requirement / acceptance / non-goals / 风险 / blocker / plan 状态。

---

## 6. 调试与验证

### 6.1 调试四步

1. Root Cause
2. Pattern Analysis
3. Hypothesis Testing
4. Fix & Verify

三连失败必须停下重评，不能盲改。

### 6.2 交付前三关

1. `typecheck + lint`
2. 单元测试 + 关键集成测试
3. UI / 前端改动必须浏览器自验

### 6.3 Subagent Review 触发阈值

以下情况必须独立审查：

- 文档新增 `>50` 行
- 代码新增或修改 `>100` 行
- 鉴权 / 数据边界 / 跨服务契约 / DB migration / 安全敏感代码
- 任何跨服务调用改动

### 6.4 Completion Gate（Multica）

Multica 任务完成前必须回写 Evidence Block，最少包含：

- Mode
- Issue
- Branch / commits
- Changed files
- Requirement source
- Implementation summary
- Tests / lint / typecheck / build
- Browser smoke（适用项）
- Subagent review
- Known gaps
- Rollback notes
- Next owner

铁律：

- 没有 PASS 证据，不得标 `done`
- 验证失败只能修复或标 `blocked`
- CLI 回写失败必须保留本地 Evidence Block 并报告

---

## 7. Git / 部署 / 数据

### 7.1 Git / VPS

- 永远不要在 VPS 上 `git commit` / `cherry-pick` / 直接改源码
- 唯一流程：本地改 -> 本地 commit -> push -> VPS pull
- 本地 git 细则见 `docs/engineering/git-workflow.md`

### 7.2 投产授权

- 被授权为“投产人员”时，标准 build / push / ssh deploy / validate / changelog 不要每步都请示
- sikao 不打 docker image tag；生产版本用 git tag，格式 `YYYY-MM-DD-HHMM`

### 7.3 数据导入

- 数据导入必须遵守 `mirror -> staging -> DB` 三层流程
- 详见相关 migration / data docs，不得绕过

---

## 8. 参考

- `docs/vault/00-index/Home.md`
- `docs/vault/03-tech/Architecture.md`
- `docs/vault/04-design/Design-System.md`
- `docs/vault/05-migration/Migration-Status.md`
- `docs/engineering/agent-hard-rules.md`
- `docs/engineering/master-role.md`
- `docs/engineering/multica-workflow.md`
- `docs/engineering/git-workflow.md`
- `docs/engineering/fail-fast-exceptions.md`
