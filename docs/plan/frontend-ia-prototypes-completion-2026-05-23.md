# Frontend-IA-V2 Prototypes Completion · 2026-05-23

## Summary

把 `.tmp_review/out/` 下的 view 原型从 ~30% 拉到 ~98%，使得 IA-V2 §4 总览图列出的 ~37 个 view 全部有对应的可视化原型，作为 V5 视觉规范的事实输入与下游业务 Phase 的 surface-level 参考。

## Context

- 起点：`.tmp_review/1.md` 列出了 26 个未做（P0/P1/P2）的 view 原型缺口
- 目标：所有 IA-V2 §4 列出的 layer/tab/子路由都有 1 个 v1 原型
- 非目标：不动 `apps/web/src/**` 任何运行时代码；不替代 V5 token 切换（SIK-71）；不替代视觉回归基线 36 截图（SIK-82）

## Locked Decisions

- `_shared/v5-base.css` 作为新原型的共享 V5 token + rail/workspace shell SSOT，避免每文件 200+ 行 token block 重复
- 文件命名遵循既有惯例：`{Tab|Layer}{n}-{Name}/{ViewName} {version}.html`
- 旧 V4 风格原型（`Note v2.html` / `Practice v1.html` / `Review.html` 等）保留作版本对照，不删
- 与已完成的 `Layer2-Auth/`（5 件套）+ `Layer4-Gate/`（Onboarding + Diagnosis）+ `Tab1-Home/Calendar`（Today/Week/Month）+ `Tab2-Practice/Mock Exam *`（Start/History/Comparison）+ `Tab4-Notes/NoteEditor + NoteTagsManagement`（已由其他工作流落地）汇合，不重复劳动

## Scope

补 1.md 列出的 P0/P1/P2 中本会话亲自补做的 18 个 view + 1 个共享 base.css：

### `_shared/`
- `v5-base.css`（V5 token + rail + workspace + panel + btn + badge + chip + list-row 共享 SSOT）

### Layer ④ Gate
- `Diagnosis v1.html`（Intro + Quiz + Result 三态）

### Tab 2 Practice
- `Session Result v1.html`（脱壳 hero ring + 逐题概览 + 下一步 actions + AI 教练）
- `Essay Grading Result v1.html`（hero + 4 维分项分 + 原文+批注 + AI 评语 + 6 条批注详情）
- `Exam Shenlun v2.html`（V5 对齐双栏材料/作答 + 字数计 + 节奏 hint）

### Tab 3 Review（5 子路由全拆）
- `Review Today v1.html`（4 metric + SRS 队列 + 分级 + 错因侧栏）
- `Review All v1.html`（4 segment + 题目 table + 分页 + 批量栏）
- `Review Insights v1.html`（错题趋势 + 错因聚类气泡 + 再做正确率提升 + AI 洞察）
- `Review Graduated v1.html`（毕业 hero + 卡片墙 + "已毕业"邮戳）
- `Review Archived v1.html`（归档 table + 归档原因 chip + 恢复 actions）

### Tab 5 Profile（8 子页全拆）
- `Profile Goals v1.html`（多目标卡 · 主目标 · 添加新目标）
- `Profile Security v1.html`（登录方式 / 密码与 2FA / 设备 / 危险区 + 安全度 ring）
- `Profile Info v1.html`（头像 + 身份 + 联系方式 + 教育背景）
- `Profile Settings v1.html`（左 TOC + AI / 通知 / 隐私 / 外观 / 数据 / 实验 6 段）
- `Profile Learning v1.html`（KPI + 30 天趋势 + 雷达图 + 知识点树 + 时段热力）
- `Profile Records v1.html`（按日 timeline · 6 类事件 · 里程碑节点）
- `Profile Preferences v1.html`（Dashboard 模块 DnD + 默认视图 + 题型颜色 + 命令面板）
- `Practice Preferences v1.html`（左 TOC + 6 子树：默认/计时/提示/音效/错题/模考）

## Acceptance

- 所有 18 个新增 v1 原型在 file:// 协议下渲染无 console error/warn
- 全页 screenshot 保存于各 Tab 目录 `_smoke_*.png`，便于后续人工 review
- IA-V2 §4 总览图列出的所有 layer/tab/子路由都有对应原型文件
- 沿用 V5 SSOT：`--brand-yellow #FFD200` / 5 档 radius / shadow l1-l4 / 5 题型分类色
- 新原型全部走 `<link rel="stylesheet" href="../_shared/v5-base.css" />`，不再 inline 重复 token block
- CJK 不用 italic；Numeric 全部 `font-variant-numeric: tabular-nums`；SVG outline + currentColor + round linecap/linejoin

## Non-goals

- 不动 `apps/web/src/views/**` 任何 React 运行时代码
- 不删除 V4 老原型（`Review.html` / `Note v2.html` / `Practice v1.html` 等）
- 不做视觉回归基线截图（归 SIK-82 / Phase 7）
- 不实施 V5 token 切换（归 SIK-71 子任务）
- 不补 Marketing 12 个 view 原型（已上线，按 IA-V2 §4 不在原型范围）

## Review / Validation Gate

本任务是规范文档级 / 静态原型工件，不命中 H5 review gate（无运行时代码、无 API 契约、无 schema、无安全敏感）。
- 验证：Browser MCP 静态预览 6 页 / 11 页 = 0 console error/warn
- Smoke 截图归档于 `.tmp_review/out/*/`，作为 IA-V2 / 04-Pages.md 的事实输入
- 不需要独立 subagent review；如后续业务 Phase 直接消费这些原型作为 React 实施 spec，再走该 Phase 的 review gate

## Source Docs

- `docs/vault/05-migration/Frontend-IA-V2.md` §4（总览图 / 路由清单 SSOT）
- `docs/vault/05-migration/Phase/Style-Guide-V5/04-Pages.md` §1（页面骨架以 `.tmp_review/out/*` 为事实来源）
- `docs/vault/05-migration/Phase/Style-Guide-V5/09-Correctness-Properties.md` §3（V5 Baseline Report 扫描范围）
- `.tmp_review/v5-design-preview.html`（V5 Token + Component 视觉示例）
- `.tmp_review/1.md`（本任务的缺口分析与优先级表）
