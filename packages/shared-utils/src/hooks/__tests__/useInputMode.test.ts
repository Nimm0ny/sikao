import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInputMode } from '../useInputMode';

// useInputMode tests — fake timers (no real 300ms waits, deterministic).
// jsdom does not synthesise PointerEvent with `pointerType` by default, so we
// dispatch raw constructed events with the relevant fields populated.

interface PenInit {
  readonly pointerType?: 'pen' | 'mouse' | 'touch';
  readonly isPrimary?: boolean;
}

function dispatchPen(type: 'pointerdown' | 'pointermove', init: PenInit = {}): void {
  const evt = new Event(type, { bubbles: true }) as Event & {
    pointerType?: string;
    isPrimary?: boolean;
  };
  evt.pointerType = init.pointerType ?? 'pen';
  evt.isPrimary = init.isPrimary ?? true;
  window.dispatchEvent(evt);
}

function dispatchKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('useInputMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial mode is "idle" by default', () => {
    const { result } = renderHook(() => useInputMode());
    expect(result.current.mode).toBe('idle');
    expect(result.current.lastEventType).toBeNull();
    expect(result.current.isDebouncing).toBe(false);
  });

  it('respects initialMode argument', () => {
    const { result } = renderHook(() => useInputMode('typed'));
    expect(result.current.mode).toBe('typed');
  });

  it('pen pointerdown flips mode to "handwritten"', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchPen('pointerdown');
    });
    expect(result.current.mode).toBe('handwritten');
    expect(result.current.lastEventType).toBe('pen');
  });

  it('printable keydown flips mode to "typed"', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchKey('a');
    });
    expect(result.current.mode).toBe('typed');
    expect(result.current.lastEventType).toBe('keyboard');
  });

  it('whitelisted control keys (Backspace, ArrowDown, Space) flip to "typed"', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchKey('ArrowDown');
    });
    expect(result.current.mode).toBe('typed');
  });

  it('modifier-only keys do not flip mode', () => {
    const { result } = renderHook(() => useInputMode('handwritten'));
    act(() => {
      dispatchKey('Shift');
      dispatchKey('Control');
      dispatchKey('Alt');
      dispatchKey('Meta');
    });
    expect(result.current.mode).toBe('handwritten');
    expect(result.current.lastEventType).toBeNull();
  });

  it('mouse pointer (non-pen) does not flip mode', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchPen('pointerdown', { pointerType: 'mouse' });
    });
    expect(result.current.mode).toBe('idle');
  });

  it('non-primary pen pointer does not flip mode', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchPen('pointerdown', { isPrimary: false });
    });
    expect(result.current.mode).toBe('idle');
  });

  it('debounces alternate signal within 300ms (pen → key blocked)', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchPen('pointerdown');
    });
    expect(result.current.mode).toBe('handwritten');
    expect(result.current.isDebouncing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
      dispatchKey('a');
    });
    // Within 300ms window, keyboard signal ignored.
    expect(result.current.mode).toBe('handwritten');
  });

  it('debounces alternate signal within 300ms (key → pen blocked, symmetric)', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchKey('a');
    });
    expect(result.current.mode).toBe('typed');
    expect(result.current.isDebouncing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
      dispatchPen('pointerdown');
    });
    // Within 300ms window, pen signal ignored.
    expect(result.current.mode).toBe('typed');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.isDebouncing).toBe(false);

    act(() => {
      dispatchPen('pointerdown');
    });
    expect(result.current.mode).toBe('handwritten');
  });

  it('allows flip after 300ms window expires', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchPen('pointerdown');
    });
    expect(result.current.mode).toBe('handwritten');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.isDebouncing).toBe(false);

    act(() => {
      dispatchKey('a');
    });
    expect(result.current.mode).toBe('typed');
    expect(result.current.lastEventType).toBe('keyboard');
  });

  it('switchMode applies immediately and clears debounce', () => {
    const { result } = renderHook(() => useInputMode());
    act(() => {
      dispatchPen('pointerdown');
    });
    expect(result.current.isDebouncing).toBe(true);

    act(() => {
      result.current.switchMode('typed');
    });
    expect(result.current.mode).toBe('typed');
    expect(result.current.isDebouncing).toBe(false);
    // switchMode is a manual override; it does not synthesise an event
    // source. The last actual event was a pen pointerdown, so lastEventType
    // remains 'pen'. Intended design — UI badge tracks real input device.
    expect(result.current.lastEventType).toBe('pen');

    // After switchMode, a pen event in the same tick should flip again
    // (debounce was cleared, not re-armed).
    act(() => {
      dispatchPen('pointerdown');
    });
    expect(result.current.mode).toBe('handwritten');
  });

  it('removes listeners on unmount (no leak)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useInputMode());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('same-mode signals do not extend the debounce window', () => {
    const { result } = renderHook(() => useInputMode());
    // t=0: first key arms debounce.
    act(() => {
      dispatchKey('a');
    });
    expect(result.current.mode).toBe('typed');
    expect(result.current.isDebouncing).toBe(true);

    // t=200ms: second same-mode key. If debounce had been re-armed, it
    // would expire at t=500ms; we assert it does not.
    act(() => {
      vi.advanceTimersByTime(200);
      dispatchKey('b');
    });
    expect(result.current.isDebouncing).toBe(true);

    // t=299ms: still within the ORIGINAL window from the first key.
    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(result.current.isDebouncing).toBe(true);

    // t=300ms: original window expires. If debounce had been re-armed
    // at t=200ms, isDebouncing would still be true here.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.isDebouncing).toBe(false);
  });
});
