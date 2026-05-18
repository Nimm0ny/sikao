import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useQuestionRegistry } from '../useQuestionRegistry';

describe('useQuestionRegistry', () => {
  it('registers question scroll handlers and jumps to them', () => {
    const { result } = renderHook(() => useQuestionRegistry());
    const scrollTo = vi.fn();

    act(() => {
      result.current.registerQuestion({ questionId: '101', scrollTo });
    });

    act(() => {
      result.current.scrollToQuestion('101');
    });

    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('throws when selecting an unregistered question', () => {
    const { result } = renderHook(() => useQuestionRegistry());

    expect(() => result.current.scrollToQuestion('missing')).toThrow(
      'Question missing is not registered.',
    );
  });
});
