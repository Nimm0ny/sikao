import { useCallback, useEffect, useRef, useState } from 'react';

// useInputMode (PR13 P1, 2026-05-13) — 申论双模输入态侦测.
//
// Why a dedicated hook instead of inline pointerType check:
//   1. 300ms debounce against rapid pen/keyboard interleave (handoff §7 risk),
//      kept entirely inside the hook so call sites do not reimplement timing.
//   2. Single source of truth for `lastEventType` so the UI badge ([✎ 手写] /
//      [⌨ 键入]) does not contradict the editor split (TypedEditor /
//      HandwriteEditor) when both devices are connected.
//   3. `switchMode` escape hatch keeps the event-driven contract clean: the
//      UI cannot poke `setMode` directly, only request a manual override
//      via this single typed entry point.

export type InputMode = 'typed' | 'handwritten' | 'idle';

export type InputEventType = 'keyboard' | 'pen';

export interface UseInputModeResult {
  readonly mode: InputMode;
  readonly lastEventType: InputEventType | null;
  readonly switchMode: (mode: InputMode) => void;
  readonly isDebouncing: boolean;
}

const DEBOUNCE_MS = 300;

// Keys we treat as "user is typing prose" even though they are not strictly
// printable single chars. Arrow keys + delete + space + enter + tab all
// signal keyboard intent during essay drafting. Modifier-only chords
// (Ctrl+S save, Shift+Tab navigate) do NOT switch mode.
const TYPING_KEY_WHITELIST = new Set<string>([
  'Backspace',
  'Enter',
  'Tab',
  ' ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

const MODIFIER_KEYS = new Set<string>([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'AltGraph',
  'ContextMenu',
  'OS',
  'Fn',
  'FnLock',
]);

function isTypingKey(event: KeyboardEvent): boolean {
  if (MODIFIER_KEYS.has(event.key)) return false;
  // Single-character keys are printable (e.g. "a", "1", "中" via IME commit).
  if (event.key.length === 1) return true;
  return TYPING_KEY_WHITELIST.has(event.key);
}

// Mouse and touch (finger) pointer events are intentionally ignored. They
// represent navigation gestures (tap to select question, scroll material,
// click prev/next), not text input intent. Treating them as "typed" would
// flip the editor split incorrectly when the user just taps the material
// pane. Mode is event-driven only by (a) primary pen pointerdown or
// (b) typing-key keydown. UI toggle exists via switchMode escape hatch.
function isPenEvent(event: PointerEvent): boolean {
  return event.pointerType === 'pen' && event.isPrimary === true;
}

export function useInputMode(initialMode: InputMode = 'idle'): UseInputModeResult {
  if (typeof window === 'undefined') {
    // Fail-fast: this hook only makes sense in the browser (PointerEvent +
    // KeyboardEvent + setTimeout). Render-throw, not effect-throw, surfaces
    // misuse immediately in SSR or test environments.
    throw new Error('useInputMode is browser-only; window is undefined (SSR not supported).');
  }

  const [mode, setMode] = useState<InputMode>(initialMode);
  const [lastEventType, setLastEventType] = useState<InputEventType | null>(null);
  const [isDebouncing, setIsDebouncing] = useState<boolean>(false);

  // R2 (2026-05-13): 显式声明为 number 而非 ReturnType<typeof window.setTimeout>
  // —— 后者在 monorepo 引入 @types/node 后会解析为 Node 的 Timeout，与浏览器
  // setTimeout 实际返回的 number 冲突。
  const debounceTimerRef = useRef<number | null>(null);
  const debouncingRef = useRef<boolean>(false);

  const clearDebounce = useCallback((): void => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    debouncingRef.current = false;
    setIsDebouncing(false);
  }, []);

  const armDebounce = useCallback((): void => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debouncingRef.current = true;
    setIsDebouncing(true);
    debounceTimerRef.current = window.setTimeout(() => {
      debouncingRef.current = false;
      setIsDebouncing(false);
      debounceTimerRef.current = null;
    }, DEBOUNCE_MS);
  }, []);

  const applyMode = useCallback(
    (next: InputMode, source: InputEventType): void => {
      if (debouncingRef.current) return;
      setLastEventType(source);
      setMode((prev) => {
        if (prev === next) return prev;
        armDebounce();
        return next;
      });
    },
    [armDebounce],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!isTypingKey(event)) return;
      applyMode('typed', 'keyboard');
    }

    function onPointer(event: PointerEvent): void {
      if (!isPenEvent(event)) return;
      applyMode('handwritten', 'pen');
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointer);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointer);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [applyMode]);

  const switchMode = useCallback(
    (next: InputMode): void => {
      clearDebounce();
      setMode(next);
    },
    [clearDebounce],
  );

  return { mode, lastEventType, switchMode, isDebouncing };
}
