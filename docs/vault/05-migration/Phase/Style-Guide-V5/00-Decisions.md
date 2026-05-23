# 00 · Resolved Decisions（V5 拍板决策 SSOT）

> **Status**: LOCKED（2026-05-23 user 在 `.tmp_review/v5-open-questions.html` 与 `.tmp_review/v5-open-questions-r2.html` 两轮决策板上拍板）
> **Phase 父目录**：[../README.md](../README.md)
> **来源**：[`.kiro/specs/frontend-style-guide-v5/requirements.md` §7](../../../../../.kiro/specs/frontend-style-guide-v5/requirements.md)
> **变更规则**：任何 R1/R2 决策修改必须在 spec + 本文件同步打 ~~删除线~~ + 新决策 + 新拍板日期；下游 design / tasks / 其他 Phase 引用矩阵全部更新。
> **Last Updated**: 2026-05-23

---

## 1. R1 决策（基础规范层，6 项）

R1 是关于 token / 字体 / 圆角 / 间距 / 底部导航 / 迁移过渡期 的基础选择，全部在 design.md 落地。

| 编号 | 关联 REQ | 决策 | 关键约束 |
|---|---|---|---|
| **R1/Q1** | REQ-3.2 | `--radius-card = 16px`（与交接包对齐，V4 18px 收敛） | 配套 `--radius-card-sm = 12px` / `--radius-card-lg = 22px` / `--radius-tiny = 10px` / `--radius-pill = 999px`；嵌套差值 ≥ 4px（CP.3） |
| **R1/Q2** | REQ-4.3 | 单屏一级模块 N = 4 | 与底部导航 4 项呼应；超出靠滚动或合并，不靠塞密度 |
| **R1/Q3** | REQ-5.5 | 纯系统字体栈 + 中文回退（**不引入** DM Sans / Inter / Noto Sans 在线字体） | UI 默认：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`；代码用等宽：`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`；`<Numeric>` 必带 `font-variant-numeric: tabular-nums` |
| **R1/Q4** | REQ-8.4 | 底部导航采用**玻璃拟态 + 自动降级** | 默认 `backdrop-filter: blur(18px) saturate(140%)` + `bg/0.55`；`@supports not (backdrop-filter)` 与 `prefers-reduced-transparency: reduce` 双触发降级到不透明 `--color-bg-elevated`；该 fallback 必须登记到 `docs/engineering/fail-fast-exceptions.md`（详见 §3） |
| **R1/Q5** | REQ-9.5 | V5 只定考试模式所需的 token 与容器钩子 | 具体 layout / resize / 计时器 / 状态机走独立"考试设计 spec"，不在 V5 范围 |
| **R1/Q6** | REQ-12.2 | V4→V5 迁移过渡期 = 2 周（2026-05-23 → 2026-06-06） | 双轨期内 V4 token 标 `@deprecated 失效 2026-06-06`；过渡期满 Verifier 跑残留扫描，0 引用才删除 |

---

## 2. R2 决策（架构方向层，6 项）

R2 是关于浮层形态 / 组件合并 / DataTable / Mobile / 大屏限宽 / 答题业务组件 的方向性选择，全部在 design.md 与 tasks.md 落地。

| 编号 | 关联 design 章节 | 决策 | 关键约束 |
|---|---|---|---|
| **R2/Q1** | D.3.21 / D.4.3 / D.3.35 | Note 详情用 **`<Drawer side="right" size="lg">`，不用 Modal** | 移动端自动转 `<Sheet side="bottom">`；左侧保留笔记墙作上下文；D.3.35 gotcha 强制约束："Modal 内容超过 640px 高度时用 Drawer 替代" |
| **R2/Q2** | D.3.3 | Tabs 与 SegmentedControl **合并为单组件 3 variant** | 单组件 3 variant：`underline` / `pill` / `segmented`；ScopeToggle（行测/申论）= `variant='segmented'` 的业务别名；**禁独立 SegmentedControl 实现** |
| **R2/Q3** | D.3.x（DataTable，prop API 由独立 admin spec 承担） | DataTable 仅在 V5 留 token 钩子 | `--table-row-h` 等纳入 component token；具体 prop API 由独立 admin spec 承担 |
| **R2/Q4** | D.5 | Mobile Shell 骨架 + token，4 页结构精简 | §D.5 当前 7 子节（D.5.1–D.5.7）保留；移动端启动时新写 mobile spec 细化，但 token 已固化 |
| **R2/Q5** | C.4.2 / C.4.3 | `--max-w-workspace = 1440px` | 1920 主战场 ws 居中，左右各 120 留白；折叠后留白增至 200，**workspace 内容不变**（"沉浸感开关"）；附加 Rail 折叠规则详见 §C.4.3 |
| **R2/Q6** | D.3.28–31 | 答题系统业务组件保留在 V5 | OptionItem / QuestionStem / AnswerSheet / TimerDisplay 由 V5 给契约；layout / 状态机由独立 Exam spec 承担（与 R2/Q3 不冲突） |

### 2.1 Exam 模式独立 layout 强约束（衍生自 R1/Q5 + R2/Q6）

进入 Exam 是**切 layout，不是折叠 Rail**。禁止在 Exam 内嵌 `<AppShell>` / `<Rail>`。Exam 由独立的 `<ExamLayout>` 容器组成（D.4.6）：

```
<ExamLayout>
├─ <ExamTopBar h=var(--exam-topbar-h)>
├─ <PanelGroup direction="horizontal">
│   ├─ <Panel padding=var(--exam-pane-padding)><MaterialPanel /></Panel>
│   ├─ <ResizeHandle w=var(--exam-divider-handle-w)>
│   └─ <Panel padding=var(--exam-pane-padding)><QuestionPanel /></Panel>
└─ <Sheet>  // 草稿纸（z-modal）
```

V5 只提供 3 个 exam token：`--exam-pane-padding` / `--exam-divider-handle-w` / `--exam-topbar-h`；其他全部由独立 Exam spec 承接。

---

## 3. R1/Q4 玻璃拟态 fail-fast 例外登记草案

requirements.md §7.3 已草拟完整字段；tasks.md 任务 14.3 强制要求在 `docs/engineering/fail-fast-exceptions.md` 追加。这是 V5 **唯一**允许的 fail-fast 例外，其他 fallback / silent catch / `?? defaultValue` 一律按 AGENT-H7 拒绝。

### 例外条目字段

| 字段 | 值 |
|---|---|
| **name** | `mobile-bottom-nav-glassmorphism-fallback` |
| **位置** | `apps/web/src/components/layout/BottomTabBar/`（BottomNavigation 组件底部容器背景） |
| **默认行为** | `background: rgba(paper-1, 0.55); backdrop-filter: blur(18px) saturate(140%);` |
| **降级触发** | `@supports not (backdrop-filter: blur(1px))`、或 `prefers-reduced-transparency: reduce`、或运行时检测 `CSS.supports('backdrop-filter', 'blur(1px)') === false` |
| **降级目标** | `background: var(--color-bg-elevated); backdrop-filter: none;`（保持可读性优先） |
| **负责人** | lhr |
| **复审日期** | 2026-08-23（V5 上线后约 3 个月） |
| **不允许的处理方式** | silent catch / 用 `?? defaultValue` 把 backdrop-filter 写成可选字符串 / 在业务组件里手写 fallback 而不走 token |

### 默认实现

```css
.bottom-nav {
  background: rgba(255, 255, 255, .55);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
}
```

### 自动降级

```css
@supports not (backdrop-filter: blur(1px)) {
  .bottom-nav { background: var(--color-bg-elevated); }
}
@media (prefers-reduced-transparency: reduce) {
  .bottom-nav {
    background: var(--color-bg-elevated);
    backdrop-filter: none;
  }
}
```

### 校验手段

- `grep mobile-bottom-nav-glassmorphism-fallback docs/engineering/fail-fast-exceptions.md` 必命中且字段无缺失（tasks.md 任务 25.2 兜底）
- playwright 模拟 `prefers-reduced-transparency: reduce` 截图回归（CP.7）→ 必须降级到不透明 `--color-bg-elevated`

---

## 4. 决策变更规则（与 Phase 父目录约定一致）

修改任意 R1/R2 决策必须：

1. 在本文件对应行画 `~~删除线~~` + 新决策 + 拍板日期
2. 同步 `.kiro/specs/frontend-style-guide-v5/requirements.md` §7
3. 检查下游 design.md 是否被影响——如果是，design.md 同步更新
4. 已在 tasks.md 落实的，PR 标 `BREAKING DECISION CHANGE: <R1/QN | R2/QN>`
5. 跨 Phase 决策（如 fail-fast 例外条目变更）必须在 [Frontend-IA-V2.md](../../Frontend-IA-V2.md) 同步

---

## 5. 关联文档

- [`requirements.md` §7.1](../../../../../.kiro/specs/frontend-style-guide-v5/requirements.md) — R1 6 项决策原文
- [`requirements.md` §7.2](../../../../../.kiro/specs/frontend-style-guide-v5/requirements.md) — R2 6 项决策原文
- [`requirements.md` §7.3](../../../../../.kiro/specs/frontend-style-guide-v5/requirements.md) — Q4 fail-fast 草案
- [01-Boundary-Rules.md](./01-Boundary-Rules.md) — 不变量与跨 Phase 接力
- [02-Token-System.md](./02-Token-System.md) — R1/Q1 圆角 / R2/Q5 max-width 落地处
- [03-Components.md](./03-Components.md) — R2/Q1 Drawer / R2/Q2 Tabs 合并 落地处
- [04-Pages.md](./04-Pages.md) — R1/Q5 Exam token 钩子 / R2/Q4 Mobile Shell 落地处
- [10-Migration.md](./10-Migration.md) — R1/Q6 双轨期 2 周 落地处
