# Phase-Review · 07 · Smart Review Aggregation

> **Status**: ACCEPTED (REWRITTEN)
> **Last Updated**: 2026-05-21
> **前置阅读**：[00-Decisions](./00-Decisions.md) §3（D-R4 / D-R5）· [04-Frontend-WU](./04-Frontend-WU.md) WU-FR4 · [12-Debt-Management](./12-Debt-Management.md) · [14-Confidence-Rating](./14-Confidence-Rating.md)

---

## 1. 概述

S-front 聚合算法**完全运行在浏览器端**（D8 / R-2），无后端专用 endpoint。
- 输入：已从 API 获取的 ReviewItemV2 列表 + 最近 N=200 PracticeSessionAnswerV2
- 输出：3 张智能卡数据 + 推荐 session 长度
- 触发：`/review` 默认视图加载时，由 `useSmartReviewCards` hook 计算

### 1.1 修订范围

本次修订相比 v1 增加：
1. **新手三卡 fallback**（items < 5 时不再隐藏，改为新手版三卡）
2. **CardA 双轴聚合**（category_l2 + cause_tag）
3. **CardC mismatch 加权**（certain+错 ×3, is_hard ×2）
4. **useRecommendedSessionLength**（智能 session 长度推荐）
5. **debt-aware**（使用 original_overdue_at 而非被打散的 next_review_at）
6. **ramp-up 模式自适应**（critical 期间隐藏 CardC）
7. **P75 percentile 阈值**（取代固定 threshold=3）

---

## 2. 输入数据

### 2.1 ReviewItemForAggregation（升级）

```typescript
interface ReviewItemForAggregation {
  id: number;
  questionId: number;
  sourceKind: ReviewSourceKind;
  status: ReviewItemStatus;        // pending / in_progress / probationary / graduated / archived
  correctStreak: number;
  nextReviewAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: {
    lastReviewedAt: string | null;
    lastAnswerHash: string | null;
    debtStatus: "due" | "deferred" | "redistributed" | "ramp_up_protected" | null;
    originalOverdueAt: string | null;        // 打散前的 next_review_at（聚合时用）
    isHard: boolean;
    reFailCount: number;
    confidenceMismatchCount: number;
    lastConfidence: ConfidenceLevel | null;
    forcedCauseAnalysisPending: boolean;
  };
  questionEnvelope: {
    categoryL1: string;
    categoryL2: string;             // ← 新增使用
    categoryL3: string | null;
    questionType: string;
    historicalAccuracy: number | null;  // 题目历史正确率（已下沉到 Practice schema）
  } | null;
}
```

### 2.2 RecentAnswerForAggregation（升级）

```typescript
interface RecentAnswerForAggregation {
  questionId: number;
  isCorrect: boolean;
  confidence: ConfidenceLevel | null;   // ← 新增
  answeredAt: string;
  sessionId: number;
  durationS: number | null;             // ← 新增（用于 session 长度推荐）
}
```

### 2.3 RecentCauseAnalysisForAggregation（新增）

最近 30 条用户的 cause-analysis 结果，用于 CardA 双轴聚合：

```typescript
interface RecentCauseAnalysisForAggregation {
  analysisId: number;
  questionId: number;
  effectiveDimensions: { slug: string; severity: "high" | "medium" | "low" }[];  // 含 user_override
  createdAt: string;
}
```

### 2.4 DebtSnapshotForAggregation（新增）

```typescript
interface DebtSnapshotForAggregation {
  severity: "none" | "light" | "moderate" | "heavy" | "critical";
  rampupActive: boolean;
  rampupPhase: "day_1" | "day_2" | "day_3" | "day_4" | null;
  // 注意：day 5 = rampupActive 已变为 false + rampupPhase=null
  // （5 阶段中第 5 阶段恢复正常，此时 rampupActive=false，前端走 standard 模式）
}
```

---

## 3. 入口与模式判断

