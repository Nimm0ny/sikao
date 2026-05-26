// lint-allow-ui-copy: V5 ProfileLearning chart copy.
/*
 * Charts — recharts-backed ProfileLearning sections.
 *
 * Why: sik-fu-b §2.5 — single React.lazy chunk so vite emits a separate
 *      profile-learning chunk that includes recharts (Home route stays
 *      lean per §6 B7).
 *
 *      Two charts:
 *        - TrendChart (30-day combined bar + line):
 *            bar = daily itemsAnswered, line = 7-day moving average accuracy
 *        - RadarChart (5 categorical modules, current solid + prev dashed):
 *            5 axes (言语/数量/判断/资料/申论); two series (current vs
 *            previous window). prev series renders dashed.
 *
 *      Reduced-motion: ResponsiveContainer + isAnimationActive=false to
 *      prevent transition flicker for users with prefers-reduced-motion.
 *
 *      AGENT-H7: missing accuracy fields render as 0 (number coerce path
 *      goes through Number.isFinite gate; non-finite -> 0). The radar
 *      "previous" series is omitted when no historical data exists.
 */
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useProgressTimeseries, useProgressWeakness, useProgressOverview } from '@sikao/api-client/progressQueries';
import { Panel } from '../../components/layout';
import { Skeleton } from '../../components/atom/Skeleton';
import { EmptyState } from '../../components/atom/EmptyState';

const CHART_COLOR_INFO = 'var(--color-state-info)';
const CHART_COLOR_BRAND = 'var(--color-brand-primary)';
const CHART_COLOR_OK = 'var(--color-state-ok)';

const TREND_RANGE_DAYS = 30;
const MA_WINDOW = 7;

// Categorical 5-module fixed order per design.md §C.1.1.
const RADAR_MODULES: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
  { key: 'yanyu',    label: '言语' },
  { key: 'shuliang', label: '数量' },
  { key: 'panduan',  label: '判断' },
  { key: 'ziliao',   label: '资料' },
  { key: 'shenlun',  label: '申论' },
];

function pad(n: number) { return String(n).padStart(2, '0'); }

function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface TrendPointOut {
  readonly date: string;
  readonly itemsAnswered: number;
  readonly accuracyMA: number;
}

function buildTrendData(points: ReadonlyArray<{ bucketStart: string; itemsAnswered: number; accuracy?: string | null }>): TrendPointOut[] {
  // 7-day moving average of accuracy. accuracy comes as 0..1 decimal; we
  // present 0..100 percent on a secondary Y axis.
  const accs = points.map((p) => safeNumber(p.accuracy) * 100);
  const out: TrendPointOut[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - MA_WINDOW + 1);
    const window = accs.slice(start, i + 1);
    const ma = window.length === 0 ? 0 : window.reduce((s, v) => s + v, 0) / window.length;
    out.push({
      date: points[i].bucketStart.slice(5), // MM-DD
      itemsAnswered: points[i].itemsAnswered,
      accuracyMA: Math.round(ma * 10) / 10,
    });
  }
  return out;
}

export function TimeseriesChart() {
  const query = useProgressTimeseries({
    from: dateOffset(TREND_RANGE_DAYS - 1),
    to: dateOffset(0),
    granularity: 'day',
  });

  if (query.isLoading) {
    return <Panel title="近 30 天练习趋势"><Skeleton variant="rect" height={280} /></Panel>;
  }

  const points = query.data?.points ?? [];
  if (points.length === 0) {
    return (
      <Panel title="近 30 天练习趋势">
        <EmptyState title="窗口内尚无练习记录" description="完成一次练习后这里会出现趋势。" />
      </Panel>
    );
  }

  const data = buildTrendData(points);

  return (
    <Panel title="近 30 天练习趋势">
      <div data-testid="profile-learning-trend-chart" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="itemsAnswered" name="题量" fill={CHART_COLOR_BRAND} isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey="accuracyMA" name="正确率 (7d MA)" stroke={CHART_COLOR_OK} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function WeaknessRadar() {
  const overviewQ = useProgressOverview();
  const weaknessQ = useProgressWeakness();

  if (overviewQ.isLoading || weaknessQ.isLoading) {
    return <Panel title="模块对比雷达"><Skeleton variant="rect" height={280} /></Panel>;
  }

  // Build a 5-axis dataset using the categorical fixed order. Current
  // series reads from weaknessQ items; previous series reads from
  // overview.subjectAccuracies if present (otherwise omitted).
  const currentMap = new Map<string, number>();
  for (const it of weaknessQ.data?.items ?? []) {
    currentMap.set(it.subjectKey, safeNumber(it.accuracy) * 100);
  }
  const prevMap = new Map<string, number>();
  for (const it of overviewQ.data?.subjectAccuracies ?? []) {
    // Reuse subjectAccuracies as a stand-in for "previous window" until
    // backend exposes a dedicated field; this is a known data gap.
    prevMap.set(it.subjectKey, safeNumber(it.accuracy) * 100);
  }

  const data = RADAR_MODULES.map((m) => ({
    subject: m.label,
    current: Math.round((currentMap.get(m.key) ?? 0) * 10) / 10,
    previous: Math.round((prevMap.get(m.key) ?? 0) * 10) / 10,
  }));

  const hasAnyCurrent = data.some((d) => d.current > 0);
  if (!hasAnyCurrent) {
    return (
      <Panel title="模块对比雷达">
        <EmptyState title="尚无模块对比数据" description="完成一次练习后这里会出现雷达。" />
      </Panel>
    );
  }

  const hasPrev = data.some((d) => d.previous > 0);

  return (
    <Panel title="模块对比雷达">
      <div data-testid="profile-learning-radar-chart" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis domain={[0, 100]} angle={30} />
            <Radar name="本期" dataKey="current" stroke={CHART_COLOR_INFO} fill={CHART_COLOR_INFO} fillOpacity={0.4} isAnimationActive={false} />
            {hasPrev ? (
              <Radar name="上期" dataKey="previous" stroke={CHART_COLOR_BRAND} fill={CHART_COLOR_BRAND} fillOpacity={0.1} strokeDasharray="4 4" isAnimationActive={false} />
            ) : null}
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const Charts = { WeaknessRadar, TimeseriesChart } as const;
export default Charts;
