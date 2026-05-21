# Phase-Profile · 03 · Frontend Work Units

> **Status**: DRAFT（占位 · 后端先行，前端后做）
> **Last Updated**: 2026-05-21
> **Index**: see `./README.md`

---

## 1. 页面结构

### 1.1 路由规划

```
/me                  ← mobile TabBar 入口（alias → /profile）
/profile             ← 概览页（M-Multi overview）
/profile/goals       ← 目标编辑
/profile/info        ← 个人信息编辑
/profile/security    ← 改密 + 注销入口
/profile/settings    ← AI 开关
/profile/learning    ← 详细学情（已在 Home Phase 落地）
/profile/records     ← 学习记录（已在 Home Phase 落地）
```

### 1.2 页面组件树（预览）

```
ProfileOverviewPage
├── ProfileHeader（头像 + display_name + active plan badge）
├── SectionCard × 4
│   ├── "目标设置" → /profile/goals
│   ├── "个人信息" → /profile/info
│   ├── "账号安全" → /profile/security
│   └── "偏好设置" → /profile/settings
├── QuickLink "详细学情" → /profile/learning
├── QuickLink "学习记录" → /profile/records
└── FooterVersion（版本号 + 法律链接）

ProfileGoalsPage
├── ExamTargetList（exam_targets[] 增删改）
├── TargetScoreInput
├── WeeklyHoursInput
└── SaveButton

ProfileInfoPage
├── DisplayNameInput
├── RealNameInput
├── RegionSelect
├── BioTextarea
└── SaveButton

ProfileSecurityPage
├── PasswordSection（改密表单）
├── PhoneSection（绑定状态 + CTA — disabled/占位）
├── EmailSection（绑定状态 — 仅展示）
├── SessionSection（活跃设备数）
└── DangerZone
    └── DeleteAccountButton → DeleteConfirmDialog

ProfileSettingsPage
├── AiToggle（ai_adjust_enabled 开关）
├── AiExplanation（关闭后的影响说明文案）
└── （预留：通知偏好、推荐策略 — 后续迭代）
```

---

## 2. 设计约束

| 约束 | 来源 | 说明 |
|---|---|---|
| Mobile 4-tab 铁线 | Handoff §3.3 | TabBar 第 4 tab = `/me`；RailMini 同 |
| M-Multi | IA-V2 D11 | 概览 + 子路由，不做长滚动 |
| SVG-only | CLAUDE.md §4 | 所有 icon 用 `@sikao/ui/icons` |
| aria-label 必填 | lint:icon-button | 所有可交互 icon |
| CamelCase API | 全局 | 前端对接 camelCase response |

---

## 3. 注销 UX 流程

```
[ProfileSecurityPage]
    └─ DangerZone
         └─ "注销账号" 按钮（destructive style）
              │
              ▼
         DeleteConfirmDialog（modal）
              ├─ 标题："确认注销账号"
              ├─ 说明："注销后 7 天内账号数据将被永久删除，此操作不可撤销。"
              ├─ 注销原因 radio group（DeletionReason 枚举）
              ├─ 确认输入框：请输入"确认注销"
              └─ 按钮：[取消] [确认注销]（disabled until 输入匹配）
                        │
                        ▼
                  DELETE /api/v2/profile/account
                        │
                        ▼
                  成功 → 清 session → 跳 /login + toast "账号已注销"
```

---

## 4. PR 拆分（预估 · 前端后做）

| PR | 范围 | 依赖 |
|---|---|---|
| PR-F1 | ProfileOverviewPage + routing `/me` alias | 后端 overview 已有 |
| PR-F2 | ProfileSettingsPage（AI toggle） | PR-P1 |
| PR-F3 | ProfileSecurityPage + DeleteConfirmDialog | PR-P3 |
| PR-F4 | ProfileGoalsPage（exam_targets 增删改） | 后端 goals 已有 |
| PR-F5 | ProfileInfoPage | 后端 info 已有 |
| PR-F6 | PreferencesPage（如果决定 UI 化） | PR-P2 |

---

## 5. 状态管理

| 数据 | 方案 | 备注 |
|---|---|---|
| Profile overview | React Query `useQuery` | staleTime=5min |
| Settings | React Query `useQuery` + `useMutation` | optimistic update |
| Preferences | React Query `useQuery` + `useMutation` | 后续同步时 invalidate |
| Deletion | `useMutation` only | 成功后清全部 cache + redirect |

---

## 6. 关联文档

- [00-Decisions.md](./00-Decisions.md)
- [02-Backend-WU.md](./02-Backend-WU.md)（API 规格）
- [../Home/04-Frontend-WU.md](../Home/04-Frontend-WU.md)（格式参考）
