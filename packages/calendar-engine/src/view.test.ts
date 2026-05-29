import { describe, expect, it } from 'vitest';

import { buildViewRange } from './view';

describe('buildViewRange', () => {
  const anchor = { anchorDate: '2026-05-30', timeZone: 'Asia/Shanghai' } as const;
  const sundayFirstAnchor = {
    anchorDate: '2026-05-30',
    timeZone: 'Asia/Shanghai',
    startWeekOnMonday: false,
  } as const;

  it('returns the anchor local day for today view', () => {
    expect(buildViewRange('today', anchor)).toEqual({
      from: '2026-05-29T16:00:00.000Z',
      to: '2026-05-30T16:00:00.000Z',
    });
  });

  it('returns the Monday-start calendar week for week view', () => {
    expect(buildViewRange('week', anchor)).toEqual({
      from: '2026-05-24T16:00:00.000Z',
      to: '2026-05-31T16:00:00.000Z',
    });
  });

  it('returns the Sunday-start calendar week when configured', () => {
    expect(buildViewRange('week', sundayFirstAnchor)).toEqual({
      from: '2026-05-23T16:00:00.000Z',
      to: '2026-05-30T16:00:00.000Z',
    });
  });

  it('returns a three-week rolling window for month view', () => {
    expect(buildViewRange('month', anchor)).toEqual({
      from: '2026-05-24T16:00:00.000Z',
      to: '2026-06-14T16:00:00.000Z',
    });
  });

  it('returns a Sunday-start three-week rolling window when configured', () => {
    expect(buildViewRange('month', sundayFirstAnchor)).toEqual({
      from: '2026-05-23T16:00:00.000Z',
      to: '2026-06-13T16:00:00.000Z',
    });
  });
});
