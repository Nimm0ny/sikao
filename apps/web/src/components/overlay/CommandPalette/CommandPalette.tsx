import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactElement } from 'react';
import { FocusTrap } from '../../system/FocusTrap';
import { COMMAND_PALETTE } from '@/lib/ui-copy';
import styles from './CommandPalette.module.css';

/*
 * CommandPalette — V5 D.3.26 overlay (skeleton).
 *
 * Why: cmd-k command surface. NOT delegated to <Modal> — Modal forces
 *      primaryAction + title + chrome we don't want here. We replicate the
 *      portal + FocusTrap + body-scroll-lock + Esc protocol so the palette
 *      stays consistent with the rest of the overlay layer (D.3.6 / D.3.34).
 *      Caller registers Ctrl+K / ⌘K via <KeyboardShortcuts> at the layout
 *      level; this component owns the OPEN-state UX (search + ↓↑Enter Esc).
 *      aria pattern follows W3C combobox + listbox.
 *
 *      Mount-on-open: <Panel> only renders while open=true so query / index
 *      state are fresh per-open without a setState-in-effect reset
 *      (react-hooks/set-state-in-effect). 30vh top offset is cmd-k canonical.
 */

export interface CommandPaletteItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactElement;
  readonly shortcut?: readonly string[];
  readonly onSelect: () => void;
}
export interface CommandPaletteGroup {
  readonly label: string;
  readonly items: readonly CommandPaletteItem[];
}
export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly groups: readonly CommandPaletteGroup[];
  readonly placeholder?: string;
}

interface FlatItem { readonly groupLabel: string; readonly item: CommandPaletteItem }

function flatten(groups: readonly CommandPaletteGroup[], query: string): FlatItem[] {
  const q = query.trim().toLowerCase();
  const out: FlatItem[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (q === '' || item.label.toLowerCase().includes(q)) out.push({ groupLabel: g.label, item });
    }
  }
  return out;
}

function regroup(flat: readonly FlatItem[]): { label: string; items: FlatItem[] }[] {
  const out: { label: string; items: FlatItem[] }[] = [];
  for (const f of flat) {
    const last = out[out.length - 1];
    if (last && last.label === f.groupLabel) last.items.push(f);
    else out.push({ label: f.groupLabel, items: [f] });
  }
  return out;
}

interface PanelProps {
  readonly onClose: () => void;
  readonly groups: readonly CommandPaletteGroup[];
  readonly placeholder: string;
}

function Panel({ onClose, groups, placeholder }: PanelProps) {
  const reactId = useId();
  const listboxId = `cmdk-list-${reactId}`;
  const optionId = (i: number) => `cmdk-opt-${reactId}-${i}`;
  const [query, setQuery] = useState('');
  const [rawHighlighted, setRawHighlighted] = useState(0);
  const visibleFlat = useMemo(() => flatten(groups, query), [groups, query]);
  // Clamp inline (rather than via a setState-in-effect): ensures the active
  // index is always valid for the current filter without an extra render.
  const highlightedIndex = visibleFlat.length === 0
    ? 0
    : Math.min(Math.max(rawHighlighted, 0), visibleFlat.length - 1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSelect = useCallback((item: CommandPaletteItem) => {
    item.onSelect();
    onClose();
  }, [onClose]);

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleFlat.length > 0) setRawHighlighted((i) => (i + 1) % visibleFlat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleFlat.length > 0) setRawHighlighted((i) => (i - 1 + visibleFlat.length) % visibleFlat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = visibleFlat[highlightedIndex];
      if (sel) handleSelect(sel.item);
    }
  };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;
  const rendered = regroup(visibleFlat);
  const activeId = visibleFlat.length > 0 ? optionId(highlightedIndex) : undefined;

  return createPortal(
    <div className={styles.overlay} data-testid="cmdk-overlay">
      <FocusTrap active>
        <div role="dialog" aria-label="命令面板" className={styles.panel} data-testid="cmdk-panel">
          <div className={styles.inputRow}>
            <input
              type="text" autoFocus className={styles.input}
              role="combobox" aria-expanded={true} aria-controls={listboxId}
              aria-activedescendant={activeId}
              aria-label="搜索命令"
              placeholder={placeholder} value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
            />
          </div>
          <div id={listboxId} role="listbox" className={styles.list} aria-label="命令结果">
            {visibleFlat.length === 0 ? (
              <div className={styles.empty} data-testid="cmdk-empty">{COMMAND_PALETTE.emptyResult}</div>
            ) : rendered.map((g) => (
              <div key={g.label} className={styles.group}>
                <div className={styles.groupHeader}>{g.label}</div>
                {g.items.map((f) => {
                  const flatIdx = visibleFlat.indexOf(f);
                  const isActive = flatIdx === highlightedIndex;
                  return (
                    <button
                      key={f.item.id} type="button" id={optionId(flatIdx)}
                      role="option" aria-selected={isActive ? true : false}
                      data-active={isActive || undefined}
                      className={styles.option}
                      onClick={() => handleSelect(f.item)}
                      onMouseEnter={() => setRawHighlighted(flatIdx)}
                    >
                      {f.item.icon !== undefined ? (
                        <span className={styles.icon} aria-hidden="true">{f.item.icon}</span>
                      ) : null}
                      <span className={styles.label}>{f.item.label}</span>
                      {f.item.shortcut && f.item.shortcut.length > 0 ? (
                        <span className={styles.shortcut}>
                          {f.item.shortcut.map((k, i) => <kbd key={i} className={styles.kbd}>{k}</kbd>)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </FocusTrap>
    </div>,
    portalTarget,
  );
}

export function CommandPalette({
  open, onClose, groups, placeholder = '搜索命令、笔记、题目…',
}: CommandPaletteProps) {
  if (!open) return null;
  return <Panel onClose={onClose} groups={groups} placeholder={placeholder} />;
}
