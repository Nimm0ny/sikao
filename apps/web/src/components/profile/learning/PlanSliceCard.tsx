import { Card } from '@sikao/ui/ui';
import type { DashboardProgressResponseV2 } from '@sikao/api-client/types/home';

interface PlanSliceCardProps {
  readonly overview: DashboardProgressResponseV2;
}

export function PlanSliceCard({ overview }: PlanSliceCardProps) {
  const slice = overview.summary.planSlice;

  return (
    <Card padding="md" className="border-line bg-surface" data-testid="profile-learning-plan-slice">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
            当前计划切片
          </div>
          <div className="mt-2 font-serif text-2xl text-ink">
            {slice.rangeFrom ?? '—'} ~ {slice.rangeTo ?? '—'}
          </div>
        </div>
        <div className="text-right text-sm text-ink-3">
          <div>计划事件 {slice.eventsInWindowTotal}</div>
          <div>已完成 {slice.eventsDone}</div>
          <div>已跳过 {slice.eventsSkipped}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="text-sm text-ink-3">计划目标分钟</div>
          <div className="mt-2 font-serif text-3xl text-ink">
            {slice.minutesTargetInWindow}
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="text-sm text-ink-3">实际练习分钟</div>
          <div className="mt-2 font-serif text-3xl text-ink">
            {slice.minutesPracticedInWindow}
          </div>
        </div>
      </div>
    </Card>
  );
}
