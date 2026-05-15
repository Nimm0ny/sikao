import { useEffect, useState } from 'react';
import { useWeeklyProgress, useAccuracyTrend } from '@sikao/api-client/queries/progressQueries';
import { useNationalExamCountdown } from '@sikao/api-client/queries/examEventsQueries';
import { trackEvent } from '@/lib/analytics';

// PR-6 MVP: /progress -- progress dashboard.
const TREND_DAYS = [7, 30, 90, 180] as const;
type TrendDays = typeof TREND_DAYS[number];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className='p-4 rounded-card' style={{ background: 'var(--paper-2)', boxShadow: 'var(--shadow-card)' }}>
      <p style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>{label}</p>
      <p className='font-bold' style={{ fontSize: 'var(--t-h2)', color: 'var(--ink-1)' }}>{value}</p>
      {sub && <p style={{ fontSize: 'var(--t-tiny)', color: 'var(--ink-4)' }}>{sub}</p>}
    </div>
  );
}

export default function Progress() {
  const [trendDays, setTrendDays] = useState<TrendDays>(30);
  const { data: weekly, isLoading: weeklyLoading } = useWeeklyProgress();
  const { data: trend } = useAccuracyTrend(trendDays);
  const countdown = useNationalExamCountdown();

  useEffect(() => {
    trackEvent({
      eventName: 'progress_viewed',
      properties: { trendDays: String(trendDays) },
    });
  }, [trendDays]);

  const daysLeft = countdown.daysUntil;

  if (weeklyLoading) {
    return <div style={{ padding: 40, fontSize: 'var(--t-body)', color: 'var(--ink-3)' }}>加载中…</div>;
  }

  const peak = trend ? Math.max(...trend.points.map((p) => p.accuracy)) : 0;
  const latest = trend?.points[trend.points.length - 1];

  return (
    <div className='min-h-screen' style={{ background: 'var(--paper-1)' }}>
      <div className='max-w-2xl mx-auto px-4 py-8'>
        <div className='flex items-baseline justify-between mb-6'>
          <h1 className='font-bold' style={{ fontSize: 'var(--t-h2)', color: 'var(--ink-1)' }}>备考进度</h1>
          {daysLeft != null && (
            <p style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>距考试还有 <span style={{ color: 'var(--accent-1)', fontWeight: 700 }}>{daysLeft}</span> 天</p>
          )}
        </div>

        <section className='mb-8'>
          <h2 className='font-medium mb-3' style={{ fontSize: 'var(--t-h3)', color: 'var(--ink-2)' }}>本周概况</h2>
          <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
            <StatCard label='行测题数' value={weekly?.xingceAnswered ?? 0} sub={weekly ? weekly.xingceAccuracy.toFixed(1) + '% 正确率' : undefined} />
            <StatCard label='申论提交' value={weekly?.essaySubmitted ?? 0} />
            <StatCard label='连续天数' value={weekly ? weekly.streakDays + ' 天' : '--'} />
            <StatCard label='任务完成' value={weekly ? weekly.tasksCompleted + '/' + weekly.tasksTotal : '--'} />
          </div>
        </section>

        <section className='mb-8'>
          <div className='flex items-center justify-between mb-3'>
            <h2 className='font-medium' style={{ fontSize: 'var(--t-h3)', color: 'var(--ink-2)' }}>行测正确率趋势</h2>
            <div className='flex gap-2'>
              {TREND_DAYS.map((d) => (
                <button key={d} className='py-1 px-2 rounded-tiny' style={{ fontSize: 'var(--t-tiny)', background: trendDays === d ? 'var(--accent-1)' : 'var(--paper-3)', color: trendDays === d ? '#fff' : 'var(--ink-3)' }} onClick={() => setTrendDays(d)}>{d}天</button>
              ))}
            </div>
          </div>
          <div className='p-4 rounded-card' style={{ background: 'var(--paper-2)', boxShadow: 'var(--shadow-card)' }}>
            {trend && trend.points.length > 0 ? (
              <div>
                <div className='flex gap-4 mb-3'>
                  <span style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>最近: <span style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{latest?.accuracy.toFixed(1)}%</span></span>
                  <span style={{ fontSize: 'var(--t-small)', color: 'var(--ink-3)' }}>峰值: <span style={{ color: 'var(--ok)', fontWeight: 600 }}>{peak.toFixed(1)}%</span></span>
                </div>
                <div className='flex items-end gap-0.5' style={{ height: 80 }}>
                  {trend.points.slice(-30).map((p, i) => (
                    <div key={i} title={p.date + ': ' + p.accuracy.toFixed(1) + '%'}
                      style={{ flex: 1, height: p.accuracy + '%', background: p.accuracy > 70 ? 'var(--ok)' : p.accuracy > 50 ? 'var(--accent-1)' : 'var(--warn)', minHeight: 2, borderRadius: 2 }} />
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 'var(--t-small)', color: 'var(--ink-4)' }}>暂无数据</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