```typescript
type AggregationMode =
  | "newcomer"          // items < 5 → 新手三卡
  | "rampup"            // debt.rampupActive=true → 简化版（隐藏 CardC）
  | "standard"          // 正常 → 标准三卡（CardA 双轴 + CardB + CardC 加权）

function determineMode(
  items: ReviewItemForAggregation[],
  debt: DebtSnapshotForAggregation,
): AggregationMode {
  if (debt.rampupActive) return "rampup";
  if (items.filter(i => i.status === "pending" || i.status === "in_progress").length < 5) return "newcomer";
  return "standard";
}
```

---

## 4. Newcomer 三卡（items < 5）

### 4.1 设计原则

不直接展示 EmptyState，而是给新用户一个"温和"的引导版三卡，建立"复盘 tab 是有用的"心智。

### 4.2 三卡内容

```typescript
function computeNewcomerCards(
  items: ReviewItemForAggregation[],
  recentAnswers: RecentAnswerForAggregation[],
  notes: NoteV2Light[],          // 题级笔记（query 拉取，仅供 newcomer 用）
  todayChallenge: QuestionV2Light | null,
): SmartCard[] {
  const cards: SmartCard[] = [];

  // ─── CardA-Newcomer: 首次接触科目入门题 ───
  const subjectCards = computeFirstEncounterSubject(recentAnswers);
  if (subjectCards) cards.push(subjectCards);

  // ─── CardB-Newcomer: 已答未做笔记 ───
  const noNotesCards = computeAnsweredButNoNotes(items, notes);
  if (noNotesCards) cards.push(noNotesCards);

  // ─── CardC-Newcomer: 今日真题挑战 ───
  if (todayChallenge) {
    cards.push({
      type: "today_challenge_newcomer",
      title: "今日真题挑战",
      subtitle: `${todayChallenge.categoryL1} · 公考真题`,
      questionIds: [todayChallenge.id],
      count: 1,
      ctaLabel: "开始挑战",
      mode: "newcomer",
    });
  }

  return cards;
}
```

### 4.3 CardA-Newcomer：首次接触科目

```typescript
function computeFirstEncounterSubject(
  recentAnswers: RecentAnswerForAggregation[],
): SmartCard | null {
  if (recentAnswers.length === 0) return null;

  // 找用户最少接触的科目（按 categoryL1 计数最少）
  const subjectCounts: Record<string, number> = {};
  for (const a of recentAnswers) {
    const cat = a.questionEnvelope?.categoryL1;
    if (!cat) continue;
    subjectCounts[cat] = (subjectCounts[cat] ?? 0) + 1;
  }

  const sorted = Object.entries(subjectCounts).sort((a, b) => a[1] - b[1]);
  if (sorted.length === 0) return null;

  const [leastSubject] = sorted[0];
  return {
    type: "first_encounter_newcomer",
    title: `开始接触：${leastSubject}`,
    subtitle: `做 5 道入门题，建立题感`,
    queryFilter: { categoryL1: leastSubject, difficulty: "easy", limit: 5 },
    count: 5,
    ctaLabel: "开始入门",
    mode: "newcomer",
  };
}
```

### 4.4 CardB-Newcomer：已答未做笔记

```typescript
function computeAnsweredButNoNotes(
  items: ReviewItemForAggregation[],
  notes: NoteV2Light[],
): SmartCard | null {
  const noteQuestionIds = new Set(notes.map(n => n.linkedQuestionId).filter(Boolean));
  const candidates = items.filter(i =>
    i.questionId &&
    !noteQuestionIds.has(i.questionId) &&
    (i.status === "pending" || i.status === "in_progress"),
  );

  if (candidates.length === 0) return null;

  return {
    type: "no_notes_newcomer",
    title: "复习要做笔记",
    subtitle: `${candidates.length} 道答过的题尚无笔记，写一句记忆点`,
    questionIds: candidates.slice(0, 10).map(i => i.questionId!),
    count: Math.min(candidates.length, 10),
    ctaLabel: "去写笔记",
    mode: "newcomer",
  };
}
```

---

## 5. Rampup 三卡（debt.rampupActive）

### 5.1 设计原则

回归用户脆弱，避免推送过多。三卡降级为 2 卡（隐藏 CardC，避免"预测再错"心理负担）。

### 5.2 内容

