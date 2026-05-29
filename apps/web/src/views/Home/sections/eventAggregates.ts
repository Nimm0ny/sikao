// lint-allow-ui-copy: SIK-141 aggregation labels are issue-scoped,
// define-first, and reused across chip / peek renderers.
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { homeQueryKeys } from '@sikao/api-client/homeQueryKeys';
import { fetchEventAggregates } from '@sikao/api-client/plansQueries';
import type { PlanEventAggregateBatchResponseV2, PlanEventAggregateReadV2 } from '@sikao/api-client/types/home';

const BATCH_LIMIT = 100;
const AGGREGATE_QUERY_ERROR_LABEL = '聚合不可用';
const AGGREGATE_QUERY_MISSING_LABEL = '聚合缺失';

const EMPTY_LABEL: Readonly<Record<PlanEventAggregateReadV2['availability'], string>> = {
  ready: '',
  event_unavailable: '事件不可用',
  missing_linked_session: '未关联',
  session_not_found: '关联失效',
  not_submitted: '未提交',
  unsupported_track: '暂不支持',
  no_graded_items: '无判题数据',
};

export interface CalendarAggregateQueryState {
  readonly byEventId: ReadonlyMap<string, PlanEventAggregateReadV2>;
  readonly isLoaded: boolean;
  readonly isError: boolean;
}

function roundedPct(value: number): number {
  return Math.round(value * 1000) / 10;
}

function normalizeEventIds(eventIds: readonly string[]): string[] {
  return Array.from(new Set(eventIds)).sort((left, right) => left.localeCompare(right));
}

function chunkEventIds(eventIds: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < eventIds.length; index += BATCH_LIMIT) {
    batches.push(eventIds.slice(index, index + BATCH_LIMIT));
  }
  return batches;
}

export function useCalendarEventAggregates(eventIds: readonly string[]): CalendarAggregateQueryState {
  const normalizedEventIds = useMemo(() => normalizeEventIds(eventIds), [eventIds]);
  const batches = useMemo(() => chunkEventIds(normalizedEventIds), [normalizedEventIds]);

  return useQueries({
    queries: batches.map((batch) => ({
      queryKey: homeQueryKeys.plans.eventAggregates(batch),
      queryFn: () => fetchEventAggregates({ eventIds: batch }),
      enabled: batch.length > 0,
    })),
    combine: (results) => {
      const byEventId = new Map<string, PlanEventAggregateReadV2>();
      const isError = results.some((result) => result.isError);
      const isLoaded = normalizedEventIds.length === 0
        ? true
        : results.length > 0 && results.every((result) => result.isSuccess);

      for (const result of results) {
        const data = result.data as PlanEventAggregateBatchResponseV2 | undefined;
        for (const item of data?.items ?? []) {
          byEventId.set(item.eventId, item);
        }
      }

      return { byEventId, isLoaded, isError };
    },
  });
}

export function chipAggregateLabel(
  aggregate: PlanEventAggregateReadV2 | undefined,
  state: Pick<CalendarAggregateQueryState, 'isLoaded' | 'isError'>,
): string | null {
  if (state.isError) return AGGREGATE_QUERY_ERROR_LABEL;
  if (!state.isLoaded) return null;
  if (aggregate === undefined) return AGGREGATE_QUERY_MISSING_LABEL;
  if (aggregate.availability !== 'ready' || aggregate.metrics === null) {
    return EMPTY_LABEL[aggregate.availability];
  }
  return `练 ${aggregate.metrics.attemptedCount} · 准 ${roundedPct(aggregate.metrics.accuracy)}%`;
}

export function peekAggregateEmptyLabel(
  aggregate: PlanEventAggregateReadV2 | undefined,
  state: Pick<CalendarAggregateQueryState, 'isLoaded' | 'isError'>,
): string | null {
  if (state.isError) return AGGREGATE_QUERY_ERROR_LABEL;
  if (!state.isLoaded) return null;
  if (aggregate === undefined) return AGGREGATE_QUERY_MISSING_LABEL;
  if (aggregate.availability === 'ready') return null;
  return EMPTY_LABEL[aggregate.availability];
}

export function formatActiveSeconds(activeSeconds: number | null): string | null {
  if (activeSeconds === null || activeSeconds <= 0) return null;
  const minutes = Math.round(activeSeconds / 60);
  return `${minutes}分`;
}
