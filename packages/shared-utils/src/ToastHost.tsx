// V5-M0.5 ToastHost — minimal inline implementation (2026-05-24).
//
// Pre-V5-M0.5 this file forwarded to @sikao/ui/ui/ToastHost. That UI package
// was scrapped in commit 3 of the big-bang rebuild. This file now hosts the
// minimal queue + render contract directly so that main.tsx can consume the
// SSOT toast API (toast.info / .warn / .error from ./toast.ts) without
// depending on a component library.
//
// Real V5 toast component lands in V5 Phase 3 (SIK-75 task 13.5,
// design.md §D.3.7), at which point this host can either delegate to that
// component or be replaced wholesale.
//
// Visual contract:
//   - fixed bottom-right, z-index var(--z-toast)
//   - max 3 visible items (oldest first dismiss handled by ./toast.ts setTimeout)
//   - aria-live=polite + role=region (a11y)
//   - tone -> color: info=focus-ring, warn=state-warn, err=state-err
//   - V5 tokens only; no Tailwind utility classes (those depend on tailwind.config)
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { subscribe, type ToastItem, type ToastKind } from './toast';

const MAX_VISIBLE = 3;

const TONE_COLOR: Record<ToastKind, string> = {
  info: 'var(--color-focus-ring)',
  warn: 'var(--color-state-warn)',
  error: 'var(--color-state-err)',
};

const HOST_STYLE: CSSProperties = {
  position: 'fixed',
  right: 'var(--space-4)',
  bottom: 'var(--space-4)',
  zIndex: 'var(--z-toast)' as unknown as number,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  pointerEvents: 'none',
};

const ITEM_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  maxWidth: 380,
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--color-text-primary)',
  color: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-10)',
  boxShadow: 'var(--shadow-l3)',
  fontSize: 'var(--font-body)',
  lineHeight: 1.4,
  pointerEvents: 'auto',
};

const DOT_STYLE: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
};

export function ToastHost(): ReactElement {
  const [items, setItems] = useState<readonly ToastItem[]>([]);

  useEffect(() => subscribe(setItems), []);

  const visible = items.slice(-MAX_VISIBLE);

  return (
    <div aria-live="polite" role="region" aria-label="Notifications" style={HOST_STYLE} data-testid="toast-host">
      {visible.map(t => (
        <div key={t.id} role="status" style={ITEM_STYLE}>
          <span aria-hidden="true" data-pattern="dot" style={{ ...DOT_STYLE, background: TONE_COLOR[t.kind] }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'] }}>
              {t.title}
            </span>
            {t.description ? (
              <span style={{ marginLeft: 'var(--space-1)', opacity: 0.8 }}>· {t.description}</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
