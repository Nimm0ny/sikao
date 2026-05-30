// lint-allow-ui-copy: V5 D.4.1 Section C accept-option dialog copy.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { homeQueryKeys } from '@sikao/api-client/homeQueryKeys';
import { useNavigate } from 'react-router-dom';
import { useAcceptRecommendation } from '@sikao/api-client/recommendationsQueries';
import { usePlanStore } from '@sikao/domain';
import type {
  EventWindowFilters,
  EventWindowResponseV2,
  RecommendationAcceptResponseV2,
  RecommendationReadV2,
} from '@sikao/api-client/types/home';
import { Modal } from '../../../components/overlay/Modal';
import { buildRecommendationPlanOptimisticEvent } from './recommendationActionType';

/*
 * AcceptOptionMenu — SIK-92 closeout.
 *
 * Why: accept(plan) must mirror the real backend event-create behavior.
 *      The backend returns eventId only; FE builds the optimistic event
 *      locally from targetDate + recommendation payload with the same
 *      defaults (18:00 Asia/Shanghai, category from payload or custom/break,
 *      source=ai_generated, notes=recommendation.reason).
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface AcceptOptionMenuProps {
  readonly recommendation: RecommendationReadV2;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onReject?: () => void;
}

export function AcceptOptionMenu({ recommendation, open, onClose, onReject }: AcceptOptionMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const acceptMutation = useAcceptRecommendation(recommendation.id);
  const upsertOptimisticEvent = usePlanStore((state) => state.upsertOptimisticEvent);
  const removeOptimisticEvent = usePlanStore((state) => state.removeOptimisticEvent);
  const [targetDate, setTargetDate] = useState<string>(todayStamp());
  const canAcceptAsSession = recommendation.actionType !== 'rest';
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const injectOptimisticPlanEvent = (target: ReturnType<typeof buildRecommendationPlanOptimisticEvent>) => {
    const cached = queryClient.getQueriesData<EventWindowResponseV2>({ queryKey: homeQueryKeys.plans.all() });
    const targetStartMs = new Date(target.startAt).getTime();

    for (const [queryKey, current] of cached) {
      if (!Array.isArray(queryKey) || queryKey[2] !== 'events') continue;
      if (current === undefined) continue;
      const filters = queryKey[3] as EventWindowFilters;
      const fromMs = new Date(filters.from).getTime();
      const toMs = new Date(filters.to).getTime();
      if (Number.isNaN(fromMs) || Number.isNaN(toMs) || targetStartMs < fromMs || targetStartMs >= toMs) {
        continue;
      }
      queryClient.setQueryData<EventWindowResponseV2>(queryKey, (previous) => {
        if (previous === undefined) return previous;
        if (previous.data.events.some((event) => event.id === target.id)) {
          return previous;
        }
        const events = [...previous.data.events, target].sort(
          (left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
        );
        return {
          ...previous,
          data: {
            ...previous.data,
            events,
          },
        };
      });
    }
  };

  const handleAcceptSession = () => {
    if (acceptMutation.isPending) return;
    setAcceptError(null);
    acceptMutation.mutate(
      { action: 'session' },
      {
        onSuccess: (response: RecommendationAcceptResponseV2) => {
          if (response.redirectUrl) {
            navigate(response.redirectUrl);
            onClose();
            return;
          }
          if (response.sessionId !== null && response.sessionId !== undefined) {
            navigate(`/practice/sessions/${response.sessionId}`);
            onClose();
            return;
          }
          throw new Error('accept(session) response missing redirectUrl and sessionId');
        },
      },
    );
  };

  const isPlanDateValid = ISO_DATE_RE.test(targetDate);

  const handleAcceptPlan = () => {
    if (acceptMutation.isPending) return;
    if (!isPlanDateValid) {
      setAcceptError('请选择有效日期后再加入计划。');
      return;
    }
    setAcceptError(null);
    acceptMutation.mutate(
      { action: 'plan', targetDate },
      {
        onSuccess: (response: RecommendationAcceptResponseV2) => {
          if (response.eventId === null || response.eventId === undefined) {
            throw new Error('accept(plan) response missing eventId');
          }
          const optimisticEvent = buildRecommendationPlanOptimisticEvent({
            actionType: recommendation.actionType,
            eventId: response.eventId,
            title: recommendation.title,
            reason: recommendation.reason,
            estimatedMinutes: recommendation.estimatedMinutes,
            targetDate,
            payload: recommendation.payload as Record<string, unknown> | undefined,
          });
          upsertOptimisticEvent(String(response.eventId), optimisticEvent);
          injectOptimisticPlanEvent(optimisticEvent);
          void queryClient.invalidateQueries({ queryKey: homeQueryKeys.plans.all() }).then(() => {
            const aligned = queryClient.getQueriesData<EventWindowResponseV2>({ queryKey: homeQueryKeys.plans.all() })
              .some(([queryKey, data]) =>
                Array.isArray(queryKey)
                && queryKey[2] === 'events'
                && data !== undefined
                && data.data.events.some((event) => event.id === optimisticEvent.id),
              );
            if (aligned) {
              removeOptimisticEvent(optimisticEvent.id);
            }
          });
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="如何处理这条推荐？"
      description={recommendation.title}
      primaryAction={{
        label: canAcceptAsSession ? '立即开始' : '加入计划',
        onClick: canAcceptAsSession ? handleAcceptSession : handleAcceptPlan,
      }}
      secondaryAction={{ label: '取消', onClick: onClose }}
    >
      <div data-testid="accept-option-menu" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <label htmlFor="accept-option-target-date" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 'var(--font-meta)' }}>
          <span>或者排入未来某天的学习计划</span>
          <input
            id="accept-option-target-date"
            type="date"
            aria-label="排入计划的目标日期"
            value={targetDate}
            onChange={(e) => {
              setTargetDate(e.target.value);
              setAcceptError(null);
            }}
            data-testid="accept-option-target-date"
            min={todayStamp()}
          />
        </label>
        {canAcceptAsSession ? (
          <button
            type="button"
            aria-label={`将本推荐排入 ${targetDate}`}
            onClick={handleAcceptPlan}
            disabled={!isPlanDateValid || acceptMutation.isPending}
            data-testid="accept-option-plan-submit"
          >
            排入 {targetDate}
          </button>
        ) : null}
        {onReject !== undefined ? (
          <button
            type="button"
            onClick={onReject}
            data-testid="accept-option-reject"
            style={{ marginTop: 'var(--space-2)', color: 'var(--color-state-err)' }}
          >
            不感兴趣
          </button>
        ) : null}
        {acceptError !== null ? (
          <p role="alert" style={{ margin: 0, color: 'var(--color-state-err)', fontSize: 'var(--font-meta)' }}>
            {acceptError}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