```typescript
function computeRampupCards(
  items: ReviewItemForAggregation[],
  recentAnswers: RecentAnswerForAggregation[],
  rampupPhase: string,
): SmartCard[] {
  const cards: SmartCard[] = [];

  // CardA-Rampup: 仅推 manual_add + re_failed（用户主动性强的题）
  const userInitiated = items.filter(i =>
    (i.sourceKind === "manual_add" || i.sourceKind === "re_failed") &&
    (i.status === "pending" || i.status === "in_progress"),
  );

  if (userInitiated.length > 0) {
    cards.push({
      type: "user_initiated_rampup",
      title: "你曾主动加入的题",
      subtitle: `这些是你重视的题，回归先做这些`,
      questionIds: userInitiated.slice(0, 10).map(i => i.questionId!).filter(Boolean),
      count: Math.min(userInitiated.length, 10),
      ctaLabel: "继续",
      mode: "rampup",
    });
  }

  // CardB-Rampup: 长期未碰（同 standard 但简化文案）
  const stale = computeStaleItems(items, /* useOriginalOverdue */ true);
  if (stale) {
    stale.title = "捡回久违的题";
    stale.subtitle = `${stale.count} 道题超过 14 天未碰，恢复节奏`;
    stale.mode = "rampup";
    cards.push(stale);
  }

  // CardC 不展示（避免负担）

  return cards;
}
```

---

## 6. Standard 三卡（核心逻辑）

### 6.1 CardA — 高频错点（双轴聚合 category_l2 + cause_tag）

#### 6.1.1 双轴算法

```typescript
function computeCardA(
  items: ReviewItemForAggregation[],
  recentAnswers: RecentAnswerForAggregation[],
  recentAnalyses: RecentCauseAnalysisForAggregation[],
): SmartCard | null {
  const cutoff = subDays(now(), 14);

  // Step 1: 14 天内错误答案
  const recentWrong = recentAnswers.filter(
    a => !a.isCorrect && new Date(a.answeredAt) >= cutoff,
  );
  if (recentWrong.length === 0) return null;

  // Step 2: 双轴聚合 key = categoryL2 + cause_tag_slug
  type AxisKey = string;  // "categoryL2::tag_slug"
  const axisErrors = new Map<AxisKey, AxisErrorEntry>();

  for (const ans of recentWrong) {
    const item = items.find(i => i.questionId === ans.questionId);
    const cat = item?.questionEnvelope?.categoryL2;
    if (!cat) continue;

    // 找该题最近的 analysis dimensions（如有）
    const analysis = recentAnalyses
      .filter(a => a.questionId === ans.questionId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    const dimSlugs = analysis?.effectiveDimensions.map(d => d.slug) ?? ["unknown"];

    for (const slug of dimSlugs) {
      const key = `${cat}::${slug}`;
      const entry = axisErrors.get(key) ?? {
        category: cat,
        slug,
        count: 0,
        questionIds: new Set<number>(),
        weightSum: 0,
      };
      entry.count += 1;
      entry.questionIds.add(ans.questionId);
      // 加权：confidence_mismatch / is_hard / severity=high
      let weight = 1;
      if (ans.confidence === "certain") weight *= 3;        // certain+错 mismatch
      if (item?.metadata.isHard) weight *= 2;
      const sev = analysis?.effectiveDimensions.find(d => d.slug === slug)?.severity;
      if (sev === "high") weight *= 1.5;
      entry.weightSum += weight;
      axisErrors.set(key, entry);
    }
  }

  // Step 3: 用户 P75 阈值（取代固定 3）
  const counts = [...axisErrors.values()].map(e => e.count);
  const threshold = Math.max(2, computePercentile(counts, 0.75));  // 至少 ≥ 2

  // Step 4: 过滤 + 按 weightSum 排序
  const qualified = [...axisErrors.values()]
    .filter(e => e.count >= threshold)
    .sort((a, b) => b.weightSum - a.weightSum);

  if (qualified.length === 0) return null;

  // Step 5: 取 top 1 axis
  const top = qualified[0];
  const tagDisplay = lookupTagName(top.slug) ?? "未知错因";  // [13] 词典查询
  return {
    type: "high_frequency_dual_axis",
    title: `高频错点：${top.category} · ${tagDisplay}`,
    subtitle: `近 14 天错 ${top.count} 次，涉及 ${top.questionIds.size} 题`,
    questionIds: [...top.questionIds].slice(0, 20),
    count: Math.min(top.questionIds.size, 20),
    ctaLabel: "集中突破",
    mode: "standard",
    metadata: {
      category: top.category,
      causeTagSlug: top.slug,
      weightSum: top.weightSum,
    },
  };
}

interface AxisErrorEntry {
  category: string;
  slug: string;
  count: number;
  questionIds: Set<number>;
  weightSum: number;
}
```

