import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewModePreference } from './viewMode';

describe('useViewModePreference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to deck when no localStorage', () => {
    const { result } = renderHook(() => useViewModePreference());
    expect(result.current.value).toBe('deck');
  });

  it('reads existing deck value', () => {
    window.localStorage.setItem('sikao.practice.viewMode', 'deck');
    const { result } = renderHook(() => useViewModePreference());
    expect(result.current.value).toBe('deck');
  });

  it('falls back to deck when stored value is invalid', () => {
    window.localStorage.setItem('sikao.practice.viewMode', 'garbage');
    const { result } = renderHook(() => useViewModePreference());
    expect(result.current.value).toBe('deck');
  });

  it('regularizes scroll → deck when scrollDisabled (review-fix #5)', () => {
    window.localStorage.setItem('sikao.practice.viewMode', 'scroll');
    const { result } = renderHook(() => useViewModePreference(true));
    expect(result.current.value).toBe('deck');
  });

  it('keeps scroll value when scrollDisabled=false', () => {
    window.localStorage.setItem('sikao.practice.viewMode', 'scroll');
    const { result } = renderHook(() => useViewModePreference(false));
    expect(result.current.value).toBe('scroll');
  });

  it('setValue persists to localStorage', () => {
    const { result } = renderHook(() => useViewModePreference(false));
    act(() => {
      result.current.setValue('scroll');
    });
    expect(result.current.value).toBe('scroll');
    expect(window.localStorage.getItem('sikao.practice.viewMode')).toBe('scroll');
  });
});
