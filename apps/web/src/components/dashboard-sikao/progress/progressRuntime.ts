import type {
  DashboardProgressResponseV2,
  ProgressTimeseriesResponseV2,
  ProgressWeaknessResponseV2,
} from '@sikao/api-client/types/home';

type SubjectAccuracyV2 = NonNullable<DashboardProgressResponseV2['subjectAccuracies']>[number];
type ProgressTimeseriesPointV2 = NonNullable<ProgressTimeseriesResponseV2['points']>[number];
type WeaknessItemV2 = NonNullable<ProgressWeaknessResponseV2['items']>[number];

export type ProgressMetricKey =
  | 'minutesPracticed'
  | 'itemsAnswered'
  | 'accuracy'
  | 'sessionsCount';

export interface DashboardMetricCard {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}

export interface RadarDatum {
  readonly subject: string;
  readonly accuracy: number;
  readonly answered: number;
}

export interface TimeseriesDatum {
  readonly bucketLabel: string;
  readonly minutesPracticed: number;
  readonly itemsAnswered: number;
  readonly accuracy: number | null;
  readonly sessionsCount: number;
}

function asPercent(value?: string | null): number | null {
  if (value == null) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed * 100;
}

function formatPercent(value?: string | null): string {
  const percent = asPercent(value);
  if (percent == null) return '—';
  return `${Math.round(percent)}%`;
}

function formatMinutes(value: number): string {
  if (value <= 0) return '0 min';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function findSubjectAccuracy(
  subjects: readonly SubjectAccuracyV2[] | undefined,
  keys: readonly string[],
): SubjectAccuracyV2 | null {
  if (!subjects) return null;
  for (const key of keys) {
    const match = subjects.find((subject) => subject.subjectKey === key);
    if (match) return match;
  }
  return null;
}

function bucketLabel(point: ProgressTimeseriesPointV2): string {
  if (point.bucketStart === point.bucketEnd) {
    return point.bucketStart.slice(5);
  }
  return `${point.bucketStart.slice(5)}~${point.bucketEnd.slice(5)}`;
}

export function buildDashboardMetricCards(
  overview: DashboardProgressResponseV2,
): readonly DashboardMetricCard[] {
  const verbal =
    findSubjectAccuracy(overview.subjectAccuracies, ['yanyu', 'language']);
  const judgment =
    findSubjectAccuracy(overview.subjectAccuracies, ['panduan', 'judgment']);

  return [
    {
      label: '今日已答题数',
      value: String(overview.summary.today.itemsAnswered),
      detail: `共 ${overview.summary.today.sessionsCount} 场 session`,
    },
    {
      label: '今日正确率',
      value: formatPercent(overview.summary.today.accuracy),
      detail: `${overview.summary.today.minutesPracticed} 分钟练习`,
    },
    {
      label: '本周分钟',
      value: formatMinutes(overview.summary.week.minutesPracticed),
      detail: `本周 ${overview.summary.week.itemsAnswered} 题`,
    },
    {
      label: '距考试日',
      value:
        overview.nearestExamTarget == null
          ? '—'
          : `${overview.nearestExamTarget.daysUntil} 天`,
      detail: overview.nearestExamTarget?.examName ?? '暂无考试目标',
    },
    {
      label: '言语正确率',
      value: verbal ? formatPercent(verbal.accuracy) : '—',
      detail: verbal ? `${verbal.answered} 题` : '暂无言语数据',
    },
    {
      label: '判断正确率',
      value: judgment ? formatPercent(judgment.accuracy) : '—',
      detail: judgment ? `${judgment.answered} 题` : '暂无判断数据',
    },
  ] as const;
}

export function buildSparklineValues(
  response: ProgressTimeseriesResponseV2,
): readonly (number | null)[] {
  const points = response.points ?? [];
  return points.slice(-7).map((point) => asPercent(point.accuracy));
}

export function buildRadarData(
  overview: DashboardProgressResponseV2,
): readonly RadarDatum[] {
  return (overview.subjectAccuracies ?? [])
    .map((subject) => ({
      subject: subject.subjectLabel,
      accuracy: asPercent(subject.accuracy),
      answered: subject.answered,
    }))
    .filter((subject): subject is RadarDatum => subject.accuracy != null);
}

export function buildTimeseriesData(
  response: ProgressTimeseriesResponseV2,
): readonly TimeseriesDatum[] {
  return (response.points ?? []).map((point) => ({
    bucketLabel: bucketLabel(point),
    minutesPracticed: point.minutesPracticed,
    itemsAnswered: point.itemsAnswered,
    accuracy: asPercent(point.accuracy),
    sessionsCount: point.sessionsCount,
  }));
}

export function buildWeaknessTopThree(
  weakness: ProgressWeaknessResponseV2,
): readonly WeaknessItemV2[] {
  return (weakness.items ?? []).slice(0, 3);
}

export function metricValue(
  point: TimeseriesDatum,
  metric: ProgressMetricKey,
): number | null {
  switch (metric) {
    case 'minutesPracticed':
      return point.minutesPracticed;
    case 'itemsAnswered':
      return point.itemsAnswered;
    case 'accuracy':
      return point.accuracy;
    case 'sessionsCount':
      return point.sessionsCount;
  }
}

export function metricLabel(metric: ProgressMetricKey): string {
  switch (metric) {
    case 'minutesPracticed':
      return '练习分钟';
    case 'itemsAnswered':
      return '已答题数';
    case 'accuracy':
      return '正确率';
    case 'sessionsCount':
      return 'Session 数';
  }
}

export function formatMetricValue(
  metric: ProgressMetricKey,
  value: number | null,
): string {
  if (value == null) return '—';
  if (metric === 'accuracy') return `${Math.round(value)}%`;
  if (metric === 'minutesPracticed') return formatMinutes(value);
  return String(value);
}
