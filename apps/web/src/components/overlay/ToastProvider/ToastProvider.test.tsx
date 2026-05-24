import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';

/*
 * ToastProvider tests — V5 D.3.7 (skeleton).
 * Why: cover imperative API (toast / dismiss), default + err duration auto-
 *      dismiss, action click, manual dismiss(id). Uses fake timers for
 *      deterministic auto-dismiss assertions.
 */

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('toast() shows a toast and returns its id', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.toast({ title: '已保存', variant: 'ok' });
    });
    expect(id).toMatch(/^t-/);
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });

  it('default duration auto-dismisses after 3000ms (info / ok / warn)', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.toast({ title: '提示', variant: 'info' });
    });
    expect(screen.getByText('提示')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.queryByText('提示')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('提示')).toBeNull();
  });

  it('err variant defaults to 5000ms duration', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.toast({ title: '错误', variant: 'err' });
    });
    expect(screen.getByText('错误')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('错误')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('错误')).toBeNull();
  });

  it('dismiss(id) immediately removes the toast and cancels its timer', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    let id = '';
    act(() => {
      id = result.current.toast({ title: '可关闭', duration: 10000 });
    });
    expect(screen.getByText('可关闭')).toBeInTheDocument();
    act(() => {
      result.current.dismiss(id);
    });
    expect(screen.queryByText('可关闭')).toBeNull();
  });

  it('action button click triggers the action onClick handler', () => {
    const onClick = vi.fn();
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.toast({ title: '撤销', action: { label: '撤销', onClick } });
    });
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('useToast outside ToastProvider throws', () => {
    // Suppress React error boundary console noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<UnwrappedConsumer />)).toThrow(
      'useToast must be used inside <ToastProvider>',
    );
    spy.mockRestore();
  });
});

function UnwrappedConsumer() {
  useToast();
  return null;
}
