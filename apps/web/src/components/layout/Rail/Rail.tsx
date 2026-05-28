import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { SpriteIcon } from '../../atom/SpriteIcon';
import { KeyboardShortcuts } from '../../system/KeyboardShortcuts';
import type { ShortcutEntry } from '../../system/KeyboardShortcuts';
import styles from './Rail.module.css';

/*
 * Rail — V5 D.3.32 layout (skeleton).
 *
 * Why: persistent left navigation column. Owns the §C.4.3 collapse state
 *      machine: 768-1279 default collapsed (80px), ≥1280 default expanded
 *      (240px), localStorage 'v5-rail-collapsed' persists user override,
 *      controlled `collapsed` prop wins above both. Ctrl/Cmd+\ toggles via
 *      <KeyboardShortcuts> registered inside the rail (not a global window
 *      listener — keeps cleanup tied to mount lifecycle).
 *
 *      SIK-121 W2: visual alignment with prototype `.tmp_review/home-frame.html`.
 *      H06 toggle button consumes sprite `rail-toggle`; H07 toggle sits inside
 *      the brand row trailing (expanded only); H10 renders "导航" section
 *      heading; Tooltip mode unified across brand / nav / me onto the pure
 *      CSS [data-tip]::after pattern (no React <Tooltip> overlay), matching
 *      W1 RailMe so all 3 collapsed-state tooltips share one CSS contract.
 *      See docs/plan/sik-rail-v5-visual-contract.md §7 H05–H10.
 */

const STORAGE_KEY = 'v5-rail-collapsed';
const BREAKPOINT_EXPAND = 1280;

export interface RailNavItem {
  readonly id: string;
  readonly icon: ReactElement;
  readonly label: string;
  readonly href: string;
  readonly active?: boolean;
  /**
   * Optional click interceptor. When provided, the underlying <a> calls
   * `e.preventDefault()` before invoking this handler so callers can
   * route through React Router (`useNavigate`) without triggering a
   * full-page reload. The `href` attribute is still rendered so middle-
   * click / right-click / keyboard-with-modifier "open in new tab" /
   * a11y reading flow keep working — handler is only for the plain
   * left-click path.
   */
  readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface RailProps {
  readonly brand: ReactNode;
  readonly cmd?: ReactNode;
  readonly navItems: readonly RailNavItem[];
  readonly me: ReactNode;
  readonly collapsed?: boolean;
  readonly onCollapseChange?: (next: boolean) => void;
}

function readStoredCollapsed(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // localStorage may be unavailable (Safari private mode) — fall through
    // to breakpoint default.
  }
  return null;
}

function readBreakpointCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < BREAKPOINT_EXPAND;
}

function persistCollapsed(next: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Persistence is best-effort.
  }
}

interface RailToggleButtonProps {
  readonly onClick: () => void;
  readonly label: string;
}
export function RailToggleButton({ onClick, label }: RailToggleButtonProps) {
  return (
    <button
      type="button"
      className={styles.toggle}
      data-testid="rail-toggle"
      aria-label={label}
      onClick={onClick}
    >
      <SpriteIcon id="rail-toggle" size={16} />
    </button>
  );
}

interface RailBrandProps {
  readonly children: ReactNode;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly onExpand: () => void;
}
export function RailBrand({ children, collapsed, onToggle, onExpand }: RailBrandProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.brandButton}
        aria-label="展开侧栏"
        data-testid="rail-brand-collapsed"
        data-tip="展开侧栏 (Ctrl+\\)"
        onClick={onExpand}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={styles.brand} data-testid="rail-brand">
      <span className={styles.brandContent}>{children}</span>
      <RailToggleButton onClick={onToggle} label="折叠侧栏" />
    </div>
  );
}

interface RailCmdProps { readonly children: ReactNode }
export function RailCmd({ children }: RailCmdProps) {
  return <div className={styles.cmd}>{children}</div>;
}

interface RailNavSectionProps { readonly label: string }
export function RailNavSection({ label }: RailNavSectionProps) {
  // H10: section heading "导航" visible only in expanded state. Collapsed
  // state hides via :root[data-rail="collapsed"] override in the CSS module.
  return <div className={styles.navSection}>{label}</div>;
}

interface RailNavProps {
  readonly items: readonly RailNavItem[];
  readonly collapsed: boolean;
}
export function RailNav({ items, collapsed }: RailNavProps) {
  return (
    <ul className={styles.navList} role="list">
      {items.map((item) => {
        const handleClick = item.onClick
          ? (event: MouseEvent<HTMLAnchorElement>) => {
              // Plain left-click without modifiers → SPA route via callback.
              // Modifier-clicks (Cmd/Ctrl/Shift) and middle-click fall
              // through to the native href so "open in new tab" still works.
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              item.onClick!(event);
            }
          : undefined;
        return (
          <li key={item.id} className={styles.navRow}>
            <a
              href={item.href}
              className={styles.navItem}
              data-active={item.active || undefined}
              data-collapsed={collapsed || undefined}
              data-tip={item.label}
              aria-label={collapsed ? item.label : undefined}
              aria-current={item.active ? 'page' : undefined}
              onClick={handleClick}
            >
              <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
              {!collapsed ? <span className={styles.navLabel}>{item.label}</span> : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

interface RailMeProps { readonly children: ReactNode }
export function RailMe({ children }: RailMeProps) {
  return <div className={styles.me}>{children}</div>;
}

export function Rail({ brand, cmd, navItems, me, collapsed, onCollapseChange }: RailProps) {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    const stored = readStoredCollapsed();
    if (stored !== null) return stored;
    return readBreakpointCollapsed();
  });
  const isControlled = collapsed !== undefined;
  const effectiveCollapsed = isControlled ? collapsed : internalCollapsed;

  const setCollapsed = useCallback((next: boolean) => {
    if (!isControlled) {
      setInternalCollapsed(next);
      persistCollapsed(next);
    }
    onCollapseChange?.(next);
  }, [isControlled, onCollapseChange]);

  const toggle = useCallback(() => {
    setCollapsed(!effectiveCollapsed);
  }, [setCollapsed, effectiveCollapsed]);

  // Sync :root[data-rail] so tokens.css §7 picks up the user override.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-rail', effectiveCollapsed ? 'collapsed' : 'expanded');
  }, [effectiveCollapsed]);

  // Ctrl/Cmd+\ toggles. Registered through KeyboardShortcuts so the listener
  // unbinds on unmount and a future scope-aware version still works.
  const shortcuts: readonly ShortcutEntry[] = useMemo(() => [
    { keys: ['Control', '\\'], handler: () => toggle(), description: '折叠/展开侧栏' },
    { keys: ['Meta', '\\'], handler: () => toggle(), description: '折叠/展开侧栏 (mac)' },
  ], [toggle]);

  return (
    <aside
      role="navigation"
      aria-label="主侧栏"
      className={styles.rail}
      data-collapsed={effectiveCollapsed || undefined}
      data-testid="rail"
    >
      <KeyboardShortcuts shortcuts={shortcuts} />
      <RailBrand
        collapsed={effectiveCollapsed}
        onToggle={toggle}
        onExpand={() => setCollapsed(false)}
      >
        {brand}
      </RailBrand>
      {cmd !== undefined ? <RailCmd>{cmd}</RailCmd> : null}
      <RailNavSection label="导航" />
      <RailNav items={navItems} collapsed={effectiveCollapsed} />
      <RailMe>{me}</RailMe>
    </aside>
  );
}
