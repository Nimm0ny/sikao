// lint-allow-ui-copy: V5 ProfileLearning chart copy.
/*
 * Charts — recharts-backed ProfileLearning sections.
 *
 * Why: this module is the single React.lazy chunk boundary for the
 *      drilldown so vite emits a separate `profile-learning-*.js` and
 *      `recharts-vendor-*.js` (the latter via vite.config.ts manualChunks
 *      in a future pass — for now recharts ends up in its own chunk
 *      because nothing else in the Home route imports it).
 *
 *      Two charts:
 *        - WeaknessRadar — RadarChart of weaknessTop3 + extra weakness
 *          API items, polar accuracy axis 0..100.
 *        - TimeseriesChart — LineChart of itemsAnswered per day from
 *          useProgressTimeseries (last 7 days window).
 *
 *      Reduced-motion: recharts ResponsiveContainer + isAnimationActive
 *      false prevents transition flicker for users with prefers-reduced-
 *      motion. Still a CSS spec'd safety net at the global level.
 */
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useProgressTimeseries, useProgressWeakness } from '@sikao/api-client/progressQueries';
import { Panel } from '../../components/layout';
import { Skeleton } from '../../components/atom/Skeleton';
import { EmptyState } from '../../components/atom/EmptyState';

// recharts color tokens — read from the V5 token surface so the chart
// inherits theme switches without hard-coded hex. We pass the var()
// directly to recharts; it forwards as `stroke`/`fill` attrs.
const CHART_COLOR_INFO = 'var(--color-state-info)';
const CHART_COLOR_OK = 'var(--color-state-ok)';
const SAMPLE_RANGE_DAYS = 7;


function pad(n: number) { return String(n).padStart(2, '0'); }
function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function WeaknessRadar() {
  const query = useProgressWeakness();
  if (query.isLoading) {
    return <Panel title="薄弱模块雷达"><Skeleton variant="rect" height={240} /></Panel>;
  }
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return <Panel title="薄弱模块雷达"><EmptyState title="尚无薄弱数据" /></Panel>;
  }
  const data = items.map((it) => ({
    subject: it.subjectLabel,
    accuracy: it.accuracy === null || it.accuracy === undefined ? 0 : Math.round(Number(it.accuracy) * 100),
  }));
  return (
    <Panel title="薄弱模块雷达">
      <div data-testid="weakness-radar" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis domain={[0, 100]} angle={30} />
            <Radar name="正确率" dataKey="accuracy" stroke={CHART_COLOR_INFO} fill={CHART_COLOR_INFO} fillOpacity={0.4} isAnimationActive={false} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function TimeseriesChart() {
  const query = useProgressTimeseries({
    from: dateOffset(SAMPLE_RANGE_DAYS - 1),
    to: dateOffset(0),
    granularity: 'day',
  });

  if (query.isLoading) {
    return <Panel title="近 7 天练习量"><Skeleton variant="rect" height={240} /></Panel>;
  }

  const points = query.data?.points ?? [];
  if (points.length === 0) {
    return <Panel title="近 7 天练习量"><EmptyState title="近 7 天尚无练习记录" /></Panel>;
  }

  const data = points.map((p) => ({
    date: p.bucketStart.slice(5),
    itemsAnswered: p.itemsAnswered,
    minutes: p.minutesPracticed,
  }));

  return (
    <Panel title="近 7 天练习量">
      <div data-testid="timeseries-chart" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="itemsAnswered" name="题量" stroke={CHART_COLOR_INFO} isAnimationActive={false} />
            <Line type="monotone" dataKey="minutes" name="分钟" stroke={CHART_COLOR_OK} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const Charts = { WeaknessRadar, TimeseriesChart } as const;
export default Charts;
