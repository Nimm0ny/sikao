// lint-allow-ui-copy: V5 D.4.1 Section C copy.
import { useNavigate } from 'react-router-dom';
import {
  useAcceptRecommendation,
  useRejectRecommendation,
} from '@sikao/api-client/recommendationsQueries';
import type { RecommendationReadV2 } from '@sikao/api-client/types/home';
import { Button } from '../../../components/form';
import styles from './RecommendationSection.module.css';

/*
 * RecommendationCard — single recommendation row.
 *
 * Why: minimal card with title + reason + meta + two CTAs.
 *      accept(session) → POST accept with action='session', then
 *        navigate to /practice/sessions/:id (Practice line owns the
 *        target route; missing-route fallback lands on BootCard).
 *      reject (wave 1) → POST reject with reason='not-interested';
 *        wave 2 swaps for RejectFeedbackDialog + draft store.
 *
 *      AGENT-H7: accept response is inspected in priority order
 *      redirectUrl → sessionId → BootCard fallback. Never silently
 *      no-ops.
 */

interface RecommendationCardProps {
  readonly recommendation: RecommendationReadV2;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const navigate = useNavigate();
  const acceptMutation = useAcceptRecommendation(recommendation.id);
  const rejectMutation = useRejectRecommendation(recommendation.id);

  const handleAcceptSession = () => {
    acceptMutation.mutate(
      { action: 'session' },
      {
        onSuccess: (response) => {
          if (response.redirectUrl) {
            navigate(response.redirectUrl);
            return;
          }
          if (response.sessionId !== null && response.sessionId !== undefined) {
            navigate(`/practice/sessions/${response.sessionId}`);
            return;
          }
          // Fail-fast surface: backend returned ok but no target → land on
          // BootCard placeholder so the user sees a clear "coming soon"
          // rather than a silent no-op.
          navigate('/boot?reason=coming-soon-practice');
        },
      },
    );
  };

  const handleReject = () => {
    rejectMutation.mutate({ reason: 'not-interested' });
  };

  return (
    <li className={styles.card} data-testid={`home-recommendation-${recommendation.id}`}>
      <span className={styles.cardTitle}>{recommendation.title}</span>
      <span className={styles.cardReason}>{recommendation.reason}</span>
      <span className={styles.cardMeta}>
        <span>{recommendation.estimatedMinutes} 分钟</span>
        <span>{recommendation.actionType}</span>
      </span>
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="sm"
          disabled={acceptMutation.isPending}
          onClick={handleAcceptSession}
        >
          {recommendation.cta || '开始'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={rejectMutation.isPending}
          onClick={handleReject}
        >
          不感兴趣
        </Button>
      </div>
    </li>
  );
}
