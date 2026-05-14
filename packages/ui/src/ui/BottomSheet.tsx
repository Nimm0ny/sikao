import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@sikao/shared-utils';

/**
 * BottomSheet primitive (PR8, 2026-05-13) — Mobile and Tablet Pack New
 * §iv / Handoff §4.3 SSOT. role=dialog · grabber 拖 >80px 关 · paper-1 顶角
 * rounded-card-lg + shadow-pop + env(safe-area-inset-bottom). 高度 auto/tall=88dvh
 * /full=100dvh, visualViewport.height 双保险 (键盘弹起). pure CSS + pointer events.
 */
export interface BottomSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  /** 'auto' = content-fit · 'tall' = 88dvh · 'full' = 100dvh */
  readonly size?: 'auto' | 'tall' | 'full';
  readonly children: ReactNode;
  /** 用于 a11y. 没 title 时必填. */
  readonly 'aria-label'?: string;
}

const DRAG_CLOSE_THRESHOLD = 80; // px · Handoff §4.3
const ANIM_MS = 200;
const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 焦点收口 — 打开 focus 首个 + Esc 关 + Tab 循环 + 退场还原.
function useSheetFocus(
  open: boolean,
  panelRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void {
  const previousFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const node = panelRef.current;
    if (node == null) return;
    const focusable = node.querySelector<HTMLElement>(FOCUSABLE_SEL);
    (focusable ?? node).focus();
    return () => previousFocus.current?.focus?.();
  }, [open, panelRef]);
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') return onClose();
      if (event.key !== 'Tab') return;
      const node = panelRef.current;
      if (node == null) return;
      const list = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
      if (list.length === 0) return event.preventDefault();
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, panelRef]);
}

function useSheetMount(open: boolean): {
  isMounted: boolean;
  isExiting: boolean;
  setIsExiting: (v: boolean) => void;
} {
  const [isMounted, setIsMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  useEffect(() => {
    if (open) {
      // 在 RAF 回调里翻 isMounted → 触发 transition. 同步 setIsExiting(false)
      // 也放回调内, 避免 react-hooks/set-state-in-effect 警告.
      const raf = window.requestAnimationFrame(() => {
        setIsExiting(false);
        setIsMounted(true);
      });
      return () => window.cancelAnimationFrame(raf);
    }
    // open=false 异步 reset (next microtask) 避免 sync setState in effect.
    const raf = window.requestAnimationFrame(() => setIsMounted(false));
    return () => window.cancelAnimationFrame(raf);
  }, [open]);
  return { isMounted, isExiting, setIsExiting };
}

function useVisualViewportHeight(open: boolean): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv == null) return;
    const handler = (): void => setH(vv.height);
    // 初始 height 走 RAF, 避免 sync setState in effect (react-hooks rule).
    const raf = window.requestAnimationFrame(() => setH(vv.height));
    vv.addEventListener('resize', handler);
    return () => {
      window.cancelAnimationFrame(raf);
      vv.removeEventListener('resize', handler);
    };
  }, [open]);
  return h;
}

function useDragToClose(requestClose: () => void): {
  dragOffset: number;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  };
} {
  const startY = useRef<number | null>(null);
  const pointerId = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    startY.current = e.clientY;
    pointerId.current = e.pointerId;
    // setPointerCapture 在 jsdom 不存在; 真浏览器才生效. 测试环境跳过.
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (startY.current == null || pointerId.current !== e.pointerId) return;
    const delta = e.clientY - startY.current;
    setDragOffset(delta > 0 ? delta : 0);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (startY.current == null || pointerId.current !== e.pointerId) return;
    const delta = e.clientY - startY.current;
    startY.current = null;
    pointerId.current = null;
    if (typeof e.currentTarget.releasePointerCapture === 'function') {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // releasePointerCapture 已释放抛 InvalidStateError 是 DOM spec.
      }
    }
    if (delta > DRAG_CLOSE_THRESHOLD) requestClose();
    else setDragOffset(0);
  };
  return {
    dragOffset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

function resolveHeight(
  size: NonNullable<BottomSheetProps['size']>,
  vh: number | null,
): CSSProperties {
  if (vh != null && size !== 'auto') {
    return { height: Math.min(vh * (size === 'full' ? 1 : 0.88), vh) };
  }
  if (size === 'auto') return { height: 'auto' };
  return { height: size === 'full' ? '100dvh' : '88dvh' };
}

export function BottomSheet({
  open,
  onClose,
  title,
  size = 'auto',
  children,
  'aria-label': ariaLabel,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { isMounted, isExiting, setIsExiting } = useSheetMount(open);
  const vh = useVisualViewportHeight(open);
  const titleId = useId();
  useSheetFocus(open, panelRef, onClose);

  const requestClose = useCallback((): void => {
    if (isExiting) return;
    setIsExiting(true);
    window.setTimeout(onClose, ANIM_MS);
  }, [isExiting, onClose, setIsExiting]);

  const { dragOffset, handlers } = useDragToClose(requestClose);

  if (!open && !isExiting) return null;

  const translateY = isExiting
    ? '100%'
    : dragOffset > 0
      ? `${dragOffset}px`
      : isMounted
        ? '0'
        : '100%';
  const labelledByTitle = title != null;

  return (
    // 背景遮罩 onClick=requestClose 是鼠标 affordance, 键盘用户走 Esc
    // (见 useSheetFocus). div+role=presentation.
    <div
      role="presentation"
      onClick={requestClose}
      className="fixed inset-0 z-modal flex items-end justify-center bg-ink/40"
      style={{
        opacity: isExiting ? 0 : isMounted ? 1 : 0,
        transition: `opacity ${ANIM_MS}ms ease-out`,
      }}
      data-testid="bottom-sheet-backdrop"
    >
      {/* role=dialog + onClick stopPropagation 防点击穿透到 backdrop. dialog 已是
          interactive 但 plugin 仍报 noninteractive-element-interactions, 行内
          disable. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledByTitle ? undefined : ariaLabel}
        aria-labelledby={labelledByTitle ? titleId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'relative w-full max-w-[640px] flex flex-col',
          'bg-paper-1 rounded-card-lg shadow-pop focus-visible:outline-none',
        )}
        style={{
          ...resolveHeight(size, vh),
          transform: `translateY(${translateY})`,
          transition: dragOffset > 0 ? 'none' : `transform ${ANIM_MS}ms ease-out`,
          maxHeight: size === 'auto' ? '88dvh' : undefined,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
        data-testid="bottom-sheet-panel"
      >
        <div
          role="button"
          aria-label="拖拽关闭"
          tabIndex={0}
          {...handlers}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              requestClose();
            }
          }}
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          data-testid="bottom-sheet-grabber"
        >
          <span
            aria-hidden="true"
            className="block h-1 w-9 rounded-pill bg-paper-3"
          />
        </div>
        {title != null ? (
          <h2
            id={titleId}
            className="px-5 pb-3 text-h3 font-serif font-medium text-ink"
          >
            {title}
          </h2>
        ) : null}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
