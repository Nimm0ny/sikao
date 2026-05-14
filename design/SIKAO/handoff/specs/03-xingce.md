# 03 · 行测练习页（fenbi 列表式）

> HTML 锚点：`03 · 标准版` · `03b · AI Pro` · `03c · 题组`
> 路由：`/practice/xingce/:setId`，AI Pro 加 `?ai=1`

## 共同结构（fenbi 风格 · 列表式答题卡）
```
┌────────────────────────────────────┬─────────────┐
│  FbTopbar (sticky)                 │             │
│   时:分:秒 · 22 / 35 · 答题卡 ·... │  03b only:  │
├────────────────────────────────────┤  AI 右栏    │
│  FbCard #1                         │             │
│   题号 + 题干 (serif 17/1.7)        │             │
│   FbOpt × 4 (圆形 letter)           │             │
│   操作条: ★收藏 ⤴标记 📝笔记       │             │
├────────────────────────────────────┤             │
│  FbCard #2 ...                     │             │
│  ...                               │             │
├────────────────────────────────────┴─────────────┤
│           FbDock (悬浮于底)                       │
│  1 2 3 4 ... 35   提交 →                          │
└──────────────────────────────────────────────────┘
```

## 03 · 标准版（免费）
- 没有 AI 右栏 (`grid-template-columns: 1fr`)
- 答题完一题后选项行被锁定但不显示对错（用户必须完整提交才看 result）
- 底部插一个 `Upsell` 卡片：模糊的 AI 预览 + "解锁 AI 解析 ¥39/月" 按钮

## 03b · AI Pro
- 右栏 320px，sticky，含三块：
  1. **AI 解题思路**（3 步骨架 + 代码块），仅在用户答完该题后展开
  2. **你的画像**（典型陷阱：例 "你常被 D 选项偷换概念"）
  3. **AI 提问**（textarea + 4 个快捷气泡："为什么不是 B" / "再来一道同类" ...）
- 顶部 chip 带 `PRO` 暗朱标记

## 03c · 题组
- 上半部 = `FbPassage`（一段材料，关键数字 / 关联段落用 `.hl` `.hl-ref` 高亮）
- 中部 `FbGroupTabs`（Q12 done · Q13 done · Q14 active · Q15 marked）
- 下半部 = 当前题 FbCard，每个选项右侧带 `⤴ M·段二` 锚点跳回原文

## 关键交互
- 选项点击：圆形 letter 动效从 `--rule` → `--ink` 充满
- 收藏 / 标记 / 笔记 三键：标记态时按钮变暗朱
- 答题卡 dock：圆点 = 未答 / 实心 = 已答 / 描边 = 标记 / 暗朱 = 当前题
- `space` 切换暂停（顶部 timer 变虚线）
- 滚动时 dock 阴影加深 (shadow-2 → shadow-3)

## 数据
```ts
type PracticeVM = {
  set: { id: string; title: string; durationMin: number };
  questions: Question[];          // FbCard.map
  groups?: { id: string; passageId: string; qIds: string[] }[]; // 题组用
  answers: Record<string, string>;
  marks: Set<string>;
  ai?: { stepsByQid: Record<string, AIStep[]>; portrait: PortraitItem[] };
};
```

## 验收
- [ ] 答题区列表的字号是 `var(--read-fs)`，受 Tweak `reading` 控制
- [ ] FbDock 在屏底 fixed，提交按钮是 `Button.primary`
- [ ] 03 没有 AI 元素；03b 的 AI 仅答完后才出现
- [ ] 题组里 `⤴ M·段二` 点击平滑滚动到对应 `<sup id="m1-p2">`
- [ ] 不允许任何 emoji 替代图标