#### 6.1.2 阈值速查

| recentWrong 数 | P75 threshold | 兜底 |
|---|---|---|
| 0~3 | 自动按 ≥2 | 至少 2 次 |
| 4~10 | P75 ~3 | — |
| 11~30 | P75 ~5-7 | — |
| > 30 | P75 ~10+ | — |

不再使用固定阈值，避免活跃用户/低活用户体验割裂。

#### 6.1.3 加权速查

| 信号 | 权重 |
|---|---|
| 默认 | × 1 |
| confidence=certain（mismatch） | × 3 |
| is_hard | × 2 |
| dim severity=high | × 1.5 |
| 三个组合（certain + hard + high） | × 9 |

---

### 6.2 CardB — 长期未碰（debt-aware）

#### 6.2.1 算法

```typescript
function computeCardB(
  items: ReviewItemForAggregation[],
): SmartCard | null {
  const cutoff = subDays(now(), 14);

  const stale = items.filter(item => {
    if (item.status === "graduated" || item.status === "archived") return false;
    if (item.status === "probationary") return false;  // probationary 由 SRS 处理

    const lastReviewed = item.metadata.lastReviewedAt
      ? new Date(item.metadata.lastReviewedAt)
      : null;

    // ★ 关键：使用 originalOverdueAt（打散前）而非 nextReviewAt（被打散后挪到未来）
    // 否则被打散的题永远不会进入 CardB
    const effectiveDueAt = item.metadata.originalOverdueAt
      ? new Date(item.metadata.originalOverdueAt)
      : (item.nextReviewAt ? new Date(item.nextReviewAt) : null);

    const isStaleByLastReview = lastReviewed && lastReviewed < cutoff;
    const isOverdueByEffective = effectiveDueAt && effectiveDueAt < cutoff;

    return isStaleByLastReview || isOverdueByEffective;
  });

  if (stale.length === 0) return null;

  // 按 staleness 排序（越久越前）
  const sorted = stale.sort((a, b) => {
    const aDate = a.metadata.lastReviewedAt
      ?? a.metadata.originalOverdueAt
      ?? a.createdAt;
    const bDate = b.metadata.lastReviewedAt
      ?? b.metadata.originalOverdueAt
      ?? b.createdAt;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });

  const questionIds = sorted.slice(0, 20).map(i => i.questionId).filter(Boolean) as number[];
  return {
    type: "long_unreviewed",
    title: "长期未碰",
    subtitle: `${questionIds.length} 道题已超过 14 天未复盘`,
    questionIds,
    count: questionIds.length,
    ctaLabel: "立即复盘",
    mode: "standard",
  };
}
```

---

### 6.3 CardC — 预测再错（mismatch 加权）

#### 6.3.1 算法

