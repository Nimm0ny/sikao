# Phase-Review · 07 · Smart Review Aggregation

> **Status**: ACCEPTED
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §3（D-R4 / D-R5）· [04-Frontend-WU](./04-Frontend-WU.md) WU-FR4

---

## 1. 概述

S-front 聚合算法**完全运行在浏览器端**（D8 / R-2），无后端专用 endpoint。
- 输入：已从 API 获取的 ReviewItemV2 列表 + 最近 N=200 PracticeSessionAnswerV2
- 输出：3 张智能卡数据
- 触发：`/review` 默认视图加载时，由 `useSmartReviewCards` hook 计算

---

## 2. 输入数据

### 2.1 ReviewItemV2[]（用户全部 active 条目）

从 `useReviewItems` 获取（status IN [pending, in_progress]），预期数据量 50~500 条。

关键字段：
```typescript
interface ReviewItemForAggregation {
  id: number;
  questionId: number;
  sourceKind: string;
  status: string;
  correctStreak: number;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: {
    lastReviewedAt: string | null;
    lastAnswerHash: string | null;
  };
  questionEnvelope: {
    categoryL1: string;
    categoryL2: string;
    questionType: string;
  } | null;
}
```

### 2.2 PracticeSessionAnswerV2[]（最近 N=200 条）

从 `useRecentAnswers` 获取（按 answered_at DESC LIMIT 200）。

关键字段：
```typescript
interface RecentAnswerForAggregation {
  questionId: number;
  isCorrect: boolean;
  answeredAt: string;
  sessionId: number;
}
```

---

## 3. Card A — 高频错点（14 天）

### 3.1 算法

```typescript
function computeCardA(
  items: ReviewItemForAggregation[],
  answers: RecentAnswerForAggregation[],
): SmartCard | null {
  const cutoff = subDays(now(), 14);
  
  // Step 1: 筛选 14 天内的错误答案
  const recentWrong = answers.filter(
    a => !a.isCorrect && new Date(a.answeredAt) >= cutoff
  );
  
  // Step 2: 按 category_l1 聚合错误次数
  const categoryErrors: Map<string, { count: number; questionIds: Set<number> }> = new Map();
  
  for (const answer of recentWrong) {
    const item = items.find(i => i.questionId === answer.questionId);
    if (!item?.questionEnvelope?.categoryL1) continue;
    
    const cat = item.questionEnvelope.categoryL1;
    const entry = categoryErrors.get(cat) ?? { count: 0, questionIds: new Set() };
    entry.count += 1;
    entry.questionIds.add(answer.questionId);
    categoryErrors.set(cat, entry);
  }
  
  // Step 3: 过滤 error_count >= threshold (3)
  const THRESHOLD = 3;
  const qualified = [...categoryErrors.entries()]
    .filter(([, v]) => v.count >= THRESHOLD)
    .sort((a, b) => b[1].count - a[1].count);
  
  if (qualified.length === 0) return null;
  
  // Step 4: 取 top 1 类别
  const [topCategory, data] = qualified[0];
  const questionIds = [...data.questionIds].slice(0, 20);
  
  return {
    type: 'high_frequency',
    title: `高频错点：${topCategory}`,
    subtitle: `近 14 天错 ${data.count} 次，涉及 ${questionIds.length} 题`,
    questionIds,
    count: questionIds.length,
    ctaLabel: '集中突破',
  };
}
```

### 3.2 阈值

| 参数 | 值 | 说明 |
|---|---|---|
| 时间窗口 | 14 天 | 近期高频 |
| 最低错误次数 | 3 | 低于 3 次不展示 |
| 取 top N 类别 | 1 | 只展示最严重的 1 个 |
| 最多题目数 | 20 | 超出截断 |

---

## 4. Card B — 长期未碰（>14 天）

### 4.1 算法

```typescript
function computeCardB(
  items: ReviewItemForAggregation[],
): SmartCard | null {
  const cutoff = subDays(now(), 14);
  
  // Step 1: 筛选"长期未碰"的条目
  const stale = items.filter(item => {
    if (item.status === 'graduated' || item.status === 'archived') return false;
    
    const lastReviewed = item.metadata.lastReviewedAt
      ? new Date(item.metadata.lastReviewedAt)
      : null;
    const nextReview = item.nextReviewAt
      ? new Date(item.nextReviewAt)
      : null;
    
    // 条件：lastReviewedAt < cutoff OR nextReviewAt < cutoff
    const isStaleByLastReview = lastReviewed && lastReviewed < cutoff;
    const isOverdueByNext = nextReview && nextReview < cutoff;
    
    return isStaleByLastReview || isOverdueByNext;
  });
  
  if (stale.length === 0) return null;
  
  // Step 2: 按 staleness 排序（越久未碰越前）
  const sorted = stale.sort((a, b) => {
    const aDate = a.metadata.lastReviewedAt || a.createdAt;
    const bDate = b.metadata.lastReviewedAt || b.createdAt;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
  
  // Step 3: 取 top 20
  const questionIds = sorted.slice(0, 20).map(i => i.questionId).filter(Boolean) as number[];
  
  return {
    type: 'long_unreviewed',
    title: '长期未碰',
    subtitle: `${questionIds.length} 道题已超过 14 天未复盘`,
    questionIds,
    count: questionIds.length,
    ctaLabel: '立即复盘',
  };
}
```

