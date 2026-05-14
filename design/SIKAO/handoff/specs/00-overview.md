# 00 · Information Architecture

## 路由
```
/                          ← 营销首页
/login   /register
/dashboard                 ← 02 (默认登录后落地)
/plan                      ← 07
/practice/xingce/:setId    ← 03 标准版
/practice/xingce/:setId?ai=1   ← 03b AI Pro
/practice/xingce/:setId#group=Q12-Q15  ← 03c 题组（同路由，材料 + 多题）
/essay/:setId/:qId         ← 04 单题
/essay/:setId              ← 04b 多材料多题
/result/:attemptId         ← 05 (行测) / 05b (申论)，按 attempt.kind 分发
/wrongbook                 ← 06
/profile                   ← 08
/profile/subscription      ← PRO 订阅
```

## 全局壳
- 默认左侧 nav (240px)，topbar 仅在小屏出现
- Tweak `nav=top` 时切顶导航，content 全宽

## 全局快捷键 (建议)
- `cmd/ctrl + k` 全局搜
- `f` 收藏 · `m` 标记 · `n` 笔记 (在 03/03b/03c)
- `?` 显示快捷键面板
- `[` / `]` 上一题 / 下一题
- `1-4` 选 A/B/C/D
- `ctrl/cmd + enter` 提交

## 数据契约 (建议 zod schema 命名)
- `User { id, name, avatar, plan: "free"|"pro", planExpireAt }`
- `Attempt { id, kind: "xingce"|"essay", setId, score, timeSpent, finishedAt, breakdown: BreakdownRow[] }`
- `Question { id, kind, stem, options?, answer, explanation?, materialIds? }`
- `Material { id, title, body, lines: HighlightLine[] }`
- `WrongItem { id, qId, attemptId, addedAt, masteredAt?, tag?: string }`
- `PlanItem { id, date, kind: "xingce"|"essay"|"review", payload, status }`

## 共享 mock
建议在 `mocks/` 放：`user.ts` `attempts.ts` `wrong.ts` `plan.ts`，每页都引同一份，不要各写各的。
