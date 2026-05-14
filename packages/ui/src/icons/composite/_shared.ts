// SIKAO composite icon — shared status maps + sizing.
//
// SSOT: design/SIKAO/icon-spec/composite-icons-spec.md §A.4 / §C.3 / §D.1.
// 4 个复合 icon (NumberCircle / NumberSquare / MaterialBadge / QuestionBadge)
// 共享: 状态 → token 颜色映射 / size → px / 数字字号自适应.
//
// 状态颜色用 var(--*) token 直接 inline (而非 currentColor), 因为复合 icon
// 同一个 SVG 内有 outer fill + inner text fill 两个独立颜色通道, currentColor
// 一次只能携带一个值. 详见 spec §A.3 footnote.

export type CommonStatus =
  | 'unanswered'
  | 'answered'
  | 'marked'
  | 'current'
  | 'wrong';

/**
 * NumberCircle / NumberSquare 5 状态的颜色三元组.
 * outerStroke / outerFill / numberFill 各自独立; 'none' 表示该通道不渲染.
 */
export interface CommonStatusColors {
  readonly outerStroke: string;
  readonly outerFill: string;
  readonly numberFill: string;
}

export const COMMON_STATUS_COLORS: Record<CommonStatus, CommonStatusColors> = {
  unanswered: {
    outerStroke: 'var(--ink-3)',
    outerFill: 'none',
    numberFill: 'var(--ink-3)',
  },
  answered: {
    outerStroke: 'none',
    outerFill: 'var(--ink-1)',
    numberFill: 'var(--paper-1)',
  },
  marked: {
    outerStroke: 'var(--accent-1)',
    outerFill: 'none',
    numberFill: 'var(--accent-1)',
  },
  current: {
    outerStroke: 'none',
    outerFill: 'var(--accent-1)',
    numberFill: 'var(--paper-1)',
  },
  wrong: {
    outerStroke: 'none',
    outerFill: 'var(--bad-bg)',
    numberFill: 'var(--err)',
  },
};

export type CompositeSize = 'sm' | 'md' | 'lg';

/** Outer SVG render size, px. spec §A.5: sm=24 dock, md=28 opt, lg=32 result. */
export const COMPOSITE_SIZE_PX: Record<CompositeSize, number> = {
  sm: 24,
  md: 28,
  lg: 32,
};

/**
 * Number font size 自适应: 单字符 11/13/15, 双字符 10/12/14, 三字符 9/11/12.
 * 24-grid viewBox 内 font-size 11 等于约 outer*0.46 (24 → 11).
 * 实现走比例 (而非硬阶梯) 以便未来加更大 size 时不撕裂.
 */
export function compositeNumberFontSize(
  num: number | string,
  outerPx: number,
): number {
  const txt = String(num);
  if (txt.length <= 1) return outerPx * 0.46;
  if (txt.length === 2) return outerPx * 0.42;
  return outerPx * 0.38;
}
