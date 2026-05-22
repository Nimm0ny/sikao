import { ChevronRightIcon } from '@sikao/ui/icons';
import { Card } from '@sikao/ui/ui';

interface KeyMetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly onClick?: () => void;
}

export function KeyMetricCard({
  label,
  value,
  detail,
  onClick,
}: KeyMetricCardProps) {
  return (
    <Card padding="md" className="h-full border-line bg-surface">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
            {label}
          </div>
          {onClick ? <ChevronRightIcon className="h-4 w-4 text-ink-4" /> : null}
        </div>
        <div className="mt-3 font-serif text-3xl text-ink">
          {value}
        </div>
        <div className="mt-2 text-sm text-ink-3">{detail}</div>
      </button>
    </Card>
  );
}
