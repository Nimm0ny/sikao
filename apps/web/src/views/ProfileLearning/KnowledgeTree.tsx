// lint-allow-ui-copy: V5 ProfileLearning KnowledgeTree copy. CJK strings
// are visual contract from Profile Learning v1.html lines 91-114.
import { useProgressWeakness, useProgressOverview } from '@sikao/api-client/progressQueries';
import { Panel } from '../../components/layout';
import { Skeleton } from '../../components/atom/Skeleton';
import { EmptyState } from '../../components/atom/EmptyState';
import styles from './KnowledgeTree.module.css';

/*
 * KnowledgeTree — ProfileLearning knowledge tree (4-col grid).
 *
 * Why: sik-fu-b §2.5 — 4-column grid (name | bar | val | actions).
 *      Severity-based row tinting:
 *        - is-weak (<= 50%) -> err
 *        - is-mid  (51-70%) -> warn
 *        - default          -> ok
 *
 *      Backend API does not yet expose a hierarchical tree; we render a
 *      flat list keyed by subjectKey from useProgressWeakness().items
 *      merged with overview.subjectAccuracies (so well-performing modules
 *      are also visible). When data is empty we render a friendly empty
 *      state.
 *
 *      AGENT-H7: accuracy missing/non-finite renders as '—', not 0%.
 */

const ERR_THRESHOLD_PCT = 50;
const WARN_THRESHOLD_PCT = 70;

interface TreeRow {
  readonly key: string;
  readonly label: string;
  readonly accuracyPct: number | null;
  readonly answered: number;
}

function parseAccuracyPct(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 1000) / 10;
}

function severityOf(pct: number | null): 'err' | 'warn' | 'ok' {
  if (pct === null) return 'ok';
  if (pct <= ERR_THRESHOLD_PCT) return 'err';
  if (pct <= WARN_THRESHOLD_PCT) return 'warn';
  return 'ok';
}

export function KnowledgeTree() {
  const weaknessQ = useProgressWeakness();
  const overviewQ = useProgressOverview();

  if (weaknessQ.isLoading || overviewQ.isLoading) {
    return (
      <Panel title="知识树">
        <Skeleton variant="rect" height={240} />
      </Panel>
    );
  }

  // Merge weakness items with subjectAccuracies for full coverage.
  const rowMap = new Map<string, TreeRow>();
  for (const it of weaknessQ.data?.items ?? []) {
    rowMap.set(it.subjectKey, {
      key: it.subjectKey,
      label: it.subjectLabel,
      accuracyPct: parseAccuracyPct(it.accuracy),
      answered: it.answered,
    });
  }
  for (const it of overviewQ.data?.subjectAccuracies ?? []) {
    if (rowMap.has(it.subjectKey)) continue;
    rowMap.set(it.subjectKey, {
      key: it.subjectKey,
      label: it.subjectLabel,
      accuracyPct: parseAccuracyPct(it.accuracy),
      answered: it.answered ?? 0,
    });
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const aPct = a.accuracyPct ?? Number.MAX_VALUE;
    const bPct = b.accuracyPct ?? Number.MAX_VALUE;
    return aPct - bPct;
  });

  if (rows.length === 0) {
    return (
      <Panel title="知识树">
        <EmptyState title="尚无知识树数据" description="完成不同模块的练习以填充知识树。" />
      </Panel>
    );
  }

  return (
    <Panel title="知识树">
      <ul className={styles.list} data-testid="profile-learning-knowledge-tree" role="list">
        {rows.map((row) => {
          const sev = severityOf(row.accuracyPct);
          const widthPct = row.accuracyPct === null ? 0 : Math.max(0, Math.min(100, row.accuracyPct));
          return (
            <li key={row.key} className={styles.row} data-severity={sev} data-testid={`tree-row-${row.key}`}>
              <span className={styles.name} title={row.label}>{row.label}</span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} data-severity={sev} style={{ width: `${widthPct}%` }} />
              </span>
              <span className={styles.val}>
                {row.accuracyPct === null ? '—' : `${row.accuracyPct.toFixed(1)}%`}
              </span>
              <span className={styles.actions}>
                <span className={styles.count}>{row.answered} 题</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
