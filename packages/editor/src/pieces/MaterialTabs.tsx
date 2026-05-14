import { useEffect, useRef, useState } from 'react';
import { cn } from '@sikao/shared-utils';
import type { Material } from '@sikao/domain/shenlun/types';

interface Props {
  materials: readonly Material[];
  matIdx: number;
  onSelect: (i: number) => void;
  matchCounts: readonly number[];
  highlightCounts: readonly number[];
  hideUnderline: boolean;
}

interface UnderlineRect {
  left: number;
  width: number;
}

// MaterialTabs — 4 tab buttons (one per material) with a sliding accent
// underline. We measure the active tab's bounding rect after layout and
// transition the underline to it; spring-y cubic-out gives the bounce the
// design calls for without needing framer-motion's layout animation.

export function MaterialTabs({
  materials,
  matIdx,
  onSelect,
  matchCounts,
  highlightCounts,
  hideUnderline,
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [underline, setUnderline] = useState<UnderlineRect>({ left: 0, width: 0 });

  useEffect(() => {
    const row = rowRef.current;
    const btn = tabRefs.current[matIdx];
    if (!row || !btn) return;
    const parentRect = row.getBoundingClientRect();
    const rect = btn.getBoundingClientRect();
    setUnderline({ left: rect.left - parentRect.left + 8, width: rect.width - 16 });
  }, [matIdx, materials.length]);

  return (
    <div
      ref={rowRef}
      className="flex px-3 border-b border-line shrink-0 relative"
      role="tablist"
    >
      {materials.map((mat, i) => {
        const active = i === matIdx;
        const hits = matchCounts[i] ?? 0;
        const hlCount = highlightCounts[i] ?? 0;
        return (
          <button
            type="button"
            key={mat.id}
            ref={(el) => { tabRefs.current[i] = el; }}
            onClick={() => onSelect(i)}
            role="tab"
            aria-selected={active}
            className={cn(
              'flex-1 px-2 py-3 -mb-px border-0 bg-transparent cursor-pointer font-serif',
              'transition-colors duration-base inline-flex items-center justify-center gap-2',
              active ? 'text-ink font-bold tracking-wide' : 'text-ink-3 font-medium',
            )}
            style={{ fontSize: 13.5 }} /* hardcode-allow: 13.5px is the spec'd serif tab size — between text-sm and text-base, no token */
            data-testid={`exam-materials-tab-${i}`}
          >
            {mat.title}
            {hits > 0 && (
              <span
                className={cn(
                  'text-tiny font-bold px-1 rounded-pill min-w-3.5 text-center font-mono',
                  'bg-warn text-surface exam-ink-fade',
                )}
                data-testid={`exam-materials-tab-${i}-hits`}
              >
                {hits}
              </span>
            )}
            {hlCount > 0 && hits === 0 && (
              <span
                className="w-1.5 h-1.5 rounded-pill bg-accent" /* hardcode-allow: 6px tab indicator dot, sub-token */
                aria-hidden
              />
            )}
          </button>
        );
      })}
      {!hideUnderline && (
        <span
          aria-hidden
          className="absolute -bottom-px h-0.5 rounded-tiny pointer-events-none exam-tab-underline-slide"
          style={{
            left: underline.left,
            width: underline.width,
            background: 'linear-gradient(90deg, var(--ink-1) 0%, var(--accent-1) 100%)',
          }}
          data-testid="exam-materials-tab-underline"
        />
      )}
    </div>
  );
}
