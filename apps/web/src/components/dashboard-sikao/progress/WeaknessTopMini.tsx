import { Card } from '@sikao/ui/ui';

import type { ProgressWeaknessResponseV2 } from '@sikao/api-client/types/home';

type WeaknessItemV2 = NonNullable<ProgressWeaknessResponseV2['items']>[number];

interface WeaknessTopMiniProps {
  readonly items: readonly WeaknessItemV2[];
}

function severityTone(severity: string): string {
  switch (severity) {
    case 'high':
      return 'border-err text-err';
    case 'medium':
      return 'border-warn text-warn';
    default:
      return 'border-line-3 text-ink-3';
  }
}

export function WeaknessTopMini({ items }: WeaknessTopMiniProps) {
  return (
    <Card padding="md" className="h-full border-line bg-surface">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
          薄弱项 Top 3
        </div>
        <div className="text-xs text-ink-4">最近快照</div>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 text-sm text-ink-3">暂无薄弱项数据。</div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.subjectKey}
              className="flex items-center justify-between gap-3"
              data-testid={`dashboard-weakness-mini-${item.subjectKey}`}
            >
              <div className="min-w-0">
                <div className="font-medium text-ink">{item.subjectLabel}</div>
                <div className="text-sm text-ink-3">
                  {item.answered} 题 · 正确率 {item.accuracy == null ? '—' : `${Math.round(Number(item.accuracy) * 100)}%`}
                </div>
              </div>
              <span
                className={`inline-flex rounded-pill border px-3 py-1 text-xs font-medium ${severityTone(item.severity)}`}
              >
                {item.trend}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