```typescript
function computeCardC(
  items: ReviewItemForAggregation[],
  recentAnswers: RecentAnswerForAggregation[],
): SmartCard | null {
  // Step 1: 候选 = correct_streak=0 + 非毕业/归档
  const candidates = items.filter(item =>
    item.correctStreak === 0 &&
    item.status !== "graduated" &&
    item.status !== "archived" &&
    item.status !== "probationary"
  );

  // Step 2: 错误次数与 mismatch 计数
  const errorCounts = new Map<number, number>();
  const mismatchCounts = new Map<number, number>();
  for (const ans of recentAnswers) {
    if (!ans.isCorrect) {
      errorCounts.set(ans.questionId, (errorCounts.get(ans.questionId) ?? 0) + 1);
      if (ans.confidence === "certain") {
        mismatchCounts.set(ans.questionId, (mismatchCounts.get(ans.questionId) ?? 0) + 1);
      }
    }
  }

  // Step 3: 过滤 error_count >= 2
  const atRisk = candidates.filter(item => (errorCounts.get(item.questionId!) ?? 0) >= 2);
  if (atRisk.length === 0) return null;

  // Step 4: 加权评分
  const scored = atRisk.map(item => {
    const qid = item.questionId!;
    const errCount = errorCounts.get(qid) ?? 0;
    const mismatch = mismatchCounts.get(qid) ?? 0;

    // 用 originalOverdueAt 计算 days_overdue（debt-aware）
    const effectiveDueAt = item.metadata.originalOverdueAt
      ? new Date(item.metadata.originalOverdueAt)
      : (item.nextReviewAt ? new Date(item.nextReviewAt) : null);
    const daysOverdue = effectiveDueAt
      ? Math.max(0, differenceInDays(now(), effectiveDueAt))
      : 0;

    // 综合得分公式
    let score = errCount * (1 + daysOverdue * 0.1);
    score *= 1 + mismatch * 2;            // mismatch 系数
    if (item.metadata.isHard) score *= 2;  // hard 题加权

    return { item, score };
  }).sort((a, b) => b.score - a.score);

  const questionIds = scored.slice(0, 20).map(s => s.item.questionId!);
  return {
    type: "predicted_re_fail",
    title: "预测再错",
    subtitle: `${questionIds.length} 道题再错风险高`,
    questionIds,
    count: questionIds.length,
    ctaLabel: "重点攻克",
    mode: "standard",
  };
}
```

#### 6.3.2 评分公式（修订）

```
score = error_count × (1 + days_overdue × 0.1)
       × (1 + mismatch_count × 2)
       × (is_hard ? 2 : 1)

其中：
  error_count    = 该题在最近 200 答题中错误次数
  days_overdue   = max(0, today - originalOverdueAt)（注意用 original）
  mismatch_count = 该题中 confidence=certain + is_correct=false 的次数
  is_hard        = ReviewItemV2.metadata.isHard
```

举例：
- 普通题错 3 次 + 逾期 5d → 3 × 1.5 × 1 × 1 = 4.5
- 普通题错 3 次 + mismatch 1 次 + 逾期 5d → 3 × 1.5 × 3 × 1 = 13.5
- hard 题错 3 次 + mismatch 2 次 + 逾期 10d → 3 × 2 × 5 × 2 = 60

---

## 7. useRecommendedSessionLength（智能 session 长度推荐）

### 7.1 算法

```typescript
function useRecommendedSessionLength(
  recentAnswers: RecentAnswerForAggregation[],
  options?: { defaultLength?: number },
): number {
  const default_ = options?.defaultLength ?? 15;

  // 取最近 7 天的 sessions
  const cutoff = subDays(now(), 7);
  const recent = recentAnswers.filter(a => new Date(a.answeredAt) >= cutoff);
  if (recent.length === 0) return default_;

  // 按 sessionId 分组
  const sessionGroups = groupBy(recent, "sessionId");
  const sessionStats = Object.values(sessionGroups).map(answers => ({
    questionCount: answers.length,
    avgDuration: average(answers.map(a => a.durationS).filter(Boolean) as number[]),
    completed: answers.length >= 5,  // 假设 ≥5 题为完整完成
  }));

  if (sessionStats.length === 0) return default_;

  const avgQuestionPerSession = average(sessionStats.map(s => s.questionCount));
  const completionRate = sessionStats.filter(s => s.completed).length / sessionStats.length;
  const avgDurationS = average(sessionStats.map(s => s.avgDuration).filter(Boolean));

  // 目标：用户能在 15-25 分钟内完成 + 完成率 > 70%
  const targetMinutes = 20;
  const targetSeconds = targetMinutes * 60;
  let recommended = Math.floor(targetSeconds / Math.max(avgDurationS || 60, 30));

  // 完成率低 → 减少
  if (completionRate < 0.5) recommended = Math.floor(recommended * 0.7);
  if (completionRate < 0.3) recommended = Math.floor(recommended * 0.5);

  // 最近习惯 alignment
  recommended = Math.round((recommended + avgQuestionPerSession) / 2);

  // Clamp 到 [5, 30] 5 题为单位
  return Math.max(5, Math.min(30, Math.round(recommended / 5) * 5));
}
```

