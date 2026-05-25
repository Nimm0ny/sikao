// lint-allow-ui-copy: V5 D.4.1 Section C accept-option dialog copy.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAcceptRecommendation } from '@sikao/api-client/recommendationsQueries';
import { usePlanStore } from '@sikao/domain';
import type {
  RecommendationAcceptResponseV2,
  RecommendationReadV2,
} from '@sikao/api-client/types/home';
import { Modal } from '../../../components/overlay/Modal';

/*
 * AcceptOptionMenu — SIK-92 wave 2.
 *
 * Why: when the user clicks the accept CTA, this Modal lets them choose
 *      between "立刻开始" (action='session') and "排入计划"
 *      (action='plan' with a target date). Per Multica SIK-92 Acceptance:
 *        - accept(session) → useAcceptRecommendation with action='session'
 *          → navigate sessionId / redirectUrl / BootCard fallback.
 *        - accept(plan) → useAcceptRecommendation with action='plan'
 *          and target_date (YYYY-MM-DD); on success write the upcoming
 *          event into usePlanStore.upsertOptimisticEvent so the calendar
 *          sees it before the next refetch lands.
 *
 *      AGENT-H7: target_date validates as a non-empty YYYY-MM-DD before
 *      submit; empty / invalid dates disable the plan CTA. Mutation
 *      errors propagate via the mutation result; not silenced.
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
}

export function AcceptOptionMenu({ recommendation, open, onClose }: AcceptOptionMenuProps) {
  const navigate = useNavigate();
  const acceptMutation = useAcceptRecommendation(recommendation.id);
  const upsertOptimistic = usePlanStore((s) => s.upsertOptimisticEvent);
  const [targetDate, setTargetDate] = useState<string>(todayStamp());

  const handleAcceptSession = () => {
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
          navigate('/boot?reason=coming-soon-practice');
          onClose();
        },
      },
    );
  };

  const isPlanDateValid = ISO_DATE_RE.test(targetDate);

  const handleAcceptPlan = () => {
    if (!isPlanDateValid) return;
    acceptMutation.mutate(
      { action: 'plan', targetDate },
      {
        onSuccess: (response: RecommendationAcceptResponseV2) => {
          if (response.eventId !== null && response.eventId !== undefined) {
            upsertOptimistic(String(response.eventId), {
              id: String(response.eventId),
              title: recommendation.title,
              startAt: `${targetDate}T08:00:00+08:00`,
              endAt: `${targetDate}T09:00:00+08:00`,
              category: 'practice',
              status: 'planned',
            });
          }
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
      primaryAction={{ label: '立即开始', onClick: handleAcceptSession }}
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
            onChange={(e) => setTargetDate(e.target.value)}
            data-testid="accept-option-target-date"
            min={todayStamp()}
          />
        </label>
        <button
          type="button"
          aria-label={`将本推荐排入 ${targetDate}`}
          onClick={handleAcceptPlan}
          disabled={!isPlanDateValid || acceptMutation.isPending}
          data-testid="accept-option-plan-submit"
        >
          排入 {targetDate}
        </button>
      </div>
    </Modal>
  );
}
