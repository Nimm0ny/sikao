import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, KeyboardEventHandler, MouseEvent, ReactElement } from 'react';
import { Popover } from '../../overlay/Popover';
import styles from './Select.module.css';

/*
 * Select / Combobox — V5 D.3.13 form atom (skeleton).
 *
 * Why: single-select dropdown with optional search filter (combobox mode).
 *      Wraps D.3.20 Popover for the panel surface so positioning, click-
 *      outside dismissal and z-index ladder match the rest of the overlay
 *      layer. State machine per design.md §D.3.13:
 *        closed / focus / open / searching / selected / disabled
 *
 * Generics:
 *   - The component is parameterized over T so non-string values
 *     (numbers, branded ids, enums) flow through value/onChange/options
 *     without `any`. React.FC does not support generics; we declare it as
 *     a plain function with a generic signature instead.
 *   - clearable triggers onChange(undefined as T). The undefined coercion
 *     is documented in design.md §D.3.13: clearable selects logically
 *     mean "no value" so the contract is intentional even though the
 *     formal type is T (the caller picks T = X | undefined when using
 *     clearable; this is enforced at the call site, not at the prop).
 *
 * DOM structure:
 *   - `<button role="combobox">` is the trigger Popover toggles on.
 *   - The clear "x" sibling-button is positioned absolutely OUTSIDE the
 *     trigger button (HTML forbids nested buttons). It stops propagation
 *     so clicking clear does not also toggle Popover open.
 *
 * Skeleton stage delivers Enter (select) / Esc (close) keyboard. Full
 * roving ↑/↓ tab-index lands later when D.3.34 keyboard map is wired.
 */

export interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
  readonly icon?: ReactElement;
  readonly disabled?: boolean;
}

export type SelectSize = 'sm' | 'md' | 'lg';

function enabledOptions<T>(options: ReadonlyArray<SelectOption<T>>): SelectOption<T>[] {
  return options.filter((option) => option.disabled !== true);
}

function nextOptionByDirection<T>(
  options: ReadonlyArray<SelectOption<T>>,
  currentValue: T,
  direction: 1 | -1,
): SelectOption<T> | undefined {
  const selectable = enabledOptions(options);
  if (selectable.length === 0) return undefined;
  const currentIndex = selectable.findIndex((option) => option.value === currentValue);
  if (currentIndex === -1) {
    return direction === 1 ? selectable[0] : selectable[selectable.length - 1];
  }
  return selectable[(currentIndex + direction + selectable.length) % selectable.length];
}

export interface SelectProps<T = string> {
  readonly value: T;
  readonly onChange: (v: T) => void;
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly placeholder?: string;
  readonly searchable?: boolean;
  readonly clearable?: boolean;
  readonly size?: SelectSize;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  readonly onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  readonly 'aria-label'?: string;
}

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 5l4 4 4-4" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 3l6 6M9 3l-6 6" />
    </svg>
  );
}

export function Select<T = string>({
  value,
  onChange,
  options,
  placeholder = '请选择',
  searchable = false,
  clearable = false,
  size = 'md',
  invalid = false,
  disabled = false,
  autoFocus = false,
  onKeyDown,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!searchable || query.length === 0) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchable, query]);

  const handleOpenChange = (next: boolean) => {
    if (disabled) return;
    setOpen(next);
    if (!next) setQuery('');
  };

  const handleSelect = (opt: SelectOption<T>) => {
    if (opt.disabled === true) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onChange(undefined as unknown as T);
  };

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (disabled) return;
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!searchable && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const next = nextOptionByDirection(options, value, e.key === 'ArrowDown' ? 1 : -1);
      if (next !== undefined) onChange(next.value);
      return;
    }
    if (!searchable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen((current) => !current);
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = filtered.find((o) => o.disabled !== true);
      if (first !== undefined) handleSelect(first);
    }
  };

  const trigger = (
    <button
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? 'select-listbox' : undefined}
      aria-label={ariaLabel}
      className={styles.trigger}
      data-size={size}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-open={open || undefined}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={handleTriggerKeyDown}
    >
      <span
        className={styles.label}
        data-placeholder={selected === undefined || undefined}
      >
        {selected !== undefined ? selected.label : placeholder}
      </span>
      <span className={styles.suffix} aria-hidden="true">
        <ChevronIcon />
      </span>
    </button>
  );

  return (
    <span className={styles.root}>
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        trigger={trigger}
        width="trigger"
        side="bottom"
        align="start"
        panelClassName={styles.popoverPanel}
      >
        <div className={styles.panel}>
          {searchable ? (
            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              value={query}
              placeholder="搜索"
              aria-label="搜索选项"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          ) : null}
          <ul id="select-listbox" className={styles.list} role="listbox">
            {filtered.length === 0 ? (
              <li className={styles.empty} data-testid="select-empty">无结果</li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                return (
                  <li
                    key={`${idx}-${opt.label}`}
                    className={styles.option}
                    data-disabled={opt.disabled || undefined}
                    data-selected={isSelected || undefined}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={styles.optionBtn}
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                    >
                      {opt.icon !== undefined ? (
                        <span className={styles.optionIcon} aria-hidden="true">
                          {opt.icon}
                        </span>
                      ) : null}
                      <span className={styles.optionLabel}>{opt.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </Popover>
      {clearable && selected !== undefined && !disabled ? (
        <button
          type="button"
          className={styles.clearBtn}
          aria-label="清空"
          onClick={handleClear}
        >
          <ClearIcon />
        </button>
      ) : null}
    </span>
  );
}
