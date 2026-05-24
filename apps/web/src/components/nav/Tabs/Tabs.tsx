import type { ReactElement } from 'react';
import styles from './Tabs.module.css';

/*
 * Tabs — V5 D.3.3 nav primitive (skeleton).
 *
 * Why: 3 visual variants (underline / pill / segmented) sharing the same
 *      tab roving-tablist a11y contract. SegmentedControl is NOT a separate
 *      component (R2/Q2 decision); business code that needs a "scope toggle"
 *      composes ScopeToggle which is just `<Tabs variant="segmented">`.
 *
 *      We render `role="tablist"` on the outer container and `role="tab"`
 *      on each item with `aria-selected` synced to the active key.
 *      Visuals are token-driven via data-* attrs; the underline/pill/seg
 *      shapes live in Tabs.module.css.
 *
 *      `noPanel` (default false): when true, drops the `aria-controls`
 *      attribute. Use this when the tab acts as a state-flipper rather
 *      than the heading of a sibling tabpanel — the canonical case is
 *      ScopeToggle (variant="segmented" + business state flip; caller
 *      owns the body, no `<div role="tabpanel" id="tabpanel-<key>">`
 *      sibling exists). Without this prop the axe rule
 *      `aria-valid-attr-value` fires because the referenced tabpanel
 *      element is missing.
 */

export interface TabItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: ReactElement;
  readonly disabled?: boolean;
}

export type TabsVariant = 'underline' | 'pill' | 'segmented';
export type TabsSize = 'sm' | 'md';

export interface TabsProps {
  readonly variant?: TabsVariant;
  readonly items: ReadonlyArray<TabItem>;
  readonly active: string;
  readonly onChange: (key: string) => void;
  readonly size?: TabsSize;
  readonly noPanel?: boolean;
  readonly 'aria-label'?: string;
}

export function Tabs({
  variant = 'underline',
  items,
  active,
  onChange,
  size = 'md',
  noPanel = false,
  'aria-label': ariaLabel,
}: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={styles.root}
      data-variant={variant}
      data-size={size}
    >
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={isActive}
            aria-controls={noPanel ? undefined : `tabpanel-${item.key}`}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            className={styles.tab}
            data-active={isActive || undefined}
            data-disabled={item.disabled || undefined}
            onClick={() => {
              if (!item.disabled) onChange(item.key);
            }}
          >
            {item.icon !== undefined ? <span className={styles.icon} aria-hidden="true">{item.icon}</span> : null}
            <span className={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
