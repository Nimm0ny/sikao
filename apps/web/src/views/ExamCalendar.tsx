import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircleIcon, RefreshIcon } from '@sikao/ui/icons';
import { Button, EmptyState, PageHeader, Skeleton } from '@sikao/ui/ui';
import { ExamCountdownCard } from '@/components/exam/ExamCountdownCard';
import { sortByUpcoming, daysUntil, type ExamCategory, type ExamEvent } from '@sikao/domain/study-record/exam-calendar';
import { getTrackedExamSlugs } from '@sikao/domain/study-record/exam-tracking';
import { ERROR_COPY, EXAM_COPY } from '@/lib/ui-copy';
import { examEventsKeys, fetchExamEvents } from '@sikao/api-client/apiQueries';
import { cn } from '@sikao/shared-utils';

//
// ARCH §7.3 P3 (2026-04-28): 数据从前端 hardcoded 移到后端 admin 维护.
// 通过 GET /api/v2/exam-events 拉 (visible=True 的 events). admin 通过
// /api/v2/admin/exam-events CRUD endpoints 改 / 加 / 删.
// 视觉调性按 §1.3: 中性, 不喊话 ("再坚持 X 天" → "X 天"). 用户自然懂倒计时含义.
//
// P0-2 + P1-2: 类别 facet (national/provincial/institution/other) + tracked
// 分段. 跟踪的 slug 走 localStorage (lib/exam-tracking.ts), 切 chip / toggle
// 跟踪都是 client-only 操作.

const CATEGORY_FACETS: readonly { value: ExamCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'national', label: '国考' },
  { value: 'provincial', label: '省考' },
  { value: 'institution', label: '事业单位' },
  { value: 'other', label: '其他' },
];

export default function ExamCalendar() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: examEventsKeys.list(),
    queryFn: fetchExamEvents,
  });
  const [categoryFacet, setCategoryFacet] = useState<ExamCategory | 'all'>('all');
  // tracked slugs 不走 React state lazy init (mount 时一次), 跨 toggle 需要
  // re-read; 用 useState + 监听 storage event + window focus 重读.
  const [trackedSlugs, setTrackedSlugs] = useState<ReadonlySet<string>>(() => getTrackedExamSlugs());
  useEffect(() => {
    const refresh = () => setTrackedSlugs(getTrackedExamSlugs());
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    // 同 tab toggle 不触发 storage; ExamCountdownCard 内部 toggle 后通过卡片
    // 重 mount 不会触发 view re-read. 加一个 1s interval 兜底 (轻量, view
    // 通常不长开).
    const tick = window.setInterval(refresh, 1000);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(tick);
    };
  }, []);

  const now = useMemo(() => new Date(), []);
  const events = useMemo<readonly ExamEvent[]>(() => data?.items ?? [], [data]);
  const filtered = useMemo<readonly ExamEvent[]>(() => {
    if (categoryFacet === 'all') return events;
    return events.filter((e) => e.category === categoryFacet);
  }, [events, categoryFacet]);
  const sorted = sortByUpcoming(filtered, now);
  const upcoming = sorted.filter((e) => daysUntil(e.examDate, now) >= 0);
  const past = sorted.filter((e) => daysUntil(e.examDate, now) < 0);
  // P0-2: tracked / others 分段. tracked 集为空 → 不分段, 全显当前 upcoming.
  const upcomingTracked = upcoming.filter((e) => trackedSlugs.has(e.slug));
  const upcomingOthers = upcoming.filter((e) => !trackedSlugs.has(e.slug));
  const showSplit = upcomingTracked.length > 0;

  return (
    <div
      className="max-w-3xl mx-auto p-4 md:p-6 space-y-6"
      data-testid="exam-calendar-view"
    >
      <PageHeader
        title="考试日历"
        subtitle="公考主要考试日期 + 倒计时. 数据基于公开通知 + 往年规律, 公告出后会更新为正式日期."
      />

      {/* P1-2: 类别 facet chip 行. all + 4 类. */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={EXAM_COPY.categoryFilterAria}
        data-testid="exam-calendar-facets"
      >
        {CATEGORY_FACETS.map((opt) => {
          const active = categoryFacet === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setCategoryFacet(opt.value)}
              className={cn(
                'text-xs px-3 py-1 rounded-tiny border transition-colors duration-base motion-safe:hover:-translate-y-0.5',
                active
                  ? 'border-ink bg-ink text-surface font-semibold'
                  : 'border-line text-ink-3 hover:text-ink hover:border-ink',
              )}
              data-testid={`exam-facet-${opt.value}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="exam-calendar-loading">
          <Skeleton heightClass="h-44" />
          <Skeleton heightClass="h-44" />
        </div>
      ) : null}

      {isError ? (
        <EmptyState
          tone="error"
          icon={<AlertCircleIcon className="w-6 h-6" aria-hidden="true" />}
          title={ERROR_COPY.examCalendar.title}
          description={ERROR_COPY.examCalendar.description}
          action={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshIcon className="w-4 h-4" aria-hidden="true" />}
              onClick={() => { void refetch(); }}
              data-testid="exam-calendar-retry"
            >
              重试
            </Button>
          }
        />
      ) : null}

      {!isLoading && !isError && showSplit ? (
        <section data-testid="exam-calendar-tracked">
          <div className="text-tiny font-mono font-semibold tracking-eyebrow text-ink mb-3">
            我跟踪的
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingTracked.map((event) => (
              <ExamCountdownCard key={event.slug} event={event} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      {!isLoading && !isError && upcoming.length > 0 ? (
        <section data-testid="exam-calendar-upcoming">
          <div className="text-tiny font-mono font-semibold tracking-eyebrow text-ink-4 mb-3">
            {showSplit ? '其他考试' : '即将到来'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(showSplit ? upcomingOthers : upcoming).map((event) => (
              <ExamCountdownCard key={event.slug} event={event} now={now} />
            ))}
          </div>
        </section>
      ) : !isLoading && !isError && upcoming.length === 0 ? (
        <p className="text-sm text-ink-3" data-testid="exam-calendar-empty">
          当前无即将到来的考试. 后续公告会同步到本页.
        </p>
      ) : null}

      {!isLoading && !isError && past.length > 0 ? (
        <section data-testid="exam-calendar-past">
          <div className="text-tiny font-mono font-semibold tracking-eyebrow text-ink-4 mb-3">
            已结束
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {past.map((event) => (
              <ExamCountdownCard key={event.slug} event={event} now={now} />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="pt-4 text-xs text-ink-4 leading-relaxed">
        日期未必精确. 标「估」的是按往年规律推算. 一切以官方公告为准.
      </footer>
    </div>
  );
}
