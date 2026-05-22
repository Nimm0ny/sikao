import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts';

import { Card, EmptyState } from '@sikao/ui/ui';

import type { DashboardProgressResponseV2 } from '@sikao/api-client/types/home';

import { buildRadarData } from '@/components/dashboard-sikao/progress/progressRuntime';

interface WeaknessRadarProps {
  readonly overview: DashboardProgressResponseV2;
}

export function WeaknessRadar({ overview }: WeaknessRadarProps) {
  const data = buildRadarData(overview);

  if (data.length < 3) {
    return (
      <Card padding="md" className="border-line bg-surface">
        <EmptyState
          title="弱项雷达暂不可用"
          description="当前学科维度不足以成图，先继续积累分科练习数据。"
        />
      </Card>
    );
  }

  return (
    <Card padding="md" className="border-line bg-surface" data-testid="profile-learning-radar">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
        学科雷达
      </div>
      <div className="mt-2 font-serif text-2xl text-ink">薄弱项雷达</div>
      <div className="mt-3 overflow-x-auto">
        <RadarChart width={640} height={320} data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" />
          <PolarRadiusAxis domain={[0, 100]} tickCount={6} />
          <Radar
            name="正确率"
            dataKey="accuracy"
            stroke="var(--accent-1)"
            fill="var(--accent-1)"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
        </RadarChart>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-ink-3 md:grid-cols-3">
        {data.map((item) => (
          <div key={item.subject} className="rounded-card border border-line bg-paper p-3">
            <div className="font-medium text-ink">{item.subject}</div>
            <div className="mt-1">正确率 {Math.round(item.accuracy)}%</div>
            <div className="mt-1">已答 {item.answered} 题</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
