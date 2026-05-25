// lint-allow-ui-copy: V5 D.4.1 Section C copy.
import { useState } from 'react';
import type { RecommendationReadV2 } from '@sikao/api-client/types/home';
import { Button } from '../../../components/form';
import { AcceptOptionMenu } from './AcceptOptionMenu';
import { RejectFeedbackDialog } from './RejectFeedbackDialog';
import styles from './RecommendationSection.module.css';

/*
 * RecommendationCard — single recommendation row with full action UX.
 *
 * Why: minimal card with title + reason + meta + two CTAs.
 *      "开始" → opens AcceptOptionMenu (立即开始 / 排入计划 date picker).
 *      "不感兴趣" → opens RejectFeedbackDialog (reason picker + note +
 *        draft restore via useRecommendationDraftStore).
 *
 *      Hosting both modals at the card level keeps the per-rec mutation
 *      hooks scoped (one accept + one reject hook per card) and avoids
 *      lifting state up to the section.
 */

interface RecommendationCardProps {
  readonly recommendation: RecommendationReadV2;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <li className={styles.card} data-testid={`home-recommendation-${recommendation.id}`}>
      <span className={styles.cardTitle}>{recommendation.title}</span>
      <span className={styles.cardReason}>{recommendation.reason}</span>
      <span className={styles.cardMeta}>
        <span>{recommendation.estimatedMinutes} 分钟</span>
        <span>{recommendation.actionType}</span>
      </span>
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={() => setAcceptOpen(true)}>
          {recommendation.cta || '开始'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setRejectOpen(true)}>
          不感兴趣
        </Button>
      </div>
      <AcceptOptionMenu
        recommendation={recommendation}
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
      />
      <RejectFeedbackDialog
        recommendation={recommendation}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
      />
    </li>
  );
}
