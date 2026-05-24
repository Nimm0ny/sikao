import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Tooltip } from '../../overlay/Tooltip';
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
 *      Visual: width transition between --rail-w-collapsed / --rail-w-expanded;
 *      icon-only nav rows in collapsed state pair a <Tooltip> for label
 *      access (§D.3.35 icon-only contract). Mobile (<768) hides the rail
 *      via @media — AppShell additionally drops the slot from the tree, so
 *      this @media is a defense-in-depth.
 */

const STORAGE_KEY = 'v5-rail-collapsed';
const BREAKPOINT_EXPAND = 1280;

export interface RailNavItem {
  readonly id: string;
  readonly icon: ReactElement;
  readonly label: string;
  readonly href: string;
  readonly active?: boolean;
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

function IconRailToggle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
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
      <IconRailToggle />
    </button>
  );
}

interface RailBrandProps {
  readonly children: ReactNode;
  readonly collapsed: boolean;
  readonly onExpand: () => void;
}
export function RailBrand({ children, collapsed, onExpand }: RailBrandProps) {
  if (collapsed) {
    return (
      <Tooltip content="展开侧栏" shortcut={['Ctrl', '\\']} side="right">
        <button
          type="button"
          className={styles.brandButton}
          aria-label="展开侧栏"
          data-testid="rail-brand-collapsed"
          onClick={onExpand}
        >
          {children}
        </button>
      </Tooltip>
    );
  }
  return <div className={styles.brand} data-testid="rail-brand">{children}</div>;
}

interface RailCmdProps { readonly children: ReactNode }
export function RailCmd({ children }: RailCmdProps) {
  return <div className={styles.cmd}>{children}</div>;
}

interface RailNavProps {
  readonly items: readonly RailNavItem[];
  readonly collapsed: boolean;
}
export function RailNav({ items, collapsed }: RailNavProps) {
  return (
    <ul className={styles.navList} role="list">
      {items.map((item) => {
        const row = (
          <a
            href={item.href}
            className={styles.navItem}
            data-active={item.active || undefined}
            data-collapsed={collapsed || undefined}
            aria-label={collapsed ? item.label : undefined}
            aria-current={item.active ? 'page' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
            {!collapsed ? <span className={styles.navLabel}>{item.label}</span> : null}
          </a>
        );
        return (
          <li key={item.id} className={styles.navRow}>
            {collapsed ? (
              <Tooltip content={item.label} side="right">{row}</Tooltip>
            ) : row}
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
      <RailBrand collapsed={effectiveCollapsed} onExpand={() => setCollapsed(false)}>{brand}</RailBrand>
      {cmd !== undefined ? <RailCmd>{cmd}</RailCmd> : null}
      <RailNav items={navItems} collapsed={effectiveCollapsed} />
      <RailMe>{me}</RailMe>
      {!effectiveCollapsed ? (
        <RailToggleButton onClick={toggle} label="折叠侧栏" />
      ) : null}
    </aside>
  );
}
