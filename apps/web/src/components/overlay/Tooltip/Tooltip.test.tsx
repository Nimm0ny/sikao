import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from './Tooltip';

afterEach(() => {
  vi.useRealTimers();
  // Reset matchMedia to default (pointer:fine — see setupTests.ts) between cases.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('Tooltip', () => {
  it('shows after delayIn (600ms) on mouseenter and hides after delayOut (200ms) on mouseleave', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="提示文案">
        <button type="button">触发</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: '触发' });
    fireEvent.mouseEnter(trigger);
    // before delayIn elapses, tooltip is not yet rendered
    act(() => { vi.advanceTimersByTime(599); });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole('tooltip')).toHaveTextContent('提示文案');
    fireEvent.mouseLeave(trigger);
    act(() => { vi.advanceTimersByTime(199); });
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens immediately on focus and closes on blur (no delay for kbd a11y)', () => {
    render(
      <Tooltip content="键盘提示">
        <button type="button">键盘触发</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: '键盘触发' });
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('键盘提示');
    // aria-describedby auto-binds to children
    expect(trigger.getAttribute('aria-describedby')).not.toBeNull();
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders no listeners and no panel on coarse-pointer (touch) devices', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('pointer: coarse'),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    render(
      <Tooltip content="触屏不渲染">
        <button type="button">触屏触发</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: '触屏触发' });
    fireEvent.mouseEnter(trigger);
    fireEvent.focus(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
  });

  it('renders shortcut keys as <kbd> elements', () => {
    render(
      <Tooltip content="搜索" shortcut={['Ctrl', 'K']}>
        <button type="button">搜索按钮</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button', { name: '搜索按钮' }));
    const shortcutGroup = screen.getByTestId('tooltip-shortcut');
    const kbds = shortcutGroup.querySelectorAll('kbd');
    expect(kbds).toHaveLength(2);
    expect(kbds[0].textContent).toBe('Ctrl');
    expect(kbds[1].textContent).toBe('K');
  });
});