### 7.2 阶梯输出

最终推荐落到 5/10/15/20/25/30 之一，避免 17 道这种奇怪的数字。

### 7.3 三卡 CTA 默认携带

```typescript
function buildCardCTA(card: SmartCard, recommendedLength: number): CTAConfig {
  return {
    label: card.ctaLabel,
    sessionLength: Math.min(recommendedLength, card.count),
    sourceMode: "wrong_redo",       // 复用 PracticeSessionV2 source_mode
    questionIds: card.questionIds.slice(0, recommendedLength),
  };
}
```

UI 展示："集中突破 · 推荐 15 道"（如果 count=20 + recommended=15）。

### 7.4 用户调整入口

CTA 按钮右侧"⚙️"小按钮 → 打开 `<SessionLengthAdjuster>` modal：
- 5 / 10 / 15 / 20 / 25 / 30 题（5 个 chip）
- 默认高亮系统推荐
- 用户选择后写入 `localStorage.preferred_session_length`，下次默认这个值（覆盖系统推荐）

---

## 8. 输出结构（修订）

```typescript
type SmartCardType =
  // Newcomer
  | "first_encounter_newcomer" | "no_notes_newcomer" | "today_challenge_newcomer"
  // Rampup
  | "user_initiated_rampup" | "long_unreviewed" /* shared */
  // Standard
  | "high_frequency_dual_axis" | "predicted_re_fail";

interface SmartCard {
  type: SmartCardType;
  title: string;
  subtitle: string;
  questionIds: number[];                                // 已选定的具体题；newcomer 也可用 queryFilter
  queryFilter?: { categoryL1?: string; difficulty?: string; limit?: number };
  count: number;
  ctaLabel: string;
  mode: AggregationMode;
  metadata?: Record<string, unknown>;
}

interface UseSmartReviewCardsReturn {
  cards: SmartCard[];
  recommendedSessionLength: number;
  mode: AggregationMode;
  isLoading: boolean;
}
```

---

## 9. 性能优化（修订）

| 策略 | 实现 |
|---|---|
| `useMemo` | 所有聚合计算包裹 useMemo，依赖 [items, answers, analyses, debt] |
| `debounce` | 输入变化时 150ms debounce |
| 题目数上限 | 每张卡最多 20；newcomer CardC 最多 1 |
| 早返回 | items < 5 不进 standard 路径 |
| useRecentCauseAnalyses staleTime | 5min（错因分析变化不频繁） |
| useNotesLight staleTime | 5min（newcomer 用） |
| useDebtSnapshot staleTime | 30s（影响模式判断） |
| 双轴聚合 cache | useMemo with hash key（answers.length + analyses.length） |

---

## 10. 空状态处理（修订）

| 条件 | 行为 |
|---|---|
| items=0 + answers=0 | 完全空状态："还没开始练习，去 Practice tab 做几道题吧" + CTA 跳转 |
| items=0 + answers>0 | newcomer 模式：仅 CardA-Newcomer 有数据 |
| 1 ≤ items < 5 | newcomer 模式：完整 3 卡（CardA-Newcomer + CardB-Newcomer + CardC-Newcomer） |
| items ≥ 5 + standard 全为 null | 显示 "继续练习，更多智能推荐即将解锁" |
| Rampup 模式 + 仅 CardB 有数据 | 显示 1 卡 + 文案"回归恢复中，先做这些" |
| Rampup 模式 + 全为 null | "回归首日，请先做今日推荐数（见顶部 DebtBar）" |

---

## 11. 测试场景（升级到 24 个）

