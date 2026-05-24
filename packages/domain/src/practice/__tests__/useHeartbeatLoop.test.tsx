import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeartbeatLoop } from '../useHeartbeatLoop';

describe('useHeartbeatLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures rejected heartbeat promises through onError instead of leaking an unhandled rejection', async () => {
    const onError = vi.fn();
    const rejection = new Error('heartbeat failed');

    renderHook(() =>
      useHeartbeatLoop({
        enabled: true,
        intervalMs: 1_000,
        onHeartbeat: () => Promise.reject(rejection),
        onError,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(rejection);
  });

  it('captures synchronously thrown heartbeat errors through onError', async () => {
    const onError = vi.fn();
    const failure = new Error('sync heartbeat failed');

    renderHook(() =>
      useHeartbeatLoop({
        enabled: true,
        intervalMs: 1_000,
        onHeartbeat: () => {
          throw failure;
        },
        onError,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
