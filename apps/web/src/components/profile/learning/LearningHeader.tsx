import { Card } from '@sikao/ui/ui';
import type { DashboardProgressResponseV2 } from '@sikao/api-client/types/home';

interface LearningHeaderProps {
  readonly overview: DashboardProgressResponseV2;
}

export function LearningHeader({ overview }: LearningHeaderProps) {
  return (
    <Card padding="md" className="border-line bg-surface">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
        Profile / Learning
      </div>
      <div className="mt-2 font-serif text-3xl text-ink">详细学情</div>
      <div className="mt-3 text-sm text-ink-3">
        已累计练习 {overview.summary.allTime.minutesPracticed} 分钟，共答 {overview.summary.allTime.itemsAnswered} 题，
        当前最近考试目标为 {overview.nearestExamTarget?.examName ?? '未设置'}。
      </div>
    </Card>
  );
}
