import type { TrendEntryV2 } from '@sikao/api-client/types/api';

/**
 * Helper: trend 数据按 7 段桶聚合, 高位 (rate > median) 为 on. 拆出文件让
 * react-refresh ESLint 不再把它跟 MetricsRow component 同文件混导出
 * (only-export-components rule).
 *
 * 不强求 caller 用; 复杂场景 caller 可自定 mapping.
 */
export function trendToBars(trend: readonly TrendEntryV2[]): readonly boolean[] {
  if (trend.length === 0) return [false, false, false, false, false, false, false];
  const sorted = [...trend].map((t) => t.rate).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const recent = trend.slice(-7);
  const bars = recent.map((t) => t.rate >= median);
  while (bars.length < 7) bars.unshift(false);
  return bars;
}
