import type { ReactElement } from 'react';
import { cn } from '@sikao/shared-utils';
import type { ShenlunMaterial } from './mockSession';

// ShenlunMaterialReader (PR13 P2, 2026-05-13) — thin material body renderer.
//
// Why a separate primitive instead of reusing components/essay/sikao/MaterialPanel:
//   - MaterialPanel hard-couples to `useExamSession` store + renders
//     draggable `MaterialClip` spans on top of `highlights[matId]`.
//     PR13 申论双模 (TD1 / TD1b) does NOT have the drag-to-scratch flow yet
//     (P2 is layout only, P3 brings TypedEditor / HandwriteEditor without
//     scratch). Pulling MaterialPanel in would (a) drag the store dependency
//     into PR13's stub flow (b) leak MaterialClip drag handlers + grip UI
//     into a reader that should just present serif body text.
//   - Spec §2.4 simply asks "材料阅读区 (滚动)" — no highlight, no clip, no
//     drag at this stage. The reader is essentially a serif <article>.
//
// When P3 adds scratch/drag, this primitive stays focused on read-only
// content; drag-target is introduced in a wrapper (or as a new variant)
// without pulling the store dependency back in. Cleaner separation.

export interface ShenlunMaterialReaderProps {
  readonly material: ShenlunMaterial;
  readonly className?: string;
}

export default function ShenlunMaterialReader({
  material,
  className,
}: ShenlunMaterialReaderProps): ReactElement {
  return (
    <article
      className={cn('flex flex-col min-h-0 overflow-hidden', className)}
      data-testid="shenlun-material-reader"
      data-material-id={material.id}
    >
      <header className="px-5 py-3 border-b border-line-1 shrink-0 bg-paper-1">
        <h3
          className="font-serif text-ink"
          style={{ fontSize: 16, lineHeight: 1.4 }} /* hardcode-allow: spec TD1 §2.4 material title 16 between --t-h3 18 and --t-body 14 */
        >
          {material.title}
        </h3>
      </header>
      <div
        className="flex-1 overflow-y-auto px-5 py-4 min-h-0 font-serif text-ink-2"
        style={{
          fontSize: 'var(--read-fs, 14px)',
          lineHeight: 'var(--read-lh, 1.85)',
        }}
        data-testid="shenlun-material-reader-body"
      >
        <div style={{ whiteSpace: 'pre-wrap' }}>{material.content}</div>
      </div>
    </article>
  );
}
