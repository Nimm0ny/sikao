/**
 * SIKAO Wave 4 Phase 2C · StatStrip — 4 格汇总 (已练 / 连续 / 本周 / 平均分).
 *
 * hifi 参考: design/SIKAO/handoff/modules/essay-specialty/essay-redesign.html
 * .stat-strip CSS (border + 1px 内分隔 / mono eyebrow + serif 大数字 + 小单位).
 *
 * Dumb 组件: caller 装数据 (从 SpecialtyTotalsV2 映射).
 *
 * Wave 5A xingce 复用 (2026-05-12): mode='xingce' 复用 essay 组件, BE
 * XingceSpecialtyTotalsV2 字段名/shape 跟 essay 完全 mirror. mode 唯一驱动
 * (a) testid prefix essay-specialty-* → xingce-specialty-* (b) avgScore
 * suffix /100 → % (行测 avgScore 是正确率 0-100, 不是分数) (c) aria-label.
 */
import type { SpecialtyTotalsV2 } from '@sikao/api-client/queries/essaySpecialtyQueries';
import type { XingceSpecialtyTotalsV2 } from '@sikao/api-client/queries/xingceSpecialtyQueries';

export type SpecialtyMode = 'essay' | 'xingce';

export interface StatStripProps {
  readonly totals: SpecialtyTotalsV2 | XingceSpecialtyTotalsV2;
  readonly mode?: SpecialtyMode;
}

interface CellEntry {
  readonly label: string;
  readonly value: string;
  readonly suffix?: string;
  readonly testId: string;
}

function buildCells(
  totals: SpecialtyTotalsV2 | XingceSpecialtyTotalsV2,
  mode: SpecialtyMode,
): readonly CellEntry[] {
  // avgScore 走 0-100 + 一位小数. 0 batch BE 返 0, 显示 "—" 更克制.
  // essay: 0-100 分数 → suffix /100. xingce: 0-100 正确率 → suffix %.
  const avgDisplay = totals.avgScore > 0 ? totals.avgScore.toFixed(1) : '—';
  const avgLabel = mode === 'xingce' ? '正确率' : '平均分';
  const avgSuffix =
    totals.avgScore > 0 ? (mode === 'xingce' ? '%' : '/100') : undefined;
  return [
    {
      label: '已练',
      value: String(totals.practiced),
      suffix: `/${totals.total}`,
      testId: 'practiced',
    },
    {
      label: '连续',
      value: String(totals.streakDays),
      suffix: '天',
      testId: 'streak',
    },
    {
      label: '本周',
      value: String(totals.weekDone),
      suffix: '题',
      testId: 'week',
    },
    {
      label: avgLabel,
      value: avgDisplay,
      suffix: avgSuffix,
      testId: 'avg',
    },
  ];
}

export function StatStrip({ totals, mode = 'essay' }: StatStripProps) {
  const cells = buildCells(totals, mode);
  const ariaLabel = mode === 'xingce' ? '行测专项总览' : '申论专项总览';
  return (
    <section
      className="flex border border-line bg-paper rounded-card overflow-hidden shrink-0"
      data-testid={`${mode}-specialty-stat-strip`}
      aria-label={ariaLabel}
    >
      {cells.map((cell, idx) => (
        <div
          key={cell.testId}
          className={`px-5 py-3 min-w-[6rem] flex-1 ${idx < cells.length - 1 ? 'border-r border-line' : ''}`}
          data-testid={`${mode}-specialty-stat-${cell.testId}`}
        >
          <div className="font-mono text-tiny tracking-wider uppercase text-ink-3">
            {cell.label}
          </div>
          <div className="mt-1 font-serif text-2xl font-semibold tracking-tight text-ink leading-tight">
            {cell.value}
            {cell.suffix !== undefined ? (
              <span className="ml-1 font-mono text-sm font-medium text-ink-3">
                {cell.suffix}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}
