---
type: review
status: complete
owner: codex
reviewer: subagent
last-reviewed: 2026-05-28
target: SIK-121 W5 RailMe button + popover baseline freeze
---

# SIK-121 W5 Review

## 检查范围

- `D:/py_pj/sikao/docs/plan/sik-rail-v5-visual-contract.md`
- `D:/py_pj/sikao/.kiro/steering/nav-baseline.md`
- `D:/py_pj/sikao/apps/web/src/views/Me/accountNav.ts`
- `D:/py_pj/sikao/apps/web/src/layouts/RootLayout/*`
- `D:/py_pj/sikao/apps/web/src/components/overlay/Popover/*`
- `D:/py_pj/sikao/apps/web/src/components/layout/Rail/*`

额外交叉复核：

- `D:/py_pj/sikao/apps/web/src/components/layout/BottomTabBar/*`
- `D:/py_pj/sikao/apps/web/src/components/layout/AppShell/AppShell.tsx`
- `D:/py_pj/sikao/apps/web/src/views/Me/SubNav.tsx`
- `D:/py_pj/sikao/apps/web/src/views/Me/accountNav.test.ts`

复核结论：

- `R1` 已修：`Popover` 保留 caller 的 `aria-haspopup`
- `R2` 已修：无 `panelLabel` 时不再强制 `role="dialog"`
- `R3` 已修：`RootLayout` 测试已锁 mobile bottom-nav 4-tab baseline
- `R4` 已修：route-change close 有独立用例

## 发现项

none

## 风险等级

低

## 建议

- 本次范围内未见剩余 blocker，`SIK-121 W5` 可按“无发现项”收口。
- Residual risk 仅两点：
  - 本 review 是只读静态复核，不替代 `typecheck / lint / tests / browser smoke`。
  - 4-tab baseline 当前靠 `RootLayout`、`nav-baseline` 与测试共同锁住；`BottomTabBar` 组件本身仍是通用组件，但不构成当前 blocker。
