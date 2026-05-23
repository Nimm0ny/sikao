import { useEffect, useState } from 'react';

interface BurstSpec {
  id: number;
  x: number;
  y: number;
}

interface Props {
  burst: BurstSpec | null;
  onDone: () => void;
}

const PARTICLE_DEGS = [0, 60, 120, 180, 240, 300] as const;
const COLORS = ['var(--color-brand-primary)', 'var(--color-state-warn)'];
const LIFETIME_MS = 700;

// ParticleBurst — renders 6 particles radiating from a (x, y) anchor.
// Used by MaterialReader as the celebration on a newly recorded highlight.
// Colours alternate accent / warn (3 + 3) per the design v2 ANIMATIONS A5.1.
// Honours prefers-reduced-motion by rendering nothing.

export function ParticleBurst({ burst, onDone }: Props) {
  // Lazy init reads matchMedia synchronously on mount; useEffect only
  // subscribes to subsequent changes. This avoids react-hooks/set-state-in-
  // effect (which trips on synchronous setState inside an effect body).
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!burst) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    const id = window.setTimeout(onDone, LIFETIME_MS);
    return () => window.clearTimeout(id);
  }, [burst, reduceMotion, onDone]);

  if (!burst || reduceMotion) return null;

  return (
    <div
      style={{ position: 'absolute', left: burst.x, top: burst.y, pointerEvents: 'none', zIndex: 9 }}
      data-testid="exam-particle-burst"
    >
      {PARTICLE_DEGS.map((deg, i) => (
        <span
          key={`${burst.id}-${deg}`}
          style={{
            position: 'absolute',
            width: 5, /* hardcode-allow: 5px particle size, decorative */
            height: 5,
            borderRadius: '50%',
            background: COLORS[i % 2],
            left: -2.5,
            top: -2.5,
            ['--deg' as string]: `${deg}deg`,
            transform: `rotate(${deg}deg) translateY(0) scale(1)`,
            animation: 'exam-particle-burst 700ms cubic-bezier(.2,.7,.3,1) forwards',
          } as React.CSSProperties}
          aria-hidden
        />
      ))}
    </div>
  );
}

export type { BurstSpec };
