import { useEffect } from 'react';

/*
 * KeyboardShortcuts — V5 D.3.34 a11y system layer (skeleton).
 *
 * Why: pure side-effect component that registers a single window-level
 *      keydown listener and dispatches to whichever shortcut entry matches
 *      the modifier set + trigger key. Renders null. Fail-fast on empty
 *      shortcut arrays (caller programming error).
 *
 * TODO(V5-M3 D.3.34 modal scope): integrate with FocusTrap + scope context
 *      so `scope: 'modal'` only fires when the active focus trap matches.
 *      For now scope is stored but every shortcut dispatches globally.
 */

export type ShortcutScope = 'global' | 'page' | 'modal';

export interface ShortcutEntry {
  readonly keys: readonly string[];
  readonly handler: (e: KeyboardEvent) => void;
  readonly scope?: ShortcutScope;
  readonly description: string;
}

export interface KeyboardShortcutsProps {
  readonly shortcuts: readonly ShortcutEntry[];
}

const MODIFIERS = new Set(['Control', 'Ctrl', 'Meta', 'Cmd', 'Command', 'Shift', 'Alt', 'Option']);
const TRIGGER_ALIASES: Record<string, string> = {
  backslash: '\\',
  slash: '/',
  space: ' ',
  esc: 'escape',
  return: 'enter',
};

function matches(entry: ShortcutEntry, e: KeyboardEvent): boolean {
  if (entry.keys.length === 0) return false;
  const wantCtrl = entry.keys.some((k) => /^(control|ctrl)$/i.test(k));
  const wantMeta = entry.keys.some((k) => /^(meta|cmd|command)$/i.test(k));
  const wantShift = entry.keys.some((k) => /^shift$/i.test(k));
  const wantAlt = entry.keys.some((k) => /^(alt|option)$/i.test(k));
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.metaKey !== wantMeta) return false;
  if (e.shiftKey !== wantShift) return false;
  if (e.altKey !== wantAlt) return false;
  const trigger = entry.keys.find((k) => !MODIFIERS.has(k) && !/^(control|ctrl|meta|cmd|command|shift|alt|option)$/i.test(k));
  if (trigger === undefined) return false;
  const normalized = (TRIGGER_ALIASES[trigger.toLowerCase()] ?? trigger).toLowerCase();
  return e.key.toLowerCase() === normalized;
}

export function KeyboardShortcuts({ shortcuts }: KeyboardShortcutsProps): null {
  useEffect(() => {
    if (shortcuts.length === 0) return;
    function handler(e: KeyboardEvent) {
      for (const entry of shortcuts) {
        if (matches(entry, e)) entry.handler(e);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
  return null;
}
