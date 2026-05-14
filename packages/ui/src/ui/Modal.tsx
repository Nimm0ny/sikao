import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@sikao/shared-utils';
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import { BottomSheet } from './BottomSheet';
import {
  MODAL_BACKDROP_VARIANTS,
  MODAL_PANEL_VARIANTS,
  MOTION_DURATION,
} from '@sikao/shared-utils';

// Replaces the `alert()` / `confirm()` blocked by harness §3.3. Minimal safe
// subset: overlay + focused card + Esc/backdrop close. Full focus-trap is
// intentionally deferred — the call sites we ship in phase 3 do not nest
// tabbable content deep enough to require it. When we do, swap the ref move
// for a proper trap without changing the API.
//
// PR8 (2026-05-13) — device-aware fallback: mobile (<1024) 自动渲染为
// BottomSheet(size='auto'); tablet/desktop 仍居中卡片. 调用方 API 不变 —
// 只是 mobile 视觉变成底部 sheet, 跟 Handoff §4.2 三态契约一致.

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: ModalSize;
  readonly closeOnBackdrop?: boolean;
  readonly closeOnEsc?: boolean;
  readonly ariaLabel?: string;
  readonly children?: ReactNode;
}

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

function MobileModalSheet({
  open,
  onClose,
  title,
  description,
  footer,
  ariaLabel,
  children,
}: Pick<
  ModalProps,
  'open' | 'onClose' | 'title' | 'description' | 'footer' | 'ariaLabel' | 'children'
>) {
  // title 在 BottomSheet 内只接 string; ReactNode title 退回到 aria-label.
  const titleString = typeof title === 'string' ? title : undefined;
  const fallbackAriaLabel =
    titleString != null ? undefined : ariaLabel ?? '对话框';
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={titleString}
      size="auto"
      aria-label={fallbackAriaLabel}
    >
      {/* title 是 ReactNode 时 (非 string), 在 body 内渲染 */}
      {titleString == null && title != null ? (
        <h2 className="text-h3 font-serif font-medium text-ink mb-2">{title}</h2>
      ) : null}
      {description != null ? (
        <p className="text-small text-ink-3 leading-relaxed mb-4">{description}</p>
      ) : null}
      {children != null ? (
        <div className="text-small text-ink-3 leading-relaxed">{children}</div>
      ) : null}
      {footer != null ? (
        <footer className="mt-4 pt-4 border-t border-line flex items-center justify-end gap-2">
          {footer}
        </footer>
      ) : null}
    </BottomSheet>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  ariaLabel,
  children,
}: ModalProps) {
  const device = useDevice();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || device === 'mobile') return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus();
  }, [open, device]);

  useEffect(() => {
    if (!open || !closeOnEsc || device === 'mobile') return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose, device]);

  // Mobile → BottomSheet 降级 (Handoff §4.2 三态契约).
  if (device === 'mobile') {
    return (
      <MobileModalSheet
        open={open}
        onClose={onClose}
        title={title}
        description={description}
        footer={footer}
        ariaLabel={ariaLabel}
      >
        {children}
      </MobileModalSheet>
    );
  }

  // tablet / desktop — 居中卡片 (现有 AnimatePresence 逻辑保留).
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="presentation"
          onClick={closeOnBackdrop ? onClose : undefined}
          className="fixed inset-0 z-modal bg-ink/50 flex items-center justify-center p-4"
          initial={MODAL_BACKDROP_VARIANTS.initial}
          animate={MODAL_BACKDROP_VARIANTS.animate}
          exit={MODAL_BACKDROP_VARIANTS.exit}
          transition={{ duration: MOTION_DURATION.base }}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            onClick={event => event.stopPropagation()}
            className={cn(
              'w-full bg-paper-1 rounded-card-lg border border-line shadow-pop',
              'focus-visible:outline-none',
              SIZE[size],
            )}
            initial={MODAL_PANEL_VARIANTS.initial}
            animate={MODAL_PANEL_VARIANTS.animate}
            exit={MODAL_PANEL_VARIANTS.exit}
            transition={{ duration: MOTION_DURATION.base }}
          >
            {title != null || description != null ? (
              <header className="px-6 pt-6 pb-4">
                {title != null ? (
                  <h2 className="text-lg font-bold text-ink">{title}</h2>
                ) : null}
                {description != null ? (
                  <p className="mt-2 text-sm text-ink-3 leading-relaxed">{description}</p>
                ) : null}
              </header>
            ) : null}
            {children != null ? (
              <div className="px-6 pb-6 text-sm text-ink-3 leading-relaxed">{children}</div>
            ) : null}
            {footer != null ? (
              <footer className="px-6 py-4 border-t border-line bg-paper-2 rounded-b-card-lg flex items-center justify-end gap-2">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
