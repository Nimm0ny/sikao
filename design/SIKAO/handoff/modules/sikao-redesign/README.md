# Handoff: SIKAO Redesign · audit 集合（10 view）

## Overview

本模块**不引入新 hifi 原型**，是 SIKAO Redesign.html 已有 14 个 screen artboard 中**未被独立 zip 模块覆盖的 10 个 view 集合**。

模块目标 = **audit + 测试现有落地是否齐全 / 是否跟 hifi 对齐**，**不是重设计 / 重做**。

## hifi 原型 SSOT

`SIKAO Redesign.html`（3560 行）—— 完整 brand presentation + 14 个 screen artboard

## 本模块覆盖的 10 个 view（artboard 行号锁定）

| # | view | artboard 行号区间 | 当前实现状态 |
|---|---|---|---|
| 1 | Login | 1738 起 | identity v2 已 ship 2026-05-07，hifi gap 待 audit |
| 2 | Dashboard · 1920×1080 native | 1792 起 | SIKAO Phase 2 已 ship 2026-05-11，gap 待 audit |
| 3 | Dashboard · legacy 1280 | 1929 起 | compact density 参考，是否落地待 audit 决策 |
| 4 | Essay · single question | 2674 起 | 申论 V2 已 ship 2026-05-07，hifi gap 待 audit |
| 5 | Essay · multi-material / multi-question | 2750 起 | 同上 |
| 6 | Result（行测） | 2885 起 | 已 ship，hifi gap 待 audit |
| 7 | Result · Essay | 2984 起 | 已 ship，hifi gap 待 audit |
| 8 | Study Plan | 3298 起 | 已 ship，hifi gap 待 audit |
| 9 | Profile | 3368 起 | 已 ship，hifi gap 待 audit |
| 10 | Sidebar / Shell | 3419 起 | v2 已 ship 2026-05-08，gap 待 audit |

## 不在本模块的 artboard

- **Practice · Standard / AI Pro / Group**（lines 2129 / 2352 / 2510）→ 已被 `modules/xingce-exam/` zip 新 hifi 替代
- **WrongBook**（line 3190）→ 已被 `modules/xingce-wrongbook/` zip 新 hifi 替代
- **marketing/brand 区**（lines 1240-1727: TOPBAR / HERO / DIAGNOSIS / POSITIONING / DESIGN SYSTEM / VOICE / ROLLOUT）→ marketing V1 已独立 ship 2026-05-07，lineage 在 element/marketing-redesign.html，不归本模块

## Audit 方法

详见 `docs/plan/sikao-module-sikao-redesign-2026-05-11.md`。每 view 走：
1. 视觉对齐 audit：tokens / radius / typography / spacing 跟 hifi 原型逐项比对
2. 功能完整 audit：交互、状态、空态、错误态、edge case
3. hifi gap 列表：列出落地缺的细节
4. 用户旅程衔接：从此 view 进/出转场

## Files in this dir

- `SIKAO Redesign.html` — hifi 主参考（从 handoff/design/ 移过来，git mv 保留历史）
- `README.md` — 本文档
