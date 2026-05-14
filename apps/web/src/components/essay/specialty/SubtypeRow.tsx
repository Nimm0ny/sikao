/**
 * SIKAO Wave 4 Phase 2C · SubtypeRow — CategoryCard 展开 body 的子类行.
 *
 * hifi 参考: design/SIKAO/handoff/modules/essay-specialty/essay-redesign.html
 * .sub-row CSS (18×18 tick 三态 SVG + label + meta + progress + hover 箭头).
 *
 * 三态:
 *   - status='done':     tick = filled ✓ (ok 绿)
 *   - status='progress': tick = filled square (ink, 表续答中)
 *   - status='pending':  tick = empty border
 *
 * isContinueTarget = true 时显示 "继续" 小 mark (暗朱描边 + 暗朱文字).
 * 由调用方根据 BE resume.questionId 跟此行 questionId 匹配传入.
 */
import type { SpecialtySubtypeRowV2 } from '@sikao/api-client/queries/essaySpecialtyQueries';
import type { XingceSpecialtySubtypeRowV2 } from '@sikao/api-client/queries/xingceSpecialtyQueries';
import type { SpecialtyMode } from './StatStrip';

export type AnySubtypeRow = SpecialtySubtypeRowV2 | XingceSpecialtySubtypeRowV2;

export interface SubtypeRowProps {
  readonly row: AnySubtypeRow;
  readonly mode?: SpecialtyMode;
  readonly isContinueTarget?: boolean;
  readonly onClick: (questionId: number) => void;
}

interface TickRenderProps {
  readonly status: AnySubtypeRow['status'];
}

function StatusTick({ status }: TickRenderProps) {
  if (status === 'done') {
    return (
      <span
        className="w-[18px] h-[18px] grid place-items-center shrink-0 bg-ok text-paper border border-ok rounded-1"
        aria-label="已完成"
        data-pattern="dot"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="m3 6 2.5 2.5L9 4" />
        </svg>
      </span>
    );
  }
  if (status === 'progress') {
    return (
      <span
        className="relative w-[18px] h-[18px] grid place-items-center shrink-0 border border-ink bg-paper rounded-1"
        aria-label="进行中"
        data-pattern="dot"
      >
        <span
          aria-hidden="true"
          className="w-2 h-2 bg-ink"
          data-pattern="dot"
        />
      </span>
    );
  }
  return (
    <span
      className="w-[18px] h-[18px] shrink-0 border border-line-3 bg-paper rounded-1"
      aria-label="未练"
      data-pattern="dot"
    />
  );
}

export function SubtypeRow({
  row,
  mode = 'essay',
  isContinueTarget = false,
  onClick,
}: SubtypeRowProps) {
  const handleClick = (): void => {
    onClick(row.questionId);
  };

  return (
    // svg-only-allow: specialty 选题入口 button (非答题 toolbar), 中文 label 必需
    <button
      type="button"
      onClick={handleClick}
      data-testid={`${mode}-specialty-subtype-${row.id}`}
      data-status={row.status}
      className="group flex items-center gap-4 px-4 py-3 text-left bg-paper border border-line hover:border-ink transition-colors duration-fast w-full rounded-card"
    >
      <StatusTick status={row.status} />
      <span className="flex-1 min-w-0 leading-tight">
        <span className="block text-base text-ink font-medium truncate">
          {row.name}
        </span>
        <span className="block font-mono text-tiny text-ink-3 mt-1 tracking-loose">
          {row.meta}
        </span>
      </span>
      {isContinueTarget ? (
        <span className="font-mono text-tiny uppercase tracking-wide text-exam-accent font-semibold border border-exam-accent px-2 py-1">
          继续
        </span>
      ) : null}
      <span className="font-mono text-xs text-ink-3 tabular-nums min-w-[3.5rem] text-right tracking-loose">
        <strong className="text-ink font-semibold">{row.practiced}</strong>
        /{row.total}
      </span>
      <svg
        className="w-3 h-3 text-ink-3 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-ink transition-all duration-fast"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="m6 4 5 4-5 4" />
      </svg>
    </button>
  );
}
