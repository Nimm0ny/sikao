import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@sikao/shared-utils';
import { MOTION_SPRING_SOFT } from '@sikao/shared-utils';

// Mirrors the bottom drawer in docs/ui-demo/ui-preview.html. Handle bar is
// always anchored at the bottom; the body expands/collapses from the handle
// line upward via a framer-motion height+opacity spring.
//
// Renamed from `Drawer` to `BottomDrawer` in PR8 (2026-05-13) to free the
// `Drawer` name for the spec-compliant side-drawer primitive (Mobile and
// Tablet Pack New §iv / Handoff §4.4). BottomDrawer keeps the legacy
// header/footer/onToggle API used by ExamCustomSheet and AnswerCardDrawerHeader.
// New callsites should prefer:
//   - `<BottomSheet>` for mobile-first bottom sheets
//   - `<Drawer>` for desktop side drawers with auto mobile→BottomSheet fallback
//
// Dumb by contract: `open` + `onToggle` are required; the component never
// mutates internal state.
//
// Why the handle pill and header are siblings (not nested): header callers
// embed their own <button> (e.g. AnswerCardDrawerHeader's close button).
// Wrapping both pill and header inside a single toggle <button> produces
// nested <button> DOM, which React 18+ rejects as a hydration-level
// violation. The pill alone is the compact mobile toggle affordance; practice
// pages also expose their own explicit footer drawer toggle.

export interface BottomDrawerProps {
  readonly open: boolean;
  readonly onToggle: (next: boolean) => void;
  readonly header: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  /** Reserved for API stability — the handle strip is always visible and
   *  auto-sized by its content now that we use AnimatePresence. */
  readonly collapsedHeight?: number;
  readonly closeOnEsc?: boolean;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export function BottomDrawer({
  open,
  onToggle,
  header,
  footer,
  children,
  closeOnEsc = true,
  className,
  ariaLabel = '底部抽屉',
}: BottomDrawerProps) {
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onToggle(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onToggle]);

  return (
    <>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.button
            key="drawer-scrim"
            type="button"
            aria-label="关闭抽屉"
            onClick={() => onToggle(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="hidden md:block fixed inset-x-0 top-0 bottom-0 z-30 bg-sidebar/20"
          />
        ) : null}
      </AnimatePresence>
      <section
        role="dialog"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-line rounded-t-card-lg shadow-pop',
          'md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[620px] md:rounded-none md:border-t-0 md:border-l md:transition-transform md:duration-base md:ease-motion md:flex md:flex-col',
          open ? 'md:translate-x-0' : 'md:hidden md:pointer-events-none',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => onToggle(!open)}
          aria-expanded={open}
          aria-label={open ? '收起抽屉' : '展开抽屉'}
          className="w-full flex justify-center py-2 focus-visible:outline-none md:hidden"
        >
          <span aria-hidden="true" className="block w-9 h-[3px] rounded-[3px] bg-line-3" /> {/* hardcode-allow: drag handle 3×36px 半圆, sub-token 微调不在阶梯 */}
        </button>
        {open ? (
          <div className="px-6 pb-3 md:px-7 md:py-5 flex items-center justify-between w-full md:border-b md:border-line">
            {header}
          </div>
        ) : null}
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="drawer-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={MOTION_SPRING_SOFT}
              className="overflow-hidden max-h-[55vh] md:max-h-none md:flex-1 md:min-h-0"
            >
              <div className="px-6 pb-6 pt-2 max-h-[55vh] overflow-y-auto md:max-h-none md:h-full md:px-7 md:pt-4">
                {children}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {open && footer !== undefined ? footer : null}
      </section>
    </>
  );
}
