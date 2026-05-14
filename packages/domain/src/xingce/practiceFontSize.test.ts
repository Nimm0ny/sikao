import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePracticeFontSize } from './practiceFontSize';

describe('usePracticeFontSize', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-practice-font');
  });
  afterEach(() => {
    document.documentElement.removeAttribute('data-practice-font');
  });

  it('defaults to md when localStorage empty', () => {
    const { result } = renderHook(() => usePracticeFontSize());
    expect(result.current.value).toBe('md');
    expect(document.documentElement.getAttribute('data-practice-font')).toBe('md');
  });

  it('reads existing localStorage value on mount', () => {
    window.localStorage.setItem('sikao.practice.fontSize', 'lg');
    const { result } = renderHook(() => usePracticeFontSize());
    expect(result.current.value).toBe('lg');
    expect(document.documentElement.getAttribute('data-practice-font')).toBe('lg');
  });

  it('falls back to md on invalid stored value', () => {
    window.localStorage.setItem('sikao.practice.fontSize', 'huge');
    const { result } = renderHook(() => usePracticeFontSize());
    expect(result.current.value).toBe('md');
  });

  it('setValue persists to localStorage and applies to DOM', () => {
    const { result } = renderHook(() => usePracticeFontSize());
    act(() => result.current.setValue('sm'));
    expect(result.current.value).toBe('sm');
    expect(window.localStorage.getItem('sikao.practice.fontSize')).toBe('sm');
    expect(document.documentElement.getAttribute('data-practice-font')).toBe('sm');
  });

  it('unmount keeps data-practice-font attribute (cross-page persistence)', () => {
    const { result, unmount } = renderHook(() => usePracticeFontSize());
    act(() => result.current.setValue('lg'));
    unmount();
    // review-fix #3: 字号偏好跨页保留, 不在 unmount 时 reset
    expect(document.documentElement.getAttribute('data-practice-font')).toBe('lg');
  });

  it('cross-tab storage event syncs value', () => {
    const { result } = renderHook(() => usePracticeFontSize());
    act(() => {
      window.localStorage.setItem('sikao.practice.fontSize', 'lg');
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'sikao.practice.fontSize', newValue: 'lg' }),
      );
    });
    expect(result.current.value).toBe('lg');
  });

  it('storage event for unrelated key is ignored', () => {
    const { result } = renderHook(() => usePracticeFontSize());
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'something.else', newValue: 'lg' }),
      );
    });
    expect(result.current.value).toBe('md');
  });
});
