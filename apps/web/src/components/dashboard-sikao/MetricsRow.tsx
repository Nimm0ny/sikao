/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.metrics-1920` 落地.
 *
 * 4 列 metric, 共享 border 网格. 每张: lbl (eyebrow mono) + num (大字 mono) +
 * delta (绿/红 mono) + 7 段微型 bar.
 *
 * Dumb: caller 装数据 (从 summary + trend 映射).
 */

export interface MetricEntry {
  readonly label: string;
  /** 主数值 + 单位拆开: e.g. value="12.4", unit="h"; 或 value="84.2", unit="%". */
  readonly value: string;
  readonly unit?: string;
  /** delta 文案 (e.g. "+2.1h vs 上周"). 缺值 undefined 不显. */
  readonly delta?: string;
  /** delta 是否下行 (红色). 默认 false (绿). */
  readonly isDeltaDown?: boolean;
  /** 7 段 bar. true = on (ink 浓), false = off (ink 透明). 缺值默认全 off. */
  readonly bars: readonly boolean[];
}

export interface MetricsRowProps {
  readonly metrics: readonly [MetricEntry, MetricEntry, MetricEntry, MetricEntry];
}

export function MetricsRow({ metrics }: MetricsRowProps) {
  return (
    <section
      className="grid grid-cols-2 md:grid-cols-4 border border-line bg-surface rounded-card overflow-hidden"
      data-testid="dashboard-metrics-row"
    >
      {metrics.map((m, idx) => (
        <div
          key={`${m.label}-${idx}`}
          className={`p-5 md:px-6 ${idx < metrics.length - 1 ? 'md:border-r' : ''} ${idx < 2 ? 'border-b md:border-b-0' : ''} ${idx % 2 === 0 ? 'border-r md:border-r' : ''} border-line`}
        >
          <div className="font-mono text-tiny tracking-widest uppercase text-ink-3">
            {m.label}
          </div>
          <div className="mt-2 font-mono text-3xl font-medium tracking-tight">
            {m.value}
            {m.unit != null ? (
              <small className="text-lg text-ink-3 font-normal ml-1">
                {m.unit}
              </small>
            ) : null}
          </div>
          {m.delta != null ? (
            <div
              className={`mt-1 font-mono text-tiny tracking-loose ${
                m.isDeltaDown ? 'text-err' : 'text-ok'
              }`}
            >
              {m.delta}
            </div>
          ) : (
            <div className="mt-1 font-mono text-tiny tracking-loose text-ink-3">
              —
            </div>
          )}
          {/* 7 段微 bar. h-7 + flex items-end + gap-1 (8px step token).
              on=ink-100%, off=ink-15% (opacity 表征 active vs idle). */}
          <div className="mt-4 h-7 flex items-end gap-1">
            {m.bars.map((on, i) => (
              <i
                key={i}
                aria-hidden="true"
                className={`flex-1 bg-ink rounded-1 ${on ? 'opacity-100' : 'opacity-15'}`}
                style={{ height: on ? '100%' : '60%' }}
                data-pattern="dot"
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
