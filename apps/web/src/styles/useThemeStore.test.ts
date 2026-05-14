import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApplyExamTheme, useThemeStore } from './useThemeStore';

describe('useApplyExamTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ examTheme: 'light' });
  });
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('mount applies examTheme to <html data-theme>', () => {
    useThemeStore.setState({ examTheme: 'dark' });
    renderHook(() => useApplyExamTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('mount with light examTheme writes data-theme=light', () => {
    renderHook(() => useApplyExamTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggling examTheme while mounted updates DOM', () => {
    renderHook(() => useApplyExamTheme());
    act(() => useThemeStore.getState().toggleExamTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('unmount removes data-theme attribute (review-fix #7)', () => {
    useThemeStore.setState({ examTheme: 'dark' });
    const { unmount } = renderHook(() => useApplyExamTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    unmount();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ examTheme: 'light' });
  });

  it('toggleExamTheme flips light <-> dark', () => {
    expect(useThemeStore.getState().examTheme).toBe('light');
    useThemeStore.getState().toggleExamTheme();
    expect(useThemeStore.getState().examTheme).toBe('dark');
    useThemeStore.getState().toggleExamTheme();
    expect(useThemeStore.getState().examTheme).toBe('light');
  });

  it('setExamTheme writes the requested value', () => {
    useThemeStore.getState().setExamTheme('dark');
    expect(useThemeStore.getState().examTheme).toBe('dark');
  });
});
