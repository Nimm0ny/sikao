import { Card, StatCallout } from '@sikao/ui/ui';
import { HOME_COPY } from '@/lib/ui-copy';

// Phase B (P0 #5) — Home 错题区轻量卡, 跟 Dashboard `RecentWrongQuestions`
// 视觉去重: Dashboard 显完整 5 条 list (翻看场景), Home 只显 reviewing 总数 +
// 一句简介 + "去错题本 →" CTA (拍肩膀场景, 不展开 list).
//
// 调性 / 决策:
//  - 复用 StatCallout primitive (size="lg" 大数字 serif italic), 跟 Dashboard
//    metric 卡的 visual language 一致, 只是单卡 + 不重复 5 条.
//  - count=undefined 走 loading (skeleton 数字位 "—"), count=0 走 "暂无错题" 副字,
//    count>0 走 "条 · 上次 N 天前" 副字 (lastWrongTime null 时只显 "条").
//  - 微动画: CTA hover translate-x-0.5 + Card hover hairline 微变. 全 motion-safe.

export interface RecentWrongMiniProps {
  /** undefined = loading; 0 = empty; >0 = active. */
  readonly count: number | undefined;
  /** 最近一条错题 lastWrongTime ISO; null = 没错题. */
  readonly lastWrongTime: string | null;
  readonly onNavigate: () => void;
}

function daysAgo(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  const diffMs = now.getTime() - t;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function buildSubtitle(count: number, lastWrongTime: string | null): string {
  if (count === 0) return '暂无错题, 做新题吧';
  if (lastWrongTime == null) return '待复习';
  const d = daysAgo(lastWrongTime);
  return d === 0 ? HOME_COPY.recentWrongHint : `上次 ${d} 天前`;
}

export function RecentWrongMini({
  count,
  lastWrongTime,
  onNavigate,
}: RecentWrongMiniProps) {
  const isLoading = count === undefined;
  const safeCount = isLoading ? 0 : count;

  return (
    <Card
      padding="md"
      hoverable
      data-testid="recent-wrong-mini"
      aria-label={HOME_COPY.recentWrongLabel}
    >
      <div className="flex flex-col gap-3 h-full">
        <StatCallout
          hairline={false}
          size="lg"
          label={HOME_COPY.recentWrongLabel}
          value={isLoading ? '—' : safeCount}
          unit={!isLoading && safeCount > 0 ? '条' : undefined}
          description={
            isLoading ? '加载中…' : buildSubtitle(safeCount, lastWrongTime)
          }
        />
        <div className="mt-auto">
          <button
            type="button"
            onClick={onNavigate}
            data-testid="recent-wrong-mini-cta"
            className={
              'group inline-flex items-center gap-1 text-sm text-ink-3 ' +
              'hover:text-ink transition-colors duration-base ease-motion ' +
              'focus-visible:outline-none focus-visible:underline'
            }
          >
            去错题本
            <span
              aria-hidden="true"
              className={
                'inline-block transition-transform duration-base ease-motion ' +
                'motion-safe:group-hover:translate-x-0.5'
              }
            >
              →
            </span>
          </button>
        </div>
      </div>
    </Card>
  );
}
