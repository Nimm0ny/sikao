import type { JSX } from 'react';

/*
 * EmptyState illustrations — V5 D.3.10 (skeleton, V5-M4 sprite TBD).
 *
 * Why: keep four geometry primitives inline so EmptyState has no external
 *      sprite dep until V5-M4 lands. Stroke=currentColor keeps the glyph
 *      themable; viewBox 24×24 matches V5 §C.5.1 icon canvas.
 */

export type Illustration = 'no-data' | 'no-result' | 'error' | 'first-time';

const SHARED = {
  width: '100%',
  height: '100%',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function renderIllustration(kind: Illustration): JSX.Element {
  if (kind === 'no-data') {
    return (
      <svg {...SHARED}>
        <rect x="4" y="6" width="16" height="13" rx="2" strokeDasharray="2 2" />
        <path d="M8 10h8" />
      </svg>
    );
  }
  if (kind === 'no-result') {
    return (
      <svg {...SHARED}>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg {...SHARED}>
        <path d="M12 4 3 20h18Z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...SHARED}>
      <path d="m12 3 2.6 5.6 6.1.6-4.6 4.1 1.4 6L12 16.5 6.5 19.3l1.4-6L3.3 9.2l6.1-.6Z" />
    </svg>
  );
}