---

## 5. Card C — 预测再错

### 5.1 算法

```typescript
function computeCardC(
  items: ReviewItemForAggregation[],
  answers: RecentAnswerForAggregation[],
): SmartCard | null {
  // Step 1: 筛选 correct_streak=0 的条目
  const candidates = items.filter(
    item => item.correctStreak === 0
      && item.status !== 'graduated'
      && item.status !== 'archived'
  );
  
  // Step 2: 计算每题历史错误次数
  const errorCounts = new Map<number, number>();
  for (const answer of answers) {
    if (!answer.isCorrect) {
      errorCounts.set(answer.questionId, (errorCounts.get(answer.questionId) ?? 0) + 1);
    }
  }
  
  // Step 3: 过滤 error_count >= 2
  const atRisk = candidates.filter(item => {
    const errCount = errorCounts.get(item.questionId!) ?? 0;
    return errCount >= 2;
  });
  
  if (atRisk.length === 0) return null;
  
  // Step 4: 加权排序 = error_count * days_overdue_weight
  const scored = atRisk.map(item => {
    const errCount = errorCounts.get(item.questionId!) ?? 0;
    const overduedays = item.nextReviewAt
      ? Math.max(0, differenceInDays(now(), new Date(item.nextReviewAt)))
      : 0;
    const score = errCount * (1 + overduedays * 0.1);
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  
  // Step 5: 取 top 20
  const questionIds = scored.slice(0, 20).map(s => s.item.questionId!);
  
  return {
    type: 'predicted_re_fail',
    title: '预测再错',
    subtitle: `${questionIds.length} 道题再错风险高`,
    questionIds,
    count: questionIds.length,
    ctaLabel: '重点攻克',
  };
}
```

### 5.2 评分公式

```
score = error_count × (1 + days_overdue × 0.1)

其中：
  error_count = 该题在最近 200 次答题中的错误次数
  days_overdue = max(0, today - next_review_at) （逾期天数）
```

---

## 6. 输出结构

```typescript
interface SmartCard {
  type: 'high_frequency' | 'long_unreviewed' | 'predicted_re_fail';
  title: string;
  subtitle: string;
  questionIds: number[];
  count: number;
  ctaLabel: string;
}

// Hook 返回
interface UseSmartReviewCardsReturn {
  cards: SmartCard[];       // 0~3 张
  isLoading: boolean;
  isEmpty: boolean;         // 3 张都为 null
}
```

---

## 7. 性能优化

| 策略 | 实现 |
|---|---|
| **useMemo** | 所有聚合计算包裹 `useMemo`，依赖 items + answers 引用 |
| **debounce** | items / answers 变化时 150ms debounce（防止快速翻页触发重算） |
| **max items** | 每张卡最多 20 条 questionIds，超出截断 |
| **early return** | items.length < 5 时直接返回 empty（数据不足不展示三卡） |
| **分离查询** | useReviewItems 和 useRecentAnswers 独立请求，互不阻塞 |
| **staleTime** | useRecentAnswers staleTime=5min（答题记录变化不频繁） |

---

## 8. 空状态处理

| 条件 | 行为 |
|---|---|
| 全部 3 张卡为 null | 隐藏三卡容器，显示"继续练习，系统会智能推荐复盘内容" |
| 仅 1~2 张卡有数据 | 只渲染有数据的卡，不占位 |
| items 加载中 | 显示 Skeleton（3 卡位占位） |
| items 加载失败 | 隐藏三卡区域，不影响 SRS 队列 |
| items.length < 5 | 不展示三卡（数据量过少，结果无意义） |

---

## 9. 测试场景

| # | 场景 | 期望 |
|---|---|---|
| S1 | 0 条 items | cards=[], isEmpty=true |
| S2 | 4 条 items（< threshold 5） | cards=[], isEmpty=true |
| S3 | 50 items, 所有 14 天内无错 | CardA=null |
| S4 | 50 items, 1 类别 14 天内错 5 次 | CardA 有数据 |
| S5 | 50 items, 无超过 14 天未碰的 | CardB=null |
| S6 | 50 items, 10 条超 14 天 | CardB 有 10 题 |
| S7 | 50 items, 全部 streak>0 | CardC=null |
| S8 | 50 items, 5 条 streak=0 但 error<2 | CardC=null |
| S9 | 50 items, 5 条 streak=0 且 error≥2 | CardC 有 5 题 |
| S10 | 超过 20 条符合某卡条件 | 截断为 20 |
| S11 | answers=[] 空 | CardA=null, CardC=null, CardB 可能有 |
| S12 | 3 张卡全有数据 | cards.length=3 |

---

## 引用矩阵

| 本文被引用 |
|---|
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR4 |
| [11-Testing](./11-Testing.md) 三卡算法测试 |
