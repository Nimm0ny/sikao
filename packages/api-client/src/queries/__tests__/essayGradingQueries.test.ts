import { describe, expect, it } from 'vitest';

import { getEssayGradingPollInterval } from '../essayGradingQueries';

describe('getEssayGradingPollInterval', () => {
  it('uses 1s on the first attempts, 5s in the middle, then 10s', () => {
    expect(getEssayGradingPollInterval(0)).toBe(1000);
    expect(getEssayGradingPollInterval(1)).toBe(1000);
    expect(getEssayGradingPollInterval(2)).toBe(5000);
    expect(getEssayGradingPollInterval(4)).toBe(5000);
    expect(getEssayGradingPollInterval(5)).toBe(10000);
  });
});
