import { describe, it, expect } from 'vitest';
import { cn } from '@sikao/shared-utils';

// Sanity test for the test infrastructure itself + a real assertion that
// guards `cn()`'s falsy-dropping contract. If this file ever fails, either
// vitest is misconfigured or someone broke `cn()`'s conditional-class API.

describe('cn', () => {
  it('joins truthy values with spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops null / undefined / false', () => {
    expect(cn('a', null, 'b', undefined, 'c', false)).toBe('a b c');
  });

  it('keeps numeric 0 (falsy but conventional sentinel for ZeroValue token)', () => {
    expect(cn('a', 0, 'b')).toBe('a 0 b');
  });

  it('flattens nested arrays recursively', () => {
    expect(cn('a', ['b', ['c', 'd']], 'e')).toBe('a b c d e');
  });

  it('returns empty string for all-falsy input', () => {
    expect(cn(null, undefined, false)).toBe('');
  });
});
