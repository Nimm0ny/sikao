// lint-allow-ui-copy: V5 SIK-127 最近练习 copy. CJK strings are visual
// contract from `Home v2.1.html` bottom-row 最近练习 区域.
import { Link } from 'react-router-dom';
import { useProfileRecords } from '@sikao/api-client/profileQueries';
import { SpriteIcon } from '../../../components/atom';
import { Skeleton } from '../../../components/atom/Skeleton';
import styles from './RecentPracticeSection.module.css';

/*
 * RecentPracticeSection — V5 SIK-127 (Home v2.1 bottom-row right-bottom).
 *
 * Why: compact "最近练习" card showing the 2 most recent learning records
 *      + a "全部历史" link to /profile/records. Data from
 *      useProfileRecords({ page: 1, size: 2 }).
 *
 *      AGENT-H7: loading shows skeleton; empty/error shows nothing (card
 *      still renders with head + empty body). No fabricated records.
 */

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

export function RecentPracticeSection() {
  const query = useProfileRecords({ page: 1, size: 2 });
  const items = query.data?.items ?? [];

  return (
    <div className={styles.root} data-testid="home-recent-practice">
      <header className={styles.head}>
        <h4 className={styles.title}>最近练习</h4>
        <Link to="/profile/records" className={styles.headLink}>
          全部历史
        </Link>
      </header>
      {query.isLoading ? (
        <Skeleton variant="text" lines={2} />
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.feedItem} data-testid="home-recent-item">
              <span className={styles.feedIcon}>
                <SpriteIcon id="check" size={14} />
              </span>
              <span className={styles.feedMain}>
                <span className={styles.feedName}>{item.title}</span>
                <span className={styles.feedSub}>
                  {formatRelativeTime(item.occurredAt)}
                  {item.score ? ` · ${item.score}` : ''}
                </span>
              </span>
              {item.score ? (
                <span className={styles.feedPill}>{item.score}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
