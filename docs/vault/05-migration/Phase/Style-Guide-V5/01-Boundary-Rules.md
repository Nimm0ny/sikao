# 01 · Boundary Rules（V5 不变量与跨 Phase 接力）

> **Status**: LOCKED
> **Phase 父目录**：[../README.md](../README.md)
> **来源**：`requirements.md` §3 不变量 + AGENTS.md H1–H10 + Frontend-IA-V2 layer 划分
> **Last Updated**: 2026-05-23

---

## 1. V5 不变量（user 已锁定，不得破坏）

V5 实施期间以下 7 条由 user 锁定，规范本身与 tasks 实施都不得违反。任何与之冲突的需求条目都视为缺陷。

| # | 不变量 | 校验 |
|---|---|---|
| **INV-1** | **页面骨架不变**：Home / Practice / Me / Note 的信息架构与纵向模块顺序保留 V4 现状（视觉呈现可改） | 人工 review + 04-Pages.md §D.4.x 容器树对照 |
| **INV-2** | **主色调不变**：light 主题主色 `#FFD200`（brand-yellow），dark 主题 `#FFEB38`（brand-yellow） | tokens.css `--color-brand-primary` 双值固定 |
| **INV-3** | **CJK 禁 italic**：所有中日韩字符节点不得带 `italic` / `<i>` / `font-style: italic` / Tailwind `italic` 类 | `lint-italic.mjs` + CP.4 e2e |
| **INV-4** | **SVG-only 图标**：图标只用 SVG，禁 emoji / 图片字体 / icon font 作为图标承载 | `lint-no-emoji-as-icon.mjs` + `lint-practice-svg-only.mjs` + CP.5 |
| **INV-5** | **Token 单源**：所有视觉常量必须落 `packages/design-system/src/tokens.css`；apps/web 不得出现独立 hardcoded 视觉常量 | 5 lint 闸门联合（hardcode / radius-token / shadow-token / zindex-token / spacing-token）+ CP.1 |
| **INV-6** | **dev 端口 18080**：示例代码 / 文档涉及本地启动一律使用 18080 | AGENT-H10 |
| **INV-7** | **禁 docker**：示例与建议中不得引入 docker 流程 | AGENT-H10 |

---

## 2. AGENTS.md 硬规则映射

V5 全程受 AGENTS.md H1–H10 硬规则约束。下表标出每条硬规则在 V5 上下文里的具体应用：

| 硬规则 | V5 应用 |
|---|---|
| **H1 Conflict Handling** | 任何与 INV-1..7 / R1 / R2 冲突的需求或代码必须显式指出，不得静默继续 |
| **H2 Mode First** | tasks.md 每个 sub-task 开工前声明 Master / Runner / Reviewer / Verifier |
| **H3 Capability Preflight** | Phase 7 视觉回归需要 Browser MCP；如不可用必须 fail-fast，不得降级到 axe 单跑 |
| **H4 Master Does Not Execute** | spec 编排在 Master 角色；tasks.md 实施全部派 Runner subagent，Master 只验收 |
| **H5 Review Gate** | 35 组件骨架（Phase 3）单 commit ≤ 400 行净增；前端视觉 phase 必须独立规范审查官 + Browser MCP 验收 |
| **H6 Define First** | spec 三件套已落档（requirements / design / tasks 全部 ACCEPTED），Phase 1 之前不得碰实施代码 |
| **H7 Fail Fast** | 玻璃拟态降级是 V5 **唯一**允许的 fail-fast 例外（详见 [00-Decisions §3](./00-Decisions.md)）；其他 fallback / silent catch / `?? defaultValue` 一律拒绝 |
| **H8 Validation Before Done** | Phase 1–8 每个检查点必须 `pnpm --filter @sikao/web lint && test` PASS；UI 改动加 browser smoke |
| **H9 Commit Batch** | tasks.md 每个 sub-task 对应一个原子 commit（≤15 文件、≤400 行净增）；V4→V5 迁移按 surface 整页拆 7 个 sub-commit |
| **H10 Environment Constraints** | 前端端口 18080；禁 docker；本地 commit / push / pull，不在 VPS 上改源码 |

---

## 3. 与其他业务 Phase 的接力（2026-05-24 V5-M0.5 调整后）

V5 是水平基础设施。**big-bang 重建后，V5 spec + 组件骨架到位即"接力完成"**——各业务 Phase 直接消费 V5 规范从零实现，不再走 V5 子 issue 的"surface 切换"中间步骤。

### 3.1 接力时序（big-bang 后）

```
M0    ── done. V5 spec 三件套 ACCEPTED + Phase 文档落地（含 V5-M0.5 决策追加）
M1    ── done. tokens.css 三层（§8 V4 alias 已被 V5-M0.5 删除）
M0.5  ── IN PROGRESS. big-bang rebuild + lint 聚合
M2    ── V5 Phase 2 6 lint 闸门
M3    ── V5 Phase 3 35 组件骨架
M4    ── V5 Phase 5 SVG 资产收敛
M9    ── V5 兜底实施（Me / QuestionHub / Marketing）+ 视觉回归 baseline
M11   ── V5 Phase 8 文档同步 + spec 关闭

并行（不阻塞 V5）：
  各业务 Phase 前端任务在 V5 M3+M4 到位后自主决定何时实施；
  Home (SIK-29 family) / Practice (SIK-26-28) / Notes (SIK-44 family) /
  Review (SIK-45 family) 直接按 V5 spec 从零实现。
```

