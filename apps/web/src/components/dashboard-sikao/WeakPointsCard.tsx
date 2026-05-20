import type { KnowledgePointEntryV2 } from '@sikao/api-client/types/api';
import { DASHBOARD_COPY } from '@/lib/ui-copy';

/**
 * SIKAO Dashboard 02 hifi (2026-05-11 Wave 1) — `.weak-1920` 落地.
 *
 * 薄弱考点前 3. 每行 title + sub (最近 N 次 · M 错 · 错率%) + meter bar
 * (width by 错率, 颜色按档分级 danger/warn/ink-3).
 *
 * Dumb: caller 传 KnowledgePointEntryV2 list; 内部排序 + 截前 3.
 */

const TOP_N = 3;

function colorForRate(errRate: number): string {
  // errRate 取值 0-1. 高错率 (>=0.4) = danger, 中 (0.3-0.4) = warn, 低 (<0.3) = ink-3.
  if (errRate >= 0.4) return 'var(--err)';
  if (errRate >= 0.3) return 'var(--warn)';
  return 'var(--ink-3)';
}

export interface WeakPointsCardProps {
  /** 完整 knowledge points 列表; 组件内部按 (1 - rate) 排序选前 3. */
  readonly points: readonly KnowledgePointEntryV2[];
}

export function WeakPointsCard({ points }: WeakPointsCardProps) {
  // 排序: 错率 = 1 - rate. 取最薄弱 3 个 (total > 0 才有信号).
  const sortable = points.filter((p) => p.total > 0);
  const sorted = [...sortable].sort((a, b) => a.rate - b.rate);
  const top = sorted.slice(0, TOP_N);

  return (
    <section
      className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3 shadow-card"
      data-testid="dashboard-weak-points"
    >
      <header className="flex items-baseline justify-between pb-3 border-b border-line">
        <h4 className="font-serif text-lg font-medium m-0">薄弱考点 · 前 3</h4>
        <span className="font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
          最近 30 题
        </span>
      </header>

      {top.length === 0 ? (
        <p className="text-sm text-ink-3 py-2">{DASHBOARD_COPY.weakPointsEmpty}.</p>
      ) : (
        <ul className="flex flex-col">
          {top.map((p) => {
            const wrongCount = p.total - p.correct;
            const errRate = 1 - p.rate;
            const errPct = Math.round(errRate * 100);
            return (
              <li
                key={p.name}
                className="grid grid-cols-[1fr_auto] gap-3 py-3 border-b border-line last:border-b-0 items-center"
                data-testid={`dashboard-weak-point-${p.name}`}
              >
                <div className="min-w-0">
                  <div className="font-serif text-base font-medium text-ink truncate">
                    {p.name}
                  </div>
                  <div className="mt-1 font-mono text-tiny tracking-eyebrow text-ink-3 uppercase">
                    最近 {p.total} 次 · {wrongCount} 错 · {errPct}% 错率
                  </div>
                </div>
                <div className="w-28 md:w-32">
                  <div
                    className="relative h-1.5 bg-paper-3 overflow-hidden"
                    style={{ borderRadius: 'var(--r-1)' }}
                  >
                    <i
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 block"
                      style={{
                        width: `${Math.max(8, errPct)}%`,
                        background: colorForRate(errRate),
                      }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
