// lint-allow-ui-copy: V5 D.4.1 Section C feed-item copy. CJK strings are
// visual contract from sik-fu-d §2.2.
import { useState } from 'react';
import { useRecommendationDraftStore } from '@sikao/domain';
import type { RecommendationReadV2 } from '@sikao/api-client/types/home';
import { SpriteIcon } from '../../../components/atom/SpriteIcon';
import { AcceptOptionMenu } from './AcceptOptionMenu';
import { RejectFeedbackDialog } from './RejectFeedbackDialog';
import { recommendationVisualSpec } from './recommendationActionType';
import styles from './RecommendationSection.module.css';

/*
 * RecommendationCard — single feed-item with kind tint + whole-row click.
 *
 * Why: Home Section C now follows the live backend actionType contract:
 *        continue       -> k-practice
 *        review         -> k-review
 *        rest           -> k-rest
 *        review_session -> k-review (legacy pending-row compatibility)
 *
 *      AGENT-H7: unsupported actionType throws immediately; we do not
 *      silently coerce unknown backend values into a default card.
 */

interface RecommendationCardProps {
  readonly recommendation: RecommendationReadV2;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCycle, setRejectCycle] = useState(0);
  const [rejectDraftSnapshot, setRejectDraftSnapshot] = useState<{ reason: string; note: string | null } | null>(null);
  const getDraft = useRecommendationDraftStore((state) => state.getDraft);
  const { kind, icon } = recommendationVisualSpec(recommendation.actionType);
  const pillText = recommendation.estimatedMinutes
    ? `${recommendation.estimatedMinutes} 分钟`
    : null;

  return (
    <>
      <li className={styles.feedItem} data-kind={kind} data-testid={`home-recommendation-${recommendation.id}`}>
        <button
          type="button"
          className={styles.feedButton}
          onClick={() => setMenuOpen(true)}
          aria-label={`${recommendation.title} — 点击查看操作`}
        >
          <span className={styles.feedIcon} data-kind={kind} aria-hidden="true">
            <SpriteIcon id={icon} size={14} />
          </span>
          <span className={styles.feedMain}>
            <span className={styles.feedName}>{recommendation.title}</span>
            <span className={styles.feedSub}>{recommendation.reason}</span>
          </span>
          {pillText !== null ? (
            <span className={styles.feedPill}>{pillText}</span>
          ) : null}
        </button>
      </li>
      <AcceptOptionMenu
        recommendation={recommendation}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onReject={() => {
          setRejectDraftSnapshot(getDraft(recommendation.id));
          setRejectCycle((cycle) => cycle + 1);
          setMenuOpen(false);
          setRejectOpen(true);
        }}
      />
      <RejectFeedbackDialog
        key={`reject-${recommendation.id}-${rejectCycle}`}
        recommendation={recommendation}
        initialDraft={rejectDraftSnapshot}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
      />
    </>
  );
}
