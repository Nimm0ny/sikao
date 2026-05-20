import { StatCallout } from '@sikao/ui/ui';
import type { DashboardStatsV2 } from '@sikao/api-client/types/api';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

// Phase 5.5 —— 顶部 4 张 metric 卡，复用 Phase 5.2 的 StatCallout primitive
// （大 serif italic 数字 + mono eyebrow）。
//
// Phase B (P0 #6) compact mode: Home 用 compact (无 hairline 框 + gap-3),
// Dashboard 用 default (hairline 框 + gap-4). 数字 size 都保持 'md' 不变,
// 视觉差异化核心是「框 vs 无框」+「gap 收紧」, 让用户切换 Home → Dashboard
// 不感觉 "刚才看过同样的 4 卡 grid".

export interface DashboardMetricCardsProps {
  readonly stats: DashboardStatsV2 | undefined;
  /** Compact 模式: Home 摘要场景用 (无框 + gap 收紧); Dashboard 用默认. */
  readonly compact?: boolean;
}

export function DashboardMetricCards({
  stats,
  compact = false,
}: DashboardMetricCardsProps) {
  const s = stats ?? {
    totalAnswered: 0,
    overallAccuracy: 0,
    currentStreakDays: 0,
    masteredPointsCount: 0,
    totalWrongQuestions: 0,
  };
  const accuracyPct = Math.round((s.overallAccuracy || 0) * 100);
  // compact=true: Home 摘要 — 无 hairline 框 (透出底色), gap-3, slash 小.
  //   visually 4 个数字"贴在一起" 像 inline stats bar.
  // compact=false: Dashboard 全景 — hairline 框分立, gap-4, slash 大.
  //   visually 4 个独立 hairline 卡, 像传统 metric grid.
  // size 都用默认 'md' (text-5xl=48px), 不破坏 Dashboard 现状.
  // 视觉差异化核心: 框 vs 无框 + gap 收紧.
  const calloutHairline = !compact;
  // SSOT type ramp (规范官 P1-1 2026-05-08): text-h-card / text-h-section
  // 替代 text-xl / text-3xl, 跟 type ramp token 对齐, 后续改字号阶梯只动一处.
  const slashClass = compact
    ? 'text-ink-3 font-serif italic mx-1 text-h-card'
    : 'text-ink-3 font-serif italic mx-1 text-h-section';
  const gridClass = compact
    ? 'grid grid-cols-2 md:grid-cols-4 gap-3'
    : 'grid grid-cols-2 md:grid-cols-4 gap-4';
  return (
    <div
      className={gridClass}
      data-testid="dashboard-metrics"
      data-compact={compact ? 'true' : 'false'}
    >
      <StatCallout
        hairline={calloutHairline}
        label="累计答题"
        value={s.totalAnswered}
        description={`涵盖所有 session ${DASHBOARD_COPY.metricTotalSuffix}`}
      />
      <StatCallout
        hairline={calloutHairline}
        label={DASHBOARD_COPY.metricAccuracyLabel}
        value={accuracyPct}
        unit="%"
        description="累计答对 / 累计答题"
      />
      <StatCallout
        hairline={calloutHairline}
        label="连续打卡"
        value={s.currentStreakDays}
        unit="天"
        description={DASHBOARD_COPY.metricStreakHint}
      />
      <StatCallout
        hairline={calloutHairline}
        label="已掌握 / 错题本"
        value={
          <>
            {s.masteredPointsCount}
            <span className={slashClass}>/</span>
            {s.masteredPointsCount + s.totalWrongQuestions}
          </>
        }
        description={`做对 2 ${DASHBOARD_COPY.metricMasteredSuffix}`}
      />
    </div>
  );
}
