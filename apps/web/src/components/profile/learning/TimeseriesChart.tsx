import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, EmptyState, Select } from '@sikao/ui/ui';
import { useProgressTimeseries } from '@sikao/api-client/progressQueries';

import {
  buildTimeseriesData,
  formatMetricValue,
  metricLabel,
  metricValue,
  type ProgressMetricKey,
} from '@/components/dashboard-sikao/progress/progressRuntime';

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

export function TimeseriesChart() {
  const [granularity, setGranularity] = useState<'day' | 'week'>('day');
  const [metric, setMetric] = useState<ProgressMetricKey>('accuracy');
  const to = todayDate();
  const from = granularity === 'day' ? shiftDate(to, -13) : shiftDate(to, -83);
  const query = useProgressTimeseries({
    from,
    to,
    granularity,
  });

  const data = useMemo(
    () => (query.data ? buildTimeseriesData(query.data) : []),
    [query.data],
  );

  if (query.isLoading) {
    return (
      <Card padding="md" className="border-line bg-surface">
        <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
          趋势全量
        </div>
        <div className="mt-2 font-serif text-2xl text-ink">全量趋势图</div>
        <div className="mt-6 h-80 animate-pulse rounded-card bg-line/70" />
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card padding="md" className="border-line bg-surface">
        <EmptyState
          tone="error"
          title="趋势图加载失败"
          description="当前 progress timeseries 无法渲染，请重试。"
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              重试
            </Button>
          }
        />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card padding="md" className="border-line bg-surface">
        <EmptyState
          title="暂无趋势数据"
          description="当前 timeseries 为空，还不能渲染全量趋势图。"
        />
      </Card>
    );
  }

  return (
    <Card padding="md" className="border-line bg-surface" data-testid="profile-learning-timeseries">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
            趋势全量
          </div>
          <div className="mt-2 font-serif text-2xl text-ink">全量趋势图</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            aria-label="timeseries granularity"
            value={granularity}
            onChange={(value) => setGranularity(value as 'day' | 'week')}
            options={[
              { value: 'day', label: '按日' },
              { value: 'week', label: '按周' },
            ]}
            size="sm"
          />
          <Select
            aria-label="timeseries metric"
            value={metric}
            onChange={(value) => setMetric(value as ProgressMetricKey)}
            options={[
              { value: 'accuracy', label: '正确率' },
              { value: 'minutesPracticed', label: '练习分钟' },
              { value: 'itemsAnswered', label: '已答题数' },
              { value: 'sessionsCount', label: 'Session 数' },
            ]}
            size="sm"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <LineChart width={720} height={320} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucketLabel" />
          <YAxis />
          <Tooltip
            formatter={(value) =>
              formatMetricValue(
                metric,
                typeof value === 'number'
                  ? value
                  : value == null
                    ? null
                    : Number(value),
              )
            }
            labelFormatter={(label) => `时间桶 ${String(label)}`}
          />
          <Line
            type="monotone"
            dataKey={metric}
            name={metricLabel(metric)}
            stroke="var(--accent-1)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </div>

      <div className="mt-3 text-sm text-ink-3">
        最新值：{formatMetricValue(metric, metricValue(data[data.length - 1], metric))}
      </div>
      <div className="sr-only">
        <table>
          <caption>趋势图数据表</caption>
          <thead>
            <tr>
              <th>时间桶</th>
              <th>练习分钟</th>
              <th>已答题数</th>
              <th>正确率</th>
              <th>Session 数</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.bucketLabel}>
                <td>{point.bucketLabel}</td>
                <td>{point.minutesPracticed}</td>
                <td>{point.itemsAnswered}</td>
                <td>{formatMetricValue('accuracy', point.accuracy)}</td>
                <td>{point.sessionsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
