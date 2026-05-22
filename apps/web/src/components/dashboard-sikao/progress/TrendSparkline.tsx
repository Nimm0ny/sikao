interface TrendSparklineProps {
  readonly values: readonly (number | null)[];
}

const WIDTH = 280;
const HEIGHT = 72;
const PADDING = 8;

function buildPath(values: readonly (number | null)[]): string {
  if (values.length === 0) return '';
  const validValues = values.filter((value): value is number => value != null);
  if (validValues.length === 0) return '';
  const max = Math.max(...validValues);
  const min = Math.min(...validValues);
  const range = max - min || 1;
  let started = false;
  return values
    .map((value, index) => {
      if (value == null) {
        started = false;
        return '';
      }
      const x =
        values.length === 1
          ? WIDTH / 2
          : PADDING + ((WIDTH - PADDING * 2) * index) / (values.length - 1);
      const y =
        HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
      const command = started ? 'L' : 'M';
      started = true;
      return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(' ');
}

export function TrendSparkline({ values }: TrendSparklineProps) {
  const path = buildPath(values);

  return (
    <div
      className="rounded-card border border-line bg-surface p-4"
      data-testid="dashboard-progress-sparkline"
    >
      <div className="text-xs font-mono uppercase tracking-wider text-ink-4">
        近 7 天正确率
      </div>
      {path === '' ? (
        <div className="mt-4 text-sm text-ink-3">暂无趋势数据。</div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="mt-4 h-20 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="近 7 天正确率趋势"
          >
            <path
              d={path}
              fill="none"
              stroke="var(--accent-1)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="sr-only">
            最近 7 天正确率：
            <ul>
              {values.map((value, index) => (
                <li key={index}>
                  第 {index + 1} 个时间桶：{value == null ? '暂无准确率' : `${Math.round(value)}%`}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