| # | 场景 | 期望 |
|---|---|---|
| S1 | 0 items + 0 answers | mode=newcomer, 全空状态文案 |
| S2 | 4 items（< 5）| mode=newcomer, 三卡新手版 |
| S3 | 0 answers + 0 notes（新手） | CardA-Newcomer=null, CardB-Newcomer=null, CardC-Newcomer 有今日挑战 |
| S4 | newcomer 推送的科目 | 用户最少接触的 categoryL1 |
| S5 | newcomer + 已答题但无笔记 | CardB-Newcomer 有数据 |
| S6 | rampup 模式（debt.rampupActive=true） | mode=rampup, 仅 CardA-Rampup + CardB（CardC 隐藏） |
| S7 | rampup CardA = manual_add + re_failed | 不含 wrong_answer / flagged |
| S8 | standard CardA 双轴聚合 | top axis = categoryL2 + cause_tag |
| S9 | standard CardA 加权（certain mismatch） | 错 1 次但 mismatch=1 排序高于错 2 次无 mismatch |
| S10 | standard CardA P75 阈值 | recentWrong=20 时 threshold ~5 而非固定 3 |
| S11 | standard CardA hard 加权 | hard 题 weightSum 高 |
| S12 | standard CardB 用 originalOverdueAt | 被打散的题仍能进 CardB |
| S13 | standard CardC mismatch ×3 | mismatch=1 比无 mismatch 高 3 倍 score |
| S14 | standard CardC hard ×2 | hard + mismatch=1 = ×6 |
| S15 | useRecommendedSessionLength 0 数据 | default 15 |
| S16 | useRecommendedSessionLength 高完成率 | 推荐贴近用户 avg |
| S17 | useRecommendedSessionLength 低完成率（30%） | × 0.5 系数 |
| S18 | useRecommendedSessionLength 输出阶梯 | ∈ {5,10,15,20,25,30} |
| S19 | 用户偏好覆盖系统推荐 | localStorage 优先 |
| S20 | items.length=4 + 偶有 answer | newcomer 模式正确触发 |
| S21 | items.length=5 + answers=0 | standard 模式但所有 standard 卡可能 null |
| S22 | 三种 mode 切换无 race | useMemo 依赖正确 |
| S23 | CardA tag display 用词典查 | name_display 正确（concept_confusion → "概念混淆"） |
| S24 | CardA 全部 dim slug=other | 仍能聚合，title 含"其他错因"标签 |

---

## 12. 与既有设计的边界

### 12.1 与 14-Confidence-Rating

- CardA 加权：confidence=certain → ×3
- CardC 加权：mismatch_count → ×(1 + 2n)

### 12.2 与 13-Cause-Taxonomy

- CardA 双轴聚合用 effective_dimensions（含 user_override）
- tag display 用 [13] 词典查询（`lookupTagName(slug)`）
- recentAnalyses query staleTime 5min

### 12.3 与 12-Debt-Management

- 模式判断：`debt.rampupActive` → rampup mode
- CardB 用 `metadata.originalOverdueAt` 而非 `nextReviewAt`
- CardC 同上

### 12.4 与 05-SRS-Engine

- probationary 状态在 Standard CardC 中**排除**（避免推送系统抽查题）
- early_graduated 不影响聚合（已 probationary）

### 12.5 与 04-Frontend-WU

- WU-FR4 实施需要：useSmartReviewCards 改造 + useRecommendedSessionLength 新建 + useRecentCauseAnalyses 新建 + useNotesLight 新建 + 3 卡组件改造
- 新增 SessionLengthAdjuster modal

### 12.6 与 09-Cross-Tab-Wiring

- 三卡 CTA `sessionLength` 写入 PracticeSessionV2.config_snapshot.recommended_length
- queryFilter 用于 newcomer CardA：跳转 Practice 时带参数

---

## 13. 引用矩阵

| 本文被引用 |
|---|
| [00-Decisions](./00-Decisions.md) §3 D-R4 / D-R5 |
| [04-Frontend-WU](./04-Frontend-WU.md) WU-FR4 |
| [09-Cross-Tab-Wiring](./09-Cross-Tab-Wiring.md) CTA 跳转参数 |
| [11-Testing](./11-Testing.md) S1~S24 测试矩阵 |
| [12-Debt-Management](./12-Debt-Management.md) rampup mode + originalOverdueAt |
| [13-Cause-Taxonomy](./13-Cause-Taxonomy.md) 双轴聚合 + tag display |
| [14-Confidence-Rating](./14-Confidence-Rating.md) 加权信号 |
