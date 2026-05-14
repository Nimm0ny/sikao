/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — 子组件 barrel.
 *
 * 跟现有 `components/dashboard/` 平行, 不挤现存 fallback / 其他 view 复用品.
 */

export { FocusCard } from './FocusCard';
export type { FocusCardProps, FocusCardMetric } from './FocusCard';

export { StreakCard } from './StreakCard';
export type { StreakCardProps } from './StreakCard';

export { WeekRhythmCard } from './WeekRhythmCard';
export type { WeekRhythmCardProps } from './WeekRhythmCard';

export { PlanTasksCard } from './PlanTasksCard';
export type { PlanTasksCardProps } from './PlanTasksCard';

export { AiHintCard } from './AiHintCard';
export type { AiHintCardProps } from './AiHintCard';

export { MetricsRow } from './MetricsRow';
export type { MetricsRowProps, MetricEntry } from './MetricsRow';

export { trendToBars } from './helpers';

export { PlaceholderCard } from './PlaceholderCard';
export type { PlaceholderCardProps } from './PlaceholderCard';

export { WeakPointsCard } from './WeakPointsCard';
export type { WeakPointsCardProps } from './WeakPointsCard';

export { HeroGreeting } from './HeroGreeting';
export type { HeroGreetingProps } from './HeroGreeting';
