import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlanStore module initialization', () => {
  it('derives the default currentDate from the local calendar day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 22, 23, 55, 0));
    vi.resetModules();

    const { usePlanStore } = await import('@sikao/domain/plan/usePlanStore');

    expect(usePlanStore.getState().currentDate).toBe('2026-05-22');
    expect(usePlanStore.getState().currentView).toBe('week');
  });
});
