import { useState } from 'react';
import type { CSSProperties, FormEvent, MouseEvent } from 'react';
import { Input } from '../Input';
import type { InputSize } from '../Input';
import { Popover } from '../../overlay/Popover';
import styles from './Search.module.css';

/*
 * Search — V5 D.3.17 form atom (skeleton).
 *
 * Why: page-local search field (≠ rail Cmd-K palette D.3.26). Layered on
 *      top of D.3.2 Input so prefix/suffix slots, focus chrome and size
 *      buckets stay synchronized. Outer shell is a native <form> with
 *      role="search" — ARIA Practices canonical pattern that exposes a
 *      search landmark and natively submits on Enter.
 *
 * Composition:
 *   - prefix slot: inline magnifier SVG (16x16). M4 will swap in sprite.
 *   - suffix slot: clear "×" button rendered when clearable && value.
 *   - Popover: opens on suggestions[].length > 0; click on a row mirrors
 *     the typed value into onChange and closes the panel.
 */

export type SearchSize = 'sm' | 'md' | 'lg';

export interface SearchProps {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSubmit?: (v: string) => void;
  readonly placeholder?: string;
  readonly size?: SearchSize;
  readonly width?: number | string;
  readonly suggestions?: ReadonlyArray<string>;
  readonly clearable?: boolean;
  readonly 'aria-label'?: string;
}

function MagnifierIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="5" />
      <path d="M11 11l3 3" />
    </svg>
  );
}

function ClearButton({ onClear }: { readonly onClear: () => void }) {
  return (
    <button
      type="button"
      className={styles.clearBtn}
      aria-label="清空"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        // Don't bubble into the Popover trigger toggle path.
        e.stopPropagation();
        onClear();
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        aria-hidden="true" focusable="false">
        <path d="M3 3l8 8M11 3l-8 8" />
      </svg>
    </button>
  );
}

export function Search({
  value,
  onChange,
  onSubmit,
  placeholder,
  size = 'md',
  width = 240,
  suggestions,
  clearable = true,
  'aria-label': ariaLabel,
}: SearchProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const hasSuggestions = suggestions !== undefined && suggestions.length > 0;
  const showClear = clearable && value.length > 0;

  const wrapStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
  };
  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit) onSubmit(value);
  };

  // Trigger MUST be a host element so Popover can attach a callback ref.
  const inputBundle = (
    <span className={styles.inputWrap}>
      <Input
        type="search"
        size={size as InputSize}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel ?? '搜索'}
        prefix={<MagnifierIcon />}
        suffix={showClear ? <ClearButton onClear={() => onChange('')} /> : undefined}
      />
    </span>
  );

  const handlePick = (s: string) => {
    onChange(s);
    setPopoverOpen(false);
    if (onSubmit) onSubmit(s);
  };

  return (
    <form role="search" className={styles.root} style={wrapStyle} onSubmit={handleFormSubmit}>
      {hasSuggestions ? (
        <Popover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          trigger={inputBundle}
          width="trigger"
          side="bottom"
          align="start"
        >
          <ul className={styles.suggestionList} role="listbox" aria-label="搜索建议">
            {suggestions.map((s) => (
              <li key={s} className={styles.suggestionRow}>
                <button
                  type="button"
                  className={styles.suggestionItem}
                  role="option"
                  aria-selected={s === value}
                  onClick={() => handlePick(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </Popover>
      ) : (
        inputBundle
      )}
    </form>
  );
}
