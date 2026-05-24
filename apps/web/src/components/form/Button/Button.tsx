import { cloneElement, isValidElement } from 'react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import styles from './Button.module.css';

/*
 * Button — V5 D.3.1 form atom (skeleton).
 *
 * Why: 5 variants × 4 sizes × 6 states = the canonical action surface.
 *      Visual contract is fully token-driven (§4.2 component layer); CSS
 *      module owns size/variant/state mappings via data-* attrs.
 *      Fail-fast on iconOnly mis-use (children + iconOnly is undefined per
 *      §D.3.1 mutex contract); loading > disabled per spec.
 *
 * Gotchas (design.md §D.3.35):
 *   - root <button> must clear UA defaults (background/border/cursor) — see
 *     Button.module.css `.root` rules.
 *   - icon-only must carry aria-label; lint-icon-button enforces this at
 *     scan time, here we additionally fail-fast on missing aria-label so
 *     dev catches it before lint.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  readonly iconLeading?: ReactElement;
  readonly iconTrailing?: ReactElement;
  readonly iconOnly?: ReactElement;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly fullWidth?: boolean;
  readonly onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly children?: ReactNode;
  readonly 'aria-label'?: string;
}

function Spinner({ size }: { readonly size: ButtonSize }) {
  return (
    <span className={styles.spinner} data-size={size} aria-hidden="true" data-testid="button-spinner">
      <svg viewBox="0 0 16 16" focusable="false">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function sizedIcon(node: ReactElement, size: ButtonSize): ReactElement {
  if (!isValidElement(node)) return node;
  const existing = (node.props as { className?: string }).className ?? '';
  const merged = [styles.icon, existing].filter(Boolean).join(' ');
  return cloneElement(node as ReactElement<Record<string, unknown>>, {
    className: merged,
    'data-icon-size': size,
    'aria-hidden': true,
  });
}

export function Button({
  variant,
  size = 'md',
  iconLeading,
  iconTrailing,
  iconOnly,
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  children,
  'aria-label': ariaLabel,
}: ButtonProps) {
  if (iconOnly !== undefined && children !== undefined) {
    throw new Error('Button: `iconOnly` is mutually exclusive with `children`');
  }
  if (iconOnly !== undefined && (iconLeading !== undefined || iconTrailing !== undefined)) {
    throw new Error('Button: `iconOnly` is mutually exclusive with `iconLeading` / `iconTrailing`');
  }
  if (iconOnly !== undefined && (ariaLabel === undefined || ariaLabel.length === 0)) {
    throw new Error('Button: `iconOnly` requires a non-empty `aria-label` (a11y + lint-icon-button)');
  }
  // loading > disabled per §D.3.1 — loading already implies non-interactive,
  // so we set the native `disabled` even if the prop was false.
  const inert = loading || disabled;
  return (
    <button
      type={type}
      className={styles.root}
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      data-icon-only={iconOnly !== undefined || undefined}
      data-full-width={fullWidth || undefined}
      disabled={inert}
      aria-label={ariaLabel}
      aria-busy={loading ? true : undefined}
      onClick={onClick}
    >
      {loading ? <Spinner size={size} /> : null}
      {!loading && iconLeading ? sizedIcon(iconLeading, size) : null}
      {iconOnly && !loading ? sizedIcon(iconOnly, size) : null}
      {children !== undefined ? <span className={styles.label}>{children}</span> : null}
      {!loading && iconTrailing ? sizedIcon(iconTrailing, size) : null}
    </button>
  );
}
