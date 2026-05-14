import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrientation } from '../useOrientation';

/**
 * jsdom 不实现 matchMedia, 必须 mock.
 * 我们模拟一个最小 MediaQueryList: matches + addEventListener/removeEventListener.
 * 默认 landscape (matches=false), 切 portrait 时调 trigger().
 */
type Listener = (e: MediaQueryListEvent) => void;

interface MockMql {
  matches: boolean;
  addEventListener: (type: 'change', cb: Listener) => void;
  removeEventListener: (type: 'change', cb: Listener) => void;
}

interface MockMqlController extends MockMql {
  trigger: (newMatches: boolean) => void;
  listenerCount: () => number;
}

function createMockMql(initialMatches: boolean): MockMqlController {
  const listeners = new Set<Listener>();
  const mql: MockMqlController = {
    matches: initialMatches,
    addEventListener: (_type, cb) => {
      listeners.add(cb);
    },
    removeEventListener: (_type, cb) => {
      listeners.delete(cb);
    },
    trigger: (newMatches: boolean) => {
      mql.matches = newMatches;
      const event = { matches: newMatches } as MediaQueryListEvent;
      listeners.forEach((l) => l(event));
    },
    listenerCount: () => listeners.size,
  };
  return mql;
}

describe('useOrientation', () => {
  let mockMql: MockMqlController;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    mockMql = createMockMql(false); // 默认 landscape
    window.matchMedia = vi.fn().mockReturnValue(mockMql) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns "landscape" when matchMedia(portrait).matches=false', () => {
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('landscape');
  });

  it('returns "portrait" when matchMedia(portrait).matches=true', () => {
    mockMql = createMockMql(true);
    window.matchMedia = vi.fn().mockReturnValue(mockMql) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('portrait');
  });

  it('reacts to orientation change event (landscape → portrait)', () => {
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('landscape');
    act(() => {
      mockMql.trigger(true);
    });
    expect(result.current).toBe('portrait');
  });

  it('removes change listener on unmount (no leak)', () => {
    const { unmount } = renderHook(() => useOrientation());
    expect(mockMql.listenerCount()).toBe(1);
    unmount();
    expect(mockMql.listenerCount()).toBe(0);
  });
});
