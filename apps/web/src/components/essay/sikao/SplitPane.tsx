import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ESSAY_SIKAO_COPY } from '@/lib/ui-copy/essay-sikao';

export interface SplitPaneProps {
  readonly left: ReactNode;
  readonly right: ReactNode;
  readonly mobileMode?: 'editor' | 'material';
}

const MIN_PCT = 25;
const MAX_PCT = 75;

function clampPanePct(value: number): number {
  return Math.max(MIN_PCT, Math.min(MAX_PCT, value));
}

export function SplitPane({ left, right, mobileMode = 'editor' }: SplitPaneProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [sourcePct, setSourcePct] = useState(50);

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const grid = gridRef.current;
    if (!grid) return;
    event.preventDefault();
    const rect = grid.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent) => {
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSourcePct(clampPanePct(pct));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <div
      ref={gridRef}
      className="essay-grid"
      style={{ '--essay-source-pct': `${sourcePct}%` } as CSSProperties}
      data-testid="essay-grid"
      data-mobile-mode={mobileMode}
    >
      <div className="essay-source-col">{left}</div>
      <button
        type="button"
        aria-label={ESSAY_SIKAO_COPY.gridResize}
        className="essay-grid-resizer"
        onPointerDown={startResize}
        data-testid="essay-grid-resizer"
      >
        <svg width="8" height="28" viewBox="0 0 8 28" fill="none" aria-hidden="true">
          <path d="M4 4V24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <div className="essay-editor-col min-h-0 min-w-0 flex flex-col">
        {right}
      </div>
    </div>
  );
}
