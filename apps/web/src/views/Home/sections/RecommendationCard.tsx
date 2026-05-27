// lint-allow-ui-copy: V5 D.4.1 Section C feed-item copy. CJK strings are
// visual contract from sik-fu-d §2.2.
import { useState } from 'react';
import type { RecommendationReadV2 } from '@sikao/api-client/types/home';
import { SpriteIcon } from '../../../components/atom/SpriteIcon';
import { AcceptOptionMenu } from './AcceptOptionMenu';
import { RejectFeedbackDialog } from './RejectFeedbackDialog';
import styles from './RecommendationSection.module.css';

/*
 * RecommendationCard — single feed-item with kind 染色 + 整条点击.
 *
 * Why: sik-fu-d §2.2 — feed-item visual:
 *        feed-icon (24x24 rounded, kind-colored border) +
 *        feed-main (name + sub) +
 *        feed-pill (right badge: estimatedMinutes or sessionLength)
 *
 *      Entire card is a <button> that opens AcceptOptionMenu on click.
 *      AcceptOptionMenu now contains both accept and reject paths.
 *
 *      Kind -> visual encoding (data-kind attribute drives CSS):
 *        practice-session -> k-practice
 *        mock-exam        -> k-mock
 *        review           -> k-review
 *        milestone        -> k-milestone
 *
 *      AGENT-H7: actionType is rendered as-is from the API; no fallback
 *      mapping for unknown types (they get default styling).
 */

function kindFromActionType(actionType: string): string {
  switch (actionType) {
    case 'practice-session': return 'k-practice';
    case 'mock-exam': return 'k-mock';
    case 'review': return 'k-review';
    case 'milestone': return 'k-milestone';
    default: return 'k-default';
  }
}

function iconForKind(kind: string): string {
  switch (kind) {
    case 'k-practice': return 'nav-practice';
    case 'k-mock': return 'nav-practice';
    case 'k-review': return 'nav-review';
    case 'k-milestone': return 'nav-home';
    default: return 'nav-practice';
  }
}

interface RecommendationCardProps {
  readonly recommendation: RecommendationReadV2;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const kind = kindFromActionType(recommendation.actionType);
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
            <SpriteIcon id={iconForKind(kind)} size={14} />
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
        onReject={() => { setMenuOpen(false); setRejectOpen(true); }}
      />
      <RejectFeedbackDialog
        recommendation={recommendation}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
      />
    </>
  );
}
