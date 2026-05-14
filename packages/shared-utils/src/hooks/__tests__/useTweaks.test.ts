import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTweaks, TWEAK_DEFAULTS } from '../useTweaks';

describe('useTweaks', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-reading');
    document.documentElement.removeAttribute('data-nav');
    document.documentElement.removeAttribute('data-option');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('default state matches TWEAK_DEFAULTS when no localStorage', () => {
    const { result } = renderHook(() => useTweaks());
    expect(result.current.state).toEqual(TWEAK_DEFAULTS);
  });

  it('apply on mount writes data-* attrs (theme=reading omits data-theme)', () => {
    renderHook(() => useTweaks());
    // reading 是 :root 默认, 不写 data-theme 让考场态守卫接管
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(document.documentElement.dataset.reading).toBe('md');
    expect(document.documentElement.dataset.nav).toBe('left');
    expect(document.documentElement.dataset.option).toBe('circle');
  });

  it('setTweak("theme", "pure") writes data-theme="pure" + persists', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => result.current.setTweak('theme', 'pure'));
    expect(result.current.state.theme).toBe('pure');
    expect(document.documentElement.dataset.theme).toBe('pure');
    expect(window.localStorage.getItem('sikao.tweaks')).toContain('"theme":"pure"');
  });

  it('switching back to theme=reading clears data-theme attr', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => result.current.setTweak('theme', 'night'));
    expect(document.documentElement.dataset.theme).toBe('night');
    act(() => result.current.setTweak('theme', 'reading'));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('setTweak("density", "cozy") writes attr + state', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => result.current.setTweak('density', 'cozy'));
    expect(document.documentElement.dataset.density).toBe('cozy');
    expect(result.current.state.density).toBe('cozy');
  });

  it('setTweak("reading", "xl") + setTweak("nav", "top") + setTweak("option", "square")', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => {
      result.current.setTweak('reading', 'xl');
      result.current.setTweak('nav', 'top');
      result.current.setTweak('option', 'square');
    });
    expect(document.documentElement.dataset.reading).toBe('xl');
    expect(document.documentElement.dataset.nav).toBe('top');
    expect(document.documentElement.dataset.option).toBe('square');
  });

  it('reset() restores defaults (state + dom + storage)', () => {
    const { result } = renderHook(() => useTweaks());
    act(() => {
      result.current.setTweak('theme', 'night');
      result.current.setTweak('density', 'cozy');
    });
    act(() => result.current.reset());
    expect(result.current.state).toEqual(TWEAK_DEFAULTS);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(window.localStorage.getItem('sikao.tweaks')).toContain('"density":"compact"');
  });

  it('localStorage corrupt JSON falls back to defaults (Fail-Fast 软化)', () => {
    window.localStorage.setItem('sikao.tweaks', '{not-json');
    const { result } = renderHook(() => useTweaks());
    expect(result.current.state).toEqual(TWEAK_DEFAULTS);
  });

  it('localStorage non-object falls back to defaults', () => {
    window.localStorage.setItem('sikao.tweaks', '"a-string"');
    const { result } = renderHook(() => useTweaks());
    expect(result.current.state).toEqual(TWEAK_DEFAULTS);
  });

  it('localStorage with invalid enum values falls back to defaults per-field', () => {
    window.localStorage.setItem(
      'sikao.tweaks',
      JSON.stringify({
        theme: 'martian', // invalid
        density: 'cozy', // valid
        reading: 'xxxl', // invalid
        nav: 'top', // valid
        option: 'circle', // valid
      }),
    );
    const { result } = renderHook(() => useTweaks());
    expect(result.current.state.theme).toBe('reading'); // fallback
    expect(result.current.state.density).toBe('cozy');
    expect(result.current.state.reading).toBe('md'); // fallback
    expect(result.current.state.nav).toBe('top');
    expect(result.current.state.option).toBe('circle');
  });

  it('persists pre-existing valid state from localStorage on mount', () => {
    window.localStorage.setItem(
      'sikao.tweaks',
      JSON.stringify({
        theme: 'pure',
        density: 'cozy',
        reading: 'lg',
        nav: 'top',
        option: 'square',
      }),
    );
    const { result } = renderHook(() => useTweaks());
    expect(result.current.state).toEqual({
      theme: 'pure',
      density: 'cozy',
      reading: 'lg',
      nav: 'top',
      option: 'square',
    });
    // mount effect 也写到 DOM
    expect(document.documentElement.dataset.theme).toBe('pure');
    expect(document.documentElement.dataset.density).toBe('cozy');
  });
});
