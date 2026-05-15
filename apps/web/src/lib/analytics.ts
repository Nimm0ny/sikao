import { api } from '@sikao/api-client/request';
import { logger } from '@sikao/shared-utils';

export interface AnalyticsEventInput {
  readonly eventName: string;
  readonly properties?: Record<string, string>;
  readonly sessionId?: string;
}

export function trackEvent(input: AnalyticsEventInput): void {
  void api
    .post<{ received: boolean }, AnalyticsEventInput>('/analytics/event', input)
    .catch((err: unknown) => {
      logger.warn('analytics.track.failed', {
        eventName: input.eventName,
        err: String(err),
      });
    });
}
