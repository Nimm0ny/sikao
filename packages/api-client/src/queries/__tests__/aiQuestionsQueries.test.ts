import axios from 'axios';
import { describe, expect, it } from 'vitest';

import { classifyAiQuestionGenerateError } from '../aiQuestionsQueries';

describe('classifyAiQuestionGenerateError', () => {
  it('maps rate-limit, service-unavailable, network, and unknown cases', () => {
    expect(
      classifyAiQuestionGenerateError(
        axios.AxiosError.from(new Error('rate'), undefined, undefined, undefined, {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {},
          config: { headers: {} as never },
          data: {},
        }),
      ),
    ).toBe('rate_limited');

    expect(
      classifyAiQuestionGenerateError(
        axios.AxiosError.from(new Error('unavailable'), undefined, undefined, undefined, {
          status: 503,
          statusText: 'Service Unavailable',
          headers: {},
          config: { headers: {} as never },
          data: {},
        }),
      ),
    ).toBe('service_unavailable');

    expect(
      classifyAiQuestionGenerateError(
        axios.AxiosError.from(new Error('offline')),
      ),
    ).toBe('network');

    expect(classifyAiQuestionGenerateError(new Error('boom'))).toBe('unknown');
  });
});
