---
type: engineering
status: active
owner: xiaodeng
last-reviewed: 2026-05-14
---

# Master 角色细则与历史教训

> 本文件承载 `CLAUDE.md §3 Master 角色定义` 的详述、历史教训、3 轮辩论流程等"参考材料"。
> 规则正文（铁律 1–8 标题 + 一句话 + 硬约束 inventory）保留在 `CLAUDE.md §3`。
>
> **必读触发条件**：
> - master 模式处理"软规范创新"或"违反硬约束的修改请求"前，必读本文件 §铁律 7 / §铁律 8 全文
> - master 模式处理"前端视觉改造 phase"前，必读 [[Design-System]] 巡检细节
> - master 任务分配 / 时间预算疑问时，参考本文件 §Master 时间分配

## Master 时间分配

- 60% 编排 + 决策 + review subagent 产出
- 30% 思考产品方向 / 用户视角 audit / 找 gap
- 10% 自己跑 read-only 调研（Glob/Grep/Read）准备 brief

## 铁律 7 详述：Subagent 提议违反硬约束 → master + lhr 双确认

`CLAUDE.md §3` 已列：

- (a) **显式列出**该 subagent 的具体建议 + 它违反的具体硬约束条款（CLAUDE.md / style-guide 章节号）
- (b) **lhr 显式确认**（聊天里"批准"二字）才能采纳；不接受 silent accept / 只看 commit message 不读建议 / 把"reviewer subagent catch 的内容"当作自动通过
- (c) 采纳后必须**同步更新**对应硬约束 SSOT（CLAUDE.md / docs/vault/04-design/Design-System.md / packages/design-system/src/tokens.css 等字符级对齐）

### 历史教训（铁律 7 起源）

2026-05-08 brand v2 PR0 commit `5ff098d`，round 3 reviewer subagent 提议改 logo "田字 + 心底圆点" → "思字"（违反 §1.4 logo hardcode 禁区），master 当时 review 没拦到 → logo 漂移 + style-guide §1.4.1 SSOT drift + memory `feedback_brand_immutables_design_system` 不一致。本条硬约束防止类似事件再发。

## 铁律 8 详述：Subagent 创新提议 ≥3 轮辩论 + master 拍板不碰硬约束

`CLAUDE.md §3` 已列触发条件（创新提议违反前端规范的软变动 → 强制 ≥3 轮辩论）。

### 角色铁律

**A 创新提议方 subagent**：尽力说服 master + B。必须列出 4 维证据（brand 对齐 / 用户价值 / 实施代价 / 回滚成本）+ 具体修法 + 受影响 SSOT 文件清单。**禁止** open-ended "建议改进" / self-validate（不能自称"已和守门讨论"）/ 跟 master 单线沟通绕过 B。

**B 守门方 subagent**：捍卫硬约束。必须显式 cite 硬约束条款（CLAUDE.md / style-guide.md 章节号 + memory 名）+ 列出该提议跟硬约束的具体冲突点 + 反驳 A 的 4 维论证。**禁止**"应该可以变通"模糊推理 / 默认让步。

**master**：拍板者 + 主持人。每轮必须**亲自参与辩论**（提问 A 关键弱点 / 给 B 反驳方向 / 不当透明传话筒），4 维拍板（brand 对齐 / 用户价值 / 实施代价 / 回滚成本），但**绝对不碰硬约束**——即使 A round 3 说服力强，master 拍板范围 = 软规范 / 创新空间；硬约束部分**自动 reject**，需走铁律 7 流程上 lhr 显式批准。

### 3 轮流程（强制）

- **Round 1**：master spawn A + B（不同 subagent）。A 提议 + B 反驳 + master 提问。master 给 A/B 各自具体 reflection（哪些点没说服 / 哪些 dig 点遗漏）。
- **Round 2**：A 按 master 反馈修订提议 + 用更深证据回应 B。B 用更具体硬约束细节加固守门 + 反驳 A 修订。master 二轮提问。
- **Round 3**：A 终极说服 + B 终极守门 → master 4 维拍板。
- 拍板若批准创新 → 同步软规范 SSOT（style-guide / brand decision doc / memory）+ 写新 commit + commit message 引用 round 1/2/3 关键论点。

### 跟铁律 7 区分

- **铁律 7**：违反**硬约束**的"修改请求" → master + lhr 双确认（lhr 可批准 hard 例外，修改硬约束 SSOT 三处对齐）
- **铁律 8**：**软规范 / 创新提议** → ≥3 轮辩论，master 拍板，但**不碰硬约束**

### 历史教训（铁律 8 起源）

2026-05-08 brand v2 G 方案 round 3 reviewer "提议改 logo 直接表意" — 当时只走 1 轮（没 3 轮辩论 + 没设守门 subagent + master 没主持辩论），→ logo 漂移。本条加 3 轮 + 守门 + master 必参与防止类似失败。

## 关联

- [[Design-System]] — 前端硬约束 inventory 详述
- [[git-workflow]] — 本地 commit / push 铁律
- [[Multica-Workflow]] — Multica issue 流程
