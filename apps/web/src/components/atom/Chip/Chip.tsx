import type { ReactElement, ReactNode } from 'react';
import { Tag } from '../Tag/Tag';
import type { TagProps } from '../Tag/Tag';
import type { BadgeSize, BadgeVariant } from '../Badge/Badge';
import styles from './Chip.module.css';

/*
 * Chip — V5 D.3.8 atom (skeleton).
 *
 * Why: visually based on Tag/Badge, but Chip semantically marks a
 *      user-selectable facet (filter chip / chosen value). Two modes:
 *
 *      1. **Static** (no `onSelect`): pass-through to <Tag>. Identical to
 *         the Phase 3 V5-M3 contract. Used for read-only category /
 *         removable-selection patterns.
 *
 *      2. **Selectable** (`onSelect` provided): renders as a <button>
 *         with `aria-pressed={active}` so screen readers see the toggle
 *         state. The bespoke `.chip` rules that Note / Question Hub /
 *         Review used to ship in their view module.css collapse into
 *         this single primitive — a 60-line CSS block × 3 views was
 *         eliminated by this expansion. `variant` defaults to `neutral`
 *         in selectable mode (so callers don't have to wire one); the
 *         active visual contract per V5 spec §D.4.3 R2/Q1 is inverted
 *         black (--color-text-primary bg + --color-bg-surface text).
 *         Pass `variant="brand"` to opt into the brand-yellow active
 *         visual (Note favorite toggle pattern).
 */

export interface ChipProps {
  readonly variant?: BadgeVariant;
  readonly size?: BadgeSize;
  readonly leading?: ReactElement;
  readonly children: ReactNode;
  readonly onRemove?: () => void;
  readonly removeAriaLabel?: string;
  readonly active?: boolean;
  readonly onSelect?: () => void;
  readonly selectAriaLabel?: string;
  readonly disabled?: boolean;
}

export function Chip({
  variant,
  size = 'md',
  leading,
  children,
  onRemove,
  removeAriaLabel,
  active = false,
  onSelect,
  selectAriaLabel,
  disabled = false,
}: ChipProps) {
  // Static mode: pass-through to Tag for the legacy shape. Tag's variant
  // prop is required, so we default to 'neutral' if the caller didn't
  // provide one — matches Tag's typical removable-selection pattern.
  if (onSelect === undefined) {
    const tagProps: TagProps = {
      variant: variant ?? 'neutral',
      size,
      leading,
      children,
      onRemove,
      removeAriaLabel,
    };
    return <Tag {...tagProps} />;
  }

  // Selectable mode: button-based; inverted-black active visual by default,
  // brand-yellow active visual when variant="brand" (Note favorite toggle).
  const effectiveVariant: BadgeVariant = variant ?? 'neutral';
  return (
    <button
      type="button"
      className={styles.chipButton}
      data-variant={effectiveVariant}
      data-size={size}
      data-active={active || undefined}
      data-disabled={disabled || undefined}
      aria-pressed={active}
      aria-label={selectAriaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect();
      }}
    >
      {leading !== undefined ? (
        <span className={styles.leading} aria-hidden="true">
          {leading}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
