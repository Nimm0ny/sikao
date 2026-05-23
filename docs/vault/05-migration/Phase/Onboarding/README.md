# Phase · Onboarding（Gate 层）

> **Status**: TBD（占位）
> **IA 位置**：④ Gate Layer（位于 Auth 与 Main App 之间，登录后强制流）
> **Phase 父目录**：[../README.md](../README.md)
> **Last Updated**: 2026-05-21

---

## 0. 范围预览

Gate 层是登录后但尚未进入 Main App 的强制流。覆盖：

- Onboarding（首次使用引导，收集用户档案 / 起点 / 目标）
- DiagnosisResult（基础诊断 + 建议）
- OnboardingGate 路由判定逻辑（什么状态强制走 Gate，什么状态放过）
- 多次进入后的可跳过性（用户已建立 plan 后，二次登录是否再次拦截）

> **已部分实现**：[Phase/Home](../Home/README.md) 的 WU-F4.8 实现了 `AiPlanGenerateDialog` 组件，可被本 Phase 的 onboarding 流复用（AI-1 决策的"三处入口"之一）。

---

## 1. 启动前置

- ✅ [Phase/Home](../Home/README.md) 完工：AiPlanGenerateDialog 已就绪
- ✅ ProfileGoalV2 / ProfileInfoV2 字段扩展完成
- ⏳ 起点诊断算法（行测 / 申论各 5-10 题快速诊断 → baseline 分数）

---

## 2. 关联 IA 决策

- D-Layer：Gate 优先于 Main App
- D15：Onboarding / Diagnosis 走脱壳路由（无 RailMini / TabBar）
- AI-1：onboarding 是 AI 制定的入口之一（已在 Home WU-F7.3 实现接入）

---

## 3. 预期文档结构

```
Phase/Onboarding/
├── README.md
├── 00-Decisions.md          强制流策略 / 跳过策略 / 诊断题集决策
├── 01-Data-Model.md         OnboardingProgressV2 / DiagnosisResultV2
├── 02-Backend-WU.md         baseline 收集 / 诊断算分 / 完成判定
├── 03-Frontend-WU.md        OnboardingGate 完整化 + Onboarding view 重写 + DiagnosisResult view
├── 04-Diagnosis-Algo.md     诊断分数 → baseline / focus_subjects 推导
└── 05-Testing.md
```

---

## 4. 待解的设计问题

- 诊断题集如何选（覆盖度 + 区分度）
- baseline 转化：题目正确率 → 预估分数的映射函数
- 用户中途退出 onboarding 的状态（保存进度 vs 重置）

---

## 5. 关联文档

- [../Home/README.md](../Home/README.md)（AiPlanGenerateDialog 复用）
- [../Auth/README.md](../Auth/README.md)（登录后跳转逻辑）
- [../../Frontend-IA-V2.md](../../Frontend-IA-V2.md)

---

## 6. 视觉原型参考

| view | 路由 | 原型文件 |
|---|---|---|
| Onboarding | `/onboarding` | [`.tmp_review/out/Layer4-Gate/Onboarding v1.html`](../../../../.tmp_review/out/Layer4-Gate/Onboarding%20v1.html) |
| Diagnosis（intro / quiz / result 三态） | `/diagnosis` | [`.tmp_review/out/Layer4-Gate/Diagnosis v1.html`](../../../../.tmp_review/out/Layer4-Gate/Diagnosis%20v1.html) |

原型已实现 IA-V2 §3.4 的脱壳结构（无 Rail / 无 TabBar，强制流）。Diagnosis 单文件含 3 个 state，右下角按钮可切换。记账见 SIK-85。
