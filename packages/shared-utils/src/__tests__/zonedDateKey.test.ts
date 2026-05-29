import { describe, it, expect } from 'vitest';

import { zonedDateKey } from '@sikao/shared-utils';

describe('zonedDateKey', () => {
  it('maps a UTC instant to its Asia/Shanghai calendar day', () => {
    // 16:00Z = next day 00:00 in +08:00
    expect(zonedDateKey('2026-04-30T16:00:00.000Z', 'Asia/Shanghai')).toBe('2026-05-01');
    expect(zonedDateKey('2026-05-31T15:59:59.999Z', 'Asia/Shanghai')).toBe('2026-05-31');
  });

  it('keeps the same calendar day when the instant is already local-midday', () => {
    expect(zonedDateKey('2026-05-18T04:00:00.000Z', 'Asia/Shanghai')).toBe('2026-05-18');
  });

  it('respects the requested time zone (different zone, same instant)', () => {
    // 2026-05-01T00:30+08:00 == 2026-04-30T16:30Z; in UTC it is still Apr 30.
    expect(zonedDateKey('2026-04-30T16:30:00.000Z', 'UTC')).toBe('2026-04-30');
    expect(zonedDateKey('2026-04-30T16:30:00.000Z', 'Asia/Shanghai')).toBe('2026-05-01');
  });

  it('throws on an unparseable instant (no silent fallback, H7)', () => {
    expect(() => zonedDateKey('not-a-date', 'Asia/Shanghai')).toThrow(/unparseable/);
  });
});
