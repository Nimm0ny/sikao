import { cn } from '@sikao/shared-utils';
import { MvpCard } from '@/components/mvp';
import { DASHBOARD_COPY } from '@/lib/ui-copy';
import { dashboardLoopStageIds, type DashboardLoopStageId } from './dashboardLoopModel';

const stageItems: readonly {
  readonly id: DashboardLoopStageId;
  readonly label: string;
  readonly hint: string;
}[] = dashboardLoopStageIds.map((id) => ({
  id,
  label: DASHBOARD_COPY.loop.stages[id],
  hint: DASHBOARD_COPY.loop.hints[id],
}));

export function DashboardLoopStageCard({
  activeStage,
}: {
  readonly activeStage: DashboardLoopStageId;
}) {
  return (
    <MvpCard className="p-5" testId="dashboard-loop-stage">
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-tiny font-semibold uppercase tracking-eyebrow text-accent">
            {DASHBOARD_COPY.loop.currentLabel}
          </p>
          <h2 className="mt-1 text-h3 font-semibold text-ink">{DASHBOARD_COPY.loop.title}</h2>
        </div>
      </div>
      <ol className="grid gap-2 md:grid-cols-7">
        {stageItems.map((stage, index) => {
          const active = stage.id === activeStage;
          return (
            <li
              key={stage.id}
              className={cn(
                'rounded-card border p-3',
                active ? 'border-accent bg-accent-50 text-accent' : 'border-line bg-paper-2 text-ink-3',
              )}
              data-testid={active ? 'dashboard-loop-stage-active' : undefined}
            >
              <span className="font-mono text-tiny tabular-nums">{index + 1}</span>
              <p className="mt-2 text-body font-semibold">{stage.label}</p>
              <p className="mt-1 text-tiny leading-snug text-inherit">{stage.hint}</p>
            </li>
          );
        })}
      </ol>
    </MvpCard>
  );
}
