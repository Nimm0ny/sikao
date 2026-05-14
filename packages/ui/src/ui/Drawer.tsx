import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@sikao/shared-utils';
import { useDevice } from '@sikao/shared-utils/hooks/useDevice';
import { BottomSheet } from './BottomSheet';

/**
 * Drawer primitive (PR8, 2026-05-13) — Mobile and Tablet Pack New §iv /
 * Handoff §4.4 SSOT.
 *
 * 调用方契约: 不感知 device. mobile 自动降级 BottomSheet(size='tall'),
 * tablet 420w 右抽屉, desktop 480w 右抽屉. side='left' 镜像左抽屉.
 *
 * 关闭路径: Esc / 背景遮罩点击 (mobile 还有拖把手, 走 BottomSheet 内置).
 * 不带 close button (Handoff §5 注明).
 *
 * 跟旧 BottomDrawer (header / footer / onToggle) 解耦 — 新 callsite 用本组件,
 * 旧 callsite (ExamCustomSheet / AnswerCardDrawerHeader) 继续走 BottomDrawer.
 *
 * 实现: pure CSS transition (无 framer-motion), 入场 200ms ease-out, 退场同.
 */
export interface DrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly side?: 'right' | 'left';
  /** 默认 480 desktop · 420 tablet. mobile 走 BottomSheet 全宽. */
  readonly width?: number;
  readonly children: ReactNode;
  /** 无 title 时必填 a11y. */
  readonly 'aria-label'?: string;
}

const ANIM_MS = 200;
const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDrawerFocus(
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

function useDrawerMount(open: boolean): { isMounted: boolean; isExiting: boolean } {
  const [isMounted, setIsMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  useEffect(() => {
    if (open) {
      // setState 都放 RAF 回调内, 避免 react-hooks/set-state-in-effect 警告.
      const raf = window.requestAnimationFrame(() => {
        setIsExiting(false);
        setIsMounted(true);
      });
      return () => window.cancelAnimationFrame(raf);
    }
    if (!isMounted) return undefined;
    // 走 RAF + setTimeout, 两层都 async 避免同步 setState in effect.
    const raf = window.requestAnimationFrame(() => setIsExiting(true));
    const t = window.setTimeout(() => {
      setIsMounted(false);
      setIsExiting(false);
    }, ANIM_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [open, isMounted]);
  return { isMounted, isExiting };
}

interface SideDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly side: 'right' | 'left';
  readonly width: number;
  readonly children: ReactNode;
  readonly ariaLabel?: string;
}

function SideDrawer({
  open,
  onClose,
  title,
  side,
  width,
  children,
  ariaLabel,
}: SideDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const { isMounted, isExiting } = useDrawerMount(open);
  useDrawerFocus(open, panelRef, onClose);

  if (!open && !isMounted && !isExiting) return null;

  const visible = open && isMounted && !isExiting;
  const translateX = visible ? '0' : side === 'right' ? '100%' : '-100%';
  const labelledByTitle = title != null;

  return (
    // 背景遮罩 onClick 是鼠标 affordance, 键盘用户走 Esc (见 useDrawerFocus).
    // role=presentation.
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-modal bg-ink/40"
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${ANIM_MS}ms ease-out`,
      }}
      data-testid="drawer-backdrop"
    >
      {/* role=dialog + onClick stopPropagation 防点击穿透 backdrop. dialog 已是
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
          'fixed top-0 bottom-0 flex flex-col',
          'bg-paper-1 shadow-pop focus-visible:outline-none',
          side === 'right' ? 'right-0 border-l border-line' : 'left-0 border-r border-line',
        )}
        style={{
          width,
          transform: `translateX(${translateX})`,
          transition: `transform ${ANIM_MS}ms ease-out`,
        }}
        data-testid="drawer-panel"
        data-side={side}
      >
        {title != null ? (
          <header className="px-6 py-5 border-b border-line">
            <h2
              id={titleId}
              className="text-h3 font-serif font-medium text-ink m-0"
            >
              {title}
            </h2>
          </header>
        ) : null}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  width,
  children,
  'aria-label': ariaLabel,
}: DrawerProps) {
  const device = useDevice();
  if (device === 'mobile') {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        size="tall"
        aria-label={ariaLabel}
      >
        {children}
      </BottomSheet>
    );
  }
  const resolvedWidth = width ?? (device === 'tablet' ? 420 : 480);
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={title}
      side={side}
      width={resolvedWidth}
      ariaLabel={ariaLabel}
    >
      {children}
    </SideDrawer>
  );
}
