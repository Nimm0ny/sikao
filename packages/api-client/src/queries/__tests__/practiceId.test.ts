import { describe, expect, it } from 'vitest';

import { toPracticeMutationId } from '../practiceId';

describe('toPracticeMutationId', () => {
  it('accepts numeric strings and numbers', () => {
    expect(toPracticeMutationId('12', 'questionId')).toBe(12);
    expect(toPracticeMutationId(7, 'answerId')).toBe(7);
  });

  it('fails fast for non-positive or non-numeric values', () => {
    expect(() => toPracticeMutationId('a1', 'answerId')).toThrow('answerId must be a positive integer');
    expect(() => toPracticeMutationId(0, 'questionId')).toThrow('questionId must be a positive integer');
  });
});
