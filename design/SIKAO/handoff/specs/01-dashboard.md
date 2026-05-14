# 01 · Dashboard · 今日学习

> HTML 锚点：`02 · 今日学习 · Dashboard` (1920×1080 native) 与 `02b` (1280 紧凑)
> 路由：`/dashboard`

## 目标
登录后首屏。一眼看到：今天该做什么 · 最近的状态 · 距离目标多远。

## 布局 (1920 native)
```
┌────────┬─────────────────────────────────┬──────────────┐
│        │  EYEBROW · 周一 5月8日           │  目标 ──     │
│ 240px  │  H1 让备考从刷题变成思考          │  距笔试 78d  │
│ Side   │  3-up Metric: 行测 67 · 申论 62 · 错题 38│ 周节奏    │
│        │  ─────                          │  AI 建议     │
│        │  今日任务 (PlanRow ×3)           │              │
│        │  最近一次模考 (Result preview)   │  快捷入口    │
│        │  本周覆盖 (热力 calendar)        │              │
└────────┴─────────────────────────────────┴──────────────┘
```

## 关键交互
- 顶部 H1 用 serif 56px，配 eyebrow `周一 · 5月8日 · MOCK 倒计时 D-78`
- 三个 MetricCard：行测正确率 / 申论均分 / 待复习错题。每个右下小 sparkline (7 天)
- 任务行三种状态：`未开始 / 进行中 / 已完成`，悬停整行变 paper-2，右侧显示 `继续 →`
- "最近一次模考" 是 `05` 报告的紧凑版（分数 + 三句 AI 复盘 + "查看完整 →"）
- 右栏顶部"目标"是一条窄进度条，写明"距 2026 国考 78 天"

## 数据
```ts
type DashboardVM = {
  greeting: { date: string; daysToExam: number };
  metrics: { xingceAcc: number; essayAvg: number; wrongUnreviewed: number; trends: number[][] };
  todayTasks: PlanItem[];
  recentAttempt: Attempt | null;
  weekHeat: { date: string; minutes: number }[];
  aiHints: string[]; // 短句 ≤30 字
};
```

## 验收
- [ ] 1920 屏完整呈现，没有横向滚动
- [ ] `data-density="compact"` 时整体高度收一档
- [ ] 没有任何 emoji；图标全是描边 SVG
- [ ] "继续 →" 是有效链接，跳到对应 03/04