### 3.2 各 Phase 对接动作

| 业务 Phase | V5 对接动作 | 时机 |
|---|---|---|
| **Home** | 在 V5 框架下重新实现 5 tab + /me + /profile/records + 验收（原 SIK-42/43 deliverable big-bang 删除后重做）；接 D.4.1 骨架；ListItem hover 必须 `@media (hover: hover) and (pointer: fine)`（CP.9） | V5 M3 到位后 |
| **Practice** | 按 D.4.2 实现；ScopeToggle 用 D.3.3 Tabs `variant="segmented"`（R2/Q2） | V5 M3 + Practice 后端 SIK-25 收尾 |
| **Notes** | 按 D.4.3 实现；笔记详情用 D.3.21 Drawer（R2/Q1） | V5 M3 + Notes 后端 M0-M6 收尾 |
| **Profile** | 在 V5-M9 兜底实施 | V5 M3 后 |
| **Review / Question Hub** | 按 D.4.5 实现；compact-card 用 `--card-radius-sm` (12px) | V5 M3 + Review 后端 M0-M7 收尾 |
| **Onboarding / Auth** | 在 V5 框架下从零实现，**无 V4 alias 兼容期** | V5 M3 后 |
| **Marketing** | landing 页用 V5；不受 `--max-w-workspace=1440` 限制 | V5-M9 内 |

### 3.3 Exam 模式（独立 Phase 未来承接）

R1/Q5 + R2/Q3 + R2/Q6 共同决定：

- V5 **只**定义 3 个 exam token：`--exam-pane-padding` / `--exam-divider-handle-w` / `--exam-topbar-h`
- V5 落骨架 ExamLayout（D.4.6）含 ExamTopBar slot + PanelGroup + ResizeHandle + Sheet 槽位
- V5 落 4 个答题业务组件契约（D.3.28 OptionItem / D.3.29 QuestionStem / D.3.30 AnswerSheet / D.3.31 TimerDisplay）
- **不实现** resize 拖拽 / 计时器逻辑 / 答题状态机 / 草稿纸交互——交独立 Exam spec
- D.3.35 gotcha 强约束：**禁止在 Exam 内嵌 `<AppShell>` / `<Rail>`**——Exam 是切 layout，不是折叠 Rail

---

## 4. 风险与待对齐

### 4.1 Spec 三件套尚未进 git

`.kiro/specs/frontend-style-guide-v5/{requirements,design,tasks}.md` 已落档但未 commit / push。等 lhr 拍板：

- **分支策略**：开 feature 分支（推荐 `spec/frontend-style-guide-v5`）push + 开 PR；还是直推 main（违反 git_safety 默认，需明确授权例外）
- **Commit 拆分**：requirements / design / tasks / Phase 文档各一个原子 commit（推荐，符合 H9 一次一事）；还是合一个并走 H9 例外（需 commit message 写明授权理由）
- **Working tree 当前还有 3 个无关文档修改**（obsidian workspace + Practice 03/04 WU），commit 时必须只 stage `.kiro/specs/frontend-style-guide-v5/` + 本 Phase 目录，禁 `git add .`

### 4.2 ~~V4→V5 sunset 硬约束 ≥ 2026-06-06~~ — ARCHIVED 2026-05-24

> **作废**：V5-M0.5 big-bang rebuild 决策让 sunset 失效。tokens.css §8 V4 alias 已在 V5-M0.5 commit ② 删除，无残留 alias 需要 sunset。原 tasks.md 21.3 sub-task ARCHIVED。

### 4.3 Phase 7 视觉回归基线初次跑通

playwright 36 截图首次跑通需要本地 dev server 稳定，port 18080 不被占用；CI 接入是否做仍待对齐。MVP 内只要本地 baseline 跑通 + 录入 git 即可。

### 4.4 Browser MCP 验收的工具能力

H5 要求"前端视觉 phase 还要独立规范审查官和 Browser MCP 验收"。当前 agent 工具链含 chrome-devtools MCP，可在每个 Phase 检查点（2 / 9 / 16 / 18 / 20 / 22 / 24 / 26）跑 browser smoke。如果某次执行环境无 Browser MCP，必须 fail-fast 报告并请求 lhr 切环境，**不得静默降级到 axe 单跑**。

---

## 5. 关联文档

- [`AGENTS.md`](../../../../../AGENTS.md) §0.2 HARD RULES — H1–H10 原文
- [`requirements.md` §3](../../../../../.kiro/specs/frontend-style-guide-v5/requirements.md) — 7 条不变量原文
- [00-Decisions.md](./00-Decisions.md) — R1 / R2 决策与 fail-fast 例外
- [02-Token-System.md](./02-Token-System.md) — token 单源 INV-5 落地
- [09-Correctness-Properties.md](./09-Correctness-Properties.md) — 10 条 CP 兜底校验
- [10-Migration.md](./10-Migration.md) — sunset 硬时间 + 整页切换流程
