import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFbSettings, FB_SETTINGS_DEFAULTS } from '../useFbSettings';
import { logger } from '@sikao/shared-utils';

describe('useFbSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-opt-style');
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-opt-style');
    vi.restoreAllMocks();
  });

  it('default density is cozy when localStorage is empty', () => {
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings).toEqual(FB_SETTINGS_DEFAULTS);
    expect(FB_SETTINGS_DEFAULTS.density).toBe('cozy');
  });

  it('default optStyle is circle when localStorage is empty', () => {
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings.optStyle).toBe('circle');
    expect(FB_SETTINGS_DEFAULTS.optStyle).toBe('circle');
  });

  it('mount applies density + optStyle to <html> dataset', () => {
    renderHook(() => useFbSettings());
    expect(document.documentElement.dataset.density).toBe('cozy');
    expect(document.documentElement.dataset.optStyle).toBe('circle');
  });

  it('setDensity("compact") updates state + DOM + localStorage', () => {
    const { result } = renderHook(() => useFbSettings());
    act(() => result.current.setDensity('compact'));
    expect(result.current.settings.density).toBe('compact');
    expect(document.documentElement.dataset.density).toBe('compact');
    expect(window.localStorage.getItem('fb-settings-v1')).toContain('"density":"compact"');
  });

  it('setOptStyle("square") updates state + DOM + localStorage', () => {
    const { result } = renderHook(() => useFbSettings());
    act(() => result.current.setOptStyle('square'));
    expect(result.current.settings.optStyle).toBe('square');
    expect(document.documentElement.dataset.optStyle).toBe('square');
    expect(window.localStorage.getItem('fb-settings-v1')).toContain('"optStyle":"square"');
  });

  it('inherits valid density from localStorage on mount', () => {
    window.localStorage.setItem('fb-settings-v1', JSON.stringify({ density: 'compact' }));
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings.density).toBe('compact');
    expect(document.documentElement.dataset.density).toBe('compact');
  });

  it('inherits valid optStyle from localStorage on mount', () => {
    window.localStorage.setItem(
      'fb-settings-v1',
      JSON.stringify({ density: 'cozy', optStyle: 'square' }),
    );
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings.optStyle).toBe('square');
    expect(document.documentElement.dataset.optStyle).toBe('square');
  });

  it('old storage without optStyle key falls back to circle (migration safe)', () => {
    // 旧 storage shape: only density. 没 optStyle. 应该默认 circle 不破老用户预期.
    window.localStorage.setItem('fb-settings-v1', JSON.stringify({ density: 'compact' }));
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings.density).toBe('compact');
    expect(result.current.settings.optStyle).toBe('circle');
    expect(document.documentElement.dataset.optStyle).toBe('circle');
  });

  it('parse failure (corrupt JSON) falls back to defaults + logger.warn', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    window.localStorage.setItem('fb-settings-v1', '{not-json');
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings.density).toBe('cozy');
    expect(result.current.settings.optStyle).toBe('circle');
    expect(warnSpy).toHaveBeenCalledWith(
      'fb-settings.parse-fallback',
      expect.objectContaining({ raw: '{not-json' }),
    );
  });

  it('invalid density enum value falls back to cozy', () => {
    window.localStorage.setItem('fb-settings-v1', JSON.stringify({ density: 'martian' }));
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings.density).toBe('cozy');
  });

  it('invalid optStyle enum value falls back to circle', () => {
    window.localStorage.setItem(
      'fb-settings-v1',
      JSON.stringify({ density: 'cozy', optStyle: 'pentagon' }),
    );
    const { result } = renderHook(() => useFbSettings());
    expect(result.current.settings.optStyle).toBe('circle');
  });
});
