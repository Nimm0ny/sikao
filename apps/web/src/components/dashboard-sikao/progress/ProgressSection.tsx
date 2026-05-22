import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, Card, EmptyState, Skeleton } from '@sikao/ui/ui';
import {
  useProgressOverview,
  useProgressTimeseries,
  useProgressWeakness,
} from '@sikao/api-client/progressQueries';

import {
  buildDashboardMetricCards,
  buildSparklineValues,
  buildWeaknessTopThree,
} from './progressRuntime';
import { KeyMetricCard } from './KeyMetricCard';
import { TrendSparkline } from './TrendSparkline';
import { WeaknessTopMini } from './WeaknessTopMini';

function todayDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function shiftDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const current = new Date(year, month - 1, day);
  current.setDate(current.getDate() + deltaDays);
  const nextMonth = String(current.getMonth() + 1).padStart(2, '0');
  const nextDay = String(current.getDate()).padStart(2, '0');
  return `${current.getFullYear()}-${nextMonth}-${nextDay}`;
}

export function ProgressSection() {
  const navigate = useNavigate();
  const to = todayDate();
  const from = shiftDate(to, -6);

  const overviewQuery = useProgressOverview();
  const timeseriesQuery = useProgressTimeseries({
    from,
    to,
    granularity: 'day',
  });
  const weaknessQuery = useProgressWeakness();

  const metricCards = useMemo(
    () => (overviewQuery.data ? buildDashboardMetricCards(overviewQuery.data) : []),
    [overviewQuery.data],
  );
  const sparklineValues = useMemo(
    () => (timeseriesQuery.data ? buildSparklineValues(timeseriesQuery.data) : []),
    [timeseriesQuery.data],
  );
  const weaknessTop = useMemo(
    () => (weaknessQuery.data ? buildWeaknessTopThree(weaknessQuery.data) : []),
    [weaknessQuery.data],
  );

  const isLoading =
    overviewQuery.isLoading || timeseriesQuery.isLoading || weaknessQuery.isLoading;
  const isError =
    overviewQuery.isError || timeseriesQuery.isError || weaknessQuery.isError;

  if (isLoading) {
    return (
      <section className="space-y-4" data-testid="dashboard-progress-section">
        <Card padding="md" className="border-line bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
                Section B
              </div>
              <div className="mt-1 text-2xl font-serif text-ink">学习进度</div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} heightClass="h-28" />
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Skeleton heightClass="h-28" />
            <Skeleton heightClass="h-28" />
          </div>
        </Card>
      </section>
    );
  }

  if (isError) {
    return (
      <section data-testid="dashboard-progress-section">
        <EmptyState
          tone="error"
          title="Section B 加载失败"
          description="当前 progress、timeseries 或 weakness 数据不可用，请重试。"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void overviewQuery.refetch();
                void timeseriesQuery.refetch();
                void weaknessQuery.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      </section>
    );
  }

  if (!overviewQuery.data) {
    return (
      <section data-testid="dashboard-progress-section">
        <EmptyState
          title="暂无学情数据"
          description="还没有足够的 progress 数据来渲染学习进度。"
        />
      </section>
    );
  }

  return (
    <section className="space-y-4" data-testid="dashboard-progress-section">
      <Card padding="md" className="border-line bg-surface">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
              Section B
            </div>
            <div className="mt-1 font-serif text-2xl text-ink">学习进度</div>
            <div className="mt-2 text-sm text-ink-3">
              首页只显示 6 张关键指标卡、一个近期趋势与薄弱项摘要。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/profile/records')}
              data-testid="dashboard-progress-open-records"
            >
              查看记录
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/profile/learning')}
              data-testid="dashboard-progress-open-learning"
            >
              查看详情
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metricCards.map((metric) => (
            <KeyMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              onClick={() => navigate('/profile/learning')}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <TrendSparkline values={sparklineValues} />
          <WeaknessTopMini items={weaknessTop} />
        </div>
      </Card>
    </section>
  );
}
